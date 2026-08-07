-- ═══════════════════════════════════════════════════════════════════════════
-- Quality gate — a acurácia por campo, medida em vez de suposta
--
-- ── A pergunta que isto responde ──────────────────────────────────────────
-- "Posso confiar nesses gráficos?"
--
-- Hoje o painel apresenta `proof` e `duração` do mesmo jeito. Se proof acerta
-- 60% e duração acerta 100%, a interface está mentindo por omissão — e mentir
-- por omissão é pior que errar visivelmente, porque ninguém vai procurar.
--
-- ── Por que guardar a correção, e não só certo/errado ─────────────────────
-- Marcar errado mede. Dizer QUAL era o certo ensina: vira material para
-- ajustar o prompt, e vira conjunto de referência para comparar versões do
-- modelo depois. O custo é um campo de texto opcional, preenchido só quando
-- houve erro — que é justamente onde a informação vale.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.ci_quality_reviews (
  id            uuid primary key default gen_random_uuid(),
  ad_id         uuid not null references public.ci_ads(id) on delete cascade,
  asset_id      uuid references public.ci_assets(id) on delete set null,
  brand_id      uuid not null references public.ci_brands(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,

  -- O campo avaliado. Lista fechada: métrica com nome livre vira dez nomes
  -- para a mesma coisa e nenhuma série temporal comparável.
  campo         text not null check (campo in (
                  'transcript','ocr','formato','produto','hook','angle',
                  'proof','offer','cta','estrutura','receita','duracao','cena'
                )),

  veredito      text not null check (veredito in ('correto','errado','parcial','nao_aplicavel')),

  -- O que o sistema disse, congelado no momento da revisão. Sem isto, uma
  -- reanálise mudaria o valor e a revisão passaria a julgar outra coisa.
  valor_sistema text,
  -- O que deveria ser. Opcional: só faz sentido quando houve erro.
  valor_correto text,
  observacao    text,

  revisado_por  text not null default 'humano' check (revisado_por in ('humano','modelo')),
  created_at    timestamptz not null default now(),

  -- Uma revisão por campo por anúncio. Revisar de novo SOBRESCREVE — a última
  -- palavra do humano é a que vale, e guardar histórico de opinião sobre o
  -- mesmo campo só confundiria a média.
  unique (ad_id, campo)
);

create index if not exists idx_ci_quality_brand on public.ci_quality_reviews(brand_id, campo);

alter table public.ci_quality_reviews enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                  where tablename = 'ci_quality_reviews' and policyname = 'ci_quality_own') then
    execute 'create policy ci_quality_own on public.ci_quality_reviews
               for all to authenticated
               using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;
end $$;


-- ── ci_quality_summary ─────────────────────────────────────────────────────
-- A tabela de acurácia. 'nao_aplicavel' fica FORA do denominador: um anúncio
-- sem áudio não tem transcrição para errar, e contá-lo como acerto inflaria a
-- nota; como erro, deprimiria. Ele simplesmente não é evidência.
create or replace function public.ci_quality_summary(p_brand_id uuid)
returns table (
  campo        text,
  revisados    int,
  corretos     int,
  parciais     int,
  errados      int,
  acuracia_pct int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.campo,
    count(*) filter (where r.veredito <> 'nao_aplicavel')::int as revisados,
    count(*) filter (where r.veredito = 'correto')::int        as corretos,
    count(*) filter (where r.veredito = 'parcial')::int        as parciais,
    count(*) filter (where r.veredito = 'errado')::int         as errados,
    case when count(*) filter (where r.veredito <> 'nao_aplicavel') = 0 then null
         else round(100.0 * (
                count(*) filter (where r.veredito = 'correto')
                -- Parcial vale meio acerto. Não é rigor estatístico; é
                -- reconhecer que "hook quase certo" não é o mesmo que "hook
                -- inventado", e forçar os dois no mesmo balde apagaria a
                -- diferença que mais importa para ajustar o prompt.
                + 0.5 * count(*) filter (where r.veredito = 'parcial')
              ) / count(*) filter (where r.veredito <> 'nao_aplicavel'))::int
    end as acuracia_pct
  from public.ci_quality_reviews r
  where r.brand_id = p_brand_id
  group by r.campo
  order by acuracia_pct nulls last, r.campo;
$$;

revoke all on function public.ci_quality_summary(uuid) from public;
grant execute on function public.ci_quality_summary(uuid) to authenticated;


-- ── Conferência ────────────────────────────────────────────────────────────
select count(*) as colunas from information_schema.columns
 where table_name = 'ci_quality_reviews';
