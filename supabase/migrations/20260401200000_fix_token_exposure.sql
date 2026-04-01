-- ============================================================
-- Fix: OAuth token exposure + platform_connections_safe RLS
-- Resolves two Lovable security linter warnings:
-- 1. access_token/refresh_token readable by authenticated users
-- 2. platform_connections_safe view has no RLS policies
-- ============================================================

-- ── 1. Revoke token column access from authenticated users ──
-- Tokens are only needed by edge functions (service_role).
-- Authenticated users never need access_token or refresh_token.
REVOKE SELECT (access_token, refresh_token) ON public.platform_connections FROM authenticated;

-- Explicitly grant all NON-sensitive columns to authenticated
-- (so the existing SELECT RLS policy continues to work for safe columns)
GRANT SELECT (
  id, user_id, persona_id, platform, status,
  ad_accounts, selected_account_id, connection_label,
  connected_at, created_at, updated_at, expires_at
) ON public.platform_connections TO authenticated;

-- ── 2. Recreate platform_connections_safe as SECURITY DEFINER ──
-- security_invoker view relies on base table RLS which the linter
-- doesn't detect. Switching to SECURITY DEFINER with explicit
-- WHERE clause is cleaner and passes the linter.
DROP VIEW IF EXISTS public.platform_connections_safe;

CREATE VIEW public.platform_connections_safe
WITH (security_invoker = false) AS
SELECT
  id, user_id, platform, status,
  ad_accounts, selected_account_id, connection_label,
  connected_at, created_at, updated_at, persona_id, expires_at
FROM public.platform_connections
WHERE user_id = auth.uid();

-- Grant SELECT on the safe view to authenticated users
GRANT SELECT ON public.platform_connections_safe TO authenticated;
REVOKE ALL ON public.platform_connections_safe FROM anon;

-- service_role keeps full access to base table (bypasses RLS by design)
GRANT ALL ON public.platform_connections TO service_role;
