-- Schedule the 2 action_outcomes measurement crons.
--
-- These are the consumer side of the dataset action_outcomes feeds. Both
-- run hourly, on different minutes, to bound work per execution and avoid
-- hammering Meta's API with simultaneous bursts.
--
--   :15  measure-24h   — picks up rows ≥24h old, captures metrics_after_24h
--   :45  measure-72h   — picks up rows ≥72h old, finalizes + computes verdict
--
-- We extend public.adbrief_setup_cron() (defined in
-- 20260418155730_*.sql) to include these alongside the existing 8 jobs.
-- After this migration, run `select public.adbrief_setup_cron();` once
-- to register them.

create or replace function public.adbrief_setup_cron() returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jobs jsonb;
begin
  -- Remove old adbrief schedules (clean slate per run)
  perform cron.unschedule(jobname)
  from cron.job
  where jobname like 'adbrief-%';

  -- Existing 8 schedules
  perform public.adbrief_schedule_edge('adbrief-sync-ad-diary',       '0 9 * * *',   'sync-ad-diary',         '{}');
  perform public.adbrief_schedule_edge('adbrief-daily-intelligence',  '0 11 * * *',  'daily-intelligence',    '{}');
  perform public.adbrief_schedule_edge('adbrief-market-intelligence', '30 11 * * *', 'market-intelligence',   '{}');
  perform public.adbrief_schedule_edge('adbrief-creative-director',   '0 11 * * 1',  'creative-director',     '{}');
  perform public.adbrief_schedule_edge('adbrief-weekly-report',       '0 12 * * 0',  'weekly-report',         '{}');
  perform public.adbrief_schedule_edge('adbrief-trend-watch',         '0 */2 * * *', 'trend-watcher',         '{"mode":"auto","geo":"BR"}');
  perform public.adbrief_schedule_edge('adbrief-critical-alerts',     '0 */6 * * *', 'check-critical-alerts', '{}');
  perform public.adbrief_schedule_edge('adbrief-email-lifecycle',     '0 10 * * *',  'email-lifecycle',       '{}');

  -- New: action_outcomes measurement (Phase 2b)
  --
  -- 24h cron at :15 — captures fast-effect signals (CTR/CPC).
  -- 72h cron at :45 — final verdict + improved + recovery_pct + finalize.
  -- Hourly because we want each row processed within ~1h of its window
  -- becoming due, with low per-run cost (BATCH_LIMIT=50 inside the fns).
  perform public.adbrief_schedule_edge('adbrief-outcomes-measure-24h', '15 * * * *', 'action-outcomes-measure-24h', '{}');
  perform public.adbrief_schedule_edge('adbrief-outcomes-measure-72h', '45 * * * *', 'action-outcomes-measure-72h', '{}');

  select jsonb_agg(jsonb_build_object('name', jobname, 'schedule', schedule, 'active', active) order by jobname)
  into v_jobs
  from cron.job
  where jobname like 'adbrief-%';

  return jsonb_build_object('ok', true, 'jobs', v_jobs);
end;
$$;

-- Run setup so the new schedules go live immediately. Idempotent — wipes
-- and recreates all adbrief-* jobs, no duplicates created.
select public.adbrief_setup_cron();
