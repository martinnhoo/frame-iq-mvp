import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runVision, ensureUploadBudget } from "./v4Renderer.mjs";

const OUTPUT_W = 1080;
const OUTPUT_H = 1920;
const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, Number(value)));

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

function filterPath(path) {
  return String(path)
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}

function relativeWords(transcript, clipStart, clipEnd) {
  return (Array.isArray(transcript?.words) ? transcript.words : [])
    .map((item, index) => ({
      index,
      word: String(item.word ?? item.text ?? "").trim(),
      start: Number(item.start ?? 0) - clipStart,
      end: Number(item.end ?? item.start ?? 0) - clipStart,
    }))
    .filter(
      (item) =>
        item.word &&
        item.end > 0 &&
        item.start < clipEnd - clipStart,
    )
    .map((item) => ({
      ...item,
      start: clamp(item.start, 0, clipEnd - clipStart),
      end: clamp(item.end, 0, clipEnd - clipStart),
    }));
}

function snapRangeToWords(range, words, duration) {
  const inside = words.filter(
    (word) =>
      word.end > range.start - 0.18 &&
      word.start < range.end + 0.18,
  );
  if (!inside.length) {
    return {
      start: clamp(range.start, 0, duration),
      end: clamp(range.end, 0, duration),
      purpose: range.purpose || "build",
      reason: range.reason || "",
    };
  }
  return {
    start: clamp(Math.min(range.start, inside[0].start) - 0.04, 0, duration),
    end: clamp(Math.max(range.end, inside.at(-1).end) + 0.06, 0, duration),
    purpose: range.purpose || "build",
    reason: range.reason || "",
  };
}

function splitSilences(ranges, words, pacing) {
  if (pacing?.silence_trim === false || !words.length) return ranges;
  const threshold = clamp(pacing?.pause_threshold ?? 0.42, 0.28, 0.85);
  const output = [];

  for (const range of ranges) {
    const local = words.filter(
      (word) => word.end > range.start && word.start < range.end,
    );
    if (local.length < 2) {
      output.push(range);
      continue;
    }

    let cursor = range.start;
    for (let index = 1; index < local.length; index += 1) {
      const prev = local[index - 1];
      const next = local[index];
      const gap = next.start - prev.end;
      if (gap <= threshold) continue;

      const cutEnd = clamp(prev.end + 0.07, cursor, range.end);
      const nextStart = clamp(next.start - 0.07, range.start, range.end);

      if (cutEnd - cursor >= 0.45) {
        output.push({
          start: cursor,
          end: cutEnd,
          purpose: range.purpose,
          reason: `${range.reason || ""} silence_trim`.trim(),
        });
      }
      cursor = nextStart;
    }

    if (range.end - cursor >= 0.45) {
      output.push({
        start: cursor,
        end: range.end,
        purpose: range.purpose,
        reason: range.reason || "",
      });
    }
  }

  if (!output.length) return ranges;
  return output.slice(0, 28);
}

function normalizeContentRanges(plan, words, duration) {
  const requested = Array.isArray(plan?.content_timeline)
    ? plan.content_timeline
    : [];
  let ranges = requested
    .map((range) => ({
      start: clamp(range.start ?? 0, 0, duration),
      end: clamp(range.end ?? 0, 0, duration),
      purpose: range.purpose || "build",
      reason: range.reason || "",
    }))
    .filter((range) => range.end - range.start >= 0.35)
    .sort((a, b) => a.start - b.start);

  if (!ranges.length) {
    ranges = [{ start: 0, end: duration, purpose: "build", reason: "fallback" }];
  }

  ranges = ranges.map((range) =>
    snapRangeToWords(range, words, duration),
  );

  const monotonic = [];
  for (const range of ranges) {
    const previous = monotonic.at(-1);
    const start = previous
      ? Math.max(range.start, previous.end)
      : range.start;
    if (range.end - start >= 0.35) {
      monotonic.push({ ...range, start });
    }
  }

  return splitSilences(
    monotonic,
    words,
    plan?.pacing || {},
  );
}

function addOutputOffsets(ranges) {
  let cursor = 0;
  return ranges.map((range) => {
    const item = {
      ...range,
      output_start: cursor,
      output_end: cursor + (range.end - range.start),
    };
    cursor = item.output_end;
    return item;
  });
}

function retimeWords(words, ranges) {
  const mapped = [];
  const used = new Set();

  for (const range of ranges) {
    for (const word of words) {
      if (used.has(word.index)) continue;
      if (word.end <= range.start || word.start >= range.end) continue;

      const start =
        range.output_start +
        Math.max(0, word.start - range.start);
      const end =
        range.output_start +
        Math.min(range.end - range.start, word.end - range.start);

      if (end <= start) continue;
      used.add(word.index);
      mapped.push({
        word: word.word,
        start,
        end,
      });
    }
  }

  return mapped.sort((a, b) => a.start - b.start);
}

function sourceTimeToOutput(time, ranges) {
  for (const range of ranges) {
    if (time >= range.start && time <= range.end) {
      return range.output_start + (time - range.start);
    }
  }
  return null;
}

function cameraAt(camera, time) {
  if (!Array.isArray(camera) || !camera.length) {
    return {
      focus_x: 0.5,
      focus_y: 0.43,
      mode: "center",
      speaker_id: null,
      confidence: 0.2,
    };
  }
  let best = camera[0];
  let delta = Math.abs(Number(best.time || 0) - time);
  for (const point of camera) {
    const nextDelta = Math.abs(Number(point.time || 0) - time);
    if (nextDelta < delta) {
      best = point;
      delta = nextDelta;
    }
  }
  return best;
}

function beatAt(beats, start, end) {
  return (Array.isArray(beats) ? beats : [])
    .filter((beat) => beat.time >= start - 0.08 && beat.time < end + 0.08)
    .sort((a, b) => Number(b.strength || 0) - Number(a.strength || 0))[0] || null;
}

function buildShotBreaks(range, vision, plan) {
  const points = new Set([
    Number(range.start.toFixed(3)),
    Number(range.end.toFixed(3)),
  ]);

  const camera = Array.isArray(vision?.camera) ? vision.camera : [];
  let previousSpeaker = null;

  for (const point of camera) {
    const time = Number(point.time || 0);
    if (time <= range.start + 0.35 || time >= range.end - 0.35) continue;
    if (point.mode !== "speaker" || Number(point.confidence || 0) < 0.42) continue;
    const id = point.speaker_id ?? null;
    if (previousSpeaker !== null && id !== previousSpeaker) {
      points.add(Number(time.toFixed(3)));
    }
    previousSpeaker = id;
  }

  for (const beat of plan?.beats || []) {
    const time = Number(beat.time || 0);
    if (time > range.start + 0.35 && time < range.end - 0.35) {
      points.add(Number(time.toFixed(3)));
    }
  }

  const targetMax = clamp(plan?.pacing?.target_shot_max ?? 3.4, 1.8, 6.5);
  for (
    let time = range.start + targetMax;
    time < range.end - 0.45;
    time += targetMax
  ) {
    points.add(Number(time.toFixed(3)));
  }

  return [...points].sort((a, b) => a - b);
}

function zoomForShot(style, beat, index, mode, headlineActive) {
  if (mode === "group") return headlineActive ? 1.05 : 1.0;
  if (beat?.type === "punch_in") {
    return clamp(1.08 + Number(beat.strength || 0.6) * 0.08, 1.08, 1.16);
  }
  if (beat?.type === "punch_out") return 1.0;
  if (beat?.type === "reaction") return 1.09;

  const alternating = index % 2 === 1;
  if (style === "high_energy") return alternating ? 1.09 : 1.03;
  if (style === "news_react") return alternating ? 1.08 : 1.02;
  if (style === "podcast_dynamic") return alternating ? 1.065 : 1.015;
  return alternating ? 1.045 : 1.0;
}

function cropForShot(sourceMeta, focusX, focusY, zoom, headlineActive) {
  const sourceW = Number(sourceMeta.width || 0);
  const sourceH = Number(sourceMeta.height || 0);
  if (!sourceW || !sourceH) {
    throw new Error("V5 sem dimensoes validas da fonte");
  }

  const aspect = OUTPUT_W / OUTPUT_H;
  const sourceAspect = sourceW / sourceH;
  let baseW;
  let baseH;

  if (sourceAspect >= aspect) {
    baseH = sourceH;
    baseW = sourceH * aspect;
  } else {
    baseW = sourceW;
    baseH = sourceW / aspect;
  }

  let cropW = Math.floor((baseW / zoom) / 2) * 2;
  let cropH = Math.floor((baseH / zoom) / 2) * 2;
  cropW = Math.max(2, Math.min(sourceW - (sourceW % 2), cropW));
  cropH = Math.max(2, Math.min(sourceH - (sourceH % 2), cropH));

  const desiredY = headlineActive ? 0.58 : 0.50;
  const x = clamp(
    Number(focusX ?? 0.5) * sourceW - cropW * 0.5,
    0,
    Math.max(0, sourceW - cropW),
  );
  const y = clamp(
    Number(focusY ?? 0.43) * sourceH - cropH * desiredY,
    0,
    Math.max(0, sourceH - cropH),
  );

  return {
    cropW,
    cropH,
    x: Math.round(x),
    y: Math.round(y),
  };
}

function buildShots(ranges, vision, plan, sourceMeta) {
  const shots = [];
  const headlineEnd =
    plan?.headline?.enabled === true
      ? Number(plan.headline.duration || 0)
      : 0;
  let shotIndex = 0;

  for (const range of ranges) {
    const breaks = buildShotBreaks(range, vision, plan);
    for (let index = 0; index < breaks.length - 1; index += 1) {
      const start = breaks[index];
      const end = breaks[index + 1];
      if (end - start < 0.32) continue;

      const midpoint = (start + end) / 2;
      const camera = cameraAt(vision?.camera || [], midpoint);
      const beat = beatAt(plan?.beats || [], start, end);

      let focusX = Number(camera.focus_x ?? 0.5);
      let focusY = Number(camera.focus_y ?? 0.43);
      let mode = camera.mode || "speaker";

      if (
        beat?.type === "reaction" &&
        beat.focus_x != null &&
        beat.focus_y != null
      ) {
        focusX = Number(beat.focus_x);
        focusY = Number(beat.focus_y);
        mode = "reaction";
      } else if (beat?.type === "group") {
        mode = "group";
      }

      const outputStart =
        range.output_start + (start - range.start);
      const headlineActive = outputStart < headlineEnd;
      let zoom = zoomForShot(
        plan?.editing_style || "podcast_dynamic",
        beat,
        shotIndex,
        mode,
        headlineActive,
      );
      if (headlineActive) zoom = Math.max(zoom, 1.055);

      const crop = cropForShot(
        sourceMeta,
        focusX,
        focusY,
        zoom,
        headlineActive,
      );

      shots.push({
        source_start: start,
        source_end: end,
        output_start: outputStart,
        output_end: outputStart + (end - start),
        focus_x: focusX,
        focus_y: focusY,
        speaker_id: camera.speaker_id ?? null,
        confidence: Number(camera.confidence || 0),
        mode,
        beat_type: beat?.type || null,
        zoom: Number(zoom.toFixed(3)),
        ...crop,
      });
      shotIndex += 1;
    }
  }

  if (!shots.length) {
    throw new Error("V5 nao conseguiu montar shots");
  }
  return shots;
}

function groupWords(words, maxWords = 6, maxChars = 36, maxDuration = 2.4) {
  const groups = [];
  let current = [];

  const length = (items) =>
    items.map((item) => String(item.word || "")).join(" ").length;

  for (const word of words) {
    const previous = current.at(-1);
    const pause = previous ? word.start - previous.end : 0;
    const sentenceBreak =
      previous && /[.!?…]["')\]]?$/.test(previous.word);
    const proposed = [...current, word];
    const duration = current.length ? word.end - current[0].start : 0;

    if (
      current.length &&
      (
        current.length >= maxWords ||
        length(proposed) > maxChars ||
        duration > maxDuration ||
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

function breakIndex(group, maxLineChars = 21) {
  const full = group.map((item) => item.word).join(" ");
  if (full.length <= maxLineChars || group.length < 2) return -1;
  let best = 1;
  let score = Infinity;
  for (let index = 1; index < group.length; index += 1) {
    const left = group.slice(0, index).map((x) => x.word).join(" ").length;
    const right = group.slice(index).map((x) => x.word).join(" ").length;
    const overflow =
      Math.max(0, left - maxLineChars) +
      Math.max(0, right - maxLineChars);
    const candidate = overflow * 10 + Math.abs(left - right);
    if (candidate < score) {
      score = candidate;
      best = index;
    }
  }
  return best;
}

function phrase(group, activeIndex, activeColor = "&H0000D8FF&") {
  const parts = group.map((item, index) => {
    const word = escapeAss(item.word);
    if (index === activeIndex) {
      return `{\\c${activeColor}}${word}{\\c&H00FFFFFF&}`;
    }
    return word;
  });
  const at = breakIndex(group);
  if (at <= 0) return parts.join(" ");
  return `${parts.slice(0, at).join(" ")}\\N${parts.slice(at).join(" ")}`;
}

function wrapText(text, maxChars = 29) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const lines = [];
  let current = "";
  for (const word of words) {
    const proposed = current ? `${current} ${word}` : word;
    if (current && proposed.length > maxChars && lines.length < 2) {
      lines.push(current);
      current = word;
    } else {
      current = proposed;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3).map(escapeAss).join("\\N");
}

function headlineEvents(lines, headline, end) {
  if (!headline?.enabled || !headline?.text || end <= 0) return;
  const stop = assTime(end);
  const text = wrapText(
    headline.preset === "news_red_bar"
      ? String(headline.text).toUpperCase()
      : headline.text,
    headline.preset === "social_post" ? 38 : 31,
  );

  if (headline.preset === "social_post") {
    lines.push(
      `Dialogue: 0,${assTime(0)},${stop},Graphic,,0,0,0,,{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\1c&H00FFFFFF&}m 0 0 l 1080 0 l 1080 330 l 0 330`,
    );
    lines.push(
      `Dialogue: 2,${assTime(0)},${stop},SocialDot,,0,0,0,,●`,
    );
    if (headline.page_name) {
      lines.push(
        `Dialogue: 2,${assTime(0)},${stop},SocialMeta,,0,0,0,,${escapeAss(headline.page_name)}`,
      );
    }
    if (headline.handle) {
      lines.push(
        `Dialogue: 2,${assTime(0)},${stop},SocialHandle,,0,0,0,,${escapeAss(headline.handle)}`,
      );
    }
    lines.push(
      `Dialogue: 2,${assTime(0)},${stop},SocialHeadline,,0,0,0,,${text}`,
    );
  } else if (headline.preset === "bold_top_banner") {
    lines.push(
      `Dialogue: 0,${assTime(0)},${stop},Graphic,,0,0,0,,{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\1c&H00FFFFFF&}m 0 0 l 1080 0 l 1080 210 l 0 210`,
    );
    lines.push(
      `Dialogue: 2,${assTime(0)},${stop},BoldHeadline,,0,0,0,,${text}`,
    );
  } else if (headline.preset === "news_red_bar") {
    lines.push(
      `Dialogue: 0,${assTime(0)},${stop},Graphic,,0,0,0,,{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\1c&H002929E6&}m 0 0 l 1080 0 l 1080 180 l 0 180`,
    );
    lines.push(
      `Dialogue: 2,${assTime(0)},${stop},NewsHeadline,,0,0,0,,${text}`,
    );
  } else {
    lines.push(
      `Dialogue: 2,${assTime(0)},${stop},CleanHeadline,,0,0,0,,${text}`,
    );
  }
}

async function writeV5Ass({ outputPath, words, plan, duration }) {
  const caption = plan?.captions || {};
  const preset = caption.preset || "dynamic_active_word";
  const maxWords = Number(caption.max_words || 6);
  const groups = groupWords(
    words,
    maxWords,
    preset === "bold_phrase" ? 32 : 36,
    preset === "bold_phrase" ? 2.0 : 2.45,
  );
  const fontSize =
    preset === "bold_phrase" ? 72 :
      preset === "clean_phrase" ? 62 : 66;
  const marginV =
    caption.position === "lower" ? 245 :
      caption.position === "center_low" ? 385 : 315;

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
    `Style: Caption,Inter,${fontSize},&H00FFFFFF,&H0000D8FF,&H00101010,&H00000000,-1,0,0,0,100,100,0,0,1,4,1,2,90,90,${marginV},1`,
    "Style: Graphic,Inter,20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1",
    "Style: SocialDot,Inter,38,&H0067C84A,&H0067C84A,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,50,0,42,1",
    "Style: SocialMeta,Inter,30,&H00111111,&H00111111,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,105,0,38,1",
    "Style: SocialHandle,Inter,22,&H00777777,&H00777777,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,105,0,78,1",
    "Style: SocialHeadline,Inter,42,&H00111111,&H00111111,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,8,65,65,130,1",
    "Style: BoldHeadline,Inter,55,&H00000000,&H00000000,&H00FFFFFF,&H00000000,-1,-1,0,0,100,100,0,0,1,0,0,8,55,55,55,1",
    "Style: NewsHeadline,Inter,44,&H00FFFFFF,&H00FFFFFF,&H002929E6,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,8,55,55,42,1",
    "Style: CleanHeadline,Inter,52,&H00FFFFFF,&H00FFFFFF,&H00101010,&H00000000,-1,0,0,0,100,100,0,0,1,5,1,8,80,80,100,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  headlineEvents(
    lines,
    plan?.headline || {},
    Math.min(duration, Number(plan?.headline?.duration || 0)),
  );

  for (const group of groups) {
    if (preset === "clean_phrase") {
      const start = clamp(group[0].start, 0, duration);
      const end = clamp(group.at(-1).end + 0.08, start + 0.1, duration);
      const at = breakIndex(group);
      const text =
        at <= 0
          ? group.map((item) => escapeAss(item.word)).join(" ")
          : `${group.slice(0, at).map((item) => escapeAss(item.word)).join(" ")}\\N${group.slice(at).map((item) => escapeAss(item.word)).join(" ")}`;
      lines.push(
        `Dialogue: 1,${assTime(start)},${assTime(end)},Caption,,0,0,0,,${text}`,
      );
      continue;
    }

    for (let index = 0; index < group.length; index += 1) {
      const item = group[index];
      const next = group[index + 1];
      const start = clamp(item.start, 0, duration);
      const end = clamp(
        Math.max(item.end, next ? next.start : item.end + 0.08),
        start + 0.05,
        duration,
      );
      lines.push(
        `Dialogue: 1,${assTime(start)},${assTime(end)},Caption,,0,0,0,,${phrase(group, index)}`,
      );
    }
  }

  await writeFile(outputPath, lines.join("\n"), "utf8");
  return {
    preset,
    words: words.length,
    caption_groups: groups.length,
    headline: plan?.headline || { enabled: false, preset: "none" },
  };
}

function buildFilterComplex({
  shots,
  assPath,
  hasAudio,
}) {
  const count = shots.length;
  const filters = [];

  filters.push(
    `[0:v]split=${count}${shots.map((_, i) => `[vs${i}]`).join("")}`,
  );
  if (hasAudio) {
    filters.push(
      `[0:a]asplit=${count}${shots.map((_, i) => `[as${i}]`).join("")}`,
    );
  }

  shots.forEach((shot, index) => {
    filters.push(
      `[vs${index}]trim=start=${shot.source_start.toFixed(3)}:end=${shot.source_end.toFixed(3)},` +
      `setpts=PTS-STARTPTS,` +
      `crop=${shot.cropW}:${shot.cropH}:${shot.x}:${shot.y},` +
      `scale=${OUTPUT_W}:${OUTPUT_H}:flags=lanczos,setsar=1[v${index}]`,
    );
    if (hasAudio) {
      filters.push(
        `[as${index}]atrim=start=${shot.source_start.toFixed(3)}:end=${shot.source_end.toFixed(3)},` +
        `asetpts=PTS-STARTPTS[a${index}]`,
      );
    }
  });

  if (hasAudio) {
    filters.push(
      `${shots.map((_, i) => `[v${i}][a${i}]`).join("")}` +
      `concat=n=${count}:v=1:a=1[vcat][acat]`,
    );
    filters.push(
      `[vcat]subtitles='${filterPath(assPath)}',format=yuv420p[vout]`,
    );
    filters.push(
      `[acat]loudnorm=I=-16:TP=-1.5:LRA=11[aout]`,
    );
  } else {
    filters.push(
      `${shots.map((_, i) => `[v${i}]`).join("")}` +
      `concat=n=${count}:v=1:a=0[vcat]`,
    );
    filters.push(
      `[vcat]subtitles='${filterPath(assPath)}',format=yuv420p[vout]`,
    );
  }

  return filters.join(";");
}

async function runFfmpeg({
  master,
  output,
  clipStart,
  clipDuration,
  outputDuration,
  filterComplex,
  hasAudio,
  report,
}) {
  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    "-ss", String(clipStart),
    "-i", master,
    "-t", String(clipDuration),
    "-filter_complex", filterComplex,
    "-map", "[vout]",
  ];

  if (hasAudio) args.push("-map", "[aout]");

  args.push(
    "-c:v", "libx264",
    "-preset", process.env.V4_X264_PRESET || "superfast",
    "-crf", process.env.V4_X264_CRF || "28",
    "-pix_fmt", "yuv420p",
    "-threads", String(process.env.V4_FFMPEG_THREADS || 2),
  );

  if (hasAudio) {
    args.push("-c:a", "aac", "-b:a", "128k");
  } else {
    args.push("-an");
  }

  args.push(
    "-movflags", "+faststart",
    "-progress", "pipe:1",
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
          const parsed = Number(String(value).replace(/x$/i, ""));
          if (Number.isFinite(parsed)) speed = parsed;
        }
        if (key !== "out_time") continue;
        const match = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(value);
        if (!match) continue;
        const seconds =
          Number(match[1]) * 3600 +
          Number(match[2]) * 60 +
          Number(match[3]);
        const pct = clamp(
          (seconds / Math.max(0.1, outputDuration)) * 100,
          0,
          100,
        );
        if (Math.floor(pct) < lastPct + 2 && pct < 99.5) continue;
        lastPct = Math.floor(pct);
        report({
          phase: "render",
          phase_pct: pct,
          current: Number(seconds.toFixed(2)),
          total: Number(outputDuration.toFixed(2)),
          eta_seconds:
            speed && speed > 0
              ? Number(((outputDuration - seconds) / speed).toFixed(1))
              : null,
          detail:
            `V5 ${seconds.toFixed(1)}/${outputDuration.toFixed(1)}s` +
            (speed ? ` · ${speed.toFixed(2)}x` : ""),
        }).catch(() => {});
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
            `FFmpeg V5 falhou (${code}): ${stderr.slice(-2200)}`,
          ),
        );
      }
    });
  });
}

export async function renderEditorialV5({
  master,
  clip,
  revision,
  transcript,
  dir,
  sourceMeta,
  report,
}) {
  const clipStart = Number(
    revision?.parameters?.start_seconds ?? clip.start_seconds,
  );
  const clipEnd = Number(
    revision?.parameters?.end_seconds ?? clip.end_seconds,
  );
  const clipDuration = clipEnd - clipStart;
  if (!(clipDuration > 0)) throw new Error("V5: janela invalida");

  const v5 = revision?.parameters?.v5_plan;
  const plan = v5?.recommended;
  if (!plan) throw new Error("V5: plano semantico ausente");
  if (plan?.qa?.pass !== true) {
    throw new Error(
      `V5 semantic QA reprovou o corte: ${plan?.qa?.notes || "sem detalhes"}`,
    );
  }

  await report({
    phase: "vision",
    phase_pct: 0,
    detail: "LR-ASD identificando speakers para o V5",
  });

  const vision = await runVision({
    master,
    dir,
    startSeconds: clipStart,
    durationSeconds: clipDuration,
    report,
  });

  await report({
    phase: "timeline",
    phase_pct: 0,
    detail: "Montando timeline humana: cortes, reactions e punch-ins",
  });

  const sourceWords = relativeWords(
    transcript,
    clipStart,
    clipEnd,
  );
  const contentRanges = addOutputOffsets(
    normalizeContentRanges(
      plan,
      sourceWords,
      clipDuration,
    ),
  );
  const outputDuration =
    contentRanges.at(-1)?.output_end || clipDuration;

  if (outputDuration < 8 || outputDuration > 90) {
    throw new Error(
      `V5: duracao final fora do limite (${outputDuration.toFixed(2)}s)`,
    );
  }

  const shots = buildShots(
    contentRanges,
    vision,
    plan,
    sourceMeta,
  );

  const retimedWords = retimeWords(
    sourceWords,
    contentRanges,
  );

  const assPath = join(
    dir,
    `${revision.id}-captions-v5.ass`,
  );
  const output = join(
    dir,
    `${revision.id}-ai-editor-v5.mp4`,
  );

  await report({
    phase: "timeline",
    phase_pct: 100,
    current: shots.length,
    total: shots.length,
    detail:
      `${shots.length} shots · ${contentRanges.length} blocos de conteudo · ${outputDuration.toFixed(1)}s`,
  });

  await report({
    phase: "captions",
    phase_pct: 0,
    detail: `Legenda V5 + headline ${plan?.headline?.preset || "none"}`,
  });

  const captionMeta = await writeV5Ass({
    outputPath: assPath,
    words: retimedWords,
    plan,
    duration: outputDuration,
  });

  await report({
    phase: "captions",
    phase_pct: 100,
    detail:
      `${captionMeta.words} palavras · ${captionMeta.caption_groups} grupos`,
  });

  const filterComplex = buildFilterComplex({
    shots,
    assPath,
    hasAudio: Boolean(sourceMeta.hasAudio),
  });

  await report({
    phase: "render",
    phase_pct: 0,
    detail:
      `V5 hard-cut renderer · ${shots.length} decisões visuais`,
  });

  await runFfmpeg({
    master,
    output,
    clipStart,
    clipDuration,
    outputDuration,
    filterComplex,
    hasAudio: Boolean(sourceMeta.hasAudio),
    report,
  });

  const uploadBudget = await ensureUploadBudget({
    output,
    durationSeconds: outputDuration,
    hasAudio: Boolean(sourceMeta.hasAudio),
    report,
  });

  await report({
    phase: "render",
    phase_pct: 100,
    detail: "V5 encode concluido",
  });

  return {
    out: output,
    parameters: {
      ...(revision.parameters || {}),
      editor: "ai_editor_v5_semantic_multimodal",
      editor_version: 5,
      renderer: "ffmpeg_hardcut_v5",
      vision_backend: vision.vision_backend,
      vision_stats: vision.stats,
      v5_runtime: {
        editing_style: plan.editing_style,
        viral_score: plan.viral_score,
        qa: plan.qa,
        source_duration_seconds: clipDuration,
        output_duration_seconds: outputDuration,
        removed_seconds: Math.max(
          0,
          Number((clipDuration - outputDuration).toFixed(3)),
        ),
        content_ranges: contentRanges,
        shot_count: shots.length,
        shots,
        headline: plan.headline,
        captions: captionMeta,
        alternatives_available:
          Array.isArray(v5?.alternatives)
            ? v5.alternatives.map((item) => item.id)
            : [],
      },
      upload_budget: uploadBudget,
      effective_start_seconds: clipStart,
      effective_end_seconds: clipEnd,
    },
  };
}


export const __v5Test = {
  relativeWords,
  normalizeContentRanges,
  addOutputOffsets,
  retimeWords,
  sourceTimeToOutput,
  buildShots,
  cropForShot,
};
