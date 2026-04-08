
-- 1. PROFILES: Block client-side updates to billing columns via trigger
CREATE OR REPLACE FUNCTION public.guard_profile_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only service_role can modify billing/plan columns
  IF current_setting('role') != 'service_role' THEN
    NEW.plan := OLD.plan;
    NEW.subscription_status := OLD.subscription_status;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
    NEW.current_period_end := OLD.current_period_end;
    NEW.trial_end := OLD.trial_end;
    NEW.plan_started_at := OLD.plan_started_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_billing_cols ON public.profiles;
CREATE TRIGGER guard_billing_cols
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_billing_columns();

-- 2. PLATFORM_CONNECTIONS: Drop client SELECT policy that exposes tokens
DROP POLICY IF EXISTS "Users read own connections" ON public.platform_connections;

-- 3. COST_ALERTS: Add user SELECT policy
DROP POLICY IF EXISTS "Users can view own cost alerts" ON public.cost_alerts;
CREATE POLICY "Users can view own cost alerts"
  ON public.cost_alerts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. CHECKOUT_ATTEMPTS: Add service-role-only policy
DROP POLICY IF EXISTS "Service role manages checkout attempts" ON public.checkout_attempts;
CREATE POLICY "Service role manages checkout attempts"
  ON public.checkout_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. FIX increment_chat_usage search_path
CREATE OR REPLACE FUNCTION public.increment_chat_usage(p_user_id uuid, p_daily_cap integer, p_today text, p_month_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
DECLARE
  v_daily   integer := 0;
  v_monthly integer := 0;
  v_today   date    := p_today::date;
  v_month   text    := p_month_key;
BEGIN
  INSERT INTO free_usage (user_id, chat_count, last_reset, monthly_msg_count, monthly_reset)
  VALUES (p_user_id, 1, v_today, 1, v_month)
  ON CONFLICT (user_id) DO UPDATE SET
    chat_count        = CASE
                          WHEN free_usage.last_reset = v_today
                          THEN free_usage.chat_count + 1
                          ELSE 1
                        END,
    last_reset        = v_today,
    monthly_msg_count = CASE
                          WHEN free_usage.monthly_reset = v_month
                          THEN free_usage.monthly_msg_count + 1
                          ELSE 1
                        END,
    monthly_reset     = v_month
  RETURNING chat_count, monthly_msg_count
  INTO v_daily, v_monthly;

  IF v_daily > p_daily_cap THEN
    UPDATE free_usage
    SET chat_count = p_daily_cap
    WHERE user_id = p_user_id AND last_reset = v_today;

    RETURN jsonb_build_object('allowed', false, 'daily_count', p_daily_cap, 'monthly_count', v_monthly);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'daily_count', v_daily, 'monthly_count', v_monthly);
END;
$$;

-- 6. Remove overly permissive "always true" INSERT policy on account_alerts for service_role
-- (service_role bypasses RLS anyway, so these are redundant)
DROP POLICY IF EXISTS "Service role can insert alerts" ON public.account_alerts;
DROP POLICY IF EXISTS "Service role can select alerts" ON public.account_alerts;

-- 7. Remove duplicate/redundant policies on user_ai_profile
DROP POLICY IF EXISTS "Users manage own profile" ON public.user_ai_profile;
DROP POLICY IF EXISTS "Users manage own ai profile" ON public.user_ai_profile;
