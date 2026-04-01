-- ============================================================
-- Fix: platform_connections_safe — eliminate SECURITY DEFINER
-- The view must use SECURITY INVOKER so it inherits base table
-- RLS policies. The WHERE clause stays as defense-in-depth.
-- Supabase (PostgreSQL 15+) supports WITH (security_invoker=true)
-- which passes the Lovable linter.
-- ============================================================

DROP VIEW IF EXISTS public.platform_connections_safe;

-- Recreate as SECURITY INVOKER — inherits RLS from base table.
-- authenticated users can only see their own rows (enforced by
-- platform_connections_select policy on the base table).
-- Tokens (access_token, refresh_token) are excluded from this view
-- AND revoked at column level for authenticated role.
CREATE VIEW public.platform_connections_safe
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  platform,
  status,
  ad_accounts,
  selected_account_id,
  connection_label,
  connected_at,
  created_at,
  updated_at,
  persona_id,
  expires_at
FROM public.platform_connections;

-- Grant SELECT on the view to authenticated
GRANT SELECT ON public.platform_connections_safe TO authenticated;
REVOKE ALL ON public.platform_connections_safe FROM anon;

-- Ensure column-level REVOKE is still in place on base table
REVOKE SELECT (access_token, refresh_token)
  ON public.platform_connections FROM authenticated;

-- Re-grant safe columns explicitly (idempotent)
GRANT SELECT (
  id, user_id, persona_id, platform, status,
  ad_accounts, selected_account_id, connection_label,
  connected_at, created_at, updated_at, expires_at
) ON public.platform_connections TO authenticated;
