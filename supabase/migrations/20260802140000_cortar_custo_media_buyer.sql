-- ═══════════════════════════════════════════════════════════════════════════
-- Corte de custo recorrente — 02/08/2026
--
-- Pivot: o produto agora é o Hub Criativo. O motor de media buyer fica
-- dormindo. Mas dormindo estava custando: 7 crons continuavam chamando
-- Meta API, Anthropic, Brave Search e Telegram todo dia, para um produto
-- que não é mais vendido.
--
-- Esta migration desliga o que não serve ao Hub e liga o que ele precisa.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DESLIGAR — media buyer
-- ─────────────────────────────────────────────────────────────────────────────
--
--  cron                        frequência    o que queimava
--  ──────────────────────────  ────────────  ─────────────────────────────────
--  adbrief-sync-ad-diary       1x/dia        Meta Ads API
--  adbrief-daily-intelligence  1x/dia        Anthropic (função de 1.371 linhas)
--  adbrief-market-intelligence 1x/dia        Anthropic + Brave
--  adbrief-creative-director   1x/semana     Anthropic
--  adbrief-weekly-report       1x/semana     Anthropic + Resend
--  adbrief-critical-alerts     4x/dia        Meta API + Anthropic + Telegram
--  adbrief-trend-watch         3x/dia        Brave Search + Anthropic
--
-- Os 3 de e-mail também saem: falam de "conectar sua conta Meta", que não é
-- mais o produto. Precisam ser reescritos para o Hub antes de voltar.

do $$
declare
  v_job text;
  v_dead text[] := array[
    'adbrief-sync-ad-diary',
    'adbrief-daily-intelligence',
    'adbrief-market-intelligence',
    'adbrief-creative-director',
    'adbrief-weekly-report',
    'adbrief-critical-alerts',
    'adbrief-trend-watch',
    'adbrief-email-lifecycle',
    'adbrief-fast-activation',
    'adbrief-demo-followup'
  ];
begin
  foreach v_job in array v_dead loop
    if exists (select 1 from cron.job where jobname = v_job) then
      perform cron.unschedule(v_job);
      raise notice 'cron desligado: %', v_job;
    end if;
  end loop;
end $$;

-- Varredura final: qualquer job adbrief-* que sobrou e não está na allowlist.
-- Pega o que foi criado fora do setup-cron e que ninguém lembra mais.
do $$
declare r record;
begin
  for r in
    select jobname from cron.job
     where jobname like 'adbrief-%'
       and jobname not in ('adbrief-trial-expiring', 'adbrief-hub-sweep')
  loop
    perform cron.unschedule(r.jobname);
    raise notice 'cron órfão desligado: %', r.jobname;
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. LIGAR — o único cron que o Hub precisa
--
-- Devolve reservas de crédito órfãs (função morreu entre reservar e
-- confirmar). Sem isso o crédito fica preso e o usuário reclama de saldo
-- que sumiu. Roda a cada 30 min; é só um UPDATE, custo desprezível.
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  if exists (select 1 from cron.job where jobname = 'adbrief-hub-sweep') then
    perform cron.unschedule('adbrief-hub-sweep');
  end if;
end $$;

select cron.schedule(
  'adbrief-hub-sweep',
  '*/30 * * * *',
  $$ select public.hub_sweep_stale_reservations(); $$
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Telemetria de saldo dos providers pré-pagos
--
-- A PiAPI é pré-paga e o saldo acabou em 01/08, derrubando a geração de
-- vídeo para todo mundo. Com histórico dá pra recarregar antes.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.provider_balance_log (
  id          bigserial primary key,
  provider    text not null,
  balance_usd numeric(12,2) not null,
  level       text not null check (level in ('ok', 'warning', 'critical', 'unknown')),
  created_at  timestamptz not null default now()
);
create index if not exists idx_pbl_provider on public.provider_balance_log (provider, created_at desc);
alter table public.provider_balance_log enable row level security;
-- Só service_role escreve e lê. Nenhuma policy para authenticated é proposital.


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Registro do que ficou desligado
-- ─────────────────────────────────────────────────────────────────────────────

comment on schema public is
  'AdBrief — Hub Criativo. Media buyer (Meta Ads, decision engine, autopilot) '
  'está DORMINDO desde 02/08/2026: código preservado, crons desligados. '
  'Para reativar: rode a edge function setup-cron.';
