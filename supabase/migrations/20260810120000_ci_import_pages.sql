-- Phase B import durability: every paid response is durable before transform.

alter table public.ci_import_runs
  add column if not exists request_fingerprint text,
  add column if not exists idempotency_key text,
  add column if not exists cursor_in text,
  add column if not exists cursor_context_hash text,
  add column if not exists resume_of_run_id uuid references public.ci_import_runs(id) on delete set null,
  add column if not exists replay_of_run_id uuid references public.ci_import_runs(id) on delete set null,
  add column if not exists transform_version text not null default 'spresh-normalize/v1',
  add column if not exists pages_persisted int not null default 0;

create unique index if not exists uq_ci_import_runs_idempotency
  on public.ci_import_runs(user_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_ci_import_runs_fingerprint
  on public.ci_import_runs(user_id, request_fingerprint, created_at desc);

create table if not exists public.ci_import_pages (
  id                    uuid primary key default gen_random_uuid(),
  import_run_id         uuid not null references public.ci_import_runs(id) on delete cascade,
  brand_id              uuid not null references public.ci_brands(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  page_index            int not null check (page_index >= 0),
  request_fingerprint   text not null,
  cursor_in             text,
  cursor_out            text,
  cursor_context_hash   text not null,
  response_payload      jsonb not null,
  response_hash         text not null,
  ads_returned          int not null default 0 check (ads_returned >= 0),
  credits_spent         int not null default 0 check (credits_spent >= 0),
  has_more              boolean not null default false,
  transform_version     text not null default 'spresh-normalize/v1',
  transform_status      text not null default 'pending'
                        check (transform_status in ('pending','running','completed','failed')),
  transform_error       text,
  transformed_at        timestamptz,
  provider_request_id   text,
  fetched_at            timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  check (length(request_fingerprint) = 64),
  check (length(cursor_context_hash) = 64),
  check (length(response_hash) = 64),
  unique (import_run_id, page_index),
  unique (import_run_id, response_hash)
);

alter table public.ci_import_runs
  add constraint uq_ci_import_runs_id_brand_user unique (id, brand_id, user_id);
alter table public.ci_import_pages
  add constraint fk_ci_import_pages_run_tenant
  foreign key (import_run_id, brand_id, user_id)
  references public.ci_import_runs(id, brand_id, user_id) not valid;

create index if not exists idx_ci_import_pages_replay
  on public.ci_import_pages(import_run_id, page_index, transform_status);
create index if not exists idx_ci_import_pages_tenant
  on public.ci_import_pages(user_id, brand_id, fetched_at desc);

alter table public.ci_import_pages enable row level security;
drop policy if exists ci_import_pages_read_own on public.ci_import_pages;
create policy ci_import_pages_read_own on public.ci_import_pages
  for select to authenticated using (user_id = auth.uid());

create or replace function public.ci_prepare_import_page()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare run_row record;
begin
  select brand_id, user_id, request_fingerprint, cursor_context_hash
    into strict run_row
  from public.ci_import_runs where id = new.import_run_id;
  if new.brand_id <> run_row.brand_id or new.user_id <> run_row.user_id then
    raise exception 'ci_import_pages tenant/brand mismatch' using errcode = '23514';
  end if;
  if new.request_fingerprint <> run_row.request_fingerprint
     or new.cursor_context_hash <> run_row.cursor_context_hash then
    raise exception 'ci_import_pages request/cursor context mismatch' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (
    new.import_run_id is distinct from old.import_run_id
    or new.brand_id is distinct from old.brand_id
    or new.user_id is distinct from old.user_id
    or new.page_index is distinct from old.page_index
    or new.request_fingerprint is distinct from old.request_fingerprint
    or new.cursor_in is distinct from old.cursor_in
    or new.cursor_out is distinct from old.cursor_out
    or new.cursor_context_hash is distinct from old.cursor_context_hash
    or new.response_payload is distinct from old.response_payload
    or new.response_hash is distinct from old.response_hash
    or new.credits_spent is distinct from old.credits_spent
    or new.has_more is distinct from old.has_more
    or new.fetched_at is distinct from old.fetched_at
  ) then
    raise exception 'ci_import_pages paid response identity is immutable' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    new.response_hash := encode(
      digest(convert_to(new.response_payload::text, 'UTF8'), 'sha256'), 'hex'
    );
    new.ads_returned := case
      when jsonb_typeof(new.response_payload -> 'ads') = 'array'
        then jsonb_array_length(new.response_payload -> 'ads')
      else 0
    end;
  end if;
  return new;
end
$$;

drop trigger if exists trg_ci_import_pages_prepare on public.ci_import_pages;
create trigger trg_ci_import_pages_prepare
before insert or update on public.ci_import_pages
for each row execute function public.ci_prepare_import_page();

create or replace function public.ci_import_pages_touch_run()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.ci_import_runs
  set pages_persisted = (
        select count(*) from public.ci_import_pages where import_run_id = new.import_run_id
      ),
      next_cursor = new.cursor_out,
      updated_at = now()
  where id = new.import_run_id;
  return new;
end
$$;

drop trigger if exists trg_ci_import_pages_touch_run on public.ci_import_pages;
create trigger trg_ci_import_pages_touch_run
after insert on public.ci_import_pages
for each row execute function public.ci_import_pages_touch_run();

comment on table public.ci_import_pages is
  'Immutable paid provider page ledger. Insert happens before normalization so replay never calls the provider.';
comment on column public.ci_import_runs.cursor_context_hash is
  'Binds a resume cursor to page, brand, filters, cap, and import contract; prevents cross-request cursor reuse.';
