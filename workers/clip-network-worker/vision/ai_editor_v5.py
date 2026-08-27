#!/usr/bin/env python3
"""
AI Editor v4.2 vision engine.

CPU-first audiovisual active-speaker pipeline:
- YuNet face detection
- stable multi-face tracking (center + IoU + size)
- audio envelope extraction from the source track
- head-motion-compensated lower-face motion
- short-window audio/lip correlation for active-speaker scoring
- scene reset, hysteresis, dead-zone and camera smoothing
- motion-centroid fallback when no face is available

The output schema stays compatible with the v4 renderer.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
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


def extract_audio_envelope(path, start, duration, sample_fps, sample_rate=16000):
    total_frames = max(1, int(math.ceil(duration * sample_fps)))
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-ss", f"{start:.3f}", "-i", path,
        "-t", f"{duration:.3f}",
        "-vn", "-ac", "1", "-ar", str(sample_rate),
        "-f", "s16le", "pipe:1",
    ]
    try:
        raw = subprocess.check_output(cmd, stderr=subprocess.STDOUT)
    except subprocess.CalledProcessError:
        return np.zeros(total_frames, dtype=np.float32)

    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if samples.size == 0:
        return np.zeros(total_frames, dtype=np.float32)

    rms = np.zeros(total_frames, dtype=np.float32)
    samples_per_frame = sample_rate / sample_fps
    for index in range(total_frames):
        start_i = int(round(index * samples_per_frame))
        end_i = int(round((index + 1) * samples_per_frame))
        chunk = samples[start_i:min(end_i, samples.size)]
        if chunk.size:
            rms[index] = float(np.sqrt(np.mean(chunk * chunk) + 1e-10))

    db = 20.0 * np.log10(np.maximum(rms, 1e-6))
    finite = db[np.isfinite(db)]
    if finite.size == 0:
        return np.zeros(total_frames, dtype=np.float32)

    low = float(np.percentile(finite, 20))
    high = float(np.percentile(finite, 85))
    if high <= low + 3.0:
        high = low + 3.0
    envelope = np.clip((db - low) / (high - low), 0.0, 1.0)
    if envelope.size >= 3:
        envelope = np.convolve(envelope, np.array([0.18, 0.64, 0.18]), mode="same")
    return envelope.astype(np.float32)


@dataclass
class Track:
    track_id: int
    center: tuple[float, float]
    box: tuple[float, float, float, float]
    det_score: float = 0.0
    score: float = 0.0
    lip_motion: float = 0.0
    face_motion: float = 0.0
    sync_score: float = 0.0
    prev_mouth: np.ndarray | None = None
    prev_face: np.ndarray | None = None
    missed: int = 0
    motion_history: deque = field(default_factory=lambda: deque(maxlen=30))
    audio_history: deque = field(default_factory=lambda: deque(maxlen=30))


def box_center(box):
    x, y, w, h = box
    return x + w * 0.5, y + h * 0.5


def box_area(box):
    return max(1.0, box[2] * box[3])


def box_iou(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    x1 = max(ax, bx)
    y1 = max(ay, by)
    x2 = min(ax + aw, bx + bw)
    y2 = min(ay + ah, by + bh)
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    union = box_area(a) + box_area(b) - inter
    return inter / max(1.0, union)


def distance(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def crop_region(gray, box, rel_x1, rel_y1, rel_x2, rel_y2, size):
    h_img, w_img = gray.shape[:2]
    x, y, w, h = box
    x1 = int(clamp(x + w * rel_x1, 0, w_img - 1))
    x2 = int(clamp(x + w * rel_x2, x1 + 1, w_img))
    y1 = int(clamp(y + h * rel_y1, 0, h_img - 1))
    y2 = int(clamp(y + h * rel_y2, y1 + 1, h_img))
    patch = gray[y1:y2, x1:x2]
    if patch.size == 0:
        return None
    patch = cv2.resize(patch, size, interpolation=cv2.INTER_AREA)
    patch = cv2.GaussianBlur(patch, (3, 3), 0)
    return cv2.equalizeHist(patch)


def crop_mouth(gray, box):
    return crop_region(gray, box, 0.12, 0.52, 0.88, 0.95, (64, 32))


def crop_face(gray, box):
    return crop_region(gray, box, 0.08, 0.08, 0.92, 0.92, (64, 64))


def visual_motion(prev_patch, patch):
    if prev_patch is None or patch is None:
        return 0.0
    diff = cv2.absdiff(prev_patch, patch)
    return float(np.mean(diff)) / 255.0


def audio_lip_sync(motions, audios):
    if len(motions) < 7 or len(audios) < 7:
        return 0.0
    m = np.asarray(motions, dtype=np.float64)
    a = np.asarray(audios, dtype=np.float64)
    if np.std(m) < 0.0025 or np.std(a) < 0.035:
        return 0.0

    best = -1.0
    # Small A/V offsets are common. Test roughly +/- one sampled frame.
    for lag in (-1, 0, 1):
        if lag < 0:
            mm, aa = m[-lag:], a[:lag]
        elif lag > 0:
            mm, aa = m[:-lag], a[lag:]
        else:
            mm, aa = m, a
        if len(mm) < 6 or np.std(mm) < 0.0025 or np.std(aa) < 0.035:
            continue
        corr = float(np.corrcoef(mm, aa)[0, 1])
        if math.isfinite(corr):
            best = max(best, corr)

    if best <= -1.0:
        return 0.0
    return clamp((best + 0.10) / 0.90, 0.0, 1.0)


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
    out = [points[0]]
    last = points[0]
    for point in points[1:]:
        same_mode = point["mode"] == last["mode"]
        same_speaker = point.get("speaker_id") == last.get("speaker_id")
        close = (
            abs(point["focus_x"] - last["focus_x"]) < 0.012
            and abs(point["focus_y"] - last["focus_y"]) < 0.018
        )
        elapsed = point["time"] - last["time"]
        if same_mode and same_speaker and close and elapsed < 1.15:
            continue
        out.append(point)
        last = point
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
    parser.add_argument("--sample-fps", type=float, default=6.0)
    args = parser.parse_args()

    width, height, source_fps = probe_video(args.input)
    proxy_w, proxy_h = proxy_size(width, height)
    sample_fps = clamp(args.sample_fps, 4.0, 10.0)
    total_frames = max(1, int(math.ceil(args.duration * sample_fps)))
    audio_envelope = extract_audio_envelope(
        args.input, args.start, args.duration, sample_fps
    )

    detector = cv2.FaceDetectorYN.create(
        args.model, "", (320, 320), 0.56, 0.30, 5000
    )

    vf = f"fps={sample_fps},scale={proxy_w}:{proxy_h}:flags=fast_bilinear"
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-ss", f"{args.start:.3f}", "-i", args.input,
        "-t", f"{args.duration:.3f}",
        "-vf", vf, "-an", "-pix_fmt", "bgr24",
        "-f", "rawvideo", "pipe:1",
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
    active_confidences = []
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
            audio_now = float(audio_envelope[min(frame_index, len(audio_envelope) - 1)])

            hist = histogram_signature(frame)
            scene_change = False
            if prev_hist is not None:
                corr = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_CORREL)
                scene_change = corr < 0.54
                if scene_change:
                    scene_count += 1
                    tracks.clear()
                    active_track_id = None
                    challenger_id = None
                    challenger_streak = 0
            prev_hist = hist

            detector.setInputSize((proxy_w, proxy_h))
            _, faces = detector.detect(frame)
            detections = []
            if faces is not None:
                for face in faces:
                    x, y, w, h = [float(v) for v in face[:4]]
                    det_score = float(face[14]) if len(face) > 14 else 0.5
                    box = (
                        clamp(x, 0, proxy_w - 1),
                        clamp(y, 0, proxy_h - 1),
                        clamp(w, 2, proxy_w),
                        clamp(h, 2, proxy_h),
                    )
                    if box[2] * box[3] < proxy_w * proxy_h * 0.0012:
                        continue
                    detections.append((box, det_score))

            assigned_tracks = set()
            assigned_dets = set()
            pairs = []
            for det_i, (box, _) in enumerate(detections):
                center = box_center(box)
                area = box_area(box)
                for track_id, track in tracks.items():
                    d = distance(center, track.center) / max(proxy_w, proxy_h)
                    iou = box_iou(box, track.box)
                    size_delta = abs(math.log(area / max(1.0, box_area(track.box))))
                    cost = 0.56 * d + 0.34 * (1.0 - iou) + 0.10 * min(1.0, size_delta)
                    if d < 0.22 or iou > 0.05:
                        pairs.append((cost, det_i, track_id))
            pairs.sort()

            for cost, det_i, track_id in pairs:
                if cost > 0.43 or det_i in assigned_dets or track_id in assigned_tracks:
                    continue
                box, det_score = detections[det_i]
                track = tracks[track_id]
                mouth = crop_mouth(gray, box)
                face_patch = crop_face(gray, box)
                mouth_delta = visual_motion(track.prev_mouth, mouth)
                face_delta = visual_motion(track.prev_face, face_patch)
                compensated = max(0.0, mouth_delta - 0.48 * face_delta)

                track.prev_mouth = mouth
                track.prev_face = face_patch
                track.center = box_center(box)
                track.box = box
                track.det_score = det_score
                track.missed = 0
                track.lip_motion = 0.58 * track.lip_motion + 0.42 * compensated
                track.face_motion = 0.62 * track.face_motion + 0.38 * face_delta
                track.motion_history.append(track.lip_motion)
                track.audio_history.append(audio_now)
                sync = audio_lip_sync(track.motion_history, track.audio_history)
                track.sync_score = 0.68 * track.sync_score + 0.32 * sync

                activity = clamp(track.lip_motion * 8.5, 0.0, 1.0)
                instant = (
                    0.58 * track.sync_score
                    + 0.30 * activity
                    + 0.10 * activity * audio_now
                    + 0.02 * det_score
                )
                if audio_now < 0.10:
                    instant *= 0.45
                track.score = 0.62 * track.score + 0.38 * instant
                assigned_dets.add(det_i)
                assigned_tracks.add(track_id)

            newly_created_ids = set()
            for det_i, (box, det_score) in enumerate(detections):
                if det_i in assigned_dets:
                    continue
                track = Track(
                    track_id=next_track_id,
                    center=box_center(box),
                    box=box,
                    det_score=det_score,
                    score=det_score * 0.015,
                    prev_mouth=crop_mouth(gray, box),
                    prev_face=crop_face(gray, box),
                )
                track.motion_history.append(0.0)
                track.audio_history.append(audio_now)
                tracks[next_track_id] = track
                newly_created_ids.add(next_track_id)
                next_track_id += 1

            for track_id in list(tracks.keys()):
                if track_id not in assigned_tracks and track_id not in newly_created_ids:
                    tracks[track_id].missed += 1
                    tracks[track_id].score *= 0.90
                if tracks[track_id].missed > int(sample_fps * 1.35):
                    del tracks[track_id]
                    if active_track_id == track_id:
                        active_track_id = None

            visible = [track for track in tracks.values() if track.missed == 0]
            if visible:
                face_frames += 1

            previous_active_id = active_track_id
            ranked = sorted(visible, key=lambda track: track.score, reverse=True)
            if ranked:
                best = ranked[0]
                current = tracks.get(active_track_id) if active_track_id in tracks else None
                if len(ranked) == 1:
                    active_track_id = best.track_id
                    challenger_id = None
                    challenger_streak = 0
                elif current is None or current.missed:
                    active_track_id = best.track_id
                    challenger_id = None
                    challenger_streak = 0
                elif best.track_id != active_track_id:
                    threshold = max(current.score + 0.045, current.score * 1.16)
                    if best.score > threshold:
                        if challenger_id == best.track_id:
                            challenger_streak += 1
                        else:
                            challenger_id = best.track_id
                            challenger_streak = 1
                        required = max(2, int(round(sample_fps * 0.32)))
                        if challenger_streak >= required:
                            active_track_id = best.track_id
                            challenger_id = None
                            challenger_streak = 0
                    else:
                        challenger_id = None
                        challenger_streak = 0

            switched = previous_active_id is not None and active_track_id != previous_active_id
            if switched:
                speaker_switches += 1

            mode = "center"
            confidence = 0.20
            target = np.array([0.5, 0.43], dtype=np.float64)
            active = tracks.get(active_track_id) if active_track_id in tracks else None

            if active is not None:
                target = np.array(active.center) / np.array([proxy_w, proxy_h])
                target[1] = clamp(target[1] - 0.06, 0.22, 0.68)
                mode = "speaker"
                confidence = clamp(0.42 + active.score * 0.74, 0.42, 0.97)
                active_confidences.append(confidence)
            elif len(visible) >= 2 and audio_now < 0.10:
                top2 = sorted(visible, key=lambda track: track.det_score, reverse=True)[:2]
                c1 = np.array(top2[0].center) / np.array([proxy_w, proxy_h])
                c2 = np.array(top2[1].center) / np.array([proxy_w, proxy_h])
                if abs(c1[0] - c2[0]) < 0.26:
                    target = (c1 + c2) * 0.5
                    target[1] = clamp(target[1] - 0.04, 0.24, 0.68)
                    mode = "group"
                    confidence = 0.52
                    group_frames += 1
            elif not visible:
                motion, motion_confidence = motion_focus(prev_gray, gray)
                if motion is not None:
                    target = np.array(motion)
                    mode = "motion"
                    confidence = 0.30 + motion_confidence * 0.40

            # Dead-zone keeps a human-editor feel: don't micro-pan for small head movement.
            delta = target - smoothed_focus
            if abs(delta[0]) < 0.020:
                target[0] = smoothed_focus[0]
            if abs(delta[1]) < 0.026:
                target[1] = smoothed_focus[1]

            if scene_change:
                alpha = 0.72
            elif switched:
                alpha = 0.62
            elif mode == "speaker":
                alpha = 0.26
            else:
                alpha = 0.18

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
                "audio_activity": round(audio_now, 4),
                "speaker_score": round(float(active.score), 4) if active is not None else None,
                "sync_score": round(float(active.sync_score), 4) if active is not None else None,
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
        "vision_backend": "yunet_audio_lip_sync_v2",
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
            "avg_active_confidence": round(float(np.mean(active_confidences)), 4) if active_confidences else 0.0,
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
        "avg_active_confidence": result["stats"]["avg_active_confidence"],
    })


if __name__ == "__main__":
    main()
