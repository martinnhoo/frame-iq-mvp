// Video model registry — PiAPI multi-model support.
//
// Cada modelo expõe:
//   - metadata pro frontend (label, badge, cost, bestFor, supports)
//   - função buildPiapiInput(input) que constrói o body PiAPI específico
//
// O server hub-video-gen recebe { model: "kling-std" | "kling-pro" | "hailuo" | "luma" }
// e usa MODELS[model].buildPiapiInput pra montar o payload correto. Polling
// é genérico (mesmo PiAPI envelope) — só a criação muda.
//
// Status: VERIFIED = testado e funcionando · BETA = best-guess shape, pode
// precisar ajuste depois do primeiro teste real. Se beta falhar, ajusta o
// shape baseado no erro do PiAPI.

export type VideoModelId = "kling-std" | "kling-pro" | "hailuo" | "luma";

export interface NormalizedInput {
  prompt: string;
  imageUrl: string | null;        // só http(s), validado upstream
  imageTailUrl: string | null;    // last-frame (Kling 3.0 only)
  duration: number;               // segundos (5 ou 10)
  aspectRatio: string;            // "16:9" | "9:16" | "1:1"
  audio: boolean;                 // gerar áudio nativo (Kling 3.0)
}

// O body é exatamente o que o PiAPI espera no POST /api/v1/task
export interface PiapiCreateBody {
  model: string;
  task_type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>;
  config?: Record<string, unknown>;
}

export interface VideoModelMeta {
  id: VideoModelId;
  label: string;
  bestFor: string;              // 1 linha pro UI ("Movimento natural, geral")
  badge: "verified" | "beta";
  resolution: "720p" | "1080p";
  // Custo aproximado por 5s de vídeo (USD) — referência pro UI, não billing real
  cost5s: number;
  supports: {
    imageToVideo: boolean;
    audio: boolean;
    durations: number[];
    aspectRatios: string[];
  };
  buildPiapiInput: (input: NormalizedInput) => PiapiCreateBody;
}

// ── Kling 3.0 Standard (720p) — VERIFIED ─────────────────────────────
// Shape testado em produção desde maio/2026. Cobre maior parte dos casos.
function buildKlingStd(input: NormalizedInput): PiapiCreateBody {
  return {
    model: "kling",
    task_type: "video_generation",
    input: {
      prompt: input.prompt,
      version: "3.0",
      mode: "std",
      duration: input.duration,
      aspect_ratio: input.aspectRatio,
      enable_audio: input.audio,
      prefer_multi_shots: false,
      ...(input.imageUrl ? { image_url: input.imageUrl } : {}),
      ...(input.imageTailUrl ? { image_tail_url: input.imageTailUrl } : {}),
    },
    config: { service_mode: "public" },
  };
}

// ── Kling 3.0 Pro (1080p) — VERIFIED ─────────────────────────────────
// Mesmo shape, mode=pro pra 1080p.
function buildKlingPro(input: NormalizedInput): PiapiCreateBody {
  const body = buildKlingStd(input);
  body.input.mode = "pro";
  return body;
}

// ── Hailuo 02 — BETA ─────────────────────────────────────────────────
// Shape baseado em padrões PiAPI (model: "hailuo", input similar a Kling).
// PiAPI docs: https://piapi.ai/docs/minimax-api (provider MiniMax = Hailuo)
// Diferença vs Kling: aspect_ratio só "16:9" e "9:16" no Hailuo 02; sem audio nativo.
//
// Se falhar com "piapi_create_failed", próxima iteração ajusta:
//   - pode precisar de "model": "minimax" em vez de "hailuo"
//   - pode precisar de "task_type": "text-to-video-01"
//   - pode não aceitar duration > 6s
function buildHailuo(input: NormalizedInput): PiapiCreateBody {
  // Hailuo só suporta 16:9 e 9:16 — força 16:9 se vier 1:1
  const aspectRatio = input.aspectRatio === "1:1" ? "16:9" : input.aspectRatio;
  return {
    model: "hailuo",
    task_type: "video_generation",
    input: {
      prompt: input.prompt,
      duration: Math.min(input.duration, 6), // Hailuo 02 max 6s
      aspect_ratio: aspectRatio,
      ...(input.imageUrl ? { image_url: input.imageUrl } : {}),
    },
    config: { service_mode: "public" },
  };
}

// ── Luma Dream Machine — BETA ─────────────────────────────────────────
// Shape baseado em padrões PiAPI (model: "luma").
// PiAPI docs: https://piapi.ai/docs/luma-api
// Diferença vs Kling: Luma ignora "duration" (sempre 5s no ray-1) e
// só suporta 16:9. Sem audio nativo.
//
// Se falhar, próxima iteração ajusta:
//   - pode precisar de model_version param ("ray-1" vs "ray-2")
//   - pode rejeitar image_tail_url
function buildLuma(input: NormalizedInput): PiapiCreateBody {
  return {
    model: "luma",
    task_type: "video_generation",
    input: {
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio === "1:1" ? "16:9" : input.aspectRatio,
      ...(input.imageUrl ? { image_url: input.imageUrl } : {}),
    },
    config: { service_mode: "public" },
  };
}

// ── Registry ──────────────────────────────────────────────────────────
export const VIDEO_MODELS: Record<VideoModelId, VideoModelMeta> = {
  "kling-std": {
    id: "kling-std",
    label: "Kling 3.0 Standard",
    bestFor: "Movimento natural, uso geral",
    badge: "verified",
    resolution: "720p",
    cost5s: 0.10,
    supports: {
      imageToVideo: true,
      audio: true,
      durations: [5, 10],
      aspectRatios: ["16:9", "9:16", "1:1"],
    },
    buildPiapiInput: buildKlingStd,
  },
  "kling-pro": {
    id: "kling-pro",
    label: "Kling 3.0 Pro",
    bestFor: "Cinematic 1080p, qualidade máxima",
    badge: "verified",
    resolution: "1080p",
    cost5s: 0.30,
    supports: {
      imageToVideo: true,
      audio: true,
      durations: [5, 10],
      aspectRatios: ["16:9", "9:16", "1:1"],
    },
    buildPiapiInput: buildKlingPro,
  },
  "hailuo": {
    id: "hailuo",
    label: "Hailuo 02",
    bestFor: "Personagens consistentes, expressões",
    badge: "beta",
    resolution: "720p",
    cost5s: 0.20,
    supports: {
      imageToVideo: true,
      audio: false,
      durations: [5, 6],
      aspectRatios: ["16:9", "9:16"],
    },
    buildPiapiInput: buildHailuo,
  },
  "luma": {
    id: "luma",
    label: "Luma Dream Machine",
    bestFor: "Orgânico, humanos, lifestyle",
    badge: "beta",
    resolution: "720p",
    cost5s: 0.25,
    supports: {
      imageToVideo: true,
      audio: false,
      durations: [5],
      aspectRatios: ["16:9", "9:16"],
    },
    buildPiapiInput: buildLuma,
  },
};

export function getModel(id: string): VideoModelMeta {
  return VIDEO_MODELS[id as VideoModelId] || VIDEO_MODELS["kling-std"];
}
