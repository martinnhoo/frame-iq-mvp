#!/usr/bin/env python3
"""
T2 e T3 — padrões de hook e playbook de produto.

O cenário tem armadilhas de propósito, uma por defeito que eu queria evitar:

  · o mesmo hook escrito de três jeitos  → tem que virar UM padrão de 6 assets,
    não três de 2. Este número é o que faz alguém decidir usar o padrão, então
    fragmentá-lo não é cosmético.

  · o mesmo anúncio marcado com `product` E `product_type` do mesmo produto
    → tem que contar UMA vez. Número inflado é pior que número ausente, porque
    parece certo.

  · cenas repetindo a mesma função em sequência → a estrutura tem que colapsar
    "hook → hook → demo" em "hook → demo", senão o mesmo roteiro cortado em
    mais pedaços viraria uma estrutura diferente.

  · um hook sem evidência → descartado, como em todo o resto do sistema.
"""
import glob
import json
import sys
import tempfile
from pathlib import Path

import pgserver

RAIZ = Path(__file__).resolve().parents[2]
USER = "11111111-1111-1111-1111-111111111111"
MARCA = "22222222-2222-2222-2222-222222222222"

PASSOU = True


def check(nome, cond, detalhe=""):
    global PASSOU
    print(f"{'PASS' if cond else 'FAIL'}  {nome}" + (f"  [{detalhe}]" if detalhe else ""))
    if not cond:
        PASSOU = False


def main():
    db = pgserver.get_server(tempfile.mkdtemp(prefix="ci-pat-"))
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
    """)

    # O mesmo hook em três grafias, dois anúncios cada.
    HOOKS = ["if you struggle with back pain", "If You Struggle With Back Pain",
             "if you struggle with back pain!"]

    for i in range(6):
        ad = f"aaaa{i:02d}aa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        asset = f"bbbb{i:02d}bb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
        db.psql(f"""insert into public.ci_ads
            (id,brand_id,user_id,ad_archive_id,media_type,raw_payload,is_active)
            values ('{ad}','{MARCA}','{USER}','AD{i}','video','{{}}'::jsonb,{'true' if i < 4 else 'false'});""")
        db.psql(f"""insert into public.ci_assets
            (id,brand_id,user_id,sha256,storage_key,media_type,duration_seconds)
            values ('{asset}','{MARCA}','{USER}','h{i}','k{i}','video',30);""")
        db.psql(f"""insert into public.ci_ad_assets(ad_id,asset_id,user_id,role)
            values ('{ad}','{asset}','{USER}','primary');""")

        # Cenas: hook, hook, demo, cta. As duas primeiras têm que colapsar.
        for j, fn in enumerate(["hook", "hook", "demo", "cta"]):
            db.psql(f"""insert into public.ci_scenes
                (asset_id,brand_id,user_id,scene_index,start_seconds,end_seconds,
                 scene_function,framing,setting_kind)
                values ('{asset}','{MARCA}','{USER}',{j},{j*5},{j*5+5},
                        '{fn}','close-up','home');""")

        termos = [
            ("hook", HOOKS[i % 3], "ev do hook"),
            ("product", "compression bodysuit", "ev do produto"),
            # o MESMO produto, outro kind: não pode contar duas vezes
            ("product_type", "compression bodysuit", "ev do tipo"),
            ("angle", "back support", "ev do angulo"),
            ("proof", "customer testimonial", "ev da prova"),
        ]
        # Um hook sem evidência, que tem que sumir.
        if i == 0:
            termos.append(("hook", "hook fantasma", ""))

        for k, (kind, label, ev) in enumerate(termos):
            termo = f"cccc{i:02d}{k}0-cccc-cccc-cccc-cccccccccccc"
            db.psql(f"""insert into public.ci_taxonomy_terms
                (id,brand_id,user_id,kind,slug,label)
                values ('{termo}','{MARCA}','{USER}','{kind}','t{i}{k}',$${label}$$);""")
            db.psql(f"""insert into public.ci_ad_taxonomy
                (ad_id,term_id,brand_id,user_id,confidence,evidence,source)
                values ('{ad}','{termo}','{MARCA}','{USER}',0.9,$${ev}$$,'gemini');""")

    # ══ Hooks ════════════════════════════════════════════════════════════════
    saida = db.psql(f"""
      select label, assets, receitas, coalesce(estrutura,'-'), coalesce(primeiro_frame,'-'),
             duracao_media_s
        from public.ci_hook_patterns('{MARCA}');
    """)
    print(saida)
    linhas = [[c.strip() for c in l.split("|")]
              for l in saida.strip().split("\n")[2:] if "|" in l]

    check("três grafias do mesmo hook viram UM padrão", len(linhas) == 1, str(linhas))
    if linhas:
        check("o padrão soma os 6 anúncios, não 2", linhas[0][1] == "6", linhas[0][1])
        check("cenas seguidas com a mesma função colapsam",
              linhas[0][3] == "hook → demo → cta", linhas[0][3])
        check("o primeiro frame vem da primeira cena",
              linhas[0][4] == "close-up, home", linhas[0][4])
        check("duração média é calculada", linhas[0][5] == "30", linhas[0][5])
        # Empate de grafia: a minúscula tem que ganhar, porque é a convenção
        # que a regra 9 do prompt impõe ao modelo. Desempatar por alfabeto
        # exibiria a grafia que o próprio produto pede para não usar.
        check("no empate de grafia, a minúscula vence o ASCII",
              linhas[0][0] == "if you struggle with back pain", linhas[0][0])
    check("hook sem evidência não vira padrão", "fantasma" not in saida)

    ex = db.psql(f"select jsonb_array_length(exemplos) from public.ci_hook_patterns('{MARCA}');")
    check("o padrão carrega exemplos com evidência",
          int(ex.strip().split("\n")[2].strip()) == 6, ex.strip().split("\n")[2].strip())

    # ══ Produtos ═════════════════════════════════════════════════════════════
    prod = db.psql(f"""
      select produto, assets, receitas, ativos, angulos::text, provas::text
        from public.ci_product_playbook('{MARCA}');
    """)
    print(prod)
    plinhas = [[c.strip() for c in l.split("|")]
               for l in prod.strip().split("\n")[2:] if "|" in l]

    check("product e product_type do mesmo produto viram UMA linha",
          len(plinhas) == 1, str(len(plinhas)))
    if plinhas:
        # A armadilha principal: 6 anúncios, cada um marcado duas vezes.
        check("o anúncio marcado duas vezes conta UMA vez",
              plinhas[0][1] == "6", plinhas[0][1])
        check("anúncios ativos são contados à parte",
              plinhas[0][3] == "4", plinhas[0][3])
        angulos = json.loads(plinhas[0][4])
        check("o ângulo do produto aparece com a contagem certa",
              len(angulos) == 1 and angulos[0]["ads"] == 6, str(angulos))
        provas = json.loads(plinhas[0][5])
        check("a prova do produto aparece", len(provas) == 1, str(provas))

    # ══ Marca sem dado ═══════════════════════════════════════════════════════
    # Uma marca vazia tem que devolver zero linhas, não erro: a tela precisa
    # saber a diferença entre "não há padrão" e "a consulta quebrou".
    vazia = "33333333-3333-3333-3333-333333333333"
    db.psql(f"""insert into public.ci_brands(id,user_id,slug,name)
                values ('{vazia}','{USER}','vazia','Vazia');""")
    n = db.psql(f"select count(*) from public.ci_hook_patterns('{vazia}');")
    check("marca sem anúncio devolve zero linhas, sem erro",
          n.strip().split("\n")[2].strip() == "0", n.strip().split("\n")[2].strip())

    print("\n" + ("TODOS OS TESTES PASSARAM" if PASSOU else "HOUVE FALHA"))
    return 0 if PASSOU else 1


if __name__ == "__main__":
    sys.exit(main())
