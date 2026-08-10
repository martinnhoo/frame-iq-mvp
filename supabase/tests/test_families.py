#!/usr/bin/env python3
"""
B6 — ângulo e mecanismo com família de lista fechada.

O teste reproduz o caso REAL que quebrou o produto: os sete rótulos que a
Shapermint gerou para uma ideia só, que viraram sete receitas de um anúncio.

O que cada asserção protege:

  1. Sete redações da mesma família → UMA receita. É o defeito inteiro.
  2. Famílias diferentes continuam separadas. Uma correção que junta tudo numa
     receita só "resolveria" o número e destruiria o produto.
  3. Termo de ângulo que NÃO é família não forma assinatura. É o que faz a
     análise antiga de texto livre parar de fragmentar sem precisar apagar
     nada — e o que impede a reanálise paga de parecer que não funcionou.
  4. O anúncio que só tem rótulo obsoleto vira ÓRFÃO, não vira receita
     silenciosa. Órfão é a verdade: ele não foi analisado sob este contrato.
  5. A tabela de famílias do banco bate com o enum do worker. Duas listas em
     lugares que ninguém compara é como as onze paletas que acabei de juntar.
"""
import glob
import re
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


def uma(db, sql):
    return db.psql(sql).strip().split("\n")[2].strip()


def termo(db, i, kind, slug, label):
    """
    Cria um termo e liga ao anúncio i. Com evidência — sem ela nada conta.

    O primeiro bloco do UUID tem OITO dígitos hex, e isso não é detalhe de
    formatação: com sete o Postgres recusa a linha, TODOS os inserts falham em
    silêncio (psql imprime ERROR e segue), e a função recebe zero dados. O teste
    então "reprova" por um motivo que não tem nada a ver com o que ele testa.
    Já me custou uma rodada hoje.
    """
    tid = f"ccc{i:02d}{abs(hash(kind + slug)) % 1000:03d}-cccc-cccc-cccc-cccccccccccc"
    db.psql(f"""
      insert into public.ci_taxonomy_terms(id,brand_id,user_id,kind,slug,label)
        values ('{tid}','{MARCA}','{USER}','{kind}','{slug}','{label}')
        on conflict do nothing;
      insert into public.ci_ad_taxonomy(ad_id,term_id,brand_id,user_id,confidence,evidence,source)
        values ('aaaa{i:02d}aa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                (select id from public.ci_taxonomy_terms
                  where brand_id='{MARCA}' and kind='{kind}' and slug='{slug}' limit 1),
                '{MARCA}','{USER}',0.8,'disse na tela','gemini');
    """)


def main():
    db = pgserver.get_server(tempfile.mkdtemp(prefix="ci-fam-"))
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
    """)

    # ── Os sete rótulos reais, todos da família `fit` ───────────────────────
    #
    # É literalmente o que estava no banco de produção. Em v6 cada um destes
    # era o `label` do ângulo e cada um virou uma receita.
    REAIS = ["stays in place", "stays in place + no wires", "stays in place + thick band",
             "stays in place + wireless design", "comfortable fit + no wires",
             "wire-free comfort + wire-free construction", "comfort"]

    for i, detalhe in enumerate(REAIS):
        db.psql(f"""insert into public.ci_ads
          (id,brand_id,user_id,ad_archive_id,media_type,raw_payload,is_demo,is_active)
          values ('aaaa{i:02d}aa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{MARCA}','{USER}',
                  'AD{i}','video','{{}}'::jsonb,false,true);""")
        termo(db, i, "angle", "fit", "caimento e ajuste")
        termo(db, i, "angle_detail", re.sub(r"[^a-z0-9]+", "-", detalhe), detalhe)

    # Dois anúncios de OUTRA família, para provar que não virou tudo um bolo.
    for i in (7, 8):
        db.psql(f"""insert into public.ci_ads
          (id,brand_id,user_id,ad_archive_id,media_type,raw_payload,is_demo,is_active)
          values ('aaaa{i:02d}aa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{MARCA}','{USER}',
                  'AD{i}','video','{{}}'::jsonb,false,true);""")
        termo(db, i, "angle", "price_value", "preço e custo-benefício")

    # Um anúncio como os de hoje: ângulo de TEXTO LIVRE, do contrato antigo.
    db.psql(f"""insert into public.ci_ads
      (id,brand_id,user_id,ad_archive_id,media_type,raw_payload,is_demo,is_active)
      values ('aaaa09aa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{MARCA}','{USER}',
              'AD9','video','{{}}'::jsonb,false,true);""")
    termo(db, 9, "angle", "permanece-no-lugar", "Permanece no lugar")

    # ── Antes de afirmar qualquer coisa, o teste confere que ele mesmo montou
    #    o cenário. `db.psql` NÃO levanta exceção em erro de SQL: imprime ERROR
    #    e retorna normal. Sem esta guarda, um insert quebrado faz a função
    #    receber zero linhas e as asserções reprovam por um motivo que não é o
    #    que está sendo testado — foi exatamente o que aconteceu na primeira
    #    rodada deste arquivo.
    n_ads = uma(db, f"select count(*) from public.ci_ads where brand_id='{MARCA}';")
    n_vinc = uma(db, f"select count(*) from public.ci_ad_taxonomy where brand_id='{MARCA}';")
    check("o cenário foi montado: 10 anúncios", n_ads == "10", n_ads)
    check("o cenário foi montado: 17 vínculos anúncio↔termo",
          n_vinc == "17", f"{n_vinc} (7 fit + 7 detalhes + 2 preço + 1 obsoleto)")
    if not PASSOU:
        print("\nCenário não montou — não adianta avaliar o resto.")
        return 1

    r = db.psql(f"select * from public.ci_rebuild_concepts('{MARCA}');")
    print(r)
    criados, membros, orfaos = [c.strip() for c in r.strip().split("\n")[2].split("|")]

    # ── 1. O defeito ────────────────────────────────────────────────────────
    n_fit = uma(db, f"""select count(distinct cm.concept_id)
                          from public.ci_concept_members cm
                         where cm.ad_id in (
                           {','.join(f"'aaaa{i:02d}aa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'" for i in range(7))});""")
    check("as 7 redações de `fit` viram UMA receita, não sete",
          n_fit == "1", f"{n_fit} receitas")

    ads_na_receita = uma(db, f"""select ad_count from public.ci_concepts
                                  where brand_id='{MARCA}' and signature like 'fit|%';""")
    check("essa receita tem os 7 anúncios dentro", ads_na_receita == "7", ads_na_receita)

    # ── 2. Não virou um bolo só ─────────────────────────────────────────────
    check("`price_value` continua sendo outra receita", criados == "2", f"criados={criados}")

    # ── 3. e 4. O rótulo obsoleto ───────────────────────────────────────────
    check("ângulo de texto livre NÃO forma receita", orfaos == "1", f"orfaos={orfaos}")
    fora = uma(db, """select count(*) from public.ci_concept_members
                       where ad_id='aaaa09aa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';""")
    check("e o anúncio dele fica fora de qualquer receita", fora == "0", f"{fora} vínculos")

    # ── O nome vem da tabela, não do que o modelo escreveu ──────────────────
    nome = uma(db, f"""select name from public.ci_concepts
                        where brand_id='{MARCA}' and signature like 'fit|%';""")
    check("o nome exibido é o da família, não uma das sete grafias",
          nome == "caimento e ajuste", nome)

    # ── O detalhe sobreviveu como eixo de variação ──────────────────────────
    cid = uma(db, f"""select id from public.ci_concepts
                       where brand_id='{MARCA}' and signature like 'fit|%';""")
    eixos = db.psql(f"""select kind, papel, n_valores
                          from public.ci_concept_variation('{cid}')
                         where kind = 'angle_detail';""")
    print(eixos)
    linha = [l for l in eixos.strip().split("\n")[2:] if "angle_detail" in l]
    check("a redação específica virou eixo de variação com os 7 valores",
          bool(linha) and linha[0].split("|")[2].strip() == "7",
          linha[0] if linha else "eixo ausente")
    check("e esse eixo é lido como VARIADO, que é o que a marca fez",
          bool(linha) and linha[0].split("|")[1].strip() == "variado",
          linha[0] if linha else "")

    # ── 5. As duas listas não podem divergir ────────────────────────────────
    #
    # Esta é a asserção que me salvaria de um bug mudo: se alguém acrescentar
    # família no worker e esquecer da migration, o termo chega ao banco, não
    # casa com ci_term_family, e o anúncio vira órfão em silêncio. Ninguém
    # olharia o worker para descobrir.
    sem = (RAIZ / "ci-worker/worker/semantic.py").read_text(encoding="utf-8")
    def do_worker(nome_dict):
        bloco = re.search(nome_dict + r": dict\[str, str\] = \{(.*?)\n\}", sem, re.S).group(1)
        return {m for m in re.findall(r'"([a-z_]+)":', bloco)} - {"unknown"}
    def do_banco(kind):
        saida = db.psql(f"select slug from public.ci_term_family where kind='{kind}' order by slug;")
        return {l.strip() for l in saida.strip().split("\n")[2:] if l.strip() and "|" not in l
                and "row" not in l and "linha" not in l}

    for kind, dicionario in (("angle", "FAMILIAS_ANGULO"), ("mechanism", "FAMILIAS_MECANISMO")):
        w, b = do_worker(dicionario), do_banco(kind)
        check(f"famílias de {kind}: worker e banco batem", w == b,
              f"só no worker {sorted(w - b)} · só no banco {sorted(b - w)}")

    print("\n" + ("TODOS OS TESTES PASSARAM" if PASSOU else "HOUVE FALHA"))
    return 0 if PASSOU else 1


if __name__ == "__main__":
    sys.exit(main())
