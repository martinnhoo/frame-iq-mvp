export const VARIANT_KEYS = Object.freeze(["blur_caption", "zoom_caption", "zoom_clean"]);

export const RENDER_CONFIG = Object.freeze({
  width: 1080,
  height: 1920,
  maxAutomaticEdgeTrimSeconds: 0.75,

  safeArea: Object.freeze({
    top: 120,
    bottom: 300,
    left: 70,
    right: 70,
  }),

  captions: Object.freeze({
    fontName: "Nimbus Sans Narrow",
    fontSize: 68,
    outline: 5,
    shadow: 2,

    lowerMargin: 345,
    lowerMidMargin: 455,

    maxWords: 4,
    targetWords: 3,
    maxLineChars: 20,

    pauseBreakSeconds: 0.38,

    activeScale: 1.10,
    activeColour: "&H0000D8FF",
    normalColour: "&H00FFFFFF",
  }),

  audio: Object.freeze({
    loudnessI: -16,
    truePeak: -1.5,
    loudnessRange: 11,
    fadeSeconds: 0.08,
  }),

  // Mantido por compatibilidade com revisões antigas.
  // O renderer novo não usa zoom animado.
  punchIn: Object.freeze({
    periodSeconds: 12,
    levels: Object.freeze({
      low: 0,
      medium: 0,
      high: 0,
    }),
  }),
});

export const RENDER_PRESETS = Object.freeze({
  blur_caption: Object.freeze({
    framingMode: "cover_center",
    captions: true,
    captionStyle: "kinetic",
    zoomIntensity: "none",
  }),

  zoom_caption: Object.freeze({
    framingMode: "cover_center",
    captions: true,
    captionStyle: "clean",
    zoomIntensity: "none",
  }),

  zoom_clean: Object.freeze({
    framingMode: "cover_center",
    captions: false,
    captionStyle: "clean",
    zoomIntensity: "none",
  }),
});

const finite = (value, fallback) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeRenderSettings(variantKey, raw = {}, clip = {}) {
  const preset = RENDER_PRESETS[variantKey];

  if (!preset) {
    throw new Error(`variant_key desconhecida: ${variantKey}`);
  }

  const nestedCaptions =
    raw.captions && typeof raw.captions === "object"
      ? raw.captions
      : {};

  const start = finite(
    raw.start_seconds ?? raw.startSeconds,
    finite(clip.start_seconds, 0),
  );

  const end = finite(
    raw.end_seconds ?? raw.endSeconds,
    finite(clip.end_seconds, start),
  );

  const fontScale = Math.min(
    1.35,
    Math.max(
      0.70,
      finite(nestedCaptions.scale ?? raw.caption_scale, 1),
    ),
  );

  return {
    startSeconds: start,
    endSeconds: Math.max(start + 0.1, end),

    captions: {
      enabled: Boolean(
        nestedCaptions.enabled ??
        raw.captions ??
        preset.captions
      ),

      scale: fontScale,

      position: String(
        nestedCaptions.position ??
        raw.caption_position ??
        "lower"
      ),

      text:
        nestedCaptions.text ??
        raw.caption_text ??
        null,

      style: String(
        nestedCaptions.style ??
        preset.captionStyle
      ),
    },

    // Todos usam o crop vertical estático que ficou melhor.
    framing: {
      mode: "cover_center",
      zoomIntensity: "none",
    },

    audio: {
      normalize: raw.audio?.normalize !== false,
    },

    hookTitle: {
      enabled: Boolean(raw.hookTitle?.enabled ?? false),
    },
  };
}

export function revisionStoragePath(
  userId,
  clipId,
  variantKey,
  revisionNumber,
) {
  if (!VARIANT_KEYS.includes(variantKey)) {
    throw new Error(`variant_key desconhecida: ${variantKey}`);
  }

  return `${userId}/${clipId}/${variantKey}/v${Number(revisionNumber)}.mp4`;
}

export function aggregateVariantProgress(variants) {
  const total = VARIANT_KEYS.length;

  const ready = variants.filter(
    variant => variant.render_status === "ready"
  ).length;

  const rendering = variants.some(
    variant => variant.render_status === "rendering"
  );

  const failed = variants.filter(
    variant => variant.render_status === "error"
  ).length;

  return {
    total,
    ready,
    failed,
    status:
      ready === total
        ? "ready"
        : rendering
          ? "rendering"
          : failed
            ? "error"
            : "pending",
  };
}
