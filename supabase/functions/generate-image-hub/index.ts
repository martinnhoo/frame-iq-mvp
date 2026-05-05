// generate-image-hub — Image Generator interno.
//
// Subproduto isolado. Não lê personas, não lê brand_kit, não lê
// nenhuma tabela do produto AdBrief. Recebe prompt + size + quality,
// chama gpt-image-2, devolve URL. Salva em creative_memory só pra
// alimentar a Biblioteca interna (mesma tabela do projeto, type
// distinto pra isolar — sem cross-contamination).

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SIZE_MAP: Record<string, string> = {
  "1:1":  "1024x1024",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "4:5":  "1024x1280",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({
        error: "openai_not_configured",
        message: "OPENAI_API_KEY não configurado.",
      }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user: authUser } } = await sb.auth.getUser(authHeader.slice(7));
    if (!authUser) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const {
      prompt,
      aspect_ratio = "1:1",
      quality = "medium",
      transparent = false,
    } = body as {
      prompt?: string;
      aspect_ratio?: string;
      quality?: "low" | "medium" | "high";
      transparent?: boolean;
    };

    if (!prompt || prompt.trim().length < 5) {
      return new Response(JSON.stringify({
        error: "invalid_prompt",
        message: "Descreva a imagem com pelo menos 5 caracteres.",
      }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const size = SIZE_MAP[aspect_ratio] || SIZE_MAP["1:1"];

    const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt: prompt.trim().slice(0, 4000),
        size,
        quality,
        n: 1,
        moderation: "low",
        ...(transparent ? { background: "transparent", output_format: "png" } : {}),
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      let errorCode = "image_gen_failed";
      let errorMessage = "Geração de imagem falhou.";
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.error?.code === "content_policy_violation") {
          errorCode = "content_policy";
          errorMessage = "Prompt rejeitado por política de conteúdo.";
        } else if (openaiRes.status === 429) {
          errorCode = "rate_limited";
          errorMessage = "Rate limit atingido. Tenta de novo em ~1min.";
        } else if (openaiRes.status === 401) {
          errorCode = "openai_auth";
          errorMessage = "Chave OpenAI inválida ou expirada.";
        } else if (openaiRes.status === 403) {
          errorCode = "openai_access";
          errorMessage = "Conta OpenAI sem acesso a gpt-image-2 (precisa Verified Organization).";
        }
      } catch {}
      return new Response(JSON.stringify({
        error: errorCode,
        message: errorMessage,
        status: openaiRes.status,
        detail: errText.slice(0, 300),
      }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const data = await openaiRes.json();
    const imgData = data?.data?.[0];
    const imageUrl: string | null = imgData?.url
      || (imgData?.b64_json ? `data:image/png;base64,${imgData.b64_json}` : null);
    const revisedPrompt = imgData?.revised_prompt || prompt.trim();

    if (!imageUrl) {
      return new Response(JSON.stringify({
        error: "no_image_returned",
        message: "Nenhuma imagem retornada.",
      }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Save to creative_memory pra Biblioteca interna do Hub. type='hub_image'
    // isola dos assets do produto principal. Não usa persona_id.
    try {
      await sb.from("creative_memory" as any).insert({
        user_id: authUser.id,
        type: "hub_image",
        content: {
          prompt: prompt.trim(),
          revised_prompt: revisedPrompt,
          image_url: imageUrl,
          aspect_ratio,
          size,
          quality,
          model: "gpt-image-2",
          transparent,
        },
        created_at: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }

    return new Response(JSON.stringify({
      ok: true,
      image_url: imageUrl,
      prompt: prompt.trim(),
      revised_prompt: revisedPrompt,
      aspect_ratio,
      size,
      quality,
    }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: "internal_error", message: String(e).slice(0, 200) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
