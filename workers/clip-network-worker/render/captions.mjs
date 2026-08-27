import { createTikTokStyleCaptions } from "@remotion/captions";
import { RENDER_CONFIG } from "./config.mjs";

const normalizeText = text =>
  String(text || "")
    .replace(/\s+/g, " ")
    .trim();

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

function collectTimedWords(
  transcript,
  start,
  end,
  textOverride = null,
) {
  if (textOverride) {
    return estimateWordsFromSegment({
      start,
      end,
      text: textOverride,
    });
  }

  const precise = cleanTimedWords(
    transcript?.words || []
  ).filter(word =>
    word.end > start &&
    word.start < end
  );

  if (precise.length) return precise;

  return (transcript?.segments || [])
    .filter(segment =>
      Number(segment.end) > start &&
      Number(segment.start) < end
    )
    .flatMap(estimateWordsFromSegment);
}

function toCaptionTokens(words, clipStart, clipEnd) {
  return words
    .map((word, index) => {
      const from = Math.max(clipStart, Number(word.start));
      const to = Math.min(clipEnd, Number(word.end));

      if (!(to > from)) return null;

      const startMs = Math.max(
        0,
        Math.round((from - clipStart) * 1000),
      );

      const endMs = Math.max(
        startMs + 20,
        Math.round((to - clipStart) * 1000),
      );

      return {
        text: `${index === 0 ? "" : " "}${word.text}`,
        startMs,
        endMs,
        timestampMs: Math.round((startMs + endMs) / 2),
        confidence: null,
      };
    })
    .filter(Boolean);
}

function pageFromTokens(tokens) {
  const startMs = tokens[0].fromMs;
  const endMs = Math.max(
    startMs + 20,
    ...tokens.map(token => token.toMs),
  );

  return {
    text: tokens
      .map(token => token.text)
      .join("")
      .trim(),
    startMs,
    durationMs: endMs - startMs,
    tokens,
  };
}

function splitOversizedPage(page, maxWords) {
  if (page.tokens.length <= maxWords) return [page];

  const result = [];
  let index = 0;

  while (index < page.tokens.length) {
    let take = Math.min(
      maxWords,
      page.tokens.length - index,
    );

    if (
      page.tokens.length - (index + take) === 1 &&
      take > 2
    ) {
      take -= 1;
    }

    result.push(
      pageFromTokens(
        page.tokens.slice(index, index + take)
      )
    );

    index += take;
  }

  return result;
}

export function buildRemotionCaptionPages(
  transcript,
  start,
  end,
  textOverride = null,
) {
  const cfg = RENDER_CONFIG.captions;

  const words = collectTimedWords(
    transcript,
    start,
    end,
    textOverride,
  );

  const captions = toCaptionTokens(
    words,
    start,
    end,
  );

  if (!captions.length) return [];

  const { pages } = createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds:
      cfg.combineTokensWithinMilliseconds,
    breakOnSilenceAfterMilliseconds:
      cfg.breakOnSilenceAfterMilliseconds,
  });

  return pages.flatMap(page =>
    splitOversizedPage(page, cfg.maxWords)
  );
}
