-- hub_assets — tabela dedicada pro Brilliant Hub.
--
-- Por que nova tabela e não reusar creative_memory:
--   creative_memory é da feature de Meta Ads analytics (colunas
--   hook_type, hook_score, platform, market, ctr, roas, etc.) e
--   tem schema rígido focado nesse domínio. Tentar fittar Hub
--   assets nela exigiria adicionar colunas type+content que
--   poluem semanticamente — e foi exatamente isso que falhava
--   silenciosamente quando o código tentava escrever lá.
--
-- hub_assets é simples: id, user_id, kind, content (JSONB), created_at.
-- Todos os assets do Hub (image, png, storyboard, carousel) usam.

create table if not exists public.hub_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- Validação: kind precisa ser um dos tipos suportados
  constraint hub_assets_kind_check check (
    kind in ('hub_image', 'hub_png', 'hub_storyboard', 'hub_carousel')
  )
);

-- Indexes pra queries comuns: lista por user + kind + recência
create index if not exists idx_hub_assets_user_created
  on public.hub_assets (user_id, created_at desc);
create index if not exists idx_hub_assets_user_kind_created
  on public.hub_assets (user_id, kind, created_at desc);

-- RLS: usuário só vê e escreve próprias rows
alter table public.hub_assets enable row level security;

drop policy if exists "Users manage own hub assets" on public.hub_assets;
create policy "Users manage own hub assets"
  on public.hub_assets for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.hub_assets is
  'Assets gerados no Brilliant Hub: imagens, PNGs, storyboards e carrosséis. content JSONB tem prompt, image_url, brand_id, market, etc. dependendo do kind.';
