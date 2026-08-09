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

# v2: regras 8 e 9 — label em inglês, curto e canônico.
# v6: response_schema na API. O formato deixa de ser pedido e passa a ser
#     imposto — campo com enum não consegue voltar inválido. As regras de
#     formato saíram do prompt; sobrou o que é julgamento (o que colocar em
#     cada campo), que é o que prompt sabe fazer.
# v5: a notação "a|b|c" do schema era a CAUSA de o modelo devolver o cardápio
#     como resposta. Trocada por "<UMA de: a, b, c>" em todos os campos de
#     lista fechada. Regra 11 também deixou de convidar ao null: 472 das 638
#     cenas estavam sem função, e sem função não há estrutura de roteiro.
# v4: regra 11 — `scene_function` com UM valor. O modelo devolvia o enum
#     inteiro do schema ("hook|problem") e inventava valores fora da lista.
#     A estrutura de roteiro é chave de agrupamento: cada combinação virava uma
#     estrutura diferente e o padrão se dissolvia.
# v3: `mechanisms`. O banco aceitava kind='mechanism', a tela de saúde contava,
#     e ci_rebuild_concepts passou a usar mecanismo como METADE da assinatura da
#     receita — mas o prompt nunca pediu o campo. Três camadas apoiadas num dado
#     que ninguém produzia; o contador ficou em 0 com 516 vínculos ao lado.
#
# Sem bumpar a versão, resultado de prompt velho e novo ficam indistinguíveis no
# banco, e "este anúncio já foi reanalisado?" não tem resposta.
PROMPT_VERSION = "semantic/v6"

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
              "setting_kind": "<UMA de: home, studio, outdoor, retail, ugc-selfie>",
              "description": "", "camera_style": "",
              "framing": "<UMA de: close-up, medium, wide>",
              "action": "",
              "scene_function": "<UMA de: hook, problem, solution, product, demo, proof, benefit, objection, offer, cta>",
              "product_visible": true, "confidence": 0.0}],
  "products": [{"label": "", "product_type": "", "timestamp_s": 0.0,
                "evidence": "", "confidence": 0.0}],
  "hooks": [{"kind": "<UMA de: verbal, visual, written>", "label": "", "timestamp_s": 0.0,
             "evidence": "", "evidence_kind": "<UMA de: speech, onscreen, copy, visual>",
             "confidence": 0.0}],
  "angles": [{"label": "", "evidence": "", "confidence": 0.0}],
  "mechanisms": [{"label": "", "evidence": "", "confidence": 0.0}],
  "promises": [{"label": "", "evidence": "", "timestamp_s": 0.0, "confidence": 0.0}],
  "proofs": [{"label": "",
              "proof_type": "<UMA de: demonstration, testimonial, before_after, statistic, authority, social_proof>",
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


# ── O contrato com o modelo ─────────────────────────────────────────────────
#
# Isto é a correção definitiva de uma classe inteira de bug, e a razão de ela
# existir merece ficar registrada.
#
# Em poucas horas o prompt foi de v2 a v5. Cada versão nasceu de um defeito
# descoberto DEPOIS de analisar quarenta anúncios: rótulo em português, rótulo
# longo demais, mecanismo ausente, "hook|problem" no lugar de "hook". A cada
# defeito eu escrevia mais uma regra em texto, e cada regra custava um deploy do
# worker e uma reanálise paga.
#
# O erro não era nenhum dos bugs. Era o método: eu estava PEDINDO ao modelo que
# respeitasse um formato, quando a API permite EXIGIR.
#
# `response_schema` faz o Gemini gerar sob restrição. Um campo com `enum` não
# pode voltar com valor fora da lista — não é o modelo se comportando bem, é a
# decodificação que não permite outra coisa. "hook|problem" e
# "objection handling" deixam de ser possíveis, não de ser prováveis.
#
# O que continua sendo trabalho de prompt: o que colocar em cada campo. O que
# passa a ser trabalho de schema: qual a forma. Confundir os dois foi o que me
# fez rodar em círculo.
FUNCOES_ENUM = [
    "hook", "problem", "solution", "product", "demo",
    "proof", "benefit", "objection", "offer", "cta",
    # "unknown" existe de propósito. Sem ele, um campo obrigatório com enum
    # força o modelo a escolher mesmo quando não há resposta — e aí ele chuta,
    # o que é pior que o buraco. Com ele, "não sei" é uma resposta que cabe no
    # contrato, e vira NULL no banco.
    "unknown",
]

def _txt(desc: str = "") -> dict[str, Any]:
    return {"type": "STRING", "description": desc} if desc else {"type": "STRING"}

RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "scenes": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "start": {"type": "NUMBER"},
                    "end": {"type": "NUMBER"},
                    "setting": _txt("onde a cena acontece"),
                    "setting_kind": {"type": "STRING",
                                     "enum": ["home", "studio", "outdoor", "retail",
                                              "ugc-selfie", "unknown"]},
                    "description": _txt(),
                    "camera_style": _txt(),
                    "framing": {"type": "STRING",
                                "enum": ["close-up", "medium", "wide", "unknown"]},
                    "action": _txt(),
                    "scene_function": {
                        "type": "STRING", "enum": FUNCOES_ENUM,
                        "description": "o PAPEL da cena no roteiro, não o que aparece nela",
                    },
                    "product_visible": {"type": "BOOLEAN"},
                    "confidence": {"type": "NUMBER"},
                },
                # scene_function é obrigatório: era ele que vinha faltando em 74%
                # das cenas, e sem função não existe estrutura de roteiro.
                "required": ["start", "end", "scene_function"],
            },
        },
        "products": {"type": "ARRAY", "items": {
            "type": "OBJECT",
            "properties": {"label": _txt(), "product_type": _txt(),
                           "timestamp_s": {"type": "NUMBER"}, "evidence": _txt(),
                           "confidence": {"type": "NUMBER"}},
            "required": ["label", "evidence"]}},
        "hooks": {"type": "ARRAY", "items": {
            "type": "OBJECT",
            "properties": {
                "kind": {"type": "STRING", "enum": ["verbal", "visual", "written"]},
                "label": _txt(), "timestamp_s": {"type": "NUMBER"}, "evidence": _txt(),
                "evidence_kind": {"type": "STRING",
                                  "enum": ["speech", "onscreen", "copy", "visual", "inferred"]},
                "confidence": {"type": "NUMBER"}},
            "required": ["kind", "label", "evidence"]}},
        "angles": {"type": "ARRAY", "items": {
            "type": "OBJECT",
            "properties": {"label": _txt("POR QUE a pessoa deveria se importar"),
                           "evidence": _txt(), "confidence": {"type": "NUMBER"}},
            "required": ["label", "evidence"]}},
        "mechanisms": {"type": "ARRAY", "items": {
            "type": "OBJECT",
            "properties": {"label": _txt("COMO o produto entrega — material, construção"),
                           "evidence": _txt(), "confidence": {"type": "NUMBER"}},
            "required": ["label", "evidence"]}},
        "promises": {"type": "ARRAY", "items": {
            "type": "OBJECT",
            "properties": {"label": _txt(), "evidence": _txt(),
                           "timestamp_s": {"type": "NUMBER"}, "confidence": {"type": "NUMBER"}},
            "required": ["label", "evidence"]}},
        "proofs": {"type": "ARRAY", "items": {
            "type": "OBJECT",
            "properties": {
                "label": _txt(),
                "proof_type": {"type": "STRING",
                               "enum": ["demonstration", "testimonial", "before_after",
                                        "statistic", "authority", "social_proof"]},
                "evidence": _txt(), "timestamp_s": {"type": "NUMBER"},
                "confidence": {"type": "NUMBER"}},
            "required": ["label", "evidence"]}},
        "objections": {"type": "ARRAY", "items": {
            "type": "OBJECT",
            "properties": {"label": _txt(), "evidence": _txt(),
                           "timestamp_s": {"type": "NUMBER"}, "confidence": {"type": "NUMBER"}},
            "required": ["label", "evidence"]}},
        "offers": {"type": "ARRAY", "items": {
            "type": "OBJECT",
            "properties": {"label": _txt(), "evidence": _txt(),
                           "timestamp_s": {"type": "NUMBER"}, "confidence": {"type": "NUMBER"}},
            "required": ["label", "evidence"]}},
        "ctas": {"type": "ARRAY", "items": {
            "type": "OBJECT",
            "properties": {"label": _txt(), "evidence": _txt(),
                           "timestamp_s": {"type": "NUMBER"}, "confidence": {"type": "NUMBER"}},
            "required": ["label", "evidence"]}},
        "creative_analysis": {
            "type": "OBJECT",
            "properties": {
                campo: {"type": "OBJECT",
                        "properties": {"label": _txt(), "evidence": _txt()},
                        "required": ["label", "evidence"]}
                for campo in ("story_structure", "emotional_tone",
                              "visual_style", "editing_rhythm")
            },
        },
        "timing": {"type": "OBJECT", "properties": {
            "time_to_product_s": {"type": "NUMBER"}, "time_to_offer_s": {"type": "NUMBER"},
            "time_to_cta_s": {"type": "NUMBER"}, "hook_duration_s": {"type": "NUMBER"}}},
        "flags": {"type": "OBJECT", "properties": {
            campo: {"type": "BOOLEAN"} for campo in (
                "has_before_after", "has_testimonial", "has_problem_solution",
                "has_urgency", "has_social_proof", "has_demonstration")}},
    },
    "required": ["scenes", "hooks", "angles"],
}


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

8. TODO `label` em INGLÊS, sempre — independente do idioma do anúncio. O rótulo
   é chave de agrupamento: se o mesmo ângulo sair "Conforto" num anúncio e
   "Comfort" noutro, viram dois grupos diferentes e o painel mostra fragmentação
   onde há repetição. `evidence` é CITAÇÃO e fica no idioma original — traduzir
   evidência seria falsear o que a marca disse.

9. `label` CURTO e CANÔNICO: 2 a 4 palavras, minúsculas, sem adjetivo de
   intensidade. Descreva a CATEGORIA, não a execução daquele anúncio.

   Sim:  "stays in place"  ·  "wire-free comfort"  ·  "social proof"
   Não:  "Superior comfort with no wire and jelly strips" (execução, não categoria)
   Não:  "Comfort"  (vago demais para distinguir de qualquer outro)

   Se dois anúncios defendem a mesma ideia com palavras diferentes, o label tem
   que ser IGUAL nos dois. Prefira reusar um rótulo óbvio a inventar um novo
   mais preciso.

10. ÂNGULO e MECANISMO são coisas diferentes, e confundir os dois é o erro mais
    caro desta análise.

    ÂNGULO    = POR QUE a pessoa deveria se importar. O benefício, a promessa,
                a razão de compra.
    MECANISMO = COMO o produto entrega aquilo. A característica física, o
                material, a construção, a tecnologia.

    Exemplo:  "não sai do lugar" é ÂNGULO.
              "faixas de silicone" é o MECANISMO que faz não sair do lugar.

    Um anúncio pode ter ângulo sem mecanismo explícito — nesse caso devolva
    `mechanisms` vazio. NÃO invente um mecanismo para preencher, e NÃO repita
    o ângulo com outras palavras: mecanismo repetido do ângulo destrói o
    agrupamento, porque cria distinção onde não há.

    Mecanismo também precisa de `evidence`, como todo o resto.

11. `scene_function` descreve o PAPEL da cena no roteiro, não o que aparece
    nela. Uma pessoa falando sobre o resultado é `proof`, mesmo com o produto
    em cena. O produto sendo usado é `demo`; o produto sendo apresentado é
    `product`.

    O formato já é garantido pelo schema da resposta — você não consegue devolver
    valor fora da lista. Use `unknown` quando a cena realmente não tiver papel
    identificável; é melhor que chutar, e o sistema trata como "sem função".

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
            # O contrato. Sem isto o modelo é livre para inventar forma, e a
            # única defesa vira regra em texto — que é pedido, não garantia.
            "response_schema": RESPONSE_SCHEMA,
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
    "mechanisms": "mechanism",
    "promises": "promise", "proofs": "proof", "objections": "objection",
    "offers": "offer", "ctas": "cta",
}


# ── Funções de cena ─────────────────────────────────────────────────────────
#
# Lista FECHADA. O schema do prompt escreve as opções separadas por "|", e o
# modelo às vezes devolve o enum inteiro de volta — "hook|problem" em vez de
# escolher um. Visto em produção: uma estrutura de roteiro saiu como
#
#   hook|problem → Problema → solution|proof → solution|demo → demo|proof
#
# O estrago não é cosmético. A estrutura é chave de agrupamento: cada
# combinação vira uma estrutura diferente, e o padrão que existia se dissolve
# em variantes que ninguém consegue ler.
#
# Ele também inventa valores fora da lista ("objection handling"). Aceitar
# texto livre aqui é o mesmo erro dos rótulos, num campo onde o vocabulário
# fechado é o ponto todo.
FUNCOES_DE_CENA = {
    "hook", "problem", "solution", "product", "demo", "demonstration",
    "proof", "benefit", "objection", "offer", "cta",
}

# Sinônimos que o modelo produz com frequência e que têm equivalente óbvio.
# Mapear é melhor que descartar: "objection handling" é claramente `objection`,
# e jogar fora perderia uma cena classificada corretamente por um detalhe de
# redação.
SINONIMOS_DE_CENA = {
    "demonstration": "demo",
    "objection handling": "objection",
    "objection_handling": "objection",
    "call to action": "cta",
    "call_to_action": "cta",
    "solution reveal": "solution",
    "product reveal": "product",
    "social proof": "proof",
    "testimonial": "proof",
}


def _funcao_de_cena(bruto: Any, violacoes: list[str] | None = None) -> str | None:
    """
    Devolve UMA função válida, ou None.

    None é resposta legítima e aparece na interface como "cena sem função" —
    melhor que um rótulo inventado, porque a tela de estruturas já sabe dizer
    "sem função não há sequência para comparar".
    """
    if not bruto:
        return None
    texto = str(bruto).strip().lower()
    if not texto or texto == "unknown":
        # "unknown" é resposta legítima do contrato: o enum tem esse valor
        # justamente para o modelo poder dizer "não sei" sem chutar. Vira NULL
        # e NÃO conta como violação.
        return None

    for parte in texto.split("|"):
        parte = parte.strip()
        if not parte:
            continue
        parte = SINONIMOS_DE_CENA.get(parte, parte)
        if parte in FUNCOES_DE_CENA:
            if violacoes is not None and parte != texto:
                # Chegou aqui = o response_schema não segurou. Isso é sintoma de
                # o contrato ter deixado de ser aplicado (modelo trocado, campo
                # renomeado), e precisa ser VISÍVEL, não corrigido em silêncio.
                violacoes.append(f"scene_function fora do contrato: {bruto!r}")
            return "demo" if parte == "demonstration" else parte
    if violacoes is not None:
        violacoes.append(f"scene_function inválida, descartada: {bruto!r}")
    return None


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
    # Toda vez que o dado chega fora do contrato, registra. Com response_schema
    # isto deveria ficar sempre vazio — e é exatamente por isso que vale contar:
    # o dia em que parar de ficar, alguém precisa saber no primeiro anúncio, não
    # depois de quarenta e de uma tela estranha.
    violacoes: list[str] = []

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
            "scene_function": _funcao_de_cena(item.get("scene_function"), violacoes),
            "product_visible": bool(item.get("product_visible")),
            "confidence": _clamp(item.get("confidence")),
        })

    analysis = raw.get("creative_analysis") or {}
    timing = raw.get("timing") or {}
    flags = raw.get("flags") or {}

    return {
        "violacoes_de_contrato": violacoes[:20],
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
    permitir_fallback: bool = False,
) -> SemanticResult:
    """
    Gemini quando há chave. Heurística local só como ÚLTIMO recurso.

    ── O que esse fallback custou ────────────────────────────────────────────
    Antes, qualquer falha do Gemini caía direto na heurística, gravava o
    resultado como análise concluída e seguia. O aviso ia parar dentro do job,
    onde ninguém olha.

    O resultado apareceu semanas depois: 37 dos 40 anúncios tinham
    prompt_version 'local/v1'. O produto inteiro — receitas, hooks, mecanismos,
    estruturas — estava sendo montado sobre saída de regex. Os rótulos em
    português que passei um dia inteiro tentando canonizar são strings fixas
    daqui de baixo, não do modelo.

    Uma falha transitória de rede virava dado permanente de regex, e nada na
    tela dizia isso. Degradação silenciosa é pior que erro: erro alguém
    conserta.

    ── A regra agora ─────────────────────────────────────────────────────────
    Falhou o Gemini? A exceção sobe e o job vai para retry. Só quando as
    tentativas acabam é que a heurística entra — e aí ela entra marcada como
    degradada, com aviso de nível error, e o dado dela NÃO alimenta receita.
    """
    if not settings.gemini_api_key:
        # Sem chave não há o que tentar de novo. Degrada na hora, marcado.
        resultado = analyze_locally(transcript_text, segments, onscreen, metadata)
        resultado.warnings.append(
            "GEMINI_API_KEY ausente: análise feita por heurística local, não por modelo")
        return resultado

    try:
        return analyze_with_gemini(
            settings, keyframes, transcript_text, segments, onscreen, metadata)
    except SemanticError as exc:
        if not permitir_fallback:
            # Sobe. O job tenta de novo, e a fila mostra a falha.
            raise
        resultado = analyze_locally(transcript_text, segments, onscreen, metadata)
        resultado.warnings.append(
            f"Gemini falhou em todas as tentativas, caiu na heurística local: {exc}")
        return resultado
