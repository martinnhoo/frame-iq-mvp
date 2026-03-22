-- Enable pg_cron extension (needs to be enabled in Supabase dashboard)
-- Run this in Supabase SQL Editor after enabling pg_cron

-- Schedule daily-intelligence to run at 12:00 UTC every day
select cron.schedule(
  'daily-intelligence-noon',
  '0 12 * * *',  -- Every day at 12:00 UTC (9h Brasília, 7h MX)
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-intelligence',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Also create the daily_snapshots table if not exists
create table if not exists daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  persona_id uuid,
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

alter table daily_snapshots enable row level security;

drop policy if exists "Users see own snapshots" on daily_snapshots;
create policy "Users see own snapshots" on daily_snapshots
  for all using (auth.uid() = user_id);

create index if not exists daily_snapshots_user_date on daily_snapshots(user_id, date desc);
