import { spawn } from "node:child_process";

function runJson(bin, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`multimodal analyzer timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`multimodal analyzer exited ${code}: ${stderr.slice(-1800)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim() || "{}"));
      } catch (e) {
        reject(new Error(`multimodal analyzer invalid JSON: ${stdout.slice(-800)}`));
      }
    });
  });
}

export async function buildMultimodalTimeline({
  master,
  sampleFps = Number(process.env.CLIP_MULTIMODAL_FPS || 1),
  timeoutMs = Number(process.env.CLIP_MULTIMODAL_TIMEOUT_MS || 12 * 60 * 1000),
} = {}) {
  if (!master) throw new Error("multimodal analyzer: master ausente");
  const result = await runJson("python3", [
    "/app/vision/multimodal_analyzer_light.py",
    "--input", master,
    "--yunet", "/app/vision/yunet.onnx",
    "--emotion-model", "/app/vision/emotion-ferplus-8.onnx",
    "--sample-fps", String(sampleFps),
    "--width", String(Number(process.env.CLIP_MULTIMODAL_WIDTH || 448)),
    "--max-events", String(Number(process.env.CLIP_MULTIMODAL_MAX_EVENTS || 420)),
  ], timeoutMs);

  if (!result || result.version !== "multimodal_light_v1" || !Array.isArray(result.events)) {
    throw new Error("multimodal analyzer returned invalid payload");
  }
  return result;
}
