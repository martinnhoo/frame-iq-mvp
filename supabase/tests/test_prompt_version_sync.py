#!/usr/bin/env python3
"""
A versão do prompt está duplicada em dois runtimes. Este teste é o que torna a
duplicação segura em vez de perigosa.

── Por que a constante existe em dois lugares ────────────────────────────────
O worker (Python) grava `prompt_version` em cada resultado. A edge function
(Deno) decide o que reanalisar comparando com a versão atual. As duas precisam
concordar, e não compartilham runtime.

A alternativa seria o worker publicar a versão numa tabela e a função ler de lá.
Isso troca uma constante duplicada por uma dependência de rede num caminho que
já é frágil — e não resolve nada que este teste não resolva.

── O que acontece se divergirem ──────────────────────────────────────────────
Nada visível, que é o pior tipo de falha.

Se a função ficar ATRÁS: o botão "Reanalisar" some, o usuário acha que está
tudo atualizado, e as receitas seguem sendo montadas com extração antiga.

Se ficar À FRENTE: o botão reenfileira TUDO a cada clique, para sempre, porque
nenhum resultado jamais alcança a versão que ela espera. Gemini cobrado em loop.

Nenhum dos dois dá erro. Por isso o teste.
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
PY = RAIZ / "ci-worker/worker/semantic.py"
TS = RAIZ / "supabase/functions/ci-requeue-analysis/index.ts"


def main() -> int:
    py_txt = PY.read_text(encoding="utf-8")
    ts_txt = TS.read_text(encoding="utf-8")

    py_m = re.search(r'^PROMPT_VERSION\s*=\s*"([^"]+)"', py_txt, re.M)
    ts_m = re.search(r'^const PROMPT_VERSION_ATUAL\s*=\s*"([^"]+)";', ts_txt, re.M)

    ok = True

    if not py_m:
        print("FAIL  PROMPT_VERSION não encontrado em ci-worker/worker/semantic.py")
        ok = False
    if not ts_m:
        print("FAIL  PROMPT_VERSION_ATUAL não encontrado em ci-requeue-analysis/index.ts")
        ok = False

    if py_m and ts_m:
        igual = py_m.group(1) == ts_m.group(1)
        print(f"{'PASS' if igual else 'FAIL'}  worker e edge function na mesma versão do prompt"
              f"  [{py_m.group(1)} vs {ts_m.group(1)}]")
        ok = ok and igual

    # Os estágios refeitos também precisam existir com esse nome no worker: se
    # alguém renomear um estágio no pipeline, o array da função passa a remover
    # nomes que não existem — silenciosamente, sem reanalisar nada.
    estagios_ts = re.search(r"ESTAGIOS_A_REFAZER\s*=\s*\[([^\]]+)\]", ts_txt)
    if not estagios_ts:
        print("FAIL  ESTAGIOS_A_REFAZER não encontrado")
        ok = False
    else:
        nomes = re.findall(r'"([^"]+)"', estagios_ts.group(1))
        analyze = (RAIZ / "ci-worker/worker/analyze.py").read_text(encoding="utf-8")
        bloco = re.search(r"STAGES\s*=\s*\[(.*?)\]", analyze, re.S)
        conhecidos = set(re.findall(r'"([^"]+)"', bloco.group(1))) if bloco else set()
        faltando = [n for n in nomes if n not in conhecidos]
        print(f"{'PASS' if not faltando else 'FAIL'}  todo estágio a refazer existe no pipeline"
              f"  [{nomes}]")
        if faltando:
            print(f"       não existem em STAGES: {faltando}")
            ok = False

    print("\n" + ("TODOS OS TESTES PASSARAM" if ok else "HOUVE FALHA"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
