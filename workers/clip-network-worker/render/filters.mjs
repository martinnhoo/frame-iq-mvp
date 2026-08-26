import { RENDER_CONFIG, RENDER_PRESETS } from "./config.mjs";

const escapeFilterPath = (path) => path.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");

export function buildPunchInExpression(fps, intensity = "medium") {
  const amount = RENDER_CONFIG.punchIn.levels[intensity] ?? RENDER_CONFIG.punchIn.levels.medium;
  const frames = Math.max(1, Number(fps) * RENDER_CONFIG.punchIn.periodSeconds);
  return `1+${amount}*(0.5-0.5*cos(2*PI*on/${frames.toFixed(3)}))`;
}

function buildBlurFraming() {
  return `[0:v]split=2[bg0][fg0];`+
    `[bg0]scale=${RENDER_CONFIG.width}:${RENDER_CONFIG.height}:force_original_aspect_ratio=increase,`+
    `crop=${RENDER_CONFIG.width}:${RENDER_CONFIG.height},boxblur=28:3,eq=brightness=-0.10:saturation=0.9[bg];`+
    `[fg0]scale=${RENDER_CONFIG.width}:${RENDER_CONFIG.height}:force_original_aspect_ratio=decrease[fg];`+
    `[bg][fg]overlay=(W-w)/2:(H-h)/2:shortest=1[base]`;
}

function buildZoomFraming(settings, fps, source) {
  const sourceAspect = Number(source.width || 0) / Math.max(1, Number(source.height || 1));
  const destructive = sourceAspect > 2.15;
  if (settings.framing.mode === "contain_blur" || destructive) return buildBlurFraming();
  const zoom = buildPunchInExpression(fps, settings.framing.zoomIntensity);
  return `[0:v]scale=${RENDER_CONFIG.width}:${RENDER_CONFIG.height}:force_original_aspect_ratio=increase,`+
    `crop=${RENDER_CONFIG.width}:${RENDER_CONFIG.height},`+
    `zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:`+
    `s=${RENDER_CONFIG.width}x${RENDER_CONFIG.height}:fps=${Number(fps).toFixed(3)}[base]`;
}

export function buildVideoFilter({ variantKey, settings, assPath, fps, source }) {
  const preset = RENDER_PRESETS[variantKey];
  if (!preset) throw new Error(`variant_key desconhecida: ${variantKey}`);
  const framing = preset.framingMode === "contain_blur" && settings.framing.mode !== "cover_center"
    ? buildBlurFraming()
    : buildZoomFraming(settings, fps, source);
  const caption = settings.captions.enabled && assPath
    ? `;[base]ass='${escapeFilterPath(assPath)}'[captioned];[captioned]setsar=1,format=yuv420p[v]`
    : `;[base]setsar=1,format=yuv420p[v]`;
  return framing + caption;
}

export function buildAudioFilter(durationSeconds) {
  const audio = RENDER_CONFIG.audio;
  const fadeOutAt = Math.max(0, Number(durationSeconds) - audio.fadeSeconds);
  return `loudnorm=I=${audio.loudnessI}:TP=${audio.truePeak}:LRA=${audio.loudnessRange},`+
    `afade=t=in:st=0:d=${audio.fadeSeconds},afade=t=out:st=${fadeOutAt.toFixed(3)}:d=${audio.fadeSeconds}`;
}
