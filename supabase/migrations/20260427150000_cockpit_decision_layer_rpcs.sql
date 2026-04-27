-- Cockpit Decision Layer analytics — 5 RPC functions the founder
-- dashboard calls to surface aggregate stats on the decision loop.
-- Security: every function checks public.is_admin(auth.uid()) and
-- raises 'Forbidden' for non-admins. Standard cockpit gate.
--
-- Why RPCs and not edge functions: edge function deploys are blocked
-- (Supabase project owned by Lovable, no direct CLI/Dashboard access).
-- RPCs ship via SQL editor — same path the user already uses for
-- migrations. Plus: faster, no cold start, no CORS, no auth header
-- juggling. Frontend just calls supabase.rpc('cockpit_dl_...', {...}).

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Totals — top-level numbers for the dashboard hero
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.cockpit_dl_totals(days int default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden';
  end if;

  return (
    select jsonb_build_object(
      'window_days', days,
      'decisions_total', (
        select count(*)::int from decisions
        where created_at > now() - (days || ' days')::interval
      ),
      'decisions_acted', (
        select count(*)::int from decisions
        where created_at > now() - (days || ' days')::interval
          and status = 'acted'
      ),
      'decisions_pending', (
        select count(*)::int from decisions
        where created_at > now() - (days || ' days')::interval
          and status = 'pending'
      ),
      'decisions_by_source', (
        select coalesce(jsonb_object_agg(source, cnt), '{}'::jsonb)
        from (
          select coalesce(source, 'unknown') as source, count(*)::int as cnt
          from decisions
          where created_at > now() - (days || ' days')::interval
          group by source
        ) s
      ),
      'actions_executed', (
        select count(*)::int from action_log
        where executed_at > now() - (days || ' days')::interval
          and result = 'success'
      ),
      'outcomes_total', (
        select count(*)::int from action_outcomes
        where taken_at > now() - (days || ' days')::interval
      ),
      'outcomes_finalized', (
        select count(*)::int from action_outcomes
        where taken_at > now() - (days || ' days')::interval
          and improved is not null
      ),
      'outcomes_wins', (
        select count(*)::int from action_outcomes
        where taken_at > now() - (days || ' days')::interval
          and improved = true
      ),
      'outcomes_losses', (
        select count(*)::int from action_outcomes
        where taken_at > now() - (days || ' days')::interval
          and improved = false
      )
    )
  );
end;
$$;

revoke all on function public.cockpit_dl_totals(int) from public;
grant execute on function public.cockpit_dl_totals(int) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Hit rate by source — chat vs feed engine
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.cockpit_dl_hit_rate_by_source(days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden';
  end if;

  return (
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    from (
      select
        ao.source,
        count(*)::int as total,
        count(*) filter (where ao.improved = true)::int as wins,
        count(*) filter (where ao.improved = false)::int as losses,
        count(*) filter (where ao.improved is null)::int as still_measuring,
        round(
          100.0 * count(*) filter (where ao.improved = true) /
          nullif(count(*) filter (where ao.improved is not null), 0),
          1
        ) as hit_rate_pct
      from action_outcomes ao
      where ao.taken_at > now() - (days || ' days')::interval
      group by ao.source
      order by total desc
    ) t
  );
end;
$$;

revoke all on function public.cockpit_dl_hit_rate_by_source(int) from public;
grant execute on function public.cockpit_dl_hit_rate_by_source(int) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Hit rate by decision type + confidence
-- Validates whether the impact_confidence label means anything.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.cockpit_dl_hit_rate_by_type(days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden';
  end if;

  return (
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    from (
      select
        d.type as decision_type,
        coalesce(d.impact_confidence, 'unset') as confidence,
        count(*)::int as total,
        count(*) filter (where ao.improved = true)::int as wins,
        count(*) filter (where ao.improved = false)::int as losses,
        round(
          100.0 * count(*) filter (where ao.improved = true) /
          nullif(count(*) filter (where ao.improved is not null), 0),
          1
        ) as hit_rate_pct
      from decisions d
      join action_log al on al.decision_id = d.id and al.result = 'success'
      left join action_outcomes ao
        on ao.target_id = al.target_meta_id
        and ao.taken_at >= al.executed_at - interval '5 minutes'
        and ao.taken_at <= al.executed_at + interval '5 minutes'
      where d.created_at > now() - (days || ' days')::interval
      group by d.type, d.impact_confidence
      order by d.type, d.impact_confidence
    ) t
  );
end;
$$;

revoke all on function public.cockpit_dl_hit_rate_by_type(int) from public;
grant execute on function public.cockpit_dl_hit_rate_by_type(int) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Activity by user — DAU + actions per user
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.cockpit_dl_by_user(days int default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden';
  end if;

  return (
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    from (
      select
        u.email,
        count(distinct d.id)::int as decisions_received,
        count(distinct al.id) filter (where al.result = 'success')::int as actions_taken,
        count(distinct ao.id) filter (where ao.improved = true)::int as wins,
        count(distinct ao.id) filter (where ao.improved = false)::int as losses,
        max(d.created_at) as last_decision_at,
        max(al.executed_at) as last_action_at
      from decisions d
      join ad_accounts aa on aa.id = d.account_id
      join auth.users u on u.id = aa.user_id
      left join action_log al on al.decision_id = d.id
      left join action_outcomes ao
        on ao.target_id = al.target_meta_id
        and ao.taken_at >= al.executed_at - interval '5 minutes'
        and ao.taken_at <= al.executed_at + interval '5 minutes'
      where d.created_at > now() - (days || ' days')::interval
      group by u.email
      order by decisions_received desc
      limit 50
    ) t
  );
end;
$$;

revoke all on function public.cockpit_dl_by_user(int) from public;
grant execute on function public.cockpit_dl_by_user(int) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Recent activity — raw stream for inspection
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.cockpit_dl_recent(limit_rows int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden';
  end if;

  return (
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    from (
      select
        d.id as decision_id,
        d.type,
        d.headline,
        d.score,
        d.impact_confidence,
        d.invalidator,
        d.source,
        d.status as decision_status,
        d.created_at,
        u.email as user_email,
        al.action_type as executed_action,
        al.result as execution_result,
        al.executed_at,
        ao.improved,
        ao.measured_24h_at,
        ao.measured_72h_at
      from decisions d
      join ad_accounts aa on aa.id = d.account_id
      join auth.users u on u.id = aa.user_id
      left join action_log al on al.decision_id = d.id
      left join action_outcomes ao
        on ao.target_id = al.target_meta_id
        and ao.taken_at >= al.executed_at - interval '5 minutes'
        and ao.taken_at <= al.executed_at + interval '5 minutes'
      order by d.created_at desc
      limit limit_rows
    ) t
  );
end;
$$;

revoke all on function public.cockpit_dl_recent(int) from public;
grant execute on function public.cockpit_dl_recent(int) to authenticated;
