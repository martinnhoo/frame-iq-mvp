-- ============================================================
-- Fix: Remove SELECT policy for authenticated on raw table
-- Frontend now reads exclusively via platform_connections_safe
-- (security_invoker view — inherits RLS, excludes token columns)
-- Raw table: authenticated users retain UPDATE + DELETE only
-- ============================================================

-- Drop all SELECT policies for authenticated on the raw table
DROP POLICY IF EXISTS "platform_connections_select"   ON public.platform_connections;
DROP POLICY IF EXISTS "Users read own connections"     ON public.platform_connections;
DROP POLICY IF EXISTS "Users see own connections"      ON public.platform_connections;
DROP POLICY IF EXISTS "Users manage own connections"   ON public.platform_connections;

-- Recreate write-only policies for authenticated
-- UPDATE: change selected account, update ad_accounts list
DROP POLICY IF EXISTS "platform_connections_update"   ON public.platform_connections;
CREATE POLICY "platform_connections_update"
  ON public.platform_connections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: disconnect a platform
DROP POLICY IF EXISTS "platform_connections_delete"   ON public.platform_connections;
CREATE POLICY "platform_connections_delete"
  ON public.platform_connections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- INSERT: blocked for authenticated — OAuth flow handled by service_role only
DROP POLICY IF EXISTS "platform_connections_insert_service" ON public.platform_connections;
CREATE POLICY "platform_connections_insert_service"
  ON public.platform_connections FOR INSERT TO service_role
  WITH CHECK (true);

-- service_role: full access (OAuth exchange, token refresh, cron jobs)
DROP POLICY IF EXISTS "platform_connections_service_all" ON public.platform_connections;
CREATE POLICY "platform_connections_service_all"
  ON public.platform_connections FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Revoke column-level SELECT on tokens for authenticated (defense in depth)
REVOKE SELECT (access_token, refresh_token)
  ON public.platform_connections FROM authenticated;

-- Grant only safe columns for authenticated (for UPDATE/DELETE queries)
GRANT SELECT (
  id, user_id, persona_id, platform, status,
  ad_accounts, selected_account_id, connection_label,
  connected_at, created_at, updated_at, expires_at
) ON public.platform_connections TO authenticated;

GRANT UPDATE, DELETE ON public.platform_connections TO authenticated;

-- ── cost_alerts: add user-scoped SELECT policy ──────────────
-- Users should be able to read their own cost alerts in the app
ALTER TABLE public.cost_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cost_alerts_user_select" ON public.cost_alerts;
CREATE POLICY "cost_alerts_user_select"
  ON public.cost_alerts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cost_alerts_service" ON public.cost_alerts;
CREATE POLICY "cost_alerts_service"
  ON public.cost_alerts FOR ALL TO service_role
  USING (true) WITH CHECK (true);
