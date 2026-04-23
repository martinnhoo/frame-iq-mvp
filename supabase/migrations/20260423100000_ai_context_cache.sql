-- AI Context Cache — caches the fully-built liveMetaData + pixelInfo
-- strings used to prime the AI chat prompt. Second-turn and follow-up
-- questions within a 15-minute window reuse this cache instead of
-- re-hitting Meta Graph with 6 API calls.
--
-- Why this exists:
--   The adbrief-ai-chat edge function used to fetch insights, campaigns,
--   adsets, time series, placements, and lifetime ads on EVERY turn —
--   even when the user was just asking a follow-up ("e se eu aumentar
--   20%?"). That's wasted Meta API budget and wasted AI tokens
--   (same 5-10 KB of context re-serialized).
--
-- Shape:
--   One row per (user_id, meta_account_id, persona_id, date_window).
--   `data` holds a small JSON blob with both the liveMetaData and
--   pixelInfo strings so we don't need two columns.
--
-- TTL:
--   Enforced by the edge function (15 minutes). Meta metrics move
--   intraday; longer TTL would produce stale advice.

CREATE TABLE IF NOT EXISTS ai_context_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_account_id TEXT NOT NULL,
  persona_id UUID,

  -- Stable hash of (user, account, persona, date-window) so the edge
  -- function can look up by single key regardless of date-range shape.
  cache_key TEXT NOT NULL,

  -- { live_meta_data: string, pixel_info: string, schema_version: number }
  data JSONB NOT NULL DEFAULT '{}'::jsonb,

  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One row per cache key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_context_cache_key
  ON ai_context_cache (cache_key);

-- For TTL sweeps and observability.
CREATE INDEX IF NOT EXISTS idx_ai_context_cache_checked_at
  ON ai_context_cache (checked_at);

-- RLS — user can read their own, service role does everything else.
ALTER TABLE ai_context_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own context cache"
  ON ai_context_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all context cache"
  ON ai_context_cache FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_ai_context_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_context_cache_updated_at ON ai_context_cache;
CREATE TRIGGER ai_context_cache_updated_at
  BEFORE UPDATE ON ai_context_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_context_cache_updated_at();
