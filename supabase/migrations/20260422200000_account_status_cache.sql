-- Account Status Cache — stores Meta's account-level health fields.
-- Populated by account-status-check edge function. TTL is enforced by the
-- function (15 minutes) because balance and amount_spent move intraday.
--
-- Shape mirrors the AccountStatusResult returned by the edge fn:
--   { severity, message, account_status, disable_reason, spend_cap,
--     amount_spent, balance, currency, cap_remaining, checked_at, cached }

CREATE TABLE IF NOT EXISTS account_status_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_account_id TEXT NOT NULL,

  -- Full AccountStatusResult payload — the edge fn writes this verbatim so it
  -- can be served back as-is on cache hit. Keeping the whole struct in a JSONB
  -- column (instead of one column per field) insulates the DB from Meta's
  -- numeric-code evolution.
  data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Cache control. `checked_at` doubles as the authoritative timestamp stored
  -- inside `data` too, so reads can use either.
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One cache row per (user, meta account id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_status_cache_user_account
  ON account_status_cache (user_id, meta_account_id);

CREATE INDEX IF NOT EXISTS idx_account_status_cache_checked_at
  ON account_status_cache (checked_at);

-- RLS
ALTER TABLE account_status_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own account status"
  ON account_status_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all account status"
  ON account_status_cache FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_account_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS account_status_updated_at ON account_status_cache;
CREATE TRIGGER account_status_updated_at
  BEFORE UPDATE ON account_status_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_account_status_updated_at();
