-- Add RLS policies to account_alerts (currently has NONE)
ALTER TABLE public.account_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts"
ON public.account_alerts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
ON public.account_alerts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert alerts"
ON public.account_alerts FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can select alerts"
ON public.account_alerts FOR SELECT
TO service_role
USING (true);

-- Fix check_and_increment_ai_usage to recognize all plan names with correct limits
CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(p_user_id uuid, p_plan text DEFAULT 'free'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_limit integer;
  v_current integer;
  v_today date := CURRENT_DATE;
  v_plan text;
BEGIN
  -- Normalize legacy plan aliases
  v_plan := CASE p_plan
    WHEN 'creator' THEN 'maker'
    WHEN 'starter' THEN 'pro'
    WHEN 'scale' THEN 'studio'
    ELSE p_plan
  END;

  -- Correct daily limits per plan
  CASE v_plan
    WHEN 'studio' THEN v_limit := 500;
    WHEN 'pro' THEN v_limit := 200;
    WHEN 'maker' THEN v_limit := 50;
    WHEN 'free' THEN v_limit := 3;
    ELSE v_limit := 3;
  END CASE;

  -- Upsert and get current count
  INSERT INTO public.ai_daily_usage (user_id, usage_date, request_count)
  VALUES (p_user_id, v_today, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET request_count = ai_daily_usage.request_count + 1
  RETURNING request_count INTO v_current;

  IF v_current > v_limit THEN
    UPDATE public.ai_daily_usage
    SET request_count = request_count - 1
    WHERE user_id = p_user_id AND usage_date = v_today;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'current', v_current - 1,
      'limit', v_limit,
      'message', 'Daily AI request limit reached. Resets at midnight UTC.'
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'current', v_current,
    'limit', v_limit
  );
END;
$function$;