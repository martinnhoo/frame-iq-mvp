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
