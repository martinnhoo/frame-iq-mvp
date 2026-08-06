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
