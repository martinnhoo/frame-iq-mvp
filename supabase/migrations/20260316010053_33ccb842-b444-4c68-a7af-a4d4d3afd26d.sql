create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  industry text not null,
  website text,
  description text,
  instagram text,
  facebook text,
  tiktok text,
  created_at timestamptz default now()
);

alter table companies enable row level security;

create policy "Users manage own companies" on companies for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);