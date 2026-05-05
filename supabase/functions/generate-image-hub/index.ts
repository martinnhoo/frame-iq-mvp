// generate-image-hub — Image Generator interno (Brilliant Hub).
//
// Estratégia: tenta gpt-image-1 (qualidade fotorrealista, modelo
// novo da OpenAI) primeiro. Se falhar por acesso/disponibilidade
// (403 = org não verificada; 404 = modelo indisponível na conta),
// cai pra dall-e-3 (estável em qualquer conta paga).
//
// Resposta inclui `model_used` pra UI mostrar qual rodou de fato.
// Saída salva em creative_memory com type='hub_image'.

const FN_VERSION = "v4-gptimage1-fallback-dalle3-2026-05-05";

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Sizes diferem entre os 2 modelos. gpt-image-1 suporta 4 ratios
// nativos; dall-e-3 só 3 (4:5 cai pra portrait mais próximo).
const SIZE_GPTIMAGE: Record<string, string> = {
  "1:1":  "1024x1024",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "4:5":  "1024x1536", // sem 4:5 nativo, usa portrait
};
const SIZE_DALLE: Record<string, string> = {
  "1:1":  "1024x1024",
  "16:9": "1792x1024",
  "9:16": "1024x1792",
  "4:5":  "1024x1792",
};

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface ModelAttempt {
  ok: boolean;
  imageUrl?: string | null;
  revisedPrompt?: string;
  status?: number;
  errText?: string;
  errMsg?: string;
}

async function tryGptImage1(prompt: string, aspect: string, quality: string, apiKey: string): Promise<ModelAttempt> {
  const size = SIZE_GPTIMAGE[aspect] || SIZE_GPTIMAGE["1:1"];
  const reqBody = {
    model: "gpt-image-1",
    prompt: prompt.slice(0, 4000),
    size,
    quality, // gpt-image-1 aceita low|medium|high
    n: 1,
    moderation: "low",
  };
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
  });
  if (!r.ok) {
    const t = await r.text();
    let msg = "";
    try { msg = JSON.parse(t)?.error?.message || ""; } catch {}
    return { ok: false, status: r.status, errText: t, errMsg: msg };
  }
  const data = await r.json();
  const imgData = data?.data?.[0];
  // gpt-image-1 retorna sempre b64_json (sem url)
  const imageUrl = imgData?.b64_json ? `data:image/png;base64,${imgData.b64_json}` : null;
  return {
    ok: true,
    imageUrl,
    revisedPrompt: imgData?.revised_prompt || prompt,
  };
}

async function tryDalle3(prompt: string, aspect: string, quality: string, apiKey: string): Promise<ModelAttempt> {
  const size = SIZE_DALLE[aspect] || SIZE_DALLE["1:1"];
  const dalleQuality = quality === "high" ? "hd" : "standard";
  const reqBody = {
    model: "dall-e-3",
    prompt: prompt.slice(0, 4000),
    size,
    quality: dalleQuality,
    n: 1,
    response_format: "url",
  };
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
  });
  if (!r.ok) {
    const t = await r.text();
    let msg = "";
    try { msg = JSON.parse(t)?.error?.message || ""; } catch {}
    return { ok: false, status: r.status, errText: t, errMsg: msg };
  }
  const data = await r.json();
  const imgData = data?.data?.[0];
  const imageUrl: string | null = imgData?.url
    || (imgData?.b64_json ? `data:image/png;base64,${imgData.b64_json}` : null);
  return {
    ok: true,
    imageUrl,
    revisedPrompt: imgData?.revised_prompt || prompt,
  };
}

console.log(`[hub-image] boot ${FN_VERSION}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[hub-image] OPENAI_API_KEY not configured");
      return jsonResponse({
        _v: FN_VERSION,
        ok: false,
        error: "openai_not_configured",
        message: "OPENAI_API_KEY não configurado no Supabase.",
      }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized", message: "Sem token de auth." }, 401);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData } = await sb.auth.getUser(authHeader.slice(7));
    const authUser = userData?.user;
    if (!authUser) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized", message: "Sessão inválida." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const {
      prompt,
      aspect_ratio = "1:1",
      quality = "medium",
    } = body as {
      prompt?: string;
      aspect_ratio?: string;
      quality?: "low" | "medium" | "high";
    };

    if (!prompt || prompt.trim().length < 5) {
      return jsonResponse({
        _v: FN_VERSION,
        ok: false,
        error: "invalid_prompt",
        message: "Descreva a imagem com pelo menos 5 caracteres.",
      }, 400);
    }

    const cleanPrompt = prompt.trim();
    console.log("[hub-image] start", JSON.stringify({
      user_id: authUser.id, aspect_ratio, quality, prompt_len: cleanPrompt.length,
    }));

    // 1. Tenta gpt-image-1 (qualidade superior)
    let modelUsed = "gpt-image-1";
    let fallbackReason: string | null = null;
    let attempt = await tryGptImage1(cleanPrompt, aspect_ratio, quality, OPENAI_API_KEY);

    // 2. Se falhar com erro de acesso/disponibilidade, fallback pra dall-e-3
    if (!attempt.ok) {
      const isAccessIssue = attempt.status === 403 || attempt.status === 404
        || (attempt.errMsg || "").toLowerCase().includes("verified")
        || (attempt.errMsg || "").toLowerCase().includes("does not have access")
        || (attempt.errMsg || "").toLowerCase().includes("model not found");
      const isContentBlock = (attempt.errMsg || "").toLowerCase().includes("content_policy");

      if (isContentBlock) {
        // Não tenta dall-e-3 — content policy é mesmo critério
        console.warn("[hub-image] gpt-image-1 content block:", attempt.errMsg);
        return jsonResponse({
          _v: FN_VERSION,
          ok: false,
          error: "content_policy",
          message: "Prompt rejeitado por política de conteúdo da OpenAI.",
          openai_status: attempt.status,
          openai_message: attempt.errMsg,
          detail: (attempt.errText || "").slice(0, 500),
        }, 502);
      }

      if (isAccessIssue) {
        console.warn(`[hub-image] gpt-image-1 access denied (${attempt.status}): ${attempt.errMsg} — falling back to dall-e-3`);
        fallbackReason = attempt.errMsg || `gpt-image-1 indisponível (${attempt.status})`;
        modelUsed = "dall-e-3";
        attempt = await tryDalle3(cleanPrompt, aspect_ratio, quality, OPENAI_API_KEY);
      } else {
        // Outro erro (rate limit, 500, etc.) — retorna direto
        console.error("[hub-image] gpt-image-1 hard error:", attempt.status, attempt.errText);
        return jsonResponse({
          _v: FN_VERSION,
          ok: false,
          error: "image_gen_failed",
          message: attempt.errMsg || `OpenAI retornou ${attempt.status}.`,
          openai_status: attempt.status,
          openai_message: attempt.errMsg,
          detail: (attempt.errText || "").slice(0, 500),
        }, 502);
      }
    }

    // Se chegou aqui mas dall-e-3 também falhou
    if (!attempt.ok) {
      console.error("[hub-image] dall-e-3 also failed:", attempt.status, attempt.errText);
      return jsonResponse({
        _v: FN_VERSION,
        ok: false,
        error: "image_gen_failed",
        message: attempt.errMsg || `Ambos os modelos falharam. dall-e-3 retornou ${attempt.status}.`,
        openai_status: attempt.status,
        openai_message: attempt.errMsg,
        detail: (attempt.errText || "").slice(0, 500),
      }, 502);
    }

    const imageUrl = attempt.imageUrl;
    const revisedPrompt = attempt.revisedPrompt || cleanPrompt;

    if (!imageUrl) {
      console.error("[hub-image] no image in response");
      return jsonResponse({
        _v: FN_VERSION,
        ok: false,
        error: "no_image_returned",
        message: "OpenAI não retornou imagem.",
      }, 502);
    }

    const sizeUsed = modelUsed === "dall-e-3"
      ? (SIZE_DALLE[aspect_ratio] || SIZE_DALLE["1:1"])
      : (SIZE_GPTIMAGE[aspect_ratio] || SIZE_GPTIMAGE["1:1"]);

    // Persiste na biblioteca
    try {
      await sb.from("creative_memory").insert({
        user_id: authUser.id,
        type: "hub_image",
        content: {
          prompt: cleanPrompt,
          revised_prompt: revisedPrompt,
          image_url: imageUrl,
          aspect_ratio,
          size: sizeUsed,
          quality,
          model: modelUsed,
        },
        created_at: new Date().toISOString(),
      });
    } catch (dbErr) {
      console.warn("[hub-image] DB insert failed (non-fatal):", dbErr);
    }

    console.log(`[hub-image] success — model=${modelUsed} fallback=${!!fallbackReason}`);

    return jsonResponse({
      _v: FN_VERSION,
      ok: true,
      image_url: imageUrl,
      prompt: cleanPrompt,
      revised_prompt: revisedPrompt,
      aspect_ratio,
      size: sizeUsed,
      quality,
      model_used: modelUsed,
      fallback_reason: fallbackReason,
    }, 200);

  } catch (e) {
    console.error("[hub-image] unexpected error:", e);
    return jsonResponse({
      _v: FN_VERSION,
      ok: false,
      error: "internal_error",
      message: String(e).slice(0, 300),
    }, 500);
  }
});
