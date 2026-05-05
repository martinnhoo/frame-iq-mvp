// generate-image-hub — Image Generator interno (Brilliant Hub).
//
// Modelo: dall-e-3 (estável em qualquer conta OpenAI paga, não exige
// Verified Organization). Antes tentamos gpt-image-1 mas exigia
// verificação organizacional que a conta não tem.
//
// Saída salva em creative_memory com type='hub_image' pra alimentar
// a Biblioteca interna do Hub.

// Version stamp — bump quando mudar comportamento. Inclui na resposta
// pro frontend conseguir confirmar que a versão certa tá rodando.
const FN_VERSION = "v3-dalle3-2026-05-05";

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// DALL-E 3 só suporta 3 tamanhos. 4:5 não tem nativo — mapeia pra
// portrait mais próximo (1024x1792) e a IA enquadra.
const SIZE_MAP: Record<string, string> = {
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

console.log(`[hub-image] boot ${FN_VERSION}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[hub-image] OPENAI_API_KEY not configured");
      return jsonResponse({
        ok: false,
        error: "openai_not_configured",
        message: "OPENAI_API_KEY não configurado no Supabase. Adiciona o secret nas Edge Function settings.",
      }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ ok: false, error: "unauthorized", message: "Sem token de auth." }, 401);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData } = await sb.auth.getUser(authHeader.slice(7));
    const authUser = userData?.user;
    if (!authUser) {
      return jsonResponse({ ok: false, error: "unauthorized", message: "Sessão inválida." }, 401);
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
        ok: false,
        error: "invalid_prompt",
        message: "Descreva a imagem com pelo menos 5 caracteres.",
      }, 400);
    }

    const size = SIZE_MAP[aspect_ratio] || SIZE_MAP["1:1"];
    // DALL-E 3: standard | hd. low/medium → standard; high → hd.
    const dalleQuality = quality === "high" ? "hd" : "standard";

    const reqBody = {
      model: "dall-e-3",
      prompt: prompt.trim().slice(0, 4000),
      size,
      quality: dalleQuality,
      n: 1,
      response_format: "url" as const,
    };

    console.log("[hub-image] calling OpenAI:", JSON.stringify({
      user_id: authUser.id, size, quality: dalleQuality, prompt_len: reqBody.prompt.length,
    }));

    const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("[hub-image] OpenAI error", openaiRes.status, errText);

      let errorCode = "image_gen_failed";
      let errorMessage = `OpenAI retornou ${openaiRes.status}.`;
      let openaiMsg = "";
      try {
        const errJson = JSON.parse(errText);
        openaiMsg = errJson?.error?.message || "";
        const code = errJson?.error?.code;
        if (code === "content_policy_violation") {
          errorCode = "content_policy";
          errorMessage = "Prompt rejeitado por política de conteúdo da OpenAI.";
        } else if (openaiRes.status === 429) {
          errorCode = "rate_limited";
          errorMessage = "Rate limit OpenAI atingido. Tenta de novo em ~1min.";
        } else if (openaiRes.status === 401) {
          errorCode = "openai_auth";
          errorMessage = "Chave OpenAI inválida ou expirada.";
        } else if (openaiRes.status === 403) {
          errorCode = "openai_access";
          errorMessage = "Conta OpenAI sem acesso a dall-e-3 ou faltando billing.";
        } else if (openaiRes.status === 400) {
          errorCode = "bad_request";
          errorMessage = openaiMsg || "Requisição inválida pra OpenAI.";
        }
      } catch {}

      return jsonResponse({
        ok: false,
        error: errorCode,
        message: errorMessage,
        openai_status: openaiRes.status,
        openai_message: openaiMsg,
        detail: errText.slice(0, 500),
      }, 502);
    }

    const data = await openaiRes.json();
    const imgData = data?.data?.[0];
    const imageUrl: string | null = imgData?.url
      || (imgData?.b64_json ? `data:image/png;base64,${imgData.b64_json}` : null);
    const revisedPrompt = imgData?.revised_prompt || prompt.trim();

    if (!imageUrl) {
      console.error("[hub-image] no image in response", JSON.stringify(data).slice(0, 500));
      return jsonResponse({
        ok: false,
        error: "no_image_returned",
        message: "OpenAI não retornou URL de imagem.",
      }, 502);
    }

    // Salva na biblioteca interna. Erro de DB não bloqueia retorno —
    // user já tem a imagem em mãos.
    try {
      await sb.from("creative_memory").insert({
        user_id: authUser.id,
        type: "hub_image",
        content: {
          prompt: prompt.trim(),
          revised_prompt: revisedPrompt,
          image_url: imageUrl,
          aspect_ratio,
          size,
          quality,
          model: "dall-e-3",
        },
        created_at: new Date().toISOString(),
      });
    } catch (dbErr) {
      console.warn("[hub-image] DB insert failed (non-fatal):", dbErr);
    }

    return jsonResponse({
      _v: FN_VERSION,
      ok: true,
      image_url: imageUrl,
      prompt: prompt.trim(),
      revised_prompt: revisedPrompt,
      aspect_ratio,
      size,
      quality,
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
