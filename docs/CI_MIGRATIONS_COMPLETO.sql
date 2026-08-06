-- ═══════════════════════════════════════════════════════════════════════════
-- CREATIVE INTELLIGENCE — TODAS AS MIGRATIONS NUMA COLADA SÓ
--
-- Cole ESTE ARQUIVO INTEIRO no SQL Editor do Supabase do projeto de produção
-- (mtrovtowcpttdqygtrwq) e execute uma vez.
--
-- É seguro:
--   · Não altera nem remove NENHUMA tabela existente.
--   · public.ads (seus anúncios reais da Meta) NÃO é tocada.
--   · Tudo que cria tem prefixo ci_.
--   · É idempotente — rodar duas vezes não quebra nada.
--
-- Cria: 32 tabelas, 10 views, 6 funções, 33 policies RLS, 117 índices e o
-- bucket privado ci-media.
--
-- Testado rodando a sequência 3x seguidas contra um Postgres real.
-- No fim do arquivo há as consultas de validação.
-- ═══════════════════════════════════════════════════════════════════════════



-- ###########################################################################
-- BLOCO: 20260806100000_ci_core
-- ###########################################################################

-- ═══════════════════════════════════════════════════════════════════════════
-- Creative Intelligence — núcleo: marcas, páginas, anúncios, mídias, imports
--
-- Módulo novo. Importa milhares de anúncios de uma marca a partir do Facebook
-- Ad Library (via SpreshApp), guarda os assets em nuvem e transforma tudo numa
-- base navegável de conceitos, pessoas, mensagens e cenas.
--
-- ── Por que prefixo ci_ em public, e não um schema ci ──────────────────────
-- Um schema separado seria mais limpo, mas o PostgREST só expõe os schemas
-- listados na config do projeto. Mudar isso é alteração de infra, e o deploy
-- aqui passa pelo Lovable. O prefixo dá o mesmo isolamento de nome sem tocar
-- em config nenhuma. Em especial: public.ads (anúncios reais das contas Meta
-- do usuário, com performance de verdade) NÃO é tocada. public.ci_ads é outra
-- coisa — anúncios de terceiros observados na biblioteca pública.
--
-- ── Sobre os dados desta base ──────────────────────────────────────────────
-- Nada aqui é performance da conta do usuário. Spend e impressões, quando
-- existem, vêm da transparência DSA e são ESTIMATIVAS de terceiros. Ficam em
-- ci_estimated_metrics (migration 100500), nunca em colunas soltas que possam
-- ser confundidas com métricas reais.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── ci_brands ───────────────────────────────────────────────────────────────
-- A marca sob investigação. Shapermint é a primeira.
create table if not exists public.ci_brands (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  slug         text not null,          -- 'shapermint' — usado na URL
  name         text not null,
  market       text default 'US',
  language     text default 'en',
  website      text,
  notes        text default '',
  is_demo      boolean not null default false,  -- regra 7: DEMO nunca se mistura em silêncio
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, slug)
);

create index if not exists idx_ci_brands_user on public.ci_brands(user_id, created_at desc);


-- ── ci_brand_pages ──────────────────────────────────────────────────────────
-- Páginas do Facebook candidatas/confirmadas para a marca. O brand search
-- devolve várias (a oficial + fakes + revendedores); o usuário escolhe qual é
-- a oficial e só ela fica is_selected.
create table if not exists public.ci_brand_pages (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references public.ci_brands(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  page_id        text not null,        -- id da página no Facebook
  page_name      text not null,
  category       text,
  likes          bigint,
  verification   text,                 -- BLUE_VERIFIED | NOT_VERIFIED | ...
  ig_username    text,
  ig_followers   bigint,
  page_alias     text,
  image_uri      text,
  is_selected    boolean not null default false,
  raw_payload    jsonb,                -- resposta original, para auditoria
  discovered_at  timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  unique (brand_id, page_id)
);

create index if not exists idx_ci_brand_pages_brand
  on public.ci_brand_pages(brand_id, is_selected desc, likes desc nulls last);

-- Só uma página selecionada por marca.
create unique index if not exists uq_ci_brand_pages_one_selected
  on public.ci_brand_pages(brand_id) where is_selected;


-- ── ci_import_runs ──────────────────────────────────────────────────────────
-- Cada execução de importação. Guarda o cursor para retomar depois e o custo
-- em créditos realmente gasto — o teto é checado ANTES de cada página.
create table if not exists public.ci_import_runs (
  id                  uuid primary key default gen_random_uuid(),
  brand_id            uuid not null references public.ci_brands(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  brand_page_id       uuid references public.ci_brand_pages(id) on delete set null,

  source              text not null default 'spreshapp',
  endpoint            text not null,   -- 'brand_ads' | 'ad_search' | 'ad_details' | 'page_search'
  filters             jsonb not null default '{}'::jsonb,

  status              text not null default 'queued'
                      check (status in ('queued','running','completed','failed','cancelled','partial')),

  -- Limites desta execução, copiados da config no momento do disparo. Ficam
  -- gravados para a auditoria mostrar sob que teto a run rodou.
  max_ads             int not null default 20,
  max_credits         int not null default 50,

  -- Contadores reais
  pages_fetched       int not null default 0,
  ads_returned        int not null default 0,
  ads_created         int not null default 0,
  ads_updated         int not null default 0,
  ads_skipped_known   int not null default 0,   -- já tínhamos o ad_archive_id
  media_urls_found    int not null default 0,
  credits_estimated   int not null default 0,   -- mostrado ao usuário antes
  credits_spent       int not null default 0,   -- 1 por ad retornado, 5 por page-search

  next_cursor         text,                     -- retomar de onde parou
  error               text,
  started_at          timestamptz,
  finished_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_ci_import_runs_brand  on public.ci_import_runs(brand_id, created_at desc);
create index if not exists idx_ci_import_runs_status on public.ci_import_runs(status, created_at);


-- ── ci_ads ──────────────────────────────────────────────────────────────────
-- Um anúncio observado na biblioteca pública. NÃO é public.ads.
create table if not exists public.ci_ads (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references public.ci_brands(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  import_run_id     uuid references public.ci_import_runs(id) on delete set null,

  -- Identidade na origem
  source            text not null default 'spreshapp',
  ad_archive_id     text not null,
  page_id           text,
  page_name         text,
  page_profile_uri  text,

  -- Criativo
  body_text         text,
  headline          text,
  description       text,
  cta               text,
  landing_page      text,
  display_format    text,   -- VIDEO | IMAGE | DCO | CAROUSEL | ...
  media_type        text,   -- normalizado: video | image | carousel | unknown

  -- Janela de veiculação
  started_on        timestamptz,
  ended_on          timestamptz,
  is_active         boolean,
  running_days      int,     -- derivado; recalculado no refresh

  -- Segmentação declarada
  countries         text[] default '{}',
  languages         text[] default '{}',
  platforms         text[] default '{}',

  -- Auditoria de origem — regra: guardar sempre o payload original
  raw_payload       jsonb not null,
  import_source     text not null default 'spreshapp',
  imported_at       timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),

  -- Marcação DEMO explícita (regra 7)
  is_demo           boolean not null default false,

  -- Ligações de análise (FK de concept adicionada na migration de taxonomia)
  concept_id        uuid,
  analysis_status   text not null default 'pending'
                    check (analysis_status in ('pending','queued','running','completed','failed','skipped')),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Idempotência: reimportar a mesma marca não duplica nem recobra
  unique (brand_id, ad_archive_id)
);

create index if not exists idx_ci_ads_brand    on public.ci_ads(brand_id, started_on desc nulls last);
create index if not exists idx_ci_ads_concept  on public.ci_ads(concept_id) where concept_id is not null;
create index if not exists idx_ci_ads_active   on public.ci_ads(brand_id, is_active, media_type);
create index if not exists idx_ci_ads_analysis on public.ci_ads(analysis_status, created_at);
create index if not exists idx_ci_ads_archive  on public.ci_ads(ad_archive_id);

-- Busca textual no copy — usada pela página Messages e pelo chat.
create index if not exists idx_ci_ads_body_fts on public.ci_ads
  using gin (to_tsvector('simple', coalesce(body_text,'') || ' ' || coalesce(headline,'')));


-- ── ci_ad_media_sources ─────────────────────────────────────────────────────
-- URL de mídia declarada pelo anúncio. Um anúncio pode ter várias (carrossel).
-- É a partir daqui que nasce um download job.
create table if not exists public.ci_ad_media_sources (
  id             uuid primary key default gen_random_uuid(),
  ad_id          uuid not null references public.ci_ads(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  media_url      text not null,
  thumbnail_url  text,
  kind           text not null default 'video' check (kind in ('video','image','thumbnail')),
  sort_order     int not null default 0,
  -- Preenchido quando o download termina. Se o asset já existia (mesmo sha256),
  -- aponta para o asset existente — é a deduplicação vista do lado do anúncio.
  asset_id       uuid,
  status         text not null default 'pending'
                 check (status in ('pending','queued','downloading','stored','duplicate','invalid','failed','skipped')),
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (ad_id, media_url)
);

create index if not exists idx_ci_media_pending on public.ci_ad_media_sources(status, created_at);
create index if not exists idx_ci_media_ad      on public.ci_ad_media_sources(ad_id, sort_order);


-- ── updated_at automático ───────────────────────────────────────────────────
create or replace function public.ci_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['ci_brands','ci_import_runs','ci_ads','ci_ad_media_sources'] loop
    execute format('drop trigger if exists trg_%s_touch on public.%I', t, t);
    execute format('create trigger trg_%s_touch before update on public.%I
                    for each row execute function public.ci_touch_updated_at()', t, t);
  end loop;
end $$;


-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Todas as tabelas são por usuário. O worker do Fly.io usa service_role, que
-- não passa por RLS — então a policy pode ser restritiva sem quebrar o job.
--
-- Escrita pelo cliente é SELECT-only nas tabelas que a importação preenche:
-- quem escreve é a edge function (service_role). Isso evita que alguém com a
-- anon key insira anúncios ou zere contadores de crédito pelo navegador —
-- mesma classe de buraco fechada na migration 20260804090000.
do $$
declare t text;
begin
  foreach t in array array['ci_brands','ci_brand_pages','ci_import_runs','ci_ads','ci_ad_media_sources'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ci_brands: o usuário cria e edita as próprias marcas pela UI.
drop policy if exists ci_brands_owner on public.ci_brands;
create policy ci_brands_owner on public.ci_brands
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- As demais: leitura própria apenas. Escrita só via service_role.
do $$
declare t text;
begin
  foreach t in array array['ci_brand_pages','ci_import_runs','ci_ads','ci_ad_media_sources'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read_own', t);
    execute format('create policy %I on public.%I for select to authenticated
                    using (user_id = auth.uid())', t || '_read_own', t);
  end loop;
end $$;


-- ── Seed ────────────────────────────────────────────────────────────────────
-- Nada é semeado aqui. A marca nasce quando o usuário roda o brand search na
-- UI, com o user_id dele. Seed cego criaria linha órfã sem dono.


-- ###########################################################################
-- BLOCO: 20260806100100_ci_assets_storage
-- ###########################################################################

-- ═══════════════════════════════════════════════════════════════════════════
-- Creative Intelligence — assets, deduplicação e objetos em nuvem
--
-- O computador do usuário não tem espaço para milhares de vídeos. Nada de
-- mídia fica em disco local de forma permanente: o worker baixa para um
-- temporário, calcula o SHA-256, sobe para o bucket e apaga o temporário.
--
-- ── Deduplicação ──────────────────────────────────────────────────────────
-- A chave é sha256, UNIQUE por marca. Marcas reciclam o mesmo vídeo em dezenas
-- de anúncios; sem dedup, 3.000 anúncios virariam 3.000 downloads e 3.000
-- análises pagas. Com dedup, o mesmo asset é baixado, armazenado e analisado
-- UMA vez, e se liga a N anúncios via ci_ad_assets.
--
-- Por que sha256 e não a URL: o CDN da Meta assina as URLs com token de
-- expiração, então a mesma mídia aparece com URLs diferentes. Só o conteúdo
-- identifica de verdade.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── ci_assets ───────────────────────────────────────────────────────────────
-- O arquivo de mídia único, já em nuvem.
create table if not exists public.ci_assets (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references public.ci_brands(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,

  sha256            text not null,
  media_type        text not null default 'video' check (media_type in ('video','image','audio','unknown')),
  mime_type         text,
  file_ext          text,
  file_size_bytes   bigint,

  -- Chave no bucket: brands/{brand_id}/originals/{sha256}.{ext}
  storage_key       text not null,
  storage_bucket    text not null default 'ci-media',
  thumbnail_key     text,

  -- Metadata técnica (ffprobe)
  duration_seconds  numeric(10,3),
  width             int,
  height            int,
  fps               numeric(8,3),
  video_codec       text,
  audio_codec       text,
  has_audio         boolean,
  bitrate           bigint,
  aspect_ratio      text,          -- '9:16' | '1:1' | '4:5' | '16:9' | outro

  -- Origem
  source_url        text,          -- URL assinada de onde veio (expira; só auditoria)
  downloaded_at     timestamptz,

  -- Integridade
  integrity_ok      boolean,
  integrity_note    text,

  -- Ciclo de análise
  analysis_status   text not null default 'pending'
                    check (analysis_status in ('pending','queued','running','completed','failed','skipped')),
  analysis_version  text,
  analyzed_at       timestamptz,

  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- O coração da deduplicação.
  unique (brand_id, sha256)
);

create index if not exists idx_ci_assets_brand    on public.ci_assets(brand_id, created_at desc);
create index if not exists idx_ci_assets_analysis on public.ci_assets(analysis_status, created_at);
create index if not exists idx_ci_assets_sha      on public.ci_assets(sha256);


-- ── ci_ad_assets ────────────────────────────────────────────────────────────
-- N:N entre anúncio e asset. Um asset pode servir 40 anúncios; um anúncio de
-- carrossel pode ter 5 assets. Esta tabela é o que torna "duplicatas evitadas"
-- um número real: (linhas aqui) − (assets distintos).
create table if not exists public.ci_ad_assets (
  id              uuid primary key default gen_random_uuid(),
  ad_id           uuid not null references public.ci_ads(id) on delete cascade,
  asset_id        uuid not null references public.ci_assets(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  media_source_id uuid references public.ci_ad_media_sources(id) on delete set null,
  role            text not null default 'primary' check (role in ('primary','carousel','thumbnail','variant')),
  sort_order      int not null default 0,
  -- true quando este vínculo reusou um asset já existente (dedup em ação)
  was_deduplicated boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (ad_id, asset_id, role)
);

create index if not exists idx_ci_ad_assets_asset on public.ci_ad_assets(asset_id);
create index if not exists idx_ci_ad_assets_ad    on public.ci_ad_assets(ad_id, sort_order);

-- FK que faltava em ci_ad_media_sources.asset_id, agora que ci_assets existe.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ci_ad_media_sources_asset_id_fkey'
  ) then
    alter table public.ci_ad_media_sources
      add constraint ci_ad_media_sources_asset_id_fkey
      foreign key (asset_id) references public.ci_assets(id) on delete set null;
  end if;
end $$;


-- ── ci_storage_objects ──────────────────────────────────────────────────────
-- Inventário de TUDO que existe no bucket, não só os originais. É o que
-- alimenta a tela de Storage Usage e o que permite limpar órfãos com
-- segurança — sem isso, "apagar o que não é usado" vira adivinhação.
create table if not exists public.ci_storage_objects (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.ci_brands(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  asset_id      uuid references public.ci_assets(id) on delete cascade,

  bucket        text not null default 'ci-media',
  object_key    text not null,
  -- originals | keyframes | faces | analysis | thumbnails
  category      text not null check (category in ('originals','keyframes','faces','analysis','thumbnails')),
  content_type  text,
  size_bytes    bigint not null default 0,
  sha256        text,
  etag          text,

  uploaded_at   timestamptz not null default now(),
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (bucket, object_key)
);

create index if not exists idx_ci_storage_brand    on public.ci_storage_objects(brand_id, category)
  where deleted_at is null;
create index if not exists idx_ci_storage_asset    on public.ci_storage_objects(asset_id)
  where deleted_at is null;


-- ── View de uso de storage ──────────────────────────────────────────────────
-- A tela de Storage Usage lê daqui. Só objetos vivos.
create or replace view public.ci_storage_usage as
select
  o.user_id,
  o.brand_id,
  o.category,
  count(*)                as object_count,
  coalesce(sum(o.size_bytes), 0)::bigint as total_bytes
from public.ci_storage_objects o
where o.deleted_at is null
group by o.user_id, o.brand_id, o.category;


-- ── View de deduplicação ────────────────────────────────────────────────────
-- "Duplicatas evitadas" = quantos downloads/análises deixamos de fazer.
create or replace view public.ci_dedup_stats as
with per_asset as (
  select
    a.user_id,
    a.brand_id,
    a.id,
    coalesce(a.file_size_bytes, 0)         as file_size_bytes,
    (select count(*) from public.ci_ad_assets l where l.asset_id = a.id) as link_count
  from public.ci_assets a
)
select
  user_id,
  brand_id,
  count(*)::bigint                                        as unique_assets,
  coalesce(sum(link_count), 0)::bigint                    as ad_asset_links,
  -- Cada vínculo além do primeiro é um download e uma análise que NÃO fizemos.
  coalesce(sum(greatest(link_count - 1, 0)), 0)::bigint   as duplicates_avoided,
  coalesce(sum(file_size_bytes), 0)::bigint               as unique_bytes,
  -- Quanto ocuparia se cada anúncio guardasse a própria cópia.
  coalesce(sum(file_size_bytes * greatest(link_count, 1)), 0)::bigint as naive_bytes
from per_asset
group by user_id, brand_id;


-- ── updated_at ──────────────────────────────────────────────────────────────
drop trigger if exists trg_ci_assets_touch on public.ci_assets;
create trigger trg_ci_assets_touch before update on public.ci_assets
  for each row execute function public.ci_touch_updated_at();


-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Leitura própria; escrita só service_role (worker e edge functions).
do $$
declare t text;
begin
  foreach t in array array['ci_assets','ci_ad_assets','ci_storage_objects'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read_own', t);
    execute format('create policy %I on public.%I for select to authenticated
                    using (user_id = auth.uid())', t || '_read_own', t);
  end loop;
end $$;

-- Views herdam a RLS das tabelas de base em Postgres 15+ com security_invoker.
alter view public.ci_storage_usage set (security_invoker = on);
alter view public.ci_dedup_stats  set (security_invoker = on);


-- ═══════════════════════════════════════════════════════════════════════════
-- BUCKET
--
-- Bucket PRIVADO. Nenhum objeto é servido por URL pública: a UI pede uma URL
-- assinada de curta duração à edge function ci-storage-sign. Vídeo de anúncio
-- de terceiro não deve ficar em URL adivinhável e permanente.
--
-- 500 MB por arquivo cobre com folga qualquer criativo da biblioteca Meta
-- (a maioria fica entre 1 e 15 MB).
-- ═══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ci-media', 'ci-media', false, 524288000,
  array['video/mp4','video/quicktime','video/webm','image/jpeg','image/png','image/webp','application/json']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Nenhuma policy de storage para `authenticated`: o cliente nunca lê nem
-- escreve direto no bucket. Todo acesso passa por URL assinada emitida pelo
-- service_role, que ignora RLS.


-- ###########################################################################
-- BLOCO: 20260806100200_ci_jobs
-- ###########################################################################

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


-- ###########################################################################
-- BLOCO: 20260806100300_ci_analysis
-- ###########################################################################

-- ═══════════════════════════════════════════════════════════════════════════
-- Creative Intelligence — saída da análise multimodal
--
-- Tudo aqui pende de ci_assets, não de ci_ads. Um vídeo reusado em 40 anúncios
-- tem UM transcript, UM conjunto de cenas, UM conjunto de rostos. Os anúncios
-- herdam pelo vínculo ci_ad_assets.
--
-- ── Privacidade — restrição de produto, não de estilo ─────────────────────
-- Não identificamos pessoas reais. Não inferimos etnia, religião, orientação,
-- saúde, idade real ou qualquer atributo sensível. Não há reconhecimento
-- facial contra base de nomes. O que existe é agrupamento de aparições do
-- MESMO rosto dentro da biblioteca desta marca, sob rótulo anônimo
-- (PERSON_001), para responder "esta creator aparece em quantos conceitos".
-- O embedding é um vetor sem nome, e o cluster pode ser apagado a qualquer
-- momento sem perder o resto da análise.
--
-- ── Toda classificação carrega evidência ──────────────────────────────────
-- label + confidence + evidence + timestamp + source + model_version.
-- Sem isso a base vira opinião de LLM sem rastro, e não dá para auditar por
-- que o sistema disse o que disse.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── ci_transcripts ──────────────────────────────────────────────────────────
create table if not exists public.ci_transcripts (
  id                uuid primary key default gen_random_uuid(),
  asset_id          uuid not null references public.ci_assets(id) on delete cascade,
  brand_id          uuid not null references public.ci_brands(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,

  language          text,
  language_prob     numeric(5,4),
  full_text         text not null default '',
  word_count        int not null default 0,
  duration_seconds  numeric(10,3),
  -- palavras por segundo de fala — entra nos gráficos de densidade
  speech_rate       numeric(8,3),

  engine            text not null,            -- 'faster-whisper' | 'gemini' | ...
  engine_model      text,                     -- 'small' | 'large-v3' | ...
  has_diarization   boolean not null default false,
  confidence        numeric(5,4),

  created_at        timestamptz not null default now(),
  unique (asset_id)
);

create index if not exists idx_ci_transcripts_brand on public.ci_transcripts(brand_id);
create index if not exists idx_ci_transcripts_fts   on public.ci_transcripts
  using gin (to_tsvector('simple', coalesce(full_text,'')));


-- ── ci_speakers ─────────────────────────────────────────────────────────────
-- Falantes distintos dentro de um asset. Anônimos: SPEAKER_00, SPEAKER_01.
create table if not exists public.ci_speakers (
  id                 uuid primary key default gen_random_uuid(),
  asset_id           uuid not null references public.ci_assets(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  label              text not null,            -- 'SPEAKER_00'
  total_seconds      numeric(10,3) not null default 0,
  segment_count      int not null default 0,
  -- Associação conservadora com um rosto visível. Só é preenchida quando o
  -- rosto está em cena durante a fala com folga; na dúvida fica null.
  person_cluster_id  uuid,
  association_conf   numeric(5,4),
  created_at         timestamptz not null default now(),
  unique (asset_id, label)
);


-- ── ci_transcript_segments ──────────────────────────────────────────────────
create table if not exists public.ci_transcript_segments (
  id             uuid primary key default gen_random_uuid(),
  transcript_id  uuid not null references public.ci_transcripts(id) on delete cascade,
  asset_id       uuid not null references public.ci_assets(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  speaker_id     uuid references public.ci_speakers(id) on delete set null,

  segment_index  int not null,
  start_seconds  numeric(10,3) not null,
  end_seconds    numeric(10,3) not null,
  text           text not null,
  words          jsonb,                       -- [{w,start,end,prob}] quando disponível
  confidence     numeric(5,4),
  no_speech_prob numeric(5,4),
  created_at     timestamptz not null default now(),
  unique (transcript_id, segment_index),
  check (end_seconds >= start_seconds)
);

create index if not exists idx_ci_tseg_asset on public.ci_transcript_segments(asset_id, start_seconds);
create index if not exists idx_ci_tseg_fts   on public.ci_transcript_segments
  using gin (to_tsvector('simple', text));


-- ── ci_scenes ───────────────────────────────────────────────────────────────
create table if not exists public.ci_scenes (
  id               uuid primary key default gen_random_uuid(),
  asset_id         uuid not null references public.ci_assets(id) on delete cascade,
  brand_id         uuid not null references public.ci_brands(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,

  scene_index      int not null,
  start_seconds    numeric(10,3) not null,
  end_seconds      numeric(10,3) not null,
  duration_seconds numeric(10,3) generated always as (end_seconds - start_seconds) stored,

  -- Observado / inferido pela camada semântica
  setting          text,     -- 'bedroom' | 'bathroom mirror' | 'studio' | 'outdoor street'
  setting_kind     text,     -- 'home' | 'studio' | 'outdoor' | 'retail' | 'ugc-selfie'
  description      text,
  camera_style     text,     -- 'handheld selfie' | 'tripod static' | 'b-roll'
  framing          text,     -- 'close-up' | 'medium' | 'wide'
  lighting         text,
  action           text,
  scene_function   text,     -- 'hook' | 'problem' | 'solution' | 'demo' | 'proof' | 'offer' | 'cta'
  product_visible  boolean default false,
  objects          jsonb not null default '[]'::jsonb,

  keyframe_key     text,     -- brands/{brand}/keyframes/{asset}/{n}.jpg
  confidence       numeric(5,4),
  source           text not null default 'ffmpeg+semantic',
  model_version    text,
  created_at       timestamptz not null default now(),
  unique (asset_id, scene_index),
  check (end_seconds >= start_seconds)
);

create index if not exists idx_ci_scenes_asset on public.ci_scenes(asset_id, scene_index);
create index if not exists idx_ci_scenes_brand on public.ci_scenes(brand_id, setting_kind);


-- ── ci_keyframes ────────────────────────────────────────────────────────────
-- Só keyframes relevantes, nunca todos os frames. Requisito da Fase 4:
-- 3.000 vídeos × 900 frames seria terabyte de lixo.
create table if not exists public.ci_keyframes (
  id             uuid primary key default gen_random_uuid(),
  asset_id       uuid not null references public.ci_assets(id) on delete cascade,
  scene_id       uuid references public.ci_scenes(id) on delete set null,
  brand_id       uuid not null references public.ci_brands(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,

  frame_index    int not null,
  timestamp_s    numeric(10,3) not null,
  storage_key    text not null,
  width          int,
  height         int,
  size_bytes     bigint,
  -- por que este frame foi guardado
  reason         text not null default 'scene_start'
                 check (reason in ('scene_start','scene_mid','text_peak','face_peak','product_peak','first_frame','last_frame')),
  -- hash perceptual, para achar frames parecidos entre anúncios diferentes
  phash          text,
  created_at     timestamptz not null default now(),
  unique (asset_id, frame_index)
);

create index if not exists idx_ci_keyframes_asset on public.ci_keyframes(asset_id, timestamp_s);
create index if not exists idx_ci_keyframes_phash on public.ci_keyframes(phash) where phash is not null;


-- ── ci_ocr_tracks / ci_onscreen_text ────────────────────────────────────────
-- ocr_tracks = observação bruta por frame. onscreen_text = observações
-- consecutivas fundidas numa faixa temporal ("o texto X ficou na tela de
-- 0.5s a 2.8s"). São coisas diferentes e ambas são úteis: a bruta para
-- auditoria, a fundida para leitura humana e para a busca.
create table if not exists public.ci_ocr_tracks (
  id            uuid primary key default gen_random_uuid(),
  asset_id      uuid not null references public.ci_assets(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  keyframe_id   uuid references public.ci_keyframes(id) on delete set null,
  timestamp_s   numeric(10,3) not null,
  text          text not null,
  bbox          jsonb,                    -- {x,y,w,h} normalizado 0..1
  confidence    numeric(5,4),
  engine        text not null,            -- 'easyocr' | 'tesseract' | 'gemini'
  created_at    timestamptz not null default now()
);

create index if not exists idx_ci_ocr_asset on public.ci_ocr_tracks(asset_id, timestamp_s);

create table if not exists public.ci_onscreen_text (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references public.ci_assets(id) on delete cascade,
  brand_id        uuid not null references public.ci_brands(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  track_index     int not null,
  start_seconds   numeric(10,3) not null,
  end_seconds     numeric(10,3) not null,
  text            text not null,
  normalized_text text,
  -- papel do texto na peça
  role            text,   -- 'hook' | 'headline' | 'caption' | 'price' | 'disclaimer' | 'cta' | 'label'
  position        text,   -- 'top' | 'center' | 'bottom'
  confidence      numeric(5,4),
  source          text not null default 'ocr',
  model_version   text,
  created_at      timestamptz not null default now(),
  unique (asset_id, track_index),
  check (end_seconds >= start_seconds)
);

create index if not exists idx_ci_ost_asset on public.ci_onscreen_text(asset_id, start_seconds);
create index if not exists idx_ci_ost_fts   on public.ci_onscreen_text
  using gin (to_tsvector('simple', coalesce(normalized_text, text)));


-- ── ci_person_clusters / ci_face_tracks ─────────────────────────────────────
-- ci_person_clusters é por MARCA: "a mesma pessoa aparece em 12 anúncios".
-- ci_face_tracks é por ASSET: "este rosto aparece de 0.2s a 4.1s neste vídeo".
create table if not exists public.ci_person_clusters (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references public.ci_brands(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,

  label             text not null,            -- 'PERSON_001' — anônimo, sempre
  display_name      text,                     -- apelido opcional dado pelo usuário
  centroid          jsonb,                    -- vetor médio, sem nome atrelado
  embedding_model   text,                     -- 'insightface/buffalo_l' | 'hist-fallback'
  thumbnail_key     text,                     -- recorte no bucket, /faces/

  appearance_count  int not null default 0,   -- nº de face_tracks
  asset_count       int not null default 0,
  ad_count          int not null default 0,
  concept_count     int not null default 0,
  first_seen_at     timestamptz,
  last_seen_at      timestamptz,

  -- Revisão humana: merge/split manual de clusters
  review_status     text not null default 'unreviewed'
                    check (review_status in ('unreviewed','confirmed','merged','split','rejected')),
  merged_into_id    uuid references public.ci_person_clusters(id) on delete set null,
  reviewed_at       timestamptz,

  confidence        numeric(5,4),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (brand_id, label)
);

create index if not exists idx_ci_persons_brand on public.ci_person_clusters(brand_id, appearance_count desc);

create table if not exists public.ci_face_tracks (
  id                uuid primary key default gen_random_uuid(),
  asset_id          uuid not null references public.ci_assets(id) on delete cascade,
  brand_id          uuid not null references public.ci_brands(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  person_cluster_id uuid references public.ci_person_clusters(id) on delete set null,

  track_index       int not null,
  start_seconds     numeric(10,3) not null,
  end_seconds       numeric(10,3) not null,
  frame_count       int not null default 0,
  -- área média do rosto no quadro — proxy de "é a protagonista ou figurante"
  avg_face_area     numeric(6,5),
  embedding         jsonb,                    -- vetor anônimo
  embedding_model   text,
  thumbnail_key     text,
  match_distance    numeric(6,5),             -- distância ao centróide do cluster
  confidence        numeric(5,4),
  created_at        timestamptz not null default now(),
  unique (asset_id, track_index),
  check (end_seconds >= start_seconds)
);

create index if not exists idx_ci_faces_asset  on public.ci_face_tracks(asset_id, start_seconds);
create index if not exists idx_ci_faces_person on public.ci_face_tracks(person_cluster_id);

-- FK pendente de ci_speakers → ci_person_clusters
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ci_speakers_person_cluster_fkey') then
    alter table public.ci_speakers
      add constraint ci_speakers_person_cluster_fkey
      foreign key (person_cluster_id) references public.ci_person_clusters(id) on delete set null;
  end if;
end $$;


-- ── updated_at ──────────────────────────────────────────────────────────────
drop trigger if exists trg_ci_person_clusters_touch on public.ci_person_clusters;
create trigger trg_ci_person_clusters_touch before update on public.ci_person_clusters
  for each row execute function public.ci_touch_updated_at();


-- ── RLS ─────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'ci_transcripts','ci_speakers','ci_transcript_segments','ci_scenes','ci_keyframes',
    'ci_ocr_tracks','ci_onscreen_text','ci_person_clusters','ci_face_tracks'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read_own', t);
    execute format('create policy %I on public.%I for select to authenticated
                    using (user_id = auth.uid())', t || '_read_own', t);
  end loop;
end $$;

-- Exceção: o usuário revisa clusters de pessoas na UI (merge/split/renomear).
-- É a única tabela de análise com escrita pelo cliente, e ela não decide gasto.
drop policy if exists ci_person_clusters_review on public.ci_person_clusters;
create policy ci_person_clusters_review on public.ci_person_clusters
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ###########################################################################
-- BLOCO: 20260806100400_ci_taxonomy
-- ###########################################################################

-- ═══════════════════════════════════════════════════════════════════════════
-- Creative Intelligence — taxonomia criativa, conceitos e variações
--
-- ── Uma decisão de modelagem que vale explicar ────────────────────────────
-- A especificação pedia sete tabelas: products, hooks, angles, proofs,
-- objections, offers, ctas. Elas teriam colunas idênticas (label, slug,
-- frequência, primeira e última aparição) e toda consulta interessante seria
-- um UNION de sete lados: "quais mensagens apareceram este mês", "evolução
-- temporal por tipo", "o que mudou entre a variante e o baseline".
--
-- Aqui vira UMA tabela ci_taxonomy_terms com a coluna `kind`, mais
-- ci_ad_taxonomy ligando anúncio → termo com evidência. As sete entidades
-- continuam existindo pelo nome, como views (ci_products, ci_hooks, ...), então
-- quem consulta `ci_hooks` acha o que espera.
--
-- O ganho concreto: adicionar 'mechanism' ou 'guarantee' amanhã é um INSERT,
-- não uma migration + sete lugares para atualizar. E a página Messages, que
-- precisa cruzar hooks com angles com proofs, vira uma query só.
--
-- ── Evidência ─────────────────────────────────────────────────────────────
-- O vínculo anúncio→termo carrega confidence, evidence, timestamp, source e
-- model_version. Nenhuma classificação entra sem poder responder "por quê".
-- ═══════════════════════════════════════════════════════════════════════════


-- ── ci_taxonomy_terms ───────────────────────────────────────────────────────
create table if not exists public.ci_taxonomy_terms (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references public.ci_brands(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,

  kind            text not null check (kind in (
                    'product','product_type','hook','hook_visual','hook_written',
                    'angle','promise','proof','demonstration','objection','offer','cta',
                    'story_structure','emotional_tone','visual_style','editing_rhythm',
                    'scenario','mechanism'
                  )),
  slug            text not null,                -- normalizado, para agrupar
  label           text not null,                -- como será exibido
  description     text,

  -- Agregados, recalculados por ci_refresh_taxonomy_stats()
  ad_count        int not null default 0,
  asset_count     int not null default 0,
  concept_count   int not null default 0,
  first_seen_at   timestamptz,
  last_seen_at    timestamptz,

  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (brand_id, kind, slug)
);

create index if not exists idx_ci_terms_brand on public.ci_taxonomy_terms(brand_id, kind, ad_count desc);


-- ── ci_ad_taxonomy ──────────────────────────────────────────────────────────
-- O vínculo com evidência. Um anúncio pode ter 2 provas e 3 objeções.
create table if not exists public.ci_ad_taxonomy (
  id              uuid primary key default gen_random_uuid(),
  ad_id           uuid not null references public.ci_ads(id) on delete cascade,
  term_id         uuid not null references public.ci_taxonomy_terms(id) on delete cascade,
  asset_id        uuid references public.ci_assets(id) on delete cascade,
  brand_id        uuid not null references public.ci_brands(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- Evidência obrigatória por contrato de produto
  confidence      numeric(5,4) not null default 0,
  evidence        text,                        -- o trecho que sustenta a classificação
  evidence_kind   text check (evidence_kind in ('speech','onscreen','copy','visual','headline','inferred')),
  timestamp_s     numeric(10,3),               -- quando no vídeo
  source          text not null,               -- 'gemini' | 'heuristic' | 'manual' | 'openai'
  model_version   text,
  is_primary      boolean not null default false,   -- o hook principal, o angle principal

  created_at      timestamptz not null default now()
);

-- UNIQUE de tabela não aceita expressão, e as duas colunas de desempate são
-- nullable — em Postgres, NULL nunca é igual a NULL, então o UNIQUE simples
-- deixaria passar duplicata. Índice único com coalesce resolve os dois.
create unique index if not exists uq_ci_adtax_ad_term_evidence
  on public.ci_ad_taxonomy(ad_id, term_id, coalesce(evidence_kind, ''), coalesce(timestamp_s, -1));

create index if not exists idx_ci_adtax_ad    on public.ci_ad_taxonomy(ad_id, is_primary desc);
create index if not exists idx_ci_adtax_term  on public.ci_ad_taxonomy(term_id);
create index if not exists idx_ci_adtax_brand on public.ci_ad_taxonomy(brand_id, created_at desc);


-- ── As sete entidades pedidas, como views ───────────────────────────────────
do $$
declare
  v record;
begin
  for v in select * from (values
    ('ci_products',   'product'),
    ('ci_hooks',      'hook'),
    ('ci_angles',     'angle'),
    ('ci_proofs',     'proof'),
    ('ci_objections', 'objection'),
    ('ci_offers',     'offer'),
    ('ci_ctas',       'cta'),
    ('ci_scenarios',  'scenario')
  ) as t(view_name, kind_value) loop
    execute format(
      'create or replace view public.%I as
         select id, brand_id, user_id, slug, label, description,
                ad_count, asset_count, concept_count,
                first_seen_at, last_seen_at, is_demo, created_at, updated_at
           from public.ci_taxonomy_terms where kind = %L',
      v.view_name, v.kind_value);
    execute format('alter view public.%I set (security_invoker = on)', v.view_name);
  end loop;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- CONCEITOS
--
-- Um conceito não é "anúncios com texto parecido". Dois vídeos podem ter o
-- mesmo copy e serem testes de creators diferentes; dois podem ter copy
-- distinto e serem a mesma ideia refilmada. O agrupamento é híbrido —
-- regras + embeddings + similaridade visual + revisão manual — e a assinatura
-- que o identifica leva produto, problema, angle, mecanismo, prova, formato,
-- estrutura, visual, creator e cenário.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.ci_concepts (
  id                  uuid primary key default gen_random_uuid(),
  brand_id            uuid not null references public.ci_brands(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,

  name                text not null,
  description         text,
  hypothesis          text,          -- por que se acredita que este conceito funciona

  -- Assinatura do conceito
  product_term_id     uuid references public.ci_taxonomy_terms(id) on delete set null,
  angle_term_id       uuid references public.ci_taxonomy_terms(id) on delete set null,
  proof_term_id       uuid references public.ci_taxonomy_terms(id) on delete set null,
  mechanism_term_id   uuid references public.ci_taxonomy_terms(id) on delete set null,
  scenario_term_id    uuid references public.ci_taxonomy_terms(id) on delete set null,
  signature           text,          -- hash legível da assinatura, para dedup de conceito
  signature_vector    jsonb,         -- embedding semântico do conceito

  -- O anúncio mais antigo do grupo. Toda variante é comparada contra ele.
  baseline_ad_id      uuid references public.ci_ads(id) on delete set null,

  -- Agregados
  ad_count            int not null default 0,
  unique_asset_count  int not null default 0,
  variant_count       int not null default 0,
  person_count        int not null default 0,
  format_count        int not null default 0,
  market_count        int not null default 0,
  first_seen_at       timestamptz,
  last_seen_at        timestamptz,
  longevity_days      int not null default 0,
  is_active           boolean not null default false,

  -- Observed Scale Signal (calculado na migration 100500)
  scale_signal        numeric(6,2),
  scale_band          text check (scale_band in ('low','medium','high','very_high','insufficient_evidence')),

  -- Como o grupo foi formado, e se um humano confirmou
  grouping_method     text not null default 'hybrid'
                      check (grouping_method in ('rules','embedding','visual','hybrid','manual')),
  confidence          numeric(5,4),
  review_status       text not null default 'unreviewed'
                      check (review_status in ('unreviewed','confirmed','merged','split','rejected')),
  merged_into_id      uuid references public.ci_concepts(id) on delete set null,
  reviewed_at         timestamptz,

  is_demo             boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_ci_concepts_brand on public.ci_concepts(brand_id, scale_signal desc nulls last);
create index if not exists idx_ci_concepts_sig   on public.ci_concepts(brand_id, signature);

-- FK que ficou pendente em ci_ads.concept_id
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ci_ads_concept_id_fkey') then
    alter table public.ci_ads
      add constraint ci_ads_concept_id_fkey
      foreign key (concept_id) references public.ci_concepts(id) on delete set null;
  end if;
end $$;


-- ── ci_concept_members ──────────────────────────────────────────────────────
-- Por que este anúncio entrou neste conceito. Sem isto, o agrupamento é uma
-- caixa preta e não dá para revisar nem corrigir.
create table if not exists public.ci_concept_members (
  id                uuid primary key default gen_random_uuid(),
  concept_id        uuid not null references public.ci_concepts(id) on delete cascade,
  ad_id             uuid not null references public.ci_ads(id) on delete cascade,
  brand_id          uuid not null references public.ci_brands(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,

  is_baseline       boolean not null default false,
  match_method      text not null check (match_method in ('rules','embedding','visual','hybrid','manual')),
  match_score       numeric(5,4),
  match_reasons     jsonb not null default '[]'::jsonb,   -- ['mesmo produto','mesmo angle','creator PERSON_003']
  added_by          text not null default 'system' check (added_by in ('system','user')),
  created_at        timestamptz not null default now(),
  unique (concept_id, ad_id)
);

create index if not exists idx_ci_cmembers_concept on public.ci_concept_members(concept_id);
create index if not exists idx_ci_cmembers_ad      on public.ci_concept_members(ad_id);

-- Um baseline por conceito.
create unique index if not exists uq_ci_concept_one_baseline
  on public.ci_concept_members(concept_id) where is_baseline;


-- ── ci_creative_variants ────────────────────────────────────────────────────
-- Diff explícito entre um anúncio e o baseline do conceito. Responde
-- "o que mudou de uma versão para a outra" sem o usuário assistir aos dois.
create table if not exists public.ci_creative_variants (
  id              uuid primary key default gen_random_uuid(),
  concept_id      uuid not null references public.ci_concepts(id) on delete cascade,
  ad_id           uuid not null references public.ci_ads(id) on delete cascade,
  baseline_ad_id  uuid not null references public.ci_ads(id) on delete cascade,
  brand_id        uuid not null references public.ci_brands(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,

  variant_index   int not null default 0,

  -- Um booleano por dimensão: filtrar "todos os testes de hook" vira WHERE
  changed_hook          boolean not null default false,
  changed_creator       boolean not null default false,
  changed_intro         boolean not null default false,
  changed_body          boolean not null default false,
  changed_cta           boolean not null default false,
  changed_offer         boolean not null default false,
  changed_scene_order   boolean not null default false,
  changed_duration      boolean not null default false,
  changed_text          boolean not null default false,
  changed_music         boolean not null default false,
  changed_framing       boolean not null default false,
  changed_format        boolean not null default false,
  changed_landing_page  boolean not null default false,

  -- O detalhe: [{field, from, to, evidence, timestamp_s, confidence}]
  changes         jsonb not null default '[]'::jsonb,
  change_count    int not null default 0,
  -- 0 = idêntico ao baseline, 1 = irreconhecível
  distance        numeric(5,4),

  source          text not null default 'system',
  model_version   text,
  created_at      timestamptz not null default now(),
  unique (concept_id, ad_id)
);

create index if not exists idx_ci_variants_concept on public.ci_creative_variants(concept_id, variant_index);
create index if not exists idx_ci_variants_hook    on public.ci_creative_variants(brand_id) where changed_hook;


-- ── ci_learnings ────────────────────────────────────────────────────────────
-- Padrão observado + evidência + limitação. Nunca causalidade: sem dado de
-- performance real, "este hook converte melhor" é uma frase que não podemos
-- dizer. O que podemos dizer é "este hook aparece em mais variações e roda há
-- mais tempo" — e é isso que o campo `statement` deve conter.
create table if not exists public.ci_learnings (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references public.ci_brands(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,

  category        text not null,     -- 'hook' | 'angle' | 'proof' | 'format' | 'creator' | 'structure' | 'timing'
  title           text not null,
  statement       text not null,
  -- O que os dados NÃO permitem concluir. Campo obrigatório de propósito.
  limitation      text not null default 'Sem dados de performance real (spend, ROAS, CPA). Nenhuma relação causal é afirmada.',
  suggestion      text,              -- teste sugerido a partir do padrão

  evidence        jsonb not null default '[]'::jsonb,   -- [{ad_id, concept_id, quote, timestamp_s}]
  evidence_count  int not null default 0,
  confidence      numeric(5,4),

  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_ci_learnings_brand on public.ci_learnings(brand_id, evidence_count desc);


-- ── updated_at ──────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['ci_taxonomy_terms','ci_concepts','ci_learnings'] loop
    execute format('drop trigger if exists trg_%s_touch on public.%I', t, t);
    execute format('create trigger trg_%s_touch before update on public.%I
                    for each row execute function public.ci_touch_updated_at()', t, t);
  end loop;
end $$;


-- ── RLS ─────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'ci_taxonomy_terms','ci_ad_taxonomy','ci_concepts','ci_concept_members',
    'ci_creative_variants','ci_learnings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read_own', t);
    execute format('create policy %I on public.%I for select to authenticated
                    using (user_id = auth.uid())', t || '_read_own', t);
  end loop;
end $$;

-- Revisão manual de conceitos pela UI (confirmar, renomear, merge/split).
drop policy if exists ci_concepts_review on public.ci_concepts;
create policy ci_concepts_review on public.ci_concepts
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ###########################################################################
-- BLOCO: 20260806100500_ci_results_and_scale_signal
-- ###########################################################################

-- ═══════════════════════════════════════════════════════════════════════════
-- Creative Intelligence — auditoria de IA, métricas estimadas e
--                          Observed Scale Signal
--
-- Três coisas que precisam existir para a base ser confiável:
--
-- 1. ci_model_runs / ci_analysis_results — toda saída de IA fica rastreável:
--    qual modelo, qual versão de prompt, qual input, quanto custou, saída
--    bruta E normalizada. Sem isso não dá para reprocessar quando o prompt
--    melhorar, nem explicar uma classificação estranha.
--
-- 2. ci_estimated_metrics — spend e reach da transparência DSA são estimativas
--    de terceiros. Ficam numa tabela SEPARADA, com fonte e limitação por
--    linha, justamente para não serem lidos como performance da conta.
--
-- 3. ci_scale_signal_config + ci_compute_scale_signal — o Observed Scale
--    Signal. NÃO é ROAS, CPA nem prova de lucro.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── ci_model_runs ───────────────────────────────────────────────────────────
create table if not exists public.ci_model_runs (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references public.ci_brands(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  asset_id          uuid references public.ci_assets(id) on delete cascade,
  ad_id             uuid references public.ci_ads(id) on delete cascade,
  analysis_job_id   uuid references public.ci_analysis_jobs(id) on delete set null,

  purpose           text not null,        -- 'semantic_analysis' | 'concept_embedding' | 'chat' | 'learnings'
  provider          text not null,        -- 'gemini' | 'openai' | 'local'
  model             text not null,
  prompt_version    text not null,        -- 'semantic/v1' — versionado no código
  input_version     text,                 -- hash do pacote de entrada
  input_summary     jsonb not null default '{}'::jsonb,  -- nº de frames, tamanho do transcript...

  status            text not null default 'running'
                    check (status in ('running','completed','failed','skipped')),
  input_tokens      bigint,
  output_tokens     bigint,
  cost_usd          numeric(10,5),
  latency_ms        int,
  error             text,

  created_at        timestamptz not null default now(),
  finished_at       timestamptz
);

create index if not exists idx_ci_model_runs_brand on public.ci_model_runs(brand_id, created_at desc);
create index if not exists idx_ci_model_runs_asset on public.ci_model_runs(asset_id);


-- ── ci_analysis_results ─────────────────────────────────────────────────────
-- Bruto e normalizado lado a lado, como a spec pediu. O bruto é a defesa
-- contra "o modelo disse isso?"; o normalizado é o que a UI consome.
create table if not exists public.ci_analysis_results (
  id                uuid primary key default gen_random_uuid(),
  asset_id          uuid not null references public.ci_assets(id) on delete cascade,
  ad_id             uuid references public.ci_ads(id) on delete cascade,
  brand_id          uuid not null references public.ci_brands(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  model_run_id      uuid references public.ci_model_runs(id) on delete set null,

  kind              text not null default 'semantic'
                    check (kind in ('semantic','structure','timing','style','summary')),

  raw_output        jsonb not null,       -- exatamente o que o modelo devolveu
  normalized_output jsonb not null,       -- depois do parse e validação de schema

  -- Marcadores temporais que viram gráfico direto
  time_to_product_s numeric(10,3),
  time_to_offer_s   numeric(10,3),
  time_to_cta_s     numeric(10,3),
  hook_duration_s   numeric(10,3),
  cut_count         int,
  cuts_per_second   numeric(8,4),
  text_per_second   numeric(8,4),

  -- Sinalizadores estruturais observados
  has_before_after  boolean,
  has_testimonial   boolean,
  has_problem_solution boolean,
  has_urgency       boolean,
  has_social_proof  boolean,
  has_demonstration boolean,

  confidence        numeric(5,4),
  provider          text,
  model             text,
  prompt_version    text,
  -- 'full' quando a camada semântica rodou de verdade; 'degraded' quando caiu
  -- no fallback local. A UI mostra a diferença — resultado de fallback não
  -- pode se passar por análise completa.
  fidelity          text not null default 'full' check (fidelity in ('full','degraded','partial')),
  warnings          jsonb not null default '[]'::jsonb,

  created_at        timestamptz not null default now(),
  unique (asset_id, kind)
);

create index if not exists idx_ci_results_brand on public.ci_analysis_results(brand_id, created_at desc);
create index if not exists idx_ci_results_ad    on public.ci_analysis_results(ad_id);


-- ── ci_estimated_metrics ────────────────────────────────────────────────────
-- Nunca em coluna solta de ci_ads. Uma linha por métrica, com fonte,
-- limitação e disponibilidade — assim a UI consegue mostrar o disclaimer certo
-- ao lado de cada número, e não um aviso genérico no rodapé.
create table if not exists public.ci_estimated_metrics (
  id             uuid primary key default gen_random_uuid(),
  ad_id          uuid not null references public.ci_ads(id) on delete cascade,
  brand_id       uuid not null references public.ci_brands(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,

  metric         text not null,     -- 'total_reach' | 'estimated_spend_usd' | 'impressions'
  value_numeric  numeric(20,4),
  value_min      numeric(20,4),     -- quando a fonte devolve faixa
  value_max      numeric(20,4),
  currency       text,
  breakdown      jsonb,             -- age_gender_breakdown, country_ratio...

  -- Procedência — obrigatória
  source         text not null,     -- 'spreshapp/ad-details' | 'meta-dsa'
  is_estimated   boolean not null default true,
  availability   text not null default 'partial'
                 check (availability in ('available','partial','unavailable','region_restricted')),
  limitation     text not null default
    'Estimativa de transparência DSA de terceiros. Não é gasto, alcance nem performance da conta do usuário. Só existe para anúncios em regiões com exigência de transparência.',
  collected_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  unique (ad_id, metric, source)
);

create index if not exists idx_ci_estmetrics_ad    on public.ci_estimated_metrics(ad_id);
create index if not exists idx_ci_estmetrics_brand on public.ci_estimated_metrics(brand_id, metric);


-- ═══════════════════════════════════════════════════════════════════════════
-- OBSERVED SCALE SIGNAL
--
-- O que é: um sinal RELATIVO de quanta energia a marca investiu num conceito,
-- inferido só do que é observável na biblioteca pública.
--
-- O que NÃO é: ROAS, CPA, lucro, receita ou qualquer prova de que o conceito
-- performa. Um anúncio pode rodar 200 dias porque converte — ou porque
-- ninguém revisou a campanha. Os dados aqui não distinguem os dois casos.
--
-- Por que é banda (Low/Medium/High/Very High) e não nota de 0 a 100 exibida
-- crua: um número com casa decimal sugere uma precisão que a fonte não tem.
-- O número existe para ORDENAR; a banda é o que se comunica.
--
-- Componentes, todos observáveis e todos com peso configurável:
--   longevity        há quanto tempo o conceito roda
--   ad_volume        quantos anúncios a marca produziu dentro dele
--   unique_assets    quantos criativos distintos (não reuploads)
--   variants         quantas variações testadas
--   evolution        se as variações são recentes (conceito vivo x congelado)
--   creators         quantas pessoas diferentes gravaram
--   formats          vídeo, imagem, carrossel
--   markets          quantos países
--   recency          houve atividade nos últimos 30 dias
--   reuploads        mesmo asset republicado (sinal de aposta deliberada)
--
-- Spend e impressões estimados NÃO entram na fórmula principal. Eles existem
-- em ci_estimated_metrics, aparecem na UI com disclaimer, e podem ser somados
-- como componente opcional desligado por padrão — misturar estimativa de
-- terceiro no sinal principal é o erro que torna a métrica não auditável.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.ci_scale_signal_config (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references public.ci_brands(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  version        text not null default 'v1',

  -- Pesos. Somam 1.0 na configuração padrão.
  w_longevity      numeric(4,3) not null default 0.20,
  w_ad_volume      numeric(4,3) not null default 0.15,
  w_unique_assets  numeric(4,3) not null default 0.15,
  w_variants       numeric(4,3) not null default 0.15,
  w_evolution      numeric(4,3) not null default 0.10,
  w_creators       numeric(4,3) not null default 0.08,
  w_formats        numeric(4,3) not null default 0.05,
  w_markets        numeric(4,3) not null default 0.05,
  w_recency        numeric(4,3) not null default 0.07,
  w_estimated      numeric(4,3) not null default 0.00,  -- desligado de propósito

  -- Pontos de saturação: acima disto o componente vale 1.0. Existem para o
  -- sinal não ser dominado por um outlier de 400 dias.
  sat_longevity_days   int not null default 120,
  sat_ad_volume        int not null default 25,
  sat_unique_assets    int not null default 12,
  sat_variants         int not null default 15,
  sat_creators         int not null default 6,
  sat_formats          int not null default 3,
  sat_markets          int not null default 5,
  recency_window_days  int not null default 30,

  -- Cortes das bandas
  band_medium      numeric(6,2) not null default 30,
  band_high        numeric(6,2) not null default 55,
  band_very_high   numeric(6,2) not null default 75,
  -- Abaixo disto o conceito não tem massa para julgar: fica
  -- 'insufficient_evidence' em vez de 'low'. Dizer "low" sobre 1 anúncio de
  -- 3 dias seria afirmar mais do que se sabe.
  min_ads_for_band int not null default 2,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (brand_id, version)
);

alter table public.ci_scale_signal_config enable row level security;
drop policy if exists ci_scale_cfg_owner on public.ci_scale_signal_config;
create policy ci_scale_cfg_owner on public.ci_scale_signal_config
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ── ci_concept_scale_components ─────────────────────────────────────────────
-- O detalhamento por conceito. A UI mostra as barras que formam o sinal —
-- requisito "mostrar os componentes". Sem isto o número é opaco.
create table if not exists public.ci_concept_scale_components (
  id             uuid primary key default gen_random_uuid(),
  concept_id     uuid not null references public.ci_concepts(id) on delete cascade,
  brand_id       uuid not null references public.ci_brands(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  config_version text not null default 'v1',

  -- valores crus observados
  raw            jsonb not null default '{}'::jsonb,
  -- cada componente normalizado 0..1
  normalized     jsonb not null default '{}'::jsonb,
  -- contribuição de cada componente ao total (normalizado × peso × 100)
  contributions  jsonb not null default '{}'::jsonb,

  signal         numeric(6,2) not null default 0,
  band           text not null default 'insufficient_evidence'
                 check (band in ('low','medium','high','very_high','insufficient_evidence')),
  computed_at    timestamptz not null default now(),
  unique (concept_id, config_version)
);

alter table public.ci_concept_scale_components enable row level security;
drop policy if exists ci_scale_comp_read on public.ci_concept_scale_components;
create policy ci_scale_comp_read on public.ci_concept_scale_components
  for select to authenticated using (user_id = auth.uid());


-- ── A função ────────────────────────────────────────────────────────────────
create or replace function public.ci_compute_scale_signal(p_brand_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  c        record;
  cfg      public.ci_scale_signal_config%rowtype;
  n        jsonb;
  raw      jsonb;
  contrib  jsonb;
  v_signal numeric(6,2);
  v_band   text;
  v_count  int := 0;
  -- normalizados
  nl numeric; nav numeric; nua numeric; nvr numeric;
  nev numeric; ncr numeric; nfm numeric; nmk numeric; nrc numeric;
begin
  select * into cfg from public.ci_scale_signal_config
   where brand_id = p_brand_id and version = 'v1' limit 1;

  if not found then
    insert into public.ci_scale_signal_config (brand_id, user_id)
    select b.id, b.user_id from public.ci_brands b where b.id = p_brand_id
    returning * into cfg;
  end if;

  for c in
    select
      k.id,
      k.user_id,
      k.longevity_days,
      k.ad_count,
      k.unique_asset_count,
      k.variant_count,
      k.person_count,
      k.format_count,
      k.market_count,
      k.last_seen_at,
      -- variações criadas dentro da janela recente = conceito ainda evoluindo
      (select count(*) from public.ci_creative_variants v
         join public.ci_ads a on a.id = v.ad_id
        where v.concept_id = k.id
          and a.started_on >= now() - make_interval(days => cfg.recency_window_days)
      ) as recent_variants,
      -- mesmo asset publicado em mais de um anúncio = reupload deliberado
      (select count(*) from (
         select l.asset_id from public.ci_ad_assets l
           join public.ci_concept_members m on m.ad_id = l.ad_id
          where m.concept_id = k.id
          group by l.asset_id having count(*) > 1
       ) r) as reupload_assets
    from public.ci_concepts k
   where k.brand_id = p_brand_id
  loop
    nl  := least(coalesce(c.longevity_days,0)::numeric     / nullif(cfg.sat_longevity_days,0), 1);
    nav := least(coalesce(c.ad_count,0)::numeric           / nullif(cfg.sat_ad_volume,0), 1);
    nua := least(coalesce(c.unique_asset_count,0)::numeric / nullif(cfg.sat_unique_assets,0), 1);
    nvr := least(coalesce(c.variant_count,0)::numeric      / nullif(cfg.sat_variants,0), 1);
    ncr := least(coalesce(c.person_count,0)::numeric       / nullif(cfg.sat_creators,0), 1);
    nfm := least(coalesce(c.format_count,0)::numeric       / nullif(cfg.sat_formats,0), 1);
    nmk := least(coalesce(c.market_count,0)::numeric       / nullif(cfg.sat_markets,0), 1);

    -- evolução: proporção das variações que são recentes
    nev := case when coalesce(c.variant_count,0) = 0 then 0
                else least(c.recent_variants::numeric / c.variant_count, 1) end;

    -- recência: 1 se houve atividade na janela, decaindo linearmente até 2×
    nrc := case
             when c.last_seen_at is null then 0
             else greatest(0, least(1,
               1 - (extract(epoch from (now() - c.last_seen_at)) / 86400.0
                    - cfg.recency_window_days) / cfg.recency_window_days))
           end;

    v_signal := round(100 * (
        cfg.w_longevity     * nl  + cfg.w_ad_volume  * nav + cfg.w_unique_assets * nua
      + cfg.w_variants      * nvr + cfg.w_evolution  * nev + cfg.w_creators      * ncr
      + cfg.w_formats       * nfm + cfg.w_markets    * nmk + cfg.w_recency       * nrc
    ), 2);

    v_band := case
      when coalesce(c.ad_count,0) < cfg.min_ads_for_band then 'insufficient_evidence'
      when v_signal >= cfg.band_very_high then 'very_high'
      when v_signal >= cfg.band_high      then 'high'
      when v_signal >= cfg.band_medium    then 'medium'
      else 'low'
    end;

    raw := jsonb_build_object(
      'longevity_days', c.longevity_days, 'ad_count', c.ad_count,
      'unique_assets', c.unique_asset_count, 'variants', c.variant_count,
      'recent_variants', c.recent_variants, 'creators', c.person_count,
      'formats', c.format_count, 'markets', c.market_count,
      'reupload_assets', c.reupload_assets, 'last_seen_at', c.last_seen_at);

    n := jsonb_build_object(
      'longevity', nl, 'ad_volume', nav, 'unique_assets', nua, 'variants', nvr,
      'evolution', nev, 'creators', ncr, 'formats', nfm, 'markets', nmk, 'recency', nrc);

    contrib := jsonb_build_object(
      'longevity',     round(100 * cfg.w_longevity     * nl,  2),
      'ad_volume',     round(100 * cfg.w_ad_volume     * nav, 2),
      'unique_assets', round(100 * cfg.w_unique_assets * nua, 2),
      'variants',      round(100 * cfg.w_variants      * nvr, 2),
      'evolution',     round(100 * cfg.w_evolution     * nev, 2),
      'creators',      round(100 * cfg.w_creators      * ncr, 2),
      'formats',       round(100 * cfg.w_formats       * nfm, 2),
      'markets',       round(100 * cfg.w_markets       * nmk, 2),
      'recency',       round(100 * cfg.w_recency       * nrc, 2));

    insert into public.ci_concept_scale_components
      (concept_id, brand_id, user_id, config_version, raw, normalized, contributions, signal, band, computed_at)
    values (c.id, p_brand_id, c.user_id, cfg.version, raw, n, contrib, v_signal, v_band, now())
    on conflict (concept_id, config_version) do update
      set raw = excluded.raw, normalized = excluded.normalized,
          contributions = excluded.contributions, signal = excluded.signal,
          band = excluded.band, computed_at = now();

    update public.ci_concepts
       set scale_signal = v_signal, scale_band = v_band, updated_at = now()
     where id = c.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.ci_compute_scale_signal(uuid) from public, anon;
grant execute on function public.ci_compute_scale_signal(uuid) to service_role, authenticated;


-- ── RLS das tabelas de auditoria ────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['ci_model_runs','ci_analysis_results','ci_estimated_metrics'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read_own', t);
    execute format('create policy %I on public.%I for select to authenticated
                    using (user_id = auth.uid())', t || '_read_own', t);
  end loop;
end $$;

drop trigger if exists trg_ci_scale_signal_config_touch on public.ci_scale_signal_config;
create trigger trg_ci_scale_signal_config_touch before update on public.ci_scale_signal_config
  for each row execute function public.ci_touch_updated_at();


-- ###########################################################################
-- BLOCO: 20260806100600_ci_hardening
-- ###########################################################################

-- ═══════════════════════════════════════════════════════════════════════════
-- Creative Intelligence — correções de segurança da revisão independente
--
-- Uma revisão adversarial das migrations 100000–100500 achou quatro furos.
-- Relatório completo em docs/REVISAO_INDEPENDENTE_01.md.
--
-- Esta migration é aditiva de propósito: não edita as anteriores, porque elas
-- podem já ter sido aplicadas via Lovable. Reescrever migration aplicada é como
-- se ganha drift entre o banco e o repositório.
--
-- ── O furo principal ──────────────────────────────────────────────────────
-- ci_compute_scale_signal nasceu SECURITY DEFINER com `grant execute` para
-- `authenticated`, e o corpo aceitava p_brand_id sem checar dono. Do próprio
-- navegador, com a anon key:
--
--   supabase.rpc('ci_compute_scale_signal', { p_brand_id: '<marca-de-outro>' })
--
-- ...rodava com privilégio de dono, ignorava RLS, sobrescrevia scale_signal e
-- scale_band em ci_concepts alheios, escrevia em ci_concept_scale_components e
-- ainda criava linha em ci_scale_signal_config no nome da vítima.
--
-- É a mesma classe fechada em 20260804090000: função SECURITY DEFINER exposta
-- pelo PostgREST sem checagem de posse. ci_claim_job e ci_reap_stale_jobs
-- fizeram o REVOKE certo na 100200; esta escapou.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Config não pode ter janela zero ──────────────────────────────────────
--
-- recency_window_days entra como divisor no cálculo de recência. A tabela é
-- gravável pelo usuário (é configuração dele), então gravar 0 derrubava a
-- função inteira com division_by_zero — para a marca toda, não só para a
-- linha ruim. O CHECK impede a gravação; o greatest() na função protege as
-- linhas que já existirem.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ci_scale_cfg_recency_window_positive'
  ) then
    update public.ci_scale_signal_config set recency_window_days = 30
     where recency_window_days is null or recency_window_days < 1;

    alter table public.ci_scale_signal_config
      add constraint ci_scale_cfg_recency_window_positive
      check (recency_window_days >= 1);
  end if;
end $$;


-- ── 2. Posse da marca, não só da linha ──────────────────────────────────────
--
-- `user_id = auth.uid()` protege a LINHA, mas o usuário escolhe o brand_id que
-- escreve nela. Dava para criar config apontando para a marca de outro e, na
-- prática, sequestrar os pesos do Scale Signal dela. Mesma correção vale para
-- a revisão manual de conceitos: sem esta checagem, um UPDATE movia o conceito
-- para outra marca.
create or replace function public.ci_owns_brand(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ci_brands b
     where b.id = p_brand_id and b.user_id = auth.uid()
  );
$$;

revoke all on function public.ci_owns_brand(uuid) from public, anon;
grant execute on function public.ci_owns_brand(uuid) to authenticated, service_role;

drop policy if exists ci_scale_cfg_owner on public.ci_scale_signal_config;
create policy ci_scale_cfg_owner on public.ci_scale_signal_config
  for all to authenticated
  using (user_id = auth.uid() and public.ci_owns_brand(brand_id))
  with check (user_id = auth.uid() and public.ci_owns_brand(brand_id));


-- ── 3. Revisão de conceito: só as colunas de revisão ────────────────────────
--
-- A policy anterior era `for update ... using (user_id = auth.uid())`. RLS
-- controla LINHA, nunca COLUNA — então o dono podia dar UPDATE em qualquer
-- campo da própria linha, inclusive:
--
--   .update({ scale_band: 'very_high', scale_signal: 100 })
--
-- ...forjando o sinal que o produto inteiro apresenta como observado. E
-- `brand_id` era gravável, o que movia o conceito para outra marca.
--
-- Grant por coluna é o mecanismo certo; RLS não faz isso.
revoke update on public.ci_concepts from authenticated;
grant update (
  name, description, hypothesis,
  review_status, merged_into_id, reviewed_at
) on public.ci_concepts to authenticated;

drop policy if exists ci_concepts_review on public.ci_concepts;
create policy ci_concepts_review on public.ci_concepts
  for update to authenticated
  using (user_id = auth.uid() and public.ci_owns_brand(brand_id))
  with check (user_id = auth.uid() and public.ci_owns_brand(brand_id));

-- Mesmo raciocínio para clusters de pessoas: o usuário renomeia e faz
-- merge/split, mas não reescreve contagem de aparições nem embedding.
revoke update on public.ci_person_clusters from authenticated;
grant update (
  display_name, review_status, merged_into_id, reviewed_at
) on public.ci_person_clusters to authenticated;

drop policy if exists ci_person_clusters_review on public.ci_person_clusters;
create policy ci_person_clusters_review on public.ci_person_clusters
  for update to authenticated
  using (user_id = auth.uid() and public.ci_owns_brand(brand_id))
  with check (user_id = auth.uid() and public.ci_owns_brand(brand_id));


-- ── 4. Scale Signal com checagem de dono ────────────────────────────────────
--
-- auth.uid() vem do JWT que o PostgREST injeta e o cliente não consegue
-- forjar. Chamada por service_role (worker, edge function) não tem JWT, então
-- auth.uid() é null — e aí a função roda para qualquer marca, que é o
-- comportamento desejado no backend.
create or replace function public.ci_compute_scale_signal(p_brand_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  c        record;
  cfg      public.ci_scale_signal_config%rowtype;
  v_owner  uuid;
  v_caller uuid := auth.uid();
  v_window int;
  n        jsonb;
  raw      jsonb;
  contrib  jsonb;
  v_signal numeric(6,2);
  v_band   text;
  v_count  int := 0;
  nl numeric; nav numeric; nua numeric; nvr numeric;
  nev numeric; ncr numeric; nfm numeric; nmk numeric; nrc numeric;
begin
  select b.user_id into v_owner from public.ci_brands b where b.id = p_brand_id;
  if v_owner is null then
    raise exception 'ci_compute_scale_signal: marca % não existe', p_brand_id
      using errcode = 'no_data_found';
  end if;

  -- A checagem que faltava.
  if v_caller is not null and v_caller <> v_owner then
    raise exception 'ci_compute_scale_signal: a marca % não pertence a quem chamou', p_brand_id
      using errcode = 'insufficient_privilege';
  end if;

  select * into cfg from public.ci_scale_signal_config
   where brand_id = p_brand_id and version = 'v1' limit 1;

  if not found then
    insert into public.ci_scale_signal_config (brand_id, user_id)
    values (p_brand_id, v_owner)
    returning * into cfg;
  end if;

  -- Protege linhas gravadas antes do CHECK da seção 1 existir.
  v_window := greatest(coalesce(cfg.recency_window_days, 30), 1);

  for c in
    select
      k.id, k.user_id, k.longevity_days, k.ad_count, k.unique_asset_count,
      k.variant_count, k.person_count, k.format_count, k.market_count, k.last_seen_at,
      (select count(*) from public.ci_creative_variants v
         join public.ci_ads a on a.id = v.ad_id
        where v.concept_id = k.id
          and a.started_on >= now() - make_interval(days => v_window)
      ) as recent_variants,
      (select count(*) from (
         select l.asset_id from public.ci_ad_assets l
           join public.ci_concept_members m on m.ad_id = l.ad_id
          where m.concept_id = k.id
          group by l.asset_id having count(*) > 1
       ) r) as reupload_assets
    from public.ci_concepts k
   where k.brand_id = p_brand_id
  loop
    nl  := least(coalesce(c.longevity_days,0)::numeric     / greatest(cfg.sat_longevity_days, 1), 1);
    nav := least(coalesce(c.ad_count,0)::numeric           / greatest(cfg.sat_ad_volume, 1), 1);
    nua := least(coalesce(c.unique_asset_count,0)::numeric / greatest(cfg.sat_unique_assets, 1), 1);
    nvr := least(coalesce(c.variant_count,0)::numeric      / greatest(cfg.sat_variants, 1), 1);
    ncr := least(coalesce(c.person_count,0)::numeric       / greatest(cfg.sat_creators, 1), 1);
    nfm := least(coalesce(c.format_count,0)::numeric       / greatest(cfg.sat_formats, 1), 1);
    nmk := least(coalesce(c.market_count,0)::numeric       / greatest(cfg.sat_markets, 1), 1);

    nev := case when coalesce(c.variant_count,0) = 0 then 0
                else least(c.recent_variants::numeric / c.variant_count, 1) end;

    nrc := case
             when c.last_seen_at is null then 0
             else greatest(0, least(1,
               1 - (extract(epoch from (now() - c.last_seen_at)) / 86400.0
                    - v_window) / v_window))
           end;

    v_signal := round(100 * (
        cfg.w_longevity * nl  + cfg.w_ad_volume * nav + cfg.w_unique_assets * nua
      + cfg.w_variants  * nvr + cfg.w_evolution * nev + cfg.w_creators      * ncr
      + cfg.w_formats   * nfm + cfg.w_markets   * nmk + cfg.w_recency       * nrc
    ), 2);

    v_band := case
      when coalesce(c.ad_count,0) < cfg.min_ads_for_band then 'insufficient_evidence'
      when v_signal >= cfg.band_very_high then 'very_high'
      when v_signal >= cfg.band_high      then 'high'
      when v_signal >= cfg.band_medium    then 'medium'
      else 'low'
    end;

    raw := jsonb_build_object(
      'longevity_days', c.longevity_days, 'ad_count', c.ad_count,
      'unique_assets', c.unique_asset_count, 'variants', c.variant_count,
      'recent_variants', c.recent_variants, 'creators', c.person_count,
      'formats', c.format_count, 'markets', c.market_count,
      'reupload_assets', c.reupload_assets, 'last_seen_at', c.last_seen_at);

    n := jsonb_build_object(
      'longevity', nl, 'ad_volume', nav, 'unique_assets', nua, 'variants', nvr,
      'evolution', nev, 'creators', ncr, 'formats', nfm, 'markets', nmk, 'recency', nrc);

    contrib := jsonb_build_object(
      'longevity',     round(100 * cfg.w_longevity     * nl,  2),
      'ad_volume',     round(100 * cfg.w_ad_volume     * nav, 2),
      'unique_assets', round(100 * cfg.w_unique_assets * nua, 2),
      'variants',      round(100 * cfg.w_variants      * nvr, 2),
      'evolution',     round(100 * cfg.w_evolution     * nev, 2),
      'creators',      round(100 * cfg.w_creators      * ncr, 2),
      'formats',       round(100 * cfg.w_formats       * nfm, 2),
      'markets',       round(100 * cfg.w_markets       * nmk, 2),
      'recency',       round(100 * cfg.w_recency       * nrc, 2));

    insert into public.ci_concept_scale_components
      (concept_id, brand_id, user_id, config_version, raw, normalized, contributions, signal, band, computed_at)
    values (c.id, p_brand_id, c.user_id, cfg.version, raw, n, contrib, v_signal, v_band, now())
    on conflict (concept_id, config_version) do update
      set raw = excluded.raw, normalized = excluded.normalized,
          contributions = excluded.contributions, signal = excluded.signal,
          band = excluded.band, computed_at = now();

    update public.ci_concepts
       set scale_signal = v_signal, scale_band = v_band, updated_at = now()
     where id = c.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.ci_compute_scale_signal(uuid) from public, anon;
grant execute on function public.ci_compute_scale_signal(uuid) to service_role, authenticated;


-- ── 5. ci_refresh_taxonomy_stats — a função que faltava ─────────────────────
--
-- A migration 100400 comenta "agregados, recalculados por
-- ci_refresh_taxonomy_stats()", mas a função nunca foi escrita. Sem ela,
-- ad_count e as datas de ci_taxonomy_terms ficam em zero para sempre, e as
-- views ci_hooks / ci_angles / ci_proofs mostram frequência zero — a página
-- Messages inteira sairia vazia sem nenhum erro visível.
create or replace function public.ci_refresh_taxonomy_stats(p_brand_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner  uuid;
  v_caller uuid := auth.uid();
  v_count  int;
begin
  select b.user_id into v_owner from public.ci_brands b where b.id = p_brand_id;
  if v_owner is null then
    raise exception 'ci_refresh_taxonomy_stats: marca % não existe', p_brand_id
      using errcode = 'no_data_found';
  end if;
  if v_caller is not null and v_caller <> v_owner then
    raise exception 'ci_refresh_taxonomy_stats: a marca % não pertence a quem chamou', p_brand_id
      using errcode = 'insufficient_privilege';
  end if;

  with stats as (
    select
      t.id as term_id,
      count(distinct x.ad_id)                        as ad_count,
      count(distinct x.asset_id)                     as asset_count,
      count(distinct a.concept_id)                   as concept_count,
      min(a.started_on)                              as first_seen_at,
      max(coalesce(a.ended_on, a.last_seen_at))      as last_seen_at
    from public.ci_taxonomy_terms t
    left join public.ci_ad_taxonomy x on x.term_id = t.id
    left join public.ci_ads a on a.id = x.ad_id
    where t.brand_id = p_brand_id
    group by t.id
  )
  update public.ci_taxonomy_terms t
     set ad_count      = s.ad_count,
         asset_count   = s.asset_count,
         concept_count = s.concept_count,
         first_seen_at = s.first_seen_at,
         last_seen_at  = s.last_seen_at,
         updated_at    = now()
    from stats s
   where t.id = s.term_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.ci_refresh_taxonomy_stats(uuid) from public, anon;
grant execute on function public.ci_refresh_taxonomy_stats(uuid) to service_role, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- VALIDAÇÃO — rode esta consulta DEPOIS e me mande o resultado
-- ═══════════════════════════════════════════════════════════════════════════

select
  (select count(*) from pg_tables   where schemaname='public' and tablename like 'ci\_%') as tabelas,
  (select count(*) from pg_views    where schemaname='public' and viewname  like 'ci\_%') as views,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname like 'ci\_%')                                 as funcoes,
  (select count(*) from pg_policies where schemaname='public' and tablename like 'ci\_%') as policies,
  (select count(*) from pg_indexes  where schemaname='public' and tablename like 'ci\_%') as indices,
  (select count(*) from storage.buckets where id='ci-media' and public=false)             as bucket_privado;

-- ESPERADO:
--   tabelas=32 · views=10 · funcoes=6 · policies>=33 · indices>=117 · bucket_privado=1
