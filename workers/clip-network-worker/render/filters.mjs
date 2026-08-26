import { RENDER_CONFIG, RENDER_PRESETS } from "./config.mjs";

const escapeFilterPath = path =>
  path
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");

// Mantido somente para imports/testes antigos.
export function buildPunchInExpression() {
  return "1";
}

function buildStaticVerticalCrop() {
  return (
    `[0:v]scale=${RENDER_CONFIG.width}:${RENDER_CONFIG.height}:force_original_aspect_ratio=increase,` +
    `crop=${RENDER_CONFIG.width}:${RENDER_CONFIG.height}:(iw-ow)/2:(ih-oh)/2[base]`
  );
}

export function buildVideoFilter({
  variantKey,
  settings,
  assPath,
}) {
  const preset = RENDER_PRESETS[variantKey];

  if (!preset) {
    throw new Error(`variant_key desconhecida: ${variantKey}`);
  }

  const framing = buildStaticVerticalCrop();

  const caption =
    settings.captions.enabled && assPath
      ? `;[base]ass='${escapeFilterPath(assPath)}'[captioned];[captioned]setsar=1,format=yuv420p[v]`
      : `;[base]setsar=1,format=yuv420p[v]`;

  return framing + caption;
}

export function buildAudioFilter(durationSeconds) {
  const audio = RENDER_CONFIG.audio;
  const fadeOutAt = Math.max(
    0,
    Number(durationSeconds) - audio.fadeSeconds,
  );

  return (
    `loudnorm=I=${audio.loudnessI}:TP=${audio.truePeak}:LRA=${audio.loudnessRange},` +
    `afade=t=in:st=0:d=${audio.fadeSeconds},` +
    `afade=t=out:st=${fadeOutAt.toFixed(3)}:d=${audio.fadeSeconds}`
  );
}
