// generate-image-hub — Image Generator do Brilliant Hub.
//
// Usa gpt-image-2 (lançado 21/04/2026 pela OpenAI, sucessor do DALL-E 3)
// pra geração + brand context da persona selecionada (logo, paleta, tom
// visual) pra outputs consistentes com a marca. Pra uso interno na
// Brilliant Gaming — multi-marca via persona_id.
//
// Por que gpt-image-2 vs DALL-E 3:
//   • Melhor adesão a prompts de marca (especialmente paletas + tipografia)
//   • Suporte nativo a transparência (PNG com alpha) — útil pra layering
//   • Quality tiers low/medium/high mais previsíveis que standard/hd
//   • Sizes flexíveis (não limita a 3 formatos como DALL-E 3)
//   • Moderation built-in com tier 'low' (mais permissivo pra iGaming)
//
// Fluxo:
//   1. Recebe { prompt, persona_id?, aspect_ratio, quality }
//   2. Carrega brand_kit da persona se persona_id fornecido
//   3. Augmenta o prompt com contexto de marca
//   4. Chama gpt-image-2 com prompt augmentado
//   5. Salva em creative_memory pra biblioteca + atividades recentes
//   6. Devolve URL + prompt usado + metadata
//
// Auth: JWT obrigatório.
// Cost cap: protege user free de queimar quota.
// Cost: gpt-image-2 low ~$0.011, medium ~$0.042, high ~$0.167 (1024×1024).
//
// Roadmap futuro:
//   • Overlay automático do logo via canvas (Deno tem npm:canvas)
//   • Refs[] — upload de imagens de referência pra image-to-image (gpt-image-2 suporta)
//   • Multi-variação no mesmo call (n=3) com 1 cap só

import { createClient } from "npm:@supabase/supabase-js@2";
import { checkCostCap, recordCost, capExceededResponse } from "../_shared/cost-cap.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// gpt-image-2 aceita resoluções flexíveis. Mapeamento por aspect ratio:
// dimensões dentro do sweet spot (até 1536px largura/altura) pra
// previsibilidade de qualidade. Acima de 2560×1440 vira experimental.
const SIZE_MAP: Record<string, string> = {
  "1:1":  "1024x1024",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "4:5":  "1024x1280",
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
      quality = "medium", // 'low' ~$0.011 | 'medium' ~$0.042 | 'high' ~$0.167
      transparent = false, // PNG com alpha, útil pra logos/composição
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

    log("calling gpt-image-2", { size, quality, aspect_ratio, has_brand: !!brandKit, transparent });

    // ── Call gpt-image-2 ────────────────────────────────────────────────
    // Endpoint compartilhado com DALL-E (/v1/images/generations) — só
    // muda model name + parameters. Resposta vem com b64_json ou url
    // dependendo de response_format.
    const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
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
        // moderation 'low' = mais permissivo (ainda filtra ilegal/explícito)
        // necessário pra iGaming, casino e linguagem de marketing direto
        moderation: "low",
        // background 'transparent' só funciona em PNG output_format
        ...(transparent ? { background: "transparent", output_format: "png" } : {}),
      }),
    });

    if (!dalleRes.ok) {
      const errText = await dalleRes.text();
      log("gpt-image-2 error", { status: dalleRes.status, body: errText.slice(0, 300) });
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
    const imageData = dalleData?.data?.[0];
    // gpt-image-2 retorna b64_json por padrão. URL só vem se passamos
    // response_format: 'url' (não passamos pra evitar URL temporária da
    // OpenAI que expira em 60min). Aceitamos ambos pra robustez.
    const imageUrl: string | null = imageData?.url
      || (imageData?.b64_json ? `data:image/png;base64,${imageData.b64_json}` : null);
    const revisedPrompt = imageData?.revised_prompt || augmentedPrompt;

    if (!imageUrl) {
      return new Response(JSON.stringify({
        error: "no_image_returned",
        message: "gpt-image-2 não retornou imagem. Tenta de novo.",
      }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── Record cost ──────────────────────────────────────────────────────
    // gpt-image-2 pricing por imagem (1024×1024):
    //   low    ≈ $0.011  (≈11k 'tokens' no cap diário)
    //   medium ≈ $0.042  (≈42k tokens)
    //   high   ≈ $0.167  (≈167k tokens)
    // Sizes maiores escalam linearmente — aproximação dentro de ±10%.
    const COST_TOKENS: Record<string, number> = {
      low:    11_000,
      medium: 42_000,
      high:   167_000,
    };
    const fakeCostTokens = COST_TOKENS[quality] || COST_TOKENS.medium;
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
          model: "gpt-image-2",
          transparent,
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
