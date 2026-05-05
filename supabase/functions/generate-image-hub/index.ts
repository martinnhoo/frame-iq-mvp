// generate-image-hub — Image Generator interno (Brilliant Hub).
//
// Modelo único: gpt-image-2. Sem fallback. dall-e-3 é inútil pra
// criativos de ad — só polui a galeria com imagens de qualidade
// inferior. Se gpt-image-2 não tá disponível, retorna erro acionável
// (verify org) e a UI mostra a tela de "destravar".
//
// Brand context: front manda { brand_id, brand_hint, include_license,
// license_text }. A função injeta brand_hint no início e instrução
// pra reservar rodapé pro disclaimer no fim do prompt.

const FN_VERSION = "v11-multimarket-disclaimer-aware-2026-05-05";

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const {
      prompt,
      aspect_ratio = "1:1",
      quality = "medium",
      brand_id = null,
      brand_hint = "",
      market = null,
      include_license = false,
      license_text = "",
    } = body as {
      prompt?: string;
      aspect_ratio?: string;
      quality?: "low" | "medium" | "high";
      brand_id?: string | null;
      brand_hint?: string;
      market?: string | null;
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
        "IMPORTANT FOR COMPOSITION: Keep the bottom 12% of the image visually clean — " +
        "no important characters, text, faces or focal elements in this strip. " +
        "It will be covered by a regulatory disclaimer overlay in post-production. " +
        "Position main subjects in the upper 88% of the canvas."
      );
    }
    const finalPrompt = parts.join("\n\n").slice(0, 4000);
    const size = SIZE_MAP[aspect_ratio] || SIZE_MAP["1:1"];

    console.log("[hub-image] start", JSON.stringify({
      user_id: authUser.id, aspect_ratio, quality,
      brand_id: brand_id || null, market: market || null,
      include_license, prompt_len: finalPrompt.length,
    }));

    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt: finalPrompt,
        size,
        quality,
        n: 1,
        moderation: "low",
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      let errMsg = "", errCode = "";
      try {
        const parsed = JSON.parse(errText);
        errMsg = parsed?.error?.message || "";
        errCode = parsed?.error?.code || "";
      } catch {}

      console.error(`[hub-image] gpt-image-2 ${r.status}:`, errText);

      // Detecta erro de "verify org" — vira código especial pra UI
      // mostrar tela de destravar org, com link direto.
      const m = errMsg.toLowerCase();
      const needsVerify = r.status === 403
        || m.includes("must be verified")
        || m.includes("verify organization")
        || m.includes("organization must be verified")
        || m.includes("does not have access");

      if (needsVerify) {
        return jsonResponse({
          _v: FN_VERSION, ok: false, error: "needs_org_verification",
          message: "Sua organização OpenAI precisa ser verificada pra usar gpt-image-2.",
          openai_status: r.status, openai_message: errMsg,
          verify_url: "https://platform.openai.com/settings/organization/general",
        }, 502);
      }

      let userError = "image_gen_failed";
      let userMessage = errMsg || `OpenAI retornou ${r.status}.`;
      if (errCode === "content_policy_violation" || m.includes("safety")) {
        userError = "content_policy";
        userMessage = "Prompt rejeitado por política de conteúdo da OpenAI.";
      } else if (r.status === 429) {
        userError = "rate_limited";
        userMessage = "Rate limit OpenAI atingido. Tenta de novo em ~1min.";
      } else if (r.status === 401) {
        userError = "openai_auth";
        userMessage = "Chave OpenAI inválida ou expirada.";
      } else if (r.status === 404) {
        userError = "model_not_found";
        userMessage = "Modelo gpt-image-2 não encontrado na conta OpenAI.";
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
    const revisedPrompt = imgData?.revised_prompt || userPrompt;

    if (!imageUrl) {
      console.error("[hub-image] no image in response");
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
          prompt: userPrompt,
          revised_prompt: revisedPrompt,
          final_prompt: finalPrompt,
          image_url: imageUrl,
          aspect_ratio, size, quality,
          model: "gpt-image-2",
          brand_id: brand_id || null,
          market: market || null,
          license_included: include_license,
          license_text: include_license ? license_text : null,
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
      prompt: userPrompt,
      revised_prompt: revisedPrompt,
      final_prompt: finalPrompt,
      aspect_ratio, size, quality,
      model_used: "gpt-image-2",
      brand_id: brand_id || null,
      market: market || null,
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
