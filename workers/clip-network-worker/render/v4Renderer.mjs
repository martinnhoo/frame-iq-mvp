import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUTPUT_W = 1080;
const OUTPUT_H = 1920;

const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, Number(value)));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assTime(seconds) {
  const value = Math.max(0, Number(seconds || 0));
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = Math.floor(value % 60);
  const cs = Math.floor((value - Math.floor(value)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function escapeAss(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r?\n/g, "\\N")
    .trim();
}

function relativeWords(transcript, startSeconds, endSeconds) {
  const direct = Array.isArray(transcript?.words) ? transcript.words : [];
  const words = direct
    .map((item) => ({
      word: String(item.word ?? item.text ?? "").trim(),
      start: Number(item.start ?? 0),
      end: Number(item.end ?? item.start ?? 0),
    }))
    .filter(
      (item) =>
        item.word &&
        item.end > startSeconds &&
        item.start < endSeconds,
    )
    .map((item) => ({
      word: item.word,
      start: clamp(item.start - startSeconds, 0, endSeconds - startSeconds),
      end: clamp(item.end - startSeconds, 0, endSeconds - startSeconds),
    }));

  if (words.length) return words;

  const segments = Array.isArray(transcript?.segments)
    ? transcript.segments
    : [];

  const approximated = [];
  for (const segment of segments) {
    const segStart = Number(segment.start ?? 0);
    const segEnd = Number(segment.end ?? segStart);
    if (segEnd <= startSeconds || segStart >= endSeconds) continue;

    const tokens = String(segment.text || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!tokens.length) continue;

    const clippedStart = Math.max(startSeconds, segStart);
    const clippedEnd = Math.min(endSeconds, segEnd);
    const span = Math.max(0.2, clippedEnd - clippedStart);
    const step = span / tokens.length;

    tokens.forEach((word, index) => {
      approximated.push({
        word,
        start: clippedStart - startSeconds + index * step,
        end: clippedStart - startSeconds + (index + 1) * step,
      });
    });
  }

  return approximated;
}

function groupWords(words, maxWords = 4) {
  const groups = [];
  let current = [];

  for (const word of words) {
    const prev = current.at(-1);
    const pause = prev ? word.start - prev.end : 0;
    const sentenceBreak =
      prev &&
      /[.!?…]["')\]]?$/.test(prev.word);

    if (
      current.length &&
      (current.length >= maxWords || pause > 0.48 || sentenceBreak)
    ) {
      groups.push(current);
      current = [];
    }
    current.push(word);
  }

  if (current.length) groups.push(current);
  return groups;
}

function phraseWithActiveWord(group, activeIndex) {
  return group
    .map((item, index) => {
      const word = escapeAss(item.word);
      if (index === activeIndex) {
        return `{\\c&H0000D8FF&}${word}{\\c&H00FFFFFF&}`;
      }
      return word;
    })
    .join(" ");
}

function overlapRatio(a, b) {
  const sa = new Set(
    String(a || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
  const sb = new Set(
    String(b || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
  if (!sa.size || !sb.size) return 0;
  let intersection = 0;
  for (const word of sa) if (sb.has(word)) intersection += 1;
  return intersection / Math.max(sa.size, sb.size);
}

async function writeAss({
  outputPath,
  transcript,
  startSeconds,
  endSeconds,
  parameters,
  clip,
}) {
  const duration = endSeconds - startSeconds;
  const words = relativeWords(transcript, startSeconds, endSeconds);
  const energy = clamp(parameters?.style?.energy ?? 3, 1, 5);
  const maxWords = energy >= 4 ? 3 : 4;
  const groups = groupWords(words, maxWords);

  const fontSize = energy >= 4 ? 92 : 86;
  const marginV = energy >= 4 ? 420 : 390;

  const lines = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${OUTPUT_W}`,
    `PlayResY: ${OUTPUT_H}`,
    "ScaledBorderAndShadow: yes",
    "WrapStyle: 2",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Caption,DejaVu Sans Condensed,${fontSize},&H00FFFFFF,&H0000D8FF,&H00101010,&H64000000,-1,0,0,0,100,100,0,0,1,8,1,2,80,80,${marginV},1`,
    "Style: Headline,DejaVu Sans Condensed,74,&H00FFFFFF,&H00FFFFFF,&H00101010,&H78000000,-1,0,0,0,100,100,0,0,1,7,1,8,80,80,160,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  for (const group of groups) {
    for (let index = 0; index < group.length; index += 1) {
      const item = group[index];
      const next = group[index + 1];
      const start = clamp(item.start, 0, duration);
      const end = clamp(
        Math.max(item.end, next ? next.start : item.end + 0.10),
        start + 0.06,
        duration,
      );
      lines.push(
        `Dialogue: 0,${assTime(start)},${assTime(end)},Caption,,0,0,0,,${phraseWithActiveWord(group, index)}`,
      );
    }
  }

  const firstSpeech = words
    .slice(0, 12)
    .map((item) => item.word)
    .join(" ");

  const headlineText = String(
    parameters?.hook_overlay?.text ||
      parameters?.hookTitle?.text ||
      clip?.on_screen_title ||
      "",
  )
    .replace(/\s+/g, " ")
    .trim();

  const explicitlyEnabled =
    parameters?.hook_overlay?.enabled === true ||
    parameters?.hookTitle?.enabled === true;

  if (
    explicitlyEnabled &&
    headlineText &&
    headlineText.split(/\s+/).length <= 8 &&
    overlapRatio(headlineText, firstSpeech) < 0.50
  ) {
    const headlineEnd = clamp(
      parameters?.hook_overlay?.end ??
        parameters?.hookTitle?.end ??
        2.0,
      1.2,
      Math.min(2.8, duration),
    );
    lines.push(
      `Dialogue: 1,${assTime(0)},${assTime(headlineEnd)},Headline,,0,0,0,,${escapeAss(headlineText)}`,
    );
  }

  await writeFile(outputPath, lines.join("\n"), "utf8");

  return {
    words: words.length,
    caption_groups: groups.length,
    style: energy >= 4 ? "viral_clean_high_energy" : "viral_clean",
    headline_enabled:
      lines.some((line) => line.includes(",Headline,")),
  };
}

function interpolateExpression(points, key, maxValue, cropSize) {
  if (!Array.isArray(points) || !points.length) {
    return String(Math.max(0, (maxValue - cropSize) / 2));
  }

  const values = points
    .map((point) => ({
      t: Math.max(0, Number(point.time || 0)),
      value: clamp(Number(point[key] ?? 0.5), 0, 1),
    }))
    .sort((a, b) => a.t - b.t);

  const pixel = (value) =>
    clamp(value * maxValue - cropSize / 2, 0, maxValue - cropSize);

  let expression = pixel(values.at(-1).value).toFixed(3);

  for (let i = values.length - 2; i >= 0; i -= 1) {
    const a = values[i];
    const b = values[i + 1];
    const ta = a.t.toFixed(3);
    const tb = Math.max(a.t + 0.001, b.t).toFixed(3);
    const pa = pixel(a.value);
    const pb = pixel(b.value);
    const span = Math.max(0.001, b.t - a.t);
    const linear =
      `(${pa.toFixed(3)}+(${(pb - pa).toFixed(3)})*(t-${ta})/${span.toFixed(3)})`;
    expression =
      `if(between(t,${ta},${tb}),${linear},${expression})`;
  }

  return expression;
}

function escapeFilterPath(path) {
  return String(path)
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}

function buildVideoFilter({
  sourceMeta,
  camera,
  assPath,
}) {
  const sourceW = Number(sourceMeta.width || 0);
  const sourceH = Number(sourceMeta.height || 0);
  if (!sourceW || !sourceH) {
    throw new Error("Dimensoes da fonte indisponiveis para o AI Editor v4");
  }

  const targetAspect = OUTPUT_W / OUTPUT_H;
  const sourceAspect = sourceW / sourceH;

  let cropW;
  let cropH;
  let xExpression = "0";
  let yExpression = "0";

  if (sourceAspect >= targetAspect) {
    cropH = sourceH - (sourceH % 2);
    cropW = Math.floor((cropH * targetAspect) / 2) * 2;
    xExpression = interpolateExpression(camera, "focus_x", sourceW, cropW);
    yExpression = String(Math.max(0, (sourceH - cropH) / 2));
  } else {
    cropW = sourceW - (sourceW % 2);
    cropH = Math.floor((cropW / targetAspect) / 2) * 2;
    xExpression = String(Math.max(0, (sourceW - cropW) / 2));
    yExpression = interpolateExpression(camera, "focus_y", sourceH, cropH);
  }

  return [
    "setpts=PTS-STARTPTS",
    `crop=${cropW}:${cropH}:x='${xExpression}':y='${yExpression}'`,
    `scale=${OUTPUT_W}:${OUTPUT_H}:flags=lanczos`,
    `subtitles='${escapeFilterPath(assPath)}'`,
    "format=yuv420p",
  ].join(",");
}

function parseOutTime(value) {
  const match = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(
    String(value || "").trim(),
  );
  if (!match) return null;
  return (
    Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3])
  );
}

async function runVision({
  master,
  dir,
  startSeconds,
  durationSeconds,
  report,
}) {
  const outputPath = join(dir, "v4-vision-plan.json");
  const modelPath =
    process.env.V4_YUNET_MODEL ||
    "/app/vision/yunet.onnx";
  const sampleFps = Number(
    process.env.V4_VISION_SAMPLE_FPS || 3,
  );

  await new Promise((resolve, reject) => {
    const child = spawn(
      "python3",
      [
        "/app/vision/ai_editor_v4.py",
        "--input",
        master,
        "--model",
        modelPath,
        "--output",
        outputPath,
        "--start",
        String(startSeconds),
        "--duration",
        String(durationSeconds),
        "--sample-fps",
        String(sampleFps),
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdoutBuffer = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.type === "progress") {
            report({
              phase: "vision",
              phase_pct: data.phase_pct,
              current: data.current,
              total: data.total,
              eta_seconds: data.eta_seconds,
              detail: `${data.current}/${data.total} frames analisados`,
            }).catch(() => {});
          }
        } catch {
          // Keep renderer resilient to non-JSON diagnostic output.
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            `AI Editor v4 vision falhou (${code}): ${stderr.slice(-1600)}`,
          ),
        );
      }
    });
  });

  return JSON.parse(await readFile(outputPath, "utf8"));
}

async function runFfmpegRender({
  master,
  output,
  startSeconds,
  durationSeconds,
  filter,
  hasAudio,
  report,
}) {
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(startSeconds),
    "-i",
    master,
    "-t",
    String(durationSeconds),
    "-vf",
    filter,
  ];

  if (hasAudio) {
    args.push(
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
    );
  }

  args.push(
    "-c:v",
    "libx264",
    "-preset",
    process.env.V4_X264_PRESET || "veryfast",
    "-crf",
    process.env.V4_X264_CRF || "19",
    "-pix_fmt",
    "yuv420p",
    "-threads",
    String(process.env.V4_FFMPEG_THREADS || 2),
  );

  if (hasAudio) {
    args.push("-c:a", "aac", "-b:a", "128k");
  } else {
    args.push("-an");
  }

  args.push(
    "-movflags",
    "+faststart",
    "-progress",
    "pipe:1",
    "-nostats",
    output,
  );

  await new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let buffer = "";
    let stderr = "";
    let lastPct = -1;
    let speed = null;

    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";

      for (const line of lines) {
        const [key, ...rest] = line.split("=");
        const value = rest.join("=");
        if (key === "speed") {
          const parsed = Number(
            String(value).replace(/x$/i, ""),
          );
          if (Number.isFinite(parsed)) speed = parsed;
        }
        if (key === "out_time") {
          const seconds = parseOutTime(value);
          if (seconds == null) continue;

          const pct = clamp(
            (seconds / Math.max(0.1, durationSeconds)) * 100,
            0,
            100,
          );

          if (
            Math.floor(pct) >= lastPct + 2 ||
            pct >= 99.5
          ) {
            lastPct = Math.floor(pct);
            const remainingMedia = Math.max(
              0,
              durationSeconds - seconds,
            );
            const etaSeconds =
              speed && speed > 0
                ? remainingMedia / speed
                : null;

            report({
              phase: "render",
              phase_pct: pct,
              current: Number(seconds.toFixed(2)),
              total: Number(durationSeconds.toFixed(2)),
              eta_seconds:
                etaSeconds == null
                  ? null
                  : Number(etaSeconds.toFixed(1)),
              detail:
                `FFmpeg ${seconds.toFixed(1)}/${durationSeconds.toFixed(1)}s` +
                (speed ? ` · ${speed.toFixed(2)}x` : ""),
            }).catch(() => {});
          }
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            `FFmpeg v4 falhou (${code}): ${stderr.slice(-1800)}`,
          ),
        );
      }
    });
  });
}

export async function renderEditorialV4({
  master,
  clip,
  revision,
  transcript,
  dir,
  sourceMeta,
  report,
}) {
  const startSeconds = Number(
    revision?.parameters?.start_seconds ??
      clip.start_seconds,
  );
  const endSeconds = Number(
    revision?.parameters?.end_seconds ??
      clip.end_seconds,
  );
  const durationSeconds = endSeconds - startSeconds;

  if (!(durationSeconds > 0)) {
    throw new Error("Janela invalida para AI Editor v4");
  }

  const output = join(
    dir,
    `${revision.id}-ai-editor-v4.mp4`,
  );
  const assPath = join(
    dir,
    `${revision.id}-captions-v4.ass`,
  );

  await report({
    phase: "vision",
    phase_pct: 0,
    detail: "YuNet + active-speaker iniciando",
  });

  const vision = await runVision({
    master,
    dir,
    startSeconds,
    durationSeconds,
    report,
  });

  await report({
    phase: "vision",
    phase_pct: 100,
    detail:
      `${vision?.stats?.camera_keyframes || vision?.camera?.length || 0} pontos de camera`,
  });

  await report({
    phase: "captions",
    phase_pct: 0,
    detail: "Montando legendas word-level",
  });

  const captionMeta = await writeAss({
    outputPath: assPath,
    transcript,
    startSeconds,
    endSeconds,
    parameters: revision.parameters || {},
    clip,
  });

  await report({
    phase: "captions",
    phase_pct: 100,
    detail:
      `${captionMeta.words} palavras · ${captionMeta.caption_groups} grupos`,
  });

  const filter = buildVideoFilter({
    sourceMeta,
    camera: vision.camera || [],
    assPath,
  });

  await report({
    phase: "render",
    phase_pct: 0,
    detail: "FFmpeg one-pass 1080x1920",
  });

  await runFfmpegRender({
    master,
    output,
    startSeconds,
    durationSeconds,
    filter,
    hasAudio: Boolean(sourceMeta.hasAudio),
    report,
  });

  await report({
    phase: "render",
    phase_pct: 100,
    detail: "Encode concluido",
  });

  return {
    out: output,
    parameters: {
      ...(revision.parameters || {}),
      editor: "ai_editor_v4_open_source",
      editor_version: 4,
      renderer: "ffmpeg_one_pass_v4",
      vision_backend: vision.vision_backend,
      camera: vision.camera,
      vision_stats: vision.stats,
      caption_v4: captionMeta,
      effective_start_seconds: startSeconds,
      effective_end_seconds: endSeconds,
    },
  };
}
