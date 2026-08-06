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
