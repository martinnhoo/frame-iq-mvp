import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";

const ENTRY_POINT = fileURLToPath(
  new URL("../remotion/index.jsx", import.meta.url),
);

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;

let bundlePromise = null;
let browserPromise = null;

async function getServeUrl() {
  if (!bundlePromise) {
    bundlePromise = bundle({
      entryPoint: ENTRY_POINT,
      webpackOverride: config => config,
    });
  }
  return bundlePromise;
}

async function ensureRenderBrowser() {
  if (!browserPromise) {
    browserPromise = ensureBrowser({ logLevel: "warn" });
  }
  return browserPromise;
}

function startLocalMediaServer(file) {
  return new Promise((resolve, reject) => {
    const server = createServer(async (request, response) => {
      try {
        const info = await stat(file);
        const total = info.size;

        response.setHeader("Accept-Ranges", "bytes");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Content-Type", "video/mp4");

        if (request.method === "HEAD") {
          response.statusCode = 200;
          response.setHeader("Content-Length", total);
          response.end();
          return;
        }

        const range = request.headers.range;
        if (!range) {
          response.statusCode = 200;
          response.setHeader("Content-Length", total);
          createReadStream(file).pipe(response);
          return;
        }

        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match) {
          response.statusCode = 416;
          response.setHeader("Content-Range", `bytes */${total}`);
          response.end();
          return;
        }

        let start = match[1] ? Number(match[1]) : 0;
        let end = match[2] ? Number(match[2]) : total - 1;

        if (!match[1] && match[2]) {
          const suffix = Number(match[2]);
          start = Math.max(0, total - suffix);
          end = total - 1;
        }

        start = Math.max(0, start);
        end = Math.min(total - 1, end);

        if (start > end || start >= total) {
          response.statusCode = 416;
          response.setHeader("Content-Range", `bytes */${total}`);
          response.end();
          return;
        }

        response.statusCode = 206;
        response.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
        response.setHeader("Content-Length", end - start + 1);
        createReadStream(file, { start, end }).pipe(response);
      } catch (error) {
        response.statusCode = 500;
        response.end(String(error?.message || error));
      }
    });

    server.once("error", reject);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}/video.mp4`,
        close: () => new Promise(done => server.close(done)),
      });
    });
  });
}

function run(bin, args, { timeoutMs = 20 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${bin} excedeu o tempo limite`));
    }, timeoutMs);

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });
    child.on("error", error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", code => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            `${bin} saiu com ${code}: ${stderr.slice(-2500)}`,
          ),
        );
      }
    });
  });
}

const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, Number(value)));

function easeExpression(progress, easing) {
  switch (easing) {
    case "out":
      return `(1-(1-(${progress}))*(1-(${progress})))`;
    case "in_out":
      return `if(lt((${progress}),0.5),2*(${progress})*(${progress}),1-pow(-2*(${progress})+2,2)/2)`;
    default:
      return `(${progress})`;
  }
}

function buildZoomExpression(editPlan, durationSeconds, fps = FPS) {
  const camera = Array.isArray(editPlan?.camera) ? editPlan.camera : [];
  const maxFrame = Math.max(1, Math.ceil(Number(durationSeconds || 1) * fps) - 1);

  let expression = "1.02";

  for (const event of [...camera].reverse()) {
    const start = clamp(event?.start ?? 0, 0, durationSeconds);
    const end = clamp(event?.end ?? start, start, durationSeconds);
    if (end <= start) continue;

    const startFrame = Math.max(0, Math.round(start * fps));
    const endFrame = Math.min(maxFrame, Math.max(startFrame + 1, Math.round(end * fps)));
    const span = Math.max(1, endFrame - startFrame);
    const from = clamp(event?.scale_from ?? event?.scale ?? 1.02, 1, 1.16);
    const to = clamp(event?.scale_to ?? event?.scale ?? from, 1, 1.16);
    const progress = `(on-${startFrame})/${span}`;
    const eased = easeExpression(progress, String(event?.easing || "linear"));
    const zoom = `(${from}+(${to}-${from})*(${eased}))`;

    expression =
      `if(between(on,${startFrame},${endFrame}),${zoom},${expression})`;
  }

  const emphasis = Array.isArray(editPlan?.emphasis) ? editPlan.emphasis : [];
  for (const item of emphasis) {
    if (item?.type !== "punch_in") continue;

    const centerSeconds = clamp(item?.time ?? 0, 0, durationSeconds);
    const duration = Math.max(0.25, Number(item?.duration || 0.55));
    const centerFrame = Math.round(centerSeconds * fps);
    const halfFrames = Math.max(1, Math.round((duration * fps) / 2));
    const startFrame = Math.max(0, centerFrame - halfFrames);
    const endFrame = Math.min(maxFrame, centerFrame + halfFrames);
    const target = clamp(item?.scale ?? 1.1, 1, 1.16);
    const pulse =
      `(1-abs(on-${centerFrame})/${halfFrames})`;
    const punch =
      `if(between(on,${startFrame},${endFrame}),1+(${target}-1)*(${pulse}),1)`;

    expression = `max(${expression},${punch})`;
  }

  return `min(1.16,max(1,${expression}))`;
}

async function renderComposition({
  id,
  inputVideo,
  outputVideo,
  inputProps,
}) {
  await ensureRenderBrowser();
  const serveUrl = await getServeUrl();
  const media = await startLocalMediaServer(inputVideo);

  try {
    const props = {
      videoSrc: media.url,
      ...inputProps,
    };

    const composition = await selectComposition({
      serveUrl,
      id,
      inputProps: props,
      logLevel: "warn",
      chromiumOptions: {
        enableMultiProcessOnLinux: true,
      },
    });

    await renderMedia({
      serveUrl,
      composition,
      codec: "h264",
      outputLocation: outputVideo,
      inputProps: props,
      crf: 20,
      imageFormat: "jpeg",
      jpegQuality: 95,
      x264Preset: "ultrafast",
      audioBitrate: "128K",
      concurrency: 2,
      disallowParallelEncoding: true,
      offthreadVideoCacheSizeInBytes: 256 * 1024 * 1024,
      offthreadVideoThreads: 2,
      chromiumOptions: {
        enableMultiProcessOnLinux: true,
      },
      logLevel: "warn",
    });
  } finally {
    await media.close();
  }
}

async function renderEditorialOverlay({
  outputVideo,
  pages,
  durationSeconds,
  captionSettings,
  editPlan,
}) {
  await ensureRenderBrowser();
  const serveUrl = await getServeUrl();

  const props = {
    videoSrc: "",
    overlayOnly: true,
    pages,
    durationSeconds,
    captionSettings,
    editPlan,
  };

  const composition = await selectComposition({
    serveUrl,
    id: "ClipNetworkEditorialOverlay",
    inputProps: props,
    logLevel: "warn",
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
    },
  });

  await renderMedia({
    serveUrl,
    composition,
    codec: "prores",
    proResProfile: "4444",
    pixelFormat: "yuva444p10le",
    imageFormat: "png",
    outputLocation: outputVideo,
    inputProps: props,
    muted: true,
    concurrency: 2,
    disallowParallelEncoding: true,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
    },
    logLevel: "warn",
  });
}

async function composeEditorialWithFfmpeg({
  inputVideo,
  overlayVideo,
  outputVideo,
  editPlan,
  durationSeconds,
}) {
  const zoom = buildZoomExpression(editPlan, durationSeconds, FPS);

  const filter = [
    `[0:v]fps=${FPS},`,
    `zoompan=z='${zoom}':`,
    `x='iw/2-(iw/zoom/2)':`,
    `y='ih/2-(ih/zoom/2)':`,
    `d=1:s=${WIDTH}x${HEIGHT}:fps=${FPS},`,
    `setsar=1[base];`,
    `[1:v]fps=${FPS},format=rgba[overlay];`,
    `[base][overlay]overlay=0:0:format=auto:shortest=1[v]`,
  ].join("");

  const args = [
    "-y",
    "-i", inputVideo,
    "-i", overlayVideo,
    "-filter_complex", filter,
    "-map", "[v]",
    "-map", "0:a?",
    "-t", String(durationSeconds),
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputVideo,
  ];

  await run("ffmpeg", args);
}

export async function renderCaptionedVideo({
  inputVideo,
  outputVideo,
  pages,
  durationSeconds,
  captionSettings,
}) {
  return renderComposition({
    id: "ClipNetworkCaption",
    inputVideo,
    outputVideo,
    inputProps: {
      pages,
      durationSeconds,
      captionSettings,
    },
  });
}

export async function renderEditorialVideo({
  inputVideo,
  outputVideo,
  pages,
  durationSeconds,
  captionSettings,
  editPlan,
}) {
  const overlayVideo = `${outputVideo}.overlay.mov`;

  try {
    await renderEditorialOverlay({
      outputVideo: overlayVideo,
      pages,
      durationSeconds,
      captionSettings,
      editPlan,
    });

    await composeEditorialWithFfmpeg({
      inputVideo,
      overlayVideo,
      outputVideo,
      editPlan,
      durationSeconds,
    });
  } finally {
    await rm(overlayVideo, { force: true }).catch(() => {});
  }
}
