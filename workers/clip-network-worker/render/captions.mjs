import { RENDER_CONFIG } from "./config.mjs";

const normalizeText = text =>
  String(text || "")
    .replace(/\s+/g, " ")
    .trim();

const bare = text =>
  normalizeText(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");

function cleanTimedWords(rawWords = []) {
  const result = [];

  for (const raw of rawWords) {
    const text = normalizeText(raw.word ?? raw.text);
    const start = Number(raw.start);
    const end = Number(raw.end);

    if (
      !text ||
      !Number.isFinite(start) ||
      !Number.isFinite(end)
    ) {
      continue;
    }

    if (/^[,.;:!?…]+$/.test(text) && result.length) {
      result[result.length - 1].text += text;
      result[result.length - 1].end = Math.max(
        result[result.length - 1].end,
        end,
      );
      continue;
    }

    result.push({
      text,
      start,
      end: Math.max(start + 0.02, end),
    });
  }

  return result;
}

function estimateWordsFromSegment(segment) {
  const tokens = normalizeText(segment.text)
    .split(" ")
    .filter(Boolean);

  if (!tokens.length) return [];

  const start = Number(segment.start) || 0;
  const end = Math.max(
    start + 0.02,
    Number(segment.end) || start,
  );
  const span = end - start;

  return tokens.map((text, index) => ({
    text,
    start: start + span * index / tokens.length,
    end: start + span * (index + 1) / tokens.length,
  }));
}

function timedWordsForSegment(allWords, segment, clipStart, clipEnd) {
  const start = Math.max(clipStart, Number(segment.start) || clipStart);
  const end = Math.min(clipEnd, Number(segment.end) || clipEnd);

  let words = allWords.filter(
    word => word.end > start && word.start < end,
  );

  if (!words.length) {
    words = estimateWordsFromSegment({
      start,
      end,
      text: segment.text,
    });
  } else {
    words = words.map(word => ({ ...word }));
  }

  const transcriptTokens = normalizeText(segment.text)
    .split(" ")
    .filter(Boolean);

  if (
    transcriptTokens.length === words.length &&
    transcriptTokens.every((token, index) =>
      !bare(token) || !bare(words[index].text) || bare(token) === bare(words[index].text)
    )
  ) {
    words = words.map((word, index) => ({
      ...word,
      text: transcriptTokens[index],
    }));
  } else if (words.length) {
    const ending = normalizeText(segment.text).match(/[!?….,;:]+$/)?.[0];
    if (ending && !/[!?….,;:]$/.test(words.at(-1).text)) {
      words[words.length - 1].text += ending;
    }
  }

  return words;
}

function toPageTokens(words, clipStart, clipEnd) {
  return words
    .map((word, index) => {
      const from = Math.max(clipStart, Number(word.start));
      const to = Math.min(clipEnd, Number(word.end));
      if (!(to > from)) return null;

      const fromMs = Math.max(
        0,
        Math.round((from - clipStart) * 1000),
      );
      const toMs = Math.max(
        fromMs + 20,
        Math.round((to - clipStart) * 1000),
      );

      return {
        text: `${index === 0 ? "" : " "}${word.text}`,
        fromMs,
        toMs,
      };
    })
    .filter(Boolean);
}

function balancedGroups(words, maxWords) {
  if (!words.length) return [];
  if (words.length <= maxWords) return [words];

  const groups = Math.ceil(words.length / maxWords);
  const baseSize = Math.floor(words.length / groups);
  let remainder = words.length % groups;
  const result = [];
  let cursor = 0;

  for (let i = 0; i < groups; i += 1) {
    const size = baseSize + (remainder > 0 ? 1 : 0);
    remainder -= remainder > 0 ? 1 : 0;
    result.push(words.slice(cursor, cursor + size));
    cursor += size;
  }

  return result.filter(group => group.length);
}

function pageFromWords(words, clipStart, clipEnd) {
  const tokens = toPageTokens(words, clipStart, clipEnd);
  if (!tokens.length) return null;

  const startMs = tokens[0].fromMs;
  const endMs = Math.max(
    startMs + 20,
    ...tokens.map(token => token.toMs),
  );

  return {
    text: tokens.map(token => token.text).join("").trim(),
    startMs,
    durationMs: endMs - startMs,
    tokens,
  };
}

export function buildRemotionCaptionPages(
  transcript,
  start,
  end,
  textOverride = null,
  captionSettings = {},
) {
  const maxWords = Math.min(
    7,
    Math.max(
      3,
      Number(captionSettings.maxWords || RENDER_CONFIG.captions.maxWords),
    ),
  );

  if (textOverride) {
    return balancedGroups(
      estimateWordsFromSegment({ start, end, text: textOverride }),
      maxWords,
    )
      .map(words => pageFromWords(words, start, end))
      .filter(Boolean);
  }

  const preciseWords = cleanTimedWords(transcript?.words || []);
  const segments = (transcript?.segments || [])
    .filter(
      segment =>
        Number(segment.end) > start &&
        Number(segment.start) < end &&
        normalizeText(segment.text),
    )
    .sort((a, b) => Number(a.start) - Number(b.start));

  if (!segments.length) {
    return balancedGroups(
      preciseWords.filter(word => word.end > start && word.start < end),
      maxWords,
    )
      .map(words => pageFromWords(words, start, end))
      .filter(Boolean);
  }

  const pages = [];

  for (const segment of segments) {
    const words = timedWordsForSegment(
      preciseWords,
      segment,
      start,
      end,
    );

    for (const group of balancedGroups(words, maxWords)) {
      const page = pageFromWords(group, start, end);
      if (page) pages.push(page);
    }
  }

  return pages;
}
