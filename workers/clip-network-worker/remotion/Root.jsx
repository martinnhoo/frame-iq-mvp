import React from "react";
import { Composition } from "remotion";
import { ClipComposition } from "./ClipComposition";
import { EditorialComposition } from "./EditorialComposition";

const FPS = 30;

const baseProps = {
  videoSrc: "",
  pages: [],
  durationSeconds: 1,
  captionSettings: {
    scale: 0.9,
    position: "lower_mid",
    highlightActiveWord: true,
  },
};

const metadata = ({ props }) => ({
  width: 1080,
  height: 1920,
  fps: FPS,
  durationInFrames: Math.max(
    1,
    Math.ceil(Number(props.durationSeconds || 1) * FPS),
  ),
});

const editorialDefaults = {
  ...baseProps,
  editPlan: {
    version: 3,
    camera: [],
    overlays: [],
    emphasis: [],
  },
};

export const RemotionRoot = () => (
  <>
    <Composition
      id="ClipNetworkCaption"
      component={ClipComposition}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={FPS}
      defaultProps={baseProps}
      calculateMetadata={metadata}
    />

    <Composition
      id="ClipNetworkEditorial"
      component={EditorialComposition}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={FPS}
      defaultProps={{
        ...editorialDefaults,
        overlayOnly: false,
      }}
      calculateMetadata={metadata}
    />

    <Composition
      id="ClipNetworkEditorialOverlay"
      component={EditorialComposition}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={FPS}
      defaultProps={{
        ...editorialDefaults,
        overlayOnly: true,
      }}
      calculateMetadata={metadata}
    />
  </>
);
