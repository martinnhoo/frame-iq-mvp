# Worker do Creative Intelligence

Baixa as mídias dos anúncios importados, deduplica por conteúdo, guarda no
bucket e analisa os vídeos. Consome a fila que vive no Postgres.

Roda em dois lugares com o mesmo código — só mudam as variáveis de ambiente.

---

## Por que ele existe

FFmpeg, Whisper, OCR e clustering de rostos não rodam em nenhum lugar da stack
atual: Supabase Edge Functions é um isolate Deno sem binários nativos, e a
Vercel é serverless sem disco persistente. O módulo exige um processo longo com
disco, e é este.

## O que ele NÃO faz

Não atende requisição HTTP. Não tem porta aberta. Nada da internet fala com
ele — o que importa porque é o único componente que segura a
`SUPABASE_SERVICE_ROLE_KEY`, a chave que ignora RLS.

---

## Rodar local (Windows)

Serve para desenvolver e para processar sem gastar Fly. Exige o PC ligado.

```powershell
cd ci-worker
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# ffmpeg precisa estar no PATH:
winget install Gyan.FFmpeg

$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role>"
$env:CI_WORKER_ID = "windows-local"

python -m worker.main
```

Se `python -m worker.main` reclamar de import, rode a partir de `ci-worker/`,
não da raiz do repositório.

## Deploy no Fly.io

```bash
cd ci-worker
fly launch --no-deploy --copy-config --name adbrief-ci-worker
fly volumes create ci_worker_data --region gru --size 10

fly secrets set -a adbrief-ci-worker \
  SUPABASE_URL="https://<project-ref>.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<service-role>" \
  GEMINI_API_KEY="<chave>"

fly deploy
fly logs -a adbrief-ci-worker
```

O `fly.toml` pede `shared-cpu-2x` com 2 GB. Não desça para 1 GB: ffmpeg mais
whisper num vídeo de 60s estoura e o processo morre por OOM no meio do job —
que volta à fila e estoura de novo, em laço.

---

## Variáveis

| Variável | Padrão | Para quê |
|---|---|---|
| `SUPABASE_URL` | — | obrigatória |
| `SUPABASE_SERVICE_ROLE_KEY` | — | obrigatória; ignora RLS, nunca sai do worker |
| `CI_WORKER_ID` | `worker-<pid>` | aparece em `locked_by`, para saber quem pegou o job |
| `CI_WORKER_CONCURRENCY` | `2` | jobs simultâneos |
| `CI_LEASE_SECONDS` | `900` | precisa ser maior que o job mais longo |
| `CI_TMP_MAX_MB` | `4096` | acima disto o worker recusa job novo em vez de encher o disco |
| `CI_MAX_MEDIA_MB` | `500` | teto por arquivo |
| `CI_STORAGE_BACKEND` | `supabase` | ou `s3` para R2/B2 |
| `GEMINI_API_KEY` | — | sem ela, a análise semântica fica em modo degradado |

Lista completa no `.env.example` da raiz do repositório.

---

## Como a fila funciona

```
queued → running → completed
              ↘ failed → retrying → running
              ↘ blocked | cancelled
```

O worker chama `ci_claim_job()`, que faz `SELECT ... FOR UPDATE SKIP LOCKED`.
É o que permite N workers em paralelo sem dois pegarem o mesmo job: sem o
`SKIP LOCKED`, o segundo ficaria bloqueado esperando o primeiro.

Se a máquina morre no meio de um job, o `lease_expires_at` vence e
`ci_reap_stale_jobs()` devolve o job para `retrying` com backoff exponencial.
O worker chama o reaper a cada minuto, então não depende de cron externo.

Reiniciar o worker não perde nada: o estado inteiro está no Postgres.

---

## Deduplicação — e o que ela NÃO faz

Uma marca recicla a mesma peça em dezenas de anúncios com copy e público
diferentes. A chave é o **SHA-256 do conteúdo**, não a URL — o CDN da Meta
assina as URLs com token de expiração, então a mesma mídia aparece com
endereços diferentes a cada requisição.

Quando o hash já existe na marca, o worker vincula o asset existente ao novo
anúncio e pula upload e análise. Um vídeo usado por 40 anúncios é baixado,
armazenado e analisado uma vez.

**Mas SHA-256 só pega duplicata binária exata.** Não pega:

- o mesmo vídeo reencodado ou em outra resolução
- versão com legenda diferente ou bordas adicionadas
- 1 segundo de intro removido
- áudio levemente alterado

Isso é deliberado, e são duas camadas distintas que não devem se sobrepor:

| Camada | Ferramenta | Para quê |
|---|---|---|
| Duplicata exata | SHA-256 | não armazenar nem analisar o mesmo arquivo duas vezes |
| Similaridade criativa | hash perceptual, similaridade de keyframe e de transcript | agrupar versões do mesmo criativo **sem** tratá-las como o mesmo arquivo |

A segunda camada é a Fase 8 (conceitos e variações), não esta.

---

## Lease e heartbeat

O worker renova `lease_expires_at` a cada 1/3 do lease enquanto o job roda, e a
renovação é **condicionada a `locked_by` ainda ser este worker**.

As duas metades importam. Sem renovar, uma análise de 20 minutos com lease de 15
é devolvida à fila pelo reaper enquanto ainda está rodando, outro worker pega, e
os dois processam o mesmo asset — pagando Gemini duas vezes. Renovar sem a
condição é igualmente errado: se o reaper já devolveu o job e outro worker o
pegou, renovar roubaria o lease de volta e aí sim haveria dois donos.

Quando a renovação devolve zero linhas, o worker abandona o job sem escrever
nada — quem grava o resultado é quem tem o lease agora.

**A garantia é at-least-once, não exactly-once.** Qualquer etapa pode rodar de
novo após timeout, queda, erro de rede ou expiração de lease. Por isso as
escritas são upsert com constraint, e não insert cego.

---

## Testes

```bash
python ci-worker/tests/test_download.py
```

26 verificações contra um servidor HTTP e um MP4 reais (gerado com ffmpeg na
hora). Supabase e bucket são dublês — o objetivo é o comportamento do worker.

Cobre: SHA-256 durante o streaming, callback de progresso, recusa de corpo
vazio e de arquivo acima do teto, layout das chaves do bucket, criação do
asset, deduplicação completa (não sobe de novo, não analisa de novo, liga aos
dois anúncios), falha permanente vs. retry, e limpeza do temporário inclusive
quando o job falha.
