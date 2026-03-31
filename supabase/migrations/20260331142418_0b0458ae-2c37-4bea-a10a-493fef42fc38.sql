-- 1. ai_action_log: Enable RLS + add policies
ALTER TABLE public.ai_action_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own action logs" ON public.ai_action_log;
CREATE POLICY "Users view own action logs"
  ON public.ai_action_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own action logs" ON public.ai_action_log;
CREATE POLICY "Users insert own action logs"
  ON public.ai_action_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access ai_action_log" ON public.ai_action_log;
CREATE POLICY "Service role full access ai_action_log"
  ON public.ai_action_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. platform_connections: Remove duplicate overlapping policy
DROP POLICY IF EXISTS "Users see own connections" ON public.platform_connections;

-- 3. Fix function search_path on functions that are missing it
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_chat_usage(p_user_id uuid, p_daily_cap integer, p_today text, p_month_key text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $function$
DECLARE
  v_daily   integer := 0;
  v_monthly integer := 0;
BEGIN
  INSERT INTO free_usage (user_id, chat_count, last_reset, monthly_msg_count, monthly_reset)
  VALUES (p_user_id, 1, p_today, 1, p_month_key)
  ON CONFLICT (user_id) DO UPDATE SET
    chat_count        = CASE
                          WHEN free_usage.last_reset = p_today
                          THEN free_usage.chat_count + 1
                          ELSE 1
                        END,
    last_reset        = p_today,
    monthly_msg_count = CASE
                          WHEN free_usage.monthly_reset = p_month_key
                          THEN free_usage.monthly_msg_count + 1
                          ELSE 1
                        END,
    monthly_reset     = p_month_key
  RETURNING
    chat_count,
    monthly_msg_count
  INTO v_daily, v_monthly;

  IF v_daily > p_daily_cap THEN
    UPDATE free_usage
    SET chat_count = p_daily_cap
    WHERE user_id = p_user_id AND last_reset = p_today;

    RETURN jsonb_build_object(
      'allowed', false,
      'daily_count', p_daily_cap,
      'monthly_count', v_monthly
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'daily_count', v_daily,
    'monthly_count', v_monthly
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.adbrief_invoke_function(fn_name text, payload text DEFAULT '{}'::text)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path = public
AS $function$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/' || fn_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := payload::jsonb
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'adbrief_invoke_function failed for %: %', fn_name, SQLERRM;
END;
$function$;