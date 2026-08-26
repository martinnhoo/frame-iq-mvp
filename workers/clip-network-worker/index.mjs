/**
 * AdBrief Clip Network â€” worker da mÃ¡quina de cortes.
 *
 * Um vÃ­deo por vez, do comeÃ§o ao fim, sem clique humano:
 *
 *   descoberto â†’ baixando â†’ transcrevendo â†’ analisando â†’ renderizando â†’ concluÃ­do
 *
 * DivisÃ£o de responsabilidade (mudou de propÃ³sito):
 * - Fly: yt-dlp, ffmpeg, disco temporÃ¡rio. Nada mais.
 * - Lovable/Supabase: banco, storage privilegiado e IA (Gemini), atrÃ¡s da edge
 *   function clip-worker-gateway.
 * O worker conhece apenas SUPABASE_URL e CLIP_WORKER_SECRET â€” nem service role
 * nem chave de IA existem nesta mÃ¡quina.
 *
 * Regras que o cÃ³digo respeita e que nÃ£o sÃ£o negociÃ¡veis:
 * - SÃ³ processa vÃ­deo cuja FONTE estÃ¡ marcada como autorizada (rights_confirmed).
 * - O master vive apenas no filesystem temporÃ¡rio do worker e Ã© apagado no fim.
 * - Nada Ã© publicado em rede social aqui. Autopilot nesta fase significa
 *   "deixar os cortes prontos sozinho".
 * - O bucket Ã© privado: o worker grava o caminho, nÃ£o uma URL pÃºblica.
 * - IdempotÃªncia: candidato tem dedupe_key, vÃ­deo concluÃ­do nÃ£o volta para a
 *   fila, e o lock com lease permite recuperar job abandonado.
 */
import { spawn } from "node:child_process";
import { hostname } from "node:os";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveMedia, probeDuration, MediaResolverError } from "./mediaResolver.mjs";
import { call, storageShim, uploadBytes } from "./gateway.mjs";
import { normalizeRenderSettings, revisionStoragePath } from "./render/config.mjs";
import { writeAssCaptions } from "./render/captions.mjs";
import { buildAudioFilter, buildVideoFilter } from "./render/filters.mjs";

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
process.on("SIGTERM", () => { shuttingDown = true; log("SIGTERM: encerrando apÃ³s o job atual"); });
process.on("SIGINT", () => { shuttingDown = true; });

function run(bin, args, { timeoutMs = 45 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`${bin} excedeu o tempo limite`)); }, timeoutMs);
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${bin} saiu com ${code}: ${stderr.slice(-1500)}`));
    });
  });
}

const updateVideo = (videoId, patch) => call("update_video", { video_id: videoId, patch });
const updateRevision = (revisionId, patch) => call("update_revision", { revision_id: revisionId, patch });

// â”€â”€ Estado do pipeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function setStage(videoId, stage, detail) {
  await call("touch_lease", {
    video_id: videoId, worker_id: WORKER_ID,
    stage, detail: detail ?? null, lease_secs: LEASE_SECS,
  });
}

/** Heartbeat: renova o lease a 1/3 do tempo para o reaper nÃ£o roubar o job em curso. */
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

// â”€â”€ TranscriÃ§Ã£o (Gemini, via gateway) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function transcribe(input, dir) {
  const audioDir = join(dir, "audio");

  await mkdir(audioDir, {
    recursive: true,
  });

  await run("ffmpeg", [
    "-y",
    "-i", input,
    "-vn",
    "-ac", "1",
    "-ar", "16000",
    "-b:a", "32k",
    "-f", "segment",
    "-segment_time", "600",
    "-reset_timestamps", "1",
    join(audioDir,"chunk_%03d.mp3"),
  ]);

  const files = (
    await readdir(audioDir)
  )
    .filter(file => file.endsWith(".mp3"))
    .sort();

  if (!files.length) {
    throw new Error(
      "Nenhum áudio extraído do master"
    );
  }

  let offset = 0;

  const segments = [];
  const words = [];
  const textParts = [];

  for (const file of files) {
    const chunkPath =
      join(audioDir,file);

    // Fundamental para não acumular drift entre chunks:
    // o offset é a duração REAL do arquivo, não o fim
    // da última palavra falada.
    const chunkDuration =
      await probeDuration(chunkPath);

    const buf =
      await readFile(chunkPath);

    const result =
      await call(
        "transcribe_chunk",
        {
          audio_base64:
            buf.toString("base64"),

          mime_type:
            "audio/mpeg",
        },
        {
          timeoutMs: 300_000,
        },
      );

    for (
      const segment of result.segments || []
    ) {
      segments.push({
        start:
          Number(segment.start || 0) +
          offset,

        end:
          Number(segment.end || 0) +
          offset,

        text:
          String(segment.text || "")
            .trim(),
      });
    }

    for (
      const word of result.words || []
    ) {
      words.push({
        start:
          Number(word.start || 0) +
          offset,

        end:
          Number(word.end || 0) +
          offset,

        word:
          String(word.word || "")
            .trim(),
      });
    }

    if (result.text) {
      textParts.push(
        String(result.text).trim()
      );
    }

    offset +=
      Number(chunkDuration || 0);

    await rm(
      chunkPath,
      { force: true },
    );
  }

  const text =
    textParts.length
      ? textParts.join(" ").trim()
      : segments
          .map(segment => segment.text)
          .join(" ")
          .trim();

  return {
    text,
    segments,
    words,
    duration: offset,
    timing_granularity:
      words.length
        ? "word"
        : "segment",
  };
}

// ── Render ──────────────────────────────────────────────────

function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), x = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(x).padStart(3, "0")}`;
}

// Legenda estilo Reels/Shorts: blocos curtos, no mÃ¡ximo 2 linhas, sem custo de IA.
const CAPTION_TARGET_WORDS = 4;   // alvo por bloco
const CAPTION_MAX_WORDS = 5;      // teto duro por bloco
const CAPTION_MAX_LINE_CHARS = 24; // largura confortÃ¡vel no 1080x1920

/** Limpa espaÃ§os/quebras que vÃªm da transcriÃ§Ã£o sem tocar na pontuaÃ§Ã£o. */
function normalizeCaptionText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

/** Quebra por frases/pausas primeiro: pontuaÃ§Ã£o manda mais que contagem de palavras. */
function splitBySentences(text) {
  return text
    .split(/(?<=[.!?â€¦]|[,;:])\s+/)
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
      // Sobraria uma palavra solta no prÃ³ximo bloco? Puxa uma para trÃ¡s.
      if (words.length - (i + take) === 1 && take > 1) take -= 1;
      chunks.push(words.slice(i, i + take));
      i += take;
    }
  }
  return chunks;
}

/** No mÃ¡ximo 2 linhas, balanceadas para nÃ£o deixar uma palavra sozinha embaixo. */
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

/** Reparte o tempo do segmento entre os blocos proporcionalmente Ã s palavras, sem gap/overlap. */
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

async function probeMedia(file) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate:format=duration", "-of", "json", file], { timeoutMs: 60_000 });
  const parsed = JSON.parse(stdout || "{}");
  const video = (parsed.streams || []).find((stream) => stream.codec_type === "video");
  const rate = String(video?.r_frame_rate || "30/1").split("/").map(Number);
  const fps = rate[1] ? rate[0] / rate[1] : rate[0];
  return {
    width: Number(video?.width || 0), height: Number(video?.height || 0),
    fps: Number.isFinite(fps) && fps > 0 && fps <= 120 ? fps : 30,
    duration: Number(parsed.format?.duration || 0), hasVideo: Boolean(video),
    hasAudio: (parsed.streams || []).some((stream) => stream.codec_type === "audio"),
  };
}

async function detectConservativeEdges(master, start, end, hasAudio) {
  if (!hasAudio || end - start < 2) return { start, end };
  try {
    const { stderr } = await run("ffmpeg", ["-hide_banner", "-ss", String(start), "-i", master, "-t", String(end - start), "-af", "silencedetect=noise=-42dB:d=0.18", "-f", "null", "-"], { timeoutMs: 120_000 });
    const starts = [...stderr.matchAll(/silence_start:\s*([0-9.]+)/g)].map((match) => Number(match[1]));
    const ends = [...stderr.matchAll(/silence_end:\s*([0-9.]+)/g)].map((match) => Number(match[1]));
    const leading = starts[0] <= 0.05 && ends.length ? Math.min(0.75, ends[0]) : 0;
    const trailingStart = starts.at(-1);
    const trailing = Number.isFinite(trailingStart) && trailingStart > (end - start) - 1.5
      ? Math.min(0.75, end - start - trailingStart) : 0;
    return { start: start + Math.max(0, leading), end: end - Math.max(0, trailing) };
  } catch (error) {
    log("análise conservadora de silêncio ignorada", error?.message || error);
    return { start, end };
  }
}

async function renderRevision(master, clip, variant, revision, transcript, dir, sourceMeta, effectiveBounds) {
  const settings = normalizeRenderSettings(variant.variant_key, revision.parameters, clip);
  settings.startSeconds = effectiveBounds?.start ?? settings.startSeconds;
  settings.endSeconds = effectiveBounds?.end ?? settings.endSeconds;
  const duration = settings.endSeconds - settings.startSeconds;
  if (duration <= 0) throw new Error("Janela de render inválida");

  const out = join(dir, `${revision.id}.mp4`);
  const ass = settings.captions.enabled ? join(dir, `${revision.id}.ass`) : null;
  if (ass) await writeAssCaptions(transcript, settings, ass);
  const filter = buildVideoFilter({ variantKey: variant.variant_key, settings, assPath: ass, fps: sourceMeta.fps, source: sourceMeta });
  const args = ["-y", "-ss", String(settings.startSeconds), "-i", master, "-t", String(duration),
    "-filter_complex", filter, "-map", "[v]", "-map", "0:a?",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k"];
  if (sourceMeta.hasAudio) args.push("-af", buildAudioFilter(duration));
  args.push("-movflags", "+faststart", out);
  await run("ffmpeg", args);

  const output = await probeMedia(out);
  if (!output.hasVideo || output.width !== 1080 || output.height !== 1920 || output.duration <= 0) {
    throw new Error(`MP4 inválido: ${output.width}x${output.height}, duração ${output.duration || 0}`);
  }
  if (sourceMeta.hasAudio && !output.hasAudio) throw new Error("MP4 inválido: faixa de áudio ausente");
  return { out, settings };
}

/**
 * Renderiza e sobe. O bucket Ã© privado de propÃ³sito: gravamos apenas o caminho
 * e o dashboard pede uma signed URL na hora de assistir/baixar. Persistir uma
 * URL assinada no banco criaria um link que expira e vira erro silencioso.
 */
async function renderAndUploadRevision(master, clip, variant, revision, transcript, dir, sourceMeta, effectiveBounds) {
  const label = `${variant.variant_key} v${revision.revision_number}`;
  log(`[clip ${clip.id}] rendering ${label}`);
  await updateRevision(revision.id, {
    render_status: "rendering", locked_by: WORKER_ID,
    lease_expires_at: new Date(Date.now() + LEASE_SECS * 1000).toISOString(),
    render_attempts: Number(revision.render_attempts || 0) + 1,
  });
  try {
    const { out, settings } = await renderRevision(master, clip, variant, revision, transcript, dir, sourceMeta, effectiveBounds);
    const path = revisionStoragePath(clip.user_id, clip.id, variant.variant_key, revision.revision_number);
    await uploadBytes(path, await readFile(out), "video/mp4");
    const parameters = {
      ...(revision.parameters || {}),
      start_seconds: Number(revision.parameters?.start_seconds ?? clip.start_seconds),
      end_seconds: Number(revision.parameters?.end_seconds ?? clip.end_seconds),
      effective_start_seconds: settings.startSeconds,
      effective_end_seconds: settings.endSeconds,
      captions: settings.captions, framing: settings.framing, audio: settings.audio,
    };
    const response = await updateRevision(revision.id, {
      render_status: "ready", rendered_storage_path: path, rendered_url: null,
      parameters, last_error: null, locked_by: null, lease_expires_at: null,
    });
    await rm(out, { force: true });
    log(`[clip ${clip.id}] ${label} ready`);
    return { ok: true, clipRenderStatus: response.clip_render_status };
  } catch (error) {
    await updateRevision(revision.id, {
      render_status: "error", last_error: String(error?.message || error).slice(0, 1500),
      locked_by: null, lease_expires_at: null,
    });
    log(`[clip ${clip.id}] ${label} failed`, error?.message || error);
    return { ok: false };
  }
}

// â”€â”€ Job completo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function failJob(job, error) {
  const retryable = !(error instanceof MediaResolverError) || error.retryable !== false;
  const message = String(error?.message || error);

  if (!retryable) {
    try {
      await updateVideo(job.id, {
        pipeline_stage: "blocked",
        media_status: "blocked",
        stage_detail: error?.code === "source_too_short"
          ? "fonte curta ignorada"
          : "fonte bloqueada: erro nÃ£o retentÃ¡vel",
        last_error: message.slice(0, 2000),
        locked_by: null,
        locked_at: null,
        lease_expires_at: null,
        next_retry_at: null,
        processing_finished_at: nowIso(),
      });
    } catch (updateError) {
      log("nÃ£o consegui registrar o bloqueio terminal", updateError?.message);
      await call("fail_job", {
        video_id: job.id,
        attempts: Number(job.attempts || 0),
        retryable,
        error: message,
      }).catch((e) => log("nÃ£o consegui registrar a falha", e?.message));
    }
  } else {
    await call("fail_job", {
      video_id: job.id, attempts: Number(job.attempts || 0),
      retryable, error: message,
    }).catch((e) => log("nÃ£o consegui registrar a falha", e?.message));
  }

  log("job falhou", job.id, message);
}

async function processJob(job) {
  let stage = "downloading";
  const stopHeartbeat = startHeartbeat(job.id, () => stage);
  await mkdir(TMP_ROOT, { recursive: true });
  const dir = await mkdtemp(join(TMP_ROOT, "clip-"));
  try {
    const ctx = await call("context", { source_id: job.source_id });

    // 1. MÃ­dia
    const { path: master, strategy } = await resolveMedia({
      video: job, source: ctx.source, dir, supabase: storageShim, bucket: BUCKET,
      onProgress: (detail) => setStage(job.id, "downloading", detail),
    });
    const duration = await probeDuration(master);
    await updateVideo(job.id, {
      media_status: "processing", duration_seconds: duration,
      stage_detail: `master obtido via ${strategy}`,
    });

    // 2. TranscriÃ§Ã£o â€” reaproveitada se jÃ¡ existe (retry nÃ£o repaga a IA).
    stage = "transcribing";
    let transcript = job.transcript;
    if (!transcript?.segments?.length) {
      await setStage(job.id, "transcribing", "transcrevendo Ã¡udio");
      transcript = await transcribe(master, dir);
      await updateVideo(job.id, {
        transcript, transcript_status: "ready",
        duration_seconds: duration || transcript.duration,
      });
    }

    // 3. SeleÃ§Ã£o editorial + 4. autopilot â€” ambos no gateway, onde a chave de
    // IA e a service role moram.
    stage = "analyzing";
    await setStage(job.id, "analyzing", "IA escolhendo os melhores momentos");
    const { clips = [], approved = [], variants = [], revisions = [] } = await call("analyze_and_save", { job, transcript }, { timeoutMs: 300_000 });

    // 5. Render dos aprovados, usando o master que jÃ¡ estÃ¡ em disco.
    const approvedClips = [...new Map(
      [...clips.filter((c) => c.status === "approved"), ...approved].map((clip) => [clip.id, clip]),
    ).values()];
    const approvedIds = new Set(approvedClips.map((clip) => clip.id));
    const clipById = new Map(approvedClips.map((clip) => [clip.id, clip]));
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));
    const toRender = revisions.filter((revision) => approvedIds.has(revision.clip_id)
      && ["pending", "error"].includes(revision.render_status)
      && Number(revision.render_attempts || 0) < 4);
    stage = "rendering";
    let rendered = 0;
    const sourceMeta = await probeMedia(master);
    const boundsByClip = new Map();
    for (const [i, revision] of toRender.entries()) {
      if (shuttingDown) break;
      const clip = clipById.get(revision.clip_id);
      const variant = variantById.get(revision.clip_variant_id);
      if (!clip || !variant) continue;
      await setStage(job.id, "rendering", `renderizando variante ${i + 1}/${toRender.length}`);
      const baseSettings = normalizeRenderSettings(variant.variant_key, revision.parameters, clip);
      const boundsKey = `${clip.id}:${baseSettings.startSeconds}:${baseSettings.endSeconds}`;
      if (!boundsByClip.has(boundsKey)) {
        boundsByClip.set(boundsKey, await detectConservativeEdges(master, baseSettings.startSeconds, baseSettings.endSeconds, sourceMeta.hasAudio));
      }
      const result = await renderAndUploadRevision(master, clip, variant, revision, transcript, dir, sourceMeta, boundsByClip.get(boundsKey));
      if (result.ok) rendered += 1;
    }

    if (toRender.length > 0 && rendered === 0) {
      throw new Error(`Todas as ${toRender.length} variantes aprovadas falharam no render`);
    }

    await call("finish_job", {
      video_id: job.id,
      clips_generated: rendered,
      candidates_count: clips.length,
      approved_count: approvedClips.length,
    });
    log(`concluÃ­do "${job.title}": ${clips.length} candidatos, ${rendered} variantes renderizadas`);
  } catch (e) {
    await failJob(job, e);
  } finally {
    stopHeartbeat();
    // O master nunca sobrevive ao job.
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Backlog de aprovaÃ§Ã£o manual (modo revisÃ£o). Precisa reobter o master, entÃ£o
 * roda sÃ³ quando nÃ£o hÃ¡ vÃ­deo novo na fila.
 */
async function processApprovedBacklog() {
  const { clip, variants = [], revisions = [], video, source } = await call("next_render_backlog");
  if (!clip) return false;

  await mkdir(TMP_ROOT, { recursive: true });
  const dir = await mkdtemp(join(TMP_ROOT, "clip-render-"));
  try {
    const { path: master } = await resolveMedia({
      video,
      source,
      dir,
      supabase: storageShim,
      bucket: BUCKET,
    });

    const sourceMeta =
      await probeMedia(master);

    let transcript =
      video.transcript || {};

    // Clips aprovados antes desta atualização só possuem
    // timestamps por segmento. Reprocessa a transcrição uma
    // única vez para ganhar timing real por palavra.
    if (!transcript?.words?.length) {
      log(
        `[clip ${clip.id}] atualizando transcrição para word-level timing`
      );

      transcript =
        await transcribe(master,dir);

      await updateVideo(video.id,{
        transcript,
        transcript_status: "ready",
        stage_detail:
          "sincronização palavra por palavra concluída",
      });
    }

    const variantById =
      new Map(
        variants.map(
          variant => [variant.id,variant]
        )
      );
    let clipReady = false;
    const boundsByKey = new Map();
    for (const revision of revisions) {
      const variant = variantById.get(revision.clip_variant_id);
      if (!variant) continue;
      const settings = normalizeRenderSettings(variant.variant_key, revision.parameters, clip);
      const boundsKey = `${settings.startSeconds}:${settings.endSeconds}`;
      if (!boundsByKey.has(boundsKey)) boundsByKey.set(boundsKey, await detectConservativeEdges(master, settings.startSeconds, settings.endSeconds, sourceMeta.hasAudio));
      const result = await renderAndUploadRevision(
        master,
        clip,
        variant,
        revision,
        transcript,
        dir,
        sourceMeta,
        boundsByKey.get(boundsKey),
      );
      if (result.clipRenderStatus === "ready") clipReady = true;
    }
    if (clipReady) {
      // CompatÃ­vel tambÃ©m com a versÃ£o anterior do gateway: incrementa a
      // mÃ©trica apÃ³s aprovaÃ§Ã£o manual. O gateway novo reconta pelo banco.
      await call("finish_job", {
        video_id: video.id,
        clips_generated: Number(video.clips_generated || 0) + 1,
        candidates_count: 1,
        approved_count: 1,
      });
    }
    return true;
  } catch (e) {
    for (const revision of revisions) {
      if (["pending", "rendering"].includes(revision.render_status)) {
        await updateRevision(revision.id, { render_status: "error", last_error: String(e?.message || e).slice(0, 1500), locked_by: null, lease_expires_at: null }).catch(() => {});
      }
    }
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

      // Aprovações humanas têm prioridade:
      // renderiza primeiro o que o usuário acabou de aprovar.
      const renderedBacklog =
        await processApprovedBacklog();

      if (!renderedBacklog) {
        const job =
          await claimJob();

        if (job) {
          await processJob(job);
        }

        else if (RUN_ONCE) {
          break;
        }
      }
    } catch (e) {
      log("erro no laÃ§o", e?.message || e);
    }
    if (RUN_ONCE || shuttingDown) break;
    await new Promise((r) => setTimeout(r, POLL_MS));
  } while (true);
  log("worker encerrado");
}

log(`worker ${WORKER_ID} iniciado (IA e banco via gateway, bucket ${BUCKET}, ts ${nowIso()})`);
await loop();
