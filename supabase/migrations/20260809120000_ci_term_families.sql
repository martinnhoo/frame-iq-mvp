-- ═══════════════════════════════════════════════════════════════════════════
-- B6 · Ângulo e mecanismo passam a ter FAMÍLIA de lista fechada
--
-- ── O que estava acontecendo em produção ──────────────────────────────────
-- 20 anúncios reais da Shapermint → 20 receitas, cada uma com 1 anúncio e
-- 0 variações. A tela de receitas não agrupava nada; listava anúncios com
-- outro nome. Os rótulos que o modelo produziu:
--
--     stays in place                stays in place + no wires
--     stays in place + thick band   stays in place + wireless design
--     comfortable fit + no wires    wire-free comfort + wire-free construction
--     comfort
--
-- Uma ideia, sete chaves. ci_canonical_label tira acento e stopword — ele não
-- tem como saber que "no wires" e "wireless design" são a mesma coisa. Isso é
-- julgamento semântico, e nenhuma quantidade de normalização de string chega lá.
--
-- ── Onde a correção mora ──────────────────────────────────────────────────
-- No worker: `family` virou enum no response_schema (v7). O que precisa ser
-- garantido se garante no contrato, não numa regra de prompt — a regra 9 já
-- pedia reuso de rótulo em letras maiúsculas e não adiantou.
--
-- Aqui no banco fica a outra metade: a lista de famílias como DADO, e a
-- assinatura da receita passando a exigir que o termo seja uma delas.
--
-- ── Por que isto dispensa apagar os termos antigos ────────────────────────
-- A persistência do worker só faz upsert; ela nunca apagou vínculo. Uma
-- reanálise deixaria o ângulo velho de texto livre AO LADO do novo, e o
-- ci_rebuild_concepts poderia escolher o velho pela confiança — a fragmentação
-- sobreviveria à reanálise paga, e eu ia jurar que a correção não funcionou.
--
-- Com a lista como tabela, termo que não é família simplesmente não forma
-- assinatura. Nada é apagado, nada precisa de DELETE novo no worker, e o
-- comportamento é auto-corretivo: só entra em receita o que foi analisado sob
-- o contrato atual.
--
-- O preço é honesto e visível: anúncio ainda não reanalisado em v7 vira órfão
-- e NÃO entra em receita nenhuma. Ele conta em `orfaos`, que a tela já mostra.
-- Preferir isso a mantê-lo numa receita construída sobre rótulo que o contrato
-- atual não reconhece mais.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Os dois kinds novos ─────────────────────────────────────────────────
--
-- `angle_detail` guarda a redação específica ("stays in place") que antes
-- disputava com a família o papel de chave. Ele não agrupa: vira eixo de
-- variação, exatamente como já fiz com a prova. A especificidade não se perde,
-- só sai do lugar errado.
alter table public.ci_taxonomy_terms drop constraint if exists ci_taxonomy_terms_kind_check;
alter table public.ci_taxonomy_terms add constraint ci_taxonomy_terms_kind_check
  check (kind in (
    'product','product_type','hook','hook_visual','hook_written',
    'angle','promise','proof','demonstration','objection','offer','cta',
    'story_structure','emotional_tone','visual_style','editing_rhythm',
    'scenario','mechanism',
    'angle_detail','mechanism_detail'
  ));


-- ── 2. As famílias, como dado ──────────────────────────────────────────────
--
-- Tabela e não CHECK, nem lista repetida em SQL: a mesma lista vive no
-- response_schema do worker, e ter as duas em lugares que ninguém compara é
-- como as onze cópias de paleta que acabei de juntar. Aqui ela é consultável —
-- a tela pode listar, o teste pode conferir, e discordância entre worker e
-- banco vira uma linha órfã visível em vez de um agrupamento silenciosamente
-- errado.
create table if not exists public.ci_term_family (
  kind      text not null check (kind in ('angle','mechanism')),
  slug      text not null,
  label     text not null,
  ordem     int  not null default 100,
  primary key (kind, slug)
);

comment on table public.ci_term_family is
  'Lista fechada de famílias de ângulo e mecanismo. Espelha FAMILIAS_ANGULO e '
  'FAMILIAS_MECANISMO em ci-worker/worker/semantic.py. Só termo cujo slug está '
  'aqui pode formar assinatura de receita.';

-- Famílias GENÉRICAS de propósito. A marca seguinte pode ser de suplemento ou
-- de eletrônico; uma lista com "sem aro" e "modelagem" só serviria para
-- shapewear e a próxima importação cairia inteira em não-identificado. Estas
-- são razões de compra, que atravessam categoria.
insert into public.ci_term_family (kind, slug, label, ordem) values
  ('angle','comfort',          'conforto',                   10),
  ('angle','fit',              'caimento e ajuste',          20),
  ('angle','support',          'suporte e sustentação',      30),
  ('angle','appearance',       'aparência e silhueta',       40),
  ('angle','confidence',       'confiança e autoestima',     50),
  ('angle','convenience',      'praticidade',                60),
  ('angle','time_saving',      'economia de tempo',          70),
  ('angle','durability',       'durabilidade e qualidade',   80),
  ('angle','performance',      'desempenho e eficácia',      90),
  ('angle','price_value',      'preço e custo-benefício',   100),
  ('angle','offer_urgency',    'oferta e urgência',         110),
  ('angle','health_wellbeing', 'saúde e bem-estar',         120),
  ('angle','safety',           'segurança',                 130),
  ('angle','versatility',      'versatilidade',             140),
  ('angle','social_proof',     'aprovação e pertencimento', 150),
  ('angle','availability',     'onde comprar',              160),
  ('angle','sustainability',   'sustentabilidade',          170),
  ('mechanism','material',      'material e tecido',          10),
  ('mechanism','construction',  'construção e estrutura',     20),
  ('mechanism','shape_design',  'formato e modelagem',        30),
  ('mechanism','technology',    'tecnologia',                 40),
  ('mechanism','adjustability', 'regulagem',                  50),
  ('mechanism','coverage',      'cobertura',                  60),
  ('mechanism','ingredient',    'ingrediente ou fórmula',     70),
  ('mechanism','process',       'modo de uso',                80),
  ('mechanism','service',       'serviço, garantia ou entrega', 90)
on conflict (kind, slug) do update set label = excluded.label, ordem = excluded.ordem;

-- 'unknown' NÃO entra na tabela, e isso é deliberado. Ele existe no enum do
-- worker para o modelo poder dizer "não sei" sem chutar, mas "não sei" não
-- pode virar chave de receita: agruparia por ignorância compartilhada. O
-- worker já descarta o item; a tabela é a segunda tranca.

alter table public.ci_term_family enable row level security;
-- Vocabulário do produto, igual para todo mundo: leitura liberada para quem
-- está autenticado, escrita só por migration.
drop policy if exists ci_term_family_read on public.ci_term_family;
create policy ci_term_family_read on public.ci_term_family
  for select to authenticated using (true);


-- ── 3. ci_rebuild_concepts v3 ──────────────────────────────────────────────
--
-- Muda só o passo 1: ângulo e mecanismo agora vêm da família, casada por SLUG
-- contra ci_term_family. Slug e não ci_canonical_label(label) porque o slug JÁ
-- é a chave fechada — passar um vocabulário controlado por um normalizador de
-- texto livre é acrescentar uma etapa que só pode errar.
-- Os nomes dos parâmetros OUT são os MESMOS da v2, de propósito. Trocá-los por
-- algo mais curto muda o tipo de linha da função, e `create or replace` morre
-- com "cannot change return type" no meio da migration — foi o que o teste
-- pegou aqui, e é a terceira vez que esta mesma armadilha aparece hoje.
-- Além disso a UI lê `anuncios_sem_sinal` pelo nome em CreativeOverview.
create or replace function public.ci_rebuild_concepts(p_brand_id uuid)
returns table (conceitos_criados int, anuncios_agrupados int, anuncios_sem_sinal int)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner   uuid;
  v_caller  uuid := auth.uid();
  v_criados int := 0;
  v_membros int := 0;
  v_orfaos  int := 0;
begin
  select user_id into v_owner from public.ci_brands where id = p_brand_id;
  if v_owner is null then
    raise exception 'ci_rebuild_concepts: marca % não existe', p_brand_id
      using errcode = 'no_data_found';
  end if;
  if v_caller is not null and v_caller <> v_owner then
    raise exception 'ci_rebuild_concepts: a marca % não pertence a quem chamou', p_brand_id
      using errcode = 'insufficient_privilege';
  end if;

  -- ── 1. Eixo dominante ───────────────────────────────────────────────────
  create temp table _eixos on commit drop as
  with ranqueado as (
    select
      at.ad_id,
      t.kind,
      -- Ângulo e mecanismo: a chave é o slug da família, e o rótulo exibido
      -- vem da tabela — não do que o modelo escreveu. Assim a tela mostra
      -- "caimento e ajuste" e não sete grafias da mesma família.
      case when t.kind in ('angle','mechanism') then t.slug
           else public.ci_canonical_label(t.label) end as chave,
      case when t.kind in ('angle','mechanism') then coalesce(f.label, t.label)
           else t.label end as label,
      row_number() over (
        partition by at.ad_id, t.kind
        order by at.confidence desc nulls last, t.ad_count desc, t.slug
      ) as pos
    from public.ci_ad_taxonomy at
    join public.ci_taxonomy_terms t on t.id = at.term_id
    join public.ci_ads ad           on ad.id = at.ad_id
    left join public.ci_term_family f on f.kind = t.kind and f.slug = t.slug
    where at.brand_id = p_brand_id
      and not ad.is_demo
      and t.kind in ('angle','mechanism','product_type')
      and coalesce(at.evidence, '') <> ''
      -- A tranca: ângulo/mecanismo que não é família não entra. É o que faz
      -- rótulo de texto livre de análise antiga parar de formar receita sem
      -- precisar apagar nada.
      and (t.kind = 'product_type' or f.slug is not null)
  )
  select
    ad_id,
    max(chave) filter (where kind = 'angle'        and pos = 1) as angle_chave,
    max(label) filter (where kind = 'angle'        and pos = 1) as angle_label,
    max(chave) filter (where kind = 'mechanism'    and pos = 1) as mech_chave,
    max(label) filter (where kind = 'mechanism'    and pos = 1) as mech_label,
    max(chave) filter (where kind = 'product_type' and pos = 1) as prod_chave
  from ranqueado
  group by ad_id;

  -- ── 2. Assinatura: ÂNGULO + MECANISMO ───────────────────────────────────
  create temp table _assinaturas on commit drop as
  select
    e.*,
    coalesce(e.angle_chave, '~') || '|' || coalesce(e.mech_chave, '~') as signature
  from _eixos e
  where e.angle_chave is not null or e.mech_chave is not null;

  -- Órfão agora quer dizer uma coisa precisa: anúncio sem ângulo nem mecanismo
  -- reconhecidos pelo contrato ATUAL. Logo depois desta migration isso inclui
  -- todo mundo que ainda está em local/v1 ou semantic/v6 — e é assim que tem
  -- que aparecer, em vez de fingir receita sobre rótulo obsoleto.
  select count(*) into v_orfaos
  from public.ci_ads a
  where a.brand_id = p_brand_id
    and not a.is_demo
    and a.id not in (select ad_id from _assinaturas);

  delete from public.ci_concepts c
  where c.brand_id = p_brand_id
    and c.review_status = 'unreviewed'
    and c.grouping_method = 'rules';

  -- ── 3. Cria as receitas ─────────────────────────────────────────────────
  with agrupado as (
    select
      s.signature,
      (select ss.angle_label from _assinaturas ss
        where ss.signature = s.signature and ss.angle_label is not null
        group by ss.angle_label order by count(*) desc, ss.angle_label limit 1) as angle_label,
      (select ss.mech_label from _assinaturas ss
        where ss.signature = s.signature and ss.mech_label is not null
        group by ss.mech_label order by count(*) desc, ss.mech_label limit 1) as mech_label,
      count(*) as ads
    from _assinaturas s
    group by s.signature
  ),
  nomeado as (
    select g.*,
           coalesce(nullif(concat_ws(' + ', g.angle_label, g.mech_label), ''),
                    'Receita sem rótulo') as nome
    from agrupado g
  ),
  inserido as (
    insert into public.ci_concepts (
      brand_id, user_id, name, description, signature,
      grouping_method, confidence, review_status, ad_count
    )
    select
      p_brand_id, v_owner, n.nome,
      'Agrupado por família de ângulo + mecanismo. A redação específica, o hook '
      'e a prova são eixos de variação, não parte da assinatura. '
      || n.ads || ' anúncio(s).',
      n.signature, 'rules',
      round(((case when n.angle_label is not null then 0.7 else 0 end) +
             (case when n.mech_label  is not null then 0.3 else 0 end))::numeric, 4),
      'unreviewed', n.ads
    from nomeado n
    on conflict (brand_id, signature) where signature is not null
    do update set name = excluded.name, ad_count = excluded.ad_count,
                  description = excluded.description, updated_at = now()
    returning id
  )
  select count(*) into v_criados from inserido;

  -- ── 4. Liga os anúncios ─────────────────────────────────────────────────
  insert into public.ci_concept_members (
    concept_id, ad_id, brand_id, user_id, match_method, match_score, match_reasons
  )
  select
    c.id, s.ad_id, p_brand_id, v_owner, 'rules', c.confidence,
    to_jsonb(array_remove(array[
      case when s.angle_label is not null then 'mesma família de ângulo: '    || s.angle_label end,
      case when s.mech_label  is not null then 'mesma família de mecanismo: ' || s.mech_label  end
    ], null))
  from _assinaturas s
  join public.ci_concepts c
    on c.brand_id = p_brand_id and c.signature = s.signature
  on conflict (concept_id, ad_id) do nothing;

  get diagnostics v_membros = row_count;

  -- ── 5. Agregados ────────────────────────────────────────────────────────
  update public.ci_concepts c set
    ad_count = m.ads, unique_asset_count = m.assets,
    first_seen_at = m.primeiro, last_seen_at = m.ultimo,
    longevity_days = greatest(0, coalesce(m.dias, 0)),
    is_active = coalesce(m.algum_ativo, false),
    baseline_ad_id = m.mais_antigo, updated_at = now()
  from (
    select cm.concept_id,
           count(distinct cm.ad_id)                              as ads,
           count(distinct aa.asset_id)                           as assets,
           min(a.started_on)                                     as primeiro,
           max(a.last_seen_at)                                   as ultimo,
           max(a.running_days)                                   as dias,
           bool_or(a.is_active)                                  as algum_ativo,
           (array_agg(a.id order by a.started_on nulls last))[1] as mais_antigo
      from public.ci_concept_members cm
      join public.ci_ads a on a.id = cm.ad_id
      left join public.ci_ad_assets aa on aa.ad_id = a.id
     where cm.brand_id = p_brand_id
     group by cm.concept_id
  ) m
  where c.id = m.concept_id;

  update public.ci_concept_members cm set is_baseline = true
  from public.ci_concepts c
  where c.id = cm.concept_id and c.brand_id = p_brand_id
    and c.baseline_ad_id = cm.ad_id;

  return query select v_criados, v_membros, v_orfaos;
end;
$$;

revoke all on function public.ci_rebuild_concepts(uuid) from public;
grant execute on function public.ci_rebuild_concepts(uuid) to authenticated;
grant select on public.ci_term_family to authenticated;
