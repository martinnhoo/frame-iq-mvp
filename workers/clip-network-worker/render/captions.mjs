import { writeFile } from "node:fs/promises";
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

    // Caso o Whisper devolva pontuação isolada,
    // cola no token anterior para não virar uma "palavra".
    if (
      /^[,.;:!?…]+$/.test(text) &&
      result.length
    ) {
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

  return tokens.map((text,index) => ({
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

  if (precise.length) {
    return precise;
  }

  // Fallback de segurança para transcrições antigas.
  return (transcript?.segments || [])
    .filter(segment =>
      Number(segment.end) > start &&
      Number(segment.start) < end
    )
    .flatMap(estimateWordsFromSegment);
}

function groupWords(words) {
  const cfg = RENDER_CONFIG.captions;
  const groups = [];

  let current = [];

  const flush = () => {
    if (!current.length) return;

    groups.push(current);
    current = [];
  };

  for (const word of words) {
    const previous = current.at(-1);

    const pause =
      previous
        ? word.start - previous.end
        : 0;

    if (
      current.length &&
      (
        current.length >= cfg.maxWords ||
        pause >= cfg.pauseBreakSeconds
      )
    ) {
      flush();
    }

    current.push(word);

    if (
      current.length >= 2 &&
      /[.!?…]$/.test(word.text)
    ) {
      flush();
    }

    else if (
      current.length >= cfg.targetWords &&
      /[,;:]$/.test(word.text)
    ) {
      flush();
    }
  }

  flush();

  // Evita um último bloco visualmente feio com 1 palavra,
  // quando há espaço no bloco anterior e não existe pausa grande.
  if (
    groups.length >= 2 &&
    groups.at(-1).length === 1
  ) {
    const last = groups.at(-1);
    const previous = groups.at(-2);

    const pause =
      last[0].start -
      previous.at(-1).end;

    if (
      previous.length < cfg.maxWords &&
      pause < cfg.pauseBreakSeconds
    ) {
      previous.push(last[0]);
      groups.pop();
    }
  }

  return groups;
}

function findBalancedLineCut(tokens) {
  const cfg = RENDER_CONFIG.captions;

  const single = tokens.join(" ");

  if (
    single.length <= cfg.maxLineChars ||
    tokens.length < 2
  ) {
    return null;
  }

  let best = {
    cost: Number.POSITIVE_INFINITY,
    cut: null,
  };

  for (
    let cut = 1;
    cut < tokens.length;
    cut += 1
  ) {
    const first =
      tokens.slice(0,cut).join(" ");

    const second =
      tokens.slice(cut).join(" ");

    const overflow =
      Math.max(
        0,
        first.length - cfg.maxLineChars,
      ) +
      Math.max(
        0,
        second.length - cfg.maxLineChars,
      );

    const cost =
      Math.abs(first.length - second.length) +
      overflow * 5;

    if (cost < best.cost) {
      best = { cost, cut };
    }
  }

  return best.cut;
}

function plainText(words) {
  const tokens = words.map(word =>
    word.text.toUpperCase()
  );

  const cut = findBalancedLineCut(tokens);

  if (!cut) {
    return tokens.join(" ");
  }

  return (
    tokens.slice(0,cut).join(" ") +
    "\n" +
    tokens.slice(cut).join(" ")
  );
}

export function buildCaptionCues(
  transcript,
  start,
  end,
  textOverride = null,
) {
  const words = collectTimedWords(
    transcript,
    start,
    end,
    textOverride,
  );

  const groups = groupWords(words);

  const cues = [];

  for (const group of groups) {
    for (
      let activeIndex = 0;
      activeIndex < group.length;
      activeIndex += 1
    ) {
      const word = group[activeIndex];

      const next =
        group[activeIndex + 1];

      const cueStart = Math.max(
        start,
        word.start,
      );

      let cueEnd =
        next
          ? Math.min(end,next.start)
          : Math.min(
              end,
              Math.max(
                word.end,
                word.start + 0.08,
              ),
            );

      if (cueEnd <= cueStart) {
        cueEnd = Math.min(
          end,
          cueStart + 0.08,
        );
      }

      if (cueEnd <= cueStart) continue;

      cues.push({
        start: cueStart - start,
        end: cueEnd - start,

        words: group.map(item => ({
          ...item,
          text: item.text,
        })),

        activeIndex,

        text: plainText(group),
      });
    }
  }

  return cues;
}

function assTime(seconds) {
  const centiseconds = Math.max(
    0,
    Math.round(Number(seconds) * 100),
  );

  const hours =
    Math.floor(centiseconds / 360000);

  const minutes =
    Math.floor(
      (centiseconds % 360000) / 6000,
    );

  const secs =
    Math.floor(
      (centiseconds % 6000) / 100,
    );

  const cs =
    centiseconds % 100;

  return (
    `${hours}:` +
    `${String(minutes).padStart(2,"0")}:` +
    `${String(secs).padStart(2,"0")}.` +
    String(cs).padStart(2,"0")
  );
}

const escapeAssToken = text =>
  String(text)
    .replace(/\\/g,"\\\\")
    .replace(/[{}]/g,"");

function renderCueText(
  cue,
  captionSettings,
) {
  const cfg = RENDER_CONFIG.captions;

  const tokens = cue.words.map(word =>
    String(word.text || "").toUpperCase()
  );

  const lineCut =
    findBalancedLineCut(tokens);

  const kinetic =
    captionSettings.style !== "clean";

  const activeScale =
    Math.round(cfg.activeScale * 100);

  let result = "";

  for (
    let index = 0;
    index < tokens.length;
    index += 1
  ) {
    if (index > 0) {
      result +=
        lineCut === index
          ? "\\N"
          : " ";
    }

    const token =
      escapeAssToken(tokens[index]);

    if (
      kinetic &&
      index === cue.activeIndex
    ) {
      result +=
        `{\\c${cfg.activeColour}\\fscx${activeScale}\\fscy${activeScale}\\t(0,110,\\fscx100\\fscy100)}` +
        token +
        `{\\c${cfg.normalColour}\\fscx100\\fscy100}`;
    }

    else {
      result +=
        `{\\c${cfg.normalColour}\\fscx100\\fscy100}` +
        token;
    }
  }

  return result;
}

export function buildAssDocument(
  cues,
  captionSettings,
) {
  const cfg = RENDER_CONFIG;

  const size = Math.round(
    cfg.captions.fontSize *
    Number(captionSettings.scale || 1)
  );

  const position =
    captionSettings.position || "lower";

  const alignment =
    position === "center"
      ? 5
      : 2;

  const marginV =
    position === "lower_mid"
      ? cfg.captions.lowerMidMargin
      : cfg.captions.lowerMargin;

  const header =
    `[Script Info]
ScriptType: v4.00+
PlayResX: ${cfg.width}
PlayResY: ${cfg.height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,${cfg.captions.fontName},${size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,94,100,0,0,1,${cfg.captions.outline},${cfg.captions.shadow},${alignment},${cfg.safeArea.left},${cfg.safeArea.right},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  return (
    header +
    cues
      .map(cue =>
        `Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Caption,,0,0,0,,${renderCueText(cue,captionSettings)}`
      )
      .join("\n") +
    "\n"
  );
}

export async function writeAssCaptions(
  transcript,
  settings,
  file,
) {
  const cues = buildCaptionCues(
    transcript,
    settings.startSeconds,
    settings.endSeconds,
    settings.captions.text,
  );

  await writeFile(
    file,
    buildAssDocument(
      cues,
      settings.captions,
    ),
    "utf8",
  );

  return cues.length;
}
