alter table public.clip_source_videos
  add column if not exists pipeline_stage text not null default 'discovered',
  add column if not exists stage_detail text,
  add column if not exists attempts integer not null default 0,
  add column if not exists locked_by text,
  add column if not exists locked_at timestamptz,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists next_retry_at timestamptz,
  add column if not exists clips_generated integer not null default 0,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_finished_at timestamptz;

alter table public.clip_source_videos drop constraint if exists clip_source_videos_pipeline_stage_check;
alter table public.clip_source_videos add constraint clip_source_videos_pipeline_stage_check check (
  pipeline_stage in ('discovered','downloading','transcribing','analyzing','rendering','done','error','blocked')
);

alter table public.clip_source_videos drop constraint if exists clip_source_videos_media_status_check;
alter table public.clip_source_videos add constraint clip_source_videos_media_status_check check (
  media_status in ('waiting_for_media','downloading','ready','processing','processed','error','blocked')
);

create index if not exists idx_clip_source_videos_pipeline
  on public.clip_source_videos(pipeline_stage, next_retry_at, source_published_at desc);
create index if not exists idx_clip_source_videos_lease
  on public.clip_source_videos(lease_expires_at) where lease_expires_at is not null;

alter table public.clips
  add column if not exists dedupe_key text,
  add column if not exists last_error text,
  add column if not exists render_attempts integer not null default 0,
  add column if not exists locked_by text,
  add column if not exists lease_expires_at timestamptz;

create unique index if not exists uq_clips_dedupe
  on public.clips(source_video_id, dedupe_key)
  where source_video_id is not null and dedupe_key is not null;

create index if not exists idx_clips_render_queue
  on public.clips(render_status, status, score desc) where render_status = 'pending';

create or replace function public.clip_source_rights_propagate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.rights_confirmed is distinct from old.rights_confirmed then
    update public.clip_source_videos v
       set rights_confirmed = new.rights_confirmed,
           pipeline_stage = case
             when new.rights_confirmed and v.pipeline_stage = 'blocked' then 'discovered'
             when not new.rights_confirmed and v.pipeline_stage in ('discovered','error') then 'blocked'
             else v.pipeline_stage end,
           last_error = case
             when new.rights_confirmed and v.pipeline_stage = 'blocked' then null
             else v.last_error end,
           updated_at = now()
     where v.source_id = new.id
       and v.pipeline_stage not in ('done','downloading','transcribing','analyzing','rendering');
  end if;
  return new;
end; $$;

drop trigger if exists trg_clip_source_rights_propagate on public.clip_sources;
create trigger trg_clip_source_rights_propagate
  after update of rights_confirmed on public.clip_sources
  for each row execute function public.clip_source_rights_propagate();

create or replace function public.clip_source_video_inherit_rights()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_rights boolean;
begin
  select rights_confirmed into v_rights from public.clip_sources where id = new.source_id;
  new.rights_confirmed := coalesce(v_rights, false);
  if not new.rights_confirmed and new.pipeline_stage = 'discovered' then
    new.pipeline_stage := 'blocked';
  end if;
  return new;
end; $$;

drop trigger if exists trg_clip_source_video_inherit_rights on public.clip_source_videos;
create trigger trg_clip_source_video_inherit_rights
  before insert on public.clip_source_videos
  for each row execute function public.clip_source_video_inherit_rights();

update public.clip_source_videos v
   set rights_confirmed = s.rights_confirmed,
       pipeline_stage = case
         when s.rights_confirmed and v.media_status = 'processed' then 'done'
         when s.rights_confirmed then 'discovered'
         else 'blocked' end,
       updated_at = now()
  from public.clip_sources s
 where s.id = v.source_id and v.pipeline_stage = 'discovered';

create or replace function public.clip_claim_source_video(p_worker_id text, p_lease_secs integer default 900)
returns setof public.clip_source_videos language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.clip_source_videos v
     set pipeline_stage = 'downloading', stage_detail = 'obtendo midia',
         media_status = 'downloading', attempts = v.attempts + 1,
         locked_by = p_worker_id, locked_at = now(),
         lease_expires_at = now() + make_interval(secs => p_lease_secs),
         processing_started_at = coalesce(v.processing_started_at, now()),
         next_retry_at = null, last_error = null, updated_at = now()
   where v.id = (
     select c.id from public.clip_source_videos c
       join public.clip_sources s on s.id = c.source_id
       join public.clip_networks n on n.id = s.network_id
      where c.rights_confirmed = true and s.active = true
        and s.rights_confirmed = true and n.active = true
        and c.pipeline_stage in ('discovered','error') and c.attempts < 4
        and (c.next_retry_at is null or c.next_retry_at <= now())
      order by c.source_published_at desc nulls last, c.discovered_at desc
      for update skip locked limit 1
   )
  returning v.*;
end; $$;

create or replace function public.clip_touch_lease(p_video_id uuid, p_worker_id text, p_stage text, p_detail text default null, p_lease_secs integer default 900)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  update public.clip_source_videos
     set pipeline_stage = coalesce(p_stage, pipeline_stage),
         stage_detail = coalesce(p_detail, stage_detail),
         lease_expires_at = now() + make_interval(secs => p_lease_secs),
         updated_at = now()
   where id = p_video_id and locked_by = p_worker_id
  returning true into v_ok;
  return coalesce(v_ok, false);
end; $$;

create or replace function public.clip_recover_stuck_jobs()
returns integer language plpgsql security definer set search_path = public as $$
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

  update public.clips
     set render_status = 'pending', locked_by = null, lease_expires_at = null, updated_at = now()
   where render_status = 'rendering' and lease_expires_at is not null
     and lease_expires_at < now() and render_attempts < 4;

  return v_count;
end; $$;

create or replace function public.clip_retry_source_video(p_video_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select user_id into v_owner from public.clip_source_videos where id = p_video_id;
  if v_owner is null then return false; end if;
  if auth.uid() is not null and auth.uid() <> v_owner then
    raise exception 'clip_retry_source_video: video nao pertence a quem chamou' using errcode = 'insufficient_privilege';
  end if;
  update public.clip_source_videos
     set pipeline_stage = 'discovered', media_status = 'waiting_for_media',
         transcript_status = case when transcript is null then 'pending' else transcript_status end,
         attempts = 0, stage_detail = null, locked_by = null, locked_at = null,
         lease_expires_at = null, next_retry_at = null, last_error = null, updated_at = now()
   where id = p_video_id;
  return true;
end; $$;

revoke all on function public.clip_claim_source_video(text, integer) from public, anon, authenticated;
revoke all on function public.clip_touch_lease(uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.clip_recover_stuck_jobs() from public, anon, authenticated;
grant execute on function public.clip_claim_source_video(text, integer) to service_role;
grant execute on function public.clip_touch_lease(uuid, text, text, text, integer) to service_role;
grant execute on function public.clip_recover_stuck_jobs() to service_role;
grant execute on function public.clip_retry_source_video(uuid) to authenticated, service_role;

grant select, insert, update, delete on public.clip_source_videos to authenticated;
grant select, insert, update, delete on public.clips to authenticated;
grant all on public.clip_source_videos to service_role;
grant all on public.clips to service_role;