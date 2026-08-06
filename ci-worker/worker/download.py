"""
Job de download: da URL do anúncio até o asset no bucket.

Sequência:
  1. baixa por streaming para um temporário, calculando SHA-256 no mesmo passe
  2. valida tipo, tamanho e integridade
  3. procura asset com o mesmo SHA-256 na marca
  4. se existe → vincula e NÃO baixa de novo, NÃO sobe de novo, NÃO analisa de novo
  5. se não existe → sobe ao bucket, cria o asset, enfileira a análise
  6. vincula asset ao anúncio
  7. apaga o temporário, sempre — inclusive quando falha

── Por que a deduplicação é o item mais importante daqui ────────────────────
Uma marca recicla o mesmo vídeo em dezenas de anúncios: mesma peça, copy
diferente, público diferente. Sem dedup, 3.000 anúncios viram 3.000 downloads,
3.000 uploads e 3.000 análises de LLM. Com dedup, o mesmo asset é processado
uma vez e se liga a N anúncios.

E a chave é o conteúdo, não a URL: o CDN da Meta assina as URLs com token de
expiração, então a mesma mídia aparece com endereços diferentes a cada
requisição. Só o SHA-256 identifica de verdade.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import Settings
from .storage import (
    InvalidMedia,
    MediaTooLarge,
    StorageBackend,
    StorageError,
    cleanup_tmp,
    media_kind,
    storage_key,
    stream_download,
)
from .supa import Supa, SupabaseError


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class PermanentFailure(RuntimeError):
    """Não adianta retentar: vai falhar igual. Vai direto para 'failed'."""


def run_download_job(
    job: dict[str, Any],
    supa: Supa,
    storage: StorageBackend,
    settings: Settings,
) -> dict[str, Any]:
    job_id = job["id"]
    brand_id = job["brand_id"]
    user_id = job["user_id"]
    media_source_id = job["media_source_id"]
    ad_id = job["ad_id"]

    def stage(name: str, progress: int, **extra: Any) -> None:
        supa.update("ci_download_jobs", {"stage": name, "progress": progress, **extra},
                    match={"id": f"eq.{job_id}"})

    # ── A mídia ───────────────────────────────────────────────────────────────
    rows = supa.select("ci_ad_media_sources", params={
        "id": f"eq.{media_source_id}", "select": "id,media_url,thumbnail_url,kind,ad_id",
    })
    if not rows:
        raise PermanentFailure("A mídia de origem sumiu — o anúncio foi apagado?")
    media = rows[0]
    url = media["media_url"]

    tmp_path = settings.tmp_dir / f"dl-{job_id}"
    try:
        # ── 1. Download ───────────────────────────────────────────────────────
        stage("fetching", 5)
        supa.update("ci_ad_media_sources", {"status": "downloading"},
                    match={"id": f"eq.{media_source_id}"})

        last_report = 0.0

        def on_progress(done: int, total: int | None, speed: float) -> None:
            # Reporta no máximo a cada 2s. Sem isso, um vídeo de 80 MB geraria
            # centenas de UPDATEs e a fila viraria o gargalo.
            nonlocal last_report
            now = time.monotonic()
            if now - last_report < 2.0:
                return
            last_report = now
            pct = int(5 + 55 * (done / total)) if total else 30
            supa.update("ci_download_jobs", {
                "stage": "fetching", "progress": min(pct, 60),
                "bytes_downloaded": done, "bytes_total": total,
                "bytes_per_second": int(speed),
            }, match={"id": f"eq.{job_id}"})

        try:
            result = stream_download(url, tmp_path, settings, on_progress=on_progress)
        except (MediaTooLarge, InvalidMedia) as exc:
            # Erro do conteúdo, não do transporte: retentar não muda nada.
            supa.update("ci_ad_media_sources",
                        {"status": "invalid", "error": str(exc)[:500]},
                        match={"id": f"eq.{media_source_id}"})
            raise PermanentFailure(str(exc)) from exc

        # ── 2. Validação ──────────────────────────────────────────────────────
        stage("hashing", 65, bytes_downloaded=result.size_bytes, bytes_total=result.size_bytes)
        kind = media_kind(result.content_type, result.ext)
        if kind == "unknown":
            supa.update("ci_ad_media_sources",
                        {"status": "invalid", "error": f"tipo não suportado: {result.content_type}"},
                        match={"id": f"eq.{media_source_id}"})
            raise PermanentFailure(f"Tipo de mídia não suportado: {result.content_type}")

        # ── 3. Deduplicação ───────────────────────────────────────────────────
        stage("deduping", 70)
        existing = supa.select("ci_assets", params={
            "brand_id": f"eq.{brand_id}", "sha256": f"eq.{result.sha256}",
            "select": "id,storage_key,file_size_bytes,analysis_status", "limit": "1",
        })

        was_duplicate = bool(existing)
        if was_duplicate:
            asset = existing[0]
            asset_id = asset["id"]
            supa.log(
                user_id=user_id, brand_id=brand_id, job_kind="download", job_id=job_id,
                stage="deduped",
                message=f"Asset já existia (sha {result.sha256[:12]}…). Download e análise economizados.",
                payload={"asset_id": asset_id, "bytes_saved": result.size_bytes},
            )
        else:
            # ── 4. Upload ─────────────────────────────────────────────────────
            stage("uploading", 78)
            key = storage_key(brand_id, "originals", f"{result.sha256}{result.ext}")
            storage.put_file(key, result.path, result.content_type)

            created = supa.insert("ci_assets", {
                "brand_id": brand_id, "user_id": user_id,
                "sha256": result.sha256, "media_type": kind,
                "mime_type": result.content_type, "file_ext": result.ext,
                "file_size_bytes": result.size_bytes,
                "storage_key": key, "storage_bucket": settings.storage_bucket,
                "source_url": url, "downloaded_at": _now(),
                "integrity_ok": True,
                "analysis_status": "queued" if kind == "video" else "pending",
            })
            if not created:
                raise StorageError("O asset não foi criado no banco após o upload")
            asset_id = created[0]["id"]

            supa.insert("ci_storage_objects", {
                "brand_id": brand_id, "user_id": user_id, "asset_id": asset_id,
                "bucket": settings.storage_bucket, "object_key": key,
                "category": "originals", "content_type": result.content_type,
                "size_bytes": result.size_bytes, "sha256": result.sha256,
            }, upsert=True, on_conflict="bucket,object_key", ignore_duplicates=True)

            # Só vídeo entra na fila de análise. Imagem de carrossel não tem
            # transcript nem cena — analisá-la gastaria LLM por nada.
            if kind == "video":
                supa.insert("ci_analysis_jobs", {
                    "brand_id": brand_id, "user_id": user_id, "asset_id": asset_id,
                }, upsert=True, on_conflict="asset_id", ignore_duplicates=True)

        # ── 5/6. Vínculo ──────────────────────────────────────────────────────
        stage("linking", 90)
        supa.insert("ci_ad_assets", {
            "ad_id": ad_id, "asset_id": asset_id, "user_id": user_id,
            "media_source_id": media_source_id,
            "role": "carousel" if (media.get("sort_order") or 0) > 0 else "primary",
            "sort_order": media.get("sort_order") or 0,
            "was_deduplicated": was_duplicate,
        }, upsert=True, on_conflict="ad_id,asset_id,role", ignore_duplicates=True)

        supa.update("ci_ad_media_sources", {
            "status": "duplicate" if was_duplicate else "stored",
            "asset_id": asset_id, "error": None,
        }, match={"id": f"eq.{media_source_id}"})

        supa.update("ci_download_jobs", {
            "status": "completed", "stage": "complete", "progress": 100,
            "asset_id": asset_id, "was_duplicate": was_duplicate,
            "finished_at": _now(), "error": None, "error_code": None,
            "lease_expires_at": None, "locked_by": None,
        }, match={"id": f"eq.{job_id}"})

        return {
            "asset_id": asset_id,
            "was_duplicate": was_duplicate,
            "sha256": result.sha256,
            "size_bytes": result.size_bytes,
            "kind": kind,
        }

    finally:
        # ── 7. Temporário sempre some ─────────────────────────────────────────
        # No finally, não no caminho feliz: um job que falha no upload deixaria
        # o arquivo para trás, e depois de algumas centenas o disco da máquina
        # do Fly enche e TODOS os jobs passam a falhar por um motivo que não
        # tem nada a ver com o job.
        cleanup_tmp(tmp_path, settings.tmp_dir)
