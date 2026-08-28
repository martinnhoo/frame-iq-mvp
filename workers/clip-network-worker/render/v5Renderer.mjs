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
      speaker_id:
        item.speaker_id ?? item.speaker ?? null,
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
  // Story-first default: pauses are part of delivery/comedic timing.
  // Internal silence removal is opt-in only, never implicit.
  if (
    pacing?.silence_trim !== true ||
    pacing?.aggressive_silence_trim !== true ||
    !words.length
  ) {
    return ranges;
  }

  const threshold = clamp(
    pacing?.pause_threshold ?? 1.4,
    1.2,
    2.8,
  );
  const output = [];
  let trims = 0;

  for (const range of ranges) {
    // Never micro-cut payoff/reaction/story ranges.
    if (["payoff", "reaction", "story"].includes(String(range.purpose))) {
      output.push(range);
      continue;
    }

    const local = words.filter(
      (word) => word.end > range.start && word.start < range.end,
    );
    if (local.length < 2) {
      output.push(range);
      continue;
    }

    let cursor = range.start;
    for (let index = 1; index < local.length; index += 1) {
      if (trims >= 4) break;
      const prev = local[index - 1];
      const next = local[index];
      const gap = next.start - prev.end;
      if (gap < threshold) continue;

      const cutEnd = clamp(prev.end + 0.28, cursor, range.end);
      const nextStart = clamp(next.start - 0.28, range.start, range.end);

      // Only remove a genuinely long dead gap.
      if (nextStart - cutEnd < 0.7) continue;

      if (cutEnd - cursor >= 0.75) {
        output.push({
          start: cursor,
          end: cutEnd,
          purpose: range.purpose,
          reason: `${range.reason || ""} long_dead_pause_trim`.trim(),
        });
      }
      cursor = nextStart;
      trims += 1;
    }

    if (range.end - cursor >= 0.75) {
      output.push({
        start: cursor,
        end: range.end,
        purpose: range.purpose,
        reason: range.reason || "",
      });
    }
  }

  return output.length ? output : ranges;
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
        speaker_id: word.speaker_id ?? null,
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

// V5.1 speaker-safe captions: preserve audio diarization and use LR-ASD only when audio speaker is unknown.
function attachVisionSpeakers(words, vision) {
  return words.map((word) => {
    if (
      word.speaker_id !== null &&
      word.speaker_id !== undefined &&
      String(word.speaker_id) !== "" &&
      String(word.speaker_id) !== "unknown"
    ) {
      return word;
    }

    const midpoint =
      (Number(word.start || 0) + Number(word.end || word.start || 0)) / 2;
    const camera = cameraAt(vision?.camera || [], midpoint);
    const speakerId =
      camera.mode === "speaker" &&
      camera.speaker_id !== null &&
      camera.speaker_id !== undefined &&
      Number(camera.confidence || 0) >= 0.42
        ? `vision:${camera.speaker_id}`
        : null;

    return {
      ...word,
      speaker_id: speakerId,
    };
  });
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
  let lastSpeakerCut = range.start;

  // Speaker changes are cues, not automatic edit points.
  for (const point of camera) {
    const time = Number(point.time || 0);
    if (time <= range.start + 0.7 || time >= range.end - 0.7) continue;
    if (point.mode !== "speaker" || Number(point.confidence || 0) < 0.55) continue;

    const id = point.speaker_id ?? null;
    if (
      previousSpeaker !== null &&
      id !== previousSpeaker &&
      time - lastSpeakerCut >= 1.35
    ) {
      points.add(Number(time.toFixed(3)));
      lastSpeakerCut = time;
    }
    previousSpeaker = id;
  }

  // Semantic beats are allowed, but still avoid jitter.
  let lastBeatCut = range.start;
  for (const beat of plan?.beats || []) {
    const time = Number(beat.time || 0);
    if (time <= range.start + 0.7 || time >= range.end - 0.7) continue;
    if (time - lastBeatCut < 1.1) continue;
    points.add(Number(time.toFixed(3)));
    lastBeatCut = time;
  }

  // Only protect against shots becoming excessively long.
  const targetMax = clamp(
    plan?.pacing?.target_shot_max ?? 4.8,
    3.8,
    8.0,
  );
  for (
    let time = range.start + targetMax;
    time < range.end - 0.9;
    time += targetMax
  ) {
    const near = [...points].some((p) => Math.abs(p - time) < 0.85);
    if (!near) points.add(Number(time.toFixed(3)));
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

function cropForShot(
  sourceMeta,
  focusX,
  focusY,
  zoom,
  headlineActive,
  targetHeight = OUTPUT_H,
) {
  const sourceW = Number(sourceMeta.width || 0);
  const sourceH = Number(sourceMeta.height || 0);
  if (!sourceW || !sourceH) {
    throw new Error("V5 sem dimensoes validas da fonte");
  }

  const aspect = OUTPUT_W / Math.max(2, Number(targetHeight || OUTPUT_H));
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

  const desiredY = 0.50;
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
  const headlineLayout = buildHeadlineLayout(plan?.headline || {});
  const bodyHeight =
    headlineLayout.enabled && headlineLayout.preset === "media_split"
      ? 1140
      : headlineLayout.enabled &&
          ["viral_headline", "news_page"].includes(headlineLayout.preset)
        ? OUTPUT_H - Number(headlineLayout.panel_height || 0)
        : OUTPUT_H;
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
      const headlineActive = headlineLayout.enabled;
      let zoom = zoomForShot(
        plan?.editing_style || "podcast_dynamic",
        beat,
        shotIndex,
        mode,
        headlineActive,
      );
      // Headline must not force a camera zoom.

      const crop = cropForShot(
        sourceMeta,
        focusX,
        focusY,
        zoom,
        headlineActive,
        bodyHeight,
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
        body_height: bodyHeight,
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
    const speakerBreak =
      previous &&
      previous.speaker_id !== null &&
      previous.speaker_id !== undefined &&
      word.speaker_id !== null &&
      word.speaker_id !== undefined &&
      String(previous.speaker_id) !== String(word.speaker_id);

    if (
      current.length &&
      (
        speakerBreak ||
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

// V5.1.1 deterministic caption scheduler:
// - no overlap between caption groups
// - hard speaker boundaries
// - max 4 words
// - one active ASS caption event at any instant
function breakIndex(group, maxLineChars = 19) {
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
    const orphanPenalty =
      group.length >= 3 && (index === 1 || index === group.length - 1)
        ? 18
        : 0;
    const candidate =
      overflow * 10 +
      Math.abs(left - right) +
      orphanPenalty;
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

const toCs = (seconds) =>
  Math.max(0, Math.round(Number(seconds || 0) * 100));
const fromCs = (value) => Math.max(0, Number(value || 0) / 100);

function buildCaptionSchedule(groups, duration) {
  const durationCs = Math.max(1, Math.floor(Number(duration || 0) * 100));
  const events = [];
  const groupWindows = [];
  let cursorCs = 0;

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    if (!group?.length) continue;

    const rawStartCs = toCs(group[0].start);
    const nextRawStartCs =
      groupIndex + 1 < groups.length
        ? toCs(groups[groupIndex + 1][0].start)
        : durationCs + 1;

    const startCs = Math.max(cursorCs, rawStartCs);
    const naturalEndCs = Math.max(
      startCs + 1,
      toCs(Number(group.at(-1).end || 0) + 0.03),
    );

    // Reserve 10 ms before the next caption group. This is deliberate:
    // ASS/libass rounding can otherwise display both groups on one frame.
    const hardBoundaryCs =
      nextRawStartCs > startCs + 1
        ? nextRawStartCs - 1
        : nextRawStartCs;

    const endCs = Math.min(
      durationCs,
      naturalEndCs,
      Math.max(startCs + 1, hardBoundaryCs),
    );

    if (endCs <= startCs) continue;

    const groupEvents = [];
    let wordCursorCs = startCs;

    for (let index = 0; index < group.length; index += 1) {
      const item = group[index];
      const start = Math.max(wordCursorCs, toCs(item.start), startCs);
      if (start >= endCs) break;

      const next = group[index + 1];
      const requestedEnd =
        next
          ? Math.max(start + 1, toCs(next.start))
          : endCs;
      const end = Math.min(endCs, requestedEnd);
      if (end <= start) continue;

      const event = {
        group_index: groupIndex,
        active_index: index,
        start_cs: start,
        end_cs: end,
        start: fromCs(start),
        end: fromCs(end),
        group,
      };
      events.push(event);
      groupEvents.push(event);
      wordCursorCs = end;
    }

    const renderedStartCs = groupEvents[0]?.start_cs ?? startCs;
    const renderedEndCs = groupEvents.at(-1)?.end_cs ?? endCs;
    groupWindows.push({
      group_index: groupIndex,
      start_cs: renderedStartCs,
      end_cs: renderedEndCs,
      start: fromCs(renderedStartCs),
      end: fromCs(renderedEndCs),
      group,
    });

    cursorCs = renderedEndCs + 1;
  }

  let overlapCount = 0;
  for (let index = 1; index < events.length; index += 1) {
    if (events[index].start_cs < events[index - 1].end_cs) {
      overlapCount += 1;
    }
  }

  if (overlapCount > 0) {
    throw new Error(
      `V5.1.1 caption scheduler gerou ${overlapCount} overlaps`,
    );
  }

  return {
    events,
    group_windows: groupWindows,
    overlap_count: overlapCount,
  };
}

function headlineLines(text, maxChars, maxLines) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines = [];
  let current = "";

  for (const word of words) {
    const proposed = current ? `${current} ${word}` : word;
    if (current && proposed.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = proposed;
    }
  }
  if (current) lines.push(current);

  // Avoid a one-word orphan when there is room to rebalance.
  if (
    lines.length >= 2 &&
    lines.at(-1).split(/\s+/).length === 1
  ) {
    const prevWords = lines.at(-2).split(/\s+/);
    if (prevWords.length >= 3) {
      const moved = prevWords.pop();
      lines[lines.length - 2] = prevWords.join(" ");
      lines[lines.length - 1] = `${moved} ${lines.at(-1)}`;
    }
  }

  if (lines.length > maxLines) return [];
  return lines;
}

function buildHeadlineLayout(headline) {
  if (!headline?.enabled || !headline?.text) {
    return {
      enabled: false,
      preset: "none",
      text: "",
      safe: true,
      reason: "disabled",
      duration: 0,
    };
  }

  const allowed = new Set([
    "news_page",
    "viral_headline",
    "media_split",
  ]);
  const preset = allowed.has(String(headline.preset))
    ? String(headline.preset)
    : "viral_headline";
  const emoji = String(headline.emoji || "").trim();
  const uppercase =
    preset === "viral_headline" || preset === "media_split";
  const baseText = uppercase
    ? String(headline.text).toUpperCase()
    : String(headline.text);
  const displayText =
    emoji && !baseText.includes(emoji)
      ? `${baseText} ${emoji}`
      : baseText;

  const config =
    preset === "news_page"
      ? {
          maxChars: 34,
          maxLines: 3,
          fontSize: displayText.length <= 42 ? 48 : 43,
          minFontSize: 40,
        }
      : preset === "media_split"
        ? {
            maxChars: 34,
            maxLines: 2,
            fontSize: displayText.length <= 38 ? 46 : 40,
            minFontSize: 36,
          }
        : {
            maxChars: 27,
            maxLines: 2,
            fontSize: displayText.length <= 30 ? 62 : 54,
            minFontSize: 48,
          };

  let lines = headlineLines(
    displayText,
    config.maxChars,
    config.maxLines,
  );
  let fontSize = config.fontSize;
  let maxChars = config.maxChars;

  while (!lines.length && fontSize > config.minFontSize) {
    fontSize -= 2;
    maxChars += 2;
    lines = headlineLines(displayText, maxChars, config.maxLines);
  }

  if (!lines.length) {
    return {
      enabled: false,
      preset: "none",
      text: "",
      safe: false,
      reason: "overflow",
      duration: 0,
      source_preset: preset,
    };
  }

  const panelHeight =
    preset === "news_page"
      ? clamp(88 + lines.length * 60, 170, 270)
      : preset === "viral_headline"
        ? clamp(45 + lines.length * 68, 120, 195)
        : 140;

  return {
    ...headline,
    enabled: true,
    preset,
    display_text: displayText,
    lines,
    font_size: fontSize,
    panel_height: panelHeight,
    safe: true,
    reason: "ok",
  };
}

function headlineEvents(lines, headlineLayout, end) {
  if (!headlineLayout?.enabled || end <= 0) return;
  const stop = assTime(end);
  const text = headlineLayout.lines.map(escapeAss).join("\\N");

  if (headlineLayout.preset === "news_page") {
    const height = Number(headlineLayout.panel_height || 220);
    lines.push(
      `Dialogue: 0,${assTime(0)},${stop},Graphic,,0,0,0,,{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\1c&H00FFFFFF&}m 0 0 l 1080 0 l 1080 ${height} l 0 ${height}`,
    );
    lines.push(
      `Dialogue: 3,${assTime(0)},${stop},NewsPageLabel,,0,0,0,,{\\an7\\pos(52,28)}●  ${escapeAss(headlineLayout.page_name || "FRAMEIQ CORTES")}`,
    );
    lines.push(
      `Dialogue: 3,${assTime(0)},${stop},NewsPageHeadline,,0,0,0,,{\\an8\\pos(540,${Math.round(height * 0.62)})\\fs${headlineLayout.font_size}}${text}`,
    );
    return;
  }

  if (headlineLayout.preset === "viral_headline") {
    const height = Number(headlineLayout.panel_height || 175);
    lines.push(
      `Dialogue: 0,${assTime(0)},${stop},Graphic,,0,0,0,,{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\1c&H00FFFFFF&}m 0 0 l 1080 0 l 1080 ${height} l 0 ${height}`,
    );
    lines.push(
      `Dialogue: 3,${assTime(0)},${stop},ViralHeadline,,0,0,0,,{\\an8\\pos(540,${Math.round(height / 2)})\\fs${headlineLayout.font_size}}${text}`,
    );
    return;
  }

  if (headlineLayout.preset === "media_split") {
    lines.push(
      `Dialogue: 0,${assTime(0)},${stop},Graphic,,0,0,0,,{\\an7\\pos(0,1140)\\p1\\bord0\\shad0\\1c&H002B1DE2&}m 0 0 l 1080 0 l 1080 140 l 0 140`,
    );
    lines.push(
      `Dialogue: 3,${assTime(0)},${stop},MediaHeadline,,0,0,0,,{\\an5\\pos(540,1210)\\fs${headlineLayout.font_size}}${text}`,
    );
  }
}

async function writeV5Ass({ outputPath, words, plan, duration }) {
  const caption = plan?.captions || {};
  const preset = caption.preset || "dynamic_active_word";
  const requestedMaxWords = Number(caption.max_words || 4);
  const maxWords = Math.min(4, Math.max(2, requestedMaxWords));
  const groups = groupWords(
    words,
    maxWords,
    28,
    1.9,
  );
  const schedule = buildCaptionSchedule(groups, duration);
  const headlineLayout = buildHeadlineLayout(plan?.headline || {});
  const mediaSplit =
    headlineLayout.enabled &&
    headlineLayout.preset === "media_split";

  const fontSize =
    preset === "bold_phrase" ? 64 :
      preset === "clean_phrase" ? 58 : 60;
  const marginV =
    mediaSplit ? 830 :
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
    "Style: NewsPageLabel,Inter,27,&H00252525,&H00252525,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1",
    "Style: NewsPageHeadline,Inter,48,&H00101010,&H00101010,&H00000000,&H00000000,-1,0,0,0,100,100,-0.4,0,1,0,0,8,60,60,0,1",
    "Style: ViralHeadline,DejaVu Sans Condensed,58,&H00101010,&H00101010,&H00000000,&H00000000,-1,-1,0,0,104,100,-0.9,0,1,0,0,8,48,48,0,1",
    "Style: MediaHeadline,DejaVu Sans Condensed,44,&H00FFFFFF,&H00FFFFFF,&H00101010,&H00000000,-1,0,0,0,100,100,-0.2,0,1,2,0,5,45,45,0,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  headlineEvents(
    lines,
    headlineLayout,
    headlineLayout.enabled ? duration : 0,
  );

  if (preset === "clean_phrase") {
    for (const window of schedule.group_windows) {
      const group = window.group;
      const at = breakIndex(group);
      const text =
        at <= 0
          ? group.map((item) => escapeAss(item.word)).join(" ")
          : `${group.slice(0, at).map((item) => escapeAss(item.word)).join(" ")}\\N${group.slice(at).map((item) => escapeAss(item.word)).join(" ")}`;
      lines.push(
        `Dialogue: 1,${assTime(window.start)},${assTime(window.end)},Caption,,0,0,0,,${text}`,
      );
    }
  } else {
    for (const event of schedule.events) {
      lines.push(
        `Dialogue: 1,${assTime(event.start)},${assTime(event.end)},Caption,,0,0,0,,${phrase(event.group, event.active_index)}`,
      );
    }
  }

  await writeFile(outputPath, lines.join("\n"), "utf8");

  const speakerIds = [
    ...new Set(
      words
        .map((word) => word.speaker_id)
        .filter((value) => value !== null && value !== undefined && String(value) !== ""),
    ),
  ];
  let speakerSwitches = 0;
  for (let index = 1; index < words.length; index += 1) {
    const previous = words[index - 1].speaker_id;
    const current = words[index].speaker_id;
    if (
      previous !== null &&
      previous !== undefined &&
      current !== null &&
      current !== undefined &&
      String(previous) !== String(current)
    ) {
      speakerSwitches += 1;
    }
  }

  return {
    version: "5.2",
    preset,
    words: words.length,
    caption_groups: groups.length,
    caption_events: schedule.events.length,
    caption_overlap_count: schedule.overlap_count,
    max_words_per_group:
      groups.length
        ? Math.max(...groups.map((group) => group.length))
        : 0,
    speaker_count: speakerIds.length,
    speaker_switches: speakerSwitches,
    speaker_safe: true,
    one_caption_at_a_time: schedule.overlap_count === 0,
    headline: {
      ...headlineLayout,
      duration: headlineLayout.enabled ? duration : 0,
    },
    caption_font_size: fontSize,
    caption_margin_v: marginV,
    caption_probe_times: schedule.events
      .filter((event) => event.end - event.start >= 0.04)
      .map((event) => Number(((event.start + event.end) / 2).toFixed(3)))
      .slice(0, 40),
  };
}

function buildFilterComplex({
  shots,
  assPath,
  hasAudio,
  headlineLayout,
  outputDuration,
}) {
  const count = shots.length;
  const filters = [];
  const bodyHeight = Number(shots[0]?.body_height || OUTPUT_H);
  const scaleFlags = process.env.V5_SCALE_FLAGS || "bicubic";

  shots.forEach((shot, index) => {
    filters.push(
      `[${index}:v]setpts=PTS-STARTPTS,` +
      `crop=${shot.cropW}:${shot.cropH}:${shot.x}:${shot.y},` +
      `scale=${OUTPUT_W}:${bodyHeight}:flags=${scaleFlags},setsar=1[v${index}]`,
    );
    if (hasAudio) {
      filters.push(
        `[${index}:a]asetpts=PTS-STARTPTS,aresample=async=1:first_pts=0[a${index}]`,
      );
    }
  });

  if (hasAudio) {
    filters.push(
      `${shots.map((_, i) => `[v${i}][a${i}]`).join("")}` +
      `concat=n=${count}:v=1:a=1[vcat][acat]`,
    );
  } else {
    filters.push(
      `${shots.map((_, i) => `[v${i}]`).join("")}` +
      `concat=n=${count}:v=1:a=0[vcat]`,
    );
  }

  let videoLabel = "[vcat]";
  if (headlineLayout?.enabled && headlineLayout.preset === "media_split") {
    const d = Math.max(0.1, Number(outputDuration || 0)).toFixed(3);
    const supportingIndex = shots.length;
    filters.push(
      `[${supportingIndex}:v]scale=1080:640:force_original_aspect_ratio=increase,crop=1080:640,trim=duration=${d},setpts=PTS-STARTPTS,setsar=1[vbottom]`,
    );
    filters.push(
      `color=c=0xE21D2B:s=1080x140:r=25:d=${d}[vbar]`,
    );
    filters.push(
      "[vcat][vbar][vbottom]vstack=inputs=3[vlayout]",
    );
    videoLabel = "[vlayout]";
  } else if (
    headlineLayout?.enabled &&
    ["viral_headline", "news_page"].includes(headlineLayout.preset)
  ) {
    const d = Math.max(0.1, Number(outputDuration || 0)).toFixed(3);
    const panelHeight = Number(headlineLayout.panel_height || 0);
    filters.push(
      `color=c=0x000000:s=${OUTPUT_W}x${OUTPUT_H}:r=30:d=${d}[vcanvas]`,
    );
    filters.push(
      `[vcanvas][vcat]overlay=0:${panelHeight}:shortest=1[vlayout]`,
    );
    videoLabel = "[vlayout]";
  }

  filters.push(
    `${videoLabel}subtitles='${filterPath(assPath)}',format=yuv420p[vout]`,
  );

  if (hasAudio) {
    filters.push(
      "[acat]loudnorm=I=-16:TP=-1.5:LRA=11[aout]",
    );
  }

  return filters.join(";");
}

async function runFfmpeg({
  master,
  output,
  clipStart,
  outputDuration,
  filterComplex,
  hasAudio,
  shots,
  supportingFrame = null,
  report,
}) {
  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
  ];

  for (const shot of shots) {
    const duration = Math.max(
      0.05,
      Number(shot.source_end) - Number(shot.source_start),
    );
    args.push(
      "-ss", String(clipStart + Number(shot.source_start)),
      "-t", String(duration),
      "-i", master,
    );
  }

  if (supportingFrame) {
    args.push(
      "-loop", "1",
      "-framerate", "25",
      "-i", supportingFrame,
    );
  }

  args.push(
    "-filter_complex", filterComplex,
    "-map", "[vout]",
  );

  if (hasAudio) args.push("-map", "[aout]");

  args.push(
    "-c:v", "libx264",
    "-preset", process.env.V5_X264_PRESET || process.env.V4_X264_PRESET || "superfast",
    "-crf", process.env.V5_X264_CRF || process.env.V4_X264_CRF || "26",
    "-pix_fmt", "yuv420p",
    "-threads", String(process.env.V5_FFMPEG_THREADS || process.env.V4_FFMPEG_THREADS || 2),
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

  const startedAt = Date.now();
  let finalSpeed = null;

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
          if (Number.isFinite(parsed)) {
            speed = parsed;
            finalSpeed = parsed;
          }
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

  return {
    elapsed_ms: Date.now() - startedAt,
    speed_x: Number.isFinite(finalSpeed)
      ? Number(finalSpeed.toFixed(3))
      : null,
    input_strategy: "bounded_input_per_shot",
    shot_inputs: shots.length,
  };
}

function frameForOutputTime(shots, outputTime) {
  return shots.find(
    (shot) =>
      outputTime >= Number(shot.output_start) &&
      outputTime < Number(shot.output_end),
  ) || shots.at(-1) || null;
}

function chooseProbeTime(candidates, shots, duration) {
  for (const raw of candidates || []) {
    const time = clamp(raw, 0.08, Math.max(0.08, duration - 0.08));
    const shot = frameForOutputTime(shots, time);
    if (!shot) continue;
    const distance = Math.min(
      time - Number(shot.output_start),
      Number(shot.output_end) - time,
    );
    if (distance >= 0.08) return { time, shot };
  }
  const time = clamp(duration * 0.5, 0.08, Math.max(0.08, duration - 0.08));
  const shot = frameForOutputTime(shots, time);
  return shot ? { time, shot } : null;
}

function readRawFrame(args, label) {
  const expectedBytes = OUTPUT_W * OUTPUT_H * 3;
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks = [];
    let size = 0;
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      chunks.push(chunk);
      size += chunk.length;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(`${label} falhou (${code}): ${stderr.slice(-1200)}`),
        );
        return;
      }
      const frame = Buffer.concat(chunks, size);
      if (frame.length !== expectedBytes) {
        reject(
          new Error(
            `${label} retornou ${frame.length} bytes; esperado ${expectedBytes}`,
          ),
        );
        return;
      }
      resolve(frame);
    });
  });
}

async function renderedFrame(output, time) {
  return readRawFrame(
    [
      "-hide_banner", "-loglevel", "error",
      "-ss", String(time),
      "-i", output,
      "-frames:v", "1",
      "-vf", `scale=${OUTPUT_W}:${OUTPUT_H}:flags=bilinear`,
      "-pix_fmt", "rgb24",
      "-f", "rawvideo",
      "pipe:1",
    ],
    "QA frame renderizado",
  );
}

async function cleanReferenceFrame({
  master,
  clipStart,
  probe,
  headlineLayout,
}) {
  const shot = probe.shot;
  const sourceTime =
    clipStart +
    Number(shot.source_start) +
    (probe.time - Number(shot.output_start));
  const bodyHeight = Number(shot.body_height || OUTPUT_H);
  const filters = [
    `crop=${shot.cropW}:${shot.cropH}:${shot.x}:${shot.y}`,
    `scale=${OUTPUT_W}:${bodyHeight}:flags=${process.env.V5_SCALE_FLAGS || "bicubic"}`,
  ];

  if (bodyHeight < OUTPUT_H) {
    const top =
      headlineLayout?.enabled &&
      ["viral_headline", "news_page"].includes(headlineLayout.preset)
        ? Number(headlineLayout.panel_height || 0)
        : 0;
    filters.push(
      `pad=${OUTPUT_W}:${OUTPUT_H}:0:${top}:color=black`,
    );
  }

  return readRawFrame(
    [
      "-hide_banner", "-loglevel", "error",
      "-ss", String(sourceTime),
      "-i", master,
      "-frames:v", "1",
      "-vf", filters.join(","),
      "-pix_fmt", "rgb24",
      "-f", "rawvideo",
      "pipe:1",
    ],
    "QA frame de referencia",
  );
}

function regionDiff(rendered, reference, region) {
  const x0 = Math.max(0, Math.floor(region.x));
  const y0 = Math.max(0, Math.floor(region.y));
  const x1 = Math.min(OUTPUT_W, Math.ceil(region.x + region.width));
  const y1 = Math.min(OUTPUT_H, Math.ceil(region.y + region.height));
  let absolute = 0;
  let changed = 0;
  let pixels = 0;

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = (y * OUTPUT_W + x) * 3;
      const dr = Math.abs(rendered[offset] - reference[offset]);
      const dg = Math.abs(rendered[offset + 1] - reference[offset + 1]);
      const db = Math.abs(rendered[offset + 2] - reference[offset + 2]);
      const peak = Math.max(dr, dg, db);
      absolute += dr + dg + db;
      if (peak >= 30) changed += 1;
      pixels += 1;
    }
  }

  return {
    mean_absolute_difference:
      pixels > 0 ? Number((absolute / (pixels * 3)).toFixed(3)) : 0,
    changed_pixel_ratio:
      pixels > 0 ? Number((changed / pixels).toFixed(5)) : 0,
    pixels,
  };
}

async function verifyBurnedOverlays({
  output,
  master,
  clipStart,
  outputDuration,
  shots,
  captionMeta,
}) {
  const headlineLayout = captionMeta?.headline || {};
  const checks = {};

  if (captionMeta?.words > 0) {
    const probe = chooseProbeTime(
      captionMeta.caption_probe_times,
      shots,
      outputDuration,
    );
    if (!probe) throw new Error("QA visual: sem frame de fala para validar legenda");
    const [rendered, reference] = await Promise.all([
      renderedFrame(output, probe.time),
      cleanReferenceFrame({ master, clipStart, probe, headlineLayout }),
    ]);
    const baselineY = OUTPUT_H - Number(captionMeta.caption_margin_v || 315);
    const fontSize = Number(captionMeta.caption_font_size || 60);
    const diff = regionDiff(rendered, reference, {
      x: 45,
      y: baselineY - fontSize * 2.8,
      width: OUTPUT_W - 90,
      height: fontSize * 3.25,
    });
    checks.caption = { probe_time: probe.time, ...diff };
    if (
      diff.changed_pixel_ratio < 0.0025 ||
      diff.mean_absolute_difference < 0.45
    ) {
      throw new Error(
        `QA visual: legenda nao apareceu no MP4 final (${JSON.stringify(diff)})`,
      );
    }
  }

  if (headlineLayout.enabled) {
    const probe = chooseProbeTime(
      [Math.min(0.8, outputDuration * 0.25), 0.25],
      shots,
      outputDuration,
    );
    if (!probe) throw new Error("QA visual: sem frame para validar headline");
    const [rendered, reference] = await Promise.all([
      renderedFrame(output, probe.time),
      cleanReferenceFrame({ master, clipStart, probe, headlineLayout }),
    ]);
    const region =
      headlineLayout.preset === "media_split"
        ? { x: 0, y: 1140, width: OUTPUT_W, height: 140 }
        : {
            x: 0,
            y: 0,
            width: OUTPUT_W,
            height: Number(headlineLayout.panel_height || 190),
          };
    const diff = regionDiff(rendered, reference, region);
    checks.headline = { probe_time: probe.time, ...diff };
    if (
      diff.changed_pixel_ratio < 0.03 ||
      diff.mean_absolute_difference < 2
    ) {
      throw new Error(
        `QA visual: headline nao apareceu no MP4 final (${JSON.stringify(diff)})`,
      );
    }
  }

  return {
    version: 1,
    passed: true,
    method: "decoded_final_mp4_vs_clean_source_roi",
    checks,
  };
}


function selectSupportingFrameTime(plan, vision, duration) {
  const safeDuration = Math.max(0.5, Number(duration || 0));
  const reaction = (Array.isArray(plan?.beats) ? plan.beats : [])
    .filter(
      (beat) =>
        beat?.type === "reaction" &&
        Number(beat.time) >= 0.25 &&
        Number(beat.time) <= safeDuration - 0.25,
    )
    .sort((a, b) => Number(b.strength || 0) - Number(a.strength || 0))[0];

  if (reaction) {
    return clamp(Number(reaction.time), 0.25, safeDuration - 0.25);
  }

  const camera = (Array.isArray(vision?.camera) ? vision.camera : [])
    .filter(
      (point) =>
        Number(point.time) >= 0.25 &&
        Number(point.time) <= safeDuration - 0.25,
    )
    .sort(
      (a, b) =>
        Number(b.confidence || 0) -
        Number(a.confidence || 0),
    )[0];

  if (camera) {
    return clamp(Number(camera.time), 0.25, safeDuration - 0.25);
  }

  return clamp(
    Math.min(2, safeDuration * 0.33),
    0.25,
    Math.max(0.25, safeDuration - 0.25),
  );
}

async function extractSupportingFrame({
  master,
  absoluteTime,
  outputPath,
}) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel", "error",
        "-y",
        "-ss", String(Math.max(0, absoluteTime)),
        "-i", master,
        "-frames:v", "1",
        "-vf",
        "scale=1080:-2:force_original_aspect_ratio=decrease",
        "-q:v", "2",
        outputPath,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );

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
            `V5.1.1 supporting frame falhou (${code}): ${stderr.slice(-1000)}`,
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
  const speakerWords = attachVisionSpeakers(
    sourceWords,
    vision,
  );
  const contentRanges = addOutputOffsets(
    normalizeContentRanges(
      plan,
      speakerWords,
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
    speakerWords,
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

  const mediaSplit =
    captionMeta?.headline?.enabled === true &&
    captionMeta?.headline?.preset === "media_split";
  let supportingFrame = null;
  let supportingVisual = null;

  if (mediaSplit) {
    const relativeTime = selectSupportingFrameTime(
      plan,
      vision,
      clipDuration,
    );
    supportingFrame = join(
      dir,
      `${revision.id}-headline-support-v511.jpg`,
    );
    await extractSupportingFrame({
      master,
      absoluteTime: clipStart + relativeTime,
      outputPath: supportingFrame,
    });
    supportingVisual = {
      source: "clip_freeze_frame",
      relative_time_seconds:
        Number(relativeTime.toFixed(3)),
    };
  }

  const filterComplex = buildFilterComplex({
    shots,
    assPath,
    hasAudio: Boolean(sourceMeta.hasAudio),
    headlineLayout: captionMeta.headline,
    outputDuration,
  });

  await report({
    phase: "render",
    phase_pct: 0,
    detail:
      `V5.2 story-first renderer · ${shots.length} decisões visuais · headline ${captionMeta?.headline?.preset || "none"}`,
  });

  const renderMeta = await runFfmpeg({
    master,
    output,
    clipStart,
    outputDuration,
    filterComplex,
    hasAudio: Boolean(sourceMeta.hasAudio),
    shots,
    supportingFrame,
    report,
  });

  const uploadBudget = await ensureUploadBudget({
    output,
    durationSeconds: outputDuration,
    hasAudio: Boolean(sourceMeta.hasAudio),
    report,
  });

  const visualQa = await verifyBurnedOverlays({
    output,
    master,
    clipStart,
    outputDuration,
    shots,
    captionMeta,
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
      renderer: "ffmpeg_bounded_inputs_v53",
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
        render_performance: renderMeta,
        visual_qa: visualQa,
        headline: captionMeta.headline,
        supporting_visual: supportingVisual,
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
  groupWords,
  buildCaptionSchedule,
  buildHeadlineLayout,
  selectSupportingFrameTime,
  attachVisionSpeakers,
  writeV5Ass,
};
