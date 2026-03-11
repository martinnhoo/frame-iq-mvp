-- last_ai_action_at: timestamp of last AI action, used for cooldown window
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_ai_action_at timestamptz DEFAULT NULL;

-- usage_alert_flags: jsonb map of "alert_key" -> true, prevents repeat emails
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS usage_alert_flags jsonb DEFAULT '{}'::jsonb;

-- hooks_count in usage table (if not exists)
ALTER TABLE usage
  ADD COLUMN IF NOT EXISTS hooks_count integer DEFAULT 0;

-- Index for fast cooldown lookups
CREATE INDEX IF NOT EXISTS idx_profiles_last_ai_action ON profiles(last_ai_action_at);
