-- chat_messages: persist AI chat history for paid users (Maker/Pro/Studio)
-- Free plan users keep localStorage only; paid users get server-side persistence
-- This allows cross-device access and survives cache clears

create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  persona_id   uuid references public.personas(id) on delete cascade,
  role         text not null check (role in ('user', 'assistant')),
  content      jsonb not null,           -- { userText?: string, blocks?: Block[] }
  ts           bigint not null,          -- original client timestamp (ms)
  created_at   timestamptz default now()
);

-- Indexes for fast per-account history queries
create index if not exists chat_messages_user_persona_ts
  on public.chat_messages(user_id, persona_id, ts desc);

create index if not exists chat_messages_user_ts
  on public.chat_messages(user_id, ts desc);

-- RLS: users can only see their own messages
alter table public.chat_messages enable row level security;

create policy "Users manage own chat messages"
  on public.chat_messages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-prune: keep only last 100 messages per (user_id, persona_id) via function + trigger
-- This prevents unbounded table growth
create or replace function public.prune_chat_messages()
returns trigger language plpgsql security definer as $$
begin
  delete from public.chat_messages
  where id in (
    select id from public.chat_messages
    where user_id = NEW.user_id
      and (
        (NEW.persona_id is null and persona_id is null) or
        persona_id = NEW.persona_id
      )
    order by ts desc
    offset 100
  );
  return NEW;
end;
$$;

create trigger prune_chat_after_insert
  after insert on public.chat_messages
  for each row execute function public.prune_chat_messages();
