#!/usr/bin/env python3
"""
Teste das agregações no servidor, contra um Postgres DE VERDADE.

    pip install pgserver && python supabase/tests/test_aggregates.py

Estas funções substituem cálculo que hoje roda no navegador. Se elas contarem
diferente, o painel passa a mentir — e mentir com número é pior que não mostrar.

── Cenário ──────────────────────────────────────────────────────────────────
5 anúncios reais + 1 de demonstração.

  A, B, C   ângulo "conforto" (mantido nos três)
  A, B, C   hooks DIFERENTES entre si          → eixo que variou
  D, E      ângulo "preço"
  DEMO      ângulo "coelho"                     → não pode aparecer em nada

Esperado: 6 anúncios no total, 5 reais; "conforto" com 3 ads e "coelho"
ausente de toda agregação.
"""
from __future__ import annotations

import glob
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
MARCA = "22222222-2222-2222-2222-222222222222"
USER = "11111111-1111-1111-1111-111111111111"

FALHAS: list[str] = []
PASSOU = 0


def check(nome: str, cond: bool, extra: str = "") -> None:
    global PASSOU
    print(("PASS  " if cond else "FAIL  ") + nome + (f"  [{extra}]" if extra else ""))
    if cond:
        PASSOU += 1
    else:
        FALHAS.append(nome)


def linhas(saida: str) -> list[list[str]]:
    """psql em texto → lista de células, ignorando cabeçalho e rodapé."""
    out = []
    for linha in saida.split("\n")[2:]:
        if linha.count("|") >= 1 and "row" not in linha:
            out.append([c.strip() for c in linha.split("|")])
    return out


def main() -> int:
    try:
        import pgserver
    except ImportError:
        print("pgserver não instalado — este teste NÃO deve ser dado como aprovado.")
        return 1

    db = pgserver.get_server(tempfile.mkdtemp(prefix="ci-agg-"))
    db.psql("""
      create schema if not exists auth;
      create table if not exists auth.users(id uuid primary key, email text);
      create or replace function auth.uid() returns uuid language sql stable
        as $$ select null::uuid $$;
      create extension if not exists pgcrypto;
    """)
    # Só as migrations do módulo CI. O resto do projeto traz gatilhos em
    # auth.users (handle_new_user) que esperam colunas do Supabase real e
    # abortam o insert do fixture — ruído que não tem nada a ver com o que
    # estamos testando.
    for arquivo in sorted(glob.glob(str(RAIZ / "supabase/migrations/202608*.sql"))):
        db.psql(Path(arquivo).read_text(encoding="utf-8"))

    # Cinto e suspensório: se algum gatilho sobreviver, ele não atrapalha.
    db.psql("alter table auth.users disable trigger all;")

    db.psql(f"""
      insert into auth.users(id,email) values ('{USER}','t@e.com') on conflict do nothing;
      insert into public.ci_brands(id,user_id,slug,name)
        values ('{MARCA}','{USER}','sh','Shapermint') on conflict do nothing;
    """)

    # 5 reais (0-4) + 1 demo (5)
    for i in range(6):
        demo = "true" if i == 5 else "false"
        ativo = "true" if i < 3 else "false"
        db.psql(
            f"insert into public.ci_ads(id,brand_id,user_id,ad_archive_id,media_type,"
            f"raw_payload,is_demo,is_active) values "
            f"('333333{i}3-3333-3333-3333-333333333333','{MARCA}','{USER}','AD_{i}',"
            f"'video','{{}}'::jsonb,{demo},{ativo});")

    termos = [("angle", "conforto"), ("angle", "preco"), ("angle", "coelho"),
              ("hook", "hook-a"), ("hook", "hook-b"), ("hook", "hook-c")]
    for i, (kind, slug) in enumerate(termos):
        db.psql(
            f"insert into public.ci_taxonomy_terms(id,brand_id,user_id,kind,slug,label)"
            f" values ('444444{i}4-4444-4444-4444-444444444444','{MARCA}','{USER}',"
            f"'{kind}','{slug}','{slug}');")

    # A,B,C → conforto + hook próprio | D,E → preço | DEMO → coelho
    lig = [(0, 0), (1, 0), (2, 0), (0, 3), (1, 4), (2, 5), (3, 1), (4, 1), (5, 2)]
    for ad, t in lig:
        db.psql(
            f"insert into public.ci_ad_taxonomy(ad_id,term_id,brand_id,user_id,"
            f"confidence,evidence,source) values "
            f"('333333{ad}3-3333-3333-3333-333333333333',"
            f"'444444{t}4-4444-4444-4444-444444444444','{MARCA}','{USER}',"
            f"0.9,'fala aos 2s','gemini');")

    # ══ ci_brand_overview ════════════════════════════════════════════════════
    ov = linhas(db.psql(f"select * from public.ci_brand_overview('{MARCA}');"))[0]
    check("conta todos os anúncios", ov[0] == "6", ov[0])
    check("separa os reais do de demonstração", ov[1] == "5", ov[1])
    check("conta ativos ignorando demonstração", ov[2] == "3", ov[2])
    check("cobertura é 0 sem asset analisado", ov[5] == "0", ov[5])

    # ══ ci_terms_ranked ══════════════════════════════════════════════════════
    tr = linhas(db.psql(
        f"select label, ads from public.ci_terms_ranked('{MARCA}', array['angle'], 10);"))
    mapa = {l[0]: int(l[1]) for l in tr if len(l) >= 2}
    check("ângulo mantido nos 3 aparece com 3 anúncios", mapa.get("conforto") == 3, str(mapa))
    check("o outro ângulo aparece com 2", mapa.get("preco") == 2, str(mapa))
    # REGRESSÃO: o termo do anúncio de demonstração já apareceu na lista de
    # hooks da Shapermint em produção por falta deste filtro.
    check("REGRESSÃO: termo de anúncio DEMO não entra na agregação",
          "coelho" not in mapa, str(mapa))
    check("ordenado por número de anúncios", tr[0][0] == "conforto" if tr else False)

    # ══ ci_concept_variation ═════════════════════════════════════════════════
    db.psql(f"select public.ci_rebuild_concepts('{MARCA}');")
    # Duas colunas de propósito: `linhas()` separa por "|", e uma saída de
    # coluna única não tem separador nenhum. O teste falhou por isso antes de
    # a função ter qualquer problema — parser ruim acusando inocente.
    cid = linhas(db.psql(
        f"select id, name from public.ci_concepts where brand_id='{MARCA}'"
        f" order by ad_count desc limit 1;"))
    if cid:
        var = linhas(db.psql(
            # v2: a coluna booleana `mantido` virou `papel`, com três valores.
            # O terceiro — nao_extraido — é o que impede a tela de apresentar
            # ausência de extração como se fosse variação da marca.
            f"select kind, papel, n_valores from public.ci_concept_variation('{cid[0][0]}');"))
        v = {l[0]: (l[1], int(l[2])) for l in var if len(l) >= 3}
        check("ângulo igual nos 3 é marcado como MANTIDO",
              v.get("angle", ("", 0))[0] == "mantido", str(v))
        check("hook diferente em cada um é marcado como VARIADO",
              v.get("hook", ("", 0))[0] == "variado" and v.get("hook", ("", 0))[1] == 3, str(v))
    else:
        check("receita foi montada para testar variação", False)

    # ══ ci_script_structures ═════════════════════════════════════════════════
    db.psql(f"""
      insert into public.ci_assets(id,brand_id,user_id,sha256,storage_key,storage_bucket,
                                   media_type,file_ext,file_size_bytes,mime_type)
      values ('555555a5-5555-5555-5555-555555555555','{MARCA}','{USER}',
              repeat('a',64),'k','ci-media','video','.mp4',1,'video/mp4');
      insert into public.ci_ad_assets(ad_id,asset_id,user_id,role)
      values ('33333303-3333-3333-3333-333333333333',
              '555555a5-5555-5555-5555-555555555555','{USER}','primary');
    """)
    # hook, hook, demo, cta → colapsa para hook → demo → cta
    for i, f in enumerate(["hook", "hook", "demonstration", "cta"]):
        db.psql(
            f"insert into public.ci_scenes(asset_id,brand_id,user_id,scene_index,"
            f"start_seconds,end_seconds,scene_function,source) values "
            f"('555555a5-5555-5555-5555-555555555555','{MARCA}','{USER}',{i},"
            f"{i},{i+1},'{f}','ffmpeg');")
    est = linhas(db.psql(f"select passos, assets from public.ci_script_structures('{MARCA}', 5);"))
    check("cenas iguais e seguidas colapsam numa só",
          bool(est) and est[0][0] == "{hook,demonstration,cta}", str(est))

    print()
    if FALHAS:
        print(f"FALHAS ({len(FALHAS)}/{PASSOU + len(FALHAS)}): " + ", ".join(FALHAS))
        return 1
    print(f"TODOS OS {PASSOU} TESTES PASSARAM")
    return 0


if __name__ == "__main__":
    sys.exit(main())
