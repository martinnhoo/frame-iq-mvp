-- ═══════════════════════════════════════════════════════════════════════════
-- Admin Cockpit — privileged backoffice for AdBrief
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Design principles:
-- 1. admin_users is a separate table — NEVER add is_admin to profiles.
--    Granting admin is an explicit row insert. Revocation sets revoked_at.
-- 2. Only service_role can SELECT/INSERT/UPDATE admin_users.
--    (admin-check edge fn runs with service role, verifies against JWT.)
-- 3. Every privileged action writes an admin_audit_log row. This is
--    append-only: no UPDATE/DELETE policies. Admins CAN read their own log
--    via the admin-audit-log edge fn (also service role).
-- 4. is_admin(uid) SECURITY DEFINER helper for use from other functions.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- admin_users — who has cockpit access
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,           -- null = active
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,                         -- optional: "founder", "support lead", etc
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_users IS
  'Privileged accounts with cockpit access. Insertions/updates only via service_role.';

CREATE INDEX IF NOT EXISTS admin_users_active_idx
  ON public.admin_users (user_id) WHERE revoked_at IS NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- admin_audit_log — immutable trail of every privileged action
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL,              -- e.g. "user_summary.view", "audit_log.view"
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_resource text,              -- e.g. "user", "campaign", "subscription"
  target_resource_id text,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  ip inet,
  user_agent text,
  request_id text
);

COMMENT ON TABLE public.admin_audit_log IS
  'Append-only audit trail. Never UPDATE or DELETE rows. Service_role writes only.';

CREATE INDEX IF NOT EXISTS admin_audit_log_admin_idx
  ON public.admin_audit_log (admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx
  ON public.admin_audit_log (target_user_id, created_at DESC)
  WHERE target_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx
  ON public.admin_audit_log (action, created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- RLS — lock down to service_role only. Client-side queries return 0 rows.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.admin_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log   ENABLE ROW LEVEL SECURITY;

-- No policies = no access from anon or authenticated roles.
-- service_role bypasses RLS by default in Supabase, so edge fns using the
-- service key can read/write freely. RPCs from the client stay locked out.

-- ───────────────────────────────────────────────────────────────────────────
-- Helper function — is_admin(uid) for use inside other SQL / RLS policies
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = check_user_id
      AND revoked_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.is_admin(uuid) IS
  'Returns true if the user has active admin access. SECURITY DEFINER so it can read admin_users despite RLS.';

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- Seed the first admin: martinhovff@gmail.com
-- ───────────────────────────────────────────────────────────────────────────
-- Uses a DO block so the migration is idempotent and won't fail on re-run.
-- If the email doesn't exist in auth.users, nothing happens (no error).

DO $$
DECLARE
  founder_id uuid;
BEGIN
  SELECT id INTO founder_id
  FROM auth.users
  WHERE email = 'martinhovff@gmail.com'
  LIMIT 1;

  IF founder_id IS NOT NULL THEN
    INSERT INTO public.admin_users (user_id, granted_by, note)
    VALUES (founder_id, founder_id, 'founder — initial admin seeded by migration')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;
