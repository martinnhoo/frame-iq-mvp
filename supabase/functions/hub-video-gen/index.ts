// hub-video-gen — geração de vídeo (Brilliant Hub).
//
// Spec: https://piapi.ai/docs/kling-api/kling-3-api (Kling 3.0)
//
// Pricing PiAPI Kling 3.0 (USD/segundo de vídeo):
//   - mode=std (720p) sem áudio: $0.10/s
//   - mode=std (720p) com áudio: $0.15/s
//   - mode=pro (1080p) sem áudio: $0.15/s
//   - mode=pro (1080p) com áudio: $0.20/s
//
// Modos de geração:
//   - text-to-video: input = { prompt, duration, aspect_ratio }
//   - image-to-video: input = { image_url, prompt (motion description), duration }
//   - first+last frame: input = { image_url, image_tail_url, prompt, duration }
//
// Pipeline PiAPI:
//   1. POST /api/v1/task → recebe task_id
//   2. Poll GET /api/v1/task/{id} a cada 5s até status="completed"
//   3. Extrai video_url do output (deep search por shape)
//   4. Salva em hub_assets kind="hub_video"
//
// Body shape Kling 3.0 (versão atual):
//   {
//     "model": "kling",
//     "task_type": "video_generation",
//     "input": {
//       "prompt": "...",
//       "version": "3.0",            ← obrigatório
//       "mode": "std" | "pro",        ← std=720p, pro=1080p
//       "duration": 3-15,             ← segundos
//       "aspect_ratio": "16:9"|"9:16"|"1:1",  ← ignorado se image_url
//       "enable_audio": boolean,
//       "prefer_multi_shots": false,
//       "image_url": "...",           ← opcional (image-to-video)
//       "image_tail_url": "..."       ← opcional (último frame)
//     },
//     "config": { "service_mode": "public" }
//   }
//
// Timeout: 130s. Vídeos 5s-720p levam ~60-90s no PiAPI.

const FN_VERSION = "v13-quota-msg-2026-08-01";

// Traduz erros crus do PiAPI em mensagens acionáveis pro usuário.
function friendlyPiapiError(raw: string): string {
  const s = (raw || "").toLowerCase();
  if (s.includes("credit not enough") || s.includes("quota not enough") || s.includes("freeze credit")) {
    return "provider_no_credits: A conta do provedor de vídeo (PiAPI) está sem créditos. Recarregue o saldo em piapi.ai para voltar a gerar vídeos.";
  }
  if (s.includes("rate limit") || s.includes("too many requests")) {
    return "provider_rate_limited: O provedor de vídeo está limitando as requisições. Tente novamente em alguns minutos.";
  }
  return raw;
}

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  reserveCredits, confirmCredits, refundCredits,
  insufficientCreditsResponse, resolveVideoAction, getUserPlan,
} from "../_shared/hub-credits.ts";
import { checkVideoCapacity } from "../_shared/provider-balance.ts";
import { checkVideoLimits, videoLimitResponse } from "../_shared/video-limits.ts";
import { getModel, type NormalizedInput, type PiapiCreateBody } from "./models.ts";

/**
 * Estorna a cobrança de uma task que falhou depois de criada.
 * Idempotente: só afeta linhas ainda em 'confirmed'.
 */
async function refundTaskCredits(sb: any, taskId: string): Promise<void> {
  try {
    const { error } = await sb
      .from("hub_credit_ledger")
      .update({ state: "refunded", settled_at: new Date().toISOString() })
      .eq("ref_id", taskId)
      .eq("state", "confirmed");
    if (error) console.error("[hub-video] estorno falhou:", error.message);
    else console.log(`[hub-video] créditos estornados — task=${taskId}`);
  } catch (e) {
    console.error("[hub-video] estorno lançou:", e);
  }
}

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
// Polling adaptive: 2s nos primeiros 30s (caso vídeo termine cedo —
// raro mas reduz latência), depois 5s (normal). Vídeos 5-10s levam
// 60-90s no Kling 3.0 std, então maioria do tempo fica no 5s.
const POLL_INTERVAL_FAST_MS = 2_000;
const POLL_INTERVAL_NORMAL_MS = 5_000;
const POLL_FAST_WINDOW_MS = 30_000;

// ── Provider: PiAPI (multi-model via MODEL_REGISTRY) ────────────────
// Body shape vem do adapter do modelo selecionado (kling-std/pro, hailuo, luma).
// Polling é genérico (mesmo envelope PiAPI pra todos os modelos).
interface PiapiResult {
  ok: boolean;
  video_url?: string;
  duration_s?: number;
  resolution?: string;
  task_id?: string;
  error?: string;
  provider_status?: number;
}

async function generateViaPiapi(body: PiapiCreateBody, resolution: string, apiKey: string, deadline: number): Promise<PiapiResult> {
  // ── 1. Cria task ──────────────────────────────────────────────────
  // Body já vem montado pelo MODEL_REGISTRY (Kling, Hailuo, Luma têm
  // shapes diferentes). Esta função é model-agnostic — só faz a chamada
  // e o polling do PiAPI envelope padrão.
  console.log(`[hub-video] piapi create model=${body.model} task_type=${body.task_type} keys=${Object.keys(body.input).join(",")}`);

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
      error: friendlyPiapiError(`piapi_create_failed: ${createText.slice(0, 800)}`),
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
  // Adaptive polling: 2s nos primeiros 30s, depois 5s. Vídeos 5-10s no
  // Kling 3.0 std levam 60-90s, então maior parte fica no 5s. O 2s
  // inicial só pega os raros casos de vídeo curto que termina cedo.
  const pollStart = Date.now();
  while (Date.now() < deadline) {
    const elapsedSinceStart = Date.now() - pollStart;
    const interval = elapsedSinceStart < POLL_FAST_WINDOW_MS
      ? POLL_INTERVAL_FAST_MS
      : POLL_INTERVAL_NORMAL_MS;
    await new Promise(r => setTimeout(r, interval));

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
        error: friendlyPiapiError(`piapi_task_failed: ${errMsg}`),
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
      // duration_s: priorizamos o que o PiAPI retorna (mais fiel), caímos no
      // que pedimos no body (body.input.duration) só se PiAPI não devolver.
      const requestedDuration = typeof body.input.duration === "number" ? body.input.duration : 5;
      const duration_s = firstWork?.duration ? parseFloat(firstWork.duration) : requestedDuration;
      return {
        ok: true,
        video_url,
        duration_s,
        resolution,
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

// ── Async: create task (sem polling) ────────────────────────────────
async function createPiapiTask(body: PiapiCreateBody, apiKey: string): Promise<{ ok: boolean; task_id?: string; error?: string }> {
  console.log(`[hub-video] piapi create(async) model=${body.model} keys=${Object.keys(body.input).join(",")}`);
  let res: Response;
  try {
    res = await fetch("https://api.piapi.ai/api/v1/task", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: `network_error: ${String(e).slice(0, 200)}` };
  }
  const text = await res.text();
  if (!res.ok) return { ok: false, error: friendlyPiapiError(`piapi_create_failed: ${text.slice(0, 800)}`) };
  let payload: { data?: { task_id?: string }; message?: string };
  try { payload = JSON.parse(text); } catch { return { ok: false, error: `piapi_create_non_json: ${text.slice(0, 200)}` }; }
  const task_id = payload?.data?.task_id;
  if (!task_id) return { ok: false, error: `piapi_no_task_id: ${payload.message || text.slice(0, 200)}` };
  return { ok: true, task_id };
}

// ── Async: poll uma única vez ───────────────────────────────────────
async function pollPiapiOnce(taskId: string, apiKey: string, resolution: string): Promise<{ status: "pending" | "completed" | "failed"; result?: PiapiResult; error?: string }> {
  let res: Response;
  try {
    res = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
      method: "GET",
      headers: { "x-api-key": apiKey },
    });
  } catch (e) {
    return { status: "pending", error: String(e).slice(0, 120) };
  }
  if (!res.ok) return { status: "pending", error: `poll_status=${res.status}` };
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: any;
  try { payload = JSON.parse(text); } catch { return { status: "pending" }; }

  const status = payload?.data?.status;
  if (status === "failed") {
    const data = payload?.data || {};
    const errMsg = data.error?.message || data.error?.detail || data.error?.raw_message
      || data.error?.code || data.message || data.fail_reason || payload?.message
      || "task failed (no detail provided by PiAPI)";
    console.error(`[hub-video] PiAPI failed task ${taskId}:`, JSON.stringify(payload).slice(0, 1500));
    return { status: "failed", error: friendlyPiapiError(`piapi_task_failed: ${errMsg}`) };
  }
  if (status !== "completed") return { status: "pending" };

  const out = payload?.data?.output;
  const works = out?.works || [];
  const firstWork = works[0]?.video;
  const explicit = (typeof out?.video === "string" ? out.video : null)
    || (typeof out?.video_url === "string" ? out.video_url : null)
    || (typeof firstWork?.resource_without_watermark === "string" ? firstWork.resource_without_watermark : null)
    || (typeof firstWork?.resource === "string" ? firstWork.resource : null);
  const video_url = explicit || deepFindVideoUrl(out);
  if (!video_url) {
    console.error(`[hub-video] no_video_url. Full output:`, JSON.stringify(out));
    return { status: "failed", error: `piapi_no_video_url_in_output: ${JSON.stringify(out).slice(0, 300)}` };
  }
  const duration_s = firstWork?.duration ? parseFloat(firstWork.duration) : undefined;
  return {
    status: "completed",
    result: { ok: true, video_url, duration_s, resolution, task_id: taskId },
  };
}

// ── Stub: fal.ai (Fase futura) ──────────────────────────────────────
async function generateViaFalai(_apiKey: string, _deadline: number): Promise<PiapiResult> {
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
      image_tail_url = null,
      duration = 5,
      aspect_ratio = "16:9",
      enable_audio = false,
      mode = "std",
      model: bodyModel,         // NEW: kling-std | kling-pro | hailuo | luma
      provider: bodyProvider,
      brand_id = null,
      market = null,
      brand_hint = "",
      action = "generate",      // "create" | "poll" | "generate" (legacy sync)
      task_id: bodyTaskId = null,
    } = body as {
      prompt?: string;
      image_url?: string | null;
      image_tail_url?: string | null;
      duration?: number;
      aspect_ratio?: string;
      enable_audio?: boolean;
      mode?: "std" | "pro";
      model?: string;
      provider?: "piapi" | "falai";
      brand_id?: string | null;
      market?: string | null;
      brand_hint?: string;
      action?: "create" | "poll" | "generate";
      task_id?: string | null;
    };

    // Resolve model: body.model > derivado do mode legacy (back-compat)
    // Body antigo manda { mode: "std"|"pro" } → mapeia pra kling-std/kling-pro.
    const modelId = bodyModel || (mode === "pro" ? "kling-pro" : "kling-std");
    const modelMeta = getModel(modelId);
    if (!modelMeta) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "invalid_model",
        message: `Modelo desconhecido: ${modelId}`,
      }, 400);
    }

    // Validação básica
    if (!prompt || prompt.trim().length < 5) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "invalid_prompt",
        message: "Prompt mínimo 5 caracteres.",
      }, 400);
    }

    // Provider: body > env > default
    const provider = bodyProvider || Deno.env.get("VIDEO_PROVIDER") || "piapi";

    // Constrói prompt final com brand context
    let finalPrompt = prompt.trim();
    if (brand_hint && brand_hint.trim()) {
      finalPrompt = `${brand_hint.trim()}\n\n${finalPrompt}`;
    }
    finalPrompt = finalPrompt.slice(0, 2500);

    // Validação de duração baseada no model.supports.durations
    const desiredDur = Math.floor(duration) || 5;
    const allowedDurations = modelMeta.supports.durations;
    const finalDuration = allowedDurations.includes(desiredDur)
      ? desiredDur
      : (allowedDurations.find(d => d >= desiredDur) || allowedDurations[allowedDurations.length - 1]);

    // Validação de aspect ratio baseada no model.supports.aspectRatios
    const finalAspect = modelMeta.supports.aspectRatios.includes(aspect_ratio)
      ? aspect_ratio
      : modelMeta.supports.aspectRatios[0];

    // Audio só se o modelo suporta
    const finalAudio = modelMeta.supports.audio && enable_audio;

    // Validação de imagem: só HTTP(S) URLs
    const normalizedImageUrl = typeof image_url === "string" && image_url.startsWith("http") ? image_url : null;
    const normalizedTailUrl = typeof image_tail_url === "string" && image_tail_url.startsWith("http") ? image_tail_url : null;

    console.log(`[hub-video] start — user=${authUser.id} model=${modelId} (${modelMeta.badge}) duration=${finalDuration}s audio=${finalAudio} aspect=${finalAspect} hasImage=${!!normalizedImageUrl}`);

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
      const input: NormalizedInput = {
        prompt: finalPrompt,
        imageUrl: normalizedImageUrl,
        imageTailUrl: normalizedTailUrl,
        duration: finalDuration,
        aspectRatio: finalAspect,
        audio: finalAudio,
      };

      // ── action=create → só cria a task e devolve task_id ───────────
      // Kling costuma levar 2-5 min; a edge function morre em ~150s.
      // Por isso o client cria e depois faz poll.
      if (action === "create") {
        // Reserva ANTES de falar com a PiAPI. Se debitássemos só no sucesso do
        // polling, o usuário dispararia N jobs em paralelo com saldo pra 1.
        const plan = await getUserPlan(sb, authUser.id);

        // Teto do plano ANTES da reserva: barrar depois de cobrar seria
        // cobrar por algo que não vai acontecer.
        const limitCheck = await checkVideoLimits(sb, authUser.id, plan);
        if (!limitCheck.allowed) return videoLimitResponse(limitCheck, cors);

        // Guarda de saldo: a PiAPI é pré-paga. Se estiver no fim, corta o
        // Free antes que ele queime o que resta e derrube o pagante junto.
        const capacity = await checkVideoCapacity(sb, PIAPI_KEY, plan);
        if (!capacity.allowed) {
          return jsonResponse({
            _v: FN_VERSION, ok: false, error: "capacity_restricted",
            message: capacity.message,
            upgrade_url: "/dashboard/settings?tab=plan",
          }, 402);
        }

        const creditAction = resolveVideoAction({
          duration: finalDuration,
          mode: modelMeta.resolution === "1080p" ? "pro" : "std",
          audio: finalAudio,
        });
        const reservation = await reserveCredits(sb, authUser.id, plan, creditAction);
        if (!reservation.ok) {
          return insufficientCreditsResponse(reservation, cors);
        }

        const piapiBody = modelMeta.buildPiapiInput(input);
        const created = await createPiapiTask(piapiBody, PIAPI_KEY);

        if (!created.ok || !created.task_id) {
          await refundCredits(sb, reservation.reservation_id!, created.error || "piapi_create_failed");
          return jsonResponse({
            _v: FN_VERSION, ok: false, error: "video_gen_failed",
            message: created.error || "Falha ao criar task de vídeo.",
            provider,
          }, 502);
        }

        // ref_id = task_id, pra que o poll consiga estornar se a task falhar.
        await confirmCredits(sb, reservation.reservation_id!, created.task_id);

        return jsonResponse({
          _v: FN_VERSION, ok: true, status: "pending",
          task_id: created.task_id, provider,
          model: modelMeta.id, model_label: modelMeta.label,
        }, 200);
      }

      // ── action=poll → checa uma vez ────────────────────────────────
      if (action === "poll") {
        if (!bodyTaskId) {
          return jsonResponse({ _v: FN_VERSION, ok: false, error: "missing_task_id" }, 400);
        }
        const poll = await pollPiapiOnce(bodyTaskId, PIAPI_KEY, modelMeta.resolution);
        if (poll.status === "pending") {
          return jsonResponse({ _v: FN_VERSION, ok: true, status: "pending", task_id: bodyTaskId }, 200);
        }
        if (poll.status === "failed" || !poll.result?.video_url) {
          // A cobrança foi confirmada na criação (pra impedir paralelismo
          // abusivo). Se a task morreu, o crédito volta agora.
          await refundTaskCredits(sb, bodyTaskId);
          return jsonResponse({
            _v: FN_VERSION, ok: false, error: "video_gen_failed",
            message: poll.error || "Falha na geração de vídeo.",
            provider, task_id: bodyTaskId,
          }, 502);
        }
        result = poll.result;
      } else {
        const piapiBody = modelMeta.buildPiapiInput(input);
        result = await generateViaPiapi(piapiBody, modelMeta.resolution, PIAPI_KEY, deadline);
      }
    } else if (provider === "falai") {
      const FAL_KEY = Deno.env.get("FAL_API_KEY");
      if (!FAL_KEY) {
        return jsonResponse({
          _v: FN_VERSION, ok: false, error: "fal_key_missing",
          message: "fal.ai ainda não foi codado. Use provider='piapi'.",
        }, 503);
      }
      result = await generateViaFalai(FAL_KEY, deadline);
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


    // ── Download do vídeo + upload pro Supabase Storage ──────────────
    // PiAPI NÃO garante storage permanente em storage.theapi.app — URLs
    // podem expirar. Fazemos download e re-upload pro nosso bucket pra
    // garantir que o asset fica acessível depois.
    // Se falhar, fica com a URL do PiAPI como fallback.
    let finalVideoUrl = result.video_url;
    try {
      const videoRes = await fetch(result.video_url);
      if (videoRes.ok) {
        const videoBlob = await videoRes.blob();
        const videoSizeMB = (videoBlob.size / 1024 / 1024).toFixed(2);
        const path = `${authUser.id}/videos/${crypto.randomUUID()}.mp4`;
        const { error: upErr } = await sb.storage.from("hub-images").upload(path, videoBlob, {
          contentType: videoBlob.type || "video/mp4",
          cacheControl: "3600",
          upsert: false,
        });
        if (upErr) {
          console.warn(`[hub-video] storage upload failed (using piapi URL): ${upErr.message}`);
        } else {
          const { data: urlData } = sb.storage.from("hub-images").getPublicUrl(path);
          if (urlData?.publicUrl) {
            finalVideoUrl = urlData.publicUrl;
            console.log(`[hub-video] uploaded to storage (${videoSizeMB} MB): ${path}`);
          }
        }
      } else {
        console.warn(`[hub-video] download from PiAPI failed status=${videoRes.status}, using piapi URL`);
      }
    } catch (e) {
      console.warn(`[hub-video] storage upload exception (using piapi URL): ${String(e).slice(0, 150)}`);
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
            video_url: finalVideoUrl,
            piapi_url: result.video_url,
            image_url: normalizedImageUrl,
            duration_s: result.duration_s,
            aspect_ratio: finalAspect,
            resolution: modelMeta.resolution,
            enable_audio: finalAudio,
            provider,
            task_id: result.task_id,
            model: modelMeta.id,                  // kling-std | kling-pro | hailuo | luma
            model_label: modelMeta.label,         // pra Library mostrar amigável
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

    console.log(`[hub-video] success — provider=${provider} memory_id=${memoryId} stored=${finalVideoUrl !== result.video_url} url=${finalVideoUrl.slice(0, 80)}`);

    return jsonResponse({
      _v: FN_VERSION,
      ok: true,
      video_url: finalVideoUrl,
      memory_id: memoryId,
      duration_s: result.duration_s,
      aspect_ratio: finalAspect,
      resolution: modelMeta.resolution,
      enable_audio: finalAudio,
      provider,
      task_id: result.task_id,
      model: modelMeta.id,
      model_label: modelMeta.label,
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
