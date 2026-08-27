import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
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
  return renderComposition({
    id: "ClipNetworkEditorial",
    inputVideo,
    outputVideo,
    inputProps: {
      pages,
      durationSeconds,
      captionSettings,
      editPlan,
    },
  });
}
