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
import threading
import time
import traceback
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from .analyze import AnalysisPermanentFailure, run_analysis_job
from .config import Settings, load_settings
from .download import NeedsUrlRefresh, PermanentFailure, run_download_job
from .logs import JobLogger
from .storage import cleanup_orphan_tmp, make_storage, tmp_usage_mb
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
              *, permanent: bool, settings: Settings | None = None) -> None:
    """
    Três desfechos distintos, e a distinção importa:

      retrying  — falha transitória, volta com backoff exponencial
      failed    — dead-letter: esgotou as tentativas OU é permanente. NUNCA
                  volta sozinho. Fica com o erro, a etapa e o histórico para
                  retry manual pela UI.
      blocked   — URL vencida. Também não volta sozinho, mas o desbloqueio é
                  automático quando a reimportação trouxer endereço novo.

    Sem os três, ou o job entra em laço infinito, ou uma URL vencida some como
    se fosse defeito permanente.
    """
    attempts = int(job.get("attempts") or 1)
    ceiling = int(job.get("max_attempts") or (settings.max_job_attempts if settings else 5))
    exhausted = permanent or attempts >= ceiling

    if isinstance(exc, NeedsUrlRefresh):
        supa.update(table, {
            "status": "blocked", "stage": "url_expired",
            "error": str(exc)[:2000], "error_code": "url_expired",
            "locked_by": None, "lease_expires_at": None, "next_retry_at": None,
        }, match={"id": f"eq.{job['id']}"})
        supa.log(
            user_id=job["user_id"], brand_id=job.get("brand_id"),
            job_kind="download", job_id=job["id"], level="warn", stage="url_expired",
            message="Job bloqueado: URL da mídia venceu. Reimportar o anúncio libera.",
            payload={"attempts": attempts},
        )
        return

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
        message=f"{'Dead-letter: sem retry automático' if exhausted else 'Falha, vai retentar'}: {exc}",
        payload={"attempts": attempts, "ceiling": ceiling, "permanent": permanent,
                 "stage": job.get("stage"), "dead_letter": exhausted},
    )


class LeaseLost(RuntimeError):
    """
    O job deixou de ser nosso no meio da execução. Não é falha do job — é a
    gente descobrindo que outro worker assumiu. Quem escreve o resultado é
    ele; nós paramos e não tocamos mais na linha.
    """


def run_with_heartbeat(
    supa: Supa,
    table: str,
    job: dict[str, Any],
    settings: Settings,
    fn: Callable[[], Any],
    *,
    interval_s: float | None = None,
) -> Any:
    """
    Executa `fn` numa thread e renova o lease enquanto ela roda.

    Um lease fixo "maior que o job mais longo" não existe: o job mais longo
    depende da duração do vídeo, que varia de 6s a vários minutos. A renovação
    periódica é o que torna o lease uma garantia em vez de um chute.

    O intervalo é 1/3 do lease: dá duas chances de renovar antes de vencer, o
    que absorve uma falha de rede isolada sem perder o job.
    """
    result: dict[str, Any] = {}
    error: dict[str, BaseException] = {}

    def target() -> None:
        try:
            result["value"] = fn()
        except BaseException as exc:  # noqa: BLE001
            error["value"] = exc

    thread = threading.Thread(target=target, daemon=True)
    thread.start()

    # 1/3 do lease dá duas chances de renovar antes de vencer, o que absorve
    # uma falha de rede isolada. `interval_s` é injetável para o teste não
    # precisar esperar minutos para provar o comportamento.
    interval = interval_s if interval_s is not None else max(5, settings.lease_seconds // 3)
    lost = False
    while thread.is_alive():
        thread.join(timeout=interval)
        if not thread.is_alive():
            break
        try:
            if not supa.renew_lease(table, job["id"], settings.worker_id, settings.lease_seconds):
                lost = True
                break
        except SupabaseError as exc:
            # Falha de rede na renovação não é motivo para abortar: o lease
            # ainda tem 2/3 de folga e a próxima tentativa provavelmente passa.
            print(f"[worker] renovação de lease falhou (segue tentando): {exc}", flush=True)

    if lost:
        # Não esperamos a thread: ela pode estar num download longo. Ela é
        # daemon e morre com o processo; o importante é não gravar resultado
        # de um job que agora tem outro dono.
        raise LeaseLost(
            f"lease do job {job['id']} foi assumido por outro worker — abandonando"
        )

    thread.join()
    if "value" in error:
        raise error["value"]
    return result.get("value")


def tick(supa: Supa, storage: Any, settings: Settings) -> bool:
    """Executa no máximo um job. Devolve True se pegou algo."""

    # O disco da máquina do Fly é pequeno. Acima do teto, recusa job novo em vez
    # de encher o volume — disco cheio derruba TODOS os jobs, inclusive os que
    # não têm nada a ver com o problema.
    usage = tmp_usage_mb(settings.tmp_dir)
    if usage > settings.tmp_max_mb:
        print(f"[worker] temporário em {usage:.0f} MB (teto {settings.tmp_max_mb}) — pausando", flush=True)
        return False

    # Download antes de análise: análise sem asset baixado não tem o que fazer,
    # e manter a fila de download curta é o que faz o progresso aparecer na UI.
    for kind, table, runner in (
        ("download", "ci_download_jobs", run_download_job),
        ("analysis", "ci_analysis_jobs", run_analysis_job),
    ):
        job = supa.claim_job(kind, settings.worker_id, settings.lease_seconds)
        if not job:
            continue

        log = JobLogger(job_kind=kind, job_id=job["id"], worker_id=settings.worker_id,
                        attempt=job.get("attempts"), brand_id=job.get("brand_id"))
        log.emit("claimed")
        try:
            result = run_with_heartbeat(
                supa, table, job, settings,
                lambda j=job, r=runner: r(j, supa, storage, settings),
            )
            log.emit("completed", **{k: v for k, v in (result or {}).items()
                                     if not isinstance(v, (list, dict))})
        except LeaseLost as exc:
            # Não marcamos nada: a linha agora pertence a outro worker, e
            # escrever aqui sobrescreveria o resultado dele.
            log.error(str(exc), error_code="lease_lost", retryable=False)
        except NeedsUrlRefresh as exc:
            log.error(str(exc), error_code="url_expired", retryable=True)
            _fail_job(supa, table, job, exc, permanent=False, settings=settings)
        except (PermanentFailure, AnalysisPermanentFailure) as exc:
            log.error(str(exc), error_code="permanent", retryable=False)
            _fail_job(supa, table, job, exc, permanent=True, settings=settings)
        except Exception as exc:  # noqa: BLE001
            log.error(str(exc), error_code=type(exc).__name__.lower(), retryable=True)
            traceback.print_exc()
            _fail_job(supa, table, job, exc, permanent=False, settings=settings)
        return True

    return False


def main() -> int:
    settings = load_settings()
    settings.require()

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    supa = Supa(settings.supabase_url, settings.service_role_key)
    storage = make_storage(settings)

    boot = JobLogger(worker_id=settings.worker_id, job_kind="system")
    boot.emit("worker_up", storage=settings.storage_backend,
              bucket=settings.storage_bucket, lease_s=settings.lease_seconds,
              concurrency=settings.concurrency, max_attempts=settings.max_job_attempts)

    # Órfãos do boot: temporários de jobs que morreram junto com o processo
    # anterior. Sem isto, cada crash deixa lixo no volume até ele encher e
    # TODOS os jobs passarem a falhar por um motivo que não é deles.
    freed = cleanup_orphan_tmp(settings.tmp_dir, settings.tmp_max_age_min)
    boot.emit("orphans_cleaned", removed=freed["removed"], bytes=freed["bytes"])

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
                boot.error(f"reaper falhou: {exc}", error_code="reaper", retryable=True)
            # Varredura periódica: um job pode morrer sem derrubar o processo.
            cleanup_orphan_tmp(settings.tmp_dir, settings.tmp_max_age_min)

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
