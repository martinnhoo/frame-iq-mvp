import { spawn } from "node:child_process";
import { readFile, writeFile, stat, rename, unlink } from "node:fs/promises";
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

function groupWords(
  words,
  {
    maxWords = 7,
    maxChars = 44,
    maxDuration = 2.5,
  } = {},
) {
  const groups = [];
  let current = [];

  const textLength = (items) =>
    items.map((item) => String(item.word || "")).join(" ").length;

  for (const word of words) {
    const prev = current.at(-1);
    const pause = prev ? word.start - prev.end : 0;
    const sentenceBreak =
      prev && /[.!?…]["')\]]?$/.test(prev.word);
    const proposed = [...current, word];
    const proposedDuration =
      current.length > 0
        ? word.end - current[0].start
        : 0;

    if (
      current.length &&
      (
        current.length >= maxWords ||
        textLength(proposed) > maxChars ||
        proposedDuration > maxDuration ||
        pause > 0.55 ||
        sentenceBreak
      )
    ) {
      groups.push(current);
      current = [];
    }

    current.push(word);
  }

  if (current.length) groups.push(current);
  return groups;
}

function captionBreakIndex(group, maxLineChars = 24) {
  if (!Array.isArray(group) || group.length < 2) return -1;
  const full = group.map((item) => String(item.word || "")).join(" ");
  if (full.length <= maxLineChars) return -1;

  let bestIndex = 1;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let index = 1; index < group.length; index += 1) {
    const left = group
      .slice(0, index)
      .map((item) => String(item.word || ""))
      .join(" ").length;
    const right = group
      .slice(index)
      .map((item) => String(item.word || ""))
      .join(" ").length;
    const overflow =
      Math.max(0, left - maxLineChars) +
      Math.max(0, right - maxLineChars);
    const score = overflow * 12 + Math.abs(left - right);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function phraseWithActiveWord(group, activeIndex) {
  const rendered = group.map((item, index) => {
    const word = escapeAss(item.word);
    if (index === activeIndex) {
      return `{\\c&H0000D8FF&}${word}{\\c&H00FFFFFF&}`;
    }
    return word;
  });

  const breakAt = captionBreakIndex(group, 24);
  if (breakAt <= 0) return rendered.join(" ");

  return (
    rendered.slice(0, breakAt).join(" ") +
    "\\N" +
    rendered.slice(breakAt).join(" ")
  );
}

function wrapHeadline(text, maxLineChars = 26) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "";
  const full = words.join(" ");
  if (full.length <= maxLineChars || words.length === 1) {
    return escapeAss(full);
  }

  let bestIndex = 1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const left = words.slice(0, index).join(" ");
    const right = words.slice(index).join(" ");
    const overflow =
      Math.max(0, left.length - maxLineChars) +
      Math.max(0, right.length - maxLineChars);
    const score = overflow * 12 + Math.abs(left.length - right.length);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  const left = words.slice(0, bestIndex).join(" ");
  const right = words.slice(bestIndex).join(" ");
  return `${escapeAss(left)}\\N${escapeAss(right)}`;
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
  const groups = groupWords(words, {
    maxWords: energy >= 4 ? 6 : 7,
    maxChars: energy >= 4 ? 40 : 44,
    maxDuration: energy >= 4 ? 2.15 : 2.55,
  });

  const fontSize = energy >= 4 ? 70 : 66;
  const marginV = energy >= 4 ? 330 : 315;

  const lines = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${OUTPUT_W}`,
    `PlayResY: ${OUTPUT_H}`,
    "ScaledBorderAndShadow: yes",
    "WrapStyle: 0",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Caption,Inter,${fontSize},&H00FFFFFF,&H0000D8FF,&H00101010,&H00000000,-1,0,0,0,100,100,0,0,1,4,1,2,96,96,${marginV},1`,
    "Style: Headline,Inter,58,&H00FFFFFF,&H00FFFFFF,&H00000000,&H98000000,-1,0,0,0,100,100,0,0,3,12,0,8,110,110,150,1",
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
      `Dialogue: 1,${assTime(0)},${assTime(headlineEnd)},Headline,,0,0,0,,${wrapHeadline(headlineText, 26)}`,
    );
  }

  await writeFile(outputPath, lines.join("\n"), "utf8");

  return {
    words: words.length,
    caption_groups: groups.length,
    style: "premium_dynamic_v2",
    headline_enabled:
      lines.some((line) => line.includes(",Headline,")),
  };
}

function computeCropGeometry(sourceMeta) {
  const sourceW = Number(sourceMeta.width || 0);
  const sourceH = Number(sourceMeta.height || 0);

  if (!sourceW || !sourceH) {
    throw new Error(
      "Dimensoes da fonte indisponiveis para o AI Editor v4",
    );
  }

  const targetAspect = OUTPUT_W / OUTPUT_H;
  const sourceAspect = sourceW / sourceH;

  if (sourceAspect >= targetAspect) {
    const cropH = sourceH - (sourceH % 2);
    const cropW =
      Math.floor((cropH * targetAspect) / 2) * 2;

    return {
      sourceW,
      sourceH,
      cropW,
      cropH,
      dynamicAxis: "x",
    };
  }

  const cropW = sourceW - (sourceW % 2);
  const cropH =
    Math.floor((cropW / targetAspect) / 2) * 2;

  return {
    sourceW,
    sourceH,
    cropW,
    cropH,
    dynamicAxis: "y",
  };
}

function pixelFromFocus(value, maxValue, cropSize) {
  return clamp(
    Number(value ?? 0.5) * maxValue - cropSize / 2,
    0,
    Math.max(0, maxValue - cropSize),
  );
}

function normalizedCamera(camera, durationSeconds) {
  const values = (Array.isArray(camera) ? camera : [])
    .map((point) => ({
      time: clamp(
        Number(point.time || 0),
        0,
        durationSeconds,
      ),
      focus_x: clamp(
        Number(point.focus_x ?? 0.5),
        0,
        1,
      ),
      focus_y: clamp(
        Number(point.focus_y ?? 0.43),
        0,
        1,
      ),
    }))
    .filter(
      (point) =>
        Number.isFinite(point.time) &&
        Number.isFinite(point.focus_x) &&
        Number.isFinite(point.focus_y),
    )
    .sort((a, b) => a.time - b.time);

  const deduped = [];
  for (const point of values) {
    const previous = deduped.at(-1);

    if (
      previous &&
      Math.abs(previous.time - point.time) < 0.001
    ) {
      deduped[deduped.length - 1] = point;
    } else {
      deduped.push(point);
    }
  }

  if (!deduped.length) {
    return [
      { time: 0, focus_x: 0.5, focus_y: 0.43 },
      {
        time: durationSeconds,
        focus_x: 0.5,
        focus_y: 0.43,
      },
    ];
  }

  if (deduped[0].time > 0.001) {
    deduped.unshift({
      ...deduped[0],
      time: 0,
    });
  } else {
    deduped[0].time = 0;
  }

  const last = deduped.at(-1);
  if (last.time < durationSeconds - 0.001) {
    deduped.push({
      ...last,
      time: durationSeconds,
    });
  } else {
    last.time = durationSeconds;
  }

  return deduped;
}

async function writeCameraCommands({
  outputPath,
  sourceMeta,
  camera,
  durationSeconds,
}) {
  const geometry = computeCropGeometry(sourceMeta);
  const points = normalizedCamera(
    camera,
    durationSeconds,
  );

  const first = points[0];

  const initialX =
    geometry.dynamicAxis === "x"
      ? pixelFromFocus(
          first.focus_x,
          geometry.sourceW,
          geometry.cropW,
        )
      : Math.max(
          0,
          (geometry.sourceW - geometry.cropW) / 2,
        );

  const initialY =
    geometry.dynamicAxis === "y"
      ? pixelFromFocus(
          first.focus_y,
          geometry.sourceH,
          geometry.cropH,
        )
      : Math.max(
          0,
          (geometry.sourceH - geometry.cropH) / 2,
        );

  const lines = [];

  for (
    let index = 0;
    index < points.length - 1;
    index += 1
  ) {
    const from = points[index];
    const to = points[index + 1];

    const intervalStart = clamp(
      from.time,
      0,
      durationSeconds,
    );
    const intervalEnd = clamp(
      to.time,
      intervalStart,
      durationSeconds,
    );

    if (intervalEnd <= intervalStart + 0.001) {
      continue;
    }

    if (geometry.dynamicAxis === "x") {
      const fromPx = pixelFromFocus(
        from.focus_x,
        geometry.sourceW,
        geometry.cropW,
      );
      const toPx = pixelFromFocus(
        to.focus_x,
        geometry.sourceW,
        geometry.cropW,
      );

      lines.push(
        `${intervalStart.toFixed(3)}-${intervalEnd.toFixed(3)} ` +
          `[expr] crop@v4crop x ` +
          `'lerp(${fromPx.toFixed(3)},${toPx.toFixed(3)},TI)';`,
      );
    } else {
      const fromPx = pixelFromFocus(
        from.focus_y,
        geometry.sourceH,
        geometry.cropH,
      );
      const toPx = pixelFromFocus(
        to.focus_y,
        geometry.sourceH,
        geometry.cropH,
      );

      lines.push(
        `${intervalStart.toFixed(3)}-${intervalEnd.toFixed(3)} ` +
          `[expr] crop@v4crop y ` +
          `'lerp(${fromPx.toFixed(3)},${toPx.toFixed(3)},TI)';`,
      );
    }
  }

  await writeFile(
    outputPath,
    lines.join("\n"),
    "utf8",
  );

  return {
    ...geometry,
    initialX,
    initialY,
    commandCount: lines.length,
    cameraPoints: points.length,
  };
}

function escapeFilterPath(path) {
  return String(path)
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}

function buildVideoFilter({
  assPath,
  cameraCommandPath,
  cameraRuntime,
}) {
  const filters = [];

  if (cameraRuntime.commandCount > 0) {
    filters.push(
      `sendcmd=f='${escapeFilterPath(cameraCommandPath)}'`,
    );
  }

  filters.push(
    `crop@v4crop=` +
      `w=${cameraRuntime.cropW}:` +
      `h=${cameraRuntime.cropH}:` +
      `x=${cameraRuntime.initialX.toFixed(3)}:` +
      `y=${cameraRuntime.initialY.toFixed(3)}`,
  );

  filters.push(
    `scale=${OUTPUT_W}:${OUTPUT_H}:flags=lanczos`,
    `subtitles='${escapeFilterPath(assPath)}'`,
    "format=yuv420p",
  );

  return filters.join(",");
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
    process.env.V4_VISION_SAMPLE_FPS || 6,
  );

  await new Promise((resolve, reject) => {
    const child = spawn(
      "python3",
      [
        "/app/vision/ai_editor_v6_lrasd.py",
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
        "--weights",
        process.env.V4_LR_ASD_WEIGHTS || "/app/vision/lrasd_talkset.model",
        "--torch-threads",
        String(process.env.V4_ASD_THREADS || 2),
        "--proxy-max-side",
        String(process.env.V4_ASD_PROXY_MAX_SIDE || 640),
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

async function ensureUploadBudget({
  output,
  durationSeconds,
  hasAudio,
  report,
}) {
  const maxBytes = Number(
    process.env.V4_MAX_OUTPUT_BYTES || 47185920,
  );

  const before = await stat(output);
  if (!Number.isFinite(maxBytes) || maxBytes <= 0 || before.size <= maxBytes) {
    return {
      compacted: false,
      bytes_before: before.size,
      bytes_after: before.size,
      max_bytes: maxBytes,
    };
  }

  await report({
    phase: "render",
    phase_pct: 100,
    detail: `MP4 acima do budget (${(before.size / 1048576).toFixed(1)} MB); compactando`,
  });

  const tempOutput = `${output}.storage-budget.mp4`;
  const audioBps = hasAudio ? 96000 : 0;
  const totalBps = Math.max(
    650000,
    Math.floor((maxBytes * 8 * 0.88) / Math.max(1, durationSeconds)),
  );
  const videoBps = Math.max(550000, totalBps - audioBps);
  const videoK = Math.max(550, Math.floor(videoBps / 1000));

  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    output,
    "-c:v",
    "libx264",
    "-preset",
    "superfast",
    "-b:v",
    `${videoK}k`,
    "-maxrate",
    `${videoK}k`,
    "-bufsize",
    `${videoK * 2}k`,
    "-pix_fmt",
    "yuv420p",
    "-threads",
    String(process.env.V4_FFMPEG_THREADS || 2),
  ];

  if (hasAudio) {
    args.push("-c:a", "aac", "-b:a", "96k");
  } else {
    args.push("-an");
  }

  args.push("-movflags", "+faststart", tempOutput);

  try {
    await new Promise((resolve, reject) => {
      const child = spawn("ffmpeg", args, {
        stdio: ["ignore", "ignore", "pipe"],
      });

      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve();
        else {
          reject(
            new Error(
              `FFmpeg storage-budget falhou (${code}): ${stderr.slice(-1400)}`,
            ),
          );
        }
      });
    });

    const after = await stat(tempOutput);
    if (after.size > maxBytes) {
      throw new Error(
        `MP4 continua acima do budget: ${after.size} > ${maxBytes}`,
      );
    }

    await rename(tempOutput, output);
    return {
      compacted: true,
      bytes_before: before.size,
      bytes_after: after.size,
      max_bytes: maxBytes,
      target_video_kbps: videoK,
    };
  } catch (error) {
    await unlink(tempOutput).catch(() => {});
    throw error;
  }
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
    detail: "YuNet + LR-ASD neural active-speaker iniciando",
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

  const cameraCommandPath = join(
    dir,
    `${revision.id}-camera-v4.cmd`,
  );

  const cameraRuntime = await writeCameraCommands({
    outputPath: cameraCommandPath,
    sourceMeta,
    camera: vision.camera || [],
    durationSeconds,
  });

  const filter = buildVideoFilter({
    assPath,
    cameraCommandPath,
    cameraRuntime,
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

  const uploadBudget = await ensureUploadBudget({
    output,
    durationSeconds,
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
      camera_runtime: {
        backend: "ffmpeg_sendcmd_lerp",
        command_count: cameraRuntime.commandCount,
        camera_points: cameraRuntime.cameraPoints,
        crop_width: cameraRuntime.cropW,
        crop_height: cameraRuntime.cropH,
        dynamic_axis: cameraRuntime.dynamicAxis,
      },
      caption_v4: captionMeta,
      upload_budget: uploadBudget,
      effective_start_seconds: startSeconds,
      effective_end_seconds: endSeconds,
    },
  };
}
