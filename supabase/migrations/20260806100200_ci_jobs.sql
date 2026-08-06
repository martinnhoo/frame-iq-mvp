-- ═══════════════════════════════════════════════════════════════════════════
-- Creative Intelligence — filas persistentes
--
-- A fila mora no Postgres, não na memória do worker. Requisito explícito:
-- "reiniciar o servidor não apaga filas nem dados". Se o worker do Fly.io cair
-- no meio de um download, o job volta para 'queued' pelo reaper e outro worker
-- pega. Nada se perde e nada roda duas vezes.
--
-- ── Como o worker pega trabalho sem corrida ────────────────────────────────
-- Via a função ci_claim_job(), que usa
--   SELECT ... FOR UPDATE SKIP LOCKED
-- Isso é o que permite rodar N workers em paralelo sem dois pegarem o mesmo
-- job. Sem o SKIP LOCKED, o segundo worker ficaria bloqueado esperando o
-- primeiro; com ele, simplesmente pula para o próximo job livre.
--
-- ── Estados ────────────────────────────────────────────────────────────────
-- queued → running → completed
--                  ↘ failed → retrying → running
--                  ↘ blocked  (dependência não satisfeita / limite atingido)
--                  ↘ cancelled (usuário)
-- ═══════════════════════════════════════════════════════════════════════════


-- ── ci_download_jobs ────────────────────────────────────────────────────────
create table if not exists public.ci_download_jobs (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references public.ci_brands(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  media_source_id   uuid not null references public.ci_ad_media_sources(id) on delete cascade,
  ad_id             uuid not null references public.ci_ads(id) on delete cascade,

  status            text not null default 'queued'
                    check (status in ('queued','running','completed','failed','retrying','cancelled','blocked')),
  stage             text not null default 'queued',
  -- queued | fetching | hashing | deduping | uploading | linking | cleanup | complete

  progress          int not null default 0 check (progress between 0 and 100),
  priority          int not null default 100,   -- menor = antes

  -- Telemetria mostrada na UI
  bytes_total       bigint,
  bytes_downloaded  bigint not null default 0,
  bytes_per_second  bigint,

  attempts          int not null default 0,
  max_attempts      int not null default 5,
  error             text,
  error_code        text,          -- http_404 | http_429 | timeout | invalid_media | ...
  next_retry_at     timestamptz,   -- backoff exponencial: 2^n * 15s, teto 15min

  -- Resultado
  asset_id          uuid references public.ci_assets(id) on delete set null,
  was_duplicate     boolean not null default false,

  -- Lease: se o worker morrer, isto expira e o reaper devolve o job à fila.
  locked_by         text,
  locked_at         timestamptz,
  lease_expires_at  timestamptz,

  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Um job por mídia. Reimportar não reenfileira o que já foi baixado.
  unique (media_source_id)
);

create index if not exists idx_ci_dl_jobs_claim on public.ci_download_jobs(status, priority, created_at)
  where status in ('queued','retrying');
create index if not exists idx_ci_dl_jobs_brand on public.ci_download_jobs(brand_id, status);
create index if not exists idx_ci_dl_jobs_lease on public.ci_download_jobs(lease_expires_at)
  where status = 'running';


-- ── ci_analysis_jobs ────────────────────────────────────────────────────────
-- Analisa o ASSET, não o anúncio. Um asset usado por 40 anúncios é analisado
-- uma vez só — é aqui que a deduplicação vira economia de custo de LLM.
create table if not exists public.ci_analysis_jobs (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references public.ci_brands(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  asset_id          uuid not null references public.ci_assets(id) on delete cascade,

  status            text not null default 'queued'
                    check (status in ('queued','running','completed','failed','retrying','cancelled','blocked')),
  stage             text not null default 'queued',
  -- queued | downloading | probing | scenes | keyframes | audio | transcript
  -- | ocr | faces | semantic | persisting | cleanup | complete

  progress          int not null default 0 check (progress between 0 and 100),
  priority          int not null default 100,

  -- Quais camadas rodar. Permite reprocessar só o que faltou sem repagar o
  -- resto — ex.: rodar OCR num asset que já tem transcript.
  requested_stages  text[] not null default array['probe','scenes','keyframes','transcript','ocr','faces','semantic'],
  completed_stages  text[] not null default '{}',
  skipped_stages    text[] not null default '{}',   -- com o motivo em warnings
  warnings          jsonb not null default '[]'::jsonb,

  attempts          int not null default 0,
  max_attempts      int not null default 3,
  error             text,
  error_code        text,
  next_retry_at     timestamptz,

  -- Custo real desta análise, para a tela de custo estimado
  llm_provider      text,
  llm_model         text,
  llm_input_tokens  bigint,
  llm_output_tokens bigint,
  cost_usd          numeric(10,5),

  locked_by         text,
  locked_at         timestamptz,
  lease_expires_at  timestamptz,

  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (asset_id)
);

create index if not exists idx_ci_an_jobs_claim on public.ci_analysis_jobs(status, priority, created_at)
  where status in ('queued','retrying');
create index if not exists idx_ci_an_jobs_brand on public.ci_analysis_jobs(brand_id, status);
create index if not exists idx_ci_an_jobs_lease on public.ci_analysis_jobs(lease_expires_at)
  where status = 'running';


-- ── ci_job_events ───────────────────────────────────────────────────────────
-- Log append-only. É o que permite responder "por que este vídeo falhou" três
-- dias depois, e o que alimenta o histórico de jobs na página do anúncio.
create table if not exists public.ci_job_events (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  brand_id    uuid references public.ci_brands(id) on delete cascade,
  job_kind    text not null check (job_kind in ('download','analysis','import','storage','concept')),
  job_id      uuid,
  level       text not null default 'info' check (level in ('debug','info','warn','error')),
  stage       text,
  message     text not null,
  payload     jsonb not null default '{}'::jsonb,   -- NUNCA contém secret
  created_at  timestamptz not null default now()
);

create index if not exists idx_ci_job_events_job   on public.ci_job_events(job_kind, job_id, created_at desc);
create index if not exists idx_ci_job_events_brand on public.ci_job_events(brand_id, created_at desc);
create index if not exists idx_ci_job_events_error on public.ci_job_events(brand_id, created_at desc)
  where level = 'error';


-- ═══════════════════════════════════════════════════════════════════════════
-- Claim atômico
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.ci_claim_job(
  p_kind        text,          -- 'download' | 'analysis'
  p_worker_id   text,
  p_lease_secs  int default 900
)
returns setof jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  if p_kind = 'download' then
    update public.ci_download_jobs j
       set status           = 'running',
           stage            = 'fetching',
           attempts         = j.attempts + 1,
           locked_by        = p_worker_id,
           locked_at        = now(),
           lease_expires_at = now() + make_interval(secs => p_lease_secs),
           started_at       = coalesce(j.started_at, now()),
           next_retry_at    = null,
           updated_at       = now()
     where j.id = (
       select c.id from public.ci_download_jobs c
        where c.status in ('queued','retrying')
          and (c.next_retry_at is null or c.next_retry_at <= now())
        order by c.priority, c.created_at
        for update skip locked
        limit 1
     )
    returning to_jsonb(j.*) into v_row;

  elsif p_kind = 'analysis' then
    update public.ci_analysis_jobs j
       set status           = 'running',
           stage            = 'downloading',
           attempts         = j.attempts + 1,
           locked_by        = p_worker_id,
           locked_at        = now(),
           lease_expires_at = now() + make_interval(secs => p_lease_secs),
           started_at       = coalesce(j.started_at, now()),
           next_retry_at    = null,
           updated_at       = now()
     where j.id = (
       select c.id from public.ci_analysis_jobs c
        where c.status in ('queued','retrying')
          and (c.next_retry_at is null or c.next_retry_at <= now())
        order by c.priority, c.created_at
        for update skip locked
        limit 1
     )
    returning to_jsonb(j.*) into v_row;

  else
    raise exception 'ci_claim_job: kind inválido %', p_kind;
  end if;

  if v_row is not null then
    return next v_row;
  end if;
  return;
end;
$$;

-- Só o worker chama isto. PUBLIC não executa — em Postgres a função nasce com
-- EXECUTE para PUBLIC, e como é SECURITY DEFINER isso seria um buraco: qualquer
-- um com a anon key poderia sequestrar jobs. Mesmo cuidado da migration
-- 20260804090000.
revoke all on function public.ci_claim_job(text, text, int) from public, anon, authenticated;
grant execute on function public.ci_claim_job(text, text, int) to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- Reaper — devolve à fila o que ficou órfão
--
-- Worker morto no meio do job deixa a linha em 'running' para sempre. Cron
-- chama isto de minuto em minuto; jobs com lease vencido voltam para
-- 'retrying' com backoff, ou vão para 'failed' se estouraram as tentativas.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.ci_reap_stale_jobs()
returns table (kind text, reaped int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dl int;
  v_an int;
begin
  with expired as (
    update public.ci_download_jobs j
       set status        = case when j.attempts >= j.max_attempts then 'failed' else 'retrying' end,
           stage         = 'queued',
           error         = coalesce(j.error, 'lease expirado — worker não respondeu'),
           error_code    = coalesce(j.error_code, 'lease_expired'),
           -- backoff exponencial com teto de 15 min
           next_retry_at = now() + make_interval(secs => least(power(2, j.attempts) * 15, 900)),
           locked_by     = null,
           lease_expires_at = null,
           updated_at    = now()
     where j.status = 'running'
       and j.lease_expires_at is not null
       and j.lease_expires_at < now()
    returning 1
  ) select count(*) into v_dl from expired;

  with expired as (
    update public.ci_analysis_jobs j
       set status        = case when j.attempts >= j.max_attempts then 'failed' else 'retrying' end,
           stage         = 'queued',
           error         = coalesce(j.error, 'lease expirado — worker não respondeu'),
           error_code    = coalesce(j.error_code, 'lease_expired'),
           next_retry_at = now() + make_interval(secs => least(power(2, j.attempts) * 30, 1800)),
           locked_by     = null,
           lease_expires_at = null,
           updated_at    = now()
     where j.status = 'running'
       and j.lease_expires_at is not null
       and j.lease_expires_at < now()
    returning 1
  ) select count(*) into v_an from expired;

  return query select 'download'::text, v_dl union all select 'analysis'::text, v_an;
end;
$$;

revoke all on function public.ci_reap_stale_jobs() from public, anon, authenticated;
grant execute on function public.ci_reap_stale_jobs() to service_role;


-- ── updated_at ──────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['ci_download_jobs','ci_analysis_jobs'] loop
    execute format('drop trigger if exists trg_%s_touch on public.%I', t, t);
    execute format('create trigger trg_%s_touch before update on public.%I
                    for each row execute function public.ci_touch_updated_at()', t, t);
  end loop;
end $$;


-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Leitura própria (a UI precisa mostrar progresso e erro). Cancelar/retentar
-- passa por edge function, não por UPDATE direto do navegador.
do $$
declare t text;
begin
  foreach t in array array['ci_download_jobs','ci_analysis_jobs','ci_job_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read_own', t);
    execute format('create policy %I on public.%I for select to authenticated
                    using (user_id = auth.uid())', t || '_read_own', t);
  end loop;
end $$;
