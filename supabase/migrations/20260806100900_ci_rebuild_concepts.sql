-- ═══════════════════════════════════════════════════════════════════════════
-- ci_rebuild_concepts — agrupa anúncios em RECEITAS CRIATIVAS
--
-- Uma receita é um conjunto de anúncios que contam a MESMA ideia com execuções
-- diferentes. É o que transforma "40 anúncios analisados" em "6 ideias, e esta
-- aqui a marca repetiu 12 vezes".
--
-- ── Por que regras e não embedding ────────────────────────────────────────
-- A tabela prevê 'embedding' como método, e um dia será melhor. Mas regra tem
-- uma propriedade que embedding não tem: dá para EXPLICAR por que dois anúncios
-- caíram juntos, e a explicação vai gravada em match_reasons. Num produto cujo
-- rodapé promete que tudo é observado e sustentado por evidência, um
-- agrupamento que ninguém consegue justificar seria a peça mais fraca da
-- cadeia. Começamos pelo que se defende.
--
-- ── A assinatura ─────────────────────────────────────────────────────────
-- Três eixos, nesta ordem de importância:
--
--   angle       o argumento — POR QUE comprar
--   mechanism   como o produto entrega — quando o modelo identifica
--   proof       com o que a promessa é sustentada
--
-- Hook fica de FORA da assinatura de propósito. Hook é a execução, não a ideia:
-- a mesma receita testada com cinco aberturas diferentes é exatamente o padrão
-- que interessa descobrir. Se o hook entrasse na chave, cada variação viraria
-- uma receita solitária e o painel mostraria 40 receitas de 1 anúncio — que é
-- o mesmo que não agrupar nada.
--
-- Anúncio sem NENHUM dos três eixos não entra em receita. Ficaria num balaio
-- "diversos" que finge estrutura onde não há.
--
-- ── Idempotência ─────────────────────────────────────────────────────────
-- Reprocessar é seguro: as receitas geradas por sistema da marca são apagadas
-- e reconstruídas. O que um humano confirmou, renomeou ou fundiu
-- (review_status <> 'unreviewed') é PRESERVADO — reconstruir não pode apagar
-- trabalho de revisão.
-- ═══════════════════════════════════════════════════════════════════════════

-- A assinatura precisa ser única por marca para o upsert funcionar.
create unique index if not exists uq_ci_concepts_brand_signature
  on public.ci_concepts(brand_id, signature)
  where signature is not null;


create or replace function public.ci_rebuild_concepts(p_brand_id uuid)
returns table (
  conceitos_criados  int,
  anuncios_agrupados int,
  anuncios_sem_sinal int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner   uuid;
  v_caller  uuid := auth.uid();
  v_criados int := 0;
  v_membros int := 0;
  v_orfaos  int := 0;
begin
  -- Mesma checagem de dono de ci_compute_scale_signal. SECURITY DEFINER sem
  -- isto deixaria qualquer usuário autenticado reconstruir — e ler, pelo
  -- retorno — os conceitos de marca alheia.
  select user_id into v_owner from public.ci_brands where id = p_brand_id;
  if v_owner is null then
    raise exception 'ci_rebuild_concepts: marca % não existe', p_brand_id
      using errcode = 'no_data_found';
  end if;
  if v_caller is not null and v_caller <> v_owner then
    raise exception 'ci_rebuild_concepts: a marca % não pertence a quem chamou', p_brand_id
      using errcode = 'insufficient_privilege';
  end if;

  -- ── 1. Eixo dominante de cada anúncio ───────────────────────────────────
  -- "Dominante" = maior confiança. Empate desempata pelo termo mais usado na
  -- marca, e depois pelo slug — para o resultado não depender da ordem em que
  -- o Postgres devolveu as linhas.
  create temp table _eixos on commit drop as
  with ranqueado as (
    select
      at.ad_id,
      t.kind,
      t.id   as term_id,
      t.label,
      row_number() over (
        partition by at.ad_id, t.kind
        order by at.confidence desc nulls last, t.ad_count desc, t.slug
      ) as pos
    from public.ci_ad_taxonomy at
    join public.ci_taxonomy_terms t on t.id = at.term_id
    where at.brand_id = p_brand_id
      and t.kind in ('angle','mechanism','proof','demonstration','product_type')
      -- Sem evidência o termo nem deveria existir; se existir, não vira chave.
      and coalesce(at.evidence, '') <> ''
  )
  select
    ad_id,
    max(term_id) filter (where kind = 'angle'        and pos = 1) as angle_id,
    max(label)   filter (where kind = 'angle'        and pos = 1) as angle_label,
    max(term_id) filter (where kind = 'mechanism'    and pos = 1) as mechanism_id,
    max(label)   filter (where kind = 'mechanism'    and pos = 1) as mechanism_label,
    -- 'demonstration' conta como prova quando não há 'proof': mostrar o produto
    -- funcionando É a prova, e separar os dois fragmentaria receitas idênticas.
    coalesce(
      max(term_id) filter (where kind = 'proof'         and pos = 1),
      max(term_id) filter (where kind = 'demonstration' and pos = 1)
    ) as proof_id,
    coalesce(
      max(label) filter (where kind = 'proof'         and pos = 1),
      max(label) filter (where kind = 'demonstration' and pos = 1)
    ) as proof_label,
    max(term_id) filter (where kind = 'product_type' and pos = 1) as product_id
  from ranqueado
  group by ad_id;

  -- ── 2. Assinatura ───────────────────────────────────────────────────────
  create temp table _assinaturas on commit drop as
  select
    e.*,
    -- coalesce com '~' e não com '': '' colidiria com um rótulo vazio, e '~'
    -- não aparece em slug nenhum.
    coalesce(e.angle_id::text, '~') || '|' ||
    coalesce(e.mechanism_id::text, '~') || '|' ||
    coalesce(e.proof_id::text, '~') as signature
  from _eixos e
  where e.angle_id is not null
     or e.mechanism_id is not null
     or e.proof_id is not null;

  select count(*) into v_orfaos
  from public.ci_ads a
  where a.brand_id = p_brand_id
    and a.id not in (select ad_id from _assinaturas);

  -- ── 3. Limpa só o que foi gerado por máquina ────────────────────────────
  delete from public.ci_concepts c
  where c.brand_id = p_brand_id
    and c.review_status = 'unreviewed'
    and c.grouping_method = 'rules';

  -- ── 4. Cria as receitas ─────────────────────────────────────────────────
  with agrupado as (
    select
      s.signature,
      max(s.angle_id)       as angle_id,
      max(s.mechanism_id)   as mechanism_id,
      max(s.proof_id)       as proof_id,
      max(s.product_id)     as product_id,
      -- Nome legível a partir dos rótulos que formaram a chave. Sem eles o
      -- painel mostraria uma lista de UUIDs.
      coalesce(
        nullif(concat_ws(' + ',
          max(s.angle_label),
          max(s.mechanism_label),
          max(s.proof_label)
        ), ''),
        'Receita sem rótulo'
      ) as nome,
      count(*) as ads
    from _assinaturas s
    group by s.signature
  ),
  inserido as (
    insert into public.ci_concepts (
      brand_id, user_id, name, description, signature,
      angle_term_id, mechanism_term_id, proof_term_id, product_term_id,
      grouping_method, confidence, review_status, ad_count
    )
    select
      p_brand_id, v_owner, g.nome,
      'Agrupado por regra: mesmo ângulo, mecanismo e prova. ' ||
      g.ads || ' anúncio(s) com esta assinatura.',
      g.signature,
      g.angle_id, g.mechanism_id, g.proof_id, g.product_id,
      'rules',
      -- Confiança pela completude da assinatura: os três eixos valem mais que
      -- um só. Não é probabilidade, é quanto da chave estava preenchida — e
      -- está dito assim na descrição.
      round((
        (case when g.angle_id     is not null then 0.5 else 0 end) +
        (case when g.mechanism_id is not null then 0.3 else 0 end) +
        (case when g.proof_id     is not null then 0.2 else 0 end)
      )::numeric, 4),
      'unreviewed',
      g.ads
    from agrupado g
    on conflict (brand_id, signature) where signature is not null
    do update set name = excluded.name, ad_count = excluded.ad_count, updated_at = now()
    returning id, signature
  )
  select count(*) into v_criados from inserido;

  -- ── 5. Liga os anúncios, com o motivo escrito ───────────────────────────
  insert into public.ci_concept_members (
    concept_id, ad_id, brand_id, user_id, match_method, match_score, match_reasons
  )
  select
    c.id, s.ad_id, p_brand_id, v_owner, 'rules', c.confidence,
    -- match_reasons é o que permite a alguém discordar do agrupamento com
    -- argumento, em vez de só achar que está errado.
    to_jsonb(array_remove(array[
      case when s.angle_id     is not null then 'mesmo ângulo: '    || s.angle_label     end,
      case when s.mechanism_id is not null then 'mesmo mecanismo: ' || s.mechanism_label end,
      case when s.proof_id     is not null then 'mesma prova: '     || s.proof_label     end
    ], null))
  from _assinaturas s
  join public.ci_concepts c
    on c.brand_id = p_brand_id and c.signature = s.signature
  on conflict (concept_id, ad_id) do nothing;

  get diagnostics v_membros = row_count;

  -- ── 6. Agregados ────────────────────────────────────────────────────────
  update public.ci_concepts c set
    ad_count = m.ads,
    unique_asset_count = m.assets,
    first_seen_at = m.primeiro,
    last_seen_at  = m.ultimo,
    longevity_days = greatest(0, coalesce(m.dias, 0)),
    is_active = m.algum_ativo,
    baseline_ad_id = m.mais_antigo,
    updated_at = now()
  from (
    select
      cm.concept_id,
      count(distinct cm.ad_id)                                  as ads,
      count(distinct aa.asset_id)                               as assets,
      min(a.started_on)                                         as primeiro,
      max(a.last_seen_at)                                       as ultimo,
      max(a.running_days)                                       as dias,
      bool_or(a.is_active)                                      as algum_ativo,
      (array_agg(a.id order by a.started_on nulls last))[1]     as mais_antigo
    from public.ci_concept_members cm
    join public.ci_ads a on a.id = cm.ad_id
    left join public.ci_ad_assets aa on aa.ad_id = a.id
    where cm.brand_id = p_brand_id
    group by cm.concept_id
  ) m
  where c.id = m.concept_id;

  -- O anúncio mais antigo é a linha de base contra a qual as variantes são
  -- comparadas. Marcar aqui evita a UI ter que redescobrir isso toda vez.
  update public.ci_concept_members cm set is_baseline = true
  from public.ci_concepts c
  where c.id = cm.concept_id
    and c.brand_id = p_brand_id
    and c.baseline_ad_id = cm.ad_id;

  return query select v_criados, v_membros, v_orfaos;
end;
$$;

comment on function public.ci_rebuild_concepts(uuid) is
  'Agrupa os anúncios da marca em receitas criativas por assinatura '
  '(ângulo + mecanismo + prova). Hook fica fora de propósito: é execução, não '
  'ideia. Preserva conceitos revisados por humano.';

revoke all on function public.ci_rebuild_concepts(uuid) from public;
grant execute on function public.ci_rebuild_concepts(uuid) to authenticated;


-- ── Conferência ────────────────────────────────────────────────────────────
select proname, pg_get_function_identity_arguments(oid) as args
  from pg_proc where proname = 'ci_rebuild_concepts';
