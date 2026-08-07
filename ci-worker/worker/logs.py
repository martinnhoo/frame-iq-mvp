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


def memoria_mb() -> dict[str, int] | None:
    """
    Memória do CONTÊINER, não do processo Python.

    Lê o cgroup e não /proc/self/status de propósito: ffmpeg, ffprobe e o
    Whisper rodam em subprocesso, e o pico deles é justamente o que derruba a
    máquina. O RSS do Python sozinho não veria nada disso e diria que está tudo
    bem enquanto o contêiner morre.

    cgroup v2 primeiro (é o do Fly), v1 como reserva. Fora de contêiner devolve
    None — e quem chama simplesmente não registra o campo, em vez de inventar
    um zero que pareceria medição.
    """
    def _ler(caminho: str) -> int | None:
        try:
            with open(caminho) as fh:  # noqa: PTH123
                valor = fh.read().strip()
            return int(valor) // (1024 * 1024) if valor.isdigit() else None
        except (OSError, ValueError):
            return None

    atual = _ler("/sys/fs/cgroup/memory.current")
    pico = _ler("/sys/fs/cgroup/memory.peak")
    if atual is None:
        atual = _ler("/sys/fs/cgroup/memory/memory.usage_in_bytes")
        pico = _ler("/sys/fs/cgroup/memory/memory.max_usage_in_bytes")

    # /proc/meminfo como reserva — e no Fly ele é até melhor que o cgroup: a
    # máquina é uma VM Firecracker com kernel próprio, então MemTotal e
    # MemAvailable descrevem exatamente o que o OOM killer enxerga.
    if atual is None:
        try:
            info: dict[str, int] = {}
            with open("/proc/meminfo") as fh:  # noqa: PTH123
                for linha in fh:
                    campo, _, resto = linha.partition(":")
                    numero = resto.strip().split(" ")[0]
                    if numero.isdigit():
                        info[campo] = int(numero)  # kB
            total = info.get("MemTotal")
            disponivel = info.get("MemAvailable")
            if total and disponivel is not None:
                atual = (total - disponivel) // 1024
                # /proc/meminfo não guarda histórico, então não há pico aqui.
                pico = None
        except (OSError, ValueError):
            return None

    if atual is None:
        return None
    return {"atual": atual, "pico": pico or atual}


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
        # Memória junto do tempo, em todo estágio. Sem isto, dimensionar a
        # máquina é chute: foi assim que 2 GB foram escolhidos contra um vídeo
        # de teste de 10s e morreram no primeiro anúncio real de 1080x1920.
        # O custo é ler dois arquivos — barato o bastante para ser sempre.
        mem = memoria_mb()
        if mem:
            fields.setdefault("mem_mb", mem["atual"])
            if mem.get("pico"):
                fields.setdefault("mem_pico_mb", mem["pico"])
        self.emit(status, stage=stage, elapsed_ms=elapsed, **fields)
        return elapsed

    def emit(self, status: str, **fields: Any) -> None:  # noqa: D102
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

    def error(self, message: str, *, error_code: str, retryable: bool,
              detail: str = "", **fields: Any) -> None:
        # `detail` é o corpo da resposta que o servidor devolveu. Sem ele, um
        # 400 do PostgREST vira "insert → 400" e não diz QUAL constraint
        # estourou — foi exatamente assim que o erro de duplicata em
        # ci_ad_taxonomy custou uma rodada inteira de diagnóstico. A redação
        # roda sobre a linha serializada, então incluir o corpo aqui não abre
        # caminho para vazar segredo.
        if detail:
            fields["detail"] = detail[:1000]
        self.emit("error", message=message[:2000], error_code=error_code,
                  retryable=retryable, **fields)
