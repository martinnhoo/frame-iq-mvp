-- Platform connections table
-- Stores OAuth tokens for Meta, TikTok, Google Ads

create table if not exists platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('meta', 'tiktok', 'google')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  ad_accounts jsonb default '[]',
  status text not null default 'active' check (status in ('active', 'expired', 'error')),
  connected_at timestamptz default now(),
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, platform)
);

-- Enable RLS
alter table platform_connections enable row level security;

-- Users can only see and manage their own connections
create policy "Users manage own connections"
  on platform_connections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast user lookups
create index if not exists idx_platform_connections_user 
  on platform_connections(user_id);

-- Updated_at trigger
create or replace function update_platform_connections_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger platform_connections_updated_at
  before update on platform_connections
  for each row execute function update_platform_connections_updated_at();
