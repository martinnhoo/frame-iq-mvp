-- ═══════════════════════════════════════════════════════════════════════════
-- Hub comercial — 02/08/2026
--
-- Três coisas, na ordem em que importam:
--   1. Ledger de créditos + RPC de reserva atômica  → fecha o buraco onde toda
--      geração de mídia era gratuita para qualquer plano, inclusive Free.
--   2. logo_url + markets em user_brands            → marca do usuário completa
--   3. Limpeza das marcas pré-cadastradas dos templates de workflow
--
-- Migrations já aplicadas não são editadas; esta corrige o estado.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MARCA DO USUÁRIO — logo + mercados
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.user_brands
  add column if not exists logo_url text,
  add column if not exists markets  text[] default '{}';

comment on column public.user_brands.notes is
  'Preferências e contexto da marca escritos pelo usuário: tom de voz, paleta, '
  'palavras proibidas, público, regulação. Injetado no prompt de toda geração.';
comment on column public.user_brands.logo_url is
  'URL do logo no Storage (bucket hub-images). Compositado no criativo quando '
  'o usuário ativa "Incluir logo".';
comment on column public.user_brands.markets is
  'Mercados onde a marca opera (BR, MX, CO, PE, US, IN). Vazio = sem restrição.';

-- 'logo' vira um kind de primeira classe em brand_assets
alter table public.brand_assets
  drop constraint if exists brand_assets_kind_check;
alter table public.brand_assets
  add constraint brand_assets_kind_check
  check (kind in ('general', 'logo', 'promo', 'screenshot', 'competitor', 'product'));


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. LEDGER DE CRÉDITOS
--
-- Modelo reserva → confirma → estorna. A geração de vídeo na PiAPI é
-- assíncrona (cria task, faz polling). Se o débito só acontecesse no sucesso,
-- o usuário dispararia 20 jobs em paralelo com saldo para 1 e todos passariam.
-- O saldo precisa sair ANTES da chamada ao provider.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.hub_credit_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  action      text not null,
  credits     int  not null check (credits > 0),
  state       text not null default 'reserved'
              check (state in ('reserved', 'confirmed', 'refunded')),
  ref_id      text,
  created_at  timestamptz not null default now(),
  settled_at  timestamptz
);

create index if not exists idx_hcl_user_created on public.hub_credit_ledger (user_id, created_at desc);
create index if not exists idx_hcl_ref          on public.hub_credit_ledger (ref_id) where ref_id is not null;
-- Reservas presas (crash entre reservar e confirmar) são varridas por esse índice.
create index if not exists idx_hcl_stale        on public.hub_credit_ledger (created_at) where state = 'reserved';

alter table public.hub_credit_ledger enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'hub_credit_ledger' and policyname = 'hcl_read_own') then
    create policy hcl_read_own on public.hub_credit_ledger
      for select to authenticated using (user_id = auth.uid());
  end if;
end $$;
-- Escrita só via RPC security definer / service role. O cliente nunca insere.


-- ── Pacotes de créditos comprados avulsos ───────────────────────────────────
create table if not exists public.hub_credit_packs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  credits     int not null check (credits > 0),
  source      text not null default 'purchase',
  expires_at  timestamptz not null default (now() + interval '365 days'),
  created_at  timestamptz not null default now()
);
create index if not exists idx_hcp_user on public.hub_credit_packs (user_id, expires_at desc);
alter table public.hub_credit_packs enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'hub_credit_packs' and policyname = 'hcp_read_own') then
    create policy hcp_read_own on public.hub_credit_packs
      for select to authenticated using (user_id = auth.uid());
  end if;
end $$;


-- ── Pools por plano ─────────────────────────────────────────────────────────
-- Tabela, não constante em código: mudar preço não deveria exigir deploy.
create table if not exists public.hub_plan_config (
  plan            text primary key,
  monthly_credits int  not null,
  renews          bool not null default true,
  price_usd       numeric(10,2),
  price_brl       numeric(10,2),
  updated_at      timestamptz not null default now()
);

insert into public.hub_plan_config (plan, monthly_credits, renews, price_usd, price_brl) values
  ('free',     80,   false, 0,   0),
  ('creator',  700,  true,  19,  97),
  ('pro',      2000, true,  49,  247),
  ('studio',   4500, true,  99,  497)
on conflict (plan) do update set
  monthly_credits = excluded.monthly_credits,
  renews          = excluded.renews,
  price_usd       = excluded.price_usd,
  price_brl       = excluded.price_brl,
  updated_at      = now();

-- Aliases antigos apontam para os novos pools.
insert into public.hub_plan_config (plan, monthly_credits, renews, price_usd, price_brl) values
  ('maker',   700,  true, 19, 97),
  ('starter', 2000, true, 49, 247),
  ('scale',   4500, true, 99, 497)
on conflict (plan) do nothing;


-- ── Saldo ───────────────────────────────────────────────────────────────────
-- Saldo = pool do plano + pacotes válidos − consumo do ciclo.
-- Ciclo = mês corrente. Créditos de assinatura não acumulam (o breakage é o
-- que sustenta a margem); pacotes avulsos valem 12 meses.
create or replace function public.hub_credit_balance(p_user uuid)
returns table (balance int, plan_credits int, pack_credits int, used int)
language plpgsql security definer set search_path = public as $$
declare
  v_plan  text;
  v_pool  int;
  v_packs int;
  v_used  int;
  v_cycle_start timestamptz := date_trunc('month', now());
begin
  select coalesce(p.plan, 'free') into v_plan
    from public.user_profiles p where p.id = p_user;

  select c.monthly_credits into v_pool
    from public.hub_plan_config c where c.plan = coalesce(v_plan, 'free');
  v_pool := coalesce(v_pool, 0);

  select coalesce(sum(k.credits), 0) into v_packs
    from public.hub_credit_packs k
    where k.user_id = p_user and k.expires_at > now();

  -- Reservas contam como gasto: só voltam se forem estornadas.
  select coalesce(sum(l.credits), 0) into v_used
    from public.hub_credit_ledger l
    where l.user_id = p_user
      and l.state in ('reserved', 'confirmed')
      and l.created_at >= v_cycle_start;

  return query select (v_pool + v_packs - v_used)::int, v_pool, v_packs::int, v_used;
end $$;


-- ── Reserva atômica ─────────────────────────────────────────────────────────
-- O advisory lock por usuário é o que impede duas requisições simultâneas de
-- furarem o limite. Sem ele, dois vídeos disparados juntos leem o mesmo saldo
-- e ambos passam.
create or replace function public.hub_reserve_credits(
  p_user    uuid,
  p_action  text,
  p_credits int
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_balance int;
  v_id      uuid;
begin
  if p_credits <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  select b.balance into v_balance from public.hub_credit_balance(p_user) b;

  if v_balance < p_credits then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_credits',
                              'available', greatest(v_balance, 0), 'needed', p_credits);
  end if;

  insert into public.hub_credit_ledger (user_id, action, credits, state)
  values (p_user, p_action, p_credits, 'reserved')
  returning id into v_id;

  return jsonb_build_object('ok', true, 'reservation_id', v_id,
                            'balance_after', v_balance - p_credits);
end $$;

revoke all on function public.hub_reserve_credits(uuid, text, int) from public, anon;
grant execute on function public.hub_reserve_credits(uuid, text, int) to service_role;
grant execute on function public.hub_credit_balance(uuid) to authenticated, service_role;


-- ── Varredura de reservas órfãs ─────────────────────────────────────────────
-- Se uma edge function morrer entre reservar e confirmar, o crédito ficaria
-- preso para sempre. Nenhuma geração leva 30 minutos.
create or replace function public.hub_sweep_stale_reservations()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.hub_credit_ledger
     set state = 'refunded', settled_at = now()
   where state = 'reserved' and created_at < now() - interval '30 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. LIMPEZA DAS MARCAS PRÉ-CADASTRADAS
--
-- Templates de workflow foram semeados com brand_id 'betbus' / 'eluck'.
-- Esses ids não existem mais: marca agora é uuid em user_brands.
-- ─────────────────────────────────────────────────────────────────────────────

update public.hub_workflows
   set brand_id = null
 where brand_id in ('betbus', 'eluck', 'come', 'funilive');

-- Mesma troca dentro do JSON do grafo, nos nós de brand.
update public.hub_workflows
   set graph = replace(
         replace(
           replace(
             replace(graph::text, '"brand_id": "betbus"',   '"brand_id": "none"'),
             '"brand_id": "eluck"',    '"brand_id": "none"'),
           '"brand_id": "come"',       '"brand_id": "none"'),
         '"brand_id": "funilive"',     '"brand_id": "none"')::jsonb
 where graph::text like '%"brand_id": "betbus"%'
    or graph::text like '%"brand_id": "eluck"%'
    or graph::text like '%"brand_id": "come"%'
    or graph::text like '%"brand_id": "funilive"%';

-- Disclaimer regulatório era específico de uma marca de iGaming.
-- Quem precisar escreve nas preferências da própria marca.
update public.hub_workflows
   set graph = replace(graph::text, '"include_disclaimer": true', '"include_disclaimer": false')::jsonb
 where is_template = true
   and graph::text like '%"include_disclaimer": true%';

-- Copy de exemplo com nome de marca real nos templates de voiceover.
update public.hub_workflows
   set graph = replace(graph::text, 'BETBUS', 'sua marca')::jsonb
 where is_template = true and graph::text like '%BETBUS%';
