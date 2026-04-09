-- email-lifecycle: track which drip emails each user has received
-- Column stores a JSONB array of step keys: ["day1-activation", "day3", "day5-social-proof", ...]

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email_lifecycle_sent jsonb DEFAULT '[]'::jsonb;

-- Index for filtering users who haven't completed the sequence
CREATE INDEX IF NOT EXISTS idx_profiles_lifecycle
ON profiles (created_at)
WHERE plan = 'free' OR plan IS NULL;

-- Cron job: runs daily at 10:00 UTC (7:00 BRT) — catches users at start of workday
SELECT cron.unschedule('adbrief-email-lifecycle')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'adbrief-email-lifecycle');

SELECT cron.schedule(
  'adbrief-email-lifecycle',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/email-lifecycle',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
