-- ── free_usage: server-side chat counter with daily reset ─────────────────────
CREATE TABLE IF NOT EXISTS free_usage (
  user_id   uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  chat_count int NOT NULL DEFAULT 0,
  last_reset date NOT NULL DEFAULT CURRENT_DATE
);

-- Add last_reset column if table already exists without it
DO $$ BEGIN
  ALTER TABLE free_usage ADD COLUMN IF NOT EXISTS last_reset date NOT NULL DEFAULT CURRENT_DATE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── upgrade_events: track which gate triggers upgrade wall ────────────────────
CREATE TABLE IF NOT EXISTS upgrade_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  trigger    text NOT NULL,  -- 'chat' | 'tool' | 'account'
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS upgrade_events_user_id_idx ON upgrade_events(user_id);
CREATE INDEX IF NOT EXISTS upgrade_events_trigger_idx ON upgrade_events(trigger);

-- ── user_preferences: like/dislike learning ───────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id          uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  liked_patterns   text,
  disliked_patterns text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── user_ai_profile: add pain_point column ────────────────────────────────────
ALTER TABLE user_ai_profile ADD COLUMN IF NOT EXISTS pain_point text;

-- ── RLS policies ─────────────────────────────────────────────────────────────
ALTER TABLE free_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE upgrade_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "free_usage_own" ON free_usage;
CREATE POLICY "free_usage_own" ON free_usage FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "upgrade_events_own" ON upgrade_events;
CREATE POLICY "upgrade_events_own" ON upgrade_events FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_own" ON user_preferences;
CREATE POLICY "user_preferences_own" ON user_preferences FOR ALL USING (auth.uid() = user_id);
