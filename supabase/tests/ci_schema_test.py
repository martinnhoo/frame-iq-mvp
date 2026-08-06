#!/usr/bin/env python3
"""
Teste do schema Creative Intelligence contra um Postgres de verdade.

Por que Postgres real e não mock: as garantias que importam aqui — SKIP LOCKED
no claim da fila, índice único parcial, RLS, backoff — são comportamento do
banco. Um mock testaria o mock.

    pip install pgserver psycopg2-binary
    python supabase/tests/ci_schema_test.py

Sobe um Postgres efêmero em /tmp, stuba o que o Supabase fornece (roles anon /
authenticated / service_role, schema auth com auth.uid(), storage.buckets),
aplica as migrations ci_* em ordem, roda duas vezes para provar idempotência, e
então exercita o comportamento.

Sai com código 1 se qualquer verificação falhar.
"""
from __future__ import annotations

import glob
import os
import shutil
import sys
import tempfile

import pgserver
import psycopg2

MIGRATIONS_GLOB = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "migrations", "2026080610*.sql",
)

# O Supabase já provê isto. Em Postgres cru, precisamos criar para as migrations
# encontrarem auth.users, storage.buckets e os roles referenciados nas policies.
BOOTSTRAP = """
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon')          then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role')  then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default public.gen_random_uuid(),
  email text
);
create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create or replace function auth.uid() returns uuid language sql stable as $q$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$q$;
"""

# pgserver não traz pgcrypto compilado, e o Supabase já tem gen_random_uuid.
# md5() devolve 32 hex, que é exatamente o formato aceito no cast para uuid.
UUID_SHIM = """
create or replace function public.gen_random_uuid() returns uuid
language sql volatile as $q$
  select md5(random()::text || clock_timestamp()::text)::uuid
$q$;
"""


class Checker:
    def __init__(self) -> None:
        self.failures: list[str] = []

    def __call__(self, name: str, cond: bool, extra: str = "") -> None:
        print(("PASS  " if cond else "FAIL  ") + name + (f"  [{extra}]" if extra else ""))
        if not cond:
            self.failures.append(name)


def main() -> int:
    data_dir = tempfile.mkdtemp(prefix="ci-schema-pg-")
    try:
        server = pgserver.get_server(data_dir)
        conn = psycopg2.connect(server.get_uri())
        conn.autocommit = True
        cur = conn.cursor()

        def q(sql: str, params=None):
            cur.execute(sql, params)
            return cur.fetchall() if cur.description else None

        cur.execute(UUID_SHIM)
        cur.execute(BOOTSTRAP)

        files = sorted(glob.glob(MIGRATIONS_GLOB))
        if not files:
            print(f"nenhuma migration encontrada em {MIGRATIONS_GLOB}")
            return 1

        for path in files:
            cur.execute(open(path, encoding="utf-8").read())
            print("OK    ", os.path.basename(path))

        # Rodar de novo: `create ... if not exists` + `drop policy if exists`
        # devem tornar toda a sequência reaplicável. Se o Lovable reaplicar uma
        # migration, isso não pode explodir.
        for path in files:
            cur.execute(open(path, encoding="utf-8").read())
        print("RERUN OK — migrations idempotentes\n")

        check = Checker()

        uid = q("insert into auth.users(email) values('owner@test') returning id")[0][0]
        bid = q(
            "insert into public.ci_brands(user_id,slug,name) values(%s,'shapermint','Shapermint') returning id",
            (uid,),
        )[0][0]
        q(
            """insert into public.ci_brand_pages(brand_id,user_id,page_id,page_name,verification,likes,is_selected)
               values(%s,%s,'606426623024865','Shapermint','BLUE_VERIFIED',582831,true)""",
            (bid, uid),
        )

        # Duas páginas "oficiais" na mesma marca seria ambiguidade silenciosa:
        # o import não saberia de onde puxar os anúncios.
        try:
            q(
                """insert into public.ci_brand_pages(brand_id,user_id,page_id,page_name,is_selected)
                   values(%s,%s,'999','Fake',true)""",
                (bid, uid),
            )
            ok = False
        except Exception:
            conn.rollback()
            ok = True
        check("uma única página oficial por marca", ok)

        ads = []
        for i in range(3):
            ads.append(
                q(
                    """insert into public.ci_ads(brand_id,user_id,ad_archive_id,page_id,page_name,body_text,
                         display_format,media_type,is_active,started_on,running_days,raw_payload)
                       values(%s,%s,%s,'606426623024865','Shapermint',%s,'VIDEO','video',true,
                              now()-make_interval(days=>%s),%s,'{}'::jsonb) returning id""",
                    (bid, uid, f"arch_{i}", f"hook {i}", 60 - i * 10, 60 - i * 10),
                )[0][0]
            )

        # Reimportar a mesma marca não pode duplicar — nem gastar crédito de novo.
        try:
            q(
                "insert into public.ci_ads(brand_id,user_id,ad_archive_id,raw_payload) values(%s,%s,'arch_0','{}'::jsonb)",
                (bid, uid),
            )
            ok = False
        except Exception:
            conn.rollback()
            ok = True
        check("import idempotente (brand_id, ad_archive_id)", ok)

        sha = "a" * 64
        asset = q(
            """insert into public.ci_assets(brand_id,user_id,sha256,media_type,storage_key,file_size_bytes)
               values(%s,%s,%s,'video',%s,8000000) returning id""",
            (bid, uid, sha, f"brands/{bid}/originals/{sha}.mp4"),
        )[0][0]

        try:
            q(
                "insert into public.ci_assets(brand_id,user_id,sha256,media_type,storage_key) values(%s,%s,%s,'video','x')",
                (bid, uid, sha),
            )
            ok = False
        except Exception:
            conn.rollback()
            ok = True
        check("deduplicação por SHA-256", ok)

        # O mesmo vídeo servindo dois anúncios é o caso comum numa marca real.
        for ad in ads[:2]:
            q(
                "insert into public.ci_ad_assets(ad_id,asset_id,user_id,was_deduplicated) values(%s,%s,%s,%s)",
                (ad, asset, uid, ad != ads[0]),
            )
        r = q(
            "select unique_assets, ad_asset_links, duplicates_avoided, unique_bytes, naive_bytes from public.ci_dedup_stats where brand_id=%s",
            (bid,),
        )[0]
        check(
            "view de dedup conta duplicata evitada",
            r[0] == 1 and r[1] == 2 and r[2] == 1,
            f"assets={r[0]} links={r[1]} evitadas={r[2]} {r[3]}B vs {r[4]}B ingênuo",
        )

        q(
            """insert into public.ci_storage_objects(brand_id,user_id,asset_id,object_key,category,size_bytes)
               values(%s,%s,%s,'k1','originals',8000000),(%s,%s,%s,'k2','keyframes',120000)""",
            (bid, uid, asset, bid, uid, asset),
        )
        usage = {row[2]: row[4] for row in q("select * from public.ci_storage_usage where brand_id=%s", (bid,))}
        check(
            "storage usage separado por categoria",
            usage.get("originals") == 8000000 and usage.get("keyframes") == 120000,
            str(usage),
        )

        # ── Fila ────────────────────────────────────────────────────────────
        ms = q(
            "insert into public.ci_ad_media_sources(ad_id,user_id,media_url,kind) values(%s,%s,'https://cdn/x.mp4','video') returning id",
            (ads[0], uid),
        )[0][0]
        job = q(
            "insert into public.ci_download_jobs(brand_id,user_id,media_source_id,ad_id) values(%s,%s,%s,%s) returning id",
            (bid, uid, ms, ads[0]),
        )[0][0]

        first = q("select * from public.ci_claim_job('download','worker-A',900)")
        second = q("select * from public.ci_claim_job('download','worker-A',900)")
        check("claim pega o job da fila", len(first) == 1)
        check("segundo claim não repega job em execução", len(second) == 0)

        state = q("select status,attempts,locked_by from public.ci_download_jobs where id=%s", (job,))[0]
        check("job vira running com lease e contador", state == ("running", 1, "worker-A"), str(state))

        # Worker morto: o lease vence e o job precisa voltar sozinho.
        q("update public.ci_download_jobs set lease_expires_at=now()-interval '1 min' where id=%s", (job,))
        reaped = dict(q("select * from public.ci_reap_stale_jobs()"))
        state = q(
            "select status,error_code,next_retry_at>now() from public.ci_download_jobs where id=%s", (job,)
        )[0]
        check(
            "reaper devolve job órfão à fila com backoff",
            reaped["download"] == 1 and state == ("retrying", "lease_expired", True),
            str(state),
        )
        check(
            "backoff respeitado — não repega antes da hora",
            len(q("select * from public.ci_claim_job('download','worker-B',900)")) == 0,
        )

        # ── Observed Scale Signal ───────────────────────────────────────────
        strong_id = q(
            """insert into public.ci_concepts(brand_id,user_id,name,ad_count,unique_asset_count,variant_count,
                 person_count,format_count,market_count,longevity_days,last_seen_at)
               values(%s,%s,'Leggings que não enrolam',12,6,8,3,2,2,95,now()) returning id""",
            (bid, uid),
        )[0][0]
        thin_id = q(
            """insert into public.ci_concepts(brand_id,user_id,name,ad_count,longevity_days,last_seen_at)
               values(%s,%s,'Conceito magro',1,3,now()) returning id""",
            (bid, uid),
        )[0][0]

        computed = q("select public.ci_compute_scale_signal(%s)", (bid,))[0][0]
        strong = q("select scale_signal,scale_band from public.ci_concepts where id=%s", (strong_id,))[0]
        thin = q("select scale_signal,scale_band from public.ci_concepts where id=%s", (thin_id,))[0]
        comps = q(
            "select contributions from public.ci_concept_scale_components where concept_id=%s", (strong_id,)
        )[0][0]

        check("scale signal calculado para todos os conceitos", computed == 2, f"n={computed}")
        check(
            "conceito com massa recebe banda acima de low",
            strong[1] in ("medium", "high", "very_high"),
            f"{strong[0]} → {strong[1]}",
        )
        # O ponto do teste: um conceito com 1 anúncio não é "baixo desempenho",
        # é ausência de evidência. Chamar de 'low' seria afirmar mais do que se sabe.
        check(
            "conceito magro fica insufficient_evidence, não 'low'",
            thin[1] == "insufficient_evidence",
            f"{thin[0]} → {thin[1]}",
        )
        total = sum(float(v) for v in comps.values())
        check(
            "componentes somam o sinal exibido (fórmula auditável)",
            len(comps) == 9 and abs(total - float(strong[0])) < 0.05,
            f"soma={round(total, 2)} sinal={strong[0]}",
        )

        # ── RLS ─────────────────────────────────────────────────────────────
        q("grant usage on schema public to authenticated")
        q("grant select on all tables in schema public to authenticated")
        stranger = q("insert into auth.users(email) values('stranger@test') returning id")[0][0]

        cur.execute("set role authenticated")
        cur.execute("select set_config('request.jwt.claim.sub',%s,false)", (str(stranger),))
        seen_by_stranger = q("select count(*) from public.ci_ads")[0][0]
        cur.execute("select set_config('request.jwt.claim.sub',%s,false)", (str(uid),))
        seen_by_owner = q("select count(*) from public.ci_ads")[0][0]
        cur.execute("reset role")
        check(
            "RLS esconde os dados de outro usuário",
            seen_by_stranger == 0 and seen_by_owner == 3,
            f"estranho vê {seen_by_stranger}, dono vê {seen_by_owner}",
        )

        # ══ REGRESSÕES DE SEGURANÇA — revisão independente 01 ═══════════════
        #
        # ci_compute_scale_signal nasceu SECURITY DEFINER, com grant para
        # `authenticated`, e sem checar dono do brand_id. Do navegador, com a
        # anon key, dava para reprocessar e sobrescrever o Scale Signal da
        # marca de outra pessoa. Mesma classe fechada em 20260804090000.
        outra_brand = q(
            "insert into public.ci_brands(user_id,slug,name) values(%s,'marca-alheia','Alheia') returning id",
            (stranger,),
        )[0][0]
        q(
            """insert into public.ci_concepts(brand_id,user_id,name,ad_count,longevity_days,last_seen_at)
               values(%s,%s,'Conceito do estranho',9,50,now())""",
            (outra_brand, stranger),
        )

        cur.execute("set role authenticated")
        cur.execute("select set_config('request.jwt.claim.sub',%s,false)", (str(uid),))
        try:
            q("select public.ci_compute_scale_signal(%s)", (outra_brand,))
            invadiu = True
        except Exception:
            conn.rollback()
            invadiu = False
        cur.execute("reset role")
        check("ci_compute_scale_signal recusa marca de outro usuário", not invadiu)

        # E continua funcionando para o dono legítimo.
        cur.execute("set role authenticated")
        cur.execute("select set_config('request.jwt.claim.sub',%s,false)", (str(stranger),))
        try:
            n_dono = q("select public.ci_compute_scale_signal(%s)", (outra_brand,))[0][0]
            ok_dono = n_dono == 1
        except Exception as exc:
            conn.rollback()
            ok_dono, n_dono = False, str(exc)[:60]
        cur.execute("reset role")
        check("ci_compute_scale_signal funciona para o dono", ok_dono, str(n_dono))

        # RLS controla LINHA, nunca COLUNA. Sem grant por coluna, o dono podia
        # dar UPDATE em scale_band da própria linha e forjar o sinal que o
        # produto apresenta como observado.
        cur.execute("set role authenticated")
        cur.execute("select set_config('request.jwt.claim.sub',%s,false)", (str(uid),))
        try:
            q("update public.ci_concepts set scale_band='very_high' where id=%s", (strong_id,))
            forjou = True
        except Exception:
            conn.rollback()
            forjou = False
        # O que ele PODE fazer é renomear e revisar.
        try:
            q("update public.ci_concepts set name='Renomeado', review_status='confirmed' where id=%s", (strong_id,))
            revisou = True
        except Exception as exc:
            conn.rollback()
            revisou = False
        cur.execute("reset role")
        check("usuário não consegue forjar scale_band", not forjou)
        check("usuário ainda consegue renomear e revisar conceito", revisou)

        # recency_window_days entra como divisor. Gravar 0 derrubava a função
        # para a marca inteira com division_by_zero.
        try:
            q("update public.ci_scale_signal_config set recency_window_days=0 where brand_id=%s", (bid,))
            zerou = True
        except Exception:
            conn.rollback()
            zerou = False
        check("config recusa janela de recência zero", not zerou)

        # A migration 100400 citava ci_refresh_taxonomy_stats() no comentário,
        # mas a função nunca foi escrita. Sem ela, ad_count dos termos fica em
        # zero para sempre e a página Messages sai vazia sem erro visível.
        term = q(
            """insert into public.ci_taxonomy_terms(brand_id,user_id,kind,slug,label)
               values(%s,%s,'hook','leggings-nao-enrolam','Leggings que não enrolam') returning id""",
            (bid, uid),
        )[0][0]
        q(
            """insert into public.ci_ad_taxonomy(ad_id,term_id,brand_id,user_id,confidence,source)
               values(%s,%s,%s,%s,0.9,'gemini'),(%s,%s,%s,%s,0.8,'gemini')""",
            (ads[0], term, bid, uid, ads[1], term, bid, uid),
        )
        atualizados = q("select public.ci_refresh_taxonomy_stats(%s)", (bid,))[0][0]
        contagem = q("select ad_count from public.ci_taxonomy_terms where id=%s", (term,))[0][0]
        check(
            "ci_refresh_taxonomy_stats existe e conta os anúncios do termo",
            atualizados >= 1 and contagem == 2,
            f"linhas={atualizados} ad_count={contagem}",
        )

        print()
        if check.failures:
            print(f"FALHAS ({len(check.failures)}): {check.failures}")
            return 1
        print("TODOS OS TESTES PASSARAM")
        return 0
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
