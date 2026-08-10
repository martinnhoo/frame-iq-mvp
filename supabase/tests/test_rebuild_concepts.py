#!/usr/bin/env python3
"""
Teste do agrupamento em receitas, contra um Postgres DE VERDADE.

    pip install pgserver && python supabase/tests/test_rebuild_concepts.py

── Por que este arquivo existe ──────────────────────────────────────────────
Duas versões desta função chegaram ao usuário quebradas, e as duas passaram por
um validador de sintaxe antes:

  1. `max(uuid)` — a função não existe no Postgres. Sintaxe perfeita.
  2. `bool_or()` devolvendo NULL numa coluna NOT NULL, quando todos os valores
     de entrada são NULL. Sintaxe perfeita, e só quebra com o dado certo.

Nenhum parser pegaria os dois. Só executar pega. Este teste sobe um Postgres
efêmero, aplica todas as migrations, insere um cenário com resposta conhecida e
confere o resultado.

── O cenário ────────────────────────────────────────────────────────────────
Seis anúncios com desfecho previsto:

  A, B, C   mesmo ângulo (conforto) → UMA receita (prova não entra na assinatura)
  D         ângulo diferente (preço), mesma prova               → receita própria
  E         só mecanismo                                        → receita própria
  F         nenhum eixo                                         → órfão, fora

Esperado: 3 receitas, 5 anúncios agrupados, 1 órfão.
"""
from __future__ import annotations

import glob
import sys
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


def main() -> int:
    try:
        import pgserver
    except ImportError:
        print("pgserver não instalado. `pip install pgserver` — sem ele este teste")
        print("não roda, e NÃO deve ser considerado aprovado.")
        return 1

    import tempfile
    db = pgserver.get_server(tempfile.mkdtemp(prefix="ci-pg-"))

    # O Supabase traz auth.users e auth.uid(); num Postgres nu, não existem.
    db.psql("""
      create schema if not exists auth;
      create table if not exists auth.users(id uuid primary key, email text);
      create or replace function auth.uid() returns uuid language sql stable
        as $$ select null::uuid $$;
      create extension if not exists pgcrypto;
    """)

    # TODAS as migrations do módulo CI, não um recorte por data: o filtro
    # "20260806*" fazia o teste validar a versão ANTIGA de ci_rebuild_concepts
    # e passar enquanto a versão publicada estava quebrada. Teste que não roda
    # o código publicado é pior que teste nenhum — dá confiança falsa.
    #
    # As ~140 migrations do app legado ficam de fora de propósito: carregar
    # tudo traz triggers e seeds que não têm nada a ver com o que se testa aqui
    # e que quebram a inserção do cenário. O módulo CI é autocontido.
    arquivos = [a for a in sorted(glob.glob(str(RAIZ / "supabase/migrations/*.sql")))
                if "_ci_" in Path(a).name]
    assert arquivos, "nenhuma migration do CI encontrada — glob errado?"
    for arquivo in arquivos:
        # Os GRANT para authenticated/anon falham num Postgres sem esses papéis.
        # Não é o que estamos testando, e criar os papéis mascararia a RLS real.
        db.psql(Path(arquivo).read_text(encoding="utf-8"))

    db.psql(f"""
      insert into auth.users(id,email) values ('{USER}','teste@exemplo.com')
        on conflict do nothing;
      insert into public.ci_brands(id,user_id,slug,name)
        values ('{MARCA}','{USER}','sh','Shapermint') on conflict do nothing;
    """)

    for i, nome in enumerate("ABCDEF"):
        db.psql(
            f"insert into public.ci_ads(id,brand_id,user_id,ad_archive_id,media_type,raw_payload)"
            f" values ('333333{i}3-3333-3333-3333-333333333333','{MARCA}','{USER}',"
            f"'AD_{nome}','video','{{}}'::jsonb);")

    # B6: ângulo e mecanismo agora vêm de lista fechada (ci_term_family). Slug
    # fora da lista não forma assinatura — de propósito, para que rótulo antigo
    # de texto livre pare de fragmentar receita. Por isso este cenário usa os
    # slugs das famílias, e não mais "conforto"/"preco" escritos à mão.
    for i, (kind, slug) in enumerate(
            [("angle", "comfort"), ("angle", "price_value"),
             ("proof", "antes-depois"), ("mechanism", "material")]):
        db.psql(
            f"insert into public.ci_taxonomy_terms(id,brand_id,user_id,kind,slug,label)"
            f" values ('444444{i}4-4444-4444-4444-444444444444','{MARCA}','{USER}',"
            f"'{kind}','{slug}','{slug}');")

    # (anúncio, termo)
    for ad, termo in [(0, 0), (0, 2), (1, 0), (1, 2), (2, 0), (2, 2),
                      (3, 1), (3, 2), (4, 3)]:
        db.psql(
            f"insert into public.ci_ad_taxonomy"
            f"(ad_id,term_id,brand_id,user_id,confidence,evidence,source)"
            f" values ('333333{ad}3-3333-3333-3333-333333333333',"
            f"'444444{termo}4-4444-4444-4444-444444444444','{MARCA}','{USER}',"
            f"0.9,'fala aos 2s','gemini');")

    saida = db.psql(f"select * from public.ci_rebuild_concepts('{MARCA}');")
    numeros = [int(x) for x in saida.split("\n")[2].split("|")]
    check("3 receitas para o cenário conhecido", numeros[0] == 3, str(numeros[0]))
    check("5 anúncios agrupados", numeros[1] == 5, str(numeros[1]))
    check("1 anúncio sem eixo fica de fora", numeros[2] == 1, str(numeros[2]))

    linhas = db.psql(f"""
      select c.name, c.ad_count,
             (select count(*) from public.ci_concept_members m where m.concept_id=c.id)
        from public.ci_concepts c where c.brand_id='{MARCA}' order by c.ad_count desc;""")
    # Parse em vez de casar substring com espaços: a primeira versão deste teste
    # falhou por causa do alinhamento do psql, não da função — um teste que
    # acusa erro onde não há é tão ruim quanto um que deixa passar.
    receitas = {}
    for linha in linhas.split("\n")[2:]:
        if linha.count("|") != 2:
            continue
        nome, ads, membros = (p.strip() for p in linha.split("|"))
        if nome:
            receitas[nome] = (int(ads), int(membros))

    # v2: a assinatura é ÂNGULO + MECANISMO. A prova saiu — ela é execução da
    # mesma ideia, e mantê-la na assinatura quebrava um ângulo em várias
    # receitas.
    #
    # v3 (B6): o NOME da receita passou a vir de ci_term_family, não do que o
    # modelo escreveu. É por isso que se espera "preço e custo-benefício" e não
    # "price_value": o slug é a chave, o rótulo da tabela é o que a tela mostra.
    check("a receita dominante junta os 3 de mesmo ângulo",
          receitas.get("conforto", (0, 0))[0] == 3, str(receitas))
    check("ângulo diferente NÃO é agrupado junto",
          receitas.get("preço e custo-benefício", (0, 0))[0] == 1, str(receitas))
    check("mecanismo sozinho vira receita própria",
          receitas.get("material e tecido", (0, 0))[0] == 1, str(receitas))
    check("ad_count bate com o número de membros em toda receita",
          all(a == m for a, m in receitas.values()), str(receitas))

    # Idempotência: rodar duas vezes não duplica nem muda o resultado.
    db.psql(f"select * from public.ci_rebuild_concepts('{MARCA}');")
    de_novo = db.psql(
        f"select count(*) from public.ci_concepts where brand_id='{MARCA}';")
    check("reagrupar duas vezes não duplica receita",
          de_novo.split("\n")[2].strip() == "3", de_novo.split("\n")[2].strip())

    # Revisão humana é preservada.
    db.psql(f"""update public.ci_concepts set review_status='confirmed', name='Revisada por humano'
                where brand_id='{MARCA}' and ad_count=3;""")
    db.psql(f"select * from public.ci_rebuild_concepts('{MARCA}');")
    sobrou = db.psql(
        f"select count(*) from public.ci_concepts where brand_id='{MARCA}'"
        f" and review_status='confirmed';")
    check("receita confirmada por humano sobrevive ao reagrupamento",
          sobrou.split("\n")[2].strip() == "1", sobrou.split("\n")[2].strip())

    print()
    if FALHAS:
        print(f"FALHAS ({len(FALHAS)}/{PASSOU + len(FALHAS)}): " + ", ".join(FALHAS))
        return 1
    print(f"TODOS OS {PASSOU} TESTES PASSARAM")
    return 0


if __name__ == "__main__":
    sys.exit(main())
