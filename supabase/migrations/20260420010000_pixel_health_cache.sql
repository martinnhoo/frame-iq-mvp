-- Pixel Health Cache — stores the latest deterministic pixel diagnostic per account.
-- Populated by pixel-health-check edge function. TTL is enforced by the function (1h).
--
-- Status values:
--   'no_pixel'     — account has zero pixels attached
--   'pixel_stale'  — pixel exists but last_fired_time is >7 days ago
--   'pixel_orphan' — pixel fires but active ads don't reference it in tracking_specs
--   'pixel_ok'     — pixel exists, fired in last 24h, active ads wired to it
--   'unknown'      — check failed (API error, no ads, etc.) — treat as ok-ish

CREATE TABLE IF NOT EXISTS pixel_health_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id UUID,
  ad_account_id TEXT NOT NULL,

  -- Canonical status (what FeedPage reads)
  status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('no_pixel', 'pixel_stale', 'pixel_orphan', 'pixel_ok', 'unknown')),

  -- Raw diagnostic payload
  pixels JSONB DEFAULT '[]',             -- [{ id, name, last_fired_time, event_counts }]
  primary_pixel_id TEXT,                 -- the main pixel we anchor on (most recently fired)
  last_fired_at TIMESTAMPTZ,             -- last_fired_time of primary pixel
  orphan_ads_count INTEGER DEFAULT 0,    -- active ads without tracking_specs pointing at primary pixel
  active_ads_checked INTEGER DEFAULT 0,  -- denominator for orphan ratio

  -- Human-readable reason (for UI/AI chat context)
  message TEXT,

  -- Cache control
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  error TEXT,                            -- populated if status='unknown' and we hit an API error

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One row per (user, account)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pixel_health_cache_user_account
  ON pixel_health_cache (user_id, ad_account_id);

CREATE INDEX IF NOT EXISTS idx_pixel_health_cache_checked_at
  ON pixel_health_cache (checked_at);

-- RLS
ALTER TABLE pixel_health_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pixel health"
  ON pixel_health_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all pixel health"
  ON pixel_health_cache FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_pixel_health_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pixel_health_updated_at ON pixel_health_cache;
CREATE TRIGGER pixel_health_updated_at
  BEFORE UPDATE ON pixel_health_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_pixel_health_updated_at();
