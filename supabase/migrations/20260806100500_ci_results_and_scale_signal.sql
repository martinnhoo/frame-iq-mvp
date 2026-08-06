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
