#!/usr/bin/env python3
import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np

EMOTIONS = ["neutral", "happiness", "surprise", "sadness", "anger", "disgust", "fear", "contempt"]

def softmax(x):
    x = np.asarray(x, dtype=np.float32).reshape(-1)
    x = x - np.max(x)
    e = np.exp(x)
    s = float(np.sum(e))
    return e / s if s > 0 else np.zeros_like(e)

def run(cmd, timeout=1800):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout).decode("utf-8", "ignore")[-1800:])
    return p

def extract_frames(video, out_dir, sample_fps, width):
    pattern = str(Path(out_dir) / "frame_%07d.jpg")
    vf = f"fps={sample_fps},scale={width}:-2:flags=fast_bilinear"
    run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",video,"-vf",vf,"-q:v","6",pattern], timeout=3600)
    return sorted(Path(out_dir).glob("frame_*.jpg"))

def extract_audio(video, pcm_path):
    run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",video,"-vn","-ac","1","-ar","16000","-f","s16le",str(pcm_path)], timeout=1800)

def audio_windows(pcm_path, hop_s=0.5, sr=16000):
    data = np.fromfile(str(pcm_path), dtype=np.int16).astype(np.float32) / 32768.0
    hop = max(1, int(sr * hop_s))
    if data.size == 0:
        return {"hop": hop_s, "energy": [], "p95": 1.0}
    vals = []
    for i in range(0, len(data), hop):
        chunk = data[i:i+hop]
        if chunk.size == 0: break
        rms = float(np.sqrt(np.mean(chunk * chunk) + 1e-12))
        vals.append(rms)
    arr = np.asarray(vals, dtype=np.float32)
    p95 = float(np.percentile(arr, 95)) if arr.size else 1.0
    p95 = max(p95, 1e-4)
    norm = np.clip(arr / p95, 0.0, 1.5)
    return {"hop": hop_s, "energy": norm.tolist(), "p95": p95}

def energy_at(audio, t):
    vals = audio["energy"]
    if not vals: return 0.0
    idx = min(len(vals)-1, max(0, int(round(t / audio["hop"]))))
    return float(vals[idx])

def detect_faces(detector, frame):
    h,w = frame.shape[:2]
    detector.setInputSize((w,h))
    _, faces = detector.detect(frame)
    out = []
    if faces is None:
        return out
    for row in faces:
        x,y,fw,fh = [float(v) for v in row[:4]]
        score = float(row[-1])
        if fw <= 1 or fh <= 1:
            continue
        out.append({
            "x": max(0.0,x)/w, "y": max(0.0,y)/h,
            "w": min(float(w),fw)/w, "h": min(float(h),fh)/h,
            "cx": (x+fw/2)/w, "cy": (y+fh/2)/h,
            "score": score,
            "_px": (max(0,int(x)), max(0,int(y)), min(w,int(x+fw)), min(h,int(y+fh)))
        })
    return out

def emotion_probs(net, gray, face):
    x1,y1,x2,y2 = face["_px"]
    if x2-x1 < 12 or y2-y1 < 12:
        return np.array([1,0,0,0,0,0,0,0], dtype=np.float32)
    crop = gray[y1:y2, x1:x2]
    if crop.size == 0:
        return np.array([1,0,0,0,0,0,0,0], dtype=np.float32)
    img = cv2.resize(crop, (64,64), interpolation=cv2.INTER_AREA).astype(np.float32)
    blob = img.reshape(1,1,64,64)
    net.setInput(blob)
    scores = net.forward()
    return softmax(scores)

def scene_diff(prev_small, gray):
    small = cv2.resize(gray, (64,36), interpolation=cv2.INTER_AREA).astype(np.float32)
    if prev_small is None:
        return 0.0, small
    diff = float(np.mean(np.abs(small - prev_small)) / 255.0)
    return diff, small

def match_tracks(faces, tracks, t, reset=False):
    if reset:
        tracks.clear()
    used = set()
    ids = []
    next_id = max(tracks.keys(), default=0) + 1
    for f in faces:
        best = None
        best_d = 999
        for tid,tr in tracks.items():
            if tid in used or t - tr["t"] > 3.2:
                continue
            d = math.hypot(f["cx"]-tr["cx"], f["cy"]-tr["cy"])
            if d < 0.23 and d < best_d:
                best, best_d = tid, d
        if best is None:
            best = next_id
            next_id += 1
        tracks[best] = {"cx":f["cx"],"cy":f["cy"],"t":t}
        used.add(best)
        ids.append(best)
    stale = [tid for tid,tr in tracks.items() if t-tr["t"]>4.0]
    for tid in stale:
        tracks.pop(tid, None)
    return ids

def clamp01(v):
    return max(0.0, min(1.0, float(v)))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--yunet", required=True)
    ap.add_argument("--emotion-model", required=True)
    ap.add_argument("--sample-fps", type=float, default=1.0)
    ap.add_argument("--width", type=int, default=448)
    ap.add_argument("--max-events", type=int, default=420)
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    if args.self_test:
        assert Path(args.yunet).exists(), "YuNet missing"
        assert Path(args.emotion_model).exists(), "emotion model missing"
        det = cv2.FaceDetectorYN.create(args.yunet, "", (320,320), 0.72, 0.3, 5000)
        net = cv2.dnn.readNetFromONNX(args.emotion_model)
        dummy = np.zeros((64,64), dtype=np.float32)
        net.setInput(dummy.reshape(1,1,64,64))
        out = net.forward()
        assert np.asarray(out).size == 8, f"emotion output invalid: {np.asarray(out).shape}"
        print(json.dumps({"ok":True,"backend":"yunet+ferplus_int8_or_fp32","emotion_outputs":8}))
        return

    sample_fps = max(0.25, min(2.0, float(args.sample_fps)))
    tmp = Path(tempfile.mkdtemp(prefix="multimodal-light-"))
    try:
        frames_dir = tmp/"frames"
        frames_dir.mkdir(parents=True, exist_ok=True)
        pcm = tmp/"audio.pcm"

        extract_frames(args.input, frames_dir, sample_fps, args.width)
        extract_audio(args.input, pcm)
        frames = sorted(frames_dir.glob("frame_*.jpg"))
        audio = audio_windows(pcm)

        detector = cv2.FaceDetectorYN.create(args.yunet, "", (args.width,args.width), 0.72, 0.3, 5000)
        emotion_net = cv2.dnn.readNetFromONNX(args.emotion_model)

        events = []
        prev_small = None
        prev_emotion = np.zeros(8, dtype=np.float32)
        prev_energy = 0.0
        prev_faces = 0
        tracks = {}
        face_frames = 0
        multi_face_frames = 0
        scene_count = 0
        emotion_frames = 0
        track_ids_seen = set()

        for idx, path in enumerate(frames):
            t = idx / sample_fps
            frame = cv2.imread(str(path), cv2.IMREAD_COLOR)
            if frame is None:
                continue
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            diff, prev_small_next = scene_diff(prev_small, gray)
            is_scene = diff >= 0.19
            prev_small = prev_small_next
            if is_scene:
                scene_count += 1

            faces = detect_faces(detector, frame)
            face_count = len(faces)
            if face_count:
                face_frames += 1
            if face_count >= 2:
                multi_face_frames += 1
            track_ids = match_tracks(faces, tracks, t, reset=is_scene)
            track_ids_seen.update(track_ids)

            probs_list = []
            for f in faces[:6]:
                try:
                    probs_list.append(emotion_probs(emotion_net, gray, f))
                except cv2.error:
                    pass
            if probs_list:
                arr = np.vstack(probs_list)
                max_probs = arr.max(axis=0)
                mean_probs = arr.mean(axis=0)
                emotion_frames += 1
            else:
                max_probs = np.zeros(8, dtype=np.float32)
                max_probs[0] = 1.0
                mean_probs = max_probs.copy()

            emotion_change = float(np.mean(np.abs(max_probs - prev_emotion)))
            prev_emotion = max_probs

            energy = energy_at(audio, t)
            audio_delta = max(0.0, energy - prev_energy)
            prev_energy = energy
            silence = energy < 0.07

            happiness = float(max_probs[1])
            surprise = float(max_probs[2])
            anger = float(max_probs[4])
            disgust = float(max_probs[5])
            fear = float(max_probs[6])
            contempt = float(max_probs[7])
            non_neutral = max(happiness, surprise, anger, disgust, fear, contempt)

            reaction_score = clamp01(
                0.34*non_neutral +
                1.85*emotion_change +
                0.18*clamp01(audio_delta/0.45) +
                (0.08 if face_count >= 2 else 0.0)
            )
            laughter_score = clamp01(0.70*happiness + 0.22*clamp01(energy) + 0.08*(face_count>=2))
            tension_score = clamp01(0.45*max(anger,disgust,fear,contempt) + 0.30*clamp01(energy) + 1.1*emotion_change)

            largest = max((f["w"]*f["h"] for f in faces), default=0.0)
            group_shot = face_count >= 2
            close_up = largest >= 0.18

            candidates = []
            if is_scene:
                candidates.append(("scene_change", clamp01((diff-0.15)/0.25 + 0.35)))
            if reaction_score >= 0.52:
                candidates.append(("facial_reaction", reaction_score))
            if laughter_score >= 0.58:
                candidates.append(("laughter_candidate", laughter_score))
            if tension_score >= 0.58:
                candidates.append(("tension_expression", tension_score))
            if audio_delta >= 0.32:
                candidates.append(("audio_spike", clamp01(audio_delta/0.75)))
            if silence and prev_energy >= 0.18:
                candidates.append(("sudden_pause", 0.58))
            if face_count != prev_faces and max(face_count,prev_faces) >= 2:
                candidates.append(("face_count_change", 0.50 + 0.08*min(4,abs(face_count-prev_faces))))
            if face_count >= 2 and reaction_score >= 0.45:
                candidates.append(("group_reaction", clamp01(reaction_score + 0.08)))

            prev_faces = face_count

            for typ, score in candidates:
                events.append({
                    "time": round(t,3),
                    "type": typ,
                    "score": round(float(score),3),
                    "faces": face_count,
                    "tracks": track_ids[:6],
                    "group_shot": bool(group_shot),
                    "close_up": bool(close_up),
                    "face_area": round(float(largest),4),
                    "happiness": round(happiness,3),
                    "surprise": round(surprise,3),
                    "anger": round(anger,3),
                    "disgust": round(disgust,3),
                    "fear": round(fear,3),
                    "contempt": round(contempt,3),
                    "emotion_change": round(emotion_change,3),
                    "audio_energy": round(float(energy),3),
                    "audio_delta": round(float(audio_delta),3),
                    "scene_diff": round(float(diff),3),
                })

        # Keep the highest-salience event inside each 0.75s/type bucket, then cap.
        buckets = {}
        for e in events:
            key = (e["type"], int(e["time"]/0.75))
            if key not in buckets or e["score"] > buckets[key]["score"]:
                buckets[key] = e
        compact = sorted(buckets.values(), key=lambda e: e["time"])
        if len(compact) > args.max_events:
            top = sorted(compact, key=lambda e:e["score"], reverse=True)[:args.max_events]
            compact = sorted(top, key=lambda e:e["time"])

        duration = (len(frames)-1)/sample_fps if frames else 0.0
        summary = {
            "frames_sampled": len(frames),
            "sample_fps": sample_fps,
            "face_frame_ratio": round(face_frames/max(1,len(frames)),4),
            "multi_face_frame_ratio": round(multi_face_frames/max(1,len(frames)),4),
            "emotion_frame_ratio": round(emotion_frames/max(1,len(frames)),4),
            "face_tracks_seen": len(track_ids_seen),
            "scene_changes": scene_count,
            "events": len(compact),
            "reaction_events": sum(1 for e in compact if e["type"] in ("facial_reaction","group_reaction")),
            "laughter_candidates": sum(1 for e in compact if e["type"]=="laughter_candidate"),
            "audio_spikes": sum(1 for e in compact if e["type"]=="audio_spike"),
            "sudden_pauses": sum(1 for e in compact if e["type"]=="sudden_pause"),
        }
        out = {
            "version":"multimodal_light_v1",
            "backend":"opencv_yunet+ferplus+audio+scene",
            "duration_seconds":round(duration,3),
            "features":[
                "face_present","face_count","face_track","face_area","group_shot","close_up",
                "happiness","surprise","anger","disgust","fear","contempt",
                "emotion_change","facial_reaction","group_reaction","laughter_candidate",
                "audio_energy","audio_delta","audio_spike","sudden_pause",
                "scene_change","scene_diff"
            ],
            "summary":summary,
            "events":compact,
        }
        print(json.dumps(out, ensure_ascii=False, separators=(",",":")))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

if __name__ == "__main__":
    main()
