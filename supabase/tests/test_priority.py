#!/usr/bin/env python3
"""
T6 — Current Creative Priority.

Duas receitas, montadas para testar as decisões que importam:

  GRANDE  6 anúncios · 6 assets únicos · hook variando · produto mantido
  PEQUENA 2 anúncios · 2 assets, sendo que os DOIS compartilham o mesmo asset
          (o mesmo vídeo usado em dois anúncios)

O caso do asset compartilhado é o que mais me preocupa. Se a presença contasse
ANÚNCIOS em vez de assets únicos, uma receita reciclada — o mesmo vídeo rodando
em vários anúncios — apareceria como se a marca estivesse apostando mais nela.
Isso é o tipo de erro que só aparece quando alguém age em cima do número.

Também: "presença" é RELATIVA à marca. Não existe escala absoluta — 6 assets é
muito numa marca de 8 e irrelevante numa de 3.000 — e o rótulo tem que vir
sempre acompanhado do número que o produziu.
"""
import glob
import sys
import tempfile
from pathlib import Path

import pgserver

RAIZ = Path(__file__).resolve().parents[2]
USER = "11111111-1111-1111-1111-111111111111"
MARCA = "22222222-2222-2222-2222-222222222222"
GRANDE = "99999991-9999-9999-9999-999999999999"
PEQUENA = "99999992-9999-9999-9999-999999999999"

PASSOU = True


def check(nome, cond, detalhe=""):
    global PASSOU
    print(f"{'PASS' if cond else 'FAIL'}  {nome}" + (f"  [{detalhe}]" if detalhe else ""))
    if not cond:
        PASSOU = False


def main():
    db = pgserver.get_server(tempfile.mkdtemp(prefix="ci-prio-"))
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
      insert into auth.users(id,email) values ('{USER}','t@e.com');
      insert into public.ci_brands(id,user_id,slug,name)
        values ('{MARCA}','{USER}','sh','Shapermint');
      insert into public.ci_concepts(id,brand_id,user_id,name,grouping_method)
        values ('{GRANDE}','{MARCA}','{USER}','Permanece no lugar','rules'),
               ('{PEQUENA}','{MARCA}','{USER}','Antes e depois','rules');
    """)

    def cria_ad(i, conceito, asset_idx, ativo, dias):
        ad = f"dddd{i:02d}dd-dddd-dddd-dddd-dddddddddddd"
        asset = f"eeee{asset_idx:02d}ee-eeee-eeee-eeee-eeeeeeeeeeee"
        db.psql(f"""insert into public.ci_ads
            (id,brand_id,user_id,ad_archive_id,media_type,raw_payload,is_active,running_days)
            values ('{ad}','{MARCA}','{USER}','AD{i}','video','{{}}'::jsonb,
                    {'true' if ativo else 'false'},{dias});""")
        db.psql(f"""insert into public.ci_assets
            (id,brand_id,user_id,sha256,storage_key,media_type,duration_seconds)
            values ('{asset}','{MARCA}','{USER}','sha{asset_idx}','k{asset_idx}','video',
                    {20 + asset_idx})
            on conflict (id) do nothing;""")
        db.psql(f"""insert into public.ci_ad_assets(ad_id,asset_id,user_id,role)
            values ('{ad}','{asset}','{USER}','primary');""")
        db.psql(f"""insert into public.ci_concept_members
            (concept_id,ad_id,brand_id,user_id,match_method)
            values ('{conceito}','{ad}','{MARCA}','{USER}','rules');""")
        return ad

    def marca_termo(ad, i, k, kind, label):
        termo = f"ffff{i:02d}{k}0-ffff-ffff-ffff-ffffffffffff"
        db.psql(f"""insert into public.ci_taxonomy_terms
            (id,brand_id,user_id,kind,slug,label)
            values ('{termo}','{MARCA}','{USER}','{kind}','sl{i}{k}',$${label}$$);""")
        db.psql(f"""insert into public.ci_ad_taxonomy
            (ad_id,term_id,brand_id,user_id,confidence,evidence,source)
            values ('{ad}','{termo}','{MARCA}','{USER}',0.9,'ev','gemini');""")

    # GRANDE: 6 anúncios, 6 assets distintos.
    for i in range(6):
        ad = cria_ad(i, GRANDE, i, i < 4, 30 + i)
        marca_termo(ad, i, 0, "product", "shapewear bodysuit")     # mantido
        marca_termo(ad, i, 1, "hook", f"hook distinto {i}")        # variado
        marca_termo(ad, i, 2, "angle", "stays in place")           # mantido

    # PEQUENA: 2 anúncios que COMPARTILHAM o mesmo asset (índice 90).
    for i in (6, 7):
        ad = cria_ad(i, PEQUENA, 90, False, 10)
        marca_termo(ad, i, 0, "product", "shapewear bodysuit")
        marca_termo(ad, i, 1, "hook", "hook do antes e depois")

    saida = db.psql(f"""
      select nome, ads, assets_unicos, variacoes, eixos_variados, eixos_mantidos,
             pessoas, ativos, presenca, share_pct, presenca_motivo,
             coalesce(hook_dominante,'-')
        from public.ci_creative_priority('{MARCA}');
    """)
    print(saida)
    linhas = {}
    for l in saida.strip().split("\n")[2:]:
        if "|" not in l:
            continue
        c = [x.strip() for x in l.split("|")]
        if len(c) >= 12:
            linhas[c[0]] = c

    g = linhas.get("Permanece no lugar")
    p = linhas.get("Antes e depois")

    check("as duas receitas aparecem", g is not None and p is not None, str(list(linhas)))
    if not (g and p):
        print("\nHOUVE FALHA")
        return 1

    # ── A armadilha principal ───────────────────────────────────────────────
    check("a receita reciclada tem 2 anúncios mas 1 asset único",
          p[1] == "2" and p[2] == "1", f"ads={p[1]} assets={p[2]}")
    check("a presença conta ASSETS ÚNICOS, não anúncios",
          int(p[9]) == round(100 * 1 / 7), f"share={p[9]}% (esperado {round(100*1/7)}%)")

    # ── Variações ───────────────────────────────────────────────────────────
    check("a receita grande soma as 6 variações de hook", g[3] == "6", g[3])
    check("um eixo variado é contado", g[4] == "1", g[4])
    check("produto e ângulo entram como mantidos", g[5] == "2", g[5])

    # ── Ordem e rótulo ──────────────────────────────────────────────────────
    ordem = [l.split("|")[0].strip() for l in saida.strip().split("\n")[2:] if "|" in l]
    check("a receita com mais assets únicos vem primeiro",
          ordem[0] == "Permanece no lugar", str(ordem))
    check("presença muito alta para 6 de 7 assets", g[8] == "muito alta", g[8])
    # 1 de 7 é 14%, e a regra percentual sozinha diria "alta". O piso absoluto
    # impede isso: um criativo não é padrão, é um criativo. Foi o teste que
    # revelou o furo — a primeira versão da regra chamava isto de alta.
    check("um único asset nunca é 'alta', mesmo com share de 14%",
          p[8] == "baixa", f"{p[8]} com share={p[9]}%")
    check("o motivo explica que são poucos criativos",
          "poucos criativos" in p[10], p[10])

    # O rótulo sem o número seria um score disfarçado.
    check("o rótulo vem acompanhado do número que o gerou",
          "de 7 assets únicos" in g[10], g[10])

    # ── O que ainda não existe ──────────────────────────────────────────────
    check("pessoas devolve 0, com a coluna presente",
          g[6] == "0" and p[6] == "0", f"{g[6]} / {p[6]}")

    check("ativos são contados à parte da presença", g[7] == "4", g[7])
    check("o hook dominante é o da receita", "hook" in g[11], g[11])

    # ── Marca sem receita ───────────────────────────────────────────────────
    vazia = "33333333-3333-3333-3333-333333333333"
    db.psql(f"""insert into public.ci_brands(id,user_id,slug,name)
                values ('{vazia}','{USER}','v','Vazia');""")
    n = db.psql(f"select count(*) from public.ci_creative_priority('{vazia}');")
    check("marca sem receita devolve zero linhas, sem erro",
          n.strip().split("\n")[2].strip() == "0", n.strip().split("\n")[2].strip())

    print("\n" + ("TODOS OS TESTES PASSARAM" if PASSOU else "HOUVE FALHA"))
    return 0 if PASSOU else 1


if __name__ == "__main__":
    sys.exit(main())
