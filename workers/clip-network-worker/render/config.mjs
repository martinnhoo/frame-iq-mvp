export const VARIANT_KEYS = Object.freeze(["blur_caption", "zoom_caption", "zoom_clean"]);

export const RENDER_CONFIG = Object.freeze({
  width: 1080,
  height: 1920,
  maxAutomaticEdgeTrimSeconds: 0.75,
  safeArea: Object.freeze({ top: 120, bottom: 300, left: 70, right: 120 }),
  captions: Object.freeze({
    fontName: "DejaVu Sans",
    fontSize: 48,
    outline: 3,
    lowerMargin: 330,
    lowerMidMargin: 460,
    maxWords: 5,
    targetWords: 4,
    maxLineChars: 24,
  }),
  audio: Object.freeze({ loudnessI: -16, truePeak: -1.5, loudnessRange: 11, fadeSeconds: 0.08 }),
  punchIn: Object.freeze({ periodSeconds: 12, levels: Object.freeze({ low: 0.05, medium: 0.08, high: 0.12 }) }),
});

export const RENDER_PRESETS = Object.freeze({
  blur_caption: Object.freeze({ framingMode: "contain_blur", captions: true, zoomIntensity: "low" }),
  zoom_caption: Object.freeze({ framingMode: "cover_center", captions: true, zoomIntensity: "medium" }),
  zoom_clean: Object.freeze({ framingMode: "cover_center", captions: false, zoomIntensity: "medium" }),
});

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeRenderSettings(variantKey, raw = {}, clip = {}) {
  const preset = RENDER_PRESETS[variantKey];
  if (!preset) throw new Error(`variant_key desconhecida: ${variantKey}`);
  const nestedCaptions = raw.captions && typeof raw.captions === "object" ? raw.captions : {};
  const nestedFraming = raw.framing && typeof raw.framing === "object" ? raw.framing : {};
  const start = finite(raw.start_seconds ?? raw.startSeconds, finite(clip.start_seconds, 0));
  const end = finite(raw.end_seconds ?? raw.endSeconds, finite(clip.end_seconds, start));
  const fontScale = Math.min(1.4, Math.max(0.65, finite(nestedCaptions.scale ?? raw.caption_scale, 1)));
  const legacyFontSize = finite(raw.caption_font_size, RENDER_CONFIG.captions.fontSize);

  return {
    startSeconds: start,
    endSeconds: Math.max(start + 0.1, end),
    captions: {
      enabled: Boolean(nestedCaptions.enabled ?? raw.captions ?? preset.captions),
      scale: legacyFontSize <= 12 ? Math.min(1.4, Math.max(0.65, legacyFontSize / 6)) : fontScale,
      position: String(nestedCaptions.position ?? raw.caption_position ?? "lower"),
      text: nestedCaptions.text ?? raw.caption_text ?? null,
    },
    framing: {
      mode: String(nestedFraming.mode ?? raw.framing_mode ?? preset.framingMode),
      zoomIntensity: String(nestedFraming.zoomIntensity ?? raw.zoom_intensity ?? preset.zoomIntensity),
    },
    audio: { normalize: raw.audio?.normalize !== false },
    hookTitle: { enabled: Boolean(raw.hookTitle?.enabled ?? false) },
  };
}

export function revisionStoragePath(userId, clipId, variantKey, revisionNumber) {
  if (!VARIANT_KEYS.includes(variantKey)) throw new Error(`variant_key desconhecida: ${variantKey}`);
  return `${userId}/${clipId}/${variantKey}/v${Number(revisionNumber)}.mp4`;
}

export function aggregateVariantProgress(variants) {
  const total = VARIANT_KEYS.length;
  const ready = variants.filter((variant) => variant.render_status === "ready").length;
  const rendering = variants.some((variant) => variant.render_status === "rendering");
  const failed = variants.filter((variant) => variant.render_status === "error").length;
  return { total, ready, failed, status: ready === total ? "ready" : rendering ? "rendering" : failed ? "error" : "pending" };
}
