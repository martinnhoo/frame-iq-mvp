-- ═══════════════════════════════════════════════════════════════════════════
-- Conserta scene_function nas cenas que já estão no banco
--
-- ── O que apareceu na tela ────────────────────────────────────────────────
-- Uma estrutura de roteiro, em /ci/hooks, saiu assim:
--
--   hook|problem → Problema → solution|proof → solution|demo → demo|proof
--
-- O modelo copiou de volta o enum do schema — a barra vertical em
-- "hook|problem|solution|demo|proof|offer|cta" significa "escolha uma destas",
-- e ele devolveu a lista inteira. Também inventou valores fora dela, como
-- "objection handling".
--
-- ── Por que não é cosmético ───────────────────────────────────────────────
-- A estrutura é chave de agrupamento. Cada combinação diferente vira uma
-- estrutura diferente, e o padrão que existia — "problema → demo → prova → cta"
-- em doze anúncios — se dissolve em doze variantes que ninguém consegue ler.
-- É o mesmo defeito da fragmentação de receitas, num campo diferente.
--
-- ── Por que SQL e não reanálise ───────────────────────────────────────────
-- A correção no prompt (regra 11, semantic/v4) resolve daqui para a frente.
-- Mas as 638 cenas que já estão gravadas não precisam de Gemini para serem
-- consertadas: a informação está lá, só mal formatada. Reanalisar custaria
-- dinheiro para recuperar um dado que já temos.
--
-- Idempotente: rodar de novo não muda nada, porque valores já limpos passam
-- pelo mesmo caminho e saem iguais.
-- ═══════════════════════════════════════════════════════════════════════════

-- Antes: quantas cenas estão com valor inválido.
select
  count(*) filter (where scene_function like '%|%')                    as com_enum_copiado,
  count(*) filter (where scene_function is not null
                     and scene_function not like '%|%'
                     and lower(trim(scene_function)) not in (
                       'hook','problem','solution','product','demo',
                       'proof','benefit','objection','offer','cta'))   as fora_da_lista,
  count(*)                                                             as total
from public.ci_scenes;


update public.ci_scenes s
   set scene_function = novo.valor
  from (
    select
      sc.id,
      -- Mesma regra do worker, em SQL. Duplicar a lógica entre Python e
      -- Postgres é feio, e a alternativa — deixar o banco sujo até a próxima
      -- reanálise — é pior: a tela mente enquanto isso.
      (
        select coalesce(
          -- sinônimos primeiro
          case p.parte
            when 'demonstration'      then 'demo'
            when 'objection handling' then 'objection'
            when 'objection_handling' then 'objection'
            when 'call to action'     then 'cta'
            when 'call_to_action'     then 'cta'
            when 'solution reveal'    then 'solution'
            when 'product reveal'     then 'product'
            when 'social proof'       then 'proof'
            when 'testimonial'        then 'proof'
            else p.parte
          end, null)
        from unnest(string_to_array(lower(trim(sc.scene_function)), '|')) with ordinality
             as p(parte, ord)
        where case p.parte
                when 'demonstration'      then 'demo'
                when 'objection handling' then 'objection'
                when 'objection_handling' then 'objection'
                when 'call to action'     then 'cta'
                when 'call_to_action'     then 'cta'
                when 'solution reveal'    then 'solution'
                when 'product reveal'     then 'product'
                when 'social proof'       then 'proof'
                when 'testimonial'        then 'proof'
                else p.parte
              end in ('hook','problem','solution','product','demo',
                      'proof','benefit','objection','offer','cta')
        order by p.ord
        limit 1
      ) as valor
    from public.ci_scenes sc
    where sc.scene_function is not null
  ) novo
 where s.id = novo.id
   and s.scene_function is distinct from novo.valor;


-- Depois: as duas primeiras colunas têm que ser 0.
--
-- A terceira mostra quantas ficaram sem função — e isso NÃO é falha. Cena cuja
-- descrição não cabe em nenhuma das dez funções é cena sem função, e a tela já
-- sabe dizer "sem função não há sequência para comparar". Rótulo inventado
-- seria pior.
select
  count(*) filter (where scene_function like '%|%')                    as com_enum_copiado,
  count(*) filter (where scene_function is not null
                     and lower(trim(scene_function)) not in (
                       'hook','problem','solution','product','demo',
                       'proof','benefit','objection','offer','cta'))   as fora_da_lista,
  count(*) filter (where scene_function is null)                       as sem_funcao,
  count(*)                                                             as total
from public.ci_scenes;
