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
