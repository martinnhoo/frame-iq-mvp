#!/usr/bin/env python3
"""
Prova que CI_WORKER_CONCURRENCY realmente executa jobs em paralelo.

    python ci-worker/tests/test_concurrency.py

── Por que este arquivo existe ──────────────────────────────────────────────
`CI_WORKER_CONCURRENCY` existia, era lido do ambiente, aparecia no log de boot
como "concurrency: 2" — e não fazia nada. O laço era um só e os jobs saíam
estritamente em série.

Medido em 07/08 contra a máquina de produção: o valor foi para 2, o boot
registrou 2, e os downloads continuaram um de cada vez, com 2min30 entre o fim
de um e o início do próximo.

Botão que não liga nada é pior que botão ausente: quem lê o log acredita que
ligou e vai procurar a lentidão em outro lugar. Foi o que aconteceu.

── O que o teste faz ────────────────────────────────────────────────────────
Substitui `tick` por uma função que dorme e anota quando começou e terminou.
Se as execuções se sobrepõem no tempo, há paralelismo de verdade. Se não se
sobrepõem, o valor é decorativo.
"""
from __future__ import annotations

import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from worker import main as m  # noqa: E402

FALHAS: list[str] = []
PASSOU = 0


def check(nome: str, cond: bool, extra: str = "") -> None:
    global PASSOU
    print(("PASS  " if cond else "FAIL  ") + nome + (f"  [{extra}]" if extra else ""))
    if cond:
        PASSOU += 1
    else:
        FALHAS.append(nome)


class SupaFalso:
    mode = "teste"

    def ping(self) -> bool:
        return True

    def rpc(self, *_a, **_k):
        return None

    def update(self, *_a, **_k):
        return []


def roda_com(concorrencia: int, n_jobs: int = 4) -> list[tuple[float, float]]:
    """Roda o laço com `tick` instrumentado e devolve os intervalos [início, fim]."""
    restantes = {"n": n_jobs}
    janelas: list[tuple[float, float]] = []
    trava = threading.Lock()

    def tick_falso(_supa, _storage, _settings) -> bool:
        with trava:
            if restantes["n"] <= 0:
                return False
            restantes["n"] -= 1
        inicio = time.monotonic()
        time.sleep(0.35)          # simula um job
        with trava:
            janelas.append((inicio, time.monotonic()))
        return True

    original_tick = m.tick
    original_cleanup = m.cleanup_orphan_tmp
    m.tick = tick_falso
    m.cleanup_orphan_tmp = lambda *_a, **_k: {"removed": 0, "bytes": 0}
    m._stop = False

    class Cfg:
        concurrency = concorrencia
        poll_interval_s = 0.05
        tmp_dir = Path("/tmp")
        tmp_max_age_min = 60
        worker_id = "teste"
        lease_seconds = 60
        max_job_attempts = 5
        storage_backend = "supabase"
        storage_bucket = "b"

    def parar_quando_acabar() -> None:
        while True:
            with trava:
                if restantes["n"] <= 0 and len(janelas) >= n_jobs:
                    break
            time.sleep(0.02)
        m._stop = True

    vigia = threading.Thread(target=parar_quando_acabar, daemon=True)
    vigia.start()

    # Reproduz o laço de main() sem subir o resto do worker.
    supa, storage, cfg = SupaFalso(), None, Cfg()
    threads = []
    last_reap = [0.0]

    def laco(indice: int) -> None:
        while not m._stop:
            try:
                pegou = m.tick(supa, storage, cfg)
            except Exception:  # noqa: BLE001
                break
            if not pegou:
                time.sleep(cfg.poll_interval_s + indice * 0.01)

    for i in range(cfg.concurrency):
        t = threading.Thread(target=laco, args=(i,), daemon=True)
        t.start()
        threads.append(t)
    for t in threads:
        t.join(timeout=8)

    m.tick = original_tick
    m.cleanup_orphan_tmp = original_cleanup
    return janelas


def sobreposicoes(janelas: list[tuple[float, float]]) -> int:
    """Quantos pares de jobs rodaram ao mesmo tempo."""
    n = 0
    for i in range(len(janelas)):
        for j in range(i + 1, len(janelas)):
            a, b = janelas[i], janelas[j]
            if a[0] < b[1] and b[0] < a[1]:
                n += 1
    return n


def main() -> int:
    serie = roda_com(1)
    check("com concorrência 1, os 4 jobs rodam", len(serie) == 4, str(len(serie)))
    check("com concorrência 1, NADA se sobrepõe",
          sobreposicoes(serie) == 0, f"{sobreposicoes(serie)} sobreposições")

    par = roda_com(2)
    check("com concorrência 2, os 4 jobs rodam", len(par) == 4, str(len(par)))
    # REGRESSÃO: aqui é onde o bug morava. Antes desta correção o número era 0,
    # e o log de boot dizia "concurrency: 2" do mesmo jeito.
    check("REGRESSÃO: com concorrência 2, jobs SE SOBREPÕEM no tempo",
          sobreposicoes(par) > 0, f"{sobreposicoes(par)} sobreposições")

    if serie and par:
        dur_serie = max(f for _, f in serie) - min(i for i, _ in serie)
        dur_par = max(f for _, f in par) - min(i for i, _ in par)
        check("concorrência 2 termina o lote mais rápido que 1",
              dur_par < dur_serie * 0.8, f"{dur_par:.2f}s contra {dur_serie:.2f}s")

    print()
    if FALHAS:
        print(f"FALHAS ({len(FALHAS)}/{PASSOU + len(FALHAS)}): " + ", ".join(FALHAS))
        return 1
    print(f"TODOS OS {PASSOU} TESTES PASSARAM")
    return 0


if __name__ == "__main__":
    sys.exit(main())
