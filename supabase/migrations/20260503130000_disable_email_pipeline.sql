-- Desativa pipeline de email.
--
-- AdBrief virou portal interno invite-only — não dispara mais nenhum
-- email automático (welcome, confirmation, drip, trial expiring,
-- reengagement, credit alert, daily intelligence, demo followup,
-- weekly report). As edge functions correspondentes foram trocadas
-- por stubs no-op no mesmo commit.
--
-- Aqui só tiramos o cron diário do email-lifecycle. Os outros crons
-- (daily-intelligence, market-intelligence, weekly-report,
-- critical-alerts) seguem rodando porque alimentam o dashboard, mas
-- as chamadas internas pra send-*-email viram no-op.

-- Unschedule o cron explicitamente.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'adbrief-email-lifecycle') then
    perform cron.unschedule('adbrief-email-lifecycle');
  end if;
end $$;

-- Reescreve o orquestrador de schedules pra NÃO recriar o cron de
-- email-lifecycle. Mantém os outros 7 schedules canônicos.
create or replace function public.adbrief_schedule_all_canonical()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jobs jsonb;
begin
  -- Limpa todos os jobs adbrief-* primeiro
  perform cron.unschedule(jobname)
  from cron.job
  where jobname like 'adbrief-%';

  -- Recria 7 canônicos (sem adbrief-email-lifecycle)
  perform public.adbrief_schedule_edge('adbrief-sync-ad-diary',       '0 9 * * *',   'sync-ad-diary',         '{}');
  perform public.adbrief_schedule_edge('adbrief-daily-intelligence',  '0 11 * * *',  'daily-intelligence',    '{}');
  perform public.adbrief_schedule_edge('adbrief-market-intelligence', '30 11 * * *', 'market-intelligence',   '{}');
  perform public.adbrief_schedule_edge('adbrief-creative-director',   '0 11 * * 1',  'creative-director',     '{}');
  perform public.adbrief_schedule_edge('adbrief-weekly-report',       '0 12 * * 0',  'weekly-report',         '{}');
  perform public.adbrief_schedule_edge('adbrief-trend-watch',         '0 */2 * * *', 'trend-watcher',         '{"mode":"auto","geo":"BR"}');
  perform public.adbrief_schedule_edge('adbrief-critical-alerts',     '0 */6 * * *', 'check-critical-alerts', '{}');

  select jsonb_agg(jsonb_build_object('name', jobname, 'schedule', schedule, 'active', active) order by jobname)
  into v_jobs
  from cron.job
  where jobname like 'adbrief-%';

  return jsonb_build_object('ok', true, 'jobs', v_jobs);
end;
$$;

comment on function public.adbrief_schedule_all_canonical is
  'Recria os 7 crons canônicos do AdBrief. email-lifecycle foi removido — pipeline de email está desligado.';
