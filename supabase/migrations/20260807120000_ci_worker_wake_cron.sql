-- ═══════════════════════════════════════════════════════════════════════════
-- Cron que acorda o worker quando há trabalho na fila
--
-- ── O problema ────────────────────────────────────────────────────────────
-- O worker não atende requisição: ele lê a fila do Postgres. Quando o Fly
-- desliga a máquina — ociosidade, deploy, reciclagem de host — nada a religa,
-- e os jobs ficam parados com a tela dizendo "na fila" sem sair do lugar. Em
-- 07/08 isso aconteceu seis vezes num dia, e todas as vezes a solução foi um
-- humano digitar `fly machine start`.
--
-- Um sistema que depende de alguém olhando não está pronto.
--
-- ── Onde mora o segredo ───────────────────────────────────────────────────
-- No Vault do Supabase, não nesta migration nem em coluna comum. A migration
-- vai para o Git; o Vault não. O cron LÊ o segredo na hora de disparar.
--
-- Se o segredo não existir, a chamada falha com uma mensagem clara em
-- cron.job_run_details em vez de mandar cabeçalho vazio e receber 401 sem
-- explicação.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;


create or replace function public.ci_wake_worker_tick()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_url     text;
  v_segredo text;
begin
  -- Os dois vêm do Vault. `ci_supabase_url` evita depender de current_setting,
  -- que não existe no contexto do cron.
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'ci_supabase_url' limit 1;
  select decrypted_secret into v_segredo
    from vault.decrypted_secrets where name = 'ci_worker_secret' limit 1;

  if v_url is null or v_segredo is null then
    raise exception
      'ci_wake_worker_tick: faltam segredos no Vault (ci_supabase_url e/ou ci_worker_secret)';
  end if;

  -- pg_net é assíncrono: devolve o id da requisição e não bloqueia o cron.
  -- O resultado fica em net._http_response, com o corpo que a função devolveu.
  perform net.http_post(
    url     := v_url || '/functions/v1/ci-worker-wake',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-ci-worker-secret', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
end;
$$;

comment on function public.ci_wake_worker_tick() is
  'Chama ci-worker-wake, que liga a máquina do Fly SE houver job na fila. '
  'Segredos vêm do Vault, nunca desta migration.';

revoke all on function public.ci_wake_worker_tick() from public, anon, authenticated;


-- ── Agendamento ────────────────────────────────────────────────────────────
-- A cada 2 minutos. O job leva ~2,5 min, então esse intervalo detecta uma
-- queda antes de a fila acumular, sem martelar a API do Fly.
--
-- Desagenda antes de agendar: rodar esta migration duas vezes não pode criar
-- dois cron disparando em paralelo.
do $$
begin
  perform cron.unschedule('ci-wake-worker');
exception when others then
  null;  -- não existia ainda
end $$;

select cron.schedule('ci-wake-worker', '*/2 * * * *', 'select public.ci_wake_worker_tick()');


-- ═══════════════════════════════════════════════════════════════════════════
-- ANTES DE RODAR: guarde os dois segredos no Vault
--
-- Troque os valores e execute UMA VEZ. Depois disso eles nunca mais aparecem
-- em SQL nenhum.
--
--   select vault.create_secret(
--     'https://SEU-PROJETO.supabase.co', 'ci_supabase_url',
--     'URL do projeto, usada pelo cron para chamar a edge function');
--
--   select vault.create_secret(
--     'MESMO-VALOR-DO-CI_WORKER_SECRET', 'ci_worker_secret',
--     'Segredo compartilhado com ci-worker-wake e ci-worker-write');
--
-- E nos secrets das edge functions (pelo Lovable):
--   FLY_API_TOKEN   token do Fly com permissão de start de máquina
--   FLY_APP_NAME    adbrief-ci-worker   (opcional, este é o padrão)
-- ═══════════════════════════════════════════════════════════════════════════


-- ── Conferência ────────────────────────────────────────────────────────────
select jobname, schedule, active from cron.job where jobname = 'ci-wake-worker';
