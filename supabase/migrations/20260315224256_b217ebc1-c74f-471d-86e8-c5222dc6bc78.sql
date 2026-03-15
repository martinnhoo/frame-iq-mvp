create table if not exists platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  platform text not null check (platform in ('meta', 'tiktok', 'google')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  ad_accounts jsonb default '[]',
  status text not null default 'active',
  persona_id uuid,
  connected_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, platform)
);

alter table platform_connections enable row level security;

create policy "Users manage own connections" on platform_connections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);