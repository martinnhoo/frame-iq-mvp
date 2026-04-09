-- Health scoring: track feature adoption, login frequency, usage breadth
-- Flags at-risk users (score < 0.3) for outreach

-- Add health score columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS health_score real DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS health_risk_flagged boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS login_streak integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_actions integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS cancel_feedback text,
  ADD COLUMN IF NOT EXISTS pause_until timestamptz;

-- Index for flagging at-risk users
CREATE INDEX IF NOT EXISTS idx_profiles_health_risk
ON profiles (health_score) WHERE health_risk_flagged = true;

-- Index for churn query (paid users with low health)
CREATE INDEX IF NOT EXISTS idx_profiles_paid_health
ON profiles (plan, health_score) WHERE plan != 'free';

-- Schedule health scoring cron (daily at 6am)
SELECT cron.schedule(
  'adbrief-health-scoring',
  '0 6 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/health-scoring',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );$$
);
