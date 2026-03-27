-- ── Fix intelligence cron schedules ──────────────────────────────────────────
-- Fixes:
-- 1. Schedule 5 was calling trend-researcher (wrong) — now calls trend-watcher
-- 2. check-critical-alerts was never scheduled — now runs every 6h
-- 3. trend-matcher was never scheduled — now runs 15min after trend-watcher

-- Remove broken/missing schedules
DO $$
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname IN (
    'adbrief-trend-watch',
    'adbrief-check-alerts',
    'adbrief-trend-matcher'
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Schedule 5: Trend Watch — every 30min, calls trend-WATCHER (not researcher)
-- trend-watcher fetches Google Trends BR, analyzes with Anthropic, saves to trend_intelligence
SELECT cron.schedule(
  'adbrief-trend-watch',
  '*/30 * * * *',
  $$SELECT adbrief_invoke_function('trend-watcher', '{"mode":"auto","geo":"BR"}')$$
);

-- Schedule 6: Check Critical Alerts — every 6h (0h, 6h, 12h, 18h UTC)
-- Checks active ad accounts for performance drops, high frequency, budget burn
-- Sends email + Telegram alerts when thresholds crossed
SELECT cron.schedule(
  'adbrief-check-alerts',
  '0 0,6,12,18 * * *',
  $$SELECT adbrief_invoke_function('check-critical-alerts', '{}')$$
);

-- Schedule 7: Trend Matcher — 15min after trend-watcher (xx:15 and xx:45)
-- Scores each active trend against all user accounts → Telegram alerts when fit >= 7
SELECT cron.schedule(
  'adbrief-trend-matcher',
  '15,45 * * * *',
  $$SELECT adbrief_invoke_function('trend-matcher', '{}')$$
);
