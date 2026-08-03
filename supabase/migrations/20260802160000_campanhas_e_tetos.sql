-- ═══════════════════════════════════════════════════════════════════════════
-- Campanhas com cupom + tetos por plano — 02/08/2026
--
-- 1. Campanhas: oferta de entrada aplicada por CÓDIGO, não para todo mundo.
--    Ex.: LANCAMENTO → R$ 49,90 nos 3 primeiros meses, depois R$ 97.
--    O desconto em si é do Stripe (coupon repeating). Aqui guardamos o que o
--    Stripe não guarda: qual campanha trouxe qual cliente, quantos resgates
--    restam, e se o cliente sobreviveu ao fim do desconto.
--
-- 2. Tetos: número de vídeos, gerações simultâneas e teto diário.
--    Crédito controla custo; teto controla operação. São coisas diferentes:
--    um usuário que dispara 200 vídeos numa madrugada esgota o saldo pré-pago
--    da PiAPI e derruba a geração para os outros pagantes — mesmo tendo
--    crédito para isso.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TETOS POR PLANO
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.hub_plan_config
  add column if not exists max_videos_month int,      -- null = sem teto
  add column if not exists max_concurrent   int not null default 1,
  add column if not exists max_videos_day   int;      -- null = sem teto diário

update public.hub_plan_config set
  max_videos_month = case plan
    when 'free'    then 1
    when 'creator' then 12
    when 'maker'   then 12
    when 'pro'     then 30
    when 'starter' then 30
    when 'studio'  then 65
    when 'scale'   then 65
    else 1 end,
  max_concurrent = case plan
    when 'free'    then 1
    when 'creator' then 1
    when 'maker'   then 1
    when 'pro'     then 3
    when 'starter' then 3
    when 'studio'  then 5
    when 'scale'   then 5
    else 1 end,
  max_videos_day = case plan
    when 'free'    then 1
    when 'creator' then 6
    when 'maker'   then 6
    when 'pro'     then 12
    when 'starter' then 12
    when 'studio'  then 25
    when 'scale'   then 25
    else 1 end;

comment on column public.hub_plan_config.max_videos_month is
  'Teto mensal de vídeos. Existe para clareza comercial ("30 vídeos/mês" vende '
  'melhor que "2.000 créditos") e para proteger o saldo pré-pago do provedor.';
comment on column public.hub_plan_config.max_concurrent is
  'Gerações simultâneas. É isto que impede geração em massa por script.';


-- Conta vídeos do ciclo e do dia, e quantos estão em andamento agora.
create or replace function public.hub_video_usage(p_user uuid)
returns table (month_count int, day_count int, in_flight int)
language sql security definer set search_path = public as $$
  select
    (select count(*)::int from public.hub_credit_ledger
      where user_id = p_user
        and action like 'video%'
        and state in ('reserved', 'confirmed')
        and created_at >= date_trunc('month', now())),
    (select count(*)::int from public.hub_credit_ledger
      where user_id = p_user
        and action like 'video%'
        and state in ('reserved', 'confirmed')
        and created_at >= date_trunc('day', now())),
    -- 'reserved' recente = job ainda rodando. Depois de 30 min a varredura
    -- de reservas órfãs limpa, então o que sobra aqui é trabalho real.
    (select count(*)::int from public.hub_credit_ledger
      where user_id = p_user
        and action like 'video%'
        and state = 'reserved'
        and created_at >= now() - interval '30 minutes');
$$;

grant execute on function public.hub_video_usage(uuid) to authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CAMPANHAS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.hub_campaigns (
  code                  text primary key,
  label                 text not null,
  plan                  text not null default 'pro',

  -- O que o cliente paga durante a promoção, e por quantos ciclos.
  intro_price_brl       numeric(10,2),
  intro_price_usd       numeric(10,2),
  intro_months          int not null default 3 check (intro_months between 1 and 12),

  -- IDs do Stripe. O desconto real é aplicado lá; aqui só referenciamos.
  stripe_promotion_code_brl text,
  stripe_promotion_code_usd text,

  max_redemptions       int,           -- null = ilimitado
  redeemed              int not null default 0,
  starts_at             timestamptz not null default now(),
  ends_at               timestamptz,   -- null = sem prazo
  active                bool not null default true,

  -- De onde veio o tráfego. Sem isto não dá pra saber qual campanha presta.
  source                text,
  created_at            timestamptz not null default now()
);

alter table public.hub_campaigns enable row level security;
-- Sem policy de leitura pública: validar código é papel da edge function, que
-- responde só sim/não. Expor a tabela entregaria a lista de cupons.

create table if not exists public.hub_campaign_redemptions (
  id            uuid primary key default gen_random_uuid(),
  code          text not null references public.hub_campaigns(code) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  plan          text not null,
  currency      text not null,
  intro_months  int not null,
  -- Quando o desconto acaba. É a data que interessa: quantos sobrevivem a ela
  -- é a única métrica que diz se a campanha trouxe cliente ou caçador de promo.
  full_price_at timestamptz,
  redeemed_at   timestamptz not null default now(),
  unique (code, user_id)
);

create index if not exists idx_hcr_code on public.hub_campaign_redemptions (code, redeemed_at desc);
create index if not exists idx_hcr_user on public.hub_campaign_redemptions (user_id);
alter table public.hub_campaign_redemptions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'hub_campaign_redemptions' and policyname = 'hcr_read_own') then
    create policy hcr_read_own on public.hub_campaign_redemptions
      for select to authenticated using (user_id = auth.uid());
  end if;
end $$;


-- ── Validação ───────────────────────────────────────────────────────────────
-- Uma função só, para o frontend (preview) e o checkout (aplicação) nunca
-- divergirem sobre o que é um cupom válido.
create or replace function public.hub_validate_campaign(
  p_code text,
  p_user uuid
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.hub_campaigns%rowtype;
begin
  select * into c from public.hub_campaigns
   where upper(code) = upper(trim(p_code));

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  if not c.active then
    return jsonb_build_object('valid', false, 'reason', 'inactive');
  end if;
  if now() < c.starts_at then
    return jsonb_build_object('valid', false, 'reason', 'not_started');
  end if;
  if c.ends_at is not null and now() > c.ends_at then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;
  if c.max_redemptions is not null and c.redeemed >= c.max_redemptions then
    return jsonb_build_object('valid', false, 'reason', 'sold_out');
  end if;
  if exists (select 1 from public.hub_campaign_redemptions r
              where r.code = c.code and r.user_id = p_user) then
    return jsonb_build_object('valid', false, 'reason', 'already_used');
  end if;

  return jsonb_build_object(
    'valid', true,
    'code', c.code,
    'label', c.label,
    'plan', c.plan,
    'intro_price_brl', c.intro_price_brl,
    'intro_price_usd', c.intro_price_usd,
    'intro_months', c.intro_months,
    'promo_brl', c.stripe_promotion_code_brl,
    'promo_usd', c.stripe_promotion_code_usd,
    'remaining', case when c.max_redemptions is null
                      then null else c.max_redemptions - c.redeemed end
  );
end $$;

grant execute on function public.hub_validate_campaign(text, uuid) to authenticated, service_role;


-- ── Resgate ─────────────────────────────────────────────────────────────────
-- Chamado pelo create-checkout depois de a sessão do Stripe ser criada.
-- Revalida sob lock: entre o preview e o clique, o último cupom pode ter ido.
create or replace function public.hub_redeem_campaign(
  p_code text,
  p_user uuid,
  p_currency text
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.hub_campaigns%rowtype;
  v_check jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('campaign:' || upper(trim(p_code)), 0));

  v_check := public.hub_validate_campaign(p_code, p_user);
  if not (v_check->>'valid')::bool then
    return v_check;
  end if;

  select * into c from public.hub_campaigns where upper(code) = upper(trim(p_code));

  insert into public.hub_campaign_redemptions
    (code, user_id, plan, currency, intro_months, full_price_at)
  values
    (c.code, p_user, c.plan, p_currency, c.intro_months,
     now() + (c.intro_months || ' months')::interval);

  update public.hub_campaigns set redeemed = redeemed + 1 where code = c.code;

  return jsonb_build_object('valid', true, 'code', c.code, 'plan', c.plan);
end $$;

revoke all on function public.hub_redeem_campaign(text, uuid, text) from public, anon;
grant execute on function public.hub_redeem_campaign(text, uuid, text) to service_role;


-- ── Campanha de lançamento ──────────────────────────────────────────────────
-- R$ 49,90 nos 3 primeiros meses, depois R$ 97. Só por código.
-- Os promotion codes do Stripe são preenchidos por scripts/stripe-setup.mjs.
insert into public.hub_campaigns
  (code, label, plan, intro_price_brl, intro_price_usd, intro_months,
   max_redemptions, source, active)
values
  ('LANCAMENTO', 'Oferta de lançamento — 3 meses com desconto', 'pro',
   49.90, 24.90, 3, 100, 'campanha-lancamento', true)
on conflict (code) do nothing;


-- ── Painel da campanha ──────────────────────────────────────────────────────
-- A pergunta que decide se a campanha funcionou não é quantos entraram —
-- é quantos continuaram depois de o desconto acabar.
create or replace view public.hub_campaign_stats as
select
  c.code,
  c.label,
  c.redeemed,
  c.max_redemptions,
  count(r.id) filter (where r.full_price_at <= now())            as ja_no_preco_cheio,
  count(r.id) filter (where r.full_price_at > now())             as ainda_no_desconto,
  min(r.redeemed_at)                                             as primeiro_resgate,
  max(r.redeemed_at)                                             as ultimo_resgate
from public.hub_campaigns c
left join public.hub_campaign_redemptions r on r.code = c.code
group by c.code, c.label, c.redeemed, c.max_redemptions;
