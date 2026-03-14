create table if not exists ai_user_insights (
  user_id uuid primary key references auth.users(id) on delete cascade,
  summary text,
  updated_at timestamptz default now()
);

alter table ai_user_insights enable row level security;

create policy "Users manage own insights"
  on ai_user_insights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
