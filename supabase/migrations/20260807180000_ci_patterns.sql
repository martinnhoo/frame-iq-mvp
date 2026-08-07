-- ═══════════════════════════════════════════════════════════════════════════
-- T2 e T3 · Padrões de hook e playbook de produto
--
-- ── A diferença que estas duas funções carregam ───────────────────────────
-- Uma lista de hooks é inventário:
--
--     Hook A — 32
--     Hook B — 19
--
-- Um padrão de hook é material de roteiro:
--
--     "Se você sofre com [problema]…"
--     38 assets · 11 receitas · tipo: problem callout
--     Estrutura em que aparece: Problem → Demo → Proof → CTA
--     Exemplos reais com timestamp e a fala que sustenta
--
-- A primeira você olha e fecha. A segunda vira briefing no mesmo dia. Toda a
-- complexidade abaixo existe para produzir a segunda.
--
-- ── O agrupamento é canônico ──────────────────────────────────────────────
-- Mesma decisão das receitas e da variação: agrupar por texto bruto
-- fragmentaria "Stays in place" e "stays in place" em dois padrões, e um padrão
-- de 38 assets apareceria como dois de 19. Aqui isso é ainda mais grave, porque
-- o número de assets é exatamente o que faz alguém decidir usar o padrão.
--
-- ── Sem evidência não entra ───────────────────────────────────────────────
-- A mesma regra do resto do sistema. Um padrão sem a fala que o sustenta não
-- serve para escrever roteiro — serve para acreditar em coisa nenhuma.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── ci_hook_patterns ───────────────────────────────────────────────────────
create or replace function public.ci_hook_patterns(
  p_brand_id uuid,
  p_limite   int default 40
)
returns table (
  chave           text,
  label           text,
  tipo            text,     -- hook | hook_visual | hook_written
  assets          int,
  receitas        int,
  estrutura       text,     -- a sequência de funções de cena mais comum
  primeiro_frame  text,     -- o enquadramento/cenário mais combinado
  duracao_media_s int,
  exemplos        jsonb     -- [{ad_id, evidence, timestamp_s, arquivo}]
)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select
      public.ci_canonical_label(t.label) as chave,
      t.label,
      t.kind as tipo,
      at.ad_id,
      at.evidence,
      at.timestamp_s
    from public.ci_ad_taxonomy at
    join public.ci_taxonomy_terms t on t.id = at.term_id
    join public.ci_ads a            on a.id = at.ad_id
    where at.brand_id = p_brand_id
      and not a.is_demo
      and t.kind in ('hook', 'hook_visual', 'hook_written')
      and coalesce(at.evidence, '') <> ''
      and public.ci_canonical_label(t.label) is not null
  ),

  -- A estrutura de roteiro em que o hook aparece. Cenas seguidas com a mesma
  -- função contam uma vez: senão o mesmo roteiro cortado em mais pedaços
  -- viraria uma estrutura diferente, e o padrão se dissolveria.
  estrutura_por_ad as (
    select
      aa.ad_id,
      string_agg(s.scene_function, ' → ' order by s.scene_index) as seq
    from (
      select
        sc.asset_id, sc.scene_index, sc.scene_function,
        lag(sc.scene_function) over (partition by sc.asset_id order by sc.scene_index) as anterior
      from public.ci_scenes sc
      where sc.brand_id = p_brand_id and sc.scene_function is not null
    ) s
    join public.ci_ad_assets aa on aa.asset_id = s.asset_id
    where s.anterior is distinct from s.scene_function
    group by aa.ad_id
  ),

  primeiro_frame_por_ad as (
    select distinct on (aa.ad_id)
      aa.ad_id,
      nullif(concat_ws(', ', sc.framing, sc.setting_kind), '') as frame
    from public.ci_scenes sc
    join public.ci_ad_assets aa on aa.asset_id = sc.asset_id
    where sc.brand_id = p_brand_id
    order by aa.ad_id, sc.scene_index
  ),

  duracao_por_ad as (
    select aa.ad_id, max(ass.duration_seconds) as dur
    from public.ci_ad_assets aa
    join public.ci_assets ass on ass.id = aa.asset_id
    group by aa.ad_id
  ),

  agrupado as (
    select
      b.chave,
      (array_agg(b.tipo order by b.tipo))[1]                         as tipo,
      count(distinct b.ad_id)::int                                   as assets,
      count(distinct cm.concept_id)::int                             as receitas,
      (array_agg(e.seq order by e.seq) filter (where e.seq is not null))[1]     as estrutura,
      (array_agg(pf.frame order by pf.frame) filter (where pf.frame is not null))[1] as primeiro_frame,
      round(avg(d.dur))::int                                         as duracao_media_s,
      jsonb_agg(distinct jsonb_build_object(
        'ad_id', b.ad_id,
        'evidence', left(b.evidence, 220),
        'timestamp_s', b.timestamp_s
      ))                                                             as exemplos
    from base b
    left join public.ci_concept_members cm on cm.ad_id = b.ad_id
    left join estrutura_por_ad e           on e.ad_id  = b.ad_id
    left join primeiro_frame_por_ad pf     on pf.ad_id = b.ad_id
    left join duracao_por_ad d             on d.ad_id  = b.ad_id
    group by b.chave
  ),

  -- A grafia exibida sai daqui, contada de verdade.
  --
  -- No empate, a minúscula ganha: a regra 9 do prompt manda o modelo emitir
  -- label em minúsculas, e desempatar por alfabeto faria "If You Struggle"
  -- vencer "if you struggle" só porque maiúscula vem antes no ASCII —
  -- exibindo justamente a grafia que a convenção do produto não quer.
  grafia as (
    select chave, label, count(*) as n
    from base group by chave, label
  )

  select
    g.chave,
    (array_agg(gr.label order by gr.n desc,
                                 (gr.label = lower(gr.label)) desc,
                                 gr.label))[1] as label,
    g.tipo,
    g.assets,
    g.receitas,
    g.estrutura,
    g.primeiro_frame,
    g.duracao_media_s,
    g.exemplos
  from agrupado g
  join grafia gr on gr.chave = g.chave
  group by g.chave, g.tipo, g.assets, g.receitas, g.estrutura,
           g.primeiro_frame, g.duracao_media_s, g.exemplos
  -- Padrão que se repete mais vem primeiro: é o que a marca mais aposta.
  order by g.assets desc, g.receitas desc, 2
  limit greatest(1, p_limite);
$$;

revoke all on function public.ci_hook_patterns(uuid, int) from public;
grant execute on function public.ci_hook_patterns(uuid, int) to authenticated;

comment on function public.ci_hook_patterns(uuid, int) is
  'Padrões de hook, não lista de hooks: cada linha traz assets, receitas, a '
  'estrutura em que aparece e exemplos com evidência.';


-- ── ci_product_playbook ────────────────────────────────────────────────────
--
-- O que a marca faz quando está vendendo ESTE produto. A pergunta é a mesma
-- das receitas, restrita a um produto — e a resposta é o que alguém precisa
-- para escrever um roteiro novo do mesmo produto.
create or replace function public.ci_product_playbook(p_brand_id uuid)
returns table (
  chave           text,
  produto         text,
  assets          int,
  receitas        int,
  duracao_media_s int,
  ativos          int,
  angulos         jsonb,   -- [{label, ads}]
  hooks           jsonb,
  problemas       jsonb,
  promessas       jsonb,
  provas          jsonb,
  ofertas         jsonb,
  ctas            jsonb,
  formatos        jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with produtos as (
    select
      public.ci_canonical_label(t.label) as chave,
      t.label,
      at.ad_id
    from public.ci_ad_taxonomy at
    join public.ci_taxonomy_terms t on t.id = at.term_id
    join public.ci_ads a            on a.id = at.ad_id
    where at.brand_id = p_brand_id
      and not a.is_demo
      and t.kind in ('product', 'product_type')
      and coalesce(at.evidence, '') <> ''
      and public.ci_canonical_label(t.label) is not null
  ),

  -- Um anúncio pode citar o mesmo produto duas vezes (product e product_type).
  -- Sem o distinct, ele contaria duas vezes e o playbook exageraria o alcance
  -- do produto — número inflado é pior que número ausente, porque parece certo.
  ads_por_produto as (
    select distinct chave, ad_id from produtos
  ),

  -- Os termos de cada tipo, dentro dos anúncios daquele produto.
  termos as (
    select
      ap.chave,
      t.kind,
      public.ci_canonical_label(t.label) as termo_chave,
      t.label,
      at.ad_id
    from ads_por_produto ap
    join public.ci_ad_taxonomy at   on at.ad_id = ap.ad_id
    join public.ci_taxonomy_terms t on t.id = at.term_id
    where coalesce(at.evidence, '') <> ''
      and public.ci_canonical_label(t.label) is not null
  ),

  contado as (
    select chave, kind, termo_chave,
           (array_agg(label order by (label = lower(label)) desc, label))[1] as label,
           count(distinct ad_id)::int          as ads
    from termos
    group by chave, kind, termo_chave
  ),

  por_tipo as (
    select chave, kind,
           jsonb_agg(jsonb_build_object('label', label, 'ads', ads)
                     order by ads desc, label) as lista
    from contado
    group by chave, kind
  ),

  numeros as (
    select
      ap.chave,
      count(distinct ap.ad_id)::int          as assets,
      count(distinct cm.concept_id)::int     as receitas,
      round(avg(ass.duration_seconds))::int  as duracao_media_s,
      count(distinct a.id) filter (where a.is_active)::int as ativos
    from ads_por_produto ap
    join public.ci_ads a                   on a.id = ap.ad_id
    left join public.ci_concept_members cm on cm.ad_id = ap.ad_id
    left join public.ci_ad_assets aa       on aa.ad_id = ap.ad_id
    left join public.ci_assets ass         on ass.id = aa.asset_id
    group by ap.chave
  ),

  nome as (
    select chave, (array_agg(label order by n desc,
                                      (label = lower(label)) desc,
                                      label))[1] as produto
    from (select chave, label, count(*) as n from produtos group by chave, label) x
    group by chave
  )

  select
    n.chave,
    nm.produto,
    n.assets,
    n.receitas,
    n.duracao_media_s,
    n.ativos,
    coalesce((select lista from por_tipo p where p.chave = n.chave and p.kind = 'angle'), '[]'::jsonb),
    coalesce((select lista from por_tipo p where p.chave = n.chave and p.kind = 'hook'), '[]'::jsonb),
    coalesce((select lista from por_tipo p where p.chave = n.chave and p.kind = 'objection'), '[]'::jsonb),
    coalesce((select lista from por_tipo p where p.chave = n.chave and p.kind = 'promise'), '[]'::jsonb),
    coalesce((select lista from por_tipo p where p.chave = n.chave and p.kind = 'proof'), '[]'::jsonb),
    coalesce((select lista from por_tipo p where p.chave = n.chave and p.kind = 'offer'), '[]'::jsonb),
    coalesce((select lista from por_tipo p where p.chave = n.chave and p.kind = 'cta'), '[]'::jsonb),
    coalesce((select lista from por_tipo p where p.chave = n.chave and p.kind = 'visual_style'), '[]'::jsonb)
  from numeros n
  join nome nm on nm.chave = n.chave
  order by n.assets desc, nm.produto;
$$;

revoke all on function public.ci_product_playbook(uuid) from public;
grant execute on function public.ci_product_playbook(uuid) to authenticated;

comment on function public.ci_product_playbook(uuid) is
  'O playbook criativo de cada produto: o que a marca faz quando está vendendo '
  'aquilo. Contagens por anúncio distinto, para não inflar alcance.';
