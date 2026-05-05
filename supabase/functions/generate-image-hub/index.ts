// generate-image-hub — Image Generator interno (Brilliant Hub).
//
// Estratégia: chain de modelos em ordem de qualidade decrescente.
//   1. gpt-image-2 (modelo novo da OpenAI, fotorrealista premium)
//   2. gpt-image-1 (geração anterior, ainda alta qualidade)
//   3. dall-e-3 (estável em qualquer conta paga, qualidade ilustrativa)
//
// Se um modelo falhar com erro de acesso/disponibilidade (404/403),
// passa pro próximo. Erros de content_policy ou rate_limit retornam
// direto (mesmo problema em qualquer modelo).
//
// Resposta inclui `model_used` pra UI mostrar qual rodou.

const FN_VERSION = "v5-chain-2026-05-05";

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Sizes por modelo. gpt-image-1/2 usam grid de 1024x{1024,1536} ou
// 1536x1024. dall-e-3 usa 1024x1024 / 1024x1792 / 1792x1024.
const SIZE_GPTIMAGE: Record<string, string> = {
  "1:1":  "1024x1024",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "4:5":  "1024x1536",
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

async function callOpenAI(reqBody: Record<string, unknown>, apiKey: string): Promise<ModelAttempt> {
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
  // Handle both url and b64_json responses (different models return different formats)
  const imageUrl: string | null = imgData?.url
    || (imgData?.b64_json ? `data:image/png;base64,${imgData.b64_json}` : null);
  return {
    ok: true,
    imageUrl,
    revisedPrompt: imgData?.revised_prompt,
  };
}

async function tryGptImage(model: "gpt-image-2" | "gpt-image-1", prompt: string, aspect: string, quality: string, apiKey: string): Promise<ModelAttempt> {
  const size = SIZE_GPTIMAGE[aspect] || SIZE_GPTIMAGE["1:1"];
  return callOpenAI({
    model,
    prompt: prompt.slice(0, 4000),
    size,
    quality, // low|medium|high
    n: 1,
    moderation: "low",
  }, apiKey);
}

async function tryDalle3(prompt: string, aspect: string, quality: string, apiKey: string): Promise<ModelAttempt> {
  const size = SIZE_DALLE[aspect] || SIZE_DALLE["1:1"];
  const dalleQuality = quality === "high" ? "hd" : "standard";
  return callOpenAI({
    model: "dall-e-3",
    prompt: prompt.slice(0, 4000),
    size,
    quality: dalleQuality,
    n: 1,
    response_format: "url",
  }, apiKey);
}

// True se o erro indica que vale tentar próximo modelo do chain
function isAvailabilityError(a: ModelAttempt): boolean {
  if (!a.status) return false;
  if (a.status === 403 || a.status === 404) return true;
  const m = (a.errMsg || "").toLowerCase();
  return m.includes("verified") || m.includes("does not have access")
      || m.includes("model not found") || m.includes("invalid model")
      || m.includes("must be verified");
}

function isContentBlock(a: ModelAttempt): boolean {
  const m = (a.errMsg || "").toLowerCase();
  return m.includes("content_policy") || m.includes("safety system");
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

    const cleanPrompt = prompt.trim();
    console.log("[hub-image] start", JSON.stringify({
      user_id: authUser.id, aspect_ratio, quality, prompt_len: cleanPrompt.length,
    }));

    // ── Chain de modelos ─────────────────────────────────────────────
    type ModelKey = "gpt-image-2" | "gpt-image-1" | "dall-e-3";
    const chain: ModelKey[] = ["gpt-image-2", "gpt-image-1", "dall-e-3"];
    let attempt: ModelAttempt | null = null;
    let modelUsed: ModelKey | null = null;
    const skipped: { model: ModelKey; reason: string; status?: number }[] = [];

    for (const model of chain) {
      console.log(`[hub-image] trying ${model}…`);
      const a: ModelAttempt = model === "dall-e-3"
        ? await tryDalle3(cleanPrompt, aspect_ratio, quality, OPENAI_API_KEY)
        : await tryGptImage(model, cleanPrompt, aspect_ratio, quality, OPENAI_API_KEY);

      if (a.ok) {
        attempt = a;
        modelUsed = model;
        break;
      }

      // Content policy ou rate limit — não adianta tentar outro modelo
      if (isContentBlock(a)) {
        console.warn(`[hub-image] ${model} content block:`, a.errMsg);
        return jsonResponse({
          _v: FN_VERSION, ok: false, error: "content_policy",
          message: "Prompt rejeitado por política de conteúdo da OpenAI.",
          openai_status: a.status, openai_message: a.errMsg,
          detail: (a.errText || "").slice(0, 500),
        }, 502);
      }
      if (a.status === 429) {
        console.warn(`[hub-image] ${model} rate limit`);
        return jsonResponse({
          _v: FN_VERSION, ok: false, error: "rate_limited",
          message: "Rate limit OpenAI atingido. Tenta de novo em ~1min.",
          openai_status: a.status, openai_message: a.errMsg,
        }, 502);
      }

      // Erro de acesso/disponibilidade — passa pro próximo modelo
      if (isAvailabilityError(a)) {
        console.warn(`[hub-image] ${model} unavailable (${a.status}): ${a.errMsg}`);
        skipped.push({ model, reason: a.errMsg || `${a.status}`, status: a.status });
        continue;
      }

      // Erro hard que não merece retry — retorna direto
      console.error(`[hub-image] ${model} hard error:`, a.status, a.errText);
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "image_gen_failed",
        message: a.errMsg || `OpenAI retornou ${a.status} pra ${model}.`,
        model_attempted: model,
        openai_status: a.status, openai_message: a.errMsg,
        detail: (a.errText || "").slice(0, 500),
        skipped,
      }, 502);
    }

    // Se chegou aqui sem sucesso, todos do chain caíram em "availability"
    if (!attempt || !modelUsed) {
      console.error("[hub-image] all models unavailable:", JSON.stringify(skipped));
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "no_model_available",
        message: "Nenhum modelo de imagem disponível na conta OpenAI. Verifica acesso aos modelos no painel da OpenAI.",
        skipped,
      }, 502);
    }

    if (!attempt.imageUrl) {
      console.error("[hub-image] no image in response from", modelUsed);
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "no_image_returned",
        message: `${modelUsed} não retornou imagem.`,
        model_attempted: modelUsed,
      }, 502);
    }

    const sizeUsed = modelUsed === "dall-e-3"
      ? (SIZE_DALLE[aspect_ratio] || SIZE_DALLE["1:1"])
      : (SIZE_GPTIMAGE[aspect_ratio] || SIZE_GPTIMAGE["1:1"]);
    const fallbackReason = skipped.length > 0
      ? skipped.map(s => `${s.model}: ${s.reason}`).join(" | ")
      : null;

    // Persiste na biblioteca
    try {
      await sb.from("creative_memory").insert({
        user_id: authUser.id,
        type: "hub_image",
        content: {
          prompt: cleanPrompt,
          revised_prompt: attempt.revisedPrompt || cleanPrompt,
          image_url: attempt.imageUrl,
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

    console.log(`[hub-image] success — model=${modelUsed} skipped=${skipped.length}`);

    return jsonResponse({
      _v: FN_VERSION,
      ok: true,
      image_url: attempt.imageUrl,
      prompt: cleanPrompt,
      revised_prompt: attempt.revisedPrompt || cleanPrompt,
      aspect_ratio,
      size: sizeUsed,
      quality,
      model_used: modelUsed,
      fallback_reason: fallbackReason,
      skipped,
    }, 200);

  } catch (e) {
    console.error("[hub-image] unexpected error:", e);
    return jsonResponse({
      _v: FN_VERSION, ok: false, error: "internal_error",
      message: String(e).slice(0, 300),
    }, 500);
  }
});
