"""
Autodiagnóstico do Gemini — roda no boot, custa quase nada, e responde a
pergunta que passamos horas tentando responder por SQL.

── Por que isto existe ──────────────────────────────────────────────────────
37 dos 40 anúncios foram "analisados" por regex porque o Gemini falhava e o
worker caía num fallback silencioso. Descobrir isso levou um dia. Descobrir
POR QUE ele falha levou mais consultas, logs e chutes — e ainda não sabíamos,
porque a mensagem gravada no banco afirmava um motivo que ela não conhecia.

O erro de método foi tratar o worker como caixa-preta e tentar inferir de fora
o que ele sabe de dentro. Ele tem a chave, faz a chamada e recebe o status
HTTP. Perguntar isso ao Postgres é o caminho mais longo possível.

── O que faz ────────────────────────────────────────────────────────────────
Uma chamada mínima ao Gemini, só texto, com o mesmo cabeçalho e o mesmo
response_schema da análise real. Custa alguns tokens. Devolve um veredito
legível e o classifica: chave ausente, chave inválida, cota, schema recusado,
rede, ou tudo certo.

O resultado vai para ci_job_events, que a tela de saúde já lê. Ninguém precisa
abrir terminal.

Rodar à mão:  fly ssh console -a adbrief-ci-worker -C "python -m worker.diagnostico"
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Any

from .config import Settings
from .semantic import GEMINI_URL

# Um objeto minúsculo, mas com um campo de enum: se o problema for o
# response_schema ser recusado pela API, um payload sem enum passaria e o
# diagnóstico diria "tudo certo" enquanto a análise real continua quebrando.
_SCHEMA_TESTE: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "ok": {"type": "BOOLEAN"},
        "escolha": {"type": "STRING", "enum": ["hook", "demo", "proof"]},
    },
    "required": ["ok", "escolha"],
}


def _classificar(status: int | None, corpo: str, excecao: str) -> tuple[str, str]:
    """
    Devolve (código, explicação em português).

    A explicação diz o que FAZER, não só o que aconteceu. Um diagnóstico que
    termina em "401 Unauthorized" obriga quem lê a ir pesquisar; um que termina
    em "a chave está errada ou revogada, gere outra" resolve.
    """
    texto = f"{corpo} {excecao}".lower()

    # Chave inválida vem como 400, não 401 — verificado contra a API real. A
    # primeira versão deste classificador respondia "requisição inválida" para
    # o caso mais provável de todos, que é justamente o que estamos caçando.
    # Por isso o corpo é lido antes do status.
    if "api_key_invalid" in texto or "api key not valid" in texto:
        return ("chave_invalida",
                "A chave foi recusada: 'API key not valid'. Ou está errada, ou foi "
                "revogada, ou pertence a um projeto sem a API do Gemini habilitada. "
                "Gere outra em aistudio.google.com/apikey e rode "
                "fly secrets set GEMINI_API_KEY=... -a adbrief-ci-worker")
    if "permission_denied" in texto or "api has not been used" in texto:
        return ("api_desabilitada",
                "A chave é válida mas a API generativelanguage não está habilitada "
                "no projeto do Google Cloud dela.")

    if status == 400 and ("schema" in texto or "response_schema" in texto):
        return ("schema_recusado",
                "A API recusou o response_schema. É o contrato que impede o modelo "
                "de inventar valor — provavelmente um campo usa tipo ou enum que "
                "esta versão da API não aceita. O corpo do erro diz qual.")
    if status in (401, 403):
        return ("chave_invalida",
                "A chave existe mas foi recusada. Ou está errada, ou foi revogada, "
                "ou não tem a API do Gemini habilitada no projeto.")
    if status == 429:
        return ("cota",
                "Cota ou limite de requisições estourado. Não é bug de código: ou "
                "espera a janela virar, ou sobe o limite no projeto.")
    if status == 404:
        return ("modelo_inexistente",
                "O modelo configurado em GEMINI_MODEL não existe ou não está "
                "disponível para esta chave.")
    if status is not None and 500 <= status < 600:
        return ("erro_do_servidor",
                "Falha do lado do Google. Transitória na maioria das vezes — o "
                "retry do worker resolve. Se persistir, é incidente deles.")
    if status == 400:
        return ("requisicao_invalida",
                "A API recusou a requisição. O corpo do erro diz o motivo exato.")
    if excecao:
        return ("rede",
                "A chamada nem chegou a receber resposta: timeout, DNS ou saída de "
                "rede bloqueada na máquina do Fly.")
    return ("desconhecido", "Falhou sem status nem exceção legível.")


def diagnosticar_gemini(settings: Settings) -> dict[str, Any]:
    """Nunca levanta exceção. Um diagnóstico que quebra não diagnostica nada."""
    if not settings.gemini_api_key:
        return {
            "ok": False,
            "codigo": "chave_ausente",
            "explicacao": ("GEMINI_API_KEY não está configurada nesta máquina. "
                           "Toda análise vai cair na heurística de regex. "
                           "Rode: fly secrets set GEMINI_API_KEY=... -a adbrief-ci-worker"),
            "modelo": settings.gemini_model,
            "status_http": None,
            "latencia_ms": 0,
        }

    corpo = json.dumps({
        "contents": [{"role": "user", "parts": [{
            "text": "Responda com ok=true e escolha='demo'. É um teste de conectividade.",
        }]}],
        "generationConfig": {
            "temperature": 0,
            "response_mime_type": "application/json",
            "response_schema": _SCHEMA_TESTE,
        },
    }).encode()

    pedido = urllib.request.Request(
        GEMINI_URL.format(model=settings.gemini_model),
        data=corpo, method="POST",
        headers={"Content-Type": "application/json",
                 "x-goog-api-key": settings.gemini_api_key},
    )

    inicio = time.monotonic()
    status: int | None = None
    resposta_corpo = ""
    excecao = ""
    try:
        with urllib.request.urlopen(pedido, timeout=30) as r:  # noqa: S310
            status = r.status
            resposta_corpo = r.read().decode()[:2000]
    except urllib.error.HTTPError as exc:
        status = exc.code
        try:
            resposta_corpo = exc.read().decode()[:2000]
        except Exception:  # noqa: BLE001
            resposta_corpo = ""
    except Exception as exc:  # noqa: BLE001
        excecao = f"{type(exc).__name__}: {exc}"

    latencia = int((time.monotonic() - inicio) * 1000)

    if status == 200:
        # 200 não basta: o que importa é se o texto veio e é JSON válido sob o
        # schema. Um 200 com resposta vazia derrubaria a análise do mesmo jeito.
        try:
            payload = json.loads(resposta_corpo)
            texto = (payload["candidates"][0]["content"]["parts"][0]["text"])
            json.loads(texto)
            return {
                "ok": True, "codigo": "ok",
                "explicacao": "Gemini respondeu e respeitou o schema.",
                "modelo": settings.gemini_model,
                "status_http": 200, "latencia_ms": latencia,
            }
        except Exception as exc:  # noqa: BLE001
            return {
                "ok": False, "codigo": "resposta_ilegivel",
                "explicacao": (f"A API respondeu 200 mas o corpo não é o esperado "
                               f"({type(exc).__name__}). Formato da resposta mudou."),
                "modelo": settings.gemini_model,
                "status_http": 200, "latencia_ms": latencia,
                # O corpo entra truncado: a redação do logger cuida de segredo,
                # e sem o corpo este caso vira adivinhação.
                "corpo": resposta_corpo[:600],
            }

    codigo, explicacao = _classificar(status, resposta_corpo, excecao)
    return {
        "ok": False, "codigo": codigo, "explicacao": explicacao,
        "modelo": settings.gemini_model,
        "status_http": status, "latencia_ms": latencia,
        "corpo": resposta_corpo[:600],
        "excecao": excecao[:300],
    }


def main() -> int:
    from .config import load_settings  # noqa: PLC0415
    from .logs import JobLogger  # noqa: PLC0415

    settings = load_settings()
    resultado = diagnosticar_gemini(settings)
    log = JobLogger(worker_id=settings.worker_id, job_kind="system")
    log.emit("gemini_diagnostico", **resultado)

    print(f"\n{'OK' if resultado['ok'] else 'FALHOU'}  [{resultado['codigo']}]")
    print(resultado["explicacao"])
    if resultado.get("corpo"):
        print(f"\ncorpo da resposta:\n{resultado['corpo']}")
    return 0 if resultado["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
