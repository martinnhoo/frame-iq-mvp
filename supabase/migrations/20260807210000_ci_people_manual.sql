-- ═══════════════════════════════════════════════════════════════════════════
-- BE1 · Pessoas recorrentes — agrupadas por humano, não por reconhecimento
--
-- ── A decisão de desenho, e por que ela é melhor ──────────────────────────
-- O plano original era detectar rostos, gerar embeddings e agrupar por
-- similaridade. Isso teria três problemas de uma vez: arrasta o torch para
-- dentro de um container que já disputa RAM com o Whisper, erra em ângulo e
-- iluminação de anúncio, e é justamente a parte sensível — um pipeline de
-- reconhecimento facial rodando sobre criativos de terceiros.
--
-- O Martinho ofereceu classificar à mão. Isso muda tudo:
--
--   · o agrupamento fica CERTO, porque quem olha é um humano
--   · não existe embedding facial em lugar nenhum do sistema
--   · o identificador é anônimo POR CONSTRUÇÃO, não por política — não há nome
--     a vazar porque nunca houve nome
--
-- Trocamos automação incerta por rotulagem certa. Com 40 anúncios isso leva
-- minutos. Com 3.000 vai precisar de ajuda do modelo, e aí o caminho é pedir
-- ao Gemini uma DESCRIÇÃO observável e não-sensível do apresentador — nunca
-- identidade — para sugerir agrupamento que o humano confirma.
--
-- ── O que NÃO entra aqui, nunca ───────────────────────────────────────────
-- Nome, etnia, idade, gênero presumido, religião, orientação, condição de
-- saúde. O apelido é opcional e é do usuário ("a ruiva do sofá" é dele; o
-- sistema guarda PERSON_003). Nada disso vira coluna, nem termo, nem filtro.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── Aparições: a ligação pessoa ↔ anúncio ──────────────────────────────────
create table if not exists public.ci_person_appearances (
  id          uuid primary key default gen_random_uuid(),
  cluster_id  uuid not null references public.ci_person_clusters(id) on delete cascade,
  ad_id       uuid not null references public.ci_ads(id) on delete cascade,
  brand_id    uuid not null references public.ci_brands(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,

  -- 'humano' hoje. 'modelo' fica reservado para quando houver sugestão
  -- automática — e mesmo então a coluna existe para que a tela possa mostrar
  -- a diferença, em vez de apresentar palpite como fato.
  origem      text not null default 'humano' check (origem in ('humano', 'modelo')),
  confianca   numeric(5,4),

  created_at  timestamptz not null default now(),

  -- Uma pessoa aparece uma vez por anúncio. Ela pode aparecer em várias cenas,
  -- mas isso é contagem de cena, não de pessoa — e contar duas vezes faria um
  -- anúncio com muitos cortes parecer que tem mais gente.
  unique (cluster_id, ad_id)
);

create index if not exists idx_ci_person_app_cluster on public.ci_person_appearances(cluster_id);
create index if not exists idx_ci_person_app_ad      on public.ci_person_appearances(ad_id);
create index if not exists idx_ci_person_app_brand   on public.ci_person_appearances(brand_id);

alter table public.ci_person_appearances enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                  where tablename = 'ci_person_appearances'
                    and policyname = 'ci_person_app_own') then
    execute 'create policy ci_person_app_own on public.ci_person_appearances
               for all to authenticated
               using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;
end $$;


-- ── ci_person_next_label ───────────────────────────────────────────────────
-- PERSON_001, PERSON_002... por marca.
--
-- O número É reaproveitado: apagar o 002 faz o próximo voltar a ser 002. Eu
-- tinha escrito o contrário neste comentário, e o teste mostrou que o código
-- fazia outra coisa — o comentário estava errado, não o código.
--
-- E reaproveitar é o comportamento certo aqui. A rotulagem é manual: quem
-- classifica erra, apaga e refaz, e uma lista com PERSON_001, PERSON_003,
-- PERSON_007 faria alguém procurar os que faltam. O risco de um rótulo
-- reaproveitado confundir um export antigo existe, mas é pequeno diante de
-- uma lista cheia de buracos numa tela que a pessoa usa todo dia.
create or replace function public.ci_person_next_label(p_brand_id uuid)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select 'PERSON_' || lpad((
    coalesce(max(
      nullif(regexp_replace(label, '^PERSON_', ''), '')::int
    ), 0) + 1)::text, 3, '0')
  from public.ci_person_clusters
  where brand_id = p_brand_id
    and label ~ '^PERSON_[0-9]+$';
$$;

revoke all on function public.ci_person_next_label(uuid) from public;
grant execute on function public.ci_person_next_label(uuid) to authenticated;


-- ── ci_person_overview ─────────────────────────────────────────────────────
-- O que dá para dizer sobre uma pessoa recorrente SEM dizer quem ela é:
-- em quantos anúncios aparece, em quantas receitas, que formatos, que duração.
-- Tudo observável, nada inferido.
create or replace function public.ci_person_overview(p_brand_id uuid)
returns table (
  cluster_id      uuid,
  label           text,
  apelido         text,
  ads             int,
  assets_unicos   int,
  receitas        int,
  ativos          int,
  duracao_media_s int,
  primeiro_visto  timestamptz,
  ultimo_visto    timestamptz,
  share_pct       int,
  formatos        jsonb,
  exemplos        jsonb
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
  total as (
    select greatest(1, count(*))::int as n from reais
  ),
  base as (
    select ap.cluster_id, ap.ad_id
      from public.ci_person_appearances ap
      join reais r on r.ad_id = ap.ad_id
     where ap.brand_id = p_brand_id
  ),
  numeros as (
    select
      b.cluster_id,
      count(distinct b.ad_id)::int                            as ads,
      count(distinct aa.asset_id)::int                        as assets_unicos,
      count(distinct cm.concept_id)::int                      as receitas,
      count(distinct b.ad_id) filter (where a.is_active)::int as ativos,
      round(avg(ass.duration_seconds))::int                   as duracao_media_s,
      min(a.started_on)                                       as primeiro,
      max(a.last_seen_at)                                     as ultimo
    from base b
    join public.ci_ads a                   on a.id = b.ad_id
    left join public.ci_ad_assets aa       on aa.ad_id = b.ad_id
    left join public.ci_assets ass         on ass.id = aa.asset_id
    left join public.ci_concept_members cm on cm.ad_id = b.ad_id
    group by b.cluster_id
  ),
  formatos_por_pessoa as (
    select b.cluster_id,
           jsonb_agg(jsonb_build_object('label', x.label, 'ads', x.ads)
                     order by x.ads desc, x.label) as lista
    from base b
    join lateral (
      select t.label, count(distinct at2.ad_id)::int as ads
        from public.ci_ad_taxonomy at2
        join public.ci_taxonomy_terms t on t.id = at2.term_id
        join base b2 on b2.ad_id = at2.ad_id and b2.cluster_id = b.cluster_id
       where t.kind = 'visual_style' and coalesce(at2.evidence,'') <> ''
       group by t.label
    ) x on true
    group by b.cluster_id
  ),
  exemplos_por_pessoa as (
    select cluster_id,
           jsonb_agg(jsonb_build_object('ad_id', ad_id)) as lista
    from (
      select cluster_id, ad_id,
             row_number() over (partition by cluster_id order by ad_id) as pos
      from base
    ) y
    where pos <= 6
    group by cluster_id
  )
  select
    c.id, c.label, c.display_name,
    n.ads, n.assets_unicos, n.receitas, n.ativos, n.duracao_media_s,
    n.primeiro, n.ultimo,
    round(100.0 * n.ads / t.n)::int,
    coalesce(f.lista, '[]'::jsonb),
    coalesce(e.lista, '[]'::jsonb)
  from numeros n
  join public.ci_person_clusters c on c.id = n.cluster_id
  cross join total t
  left join formatos_por_pessoa f on f.cluster_id = n.cluster_id
  left join exemplos_por_pessoa e on e.cluster_id = n.cluster_id
  where c.brand_id = p_brand_id
  order by n.ads desc, c.label;
$$;

revoke all on function public.ci_person_overview(uuid) from public;
grant execute on function public.ci_person_overview(uuid) to authenticated;


-- ── A coluna Pessoas da home deixa de ser zero fixo ────────────────────────
--
-- Ela devolvia 0::int com um comentário dizendo que o agrupamento não existia.
-- Agora existe, e o número é real: quantas pessoas distintas foram observadas
-- nos anúncios daquela receita. Continua sendo 0 até alguém classificar — mas
-- aí é ausência de classificação, não ausência de recurso.
create or replace function public.ci_creative_priority(p_brand_id uuid)
returns table (
  concept_id      uuid,
  nome            text,
  ads             int,
  assets_unicos   int,
  variacoes       int,
  eixos_variados  int,
  eixos_mantidos  int,
  pessoas         int,
  ativos          int,
  dias_no_ar      int,
  duracao_min_s   int,
  duracao_max_s   int,
  hook_dominante  text,
  presenca        text,
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
  -- Pessoas distintas por receita. Contagem de CLUSTER, não de aparição: a
  -- mesma pessoa em cinco anúncios da receita é uma pessoa.
  pessoas_por_conceito as (
    select m.concept_id, count(distinct ap.cluster_id)::int as pessoas
      from membros m
      join public.ci_person_appearances ap on ap.ad_id = m.ad_id
     group by m.concept_id
  ),
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
           m.concept_id, t.label
      from membros m
      join public.ci_ad_taxonomy at   on at.ad_id = m.ad_id
      join public.ci_taxonomy_terms t on t.id = at.term_id
     where t.kind in ('hook', 'hook_written', 'hook_visual')
       and coalesce(at.evidence, '') <> ''
     group by m.concept_id, t.label
     order by m.concept_id, count(*) desc, t.label
  )
  select
    c.id, c.name, n.ads, n.assets_unicos,
    e.variacoes, e.eixos_variados, e.eixos_mantidos,
    coalesce(p.pessoas, 0),
    n.ativos, n.dias_no_ar, n.dur_min, n.dur_max, h.label,
    case
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
  join public.ci_concepts c            on c.id = n.concept_id
  join eixos e                         on e.concept_id = n.concept_id
  left join pessoas_por_conceito p     on p.concept_id = n.concept_id
  left join hook_da_receita h          on h.concept_id = n.concept_id
  cross join total_marca t
  where c.brand_id = p_brand_id
  order by n.assets_unicos desc, e.variacoes desc, c.name;
$$;

revoke all on function public.ci_creative_priority(uuid) from public;
grant execute on function public.ci_creative_priority(uuid) to authenticated;

comment on table public.ci_person_appearances is
  'Pessoa recorrente ↔ anúncio, atribuído por humano. Não existe embedding '
  'facial no sistema: o identificador é anônimo por construção, não por regra.';


-- ── 'pessoa' entra na lista de campos revisáveis ───────────────────────────
--
-- O agrupamento é manual, mas manual não quer dizer infalível: reconhecer a
-- mesma pessoa em dois anúncios de ângulos diferentes é exatamente o tipo de
-- julgamento em que se erra. Sem estar na lista de qualidade, o erro não teria
-- onde ser registrado — e a coluna Pessoas da home apareceria com a mesma
-- autoridade de um campo medido.
--
-- A lista é fechada de propósito (métrica com nome livre vira dez nomes para a
-- mesma coisa), então adicionar exige recriar a restrição.
alter table public.ci_quality_reviews
  drop constraint if exists ci_quality_reviews_campo_check;

alter table public.ci_quality_reviews
  add constraint ci_quality_reviews_campo_check check (campo in (
    'transcript','ocr','formato','produto','hook','angle',
    'proof','offer','cta','estrutura','receita','duracao','cena',
    'mecanismo','pessoa'
  ));
