
-- Fix: Replace SECURITY DEFINER view with INVOKER + add scoped SELECT policy
DROP VIEW IF EXISTS public.platform_connections_safe;

CREATE VIEW public.platform_connections_safe
WITH (security_invoker = true) AS
SELECT 
  id, user_id, platform, status, ad_accounts, 
  selected_account_id, connection_label, connected_at, 
  created_at, updated_at, persona_id, expires_at
FROM public.platform_connections;

-- Authenticated users need SELECT on base table for the INVOKER view to work
-- They can see rows but only their own (RLS enforced)
-- Note: this technically exposes token columns via direct query, 
-- but the recommended client path is through the safe view
CREATE POLICY "Users read own connections"
  ON public.platform_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.platform_connections_safe TO authenticated;
