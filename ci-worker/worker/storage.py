"""
Camada de storage do Creative Intelligence.

Dois backends com a mesma interface:

  'supabase' — usa o bucket ci-media com a service role. Zero credencial nova,
               uma fatura só. É o padrão.
  's3'       — qualquer endpoint compatível com S3. Funciona com Cloudflare R2
               e Backblaze B2 sem mudar código, só variáveis de ambiente.

A abstração existe porque a escolha do fornecedor é reversível e barata (menos
de US$ 1/mês para 27 GB nos três), mas trocar depois com o código acoplado não
seria.

── Streaming, sempre ─────────────────────────────────────────────────────────
Nenhuma função aqui carrega o arquivo inteiro na memória. A máquina do Fly tem
256 MB–2 GB; um vídeo de 80 MB lido inteiro, mais o buffer do upload, derruba
o processo. Tudo passa por arquivo temporário e é lido em blocos.
"""
from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterator

from .config import Settings
from .urlguard import BlockedUrl, UrlPolicy, content_type_allowed, validate_redirect, validate_url

CHUNK = 1024 * 256  # 256 KB


class StorageError(RuntimeError):
    """Falha de storage que vale retentar."""


class MediaTooLarge(RuntimeError):
    """Mídia acima do teto. NÃO vale retentar — vai falhar igual."""


class InvalidMedia(RuntimeError):
    """O que veio não é mídia utilizável. NÃO vale retentar."""


class ExpiredMediaUrl(RuntimeError):
    """
    O CDN respondeu 401/403. Nas URLs da biblioteca da Meta isso quase sempre
    significa token de assinatura vencido, não que o arquivo sumiu.

    É uma categoria própria de propósito: tratar como falha permanente
    produziria uma enxurrada de erro falso numa importação de milhares de
    anúncios, porque o job pode esperar horas na fila antes de rodar e a
    assinatura vence antes disso. E tratar como retentável comum faria o worker
    bater cinco vezes na mesma URL morta.

    O caminho certo é terceiro: bloquear o job, marcar a mídia como precisando
    de URL nova, e desbloquear quando a reimportação trouxer o endereço
    atualizado.
    """


@dataclass
class DownloadResult:
    path: Path
    sha256: str
    size_bytes: int
    content_type: str
    ext: str


# ── Download ────────────────────────────────────────────────────────────────

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """
    Desliga o redirecionamento automático do urllib.

    Precisamos revalidar CADA salto: um destino público pode responder 302
    apontando para 127.0.0.1 ou para o metadata da nuvem, e validar só a URL
    inicial deixaria esse caminho aberto.
    """

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001, D102
        return None


_opener = urllib.request.build_opener(_NoRedirect)


def stream_download(
    url: str,
    dest: Path,
    settings: Settings,
    *,
    on_progress: Callable[[int, int | None, float], None] | None = None,
    policy: "UrlPolicy | None" = None,
) -> DownloadResult:
    """
    Baixa para arquivo temporário calculando o SHA-256 no mesmo passe.

    Calcular o hash durante o download, e não depois, evita reler o arquivo
    inteiro do disco — em 3.000 vídeos isso é hora de I/O à toa.

    A URL passa pelo urlguard antes de qualquer conexão, e de novo a cada
    redirecionamento. Ver worker/urlguard.py para o porquê.
    """
    policy = policy or UrlPolicy()
    current = validate_url(url, policy)

    max_bytes = settings.max_media_mb * 1024 * 1024
    digest = hashlib.sha256()
    total = 0
    started = time.monotonic()

    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        response = None
        for hop in range(policy.max_redirects + 1):
            request = urllib.request.Request(current, headers={
                # O CDN da Meta recusa User-Agent vazio.
                "User-Agent": "Mozilla/5.0 (compatible; AdBrief-CI/1.0)",
                "Accept": "*/*",
            })
            try:
                response = _opener.open(request, timeout=settings.download_timeout_s)  # noqa: S310
                break
            except urllib.error.HTTPError as exc:
                if exc.code in (301, 302, 303, 307, 308):
                    location = exc.headers.get("Location")
                    if not location:
                        raise StorageError(f"HTTP {exc.code} sem cabeçalho Location") from exc
                    if hop >= policy.max_redirects:
                        raise StorageError(
                            f"mais de {policy.max_redirects} redirecionamentos"
                        ) from exc
                    current = validate_redirect(location, current, policy)
                    continue
                raise

        if response is None:
            raise StorageError("não foi possível abrir a URL")

        with response:
            content_type = response.headers.get_content_type() or "application/octet-stream"
            # Content-Type sozinho não é confiável — o servidor escolhe o que
            # declarar — mas recusa cedo o que obviamente não é mídia, como uma
            # página de erro HTML servida com 200.
            if not content_type_allowed(content_type):
                raise InvalidMedia(f"Content-Type '{content_type}' não é mídia")

            declared = response.headers.get("Content-Length")
            expected = int(declared) if declared and declared.isdigit() else None

            # Recusa pelo cabeçalho antes de gastar banda, quando dá.
            if expected is not None and expected > max_bytes:
                raise MediaTooLarge(
                    f"Content-Length {expected} bytes acima do teto de {settings.max_media_mb} MB"
                )

            with dest.open("wb") as fh:
                while True:
                    block = response.read(CHUNK)
                    if not block:
                        break
                    total += len(block)
                    # E de novo durante o corpo: servidores mentem no
                    # Content-Length, e alguns nem mandam.
                    if total > max_bytes:
                        raise MediaTooLarge(
                            f"Corpo passou de {settings.max_media_mb} MB durante o download"
                        )
                    digest.update(block)
                    fh.write(block)
                    if on_progress:
                        elapsed = max(time.monotonic() - started, 1e-6)
                        on_progress(total, expected, total / elapsed)
    except BlockedUrl:
        # Recusa de segurança. Nunca vira retry: a URL não vai ficar boa.
        dest.unlink(missing_ok=True)
        raise
    except urllib.error.HTTPError as exc:
        dest.unlink(missing_ok=True)
        if exc.code in (401, 403):
            raise ExpiredMediaUrl(
                f"HTTP {exc.code} — assinatura da URL provavelmente venceu") from exc
        if exc.code == 404:
            raise InvalidMedia("HTTP 404 — a mídia não existe mais na origem") from exc
        raise StorageError(f"HTTP {exc.code} ao baixar a mídia") from exc
    except urllib.error.URLError as exc:
        raise StorageError(f"Falha de rede ao baixar: {exc.reason}") from exc
    except (MediaTooLarge, InvalidMedia):
        dest.unlink(missing_ok=True)
        raise
    except Exception:
        dest.unlink(missing_ok=True)
        raise

    if total == 0:
        dest.unlink(missing_ok=True)
        raise InvalidMedia("A URL respondeu com corpo vazio")

    ext = _extension_for(url, content_type)
    return DownloadResult(
        path=dest, sha256=digest.hexdigest(), size_bytes=total,
        content_type=content_type, ext=ext,
    )


def _extension_for(url: str, content_type: str) -> str:
    """
    Extensão a partir do content-type, com a URL como desempate.
    O CDN da Meta serve .mp4 com querystring gigante, então a extensão da URL
    sozinha é pouco confiável — mas o content-type às vezes vem genérico.
    """
    by_type = {
        "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm",
        "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
    }
    if content_type in by_type:
        return by_type[content_type]
    guessed = mimetypes.guess_extension(content_type or "") or ""
    if guessed in {".mp4", ".mov", ".webm", ".jpg", ".jpeg", ".png", ".webp"}:
        return ".jpg" if guessed == ".jpeg" else guessed
    path_ext = Path(urllib.parse.urlparse(url).path).suffix.lower()
    if path_ext in {".mp4", ".mov", ".webm", ".jpg", ".jpeg", ".png", ".webp"}:
        return ".jpg" if path_ext == ".jpeg" else path_ext
    return ".bin"


def media_kind(content_type: str, ext: str) -> str:
    if content_type.startswith("video/") or ext in {".mp4", ".mov", ".webm"}:
        return "video"
    if content_type.startswith("image/") or ext in {".jpg", ".png", ".webp"}:
        return "image"
    return "unknown"


# ── Chaves do bucket ────────────────────────────────────────────────────────

def storage_key(brand_id: str, category: str, *parts: str) -> str:
    """
    Layout único, definido na Fase 4 do briefing:

      brands/{brand_id}/originals/{sha256}.{ext}
      brands/{brand_id}/keyframes/{asset_id}/{n}.jpg
      brands/{brand_id}/faces/{asset_id}/{n}.jpg
      brands/{brand_id}/analysis/{asset_id}.json
      brands/{brand_id}/thumbnails/{asset_id}.jpg

    Original indexado por SHA-256, não por asset_id: é o que faz o mesmo vídeo
    reusado em 40 anúncios ocupar uma cópia só.
    """
    assert category in {"originals", "keyframes", "faces", "analysis", "thumbnails"}
    tail = "/".join(str(p).strip("/") for p in parts if str(p).strip("/"))
    return f"brands/{brand_id}/{category}/{tail}"


# ── Backends ────────────────────────────────────────────────────────────────

class StorageBackend:
    """Interface mínima. Os dois backends implementam exatamente isto."""

    def put_file(self, key: str, path: Path, content_type: str) -> str:
        raise NotImplementedError

    def signed_url(self, key: str, expires_in: int = 3600) -> str:
        raise NotImplementedError

    def exists(self, key: str) -> bool:
        raise NotImplementedError

    def delete(self, key: str) -> None:
        raise NotImplementedError


class SupabaseStorage(StorageBackend):
    """
    Storage do Supabase pela API REST, com a service role.

    Bucket privado: nada é servido por URL pública. Quem precisa ver pede uma
    URL assinada de curta duração. Vídeo de anúncio de terceiro não deve ficar
    em endereço adivinhável e permanente.
    """

    def __init__(self, settings: Settings) -> None:
        self.base = f"{settings.supabase_url}/storage/v1"
        self.bucket = settings.storage_bucket
        self.key = settings.service_role_key

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        h = {
            "Authorization": f"Bearer {self.key}",
            "apikey": self.key,
        }
        h.update(extra or {})
        return h

    def put_file(self, key: str, path: Path, content_type: str) -> str:
        url = f"{self.base}/object/{self.bucket}/{urllib.parse.quote(key)}"
        size = path.stat().st_size
        with path.open("rb") as fh:
            request = urllib.request.Request(
                url, data=fh, method="POST",
                headers=self._headers({
                    "Content-Type": content_type,
                    "Content-Length": str(size),
                    # Reprocessar um asset sobrescreve em vez de estourar 409.
                    "x-upsert": "true",
                }),
            )
            try:
                with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310
                    response.read()
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", "replace")[:300]
                raise StorageError(f"Upload falhou ({exc.code}): {detail}") from exc
            except urllib.error.URLError as exc:
                raise StorageError(f"Upload falhou: {exc.reason}") from exc
        return key

    def signed_url(self, key: str, expires_in: int = 3600) -> str:
        url = f"{self.base}/object/sign/{self.bucket}/{urllib.parse.quote(key)}"
        body = json.dumps({"expiresIn": expires_in}).encode()
        request = urllib.request.Request(
            url, data=body, method="POST",
            headers=self._headers({"Content-Type": "application/json"}),
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:  # noqa: S310
                payload = json.loads(response.read().decode())
        except urllib.error.HTTPError as exc:
            raise StorageError(f"Assinatura falhou ({exc.code})") from exc
        signed = payload.get("signedURL") or payload.get("signedUrl") or ""
        return f"{self.base}{signed}" if signed.startswith("/") else signed

    def exists(self, key: str) -> bool:
        url = f"{self.base}/object/info/{self.bucket}/{urllib.parse.quote(key)}"
        request = urllib.request.Request(url, headers=self._headers())
        try:
            with urllib.request.urlopen(request, timeout=30) as response:  # noqa: S310
                return response.status == 200
        except urllib.error.HTTPError as exc:
            if exc.code in (400, 404):
                return False
            raise StorageError(f"Consulta falhou ({exc.code})") from exc
        except urllib.error.URLError as exc:
            raise StorageError(f"Consulta falhou: {exc.reason}") from exc

    def delete(self, key: str) -> None:
        url = f"{self.base}/object/{self.bucket}/{urllib.parse.quote(key)}"
        request = urllib.request.Request(url, method="DELETE", headers=self._headers())
        try:
            with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310
                response.read()
        except urllib.error.HTTPError as exc:
            if exc.code not in (400, 404):
                raise StorageError(f"Remoção falhou ({exc.code})") from exc


class S3Storage(StorageBackend):
    """
    Backend S3 para Cloudflare R2 ou Backblaze B2. Usa boto3, importado só
    aqui — quem roda com o backend supabase não precisa da dependência.
    """

    def __init__(self, settings: Settings) -> None:
        try:
            import boto3  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise StorageError(
                "CI_STORAGE_BACKEND=s3 exige boto3. Instale com: pip install boto3"
            ) from exc
        self.bucket = settings.s3_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint or None,
            region_name=settings.s3_region or "auto",
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
        )

    def put_file(self, key: str, path: Path, content_type: str) -> str:
        # upload_file faz multipart e streaming sozinho.
        self.client.upload_file(
            str(path), self.bucket, key,
            ExtraArgs={"ContentType": content_type},
        )
        return key

    def signed_url(self, key: str, expires_in: int = 3600) -> str:
        return self.client.generate_presigned_url(
            "get_object", Params={"Bucket": self.bucket, "Key": key}, ExpiresIn=expires_in,
        )

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError  # type: ignore
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError as exc:
            if exc.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"):
                return False
            raise StorageError(f"Consulta falhou: {exc}") from exc

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)


class ProxyStorage(StorageBackend):
    """
    Storage pela edge function ci-worker-write, para quando a service role não
    é acessível.

    O ARQUIVO não passa pela função: ela devolve uma URL de upload assinada e o
    worker faz o PUT direto no storage. Um vídeo de 80 MB atravessando uma edge
    function estouraria o limite de corpo e o timeout — e ainda pagaria a
    transferência duas vezes.
    """

    def __init__(self, settings: Settings) -> None:
        self.base = f"{settings.supabase_url}/storage/v1"
        self.proxy = f"{settings.supabase_url}/functions/v1/ci-worker-write"
        self.secret = settings.worker_secret
        self.bucket = settings.storage_bucket

    def _call(self, payload: dict) -> dict:
        request = urllib.request.Request(
            self.proxy, data=json.dumps(payload).encode(), method="POST",
            headers={"Content-Type": "application/json", "x-ci-worker-secret": self.secret},
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310
                return json.loads(response.read().decode() or "{}")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:300]
            raise StorageError(f"ci-worker-write {payload.get('action')} → {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise StorageError(f"ci-worker-write inacessível: {exc.reason}") from exc

    def put_file(self, key: str, path: Path, content_type: str) -> str:
        signed = (self._call({"action": "sign_upload", "key": key}) or {}).get("data") or {}
        token = signed.get("token")
        if not token:
            raise StorageError("a função não devolveu token de upload")

        url = f"{self.base}/object/upload/sign/{self.bucket}/{urllib.parse.quote(key)}?token={urllib.parse.quote(token)}"
        with path.open("rb") as fh:
            request = urllib.request.Request(
                url, data=fh, method="PUT",
                headers={
                    "Content-Type": content_type,
                    "Content-Length": str(path.stat().st_size),
                    "x-upsert": "true",
                },
            )
            try:
                with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310
                    response.read()
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", "replace")[:300]
                raise StorageError(f"upload assinado falhou ({exc.code}): {detail}") from exc
            except urllib.error.URLError as exc:
                raise StorageError(f"upload assinado falhou: {exc.reason}") from exc
        return key

    def signed_url(self, key: str, expires_in: int = 3600) -> str:
        out = (self._call({"action": "sign_download", "key": key,
                           "expires_in": expires_in}) or {}).get("data") or {}
        url = out.get("signedUrl") or out.get("signedURL") or ""
        if not url:
            raise StorageError("a função não devolveu URL assinada")
        return url if url.startswith("http") else f"{self.base}{url}"

    def exists(self, key: str) -> bool:
        try:
            self.signed_url(key, 60)
            return True
        except StorageError:
            return False

    def delete(self, key: str) -> None:
        self._call({"action": "storage_remove", "key": key})


def make_storage(settings: Settings) -> StorageBackend:
    if settings.storage_backend == "s3":
        return S3Storage(settings)
    # Sem service role, o caminho é a edge function.
    if not settings.service_role_key and settings.worker_secret:
        return ProxyStorage(settings)
    return SupabaseStorage(settings)


# ── Temporários ─────────────────────────────────────────────────────────────

def tmp_usage_mb(tmp_dir: Path) -> float:
    total = 0
    for root, _dirs, files in os.walk(tmp_dir):
        for name in files:
            try:
                total += (Path(root) / name).stat().st_size
            except OSError:
                pass
    return total / (1024 * 1024)


def cleanup_orphan_tmp(tmp_root: Path, max_age_min: int) -> dict[str, int]:
    """
    Apaga temporários mais velhos que `max_age_min`.

    Nenhum job legítimo dura duas horas, então o que sobrou é de um processo
    que morreu. Rodar no boot resolve o caso mais comum: o container reiniciou
    no meio de um download de 300 MB.

    Devolve quantos e quantos bytes, para o número aparecer no log em vez de a
    limpeza acontecer em silêncio.
    """
    removed = 0
    freed = 0
    cutoff = time.time() - max_age_min * 60
    try:
        entries = list(tmp_root.iterdir())
    except OSError:
        return {"removed": 0, "bytes": 0}

    for entry in entries:
        try:
            if entry.stat().st_mtime > cutoff:
                continue
            size = 0
            if entry.is_dir():
                for root, _dirs, files in os.walk(entry):
                    for name in files:
                        try:
                            size += (Path(root) / name).stat().st_size
                        except OSError:
                            pass
                shutil.rmtree(entry, ignore_errors=True)
            else:
                size = entry.stat().st_size
                entry.unlink(missing_ok=True)
            removed += 1
            freed += size
        except OSError:
            continue
    return {"removed": removed, "bytes": freed}


def cleanup_tmp(path: Path, tmp_root: Path) -> None:
    """
    Apaga o temporário de um job. Só apaga DENTRO do diretório temporário —
    um path montado errado não pode virar rm em outro lugar do disco.
    """
    try:
        resolved = path.resolve()
        root = tmp_root.resolve()
        if not str(resolved).startswith(str(root)):
            raise ValueError(f"recusando apagar fora do temporário: {resolved}")
        if resolved.is_dir():
            shutil.rmtree(resolved, ignore_errors=True)
        else:
            resolved.unlink(missing_ok=True)
    except (OSError, ValueError):
        pass
