#!/usr/bin/env python3
"""
B4 — os eixos de variação.

O cenário abaixo é montado para que cada papel apareça pelo menos uma vez, e
cada um deles corrige um defeito específico da versão anterior:

  product   → 10 de 10 anúncios, mesmo produto            → MANTIDO
  angle     →  9 de 10 com o mesmo ângulo, 1 diferente    → MANTIDO (não exige
                                                             unanimidade)
  hook      → 10 valores distintos em 10 anúncios         → VARIADO
  proof     →  grafias diferentes da MESMA ideia          → MANTIDO
                                                             (canonização)
  mechanism →  presente em só 2 de 10                     → NAO_EXTRAIDO

O último é o mais importante. A versão anterior reportaria mecanismo como eixo
variado, e "a marca varia o mecanismo" iria parar num briefing — quando a
verdade é que o modelo não extraiu o campo em 8 dos 10 anúncios e nós não
sabemos nada sobre ele.
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


def main():
    db = pgserver.get_server(tempfile.mkdtemp(prefix="ci-var-"))
    db.psql("""
      create schema if not exists auth;
      create table if not exists auth.users(id uuid primary key, email text);
      create or replace function auth.uid() returns uuid language sql stable
        as $$ select null::uuid $$;
      create extension if not exists pgcrypto;
    """)
    for arq in [a for a in sorted(glob.glob(str(RAIZ / "supabase/migrations/*.sql")))
                if "_ci_" in Path(a).name]:
        db.psql(Path(arq).read_text(encoding="utf-8"))

    db.psql(f"""
      insert into auth.users(id,email) values ('{USER}','t@e.com');
      insert into public.ci_brands(id,user_id,slug,name)
        values ('{MARCA}','{USER}','sh','Shapermint');
      insert into public.ci_concepts(id,brand_id,user_id,name,grouping_method)
        values ('{CONCEITO}','{MARCA}','{USER}','Receita de teste','rules');
    """)

    # ad_i → lista de (kind, label). None = o modelo não emitiu nada daquele kind.
    def rotulos(i):
        r = [
            ("product", "shapewear bodysuit"),
            # 9 iguais, o décimo diferente: ainda é MANTIDO.
            ("angle", "stays in place" if i < 9 else "wire-free comfort"),
            # dez hooks distintos: VARIADO de verdade.
            ("hook", f"hook numero {i}"),
            # a MESMA prova escrita de jeitos diferentes: a canonização tem que
            # colapsar, senão vira "10 provas diferentes" e mente.
            ("proof", ["social proof", "Social Proof", "social  proof!",
                       "SOCIAL PROOF", "social proof"][i % 5]),
        ]
        # mecanismo só nos dois primeiros: cobertura de 20%.
        if i < 2:
            r.append(("mechanism", "silicone strips"))
        return r

    for i in range(10):
        ad = f"7777{i:02d}77-7777-7777-7777-777777777777"
        db.psql(f"""insert into public.ci_ads
            (id,brand_id,user_id,ad_archive_id,media_type,raw_payload)
            values ('{ad}','{MARCA}','{USER}','AD{i}','video','{{}}'::jsonb);""")
        db.psql(f"""insert into public.ci_concept_members
            (concept_id,ad_id,brand_id,user_id,match_method)
            values ('{CONCEITO}','{ad}','{MARCA}','{USER}','rules');""")
        for k, (kind, label) in enumerate(rotulos(i)):
            # 8 caracteres no primeiro bloco. A versão anterior tinha 7 e
            # TODOS os inserts falhavam sem que o teste notasse.
            termo = f"8888{i:02d}{k}0-8888-8888-8888-888888888888"
            db.psql(f"""insert into public.ci_taxonomy_terms
                (id,brand_id,user_id,kind,slug,label)
                values ('{termo}','{MARCA}','{USER}','{kind}','s{i}{k}',$${label}$$);""")
            db.psql(f"""insert into public.ci_ad_taxonomy
                (ad_id,term_id,brand_id,user_id,confidence,evidence,source)
                values ('{ad}','{termo}','{MARCA}','{USER}',0.9,'ev','gemini');""")

    saida = db.psql(f"""
      select kind, papel, n_valores, cobertura_pct, dominancia_pct, dominante
        from public.ci_concept_variation('{CONCEITO}');
    """)
    linhas = {}
    for l in saida.strip().split("\n")[2:]:
        if "|" not in l:
            continue
        c = [x.strip() for x in l.split("|")]
        if len(c) >= 6:
            linhas[c[0]] = {"papel": c[1], "n": int(c[2]),
                            "cob": int(c[3]), "dom": int(c[4]), "dominante": c[5]}
    print(saida)

    check("produto igual em todos → mantido",
          linhas.get("product", {}).get("papel") == "mantido", str(linhas.get("product")))

    check("9 de 10 com o mesmo ângulo → mantido, sem exigir unanimidade",
          linhas.get("angle", {}).get("papel") == "mantido", str(linhas.get("angle")))
    check("o ângulo mantido é o mais frequente, não um qualquer",
          linhas.get("angle", {}).get("dominante") == "stays in place",
          str(linhas.get("angle")))

    check("dez hooks distintos → variado",
          linhas.get("hook", {}).get("papel") == "variado", str(linhas.get("hook")))
    check("os dez hooks contam como dez valores",
          linhas.get("hook", {}).get("n") == 10, str(linhas.get("hook")))

    # A regressão que mais importa depois da fragmentação das receitas.
    check("grafias diferentes da mesma prova colapsam → mantido",
          linhas.get("proof", {}).get("papel") == "mantido", str(linhas.get("proof")))
    check("a prova conta como UM valor, não cinco",
          linhas.get("proof", {}).get("n") == 1, str(linhas.get("proof")))
    # A grafia exibida tem que ser a MAIS FREQUENTE. "social proof" aparece 4x,
    # as outras 2x cada. Ordenar por alfabeto escolheria "SOCIAL PROOF" só pela
    # caixa alta — e foi o que a primeira versão fez, contrariando o próprio
    # comentário logo acima do código.
    check("a grafia exibida é a mais usada, não a primeira do alfabeto",
          linhas.get("proof", {}).get("dominante") == "social proof",
          str(linhas.get("proof", {}).get("dominante")))

    # O defeito mais caro da v1.
    check("mecanismo em 2 de 10 → nao_extraido, NUNCA 'variado'",
          linhas.get("mechanism", {}).get("papel") == "nao_extraido",
          str(linhas.get("mechanism")))
    check("cobertura do mecanismo é reportada como 20%",
          linhas.get("mechanism", {}).get("cob") == 20, str(linhas.get("mechanism")))

    # Ordem de leitura: mantidos primeiro.
    ordem = [l.split("|")[0].strip() for l in saida.strip().split("\n")[2:] if "|" in l]
    papeis = [linhas[k]["papel"] for k in ordem if k in linhas]
    # `papeis` vazio satisfaz qualquer teste de ordenação — este check passou
    # verde com lista vazia na primeira execução, enquanto a função sequer
    # existia. Teste que passa sem dado é pior que teste que falha.
    check("a função devolveu os cinco eixos", len(papeis) == 5, str(papeis))
    check("mantidos vêm antes de variados, e nao_extraido por último",
          len(papeis) == 5 and papeis == sorted(
              papeis, key=lambda p: {"mantido": 1, "variado": 2, "nao_extraido": 3}[p]),
          str(list(zip(ordem, papeis))))

    # DEMO fora do agregado.
    demo = "76767676-7676-7676-7676-767676767676"
    db.psql(f"""insert into public.ci_ads
        (id,brand_id,user_id,ad_archive_id,media_type,raw_payload,is_demo)
        values ('{demo}','{MARCA}','{USER}','ADDEMO','video','{{}}'::jsonb,true);""")
    db.psql(f"""insert into public.ci_concept_members
        (concept_id,ad_id,brand_id,user_id,match_method)
        values ('{CONCEITO}','{demo}','{MARCA}','{USER}','rules');""")
    depois = db.psql(f"""select ads_no_conceito from public.ci_concept_variation('{CONCEITO}') limit 1;""")
    check("anúncio DEMO não entra na contagem",
          depois.strip().split("\n")[2].strip() == "10",
          depois.strip().split("\n")[2].strip())

    print("\n" + ("TODOS OS TESTES PASSARAM" if PASSOU else "HOUVE FALHA"))
    return 0 if PASSOU else 1


if __name__ == "__main__":
    sys.exit(main())
