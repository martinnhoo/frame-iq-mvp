-- ═══════════════════════════════════════════════════════════════════════════
-- O4a · A contagem da fila sai do navegador
--
-- ── Dívida que eu mesmo criei hoje ────────────────────────────────────────
-- A BarraStatus lê a coluna `status` de TODAS as linhas de ci_analysis_jobs e
-- ci_download_jobs, a cada 8 segundos, e conta no JavaScript. Com 40 jobs é
-- irrelevante. Com 3.000 são 3.000 linhas trafegadas oito vezes por minuto por
-- aba aberta; com 50.000, a barra de status vira a consulta mais cara do
-- produto — e ela existe justamente para ser barata e estar sempre visível.
--
-- O agravante é que o worker está competindo pelo mesmo banco exatamente
-- quando a fila está cheia, que é quando a barra mais é olhada.
--
-- ── Uma chamada, uma linha ────────────────────────────────────────────────
-- A função devolve UMA linha com tudo o que a barra precisa. O `group by` roda
-- no Postgres, sobre índice, e o que trafega são sete inteiros.
--
-- ── Sobre `ultimo_evento_seg` ─────────────────────────────────────────────
-- É o sinal que distingue "o worker está lento" de "o worker morreu", e a barra
-- depende dele para decidir se avisa. Vem junto para não virar uma segunda
-- chamada — duas consultas para desenhar uma barra seria trocar um problema
-- por outro.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.ci_queue_status(p_brand_id uuid default null)
returns table (
  analise_rodando   int,
  analise_fila      int,
  analise_falhou    int,
  analise_total     int,
  download_rodando  int,
  download_fila     int,
  download_falhou   int,
  download_total    int,
  ultimo_evento_seg int   -- segundos desde o último sinal de vida do worker
)
language sql
stable
security invoker
set search_path = public
as $$
  with a as (
    select
      count(*) filter (where status = 'running')                 as rodando,
      count(*) filter (where status in ('queued','retrying'))    as fila,
      count(*) filter (where status = 'failed')                  as falhou,
      count(*)                                                   as total
    from public.ci_analysis_jobs j
    -- p_brand_id nulo = todas as marcas do usuário. A RLS já limita o que ele
    -- enxerga, então não há vazamento; o filtro aqui é de escopo, não de
    -- segurança.
    where p_brand_id is null or j.brand_id = p_brand_id
  ),
  d as (
    select
      count(*) filter (where status = 'running')                 as rodando,
      count(*) filter (where status in ('queued','retrying'))    as fila,
      count(*) filter (where status = 'failed')                  as falhou,
      count(*)                                                   as total
    from public.ci_download_jobs j
    where p_brand_id is null or j.brand_id = p_brand_id
  ),
  ev as (
    -- Sem filtro de marca de propósito: a pergunta é "o worker está vivo?",
    -- e ele é um só para todas as marcas. Filtrar por marca faria uma marca
    -- ociosa parecer worker morto.
    select extract(epoch from (now() - max(created_at)))::int as seg
      from public.ci_job_events
  )
  select
    a.rodando::int, a.fila::int, a.falhou::int, a.total::int,
    d.rodando::int, d.fila::int, d.falhou::int, d.total::int,
    ev.seg
  from a, d, ev;
$$;

revoke all on function public.ci_queue_status(uuid) from public;
grant execute on function public.ci_queue_status(uuid) to authenticated;

comment on function public.ci_queue_status(uuid) is
  'Estado da fila em uma linha, para a barra de status. Substitui a leitura de '
  'duas tabelas inteiras no navegador a cada 8 segundos.';


-- Índices para os filtros da função. `ci_job_events` já tinha índice por
-- (brand_id, created_at desc), mas a consulta de vida usa max(created_at) sem
-- marca — sem este índice ela vira varredura completa da tabela que mais
-- cresce no sistema.
create index if not exists idx_ci_analysis_jobs_brand_status
  on public.ci_analysis_jobs(brand_id, status);
create index if not exists idx_ci_download_jobs_brand_status
  on public.ci_download_jobs(brand_id, status);
create index if not exists idx_ci_job_events_created
  on public.ci_job_events(created_at desc);
