#!/usr/bin/env python3
"""
AI Editor v4.3 vision engine — neural active-speaker edition.

Active speaker:
- OpenCV YuNet face detection + CPU face tracking
- LR-ASD (IJCV 2025) TalkSet weights for audio-visual active speaker scoring
- CPU inference through PyTorch
- editorial hysteresis / hold rules to avoid nervous camera switches

The LR-ASD architecture is adapted from Junhua-Liao/LR-ASD (MIT License).
Weights are loaded from the upstream TalkSet checkpoint at image build time.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from collections import defaultdict

import cv2
import numpy as np

try:
    import torch
    import torch.nn as nn
except Exception:
    torch = None
    nn = None

LR_ASD_UPSTREAM = "Junhua-Liao/LR-ASD"
VISION_FPS = 25.0
FACE_SIZE = 112
EPS = 1e-8


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


def box_center(box):
    x, y, w, h = box
    return np.array([x + w * 0.5, y + h * 0.5], dtype=np.float32)


def box_iou(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ax2, ay2 = ax + aw, ay + ah
    bx2, by2 = bx + bw, by + bh
    ix1, iy1 = max(ax, bx), max(ay, by)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    union = aw * ah + bw * bh - inter
    return inter / max(EPS, union)


def crop_face_for_asd(frame, box):
    """Approximate upstream LR-ASD face crop then use centered 112x112 grayscale."""
    h_img, w_img = frame.shape[:2]
    x, y, w, h = box
    side = max(w, h) * 1.42
    cx = x + w * 0.5
    cy = y + h * 0.52
    x1 = int(round(cx - side * 0.5))
    y1 = int(round(cy - side * 0.5))
    x2 = int(round(cx + side * 0.5))
    y2 = int(round(cy + side * 0.5))

    pad_l = max(0, -x1)
    pad_t = max(0, -y1)
    pad_r = max(0, x2 - w_img)
    pad_b = max(0, y2 - h_img)
    if pad_l or pad_t or pad_r or pad_b:
        padded = cv2.copyMakeBorder(
            frame, pad_t, pad_b, pad_l, pad_r,
            cv2.BORDER_CONSTANT, value=(110, 110, 110),
        )
        x1 += pad_l
        x2 += pad_l
        y1 += pad_t
        y2 += pad_t
    else:
        padded = frame

    crop = padded[max(0, y1):max(y1 + 1, y2), max(0, x1):max(x1 + 1, x2)]
    if crop.size == 0:
        return np.full((FACE_SIZE, FACE_SIZE), 110, dtype=np.uint8)
    crop = cv2.resize(crop, (224, 224), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    return gray[56:168, 56:168]


def decode_audio(path, start, duration, sample_rate=16000):
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-ss", f"{start:.3f}", "-i", path,
        "-t", f"{duration:.3f}",
        "-vn", "-ac", "1", "-ar", str(sample_rate),
        "-f", "s16le", "pipe:1",
    ]
    raw = subprocess.check_output(cmd)
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32)


def hz_to_mel(hz):
    return 2595.0 * np.log10(1.0 + hz / 700.0)


def mel_to_hz(mel):
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)


def dct_type_2_matrix(n_filters, n_ceps):
    n = np.arange(n_filters, dtype=np.float32)
    k = np.arange(n_ceps, dtype=np.float32)[:, None]
    mat = np.cos(np.pi / n_filters * (n + 0.5) * k)
    mat[0] *= math.sqrt(1.0 / n_filters)
    if n_ceps > 1:
        mat[1:] *= math.sqrt(2.0 / n_filters)
    return mat


def mfcc_python_speech_features_compatible(
    audio,
    sample_rate=16000,
    numcep=13,
    nfilt=26,
    nfft=512,
    winlen=0.025,
    winstep=0.010,
    preemph=0.97,
    ceplifter=22,
):
    """
    Reproduce python_speech_features.mfcc defaults closely enough for LR-ASD:
    rectangular window, preemphasis, 26 mel filters, DCT-II ortho, energy replacement, lifter.
    """
    signal = np.asarray(audio, dtype=np.float32)
    if signal.size == 0:
        return np.zeros((1, numcep), dtype=np.float32)

    emphasized = np.empty_like(signal)
    emphasized[0] = signal[0]
    emphasized[1:] = signal[1:] - preemph * signal[:-1]

    frame_len = int(round(winlen * sample_rate))
    frame_step = int(round(winstep * sample_rate))
    if emphasized.size <= frame_len:
        num_frames = 1
    else:
        num_frames = 1 + int(math.ceil((emphasized.size - frame_len) / frame_step))
    pad_len = (num_frames - 1) * frame_step + frame_len
    padded = np.pad(emphasized, (0, max(0, pad_len - emphasized.size)))

    indices = (
        np.arange(frame_len)[None, :]
        + np.arange(num_frames)[:, None] * frame_step
    )
    frames = padded[indices]
    # python_speech_features default winfunc is ones, so no Hamming window here.

    spectrum = np.fft.rfft(frames, n=nfft)
    power = (1.0 / nfft) * (np.abs(spectrum) ** 2)
    energy = np.maximum(np.sum(power, axis=1), np.finfo(np.float32).eps)

    low_mel = hz_to_mel(0.0)
    high_mel = hz_to_mel(sample_rate / 2.0)
    mel_points = np.linspace(low_mel, high_mel, nfilt + 2)
    hz_points = mel_to_hz(mel_points)
    bins = np.floor((nfft + 1) * hz_points / sample_rate).astype(int)
    bins = np.clip(bins, 0, nfft // 2)

    fbank = np.zeros((nfilt, nfft // 2 + 1), dtype=np.float32)
    for m in range(1, nfilt + 1):
        left, center, right = bins[m - 1], bins[m], bins[m + 1]
        if center <= left:
            center = min(left + 1, nfft // 2)
        if right <= center:
            right = min(center + 1, nfft // 2)
        if center > left:
            fbank[m - 1, left:center] = (
                np.arange(left, center) - left
            ) / max(1, center - left)
        if right > center:
            fbank[m - 1, center:right] = (
                right - np.arange(center, right)
            ) / max(1, right - center)

    feat = np.maximum(power @ fbank.T, np.finfo(np.float32).eps)
    log_feat = np.log(feat)
    dct = dct_type_2_matrix(nfilt, numcep)
    cep = log_feat @ dct.T

    if ceplifter > 0:
        n = np.arange(numcep)
        lift = 1.0 + (ceplifter / 2.0) * np.sin(np.pi * n / ceplifter)
        cep *= lift[None, :]

    cep[:, 0] = np.log(energy)
    return cep.astype(np.float32)


# ----- LR-ASD network (adapted from MIT-licensed upstream) -----

class AudioBlock(nn.Module):
    def __init__(self, in_channels, out_channels, kernel_1, kernel_2):
        super().__init__()
        relu = nn.ReLU()
        self.relu = relu
        p1, p2 = (kernel_1 - 1) // 2, (kernel_2 - 1) // 2
        self.m_1 = nn.Conv2d(in_channels, out_channels // 2, (kernel_1, 1), padding=(p1, 0), bias=False)
        self.m_norm_1 = nn.BatchNorm2d(out_channels // 2, momentum=0.01, eps=0.001)
        self.m_2 = nn.Conv2d(out_channels // 2, out_channels, (kernel_2, 1), padding=(p2, 0), bias=False)
        self.m_norm_2 = nn.BatchNorm2d(out_channels, momentum=0.01, eps=0.001)
        self.t_1 = nn.Conv2d(out_channels, out_channels, (1, kernel_1), padding=(0, p1), bias=False)
        self.t_norm_1 = nn.BatchNorm2d(out_channels, momentum=0.01, eps=0.001)
        self.t_2 = nn.Conv2d(out_channels, out_channels, (1, kernel_2), padding=(0, p2), bias=False)
        self.t_norm_2 = nn.BatchNorm2d(out_channels, momentum=0.01, eps=0.001)

    def forward(self, x):
        x = self.relu(self.m_norm_1(self.m_1(x)))
        x = self.relu(self.m_norm_2(self.m_2(x)))
        x = self.relu(self.t_norm_1(self.t_1(x)))
        x = self.relu(self.t_norm_2(self.t_2(x)))
        return x


class VisualBlock(nn.Module):
    def __init__(self, in_channels, out_channels, kernel_1, kernel_2, is_down=False):
        super().__init__()
        self.relu = nn.ReLU()
        p1, p2 = (kernel_1 - 1) // 2, (kernel_2 - 1) // 2
        stride = (1, 2, 2) if is_down else 1
        self.s_1 = nn.Conv3d(
            in_channels, out_channels // 2, (1, kernel_1, kernel_1),
            stride=stride, padding=(0, p1, p1), bias=False,
        )
        self.s_norm_1 = nn.BatchNorm3d(out_channels // 2, momentum=0.01, eps=0.001)
        self.s_2 = nn.Conv3d(
            out_channels // 2, out_channels, (1, kernel_2, kernel_2),
            padding=(0, p2, p2), bias=False,
        )
        self.s_norm_2 = nn.BatchNorm3d(out_channels, momentum=0.01, eps=0.001)
        self.t_1 = nn.Conv3d(
            out_channels, out_channels, (kernel_1, 1, 1),
            padding=(p1, 0, 0), bias=False,
        )
        self.t_norm_1 = nn.BatchNorm3d(out_channels, momentum=0.01, eps=0.001)
        self.t_2 = nn.Conv3d(
            out_channels, out_channels, (kernel_2, 1, 1),
            padding=(p2, 0, 0), bias=False,
        )
        self.t_norm_2 = nn.BatchNorm3d(out_channels, momentum=0.01, eps=0.001)

    def forward(self, x):
        x = self.relu(self.s_norm_1(self.s_1(x)))
        x = self.relu(self.s_norm_2(self.s_2(x)))
        x = self.relu(self.t_norm_1(self.t_1(x)))
        x = self.relu(self.t_norm_2(self.t_2(x)))
        return x


class VisualEncoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.block1 = VisualBlock(1, 32, 5, 3, is_down=True)
        self.pool1 = nn.MaxPool3d((1, 3, 3), stride=(1, 2, 2), padding=(0, 1, 1))
        self.block2 = VisualBlock(32, 64, 5, 3)
        self.pool2 = nn.MaxPool3d((1, 3, 3), stride=(1, 2, 2), padding=(0, 1, 1))
        self.block3 = VisualBlock(64, 128, 5, 3)
        self.maxpool = nn.AdaptiveMaxPool2d((1, 1))

    def forward(self, x):
        x = self.block1(x)
        x = self.pool1(x)
        x = self.block2(x)
        x = self.pool2(x)
        x = self.block3(x)
        x = x.transpose(1, 2)
        b, t, c, w, h = x.shape
        x = x.reshape(b * t, c, w, h)
        x = self.maxpool(x)
        return x.view(b, t, c)


class AudioEncoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.block1 = AudioBlock(1, 32, 5, 3)
        self.pool1 = nn.MaxPool3d((1, 1, 3), stride=(1, 1, 2), padding=(0, 0, 1))
        self.block2 = AudioBlock(32, 64, 5, 3)
        self.pool2 = nn.MaxPool3d((1, 1, 3), stride=(1, 1, 2), padding=(0, 0, 1))
        self.block3 = AudioBlock(64, 128, 5, 3)

    def forward(self, x):
        x = self.block1(x)
        x = self.pool1(x)
        x = self.block2(x)
        x = self.pool2(x)
        x = self.block3(x)
        x = torch.mean(x, dim=2, keepdim=True)
        return x.squeeze(2).transpose(1, 2)


class Fusion(nn.Module):
    def __init__(self, channel):
        super().__init__()
        self.sigmoid = nn.Sigmoid()
        self.attention = nn.Conv1d(channel, channel, 1, bias=False)
        self.bn = nn.BatchNorm1d(channel, momentum=0.01, eps=0.001)

    def forward(self, x1, x2):
        x = torch.cat((x1, x2), 2)
        identity = x.transpose(1, 2)
        w = self.sigmoid(self.bn(self.attention(identity)))
        return (identity * w).transpose(1, 2)


class Detector(nn.Module):
    def __init__(self, channel):
        super().__init__()
        self.gru_forward = nn.GRU(channel, channel // 4, batch_first=True)
        self.gru_backward = nn.GRU(channel, channel // 4, batch_first=True)
        self.drop = nn.Dropout(0.5)
        self.attention = Fusion(channel // 2)

    def forward(self, x):
        x1, _ = self.gru_forward(self.drop(x))
        rev = torch.flip(x, dims=[1])
        x2, _ = self.gru_backward(self.drop(rev))
        x2 = torch.flip(x2, dims=[1])
        return self.attention(x1, x2)


class LRASDModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.visualEncoder = VisualEncoder()
        self.audioEncoder = AudioEncoder()
        self.fusion = Fusion(256)
        self.detector = Detector(256)

    def forward_visual_frontend(self, x):
        b, t, w, h = x.shape
        x = x.view(b, 1, t, w, h)
        x = (x / 255.0 - 0.4161) / 0.1688
        return self.visualEncoder(x)

    def forward_audio_frontend(self, x):
        x = x.unsqueeze(1).transpose(2, 3)
        return self.audioEncoder(x)

    def forward_audio_visual_backend(self, x1, x2):
        x = self.fusion(x1, x2)
        x = self.detector(x)
        return torch.reshape(x, (-1, 128))


class LRASDInference:
    def __init__(self, weight_path, threads=2):
        if torch is None:
            raise RuntimeError("PyTorch indisponivel para LR-ASD")
        torch.set_num_threads(max(1, int(threads)))
        try:
            torch.set_num_interop_threads(1)
        except RuntimeError:
            pass

        self.model = LRASDModel().cpu()
        self.fc = nn.Linear(128, 2).cpu()
        state = torch.load(weight_path, map_location="cpu", weights_only=True)
        if isinstance(state, dict) and "state_dict" in state:
            state = state["state_dict"]

        model_state = {}
        fc_state = {}
        for key, value in state.items():
            clean = key.replace("module.", "")
            if clean.startswith("model."):
                model_state[clean[len("model."):]] = value
            elif clean.startswith("lossAV.FC."):
                fc_state[clean[len("lossAV.FC."):]] = value

        if not model_state:
            # Some checkpoints may contain the model state directly.
            direct_keys = set(self.model.state_dict().keys())
            model_state = {k: v for k, v in state.items() if k in direct_keys}
        missing, unexpected = self.model.load_state_dict(model_state, strict=False)
        if missing or unexpected:
            raise RuntimeError(
                f"LR-ASD model state incompatível; missing={missing[:6]} unexpected={unexpected[:6]}"
            )
        if not fc_state:
            raise RuntimeError("LR-ASD classifier lossAV.FC ausente no checkpoint")
        self.fc.load_state_dict(fc_state, strict=True)
        self.model.eval()
        self.fc.eval()

    @torch.inference_mode()
    def score(self, audio_mfcc, video_faces):
        audio_mfcc = np.asarray(audio_mfcc, dtype=np.float32)
        video_faces = np.asarray(video_faces, dtype=np.float32)
        v_len = int(video_faces.shape[0])
        a_len = int(audio_mfcc.shape[0])
        usable_v = min(v_len, a_len // 4)
        if usable_v < 5:
            return np.zeros(v_len, dtype=np.float32)

        usable_a = usable_v * 4
        a = torch.from_numpy(audio_mfcc[:usable_a]).unsqueeze(0)
        v = torch.from_numpy(video_faces[:usable_v]).unsqueeze(0)

        embed_a = self.model.forward_audio_frontend(a)
        embed_v = self.model.forward_visual_frontend(v)
        common = min(embed_a.shape[1], embed_v.shape[1])
        embed_a = embed_a[:, :common]
        embed_v = embed_v[:, :common]
        out = self.model.forward_audio_visual_backend(embed_a, embed_v)
        logits = self.fc(out)
        prob = torch.softmax(logits, dim=-1)[:, 1].cpu().numpy().astype(np.float32)

        result = np.zeros(v_len, dtype=np.float32)
        result[:len(prob)] = prob
        if len(prob) and len(prob) < v_len:
            result[len(prob):] = prob[-1]
        return result


def self_test(weight_path):
    engine = LRASDInference(weight_path, threads=1)
    rng = np.random.default_rng(42)
    audio = rng.normal(size=(100, 13)).astype(np.float32)
    video = rng.uniform(0, 255, size=(25, 112, 112)).astype(np.float32)
    scores = engine.score(audio, video)
    if scores.shape != (25,) or not np.all(np.isfinite(scores)):
        raise RuntimeError(f"self-test score invalido: shape={scores.shape}")
    emit({
        "type": "self_test",
        "ok": True,
        "backend": "lr_asd_talkset_cpu_v1",
        "frames": len(scores),
        "min": float(scores.min()),
        "max": float(scores.max()),
    })


@dataclass
class FaceTrack:
    track_id: int
    first_frame: int
    last_frame: int
    last_box: tuple[float, float, float, float]
    boxes: dict[int, tuple[float, float, float, float]] = field(default_factory=dict)
    faces: dict[int, np.ndarray] = field(default_factory=dict)
    missed: int = 0
    scores: dict[int, float] = field(default_factory=dict)

    def add(self, frame_idx, box, face):
        self.last_frame = frame_idx
        self.last_box = box
        self.boxes[frame_idx] = box
        self.faces[frame_idx] = face
        self.missed = 0


def associate_tracks(tracks, detections, max_missed=8):
    active = [t for t in tracks.values() if t.missed <= max_missed]
    candidates = []
    for det_i, (box, face) in enumerate(detections):
        c_det = box_center(box)
        for track in active:
            c_tr = box_center(track.last_box)
            norm = max(32.0, math.sqrt(track.last_box[2] * track.last_box[3]))
            dist = float(np.linalg.norm(c_det - c_tr) / norm)
            iou = box_iou(box, track.last_box)
            cost = (1.0 - iou) * 0.62 + min(2.0, dist) * 0.38
            candidates.append((cost, det_i, track.track_id, iou, dist))
    candidates.sort()

    det_used, track_used = set(), set()
    matches = []
    for cost, det_i, track_id, iou, dist in candidates:
        if det_i in det_used or track_id in track_used:
            continue
        if cost > 0.95 or (iou < 0.05 and dist > 1.15):
            continue
        matches.append((det_i, track_id))
        det_used.add(det_i)
        track_used.add(track_id)
    return matches, det_used, track_used


def score_track_neural(engine, track, global_mfcc):
    start = track.first_frame
    end = track.last_frame
    length = end - start + 1
    if length < 10:
        return

    # Fill short detector gaps using the last known crop, then the next crop if needed.
    faces = []
    last_face = None
    last_box = None
    next_known = {}
    next_boxes = {}
    nxt = None
    nxt_box = None
    for idx in range(end, start - 1, -1):
        if idx in track.faces:
            nxt = track.faces[idx]
        if idx in track.boxes:
            nxt_box = track.boxes[idx]
        next_known[idx] = nxt
        next_boxes[idx] = nxt_box

    visible_count = 0
    for frame_idx in range(start, end + 1):
        face = track.faces.get(frame_idx)
        box = track.boxes.get(frame_idx)
        if face is not None:
            visible_count += 1
            last_face = face
        elif last_face is not None:
            face = last_face
        else:
            face = next_known.get(frame_idx)

        if box is not None:
            last_box = box
        elif last_box is not None:
            track.boxes[frame_idx] = last_box
        elif next_boxes.get(frame_idx) is not None:
            track.boxes[frame_idx] = next_boxes[frame_idx]

        if face is None:
            face = np.full((FACE_SIZE, FACE_SIZE), 110, dtype=np.uint8)
        faces.append(face)

    if visible_count / max(1, length) < 0.45:
        return

    audio_start = start * 4
    audio_end = (end + 1) * 4
    audio = global_mfcc[audio_start:audio_end]
    usable = min(len(faces), len(audio) // 4)
    if usable < 10:
        return

    # Chunk inference limits RAM and gives the recurrent detector local conversational context.
    chunk = 150  # 6 s at 25 fps
    overlap = 25  # 1 s
    accum = np.zeros(usable, dtype=np.float32)
    counts = np.zeros(usable, dtype=np.float32)
    pos = 0
    while pos < usable:
        c_end = min(usable, pos + chunk)
        v = np.stack(faces[pos:c_end], axis=0)
        a0, a1 = pos * 4, c_end * 4
        a = audio[a0:a1]
        scores = engine.score(a, v)[: c_end - pos]
        accum[pos:c_end] += scores
        counts[pos:c_end] += 1.0
        if c_end >= usable:
            break
        pos = max(pos + 1, c_end - overlap)

    final = accum / np.maximum(1.0, counts)
    for offset, score in enumerate(final):
        track.scores[start + offset] = float(score)


def compress_camera(points):
    if not points:
        return []
    out = [points[0]]
    last = points[0]
    for point in points[1:]:
        mode_same = point["mode"] == last["mode"]
        speaker_same = point.get("speaker_id") == last.get("speaker_id")
        close = (
            abs(point["focus_x"] - last["focus_x"]) < 0.012
            and abs(point["focus_y"] - last["focus_y"]) < 0.016
        )
        elapsed = point["time"] - last["time"]
        if mode_same and speaker_same and close and elapsed < 0.9:
            continue
        out.append(point)
        last = point
    if out[-1]["time"] < points[-1]["time"] - 0.15:
        out.append(points[-1])
    return out


def run(args):
    width, height, source_fps = probe_video(args.input)
    proxy_w, proxy_h = proxy_size(width, height, max_side=args.proxy_max_side)
    total_frames = max(1, int(math.ceil(args.duration * VISION_FPS)))

    detector = cv2.FaceDetectorYN.create(
        args.model, "", (320, 320), 0.55, 0.30, 5000
    )

    audio = decode_audio(args.input, args.start, args.duration, sample_rate=16000)
    mfcc = mfcc_python_speech_features_compatible(audio, sample_rate=16000)
    engine = LRASDInference(args.weights, threads=args.torch_threads)

    vf = f"fps={VISION_FPS},scale={proxy_w}:{proxy_h}:flags=fast_bilinear"
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-ss", f"{args.start:.3f}", "-i", args.input,
        "-t", f"{args.duration:.3f}",
        "-vf", vf, "-an", "-pix_fmt", "bgr24",
        "-f", "rawvideo", "pipe:1",
    ]
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    frame_bytes = proxy_w * proxy_h * 3

    tracks: dict[int, FaceTrack] = {}
    next_track_id = 1
    active_ids = set()
    started = time.time()
    frame_idx = 0
    face_frames = 0
    multi_face_frames = 0
    max_missed = 8

    try:
        while frame_idx < total_frames:
            raw = process.stdout.read(frame_bytes)
            if not raw or len(raw) < frame_bytes:
                break
            frame = np.frombuffer(raw, dtype=np.uint8).reshape((proxy_h, proxy_w, 3))

            detector.setInputSize((proxy_w, proxy_h))
            _, faces = detector.detect(frame)
            detections = []
            if faces is not None:
                for item in faces:
                    x, y, w, h = [float(v) for v in item[:4]]
                    box = (
                        clamp(x, 0, proxy_w - 2),
                        clamp(y, 0, proxy_h - 2),
                        clamp(w, 2, proxy_w),
                        clamp(h, 2, proxy_h),
                    )
                    if box[2] * box[3] < proxy_w * proxy_h * 0.001:
                        continue
                    detections.append((box, crop_face_for_asd(frame, box)))

            if detections:
                face_frames += 1
            if len(detections) >= 2:
                multi_face_frames += 1

            matches, det_used, track_used = associate_tracks(tracks, detections, max_missed)
            for det_i, track_id in matches:
                box, face = detections[det_i]
                tracks[track_id].add(frame_idx, box, face)

            for det_i, (box, face) in enumerate(detections):
                if det_i in det_used:
                    continue
                track = FaceTrack(
                    track_id=next_track_id,
                    first_frame=frame_idx,
                    last_frame=frame_idx,
                    last_box=box,
                )
                track.add(frame_idx, box, face)
                tracks[next_track_id] = track
                next_track_id += 1

            for track_id, track in list(tracks.items()):
                if track_id not in track_used and frame_idx not in track.boxes:
                    track.missed += 1

            frame_idx += 1
            if frame_idx == 1 or frame_idx == total_frames or frame_idx % 25 == 0:
                elapsed = max(0.001, time.time() - started)
                fps_proc = frame_idx / elapsed
                remaining = max(0, total_frames - frame_idx)
                # Detection/tracking is first ~55% of vision phase.
                phase_pct = min(55.0, 55.0 * frame_idx / max(1, total_frames))
                emit({
                    "type": "progress",
                    "stage": "tracking",
                    "current": frame_idx,
                    "total": total_frames,
                    "phase_pct": round(phase_pct, 2),
                    "eta_seconds": round(remaining / max(0.01, fps_proc), 1),
                })

        if process.stdout:
            process.stdout.close()
        stderr = process.stderr.read().decode("utf-8", "ignore") if process.stderr else ""
        code = process.wait(timeout=30)
        if code != 0:
            raise RuntimeError(f"ffmpeg vision decode falhou ({code}): {stderr[-900:]}")
    finally:
        if process.poll() is None:
            process.kill()

    # Keep plausible tracks only.
    candidates = [
        track for track in tracks.values()
        if (track.last_frame - track.first_frame + 1) >= 10
        and len(track.faces) >= 8
    ]
    candidates.sort(key=lambda t: t.first_frame)

    for idx, track in enumerate(candidates):
        score_track_neural(engine, track, mfcc)
        emit({
            "type": "progress",
            "stage": "asd",
            "current": idx + 1,
            "total": max(1, len(candidates)),
            "phase_pct": round(55.0 + 35.0 * (idx + 1) / max(1, len(candidates)), 2),
            "eta_seconds": None,
        })

    by_frame = defaultdict(list)
    for track in candidates:
        for frame_no, box in track.boxes.items():
            score = track.scores.get(frame_no)
            if score is not None:
                by_frame[frame_no].append((track.track_id, score, box))

    # Editorial camera planner at user-requested sample FPS.
    output_step = max(1, int(round(VISION_FPS / clamp(args.sample_fps, 2.0, 8.0))))
    camera = []
    active_id = None
    active_since = -9999
    challenger_id = None
    challenger_count = 0
    speaker_switches = 0
    neural_speaker_samples = 0
    score_sum = 0.0
    score_count = 0
    smoothed = np.array([0.5, 0.43], dtype=np.float64)

    min_hold_frames = int(round(0.70 * VISION_FPS))
    switch_confirm_samples = max(2, int(round(0.32 * VISION_FPS / output_step)))

    for frame_no in range(0, frame_idx, output_step):
        visible = []
        # nearest scored frame within +/-2 frames for robustness.
        for delta in (0, -1, 1, -2, 2):
            if frame_no + delta in by_frame:
                visible = by_frame[frame_no + delta]
                break
        ranked = sorted(visible, key=lambda item: item[1], reverse=True)

        current_entry = next((v for v in ranked if v[0] == active_id), None)
        best = ranked[0] if ranked else None

        if active_id is None and best is not None and best[1] >= 0.46:
            active_id = best[0]
            active_since = frame_no
        elif best is not None and best[0] != active_id:
            current_score = current_entry[1] if current_entry else 0.0
            enough_hold = frame_no - active_since >= min_hold_frames
            strong_switch = best[1] >= max(0.58, current_score + 0.12)
            current_gone = current_entry is None and best[1] >= 0.55
            if (enough_hold and strong_switch) or current_gone:
                if challenger_id == best[0]:
                    challenger_count += 1
                else:
                    challenger_id = best[0]
                    challenger_count = 1
                if challenger_count >= switch_confirm_samples:
                    if active_id != best[0]:
                        speaker_switches += 1
                    active_id = best[0]
                    active_since = frame_no
                    challenger_id = None
                    challenger_count = 0
            else:
                challenger_id = None
                challenger_count = 0
        elif best is not None and best[0] == active_id:
            challenger_id = None
            challenger_count = 0

        active_entry = next((v for v in ranked if v[0] == active_id), None)
        mode = "center"
        confidence = 0.20
        target = np.array([0.5, 0.43], dtype=np.float64)

        if active_entry is not None and active_entry[1] >= 0.40:
            _, score, box = active_entry
            center = box_center(box) / np.array([proxy_w, proxy_h], dtype=np.float32)
            target = center.astype(np.float64)
            target[1] = clamp(target[1] - 0.055, 0.20, 0.70)
            mode = "speaker"
            confidence = float(score)
            neural_speaker_samples += 1
            score_sum += score
            score_count += 1
        elif len(ranked) >= 2:
            # Low-confidence overlap: frame the two best faces instead of guessing.
            c1 = box_center(ranked[0][2]) / np.array([proxy_w, proxy_h], dtype=np.float32)
            c2 = box_center(ranked[1][2]) / np.array([proxy_w, proxy_h], dtype=np.float32)
            if abs(c1[0] - c2[0]) < 0.35:
                target = ((c1 + c2) * 0.5).astype(np.float64)
                target[1] = clamp(target[1] - 0.04, 0.22, 0.68)
                mode = "group"
                confidence = float(max(ranked[0][1], ranked[1][1]))

        alpha = 0.48 if mode == "speaker" else 0.22
        # Faster editorial move on confirmed speaker switch, but still avoids an ugly hard snap.
        if camera and camera[-1].get("speaker_id") != active_id and mode == "speaker":
            alpha = 0.70
        smoothed = smoothed * (1.0 - alpha) + target * alpha
        smoothed[0] = clamp(smoothed[0], 0.08, 0.92)
        smoothed[1] = clamp(smoothed[1], 0.14, 0.86)

        camera.append({
            "time": round(frame_no / VISION_FPS, 3),
            "focus_x": round(float(smoothed[0]), 4),
            "focus_y": round(float(smoothed[1]), 4),
            "mode": mode,
            "speaker_id": int(active_id) if active_id is not None else None,
            "confidence": round(float(confidence), 4),
            "scene_change": False,
        })

    if not camera:
        camera = [{
            "time": 0.0, "focus_x": 0.5, "focus_y": 0.43,
            "mode": "center", "speaker_id": None, "confidence": 0.2,
            "scene_change": False,
        }]
    if camera[-1]["time"] < args.duration - 0.05:
        camera.append({**camera[-1], "time": round(args.duration, 3)})

    compressed = compress_camera(camera)
    stats = {
        "sampled_frames": frame_idx,
        "camera_keyframes": len(compressed),
        "face_frame_ratio": round(face_frames / max(1, frame_idx), 4),
        "multi_face_frame_ratio": round(multi_face_frames / max(1, frame_idx), 4),
        "tracks_detected": len(tracks),
        "asd_tracks_scored": len([t for t in candidates if t.scores]),
        "neural_speaker_samples": neural_speaker_samples,
        "speaker_switches": speaker_switches,
        "active_speaker_confidence_avg": round(score_sum / max(1, score_count), 4),
        "neural_coverage_ratio": round(neural_speaker_samples / max(1, len(camera)), 4),
    }
    result = {
        "version": 6,
        "editor": "ai_editor_v4_open_source",
        "vision_backend": "lr_asd_talkset_cpu_v1",
        "asd_model": "LR-ASD IJCV 2025 TalkSet",
        "asd_upstream": LR_ASD_UPSTREAM,
        "sample_fps": args.sample_fps,
        "source_width": width,
        "source_height": height,
        "source_fps": source_fps,
        "duration_seconds": args.duration,
        "camera": compressed,
        "stats": stats,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False)

    emit({
        "type": "progress",
        "stage": "planner",
        "current": 1,
        "total": 1,
        "phase_pct": 100,
        "eta_seconds": 0,
    })
    emit({
        "type": "result",
        "backend": result["vision_backend"],
        **stats,
    })


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input")
    parser.add_argument("--model")
    parser.add_argument("--output")
    parser.add_argument("--start", type=float, default=0.0)
    parser.add_argument("--duration", type=float, default=0.0)
    parser.add_argument("--sample-fps", type=float, default=6.0)
    parser.add_argument(
        "--weights",
        default=os.environ.get("V4_LR_ASD_WEIGHTS", "/app/vision/lrasd_talkset.model"),
    )
    parser.add_argument("--torch-threads", type=int, default=int(os.environ.get("V4_ASD_THREADS", "2")))
    parser.add_argument("--proxy-max-side", type=int, default=int(os.environ.get("V4_ASD_PROXY_MAX_SIDE", "640")))
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        self_test(args.weights)
        return

    for required in ("input", "model", "output"):
        if not getattr(args, required):
            parser.error(f"--{required} is required")
    if args.duration <= 0:
        parser.error("--duration must be > 0")

    run(args)


if __name__ == "__main__":
    main()
