
-- Daily AI request tracking for rate limiting
CREATE TABLE public.ai_daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  request_count integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, usage_date)
);

ALTER TABLE public.ai_daily_usage ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (edge functions use service role)
CREATE POLICY "No public access to ai_daily_usage" ON public.ai_daily_usage
  FOR ALL TO anon, authenticated
  USING (false);

-- Function to check and increment AI usage, returns whether the request is allowed
CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(
  p_user_id uuid,
  p_plan text DEFAULT 'free'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limit integer;
  v_current integer;
  v_today date := CURRENT_DATE;
BEGIN
  -- Generous daily limits per plan
  CASE p_plan
    WHEN 'scale' THEN v_limit := 2000;
    WHEN 'studio' THEN v_limit := 500;
    WHEN 'creator' THEN v_limit := 150;
    ELSE v_limit := 50; -- free
  END CASE;

  -- Upsert and get current count
  INSERT INTO public.ai_daily_usage (user_id, usage_date, request_count)
  VALUES (p_user_id, v_today, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET request_count = ai_daily_usage.request_count + 1
  RETURNING request_count INTO v_current;

  IF v_current > v_limit THEN
    -- Rollback the increment
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
$$;
