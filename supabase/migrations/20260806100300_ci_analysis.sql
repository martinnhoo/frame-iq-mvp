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
