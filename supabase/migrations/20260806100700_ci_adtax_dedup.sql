-- ═══════════════════════════════════════════════════════════════════════════
-- ci_ad_taxonomy: torna a deduplicação alcançável por ON CONFLICT
--
-- ── O bug ──────────────────────────────────────────────────────────────────
-- O índice único original era de EXPRESSÃO:
--
--   create unique index uq_ci_adtax_ad_term_evidence
--     on ci_ad_taxonomy(ad_id, term_id, coalesce(evidence_kind,''), coalesce(timestamp_s,-1));
--
-- Ele protege o dado, mas o PostgREST não consegue mirá-lo: `on_conflict` só
-- aceita nomes de coluna, nunca expressões. Resultado: o estágio `persistence`
-- não tinha como fazer upsert e caía em INSERT puro. Na primeira duplicata o
-- Postgres devolvia 23505, a edge function traduzia para 400, e o job inteiro
-- falhava depois de já ter gasto ffmpeg, Whisper e uma chamada do Gemini.
--
-- Isso NÃO acontecia só em reprocessamento. Bastava o modelo devolver dois
-- termos com o mesmo (ad_id, term_id, evidence_kind, timestamp_s) — dois hooks
-- apontando o mesmo instante, por exemplo — para o anúncio inteiro morrer.
--
-- ── A correção ─────────────────────────────────────────────────────────────
-- Materializa a expressão numa coluna gerada. Coluna gerada é coluna de
-- verdade: o índice deixa de ser de expressão, e `on_conflict` passa a
-- alcançá-lo. A semântica de deduplicação continua idêntica — inclusive o
-- tratamento de NULL, que é o motivo do coalesce existir.
--
-- GENERATED ALWAYS: ninguém escreve nessa coluna, nem o worker nem a UI. Ela é
-- consequência das outras, não um campo que possa divergir delas.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.ci_ad_taxonomy
  add column if not exists dedup_key text
  generated always as (
    coalesce(evidence_kind, '~') || '|' || coalesce(timestamp_s, -1)::text
  ) stored;

-- '~' e não '': '' é um valor que evidence_kind poderia teoricamente assumir
-- se o CHECK mudasse um dia, e aí dois registros diferentes colidiriam. '~'
-- não está na lista permitida do CHECK, então nunca colide com valor real.

drop index if exists public.uq_ci_adtax_ad_term_evidence;

create unique index if not exists uq_ci_adtax_ad_term_dedup
  on public.ci_ad_taxonomy(ad_id, term_id, dedup_key);

comment on column public.ci_ad_taxonomy.dedup_key is
  'Chave de deduplicação materializada. Existe para que on_conflict do PostgREST '
  'consiga mirar o índice único — índice de expressão não é alcançável por ele.';


-- ── Conferência ────────────────────────────────────────────────────────────
-- Deve devolver exatamente uma linha, com indexdef citando dedup_key e SEM
-- nenhum coalesce.
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public'
   and tablename  = 'ci_ad_taxonomy'
   and indexdef like '%UNIQUE%';
