# AdBrief Clip Network worker
# FFmpeg continua responsavel por download/probe/audio/base clip.
# Remotion renderiza a camada visual das variantes com legenda.
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    CLIP_TMP_DIR=/data/tmp

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates python3 python3-pip \
      fonts-dejavu-core fonts-urw-base35 fonts-inter fonts-noto-color-emoji fontconfig libgomp1 \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 \
      libxrandr2 libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 \
      libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
 && python3 -m pip install --no-cache-dir --break-system-packages --upgrade pip setuptools wheel \
 && python3 -m pip install --no-cache-dir --break-system-packages \
      "yt-dlp>=2025.1.1" "numpy==1.26.4" "opencv-python-headless==4.10.0.84" \
      "filelock>=3.13" "typing-extensions==4.15.0" "sympy>=1.13.3" \
      "networkx>=2.5.1" "jinja2>=3.1" "fsspec>=2024.1" \
 && python3 -m pip install --no-cache-dir --break-system-packages --no-deps \
      "torch==2.7.1" --index-url https://download.pytorch.org/whl/cpu \
 && rm -rf /var/lib/apt/lists/* \
 && fc-cache -f

WORKDIR /app

RUN mkdir -p /app/vision \
 && python3 -c "import urllib.request; urllib.request.urlretrieve('https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx?download=true', '/app/vision/yunet.onnx'); import hashlib, pathlib; p=pathlib.Path('/app/vision/yunet.onnx'); d=p.read_bytes(); assert len(d)>200000, f'YuNet invalido: {len(d)} bytes'; assert hashlib.sha256(d).hexdigest()=='8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4', 'SHA256 YuNet invalido'"

# LR-ASD TalkSet checkpoint pinned to an immutable upstream commit (MIT repository).
RUN python3 -c "import urllib.request, pathlib; u='https://raw.githubusercontent.com/Junhua-Liao/LR-ASD/1b6dcd2d8fc2895683de6508ec6294ec47d388ca/weight/finetuning_TalkSet.model'; p=pathlib.Path('/app/vision/lrasd_talkset.model'); urllib.request.urlretrieve(u, p); assert p.stat().st_size == 3426337, f'LR-ASD weight size invalido: {p.stat().st_size}'"

# Lightweight 8-class facial emotion model (FER+, ONNX Model Zoo).
RUN python3 -c "import urllib.request, pathlib, hashlib; u='https://huggingface.co/onnxmodelzoo/emotion-ferplus-8/resolve/4d016bfebdb4122b1f37511c5a9d40b5c87054a8/emotion-ferplus-8.onnx?download=true'; p=pathlib.Path('/app/vision/emotion-ferplus-8.onnx'); urllib.request.urlretrieve(u,p); d=p.read_bytes(); assert len(d)>30000000, f'FER+ invalido: {len(d)} bytes'; assert hashlib.sha256(d).hexdigest()=='a2a2ba6a335a3b29c21acb6272f962bd3d47f84952aaffa03b60986e04efa61c', 'SHA256 FER+ invalido'"

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Baixa o Chrome Headless Shell recomendado pelo Remotion durante o build.
RUN node -e "import('@remotion/renderer').then(async ({ensureBrowser}) => { await ensureBrowser({logLevel:'warn'}); })"

COPY index.mjs mediaResolver.mjs gateway.mjs ./
COPY render ./render
COPY vision ./vision
RUN python3 -m py_compile /app/vision/ai_editor_v4.py /app/vision/ai_editor_v5.py /app/vision/ai_editor_v6_lrasd.py /app/vision/multimodal_analyzer_light.py
RUN python3 /app/vision/ai_editor_v6_lrasd.py --self-test --weights /app/vision/lrasd_talkset.model
RUN python3 /app/vision/multimodal_analyzer_light.py --self-test --input /dev/null --yunet /app/vision/yunet.onnx --emotion-model /app/vision/emotion-ferplus-8.onnx
COPY remotion ./remotion

RUN mkdir -p /data/tmp

CMD ["node", "index.mjs"]
