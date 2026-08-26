-- Discovery automático: a cada 15 minutos o watcher procura upload novo nas
-- fontes ativas. Sem isto, "automático" era só um botão com nome bonito.
select public.adbrief_schedule_edge(
  'clip-network-discover',
  '*/15 * * * *',
  'clip-network-discover-youtube',
  '{}'
);

-- Reaper: job cujo lease expirou (máquina morreu no meio) volta para a fila com
-- backoff. Roda no banco, não no worker, porque o worker é justamente quem pode
-- ter morrido.
select cron.unschedule(jobname) from cron.job where jobname = 'clip-network-recover';
select cron.schedule(
  'clip-network-recover',
  '*/10 * * * *',
  $$select public.clip_recover_stuck_jobs()$$
);