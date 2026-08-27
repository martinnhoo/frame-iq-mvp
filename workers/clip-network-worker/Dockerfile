# AdBrief Clip Network worker
# FFmpeg continua responsavel por download/probe/audio/base clip.
# Remotion renderiza a camada visual das variantes com legenda.
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    CLIP_TMP_DIR=/data/tmp

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates python3 python3-pip \
      fonts-dejavu-core fonts-urw-base35 fontconfig libgomp1 \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 \
      libxrandr2 libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 \
      libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
 && pip3 install --no-cache-dir --break-system-packages "yt-dlp>=2025.1.1" "numpy==1.26.4" "opencv-python-headless==4.10.0.84" \
 && rm -rf /var/lib/apt/lists/* \
 && fc-cache -f

WORKDIR /app

RUN mkdir -p /app/vision \
 && python3 -c "import urllib.request; urllib.request.urlretrieve('https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx?download=true', '/app/vision/yunet.onnx'); import hashlib, pathlib; p=pathlib.Path('/app/vision/yunet.onnx'); d=p.read_bytes(); assert len(d)>200000, f'YuNet invalido: {len(d)} bytes'; assert hashlib.sha256(d).hexdigest()=='8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4', 'SHA256 YuNet invalido'"

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Baixa o Chrome Headless Shell recomendado pelo Remotion durante o build.
RUN node -e "import('@remotion/renderer').then(async ({ensureBrowser}) => { await ensureBrowser({logLevel:'warn'}); })"

COPY index.mjs mediaResolver.mjs gateway.mjs ./
COPY render ./render
COPY vision ./vision
RUN python3 -m py_compile /app/vision/ai_editor_v4.py
COPY remotion ./remotion

RUN mkdir -p /data/tmp

CMD ["node", "index.mjs"]
