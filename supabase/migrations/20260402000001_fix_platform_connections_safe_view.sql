-- ============================================================
-- Fix platform_connections_safe view
-- Problem: security_invoker=false breaks auth.uid() context
-- Solution: switch to security_invoker=true so auth.uid()
--           works correctly with the caller's JWT context
-- ============================================================

DROP VIEW IF EXISTS public.platform_connections_safe;

-- security_invoker=true: view runs as the CALLER, RLS applies normally
-- auth.uid() correctly reflects the authenticated user
CREATE VIEW public.platform_connections_safe
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  platform,
  status,
  persona_id,
  ad_accounts,
  selected_account_id,
  connection_label,
  connected_at,
  expires_at,
  created_at,
  updated_at
FROM public.platform_connections;
-- RLS policy on platform_connections (auth.uid() = user_id) handles filtering

-- Grant access
GRANT SELECT ON public.platform_connections_safe TO authenticated;
REVOKE ALL ON public.platform_connections_safe FROM anon;
