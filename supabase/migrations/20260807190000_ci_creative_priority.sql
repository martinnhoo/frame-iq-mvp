-- ═══════════════════════════════════════════════════════════════════════════
-- T6 · Current Creative Priority — o que mais se repete AGORA
--
-- ── A pergunta que a home passa a responder primeiro ──────────────────────
--
--   Receita                    Assets  Variações  Pessoas  Presença
--   Permanece no lugar             84         27       12   muito alta
--   Antes/depois                   61         14        8   alta
--
-- ── A ordem das colunas é a decisão de produto ────────────────────────────
-- Dados brutos primeiro, rótulo depois. A tentação é abrir com um score — um
-- número de 0 a 100, uma nota, uma barra. Um score abstrato na primeira coluna
-- é lido como desempenho, e desempenho é exatamente o que não temos.
--
-- Mostrar 84 assets, 27 variações, 12 pessoas — e SÓ ENTÃO "presença: muito
-- alta" — mantém o leitor ancorado no que foi observado. Se ele discordar do
-- rótulo, os números que o produziram estão ali do lado.
--
-- ── "Presença" é relativa à própria marca ─────────────────────────────────
-- Não existe escala absoluta: 84 assets é muito para uma marca pequena e pouco
-- para a Trafilea. O rótulo compara a receita com o total DAQUELA marca, e o
-- motivo vem junto, escrito ("21 de 40 assets únicos"). Um rótulo sem o número
-- que o gerou é um score disfarçado.
--
-- ── Por que isto sai do navegador ─────────────────────────────────────────
-- A home fazia fetchEverything().filter().reduce() para montar esta tabela.
-- Com 40 anúncios dava certo; com 3.000 pesa e com 50.000 não roda. Aqui o
-- trabalho acontece uma vez, no Postgres, sobre índice.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.ci_creative_priority(p_brand_id uuid)
returns table (
  concept_id      uuid,
  nome            text,
  ads             int,
  assets_unicos   int,
  variacoes       int,    -- soma dos valores distintos nos eixos que VARIARAM
  eixos_variados  int,
  eixos_mantidos  int,
  pessoas         int,    -- sempre 0 hoje: agrupamento não construído
  ativos          int,
  dias_no_ar      int,
  duracao_min_s   int,
  duracao_max_s   int,
  hook_dominante  text,
  presenca        text,   -- muito alta | alta | média | baixa
  presenca_motivo text,
  share_pct       int
)
language sql
stable
security invoker
set search_path = public
as $$
  with reais as (
    select a.id as ad_id
      from public.ci_ads a
     where a.brand_id = p_brand_id and not a.is_demo
  ),
  -- Denominador da presença: assets ÚNICOS da marca, não anúncios. O mesmo
  -- vídeo em cinco anúncios é um criativo, e contar cinco faria uma receita
  -- reciclada parecer maior do que é.
  total_marca as (
    select greatest(1, count(distinct aa.asset_id))::int as n
      from public.ci_ad_assets aa
      join reais r on r.ad_id = aa.ad_id
  ),

  membros as (
    select cm.concept_id, cm.ad_id
      from public.ci_concept_members cm
      join reais r on r.ad_id = cm.ad_id
  ),

  numeros as (
    select
      m.concept_id,
      count(distinct m.ad_id)::int                                   as ads,
      count(distinct aa.asset_id)::int                               as assets_unicos,
      count(distinct m.ad_id) filter (where a.is_active)::int        as ativos,
      coalesce(max(a.running_days), 0)::int                          as dias_no_ar,
      round(min(ass.duration_seconds))::int                          as dur_min,
      round(max(ass.duration_seconds))::int                          as dur_max
    from membros m
    join public.ci_ads a             on a.id = m.ad_id
    left join public.ci_ad_assets aa on aa.ad_id = m.ad_id
    left join public.ci_assets ass   on ass.id = aa.asset_id
    group by m.concept_id
  ),

  -- Os eixos, reusando exatamente a mesma classificação da tela de receitas.
  -- Chamar a função em vez de repetir a regra é o ponto: duas definições de
  -- "variou" divergiriam com o tempo, e a home passaria a discordar da tela de
  -- detalhe sem ninguém entender por quê.
  eixos as (
    select
      n.concept_id,
      coalesce(sum(v.n_valores) filter (where v.papel = 'variado'), 0)::int as variacoes,
      count(*) filter (where v.papel = 'variado')::int                      as eixos_variados,
      count(*) filter (where v.papel = 'mantido')::int                      as eixos_mantidos
    from numeros n
    left join lateral public.ci_concept_variation(n.concept_id) v on true
    group by n.concept_id
  ),

  hook_da_receita as (
    select distinct on (m.concept_id)
           m.concept_id,
           t.label
      from membros m
      join public.ci_ad_taxonomy at   on at.ad_id = m.ad_id
      join public.ci_taxonomy_terms t on t.id = at.term_id
     where t.kind in ('hook', 'hook_written', 'hook_visual')
       and coalesce(at.evidence, '') <> ''
     group by m.concept_id, t.label
     order by m.concept_id, count(*) desc, t.label
  )

  select
    c.id,
    c.name,
    n.ads,
    n.assets_unicos,
    e.variacoes,
    e.eixos_variados,
    e.eixos_mantidos,
    -- Agrupamento de pessoas ainda não existe. Devolver 0 com a coluna
    -- presente é honesto; omitir a coluna esconderia que ela foi combinada.
    0::int,
    n.ativos,
    n.dias_no_ar,
    n.dur_min,
    n.dur_max,
    h.label,
    case
      -- Piso absoluto ANTES da porcentagem. Numa marca com 7 assets, uma
      -- receita de 1 dá 14% e a regra percentual a chamaria de "alta" — mas um
      -- criativo não é padrão, é um criativo. Percentual com denominador
      -- pequeno é ruído, e ruído no topo da home vira decisão errada.
      --
      -- Mesmo princípio do MINIMO_AMOSTRA no módulo de confiança: abaixo de um
      -- mínimo, a medida não é medida.
      when n.assets_unicos < 3 then 'baixa'
      when (100.0 * n.assets_unicos / t.n) >= 25 then 'muito alta'
      when (100.0 * n.assets_unicos / t.n) >= 12 then 'alta'
      when (100.0 * n.assets_unicos / t.n) >= 5  then 'média'
      else 'baixa'
    end,
    case when n.assets_unicos < 3
         then n.assets_unicos || ' de ' || t.n
              || ' assets únicos — poucos criativos para chamar de padrão'
         else n.assets_unicos || ' de ' || t.n || ' assets únicos da marca'
    end,
    round(100.0 * n.assets_unicos / t.n)::int
  from numeros n
  join public.ci_concepts c on c.id = n.concept_id
  join eixos e              on e.concept_id = n.concept_id
  left join hook_da_receita h on h.concept_id = n.concept_id
  cross join total_marca t
  where c.brand_id = p_brand_id
  order by n.assets_unicos desc, e.variacoes desc, c.name;
$$;

revoke all on function public.ci_creative_priority(uuid) from public;
grant execute on function public.ci_creative_priority(uuid) to authenticated;

comment on function public.ci_creative_priority(uuid) is
  'O que mais se repete agora. Dados brutos primeiro; "presença" é relativa à '
  'própria marca e vem sempre com o número que a gerou.';
