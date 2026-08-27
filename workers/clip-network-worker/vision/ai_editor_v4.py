#!/usr/bin/env python3
"""
AI Editor v4 vision engine.

Lightweight CPU pipeline:
- YuNet face detection (MIT model)
- simple multi-face tracking
- active-speaker proxy from lower-face motion
- scene-change detection
- motion-centroid fallback when no face is available
- hysteresis + smoothing for a human-like virtual camera

Emits JSONL progress to stdout and writes the final camera plan as JSON.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
import time
from collections import deque
from dataclasses import dataclass, field

import cv2
import numpy as np


def emit(data):
    print(json.dumps(data, ensure_ascii=False), flush=True)


def clamp(value, low, high):
    return max(low, min(high, value))


def probe_video(path):
    cmd = [
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate",
        "-of", "json", path,
    ]
    raw = subprocess.check_output(cmd, text=True)
    body = json.loads(raw or "{}")
    stream = (body.get("streams") or [{}])[0]
    width = int(stream.get("width") or 0)
    height = int(stream.get("height") or 0)
    rate = str(stream.get("r_frame_rate") or "30/1").split("/")
    fps = float(rate[0]) / max(1.0, float(rate[1] if len(rate) > 1 else 1))
    return width, height, fps


def proxy_size(width, height, max_side=640):
    if width <= 0 or height <= 0:
        return 640, 360
    if width >= height:
        out_w = max_side
        out_h = int(round(max_side * height / width))
    else:
        out_h = max_side
        out_w = int(round(max_side * width / height))
    out_w = max(64, out_w - (out_w % 2))
    out_h = max(64, out_h - (out_h % 2))
    return out_w, out_h


@dataclass
class Track:
    track_id: int
    center: tuple[float, float]
    box: tuple[float, float, float, float]
    score: float = 0.0
    mouth_motion: float = 0.0
    prev_mouth: np.ndarray | None = None
    missed: int = 0
    history: deque = field(default_factory=lambda: deque(maxlen=8))


def box_center(box):
    x, y, w, h = box
    return x + w * 0.5, y + h * 0.5


def distance(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def crop_mouth(gray, box):
    h_img, w_img = gray.shape[:2]
    x, y, w, h = box
    x1 = int(clamp(x + w * 0.12, 0, w_img - 1))
    x2 = int(clamp(x + w * 0.88, x1 + 1, w_img))
    y1 = int(clamp(y + h * 0.56, 0, h_img - 1))
    y2 = int(clamp(y + h * 0.94, y1 + 1, h_img))
    patch = gray[y1:y2, x1:x2]
    if patch.size == 0:
        return None
    return cv2.resize(patch, (64, 32), interpolation=cv2.INTER_AREA)


def mouth_motion(prev_patch, patch):
    if prev_patch is None or patch is None:
        return 0.0
    diff = cv2.absdiff(prev_patch, patch)
    return float(np.mean(diff)) / 255.0


def histogram_signature(frame):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, [24, 16], [0, 180, 0, 256])
    cv2.normalize(hist, hist)
    return hist


def motion_focus(prev_gray, gray):
    if prev_gray is None:
        return None, 0.0
    diff = cv2.absdiff(prev_gray, gray)
    diff = cv2.GaussianBlur(diff, (7, 7), 0)
    _, mask = cv2.threshold(diff, 18, 255, cv2.THRESH_BINARY)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    moments = cv2.moments(mask)
    area = float(moments["m00"])
    if area < gray.shape[0] * gray.shape[1] * 0.01 * 255:
        return None, 0.0
    cx = moments["m10"] / max(1.0, moments["m00"])
    cy = moments["m01"] / max(1.0, moments["m00"])
    confidence = clamp(area / (gray.shape[0] * gray.shape[1] * 255 * 0.20), 0.0, 1.0)
    return (cx / gray.shape[1], cy / gray.shape[0]), confidence


def compress_camera(points):
    if not points:
        return []

    # Preserve the initial camera coordinate. We only emit a new point when the
    # framing materially changes or at least one second passed. This keeps the
    # FFmpeg expression small without losing t=0.
    out = [points[0]]
    last_emitted = points[0]

    for point in points[1:]:
        same_mode = point["mode"] == last_emitted["mode"]
        close = (
            abs(point["focus_x"] - last_emitted["focus_x"]) < 0.015
            and abs(point["focus_y"] - last_emitted["focus_y"]) < 0.02
        )
        elapsed = point["time"] - last_emitted["time"]

        if same_mode and close and elapsed < 1.0:
            continue

        out.append(point)
        last_emitted = point

    if out[-1]["time"] < points[-1]["time"] - 0.20:
        out.append(points[-1])

    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--start", type=float, required=True)
    parser.add_argument("--duration", type=float, required=True)
    parser.add_argument("--sample-fps", type=float, default=3.0)
    args = parser.parse_args()

    width, height, source_fps = probe_video(args.input)
    proxy_w, proxy_h = proxy_size(width, height)
    sample_fps = clamp(args.sample_fps, 1.5, 6.0)
    total_frames = max(1, int(math.ceil(args.duration * sample_fps)))

    detector = cv2.FaceDetectorYN.create(
        args.model,
        "",
        (320, 320),
        0.56,
        0.30,
        5000,
    )

    vf = f"fps={sample_fps},scale={proxy_w}:{proxy_h}:flags=fast_bilinear"
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-ss", f"{args.start:.3f}",
        "-i", args.input,
        "-t", f"{args.duration:.3f}",
        "-vf", vf,
        "-an",
        "-pix_fmt", "bgr24",
        "-f", "rawvideo",
        "pipe:1",
    ]

    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    frame_bytes = proxy_w * proxy_h * 3

    tracks: dict[int, Track] = {}
    next_track_id = 1
    active_track_id = None
    challenger_id = None
    challenger_streak = 0
    smoothed_focus = np.array([0.5, 0.43], dtype=np.float64)
    prev_gray = None
    prev_hist = None
    camera = []
    scene_count = 0
    face_frames = 0
    group_frames = 0
    speaker_switches = 0
    started = time.time()

    try:
        frame_index = 0
        while frame_index < total_frames:
            raw = process.stdout.read(frame_bytes)
            if not raw or len(raw) < frame_bytes:
                break

            frame = np.frombuffer(raw, np.uint8).reshape((proxy_h, proxy_w, 3))
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            now_t = frame_index / sample_fps

            # Scene change: color histogram correlation.
            hist = histogram_signature(frame)
            scene_change = False
            if prev_hist is not None:
                corr = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_CORREL)
                scene_change = corr < 0.58
                if scene_change:
                    scene_count += 1
            prev_hist = hist

            # YuNet accepts arbitrary input sizes. Detect directly on the proxy
            # frame so 16:9 faces are not distorted into a square before inference.
            detector.setInputSize((proxy_w, proxy_h))
            _, faces = detector.detect(frame)

            detections = []
            if faces is not None:
                for face in faces:
                    x, y, w, h = [float(v) for v in face[:4]]
                    score = float(face[14]) if len(face) > 14 else 0.5
                    box = (
                        clamp(x, 0, proxy_w - 1),
                        clamp(y, 0, proxy_h - 1),
                        clamp(w, 2, proxy_w),
                        clamp(h, 2, proxy_h),
                    )
                    if box[2] * box[3] < proxy_w * proxy_h * 0.0012:
                        continue
                    detections.append((box, score))

            # Associate detections to prior tracks using nearest normalized center.
            assigned_tracks = set()
            assigned_dets = set()
            pairs = []
            for det_i, (box, det_score) in enumerate(detections):
                center = box_center(box)
                for track_id, track in tracks.items():
                    d = distance(center, track.center) / max(proxy_w, proxy_h)
                    pairs.append((d, det_i, track_id))
            pairs.sort()

            for d, det_i, track_id in pairs:
                if d > 0.17 or det_i in assigned_dets or track_id in assigned_tracks:
                    continue
                box, det_score = detections[det_i]
                track = tracks[track_id]
                patch = crop_mouth(gray, box)
                motion = mouth_motion(track.prev_mouth, patch)
                track.prev_mouth = patch
                track.center = box_center(box)
                track.box = box
                track.missed = 0
                track.mouth_motion = 0.60 * track.mouth_motion + 0.40 * motion
                track.score = 0.68 * track.score + 0.32 * (track.mouth_motion * 4.0 + det_score * 0.06)
                track.history.append(track.score)
                assigned_dets.add(det_i)
                assigned_tracks.add(track_id)

            newly_created_ids = set()
            for det_i, (box, det_score) in enumerate(detections):
                if det_i in assigned_dets:
                    continue
                patch = crop_mouth(gray, box)
                track = Track(
                    track_id=next_track_id,
                    center=box_center(box),
                    box=box,
                    score=det_score * 0.03,
                    prev_mouth=patch,
                )
                tracks[next_track_id] = track
                newly_created_ids.add(next_track_id)
                next_track_id += 1

            for track_id in list(tracks.keys()):
                if track_id not in assigned_tracks and track_id not in newly_created_ids:
                    tracks[track_id].missed += 1

                if tracks[track_id].missed > int(sample_fps * 2.0):
                    del tracks[track_id]
                    if active_track_id == track_id:
                        active_track_id = None

            visible = [t for t in tracks.values() if t.missed == 0]
            if visible:
                face_frames += 1

            # Choose active speaker with hysteresis. This avoids frantic camera switching.
            ranked = sorted(visible, key=lambda t: t.score, reverse=True)
            if ranked:
                best = ranked[0]
                current = tracks.get(active_track_id) if active_track_id in tracks else None
                if current is None or current.missed:
                    if active_track_id is not None and active_track_id != best.track_id:
                        speaker_switches += 1
                    active_track_id = best.track_id
                    challenger_id = None
                    challenger_streak = 0
                elif best.track_id != active_track_id:
                    threshold = max(current.score * 1.25, current.score + 0.025)
                    if best.score > threshold:
                        if challenger_id == best.track_id:
                            challenger_streak += 1
                        else:
                            challenger_id = best.track_id
                            challenger_streak = 1
                        if challenger_streak >= max(2, int(round(sample_fps * 0.55))):
                            active_track_id = best.track_id
                            speaker_switches += 1
                            challenger_id = None
                            challenger_streak = 0
                    else:
                        challenger_id = None
                        challenger_streak = 0

            mode = "center"
            confidence = 0.20
            target = np.array([0.5, 0.43], dtype=np.float64)

            active = tracks.get(active_track_id) if active_track_id in tracks else None

            # Group framing when two visible faces genuinely fit together.
            if len(visible) >= 2:
                top2 = sorted(visible, key=lambda t: t.score, reverse=True)[:2]
                c1 = np.array(top2[0].center) / np.array([proxy_w, proxy_h])
                c2 = np.array(top2[1].center) / np.array([proxy_w, proxy_h])
                span_x = abs(c1[0] - c2[0])
                similar_activity = max(top2[0].score, top2[1].score) <= max(0.03, min(top2[0].score, top2[1].score) * 1.55)
                if span_x < 0.30 and similar_activity:
                    target = (c1 + c2) * 0.5
                    target[1] = clamp(target[1] - 0.04, 0.24, 0.68)
                    mode = "group"
                    confidence = 0.78
                    group_frames += 1
                elif active is not None:
                    target = np.array(active.center) / np.array([proxy_w, proxy_h])
                    target[1] = clamp(target[1] - 0.06, 0.22, 0.68)
                    mode = "speaker"
                    confidence = clamp(0.55 + active.score * 2.0, 0.55, 0.96)
            elif active is not None:
                target = np.array(active.center) / np.array([proxy_w, proxy_h])
                target[1] = clamp(target[1] - 0.06, 0.22, 0.68)
                mode = "speaker"
                confidence = clamp(0.55 + active.score * 2.0, 0.55, 0.96)
            else:
                motion, motion_confidence = motion_focus(prev_gray, gray)
                if motion is not None:
                    target = np.array(motion)
                    mode = "motion"
                    confidence = 0.35 + motion_confidence * 0.45

            # Scene changes may legitimately require a faster camera reset.
            alpha = 0.58 if scene_change else (0.34 if mode == "speaker" else 0.20)
            if camera and camera[-1]["mode"] != mode and mode in ("speaker", "group"):
                alpha = max(alpha, 0.44)
            smoothed_focus = smoothed_focus * (1.0 - alpha) + target * alpha
            smoothed_focus[0] = clamp(smoothed_focus[0], 0.08, 0.92)
            smoothed_focus[1] = clamp(smoothed_focus[1], 0.14, 0.86)

            camera.append({
                "time": round(now_t, 3),
                "focus_x": round(float(smoothed_focus[0]), 4),
                "focus_y": round(float(smoothed_focus[1]), 4),
                "mode": mode,
                "speaker_id": int(active_track_id) if active_track_id else None,
                "confidence": round(float(confidence), 4),
                "scene_change": bool(scene_change),
            })

            prev_gray = gray
            frame_index += 1

            if frame_index == 1 or frame_index == total_frames or frame_index % max(1, int(sample_fps)) == 0:
                elapsed = max(0.001, time.time() - started)
                fps_processed = frame_index / elapsed
                remaining = max(0, total_frames - frame_index)
                emit({
                    "type": "progress",
                    "phase": "vision",
                    "current": frame_index,
                    "total": total_frames,
                    "phase_pct": round(frame_index / total_frames * 100, 2),
                    "fps_processed": round(fps_processed, 2),
                    "eta_seconds": round(remaining / max(0.01, fps_processed), 1),
                })

        if process.stdout:
            process.stdout.close()
        stderr = process.stderr.read().decode("utf-8", "ignore") if process.stderr else ""
        code = process.wait(timeout=30)
        if code != 0:
            raise RuntimeError(f"ffmpeg vision proxy failed ({code}): {stderr[-800:]}")

    finally:
        if process.poll() is None:
            process.kill()

    compressed = compress_camera(camera)
    result = {
        "version": 4,
        "editor": "ai_editor_v4_open_source",
        "vision_backend": "yunet_mouth_motion_v1",
        "sample_fps": sample_fps,
        "source_width": width,
        "source_height": height,
        "source_fps": source_fps,
        "duration_seconds": args.duration,
        "camera": compressed,
        "stats": {
            "sampled_frames": len(camera),
            "camera_keyframes": len(compressed),
            "face_frame_ratio": round(face_frames / max(1, len(camera)), 4),
            "group_frame_ratio": round(group_frames / max(1, len(camera)), 4),
            "scene_changes": scene_count,
            "speaker_switches": speaker_switches,
        },
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False)

    emit({
        "type": "result",
        "camera_keyframes": len(compressed),
        "face_frame_ratio": result["stats"]["face_frame_ratio"],
        "speaker_switches": speaker_switches,
    })


if __name__ == "__main__":
    main()
