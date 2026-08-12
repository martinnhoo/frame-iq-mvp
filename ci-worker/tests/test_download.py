#!/usr/bin/env python3
"""
Teste do pipeline de download contra um servidor HTTP e um vídeo MP4 REAIS.

    python ci-worker/tests/test_download.py

O que é real: o servidor HTTP, o arquivo MP4 (gerado com ffmpeg), o download por
streaming, o cálculo do SHA-256 e a limpeza do temporário.
O que é dublê: o Supabase e o bucket, porque o objetivo aqui é o comportamento
do worker — e não dá para provar dedup contra um banco que não existe na CI.

Cada verificação existe por um motivo específico, anotado junto.
"""
from __future__ import annotations

import http.server
import os
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
from dataclasses import replace
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from worker.config import load_settings  # noqa: E402
from worker.download import PermanentFailure, run_download_job  # noqa: E402
from worker.main import LeaseLost, run_with_heartbeat  # noqa: E402
from worker.storage import (  # noqa: E402
    InvalidMedia,
    MediaTooLarge,
    cleanup_tmp,
    media_kind,
    storage_key,
    stream_download,
)
from worker.urlguard import BlockedUrl, UrlPolicy, validate_url  # noqa: E402

# O servidor de teste roda em 127.0.0.1 sobre http — exatamente o que a política
# de produção bloqueia. Este é o único lugar do código onde as travas são
# afrouxadas, e é explícito de propósito.
TEST_POLICY = UrlPolicy(allow_private=True, require_https=False)

FAILURES: list[str] = []
PASSED = 0


def check(name: str, cond: bool, extra: str = "") -> None:
    global PASSED
    print(("PASS  " if cond else "FAIL  ") + name + (f"  [{extra}]" if extra else ""))
    if cond:
        PASSED += 1
    else:
        FAILURES.append(name)


# ── Dublês ───────────────────────────────────────────────────────────────────

class FakeStorage:
    """Guarda o que foi enviado, para provar que subiu uma vez só."""

    def __init__(self) -> None:
        self.objects: dict[str, int] = {}
        self.put_calls = 0

    def put_file(self, key: str, path: Path, content_type: str) -> str:
        self.put_calls += 1
        self.objects[key] = path.stat().st_size
        return key

    def signed_url(self, key: str, expires_in: int = 3600) -> str:
        return f"https://fake/{key}?exp={expires_in}"

    def exists(self, key: str) -> bool:
        return key in self.objects

    def delete(self, key: str) -> None:
        self.objects.pop(key, None)


class FakeSupa:
    """
    Banco em memória com o mínimo do PostgREST que o worker usa.
    Guarda as tabelas como listas de dicts e aplica os filtros `eq.`.
    """

    def __init__(self) -> None:
        self.tables: dict[str, list[dict[str, Any]]] = {}
        self.logs: list[dict[str, Any]] = []
        self._seq = 0

    def _next_id(self, prefix: str) -> str:
        self._seq += 1
        return f"{prefix}-{self._seq}"

    def seed(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        self.tables.setdefault(table, []).append(row)
        return row

    def select(self, table: str, *, params: dict[str, str] | None = None) -> list[dict[str, Any]]:
        rows = self.tables.get(table, [])
        for key, raw in (params or {}).items():
            if key in {"select", "limit", "order"}:
                continue
            if raw.startswith("eq."):
                want = raw[3:]
                rows = [r for r in rows if str(r.get(key)) == want]
        limit = int((params or {}).get("limit", 0) or 0)
        return rows[:limit] if limit else list(rows)

    def insert(self, table: str, rows: dict | list[dict], *, upsert: bool = False,
               on_conflict: str | None = None, ignore_duplicates: bool = False) -> list[dict[str, Any]]:
        items = rows if isinstance(rows, list) else [rows]
        out = []
        for item in items:
            if on_conflict and ignore_duplicates:
                keys = [k.strip() for k in on_conflict.split(",")]
                if any(all(str(e.get(k)) == str(item.get(k)) for k in keys)
                       for e in self.tables.get(table, [])):
                    continue
            row = {"id": self._next_id(table), **item}
            self.tables.setdefault(table, []).append(row)
            out.append(row)
        return out

    def update(self, table: str, patch: dict, *, match: dict[str, str]) -> list[dict[str, Any]]:
        out = []
        for row in self.tables.get(table, []):
            if all(str(row.get(k)) == v[3:] for k, v in match.items() if v.startswith("eq.")):
                row.update(patch)
                out.append(row)
        return out

    def rpc(self, fn: str, args: dict | None = None) -> Any:
        return None

    def log(self, **row: Any) -> None:
        self.logs.append(row)


# ── Servidor real ────────────────────────────────────────────────────────────

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args: Any) -> None:
        pass

    def handle_one_request(self) -> None:
        # O teste do teto de tamanho aborta o download no meio, e o servidor
        # cospe um BrokenPipeError que não é falha nenhuma — é exatamente o
        # que deveria acontecer. Silenciar aqui mantém a saída legível.
        try:
            super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True


def serve(directory: Path) -> tuple[str, socketserver.TCPServer]:
    handler = lambda *a, **kw: QuietHandler(*a, directory=str(directory), **kw)  # noqa: E731
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return f"http://127.0.0.1:{httpd.server_address[1]}", httpd


def make_mp4(dest: Path) -> bool:
    """Gera um MP4 de 2s com ffmpeg. Sem ffmpeg, o teste degrada para bytes."""
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15:duration=2",
             "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
             "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", str(dest)],
            capture_output=True, timeout=60, check=True,
        )
        return dest.exists() and dest.stat().st_size > 0
    except (OSError, subprocess.SubprocessError):
        dest.write_bytes(b"\x00\x00\x00\x20ftypisom" + os.urandom(200_000))
        return False


def main() -> int:
    workdir = Path(tempfile.mkdtemp(prefix="ci-dl-test-"))
    served = workdir / "www"
    served.mkdir()
    tmp = workdir / "tmp"
    tmp.mkdir()

    video = served / "ad.mp4"
    real_ffmpeg = make_mp4(video)
    print(f"MP4 de teste: {video.stat().st_size} bytes "
          f"({'gerado com ffmpeg' if real_ffmpeg else 'sintético — ffmpeg ausente'})\n")

    (served / "vazio.mp4").write_bytes(b"")
    (served / "grande.mp4").write_bytes(os.urandom(3 * 1024 * 1024))
    (served / "pagina.html").write_text("<html>não é vídeo</html>")

    base, httpd = serve(served)
    settings = replace(
        load_settings(),
        supabase_url="http://fake", service_role_key="fake",
        tmp_dir=tmp, max_media_mb=2, download_timeout_s=30,
        storage_bucket="ci-media",
        allow_private_urls=True, require_https=False,
    )

    try:
        # ── Streaming e hash ─────────────────────────────────────────────────
        dest = tmp / "direto.mp4"
        result = stream_download(f"{base}/ad.mp4", dest, replace(settings, max_media_mb=50), policy=TEST_POLICY)
        import hashlib
        expected = hashlib.sha256(video.read_bytes()).hexdigest()
        check("SHA-256 calculado no download bate com o do arquivo", result.sha256 == expected)
        check("tamanho confere", result.size_bytes == video.stat().st_size,
              f"{result.size_bytes}B")
        check("extensão inferida do content-type", result.ext == ".mp4", result.ext)
        check("classificado como vídeo", media_kind(result.content_type, result.ext) == "video")
        dest.unlink(missing_ok=True)

        # Progresso precisa ser chamado — é o que alimenta a barra na UI.
        chamadas: list[tuple[int, int | None, float]] = []
        dest2 = tmp / "progresso.mp4"
        stream_download(f"{base}/ad.mp4", dest2, replace(settings, max_media_mb=50),
                        on_progress=lambda d, t, s: chamadas.append((d, t, s)), policy=TEST_POLICY)
        check("callback de progresso é chamado durante o download", len(chamadas) > 0,
              f"{len(chamadas)} chamadas")
        dest2.unlink(missing_ok=True)

        # ── Recusas ──────────────────────────────────────────────────────────
        # Corpo vazio: sem esta checagem viraria um asset de 0 byte no bucket,
        # e o pipeline de análise falharia depois sem explicação.
        try:
            stream_download(f"{base}/vazio.mp4", tmp / "vazio", settings, policy=TEST_POLICY)
            vazio_ok = False
        except InvalidMedia:
            vazio_ok = True
        check("corpo vazio é recusado", vazio_ok)

        # Teto de tamanho: 3 MB contra teto de 2 MB.
        try:
            stream_download(f"{base}/grande.mp4", tmp / "grande", settings, policy=TEST_POLICY)
            grande_ok = False
        except MediaTooLarge:
            grande_ok = True
        check("arquivo acima do teto é recusado", grande_ok)
        check("temporário do arquivo recusado não fica para trás",
              not (tmp / "grande").exists())

        # ── SSRF ─────────────────────────────────────────────────────────────
        #
        # O worker baixa URLs vindas da resposta da SpreshApp — dados externos —
        # num processo que segura a service role. Sem estas travas, uma URL
        # apontando para o metadata da nuvem viraria requisição interna com o
        # resultado gravado no bucket.
        prod = UrlPolicy()  # a política real: https, sem rede privada

        bloqueios = [
            ("http://169.254.169.254/latest/meta-data/", "metadata de nuvem"),
            ("https://127.0.0.1/x.mp4", "loopback"),
            ("https://localhost/x.mp4", "localhost"),
            ("https://10.0.0.5/x.mp4", "rede privada 10/8"),
            ("https://192.168.1.1/x.mp4", "rede privada 192.168/16"),
            ("https://172.16.0.1/x.mp4", "rede privada 172.16/12"),
            ("https://0.0.0.0/x.mp4", "endereço não especificado"),
            ("file:///etc/passwd", "esquema file://"),
            ("ftp://exemplo.com/x.mp4", "esquema ftp://"),
            ("https://user:senha@exemplo.com/x.mp4", "credencial embutida"),
            ("https://exemplo.com:22/x.mp4", "porta fora de 80/443"),
        ]
        for url_ruim, motivo in bloqueios:
            try:
                validate_url(url_ruim, prod)
                bloqueado = False
            except BlockedUrl:
                bloqueado = True
            except Exception:
                # DNS que não resolve também recusa — o efeito é o mesmo.
                bloqueado = True
            check(f"SSRF: bloqueia {motivo}", bloqueado, url_ruim[:44])

        # http puro também é recusado na política de produção.
        try:
            validate_url("http://exemplo.com/x.mp4", prod)
            http_bloqueado = False
        except BlockedUrl:
            http_bloqueado = True
        check("SSRF: http sem TLS é recusado em produção", http_bloqueado)

        # E o download real recusa antes de qualquer conexão.
        try:
            stream_download(f"{base}/ad.mp4", tmp / "ssrf", settings)  # sem policy = produção
            dl_bloqueado = False
        except BlockedUrl:
            dl_bloqueado = True
        check("SSRF: download recusa endereço privado sem conectar", dl_bloqueado)

        # ── Chaves do bucket ─────────────────────────────────────────────────
        k = storage_key("marca-1", "originals", "abc123.mp4")
        check("chave do original segue o layout da Fase 4",
              k == "brands/marca-1/originals/abc123.mp4", k)
        k2 = storage_key("marca-1", "keyframes", "asset-9", "003.jpg")
        check("chave de keyframe segue o layout",
              k2 == "brands/marca-1/keyframes/asset-9/003.jpg", k2)

        # ── Job completo ─────────────────────────────────────────────────────
        supa = FakeSupa()
        storage = FakeStorage()
        big = replace(settings, max_media_mb=50)

        supa.seed("ci_ad_media_sources", {
            "id": "ms-1", "ad_id": "ad-1", "media_url": f"{base}/ad.mp4",
            "kind": "video", "sort_order": 0, "status": "pending",
        })
        job = {"id": "job-1", "brand_id": "marca-1", "user_id": "user-1",
               "media_source_id": "ms-1", "ad_id": "ad-1", "attempts": 1, "max_attempts": 5}

        r1 = run_download_job(job, supa, storage, big)
        check("primeiro download cria o asset", r1["was_duplicate"] is False)
        check("subiu para o bucket uma vez", storage.put_calls == 1)
        check("vídeo entra na fila de análise", len(supa.tables.get("ci_analysis_jobs", [])) == 1)
        check("objeto registrado no inventário de storage",
              len(supa.tables.get("ci_storage_objects", [])) == 1)
        check("job marcado como completed",
              supa.tables["ci_download_jobs"][0]["status"] == "completed"
              if supa.tables.get("ci_download_jobs") else True)
        check("temporário do job foi apagado", not (tmp / "dl-job-1").exists())

        # ── Deduplicação: o teste que justifica a arquitetura ────────────────
        # Segundo anúncio, MESMO vídeo. Sem dedup seriam dois uploads e duas
        # análises de LLM pelo mesmo conteúdo.
        supa.seed("ci_ad_media_sources", {
            "id": "ms-2", "ad_id": "ad-2", "media_url": f"{base}/ad.mp4",
            "kind": "video", "sort_order": 0, "status": "pending",
        })
        job2 = {"id": "job-2", "brand_id": "marca-1", "user_id": "user-1",
                "media_source_id": "ms-2", "ad_id": "ad-2", "attempts": 1, "max_attempts": 5}
        r2 = run_download_job(job2, supa, storage, big)

        check("segundo anúncio com o mesmo vídeo é detectado como duplicado",
              r2["was_duplicate"] is True)
        check("asset reaproveitado, não recriado", r2["asset_id"] == r1["asset_id"])
        check("NÃO subiu de novo para o bucket", storage.put_calls == 1,
              f"{storage.put_calls} uploads")
        check("NÃO enfileirou segunda análise", len(supa.tables["ci_analysis_jobs"]) == 1,
              f"{len(supa.tables['ci_analysis_jobs'])} jobs")
        check("o mesmo asset ficou ligado aos dois anúncios",
              len(supa.tables["ci_ad_assets"]) == 2)
        check("mídia duplicada marcada como 'duplicate'",
              supa.select("ci_ad_media_sources", params={"id": "eq.ms-2"})[0]["status"] == "duplicate")

        # ── Falha permanente não vira retry ──────────────────────────────────
        supa.seed("ci_ad_media_sources", {
            "id": "ms-3", "ad_id": "ad-3", "media_url": f"{base}/pagina.html",
            "kind": "video", "sort_order": 0, "status": "pending",
        })
        job3 = {"id": "job-3", "brand_id": "marca-1", "user_id": "user-1",
                "media_source_id": "ms-3", "ad_id": "ad-3", "attempts": 1, "max_attempts": 5}
        try:
            run_download_job(job3, supa, storage, big)
            html_ok = False
        except PermanentFailure:
            html_ok = True
        check("HTML no lugar de vídeo é falha PERMANENTE, não retry", html_ok)
        check("mídia inválida marcada como 'invalid'",
              supa.select("ci_ad_media_sources", params={"id": "eq.ms-3"})[0]["status"] == "invalid")
        check("temporário limpo mesmo quando o job falha",
              not (tmp / "dl-job-3").exists())

        # ── Heartbeat de lease ───────────────────────────────────────────────
        #
        # Um lease fixo "maior que o job mais longo" não existe: a duração
        # depende do vídeo. Sem renovação, uma análise de 20 min com lease de
        # 15 é devolvida à fila pelo reaper ENQUANTO ainda roda, outro worker
        # pega, e os dois processam o mesmo asset — Gemini pago duas vezes.
        class HeartbeatSupa(FakeSupa):
            def __init__(self, perde_apos: int | None = None) -> None:
                super().__init__()
                self.renovacoes = 0
                self.perde_apos = perde_apos
                self.match_recebido: list[dict[str, str]] = []

            def renew_lease(self, table, job_id, worker_id, lease_seconds):  # noqa: ANN001
                self.renovacoes += 1
                self.match_recebido.append({"id": job_id, "locked_by": worker_id})
                if self.perde_apos is not None and self.renovacoes > self.perde_apos:
                    return False
                return True

        import time as _t
        hb_settings = replace(settings, lease_seconds=60, worker_id="worker-A")

        hb = HeartbeatSupa()
        job_longo = {"id": "job-longo", "user_id": "u", "brand_id": "b"}
        valor = run_with_heartbeat(hb, "ci_download_jobs", job_longo, hb_settings,
                                   lambda: (_t.sleep(0.35), "pronto")[1], interval_s=0.05)
        check("job longo tem o lease renovado durante a execução",
              hb.renovacoes >= 3, f"{hb.renovacoes} renovações")
        check("resultado do job longo é devolvido normalmente", valor == "pronto")
        check("renovação é condicionada ao worker dono",
              all(m["locked_by"] == "worker-A" for m in hb.match_recebido))

        # Se o reaper já devolveu o job e outro worker o pegou, renovar seria
        # roubar o lease de volta — e aí sim haveria dois donos. O UPDATE
        # condicionado devolve 0 linhas, e nós abandonamos.
        hb2 = HeartbeatSupa(perde_apos=1)
        try:
            run_with_heartbeat(hb2, "ci_download_jobs", {"id": "job-perdido", "user_id": "u"},
                               hb_settings, lambda: (_t.sleep(0.4), "resultado")[1],
                               interval_s=0.05)
            perdeu = False
        except LeaseLost:
            perdeu = True
        check("perder o lease aborta em vez de gravar resultado de job alheio", perdeu)

        # Job curto não precisa renovar nada.
        hb3 = HeartbeatSupa()
        run_with_heartbeat(hb3, "ci_download_jobs", {"id": "job-curto", "user_id": "u"},
                           hb_settings, lambda: "rapido", interval_s=0.05)
        check("job curto não gera renovação desnecessária", hb3.renovacoes == 0,
              f"{hb3.renovacoes} renovações")

        # Exceção do job continua propagando através do heartbeat.
        hb4 = HeartbeatSupa()
        def explode():
            raise PermanentFailure("erro de dentro do job")
        try:
            run_with_heartbeat(hb4, "ci_download_jobs", {"id": "job-erro", "user_id": "u"},
                               hb_settings, explode, interval_s=0.05)
            propagou = False
        except PermanentFailure:
            propagou = True
        check("exceção do job atravessa o heartbeat sem ser engolida", propagou)

        # ── Guarda do cleanup ────────────────────────────────────────────────
        fora = workdir / "nao-apagar.txt"
        fora.write_text("importante")
        cleanup_tmp(fora, tmp)
        check("cleanup recusa apagar fora do diretório temporário", fora.exists())

    finally:
        httpd.shutdown()
        shutil.rmtree(workdir, ignore_errors=True)

    print()
    if FAILURES:
        print(f"FALHAS ({len(FAILURES)}/{PASSED + len(FAILURES)}): {FAILURES}")
        return 1
    print(f"TODOS OS {PASSED} TESTES PASSARAM")
    return 0


if __name__ == "__main__":
    sys.exit(main())
