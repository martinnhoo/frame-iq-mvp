export const VARIANT_KEYS = Object.freeze(["editorial_master"]);

const ALL_STORAGE_KEYS = Object.freeze([
  "editorial_master",
  "blur_caption",
  "zoom_caption",
  "zoom_clean",
]);

export const RENDER_CONFIG = Object.freeze({
  width: 1080,
  height: 1920,
  fps: 30,
  captions: Object.freeze({
    fontFamily: '"Nimbus Sans Narrow", "Arial Narrow", Arial, sans-serif',
    fontSize: 116,
    outline: 15,
    bottom: 350,
    lowerMidBottom: 500,
    targetWords: 3,
    maxWords: 4,
    combineTokensWithinMilliseconds: 1100,
    breakOnSilenceAfterMilliseconds: 380,
    blockEntranceFrames: 5,
    blockEntranceScale: 0.84,
    blockEntranceTranslateY: 35,
    activeColour: "#FFD800",
    normalColour: "#FFFFFF",
  }),
  audio: Object.freeze({
    loudnessI: -16,
    truePeak: -1.5,
    loudnessRange: 11,
    fadeSeconds: 0.08,
  }),
});

const PRESETS = Object.freeze({
  editorial_master: Object.freeze({ captions: true, captionStyle: "tiktok" }),
  blur_caption: Object.freeze({ captions: true, captionStyle: "tiktok" }),
  zoom_caption: Object.freeze({ captions: true, captionStyle: "tiktok" }),
  zoom_clean: Object.freeze({ captions: false, captionStyle: "clean" }),
});

const finite = (value, fallback) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeRenderSettings(variantKey, raw = {}, clip = {}) {
  const preset = PRESETS[variantKey];
  if (!preset) throw new Error(`variant_key desconhecida: ${variantKey}`);

  const nestedCaptions =
    raw.captions && typeof raw.captions === "object" ? raw.captions : {};

  const start = finite(
    raw.start_seconds ?? raw.startSeconds,
    finite(clip.start_seconds, 0),
  );
  const end = finite(
    raw.end_seconds ?? raw.endSeconds,
    finite(clip.end_seconds, start),
  );

  const requestedPosition = String(
    nestedCaptions.position ?? raw.caption_position ?? "lower",
  );
  const position = ["lower", "lower_mid", "center"].includes(requestedPosition)
    ? requestedPosition
    : "lower";

  return {
    startSeconds: start,
    endSeconds: Math.max(start + 0.1, end),
    captions: {
      enabled: Boolean(
        nestedCaptions.enabled ?? raw.captions ?? preset.captions
      ),
      scale: Math.min(
        1.2,
        Math.max(
          0.8,
          finite(nestedCaptions.scale ?? raw.caption_scale, 1),
        ),
      ),
      position,
      text: nestedCaptions.text ?? raw.caption_text ?? null,
      style: preset.captionStyle,
      highlightActiveWord: nestedCaptions.highlightActiveWord !== false,
    },
    framing: { mode: "cover_center", zoomIntensity: "none" },
    audio: { normalize: raw.audio?.normalize !== false },
    hookTitle: {
      enabled: Boolean(
        raw.hook_overlay?.enabled ?? raw.hookTitle?.enabled ?? false
      ),
    },
    editPlan: variantKey === "editorial_master" ? raw : null,
  };
}

export function revisionStoragePath(userId, clipId, variantKey, revisionNumber) {
  if (!ALL_STORAGE_KEYS.includes(variantKey)) {
    throw new Error(`variant_key desconhecida: ${variantKey}`);
  }
  return `${userId}/${clipId}/${variantKey}/v${Number(revisionNumber)}.mp4`;
}

export function aggregateVariantProgress(variants) {
  const masters = variants.filter(v => v.variant_key === "editorial_master");
  const relevant = masters.length ? masters : variants;
  const total = masters.length ? 1 : relevant.length;
  const ready = relevant.filter(v => v.render_status === "ready").length;
  const rendering = relevant.some(v => v.render_status === "rendering");
  const failed = relevant.filter(v => v.render_status === "error").length;
  return {
    total,
    ready,
    failed,
    status:
      total > 0 && ready === total
        ? "ready"
        : rendering
          ? "rendering"
          : failed
            ? "error"
            : "pending",
  };
}
