// generate-creatives — geração em batch com angle distribution + brand context.
//
// O coração do AdBrief Studio. Recebe:
//   { brand_id?, prompt, count (1..10), angles[]?, aspect_ratio? }
//
// Pra cada slot do count:
//   1. Pega o angle correspondente (de angles[] OU pickAngles balanced)
//   2. Carrega 3 brand_assets aleatórios da marca (se brand_id)
//   3. Constrói prompt: angle_prefix + brand_notes + user_prompt
//   4. Chama generate-image-hub passando assets como reference
//   5. Salva em hub_assets pra aparecer na Library
//
// Concorrência 3 paralelo pra não estourar rate limit nem 150s timeout.
// Cap hard em count=10 — pra mais a UX deveria fazer múltiplas chamadas
// (server-side bg processing fica complexo demais pra v1).

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

// Mirror server-side da angleLibrary.ts (frontend). Mantido em sync manualmente.
// Mesma estrutura usada em execute-workflow → SERVER_ANGLE_LIBRARY.
const SERVER_ANGLE_LIBRARY: Record<string, { label: string; safety: "safe" | "moderate" | "experimental"; prompt_prefix: string }> = {
  direct_offer: {
    label: "Oferta Direta", safety: "safe",
    prompt_prefix: "CREATIVE ANGLE: Direct response. Center the offer + CTA as the dominant visual element. Clear hierarchy: hook on top, offer in the middle (largest typography), CTA at the bottom. Minimal distractions. High contrast. Safe scalable layout.",
  },
  before_after: {
    label: "Antes/Depois", safety: "safe",
    prompt_prefix: "CREATIVE ANGLE: Before/After split. Vertical or horizontal split frame. Left/top = problem state (muted, gray). Right/bottom = solution state (vibrant, energized). Same subject in both halves when applicable.",
  },
  social_proof: {
    label: "Social Proof", safety: "safe",
    prompt_prefix: "CREATIVE ANGLE: Social proof first. Foreground = stars rating + customer count badge + quote-style testimonial. Visual must feel like screenshots of real reviews.",
  },
  authority_premium: {
    label: "Autoridade Premium", safety: "safe",
    prompt_prefix: "CREATIVE ANGLE: Premium authority. Dark background. Gold or platinum accents. Centered hierarchy. Generous whitespace. Cinematic lighting on subject. Conveys exclusivity without saying 'exclusive'.",
  },
  comparison_us_vs: {
    label: "Comparação", safety: "safe",
    prompt_prefix: "CREATIVE ANGLE: Direct comparison layout. Two-column visual: left = competitor (muted, X marks), right = brand (highlighted, check marks).",
  },
  feature_zoom: {
    label: "Feature Zoom", safety: "safe",
    prompt_prefix: "CREATIVE ANGLE: Feature highlight. Extreme close-up or macro shot of the product/UI. Annotation labels with thin lines pointing to key elements.",
  },
  emotional_reaction: {
    label: "Reação Emocional", safety: "moderate",
    prompt_prefix: "CREATIVE ANGLE: Emotional reaction. Close-up of a person's face showing genuine surprise, joy, or relief. Slight imperfect framing. Natural skin tones. Eyes engage the viewer.",
  },
  curiosity_gap: {
    label: "Curiosity Gap", safety: "moderate",
    prompt_prefix: "CREATIVE ANGLE: Curiosity gap. Provocative question or incomplete statement as the hook. Visual partially obscured (cropped, blurred edges).",
  },
  urgency_scarcity: {
    label: "Urgência/Escassez", safety: "moderate",
    prompt_prefix: "CREATIVE ANGLE: Urgency/scarcity. Visible time pressure element (countdown, calendar, expiring badge). Aggressive typography for time markers. Red/orange accents.",
  },
  beginner_friendly: {
    label: "Beginner-Friendly", safety: "moderate",
    prompt_prefix: "CREATIVE ANGLE: Beginner-friendly. Reassuring tone. Simple shapes, friendly colors. Subject = approachable, smiling, ordinary.",
  },
  fomo_aspirational: {
    label: "FOMO Aspiracional", safety: "moderate",
    prompt_prefix: "CREATIVE ANGLE: Aspirational FOMO. Lifestyle shot of someone living the upgraded outcome. Slight envy-inducing framing.",
  },
  meme_native: {
    label: "Meme Native", safety: "experimental",
    prompt_prefix: "CREATIVE ANGLE: Meme-native. Low-polish aesthetic. Impact font with white-and-black outline. Slightly oversaturated. Visual hierarchy ignores rules.",
  },
  fake_screenshot: {
    label: "Fake Screenshot", safety: "experimental",
    prompt_prefix: "CREATIVE ANGLE: Native UI mock. Looks like an iOS/Android push notification, DM thread, or in-app screen capture. Authentic platform fonts.",
  },
  chaotic_typography: {
    label: "Tipografia Caótica", safety: "experimental",
    prompt_prefix: "CREATIVE ANGLE: Typography chaos. Numbers/keywords sized enormously (50%+ of frame). Asymmetric placement. Mixed weights.",
  },
  creator_pov: {
    label: "Creator POV", safety: "experimental",
    prompt_prefix: "CREATIVE ANGLE: Creator POV. First-person selfie or talking-head shot. Vertical 9:16 framing. Natural ring-light or window light.",
  },
  split_chaos: {
    label: "Split Chaos", safety: "experimental",
    prompt_prefix: "CREATIVE ANGLE: Multi-panel chaos. 3-6 visual elements overlapping or in irregular grid. Each panel = different angle of the offer.",
  },
};

// Distribuição balanceada 70/20/10 (safe / moderate / experimental).
function pickBalancedAngles(n: number): string[] {
  const all = Object.entries(SERVER_ANGLE_LIBRARY);
  const safe = all.filter(([_, a]) => a.safety === "safe").map(([id]) => id);
  const moderate = all.filter(([_, a]) => a.safety === "moderate").map(([id]) => id);
  const experimental = all.filter(([_, a]) => a.safety === "experimental").map(([id]) => id);

  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const safeShuffled = shuffle(safe);
  const modShuffled = shuffle(moderate);
  const expShuffled = shuffle(experimental);

  const safeCount = Math.max(1, Math.round(n * 0.7));
  const modCount = Math.max(0, Math.round(n * 0.2));
  const expCount = Math.max(0, n - safeCount - modCount);

  const picked = [
    ...safeShuffled.slice(0, safeCount),
    ...modShuffled.slice(0, modCount),
    ...expShuffled.slice(0, expCount),
  ].slice(0, n);

  // Embaralha o resultado final pra não sair "todos safe juntos depois experimental"
  return shuffle(picked);
}

// Pega N assets aleatórios da marca pra usar como reference image no GPT-image-2.
// Limit hard em 3 — mais que isso dilui o sinal e o modelo perde foco.
async function loadBrandContext(
  sb: ReturnType<typeof createClient>,
  brandId: string,
  userId: string,
): Promise<{ name: string; notes: string; assetUrls: string[] } | null> {
  // Busca brand + assets em queries separadas (RLS já filtra por user_id)
  const { data: brand } = await sb
    .from("user_brands")
    .select("name, notes")
    .eq("id", brandId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!brand) return null;

  const { data: assets } = await sb
    .from("brand_assets")
    .select("asset_url")
    .eq("brand_id", brandId)
    .order("position", { ascending: true })
    .limit(20);

  // Pega 3 aleatórios dos top 20 (pra rodar em ordem mais relevante mas com variedade)
  const allUrls = (assets || []).map(a => a.asset_url as string).filter(Boolean);
  const shuffled = [...allUrls].sort(() => Math.random() - 0.5).slice(0, 3);

  return {
    name: (brand.name as string) || "",
    notes: (brand.notes as string) || "",
    assetUrls: shuffled,
  };
}

interface CreativeResult {
  angle_id: string;
  angle_label: string;
  image_url?: string;
  asset_id?: string;
  error?: string;
}

console.log(`[generate-creatives] boot ${FN_VERSION}`);

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
      brand_id = null,
      prompt = "",
      count = 5,
      angles = null,
      aspect_ratio = "1:1",
    } = body as {
      brand_id?: string | null;
      prompt?: string;
      count?: number;
      angles?: string[] | null;
      aspect_ratio?: string;
    };

    // ── Validações ─────────────────────────────────────────────────
    const cleanPrompt = (prompt || "").trim();
    if (cleanPrompt.length < 5) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "invalid_prompt",
        message: "Descreva o anúncio com pelo menos 5 caracteres.",
      }, 400);
    }

    const N = Math.max(1, Math.min(10, Math.floor(count)));
    if (N !== count) {
      console.log(`[generate-creatives] count clamped: ${count} → ${N}`);
    }

    // Resolve angles: se user passou explicit list, valida; senão pickBalanced
    let angleIds: string[];
    if (Array.isArray(angles) && angles.length > 0) {
      angleIds = angles
        .filter(id => typeof id === "string" && SERVER_ANGLE_LIBRARY[id])
        .slice(0, N);
      // Se faltou (user mandou IDs inválidos ou poucos), preenche com balanced
      if (angleIds.length < N) {
        const filler = pickBalancedAngles(N - angleIds.length);
        angleIds = [...angleIds, ...filler];
      }
    } else {
      angleIds = pickBalancedAngles(N);
    }

    // ── Brand context (opcional) ───────────────────────────────────
    let brandCtx: Awaited<ReturnType<typeof loadBrandContext>> = null;
    if (brand_id) {
      brandCtx = await loadBrandContext(sb, brand_id, authUser.id);
      if (!brandCtx) {
        console.warn(`[generate-creatives] brand ${brand_id} not found or access denied — proceeding without`);
      }
    }
    const brandBlock = brandCtx
      ? `BRAND: ${brandCtx.name}\n${brandCtx.notes ? `BRAND NOTES (rules, tone, restrictions):\n${brandCtx.notes}\n` : ""}${brandCtx.assetUrls.length > 0 ? `BRAND VISUAL REFERENCES: ${brandCtx.assetUrls.length} reference image(s) provided. Use them as visual anchor — same color palette, typography mood, and style direction. Adapt freely to the user prompt and angle, but keep the brand DNA visible.\n` : ""}`
      : "";

    console.log(`[generate-creatives] start user=${authUser.id} count=${N} brand=${brand_id || "(none)"} brandAssets=${brandCtx?.assetUrls.length || 0} angles=${angleIds.join(",")}`);

    // ── Loop com concorrência 3 ────────────────────────────────────
    const CONC = 3;
    const results: CreativeResult[] = [];

    const generateOne = async (angleId: string): Promise<CreativeResult> => {
      const angle = SERVER_ANGLE_LIBRARY[angleId];
      if (!angle) {
        return { angle_id: angleId, angle_label: angleId, error: "angle_not_found" };
      }

      const finalPrompt = [
        angle.prompt_prefix,
        brandBlock,
        `USER REQUEST:\n${cleanPrompt}`,
      ].filter(Boolean).join("\n\n");

      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-image-hub`, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: finalPrompt,
            aspect_ratio,
            quality: "medium",
            ...(brandCtx?.assetUrls && brandCtx.assetUrls.length > 0
              ? { input_images_base64: brandCtx.assetUrls }
              : {}),
          }),
        });
        const text = await r.text();
        let payload: { ok?: boolean; image_url?: string; memory_id?: string; message?: string; error?: string };
        try { payload = JSON.parse(text); } catch {
          return { angle_id: angleId, angle_label: angle.label, error: `non_json: ${text.slice(0, 100)}` };
        }
        if (!payload.ok || !payload.image_url) {
          return { angle_id: angleId, angle_label: angle.label, error: payload.message || payload.error || "image_gen_failed" };
        }

        // Salva em hub_assets pra aparecer na Library
        let assetId: string | null = null;
        try {
          const { data: inserted } = await sb.from("hub_assets").insert({
            user_id: authUser.id,
            kind: "hub_image",
            content: {
              image_url: payload.image_url,
              prompt: cleanPrompt,
              full_prompt: finalPrompt,
              aspect_ratio,
              brand_id: brand_id || null,
              brand_name: brandCtx?.name || null,
              angle_id: angleId,
              angle_label: angle.label,
              source: "studio",
              model: "gpt-image-2",
            },
            created_at: new Date().toISOString(),
          }).select("id").single();
          assetId = (inserted as { id?: string })?.id || null;
        } catch (e) {
          console.warn(`[generate-creatives] hub_assets insert failed:`, e);
        }

        return {
          angle_id: angleId,
          angle_label: angle.label,
          image_url: payload.image_url,
          asset_id: assetId || undefined,
        };
      } catch (e) {
        return { angle_id: angleId, angle_label: angle.label, error: String(e).slice(0, 200) };
      }
    };

    for (let i = 0; i < angleIds.length; i += CONC) {
      const batch = angleIds.slice(i, i + CONC);
      const batchResults = await Promise.all(batch.map(generateOne));
      results.push(...batchResults);
    }

    const okCount = results.filter(r => r.image_url && !r.error).length;
    console.log(`[generate-creatives] done — ${okCount}/${N} ok`);

    return jsonResponse({
      _v: FN_VERSION,
      ok: true,
      count: N,
      ok_count: okCount,
      results,
    }, 200);

  } catch (e) {
    console.error("[generate-creatives] unexpected:", e);
    return jsonResponse({
      _v: FN_VERSION, ok: false, error: "internal_error",
      message: String(e).slice(0, 300),
    }, 500);
  }
});
