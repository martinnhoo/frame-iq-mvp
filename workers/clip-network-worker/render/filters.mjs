import { RENDER_CONFIG } from "./config.mjs";

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function focusExpression(editPlan, axis) {
  const key = axis === "y" ? "focus_y" : "focus_x";
  const events = Array.isArray(editPlan?.framing)
    ? editPlan.framing
        .map(event => ({
          start: Number(event.start),
          end: Number(event.end),
          value: clamp(Number(event[key] ?? 0.5), 0.05, 0.95),
        }))
        .filter(
          event =>
            Number.isFinite(event.start) &&
            Number.isFinite(event.end) &&
            event.end > event.start,
        )
        .sort((a, b) => a.start - b.start)
        .slice(0, 12)
    : [];

  if (!events.length) return "0.5";

  let expression = "0.5";
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    expression =
      `if(between(t,${event.start.toFixed(3)},${event.end.toFixed(3)}),` +
      `${event.value.toFixed(4)},${expression})`;
  }
  return expression;
}

export function buildBaseVideoFilter(editPlan = null) {
  const width = RENDER_CONFIG.width;
  const height = RENDER_CONFIG.height;
  const focusX = focusExpression(editPlan, "x");
  const focusY = focusExpression(editPlan, "y");

  return (
    `scale=${width}:${height}:force_original_aspect_ratio=increase,` +
    `crop=${width}:${height}:` +
    `x='max(0,min(iw-${width},iw*(${focusX})-${Math.round(width / 2)}))':` +
    `y='max(0,min(ih-${height},ih*(${focusY})-${Math.round(height / 2)}))',` +
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
