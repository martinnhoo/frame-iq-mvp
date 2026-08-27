import React from "react";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const DESIGN = {
  fontFamily: '"Nimbus Sans Narrow", "Arial Narrow", Arial, sans-serif',
  captionFontSize: 96,
  captionOutline: 10,
  normalColour: "#FFFFFF",
  activeColour: "#FFD800",
  captionBottom: 390,
  captionLowerMidBottom: 520,
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function CameraVideo({ videoSrc, editPlan }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const camera = Array.isArray(editPlan?.camera) ? editPlan.camera : [];
  const event = camera.find(
    item => time >= Number(item.start) && time < Number(item.end),
  );

  let scale = 1;
  let x = 0;
  let y = 0;

  if (event) {
    const start = Number(event.start || 0);
    const end = Math.max(start + 0.05, Number(event.end || start + 0.05));
    const progress = clamp((time - start) / (end - start), 0, 1);
    scale = interpolate(
      progress,
      [0, 1],
      [
        Number(event.scale_from ?? event.scale ?? 1),
        Number(event.scale_to ?? event.scale ?? 1),
      ],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    x = Number(event.x || 0);
    y = Number(event.y || 0);
  }

  for (const emphasis of editPlan?.emphasis || []) {
    if (emphasis.type !== "punch_in") continue;
    const center = Number(emphasis.time || 0);
    const duration = Math.max(0.25, Number(emphasis.duration || 0.55));
    const distance = Math.abs(time - center);
    if (distance > duration / 2) continue;
    const pulse = 1 - distance / (duration / 2);
    const target = Number(emphasis.scale || 1.08);
    scale = Math.max(scale, 1 + (target - 1) * pulse);
  }

  scale = clamp(scale, 1, 1.12);
  const maxShift = Math.max(0, (scale - 1) * 42);

  return (
    <OffthreadVideo
      src={videoSrc}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: `translate(${clamp(x, -maxShift, maxShift)}%, ${clamp(y, -maxShift, maxShift)}%) scale(${scale})`,
        transformOrigin: "center center",
      }}
    />
  );
}

function CaptionPage({ page, captionSettings }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    fps,
    frame,
    durationInFrames: 4,
    config: { damping: 200 },
  });

  const scale = interpolate(entrance, [0, 1], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(entrance, [0, 1], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const nowMs = page.startMs + (frame / fps) * 1000;
  const fontSize = DESIGN.captionFontSize * Number(captionSettings?.scale || 0.9);
  const uppercase = captionSettings?.uppercase === true;

  const position =
    captionSettings?.position === "center"
      ? { top: "50%", transform: "translateY(-50%)" }
      : {
          bottom:
            captionSettings?.position === "lower_mid"
              ? DESIGN.captionLowerMidBottom
              : DESIGN.captionBottom,
        };

  return (
    <div
      style={{
        position: "absolute",
        left: "7%",
        width: "86%",
        textAlign: "center",
        ...position,
      }}
    >
      <div
        style={{
          transform: `translateY(${translateY}px) scale(${scale})`,
          transformOrigin: "center center",
          fontFamily: DESIGN.fontFamily,
          fontSize,
          fontWeight: 900,
          lineHeight: 0.98,
          letterSpacing: "-1.4px",
          textTransform: uppercase ? "uppercase" : "none",
          whiteSpace: "pre-wrap",
          WebkitTextStroke: `${DESIGN.captionOutline}px #000000`,
          paintOrder: "stroke fill",
          filter: "drop-shadow(0 3px 2px rgba(0,0,0,0.18))",
        }}
      >
        {page.tokens.map((token, index) => {
          const active =
            captionSettings?.highlightActiveWord !== false &&
            nowMs >= token.fromMs &&
            nowMs < token.toMs;

          const text = uppercase
            ? String(token.text || "").toUpperCase()
            : String(token.text || "");

          return (
            <span
              key={`${token.fromMs}-${index}`}
              style={{
                color: active ? DESIGN.activeColour : DESIGN.normalColour,
              }}
            >
              {text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Headline({ text }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({
    fps,
    frame,
    config: { damping: 20, stiffness: 170 },
    durationInFrames: 9,
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 120,
        left: 80,
        right: 80,
        textAlign: "center",
        opacity: entrance,
        transform: `translateY(${interpolate(entrance, [0, 1], [-12, 0])}px)`,
      }}
    >
      <span
        style={{
          display: "inline-block",
          maxWidth: 850,
          padding: "11px 17px",
          borderRadius: 12,
          backgroundColor: "rgba(0,0,0,0.66)",
          color: "#FFFFFF",
          fontFamily: DESIGN.fontFamily,
          fontSize: 44,
          lineHeight: 1.04,
          fontWeight: 900,
          letterSpacing: "-0.6px",
          boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
        }}
      >
        {text}
      </span>
    </div>
  );
}

function Overlay({ overlay }) {
  const isEmphasis = overlay.kind === "emphasis";

  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        top:
          overlay.position === "upper_mid"
            ? 350
            : overlay.position === "lower_mid"
              ? 1080
              : 170,
        textAlign: "center",
      }}
    >
      <span
        style={{
          display: "inline-block",
          padding: isEmphasis ? "10px 15px" : "9px 14px",
          borderRadius: 11,
          backgroundColor: isEmphasis
            ? "rgba(0,0,0,0.74)"
            : "rgba(0,0,0,0.60)",
          color: isEmphasis ? "#FFD800" : "#FFFFFF",
          fontFamily: DESIGN.fontFamily,
          fontSize: isEmphasis ? 48 : 40,
          fontWeight: 900,
          lineHeight: 1.02,
        }}
      >
        {overlay.text}
      </span>
    </div>
  );
}

export function EditorialComposition({
  videoSrc,
  pages,
  durationSeconds,
  captionSettings,
  editPlan,
  overlayOnly = false,
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = Math.max(0.1, Number(durationSeconds || 1));
  const progress = clamp(
    frame / Math.max(1, Math.ceil(duration * fps) - 1),
    0,
    1,
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: overlayOnly ? "transparent" : "#000000",
        overflow: "hidden",
      }}
    >
      {!overlayOnly && videoSrc ? (
        <CameraVideo videoSrc={videoSrc} editPlan={editPlan || {}} />
      ) : null}

      {editPlan?.hook_overlay?.enabled && editPlan.hook_overlay.text && (
        <Sequence
          from={Math.max(
            0,
            Math.round(Number(editPlan.hook_overlay.start || 0) * fps),
          )}
          durationInFrames={Math.max(
            1,
            Math.ceil(
              (
                Number(editPlan.hook_overlay.end || 2.2) -
                Number(editPlan.hook_overlay.start || 0)
              ) * fps,
            ),
          )}
        >
          <Headline text={editPlan.hook_overlay.text} />
        </Sequence>
      )}

      {(editPlan?.overlays || []).map((overlay, index) => {
        const from = Math.max(
          0,
          Math.round(Number(overlay.start || 0) * fps),
        );
        const durationInFrames = Math.max(
          1,
          Math.ceil(
            (Number(overlay.end || 0) - Number(overlay.start || 0)) * fps,
          ),
        );

        return (
          <Sequence
            key={`overlay-${index}`}
            from={from}
            durationInFrames={durationInFrames}
          >
            <Overlay overlay={overlay} />
          </Sequence>
        );
      })}

      {(pages || []).map((page, index) => {
        const from = Math.max(
          0,
          Math.round((page.startMs / 1000) * fps),
        );
        const durationInFrames = Math.max(
          1,
          Math.ceil((page.durationMs / 1000) * fps),
        );

        return (
          <Sequence
            key={`${page.startMs}-${index}`}
            from={from}
            durationInFrames={durationInFrames}
          >
            <CaptionPage
              page={page}
              captionSettings={captionSettings}
            />
          </Sequence>
        );
      })}

      {editPlan?.progress?.enabled && (
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            height: 7,
            width: `${progress * 100}%`,
            backgroundColor: "#FFD800",
          }}
        />
      )}
    </AbsoluteFill>
  );
}
