#!/usr/bin/env python3
"""
BE1 — pessoas recorrentes, agrupadas por humano.

O que estes testes protegem, em ordem de importância:

  1. A coluna Pessoas da home conta CLUSTER, não aparição. A mesma pessoa em
     cinco anúncios de uma receita é uma pessoa. Contar aparições faria uma
     receita reciclada parecer ter um elenco.

  2. Anúncio DEMO não entra. A regra vale aqui como em todo agregado.

  3. 'pessoa' e 'mecanismo' são campos válidos no quality gate. Sem isso, o
     agrupamento manual não teria onde ser contestado, e a coluna apareceria
     com a mesma autoridade de um campo medido.

  4. Não existe coluna de nome, etnia, idade ou gênero em lugar nenhum. Isso é
     afirmado como teste, não como intenção — intenção não sobrevive a um
     refactor apressado.
"""
import glob
import sys
import tempfile
from pathlib import Path

import pgserver

RAIZ = Path(__file__).resolve().parents[2]
USER = "11111111-1111-1111-1111-111111111111"
MARCA = "22222222-2222-2222-2222-222222222222"
CONCEITO = "99999999-9999-9999-9999-999999999999"

PASSOU = True


def check(nome, cond, detalhe=""):
    global PASSOU
    print(f"{'PASS' if cond else 'FAIL'}  {nome}" + (f"  [{detalhe}]" if detalhe else ""))
    if not cond:
        PASSOU = False


def uma(db, sql):
    return db.psql(sql).strip().split("\n")[2].strip()


def main():
    db = pgserver.get_server(tempfile.mkdtemp(prefix="ci-pess-"))
    db.psql("""
      create schema if not exists auth;
      create table if not exists auth.users(id uuid primary key, email text);
      create or replace function auth.uid() returns uuid language sql stable
        as $$ select null::uuid $$;
    """)
    for arq in [a for a in sorted(glob.glob(str(RAIZ / "supabase/migrations/*.sql")))
                if "_ci_" in Path(a).name]:
        db.psql(Path(arq).read_text(encoding="utf-8"))

    db.psql(f"""
      insert into auth.users values ('{USER}','t@e.com');
      insert into public.ci_brands(id,user_id,slug,name)
        values ('{MARCA}','{USER}','sh','Shapermint');
      insert into public.ci_concepts(id,brand_id,user_id,name,grouping_method)
        values ('{CONCEITO}','{MARCA}','{USER}','Receita','rules');
    """)

    # 4 anúncios reais + 1 DEMO, todos na mesma receita.
    for i in range(5):
        ad = f"aaaa{i:02d}aa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        demo = "true" if i == 4 else "false"
        db.psql(f"""insert into public.ci_ads
          (id,brand_id,user_id,ad_archive_id,media_type,raw_payload,is_demo,is_active)
          values ('{ad}','{MARCA}','{USER}','AD{i}','video','{{}}'::jsonb,{demo},true);""")
        db.psql(f"""insert into public.ci_concept_members
          (concept_id,ad_id,brand_id,user_id,match_method)
          values ('{CONCEITO}','{ad}','{MARCA}','{USER}','rules');""")

    # ── Rótulos anônimos ────────────────────────────────────────────────────
    check("o primeiro rótulo é PERSON_001",
          uma(db, f"select public.ci_person_next_label('{MARCA}');") == "PERSON_001")

    p1 = "bbbb0001-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    p2 = "bbbb0002-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    db.psql(f"""insert into public.ci_person_clusters(id,brand_id,user_id,label)
      values ('{p1}','{MARCA}','{USER}','PERSON_001'),
             ('{p2}','{MARCA}','{USER}','PERSON_002');""")
    check("o próximo vira PERSON_003",
          uma(db, f"select public.ci_person_next_label('{MARCA}');") == "PERSON_003")

    # PERSON_001 em três anúncios reais; PERSON_002 em um; e PERSON_001
    # TAMBÉM no DEMO, que precisa ser ignorado.
    for i in (0, 1, 2, 4):
        db.psql(f"""insert into public.ci_person_appearances
          (cluster_id,ad_id,brand_id,user_id)
          values ('{p1}','aaaa{i:02d}aa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{MARCA}','{USER}');""")
    db.psql(f"""insert into public.ci_person_appearances
      (cluster_id,ad_id,brand_id,user_id)
      values ('{p2}','aaaa03aa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{MARCA}','{USER}');""")

    # ── Visão geral ─────────────────────────────────────────────────────────
    saida = db.psql(f"""select label, ads, receitas, share_pct
                          from public.ci_person_overview('{MARCA}');""")
    print(saida)
    linhas = {l.split("|")[0].strip(): [c.strip() for c in l.split("|")]
              for l in saida.strip().split("\n")[2:] if "|" in l}

    check("PERSON_001 aparece em 3 anúncios, não 4 — o DEMO não conta",
          linhas.get("PERSON_001", ["", "?"])[1] == "3",
          str(linhas.get("PERSON_001")))
    check("share é sobre os 4 anúncios reais",
          linhas.get("PERSON_001", ["", "", "", "?"])[3] == "75",
          str(linhas.get("PERSON_001")))

    # ── A coluna da home ────────────────────────────────────────────────────
    #
    # Na receita há QUATRO aparições — PERSON_001 em três anúncios reais e
    # PERSON_002 em um — mas DUAS pessoas. Contar aparição faria uma receita
    # que recicla o mesmo apresentador parecer ter elenco.
    pessoas = uma(db, f"""select pessoas from public.ci_creative_priority('{MARCA}');""")
    check("a home conta 2 pessoas, não as 4 aparições", pessoas == "2", pessoas)

    # ── Restrições: conferidas por CONTAGEM, não por try/except ─────────────
    #
    # `db.psql` do pgserver NÃO levanta exceção em erro de SQL: ele imprime o
    # ERROR e retorna normalmente. Escrevi este arquivo com try/except e os dois
    # testes de restrição passavam sem testar nada — o mesmo tipo de teste vazio
    # que já me enganou duas vezes hoje.
    #
    # Contar linhas depois da tentativa é o que realmente verifica.
    db.psql(f"""insert into public.ci_person_appearances
      (cluster_id,ad_id,brand_id,user_id)
      values ('{p1}','aaaa00aa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{MARCA}','{USER}');""")
    n_dup = uma(db, f"""select count(*) from public.ci_person_appearances
                         where cluster_id='{p1}'
                           and ad_id='aaaa00aa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';""")
    check("a mesma pessoa não entra duas vezes no mesmo anúncio",
          n_dup == "1", f"{n_dup} linhas")

    # ── Quality gate ────────────────────────────────────────────────────────
    for ad_i, campo in ((0, "pessoa"), (1, "mecanismo"), (2, "campo_inventado")):
        db.psql(f"""insert into public.ci_quality_reviews
          (ad_id,brand_id,user_id,campo,veredito)
          values ('aaaa{ad_i:02d}aa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{MARCA}','{USER}',
                  '{campo}','correto');""")

    aceitos = db.psql(f"""select campo from public.ci_quality_reviews
                           where brand_id='{MARCA}' order by campo;""")
    check("'pessoa' é campo revisável no quality gate", "pessoa" in aceitos, aceitos.strip()[-60:])
    check("'mecanismo' também", "mecanismo" in aceitos)
    check("a lista continua FECHADA — campo inventado é recusado",
          "campo_inventado" not in aceitos)

    # ── Privacidade, afirmada como teste ────────────────────────────────────
    colunas = db.psql("""
      select string_agg(column_name, ',' order by column_name)
        from information_schema.columns
       where table_name in ('ci_person_clusters','ci_person_appearances');
    """).strip().split("\n")[2].strip().lower()
    proibidas = ["nome", "name_real", "etnia", "ethnicity", "idade", "age",
                 "genero", "gender", "religiao", "saude"]
    achadas = [p for p in proibidas if p in colunas and p != "name"]
    check("nenhuma coluna de atributo sensível existe", not achadas, str(achadas))
    check("display_name é apelido opcional, não identidade",
          "display_name" in colunas)

    print("\n" + ("TODOS OS TESTES PASSARAM" if PASSOU else "HOUVE FALHA"))
    return 0 if PASSOU else 1


if __name__ == "__main__":
    sys.exit(main())
