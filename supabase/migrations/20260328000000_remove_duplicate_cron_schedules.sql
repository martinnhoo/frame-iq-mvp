-- Remove duplicate daily-intelligence and weekly-report schedules
-- created by 20260326_daily_cron.sql which predated the main cron setup

DO $$
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname IN (
    'daily-intelligence-noon',
    'weekly-report-sunday'
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add weekly creative-loop re-learn schedule
-- Runs Monday 3h UTC — recalibrates time-decay patterns for all users
DO $$
BEGIN
  PERFORM cron.unschedule('adbrief-creative-loop-relearn');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'adbrief-creative-loop-relearn',
  '0 3 * * 1',
  $$SELECT adbrief_invoke_function('creative-loop', '{"action":"cron_relearn"}')$$
);
