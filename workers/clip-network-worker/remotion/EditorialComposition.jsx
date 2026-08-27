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
  captionFontSize: 116,
  captionOutline: 15,
  normalColour: "#FFFFFF",
  activeColour: "#FFD800",
  captionBottom: 350,
  captionLowerMidBottom: 500,
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

  let scale = 1.02;
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
        Number(event.scale_from ?? event.scale ?? 1.02),
        Number(event.scale_to ?? event.scale ?? 1.02),
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
    const target = Number(emphasis.scale || 1.1);
    scale = Math.max(scale, 1 + (target - 1) * pulse);
  }

  scale = clamp(scale, 1, 1.16);
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
    durationInFrames: 5,
    config: { damping: 200 },
  });

  const scale = interpolate(entrance, [0, 1], [0.84, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(entrance, [0, 1], [35, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const nowMs = page.startMs + (frame / fps) * 1000;
  const fontSize = DESIGN.captionFontSize * Number(captionSettings?.scale || 1);

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
        left: "5%",
        width: "90%",
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
          lineHeight: 0.96,
          letterSpacing: "-2.5px",
          textTransform: "uppercase",
          whiteSpace: "pre-wrap",
          WebkitTextStroke: `${DESIGN.captionOutline}px #000000`,
          paintOrder: "stroke fill",
          filter: "drop-shadow(0 2px 1px rgba(0,0,0,0.12))",
        }}
      >
        {page.tokens.map((token, index) => {
          const active =
            captionSettings?.highlightActiveWord !== false &&
            nowMs >= token.fromMs &&
            nowMs < token.toMs;

          return (
            <span
              key={`${token.fromMs}-${index}`}
              style={{
                color: active ? DESIGN.activeColour : DESIGN.normalColour,
              }}
            >
              {String(token.text || "").toUpperCase()}
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
    config: { damping: 18, stiffness: 180 },
    durationInFrames: 10,
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 150,
        left: 70,
        right: 70,
        textAlign: "center",
        opacity: entrance,
        transform: `translateY(${interpolate(entrance, [0, 1], [-18, 0])}px)`,
      }}
    >
      <span
        style={{
          display: "inline-block",
          maxWidth: 900,
          padding: "15px 23px",
          borderRadius: 18,
          backgroundColor: "rgba(0,0,0,0.72)",
          color: "#FFFFFF",
          fontFamily: DESIGN.fontFamily,
          fontSize: 60,
          lineHeight: 1.02,
          fontWeight: 900,
          letterSpacing: "-1.4px",
          textTransform: "uppercase",
          boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
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
        left: 70,
        right: 70,
        top:
          overlay.position === "upper_mid"
            ? 400
            : overlay.position === "lower_mid"
              ? 1120
              : 170,
        textAlign: "center",
      }}
    >
      <span
        style={{
          display: "inline-block",
          padding: isEmphasis ? "12px 18px" : "10px 16px",
          borderRadius: 14,
          backgroundColor: isEmphasis
            ? "rgba(0,0,0,0.78)"
            : "rgba(0,0,0,0.64)",
          color: isEmphasis ? "#FFD800" : "#FFFFFF",
          fontFamily: DESIGN.fontFamily,
          fontSize: isEmphasis ? 56 : 46,
          fontWeight: 900,
          lineHeight: 1,
          textTransform: "uppercase",
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
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <CameraVideo videoSrc={videoSrc} editPlan={editPlan || {}} />

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
