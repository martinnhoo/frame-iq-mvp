#!/usr/bin/env python3
"""
Regressão da fragmentação de receitas — o caso real da Shapermint.

── O que aconteceu ───────────────────────────────────────────────────────────
A primeira rodada real analisou 22 anúncios e devolveu 19 receitas, 16 delas com
um anúncio só. Isso é o mesmo que não agrupar, e o produto inteiro depende do
agrupamento: "receita" é a unidade que o estrategista lê.

Os nomes mostraram duas causas distintas, e vale separar porque as correções são
em camadas diferentes:

  1. A PROVA estava na assinatura. "Permanece no lugar" apareceu em quatro
     receitas, uma por prova (demonstração, número de usuárias, sem costura,
     estabilidade). É UMA ideia testada com quatro provas — exatamente o que a
     coluna TESTARAM deveria mostrar. Correção: assinatura = ângulo + mecanismo.

  2. O RÓTULO era texto livre. "Conforto superior" e "conforto" nunca colidem
     como string. Correção: ci_canonical_label normaliza antes de comparar.

── O que este teste NÃO garante ──────────────────────────────────────────────
Rótulo em português e rótulo em inglês para a mesma ideia continuam separados,
de propósito. A canonização normaliza GRAFIA, não traduz — um dicionário de
sinônimos embutido no banco juntaria coisas que não são a mesma, e juntar demais
é o erro pior: o usuário enxerga uma separação indevida e reclama, mas uma fusão
indevida ele acredita. O cruzamento de idioma se resolve na origem, com a regra
de prompt que exige `label` em inglês. O caso está afirmado abaixo como
comportamento esperado, não como defeito tolerado.
"""
import glob
import sys
import tempfile
from pathlib import Path

import pgserver

RAIZ = Path(__file__).resolve().parents[2]
USER = "11111111-1111-1111-1111-111111111111"
MARCA = "22222222-2222-2222-2222-222222222222"

PASSOU = True


def check(nome, condicao, detalhe=""):
    global PASSOU
    print(f"{'PASS' if condicao else 'FAIL'}  {nome}" + (f"  [{detalhe}]" if detalhe else ""))
    if not condicao:
        PASSOU = False


def linhas(saida):
    """psql em modo tabela: cabeçalho, régua, dados, contagem."""
    corpo = saida.strip().split("\n")[2:]
    return [[c.strip() for c in l.split("|")] for l in corpo if "|" in l or l.strip()]


def main():
    db = pgserver.get_server(tempfile.mkdtemp(prefix="ci-canon-"))
    db.psql("""
      create schema if not exists auth;
      create table if not exists auth.users(id uuid primary key, email text);
      create or replace function auth.uid() returns uuid language sql stable
        as $$ select null::uuid $$;
      create extension if not exists pgcrypto;
    """)
    arquivos = [a for a in sorted(glob.glob(str(RAIZ / "supabase/migrations/*.sql")))
                if "_ci_" in Path(a).name]
    assert arquivos, "nenhuma migration do CI encontrada"
    for arquivo in arquivos:
        db.psql(Path(arquivo).read_text(encoding="utf-8"))

    # ── Parte 1: a função de canonização, isolada ───────────────────────────
    def canon(s):
        return db.psql(f"select public.ci_canonical_label($${s}$$);").strip().split("\n")[2].strip()

    check("acento não separa", canon("Conforto sem aro") == canon("conforto sem ARO"),
          canon("Conforto sem aro"))
    check("ordem das palavras não separa",
          canon("wire-free comfort") == canon("comfort wire free"),
          canon("wire-free comfort"))
    check("pontuação não separa", canon("stays in place!") == canon("Stays In Place"))
    check("adjetivo de intensidade não separa",
          canon("Conforto superior") == canon("conforto"), canon("Conforto superior"))
    check("ideias diferentes CONTINUAM separadas",
          canon("comfort") != canon("support"))
    # String vazia é uma chave válida para o Postgres: se um rótulo em branco
    # canonizasse para '', todos eles agrupariam juntos — uma receita falsa,
    # feita de anúncios sem nada em comum. NULL a assinatura já sabe tratar.
    #
    # "!!!" é caso diferente e devolve "!!!" de propósito: é um rótulo ruim, mas
    # distinguível. Dois anúncios rotulados "!!!" têm de fato o mesmo rótulo.
    vazio = db.psql("select public.ci_canonical_label('   ') is null as branco, "
                    "coalesce(public.ci_canonical_label('!!!'),'<null>') as pontuacao;")
    campos = [c.strip() for c in vazio.split("\n")[2].split("|")]
    check("rótulo em branco devolve NULL, não string vazia",
          campos[0] == "t", str(campos))
    check("rótulo ruim mas distinguível é preservado",
          campos[1] == "!!!", str(campos))

    # ── Parte 2: o cenário real ─────────────────────────────────────────────
    db.psql(f"""
      insert into auth.users(id,email) values ('{USER}','t@e.com');
      insert into public.ci_brands(id,user_id,slug,name)
        values ('{MARCA}','{USER}','sh','Shapermint');
    """)

    # ── O que mudou aqui, e por quê ────────────────────────────────────────
    #
    # Este bloco testava a fragmentação de receita por grafia de ÂNGULO. A B6
    # tirou esse trabalho do canonicalizador: ângulo virou família de lista
    # fechada e a chave passou a ser o SLUG, que não tem grafia para variar. O
    # caso de agrupamento de ângulo agora mora em test_families.py, com os sete
    # rótulos reais da produção.
    #
    # O que continua sendo trabalho do ci_canonical_label — e portanto continua
    # sendo testado aqui — são os kinds de texto livre: prova, produto, hook.
    # Eles não têm lista fechada e nem devem ter: prova É a redação.
    #
    # Mantive o cenário de rebuild porque ele ainda protege uma coisa: que a
    # grafia do LABEL não influencia o agrupamento quando o slug manda. Se
    # alguém trocar o slug por ci_canonical_label(label) "para uniformizar", o
    # teste quebra — e era exatamente o caminho que produziu 20 receitas de 1.
    casos = [
        ("A", "fit",     "caimento e ajuste", "Demonstração de que permanece no lugar"),
        ("B", "fit",     "Caimento e Ajuste", "Prova social por número de usuárias"),
        ("C", "fit",     "caimento e ajuste!", "Completamente sem costura"),
        ("D", "fit",     "CAIMENTO E AJUSTE", "Demonstração de estabilidade"),
        ("E", "comfort", "conforto",          "Avaliações positivas"),
        ("F", "comfort", "Conforto",          "Depoimento de satisfação"),
    ]
    for i, (nome, familia, angulo, prova) in enumerate(casos):
        ad = f"333333{i}3-3333-3333-3333-333333333333"
        db.psql(f"""insert into public.ci_ads
          (id,brand_id,user_id,ad_archive_id,media_type,raw_payload)
          values ('{ad}','{MARCA}','{USER}','AD_{nome}','video','{{}}'::jsonb);""")
        for k, (kind, slug, label) in enumerate([("angle", familia, angulo),
                                                 ("proof", f"s{i}1", prova)]):
            termo = f"4444{i}{k}44-4444-4444-4444-444444444444"
            db.psql(f"""insert into public.ci_taxonomy_terms
              (id,brand_id,user_id,kind,slug,label)
              values ('{termo}','{MARCA}','{USER}','{kind}','{slug}',$${label}$$)
              on conflict do nothing;""")
            db.psql(f"""insert into public.ci_ad_taxonomy
              (ad_id,term_id,brand_id,user_id,confidence,evidence,source)
              values ('{ad}',
                      (select id from public.ci_taxonomy_terms where brand_id='{MARCA}'
                        and kind='{kind}' and slug='{slug}' limit 1),
                      '{MARCA}','{USER}',0.9,'ev','gemini');""")

    db.psql(f"select * from public.ci_rebuild_concepts('{MARCA}');")
    saida = db.psql(f"""select name, ad_count from public.ci_concepts
                        where brand_id='{MARCA}' order by ad_count desc, name;""")
    receitas = {l[0]: int(l[1]) for l in linhas(saida) if len(l) == 2}

    check("6 anúncios não viram 6 receitas", len(receitas) == 2, str(receitas))
    check("os 4 da família `fit` viram UMA receita, apesar das 4 grafias",
          4 in receitas.values(), str(receitas))
    check("os 2 de `comfort` viram UMA receita", 2 in receitas.values(), str(receitas))
    check("todo anúncio entrou em alguma receita",
          sum(receitas.values()) == 6, str(receitas))

    # ── Parte 3: o limite, e onde ele ainda existe ──────────────────────────
    #
    # O canonicalizador nunca vai fundir idiomas, e essa decisão continua de pé:
    # traduzir dentro do banco seria inventar equivalência que ninguém revisou.
    #
    # O que mudou é o ALCANCE do problema. Para ângulo e mecanismo ele deixou de
    # importar, porque a chave virou slug de lista fechada. Para prova, produto e
    # hook o limite continua valendo — e é por isso que ele fica afirmado aqui,
    # como decisão consciente e não como bug esquecido.
    check("idiomas diferentes NÃO são fundidos pelo banco (por decisão)",
          canon("stays in place") != canon("permanece no lugar"))
    check("e para ângulo isso deixou de importar: a chave é o slug da família",
          len(receitas) == 2)

    print("\n" + ("TODOS OS TESTES PASSARAM" if PASSOU else "HOUVE FALHA"))
    return 0 if PASSOU else 1


if __name__ == "__main__":
    sys.exit(main())
