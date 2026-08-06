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
