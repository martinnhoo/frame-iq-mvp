-- daily_snapshots: stores daily intelligence summaries per user/account
create table if not exists daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  persona_id uuid references personas(id) on delete set null,
  date date not null,
  account_id text,
  account_name text,
  total_spend numeric(10,2) default 0,
  avg_ctr numeric(8,6) default 0,
  total_clicks integer default 0,
  active_ads integer default 0,
  winners_count integer default 0,
  losers_count integer default 0,
  yesterday_spend numeric(10,2) default 0,
  yesterday_ctr numeric(8,6) default 0,
  top_ads jsonb default '[]',
  ai_insight text,
  raw_period jsonb,
  created_at timestamptz default now(),
  unique(user_id, persona_id, date)
);

-- RLS
alter table daily_snapshots enable row level security;
create policy "Users see own snapshots" on daily_snapshots
  for all using (auth.uid() = user_id);

-- Index for fast queries
create index if not exists daily_snapshots_user_date on daily_snapshots(user_id, date desc);
