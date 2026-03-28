-- Add aggregate-intelligence to weekly cron
-- Runs Saturday 6h BRT (9h UTC) — before weekly-report (Sunday) so report has fresh benchmarks

DO $$
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname = 'adbrief-aggregate-intelligence';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'adbrief-aggregate-intelligence',
  '0 9 * * 6',
  $$SELECT adbrief_invoke_function('aggregate-intelligence', '{}')$$
);
