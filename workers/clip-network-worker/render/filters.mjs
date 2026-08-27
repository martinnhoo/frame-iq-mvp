import { RENDER_CONFIG } from "./config.mjs";

export function buildBaseVideoFilter() {
  return (
    `scale=${RENDER_CONFIG.width}:${RENDER_CONFIG.height}:force_original_aspect_ratio=increase,` +
    `crop=${RENDER_CONFIG.width}:${RENDER_CONFIG.height}:(iw-ow)/2:(ih-oh)/2,` +
    "setsar=1,format=yuv420p"
  );
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
