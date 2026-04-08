
-- 1. Attach the existing guard_profile_billing_columns trigger to profiles table
-- (the function exists but was never attached as a trigger)
CREATE TRIGGER guard_profile_billing_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_billing_columns();

-- 2. Block authenticated users from writing to OAuth token columns
CREATE OR REPLACE FUNCTION public.guard_oauth_token_columns()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('role') != 'service_role' THEN
    NEW.access_token := OLD.access_token;
    NEW.refresh_token := OLD.refresh_token;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_oauth_token_columns
  BEFORE UPDATE ON public.platform_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_oauth_token_columns();

-- 3. Remove duplicate always-true RLS policy on cost_alerts
DROP POLICY IF EXISTS "service_role_all_cost_alerts" ON public.cost_alerts;

-- 4. Restrict demo_requests: replace open INSERT with a check function
-- Create a validation function for demo requests
CREATE OR REPLACE FUNCTION public.validate_demo_request()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Validate required fields are not empty and have reasonable length
  IF NEW.name IS NULL OR length(trim(NEW.name)) < 2 OR length(NEW.name) > 255 THEN
    RAISE EXCEPTION 'Invalid name';
  END IF;
  IF NEW.email IS NULL OR length(trim(NEW.email)) < 5 OR length(NEW.email) > 255 
     OR NEW.email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;
  IF NEW.company IS NULL OR length(trim(NEW.company)) < 2 OR length(NEW.company) > 255 THEN
    RAISE EXCEPTION 'Invalid company';
  END IF;
  -- Truncate optional fields
  IF NEW.company_size IS NOT NULL AND length(NEW.company_size) > 100 THEN
    NEW.company_size := left(NEW.company_size, 100);
  END IF;
  IF NEW.monthly_ad_spend IS NOT NULL AND length(NEW.monthly_ad_spend) > 100 THEN
    NEW.monthly_ad_spend := left(NEW.monthly_ad_spend, 100);
  END IF;
  IF NEW.main_challenge IS NOT NULL AND length(NEW.main_challenge) > 500 THEN
    NEW.main_challenge := left(NEW.main_challenge, 500);
  END IF;
  IF NEW.creative_volume IS NOT NULL AND length(NEW.creative_volume) > 100 THEN
    NEW.creative_volume := left(NEW.creative_volume, 100);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_demo_request
  BEFORE INSERT ON public.demo_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_demo_request();
