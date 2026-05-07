// hub-faceswap — face swap (Brilliant Hub).
//
// Suporta 2 modos:
//   - mode="image" → troca face em uma foto. ~$0.01/call.
//     model: "Qubico/image-toolkit"
//     input: { target_image, swap_image }
//
//   - mode="video" → troca face em um MP4. Pricing por frame.
//     model: "Qubico/video-toolkit"
//     input: { target_video, swap_image, swap_faces_index?, target_faces_index? }
//     limites: MP4 only, ≤10 MB, ≤720p, ≤600 frames
//
// Pipeline:
//   1. Recebe URLs (target + swap_image) — frontend já fez upload pra Storage
//   2. POST /api/v1/task com payload do mode escolhido
//   3. Poll /api/v1/task/{id} a cada 5s até completed/failed
//   4. Download do output → re-upload pro Supabase Storage (URLs persistentes)
//   5. Salva em hub_assets kind="hub_faceswap"
//
// Spec: https://piapi.ai/docs/faceswap-api/create-task (image)
//       https://piapi.ai/docs/faceswap-api/video-faceswap (video)

const FN_VERSION = "v1.2-faceswap-2026-05-07-validate-urls";

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

// ── Provider: PiAPI Faceswap ────────────────────────────────────────
interface FaceswapInput {
  mode: "image" | "video";
  target_url: string;          // URL da imagem/vídeo onde a face será trocada
  swap_image_url: string;      // URL da imagem com a face nova
  swap_faces_index?: string;   // só video — qual face do swap_image usar (e.g. "0" ou "0,1")
  target_faces_index?: string; // só video — qual face do target_video substituir
}

interface FaceswapResult {
  ok: boolean;
  output_url?: string;         // image_url ou video_url (depende do mode)
  task_id?: string;
  error?: string;
  provider_status?: number;
}

async function generateViaPiapi(input: FaceswapInput, apiKey: string, deadline: number): Promise<FaceswapResult> {
  const isVideo = input.mode === "video";
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

  console.log(`[hub-faceswap] piapi create mode=${input.mode} payload=${JSON.stringify({
    ...body,
    input: {
      ...body.input,
      swap_image: input.swap_image_url.slice(0, 60) + "...",
      ...(isVideo
        ? { target_video: input.target_url.slice(0, 60) + "..." }
        : { target_image: input.target_url.slice(0, 60) + "..." }),
    },
  })}`);

  // ── 0. Pré-valida que as URLs são acessíveis publicamente.
  // PiAPI baixa target_video e swap_image direto. Se a URL retorna 4xx,
  // o create falha com "input:null,status:failed" — sem dica do que
  // deu errado. Esse pré-check torna o erro acionável.
  for (const [name, url] of [
    ["target_url", input.target_url],
    ["swap_image_url", input.swap_image_url],
  ] as const) {
    try {
      const head = await fetch(url, { method: "HEAD" });
      if (!head.ok) {
        return {
          ok: false,
          error: `${name}_not_accessible: status=${head.status} url=${url.slice(0, 120)}`,
        };
      }
      const ct = head.headers.get("content-type") || "";
      const isVideoUrl = name === "target_url" && isVideo;
      if (isVideoUrl && !ct.includes("video")) {
        return {
          ok: false,
          error: `target_url_not_video: content-type=${ct} url=${url.slice(0, 120)}`,
        };
      }
      if (!isVideoUrl && !ct.includes("image")) {
        return {
          ok: false,
          error: `${name}_not_image: content-type=${ct} url=${url.slice(0, 120)}`,
        };
      }
      // Pra video, valida size <= 10MB cedo (PiAPI limit)
      const len = head.headers.get("content-length");
      if (isVideoUrl && len && Number(len) > 10 * 1024 * 1024) {
        return {
          ok: false,
          error: `target_video_too_large: ${(Number(len) / 1024 / 1024).toFixed(1)}MB (PiAPI max 10MB)`,
        };
      }
    } catch (e) {
      return { ok: false, error: `${name}_fetch_error: ${String(e).slice(0, 150)}` };
    }
  }

  // ── 1. Create task
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
  // Logging completo do response — debug. Slice grande pq PiAPI às vezes
  // retorna "input:null,status:failed" sem mensagem clara, e a parte que
  // ajuda (error.detail / fail_reason) vem depois.
  console.log(`[hub-faceswap] piapi create response status=${createRes.status} body=${createText.slice(0, 1500)}`);
  if (!createRes.ok) {
    // Tenta extrair message/error do JSON pra mensagem amigável
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
    return {
      ok: false,
      error: `piapi_create_failed: ${detail}`,
      provider_status: createRes.status,
    };
  }

  let createPayload: { code?: number; message?: string; data?: { task_id?: string } };
  try { createPayload = JSON.parse(createText); } catch {
    return { ok: false, error: `piapi_create_non_json: ${createText.slice(0, 200)}` };
  }
  const task_id = createPayload?.data?.task_id;
  if (!task_id) {
    return { ok: false, error: `piapi_no_task_id: ${createPayload.message || createText.slice(0, 200)}` };
  }

  // ── 2. Poll task status
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    let pollRes: Response;
    try {
      pollRes = await fetch(`https://api.piapi.ai/api/v1/task/${task_id}`, {
        method: "GET",
        headers: { "x-api-key": apiKey },
      });
    } catch (e) {
      console.warn("[hub-faceswap] poll network error:", String(e).slice(0, 100));
      continue;
    }

    if (!pollRes.ok) {
      console.warn("[hub-faceswap] poll non-ok status:", pollRes.status);
      continue;
    }

    const pollText = await pollRes.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pollPayload: any;
    try { pollPayload = JSON.parse(pollText); } catch { continue; }

    const status = pollPayload?.data?.status;
    if (status === "failed") {
      const data = pollPayload?.data || {};
      const errMsg = data.error?.message
        || data.error?.detail
        || data.error?.raw_message
        || data.error?.code
        || data.message
        || data.fail_reason
        || pollPayload?.message
        || "task failed (no detail provided by PiAPI)";
      console.error(`[hub-faceswap] PiAPI failed task ${task_id}:`, JSON.stringify(pollPayload).slice(0, 1500));
      return { ok: false, error: `piapi_task_failed: ${errMsg}`, task_id };
    }

    if (status === "completed") {
      const out = pollPayload?.data?.output;
      // PiAPI shapes:
      //   image-toolkit face-swap: out.image_url ou out.image
      //   video-toolkit face-swap: out.video_url ou out.video
      const explicit = isVideo
        ? (typeof out?.video_url === "string" ? out.video_url
           : typeof out?.video === "string" ? out.video : null)
        : (typeof out?.image_url === "string" ? out.image_url
           : typeof out?.image === "string" ? out.image : null);
      const output_url = explicit || deepFindMediaUrl(out, isVideo);
      if (!output_url) {
        console.error(`[hub-faceswap] no output URL. Full output:`, JSON.stringify(out));
        return {
          ok: false,
          error: `piapi_no_output_url: ${JSON.stringify(out).slice(0, 300)}`,
          task_id,
        };
      }
      console.log(`[hub-faceswap] output found via ${explicit ? "explicit" : "deep_search"}: ${output_url.slice(0, 80)}…`);
      return { ok: true, output_url, task_id };
    }

    // pending / staged / running — keep polling
    console.log(`[hub-faceswap] polling task ${task_id} status=${status}`);
  }

  return { ok: false, error: "piapi_wall_clock_timeout (130s)", task_id };
}

// ── Main handler ────────────────────────────────────────────────────
console.log(`[hub-faceswap] boot ${FN_VERSION}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);
    }
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData } = await sb.auth.getUser(authHeader.slice(7));
    const authUser = userData?.user;
    if (!authUser) return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const {
      mode,
      target_url,
      swap_image_url,
      swap_faces_index,
      target_faces_index,
      brand_id = null,
    } = body as {
      mode?: "image" | "video";
      target_url?: string;
      swap_image_url?: string;
      swap_faces_index?: string;
      target_faces_index?: string;
      brand_id?: string | null;
    };

    // Validação
    if (!mode || (mode !== "image" && mode !== "video")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "invalid_mode",
        message: "mode deve ser 'image' ou 'video'." }, 400);
    }
    if (!target_url || !target_url.startsWith("http")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "invalid_target_url",
        message: "target_url deve ser uma URL HTTP(S) pública." }, 400);
    }
    if (!swap_image_url || !swap_image_url.startsWith("http")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "invalid_swap_image_url",
        message: "swap_image_url deve ser uma URL HTTP(S) pública." }, 400);
    }

    const PIAPI_KEY = Deno.env.get("PIAPI_API_KEY") || Deno.env.get("PIAPI_KEY");
    if (!PIAPI_KEY) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "piapi_key_missing",
        message: "Adicione PIAPI_API_KEY nos secrets do Supabase Edge Functions." }, 503);
    }

    console.log(`[hub-faceswap] start — user=${authUser.id} mode=${mode}`);
    const deadline = Date.now() + TOTAL_TIMEOUT_MS;

    const result = await generateViaPiapi({
      mode,
      target_url,
      swap_image_url,
      swap_faces_index,
      target_faces_index,
    }, PIAPI_KEY, deadline);

    if (!result.ok || !result.output_url) {
      return jsonResponse({
        _v: FN_VERSION, ok: false,
        error: result.error || "unknown_error",
        task_id: result.task_id,
      }, 502);
    }

    // ── Download + re-upload pro Supabase Storage ────────────────────
    let finalUrl = result.output_url;
    try {
      const dlRes = await fetch(result.output_url);
      if (dlRes.ok) {
        const blob = await dlRes.blob();
        const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
        const ext = mode === "video" ? "mp4" : "png";
        const contentType = mode === "video" ? "video/mp4" : (blob.type || "image/png");
        const path = `${authUser.id}/faceswap/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await sb.storage.from("hub-images").upload(path, blob, {
          contentType,
          cacheControl: "3600",
          upsert: false,
        });
        if (upErr) {
          console.warn(`[hub-faceswap] storage upload failed: ${upErr.message} — using piapi URL`);
        } else {
          const { data: urlData } = sb.storage.from("hub-images").getPublicUrl(path);
          if (urlData?.publicUrl) {
            finalUrl = urlData.publicUrl;
            console.log(`[hub-faceswap] uploaded to storage (${sizeMB} MB): ${path}`);
          }
        }
      } else {
        console.warn(`[hub-faceswap] download from PiAPI failed status=${dlRes.status} — using piapi URL`);
      }
    } catch (e) {
      console.warn(`[hub-faceswap] storage upload exception: ${String(e).slice(0, 150)}`);
    }

    // ── Persiste em hub_assets ───────────────────────────────────────
    let memoryId: string | null = null;
    try {
      const { data: inserted, error: dbErr } = await sb.from("hub_assets")
        .insert({
          user_id: authUser.id,
          kind: "hub_faceswap",
          content: {
            mode,                          // "image" ou "video"
            output_url: finalUrl,          // URL persistente (Storage)
            piapi_url: result.output_url,  // backup raw do PiAPI
            // Pra Library reconhecer: image_url se foto, video_url se vídeo
            ...(mode === "video"
              ? { video_url: finalUrl }
              : { image_url: finalUrl }),
            target_url,                    // input original
            swap_image_url,                // input original (face usada)
            task_id: result.task_id,
            model: mode === "video" ? "Qubico/video-toolkit" : "Qubico/image-toolkit",
            brand_id: brand_id || null,
          },
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (dbErr) {
        console.error("[hub-faceswap] DB insert error:", dbErr.message);
        // Retorna erro real pra UI mostrar — antes ficava silencioso
        // e o user via "sucesso" mas asset sumia. Comum em CHECK constraint
        // violation (kind não permitido) ou RLS.
        return jsonResponse({
          _v: FN_VERSION,
          ok: false,
          error: "db_insert_failed",
          message: `Geração ok mas asset não foi salvo: ${dbErr.message}`,
          output_url: finalUrl, // Devolve URL pra UI ainda mostrar o resultado
          task_id: result.task_id,
        }, 200); // 200 porque a geração funcionou
      } else {
        memoryId = inserted?.id || null;
      }
    } catch (dbErr) {
      console.error("[hub-faceswap] DB exception:", dbErr);
    }

    console.log(`[hub-faceswap] success — mode=${mode} memory_id=${memoryId} url=${finalUrl.slice(0, 80)}`);

    return jsonResponse({
      _v: FN_VERSION,
      ok: true,
      mode,
      output_url: finalUrl,
      memory_id: memoryId,
      task_id: result.task_id,
    }, 200);

  } catch (e) {
    console.error("[hub-faceswap] unexpected:", e);
    return jsonResponse({
      _v: FN_VERSION, ok: false, error: "internal_error",
      message: String(e).slice(0, 300),
    }, 500);
  }
});

// Deep search por URL de imagem ou vídeo no output. Fallback se PiAPI mudar
// shape no futuro. Aceita URLs Qubico/image-toolkit + storage.theapi.app.
function deepFindMediaUrl(obj: unknown, wantVideo: boolean): string | null {
  if (obj == null) return null;
  if (typeof obj === "string") {
    if (looksLikeMediaUrl(obj, wantVideo)) return obj;
    return null;
  }
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
