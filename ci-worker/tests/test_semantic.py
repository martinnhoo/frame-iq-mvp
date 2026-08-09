#!/usr/bin/env python3
"""
Teste da camada semântica.

    python ci-worker/tests/test_semantic.py

A maior parte roda offline: normalização, parse de JSON sujo e o fallback
heurístico são funções puras.

Se `GEMINI_API_KEY` estiver no ambiente, faz também UMA chamada real à API com
keyframes gerados por ffmpeg. Isso custa uma fração de centavo e prova o que
nenhum mock provaria: que o header de autenticação está certo, que o modelo
devolve JSON no formato pedido, e que a normalização aguenta a resposta real.

Sem a chave, esse trecho é PULADO e dito em voz alta — não silenciosamente
dado como aprovado.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import replace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from worker.config import load_settings  # noqa: E402
from worker.media import have  # noqa: E402
from worker.semantic import (  # noqa: E402
    PROMPT_VERSION,
    SemanticError,
    _extract_json,
    analyze,
    analyze_locally,
    analyze_with_gemini,
    build_prompt,
    normalize_semantic,
)

FAILURES: list[str] = []
PASSED = 0
SKIPPED: list[str] = []


def check(name: str, cond: bool, extra: str = "") -> None:
    global PASSED
    print(("PASS  " if cond else "FAIL  ") + name + (f"  [{extra}]" if extra else ""))
    if cond:
        PASSED += 1
    else:
        FAILURES.append(name)


def skip(name: str, why: str) -> None:
    SKIPPED.append(name)
    print(f"SKIP  {name}  [{why}]")


def main() -> int:
    settings = load_settings()

    # ══ Parse de JSON sujo ═══════════════════════════════════════════════════
    check("JSON limpo é parseado", _extract_json('{"a": 1}') == {"a": 1})
    check("JSON em cerca ```json é parseado",
          _extract_json('```json\n{"a": 2}\n```') == {"a": 2})
    check("JSON em cerca sem rótulo é parseado",
          _extract_json('```\n{"a": 3}\n```') == {"a": 3})
    check("JSON com frase antes é parseado",
          _extract_json('Aqui está a análise:\n{"a": 4}') == {"a": 4})
    try:
        _extract_json("desculpe, não consegui analisar")
        sem_json = False
    except SemanticError:
        sem_json = True
    check("resposta sem JSON vira erro explícito", sem_json)

    # ══ Normalização ═════════════════════════════════════════════════════════
    bruto = {
        "hooks": [
            {"kind": "verbal", "label": "Leggings que não enrolam",
             "evidence": "fala aos 0.5s: 'these never roll down'",
             "timestamp_s": 0.5, "confidence": 0.9},
            # sem evidência — deve ser DESCARTADO, não corrigido
            {"kind": "visual", "label": "Close no cós", "confidence": 0.8},
            {"kind": "written", "label": "NO ROLL", "evidence": "texto na tela aos 1.2s",
             "timestamp_s": 1.2, "confidence": 0.7},
        ],
        "proofs": [{"label": "Antes e depois", "proof_type": "before_after",
                    "evidence": "comparação lado a lado aos 4s", "confidence": 1.4}],
        "ctas": [{"label": "Shop now", "evidence": "botão aos 8s", "timestamp_s": 8}],
        "angles": [{"label": "", "evidence": "algo", "confidence": 0.5}],
        "scenes": [
            {"start": 0, "end": 2.5, "setting": "quarto", "setting_kind": "home",
             "scene_function": "hook", "product_visible": True, "confidence": 0.8},
            {"start": 5, "end": 2, "setting": "invertida"},  # fim < início: descartar
        ],
        # Formato NOVO (com evidência) e formato ANTIGO (string solta) juntos,
        # de propósito: o novo vira termo, o antigo é descartado pela mesma
        # regra de todo mundo. Não abro exceção para o legado só para a tela
        # encher.
        "mechanisms": [
            {"label": "silicone strips", "evidence": "faixas de silicone na barra",
             "confidence": 0.8},
            {"label": "sem evidencia", "evidence": "", "confidence": 0.9},
        ],
        "creative_analysis": {
            "visual_style": {"label": "UGC vertical", "evidence": "câmera na mão, 9:16, sem trilha"},
            "story_structure": "problema-solução",
            "emotional_tone": "confiante",
        },
        "timing": {"time_to_product_s": 1.5, "time_to_cta_s": 8.0, "time_to_offer_s": "nao-numero"},
        "flags": {"has_before_after": True, "has_urgency": "sim"},
    }
    n = normalize_semantic(bruto, provider="gemini", model="gemini-2.5-flash")

    labels = {t["label"] for t in n["terms"]}
    check("item SEM evidência é descartado, não corrigido",
          "Close no cós" not in labels, f"{len(n['terms'])} termos")
    # 2 dos itens com rótulo sem evidência + 2 do creative_analysis em formato
    # antigo (string solta, sem como sustentar).
    check("descarte é contado e reportado", n["dropped_without_evidence"] == 5,
          str(n["dropped_without_evidence"]))

    # REGRESSÃO — o mecanismo era o buraco mais caro do pipeline. O banco aceitava
    # kind='mechanism', a tela de saúde contava, e ci_rebuild_concepts passou a
    # usar mecanismo como METADE da assinatura da receita. Só que o prompt nunca
    # pediu o campo: contador em 0 com 516 vínculos ao lado. Três camadas
    # apoiadas num dado que ninguém produzia.
    mecanismo = next((t for t in n["terms"] if t["kind"] == "mechanism"), None)
    check("mecanismo COM evidência vira termo de taxonomia",
          mecanismo is not None and mecanismo["label"] == "silicone strips",
          str(mecanismo))
    check("mecanismo SEM evidência é descartado como qualquer outro",
          "sem evidencia" not in {t["label"] for t in n["terms"]})

    # REGRESSÃO — o estilo visual era extraído e guardado só dentro do JSON de
    # ci_analysis_results. A UI lê ci_taxonomy_terms, então o card "Mix criativo"
    # ficava eternamente vazio: o dado existia e não chegava a lugar nenhum.
    estilo = next((t for t in n["terms"] if t["kind"] == "visual_style"), None)
    check("estilo visual COM evidência vira termo de taxonomia",
          estilo is not None and estilo["label"] == "UGC vertical",
          str(estilo))
    check("creative_analysis em formato antigo NÃO vira termo",
          not any(t["kind"] in ("story_structure", "emotional_tone") for t in n["terms"]))
    check("item com rótulo vazio também é descartado", "" not in labels)

    kinds = {t["kind"] for t in n["terms"]}
    check("hook verbal, visual e escrito viram kinds distintos",
          "hook" in kinds and "hook_written" in kinds, str(sorted(kinds)))

    prova = next(t for t in n["terms"] if t["kind"] == "proof")
    check("confiança acima de 1 é limitada a 1", prova["confidence"] == 1.0,
          str(prova["confidence"]))
    check("proof_type entra na evidência", prova["evidence"].startswith("[before_after]"))

    hook = next(t for t in n["terms"] if t["kind"] == "hook")
    check("todo termo carrega source e model_version",
          hook["source"] == "gemini" and hook["model_version"] == "gemini-2.5-flash")
    check("slug transliterá acento em vez de descartar",
          hook["slug"] == "leggings-que-nao-enrolam", hook["slug"])
    # O slug é a chave de agrupamento: se acento virasse hífen, "não enrola" e
    # "nao enrola" seriam termos diferentes e a contagem da página Messages
    # ficaria fragmentada.
    from worker.semantic import _slug as _s  # noqa: PLC0415
    check("rótulos equivalentes com e sem acento colidem no mesmo slug",
          _s("Não enrola") == _s("nao enrola") == "nao-enrola", _s("Não enrola"))
    check("slug de rótulo só com símbolos não fica vazio", _s("!!!") == "sem-rotulo")

    check("cena com fim antes do início é descartada", len(n["scenes"]) == 1)
    check("timing não-numérico vira null em vez de quebrar",
          n["timing"]["time_to_offer_s"] is None and n["timing"]["time_to_cta_s"] == 8.0)
    check("flags viram booleano de verdade",
          n["flags"]["has_urgency"] is True and n["flags"]["has_social_proof"] is False)

    # ══ Prompt ═══════════════════════════════════════════════════════════════
    prompt = build_prompt("texto", [{"start_seconds": 0, "end_seconds": 1, "text": "olá"}],
                          [{"start_seconds": 0, "end_seconds": 1, "text": "NA TELA"}],
                          {"duration_s": 10, "width": 1080, "height": 1920})
    check("prompt proíbe identificar pessoas", "NÃO identifique pessoas" in prompt)
    check("prompt proíbe inferir atributos sensíveis",
          "etnia" in prompt and "religião" in prompt)
    check("prompt exige evidência", "evidence" in prompt and "Sem evidência" in prompt)
    check("prompt inclui a transcrição com tempo", "[0.0–1.0] olá" in prompt)
    check("prompt inclui o texto na tela", "NA TELA" in prompt)
    # Sem esta asserção o campo pode sumir do schema de novo e nada acusa: foi
    # exatamente assim que mecanismo ficou zerado por semanas.
    check("prompt PEDE mechanisms no schema", '"mechanisms"' in prompt)
    check("prompt explica a diferença entre ângulo e mecanismo",
          "MECANISMO = COMO" in prompt and "ÂNGULO    = POR QUE" in prompt)
    check("prompt proíbe inventar mecanismo para preencher",
          "NÃO invente um mecanismo" in prompt)
    # O prompt agora fala de JULGAMENTO, não de formato — o formato é imposto
    # pelo response_schema. Verificar que a orientação semântica continua lá:
    check("prompt explica que scene_function é o PAPEL, não o que aparece",
          "descreve o PAPEL da cena no roteiro" in prompt)
    check("o schema NÃO usa mais 'a|b|c' em scene_function",
          '"scene_function": "hook|problem' not in prompt)

    # ══ O contrato ═══════════════════════════════════════════════════════════
    # Isto é o que quebra o ciclo. Enquanto o formato dependia de o modelo
    # obedecer texto, cada defeito custava uma versão de prompt, um deploy e uma
    # reanálise paga. Com response_schema, valor fora do enum não é improvável —
    # é impossível de decodificar.
    from worker.semantic import RESPONSE_SCHEMA, FUNCOES_ENUM  # noqa: PLC0415

    cena = RESPONSE_SCHEMA["properties"]["scenes"]["items"]
    check("scene_function é enum fechado no contrato",
          cena["properties"]["scene_function"]["enum"] == FUNCOES_ENUM)
    check("scene_function é obrigatório — era ele que faltava em 74% das cenas",
          "scene_function" in cena["required"])
    check("o enum inclui 'unknown', para o modelo não ser forçado a chutar",
          "unknown" in FUNCOES_ENUM)
    check("framing e setting_kind também são enum",
          "enum" in cena["properties"]["framing"]
          and "enum" in cena["properties"]["setting_kind"])
    check("hook exige kind, label e evidence",
          set(RESPONSE_SCHEMA["properties"]["hooks"]["items"]["required"])
          == {"kind", "label", "evidence"})
    check("mechanisms está no contrato",
          "mechanisms" in RESPONSE_SCHEMA["properties"])
    check("todo item de taxonomia exige evidence",
          all("evidence" in RESPONSE_SCHEMA["properties"][k]["items"]["required"]
              for k in ("products", "hooks", "angles", "mechanisms", "promises",
                        "proofs", "objections", "offers", "ctas")))

    # ── scene_function: o enum voltando como resposta ───────────────────────
    # Visto em produção. Uma estrutura de roteiro saiu como
    #   hook|problem → Problema → solution|proof → solution|demo
    # porque o modelo copiou de volta a lista de opções do schema. A estrutura
    # é chave de agrupamento: cada combinação vira uma estrutura diferente, e o
    # padrão que existia se dissolve.
    from worker.semantic import _funcao_de_cena as _fc  # noqa: PLC0415
    check("enum copiado de volta vira o primeiro valor válido",
          _fc("hook|problem") == "hook", str(_fc("hook|problem")))
    check("enum inteiro do schema também é resolvido",
          _fc("hook|problem|solution|demo|proof|offer|cta") == "hook")
    check("sinônimo comum é mapeado, não descartado",
          _fc("objection handling") == "objection", str(_fc("objection handling")))
    check("demonstration vira demo, para não virar duas funções",
          _fc("demonstration") == "demo", str(_fc("demonstration")))
    check("maiúscula e espaço não atrapalham", _fc("  PROOF ") == "proof")
    check("valor inventado vira None, não texto livre",
          _fc("cena de abertura bonita") is None, str(_fc("cena de abertura bonita")))
    check("vazio vira None", _fc("") is None and _fc(None) is None)
    check("só barras vira None", _fc("|||") is None, str(_fc("|||")))
    check("'unknown' vira None — é resposta do contrato, não erro",
          _fc("unknown") is None)

    # ── Violações são CONTADAS, não corrigidas em silêncio ──────────────────
    # Com response_schema isto deveria ficar sempre vazio. É por isso que vale
    # contar: no dia em que o contrato deixar de valer — modelo trocado, campo
    # renomeado — alguém precisa saber no primeiro anúncio.
    n_viol = normalize_semantic(
        {"scenes": [{"start": 0, "end": 1, "scene_function": "hook|problem"},
                    {"start": 1, "end": 2, "scene_function": "coisa inventada"},
                    {"start": 2, "end": 3, "scene_function": "unknown"},
                    {"start": 3, "end": 4, "scene_function": "demo"}]},
        provider="gemini", model="m")
    check("saída fora do contrato é registrada",
          len(n_viol["violacoes_de_contrato"]) == 2,
          str(n_viol["violacoes_de_contrato"]))
    check("'unknown' e valor válido NÃO contam como violação",
          not any("unknown" in v or "'demo'" in v for v in n_viol["violacoes_de_contrato"]),
          str(n_viol["violacoes_de_contrato"]))
    # A cena entra na lista mesmo sem função: descartá-la perderia a duração e
    # o enquadramento, que são observações válidas.
    n_cena = normalize_semantic(
        {"scenes": [{"start": 0, "end": 2, "scene_function": "coisa inventada"}]},
        provider="gemini", model="m")
    check("cena com função inválida é mantida, com função nula",
          len(n_cena["scenes"]) == 1 and n_cena["scenes"][0]["scene_function"] is None,
          str(n_cena["scenes"]))

    # ══ O fallback NÃO pode ser silencioso ═══════════════════════════════════
    #
    # 37 dos 40 anúncios em produção tinham prompt_version 'local/v1'. Uma
    # falha transitória do Gemini virava dado permanente de regex, e nada na
    # tela dizia isso. O produto inteiro foi montado sobre isso por semanas.
    # SemanticError já vem do import no topo. Reimportar aqui criaria um nome
    # local e o `except` falharia com UnboundLocalError antes de chegar no try.
    import dataclasses  # noqa: PLC0415
    import worker.semantic as _sem  # noqa: PLC0415

    base = dataclasses.replace(settings, gemini_api_key="chave-que-vai-falhar")
    original = _sem.analyze_with_gemini
    _sem.analyze_with_gemini = lambda *a, **k: (_ for _ in ()).throw(
        SemanticError("500 do Gemini"))
    try:
        erro_subiu = False
        try:
            analyze(base, [], "t", [], [], {}, permitir_fallback=False)
        except SemanticError:
            erro_subiu = True
        check("com tentativas sobrando, a falha SOBE e o job vai para retry",
              erro_subiu)

        ultimo = analyze(base, [], "t", [], [], {}, permitir_fallback=True)
        check("só na última tentativa cai na heurística",
              ultimo.fidelity == "degraded", ultimo.fidelity)
        check("e o resultado diz, por escrito, que não foi o modelo",
              any("heurística local" in w for w in ultimo.warnings),
              str(ultimo.warnings))
    finally:
        _sem.analyze_with_gemini = original

    sem_chave = dataclasses.replace(base, gemini_api_key="")
    r_sem = analyze(sem_chave, [], "t", [], [], {})
    check("sem chave, degrada na hora — mas marcado",
          r_sem.fidelity == "degraded"
          and any("GEMINI_API_KEY ausente" in w for w in r_sem.warnings),
          str(r_sem.warnings))

    # ══ Fallback local ═══════════════════════════════════════════════════════
    local = analyze_locally(
        "these leggings will never roll down, guarantee results in 7 days",
        [{"start_seconds": 0.4, "end_seconds": 3.0,
          "text": "these leggings will never roll down"}],
        [{"start_seconds": 1.0, "end_seconds": 2.0, "text": "SHOP NOW 30% OFF"}],
        {"body_text": "Rated 5 stars by thousands of customers"},
    )
    check("fallback local é sempre marcado como degraded", local.fidelity == "degraded")
    # A heurística NÃO afirma o motivo — ela não sabe. Era chamada tanto por
    # falta de chave quanto por falha do Gemini, e dizia "Sem GEMINI_API_KEY"
    # nos dois casos. Essa mensagem mandou o diagnóstico do fallback silencioso
    # para o lado errado por horas: a chave existia.
    check("o fallback diz que não foi o modelo",
          any("não semântica" in w for w in local.warnings), str(local.warnings))
    check("o fallback NÃO afirma um motivo que não conhece",
          not any("GEMINI_API_KEY" in w for w in local.warnings), str(local.warnings))
    achados = {t["kind"] for t in local.normalized["terms"]}
    check("heurística acha CTA, oferta e prova social",
          {"cta", "offer", "proof"} <= achados, str(sorted(achados)))
    check("heurística usa confiança baixa de propósito",
          all(t["confidence"] <= 0.3 for t in local.normalized["terms"]))
    check("primeira fala vira hook com timestamp real",
          any(t["kind"] == "hook" and t["timestamp_s"] == 0.4
              for t in local.normalized["terms"]))

    vazio = analyze_locally("", [], [], {})
    check("vídeo sem nada não quebra a heurística",
          vazio.fidelity == "degraded" and vazio.normalized["terms"] == [])

    # Sem chave, analyze() cai no local sem lançar.
    sem_chave = analyze(replace(settings, gemini_api_key=""), [], "oi", [], [], {})
    check("analyze() sem chave devolve degraded em vez de falhar",
          sem_chave.fidelity == "degraded")

    # ══ Chamada REAL ao Gemini ═══════════════════════════════════════════════
    if not settings.gemini_api_key:
        skip("chamada real ao Gemini", "GEMINI_API_KEY não está no ambiente")
    elif not have("ffmpeg"):
        skip("chamada real ao Gemini", "ffmpeg ausente, sem como gerar keyframes")
    else:
        work = Path(tempfile.mkdtemp(prefix="ci-sem-test-"))
        try:
            frames = []
            for i, cor in enumerate(["red", "blue"]):
                frame = work / f"kf{i}.jpg"
                subprocess.run([
                    "ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi",
                    "-i", f"testsrc=size=640x360:duration=1:rate=1",
                    "-frames:v", "1", str(frame),
                ], capture_output=True, timeout=60)
                if frame.exists():
                    frames.append(frame)

            resultado = analyze_with_gemini(
                settings, frames,
                "these leggings never roll down. shop now and get thirty percent off.",
                [{"start_seconds": 0.0, "end_seconds": 3.0,
                  "text": "these leggings never roll down"},
                 {"start_seconds": 3.0, "end_seconds": 6.0,
                  "text": "shop now and get thirty percent off"}],
                [{"start_seconds": 0.5, "end_seconds": 2.0, "text": "NO ROLL DOWN"},
                 {"start_seconds": 4.0, "end_seconds": 6.0, "text": "30% OFF"}],
                {"duration_s": 6.0, "width": 640, "height": 360,
                 "aspect_ratio": "16:9", "cut_count": 1,
                 "body_text": "Leggings that stay up. No rolling, ever."},
            )
            check("Gemini responde e o header de auth está certo",
                  resultado.fidelity == "full", f"{resultado.latency_ms}ms")
            check("Gemini devolve JSON parseável no formato pedido",
                  isinstance(resultado.raw, dict) and len(resultado.raw) > 0,
                  f"{len(resultado.raw)} chaves")
            check("a normalização extrai termos da resposta real",
                  len(resultado.normalized["terms"]) > 0,
                  f"{len(resultado.normalized['terms'])} termos")
            check("todo termo da resposta real tem evidência",
                  all(t["evidence"] for t in resultado.normalized["terms"]))
            check("uso de tokens e custo são registrados",
                  resultado.input_tokens is not None and resultado.cost_usd is not None,
                  f"{resultado.input_tokens}in/{resultado.output_tokens}out "
                  f"= US$ {resultado.cost_usd}")
            check("versão de prompt é gravada", resultado.prompt_version == PROMPT_VERSION)

            achados_reais = {t["kind"] for t in resultado.normalized["terms"]}
            print(f"      kinds devolvidos: {sorted(achados_reais)}")
            exemplo = resultado.normalized["terms"][0] if resultado.normalized["terms"] else {}
            if exemplo:
                print(f"      exemplo: [{exemplo['kind']}] {exemplo['label']!r}")
                print(f"               evidência: {exemplo['evidence'][:90]!r}")
        finally:
            shutil.rmtree(work, ignore_errors=True)

    print()
    if SKIPPED:
        print(f"PULADOS ({len(SKIPPED)}): {SKIPPED}")
    if FAILURES:
        print(f"FALHAS ({len(FAILURES)}/{PASSED + len(FAILURES)}): {FAILURES}")
        return 1
    print(f"TODOS OS {PASSED} TESTES PASSARAM")
    return 0


if __name__ == "__main__":
    sys.exit(main())
