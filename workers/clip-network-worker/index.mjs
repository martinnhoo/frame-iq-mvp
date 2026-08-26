/**
 * AdBrief Clip Network — worker da máquina de cortes.
 *
 * Um vídeo por vez, do começo ao fim, sem clique humano:
 *
 *   descoberto → baixando → transcrevendo → analisando → renderizando → concluído
 *
 * Divisão de responsabilidade (mudou de propósito):
 * - Fly: yt-dlp, ffmpeg, disco temporário. Nada mais.
 * - Lovable/Supabase: banco, storage privilegiado e IA (Gemini), atrás da edge
 *   function clip-worker-gateway.
 * O worker conhece apenas SUPABASE_URL e CLIP_WORKER_SECRET — nem service role
 * nem chave de IA existem nesta máquina.
 *
 * Regras que o código respeita e que não são negociáveis:
 * - Só processa vídeo cuja FONTE está marcada como autorizada (rights_confirmed).
 * - O master vive apenas no filesystem temporário do worker e é apagado no fim.
 * - Nada é publicado em rede social aqui. Autopilot nesta fase significa
 *   "deixar os cortes prontos sozinho".
 * - O bucket é privado: o worker grava o caminho, não uma URL pública.
 * - Idempotência: candidato tem dedupe_key, vídeo concluído não volta para a
 *   fila, e o lock com lease permite recuperar job abandonado.
 */
import { spawn } from "node:child_process";
import { hostname } from "node:os";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveMedia, probeDuration, MediaResolverError } from "./mediaResolver.mjs";
import { call, storageShim, uploadBytes } from "./gateway.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const WORKER_SECRET = process.env.CLIP_WORKER_SECRET;
const BUCKET = process.env.CLIP_BUCKET || "clip-network";
const POLL_MS = Number(process.env.CLIP_WORKER_POLL_MS || 30000);
const LEASE_SECS = Number(process.env.CLIP_LEASE_SECONDS || 900);
const TMP_ROOT = process.env.CLIP_TMP_DIR || "/data/tmp";
const WORKER_ID = process.env.CLIP_WORKER_ID || `clip-worker-${hostname()}`;
const RUN_ONCE = process.env.RUN_ONCE === "1" || process.argv.includes("--once");

if (!SUPABASE_URL || !WORKER_SECRET) {
  throw new Error("Faltam SUPABASE_URL ou CLIP_WORKER_SECRET");
}

const log = (...a) => console.log(`[clip-worker ${new Date().toISOString()}]`, ...a);
const nowIso = () => new Date().toISOString();

let shuttingDown = false;
process.on("SIGTERM", () => { shuttingDown = true; log("SIGTERM: encerrando após o job atual"); });
process.on("SIGINT", () => { shuttingDown = true; });

function run(bin, args, { timeoutMs = 45 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`${bin} excedeu o tempo limite`)); }, timeoutMs);
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`${bin} saiu com ${code}: ${stderr.slice(-1500)}`));
    });
  });
}

const updateVideo = (videoId, patch) => call("update_video", { video_id: videoId, patch });
const updateClip = (clipId, patch) => call("update_clip", { clip_id: clipId, patch });

// ── Estado do pipeline ───────────────────────────────────────────────────────

async function setStage(videoId, stage, detail) {
  await call("touch_lease", {
    video_id: videoId, worker_id: WORKER_ID,
    stage, detail: detail ?? null, lease_secs: LEASE_SECS,
  });
}

/** Heartbeat: renova o lease a 1/3 do tempo para o reaper não roubar o job em curso. */
function startHeartbeat(videoId, getStage) {
  const interval = setInterval(() => {
    setStage(videoId, getStage(), null).catch((e) => log("heartbeat falhou", e?.message));
  }, Math.max(30_000, Math.floor(LEASE_SECS * 1000 / 3)));
  return () => clearInterval(interval);
}

async function claimJob() {
  const { job } = await call("claim", { worker_id: WORKER_ID, lease_secs: LEASE_SECS });
  return job || null;
}

// ── Transcrição (Gemini, via gateway) ────────────────────────────────────────

async function transcribe(input, dir) {
  const audioDir = join(dir, "audio");
  await mkdir(audioDir, { recursive: true });
  // Blocos de 10 min em mono 32k: o áudio viaja em base64 dentro do corpo da
  // requisição ao gateway, então o bloco precisa caber com folga no limite de
  // payload da edge function — e ainda assim cobre vídeo de horas.
  await run("ffmpeg", ["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k",
    "-f", "segment", "-segment_time", "600", "-reset_timestamps", "1", join(audioDir, "chunk_%03d.mp3")]);
  const files = (await readdir(audioDir)).filter((x) => x.endsWith(".mp3")).sort();
  if (!files.length) throw new Error("Nenhum áudio extraído do master");

  let offset = 0;
  const segments = [];
  for (const file of files) {
    const buf = await readFile(join(audioDir, file));
    const { segments: chunk = [] } = await call("transcribe_chunk", {
      audio_base64: buf.toString("base64"), mime_type: "audio/mpeg",
    }, { timeoutMs: 300_000 });
    for (const seg of chunk) {
      segments.push({
        start: Number(seg.start || 0) + offset,
        end: Number(seg.end || 0) + offset,
        text: String(seg.text || "").trim(),
      });
    }
    // O bloco tem no máximo 600s; usar o fim real evita empilhar erro de offset.
    offset += Math.max(Number(chunk.at(-1)?.end || 0), 0) || 600;
    await rm(join(audioDir, file), { force: true });
  }
  const text = segments.map((s) => s.text).join(" ").trim();
  return { text, segments, duration: segments.at(-1)?.end || offset };
}

// ── Render ───────────────────────────────────────────────────────────────────

function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), x = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(x).padStart(3, "0")}`;
}

// Legenda estilo Reels/Shorts: blocos curtos, no máximo 2 linhas, sem custo de IA.
const CAPTION_TARGET_WORDS = 4;   // alvo por bloco
const CAPTION_MAX_WORDS = 5;      // teto duro por bloco
const CAPTION_MAX_LINE_CHARS = 24; // largura confortável no 1080x1920

/** Limpa espaços/quebras que vêm da transcrição sem tocar na pontuação. */
function normalizeCaptionText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

/** Quebra por frases/pausas primeiro: pontuação manda mais que contagem de palavras. */
function splitBySentences(text) {
  return text
    .split(/(?<=[.!?…]|[,;:])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Agrupa palavras em blocos curtos, evitando bloco final com 1 palavra solta. */
function buildChunks(text) {
  const chunks = [];
  for (const phrase of splitBySentences(normalizeCaptionText(text))) {
    const words = phrase.split(" ").filter(Boolean);
    if (!words.length) continue;
    // Distribui de forma equilibrada em vez de encher e deixar sobra.
    const parts = Math.max(1, Math.ceil(words.length / CAPTION_TARGET_WORDS));
    const per = Math.min(CAPTION_MAX_WORDS, Math.ceil(words.length / parts));
    let i = 0;
    while (i < words.length) {
      let take = Math.min(per, words.length - i);
      // Sobraria uma palavra solta no próximo bloco? Puxa uma para trás.
      if (words.length - (i + take) === 1 && take > 1) take -= 1;
      chunks.push(words.slice(i, i + take));
      i += take;
    }
  }
  return chunks;
}

/** No máximo 2 linhas, balanceadas para não deixar uma palavra sozinha embaixo. */
function layoutLines(words) {
  const single = words.join(" ");
  if (single.length <= CAPTION_MAX_LINE_CHARS || words.length < 2) return single;
  let best = null;
  for (let cut = 1; cut < words.length; cut++) {
    const a = words.slice(0, cut).join(" ");
    const b = words.slice(cut).join(" ");
    const cost = Math.abs(a.length - b.length) + Math.max(0, a.length - CAPTION_MAX_LINE_CHARS) * 4
      + Math.max(0, b.length - CAPTION_MAX_LINE_CHARS) * 4;
    if (!best || cost < best.cost) best = { cost, text: `${a}\n${b}` };
  }
  return best.text;
}

/** Reparte o tempo do segmento entre os blocos proporcionalmente às palavras, sem gap/overlap. */
function chunkSegment(segment) {
  const chunks = buildChunks(segment.text);
  if (!chunks.length) return [];
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const segStart = Number(segment.start) || 0;
  const segEnd = Math.max(segStart, Number(segment.end) || segStart);
  const span = segEnd - segStart;
  const cues = [];
  let acc = 0;
  for (const chunk of chunks) {
    const from = segStart + (span * acc) / total;
    acc += chunk.length;
    const to = segStart + (span * acc) / total;
    cues.push({ start: from, end: to, text: layoutLines(chunk) });
  }
  return cues;
}

async function writeSrt(transcript, start, end, file) {
  const cues = (transcript?.segments || [])
    .filter((s) => s.end > start && s.start < end)
    .flatMap(chunkSegment)
    .filter((c) => c.end > start && c.start < end && c.text);
  const rows = cues
    .map((c, i) => `${i + 1}\n${srtTime(Math.max(0, c.start - start))} --> ${srtTime(Math.min(end - start, c.end - start))}\n${c.text}\n`)
    .join("\n");
  await writeFile(file, rows || "1\n00:00:00,000 --> 00:00:03,000\n \n");
}

async function renderClip(master, clip, transcript, dir) {
  const out = join(dir, `${clip.id}.mp4`);
  const srt = join(dir, `${clip.id}.srt`);
  const start = Number(clip.start_seconds);
  const duration = Number(clip.end_seconds) - start;
  await writeSrt(transcript, start, Number(clip.end_seconds), srt);
  const escapedSrt = srt.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
  const filter = `[0:v]split=2[bg0][fg0];[bg0]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2[bg];[fg0]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,subtitles='${escapedSrt}':force_style='FontName=DejaVu Sans,FontSize=15,Bold=1,Outline=1.4,Shadow=0.4,Alignment=2,MarginV=150,MarginL=80,MarginR=80'[v]`;

  await run("ffmpeg", ["-y", "-ss", String(start), "-i", master, "-t", String(duration),
    "-filter_complex", filter, "-map", "[v]", "-map", "0:a?",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out]);
  return out;
}

/**
 * Renderiza e sobe. O bucket é privado de propósito: gravamos apenas o caminho
 * e o dashboard pede uma signed URL na hora de assistir/baixar. Persistir uma
 * URL assinada no banco criaria um link que expira e vira erro silencioso.
 */
async function renderAndUpload(master, clip, transcript, dir) {
  await updateClip(clip.id, {
    render_status: "rendering", locked_by: WORKER_ID,
    lease_expires_at: new Date(Date.now() + LEASE_SECS * 1000).toISOString(),
    render_attempts: Number(clip.render_attempts || 0) + 1,
  });
  try {
    const rendered = await renderClip(master, clip, transcript, dir);
    const bytes = await readFile(rendered);
    const path = `${clip.user_id}/${clip.id}.mp4`;
    await uploadBytes(path, bytes, "video/mp4");
    await updateClip(clip.id, {
      render_status: "ready", rendered_storage_path: path, rendered_url: null,
      last_error: null, locked_by: null, lease_expires_at: null,
    });
    await rm(rendered, { force: true });
    return true;
  } catch (e) {
    await updateClip(clip.id, {
      render_status: "error", last_error: String(e?.message || e).slice(0, 1500),
      locked_by: null, lease_expires_at: null,
    });
    log("render falhou", clip.id, e?.message || e);
    return false;
  }
}

// ── Job completo ─────────────────────────────────────────────────────────────

async function failJob(job, error) {
  const retryable = !(error instanceof MediaResolverError) || error.retryable !== false;
  await call("fail_job", {
    video_id: job.id, attempts: Number(job.attempts || 0),
    retryable, error: String(error?.message || error),
  }).catch((e) => log("não consegui registrar a falha", e?.message));
  log("job falhou", job.id, error?.message || error);
}

async function processJob(job) {
  let stage = "downloading";
  const stopHeartbeat = startHeartbeat(job.id, () => stage);
  await mkdir(TMP_ROOT, { recursive: true });
  const dir = await mkdtemp(join(TMP_ROOT, "clip-"));
  try {
    const ctx = await call("context", { source_id: job.source_id });

    // 1. Mídia
    const { path: master, strategy } = await resolveMedia({
      video: job, source: ctx.source, dir, supabase: storageShim, bucket: BUCKET,
      onProgress: (detail) => setStage(job.id, "downloading", detail),
    });
    const duration = await probeDuration(master);
    await updateVideo(job.id, {
      media_status: "processing", duration_seconds: duration,
      stage_detail: `master obtido via ${strategy}`,
    });

    // 2. Transcrição — reaproveitada se já existe (retry não repaga a IA).
    stage = "transcribing";
    let transcript = job.transcript;
    if (!transcript?.segments?.length) {
      await setStage(job.id, "transcribing", "transcrevendo áudio");
      transcript = await transcribe(master, dir);
      await updateVideo(job.id, {
        transcript, transcript_status: "ready",
        duration_seconds: duration || transcript.duration,
      });
    }

    // 3. Seleção editorial + 4. autopilot — ambos no gateway, onde a chave de
    // IA e a service role moram.
    stage = "analyzing";
    await setStage(job.id, "analyzing", "IA escolhendo os melhores momentos");
    const { clips = [], approved = [] } = await call("analyze_and_save", { job, transcript }, { timeoutMs: 300_000 });

    // 5. Render dos aprovados, usando o master que já está em disco.
    const toRender = (approved.length ? approved : clips.filter((c) => c.status === "approved"))
      .filter((c) => c.render_status === "pending" || c.render_status === "error");
    stage = "rendering";
    let rendered = 0;
    for (const [i, clip] of toRender.entries()) {
      if (shuttingDown) break;
      await setStage(job.id, "rendering", `renderizando ${i + 1}/${toRender.length}`);
      if (await renderAndUpload(master, clip, transcript, dir)) rendered += 1;
    }

    await call("finish_job", { video_id: job.id, clips_generated: clips.length });
    log(`concluído "${job.title}": ${clips.length} candidatos, ${rendered} renderizados`);
  } catch (e) {
    await failJob(job, e);
  } finally {
    stopHeartbeat();
    // O master nunca sobrevive ao job.
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Backlog de aprovação manual (modo revisão). Precisa reobter o master, então
 * roda só quando não há vídeo novo na fila.
 */
async function processApprovedBacklog() {
  const { clip, video, source } = await call("next_render_backlog");
  if (!clip) return false;

  await mkdir(TMP_ROOT, { recursive: true });
  const dir = await mkdtemp(join(TMP_ROOT, "clip-render-"));
  try {
    const { path: master } = await resolveMedia({ video, source, dir, supabase: storageShim, bucket: BUCKET });
    await renderAndUpload(master, clip, video.transcript, dir);
    return true;
  } catch (e) {
    await updateClip(clip.id, {
      render_status: "error", last_error: String(e?.message || e).slice(0, 1500),
    });
    return true;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function loop() {
  do {
    try {
      const { recovered } = await call("recover_stuck");
      if (recovered) log(`recuperados ${recovered} job(s) abandonados`);

      const job = await claimJob();
      if (job) await processJob(job);
      else if (!(await processApprovedBacklog()) && RUN_ONCE) break;
    } catch (e) {
      log("erro no laço", e?.message || e);
    }
    if (RUN_ONCE || shuttingDown) break;
    await new Promise((r) => setTimeout(r, POLL_MS));
  } while (true);
  log("worker encerrado");
}

log(`worker ${WORKER_ID} iniciado (IA e banco via gateway, bucket ${BUCKET}, ts ${nowIso()})`);
await loop();
