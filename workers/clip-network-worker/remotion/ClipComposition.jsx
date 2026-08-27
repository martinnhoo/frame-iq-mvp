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
  fontFamily:
    '"Nimbus Sans Narrow", "Arial Narrow", Arial, sans-serif',
  fontSize: 116,
  outline: 15,
  normalColour: "#FFFFFF",
  activeColour: "#FFD800",
  maxWidthPercent: 90,
  bottom: 350,
  lowerMidBottom: 500,
  entranceFrames: 5,
  entranceScale: 0.84,
  entranceTranslateY: 35,
};

function positionStyle(position) {
  if (position === "center") {
    return {
      top: "50%",
      transform: "translateY(-50%)",
    };
  }

  return {
    bottom:
      position === "lower_mid"
        ? DESIGN.lowerMidBottom
        : DESIGN.bottom,
  };
}

const visibleToken = text =>
  String(text || "").toUpperCase();

function CaptionPage({
  page,
  captionSettings,
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    fps,
    frame,
    durationInFrames: DESIGN.entranceFrames,
    config: {
      damping: 200,
    },
  });

  const scale = interpolate(
    entrance,
    [0, 1],
    [DESIGN.entranceScale, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const translateY = interpolate(
    entrance,
    [0, 1],
    [DESIGN.entranceTranslateY, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const nowMs =
    page.startMs +
    frame / fps * 1000;

  const fontSize =
    DESIGN.fontSize *
    Number(captionSettings?.scale || 1);

  return (
    <div
      style={{
        position: "absolute",
        left: "5%",
        width: `${DESIGN.maxWidthPercent}%`,
        textAlign: "center",
        ...positionStyle(
          captionSettings?.position || "lower"
        ),
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
          WebkitTextStroke:
            `${DESIGN.outline}px #000000`,
          paintOrder: "stroke fill",
          filter:
            "drop-shadow(0 2px 1px rgba(0,0,0,0.12))",
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
                color:
                  active
                    ? DESIGN.activeColour
                    : DESIGN.normalColour,
              }}
            >
              {visibleToken(token.text)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function ClipComposition({
  videoSrc,
  pages,
  captionSettings,
}) {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        overflow: "hidden",
      }}
    >
      <OffthreadVideo
        src={videoSrc}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      {(pages || []).map((page, index) => {
        const from = Math.max(
          0,
          Math.round(page.startMs / 1000 * fps),
        );

        const durationInFrames = Math.max(
          1,
          Math.ceil(page.durationMs / 1000 * fps),
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
    </AbsoluteFill>
  );
}
