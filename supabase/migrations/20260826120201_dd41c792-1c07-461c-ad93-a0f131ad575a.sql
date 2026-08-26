-- AdBrief Clip Network — MVP schema
-- Keeps social publishing tokens server-only while exposing safe metadata to the dashboard.

create extension if not exists pgcrypto;

create table if not exists public.clip_networks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Clip Network',
  daily_limit integer not null default 10 check (daily_limit between 1 and 100),
  min_score numeric not null default 78 check (min_score between 0 and 100),
  approval_mode text not null default 'review' check (approval_mode in ('review','auto')),
  timezone text not null default 'America/Sao_Paulo',
  posting_slots text[] not null default array['09:00','10:30','12:00','13:30','15:00','16:30','18:00','19:30','21:00','22:30'],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.clip_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  network_id uuid not null,
  label text not null,
  niche text not null,
  tone text,
  rules jsonb not null default '{}'::jsonb,
  daily_limit integer not null default 10 check (daily_limit between 1 and 50),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (network_id, user_id) references public.clip_networks(id, user_id) on delete cascade
);

create table if not exists public.clip_social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  clip_account_id uuid not null,
  platform text not null check (platform in ('instagram','tiktok')),
  external_user_id text not null,
  username text,
  display_name text,
  status text not null default 'active' check (status in ('active','expired','revoked','error')),
  capabilities jsonb not null default '{}'::jsonb,
  token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, clip_account_id, platform),
  unique (id, user_id),
  foreign key (clip_account_id, user_id) references public.clip_accounts(id, user_id) on delete cascade
);

-- Sensitive tokens live in a separate server-only table. RLS is enabled with NO user policies.
create table if not exists public.clip_social_tokens (
  social_account_id uuid primary key references public.clip_social_accounts(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  token_type text,
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  scopes text,
  provider_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.clip_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  network_id uuid not null,
  provider text not null default 'youtube' check (provider in ('youtube','upload','storage')),
  label text not null,
  provider_url text,
  provider_channel_id text,
  uploads_playlist_id text,
  rights_confirmed boolean not null default false,
  active boolean not null default true,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (network_id, user_id) references public.clip_networks(id, user_id) on delete cascade
);

create table if not exists public.clip_source_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null,
  provider_video_id text,
  source_url text,
  title text not null,
  thumbnail_url text,
  source_published_at timestamptz,
  discovered_at timestamptz not null default now(),
  rights_confirmed boolean not null default false,
  media_status text not null default 'waiting_for_media' check (media_status in ('waiting_for_media','ready','processing','processed','error')),
  media_url text,
  media_storage_path text,
  transcript_status text not null default 'pending' check (transcript_status in ('pending','processing','ready','error')),
  transcript jsonb,
  duration_seconds numeric,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, provider_video_id),
  unique (id, user_id),
  foreign key (source_id, user_id) references public.clip_sources(id, user_id) on delete cascade
);

create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_video_id uuid,
  clip_account_id uuid not null,
  start_seconds numeric,
  end_seconds numeric,
  transcript_excerpt text,
  topic text,
  hook text,
  on_screen_title text,
  caption text,
  score numeric not null default 0 check (score between 0 and 100),
  ai_reason text,
  status text not null default 'candidate' check (status in ('candidate','approved','rejected','scheduled','published','error')),
  render_status text not null default 'pending' check (render_status in ('pending','rendering','ready','error','not_needed')),
  rendered_url text,
  rendered_storage_path text,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (source_video_id, user_id) references public.clip_source_videos(id, user_id) on delete set null (source_video_id),
  foreign key (clip_account_id, user_id) references public.clip_accounts(id, user_id) on delete cascade
);

create table if not exists public.clip_publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  clip_id uuid not null,
  social_account_id uuid not null,
  platform text not null check (platform in ('instagram','tiktok')),
  status text not null default 'queued' check (status in ('queued','publishing','processing','published','failed','needs_user_action')),
  provider_publish_id text,
  provider_media_id text,
  scheduled_at timestamptz,
  published_at timestamptz,
  last_checked_at timestamptz,
  error_code text,
  error_message text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clip_id, social_account_id),
  unique (id, user_id),
  foreign key (clip_id, user_id) references public.clips(id, user_id) on delete cascade,
  foreign key (social_account_id, user_id) references public.clip_social_accounts(id, user_id) on delete cascade
);

create table if not exists public.clip_publication_metrics (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null,
  captured_at timestamptz not null default now(),
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  watch_time_seconds numeric,
  raw jsonb not null default '{}'::jsonb,
  foreign key (publication_id, user_id) references public.clip_publications(id, user_id) on delete cascade
);

create index if not exists idx_clip_sources_user_active on public.clip_sources(user_id, active);
create index if not exists idx_clip_source_videos_status on public.clip_source_videos(user_id, media_status, transcript_status);
create index if not exists idx_clips_queue on public.clips(user_id, status, scheduled_at);
create index if not exists idx_clip_publications_queue on public.clip_publications(status, scheduled_at);
create index if not exists idx_clip_metrics_publication on public.clip_publication_metrics(publication_id, captured_at desc);

grant select, insert, update, delete on public.clip_networks to authenticated;
grant all on public.clip_networks to service_role;
grant select, insert, update, delete on public.clip_accounts to authenticated;
grant all on public.clip_accounts to service_role;
grant select, insert, update, delete on public.clip_social_accounts to authenticated;
grant all on public.clip_social_accounts to service_role;
grant select, insert, update, delete on public.clip_sources to authenticated;
grant all on public.clip_sources to service_role;
grant select, insert, update, delete on public.clip_source_videos to authenticated;
grant all on public.clip_source_videos to service_role;
grant select, insert, update, delete on public.clips to authenticated;
grant all on public.clips to service_role;
grant select, insert, update, delete on public.clip_publications to authenticated;
grant all on public.clip_publications to service_role;
grant select, insert, update, delete on public.clip_publication_metrics to authenticated;
grant all on public.clip_publication_metrics to service_role;
grant all on public.clip_social_tokens to service_role;
grant usage, select on sequence public.clip_publication_metrics_id_seq to authenticated;
grant all on sequence public.clip_publication_metrics_id_seq to service_role;

alter table public.clip_networks enable row level security;
alter table public.clip_accounts enable row level security;
alter table public.clip_social_accounts enable row level security;
alter table public.clip_social_tokens enable row level security;
alter table public.clip_sources enable row level security;
alter table public.clip_source_videos enable row level security;
alter table public.clips enable row level security;
alter table public.clip_publications enable row level security;
alter table public.clip_publication_metrics enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'clip_networks','clip_accounts','clip_social_accounts','clip_sources',
    'clip_source_videos','clips','clip_publications','clip_publication_metrics'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_own_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_own_all', t
    );
  end loop;
end $$;

-- Intentionally NO policy on clip_social_tokens. Only service_role functions may access tokens.

drop policy if exists "clip-network own uploads" on storage.objects;
create policy "clip-network own uploads"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'clip-network'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "clip-network own updates" on storage.objects;
create policy "clip-network own updates"
on storage.objects for update to authenticated
using (bucket_id = 'clip-network' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'clip-network' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "clip-network own deletes" on storage.objects;
create policy "clip-network own deletes"
on storage.objects for delete to authenticated
using (bucket_id = 'clip-network' and (storage.foldername(name))[1] = auth.uid()::text);