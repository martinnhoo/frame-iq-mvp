# Worker do Creative Intelligence.
#
# ffmpeg vem do apt em vez de build próprio: a imagem fica ~150 MB maior, mas o
# build cai de dezenas de minutos para segundos, e não precisamos de codec
# exótico nenhum — só H.264, AAC e extração de frame.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CI_TMP_DIR=/data/tmp

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Camada de dependências separada do código: mudar worker/*.py não reinstala
# tudo de novo.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY worker/ ./worker/

# Volume do Fly. Temporários de download vivem aqui e são apagados a cada job;
# o teto de CI_TMP_MAX_MB existe para o volume nunca encher.
RUN mkdir -p /data/tmp

# Sem porta exposta: o worker não atende requisição, só consome a fila do
# Postgres. Nada de fora fala com ele — e ele é quem segura a service role.
CMD ["python", "-m", "worker.main"]
