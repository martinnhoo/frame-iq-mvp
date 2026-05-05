// generate-image-hub — Image Generator do Brilliant Hub.
//
// Usa DALL-E 3 pra geração + brand context da persona selecionada (logo,
// paleta, tom visual) pra outputs consistentes com a marca. Pra uso interno
// na Brilliant Gaming — multi-marca via persona_id.
//
// Fluxo:
//   1. Recebe { prompt, persona_id?, aspect_ratio }
//   2. Carrega brand_kit da persona se persona_id fornecido
//   3. Augmenta o prompt com contexto de marca (ex: "in the style of {brand},
//      using {paleta} color palette, with {tom_visual} aesthetic")
//   4. Chama DALL-E 3 com prompt augmentado
//   5. Salva em creative_memory pra biblioteca + atividades recentes
//   6. Devolve URL + prompt usado + metadata
//
// Auth: JWT obrigatório.
// Cost cap: protege user free de queimar quota.
// Cost: DALL-E 3 standard = $0.04/image (1024×1024). HD = $0.08.
//
// Roadmap futuro:
//   • Overlay automático do logo via canvas (Deno tem npm:canvas)
//   • Substituir DALL-E por Replicate Flux Schnell (10× mais barato, $0.003)
//   • Refs[] — upload de imagens de referência pra image-to-image
//   • Variações automáticas (gerar 3 ao invés de 1)

import { createClient } from "npm:@supabase/supabase-js@2";
import { checkCostCap, recordCost, capExceededResponse } from "../_shared/cost-cap.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// DALL-E 3 size constraints — só aceita esses 3 tamanhos
const SIZE_MAP: Record<string, string> = {
  "1:1":  "1024x1024",
  "16:9": "1792x1024",
  "9:16": "1024x1792",
  "4:5":  "1024x1024", // DALL-E não tem 4:5 nativo — usa quadrado e crop opcional no client
};

const log = (step: string, d?: unknown) =>
  console.log(`[GEN-IMG-HUB] ${step}${d ? ` — ${JSON.stringify(d).slice(0, 200)}` : ""}`);

interface BrandKit {
  logo_data_url?: string;
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
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
  return ` (Brand context — keep generated image consistent with: ${parts.join(", ")})`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({
        error: "openai_not_configured",
        message: "OPENAI_API_KEY não está configurado nos secrets do projeto. Adiciona em Lovable Cloud → Secrets pra ativar Image Generator.",
      }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── Auth ────────────────────────────────────────────────────────────
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

    // ── Cost cap ────────────────────────────────────────────────────────
    const { data: planRow } = await sb.from("profiles").select("plan").eq("id", authUser.id).maybeSingle();
    const plan = (planRow as any)?.plan || "free";
    const cap = await checkCostCap(sb, authUser.id, plan);
    if (!cap.allowed) return capExceededResponse(cap, cors);

    // ── Body parse ──────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const {
      prompt,
      persona_id = null,
      aspect_ratio = "1:1",
      quality = "standard", // 'standard' = $0.04, 'hd' = $0.08
    } = body as {
      prompt?: string;
      persona_id?: string | null;
      aspect_ratio?: string;
      quality?: "standard" | "hd";
    };

    if (!prompt || prompt.trim().length < 5) {
      return new Response(JSON.stringify({
        error: "invalid_prompt",
        message: "Descreve a imagem com pelo menos 5 caracteres.",
      }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const size = SIZE_MAP[aspect_ratio] || SIZE_MAP["1:1"];

    // ── Load brand context ──────────────────────────────────────────────
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

    log("calling DALL-E 3", { size, quality, aspect_ratio, has_brand: !!brandKit });

    // ── Call DALL-E 3 ───────────────────────────────────────────────────
    const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: augmentedPrompt,
        size,
        quality,
        n: 1,
      }),
    });

    if (!dalleRes.ok) {
      const errText = await dalleRes.text();
      log("DALL-E error", { status: dalleRes.status, body: errText.slice(0, 300) });
      let errorCode = "image_gen_failed";
      let errorMessage = "Geração de imagem falhou. Tenta de novo em instantes.";
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.error?.code === "content_policy_violation") {
          errorCode = "content_policy";
          errorMessage = "OpenAI rejeitou esse prompt por política de conteúdo. Reformula sem termos sensíveis.";
        } else if (dalleRes.status === 429) {
          errorCode = "rate_limited";
          errorMessage = "Rate limit do OpenAI atingido. Espera ~1min e tenta de novo.";
        } else if (dalleRes.status === 401) {
          errorCode = "openai_auth";
          errorMessage = "Chave do OpenAI inválida ou expirada.";
        }
      } catch {}
      return new Response(JSON.stringify({ error: errorCode, message: errorMessage, status: dalleRes.status }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const dalleData = await dalleRes.json();
    const imageUrl = dalleData?.data?.[0]?.url;
    const revisedPrompt = dalleData?.data?.[0]?.revised_prompt || augmentedPrompt;

    if (!imageUrl) {
      return new Response(JSON.stringify({
        error: "no_image_returned",
        message: "DALL-E não retornou imagem. Tenta de novo.",
      }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── Record cost (DALL-E não vem em tokens, é fixo por imagem) ───────
    // Standard: $0.04/image. HD: $0.08. Convertendo pra "tokens" do nosso
    // cost-cap (que pensa em $/Mtok): tratamos como ~40k input tokens
    // pra encaixar no esquema. Aproximação suficiente pra cap diário.
    const fakeCostTokens = quality === "hd" ? 80_000 : 40_000;
    recordCost(sb, authUser.id, "claude-haiku-4-5-20251001", fakeCostTokens, 0).catch(() => {});

    // ── Save to creative_memory pra biblioteca + recent activities ──────
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
          model: "dall-e-3",
        },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      log("creative_memory insert failed (non-fatal)", { err: String(e).slice(0, 100) });
    }

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
    log("unhandled error", { err: String(e).slice(0, 200) });
    return new Response(JSON.stringify({ error: "internal_error", message: String(e).slice(0, 200) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
