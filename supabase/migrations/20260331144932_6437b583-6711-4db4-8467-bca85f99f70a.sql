
-- 1. Create a secure view that excludes OAuth tokens
CREATE OR REPLACE VIEW public.platform_connections_safe AS
SELECT 
  id, user_id, platform, status, ad_accounts, 
  selected_account_id, connection_label, connected_at, 
  created_at, updated_at, persona_id, expires_at
FROM public.platform_connections;

-- 2. Replace the overly broad ALL policy with scoped policies
-- Keep the existing "Users manage own connections" for backward compat on write ops
DROP POLICY IF EXISTS "Users manage own connections" ON public.platform_connections;

-- Authenticated users can only SELECT via the safe view (no token access)
-- Block direct SELECT on base table for authenticated role
CREATE POLICY "Service role reads connections"
  ON public.platform_connections FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Users update own connections"
  ON public.platform_connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own connections"
  ON public.platform_connections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own connections"
  ON public.platform_connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Grant access to the safe view for authenticated users
GRANT SELECT ON public.platform_connections_safe TO authenticated;
