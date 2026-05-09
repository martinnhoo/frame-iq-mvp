-- user_brands + brand_assets — sistema de marcas customizadas do user
--
-- Por que: hoje as marcas (BETBUS, ELUCK, FUNILIVE, COME) ficam
-- hardcoded em src/data/hubBrands.ts com hints textuais. Não escala
-- pra um user que quer cadastrar a própria marca, e a IA não tem
-- referência visual real (só descrição "vermelho/dourado").
--
-- Solução: marca vira row no DB com nome + notas + N assets visuais
-- (screenshots de site, promos, banners de competidores). Quando o
-- user gera criativos, server carrega 3 assets aleatórios da marca
-- e passa como input_images_base64 pro GPT-image-2 — modelo usa como
-- referência visual real (estilo, cores, tipografia, layout).
--
-- Storage: reusa hub-images (já aceita PNG/JPG/WEBP até 25MB e tem
-- RLS por user_id no path). Path padrão: {user_id}/brand-assets/{brand_id}/{uuid}.{ext}

-- ── user_brands ────────────────────────────────────────────────────
create table if not exists public.user_brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- Notas livres do user: tom, palavras proibidas, paleta, regulação,
  -- ex: "Sempre tom direto. Cores vermelho+dourado. Nunca menores de 18.
  --      Mercado MX. Disclaimer obrigatório: 'Aplican términos.'"
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_user_brands_user on public.user_brands(user_id, created_at desc);

alter table public.user_brands enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'user_brands' and policyname = 'user_brands_owner') then
    create policy user_brands_owner on public.user_brands
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- ── brand_assets ────────────────────────────────────────────────────
create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.user_brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- URL pública do Storage (hub-images bucket, path {user_id}/brand-assets/{brand_id}/{uuid}.{ext})
  asset_url text not null,
  -- kind opcional pra futuro filter (logo / promo / screenshot / competitor / general)
  kind text default 'general',
  -- order de display + de pick aleatório (lower = mais relevante)
  position int default 0,
  created_at timestamptz default now()
);

create index if not exists idx_brand_assets_brand on public.brand_assets(brand_id, position);
create index if not exists idx_brand_assets_user on public.brand_assets(user_id);

alter table public.brand_assets enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'brand_assets' and policyname = 'brand_assets_owner') then
    create policy brand_assets_owner on public.brand_assets
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- ── trigger updated_at on user_brands ──────────────────────────────
create or replace function public.touch_user_brands_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_user_brands_updated on public.user_brands;
create trigger trg_user_brands_updated
  before update on public.user_brands
  for each row execute function public.touch_user_brands_updated_at();
