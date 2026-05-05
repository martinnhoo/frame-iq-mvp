// generate-image-hub — Image Generator standalone do Brilliant Hub.
//
// Zero dependência de _shared/* — função totalmente independente,
// sem cost-cap, sem cron-auth, sem nenhuma referência a outros produtos.
// Auth simples via JWT (admin allowlist), valida e roda gpt-image-2.
//
// Input:
//   { prompt, persona_id?, aspect_ratio?, quality?, transparent? }
//
// Output:
//   { ok, image_url, prompt, augmented_prompt, revised_prompt, ... }

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

interface BrandKit {
  primary_color?: string;
  secondary_color?: string;
  visual_style?: string;
}

function buildBrandContext(brandKit: BrandKit | null, personaName?: string): string {
  if (!brandKit) return "";
  const parts: string[] = [];
  if (personaName) parts.push(`brand: ${personaName}`);
  if (brandKit.primary_color) parts.push(`primary color: ${brandKit.primary_color}`);
  if (brandKit.secondary_color) parts.push(`accent color: ${brandKit.secondary_color}`);
  if (brandKit.visual_style) parts.push(`visual style: ${brandKit.visual_style}`);
  if (parts.length === 0) return "";
  return ` (Brand context: ${parts.join(", ")})`;
}

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
      persona_id = null,
      aspect_ratio = "1:1",
      quality = "medium",
      transparent = false,
    } = body as {
      prompt?: string;
      persona_id?: string | null;
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

    let brandKit: BrandKit | null = null;
    let personaName: string | undefined;
    if (persona_id) {
      const { data: persona } = await sb.from("personas")
        .select("name, brand_kit")
        .eq("id", persona_id)
        .eq("user_id", authUser.id)
        .maybeSingle();
      if (persona) {
        personaName = (persona as any).name || undefined;
        brandKit = (persona as any).brand_kit || null;
      }
    }

    const brandContext = buildBrandContext(brandKit, personaName);
    const augmentedPrompt = `${prompt.trim()}${brandContext}`.slice(0, 4000);

    const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt: augmentedPrompt,
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
    const revisedPrompt = imgData?.revised_prompt || augmentedPrompt;

    if (!imageUrl) {
      return new Response(JSON.stringify({
        error: "no_image_returned",
        message: "Nenhuma imagem retornada.",
      }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Save to creative_memory (shared table — type='generated_image' isolates Hub assets)
    try {
      await sb.from("creative_memory" as any).insert({
        user_id: authUser.id,
        persona_id: persona_id || null,
        type: "generated_image",
        content: {
          prompt: prompt.trim(),
          augmented_prompt: augmentedPrompt,
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
      augmented_prompt: augmentedPrompt,
      revised_prompt: revisedPrompt,
      aspect_ratio,
      size,
      quality,
      brand_applied: !!brandKit,
      persona_name: personaName,
    }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: "internal_error", message: String(e).slice(0, 200) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
