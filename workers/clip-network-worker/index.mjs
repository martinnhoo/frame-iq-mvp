/**
 * AdBrief Clip Network Ã¢â‚¬â€ worker da mÃƒÂ¡quina de cortes.
 *
 * Um vÃƒÂ­deo por vez, do comeÃƒÂ§o ao fim, sem clique humano:
 *
 *   descoberto Ã¢â€ â€™ baixando Ã¢â€ â€™ transcrevendo Ã¢â€ â€™ analisando Ã¢â€ â€™ renderizando Ã¢â€ â€™ concluÃƒÂ­do
 *
 * DivisÃƒÂ£o de responsabilidade (mudou de propÃƒÂ³sito):
 * - Fly: yt-dlp, ffmpeg, disco temporÃƒÂ¡rio. Nada mais.
 * - Lovable/Supabase: banco, storage privilegiado e IA (Gemini), atrÃƒÂ¡s da edge
 *   function clip-worker-gateway.
 * O worker conhece apenas SUPABASE_URL e CLIP_WORKER_SECRET Ã¢â‚¬â€ nem service role
 * nem chave de IA existem nesta mÃƒÂ¡quina.
 *
 * Regras que o cÃƒÂ³digo respeita e que nÃƒÂ£o sÃƒÂ£o negociÃƒÂ¡veis:
 * - SÃƒÂ³ processa vÃƒÂ­deo cuja FONTE estÃƒÂ¡ marcada como autorizada (rights_confirmed).
 * - O master vive apenas no filesystem temporÃƒÂ¡rio do worker e ÃƒÂ© apagado no fim.
 * - Nada ÃƒÂ© publicado em rede social aqui. Autopilot nesta fase significa
 *   "deixar os cortes prontos sozinho".
 * - O bucket ÃƒÂ© privado: o worker grava o caminho, nÃƒÂ£o uma URL pÃƒÂºblica.
 * - IdempotÃƒÂªncia: candidato tem dedupe_key, vÃƒÂ­deo concluÃƒÂ­do nÃƒÂ£o volta para a
 *   fila, e o lock com lease permite recuperar job abandonado.
 */
import { spawn } from "node:child_process";
import { hostname } from "node:os";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { resolveMedia, probeDuration, MediaResolverError } from "./mediaResolver.mjs";
import { call, callFunction, storageShim, uploadBytes } from "./gateway.mjs";
import { normalizeRenderSettings, revisionStoragePath } from "./render/config.mjs";
import { buildRemotionCaptionPages } from "./render/captions.mjs";
import { buildAudioFilter, buildBaseVideoFilter } from "./render/filters.mjs";
import { renderCaptionedVideo, renderEditorialVideo } from "./render/remotionRenderer.mjs";
import { buildVisualPlan } from "./render/visualDirector.mjs";
import { renderEditorialV4 } from "./render/v4Renderer.mjs";
import { renderEditorialV5 } from "./render/v5Renderer.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const WORKER_SECRET = process.env.CLIP_WORKER_SECRET;
const BUCKET = process.env.CLIP_BUCKET || "clip-network";
const POLL_MS = Number(process.env.CLIP_WORKER_POLL_MS || 30000);
const IDLE_SHUTDOWN_MS = Number(process.env.CLIP_IDLE_SHUTDOWN_MS || 90000);
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
process.on("SIGTERM", () => { shuttingDown = true; log("SIGTERM: encerrando apÃƒÂ³s o job atual"); });
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

// Ã¢â€â‚¬Ã¢â€â‚¬ Estado do pipeline Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

async function setStage(videoId, stage, detail) {
  await call("touch_lease", {
    video_id: videoId, worker_id: WORKER_ID,
    stage, detail: detail ?? null, lease_secs: LEASE_SECS,
  });
}

/** Heartbeat: renova o lease a 1/3 do tempo para o reaper nÃƒÂ£o roubar o job em curso. */
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

// Ã¢â€â‚¬Ã¢â€â‚¬ TranscriÃƒÂ§ÃƒÂ£o (Gemini, via gateway) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

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
      "Nenhum Ã¡udio extraÃ­do do master"
    );
  }

  let offset = 0;

  const segments = [];
  const words = [];
  const textParts = [];

  for (const file of files) {
    const chunkPath =
      join(audioDir,file);

    // Fundamental para nÃ£o acumular drift entre chunks:
    // o offset Ã© a duraÃ§Ã£o REAL do arquivo, nÃ£o o fim
    // da Ãºltima palavra falada.
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

// â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    log("anÃ¡lise conservadora de silÃªncio ignorada", error?.message || error);
    return { start, end };
  }
}

async function prepareBaseClip(
  master,
  out,
  settings,
  sourceMeta,
) {
  const duration =
    settings.endSeconds -
    settings.startSeconds;

  const args = [
    "-y",
    "-ss", String(settings.startSeconds),
    "-i", master,
    "-t", String(duration),

    "-map", "0:v:0",
  ];

  if (sourceMeta.hasAudio) {
    args.push(
      "-map", "0:a:0?",
    );
  }

  args.push(
    "-vf", buildBaseVideoFilter(settings.editPlan),

    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
  );

  if (sourceMeta.hasAudio) {
    args.push(
      "-c:a", "aac",
      "-b:a", "128k",
    );

    if (settings.audio.normalize) {
      args.push(
        "-af",
        buildAudioFilter(duration),
      );
    }
  } else {
    args.push("-an");
  }

  args.push(
    "-movflags",
    "+faststart",
    out,
  );

  await run("ffmpeg", args);
}

async function renderRevision(
  master,
  clip,
  variant,
  revision,
  transcript,
  dir,
  sourceMeta,
  effectiveBounds,
) {
  let parameters = revision.parameters || {};

  if (variant.variant_key === "editorial_master") {
    try {
      parameters = await buildVisualPlan({
        run,
        callFunction,
        master,
        clip,
        revision,
        dir,
        sourceMeta,
        log,
      });
    } catch (error) {
      log(
        `[clip ${clip.id}] AI Editor v3 indisponivel; fallback v2:`,
        error?.message || error,
      );
    }
  }

  const settings = normalizeRenderSettings(
    variant.variant_key,
    parameters,
    clip,
  );

  if (variant.variant_key !== "editorial_master") {
    settings.startSeconds = effectiveBounds?.start ?? settings.startSeconds;
    settings.endSeconds = effectiveBounds?.end ?? settings.endSeconds;
  }

  const duration = settings.endSeconds - settings.startSeconds;
  if (duration <= 0) throw new Error("Janela de render invalida");

  const out = join(dir, `${revision.id}.mp4`);
  const base = join(dir, `${revision.id}-base.mp4`);

  try {
    await prepareBaseClip(master, base, settings, sourceMeta);

    const pages = settings.captions.enabled
      ? buildRemotionCaptionPages(
          transcript,
          settings.startSeconds,
          settings.endSeconds,
          settings.captions.text,
          settings.captions,
        )
      : [];

    if (variant.variant_key === "editorial_master") {
      await renderEditorialVideo({
        inputVideo: base,
        outputVideo: out,
        pages,
        durationSeconds: duration,
        captionSettings: settings.captions,
        editPlan: parameters || {},
      });
    } else if (settings.captions.enabled) {
      await renderCaptionedVideo({
        inputVideo: base,
        outputVideo: out,
        pages,
        durationSeconds: duration,
        captionSettings: settings.captions,
      });
    } else {
      await rm(out, { force: true });
      await prepareBaseClip(master, out, settings, sourceMeta);
    }
  } finally {
    await rm(base, { force: true });
  }

  const output = await probeMedia(out);

  if (
    !output.hasVideo ||
    output.width !== 1080 ||
    output.height !== 1920 ||
    output.duration <= 0
  ) {
    throw new Error(
      `MP4 invalido: ${output.width}x${output.height}, duracao ${output.duration || 0}`,
    );
  }

  if (sourceMeta.hasAudio && !output.hasAudio) {
    throw new Error("MP4 invalido: faixa de audio ausente");
  }

  return { out, settings, parameters };
}

/**
 * Renderiza e sobe. O bucket ÃƒÂ© privado de propÃƒÂ³sito: gravamos apenas o caminho
 * e o dashboard pede uma signed URL na hora de assistir/baixar. Persistir uma
 * URL assinada no banco criaria um link que expira e vira erro silencioso.
 */


// V5.1 clip-level speech quality: re-transcribe only the approved clip and generate a safe headline.
async function buildClipQualityV51({
  master,
  clip,
  revision,
  video,
  dir,
  report,
}) {
  const clipStart = Number(
    revision?.parameters?.start_seconds ?? clip.start_seconds,
  );
  const clipEnd = Number(
    revision?.parameters?.end_seconds ?? clip.end_seconds,
  );
  const clipDuration = clipEnd - clipStart;
  if (!(clipDuration > 0)) {
    throw new Error("V5.1: janela de transcricao invalida");
  }

  const audioPath = join(
    dir,
    `${revision.id}-clip-v51.mp3`,
  );

  await report({
    phase: "speech",
    phase_pct: 0,
    detail: "V5.1 retranscrevendo somente o corte aprovado",
  }, true);

  await run(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-ss", String(clipStart),
      "-i", master,
      "-t", String(clipDuration),
      "-vn",
      "-ac", "1",
      "-ar", "16000",
      "-b:a", "64k",
      audioPath,
    ],
    { timeoutMs: 3 * 60 * 1000 },
  );

  await report({
    phase: "speech",
    phase_pct: 20,
    detail: "Audio do corte pronto · transcricao + diarizacao",
  }, true);

  const audio = await readFile(audioPath);
  const quality = await callFunction(
    "clip-quality-v51",
    "transcribe",
    {
      audio_base64: audio.toString("base64"),
      mime_type: "audio/mpeg",
      language: "pt",
      context: [
        video?.title || "",
        clip?.transcript_excerpt || "",
        clip?.on_screen_title || "",
      ].filter(Boolean).join(" | ").slice(0, 900),
    },
    { timeoutMs: 2 * 60 * 1000 },
  );

  if (!Array.isArray(quality?.words) || quality.words.length < 2) {
    throw new Error("V5.1: transcricao do corte nao retornou palavras suficientes");
  }

  const transcript = {
    text: String(quality.text || ""),
    duration: clipDuration,
    source: "clip_quality_v51",
    segments: (quality.segments || []).map((segment) => ({
      ...segment,
      start: Number(segment.start || 0) + clipStart,
      end: Number(segment.end || 0) + clipStart,
    })),
    words: quality.words.map((word) => ({
      word: String(word.word || "").trim(),
      start: Number(word.start || 0) + clipStart,
      end: Number(word.end || 0) + clipStart,
      speaker_id:
        word.speaker_id === undefined
          ? null
          : word.speaker_id,
    })).filter((word) => word.word && word.end > word.start),
  };

  await report({
    phase: "speech",
    phase_pct: 72,
    detail:
      `V5.1 ${transcript.words.length} palavras · ${Number(quality.speaker_count || 0)} speakers`,
  }, true);

  let headlineResult;
  try {
    headlineResult = await callFunction(
      "clip-headline-v511",
      "headline",
      {
        transcript: transcript.text,
        video_title: video?.title || "",
        original_title: clip?.on_screen_title || "",
      },
      { timeoutMs: 45 * 1000 },
    );
  } catch (error) {
    headlineResult = {
      source: "disabled_headline_call_error",
      score: 0,
      error: String(error?.message || error).slice(0, 700),
      candidates: [],
      headline: {
        enabled: false,
        preset: "none",
        text: "",
        duration: 0,
      },
    };
  }

  const headline =
    headlineResult?.headline &&
    typeof headlineResult.headline === "object"
      ? headlineResult.headline
      : {
          enabled: false,
          preset: "none",
          text: "",
          duration: 0,
        };

  await report({
    phase: "speech",
    phase_pct: 100,
    detail:
      headline.enabled
        ? `Transcricao pronta · headline ${headline.preset}`
        : "Transcricao pronta · headline desativada pelo QA",
  }, true);

  return {
    transcript,
    transcriptionMeta: {
      version: "5.1",
      backend: quality.backend || "unknown",
      fallback_used: Boolean(quality.fallback_used),
      diarization_error: quality.diarization_error || null,
      speaker_count: Number(quality.speaker_count || 0),
      word_count: transcript.words.length,
      attempts: quality.attempts || null,
    },
    headline,
    headlineMeta: {
      source: headlineResult?.source || "unknown",
      model: headlineResult?.model || null,
      score: Number(headlineResult?.score || 0),
      candidates: headlineResult?.candidates || [],
      rejected_old_title_copy:
        Boolean(headlineResult?.rejected_old_title_copy),
      error: headlineResult?.error || null,
      enabled: Boolean(headline.enabled),
      preset: headline.preset || "none",
      text: headline.text || "",
    },
  };
}

async function renderAndUploadV4Revision(
  clip,
  variant,
  revision,
  video,
  source,
  dir,
) {
  const startedAtMs = Date.now();
  const {
    v4_progress: _previousV4Progress,
    render_duration_ms: _previousRenderDurationMs,
    render_started_at: _previousRenderStartedAt,
    render_finished_at: _previousRenderFinishedAt,
    ...baseParameters
  } = revision.parameters || {};

  const attemptNumber =
    Number(revision.render_attempts || 0) + 1;
  const useV5 =
    String(process.env.CLIP_AI_EDITOR_VERSION || "4") === "5";

  let parameters = {
    ...baseParameters,
    editor: useV5
      ? "ai_editor_v5_semantic_multimodal"
      : "ai_editor_v4_open_source",
    editor_version: useV5 ? 5 : 4,
    renderer: useV5
      ? "ffmpeg_hardcut_v5"
      : "ffmpeg_one_pass_v4",
    render_attempt_number: attemptNumber,
  };

  let activePhase = null;
  let activePhaseStartedAt = null;
  const phaseTimings = {};
  let lastPersistAt = 0;
  let lastPersistPct = -1;

  const ranges = {
    planning: [0, 10],
    acquire: [10, 20],
    speech: [20, 30],
    vision: [30, 50],
    timeline: [50, 55],
    captions: [55, 60],
    render: [60, 95],
    qa: [95, 98],
    upload: [98, 100],
    done: [100, 100],
    error: [0, 0],
  };

  const closePhase = (phase, now) => {
    if (!phase || !activePhaseStartedAt) return;
    const existing = phaseTimings[phase] || {};
    phaseTimings[phase] = {
      ...existing,
      started_at:
        existing.started_at ||
        new Date(activePhaseStartedAt).toISOString(),
      finished_at: new Date(now).toISOString(),
      duration_ms:
        Number(existing.duration_ms || 0) +
        Math.max(0, now - activePhaseStartedAt),
    };
  };

  const report = async (event = {}, force = false) => {
    const now = Date.now();
    const phase = String(event.phase || activePhase || "acquire");
    const phasePct = Math.max(
      0,
      Math.min(100, Number(event.phase_pct ?? 0)),
    );

    if (phase !== activePhase) {
      closePhase(activePhase, now);
      activePhase = phase;
      activePhaseStartedAt = now;
      phaseTimings[phase] = {
        ...(phaseTimings[phase] || {}),
        started_at:
          phaseTimings[phase]?.started_at ||
          new Date(now).toISOString(),
      };
      force = true;
    }

    const range = ranges[phase] || [0, 100];
    const overallPct =
      phase === "done"
        ? 100
        : phase === "error"
          ? Number(parameters?.v4_progress?.overall_pct || 0)
          : range[0] +
            ((range[1] - range[0]) * phasePct) / 100;

    const elapsedMs = Math.max(0, now - startedAtMs);

    parameters = {
      ...parameters,
      v4_progress: {
        version: 4,
        phase,
        phase_pct: Number(phasePct.toFixed(2)),
        overall_pct: Number(overallPct.toFixed(2)),
        detail: event.detail || null,
        current:
          event.current === undefined ? null : event.current,
        total:
          event.total === undefined ? null : event.total,
        eta_seconds:
          event.eta_seconds === undefined
            ? null
            : event.eta_seconds,
        started_at:
          new Date(startedAtMs).toISOString(),
        updated_at: new Date(now).toISOString(),
        elapsed_ms: elapsedMs,
        phase_timings: phaseTimings,
      },
    };

    const shouldPersist =
      force ||
      now - lastPersistAt >= 1500 ||
      Math.floor(overallPct) >= lastPersistPct + 2;

    if (!shouldPersist) return;

    lastPersistAt = now;
    lastPersistPct = Math.floor(overallPct);

    await updateRevision(revision.id, {
      render_status: "rendering",
      locked_by: WORKER_ID,
      lease_expires_at: new Date(
        Date.now() + LEASE_SECS * 1000,
      ).toISOString(),
      parameters,
      last_error: null,
    });
  };

  await updateRevision(revision.id, {
    render_status: "rendering",
    locked_by: WORKER_ID,
    lease_expires_at: new Date(
      Date.now() + LEASE_SECS * 1000,
    ).toISOString(),
    render_attempts: attemptNumber,
    parameters,
    last_error: null,
  });

  let out = null;

  try {
    if (useV5) {
      await report(
        {
          phase: "planning",
          phase_pct: 0,
          detail: "Diretor V5 assistindo ao corte e montando 3 timelines",
        },
        true,
      );

      const planned = await callFunction(
        "clip-ai-editor-v5",
        "plan",
        {
          clip_id: clip.id,
          revision_id: revision.id,
        },
        { timeoutMs: 5 * 60 * 1000 },
      );

      if (!planned?.recommended) {
        throw new Error("Diretor V5 nao retornou plano recomendado");
      }

      parameters = {
        ...parameters,
        editor: "ai_editor_v5_semantic_multimodal",
        editor_version: 5,
        renderer: "ffmpeg_hardcut_v5",
        v5_plan: {
          version: planned.version || 5,
          editor: planned.editor,
          model: planned.model,
          visual_source_method: planned.visual_source_method,
          selected_plan_id: planned.selected_plan_id,
          recommended: planned.recommended,
          alternatives: planned.alternatives || [],
          original_candidate_ids: planned.original_candidate_ids || [],
          generated_at: planned.generated_at,
        },
      };

      await report(
        {
          phase: "planning",
          phase_pct: 100,
          detail:
            `V5 ${planned.recommended.editing_style} · viral ${Math.round(Number(planned.recommended.viral_score || 0))} · ${planned.recommended.output_duration_estimate}s`,
        },
        true,
      );
    }

    await report(
      {
        phase: "acquire",
        phase_pct: 0,
        detail: "Obtendo master do cache/fonte",
      },
      true,
    );

    const { path: master, strategy } = await resolveMedia({
      video,
      source,
      dir,
      supabase: storageShim,
      bucket: BUCKET,
      onProgress: (detail) => {
        const match = /(\d+(?:\.\d+)?)%/.exec(
          String(detail || ""),
        );
        const phasePct = match
          ? Math.max(0, Math.min(99, Number(match[1])))
          : 15;
        return report({
          phase: "acquire",
          phase_pct: phasePct,
          detail: String(detail || "obtendo master"),
        }).catch(() => {});
      },
    });

    await report(
      {
        phase: "acquire",
        phase_pct: 100,
        detail: `Master pronto via ${strategy}`,
      },
      true,
    );

    const sourceMeta = await probeMedia(master);
    let transcript = video.transcript || {};

    if (useV5) {
      const quality = await buildClipQualityV51({
        master,
        clip,
        revision: {
          ...revision,
          parameters,
        },
        video,
        dir,
        report,
      });

      transcript = quality.transcript;

      const currentPlan = parameters?.v5_plan || {};
      const recommended = currentPlan?.recommended || null;

      parameters = {
        ...parameters,
        clip_transcription_v51: quality.transcriptionMeta,
        headline_v51: quality.headlineMeta,
        v5_plan: recommended
          ? {
              ...currentPlan,
              recommended: {
                ...recommended,
                // Never reuse candidate on_screen_title as the final fallback headline.
                headline: quality.headline,
              },
            }
          : currentPlan,
      };
    }

    const rendered = useV5
      ? await renderEditorialV5({
          master,
          clip,
          revision: {
            ...revision,
            parameters,
          },
          transcript,
          dir,
          sourceMeta,
          report,
        })
      : await renderEditorialV4({
          master,
          clip,
          revision: {
            ...revision,
            parameters,
          },
          transcript,
          dir,
          sourceMeta,
          report,
        });

    out = rendered.out;
    parameters = {
      ...parameters,
      ...(rendered.parameters || {}),
      v4_progress: parameters.v4_progress,
    };

    await report(
      {
        phase: "qa",
        phase_pct: 0,
        detail: "Validando MP4 final",
      },
      true,
    );

    const output = await probeMedia(out);

    if (
      !output.hasVideo ||
      output.width !== 1080 ||
      output.height !== 1920 ||
      output.duration <= 0
    ) {
      throw new Error(
        `MP4 v4 invalido: ${output.width}x${output.height}, duracao ${output.duration || 0}`,
      );
    }

    if (sourceMeta.hasAudio && !output.hasAudio) {
      throw new Error(
        "MP4 v4 invalido: faixa de audio ausente",
      );
    }

    await report(
      {
        phase: "qa",
        phase_pct: 100,
        detail:
          `${output.width}x${output.height} · ${output.duration.toFixed(1)}s`,
      },
      true,
    );

    const storagePath = revisionStoragePath(
      clip.user_id,
      clip.id,
      variant.variant_key,
      revision.revision_number,
    );

    await report(
      {
        phase: "upload",
        phase_pct: 0,
        detail: "Enviando MP4 para o Supabase Storage",
      },
      true,
    );

    await uploadBytes(
      storagePath,
      await readFile(out),
      "video/mp4",
    );

    await report(
      {
        phase: "upload",
        phase_pct: 100,
        detail: "Upload concluido",
      },
      true,
    );

    const finishedAtMs = Date.now();
    closePhase(activePhase, finishedAtMs);

    parameters = {
      ...parameters,
      render_duration_ms:
        finishedAtMs - startedAtMs,
      render_started_at:
        new Date(startedAtMs).toISOString(),
      render_finished_at:
        new Date(finishedAtMs).toISOString(),
      v4_progress: {
        ...(parameters.v4_progress || {}),
        phase: "done",
        phase_pct: 100,
        overall_pct: 100,
        detail: "Concluido",
        updated_at:
          new Date(finishedAtMs).toISOString(),
        elapsed_ms:
          finishedAtMs - startedAtMs,
        total_duration_ms:
          finishedAtMs - startedAtMs,
        eta_seconds: 0,
        phase_timings: phaseTimings,
      },
    };

    const response = await updateRevision(revision.id, {
      render_status: "ready",
      rendered_storage_path: storagePath,
      rendered_url: null,
      parameters,
      last_error: null,
      locked_by: null,
      lease_expires_at: null,
    });

    if (out) await rm(out, { force: true });

    log(
      `[clip ${clip.id}] editorial_master v${revision.revision_number} ready via AI Editor v${useV5 ? 5 : 4} in ${Math.round((finishedAtMs - startedAtMs) / 1000)}s`,
    );

    return {
      ok: true,
      clipRenderStatus:
        response.clip_render_status,
    };
  } catch (error) {
    const failedAt = Date.now();
    closePhase(activePhase, failedAt);

    parameters = {
      ...parameters,
      render_duration_ms:
        failedAt - startedAtMs,
      render_started_at:
        new Date(startedAtMs).toISOString(),
      render_finished_at:
        new Date(failedAt).toISOString(),
      v4_progress: {
        ...(parameters.v4_progress || {}),
        phase: "error",
        detail:
          String(error?.message || error).slice(0, 500),
        updated_at:
          new Date(failedAt).toISOString(),
        elapsed_ms:
          failedAt - startedAtMs,
        total_duration_ms:
          failedAt - startedAtMs,
        eta_seconds: null,
        phase_timings: phaseTimings,
      },
    };

    await updateRevision(revision.id, {
      render_status: "error",
      last_error:
        String(error?.message || error).slice(0, 1500),
      parameters,
      locked_by: null,
      lease_expires_at: null,
    }).catch(() => {});

    if (out) {
      await rm(out, { force: true }).catch(() => {});
    }

    log(
      `[clip ${clip.id}] AI Editor v${useV5 ? 5 : 4} failed`,
      error?.message || error,
    );

    return { ok: false };
  }
}

async function renderAndUploadRevision(master, clip, variant, revision, transcript, dir, sourceMeta, effectiveBounds) {
  const label = `${variant.variant_key} v${revision.revision_number}`;
  log(`[clip ${clip.id}] rendering ${label}`);
  await updateRevision(revision.id, {
    render_status: "rendering", locked_by: WORKER_ID,
    lease_expires_at: new Date(Date.now() + LEASE_SECS * 1000).toISOString(),
    render_attempts: Number(revision.render_attempts || 0) + 1,
  });
  try {
    const { out, settings, parameters: renderedParameters } = await renderRevision(master, clip, variant, revision, transcript, dir, sourceMeta, effectiveBounds);
    const path = revisionStoragePath(clip.user_id, clip.id, variant.variant_key, revision.revision_number);
    await uploadBytes(path, await readFile(out), "video/mp4");
    const parameters = {
      ...(renderedParameters || revision.parameters || {}),
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

// Ã¢â€â‚¬Ã¢â€â‚¬ Job completo Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

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
          : "fonte bloqueada: erro nÃƒÂ£o retentÃƒÂ¡vel",
        last_error: message.slice(0, 2000),
        locked_by: null,
        locked_at: null,
        lease_expires_at: null,
        next_retry_at: null,
        processing_finished_at: nowIso(),
      });
    } catch (updateError) {
      log("nÃƒÂ£o consegui registrar o bloqueio terminal", updateError?.message);
      await call("fail_job", {
        video_id: job.id,
        attempts: Number(job.attempts || 0),
        retryable,
        error: message,
      }).catch((e) => log("nÃƒÂ£o consegui registrar a falha", e?.message));
    }
  } else {
    await call("fail_job", {
      video_id: job.id, attempts: Number(job.attempts || 0),
      retryable, error: message,
    }).catch((e) => log("nÃƒÂ£o consegui registrar a falha", e?.message));
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

    // 1. MÃƒÂ­dia
    const { path: master, strategy } = await resolveMedia({
      video: job, source: ctx.source, dir, supabase: storageShim, bucket: BUCKET,
      onProgress: (detail) => setStage(job.id, "downloading", detail),
    });
    const duration = await probeDuration(master);
    await updateVideo(job.id, {
      media_status: "processing", duration_seconds: duration,
      stage_detail: `master obtido via ${strategy}`,
    });

    // 2. TranscriÃƒÂ§ÃƒÂ£o Ã¢â‚¬â€ reaproveitada se jÃƒÂ¡ existe (retry nÃƒÂ£o repaga a IA).
    stage = "transcribing";
    let transcript = job.transcript;
    if (!transcript?.segments?.length) {
      await setStage(job.id, "transcribing", "transcrevendo ÃƒÂ¡udio");
      transcript = await transcribe(master, dir);
      await updateVideo(job.id, {
        transcript, transcript_status: "ready",
        duration_seconds: duration || transcript.duration,
      });
    }

        // 3. Diretor Editorial v2.
    stage = "analyzing";

    await setStage(
      job.id,
      "analyzing",
      "Diretor Editorial v2 procurando micro-historias fortes",
    );

    const {
      clips = [],
      editorial_version,
      threshold,
    } = await callFunction(
      "clip-editorial-v2",
      "analyze_and_save",
      {
        job: {
          ...job,
          duration_seconds: duration || transcript.duration,
        },
        transcript,
      },
      { timeoutMs: 10 * 60 * 1000 },
    );

    await call("finish_job", {
      video_id: job.id,
      clips_generated: 0,
      candidates_count: clips.length,
      approved_count: 0,
    });

    log(
      `concluido "${job.title}": ${clips.length} candidatos editoriais v${editorial_version || 2} (regua ${threshold || 78})`,
    );
  } catch (e) {
    await failJob(job, e);
  } finally {
    stopHeartbeat();
    // O master nunca sobrevive ao job.
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Backlog de aprovaÃƒÂ§ÃƒÂ£o manual (modo revisÃƒÂ£o). Precisa reobter o master, entÃƒÂ£o
 * roda sÃƒÂ³ quando nÃƒÂ£o hÃƒÂ¡ vÃƒÂ­deo novo na fila.
 */
async function processApprovedBacklog() {
  const response = await callFunction(
    "clip-ai-editor-v2",
    "next_render_job",
    {},
    { timeoutMs: 5 * 60 * 1000 },
  );

  const renderJob = response?.job;
  if (!renderJob) return false;

  const { clip, variant, video, source } = renderJob;
  let revision = renderJob.revision;

  await mkdir(TMP_ROOT, { recursive: true });
  const dir = await mkdtemp(join(TMP_ROOT, "clip-render-v2-"));

  try {
    if (
      Number(revision.revision_number || 1) > 1 &&
      revision.feedback_text
    ) {
      const revised = await callFunction(
        "clip-ai-editor-revise-v2",
        "revise_plan",
        {
          plan: revision.parameters || variant.parameters || {},
          feedback: revision.feedback_text,
          duration_seconds:
            Number(clip.end_seconds) - Number(clip.start_seconds),
        },
        { timeoutMs: 3 * 60 * 1000 },
      );

      if (revised?.plan) {
        revision = { ...revision, parameters: revised.plan };
        await updateRevision(revision.id, {
          parameters: revised.plan,
        });
      }
    }


    if (
      variant.variant_key === "editorial_master" &&
      process.env.CLIP_AI_EDITOR_VERSION !== "3"
    ) {
      const v4Result =
        await renderAndUploadV4Revision(
          clip,
          variant,
          revision,
          video,
          source,
          dir,
        );

      if (v4Result.ok) {
        await call("finish_job", {
          video_id: video.id,
          clips_generated:
            Number(video.clips_generated || 0) + 1,
          candidates_count: 1,
          approved_count: 1,
        });
      }

      return true;
    }

    const { path: master } = await resolveMedia({
      video,
      source,
      dir,
      supabase: storageShim,
      bucket: BUCKET,
    });

    const sourceMeta = await probeMedia(master);
    let transcript = video.transcript || {};

    if (!transcript?.words?.length) {
      log(`[clip ${clip.id}] atualizando transcricao para word-level timing`);
      transcript = await transcribe(master, dir);
      await updateVideo(video.id, {
        transcript,
        transcript_status: "ready",
        stage_detail: "sincronizacao palavra por palavra concluida",
      });
    }

    const result = await renderAndUploadRevision(
      master,
      clip,
      variant,
      revision,
      transcript,
      dir,
      sourceMeta,
      null,
    );

    if (result.ok) {
      await call("finish_job", {
        video_id: video.id,
        clips_generated: Number(video.clips_generated || 0) + 1,
        candidates_count: 1,
        approved_count: 1,
      });
    }

    return true;
  } catch (error) {
    await updateRevision(
      revision.id,
      {
        render_status: "error",
        last_error: String(error?.message || error).slice(0, 1500),
        locked_by: null,
        lease_expires_at: null,
      },
    ).catch(() => {});

    log(
      `[clip ${clip.id}] editorial master failed`,
      error?.message || error,
    );

    return true;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function loop() {
  let idleSince = null;

  do {
    let didWork = false;

    try {
      const { recovered } = await call("recover_stuck");

      if (recovered) {
        log(`recuperados ${recovered} job(s) abandonados`);
      }

      // Primeiro: cortes aprovados / revisoes.
      const renderedBacklog =
        await processApprovedBacklog();

      if (renderedBacklog) {
        didWork = true;
      } else {
        // Depois: novos videos descobertos.
        const job =
          await claimJob();

        if (job) {
          didWork = true;
          await processJob(job);
        } else if (RUN_ONCE) {
          break;
        }
      }
    } catch (e) {
      log("erro no laÃ§o", e?.message || e);
    }

    if (didWork) {
      idleSince = null;
    } else if (!RUN_ONCE && !shuttingDown) {

      if (idleSince === null) {
        idleSince = Date.now();
      }

      const idleFor =
        Date.now() - idleSince;

      if (idleFor >= IDLE_SHUTDOWN_MS) {
        log(
          `fila vazia por ${Math.round(idleFor / 1000)}s; ` +
          `encerrando para a Fly desligar a Machine`
        );

        break;
      }
    }

    if (RUN_ONCE || shuttingDown) {
      break;
    }

    await new Promise(
      (resolve) =>
        setTimeout(resolve,POLL_MS)
    );
  } while (true);

  log("worker encerrado");
}
log(`worker ${WORKER_ID} iniciado (IA e banco via gateway, bucket ${BUCKET}, ts ${nowIso()})`);
await loop();
