-- Phase A: make pattern provenance explicit. A service-role query may no longer
-- turn into a global read merely because it forgot the user predicate.

alter table public.learned_patterns
  add column if not exists scope text;

update public.learned_patterns
set scope = case when user_id is null then 'global_benchmark' else 'tenant' end
where scope is null;

alter table public.learned_patterns
  alter column scope set default 'tenant',
  alter column scope set not null;

alter table public.learned_patterns
  drop constraint if exists learned_patterns_scope_check;
alter table public.learned_patterns
  add constraint learned_patterns_scope_check
  check (
    (scope = 'tenant' and user_id is not null)
    or (scope = 'global_benchmark' and user_id is null)
  );

drop policy if exists "Users read global patterns" on public.learned_patterns;
create policy "Users read global benchmark patterns"
  on public.learned_patterns for select
  to authenticated
  using (scope = 'global_benchmark' and user_id is null);

create index if not exists idx_learned_patterns_explicit_scope
  on public.learned_patterns(scope, user_id, is_winner, confidence desc);

comment on column public.learned_patterns.scope is
  'Explicit provenance boundary: tenant rows require user_id; global_benchmark rows require user_id IS NULL.';
