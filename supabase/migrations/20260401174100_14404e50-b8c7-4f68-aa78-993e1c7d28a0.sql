
-- ============================================================
-- Security Fix: platform_connections_safe view + usage table RLS
-- ============================================================

-- 1. Fix platform_connections_safe view: ensure SECURITY INVOKER
ALTER VIEW public.platform_connections_safe SET (security_invoker = on);

-- 2. Remove direct client SELECT on raw platform_connections tokens
-- Drop the existing SELECT policy that exposes tokens
DROP POLICY IF EXISTS "Users read own connections" ON public.platform_connections;

-- Revoke SELECT on token columns from authenticated/anon
REVOKE SELECT (access_token, refresh_token) ON public.platform_connections FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.platform_connections FROM anon;

-- Grant SELECT only on safe columns for authenticated (needed for UPDATE/DELETE WHERE clauses)
GRANT SELECT (
  id, user_id, persona_id, platform, status,
  ad_accounts, selected_account_id, connection_label,
  connected_at, created_at, updated_at, expires_at
) ON public.platform_connections TO authenticated;

-- 3. Restrict free_usage: SELECT-only for authenticated, mutations via service_role
DROP POLICY IF EXISTS "free_usage_own" ON public.free_usage;

CREATE POLICY "free_usage_select_own"
  ON public.free_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "free_usage_service_all"
  ON public.free_usage FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 4. Restrict usage table: remove UPDATE for authenticated, mutations via service_role
DROP POLICY IF EXISTS "Users can update own usage" ON public.usage;
DROP POLICY IF EXISTS "Users can insert own usage" ON public.usage;

CREATE POLICY "usage_service_write"
  ON public.usage FOR ALL TO service_role
  USING (true) WITH CHECK (true);
