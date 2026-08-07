-- ═══════════════════════════════════════════════════════════════════════════
-- Agrupamento v2 — a assinatura estava fragmentando
--
-- ── O que a primeira rodada real mostrou ──────────────────────────────────
-- 22 anúncios da Shapermint viraram 19 receitas. Dezesseis com um anúncio só.
-- Isso é o mesmo que não agrupar.
--
-- Os nomes denunciaram a causa:
--
--   "Permanece no lugar + Demonstração de que permanece no lugar"   2 ads
--   "Permanece no lugar + Prova social por número de usuárias"      1
--   "Permanece no lugar + Completamente sem costura"                1
--   "Permanece no lugar + Demonstração de estabilidade"             1
--
-- O MESMO ângulo, quatro receitas. Um estrategista chamaria isso de UMA receita
-- testada com quatro provas — que é exatamente a informação que a coluna
-- TESTARAM deveria mostrar, e que a assinatura estava destruindo.
--
-- ── Correção 1: prova sai da assinatura ───────────────────────────────────
-- Eu usei o argumento certo para deixar hook de fora ("hook é execução, não
-- ideia") e não o apliquei a prova. Prova é execução da mesma forma: a marca
-- escolhe demonstrar, ou citar número de usuárias, ou mostrar antes/depois —
-- defendendo a mesma ideia. A assinatura passa a ser ÂNGULO + MECANISMO, e
-- prova vira eixo de variação junto com hook.
--
-- ── Correção 2: rótulos equivalentes ──────────────────────────────────────
-- "Conforto superior", "conforto e suporte", "Conforto sem arame",
-- "Conforto e suporte sem aro" — quatro strings, um ângulo. O slug normaliza
-- acento, não sinônimo.
--
-- A canonização aqui é deliberadamente CONSERVADORA: remove palavras vazias e
-- ordena o resto. "wire free comfort" e "comfort wire-free" colidem; "comfort"
-- e "support" continuam separados. Agrupar por similaridade solta juntaria
-- coisas que não são a mesma, e o erro de juntar demais é pior que o de
-- separar demais — separado o usuário enxerga e reclama, junto ele acredita.
--
-- O prompt também passou a exigir label em inglês e canônico, o que ataca a
-- causa na origem. Esta função é a rede de segurança para o que já está no
-- banco e para o que o modelo escapar.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── ci_canonical_label ─────────────────────────────────────────────────────
create or replace function public.ci_canonical_label(p_label text)
returns text
language sql
immutable
as $$
  -- Sem CTE encadeada: o alias de uma CTE não é visível na projeção final, e
  -- a primeira versão referenciava `ws` fora do escopo. Uma subconsulta única
  -- resolve e fica mais fácil de ler.
  -- O nullif externo é o que impede rótulo vazio de virar chave: string vazia
  -- é uma chave válida para o Postgres, então "   " e "!!!" agrupariam entre si
  -- e com qualquer outro rótulo degenerado. NULL a assinatura já sabe tratar.
  select nullif(coalesce(
    nullif(
      (select string_agg(w, '-' order by w)
         from unnest(
           regexp_split_to_array(
             trim(regexp_replace(
               lower(translate(p_label,
                 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
                 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')),
               '[^a-z0-9]+', ' ', 'g')),
             ' ')) as w
        where w <> ''
          -- Lista curta de propósito: cada palavra removida a mais é um risco
          -- de fundir ideias diferentes.
          and w not in (
            'de','da','do','das','dos','e','ou','a','o','as','os','um','uma',
            'em','para','por','com','sem','no','na','nos','nas','que','ao','aos',
            'the','an','of','and','or','for','with','to','in','on','at','by',
            'total','superior','maximo','maxima','extra','muito','mais','melhor',
            'perfeito','otimo','great','best','better','very','ultimate',
            'premium','amazing','incredible')),
      ''),
    lower(trim(p_label))), '');
$$;

comment on function public.ci_canonical_label(text) is
  'Normaliza rótulo para agrupamento: sem acento, sem palavra vazia, ordenado. '
  'Conservadora de propósito — juntar demais é pior que separar demais, porque '
  'o usuário vê a separação e não vê a fusão indevida.';


-- ── ci_rebuild_concepts v2 ─────────────────────────────────────────────────
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
  select user_id into v_owner from public.ci_brands where id = p_brand_id;
  if v_owner is null then
    raise exception 'ci_rebuild_concepts: marca % não existe', p_brand_id
      using errcode = 'no_data_found';
  end if;
  if v_caller is not null and v_caller <> v_owner then
    raise exception 'ci_rebuild_concepts: a marca % não pertence a quem chamou', p_brand_id
      using errcode = 'insufficient_privilege';
  end if;

  -- ── 1. Eixo dominante, agora agrupado por rótulo CANÔNICO ───────────────
  create temp table _eixos on commit drop as
  with ranqueado as (
    select
      at.ad_id,
      t.kind,
      public.ci_canonical_label(t.label) as chave,
      t.label,
      row_number() over (
        partition by at.ad_id, t.kind
        order by at.confidence desc nulls last, t.ad_count desc, t.slug
      ) as pos
    from public.ci_ad_taxonomy at
    join public.ci_taxonomy_terms t on t.id = at.term_id
    join public.ci_ads ad           on ad.id = at.ad_id
    where at.brand_id = p_brand_id
      and not ad.is_demo
      and t.kind in ('angle','mechanism','product_type')
      and coalesce(at.evidence, '') <> ''
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

  -- ── 2. Assinatura: ÂNGULO + MECANISMO. Prova ficou de fora. ─────────────
  create temp table _assinaturas on commit drop as
  select
    e.*,
    coalesce(e.angle_chave, '~') || '|' || coalesce(e.mech_chave, '~') as signature
  from _eixos e
  where e.angle_chave is not null or e.mech_chave is not null;

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
      -- O rótulo exibido é o MAIS FREQUENTE do grupo, não um qualquer: se
      -- cinco anúncios dizem "stays in place" e um diz "no slipping", o nome
      -- da receita deve ser o que a marca mais usa.
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
      'Agrupado por ângulo + mecanismo. Prova e hook são eixos de variação, '
      'não parte da assinatura. ' || n.ads || ' anúncio(s).',
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
      case when s.angle_label is not null then 'mesmo ângulo: '    || s.angle_label end,
      case when s.mech_label  is not null then 'mesmo mecanismo: ' || s.mech_label  end
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
grant execute on function public.ci_canonical_label(text) to authenticated;


-- ── Conferência ────────────────────────────────────────────────────────────
select public.ci_canonical_label('Conforto superior sem aro')  as ex1,
       public.ci_canonical_label('conforto sem aro')           as ex2,
       public.ci_canonical_label('Wire-free comfort')          as ex3,
       public.ci_canonical_label('comfort wire free')          as ex4;
