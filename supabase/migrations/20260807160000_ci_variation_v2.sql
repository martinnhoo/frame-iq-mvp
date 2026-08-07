-- ═══════════════════════════════════════════════════════════════════════════
-- B4 · Eixos de variação, com rigor
--
-- ── A pergunta que isto responde ──────────────────────────────────────────
-- "Existem 37 anúncios parecidos" é inventário.
-- "A marca repete esta receita variando principalmente hook e pessoa" é
-- inteligência. A diferença inteira mora nesta função.
--
-- ── Três defeitos da v1, e por que cada um importa ────────────────────────
--
-- 1. AGRUPAVA POR TEXTO BRUTO.
--    O mesmo bug de fragmentação que quebrou as receitas, um nível abaixo:
--    "Comfort" e "conforto" contavam como dois valores, e o eixo aparecia como
--    variado quando a marca tinha mantido. Agora agrupa por ci_canonical_label.
--
-- 2. `mantido` EXIGIA UNANIMIDADE.
--    Um valor único presente em 100% dos anúncios. Na prática, nove anúncios
--    com o mesmo produto e um com outro é uma receita que MANTÉM o produto —
--    é assim que um estrategista lê. Exigir unanimidade fazia quase tudo cair
--    em "variou", que é o mesmo que não dizer nada.
--
-- 3. NÃO DISTINGUIA "A MARCA VARIOU" DE "O MODELO NÃO EXTRAIU".
--    Este é o pior. Se o Gemini só identificou mecanismo em 2 de 10 anúncios,
--    a v1 reportava mecanismo como eixo variado — quando a verdade é que não
--    sabemos. Apresentar ignorância como achado é o defeito mais caro que este
--    produto pode ter, porque vai direto para um briefing.
--
-- ── Os três papéis ────────────────────────────────────────────────────────
--   mantido      → a marca preservou. Define a receita.
--   variado      → a marca testou. É o que a coluna TESTARAM mostra.
--   nao_extraido → não temos base para afirmar nada. Aparece separado.
-- ═══════════════════════════════════════════════════════════════════════════


-- `create or replace` NÃO altera o tipo de retorno de uma função — o Postgres
-- responde "Row type defined by OUT parameters is different" e a migration
-- morre no meio. A v1 devolvia quatro colunas; esta devolve nove. Sem este
-- drop, o SQL falharia em produção do mesmo jeito que falhou no teste.
drop function if exists public.ci_concept_variation(uuid);

create function public.ci_concept_variation(p_concept_id uuid)
returns table (
  kind            text,
  papel           text,      -- mantido | variado | nao_extraido
  n_valores       int,       -- valores canônicos distintos
  ads_no_conceito int,
  ads_com_valor   int,
  cobertura_pct   int,       -- ads_com_valor / ads_no_conceito
  dominancia_pct  int,       -- ads do valor mais comum / ads_com_valor
  dominante       text,      -- rótulo mais frequente, na grafia mais usada
  valores         jsonb      -- [{label, ads, exemplo_ad_id}] por ads desc
)
language sql
stable
security invoker
set search_path = public
as $$
  with membros as (
    select cm.ad_id
      from public.ci_concept_members cm
      join public.ci_ads a on a.id = cm.ad_id
     where cm.concept_id = p_concept_id
       -- DEMO nunca entra em agregado. Um anúncio de demonstração no meio da
       -- contagem faria a receita mentir sobre o que a marca faz.
       and not a.is_demo
  ),
  total as (select count(*)::int as n from membros),

  -- Cada (anúncio, kind) contribui com UM valor: o de maior confiança. Sem
  -- isto, um anúncio com três hooks pesaria três vezes na contagem do eixo e
  -- um anúncio com um hook pesaria uma — a variação viraria função de quantos
  -- rótulos o modelo resolveu emitir, não do que a marca fez.
  dominante_por_ad as (
    select distinct on (m.ad_id, t.kind)
           m.ad_id,
           t.kind,
           public.ci_canonical_label(t.label) as chave,
           t.label
      from membros m
      join public.ci_ad_taxonomy at   on at.ad_id = m.ad_id
      join public.ci_taxonomy_terms t on t.id = at.term_id
     where coalesce(at.evidence, '') <> ''    -- sem evidência não conta
       and public.ci_canonical_label(t.label) is not null
     order by m.ad_id, t.kind, at.confidence desc nulls last, t.label
  ),

  -- Quantas vezes cada GRAFIA aparece. Este passo intermediário existe porque
  -- ordenar as grafias por alfabeto escolheria "SOCIAL PROOF" sobre
  -- "social proof" só por causa da caixa alta — e o rótulo que a tela mostra
  -- tem que ser o que a marca mais escreve, não o que vem primeiro no ASCII.
  por_grafia as (
    select d.kind, d.chave, d.label,
           count(*)::int                            as ads_grafia,
           (array_agg(d.ad_id order by d.ad_id))[1] as exemplo_ad_id
      from dominante_por_ad d
     group by d.kind, d.chave, d.label
  ),

  por_valor as (
    select
      g.kind,
      g.chave,
      sum(g.ads_grafia)::int as ads,
      (array_agg(g.label         order by g.ads_grafia desc, g.label))[1] as label_exibido,
      (array_agg(g.exemplo_ad_id order by g.ads_grafia desc, g.label))[1] as exemplo_ad_id
    from por_grafia g
    group by g.kind, g.chave
  ),

  por_kind as (
    select
      v.kind,
      count(*)::int              as n_valores,
      sum(v.ads)::int            as ads_com_valor,
      max(v.ads)::int            as ads_do_dominante,
      (array_agg(v.label_exibido order by v.ads desc, v.label_exibido))[1] as dominante,
      jsonb_agg(
        jsonb_build_object(
          'label', v.label_exibido,
          'ads', v.ads,
          'exemplo_ad_id', v.exemplo_ad_id
        ) order by v.ads desc, v.label_exibido
      ) as valores
    from por_valor v
    group by v.kind
  )

  select
    k.kind,
    case
      -- Cobertura abaixo de 60%: o modelo não extraiu o campo em boa parte dos
      -- anúncios. Não dá para dizer se a marca manteve ou variou — e dizer
      -- qualquer uma das duas seria inventar.
      when (100.0 * k.ads_com_valor / t.n) < 60 then 'nao_extraido'
      -- 80% dos anúncios com o mesmo valor: a marca manteve. O limiar não é
      -- 100% de propósito (ver cabeçalho); é onde um estrategista ainda lê
      -- "eles mantêm isso" olhando a lista.
      when (100.0 * k.ads_do_dominante / k.ads_com_valor) >= 80 then 'mantido'
      else 'variado'
    end as papel,
    k.n_valores,
    t.n as ads_no_conceito,
    k.ads_com_valor,
    round(100.0 * k.ads_com_valor / nullif(t.n, 0))::int          as cobertura_pct,
    round(100.0 * k.ads_do_dominante / nullif(k.ads_com_valor,0))::int as dominancia_pct,
    k.dominante,
    k.valores
  from por_kind k, total t
  -- Ordem de leitura: primeiro o que a marca manteve (define a receita),
  -- depois o que ela testou ordenado por quantas variantes, e por último o
  -- que não conseguimos afirmar.
  order by
    case
      when (100.0 * k.ads_com_valor / t.n) < 60 then 3
      when (100.0 * k.ads_do_dominante / k.ads_com_valor) >= 80 then 1
      else 2
    end,
    k.n_valores desc,
    k.kind;
$$;

revoke all on function public.ci_concept_variation(uuid) from public;
grant execute on function public.ci_concept_variation(uuid) to authenticated;

comment on function public.ci_concept_variation(uuid) is
  'Eixos de variação de uma receita. Distingue mantido / variado / nao_extraido '
  '— apresentar ausência de extração como variação seria inventar achado.';
