-- hub_elements — biblioteca de elementos reutilizáveis (PNGs com fundo
-- transparente que o user upa pra usar em criativos do Image Studio).
--
-- Antes: localStorage com data URLs base64 → estourava quota do browser
-- com poucos PNGs grandes (cota típica 5-10MB por origem).
--
-- Agora: cada elemento vira 1 row aqui + 1 file no bucket hub-images
-- sob o prefixo {user_id}/elements/{element_id}.png. Sem limite prático.
--
-- Por que tabela separada e não hub_assets:
--   hub_assets é pra OUTPUTS gerados (image/png/storyboard/voice/etc).
--   Elementos são INPUTS — assets que o user upa pra reutilizar como
--   referência visual. Mistura semântica polui a Biblioteca.

create table if not exists public.hub_elements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  storage_path text not null,           -- ex: 'abc-123/elements/xyz.png'
  public_url text not null,             -- URL público pra <img> e edge functions fetcharem
  byte_size integer,
  mime_type text default 'image/png',
  created_at timestamptz not null default now()
);

create index if not exists idx_hub_elements_user_created
  on public.hub_elements (user_id, created_at desc);

alter table public.hub_elements enable row level security;

drop policy if exists "Users manage own hub elements" on public.hub_elements;
create policy "Users manage own hub elements"
  on public.hub_elements for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.hub_elements is
  'Elementos reutilizáveis (PNGs transparentes) que o user upa pro Image Studio. Substituiu localStorage que estourava quota.';
