// hub-video-gen — geração de vídeo (Brilliant Hub).
//
// Provider-agnostic: dispatcher escolhe entre PiAPI (default), fal.ai, ou
// outros via env var VIDEO_PROVIDER ou body.provider. Pra trocar no futuro,
// só adicionar nova função generateVia<X>() e ramo no dispatcher.
//
// Default: PiAPI Kling 3.0 std 720p sem áudio (mais barato — $0.10/s).
//
// Modos de geração:
//   - text-to-video: input = { prompt, duration, aspect_ratio }
//   - image-to-video: input = { image_url, prompt (motion description), duration }
//
// Pipeline PiAPI:
//   1. POST /api/v1/task → recebe task_id
//   2. Poll GET /api/v1/task/{id} a cada 5s até status="completed"
//   3. Extrai video_url do output
//   4. Salva em hub_assets kind="hub_video"
//
// Timeout: 130s (Supabase mata em 150s). Vídeos 5s-720p costumam levar
// 60-90s. Pra vídeos longos (>10s) pode estourar — caller deve usar
// duration ≤ 10s pra segurança.

const FN_VERSION = "v5-kling26-fix-2026-05-07";

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const TOTAL_TIMEOUT_MS = 130_000;
const POLL_INTERVAL_MS = 5_000;

// ── Provider: PiAPI Kling 3.0 ───────────────────────────────────────
interface PiapiInput {
  prompt: string;
  image_url?: string | null;
  duration: number;          // 3-15s
  aspect_ratio: string;      // "16:9" | "9:16" | "1:1"
  enable_audio: boolean;
  mode: "std" | "pro";
  resolution: "720p" | "1080p"; // PiAPI usa "version":"3.0" + outros params
  negative_prompt?: string;
}

interface PiapiResult {
  ok: boolean;
  video_url?: string;
  duration_s?: number;
  resolution?: string;
  task_id?: string;
  error?: string;
  provider_status?: number;
}

async function generateViaPiapi(input: PiapiInput, apiKey: string, deadline: number): Promise<PiapiResult> {
  // ── 1. Cria task ──────────────────────────────────────────────────
  // Body shape per https://piapi.ai/docs/kling-api/create-task
  // Kling API: duration must be 5 or 10 (not 3). version values:
  // 1.5/1.6/2.1/2.1-master/2.5/2.6 (default 2.6). NOT "3.0".
  const klingDuration = input.duration <= 7 ? 5 : 10;
  const body = {
    model: "kling",
    task_type: "video_generation",
    input: {
      prompt: input.prompt,
      negative_prompt: input.negative_prompt || "",
      cfg_scale: "0.5",
      duration: klingDuration,
      aspect_ratio: input.aspect_ratio,
      enable_audio: input.enable_audio,
      mode: input.mode,
      version: "2.6",
      ...(input.image_url ? { image_url: input.image_url } : {}),
    },
    config: {
      service_mode: "public",
    },
  };

  let createRes: Response;
  try {
    createRes = await fetch("https://api.piapi.ai/api/v1/task", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: `network_error: ${String(e).slice(0, 200)}` };
  }

  const createText = await createRes.text();
  if (!createRes.ok) {
    return {
      ok: false,
      error: `piapi_create_failed: ${createText.slice(0, 300)}`,
      provider_status: createRes.status,
    };
  }

  // PiAPI envelope: { code, message, data: { task_id, ... } }
  let createPayload: { code?: number; message?: string; data?: { task_id?: string } };
  try { createPayload = JSON.parse(createText); } catch {
    return { ok: false, error: `piapi_create_non_json: ${createText.slice(0, 200)}` };
  }
  const task_id = createPayload?.data?.task_id;
  if (!task_id) {
    return {
      ok: false,
      error: `piapi_no_task_id: ${createPayload.message || createText.slice(0, 200)}`,
    };
  }

  // ── 2. Poll task status ───────────────────────────────────────────
  // Poll a cada 5s até completed/failed ou timeout. Vídeos 5s-720p
  // costumam levar 60-90s no PiAPI std mode.
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    let pollRes: Response;
    try {
      pollRes = await fetch(`https://api.piapi.ai/api/v1/task/${task_id}`, {
        method: "GET",
        headers: { "x-api-key": apiKey },
      });
    } catch (e) {
      console.warn("[hub-video] poll network error (continuing):", String(e).slice(0, 100));
      continue;
    }

    if (!pollRes.ok) {
      console.warn("[hub-video] poll non-ok status:", pollRes.status);
      continue;
    }

    const pollText = await pollRes.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pollPayload: any;
    try { pollPayload = JSON.parse(pollText); } catch { continue; }

    const status = pollPayload?.data?.status;
    if (status === "failed") {
      // PiAPI pode colocar a razão em vários lugares — tenta todos
      const data = pollPayload?.data || {};
      const errMsg = data.error?.message
        || data.error?.detail
        || data.error?.raw_message
        || data.error?.code
        || data.message
        || data.fail_reason
        || pollPayload?.message
        || "task failed (no detail provided by PiAPI)";
      // Loga payload completo no Supabase logs pra debugar moderation/etc
      console.error(`[hub-video] PiAPI failed task ${task_id}:`, JSON.stringify(pollPayload).slice(0, 1500));
      return {
        ok: false,
        error: `piapi_task_failed: ${errMsg}`,
        task_id,
      };
    }
    if (status === "completed") {
      const out = pollPayload?.data?.output;
      // PiAPI retorna o video URL em formatos diferentes dependendo da
      // versão da API. Suporta TODOS os shapes conhecidos:
      //   - data.output.video                              ← Kling 3.0 atual
      //   - data.output.video_url                          ← formato antigo
      //   - data.output.works[0].video.resource            ← multi-shot
      //   - data.output.works[0].video.resource_without_watermark
      // E faz fallback final com deepFindVideoUrl: percorre o objeto inteiro
      // procurando QUALQUER string que pareça URL de vídeo. Isso protege
      // contra mudanças futuras de shape do PiAPI sem quebrar o user.
      const works = out?.works || [];
      const firstWork = works[0]?.video;
      const explicit = (typeof out?.video === "string" ? out.video : null)
        || (typeof out?.video_url === "string" ? out.video_url : null)
        || (typeof firstWork?.resource_without_watermark === "string" ? firstWork.resource_without_watermark : null)
        || (typeof firstWork?.resource === "string" ? firstWork.resource : null);
      const video_url = explicit || deepFindVideoUrl(out);
      if (!video_url) {
        // Loga payload completo nos logs do Supabase pra debug futuro,
        // sem truncamento.
        console.error(`[hub-video] no_video_url. Full output:`, JSON.stringify(out));
        return {
          ok: false,
          error: `piapi_no_video_url_in_output: ${JSON.stringify(out).slice(0, 300)}`,
          task_id,
        };
      }
      console.log(`[hub-video] video_url found via ${explicit ? "explicit" : "deep_search"}: ${video_url.slice(0, 80)}…`);
      const duration_s = firstWork?.duration ? parseFloat(firstWork.duration) : input.duration;
      return {
        ok: true,
        video_url,
        duration_s,
        resolution: input.resolution,
        task_id,
      };
    }
    // status: pending | processing | staged → continua polling
  }

  return {
    ok: false,
    error: `piapi_timeout: vídeo não completou em ${TOTAL_TIMEOUT_MS / 1000}s. Tenta duração mais curta.`,
    task_id,
  };
}

// ── Stub: fal.ai (Fase futura) ──────────────────────────────────────
async function generateViaFalai(_input: PiapiInput, _apiKey: string, _deadline: number): Promise<PiapiResult> {
  return {
    ok: false,
    error: "falai_not_implemented: troca VIDEO_PROVIDER pra 'piapi' enquanto fal.ai não tá codado.",
  };
}

// ── Main handler ────────────────────────────────────────────────────
console.log(`[hub-video] boot ${FN_VERSION}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData } = await sb.auth.getUser(authHeader.slice(7));
    const authUser = userData?.user;
    if (!authUser) return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const {
      prompt,
      image_url = null,
      duration = 5,
      aspect_ratio = "16:9",
      enable_audio = false,
      mode = "std",
      resolution = "720p",
      negative_prompt = "",
      provider: bodyProvider,
      brand_id = null,
      market = null,
      brand_hint = "",
    } = body as {
      prompt?: string;
      image_url?: string | null;
      duration?: number;
      aspect_ratio?: string;
      enable_audio?: boolean;
      mode?: "std" | "pro";
      resolution?: "720p" | "1080p";
      negative_prompt?: string;
      provider?: "piapi" | "falai";
      brand_id?: string | null;
      market?: string | null;
      brand_hint?: string;
    };

    // Validação básica
    if (!prompt || prompt.trim().length < 5) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "invalid_prompt",
        message: "Prompt mínimo 5 caracteres.",
      }, 400);
    }
    const dur = Math.max(3, Math.min(15, Math.floor(duration)));

    // Provider: body > env > default
    const provider = bodyProvider || Deno.env.get("VIDEO_PROVIDER") || "piapi";

    // Constrói prompt final com brand context
    let finalPrompt = prompt.trim();
    if (brand_hint && brand_hint.trim()) {
      finalPrompt = `${brand_hint.trim()}\n\n${finalPrompt}`;
    }
    finalPrompt = finalPrompt.slice(0, 2500); // PiAPI limita prompt

    console.log(`[hub-video] start — user=${authUser.id} provider=${provider} duration=${dur}s mode=${mode} resolution=${resolution} audio=${enable_audio} aspect=${aspect_ratio} hasImage=${!!image_url}`);

    // Auth provider
    let result: PiapiResult;
    const deadline = Date.now() + TOTAL_TIMEOUT_MS;

    if (provider === "piapi") {
      const PIAPI_KEY = Deno.env.get("PIAPI_API_KEY") || Deno.env.get("PIAPI_KEY");
      if (!PIAPI_KEY) {
        return jsonResponse({
          _v: FN_VERSION, ok: false, error: "piapi_key_missing",
          message: "Adicione PIAPI_API_KEY nos secrets do Supabase Edge Functions.",
        }, 503);
      }
      result = await generateViaPiapi({
        prompt: finalPrompt,
        image_url,
        duration: dur,
        aspect_ratio,
        enable_audio,
        mode,
        resolution,
        negative_prompt,
      }, PIAPI_KEY, deadline);
    } else if (provider === "falai") {
      const FAL_KEY = Deno.env.get("FAL_API_KEY");
      if (!FAL_KEY) {
        return jsonResponse({
          _v: FN_VERSION, ok: false, error: "fal_key_missing",
          message: "fal.ai ainda não foi codado. Use provider='piapi'.",
        }, 503);
      }
      result = await generateViaFalai({
        prompt: finalPrompt, image_url, duration: dur, aspect_ratio,
        enable_audio, mode, resolution, negative_prompt,
      }, FAL_KEY, deadline);
    } else {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "unknown_provider",
        message: `Provider '${provider}' não suportado. Use 'piapi' ou 'falai'.`,
      }, 400);
    }

    if (!result.ok || !result.video_url) {
      return jsonResponse({
        _v: FN_VERSION, ok: false,
        error: "video_gen_failed",
        message: result.error || "Falha desconhecida na geração de vídeo.",
        provider, task_id: result.task_id,
      }, 502);
    }

    // ── Persiste em hub_assets ──────────────────────────────────────
    let memoryId: string | null = null;
    try {
      const { data: inserted, error: dbErr } = await sb.from("hub_assets")
        .insert({
          user_id: authUser.id,
          kind: "hub_video",
          content: {
            prompt: prompt.trim(),
            final_prompt: finalPrompt,
            video_url: result.video_url,
            image_url, // input image (image-to-video) ou null (text-to-video)
            duration_s: result.duration_s,
            aspect_ratio,
            resolution,
            mode,
            enable_audio,
            provider,
            task_id: result.task_id,
            model: "kling-3.0",
            brand_id: brand_id || null,
            market: market || null,
          },
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (dbErr) {
        console.error("[hub-video] DB insert error:", dbErr.message);
      } else {
        memoryId = inserted?.id || null;
      }
    } catch (dbErr) {
      console.error("[hub-video] DB exception:", dbErr);
    }

    console.log(`[hub-video] success — provider=${provider} memory_id=${memoryId} video=${result.video_url.slice(0, 80)}`);

    return jsonResponse({
      _v: FN_VERSION,
      ok: true,
      video_url: result.video_url,
      memory_id: memoryId,
      duration_s: result.duration_s,
      aspect_ratio,
      resolution,
      mode,
      enable_audio,
      provider,
      task_id: result.task_id,
      model: "kling-3.0",
      brand_id: brand_id || null,
      market: market || null,
    }, 200);

  } catch (e) {
    console.error("[hub-video] unexpected:", e);
    return jsonResponse({
      _v: FN_VERSION, ok: false, error: "internal_error",
      message: String(e).slice(0, 300),
    }, 500);
  }
});

// Percorre objeto recursivamente procurando string que seja URL de vídeo.
// Aceita qualquer extensão de vídeo comum E qualquer URL de
// storage.theapi.app (PiAPI guarda vídeo lá independente da extensão visível).
// Fallback de último recurso quando os campos explícitos não bateram.
function deepFindVideoUrl(obj: unknown): string | null {
  if (obj == null) return null;
  if (typeof obj === "string") {
    if (looksLikeVideoUrl(obj)) return obj;
    return null;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = deepFindVideoUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof obj === "object") {
    for (const value of Object.values(obj as Record<string, unknown>)) {
      const found = deepFindVideoUrl(value);
      if (found) return found;
    }
  }
  return null;
}

function looksLikeVideoUrl(s: string): boolean {
  if (!s.startsWith("http")) return false;
  // URL com extensão de vídeo
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(s)) return true;
  // PiAPI usa storage.theapi.app pra todos os vídeos
  if (/storage\.theapi\.app\/videos\//i.test(s)) return true;
  return false;
}
