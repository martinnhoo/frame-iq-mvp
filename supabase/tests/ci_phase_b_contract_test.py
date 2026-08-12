#!/usr/bin/env python3
"""Real-Postgres behavioral checks for the Phase B execution contract."""
from __future__ import annotations

import os
import shutil
import tempfile

import pgserver
import psycopg2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIGRATIONS = [
    "20260806100000_ci_core.sql",
    "20260806100100_ci_assets_storage.sql",
    "20260806100200_ci_jobs.sql",
    "20260806100300_ci_analysis.sql",
    "20260806100400_ci_taxonomy.sql",
    "20260806100500_ci_results_and_scale_signal.sql",
    "20260806100600_ci_hardening.sql",
    "20260806100700_ci_adtax_dedup.sql",
    "20260807140000_ci_quality.sql",
    "20260810110000_ci_execution_contract.sql",
    "20260810120000_ci_import_pages.sql",
]

BOOTSTRAP = """
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create schema storage;
create schema extensions;
create table auth.users(id uuid primary key default public.gen_random_uuid(), email text);
create table storage.buckets(id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create or replace function auth.uid() returns uuid language sql stable as $q$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$q$;
create or replace function extensions.digest(value bytea, algorithm text) returns bytea
language sql immutable as $q$
  select decode(md5(value) || md5(value || convert_to(algorithm, 'UTF8')), 'hex')
$q$;
"""

UUID_SHIM = """
create or replace function public.gen_random_uuid() returns uuid language sql volatile as $q$
  select md5(random()::text || clock_timestamp()::text)::uuid
$q$;
"""


def migration_sql(name: str) -> str:
    sql = open(os.path.join(ROOT, "migrations", name), encoding="utf-8").read()
    return sql.replace("create extension if not exists pgcrypto with schema extensions;", "")


def main() -> int:
    data_dir = tempfile.mkdtemp(prefix="ci-phase-b-")
    try:
        server = pgserver.get_server(data_dir)
        connection = psycopg2.connect(server.get_uri())
        connection.autocommit = True
        cursor = connection.cursor()

        def query(sql: str, params=None):
            cursor.execute(sql, params)
            return cursor.fetchall() if cursor.description else None

        cursor.execute(UUID_SHIM)
        cursor.execute(BOOTSTRAP)
        for name in MIGRATIONS:
            cursor.execute(migration_sql(name))

        owner = query("insert into auth.users(email) values('owner@test') returning id")[0][0]
        stranger = query("insert into auth.users(email) values('stranger@test') returning id")[0][0]
        brand = query(
            "insert into ci_brands(user_id,slug,name) values(%s,'owner','Owner') returning id", (owner,)
        )[0][0]
        other_brand = query(
            "insert into ci_brands(user_id,slug,name) values(%s,'other','Other') returning id", (stranger,)
        )[0][0]
        page = query(
            "insert into ci_brand_pages(brand_id,user_id,page_id,page_name,is_selected) values(%s,%s,'p1','P1',true) returning id",
            (brand, owner),
        )[0][0]
        ad1 = query(
            """insert into ci_ads(brand_id,user_id,ad_archive_id,body_text,headline,languages,raw_payload)
               values(%s,%s,'a1','same body','headline one',array['en'],'{}') returning id,context_hash""",
            (brand, owner),
        )[0]
        ad2 = query(
            """insert into ci_ads(brand_id,user_id,ad_archive_id,body_text,headline,languages,raw_payload)
               values(%s,%s,'a2','same body','headline two',array['en'],'{}') returning id,context_hash""",
            (brand, owner),
        )[0]
        assert ad1[1] != ad2[1] and len(ad1[1]) == 64
        canonical_ad1 = (
            "ad-context/v1|body_text=" + "same body".encode().hex()
            + "|headline=" + "headline one".encode().hex()
            + "|description=~|cta=~|landing_page=~|display_format=~|languages=" + "en".encode().hex()
        )
        sql_canonical_ad1 = query(
            "select ci_canonical_ad_context(%s,%s,%s,%s,%s,%s,%s)",
            ("same body", "headline one", None, None, None, None, ["en"]),
        )[0][0]
        assert sql_canonical_ad1 == canonical_ad1

        asset = query(
            """insert into ci_assets(brand_id,user_id,sha256,media_type,storage_key)
               values(%s,%s,%s,'video','brands/x/originals/a.mp4') returning id""",
            (brand, owner, "a" * 64),
        )[0][0]
        static_asset = query(
            """insert into ci_assets(brand_id,user_id,sha256,media_type,storage_key)
               values(%s,%s,%s,'image','brands/x/originals/static.jpg') returning id""",
            (brand, owner, "c" * 64),
        )[0][0]
        static_segments = query(
            "select count(*),min(segment_kind) from ci_scenes where asset_id=%s", (static_asset,)
        )[0]
        assert static_segments == (1, "static")
        link1 = query(
            "insert into ci_ad_assets(ad_id,asset_id,user_id) values(%s,%s,%s) returning id,context_hash_snapshot",
            (ad1[0], asset, owner),
        )[0]
        query("insert into ci_ad_assets(ad_id,asset_id,user_id) values(%s,%s,%s)", (ad2[0], asset, owner))
        assert link1[1] == ad1[1]

        updated_context_hash = query(
            "update ci_ads set headline='headline one revised' where id=%s returning context_hash", (ad1[0],)
        )[0][0]
        link_after_context_change = query(
            "select context_hash_snapshot,context_analysis_status,current_context_result_id from ci_ad_assets where id=%s",
            (link1[0],),
        )[0]
        assert updated_context_hash != link1[1]
        assert link_after_context_change == (link1[1], "stale", None), link_after_context_change

        foreign_asset = query(
            """insert into ci_assets(brand_id,user_id,sha256,media_type,storage_key)
               values(%s,%s,%s,'video','brands/y/originals/b.mp4') returning id""",
            (other_brand, stranger, "b" * 64),
        )[0][0]
        try:
            query("insert into ci_ad_assets(ad_id,asset_id,user_id) values(%s,%s,%s)", (ad1[0], foreign_asset, owner))
        except psycopg2.Error:
            pass
        else:
            raise AssertionError("composite tenant mismatch was accepted")

        try:
            query(
                """insert into ci_model_runs(brand_id,user_id,asset_id,purpose,provider,model,prompt_version,
                     scope,analysis_contract_version,input_schema_version,output_schema_version)
                   values(%s,%s,%s,'asset_semantic','mock','mock','asset-semantic/v1',
                     'asset_observation','asset-observation/v1','asset-observation-input/v1','asset-observation-output/v1')""",
                (brand, owner, foreign_asset),
            )
        except psycopg2.Error:
            pass
        else:
            raise AssertionError("cross-tenant model run was accepted")

        context_result = query(
            """with run as (
                 insert into ci_model_runs(brand_id,user_id,ad_id,ad_asset_id,asset_id,context_hash,
                   purpose,provider,model,prompt_version,scope,analysis_contract_version,
                   input_schema_version,output_schema_version)
                 values(%s,%s,%s,%s,%s,%s,'context_semantic','mock','mock','context-semantic/v1',
                   'context_analysis','context-analysis/v1','context-analysis-input/v1','context-analysis-output/v1')
                 returning id
               )
               insert into ci_analysis_results(ad_id,ad_asset_id,asset_id,brand_id,user_id,model_run_id,
                 kind,scope,context_hash,analysis_contract_version,raw_output,normalized_output)
               select %s,%s,%s,%s,%s,id,'context_semantic','context_analysis',%s,
                 'context-analysis/v1','{}','{}' from run returning id""",
            (
                brand, owner, ad1[0], link1[0], asset, updated_context_hash,
                ad1[0], link1[0], asset, brand, owner, updated_context_hash,
            ),
        )[0][0]
        try:
            query(
                "update ci_ad_assets set current_context_result_id=%s where id=%s",
                (context_result, link1[0]),
            )
        except psycopg2.Error:
            pass
        else:
            raise AssertionError("context result was attached to a stale context snapshot")
        query(
            """update ci_ad_assets set context_hash_snapshot=%s,current_context_result_id=%s,
                 context_analysis_status='completed',analyzed_context_at=now() where id=%s""",
            (updated_context_hash, context_result, link1[0]),
        )
        assert query(
            "select context_hash_snapshot,current_context_result_id,context_analysis_status from ci_ad_assets where id=%s",
            (link1[0],),
        )[0] == (updated_context_hash, context_result, "completed")

        first_result = query(
            """with run as (
                 insert into ci_model_runs(brand_id,user_id,asset_id,purpose,provider,model,prompt_version,
                   scope,analysis_contract_version,input_schema_version,output_schema_version)
                 values(%s,%s,%s,'asset_semantic','mock','mock','asset-semantic/v1',
                   'asset_observation','asset-observation/v1','asset-observation-input/v1','asset-observation-output/v1')
                 returning id
               )
               insert into ci_analysis_results(asset_id,brand_id,user_id,model_run_id,kind,scope,
                 analysis_contract_version,raw_output,normalized_output)
               select %s,%s,%s,id,'asset_semantic','asset_observation','asset-observation/v1','{}','{}' from run
               returning id""",
            (brand, owner, asset, asset, brand, owner),
        )[0][0]
        second_result = query(
            """with run as (
                 insert into ci_model_runs(brand_id,user_id,asset_id,purpose,provider,model,prompt_version,
                   scope,analysis_contract_version,input_schema_version,output_schema_version)
                 values(%s,%s,%s,'asset_semantic','mock','mock','asset-semantic/v1',
                   'asset_observation','asset-observation/v1','asset-observation-input/v1','asset-observation-output/v1')
                 returning id
               )
               insert into ci_analysis_results(asset_id,brand_id,user_id,model_run_id,kind,scope,
                 analysis_contract_version,raw_output,normalized_output)
               select %s,%s,%s,id,'asset_semantic','asset_observation','asset-observation/v1','{}','{}' from run
               returning id""",
            (brand, owner, asset, asset, brand, owner),
        )[0][0]
        state = query(
            "select id,is_current,superseded_at from ci_analysis_results where id in (%s,%s) order by created_at,id",
            (first_result, second_result),
        )
        assert sum(1 for row in state if row[1]) == 1
        assert next(row for row in state if row[0] == first_result)[2] is not None

        term = query(
            "insert into ci_taxonomy_terms(brand_id,user_id,kind,slug,label) values(%s,%s,'hook','hook','Hook') returning id",
            (brand, owner),
        )[0][0]
        assertion = query(
            """insert into ci_ad_taxonomy(ad_id,ad_asset_id,asset_id,analysis_result_id,term_id,brand_id,user_id,
                 confidence,source,claim_scope,provenance_class,analysis_contract_version)
               values(%s,%s,%s,%s,%s,%s,%s,.8,'local','asset','MODEL_CLASSIFIED','asset-observation/v1') returning id""",
            (ad1[0], link1[0], asset, second_result, term, brand, owner),
        )[0][0]
        cursor.execute("select set_config('request.jwt.claim.sub',%s,false)", (str(owner),))
        stored_review = query(
            """insert into ci_quality_reviews(ad_id,asset_id,brand_id,user_id,campo,veredito,target_assertion_id,override_action)
               values(%s,%s,%s,%s,'hook','errado',%s,'reject')
               returning ad_id,ad_asset_id,asset_id,analysis_result_id,brand_id,user_id,reviewer_user_id""",
            (ad2[0], foreign_asset, other_brand, stranger, assertion),
        )[0]
        assert stored_review == (ad1[0], link1[0], asset, second_result, brand, owner, owner)
        cursor.execute("select set_config('request.jwt.claim.sub','',false)")
        assert query("select count(*) from ci_effective_ad_taxonomy where id=%s", (assertion,))[0][0] == 0

        third_result = query(
            """with run as (
                 insert into ci_model_runs(brand_id,user_id,asset_id,purpose,provider,model,prompt_version,
                   scope,analysis_contract_version,input_schema_version,output_schema_version)
                 values(%s,%s,%s,'asset_semantic','mock','mock','asset-semantic/v1',
                   'asset_observation','asset-observation/v1','asset-observation-input/v1','asset-observation-output/v1')
                 returning id
               )
               insert into ci_analysis_results(asset_id,brand_id,user_id,model_run_id,kind,scope,
                 analysis_contract_version,raw_output,normalized_output)
               select %s,%s,%s,id,'asset_semantic','asset_observation','asset-observation/v1','{}','{}' from run
               returning id""",
            (brand, owner, asset, asset, brand, owner),
        )[0][0]
        replacement_assertion = query(
            """insert into ci_ad_taxonomy(ad_id,ad_asset_id,asset_id,analysis_result_id,term_id,brand_id,user_id,
                 confidence,source,claim_scope,provenance_class,analysis_contract_version)
               values(%s,%s,%s,%s,%s,%s,%s,.9,'local','asset','MODEL_CLASSIFIED','asset-observation/v1') returning id""",
            (ad1[0], link1[0], asset, third_result, term, brand, owner),
        )[0][0]
        old_assertion_state = query(
            "select is_current,superseded_at from ci_ad_taxonomy where id=%s", (assertion,)
        )[0]
        assert old_assertion_state[0] is False and old_assertion_state[1] is not None
        assert query("select count(*) from ci_effective_ad_taxonomy where id=%s", (replacement_assertion,))[0][0] == 1

        classification = query(
            "select primary_classification,contaminated from ci_legacy_context_classification where asset_id=%s",
            (asset,),
        )[0]
        assert classification[0] == "multiple_distinct_contexts"
        dry_run = dict(query("select classification,asset_count from ci_legacy_context_dry_run(%s)", (brand,)))
        assert dry_run["multiple_distinct_contexts"] == 1
        assert dry_run["missing_observations"] == 1
        assert dry_run["static_unanalysed"] == 1

        run = query(
            """insert into ci_import_runs(brand_id,user_id,brand_page_id,endpoint,request_fingerprint,cursor_context_hash)
               values(%s,%s,%s,'brand_ads',%s,%s) returning id""",
            (brand, owner, page, "1" * 64, "2" * 64),
        )[0][0]
        query(
            """insert into ci_import_pages(import_run_id,brand_id,user_id,page_index,request_fingerprint,
                 cursor_context_hash,response_payload,credits_spent)
               values(%s,%s,%s,0,%s,%s,'{"ads":[{"ad_archive_id":"local"}]}',1)""",
            (run, brand, owner, "1" * 64, "2" * 64),
        )
        page_state = query(
            "select ci_import_pages.ads_returned,length(response_hash),pages_persisted from ci_import_pages join ci_import_runs on ci_import_runs.id=import_run_id where import_run_id=%s",
            (run,),
        )[0]
        assert page_state == (1, 64, 1)

        query("grant usage on schema public to authenticated")
        query("grant select on all tables in schema public to authenticated")
        cursor.execute("set role authenticated")
        cursor.execute("select set_config('request.jwt.claim.sub',%s,false)", (str(stranger),))
        assert query("select count(*) from ci_current_ad_taxonomy")[0][0] == 0
        assert query("select count(*) from ci_import_pages")[0][0] == 0
        cursor.execute("reset role")

        print("PASS  Phase B execution, history, tenant, views, import-page and RLS contract")
        return 0
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
