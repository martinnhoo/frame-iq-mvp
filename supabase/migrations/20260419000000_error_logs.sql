-- Error logging table for frontend crashes and unhandled errors
create table if not exists public.error_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  error_type  text not null default 'unknown',      -- react_crash, js_error, unhandled_rejection
  message     text,
  stack       text,
  component   text,                                   -- React component stack or source
  url         text,                                   -- page URL where error occurred
  user_agent  text,
  metadata    jsonb default '{}',
  created_at  timestamptz not null default now()
);

-- Index for quick lookups by recency and type
create index if not exists idx_error_logs_created on public.error_logs(created_at desc);
create index if not exists idx_error_logs_type on public.error_logs(error_type);

-- RLS: anyone can insert (errors happen before/during auth), owner can read
alter table public.error_logs enable row level security;

create policy "Anyone can insert error logs"
  on public.error_logs for insert
  with check (true);

create policy "Owner can read error logs"
  on public.error_logs for select
  using (auth.uid() = user_id or user_id is null);

-- Auto-cleanup: keep only last 30 days of error logs
-- (run via pg_cron if available, otherwise manual)
create or replace function public.cleanup_old_error_logs() returns void
language sql security definer
as $$
  delete from public.error_logs where created_at < now() - interval '30 days';
$$;
