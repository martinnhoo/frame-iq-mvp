-- Setup pg_cron schedules for AdBrief automation
-- Replaces all adbrief-* schedules with the canonical 8

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store service role key & base URL in vault (idempotent)
do $$
declare
  v_key text;
  v_url text;
begin
  -- Read existing secret refs to avoid duplicates
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'adbrief_service_role_key' limit 1;
  if v_key is null then
    -- Use the SUPABASE_SERVICE_ROLE_KEY from edge function env via a placeholder
    -- We'll store via a function call below instead
    null;
  end if;
end $$;

-- Helper: schedule a cron job that POSTs to an edge function
create or replace function public.adbrief_schedule_edge(
  p_name text,
  p_cron text,
  p_fn   text,
  p_body text default '{}'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := 'https://mtrovtowcpttdqygtrwq.supabase.co/functions/v1/' || p_fn;
  v_key text;
begin
  -- Pull service role key from vault
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'adbrief_service_role_key'
  limit 1;

  if v_key is null then
    raise exception 'Vault secret adbrief_service_role_key not set. Add it via: select vault.create_secret(''<SERVICE_ROLE_KEY>'', ''adbrief_service_role_key'');';
  end if;

  perform cron.schedule(
    p_name,
    p_cron,
    format(
      $cmd$select net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := %L::jsonb
      )$cmd$,
      v_url,
      json_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json')::text,
      p_body
    )
  );
end;
$$;

-- Wipe + recreate function (run after vault secret is set)
create or replace function public.adbrief_setup_cron() returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jobs jsonb;
begin
  -- Remove old adbrief schedules
  perform cron.unschedule(jobname)
  from cron.job
  where jobname like 'adbrief-%';

  -- Recreate the 8 canonical schedules
  perform public.adbrief_schedule_edge('adbrief-sync-ad-diary',       '0 9 * * *',   'sync-ad-diary',         '{}');
  perform public.adbrief_schedule_edge('adbrief-daily-intelligence',  '0 11 * * *',  'daily-intelligence',    '{}');
  perform public.adbrief_schedule_edge('adbrief-market-intelligence', '30 11 * * *', 'market-intelligence',   '{}');
  perform public.adbrief_schedule_edge('adbrief-creative-director',   '0 11 * * 1',  'creative-director',     '{}');
  perform public.adbrief_schedule_edge('adbrief-weekly-report',       '0 12 * * 0',  'weekly-report',         '{}');
  perform public.adbrief_schedule_edge('adbrief-trend-watch',         '0 */2 * * *', 'trend-watcher',         '{"mode":"auto","geo":"BR"}');
  perform public.adbrief_schedule_edge('adbrief-critical-alerts',     '0 */6 * * *', 'check-critical-alerts', '{}');
  perform public.adbrief_schedule_edge('adbrief-email-lifecycle',     '0 10 * * *',  'email-lifecycle',       '{}');

  select jsonb_agg(jsonb_build_object('name', jobname, 'schedule', schedule, 'active', active) order by jobname)
  into v_jobs
  from cron.job
  where jobname like 'adbrief-%';

  return jsonb_build_object('ok', true, 'jobs', v_jobs);
end;
$$;