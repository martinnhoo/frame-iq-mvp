"""
Log estruturado em JSON, com redação de segredo na saída.

── Por que estruturado ──────────────────────────────────────────────────────
Com 300 jobs na fila, `print("baixando...")` não responde onde está o gargalo.
Uma linha JSON por evento, com stage e elapsed_ms, responde — e pode ser
agregada depois sem parser frágil.

── Por que a redação fica AQUI ──────────────────────────────────────────────
Confiar em "ninguém vai logar a chave" falha na primeira exceção que carrega o
header no traceback. A redação acontece no ponto de saída, então mesmo um
`log(erro=str(exc))` descuidado não vaza: a substituição roda sobre a linha
inteira, já serializada, antes de ir para o stdout.

Cobre: service role e anon key do Supabase (JWT), chave do Gemini (AIza… e
AQ.…), chave da SpreshApp (sk_sprs_…), Bearer solto, e a querystring assinada
de URLs de storage e do CDN da Meta — que é credencial temporária, não
endereço.
"""
from __future__ import annotations

import json
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any

# Cada padrão aqui é um vazamento que já aconteceu em algum projeto real.
_REDACTIONS: list[tuple[re.Pattern[str], str]] = [
    # JWT (service role e anon do Supabase têm este formato)
    (re.compile(r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}"), "<jwt:redigido>"),
    (re.compile(r"sk_sprs_[A-Za-z0-9_\-]+"), "sk_sprs_<redigido>"),
    (re.compile(r"AIza[A-Za-z0-9_\-]{20,}"), "<gemini:redigido>"),
    (re.compile(r"\bAQ\.[A-Za-z0-9_\-]{20,}"), "<gemini:redigido>"),
    (re.compile(r"sbp_[A-Za-z0-9]{20,}"), "sbp_<redigido>"),
    (re.compile(r"github_pat_[A-Za-z0-9_]+"), "github_pat_<redigido>"),
    (re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._\-]{8,}"), r"\1<redigido>"),
    (re.compile(r"(?i)(apikey[\"']?\s*[:=]\s*[\"']?)[A-Za-z0-9._\-]{8,}"), r"\1<redigido>"),
    # Querystring assinada: token, não endereço. Sem isto, uma URL de storage
    # logada vira acesso ao objeto para quem ler o log.
    (re.compile(r"([?&](?:token|signature|sig|X-Amz-Signature|oh|_nc_sid)=)[^&\s\"']+"), r"\1<redigido>"),
]


def redact(text: str) -> str:
    for pattern, replacement in _REDACTIONS:
        text = pattern.sub(replacement, text)
    return text


def safe_url(url: str | None) -> str | None:
    """
    Versão de URL segura para log: mantém host e caminho, corta a querystring.

    Uma URL assinada do CDN da Meta ou do Supabase Storage É uma credencial de
    acesso temporária. Logar inteira significa que quem lê o log baixa o
    arquivo. O host e o caminho bastam para diagnosticar.
    """
    if not url:
        return None
    base = url.split("?", 1)[0]
    return f"{base}?<query:{len(url) - len(base)}ch>" if "?" in url else base


class JobLogger:
    """
    Emite uma linha JSON por evento, já com os campos do job preenchidos.

    Os campos obrigatórios (job_id, worker_id, stage, attempt, elapsed_ms…)
    vêm do contexto em vez de serem repetidos em cada chamada — o que garante
    que nenhum evento saia sem eles.
    """

    def __init__(self, **context: Any) -> None:
        self.context = {k: v for k, v in context.items() if v is not None}
        self._stage_started = time.monotonic()
        self._job_started = time.monotonic()
        self.stage_timings: dict[str, int] = {}

    def child(self, **extra: Any) -> "JobLogger":
        logger = JobLogger(**{**self.context, **extra})
        logger._job_started = self._job_started
        logger.stage_timings = self.stage_timings
        return logger

    def begin_stage(self, stage: str) -> None:
        self._stage_started = time.monotonic()
        self.context["stage"] = stage
        self.emit("started")

    def end_stage(self, stage: str, status: str = "completed", **fields: Any) -> int:
        elapsed = int((time.monotonic() - self._stage_started) * 1000)
        self.stage_timings[stage] = elapsed
        self.emit(status, stage=stage, elapsed_ms=elapsed, **fields)
        return elapsed

    def emit(self, status: str, **fields: Any) -> None:
        record: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            **self.context,
            "status": status,
            "job_elapsed_ms": int((time.monotonic() - self._job_started) * 1000),
            **fields,
        }
        # A redação roda sobre a linha JÁ serializada. Assim ela cobre também o
        # que entrou por engano dentro de uma mensagem de erro ou traceback,
        # não só os campos que lembramos de tratar.
        line = json.dumps(record, ensure_ascii=False, default=str)
        print(redact(line), flush=True, file=sys.stdout)

    def error(self, message: str, *, error_code: str, retryable: bool, **fields: Any) -> None:
        self.emit("error", message=message[:2000], error_code=error_code,
                  retryable=retryable, **fields)
