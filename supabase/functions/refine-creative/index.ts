// refine-creative — refinamento pontual de UMA imagem com feedback do user.
//
// User vê uma imagem gerada, quer fazer ajuste pontual ("rosto mais sorridente,
// fundo escuro, fonte maior"). Esta função:
//   1. Pega a imagem original como REFERENCE (gpt-image-2 edits mode)
//   2. Mantém o angle e brand context original
//   3. Adiciona o feedback do user como instrução de refinamento
//   4. Gera uma NOVA imagem (não substitui a original) — vai pra Library
//   5. DB rastreia refined_from = original_asset_id pra arvore futura
//
// Diferente do generate-creatives (bulk N imagens com angles), este é
// 1-pra-1 e foca em precisão. Sempre síncrono (10-15s).

const FN_VERSION = "v1-2026-05-08";

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

console.log(`[refine-creative] boot ${FN_VERSION}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);
    }
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData } = await sb.auth.getUser(authHeader.slice(7));
    const authUser = userData?.user;
    if (!authUser) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const {
      source_asset_id = null,    // hub_assets.id da imagem original
      source_image_url = null,   // URL da imagem original (fallback se sem asset_id)
      user_feedback = "",        // "rosto mais sorrir, fundo mais escuro"
    } = body as {
      source_asset_id?: string | null;
      source_image_url?: string | null;
      user_feedback?: string;
    };

    const cleanFeedback = (user_feedback || "").trim();
    if (cleanFeedback.length < 3) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "invalid_feedback",
        message: "Descreva o que quer mudar (mínimo 3 caracteres).",
      }, 400);
    }

    // ── Carrega contexto do asset original ─────────────────────────
    // Se tem asset_id, busca todo o context salvo (prompt, angle, brand).
    // Se só tem url, usa só a URL (refinamento "cego").
    let originalPrompt = "";
    let angleLabel = "";
    let aspectRatio = "1:1";
    let imageUrl = source_image_url || "";
    let brandId: string | null = null;

    if (source_asset_id) {
      const { data: asset } = await sb
        .from("hub_assets")
        .select("content")
        .eq("id", source_asset_id)
        .eq("user_id", authUser.id)
        .maybeSingle();
      if (asset) {
        const c = (asset.content || {}) as Record<string, unknown>;
        originalPrompt = (c.prompt as string) || "";
        angleLabel = (c.angle_label as string) || "";
        aspectRatio = (c.aspect_ratio as string) || "1:1";
        imageUrl = (c.image_url as string) || imageUrl;
        brandId = (c.brand_id as string) || null;
      }
    }

    if (!imageUrl) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "no_source_image",
        message: "Imagem de referência não encontrada.",
      }, 400);
    }

    // ── Constrói prompt de refinamento ──────────────────────────────
    // Estratégia: preserva intenção original e diz pro modelo ESPECÍFICAMENTE
    // pra manter composição/sujeito/estilo, e aplicar SÓ o ajuste pedido.
    const refinementPrompt = [
      `REFINEMENT TASK — modify the reference image based on user feedback below.`,
      ``,
      `KEEP from the reference:`,
      `- Same subject, same composition, same overall style and mood`,
      `- Same angle/perspective and color palette (unless feedback says otherwise)`,
      `- Same brand identity if present`,
      ``,
      `APPLY this user feedback (priority — these are the ONLY changes to make):`,
      `"${cleanFeedback}"`,
      ``,
      originalPrompt ? `Original creative intent (for context, do not re-generate from scratch):\n${originalPrompt}` : "",
      angleLabel ? `Original creative angle: ${angleLabel}` : "",
    ].filter(Boolean).join("\n");

    console.log(`[refine-creative] start user=${authUser.id} source=${source_asset_id || imageUrl.slice(0, 60)} feedback="${cleanFeedback.slice(0, 80)}..."`);

    // ── Chama generate-image-hub com a imagem original como reference ──
    const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-image-hub`, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: refinementPrompt,
        aspect_ratio: aspectRatio,
        quality: "medium",
        input_images_base64: [imageUrl],
      }),
    });
    const text = await r.text();
    let payload: { ok?: boolean; image_url?: string; message?: string; error?: string };
    try { payload = JSON.parse(text); } catch {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "non_json_response",
        message: text.slice(0, 200),
      }, 502);
    }
    if (!payload.ok || !payload.image_url) {
      return jsonResponse({
        _v: FN_VERSION, ok: false,
        error: payload.error || "image_gen_failed",
        message: payload.message || "Falha ao refinar imagem.",
      }, 502);
    }

    // ── Salva o refinement em hub_assets (não substitui o original) ──
    let assetId: string | null = null;
    try {
      const { data: inserted } = await sb.from("hub_assets").insert({
        user_id: authUser.id,
        kind: "hub_image",
        content: {
          image_url: payload.image_url,
          prompt: originalPrompt || cleanFeedback,
          aspect_ratio: aspectRatio,
          brand_id: brandId,
          angle_label: angleLabel,
          source: "studio_refinement",
          refined_from: source_asset_id,
          user_feedback: cleanFeedback,
          model: "gpt-image-2",
        },
        created_at: new Date().toISOString(),
      }).select("id").single();
      assetId = (inserted as { id?: string })?.id || null;
    } catch (e) {
      console.warn(`[refine-creative] hub_assets insert failed:`, e);
    }

    return jsonResponse({
      _v: FN_VERSION,
      ok: true,
      image_url: payload.image_url,
      asset_id: assetId,
      angle_label: angleLabel,
    }, 200);

  } catch (e) {
    console.error("[refine-creative] unexpected:", e);
    return jsonResponse({
      _v: FN_VERSION, ok: false, error: "internal_error",
      message: String(e).slice(0, 300),
    }, 500);
  }
});
