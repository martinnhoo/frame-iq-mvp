"""
Configuração do worker.

Tudo por variável de ambiente, nada em arquivo versionado. No Fly.io as
credenciais entram por `fly secrets set`; local, por um .env que está no
.gitignore.

O worker é o único componente que segura a SERVICE_ROLE_KEY. Ela ignora RLS —
é o que permite escrever nas tabelas que o cliente só pode ler. Por isso o
worker nunca fala com o navegador: só com o Postgres e com o storage.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    return default if v is None else v.strip().lower() in {"1", "true", "yes", "on", "sim"}


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    service_role_key: str

    worker_id: str
    concurrency: int
    poll_interval_s: float
    lease_seconds: int

    storage_backend: str          # 'supabase' | 's3'
    storage_bucket: str
    s3_endpoint: str
    s3_region: str
    s3_bucket: str
    s3_access_key_id: str
    s3_secret_access_key: str

    tmp_dir: Path
    tmp_max_mb: int
    download_timeout_s: int
    max_media_mb: int
    # Segurança do downloader. O padrão é o seguro: se alguém esquecer de
    # configurar, o comportamento restritivo é o que vale.
    allow_private_urls: bool
    require_https: bool
    max_redirects: int

    gemini_api_key: str
    gemini_model: str
    openai_api_key: str
    openai_model: str
    hf_token: str

    whisper_model: str
    transcribe: bool
    ocr: bool
    face_analysis: bool
    max_keyframes: int
    scene_threshold: float

    ffmpeg: str
    ffprobe: str

    def require(self) -> None:
        """Falha na largada, não no meio do primeiro job."""
        missing = [
            name for name, value in (
                ("SUPABASE_URL", self.supabase_url),
                ("SUPABASE_SERVICE_ROLE_KEY", self.service_role_key),
            ) if not value
        ]
        if missing:
            raise RuntimeError(
                "Faltam variáveis obrigatórias: " + ", ".join(missing) +
                ". No Fly: fly secrets set -a <app> NOME=valor"
            )
        if self.storage_backend == "s3":
            s3_missing = [
                n for n, v in (
                    ("S3_BUCKET", self.s3_bucket),
                    ("S3_ACCESS_KEY_ID", self.s3_access_key_id),
                    ("S3_SECRET_ACCESS_KEY", self.s3_secret_access_key),
                ) if not v
            ]
            if s3_missing:
                raise RuntimeError(
                    "CI_STORAGE_BACKEND=s3 exige: " + ", ".join(s3_missing)
                )


def load_settings() -> Settings:
    tmp = Path(os.getenv("CI_TMP_DIR", "/tmp/ci-worker"))
    tmp.mkdir(parents=True, exist_ok=True)
    return Settings(
        supabase_url=os.getenv("SUPABASE_URL", "").rstrip("/"),
        service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),

        worker_id=os.getenv("CI_WORKER_ID") or f"worker-{os.getpid()}",
        concurrency=max(1, _int("CI_WORKER_CONCURRENCY", 1)),
        poll_interval_s=max(1.0, _float("CI_POLL_INTERVAL_S", 5.0)),
        # Precisa ser maior que o job mais longo esperado, senão o reaper
        # devolve à fila um job que ainda está rodando e ele roda duas vezes.
        lease_seconds=max(60, _int("CI_LEASE_SECONDS", 900)),

        storage_backend=os.getenv("CI_STORAGE_BACKEND", "supabase").lower(),
        storage_bucket=os.getenv("CI_STORAGE_BUCKET", "ci-media"),
        s3_endpoint=os.getenv("S3_ENDPOINT", ""),
        s3_region=os.getenv("S3_REGION", "auto"),
        s3_bucket=os.getenv("S3_BUCKET", ""),
        s3_access_key_id=os.getenv("S3_ACCESS_KEY_ID", ""),
        s3_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY", ""),

        tmp_dir=tmp,
        # O disco da máquina do Fly é pequeno. Acima disto o worker RECUSA
        # novos jobs em vez de encher o volume e travar tudo.
        tmp_max_mb=_int("CI_TMP_MAX_MB", 4096),
        download_timeout_s=_int("CI_DOWNLOAD_TIMEOUT_S", 180),
        max_media_mb=_int("CI_MAX_MEDIA_MB", 500),
        allow_private_urls=_bool("CI_ALLOW_PRIVATE_URLS", False),
        require_https=_bool("CI_REQUIRE_HTTPS", True),
        max_redirects=_int("CI_MAX_REDIRECTS", 3),

        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        hf_token=os.getenv("HF_TOKEN", ""),

        whisper_model=os.getenv("CI_WHISPER_MODEL", "small"),
        transcribe=_bool("CI_TRANSCRIBE", True),
        ocr=_bool("CI_OCR", True),
        face_analysis=_bool("CI_FACE_ANALYSIS", True),
        max_keyframes=max(8, _int("CI_MAX_KEYFRAMES", 80)),
        scene_threshold=min(0.95, max(0.05, _float("CI_SCENE_THRESHOLD", 0.28))),

        ffmpeg=os.getenv("CI_FFMPEG", "ffmpeg"),
        ffprobe=os.getenv("CI_FFPROBE", "ffprobe"),
    )
