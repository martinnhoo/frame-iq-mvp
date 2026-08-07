"""
Camada semântica: transforma keyframes + transcript + texto na tela em
taxonomia criativa com evidência.

── A regra que governa este arquivo ─────────────────────────────────────────
Toda classificação sai com `label`, `confidence`, `evidence`, `timestamp_s`,
`source` e `model_version`. Sem isso a base vira opinião de LLM sem rastro, e
seis meses depois ninguém consegue responder por que o sistema disse que o
hook daquele anúncio era "problema-agitação".

O contrato de saída é inspirado no que já existia num protótipo anterior
(transcript, onscreen_text, scenes, products, hooks, angles, proofs, offers,
ctas, creative_analysis), mas com o envelope de evidência que faltava lá.

── Autenticação do Gemini ───────────────────────────────────────────────────
A chave vai no header `x-goog-api-key`. NÃO use `?key=` na URL nem
`Authorization: Bearer` — as duas formas devolvem 401 com o formato de chave
atual. Isto foi verificado contra a API, e é o mesmo erro que derrubou dois
protótipos anteriores deste módulo.

── Privacidade ──────────────────────────────────────────────────────────────
O prompt proíbe explicitamente identificar pessoas e inferir etnia, religião,
orientação, saúde ou idade. Pessoas são referidas por posição na cena
("mulher à esquerda"), nunca por identidade. O agrupamento de rostos é
separado, anônimo e por marca.
"""
from __future__ import annotations

import base64
import json
import re
import time
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .config import Settings

PROMPT_VERSION = "semantic/v1"

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# Preço do Gemini 2.5 Flash em USD por milhão de tokens (entrada/saída).
# Fica aqui para o custo por análise ser calculado e gravado, não estimado
# depois por chute.
PRICE_PER_M_INPUT = 0.30
PRICE_PER_M_OUTPUT = 2.50


class SemanticError(RuntimeError):
    pass


@dataclass
class SemanticResult:
    normalized: dict[str, Any]
    raw: dict[str, Any]
    provider: str
    model: str
    prompt_version: str
    # 'full' quando o LLM rodou; 'degraded' quando caiu na heurística local.
    # A UI mostra a diferença — resultado de fallback não pode se passar por
    # análise completa.
    fidelity: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    cost_usd: float | None = None
    latency_ms: int | None = None
    warnings: list[str] = field(default_factory=list)


# ── Prompt ──────────────────────────────────────────────────────────────────

_SCHEMA_HINT = """{
  "scenes": [{"start": 0.0, "end": 2.5, "setting": "banheiro com espelho",
              "setting_kind": "home|studio|outdoor|retail|ugc-selfie",
              "description": "", "camera_style": "", "framing": "close-up|medium|wide",
              "action": "", "scene_function": "hook|problem|solution|demo|proof|offer|cta",
              "product_visible": true, "confidence": 0.0}],
  "products": [{"label": "", "product_type": "", "timestamp_s": 0.0,
                "evidence": "", "confidence": 0.0}],
  "hooks": [{"kind": "verbal|visual|written", "label": "", "timestamp_s": 0.0,
             "evidence": "", "evidence_kind": "speech|onscreen|copy|visual",
             "confidence": 0.0}],
  "angles": [{"label": "", "evidence": "", "confidence": 0.0}],
  "promises": [{"label": "", "evidence": "", "timestamp_s": 0.0, "confidence": 0.0}],
  "proofs": [{"label": "", "proof_type": "demonstration|testimonial|before_after|statistic|authority|social_proof",
              "evidence": "", "timestamp_s": 0.0, "confidence": 0.0}],
  "objections": [{"label": "", "evidence": "", "timestamp_s": 0.0, "confidence": 0.0}],
  "offers": [{"label": "", "evidence": "", "timestamp_s": 0.0, "confidence": 0.0}],
  "ctas": [{"label": "", "evidence": "", "timestamp_s": 0.0, "confidence": 0.0}],
  "creative_analysis": {
    "story_structure":  {"label": "", "evidence": ""},
    "emotional_tone":   {"label": "", "evidence": ""},
    "visual_style":     {"label": "", "evidence": ""},
    "editing_rhythm":   {"label": "", "evidence": ""}},
  "timing": {"time_to_product_s": null, "time_to_offer_s": null,
             "time_to_cta_s": null, "hook_duration_s": null},
  "flags": {"has_before_after": false, "has_testimonial": false,
            "has_problem_solution": false, "has_urgency": false,
            "has_social_proof": false, "has_demonstration": false}
}"""


def build_prompt(transcript_text: str, segments: list[dict], onscreen: list[dict],
                 metadata: dict[str, Any]) -> str:
    seg_lines = "\n".join(
        f"  [{s.get('start_seconds', 0):.1f}–{s.get('end_seconds', 0):.1f}] {s.get('text', '')}"
        for s in segments[:120]
    ) or "  (sem fala detectada)"
    ost_lines = "\n".join(
        f"  [{t.get('start_seconds', 0):.1f}–{t.get('end_seconds', 0):.1f}] {t.get('text', '')}"
        for t in onscreen[:80]
    ) or "  (sem texto na tela detectado)"

    return f"""Você analisa criativos publicitários. Recebe os keyframes de um anúncio em vídeo, a transcrição da fala com marcação de tempo e o texto que aparece na tela.

REGRAS OBRIGATÓRIAS

1. Responda APENAS com JSON válido, sem cercas de código, sem comentários.
2. Toda classificação precisa de `evidence`: a frase falada, o texto na tela ou a descrição visual que sustenta aquela conclusão. Sem evidência, não afirme — omita o item.
3. `confidence` entre 0 e 1, e seja honesto: 0.4 quando estiver em dúvida é mais útil que 0.9 falso.
4. `timestamp_s` é o segundo do vídeo onde aquilo aparece. Use null se não souber.
5. NÃO identifique pessoas. NÃO infira etnia, religião, orientação sexual, condição de saúde, renda ou idade. Refira-se a pessoas pela posição na cena ("mulher à esquerda", "voz feminina"), nunca por identidade ou atributo pessoal.
6. Descreva o que ESTÁ no anúncio. Não avalie se é bom, não sugira melhorias, não estime desempenho.
7. Se o vídeo não tiver fala, trabalhe com o visual e o texto na tela. Não invente diálogo.

METADADOS
  duração: {metadata.get('duration_s')}s · {metadata.get('width')}x{metadata.get('height')} · {metadata.get('aspect_ratio')}
  cortes detectados: {metadata.get('cut_count')}

TRANSCRIÇÃO
{seg_lines}

TEXTO NA TELA
{ost_lines}

COPY DO ANÚNCIO
  {(metadata.get('body_text') or '(não disponível)')[:800]}

FORMATO DA RESPOSTA — use exatamente estas chaves:
{_SCHEMA_HINT}
"""


# ── Gemini ──────────────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict[str, Any]:
    """
    Extrai o JSON da resposta. O modelo às vezes embrulha em ```json apesar da
    instrução, e às vezes escreve uma frase antes.
    """
    cleaned = text.strip()
    fence = re.search(r"```(?:json)?\s*(.+?)\s*```", cleaned, re.DOTALL)
    if fence:
        cleaned = fence.group(1)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Último recurso: o maior bloco entre chaves.
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(cleaned[start:end + 1])
        except json.JSONDecodeError as exc:
            raise SemanticError(f"resposta não é JSON válido: {exc}") from exc
    raise SemanticError("resposta não contém JSON")


def analyze_with_gemini(
    settings: Settings,
    keyframes: list[Path],
    transcript_text: str,
    segments: list[dict],
    onscreen: list[dict],
    metadata: dict[str, Any],
) -> SemanticResult:
    if not settings.gemini_api_key:
        raise SemanticError("GEMINI_API_KEY não configurada")

    parts: list[dict[str, Any]] = [
        {"text": build_prompt(transcript_text, segments, onscreen, metadata)}
    ]

    # Mais de 16 frames raramente melhora a análise e multiplica o custo de
    # entrada — cada imagem custa tokens. Amostra uniforme preserva começo,
    # meio e fim.
    chosen = keyframes
    if len(keyframes) > 16:
        step = len(keyframes) / 16
        chosen = [keyframes[min(int(i * step), len(keyframes) - 1)] for i in range(16)]

    for frame in chosen:
        try:
            parts.append({
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": base64.b64encode(frame.read_bytes()).decode(),
                }
            })
        except OSError:
            continue

    body = json.dumps({
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "temperature": 0.2,
            "response_mime_type": "application/json",
        },
    }).encode()

    url = GEMINI_URL.format(model=settings.gemini_model)
    request = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type": "application/json",
        # x-goog-api-key, NÃO ?key= nem Bearer. Ver docstring do módulo.
        "x-goog-api-key": settings.gemini_api_key,
    })

    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310
            payload = json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:400]
        # A chave nunca aparece no corpo de erro do Google, mas redigir é
        # barato e a alternativa é descobrir o contrário em produção.
        detail = re.sub(r"AIza[A-Za-z0-9_\-]+|AQ\.[A-Za-z0-9_\-]+", "***", detail)
        raise SemanticError(f"Gemini HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise SemanticError(f"Gemini inacessível: {exc.reason}") from exc

    latency_ms = int((time.monotonic() - started) * 1000)

    try:
        text = payload["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        finish = (payload.get("candidates") or [{}])[0].get("finishReason")
        raise SemanticError(f"Gemini não devolveu texto (finishReason={finish})") from exc

    parsed = _extract_json(text)

    usage = payload.get("usageMetadata", {})
    tin = usage.get("promptTokenCount")
    tout = usage.get("candidatesTokenCount")
    cost = None
    if isinstance(tin, int) and isinstance(tout, int):
        cost = round(tin / 1e6 * PRICE_PER_M_INPUT + tout / 1e6 * PRICE_PER_M_OUTPUT, 6)

    return SemanticResult(
        normalized=normalize_semantic(parsed, provider="gemini", model=settings.gemini_model),
        raw=parsed,
        provider="gemini",
        model=settings.gemini_model,
        prompt_version=PROMPT_VERSION,
        fidelity="full",
        input_tokens=tin, output_tokens=tout, cost_usd=cost, latency_ms=latency_ms,
    )


# ── Normalização ────────────────────────────────────────────────────────────

def _clamp(value: Any, low: float = 0.0, high: float = 1.0) -> float:
    try:
        return max(low, min(high, float(value)))
    except (TypeError, ValueError):
        return 0.0


def _num(value: Any) -> float | None:
    try:
        result = float(value)
        return result if result == result else None  # descarta NaN
    except (TypeError, ValueError):
        return None


def _slug(label: str) -> str:
    """
    O slug é a chave de agrupamento da taxonomia: dois rótulos com o mesmo slug
    viram o mesmo termo.

    Por isso acentos precisam ser transliterados, não descartados. Sem isto,
    "não enrola" viraria `n-o-enrola` e "nao enrola" viraria `nao-enrola` —
    dois termos distintos para a mesma ideia, fragmentando a contagem que a
    página Messages exibe e, por tabela, a assinatura dos conceitos.
    """
    decomposed = unicodedata.normalize("NFKD", label.lower().strip())
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    text = re.sub(r"[^a-z0-9]+", "-", ascii_only)
    return re.sub(r"^-|-$", "", text)[:80] or "sem-rotulo"


TERM_KINDS = {
    "products": "product", "hooks": "hook", "angles": "angle",
    "promises": "promise", "proofs": "proof", "objections": "objection",
    "offers": "offer", "ctas": "cta",
}


def normalize_semantic(raw: dict[str, Any], *, provider: str, model: str) -> dict[str, Any]:
    """
    Converte a saída do modelo no formato que o banco espera, descartando o que
    não tem evidência.

    Item sem `evidence` é descartado de propósito, não corrigido: a regra do
    produto é que classificação sem lastro não entra na base. Melhor ter menos
    rótulos e confiar neles.
    """
    terms: list[dict[str, Any]] = []
    dropped = 0

    for key, kind in TERM_KINDS.items():
        for item in raw.get(key) or []:
            if not isinstance(item, dict):
                dropped += 1
                continue
            label = str(item.get("label") or "").strip()
            evidence = str(item.get("evidence") or "").strip()
            if not label or not evidence:
                dropped += 1
                continue

            # hooks têm subtipo (verbal/visual/written) que vira kind próprio
            item_kind = kind
            if kind == "hook":
                sub = str(item.get("kind") or "verbal").lower()
                item_kind = {"visual": "hook_visual", "written": "hook_written"}.get(sub, "hook")
            if kind == "proof" and item.get("proof_type"):
                evidence = f"[{item['proof_type']}] {evidence}"

            terms.append({
                "kind": item_kind,
                "slug": _slug(label),
                "label": label[:200],
                "confidence": _clamp(item.get("confidence")),
                "evidence": evidence[:1000],
                "evidence_kind": str(item.get("evidence_kind") or "inferred"),
                "timestamp_s": _num(item.get("timestamp_s")),
                "source": provider,
                "model_version": model,
            })

    # ── creative_analysis também vira termo ─────────────────────────────────
    #
    # Estilo visual, estrutura de história, tom e ritmo eram extraídos e
    # guardados SÓ dentro do JSON de ci_analysis_results. A UI lê
    # ci_taxonomy_terms, então o card "Mix criativo atual" ficava eternamente
    # vazio — o dado existia e não chegava a lugar nenhum.
    #
    # Aceita as duas formas: {"visual_style": {"label","evidence"}} do schema
    # novo, e a string solta que o modelo devolvia antes. A string vira termo
    # sem evidência e é DESCARTADA pela mesma regra dos outros — não abro
    # exceção para o formato antigo só para a tela encher.
    for campo, kind in (("story_structure", "story_structure"),
                        ("emotional_tone", "emotional_tone"),
                        ("visual_style", "visual_style"),
                        ("editing_rhythm", "editing_rhythm")):
        valor = (raw.get("creative_analysis") or {}).get(campo)
        if isinstance(valor, dict):
            label = str(valor.get("label") or "").strip()
            evidence = str(valor.get("evidence") or "").strip()
        else:
            label, evidence = str(valor or "").strip(), ""
        if not label or not evidence:
            if label:
                dropped += 1
            continue
        terms.append({
            "kind": kind,
            "slug": _slug(label),
            "label": label[:200],
            # O modelo não dá confiança para estes campos. 0.6 é um valor fixo
            # e declarado, não uma estimativa disfarçada de medição.
            "confidence": 0.6,
            "evidence": evidence[:1000],
            "evidence_kind": "visual",
            "timestamp_s": None,
            "source": provider,
            "model_version": model,
        })

    scenes = []
    for index, item in enumerate(raw.get("scenes") or []):
        if not isinstance(item, dict):
            continue
        start, end = _num(item.get("start")), _num(item.get("end"))
        if start is None or end is None or end < start:
            continue
        scenes.append({
            "scene_index": index,
            "start_seconds": round(start, 3),
            "end_seconds": round(end, 3),
            "setting": (item.get("setting") or None),
            "setting_kind": (item.get("setting_kind") or None),
            "description": (item.get("description") or None),
            "camera_style": (item.get("camera_style") or None),
            "framing": (item.get("framing") or None),
            "action": (item.get("action") or None),
            "scene_function": (item.get("scene_function") or None),
            "product_visible": bool(item.get("product_visible")),
            "confidence": _clamp(item.get("confidence")),
        })

    analysis = raw.get("creative_analysis") or {}
    timing = raw.get("timing") or {}
    flags = raw.get("flags") or {}

    return {
        "terms": terms,
        "scenes": scenes,
        "creative_analysis": {
            "story_structure": analysis.get("story_structure") or None,
            "emotional_tone": analysis.get("emotional_tone") or None,
            "visual_style": analysis.get("visual_style") or None,
            "editing_rhythm": analysis.get("editing_rhythm") or None,
        },
        "timing": {
            "time_to_product_s": _num(timing.get("time_to_product_s")),
            "time_to_offer_s": _num(timing.get("time_to_offer_s")),
            "time_to_cta_s": _num(timing.get("time_to_cta_s")),
            "hook_duration_s": _num(timing.get("hook_duration_s")),
        },
        "flags": {name: bool(flags.get(name)) for name in (
            "has_before_after", "has_testimonial", "has_problem_solution",
            "has_urgency", "has_social_proof", "has_demonstration",
        )},
        "dropped_without_evidence": dropped,
    }


# ── Fallback local ──────────────────────────────────────────────────────────

# Padrões que aparecem em anúncio de DTC em inglês. Não é classificação
# semântica de verdade — é o mínimo para a tela não ficar vazia quando não há
# chave de LLM, e sai marcado como 'degraded' justamente para ninguém
# confundir uma coisa com a outra.
_HEURISTICS: list[tuple[str, str, str]] = [
    ("cta", r"\b(shop now|buy now|get yours|order now|click|link in bio|tap|learn more)\b", "CTA direto"),
    ("offer", r"\b(\d{1,3}%\s*off|free shipping|bogo|discount|sale|save \$?\d+)\b", "Oferta explícita"),
    ("proof", r"\b(reviews?|rated|stars?|customers?|thousands|million|dermatologist|doctor)\b", "Prova social ou autoridade"),
    ("objection", r"\b(but|however|worried|afraid|skeptical|doesn'?t work|too expensive)\b", "Tratamento de objeção"),
    ("promise", r"\b(will|guarantee|promise|results in|in \d+ (days|weeks))\b", "Promessa de resultado"),
]


def analyze_locally(
    transcript_text: str,
    segments: list[dict],
    onscreen: list[dict],
    metadata: dict[str, Any],
) -> SemanticResult:
    """
    Fallback sem LLM. Sai SEMPRE com fidelity='degraded'.

    Ele existe para o pipeline não travar sem chave, não para substituir a
    análise. A UI precisa mostrar a diferença — um resultado degradado
    apresentado como completo seria pior que resultado nenhum.
    """
    haystack = " ".join([
        transcript_text or "",
        " ".join(str(t.get("text", "")) for t in onscreen),
        str(metadata.get("body_text") or ""),
    ]).lower()

    terms: list[dict[str, Any]] = []
    for kind, pattern, label in _HEURISTICS:
        match = re.search(pattern, haystack, re.IGNORECASE)
        if not match:
            continue
        # Acha em qual segmento a expressão aparece, para ter um timestamp real
        # em vez de null.
        timestamp = None
        for seg in segments:
            if match.group(0).lower() in str(seg.get("text", "")).lower():
                timestamp = _num(seg.get("start_seconds"))
                break
        terms.append({
            "kind": kind, "slug": _slug(label), "label": label,
            # Confiança baixa de propósito: é casamento de padrão, não análise.
            "confidence": 0.25,
            "evidence": f"expressão encontrada: “{match.group(0)}”",
            "evidence_kind": "inferred",
            "timestamp_s": timestamp,
            "source": "heuristic", "model_version": "local/v1",
        })

    # O primeiro segmento de fala é o hook verbal com alta probabilidade —
    # é onde o anúncio precisa prender.
    if segments:
        first = segments[0]
        text = str(first.get("text", "")).strip()
        if text:
            terms.append({
                "kind": "hook", "slug": _slug(text[:60]), "label": text[:200],
                "confidence": 0.3,
                "evidence": f"primeira fala do vídeo: “{text[:200]}”",
                "evidence_kind": "speech",
                "timestamp_s": _num(first.get("start_seconds")),
                "source": "heuristic", "model_version": "local/v1",
            })

    return SemanticResult(
        normalized={
            "terms": terms, "scenes": [],
            "creative_analysis": {k: None for k in
                                  ("story_structure", "emotional_tone", "visual_style", "editing_rhythm")},
            "timing": {k: None for k in
                       ("time_to_product_s", "time_to_offer_s", "time_to_cta_s", "hook_duration_s")},
            "flags": {name: False for name in (
                "has_before_after", "has_testimonial", "has_problem_solution",
                "has_urgency", "has_social_proof", "has_demonstration")},
            "dropped_without_evidence": 0,
        },
        raw={"heuristics_matched": len(terms)},
        provider="heuristic", model="local/v1", prompt_version="local/v1",
        fidelity="degraded",
        warnings=["Sem GEMINI_API_KEY: análise por casamento de padrão, não semântica."],
    )


def analyze(
    settings: Settings,
    keyframes: list[Path],
    transcript_text: str,
    segments: list[dict],
    onscreen: list[dict],
    metadata: dict[str, Any],
) -> SemanticResult:
    """Gemini quando há chave; heurística local marcada como degradada quando não."""
    if settings.gemini_api_key:
        try:
            return analyze_with_gemini(
                settings, keyframes, transcript_text, segments, onscreen, metadata)
        except SemanticError as exc:
            result = analyze_locally(transcript_text, segments, onscreen, metadata)
            result.warnings.append(f"Gemini falhou, caiu no fallback local: {exc}")
            return result
    return analyze_locally(transcript_text, segments, onscreen, metadata)
