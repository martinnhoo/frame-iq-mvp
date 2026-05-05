// generate-image-hub — Image Generator interno (Brilliant Hub).
//
// Modelo único: gpt-image-2 (decisão do produto). Sem fallback —
// se a OpenAI rejeitar, retorna o erro real pra UI lidar.

const FN_VERSION = "v6-gptimage2-only-2026-05-05";

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// gpt-image-2 — sizes nativos. 4:5 não tem nativo, cai no portrait
// mais próximo (1024x1536) e a IA enquadra.
const SIZE_MAP: Record<string, string> = {
  "1:1":  "1024x1024",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "4:5":  "1024x1536",
};

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

console.log(`[hub-image] boot ${FN_VERSION}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[hub-image] OPENAI_API_KEY not configured");
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "openai_not_configured",
        message: "OPENAI_API_KEY não configurado no Supabase.",
      }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized", message: "Sem token de auth." }, 401);
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData } = await sb.auth.getUser(authHeader.slice(7));
    const authUser = userData?.user;
    if (!authUser) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized", message: "Sessão inválida." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { prompt, aspect_ratio = "1:1", quality = "medium" } = body as {
      prompt?: string; aspect_ratio?: string; quality?: "low" | "medium" | "high";
    };

    if (!prompt || prompt.trim().length < 5) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "invalid_prompt",
        message: "Descreva a imagem com pelo menos 5 caracteres.",
      }, 400);
    }

    const cleanPrompt = prompt.trim().slice(0, 4000);
    const size = SIZE_MAP[aspect_ratio] || SIZE_MAP["1:1"];

    const reqBody = {
      model: "gpt-image-2",
      prompt: cleanPrompt,
      size,
      quality, // low | medium | high
      n: 1,
      moderation: "low",
    };

    console.log("[hub-image] calling OpenAI gpt-image-2:", JSON.stringify({
      user_id: authUser.id, size, quality, prompt_len: cleanPrompt.length,
    }));

    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(reqBody),
    });

    if (!r.ok) {
      const errText = await r.text();
      let errMsg = "";
      let errCode = "";
      try {
        const parsed = JSON.parse(errText);
        errMsg = parsed?.error?.message || "";
        errCode = parsed?.error?.code || "";
      } catch {}

      console.error(`[hub-image] gpt-image-2 ${r.status}:`, errText);

      let userError = "image_gen_failed";
      let userMessage = errMsg || `OpenAI retornou ${r.status}.`;
      if (errCode === "content_policy_violation" || errMsg.toLowerCase().includes("safety")) {
        userError = "content_policy";
        userMessage = "Prompt rejeitado por política de conteúdo da OpenAI.";
      } else if (r.status === 429) {
        userError = "rate_limited";
        userMessage = "Rate limit OpenAI atingido. Tenta de novo em ~1min.";
      } else if (r.status === 401) {
        userError = "openai_auth";
        userMessage = "Chave OpenAI inválida ou expirada.";
      } else if (r.status === 403) {
        userError = "openai_access";
        userMessage = errMsg || "Conta sem acesso a gpt-image-2 (verifica org/billing).";
      } else if (r.status === 404) {
        userError = "model_not_found";
        userMessage = errMsg || "Modelo gpt-image-2 não encontrado na sua conta OpenAI.";
      }

      return jsonResponse({
        _v: FN_VERSION, ok: false, error: userError, message: userMessage,
        openai_status: r.status, openai_message: errMsg, openai_code: errCode,
        detail: errText.slice(0, 500),
      }, 502);
    }

    const data = await r.json();
    const imgData = data?.data?.[0];
    const imageUrl: string | null = imgData?.url
      || (imgData?.b64_json ? `data:image/png;base64,${imgData.b64_json}` : null);
    const revisedPrompt = imgData?.revised_prompt || cleanPrompt;

    if (!imageUrl) {
      console.error("[hub-image] no image in response:", JSON.stringify(data).slice(0, 500));
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "no_image_returned",
        message: "gpt-image-2 não retornou imagem.",
      }, 502);
    }

    // Persiste na biblioteca
    try {
      await sb.from("creative_memory").insert({
        user_id: authUser.id,
        type: "hub_image",
        content: {
          prompt: cleanPrompt,
          revised_prompt: revisedPrompt,
          image_url: imageUrl,
          aspect_ratio, size, quality,
          model: "gpt-image-2",
        },
        created_at: new Date().toISOString(),
      });
    } catch (dbErr) {
      console.warn("[hub-image] DB insert failed (non-fatal):", dbErr);
    }

    console.log("[hub-image] success — gpt-image-2");

    return jsonResponse({
      _v: FN_VERSION,
      ok: true,
      image_url: imageUrl,
      prompt: cleanPrompt,
      revised_prompt: revisedPrompt,
      aspect_ratio, size, quality,
      model_used: "gpt-image-2",
    }, 200);

  } catch (e) {
    console.error("[hub-image] unexpected error:", e);
    return jsonResponse({
      _v: FN_VERSION, ok: false, error: "internal_error",
      message: String(e).slice(0, 300),
    }, 500);
  }
});
