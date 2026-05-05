// generate-image-hub — Image Generator interno (Brilliant Hub).
//
// Modelo: tenta gpt-image-2 primeiro. Se OpenAI rejeitar com erro de
// acesso/disponibilidade (account em review, modelo bloqueado, etc.),
// cai automaticamente pra dall-e-3. Quando a aprovação business
// liberar gpt-image-2, vai começar a funcionar sozinho sem redeploy.
//
// Brand context: front manda { brand_id, brand_hint, include_license,
// license_text }. A função injeta brand_hint no início e instrução
// pra reservar rodapé pro disclaimer no fim do prompt.

const FN_VERSION = "v8-gptimage2-or-dalle3-brand-2026-05-05";

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Sizes diferem entre os 2 modelos. gpt-image-2 usa grid 1024/1536;
// dall-e-3 usa 1024/1792. 4:5 não tem nativo em nenhum dos 2.
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
  errCode?: string;
}

async function tryGptImage2(prompt: string, aspect: string, quality: string, apiKey: string): Promise<ModelAttempt> {
  const size = SIZE_GPTIMAGE[aspect] || SIZE_GPTIMAGE["1:1"];
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt: prompt.slice(0, 4000),
      size,
      quality, // low | medium | high
      n: 1,
      moderation: "low",
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    let msg = "", code = "";
    try {
      const p = JSON.parse(t);
      msg = p?.error?.message || "";
      code = p?.error?.code || "";
    } catch {}
    return { ok: false, status: r.status, errText: t, errMsg: msg, errCode: code };
  }
  const data = await r.json();
  const imgData = data?.data?.[0];
  const imageUrl = imgData?.url
    || (imgData?.b64_json ? `data:image/png;base64,${imgData.b64_json}` : null);
  return { ok: true, imageUrl, revisedPrompt: imgData?.revised_prompt };
}

async function tryDalle3(prompt: string, aspect: string, quality: string, apiKey: string): Promise<ModelAttempt> {
  const size = SIZE_DALLE[aspect] || SIZE_DALLE["1:1"];
  const dalleQuality = quality === "high" ? "hd" : "standard";
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: prompt.slice(0, 4000),
      size,
      quality: dalleQuality, // standard | hd
      n: 1,
      response_format: "url",
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    let msg = "", code = "";
    try {
      const p = JSON.parse(t);
      msg = p?.error?.message || "";
      code = p?.error?.code || "";
    } catch {}
    return { ok: false, status: r.status, errText: t, errMsg: msg, errCode: code };
  }
  const data = await r.json();
  const imgData = data?.data?.[0];
  const imageUrl = imgData?.url
    || (imgData?.b64_json ? `data:image/png;base64,${imgData.b64_json}` : null);
  return { ok: true, imageUrl, revisedPrompt: imgData?.revised_prompt };
}

function isAvailabilityError(a: ModelAttempt): boolean {
  if (!a.status) return false;
  if (a.status === 403 || a.status === 404) return true;
  const m = (a.errMsg || "").toLowerCase();
  return m.includes("verified") || m.includes("does not have access")
      || m.includes("model not found") || m.includes("invalid model")
      || m.includes("must be verified") || m.includes("review")
      || m.includes("not available");
}

function isContentBlock(a: ModelAttempt): boolean {
  const m = (a.errMsg || "").toLowerCase();
  return a.errCode === "content_policy_violation"
      || m.includes("content_policy") || m.includes("safety system");
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
    const {
      prompt,
      aspect_ratio = "1:1",
      quality = "medium",
      brand_id = null,
      brand_hint = "",
      include_license = false,
      license_text = "",
    } = body as {
      prompt?: string;
      aspect_ratio?: string;
      quality?: "low" | "medium" | "high";
      brand_id?: string | null;
      brand_hint?: string;
      include_license?: boolean;
      license_text?: string;
    };

    if (!prompt || prompt.trim().length < 5) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "invalid_prompt",
        message: "Descreva a imagem com pelo menos 5 caracteres.",
      }, 400);
    }

    // Constrói prompt final: [brand context] + [user prompt] + [disclaimer]
    const userPrompt = prompt.trim();
    const parts: string[] = [];
    if (brand_hint && brand_hint.trim()) parts.push(brand_hint.trim());
    parts.push(userPrompt);
    if (include_license && license_text && license_text.trim()) {
      parts.push(
        "Reserve a horizontal strip at the bottom of the image (about 12% of total height) " +
        "as a clean dark area suitable for overlay regulatory disclaimer text in post-production. " +
        "Do not render the actual disclaimer text inside the image."
      );
    }
    const finalPrompt = parts.join("\n\n").slice(0, 4000);

    console.log("[hub-image] start", JSON.stringify({
      user_id: authUser.id, aspect_ratio, quality, brand_id: brand_id || null,
      include_license, prompt_len: finalPrompt.length,
    }));

    // ── 1. Tenta gpt-image-2 ─────────────────────────────────────────
    let modelUsed: "gpt-image-2" | "dall-e-3" = "gpt-image-2";
    let fallbackReason: string | null = null;
    let attempt = await tryGptImage2(finalPrompt, aspect_ratio, quality, OPENAI_API_KEY);

    // ── 2. Se falhar com erro de acesso/disponibilidade → dall-e-3 ──
    if (!attempt.ok) {
      // Content policy: mesmo critério em qualquer modelo, retorna direto
      if (isContentBlock(attempt)) {
        console.warn("[hub-image] gpt-image-2 content block:", attempt.errMsg);
        return jsonResponse({
          _v: FN_VERSION, ok: false, error: "content_policy",
          message: "Prompt rejeitado por política de conteúdo da OpenAI.",
          openai_status: attempt.status, openai_message: attempt.errMsg,
          detail: (attempt.errText || "").slice(0, 500),
        }, 502);
      }

      if (isAvailabilityError(attempt)) {
        console.warn(`[hub-image] gpt-image-2 unavailable (${attempt.status}): ${attempt.errMsg} — falling back to dall-e-3`);
        fallbackReason = attempt.errMsg || `gpt-image-2 indisponível (${attempt.status})`;
        modelUsed = "dall-e-3";
        attempt = await tryDalle3(finalPrompt, aspect_ratio, quality, OPENAI_API_KEY);
      } else {
        // Outro erro hard (rate limit, 500, auth) — retorna direto
        console.error("[hub-image] gpt-image-2 hard error:", attempt.status, attempt.errText);
        return jsonResponse({
          _v: FN_VERSION, ok: false, error: "image_gen_failed",
          message: attempt.errMsg || `OpenAI retornou ${attempt.status}.`,
          openai_status: attempt.status, openai_message: attempt.errMsg,
          detail: (attempt.errText || "").slice(0, 500),
        }, 502);
      }
    }

    // Se o fallback também falhou
    if (!attempt.ok) {
      console.error("[hub-image] dall-e-3 also failed:", attempt.status, attempt.errText);
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "image_gen_failed",
        message: attempt.errMsg || `dall-e-3 retornou ${attempt.status}.`,
        openai_status: attempt.status, openai_message: attempt.errMsg,
        detail: (attempt.errText || "").slice(0, 500),
        fallback_reason: fallbackReason,
      }, 502);
    }

    const imageUrl = attempt.imageUrl;
    const revisedPrompt = attempt.revisedPrompt || userPrompt;

    if (!imageUrl) {
      console.error(`[hub-image] no image in response from ${modelUsed}`);
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "no_image_returned",
        message: `${modelUsed} não retornou imagem.`,
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
          prompt: userPrompt,
          revised_prompt: revisedPrompt,
          final_prompt: finalPrompt,
          image_url: imageUrl,
          aspect_ratio,
          size: sizeUsed,
          quality,
          model: modelUsed,
          brand_id: brand_id || null,
          license_included: include_license,
          license_text: include_license ? license_text : null,
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
      prompt: userPrompt,
      revised_prompt: revisedPrompt,
      final_prompt: finalPrompt,
      aspect_ratio,
      size: sizeUsed,
      quality,
      model_used: modelUsed,
      fallback_reason: fallbackReason,
      brand_id: brand_id || null,
      license_included: include_license,
    }, 200);

  } catch (e) {
    console.error("[hub-image] unexpected error:", e);
    return jsonResponse({
      _v: FN_VERSION, ok: false, error: "internal_error",
      message: String(e).slice(0, 300),
    }, 500);
  }
});
