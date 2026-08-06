"""
Laço do worker.

Pega jobs da fila do Postgres, executa, marca o resultado. Roda no Fly.io ou
localmente com o mesmo código — a única diferença são as variáveis de ambiente.

── Por que a fila mora no banco e não em memória ────────────────────────────
Requisito explícito: reiniciar o servidor não pode apagar filas nem dados. Se
esta máquina morrer no meio de um download, o lease vence, o reaper devolve o
job para 'retrying' e outro worker pega. Nada se perde, e nada roda duas vezes
ao mesmo tempo — o SKIP LOCKED do ci_claim_job garante isso.

── Backoff ──────────────────────────────────────────────────────────────────
Falha retentável volta para a fila com espera exponencial. Falha permanente
(mídia inválida, arquivo grande demais, anúncio apagado) vai direto para
'failed': retentar cinco vezes o que vai falhar igual só atrasa a fila e
polui o log.
"""
from __future__ import annotations

import signal
import sys
import time
import traceback
from datetime import datetime, timedelta, timezone
from typing import Any

from .config import Settings, load_settings
from .download import PermanentFailure, run_download_job
from .storage import make_storage, tmp_usage_mb
from .supa import Supa, SupabaseError

_stop = False


def _handle_signal(signum: int, _frame: Any) -> None:
    """
    SIGTERM do Fly no deploy: para de PEGAR job novo, mas deixa o que está em
    execução terminar. Matar no meio deixaria o lease pendurado até vencer.
    """
    global _stop
    _stop = True
    print(f"[worker] sinal {signum} recebido — encerrando após o job atual", flush=True)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _backoff_at(attempts: int, base: int, cap: int) -> str:
    delay = min(base * (2 ** max(0, attempts - 1)), cap)
    return (datetime.now(timezone.utc) + timedelta(seconds=delay)).isoformat()


def _fail_job(supa: Supa, table: str, job: dict[str, Any], exc: BaseException,
              *, permanent: bool) -> None:
    attempts = int(job.get("attempts") or 1)
    max_attempts = int(job.get("max_attempts") or 3)
    exhausted = permanent or attempts >= max_attempts

    patch: dict[str, Any] = {
        "status": "failed" if exhausted else "retrying",
        "stage": "failed" if exhausted else "queued",
        "error": str(exc)[:2000],
        "error_code": type(exc).__name__.lower(),
        "locked_by": None,
        "lease_expires_at": None,
    }
    if exhausted:
        patch["finished_at"] = _now()
    else:
        patch["next_retry_at"] = _backoff_at(attempts, 15 if table == "ci_download_jobs" else 30, 900)

    supa.update(table, patch, match={"id": f"eq.{job['id']}"})
    supa.log(
        user_id=job["user_id"], brand_id=job.get("brand_id"),
        job_kind="download" if table == "ci_download_jobs" else "analysis",
        job_id=job["id"], level="error", stage="failed",
        message=f"{'Falha definitiva' if exhausted else 'Falha, vai retentar'}: {exc}",
        payload={"attempts": attempts, "permanent": permanent},
    )


def tick(supa: Supa, storage: Any, settings: Settings) -> bool:
    """Executa no máximo um job. Devolve True se pegou algo."""

    # O disco da máquina do Fly é pequeno. Acima do teto, recusa job novo em vez
    # de encher o volume — disco cheio derruba TODOS os jobs, inclusive os que
    # não têm nada a ver com o problema.
    usage = tmp_usage_mb(settings.tmp_dir)
    if usage > settings.tmp_max_mb:
        print(f"[worker] temporário em {usage:.0f} MB (teto {settings.tmp_max_mb}) — pausando", flush=True)
        return False

    job = supa.claim_job("download", settings.worker_id, settings.lease_seconds)
    if not job:
        return False

    started = time.monotonic()
    print(f"[worker] download {job['id']} (tentativa {job.get('attempts')})", flush=True)
    try:
        result = run_download_job(job, supa, storage, settings)
        print(
            f"[worker] ok {job['id']} em {time.monotonic() - started:.1f}s "
            f"asset={result['asset_id']} duplicado={result['was_duplicate']}",
            flush=True,
        )
    except PermanentFailure as exc:
        print(f"[worker] falha definitiva {job['id']}: {exc}", flush=True)
        _fail_job(supa, "ci_download_jobs", job, exc, permanent=True)
    except Exception as exc:  # noqa: BLE001
        print(f"[worker] falha {job['id']}: {exc}", flush=True)
        traceback.print_exc()
        _fail_job(supa, "ci_download_jobs", job, exc, permanent=False)
    return True


def main() -> int:
    settings = load_settings()
    settings.require()

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    supa = Supa(settings.supabase_url, settings.service_role_key)
    storage = make_storage(settings)

    print(
        f"[worker] {settings.worker_id} de pé · storage={settings.storage_backend} "
        f"bucket={settings.storage_bucket} lease={settings.lease_seconds}s",
        flush=True,
    )

    idle_since = time.monotonic()
    last_reap = 0.0

    while not _stop:
        # O reaper devolve à fila jobs cujo worker morreu. Rodar do worker
        # evita depender de cron externo; a cada minuto é suficiente porque o
        # lease é de 15.
        now = time.monotonic()
        if now - last_reap > 60:
            last_reap = now
            try:
                supa.rpc("ci_reap_stale_jobs")
            except SupabaseError as exc:
                print(f"[worker] reaper falhou: {exc}", flush=True)

        try:
            worked = tick(supa, storage, settings)
        except SupabaseError as exc:
            # Banco fora do ar não é motivo para o container morrer: espera e
            # tenta de novo. Morrer faria o Fly reiniciar em laço.
            print(f"[worker] banco indisponível: {exc}", flush=True)
            time.sleep(min(settings.poll_interval_s * 4, 30))
            continue

        if worked:
            idle_since = time.monotonic()
        else:
            if time.monotonic() - idle_since > 300:
                print("[worker] fila vazia há 5 min", flush=True)
                idle_since = time.monotonic()
            time.sleep(settings.poll_interval_s)

    print("[worker] encerrado", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
