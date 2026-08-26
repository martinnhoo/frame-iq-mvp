import { writeFile } from "node:fs/promises";
import { RENDER_CONFIG } from "./config.mjs";

const normalizeText = (text) => String(text || "").replace(/\s+/g, " ").trim();

function splitPhrases(text) {
  return normalizeText(text).split(/(?<=[.!?…]|[,;:])\s+/).map((part) => part.trim()).filter(Boolean);
}

function buildChunks(text) {
  const chunks = [];
  for (const phrase of splitPhrases(text)) {
    const words = phrase.split(" ").filter(Boolean);
    const parts = Math.max(1, Math.ceil(words.length / RENDER_CONFIG.captions.targetWords));
    const per = Math.min(RENDER_CONFIG.captions.maxWords, Math.ceil(words.length / parts));
    for (let index = 0; index < words.length;) {
      let take = Math.min(per, words.length - index);
      if (words.length - (index + take) === 1 && take > 1) take -= 1;
      chunks.push(words.slice(index, index + take));
      index += take;
    }
  }
  return chunks;
}

function balanceLines(words) {
  const single = words.join(" ");
  if (single.length <= RENDER_CONFIG.captions.maxLineChars || words.length < 2) return single;
  let best = { cost: Number.POSITIVE_INFINITY, text: single };
  for (let cut = 1; cut < words.length; cut += 1) {
    const first = words.slice(0, cut).join(" ");
    const second = words.slice(cut).join(" ");
    const overflow = Math.max(0, first.length - RENDER_CONFIG.captions.maxLineChars)
      + Math.max(0, second.length - RENDER_CONFIG.captions.maxLineChars);
    const cost = Math.abs(first.length - second.length) + overflow * 4;
    if (cost < best.cost) best = { cost, text: `${first}\n${second}` };
  }
  return best.text;
}

function assTime(seconds) {
  const centiseconds = Math.max(0, Math.round(Number(seconds) * 100));
  const hours = Math.floor(centiseconds / 360000);
  const minutes = Math.floor((centiseconds % 360000) / 6000);
  const secs = Math.floor((centiseconds % 6000) / 100);
  const cs = centiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

const escapeAss = (text) => String(text).replace(/\\/g, "\\\\").replace(/[{}]/g, "").replace(/\r?\n/g, "\\N");

export function buildCaptionCues(transcript, start, end, textOverride = null) {
  const sourceSegments = textOverride
    ? [{ start, end, text: textOverride }]
    : (transcript?.segments || []).filter((segment) => Number(segment.end) > start && Number(segment.start) < end);
  const cues = [];
  for (const segment of sourceSegments) {
    const chunks = buildChunks(segment.text);
    if (!chunks.length) continue;
    const segmentStart = Math.max(start, Number(segment.start) || start);
    const segmentEnd = Math.min(end, Math.max(segmentStart, Number(segment.end) || segmentStart));
    const totalWords = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    let usedWords = 0;
    for (const chunk of chunks) {
      const cueStart = segmentStart + ((segmentEnd - segmentStart) * usedWords) / totalWords;
      usedWords += chunk.length;
      const cueEnd = segmentStart + ((segmentEnd - segmentStart) * usedWords) / totalWords;
      if (cueEnd > cueStart) cues.push({ start: cueStart - start, end: cueEnd - start, text: balanceLines(chunk) });
    }
  }
  return cues;
}

export function buildAssDocument(cues, captionSettings) {
  const cfg = RENDER_CONFIG;
  const size = Math.round(cfg.captions.fontSize * Number(captionSettings.scale || 1));
  const position = captionSettings.position || "lower";
  const alignment = position === "center" ? 5 : 2;
  const marginV = position === "lower_mid" ? cfg.captions.lowerMidMargin : cfg.captions.lowerMargin;
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${cfg.width}\nPlayResY: ${cfg.height}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,${cfg.captions.fontName},${size},&H00FFFFFF,&H00FFFFFF,&HAA000000,&H00000000,-1,0,0,0,100,100,0,0,1,${cfg.captions.outline},0,${alignment},${cfg.safeArea.left},${cfg.safeArea.right},${marginV},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  return header + cues.map((cue) => `Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Caption,,0,0,0,,${escapeAss(cue.text)}`).join("\n") + "\n";
}

export async function writeAssCaptions(transcript, settings, file) {
  const cues = buildCaptionCues(transcript, settings.startSeconds, settings.endSeconds, settings.captions.text);
  await writeFile(file, buildAssDocument(cues, settings.captions), "utf8");
  return cues.length;
}
