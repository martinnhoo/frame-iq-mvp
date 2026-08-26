create table if not exists public.clip_variants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  clip_id uuid not null,
  variant_key text not null check (variant_key in ('blur_caption','zoom_caption','zoom_clean')),
  current_revision integer not null default 1 check (current_revision > 0),
  current_revision_id uuid,
  parameters jsonb not null default '{}'::jsonb,
  render_status text not null default 'pending' check (render_status in ('pending','rendering','ready','error')),
  rendered_storage_path text,
  rendered_url text,
  last_error text,
  render_attempts integer not null default 0,
  locked_by text,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clip_id, variant_key),
  unique (id, user_id),
  foreign key (clip_id, user_id) references public.clips(id, user_id) on delete cascade
);

create table if not exists public.clip_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  clip_id uuid not null,
  clip_variant_id uuid,
  feedback_text text not null,
  feedback_type text not null check (feedback_type in ('trim_start','trim_end','caption_text','caption_style','framing','regenerate_variant','regenerate_opportunity','discard')),
  interpreted_action jsonb not null default '{}'::jsonb,
  requires_ai boolean not null default false,
  status text not null default 'processing' check (status in ('processing','completed','error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (clip_id, user_id) references public.clips(id, user_id) on delete cascade,
  foreign key (clip_variant_id, user_id) references public.clip_variants(id, user_id) on delete cascade
);

create table if not exists public.clip_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  clip_id uuid not null,
  clip_variant_id uuid not null,
  feedback_id uuid,
  revision_number integer not null check (revision_number > 0),
  feedback_text text,
  interpreted_action jsonb not null default '{}'::jsonb,
  previous_parameters jsonb,
  parameters jsonb not null default '{}'::jsonb,
  render_status text not null default 'pending' check (render_status in ('pending','rendering','ready','error')),
  rendered_storage_path text,
  rendered_url text,
  last_error text,
  render_attempts integer not null default 0,
  locked_by text,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clip_variant_id, revision_number),
  unique (id, user_id),
  foreign key (clip_id, user_id) references public.clips(id, user_id) on delete cascade,
  foreign key (clip_variant_id, user_id) references public.clip_variants(id, user_id) on delete cascade,
  foreign key (feedback_id) references public.clip_feedback(id) on delete set null
);

alter table public.clip_variants
  add constraint clip_variants_current_revision_fk
  foreign key (current_revision_id) references public.clip_revisions(id) on delete set null;

create index if not exists idx_clip_revisions_render_queue
  on public.clip_revisions(render_status, render_attempts, created_at)
  where render_status in ('pending','error');
create index if not exists idx_clip_variants_user_clip on public.clip_variants(user_id, clip_id);
create index if not exists idx_clip_feedback_user_clip on public.clip_feedback(user_id, clip_id, created_at desc);
create index if not exists idx_clip_revisions_user_clip on public.clip_revisions(user_id, clip_id, created_at desc);

alter table public.clip_variants enable row level security;
alter table public.clip_feedback enable row level security;
alter table public.clip_revisions enable row level security;

revoke all on table public.clip_variants, public.clip_feedback, public.clip_revisions from anon, authenticated;
grant all on table public.clip_variants, public.clip_feedback, public.clip_revisions to service_role;

create policy clip_variants_own_select on public.clip_variants for select to authenticated
using ((select auth.uid()) = user_id);
create policy clip_feedback_own_select on public.clip_feedback for select to authenticated
using ((select auth.uid()) = user_id);
create policy clip_revisions_own_select on public.clip_revisions for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.clip_default_variant_parameters(
  p_variant_key text, p_start_seconds numeric, p_end_seconds numeric
)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'preset', p_variant_key,
    'start_seconds', p_start_seconds,
    'end_seconds', p_end_seconds,
    'captions', jsonb_build_object(
      'enabled', p_variant_key <> 'zoom_clean',
      'scale', 1,
      'position', 'lower'
    ),
    'framing', jsonb_build_object(
      'mode', case when p_variant_key = 'blur_caption' then 'contain_blur' else 'cover_center' end,
      'zoomIntensity', case when p_variant_key = 'blur_caption' then 'low' else 'medium' end
    ),
    'audio', jsonb_build_object('normalize', true),
    'hookTitle', jsonb_build_object('enabled', false)
  );
$$;

revoke all on function public.clip_default_variant_parameters(text, numeric, numeric) from public, anon, authenticated;

create or replace function public.clip_sync_parent_render_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clip_id uuid;
  v_total integer;
  v_ready integer;
  v_rendering integer;
  v_pending integer;
  v_attempts integer;
  v_error text;
  v_canonical_path text;
  v_status text;
begin
  v_clip_id := case when tg_op = 'DELETE' then old.clip_id else new.clip_id end;

  select count(*),
         count(*) filter (where render_status = 'ready'),
         count(*) filter (where render_status = 'rendering'),
         count(*) filter (where render_status = 'pending'),
         coalesce(max(render_attempts), 0),
         string_agg(last_error, ' | ') filter (where render_status = 'error' and last_error is not null)
    into v_total, v_ready, v_rendering, v_pending, v_attempts, v_error
    from public.clip_variants
   where clip_id = v_clip_id;

  select rendered_storage_path into v_canonical_path
    from public.clip_variants
   where clip_id = v_clip_id and variant_key = 'blur_caption' and render_status = 'ready';

  v_status := case
    when v_total = 3 and v_ready = 3 then 'ready'
    when v_rendering > 0 then 'rendering'
    when v_pending > 0 or v_total < 3 then 'pending'
    else 'error'
  end;

  update public.clips
     set render_status = v_status,
         rendered_storage_path = case when v_status = 'ready' then v_canonical_path else null end,
         rendered_url = null,
         last_error = case when v_status = 'error' then v_error else null end,
         render_attempts = greatest(render_attempts, v_attempts),
         locked_by = null,
         lease_expires_at = null,
         updated_at = now()
   where id = v_clip_id;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.clip_sync_parent_render_status() from public, anon, authenticated;

create trigger trg_clip_sync_parent_render_status
  after insert or update or delete on public.clip_variants
  for each row execute function public.clip_sync_parent_render_status();

create or replace function public.clip_sync_variant_from_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clip_variants
     set render_status = new.render_status,
         rendered_storage_path = new.rendered_storage_path,
         rendered_url = new.rendered_url,
         last_error = new.last_error,
         render_attempts = new.render_attempts,
         locked_by = new.locked_by,
         lease_expires_at = new.lease_expires_at,
         parameters = new.parameters,
         updated_at = now()
   where id = new.clip_variant_id
     and current_revision_id = new.id;
  return new;
end;
$$;

revoke all on function public.clip_sync_variant_from_revision() from public, anon, authenticated;

create trigger trg_clip_sync_variant_from_revision
  after insert or update on public.clip_revisions
  for each row execute function public.clip_sync_variant_from_revision();

create or replace function public.clip_ensure_variants_for_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and new.source_video_id is not null then
    insert into public.clip_variants (user_id, clip_id, variant_key, parameters)
    select new.user_id, new.id, variant_key,
           public.clip_default_variant_parameters(variant_key, new.start_seconds, new.end_seconds)
      from unnest(array['blur_caption','zoom_caption','zoom_clean']::text[]) as variant_key
    on conflict (clip_id, variant_key) do nothing;

    insert into public.clip_revisions (
      user_id, clip_id, clip_variant_id, revision_number, parameters, interpreted_action
    )
    select v.user_id, v.clip_id, v.id, 1, v.parameters,
           jsonb_build_object('type','initial_render','summary','Render inicial')
      from public.clip_variants v
     where v.clip_id = new.id
       and not exists (select 1 from public.clip_revisions r where r.clip_variant_id = v.id)
    on conflict (clip_variant_id, revision_number) do nothing;

    update public.clip_variants v
       set current_revision_id = r.id,
           current_revision = r.revision_number,
           render_status = r.render_status,
           updated_at = now()
      from public.clip_revisions r
     where v.clip_id = new.id
       and r.clip_variant_id = v.id
       and r.revision_number = 1
       and v.current_revision_id is null;
  end if;
  return new;
end;
$$;

revoke all on function public.clip_ensure_variants_for_approved() from public, anon, authenticated;

create trigger trg_clip_ensure_variants_for_approved
  after insert or update of status on public.clips
  for each row execute function public.clip_ensure_variants_for_approved();

-- Backfill somente de cortes editoriais aprovados que possuem um master.
insert into public.clip_variants (user_id, clip_id, variant_key, parameters)
select c.user_id, c.id, variant_key,
       public.clip_default_variant_parameters(variant_key, c.start_seconds, c.end_seconds)
  from public.clips c
 cross join unnest(array['blur_caption','zoom_caption','zoom_clean']::text[]) as variant_key
 where c.status = 'approved' and c.source_video_id is not null
on conflict (clip_id, variant_key) do nothing;

insert into public.clip_revisions (user_id, clip_id, clip_variant_id, revision_number, parameters, interpreted_action)
select v.user_id, v.clip_id, v.id, 1, v.parameters,
       jsonb_build_object('type','initial_render','summary','Render inicial')
  from public.clip_variants v
 where not exists (select 1 from public.clip_revisions r where r.clip_variant_id = v.id)
on conflict (clip_variant_id, revision_number) do nothing;

update public.clip_variants v
   set current_revision_id = r.id,
       current_revision = r.revision_number,
       render_status = r.render_status,
       updated_at = now()
  from public.clip_revisions r
 where r.clip_variant_id = v.id and r.revision_number = 1 and v.current_revision_id is null;

create or replace function public.clip_recover_stuck_jobs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  with recovered as (
    update public.clip_source_videos
       set pipeline_stage = case when attempts >= 4 then 'error' else 'discovered' end,
           media_status = case when attempts >= 4 then 'error' else 'waiting_for_media' end,
           stage_detail = null, locked_by = null, locked_at = null, lease_expires_at = null,
           next_retry_at = now() + make_interval(mins => least(30, greatest(2, attempts * 5))),
           last_error = coalesce(last_error, 'job abandonado: lease expirou sem heartbeat'),
           updated_at = now()
     where lease_expires_at is not null and lease_expires_at < now()
       and pipeline_stage in ('downloading','transcribing','analyzing','rendering')
    returning 1
  )
  select count(*) into v_count from recovered;

  update public.clip_revisions
     set render_status = case when render_attempts >= 4 then 'error' else 'pending' end,
         locked_by = null,
         lease_expires_at = null,
         last_error = case when render_attempts >= 4 then coalesce(last_error, 'render abandonado apos 4 tentativas') else last_error end,
         updated_at = now()
   where render_status = 'rendering' and lease_expires_at is not null and lease_expires_at < now();

  update public.clips c
     set render_status = 'pending', locked_by = null, lease_expires_at = null, updated_at = now()
   where c.render_status = 'rendering' and c.lease_expires_at is not null
     and c.lease_expires_at < now() and c.render_attempts < 4
     and not exists (select 1 from public.clip_variants v where v.clip_id = c.id);

  return v_count;
end;
$$;

revoke all on function public.clip_recover_stuck_jobs() from public, anon, authenticated;
grant execute on function public.clip_recover_stuck_jobs() to service_role;
