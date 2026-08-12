"""
Job de análise: do asset no bucket até a taxonomia criativa no banco.

── Checkpoints: por que o banco e não o disco ───────────────────────────────
Cada estágio grava seu resultado no Postgres e registra o nome em
`completed_stages`. Na retomada, o estágio consulta o banco: se o transcript já
existe, ele é LIDO em vez de recalculado.

A alternativa — guardar artefatos intermediários no disco — falharia no caso
que mais importa: o volume do Fly sumir ou o job migrar de máquina. Com o
estado no banco, retomar funciona mesmo em outro worker, em outra região, dias
depois.

O único estágio que sempre reexecuta é `download`: buscar o vídeo do NOSSO
bucket para o disco local. É barato (rede interna) e é pré-requisito de
qualquer estágio de mídia. Nunca refaz o download da URL original nem regasta
crédito.

── O que isso resolve na prática ────────────────────────────────────────────
Se o Gemini falhar no fim — que é o estágio mais caro e mais frágil — o retry
não repete ffprobe, cenas, keyframes, áudio, transcrição nem OCR. Só a chamada
do Gemini. Sem isso, cada falha de LLM custaria minutos de CPU e o dobro de
tudo.

── Idempotência ─────────────────────────────────────────────────────────────
A garantia da fila é at-least-once. Toda escrita aqui é upsert com constraint
(asset_id + índice), então reexecutar um estágio sobrescreve em vez de
duplicar.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .config import Settings
from .logs import JobLogger, safe_url
from .media import (
    MediaError,
    build_scenes,
    cuts_per_second,
    detect_scene_cuts,
    extract_audio,
    extract_frame,
    pick_keyframe_times,
    probe,
    text_per_second,
)
from .semantic import analyze as semantic_analyze
from .storage import StorageBackend, StorageError, cleanup_tmp, storage_key, stream_download
from .supa import Supa
from .urlguard import UrlPolicy

# Ordem canônica. `completed_stages` guarda estes nomes.
STAGES = [
    "download",           # traz o asset do nosso bucket para o disco
    "validation",         # o arquivo é legível e é vídeo?
    "metadata",           # ffprobe
    "scenes",             # detecção de corte
    "keyframes",          # extração + upload dos JPEGs
    "audio",              # WAV para o Whisper
    "transcription",      # faster-whisper
    "ocr",                # texto na tela
    "semantic_analysis",  # Gemini
    "normalization",      # saída do modelo → formato do banco
    "persistence",        # grava taxonomia, resultado e agregados
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class AnalysisPermanentFailure(RuntimeError):
    """Não adianta retentar."""


class Ctx:
    """Estado que atravessa os estágios de uma execução."""

    def __init__(self, job: dict[str, Any], supa: Supa, storage: StorageBackend,
                 settings: Settings, log: JobLogger, workdir: Path) -> None:
        self.job = job
        self.supa = supa
        self.storage = storage
        self.settings = settings
        self.log = log
        self.workdir = workdir

        self.job_id: str = job["id"]
        self.asset_id: str = job["asset_id"]
        self.brand_id: str = job["brand_id"]
        self.user_id: str = job["user_id"]

        self.asset: dict[str, Any] = {}
        self.video: Path | None = None
        self.audio: Path | None = None
        self.probe: Any = None
        self.cuts: list[float] = []
        self.scenes: list[dict[str, Any]] = []
        self.keyframes: list[dict[str, Any]] = []
        self.keyframe_paths: list[Path] = []
        self.segments: list[dict[str, Any]] = []
        self.transcript_text: str = ""
        self.onscreen: list[dict[str, Any]] = []
        self.semantic: Any = None
        self.warnings: list[str] = []

    @property
    def completed(self) -> list[str]:
        return list(self.job.get("completed_stages") or [])

    @property
    def skipped(self) -> list[str]:
        return list(self.job.get("skipped_stages") or [])

    def mark(self, stage: str, *, skipped: bool = False, warning: str | None = None) -> None:
        completed = self.completed
        skipped_list = self.skipped
        if stage not in completed:
            completed.append(stage)
        if skipped and stage not in skipped_list:
            skipped_list.append(stage)
        if warning:
            self.warnings.append(warning)

        self.job["completed_stages"] = completed
        self.job["skipped_stages"] = skipped_list
        progress = int(100 * len(completed) / len(STAGES))
        self.supa.update("ci_analysis_jobs", {
            "completed_stages": completed,
            "skipped_stages": skipped_list,
            "stage": stage,
            "progress": min(progress, 99),
            "warnings": [{"stage": s, "message": w}
                         for s, w in zip([stage] * len(self.warnings), self.warnings)][-20:],
        }, match={"id": f"eq.{self.job_id}"})


# ══ Estágios ═════════════════════════════════════════════════════════════════

def stage_download(ctx: Ctx) -> None:
    """
    Traz o asset do NOSSO bucket. Sempre reexecuta na retomada — o arquivo
    local pode não existir mais — mas nunca toca na URL original nem gasta
    crédito.
    """
    rows = ctx.supa.select("ci_assets", params={
        "id": f"eq.{ctx.asset_id}",
        # Precisa trazer TODAS as colunas que _probe_from_asset reconstrói.
        # Sem width/height/fps/has_audio, um job RETOMADO monta um probe
        # incompleto: has_audio vira False e o estágio de áudio é pulado com
        # "vídeo sem trilha" — mesmo num vídeo com fala. Degradação silenciosa,
        # e o resultado é um anúncio sem transcrição indistinguível de um mudo.
        "select": "id,sha256,storage_key,storage_bucket,media_type,file_ext,"
                  "file_size_bytes,mime_type,duration_seconds,analysis_status,"
                  "width,height,fps,video_codec,audio_codec,has_audio,bitrate,aspect_ratio",
    })
    if not rows:
        raise AnalysisPermanentFailure("asset não existe mais")
    ctx.asset = rows[0]

    if ctx.asset.get("media_type") != "video":
        raise AnalysisPermanentFailure(
            f"asset é '{ctx.asset.get('media_type')}', não vídeo — nada a analisar")

    signed = ctx.storage.signed_url(ctx.asset["storage_key"], expires_in=1800)
    dest = ctx.workdir / f"asset{ctx.asset.get('file_ext') or '.mp4'}"

    # URL do nosso próprio storage: é interna e assinada, então a política de
    # SSRF pode permitir o host sem abrir mão de nada. `require_https` continua.
    result = stream_download(signed, dest, ctx.settings, policy=UrlPolicy(
        allow_private=ctx.settings.allow_private_urls,
        require_https=ctx.settings.require_https,
    ))
    ctx.video = result.path
    ctx.log.emit("asset_fetched", bytes=result.size_bytes,
                 storage_key=ctx.asset["storage_key"], url=safe_url(signed))


def stage_validation(ctx: Ctx) -> None:
    if not ctx.video or not ctx.video.exists() or ctx.video.stat().st_size == 0:
        raise StorageError("arquivo baixado do bucket está vazio")
    # O SHA-256 do que veio do bucket precisa bater com o que gravamos. Se não
    # bate, o objeto foi corrompido ou trocado, e analisar seria pior que falhar.
    import hashlib
    digest = hashlib.sha256()
    with ctx.video.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 256), b""):
            digest.update(block)
    if ctx.asset.get("sha256") and digest.hexdigest() != ctx.asset["sha256"]:
        raise AnalysisPermanentFailure(
            "integridade falhou: o objeto no bucket não bate com o sha256 registrado")
    ctx.log.emit("integrity_ok", sha256_prefix=digest.hexdigest()[:12])


def stage_metadata(ctx: Ctx) -> None:
    if "metadata" in ctx.completed and ctx.asset.get("duration_seconds"):
        ctx.probe = _probe_from_asset(ctx.asset)
        ctx.log.emit("reused_from_db", stage="metadata")
        return
    ctx.probe = probe(ctx.video, ctx.settings)  # type: ignore[arg-type]
    ctx.supa.update("ci_assets", {
        "duration_seconds": ctx.probe.duration_s,
        "width": ctx.probe.width, "height": ctx.probe.height,
        "fps": ctx.probe.fps, "video_codec": ctx.probe.video_codec,
        "audio_codec": ctx.probe.audio_codec, "has_audio": ctx.probe.has_audio,
        "bitrate": ctx.probe.bitrate, "aspect_ratio": ctx.probe.aspect_ratio,
        "analysis_version": "1.0.0",
    }, match={"id": f"eq.{ctx.asset_id}"})
    ctx.log.emit("probed", duration_s=ctx.probe.duration_s,
                 resolution=f"{ctx.probe.width}x{ctx.probe.height}")


def _probe_from_asset(asset: dict[str, Any]) -> Any:
    from .media import Probe
    return Probe(
        duration_s=float(asset["duration_seconds"]) if asset.get("duration_seconds") else None,
        width=asset.get("width"), height=asset.get("height"),
        fps=float(asset["fps"]) if asset.get("fps") else None,
        video_codec=asset.get("video_codec"), audio_codec=asset.get("audio_codec"),
        has_audio=bool(asset.get("has_audio")), bitrate=asset.get("bitrate"),
        aspect_ratio=asset.get("aspect_ratio"),
    )


def stage_scenes(ctx: Ctx) -> None:
    existing = ctx.supa.select("ci_scenes", params={
        "asset_id": f"eq.{ctx.asset_id}",
        "select": "scene_index,start_seconds,end_seconds", "order": "scene_index",
    })
    if "scenes" in ctx.completed and existing:
        ctx.scenes = existing
        ctx.cuts = [float(s["start_seconds"]) for s in existing[1:]]
        ctx.log.emit("reused_from_db", stage="scenes", count=len(existing))
        return

    duration = ctx.probe.duration_s if ctx.probe else None
    ctx.cuts = detect_scene_cuts(ctx.video, ctx.settings, duration)  # type: ignore[arg-type]
    ctx.scenes = build_scenes(ctx.cuts, duration)

    if ctx.scenes:
        ctx.supa.insert("ci_scenes", [{
            "asset_id": ctx.asset_id, "brand_id": ctx.brand_id, "user_id": ctx.user_id,
            "scene_index": s["scene_index"],
            "start_seconds": s["start_seconds"], "end_seconds": s["end_seconds"],
            "source": "ffmpeg", "confidence": 0.7,
        } for s in ctx.scenes], upsert=True, on_conflict="asset_id,scene_index")
    ctx.log.emit("scenes_detected", cuts=len(ctx.cuts), scenes=len(ctx.scenes))


def stage_keyframes(ctx: Ctx) -> None:
    existing = ctx.supa.select("ci_keyframes", params={
        "asset_id": f"eq.{ctx.asset_id}",
        "select": "frame_index,timestamp_s,storage_key,reason", "order": "frame_index",
    })
    if "keyframes" in ctx.completed and existing:
        ctx.keyframes = existing
        # Rebaixa os JPEGs do bucket: o Gemini precisa dos bytes, e o disco
        # local pode ter sido limpo entre execuções.
        for row in existing:
            local = ctx.workdir / f"kf{row['frame_index']:03d}.jpg"
            try:
                stream_download(ctx.storage.signed_url(row["storage_key"], 900), local,
                                ctx.settings, policy=UrlPolicy(
                                    allow_private=ctx.settings.allow_private_urls,
                                    require_https=ctx.settings.require_https))
                ctx.keyframe_paths.append(local)
            except (StorageError, OSError):
                continue
        ctx.log.emit("reused_from_db", stage="keyframes", count=len(existing))
        return

    duration = ctx.probe.duration_s if ctx.probe else None
    picks = pick_keyframe_times(ctx.scenes, duration, ctx.settings.max_keyframes)

    rows: list[dict[str, Any]] = []
    for index, (timestamp, reason) in enumerate(picks):
        local = ctx.workdir / f"kf{index:03d}.jpg"
        try:
            extract_frame(ctx.video, timestamp, local, ctx.settings)  # type: ignore[arg-type]
        except MediaError as exc:
            ctx.warnings.append(f"keyframe em {timestamp:.1f}s falhou: {exc}")
            continue
        key = storage_key(ctx.brand_id, "keyframes", ctx.asset_id, f"{index:03d}.jpg")
        ctx.storage.put_file(key, local, "image/jpeg")
        ctx.keyframe_paths.append(local)
        size = local.stat().st_size
        rows.append({
            "asset_id": ctx.asset_id, "brand_id": ctx.brand_id, "user_id": ctx.user_id,
            "frame_index": index, "timestamp_s": timestamp,
            "storage_key": key, "reason": reason, "size_bytes": size,
        })
        ctx.supa.insert("ci_storage_objects", {
            "brand_id": ctx.brand_id, "user_id": ctx.user_id, "asset_id": ctx.asset_id,
            "bucket": ctx.settings.storage_bucket, "object_key": key,
            "category": "keyframes", "content_type": "image/jpeg", "size_bytes": size,
        }, upsert=True, on_conflict="bucket,object_key", ignore_duplicates=True)

    if rows:
        ctx.supa.insert("ci_keyframes", rows, upsert=True, on_conflict="asset_id,frame_index")
    ctx.keyframes = rows

    # A capa vira a thumbnail do asset — é o que a listagem de anúncios mostra.
    if rows:
        ctx.supa.update("ci_assets", {"thumbnail_key": rows[0]["storage_key"]},
                        match={"id": f"eq.{ctx.asset_id}"})
    ctx.log.emit("keyframes_extracted", count=len(rows),
                 bytes=sum(r["size_bytes"] for r in rows))


def stage_audio(ctx: Ctx) -> None:
    if ctx.probe and not ctx.probe.has_audio:
        ctx.mark("audio", skipped=True, warning="vídeo sem trilha de áudio")
        return
    ctx.audio = extract_audio(ctx.video, ctx.workdir / "audio.wav", ctx.settings)  # type: ignore[arg-type]
    if not ctx.audio:
        ctx.mark("audio", skipped=True, warning="não foi possível extrair áudio")
        return
    ctx.log.emit("audio_extracted", bytes=ctx.audio.stat().st_size)


def stage_transcription(ctx: Ctx) -> None:
    existing = ctx.supa.select("ci_transcripts", params={
        "asset_id": f"eq.{ctx.asset_id}", "select": "id,full_text", "limit": "1",
    })
    if "transcription" in ctx.completed and existing:
        ctx.transcript_text = existing[0].get("full_text") or ""
        ctx.segments = ctx.supa.select("ci_transcript_segments", params={
            "asset_id": f"eq.{ctx.asset_id}",
            "select": "segment_index,start_seconds,end_seconds,text",
            "order": "segment_index",
        })
        ctx.log.emit("reused_from_db", stage="transcription", segments=len(ctx.segments))
        return

    if not ctx.audio or not ctx.settings.transcribe:
        ctx.mark("transcription", skipped=True,
                 warning="sem áudio ou transcrição desligada")
        return

    try:
        from faster_whisper import WhisperModel  # type: ignore
    except ImportError:
        # Degradação explícita: o pipeline segue, mas fica registrado que a
        # análise deste asset não tem fala. Silenciar aqui produziria um
        # anúncio "sem transcrição" indistinguível de um anúncio mudo.
        ctx.mark("transcription", skipped=True,
                 warning="faster-whisper não instalado — sem transcrição")
        return

    model = WhisperModel(ctx.settings.whisper_model, device="cpu", compute_type="int8")
    segments_iter, info = model.transcribe(str(ctx.audio), vad_filter=True)

    rows: list[dict[str, Any]] = []
    parts: list[str] = []
    for index, seg in enumerate(segments_iter):
        text = (seg.text or "").strip()
        if not text:
            continue
        parts.append(text)
        rows.append({
            "segment_index": index,
            "start_seconds": round(seg.start, 3), "end_seconds": round(seg.end, 3),
            "text": text,
            "confidence": round(getattr(seg, "avg_logprob", 0.0), 4),
            "no_speech_prob": round(getattr(seg, "no_speech_prob", 0.0), 4),
        })

    ctx.transcript_text = " ".join(parts)
    duration = ctx.probe.duration_s if ctx.probe else None
    words = len(ctx.transcript_text.split())

    created = ctx.supa.insert("ci_transcripts", {
        "asset_id": ctx.asset_id, "brand_id": ctx.brand_id, "user_id": ctx.user_id,
        "language": getattr(info, "language", None),
        "language_prob": round(getattr(info, "language_probability", 0.0), 4),
        "full_text": ctx.transcript_text, "word_count": words,
        "duration_seconds": duration,
        "speech_rate": round(words / duration, 3) if duration else None,
        "engine": "faster-whisper", "engine_model": ctx.settings.whisper_model,
    }, upsert=True, on_conflict="asset_id")

    transcript_id = created[0]["id"] if created else existing[0]["id"] if existing else None
    if transcript_id and rows:
        ctx.supa.insert("ci_transcript_segments", [{
            "transcript_id": transcript_id, "asset_id": ctx.asset_id,
            "user_id": ctx.user_id, **row,
        } for row in rows], upsert=True, on_conflict="transcript_id,segment_index")

    ctx.segments = rows
    ctx.log.emit("transcribed", segments=len(rows), words=words,
                 language=getattr(info, "language", None))


def _pick_ocr_engine() -> tuple[str | None, Callable[[Path], list[tuple[str, float]]]]:
    """
    Escolhe o motor de OCR disponível e devolve (nome, função de leitura).

    Prefere easyocr quando instalado — lê texto estilizado de anúncio melhor —
    e cai para tesseract, que é o que vem na imagem padrão. O nome do motor é
    gravado em cada registro, então dá para saber depois com o que cada texto
    foi lido em vez de comparar resultados de motores diferentes achando que
    são a mesma medida.

    Sem nenhum dos dois, devolve (None, ...) e o estágio é PULADO de forma
    visível — nunca silenciosamente dado como feito.
    """
    try:
        import easyocr  # type: ignore

        reader = easyocr.Reader(["en", "pt"], gpu=False, verbose=False)

        def ler_easyocr(path: Path) -> list[tuple[str, float]]:
            saida = []
            for _box, text, confidence in reader.readtext(str(path)):
                cleaned = (text or "").strip()
                if len(cleaned) >= 2 and confidence >= 0.4:
                    saida.append((cleaned, float(confidence)))
            return saida

        return "easyocr", ler_easyocr
    except ImportError:
        pass

    try:
        import pytesseract  # type: ignore
        from PIL import Image  # type: ignore
    except ImportError:
        return None, lambda _p: []

    def ler_tesseract(path: Path) -> list[tuple[str, float]]:
        # image_to_data e não image_to_string: precisamos da confiança por
        # palavra para descartar ruído. image_to_string devolve tudo junto,
        # inclusive lixo que o motor sabe que é lixo.
        dados = pytesseract.image_to_data(
            Image.open(path), lang="eng+por",
            output_type=pytesseract.Output.DICT,
        )
        # Agrupa palavras da mesma linha: "SHOP NOW" é uma mensagem, não duas.
        linhas: dict[tuple, list[tuple[str, float]]] = {}
        for i, palavra in enumerate(dados.get("text", [])):
            limpa = (palavra or "").strip()
            try:
                conf = float(dados["conf"][i])
            except (ValueError, KeyError, IndexError):
                continue
            if not limpa or conf < 55:
                continue
            chave = (dados["block_num"][i], dados["par_num"][i], dados["line_num"][i])
            linhas.setdefault(chave, []).append((limpa, conf))

        saida = []
        for palavras in linhas.values():
            texto = " ".join(p for p, _ in palavras).strip()
            if len(texto) < 2:
                continue
            media = sum(c for _, c in palavras) / len(palavras)
            saida.append((texto, media / 100.0))  # tesseract dá 0–100
        return saida

    return "tesseract", ler_tesseract


def stage_ocr(ctx: Ctx) -> None:
    existing = ctx.supa.select("ci_onscreen_text", params={
        "asset_id": f"eq.{ctx.asset_id}",
        "select": "track_index,start_seconds,end_seconds,text", "order": "track_index",
    })
    if "ocr" in ctx.completed and existing:
        ctx.onscreen = existing
        ctx.log.emit("reused_from_db", stage="ocr", tracks=len(existing))
        return

    if not ctx.settings.ocr or not ctx.keyframe_paths:
        ctx.mark("ocr", skipped=True, warning="OCR desligado ou sem keyframes")
        return

    engine, read_frame = _pick_ocr_engine()
    if engine is None:
        ctx.mark("ocr", skipped=True,
                 warning="nenhum motor de OCR instalado (pytesseract ou easyocr) — sem texto na tela")
        return

    observations: list[dict[str, Any]] = []
    for path, meta in zip(ctx.keyframe_paths, ctx.keyframes):
        timestamp = float(meta.get("timestamp_s", 0))
        try:
            for cleaned, confidence in read_frame(path):
                observations.append({
                    "timestamp_s": timestamp, "text": cleaned,
                    "confidence": round(float(confidence), 4),
                })
        except Exception as exc:  # noqa: BLE001
            ctx.warnings.append(f"OCR falhou em {timestamp:.1f}s: {exc}")

    if observations:
        ctx.supa.insert("ci_ocr_tracks", [{
            "asset_id": ctx.asset_id, "user_id": ctx.user_id, "engine": engine, **o,
        } for o in observations])

    # Funde observações do mesmo texto em keyframes consecutivos numa faixa
    # temporal. "O texto X ficou na tela de 0.5s a 2.8s" é legível; a lista
    # bruta por frame não é.
    merged: list[dict[str, Any]] = []
    for obs in observations:
        norm = obs["text"].lower()
        if merged and merged[-1]["_norm"] == norm and obs["timestamp_s"] - merged[-1]["end_seconds"] <= 2.5:
            merged[-1]["end_seconds"] = obs["timestamp_s"]
        else:
            merged.append({"_norm": norm, "text": obs["text"],
                           "start_seconds": obs["timestamp_s"],
                           "end_seconds": obs["timestamp_s"],
                           "confidence": obs["confidence"]})

    rows = [{
        "asset_id": ctx.asset_id, "brand_id": ctx.brand_id, "user_id": ctx.user_id,
        "track_index": index, "start_seconds": m["start_seconds"],
        "end_seconds": max(m["end_seconds"], m["start_seconds"] + 0.3),
        "text": m["text"], "normalized_text": m["_norm"],
        "confidence": m["confidence"], "source": "ocr", "model_version": engine,
    } for index, m in enumerate(merged)]

    if rows:
        ctx.supa.insert("ci_onscreen_text", rows, upsert=True, on_conflict="asset_id,track_index")
    ctx.onscreen = rows
    ctx.log.emit("ocr_done", observations=len(observations), tracks=len(rows))


def stage_semantic_analysis(ctx: Ctx) -> None:
    existing = ctx.supa.select("ci_analysis_results", params={
        "asset_id": f"eq.{ctx.asset_id}", "kind": "eq.semantic",
        "is_current": "eq.true",
        "select": "id,normalized_output,raw_output,provider,model,fidelity,prompt_version",
        "limit": "1",
    })
    if "semantic_analysis" in ctx.completed and existing:
        # Este é o reuso que mais importa: não repagar o Gemini.
        from .semantic import SemanticResult
        row = existing[0]
        ctx.semantic = SemanticResult(
            normalized=row.get("normalized_output") or {}, raw=row.get("raw_output") or {},
            provider=row.get("provider") or "gemini", model=row.get("model") or "",
            # A versão vem da linha, não cravada: um resultado gravado pelo
            # prompt v1 e reusado não pode se apresentar como v2.
            prompt_version=row.get("prompt_version") or "semantic/v1",
            fidelity=row.get("fidelity") or "full",
        )
        ctx.log.emit("reused_from_db", stage="semantic_analysis", note="Gemini NÃO recobrado")
        return

    ad_rows = ctx.supa.select("ci_ad_assets", params={
        "asset_id": f"eq.{ctx.asset_id}", "select": "ad_id", "limit": "1",
    })
    body_text = None
    if ad_rows:
        ads = ctx.supa.select("ci_ads", params={
            "id": f"eq.{ad_rows[0]['ad_id']}", "select": "body_text", "limit": "1"})
        body_text = ads[0].get("body_text") if ads else None

    metadata = {
        "duration_s": ctx.probe.duration_s if ctx.probe else None,
        "width": ctx.probe.width if ctx.probe else None,
        "height": ctx.probe.height if ctx.probe else None,
        "aspect_ratio": ctx.probe.aspect_ratio if ctx.probe else None,
        "cut_count": len(ctx.cuts), "body_text": body_text,
    }

    started = time.monotonic()
    # A heurística local só entra quando as tentativas acabaram. Antes disso a
    # exceção sobe e o job volta para a fila — falha transitória de rede não
    # pode virar dado permanente de regex.
    tentativas = int(ctx.job.get("attempts") or 0)
    maximo = int(ctx.job.get("max_attempts") or 3)
    ultima_chance = tentativas >= maximo - 1

    ctx.semantic = semantic_analyze(
        ctx.settings, ctx.keyframe_paths, ctx.transcript_text,
        ctx.segments, ctx.onscreen, metadata,
        permitir_fallback=ultima_chance)

    if ctx.semantic.fidelity == "degraded":
        # Nível error de propósito: isto aparece na tela de saúde e na fila,
        # não só num campo de aviso que ninguém abre.
        ctx.log.error(
            "análise DEGRADADA: feita por heurística local, não pelo modelo",
            error_code="semantic_degraded", retryable=False,
            stage="semantic_analysis")
    ctx.warnings.extend(ctx.semantic.warnings)

    ctx.supa.insert("ci_model_runs", {
        "brand_id": ctx.brand_id, "user_id": ctx.user_id, "asset_id": ctx.asset_id,
        "analysis_job_id": ctx.job_id, "purpose": "semantic_analysis",
        "provider": ctx.semantic.provider, "model": ctx.semantic.model,
        "prompt_version": ctx.semantic.prompt_version,
        "scope": "legacy_mixed",
        "analysis_contract_version": "legacy/semantic-v7",
        "input_schema_version": "legacy/semantic-input-v7",
        "output_schema_version": "legacy/semantic-output-v7",
        "input_summary": {"keyframes": len(ctx.keyframe_paths),
                          "segments": len(ctx.segments), "onscreen": len(ctx.onscreen)},
        "status": "completed",
        "input_tokens": ctx.semantic.input_tokens,
        "output_tokens": ctx.semantic.output_tokens,
        "cost_usd": ctx.semantic.cost_usd,
        "latency_ms": ctx.semantic.latency_ms or int((time.monotonic() - started) * 1000),
        "finished_at": _now(),
    })

    ctx.supa.update("ci_analysis_jobs", {
        "llm_provider": ctx.semantic.provider, "llm_model": ctx.semantic.model,
        "llm_input_tokens": ctx.semantic.input_tokens,
        "llm_output_tokens": ctx.semantic.output_tokens,
        "cost_usd": ctx.semantic.cost_usd,
    }, match={"id": f"eq.{ctx.job_id}"})

    ctx.log.emit("semantic_done", provider=ctx.semantic.provider,
                 fidelity=ctx.semantic.fidelity, cost_usd=ctx.semantic.cost_usd,
                 input_tokens=ctx.semantic.input_tokens,
                 output_tokens=ctx.semantic.output_tokens)


def stage_normalization(ctx: Ctx) -> None:
    """A normalização já acontece dentro de semantic.analyze; aqui ela é gravada."""
    if not ctx.semantic:
        raise AnalysisPermanentFailure("normalização sem resultado semântico")

    n = ctx.semantic.normalized
    timing = n.get("timing", {})
    flags = n.get("flags", {})
    duration = ctx.probe.duration_s if ctx.probe else None
    total_ost_chars = sum(len(t.get("text", "")) for t in ctx.onscreen)

    ctx.supa.insert("ci_analysis_results", {
        "asset_id": ctx.asset_id, "brand_id": ctx.brand_id, "user_id": ctx.user_id,
        "ad_id": None, "kind": "semantic",
        "scope": "legacy_mixed", "analysis_contract_version": "legacy/semantic-v7",
        "raw_output": ctx.semantic.raw, "normalized_output": n,
        "time_to_product_s": timing.get("time_to_product_s"),
        "time_to_offer_s": timing.get("time_to_offer_s"),
        "time_to_cta_s": timing.get("time_to_cta_s"),
        "hook_duration_s": timing.get("hook_duration_s"),
        "cut_count": len(ctx.cuts),
        "cuts_per_second": cuts_per_second(len(ctx.cuts), duration),
        "text_per_second": text_per_second(total_ost_chars, duration),
        "has_before_after": flags.get("has_before_after"),
        "has_testimonial": flags.get("has_testimonial"),
        "has_problem_solution": flags.get("has_problem_solution"),
        "has_urgency": flags.get("has_urgency"),
        "has_social_proof": flags.get("has_social_proof"),
        "has_demonstration": flags.get("has_demonstration"),
        "provider": ctx.semantic.provider, "model": ctx.semantic.model,
        "prompt_version": ctx.semantic.prompt_version,
        "fidelity": ctx.semantic.fidelity,
        "warnings": [{"message": w} for w in ctx.warnings][:20],
    })
    ctx.log.emit("normalized", terms=len(n.get("terms", [])))


def stage_persistence(ctx: Ctx) -> None:
    """Grava a taxonomia e liga os termos aos anúncios que usam este asset."""
    terms = (ctx.semantic.normalized.get("terms") if ctx.semantic else []) or []

    ad_rows = ctx.supa.select("ci_ad_assets", params={
        "asset_id": f"eq.{ctx.asset_id}", "select": "ad_id",
    })
    ad_ids = [r["ad_id"] for r in ad_rows]

    # Enriquece as cenas com o que o modelo disse, casando por sobreposição
    # temporal com as cenas que o ffmpeg detectou.
    for scene in (ctx.semantic.normalized.get("scenes") if ctx.semantic else []) or []:
        match = next((s for s in ctx.scenes
                      if float(s["start_seconds"]) <= float(scene["start_seconds"]) + 0.5
                      <= float(s["end_seconds"])), None)
        if not match:
            continue
        ctx.supa.update("ci_scenes", {
            "setting": scene.get("setting"), "setting_kind": scene.get("setting_kind"),
            "description": scene.get("description"), "camera_style": scene.get("camera_style"),
            "framing": scene.get("framing"), "action": scene.get("action"),
            "scene_function": scene.get("scene_function"),
            "product_visible": scene.get("product_visible"),
            "confidence": scene.get("confidence"),
            "source": "ffmpeg+semantic",
            "model_version": ctx.semantic.model if ctx.semantic else None,
        }, match={"asset_id": f"eq.{ctx.asset_id}",
                  "scene_index": f"eq.{match['scene_index']}"})

    created_terms = 0
    for term in terms:
        rows = ctx.supa.insert("ci_taxonomy_terms", {
            "brand_id": ctx.brand_id, "user_id": ctx.user_id,
            "kind": term["kind"], "slug": term["slug"], "label": term["label"],
        }, upsert=True, on_conflict="brand_id,kind,slug")
        if not rows:
            rows = ctx.supa.select("ci_taxonomy_terms", params={
                "brand_id": f"eq.{ctx.brand_id}", "kind": f"eq.{term['kind']}",
                "slug": f"eq.{term['slug']}", "select": "id", "limit": "1"})
        if not rows:
            continue
        term_id = rows[0]["id"]
        created_terms += 1

        for ad_id in ad_ids:
            ctx.supa.insert("ci_ad_taxonomy", {
                "ad_id": ad_id, "term_id": term_id, "asset_id": ctx.asset_id,
                "brand_id": ctx.brand_id, "user_id": ctx.user_id,
                "confidence": term["confidence"], "evidence": term["evidence"],
                "evidence_kind": term.get("evidence_kind"),
                "timestamp_s": term.get("timestamp_s"),
                "source": term["source"], "model_version": term["model_version"],
                "claim_scope": "legacy_mixed",
                "provenance_class": "MODEL_INFERRED",
                "analysis_contract_version": "legacy/semantic-v7",
                # on_conflict é OBRIGATÓRIO aqui, não opcional: sem ele o modo
                # proxy cai em INSERT puro e a primeira duplicata derruba o job
                # depois de já ter gasto Gemini. dedup_key é coluna gerada —
                # não se escreve nela, só se mira o índice por ela.
            }, upsert=True, on_conflict="ad_id,term_id,dedup_key,assertion_version_key",
               ignore_duplicates=True)

    # Recalcula as contagens dos termos. Sem isto, ad_count fica em zero e a
    # página Messages sai vazia sem erro visível.
    try:
        ctx.supa.rpc("ci_refresh_taxonomy_stats", {"p_brand_id": ctx.brand_id})
    except Exception as exc:  # noqa: BLE001
        ctx.warnings.append(f"refresh de taxonomia falhou: {exc}")

    ctx.supa.update("ci_assets", {
        "analysis_status": "completed", "analyzed_at": _now(),
    }, match={"id": f"eq.{ctx.asset_id}"})
    for ad_id in ad_ids:
        ctx.supa.update("ci_ads", {"analysis_status": "completed"},
                        match={"id": f"eq.{ad_id}"})

    ctx.log.emit("persisted", terms=created_terms, ads_linked=len(ad_ids))


STAGE_FUNCS: dict[str, Callable[[Ctx], None]] = {
    "download": stage_download,
    "validation": stage_validation,
    "metadata": stage_metadata,
    "scenes": stage_scenes,
    "keyframes": stage_keyframes,
    "audio": stage_audio,
    "transcription": stage_transcription,
    "ocr": stage_ocr,
    "semantic_analysis": stage_semantic_analysis,
    "normalization": stage_normalization,
    "persistence": stage_persistence,
}

# Estágios que SEMPRE reexecutam, porque produzem estado em disco que a
# retomada precisa e que não vale a pena persistir.
ALWAYS_RERUN = {"download", "validation"}


def run_analysis_job(job: dict[str, Any], supa: Supa, storage: StorageBackend,
                     settings: Settings) -> dict[str, Any]:
    log = JobLogger(
        job_kind="analysis", job_id=job["id"], asset_id=job["asset_id"],
        worker_id=settings.worker_id, attempt=job.get("attempts"),
    )
    workdir = settings.tmp_dir / f"an-{job['id']}"
    workdir.mkdir(parents=True, exist_ok=True)
    ctx = Ctx(job, supa, storage, settings, log, workdir)

    log.emit("job_started", completed_stages=ctx.completed)

    try:
        for stage in STAGES:
            if stage in ctx.completed and stage not in ALWAYS_RERUN:
                # O estágio já rodou numa tentativa anterior. Ele ainda é
                # chamado, mas lê do banco em vez de recalcular — é o que
                # impede o retry do Gemini de repetir ffmpeg e whisper.
                log.emit("checkpoint_skip", stage=stage)

            log.begin_stage(stage)
            try:
                STAGE_FUNCS[stage](ctx)
            except (AnalysisPermanentFailure, MediaError):
                raise
            except Exception as exc:  # noqa: BLE001
                log.error(f"estágio {stage} falhou: {exc}",
                          error_code=type(exc).__name__.lower(), retryable=True, stage=stage,
                          detail=getattr(exc, "detail", "") or "")
                raise
            log.end_stage(stage)
            ctx.mark(stage)

        supa.update("ci_analysis_jobs", {
            "status": "completed", "stage": "complete", "progress": 100,
            "finished_at": _now(), "error": None, "error_code": None,
            "locked_by": None, "lease_expires_at": None,
        }, match={"id": f"eq.{ctx.job_id}"})

        # O pico por estágio é o número que decide se cabe concurrency=2. Vai no
        # resumo do job para não ser preciso reler estágio por estágio depois.
        from .logs import memoria_mb  # noqa: PLC0415
        mem = memoria_mb()
        log.emit("job_completed", stage_timings=log.stage_timings,
                 warnings=len(ctx.warnings),
                 **({"mem_mb": mem["atual"], "mem_pico_mb": mem["pico"]} if mem else {}))

        return {
            "asset_id": ctx.asset_id,
            "completed_stages": ctx.completed,
            "skipped_stages": ctx.skipped,
            "stage_timings_ms": log.stage_timings,
            "scenes": len(ctx.scenes),
            "keyframes": len(ctx.keyframes),
            "segments": len(ctx.segments),
            "onscreen": len(ctx.onscreen),
            "terms": len((ctx.semantic.normalized.get("terms") if ctx.semantic else []) or []),
            "fidelity": ctx.semantic.fidelity if ctx.semantic else None,
            "cost_usd": ctx.semantic.cost_usd if ctx.semantic else None,
            "warnings": ctx.warnings,
        }
    finally:
        # O diretório inteiro do job some — vídeo, WAV e todos os JPEGs. Os
        # keyframes que importam já estão no bucket.
        cleanup_tmp(workdir, settings.tmp_dir)
