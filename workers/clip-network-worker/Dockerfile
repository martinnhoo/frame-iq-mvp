# Worker da máquina de cortes.
#
# yt-dlp vem do pip e não do apt: a versão do apt fica meses atrás, e a
# obtenção de mídia é justamente a parte que quebra quando a ferramenta está
# velha. ffmpeg/ffprobe vêm do apt porque não precisamos de codec exótico — só
# H.264, AAC, extração de áudio e o filtro de blur/subtitles.
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    CLIP_TMP_DIR=/data/tmp

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates python3 python3-pip \
      # Fontes para o filtro subtitles: sem elas o ffmpeg renderiza legenda
      # vazia e o corte sai sem texto, sem erro nenhum no log.
      fonts-dejavu-core fontconfig \
 && pip3 install --no-cache-dir --break-system-packages "yt-dlp>=2025.1.1" \
 && rm -rf /var/lib/apt/lists/* \
 && fc-cache -f

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY index.mjs mediaResolver.mjs gateway.mjs ./

# Volume do Fly. O master do vídeo vive aqui só durante o job e é apagado no
# final — nada persistente mora neste diretório.
RUN mkdir -p /data/tmp

# Sem porta exposta: o worker não atende requisição, só consome a fila do
# Postgres. Nada de fora fala com o processo que segura a service role key.
CMD ["node", "index.mjs"]
