// hub-faceswap — face swap (Brilliant Hub).
//
// Suporta 2 modos:
//   - mode="image" → troca face em uma foto. ~$0.01/call. Síncrono.
//     model: "Qubico/image-toolkit"
//     input: { target_image, swap_image }
//
//   - mode="video" → troca face em um MP4. Pricing por frame. ASSÍNCRONO.
//     model: "Qubico/video-toolkit"
//     input: { target_video, swap_image, swap_faces_index?, target_faces_index? }
//     limites: MP4 only, ≤10 MB, ≤720p, ≤600 frames
//
// Arquitetura:
//   - Imagem é rápida (~10s) → sincrono no POST `action=create`
//   - Vídeo pode demorar 60-300s, estouraria timeout do Edge Function
//     (150s). Frontend chama 2x:
//        1. POST `action=create` → cria task no PiAPI, retorna task_id
//        2. POST `action=poll` a cada 5s → checa status, se completed,
//           baixa+upload Storage+insert hub_assets

const FN_VERSION = "v2.0-faceswap-2026-05-07-async-poll";

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

interface FaceswapInput {
  mode: "image" | "video";
  target_url: string;
  swap_image_url: string;
  swap_faces_index?: string;
  target_faces_index?: string;
}

interface CreateTaskResult {
  ok: boolean;
  task_id?: string;
  error?: string;
}

interface PollResult {
  status: "pending" | "completed" | "failed";
  output_url?: string;
  error?: string;
}

// ── Pré-valida URLs públicas ───────────────────────────────────────
async function validateUrl(
  name: string,
  url: string,
  expectVideo: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (!head.ok) {
      return { ok: false, error: `${name}_not_accessible: status=${head.status}` };
    }
    const ct = head.headers.get("content-type") || "";
    if (expectVideo && !ct.includes("video")) {
      return { ok: false, error: `${name}_not_video: content-type=${ct}` };
    }
    if (!expectVideo && !ct.includes("image")) {
      return { ok: false, error: `${name}_not_image: content-type=${ct}` };
    }
    if (expectVideo) {
      const len = head.headers.get("content-length");
      if (len && Number(len) > 10 * 1024 * 1024) {
        return {
          ok: false,
          error: `target_video_too_large: ${(Number(len) / 1024 / 1024).toFixed(1)}MB (PiAPI max 10MB)`,
        };
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `${name}_fetch_error: ${String(e).slice(0, 150)}` };
  }
}

// ── PiAPI: cria task e retorna task_id ───────────────────────────
async function createPiapiTask(input: FaceswapInput, apiKey: string): Promise<CreateTaskResult> {
  const isVideo = input.mode === "video";

  // Pré-valida URLs antes de gastar com PiAPI
  const tValid = await validateUrl("target_url", input.target_url, isVideo);
  if (!tValid.ok) return { ok: false, error: tValid.error };
  const sValid = await validateUrl("swap_image_url", input.swap_image_url, false);
  if (!sValid.ok) return { ok: false, error: sValid.error };

  const body = isVideo
    ? {
        model: "Qubico/video-toolkit",
        task_type: "face-swap",
        input: {
          swap_image: input.swap_image_url,
          target_video: input.target_url,
          ...(input.swap_faces_index ? { swap_faces_index: input.swap_faces_index } : {}),
          ...(input.target_faces_index ? { target_faces_index: input.target_faces_index } : {}),
        },
        config: { service_mode: "public" },
      }
    : {
        model: "Qubico/image-toolkit",
        task_type: "face-swap",
        input: {
          target_image: input.target_url,
          swap_image: input.swap_image_url,
        },
        config: { service_mode: "public" },
      };

  console.log(`[hub-faceswap] piapi create mode=${input.mode}`);

  let createRes: Response;
  try {
    createRes = await fetch("https://api.piapi.ai/api/v1/task", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: `network_error: ${String(e).slice(0, 200)}` };
  }

  const createText = await createRes.text();
  console.log(`[hub-faceswap] piapi create response status=${createRes.status} body=${createText.slice(0, 1500)}`);

  if (!createRes.ok) {
    let detail = createText.slice(0, 800);
    try {
      const pj = JSON.parse(createText);
      const errMsg = pj?.message
        || pj?.data?.error?.message
        || pj?.data?.error?.detail
        || pj?.data?.error?.raw_message
        || pj?.data?.fail_reason
        || pj?.error
        || null;
      if (errMsg) detail = `${errMsg} | full: ${createText.slice(0, 600)}`;
    } catch { /* keep raw */ }
    return { ok: false, error: `piapi_create_failed: ${detail}` };
  }

  let parsed: { code?: number; message?: string; data?: { task_id?: string } };
  try { parsed = JSON.parse(createText); }
  catch { return { ok: false, error: `piapi_non_json: ${createText.slice(0, 200)}` }; }
  const task_id = parsed?.data?.task_id;
  if (!task_id) {
    return { ok: false, error: `piapi_no_task_id: ${parsed.message || createText.slice(0, 200)}` };
  }
  return { ok: true, task_id };
}

// ── PiAPI: poll uma vez. Retorna pending/completed/failed ──────────
async function pollPiapiTask(taskId: string, isVideo: boolean, apiKey: string): Promise<PollResult> {
  let pollRes: Response;
  try {
    pollRes = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
      method: "GET",
      headers: { "x-api-key": apiKey },
    });
  } catch (e) {
    return { status: "pending", error: `poll_network: ${String(e).slice(0, 100)}` };
  }
  if (!pollRes.ok) {
    return { status: "pending", error: `poll_status=${pollRes.status}` };
  }
  const pollText = await pollRes.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: any;
  try { payload = JSON.parse(pollText); } catch { return { status: "pending" }; }

  const status = payload?.data?.status;
  if (status === "failed") {
    const data = payload?.data || {};
    const errMsg = data.error?.message
      || data.error?.detail
      || data.error?.raw_message
      || data.error?.code
      || data.message
      || data.fail_reason
      || payload?.message
      || "task failed (no detail)";
    console.error(`[hub-faceswap] PiAPI failed task ${taskId}:`, JSON.stringify(payload).slice(0, 1500));
    return { status: "failed", error: `piapi_task_failed: ${errMsg}` };
  }
  if (status === "completed") {
    const out = payload?.data?.output;
    const explicit = isVideo
      ? (typeof out?.video_url === "string" ? out.video_url
         : typeof out?.video === "string" ? out.video : null)
      : (typeof out?.image_url === "string" ? out.image_url
         : typeof out?.image === "string" ? out.image : null);
    const output_url = explicit || deepFindMediaUrl(out, isVideo);
    if (!output_url) {
      return { status: "failed", error: `piapi_no_output_url: ${JSON.stringify(out).slice(0, 300)}` };
    }
    return { status: "completed", output_url };
  }
  return { status: "pending" };
}

// ── Sync image gen: cria + polla até completar (rápido) ───────────
async function generateImageSync(input: FaceswapInput, apiKey: string, deadline: number): Promise<PollResult & { task_id?: string }> {
  const create = await createPiapiTask(input, apiKey);
  if (!create.ok || !create.task_id) {
    return { status: "failed", error: create.error || "create_failed" };
  }
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const poll = await pollPiapiTask(create.task_id, input.mode === "video", apiKey);
    if (poll.status !== "pending") return { ...poll, task_id: create.task_id };
  }
  return { status: "failed", error: "wall_clock_timeout (130s)", task_id: create.task_id };
}

// ── Download da PiAPI + re-upload pro Supabase Storage ─────────────
async function downloadAndStore(
  piapiUrl: string,
  mode: "image" | "video",
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
): Promise<string> {
  let finalUrl = piapiUrl;
  try {
    const dlRes = await fetch(piapiUrl);
    if (dlRes.ok) {
      const blob = await dlRes.blob();
      const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
      const ext = mode === "video" ? "mp4" : "png";
      const contentType = mode === "video" ? "video/mp4" : (blob.type || "image/png");
      const path = `${userId}/faceswap/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await sb.storage.from("hub-images").upload(path, blob, {
        contentType, cacheControl: "3600", upsert: false,
      });
      if (upErr) {
        console.warn(`[hub-faceswap] storage upload failed: ${upErr.message}`);
      } else {
        const { data: urlData } = sb.storage.from("hub-images").getPublicUrl(path);
        if (urlData?.publicUrl) {
          finalUrl = urlData.publicUrl;
          console.log(`[hub-faceswap] uploaded to storage (${sizeMB} MB): ${path}`);
        }
      }
    } else {
      console.warn(`[hub-faceswap] download from PiAPI failed status=${dlRes.status}`);
    }
  } catch (e) {
    console.warn(`[hub-faceswap] storage upload exception: ${String(e).slice(0, 150)}`);
  }
  return finalUrl;
}

// ── Insert em hub_assets ───────────────────────────────────────────
async function persistAsset(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  userId: string,
  mode: "image" | "video",
  finalUrl: string,
  piapiUrl: string,
  targetUrl: string,
  swapImageUrl: string,
  taskId: string,
  brandId: string | null,
): Promise<string | null> {
  try {
    const { data: inserted, error: dbErr } = await sb.from("hub_assets")
      .insert({
        user_id: userId,
        kind: "hub_faceswap",
        content: {
          mode,
          output_url: finalUrl,
          piapi_url: piapiUrl,
          ...(mode === "video" ? { video_url: finalUrl } : { image_url: finalUrl }),
          target_url: targetUrl,
          swap_image_url: swapImageUrl,
          task_id: taskId,
          model: mode === "video" ? "Qubico/video-toolkit" : "Qubico/image-toolkit",
          brand_id: brandId || null,
        },
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (dbErr) {
      console.error("[hub-faceswap] DB insert error:", dbErr.message);
      return null;
    }
    return inserted?.id || null;
  } catch (e) {
    console.error("[hub-faceswap] DB exception:", e);
    return null;
  }
}

// ── Main handler ─────────────────────────────────────────────────
console.log(`[hub-faceswap] boot ${FN_VERSION}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PIAPI_KEY = Deno.env.get("PIAPI_API_KEY") || Deno.env.get("PIAPI_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);
    }
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData } = await sb.auth.getUser(authHeader.slice(7));
    const authUser = userData?.user;
    if (!authUser) return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);

    if (!PIAPI_KEY) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "piapi_key_missing",
        message: "Adicione PIAPI_API_KEY nos secrets do Supabase Edge Functions.",
      }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const {
      action = "create",
      mode,
      target_url,
      swap_image_url,
      swap_faces_index,
      target_faces_index,
      brand_id = null,
      task_id: existing_task_id,
    } = body as {
      action?: "create" | "poll";
      mode?: "image" | "video";
      target_url?: string;
      swap_image_url?: string;
      swap_faces_index?: string;
      target_faces_index?: string;
      brand_id?: string | null;
      task_id?: string;
    };

    // ── ACTION: poll ──────────────────────────────────────────────
    if (action === "poll") {
      if (!existing_task_id) {
        return jsonResponse({ _v: FN_VERSION, ok: false, error: "missing_task_id" }, 400);
      }
      if (!mode || (mode !== "image" && mode !== "video")) {
        return jsonResponse({ _v: FN_VERSION, ok: false, error: "invalid_mode" }, 400);
      }

      const poll = await pollPiapiTask(existing_task_id, mode === "video", PIAPI_KEY);
      if (poll.status === "pending") {
        return jsonResponse({
          _v: FN_VERSION, ok: true, status: "pending", task_id: existing_task_id,
        }, 200);
      }
      if (poll.status === "failed") {
        return jsonResponse({
          _v: FN_VERSION, ok: false, status: "failed",
          error: poll.error || "task_failed",
          task_id: existing_task_id,
        }, 502);
      }
      // completed — download + upload + insert
      const finalUrl = await downloadAndStore(poll.output_url!, mode, authUser.id, sb);
      const memoryId = await persistAsset(
        sb, authUser.id, mode,
        finalUrl, poll.output_url!,
        target_url || "", swap_image_url || "",
        existing_task_id, brand_id,
      );
      return jsonResponse({
        _v: FN_VERSION, ok: true, status: "completed",
        mode, output_url: finalUrl, memory_id: memoryId,
        task_id: existing_task_id,
      }, 200);
    }

    // ── ACTION: create ────────────────────────────────────────────
    if (!mode || (mode !== "image" && mode !== "video")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "invalid_mode",
        message: "mode deve ser 'image' ou 'video'." }, 400);
    }
    if (!target_url || !target_url.startsWith("http")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "invalid_target_url" }, 400);
    }
    if (!swap_image_url || !swap_image_url.startsWith("http")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "invalid_swap_image_url" }, 400);
    }

    console.log(`[hub-faceswap] start — user=${authUser.id} mode=${mode}`);

    // IMAGEM: síncrono fim a fim (~10-30s, dentro do timeout)
    if (mode === "image") {
      const deadline = Date.now() + TOTAL_TIMEOUT_MS;
      const result = await generateImageSync(
        { mode, target_url, swap_image_url, swap_faces_index, target_faces_index },
        PIAPI_KEY, deadline,
      );
      if (result.status !== "completed" || !result.output_url) {
        return jsonResponse({
          _v: FN_VERSION, ok: false,
          error: result.error || "unknown_error",
          task_id: result.task_id,
        }, 502);
      }
      const finalUrl = await downloadAndStore(result.output_url, mode, authUser.id, sb);
      const memoryId = await persistAsset(
        sb, authUser.id, mode,
        finalUrl, result.output_url,
        target_url, swap_image_url,
        result.task_id || "", brand_id,
      );
      return jsonResponse({
        _v: FN_VERSION, ok: true, status: "completed",
        mode, output_url: finalUrl, memory_id: memoryId,
        task_id: result.task_id,
      }, 200);
    }

    // VÍDEO: só cria task. Frontend polla via action=poll.
    const create = await createPiapiTask(
      { mode, target_url, swap_image_url, swap_faces_index, target_faces_index },
      PIAPI_KEY,
    );
    if (!create.ok || !create.task_id) {
      return jsonResponse({
        _v: FN_VERSION, ok: false,
        error: create.error || "create_failed",
      }, 502);
    }
    return jsonResponse({
      _v: FN_VERSION, ok: true, status: "pending",
      mode, task_id: create.task_id,
    }, 200);

  } catch (e) {
    console.error("[hub-faceswap] unexpected:", e);
    return jsonResponse({
      _v: FN_VERSION, ok: false, error: "internal_error",
      message: String(e).slice(0, 300),
    }, 500);
  }
});

// ── Deep search por URL de mídia (fallback se PiAPI mudar shape) ──
function deepFindMediaUrl(obj: unknown, wantVideo: boolean): string | null {
  if (obj == null) return null;
  if (typeof obj === "string") return looksLikeMediaUrl(obj, wantVideo) ? obj : null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = deepFindMediaUrl(item, wantVideo);
      if (found) return found;
    }
    return null;
  }
  if (typeof obj === "object") {
    for (const value of Object.values(obj as Record<string, unknown>)) {
      const found = deepFindMediaUrl(value, wantVideo);
      if (found) return found;
    }
  }
  return null;
}

function looksLikeMediaUrl(s: string, wantVideo: boolean): boolean {
  if (!s.startsWith("http")) return false;
  if (wantVideo) {
    if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(s)) return true;
    if (/storage\.theapi\.app\/videos\//i.test(s)) return true;
    return false;
  }
  if (/\.(png|jpg|jpeg|webp)(\?|$)/i.test(s)) return true;
  if (/storage\.theapi\.app\/images?\//i.test(s)) return true;
  return false;
}
