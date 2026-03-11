-- Pre-flight checks history
create table if not exists public.preflight_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  script text,
  platform text,
  market text,
  format text,
  product text,
  score integer,
  verdict text,
  hook_score numeric(3,1),
  result jsonb,
  created_at timestamptz default now()
);

alter table public.preflight_checks enable row level security;

create policy "Users can manage their own preflight checks"
  on public.preflight_checks
  for all using (auth.uid() = user_id);

create index if not exists preflight_checks_user_id_idx on public.preflight_checks(user_id);
create index if not exists preflight_checks_created_at_idx on public.preflight_checks(created_at desc);
