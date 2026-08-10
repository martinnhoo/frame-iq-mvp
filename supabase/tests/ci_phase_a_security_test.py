#!/usr/bin/env python3
"""Real-Postgres checks for explicit learned-pattern tenant/global scoping."""
from __future__ import annotations

import os
import shutil
import tempfile

import pgserver
import psycopg2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BOOTSTRAP = """
do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then
    create role authenticated nologin;
  end if;
end $$;
create schema auth;
create table auth.users(id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $q$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$q$;
create table public.learned_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  pattern_key text not null,
  variables jsonb not null default '{}'::jsonb,
  confidence numeric default 0,
  is_winner boolean default false
);
alter table public.learned_patterns enable row level security;
create policy tenant_rows on public.learned_patterns for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant usage on schema public to authenticated;
grant select on public.learned_patterns to authenticated;
"""


def main() -> int:
    data_dir = tempfile.mkdtemp(prefix="ci-phase-a-")
    try:
        server = pgserver.get_server(data_dir)
        connection = psycopg2.connect(server.get_uri())
        connection.autocommit = True
        cursor = connection.cursor()
        cursor.execute(BOOTSTRAP)
        owner = "11111111-1111-4111-8111-111111111111"
        stranger = "22222222-2222-4222-8222-222222222222"
        cursor.execute("insert into auth.users values(%s),(%s)", (owner, stranger))
        cursor.execute(
            "insert into learned_patterns(user_id,pattern_key) values(%s,'tenant'),(null,'global')",
            (owner,),
        )
        path = os.path.join(ROOT, "migrations", "20260810100000_ci_tenant_scope_containment.sql")
        cursor.execute(open(path, encoding="utf-8").read())

        cursor.execute("select pattern_key,scope from learned_patterns order by pattern_key")
        assert cursor.fetchall() == [("global", "global_benchmark"), ("tenant", "tenant")]

        cursor.execute("set role authenticated")
        cursor.execute("select set_config('request.jwt.claim.sub',%s,false)", (stranger,))
        cursor.execute("select pattern_key from learned_patterns order by pattern_key")
        assert cursor.fetchall() == [("global",)]
        cursor.execute("reset role")

        try:
            cursor.execute(
                "insert into learned_patterns(user_id,pattern_key,scope) values(null,'bad','tenant')"
            )
        except psycopg2.errors.CheckViolation:
            pass
        else:
            raise AssertionError("tenant scope accepted user_id IS NULL")

        print("PASS  explicit tenant/global scope and authenticated RLS")
        return 0
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
