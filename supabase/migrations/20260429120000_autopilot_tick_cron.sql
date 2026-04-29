-- ─────────────────────────────────────────────────────────────────────────
-- Autopilot tick — wakes the autopilot-executor edge function every 5 min.
--
-- Without this schedule the autopilot UI in /settings is purely cosmetic:
-- the user accepts terms, flips the toggle, sets thresholds — and nothing
-- happens because no process ever invokes the executor. The executor itself
-- is already coded (supabase/functions/autopilot-executor) with all
-- guardrails (per-user enabled flag, accepted_terms, paused_until,
-- min_confidence, min_amount_at_risk, daily_action_cap, allowed_action_types,
-- and idempotency on autopilot_action_log). It just needs a heartbeat.
--
-- Cadence: every 5 minutes. Each tick is cheap — the executor exits early
-- when no pending decisions qualify. 5 min matches the freshness of the
-- decision pipeline (run-decisions runs every 15 min today, so 5 min keeps
-- detection latency under one full pipeline cycle). pg_cron + pg_net are
-- already enabled in the project (see 20260325000001_setup_cron_jobs).
--
-- Auth: re-uses adbrief_invoke_function() — same helper the other 5 crons
-- use. Internally adds the service-role bearer token, so the executor's
-- isCronAuthorized() check passes.
-- ─────────────────────────────────────────────────────────────────────────

-- Unschedule any prior version of this job before re-creating it. Idempotent
-- — you can re-run this migration safely after editing the cadence.
do $$
begin
  perform cron.unschedule('adbrief-autopilot-tick');
exception when others then null;
end $$;

-- Schedule: every 5 minutes.
select cron.schedule(
  'adbrief-autopilot-tick',
  '*/5 * * * *',
  $$select adbrief_invoke_function('autopilot-executor', '{}')$$
);

-- Sanity check: confirm the job is registered.
-- (No-op for prod, useful when running interactively.)
do $$
declare
  job_count int;
begin
  select count(*) into job_count from cron.job where jobname = 'adbrief-autopilot-tick';
  if job_count = 0 then
    raise warning 'autopilot-tick cron failed to register';
  end if;
end $$;
