-- Landing Page Snapshots — cache of fetched page content per (user, url).
-- Populated by adbrief-ai-chat edge function when user shares a URL in chat.
-- Reused for 24h to avoid refetch on every message.
--
-- Source values:
--   'jina'  — fetched via https://r.jina.ai (markdown, handles JS)
--   'raw'   — fetched via native fetch() + HTML strip (fallback when Jina fails)
--   'error' — fetch failed (stored so we don't keep retrying broken URLs)

CREATE TABLE IF NOT EXISTS landing_page_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Normalized URL (lowercased scheme+host, no fragment, sorted query params)
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,  -- md5(url) — used for fast lookup

  -- Page content (capped to ~8k raw, 4k used in prompt)
  title TEXT,
  content TEXT,
  source TEXT NOT NULL DEFAULT 'jina'
    CHECK (source IN ('jina', 'raw', 'error')),
  error TEXT,

  -- Light structural hints extracted at fetch-time (populated when we can)
  has_fb_pixel BOOLEAN DEFAULT NULL,       -- true if fbq('init') or pixel script found
  has_conversion_event BOOLEAN DEFAULT NULL, -- true if fbq('track','Purchase|Lead|…') found
  primary_cta TEXT,                        -- first button/cta text we spotted

  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One row per (user, url) — older rows get upserted over
CREATE UNIQUE INDEX IF NOT EXISTS idx_landing_snapshots_user_url
  ON landing_page_snapshots (user_id, url_hash);

CREATE INDEX IF NOT EXISTS idx_landing_snapshots_fetched_at
  ON landing_page_snapshots (fetched_at);

-- RLS
ALTER TABLE landing_page_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own landing snapshots"
  ON landing_page_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all landing snapshots"
  ON landing_page_snapshots FOR ALL
  USING (auth.role() = 'service_role');
