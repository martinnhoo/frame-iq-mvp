"""
Camada de mídia: ffprobe, detecção de cena, keyframes e extração de áudio.

Tudo aqui é subprocesso do ffmpeg. Nenhuma função carrega vídeo em memória —
o ffmpeg lê do disco e escreve no disco, e nós só lemos os arquivos pequenos
que saem (JPEGs de keyframe, WAV de áudio).

── Sobre o espaço em disco ──────────────────────────────────────────────────
Um vídeo de 500 MB não gera 500 MB de temporários: gera bem mais. O WAV
descomprimido de 60s a 16 kHz mono são ~2 MB, mas os keyframes em JPEG de um
vídeo longo somam rápido. Por isso `CI_MAX_KEYFRAMES` tem teto e a limpeza do
diretório do job acontece no finally do analyze.
"""
from __future__ import annotations

import json
import math
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .config import Settings


class MediaError(RuntimeError):
    """Falha de processamento de mídia."""


def _run(cmd: list[str], *, timeout: int = 600) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False)
    except FileNotFoundError as exc:
        raise MediaError(f"binário não encontrado: {cmd[0]}. ffmpeg está instalado?") from exc
    except subprocess.TimeoutExpired as exc:
        raise MediaError(f"{cmd[0]} estourou {timeout}s") from exc


def have(binary: str) -> bool:
    return shutil.which(binary) is not None


# ── Metadata ────────────────────────────────────────────────────────────────

@dataclass
class Probe:
    duration_s: float | None = None
    width: int | None = None
    height: int | None = None
    fps: float | None = None
    video_codec: str | None = None
    audio_codec: str | None = None
    has_audio: bool = False
    bitrate: int | None = None
    aspect_ratio: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


def _aspect(width: int | None, height: int | None) -> str | None:
    if not width or not height:
        return None
    ratio = width / height
    # Os formatos que a Meta realmente serve. Casar com o mais próximo evita
    # rótulos como "0.5625:1" que não dizem nada a ninguém.
    known = {"9:16": 9 / 16, "4:5": 4 / 5, "1:1": 1.0, "16:9": 16 / 9, "1.91:1": 1.91}
    label, _ = min(known.items(), key=lambda kv: abs(kv[1] - ratio))
    return label if abs(known[label] - ratio) < 0.06 else f"{width}x{height}"


def probe(path: Path, settings: Settings) -> Probe:
    result = _run([
        settings.ffprobe, "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", str(path),
    ], timeout=120)
    if result.returncode != 0:
        raise MediaError(f"ffprobe falhou: {result.stderr.strip()[:300]}")

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise MediaError("ffprobe devolveu JSON inválido") from exc

    video = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), None)
    audio = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), None)
    fmt = data.get("format", {})

    duration = None
    for candidate in (fmt.get("duration"), (video or {}).get("duration")):
        try:
            duration = float(candidate)
            break
        except (TypeError, ValueError):
            continue

    fps = None
    rate = (video or {}).get("avg_frame_rate") or (video or {}).get("r_frame_rate")
    if rate and "/" in str(rate):
        num, den = str(rate).split("/", 1)
        try:
            fps = float(num) / float(den) if float(den) else None
        except (ValueError, ZeroDivisionError):
            fps = None

    width = (video or {}).get("width")
    height = (video or {}).get("height")

    try:
        bitrate = int(fmt.get("bit_rate")) if fmt.get("bit_rate") else None
    except (TypeError, ValueError):
        bitrate = None

    return Probe(
        duration_s=duration, width=width, height=height, fps=fps,
        video_codec=(video or {}).get("codec_name"),
        audio_codec=(audio or {}).get("codec_name"),
        has_audio=audio is not None,
        bitrate=bitrate,
        aspect_ratio=_aspect(width, height),
        raw=data,
    )


# ── Cenas ───────────────────────────────────────────────────────────────────

def detect_scene_cuts(path: Path, settings: Settings, duration: float | None) -> list[float]:
    """
    Detecta cortes com o filtro `select=gt(scene,threshold)` do ffmpeg.

    Devolve os instantes dos cortes, em segundos. Não é detecção semântica de
    cena — é diferença entre quadros consecutivos. Serve bem para anúncio, que
    corta duro; falharia em documentário com transição suave, o que não é o
    nosso caso.

    ── Limitação medida ─────────────────────────────────────────────────────
    A métrica do ffmpeg é uma soma de diferenças absolutas normalizada pela
    atividade espacial do quadro. Quadros de cor CHAPADA têm atividade zero e a
    métrica degenera: num teste, o corte de um trecho vermelho sólido para um
    verde sólido pontuou exatamente 0.000000, apesar da diferença de luma ser
    de 76 para 150.

    Na prática isso significa que um corte para uma cartela de cor sólida da
    marca — que anúncio usa — pode passar despercebido. Conteúdo com textura,
    que é a esmagadora maioria dos quadros, é detectado sem problema.

    Mitigar exigiria uma segunda métrica (diferença de histograma, por
    exemplo). Fica registrado como limitação conhecida em vez de virar bug
    silencioso: cena não detectada vira uma cena mais longa, não vira erro.
    """
    result = _run([
        settings.ffmpeg, "-hide_banner", "-nostats", "-i", str(path),
        "-filter:v", f"select='gt(scene,{settings.scene_threshold})',showinfo",
        "-f", "null", "-",
    ], timeout=600)

    cuts: list[float] = []
    for match in re.finditer(r"pts_time:([0-9.]+)", result.stderr):
        try:
            cuts.append(round(float(match.group(1)), 3))
        except ValueError:
            continue

    cuts = sorted(set(cuts))
    # Cortes colados (< 0.4s) são quase sempre flash ou ruído de compressão,
    # não cena nova. Sem esse filtro um anúncio com corte rápido vira 80 cenas
    # de 0.1s e a timeline fica ilegível.
    filtered: list[float] = []
    for cut in cuts:
        if not filtered or cut - filtered[-1] >= 0.4:
            filtered.append(cut)

    if duration:
        filtered = [c for c in filtered if 0.2 < c < duration - 0.2]
    return filtered


def build_scenes(cuts: list[float], duration: float | None) -> list[dict[str, float | int]]:
    """Transforma instantes de corte em intervalos [início, fim)."""
    if not duration or duration <= 0:
        return []
    bounds = [0.0, *cuts, float(duration)]
    scenes = []
    for index, (start, end) in enumerate(zip(bounds, bounds[1:])):
        if end - start < 0.25:
            continue
        scenes.append({"scene_index": index, "start_seconds": round(start, 3),
                       "end_seconds": round(end, 3)})
    # Vídeo sem corte nenhum ainda é uma cena — a de corpo inteiro.
    if not scenes:
        scenes = [{"scene_index": 0, "start_seconds": 0.0, "end_seconds": round(duration, 3)}]
    return scenes


# ── Keyframes ───────────────────────────────────────────────────────────────

def extract_frame(path: Path, timestamp: float, dest: Path, settings: Settings,
                  width: int = 720) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    result = _run([
        settings.ffmpeg, "-hide_banner", "-loglevel", "error",
        # -ss antes de -i faz seek por keyframe do container: ordens de
        # magnitude mais rápido que decodificar desde o início.
        "-ss", f"{max(timestamp, 0):.3f}", "-i", str(path),
        "-frames:v", "1", "-vf", f"scale={width}:-2", "-q:v", "3", "-y", str(dest),
    ], timeout=120)
    if result.returncode != 0 or not dest.exists():
        raise MediaError(f"não foi possível extrair frame em {timestamp:.2f}s: "
                         f"{result.stderr.strip()[:200]}")
    return dest


def pick_keyframe_times(scenes: list[dict], duration: float | None, max_frames: int) -> list[tuple[float, str]]:
    """
    Escolhe QUAIS frames guardar, com o motivo de cada um.

    Guardar todos os frames é inviável: 3.000 vídeos × 900 frames seria
    terabyte de lixo. A regra é um frame no início de cada cena (é onde a
    informação nova aparece), mais o meio das cenas longas, mais o primeiro
    frame — que é a capa do anúncio e importa desproporcionalmente.
    """
    picks: list[tuple[float, str]] = [(0.2, "first_frame")]

    for scene in scenes:
        start = float(scene["start_seconds"])
        end = float(scene["end_seconds"])
        if start > 0.3:
            picks.append((start + 0.15, "scene_start"))
        if end - start > 4.0:
            picks.append(((start + end) / 2, "scene_mid"))

    if duration and duration > 2:
        picks.append((max(duration - 0.4, 0.2), "last_frame"))

    # Ordena, tira quase-duplicatas e corta no teto.
    picks.sort(key=lambda p: p[0])
    unique: list[tuple[float, str]] = []
    for timestamp, reason in picks:
        if duration and timestamp >= duration:
            continue
        if not unique or timestamp - unique[-1][0] >= 0.35:
            unique.append((round(timestamp, 3), reason))

    if len(unique) <= max_frames:
        return unique
    # Acima do teto, amostra uniformemente em vez de cortar o fim — cortar o
    # fim perderia o CTA, que é justamente o que interessa.
    step = len(unique) / max_frames
    return [unique[min(int(i * step), len(unique) - 1)] for i in range(max_frames)]


# ── Áudio ───────────────────────────────────────────────────────────────────

def extract_audio(path: Path, dest: Path, settings: Settings) -> Path | None:
    """
    Extrai WAV 16 kHz mono — o formato que o Whisper quer. Devolve None quando
    o vídeo não tem trilha de áudio, o que é comum em anúncio de imagem
    animada e não é erro.
    """
    dest.parent.mkdir(parents=True, exist_ok=True)
    result = _run([
        settings.ffmpeg, "-hide_banner", "-loglevel", "error",
        "-i", str(path), "-vn", "-ac", "1", "-ar", "16000",
        "-c:a", "pcm_s16le", "-y", str(dest),
    ], timeout=600)
    if result.returncode != 0 or not dest.exists() or dest.stat().st_size == 0:
        return None
    return dest


# ── Métricas derivadas ──────────────────────────────────────────────────────

def cuts_per_second(cut_count: int, duration: float | None) -> float | None:
    if not duration or duration <= 0:
        return None
    return round(cut_count / duration, 4)


def text_per_second(total_chars: int, duration: float | None) -> float | None:
    if not duration or duration <= 0:
        return None
    return round(total_chars / duration, 4)
