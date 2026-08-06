#!/usr/bin/env python3
"""
Teste da camada de mídia contra ffmpeg de verdade.

    python ci-worker/tests/test_media.py

Gera vídeos sintéticos com características conhecidas (duração, resolução,
número de cortes) e verifica se ffprobe e a detecção de cena devolvem o que
deveriam. Nada aqui é dublê — se ffmpeg não estiver instalado, o teste diz
isso e sai, em vez de fingir que passou.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from dataclasses import replace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from worker.config import load_settings  # noqa: E402
from worker.media import (  # noqa: E402
    MediaError,
    build_scenes,
    cuts_per_second,
    detect_scene_cuts,
    extract_audio,
    extract_frame,
    have,
    pick_keyframe_times,
    probe,
    text_per_second,
)

FAILURES: list[str] = []
PASSED = 0


def check(name: str, cond: bool, extra: str = "") -> None:
    global PASSED
    print(("PASS  " if cond else "FAIL  ") + name + (f"  [{extra}]" if extra else ""))
    if cond:
        PASSED += 1
    else:
        FAILURES.append(name)


def ffmpeg_ok(cmd: list[str]) -> bool:
    r = subprocess.run(cmd, capture_output=True, timeout=180)
    return r.returncode == 0


def main() -> int:
    if not have("ffmpeg") or not have("ffprobe"):
        print("ffmpeg/ffprobe não encontrados no PATH — este teste exige os dois.")
        print("Windows: winget install Gyan.FFmpeg   ·   Debian: apt install ffmpeg")
        return 1

    work = Path(tempfile.mkdtemp(prefix="ci-media-test-"))
    settings = replace(load_settings(), tmp_dir=work, max_keyframes=80)

    try:
        # ── Vídeo com 3 trechos visualmente distintos = 2 cortes ─────────────
        #
        # Os trechos precisam ter TEXTURA, não cor chapada. A métrica de cena do
        # ffmpeg é uma soma de diferenças absolutas normalizada pela atividade
        # espacial do quadro; quadros de cor lisa têm atividade zero e a métrica
        # degenera — medido: um corte vermelho→verde pontua exatamente
        # 0.000000, apesar da diferença de luma ser enorme.
        #
        # Isso não é limitação do nosso código, mas É uma limitação real do
        # método: um anúncio que corta para uma cartela de cor sólida da marca
        # pode ter esse corte ignorado. Está anotado em media.py.
        cortado = work / "cortado.mp4"
        ok = ffmpeg_ok([
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "testsrc=size=640x360:duration=2:rate=25",
            "-f", "lavfi", "-i", "smptebars=size=640x360:duration=2:rate=25",
            "-f", "lavfi", "-i", "rgbtestsrc=size=640x360:duration=2:rate=25",
            "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]",
            "-map", "[v]", "-c:v", "libx264", "-preset", "ultrafast",
            "-pix_fmt", "yuv420p", str(cortado),
        ])
        if not ok:
            print("não foi possível gerar o vídeo de teste com ffmpeg")
            return 1

        p = probe(cortado, settings)
        check("ffprobe lê a duração", p.duration_s is not None and 5.5 < p.duration_s < 6.5,
              f"{p.duration_s}s")
        check("ffprobe lê a resolução", (p.width, p.height) == (640, 360), f"{p.width}x{p.height}")
        check("ffprobe lê o fps", p.fps is not None and 24 < p.fps < 26, str(p.fps))
        check("ffprobe lê o codec", p.video_codec == "h264", str(p.video_codec))
        check("vídeo sem trilha é marcado como sem áudio", p.has_audio is False)

        cuts = detect_scene_cuts(cortado, settings, p.duration_s)
        check("detecta os 2 cortes do vídeo de 3 trechos", len(cuts) == 2,
              f"{len(cuts)} cortes em {[round(c,2) for c in cuts]}")
        check("os cortes caem perto de 2s e 4s",
              len(cuts) == 2 and abs(cuts[0] - 2) < 0.3 and abs(cuts[1] - 4) < 0.3,
              str([round(c, 2) for c in cuts]))

        scenes = build_scenes(cuts, p.duration_s)
        check("2 cortes viram 3 cenas", len(scenes) == 3, f"{len(scenes)} cenas")
        check("as cenas cobrem o vídeo inteiro sem buraco",
              scenes[0]["start_seconds"] == 0.0
              and abs(float(scenes[-1]["end_seconds"]) - float(p.duration_s)) < 0.1
              and all(scenes[i]["end_seconds"] == scenes[i + 1]["start_seconds"]
                      for i in range(len(scenes) - 1)))

        # ── Vídeo sem corte ──────────────────────────────────────────────────
        estatico = work / "estatico.mp4"
        ffmpeg_ok([
            "ffmpeg", "-y", "-f", "lavfi",
            "-i", "color=c=gray:size=320x240:duration=3:rate=25",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(estatico),
        ])
        p2 = probe(estatico, settings)
        cuts2 = detect_scene_cuts(estatico, settings, p2.duration_s)
        scenes2 = build_scenes(cuts2, p2.duration_s)
        check("vídeo sem corte não inventa cena", len(cuts2) == 0, f"{len(cuts2)} cortes")
        check("vídeo sem corte ainda vira 1 cena de corpo inteiro", len(scenes2) == 1)

        # ── Áudio ────────────────────────────────────────────────────────────
        com_audio = work / "com-audio.mp4"
        ffmpeg_ok([
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "testsrc=size=320x240:rate=25:duration=3",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-shortest", str(com_audio),
        ])
        p3 = probe(com_audio, settings)
        check("ffprobe detecta a trilha de áudio", p3.has_audio is True, str(p3.audio_codec))

        wav = extract_audio(com_audio, work / "audio.wav", settings)
        check("extrai WAV do vídeo com áudio", wav is not None and wav.exists())
        if wav:
            # 3s a 16 kHz mono 16 bits ≈ 96 KB. Muito menor significaria que
            # saiu um arquivo vazio ou truncado.
            check("o WAV tem tamanho compatível com 3s a 16kHz mono",
                  80_000 < wav.stat().st_size < 130_000, f"{wav.stat().st_size}B")

        semaudio = extract_audio(estatico, work / "vazio.wav", settings)
        check("vídeo sem trilha devolve None em vez de erro", semaudio is None)

        # ── Keyframes ────────────────────────────────────────────────────────
        frame = extract_frame(cortado, 3.0, work / "kf.jpg", settings)
        check("extrai um frame como JPEG", frame.exists() and frame.stat().st_size > 1000,
              f"{frame.stat().st_size}B")

        try:
            extract_frame(cortado, 999.0, work / "fora.jpg", settings)
            fora_ok = False
        except MediaError:
            fora_ok = True
        check("frame além do fim do vídeo falha explicitamente", fora_ok)

        picks = pick_keyframe_times(scenes, p.duration_s, settings.max_keyframes)
        check("escolhe um keyframe por cena mais capa e fim", 3 <= len(picks) <= 6,
              f"{len(picks)} frames: {[r for _, r in picks]}")
        check("o primeiro keyframe é a capa do anúncio", picks[0][1] == "first_frame")
        check("nenhum keyframe cai depois do fim do vídeo",
              all(t < float(p.duration_s) for t, _ in picks))
        check("keyframes não se repetem no mesmo instante",
              all(picks[i + 1][0] - picks[i][0] >= 0.35 for i in range(len(picks) - 1)))

        # Teto respeitado, e amostrando em vez de cortar o fim — cortar o fim
        # perderia o CTA, que é o que mais interessa.
        muitas = [{"scene_index": i, "start_seconds": i * 1.0, "end_seconds": i * 1.0 + 1.0}
                  for i in range(200)]
        limitado = pick_keyframe_times(muitas, 200.0, 20)
        check("teto de keyframes é respeitado", len(limitado) == 20, f"{len(limitado)}")
        check("com teto, ainda cobre até perto do fim do vídeo",
              limitado[-1][0] > 150, f"último em {limitado[-1][0]}s")

        # ── Derivadas ────────────────────────────────────────────────────────
        check("densidade de cortes", cuts_per_second(2, 6.0) == 0.3333, str(cuts_per_second(2, 6.0)))
        check("densidade de texto", text_per_second(120, 6.0) == 20.0)
        check("duração zero não divide por zero", cuts_per_second(5, 0) is None
              and text_per_second(5, None) is None)

    finally:
        shutil.rmtree(work, ignore_errors=True)

    print()
    if FAILURES:
        print(f"FALHAS ({len(FAILURES)}/{PASSED + len(FAILURES)}): {FAILURES}")
        return 1
    print(f"TODOS OS {PASSED} TESTES PASSARAM")
    return 0


if __name__ == "__main__":
    sys.exit(main())
