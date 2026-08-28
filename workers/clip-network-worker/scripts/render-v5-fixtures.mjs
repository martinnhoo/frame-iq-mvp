import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { renderTemplateFixture } from "../render/v5Renderer.mjs";

const ffmpeg = process.env.FFMPEG_BIN || "ffmpeg";
const outputDir = resolve(process.argv[2] || "./work/v5-fixtures");
const simpleReference = resolve(process.argv[3] || "");
const mediaReference = resolve(process.argv[4] || process.argv[3] || "");
const newsReference = resolve(process.argv[5] || process.argv[3] || "");

function run(args, label) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${label} falhou (${signal || code}): ${stderr.slice(-1200)}`));
    });
  });
}

async function sourceFromReference(reference, output, crop) {
  await run([
    "-hide_banner", "-loglevel", "error", "-y",
    "-loop", "1", "-i", reference,
    "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=48000",
    "-t", "3",
    "-vf", `${crop},scale=1280:720:flags=lanczos,format=yuv420p`,
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18",
    "-c:a", "aac", "-shortest", output,
  ], `fixture source ${output}`);
}

await mkdir(outputDir, { recursive: true });
const specs = [
  {
    preset: "simple_viral",
    reference: simpleReference,
    crop: "crop=335:260:0:170",
    headline: "AGORA O FRAMEIQ FICOU MUITO MAIS PROFISSIONAL 🚀",
  },
  {
    preset: "media_split",
    reference: mediaReference,
    crop: "crop=335:260:0:300",
    supportCrop: "crop=335:225:0:0,scale=1080:680:force_original_aspect_ratio=increase,crop=1080:680",
    headline: "FRAMEIQ GANHA UMA EDIÇÃO DE RESPEITO 😳",
  },
  {
    preset: "news_page",
    reference: newsReference,
    crop: "crop=335:300:0:190",
    headline: "A nova máquina de cortes do FrameIQ já está pronta",
  },
];
const results = [];

for (const spec of specs) {
  const source = join(outputDir, `${spec.preset}-source.mp4`);
  const output = join(outputDir, `${spec.preset}.mp4`);
  await sourceFromReference(spec.reference, source, spec.crop);
  let supportingFrame = null;
  if (spec.supportCrop) {
    supportingFrame = join(outputDir, `${spec.preset}-support.jpg`);
    await run([
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", spec.reference, "-vf", spec.supportCrop,
      "-frames:v", "1", supportingFrame,
    ], "supporting image");
  }
  const result = await renderTemplateFixture({
    master: source,
    output,
    dir: outputDir,
    preset: spec.preset,
    supportingFrame,
    headline: spec.headline,
  });
  const frame = join(outputDir, `${spec.preset}.png`);
  await run([
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", "1.75", "-i", output, "-frames:v", "1", frame,
  ], "fixture frame");
  results.push({ preset: spec.preset, mp4: output, png: frame, ...result });
}

await writeFile(
  join(outputDir, "fixtures.json"),
  `${JSON.stringify(results, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(results.map(({ preset, mp4, png, visualQa }) => ({ preset, mp4, png, visualQa })), null, 2));
