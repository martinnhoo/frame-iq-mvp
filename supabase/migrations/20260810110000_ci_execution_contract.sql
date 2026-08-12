-- Phase B: canonical Creative Intelligence execution contract.
-- Asset observations remain asset-owned. Ad context is versioned on ci_ads.
-- Contextual results are owned by ci_ad_assets + context_hash + contract.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.ci_normalize_context_text(value text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(regexp_replace(normalize(btrim(coalesce(value, '')), NFKC), '\s+', ' ', 'g'), '')
$$;

create or replace function public.ci_normalize_landing_url(value text)
returns text
language plpgsql
immutable
parallel safe
as $$
declare
  normalized text := public.ci_normalize_context_text(value);
  without_fragment text;
  base text;
  query_text text;
  kept_query text;
begin
  if normalized is null then return null; end if;
  without_fragment := split_part(normalized, '#', 1);
  base := split_part(without_fragment, '?', 1);
  if position('?' in without_fragment) = 0 then return base; end if;
  query_text := substring(without_fragment from position('?' in without_fragment) + 1);
  select string_agg(part, '&' order by part collate "C") into kept_query
  from unnest(string_to_array(query_text, '&')) part
  where part <> ''
    and lower(split_part(part, '=', 1)) !~ '^(utm_[^=]*|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid)$';
  return base || case when kept_query is null then '' else '?' || kept_query end;
end
$$;

create or replace function public.ci_context_hash_component(value text)
returns text
language sql
immutable
parallel safe
as $$
  select case when value is null then '~' else encode(convert_to(value, 'UTF8'), 'hex') end
$$;

create or replace function public.ci_canonical_ad_context(
  body_text text,
  headline text,
  description text,
  cta text,
  landing_page text,
  display_format text,
  languages text[]
)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select
    'ad-context/v1' ||
    '|body_text=' || public.ci_context_hash_component(public.ci_normalize_context_text(body_text)) ||
    '|headline=' || public.ci_context_hash_component(public.ci_normalize_context_text(headline)) ||
    '|description=' || public.ci_context_hash_component(public.ci_normalize_context_text(description)) ||
    '|cta=' || public.ci_context_hash_component(upper(public.ci_normalize_context_text(cta))) ||
    '|landing_page=' || public.ci_context_hash_component(public.ci_normalize_landing_url(landing_page)) ||
    '|display_format=' || public.ci_context_hash_component(upper(public.ci_normalize_context_text(display_format))) ||
    '|languages=' || coalesce((
      select string_agg(public.ci_context_hash_component(normalized_item), ',' order by normalized_item collate "C")
      from (
        select distinct public.ci_normalize_context_text(item) as normalized_item
        from unnest(coalesce(languages, '{}'::text[])) item
      ) normalized_languages
      where normalized_item is not null
    ), '')
$$;

create or replace function public.ci_compute_ad_context_hash(
  body_text text,
  headline text,
  description text,
  cta text,
  landing_page text,
  display_format text,
  languages text[]
)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select encode(digest(convert_to(public.ci_canonical_ad_context(
    body_text, headline, description, cta, landing_page, display_format, languages
  ), 'UTF8'), 'sha256'), 'hex')
$$;

alter table public.ci_ads
  add column if not exists context_hash text,
  add column if not exists context_hash_version text not null default 'ad-context/v1',
  add column if not exists context_updated_at timestamptz;

create or replace function public.ci_set_ad_context_hash()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare computed text;
begin
  computed := public.ci_compute_ad_context_hash(
    new.body_text, new.headline, new.description, new.cta,
    new.landing_page, new.display_format, new.languages
  );
  if tg_op = 'INSERT' or new.context_hash is distinct from computed then
    new.context_updated_at := now();
  end if;
  new.context_hash := computed;
  new.context_hash_version := 'ad-context/v1';
  return new;
end
$$;

update public.ci_ads
set context_hash = public.ci_compute_ad_context_hash(
      body_text, headline, description, cta, landing_page, display_format, languages
    ),
    context_hash_version = 'ad-context/v1',
    context_updated_at = coalesce(context_updated_at, updated_at, created_at)
where context_hash is null or context_hash_version <> 'ad-context/v1';

alter table public.ci_ads alter column context_hash set not null;

drop trigger if exists trg_ci_ads_context_hash on public.ci_ads;
create trigger trg_ci_ads_context_hash
before insert or update of body_text, headline, description, cta, landing_page, display_format, languages
on public.ci_ads for each row execute function public.ci_set_ad_context_hash();

alter table public.ci_ad_assets
  add column if not exists brand_id uuid,
  add column if not exists context_hash_snapshot text,
  add column if not exists context_analysis_status text not null default 'pending',
  add column if not exists analyzed_context_at timestamptz,
  add column if not exists current_context_result_id uuid references public.ci_analysis_results(id) on delete set null;

alter table public.ci_ad_assets
  drop constraint if exists ci_ad_assets_context_analysis_status_check;
alter table public.ci_ad_assets
  add constraint ci_ad_assets_context_analysis_status_check
  check (context_analysis_status in ('pending','queued','running','completed','failed','stale','blocked','not_applicable'));

update public.ci_ad_assets aa
set brand_id = ad.brand_id,
    user_id = ad.user_id,
    context_hash_snapshot = ad.context_hash
from public.ci_ads ad
join public.ci_assets asset
  on asset.brand_id = ad.brand_id and asset.user_id = ad.user_id
where aa.ad_id = ad.id and aa.asset_id = asset.id
  and (aa.brand_id is null or aa.context_hash_snapshot is null);

alter table public.ci_ad_assets
  add constraint ci_ad_assets_brand_required check (brand_id is not null) not valid,
  add constraint ci_ad_assets_context_snapshot_required check (context_hash_snapshot is not null) not valid;

create or replace function public.ci_derive_ad_asset_identity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  ad_row record;
  asset_row record;
begin
  select brand_id, user_id, context_hash into strict ad_row
  from public.ci_ads where id = new.ad_id;
  select brand_id, user_id into strict asset_row
  from public.ci_assets where id = new.asset_id;
  if ad_row.brand_id <> asset_row.brand_id or ad_row.user_id <> asset_row.user_id then
    raise exception 'ci_ad_assets tenant/brand mismatch' using errcode = '23514';
  end if;
  new.brand_id := ad_row.brand_id;
  new.user_id := ad_row.user_id;
  if tg_op = 'INSERT' or new.context_hash_snapshot is null then
    new.context_hash_snapshot := ad_row.context_hash;
  end if;
  return new;
end
$$;

drop trigger if exists trg_ci_ad_assets_identity on public.ci_ad_assets;
create trigger trg_ci_ad_assets_identity
before insert or update of ad_id, asset_id on public.ci_ad_assets
for each row execute function public.ci_derive_ad_asset_identity();

create or replace function public.ci_propagate_ad_context_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.context_hash is distinct from old.context_hash then
    update public.ci_ad_assets
       set context_analysis_status = 'stale',
           analyzed_context_at = null,
           current_context_result_id = null
     where ad_id = new.id;
  end if;
  return new;
end
$$;

-- Jobs: legacy rows are explicitly mixed. New rows default to asset observation.
alter table public.ci_analysis_jobs
  add column if not exists scope text,
  add column if not exists ad_asset_id uuid references public.ci_ad_assets(id) on delete cascade,
  add column if not exists context_hash text,
  add column if not exists analysis_contract_version text,
  add column if not exists claim_token uuid,
  add column if not exists lease_generation bigint not null default 0;

update public.ci_analysis_jobs
set scope = coalesce(scope, case
      when requested_stages @> array['semantic']::text[]
        or completed_stages @> array['semantic_analysis']::text[] then 'legacy_mixed'
      else 'asset_observation'
    end),
    analysis_contract_version = coalesce(analysis_contract_version, case
      when requested_stages @> array['semantic']::text[]
        or completed_stages @> array['semantic_analysis']::text[] then 'legacy/semantic-v7'
      else 'asset-observation/v1'
    end);

alter table public.ci_analysis_jobs
  alter column scope set default 'asset_observation',
  alter column scope set not null,
  alter column analysis_contract_version set default 'asset-observation/v1',
  alter column analysis_contract_version set not null;

alter table public.ci_analysis_jobs
  drop constraint if exists ci_analysis_jobs_scope_check,
  add constraint ci_analysis_jobs_scope_check
    check (scope in ('asset_observation','context_analysis','legacy_mixed')),
  add constraint ci_analysis_jobs_context_identity_check
    check (
      (scope = 'context_analysis' and ad_asset_id is not null and context_hash is not null)
      or (scope in ('asset_observation','legacy_mixed') and ad_asset_id is null and context_hash is null)
    );

alter table public.ci_analysis_jobs drop constraint if exists ci_analysis_jobs_asset_id_key;
create unique index if not exists uq_ci_analysis_jobs_active_asset_observation
  on public.ci_analysis_jobs(asset_id, analysis_contract_version)
  where scope = 'asset_observation' and status in ('queued','running','retrying','blocked');
create unique index if not exists uq_ci_analysis_jobs_active_context
  on public.ci_analysis_jobs(ad_asset_id, context_hash, analysis_contract_version)
  where scope = 'context_analysis' and status in ('queued','running','retrying','blocked');
create unique index if not exists uq_ci_analysis_jobs_active_legacy_mixed
  on public.ci_analysis_jobs(asset_id, analysis_contract_version)
  where scope = 'legacy_mixed' and status in ('queued','running','retrying','blocked');

create or replace function public.ci_enqueue_legacy_mixed_job(
  p_asset_id uuid,
  p_brand_id uuid,
  p_user_id uuid,
  p_contract_version text default 'legacy/semantic-v7'
)
returns setof public.ci_analysis_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.ci_assets
    where id = p_asset_id and brand_id = p_brand_id and user_id = p_user_id
  ) then
    raise exception 'asset tenant/brand mismatch' using errcode = '23514';
  end if;
  return query
  insert into public.ci_analysis_jobs(
    asset_id, brand_id, user_id, scope, analysis_contract_version
  )
  select p_asset_id, p_brand_id, p_user_id, 'legacy_mixed', p_contract_version
  where not exists (
    select 1 from public.ci_analysis_jobs
    where asset_id = p_asset_id and scope = 'legacy_mixed'
      and analysis_contract_version = p_contract_version
      and status in ('queued','running','retrying','blocked')
  )
  returning *;
end
$$;
revoke all on function public.ci_enqueue_legacy_mixed_job(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.ci_enqueue_legacy_mixed_job(uuid,uuid,uuid,text) to service_role;

-- Model-run input identity and complete provenance.
alter table public.ci_model_runs
  add column if not exists ad_asset_id uuid references public.ci_ad_assets(id) on delete set null,
  add column if not exists scope text,
  add column if not exists context_hash text,
  add column if not exists analysis_contract_version text,
  add column if not exists input_schema_version text,
  add column if not exists output_schema_version text,
  add column if not exists provider_request_id text,
  add column if not exists attempt_number int not null default 1;

update public.ci_model_runs
set scope = coalesce(scope, 'legacy_mixed'),
    analysis_contract_version = coalesce(analysis_contract_version, prompt_version, 'legacy/unknown'),
    input_schema_version = coalesce(input_schema_version, 'legacy/unknown'),
    output_schema_version = coalesce(output_schema_version, 'legacy/unknown');

alter table public.ci_model_runs
  alter column scope set default 'legacy_mixed',
  alter column scope set not null,
  alter column analysis_contract_version set default 'legacy/unknown',
  alter column analysis_contract_version set not null,
  alter column input_schema_version set default 'legacy/unknown',
  alter column input_schema_version set not null,
  alter column output_schema_version set default 'legacy/unknown',
  alter column output_schema_version set not null,
  add constraint ci_model_runs_scope_check
    check (scope in ('asset_observation','context_analysis','legacy_mixed')),
  add constraint ci_model_runs_context_identity_check
    check (
      (scope = 'context_analysis' and ad_asset_id is not null and ad_id is not null
        and asset_id is not null and context_hash is not null)
      or (scope = 'asset_observation' and asset_id is not null and ad_asset_id is null
        and ad_id is null and context_hash is null)
      or scope = 'legacy_mixed'
    );

-- Results retain every version; only one result per identity may be current.
alter table public.ci_analysis_results
  add column if not exists ad_asset_id uuid references public.ci_ad_assets(id) on delete cascade,
  add column if not exists scope text,
  add column if not exists context_hash text,
  add column if not exists analysis_contract_version text,
  add column if not exists is_current boolean not null default true,
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by_id uuid references public.ci_analysis_results(id) on delete set null;

update public.ci_analysis_results
set scope = coalesce(scope, 'legacy_mixed'),
    analysis_contract_version = coalesce(analysis_contract_version, prompt_version, 'legacy/unknown');

alter table public.ci_analysis_results
  alter column scope set default 'legacy_mixed',
  alter column scope set not null,
  alter column analysis_contract_version set default 'legacy/unknown',
  alter column analysis_contract_version set not null,
  drop constraint if exists ci_analysis_results_scope_check,
  add constraint ci_analysis_results_scope_check
    check (scope in ('asset_observation','context_analysis','legacy_mixed')),
  add constraint ci_analysis_results_context_identity_check
    check (
      (scope = 'context_analysis' and ad_asset_id is not null and ad_id is not null and context_hash is not null)
      or (scope in ('asset_observation','legacy_mixed') and ad_asset_id is null and context_hash is null)
    ),
  add constraint ci_analysis_results_scope_kind_check
    check (
      scope = 'legacy_mixed'
      or (scope = 'context_analysis' and kind = 'context_semantic')
      or (scope = 'asset_observation' and kind in ('asset_semantic','structure','timing','style','summary'))
    ),
  add constraint ci_analysis_results_model_run_required
    check (kind not in ('asset_semantic','context_semantic') or model_run_id is not null) not valid;

alter table public.ci_analysis_results
  drop constraint if exists ci_analysis_results_kind_check,
  add constraint ci_analysis_results_kind_check
    check (kind in ('semantic','asset_semantic','context_semantic','structure','timing','style','summary'));

alter table public.ci_analysis_results drop constraint if exists ci_analysis_results_asset_id_kind_key;
create unique index if not exists uq_ci_results_current_asset_observation
  on public.ci_analysis_results(asset_id, kind, analysis_contract_version)
  where scope = 'asset_observation' and is_current;
create unique index if not exists uq_ci_results_current_context
  on public.ci_analysis_results(ad_asset_id, kind, context_hash, analysis_contract_version)
  where scope = 'context_analysis' and is_current;
create unique index if not exists uq_ci_results_current_legacy
  on public.ci_analysis_results(asset_id, kind, analysis_contract_version)
  where scope = 'legacy_mixed' and is_current;

create or replace function public.ci_supersede_current_result()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not new.is_current then return new; end if;
  update public.ci_analysis_results existing_result
     set is_current = false, superseded_at = now()
   where existing_result.id <> new.id
     and existing_result.is_current
     and existing_result.scope = new.scope
     and existing_result.kind = new.kind
     and existing_result.analysis_contract_version = new.analysis_contract_version
     and (
       (new.scope = 'context_analysis'
         and existing_result.ad_asset_id = new.ad_asset_id
         and existing_result.context_hash = new.context_hash)
       or (new.scope <> 'context_analysis' and existing_result.asset_id = new.asset_id)
     );
  return new;
end
$$;
drop trigger if exists trg_ci_results_supersede on public.ci_analysis_results;
create trigger trg_ci_results_supersede
before insert on public.ci_analysis_results
for each row execute function public.ci_supersede_current_result();

drop trigger if exists trg_ci_ads_context_propagate on public.ci_ads;
create trigger trg_ci_ads_context_propagate
after update of body_text, headline, description, cta, landing_page, display_format, languages
on public.ci_ads
for each row execute function public.ci_propagate_ad_context_change();

-- Assertion provenance and exact evidence identity.
alter table public.ci_ad_taxonomy
  add column if not exists ad_asset_id uuid references public.ci_ad_assets(id) on delete cascade,
  add column if not exists analysis_result_id uuid references public.ci_analysis_results(id) on delete set null,
  add column if not exists provenance_class text,
  add column if not exists claim_scope text,
  add column if not exists scene_id uuid references public.ci_scenes(id) on delete set null,
  add column if not exists keyframe_id uuid references public.ci_keyframes(id) on delete set null,
  add column if not exists transcript_segment_id uuid references public.ci_transcript_segments(id) on delete set null,
  add column if not exists onscreen_text_id uuid references public.ci_onscreen_text(id) on delete set null,
  add column if not exists evidence_identity_hash text,
  add column if not exists semantic_target_key text,
  add column if not exists analysis_contract_version text,
  add column if not exists is_current boolean not null default true,
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by_id uuid references public.ci_ad_taxonomy(id) on delete set null;

alter table public.ci_ad_taxonomy
  add column if not exists assertion_version_key text
    generated always as (
      coalesce(analysis_result_id::text, 'legacy') || '|' || coalesce(analysis_contract_version, 'legacy/unknown')
    ) stored;

update public.ci_ad_taxonomy
set provenance_class = coalesce(provenance_class, case when source = 'manual' then 'OBSERVED' else 'MODEL_INFERRED' end),
    claim_scope = coalesce(claim_scope, 'legacy_mixed'),
    analysis_contract_version = coalesce(analysis_contract_version, model_version, 'legacy/unknown'),
    semantic_target_key = coalesce(semantic_target_key, term_id::text),
    evidence_identity_hash = coalesce(evidence_identity_hash, md5(coalesce(evidence, '') || '|' || dedup_key));

alter table public.ci_ad_taxonomy
  alter column provenance_class set default 'MODEL_INFERRED',
  alter column provenance_class set not null,
  alter column claim_scope set default 'legacy_mixed',
  alter column claim_scope set not null,
  alter column analysis_contract_version set default 'legacy/unknown',
  alter column analysis_contract_version set not null,
  drop constraint if exists ci_ad_taxonomy_provenance_class_check,
  add constraint ci_ad_taxonomy_provenance_class_check
    check (provenance_class in ('OBSERVED','MACHINE_OBSERVED','MODEL_CLASSIFIED','MODEL_INFERRED','DETERMINISTIC_AGGREGATE','GENERATED_RECOMMENDATION')),
  drop constraint if exists ci_ad_taxonomy_claim_scope_check,
  add constraint ci_ad_taxonomy_claim_scope_check
    check (claim_scope in ('asset','context','legacy_mixed')),
  add constraint ci_ad_taxonomy_execution_required
    check (claim_scope = 'legacy_mixed' or ad_asset_id is not null) not valid,
  add constraint ci_ad_taxonomy_model_result_required
    check (claim_scope = 'legacy_mixed' or provenance_class not in ('MODEL_CLASSIFIED','MODEL_INFERRED') or analysis_result_id is not null) not valid;

drop index if exists public.uq_ci_adtax_ad_term_dedup;
create unique index if not exists uq_ci_adtax_versioned_assertion
  on public.ci_ad_taxonomy(ad_id, term_id, dedup_key, assertion_version_key);

create or replace function public.ci_prepare_current_assertion()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare result_row record;
begin
  if new.analysis_result_id is not null then
    select asset_id, ad_asset_id, brand_id, user_id, scope into strict result_row
    from public.ci_analysis_results where id = new.analysis_result_id;
    if result_row.asset_id is distinct from new.asset_id
       or result_row.brand_id is distinct from new.brand_id
       or result_row.user_id is distinct from new.user_id
       or (new.claim_scope = 'context' and (
         result_row.scope <> 'context_analysis'
         or result_row.ad_asset_id is distinct from new.ad_asset_id
       ))
       or (new.claim_scope = 'asset' and result_row.scope <> 'asset_observation') then
      raise exception 'ci_ad_taxonomy result/execution mismatch' using errcode = '23514';
    end if;
  end if;
  new.semantic_target_key := coalesce(new.semantic_target_key, new.term_id::text);
  new.evidence_identity_hash := coalesce(
    new.evidence_identity_hash,
    md5(coalesce(new.evidence, '') || '|' || coalesce(new.evidence_kind, '~') || '|' ||
        coalesce(new.timestamp_s, -1)::text || '|' || coalesce(new.asset_id::text, ''))
  );
  if new.is_current then
    update public.ci_ad_taxonomy existing_assertion
       set is_current = false, superseded_at = now()
     where existing_assertion.id <> new.id and existing_assertion.is_current
       and existing_assertion.ad_id = new.ad_id
       and existing_assertion.term_id = new.term_id
       and existing_assertion.dedup_key = (coalesce(new.evidence_kind, '~') || '|' || coalesce(new.timestamp_s, -1)::text)
       and existing_assertion.claim_scope = new.claim_scope
       and existing_assertion.assertion_version_key <>
         (coalesce(new.analysis_result_id::text, 'legacy') || '|' || coalesce(new.analysis_contract_version, 'legacy/unknown'));
  end if;
  return new;
end
$$;
drop trigger if exists trg_ci_ad_taxonomy_prepare_current on public.ci_ad_taxonomy;
create trigger trg_ci_ad_taxonomy_prepare_current
before insert on public.ci_ad_taxonomy
for each row execute function public.ci_prepare_current_assertion();

-- Human decisions target an immutable result/assertion version.
alter table public.ci_quality_reviews
  add column if not exists ad_asset_id uuid references public.ci_ad_assets(id) on delete cascade,
  add column if not exists analysis_result_id uuid references public.ci_analysis_results(id) on delete set null,
  add column if not exists target_assertion_id uuid references public.ci_ad_taxonomy(id) on delete set null,
  add column if not exists override_action text,
  add column if not exists corrected_term_id uuid references public.ci_taxonomy_terms(id) on delete set null,
  add column if not exists corrected_value jsonb,
  add column if not exists evidence_identity_hash text,
  add column if not exists semantic_target_key text,
  add column if not exists analysis_contract_version text,
  add column if not exists reviewer_user_id uuid references auth.users(id) on delete set null,
  add column if not exists effective_at timestamptz not null default now(),
  add column if not exists carry_forward_allowed boolean not null default false,
  add column if not exists is_current boolean not null default true,
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by_id uuid references public.ci_quality_reviews(id) on delete set null;

update public.ci_quality_reviews
set override_action = coalesce(override_action, case
      when veredito = 'errado' and valor_correto is null then 'reject'
      when valor_correto is not null then 'replace'
      when veredito = 'nao_aplicavel' then 'not_applicable'
      else 'confirm'
    end),
    analysis_contract_version = coalesce(analysis_contract_version, 'legacy/unknown'),
    reviewer_user_id = coalesce(reviewer_user_id, user_id);

alter table public.ci_quality_reviews
  alter column override_action set default 'confirm',
  alter column override_action set not null,
  alter column analysis_contract_version set default 'legacy/unknown',
  alter column analysis_contract_version set not null,
  add constraint ci_quality_reviews_override_action_check
    check (override_action in ('confirm','reject','replace','not_applicable')),
  add constraint ci_quality_reviews_carry_forward_check
    check (not carry_forward_allowed or (evidence_identity_hash is not null and semantic_target_key is not null));

create or replace function public.ci_prepare_quality_review()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare assertion_row record;
begin
  if new.target_assertion_id is not null then
    select ad_id, ad_asset_id, asset_id, analysis_result_id, brand_id, user_id,
           evidence_identity_hash, semantic_target_key, analysis_contract_version
      into strict assertion_row
    from public.ci_ad_taxonomy where id = new.target_assertion_id;
    new.ad_id := assertion_row.ad_id;
    new.ad_asset_id := assertion_row.ad_asset_id;
    new.asset_id := assertion_row.asset_id;
    new.analysis_result_id := assertion_row.analysis_result_id;
    new.brand_id := assertion_row.brand_id;
    new.user_id := assertion_row.user_id;
    new.evidence_identity_hash := assertion_row.evidence_identity_hash;
    new.semantic_target_key := assertion_row.semantic_target_key;
    new.analysis_contract_version := assertion_row.analysis_contract_version;
  end if;
  new.reviewer_user_id := coalesce(auth.uid(), new.reviewer_user_id, new.user_id);
  return new;
end
$$;
drop trigger if exists trg_ci_quality_review_identity on public.ci_quality_reviews;
create trigger trg_ci_quality_review_identity
before insert or update on public.ci_quality_reviews
for each row execute function public.ci_prepare_quality_review();

alter table public.ci_quality_reviews drop constraint if exists ci_quality_reviews_ad_id_campo_key;
create unique index if not exists uq_ci_quality_current_assertion
  on public.ci_quality_reviews(target_assertion_id) where is_current and target_assertion_id is not null;
create unique index if not exists uq_ci_quality_current_legacy_field
  on public.ci_quality_reviews(ad_id, campo) where is_current and target_assertion_id is null;

-- Composite tenant consistency. NOT VALID preserves legacy rows while enforcing new writes.
alter table public.ci_ads add constraint uq_ci_ads_id_brand_user unique (id, brand_id, user_id);
alter table public.ci_assets add constraint uq_ci_assets_id_brand_user unique (id, brand_id, user_id);
alter table public.ci_ad_assets add constraint uq_ci_ad_assets_id_brand_user unique (id, brand_id, user_id);
alter table public.ci_ad_assets add constraint uq_ci_ad_assets_execution_tenant unique (id, ad_id, asset_id, brand_id, user_id);
alter table public.ci_ad_assets add constraint uq_ci_ad_assets_asset_tenant unique (id, asset_id, brand_id, user_id);
alter table public.ci_analysis_results add constraint uq_ci_results_id_brand_user unique (id, brand_id, user_id);
alter table public.ci_analysis_results add constraint uq_ci_results_execution_tenant unique (id, ad_asset_id, brand_id, user_id);
alter table public.ci_analysis_results add constraint uq_ci_results_context_snapshot_tenant unique (id, ad_asset_id, context_hash, brand_id, user_id);
alter table public.ci_model_runs add constraint uq_ci_model_runs_id_brand_user unique (id, brand_id, user_id);
alter table public.ci_ad_taxonomy add constraint uq_ci_ad_taxonomy_id_brand_user unique (id, brand_id, user_id);

alter table public.ci_ad_assets
  add constraint fk_ci_ad_assets_ad_tenant foreign key (ad_id, brand_id, user_id)
    references public.ci_ads(id, brand_id, user_id) not valid,
  add constraint fk_ci_ad_assets_asset_tenant foreign key (asset_id, brand_id, user_id)
    references public.ci_assets(id, brand_id, user_id) not valid;
alter table public.ci_analysis_jobs
  add constraint fk_ci_analysis_jobs_asset_tenant foreign key (asset_id, brand_id, user_id)
    references public.ci_assets(id, brand_id, user_id) not valid,
  add constraint fk_ci_analysis_jobs_execution_tenant foreign key (ad_asset_id, asset_id, brand_id, user_id)
    references public.ci_ad_assets(id, asset_id, brand_id, user_id) not valid;
alter table public.ci_model_runs
  add constraint fk_ci_model_runs_asset_tenant foreign key (asset_id, brand_id, user_id)
    references public.ci_assets(id, brand_id, user_id) not valid,
  add constraint fk_ci_model_runs_execution_tenant foreign key (ad_asset_id, ad_id, asset_id, brand_id, user_id)
    references public.ci_ad_assets(id, ad_id, asset_id, brand_id, user_id) not valid;
alter table public.ci_analysis_results
  add constraint fk_ci_results_asset_tenant foreign key (asset_id, brand_id, user_id)
    references public.ci_assets(id, brand_id, user_id) not valid,
  add constraint fk_ci_results_execution_tenant foreign key (ad_asset_id, ad_id, asset_id, brand_id, user_id)
    references public.ci_ad_assets(id, ad_id, asset_id, brand_id, user_id) not valid,
  add constraint fk_ci_results_model_run_tenant foreign key (model_run_id, brand_id, user_id)
    references public.ci_model_runs(id, brand_id, user_id) not valid;
alter table public.ci_ad_taxonomy
  add constraint fk_ci_ad_taxonomy_ad_tenant foreign key (ad_id, brand_id, user_id)
    references public.ci_ads(id, brand_id, user_id) not valid,
  add constraint fk_ci_ad_taxonomy_asset_tenant foreign key (asset_id, brand_id, user_id)
    references public.ci_assets(id, brand_id, user_id) not valid,
  add constraint fk_ci_ad_taxonomy_execution_tenant foreign key (ad_asset_id, ad_id, asset_id, brand_id, user_id)
    references public.ci_ad_assets(id, ad_id, asset_id, brand_id, user_id) not valid,
  add constraint fk_ci_ad_taxonomy_result_tenant foreign key (analysis_result_id, brand_id, user_id)
    references public.ci_analysis_results(id, brand_id, user_id) not valid;
alter table public.ci_ad_assets
  add constraint fk_ci_ad_assets_current_context_result foreign key (current_context_result_id, id, context_hash_snapshot, brand_id, user_id)
    references public.ci_analysis_results(id, ad_asset_id, context_hash, brand_id, user_id) not valid;
alter table public.ci_quality_reviews
  add constraint fk_ci_quality_reviews_assertion_tenant foreign key (target_assertion_id, brand_id, user_id)
    references public.ci_ad_taxonomy(id, brand_id, user_id) not valid,
  add constraint fk_ci_quality_reviews_result_tenant foreign key (analysis_result_id, brand_id, user_id)
    references public.ci_analysis_results(id, brand_id, user_id) not valid,
  add constraint fk_ci_quality_reviews_execution_tenant foreign key (ad_asset_id, brand_id, user_id)
    references public.ci_ad_assets(id, brand_id, user_id) not valid;

-- Static-image contract support. Existing images remain dry-run candidates.
alter table public.ci_scenes add column if not exists segment_kind text not null default 'video_scene';
alter table public.ci_scenes
  add constraint ci_scenes_segment_kind_check check (segment_kind in ('video_scene','static'));

create or replace function public.ci_create_static_segment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.media_type = 'image' then
    insert into public.ci_scenes(
      asset_id, brand_id, user_id, scene_index, start_seconds, end_seconds,
      source, confidence, segment_kind
    ) values (new.id, new.brand_id, new.user_id, 0, 0, 0, 'static', 1, 'static')
    on conflict (asset_id, scene_index) do nothing;
  end if;
  return new;
end
$$;
drop trigger if exists trg_ci_assets_static_segment on public.ci_assets;
create trigger trg_ci_assets_static_segment
after insert on public.ci_assets for each row execute function public.ci_create_static_segment();

-- Deterministic read-only legacy classifier and counts.
create or replace view public.ci_legacy_context_classification as
with link_stats as (
  select
    asset.id as asset_id,
    asset.brand_id,
    asset.user_id,
    asset.media_type,
    asset.analysis_status,
    asset.analyzed_at,
    count(distinct aa.ad_id)::int as ad_count,
    count(distinct ad.context_hash)::int as context_count,
    bool_or(aa.created_at > coalesce(asset.analyzed_at, 'infinity'::timestamptz)) as late_duplicate,
    exists (select 1 from public.ci_analysis_results r where r.asset_id = asset.id and r.scope = 'legacy_mixed') as legacy_mixed,
    exists (select 1 from public.ci_transcripts tr where tr.asset_id = asset.id)
      or exists (select 1 from public.ci_scenes sc where sc.asset_id = asset.id and sc.segment_kind = 'video_scene')
      or exists (select 1 from public.ci_keyframes k where k.asset_id = asset.id) as has_observations
  from public.ci_assets asset
  left join public.ci_ad_assets aa on aa.asset_id = asset.id
  left join public.ci_ads ad on ad.id = aa.ad_id
  group by asset.id
)
select
  *,
  case
    when context_count > 1 then 'multiple_distinct_contexts'
    when ad_count > 1 and context_count = 1 then 'multiple_ads_identical_context'
    when ad_count = 1 and context_count = 1 then 'one_asset_one_context'
    else 'no_context'
  end as primary_classification,
  (context_count > 1 and legacy_mixed) as contaminated,
  (media_type = 'video' and not has_observations) as missing_observations,
  (media_type = 'image' and analysis_status <> 'completed') as static_unanalysed
from link_stats;
alter view public.ci_legacy_context_classification set (security_invoker = on);

create or replace function public.ci_legacy_context_dry_run(p_brand_id uuid)
returns table(classification text, asset_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select label, count(*)
  from public.ci_legacy_context_classification c
  cross join lateral unnest(array_remove(array[
    c.primary_classification,
    case when c.late_duplicate then 'late_duplicates' end,
    case when c.legacy_mixed then 'legacy_mixed' end,
    case when c.contaminated then 'contaminated' end,
    case when c.missing_observations then 'missing_observations' end,
    case when c.static_unanalysed then 'static_unanalysed' end
  ], null)) label
  where c.brand_id = p_brand_id
  group by label order by label
$$;

create or replace view public.ci_current_ad_taxonomy as
select assertion.*
from public.ci_ad_taxonomy assertion
left join public.ci_legacy_context_classification legacy on legacy.asset_id = assertion.asset_id
left join public.ci_analysis_results result on result.id = assertion.analysis_result_id
where assertion.is_current and assertion.superseded_by_id is null
  and (assertion.analysis_result_id is null or (result.is_current and result.superseded_by_id is null))
  and (assertion.claim_scope <> 'legacy_mixed' or not coalesce(legacy.contaminated, false));
alter view public.ci_current_ad_taxonomy set (security_invoker = on);

create or replace view public.ci_effective_ad_taxonomy as
select
  current_assertion.*,
  coalesce(review.corrected_term_id, current_assertion.term_id) as effective_term_id,
  review.corrected_value,
  review.id as human_review_id,
  (review.id is not null) as has_human_override
from public.ci_current_ad_taxonomy current_assertion
left join lateral (
  select qr.* from public.ci_quality_reviews qr
  where qr.target_assertion_id = current_assertion.id and qr.is_current
  order by qr.created_at desc limit 1
) review on true
where coalesce(review.override_action, 'confirm') not in ('reject','not_applicable');
alter view public.ci_effective_ad_taxonomy set (security_invoker = on);

comment on view public.ci_current_ad_taxonomy is
  'Current model assertions only; dynamically excludes contaminated multi-context legacy semantics.';
comment on view public.ci_effective_ad_taxonomy is
  'Current assertions after exact-version human reject/replace overrides; raw history remains intact.';
