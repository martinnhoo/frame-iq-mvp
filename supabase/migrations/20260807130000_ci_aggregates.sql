-- ═══════════════════════════════════════════════════════════════════════════
-- Agregações no servidor — o painel para de baixar a base inteira
--
-- ── O problema ────────────────────────────────────────────────────────────
-- Hoje toda tela faz o equivalente a fetchEverything().filter().reduce() no
-- navegador. Com 31 anúncios funciona. Com 3.000 pesa; com 15.000 de uma marca
-- como a Trafilea, ou 50.000 somando várias, não roda — e o navegador não
-- avisa que está lento, ele só trava.
--
-- Isto move o cálculo para onde os dados estão. O painel passa a baixar
-- dezenas de linhas em vez de dezenas de milhares.
--
-- ── Uma decisão que atravessa todas as funções ────────────────────────────
-- `is_demo` é excluído em TODA agregação. O anúncio semeado para provar o
-- pipeline não é dado da marca, e já apareceu como hook da Shapermint uma vez
-- por eu ter esquecido de filtrar. Aqui está no SQL, num lugar só, em vez de
-- repetido em cada tela — que é onde o esquecimento mora.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── ci_brand_overview ──────────────────────────────────────────────────────
-- Os cinco KPIs do topo, numa consulta.
create or replace function public.ci_brand_overview(p_brand_id uuid)
returns table (
  ads_total          int,
  ads_reais          int,
  ads_ativos         int,
  assets_unicos      int,
  assets_analisados  int,
  cobertura_pct      int,
  receitas           int,
  pessoas            int,
  termos             int
)
language sql
stable
security invoker   -- a RLS decide o que este usuário vê; não contornamos nada
set search_path = public
as $$
  with a as (
    select * from public.ci_ads where brand_id = p_brand_id
  ),
  ativos as (
    select count(*) filter (where is_active and not is_demo) as n from a
  ),
  ass as (
    select count(*) as total,
           count(*) filter (where analysis_status = 'completed') as ok
      from public.ci_assets where brand_id = p_brand_id
  )
  select
    (select count(*) from a)::int,
    (select count(*) filter (where not is_demo) from a)::int,
    (select n from ativos)::int,
    (select total from ass)::int,
    (select ok from ass)::int,
    case when (select total from ass) > 0
         then round(100.0 * (select ok from ass) / (select total from ass))::int
         else 0 end,
    (select count(*) from public.ci_concepts where brand_id = p_brand_id)::int,
    (select count(*) from public.ci_person_clusters where brand_id = p_brand_id)::int,
    (select count(*) from public.ci_taxonomy_terms where brand_id = p_brand_id)::int;
$$;


-- ── ci_terms_ranked ────────────────────────────────────────────────────────
-- Termos de um tipo, com contagem de anúncios e assets, já ordenados e
-- limitados. Substitui o "baixa tudo e conta no navegador" de hooks, mensagens
-- e mix criativo.
create or replace function public.ci_terms_ranked(
  p_brand_id uuid,
  p_kinds    text[],
  p_limit    int default 20
)
returns table (
  term_id     uuid,
  kind        text,
  label       text,
  slug        text,
  ads         int,
  assets      int,
  evidencia   text,
  confianca   numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.id, t.kind, t.label, t.slug,
    count(distinct at.ad_id)::int    as ads,
    count(distinct at.asset_id)::int as assets,
    -- Uma evidência representativa: a de maior confiança. A tela mostra uma;
    -- quem quiser todas abre o anúncio.
    (array_agg(at.evidence order by at.confidence desc nulls last)
       filter (where coalesce(at.evidence,'') <> ''))[1] as evidencia,
    round(avg(at.confidence), 4)     as confianca
  from public.ci_taxonomy_terms t
  join public.ci_ad_taxonomy at on at.term_id = t.id
  join public.ci_ads ad         on ad.id = at.ad_id
  where t.brand_id = p_brand_id
    and t.kind = any(p_kinds)
    and not ad.is_demo          -- demonstração nunca entra em agregado
  group by t.id, t.kind, t.label, t.slug
  order by ads desc, assets desc, t.label
  limit p_limit;
$$;


-- ── ci_script_structures ───────────────────────────────────────────────────
-- A sequência de funções de cena por asset, e quantos assets repetem cada
-- sequência. Estava sendo calculado no navegador; com milhares de cenas isso
-- deixa de ser viável.
--
-- Cenas consecutivas com a MESMA função contam uma vez: dois anúncios com o
-- mesmo roteiro e cortes diferentes são a mesma estrutura, e tratá-los como
-- diferentes mostraria variação onde não há.
create or replace function public.ci_script_structures(
  p_brand_id uuid,
  p_limit    int default 10
)
returns table (passos text[], assets int)
language sql
stable
security invoker
set search_path = public
as $$
  with ordenado as (
    select
      s.asset_id,
      s.scene_index,
      s.scene_function,
      lag(s.scene_function) over (partition by s.asset_id order by s.scene_index) as anterior
    from public.ci_scenes s
    join public.ci_assets a on a.id = s.asset_id
    where s.brand_id = p_brand_id
      and s.scene_function is not null
      -- Asset ligado APENAS a anúncio de demonstração fica de fora. A
      -- deduplicação é por SHA-256, então o mesmo vídeo pode estar nos dois
      -- lados; nesse caso é dado real e entra.
      and exists (
        select 1 from public.ci_ad_assets aa
        join public.ci_ads ad on ad.id = aa.ad_id
        where aa.asset_id = s.asset_id and not ad.is_demo
      )
  ),
  colapsado as (
    select asset_id, scene_index, scene_function
      from ordenado
     where anterior is distinct from scene_function
  ),
  sequencias as (
    select asset_id,
           array_agg(scene_function order by scene_index) as passos
      from colapsado
     group by asset_id
    having count(*) >= 2   -- um passo só não é estrutura
  )
  select passos, count(*)::int as assets
    from sequencias
   group by passos
   order by assets desc
   limit p_limit;
$$;


-- ── ci_concept_variation ───────────────────────────────────────────────────
-- O coração do produto: dentro de uma receita, o que se MANTEVE e o que MUDOU.
--
-- Um eixo é `mantido` quando tem um valor só, presente em TODOS os anúncios da
-- receita. Um valor presente em metade não é padrão — é lacuna de dado, e
-- chamar de padrão seria inventar consistência.
create or replace function public.ci_concept_variation(p_concept_id uuid)
returns table (
  kind        text,
  mantido     boolean,
  valores     jsonb,     -- [{label, ads}] ordenado por ads desc
  n_valores   int
)
language sql
stable
security invoker
set search_path = public
as $$
  with membros as (
    select cm.ad_id, cm.brand_id
      from public.ci_concept_members cm
     where cm.concept_id = p_concept_id
  ),
  total as (select count(*)::int as n from membros),
  por_valor as (
    select t.kind, t.label, count(distinct at.ad_id)::int as ads
      from membros m
      join public.ci_ad_taxonomy at on at.ad_id = m.ad_id
      join public.ci_taxonomy_terms t on t.id = at.term_id
     group by t.kind, t.label
  )
  select
    v.kind,
    (count(*) = 1 and max(v.ads) = (select n from total) and (select n from total) > 1) as mantido,
    jsonb_agg(jsonb_build_object('label', v.label, 'ads', v.ads) order by v.ads desc) as valores,
    count(*)::int as n_valores
  from por_valor v
  group by v.kind
  order by count(*) desc, v.kind;
$$;


revoke all on function public.ci_brand_overview(uuid)      from public;
revoke all on function public.ci_terms_ranked(uuid,text[],int) from public;
revoke all on function public.ci_script_structures(uuid,int)   from public;
revoke all on function public.ci_concept_variation(uuid)   from public;

grant execute on function public.ci_brand_overview(uuid)      to authenticated;
grant execute on function public.ci_terms_ranked(uuid,text[],int) to authenticated;
grant execute on function public.ci_script_structures(uuid,int)   to authenticated;
grant execute on function public.ci_concept_variation(uuid)   to authenticated;


-- ── Índices que estas funções pedem ────────────────────────────────────────
create index if not exists idx_ci_adtax_term_ad on public.ci_ad_taxonomy(term_id, ad_id);
create index if not exists idx_ci_scenes_asset_idx on public.ci_scenes(asset_id, scene_index);
create index if not exists idx_ci_ads_brand_demo on public.ci_ads(brand_id, is_demo);


-- ── Conferência ────────────────────────────────────────────────────────────
select proname, pg_get_function_identity_arguments(oid) as args
  from pg_proc
 where proname in ('ci_brand_overview','ci_terms_ranked',
                   'ci_script_structures','ci_concept_variation')
 order by proname;
