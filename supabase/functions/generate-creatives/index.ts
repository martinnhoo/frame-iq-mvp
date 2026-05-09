// generate-creatives — geração em batch com angle distribution + brand context.
//
// FLUXO (background processing pra evitar 150s timeout):
//   1. Recebe request → cria studio_runs row (status=pending)
//   2. Kick off generation via EdgeRuntime.waitUntil (não bloqueia)
//   3. Retorna IMEDIATAMENTE com { run_id, angles[] }
//   4. Background: pra cada angle, chama generate-image-hub e ATUALIZA
//      studio_runs.results conforme cada um termina (streaming UX)
//   5. Frontend polla studio_runs.results a cada 2.5s
//
// Pra cada slot:
//   - Pega angle correspondente
//   - Carrega 3 brand_assets aleatórios (se brand_id)
//   - Constrói prompt = angle_prefix + brand_block + user_prompt
//   - Chama generate-image-hub passando assets como reference
//   - Salva em hub_assets pra Library
//   - Atualiza studio_runs.results

const FN_VERSION = "v2-background-2026-05-08";

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

const SERVER_ANGLE_LIBRARY: Record<string, { label: string; safety: "safe" | "moderate" | "experimental"; prompt_prefix: string }> = {
  direct_offer: { label: "Oferta Direta", safety: "safe", prompt_prefix: "CREATIVE ANGLE: Direct response. Center the offer + CTA as the dominant visual element. Clear hierarchy: hook on top, offer in the middle (largest typography), CTA at the bottom. Minimal distractions. High contrast. Safe scalable layout." },
  before_after: { label: "Antes/Depois", safety: "safe", prompt_prefix: "CREATIVE ANGLE: Before/After split. Vertical or horizontal split frame. Left/top = problem state (muted, gray). Right/bottom = solution state (vibrant, energized). Same subject in both halves when applicable." },
  social_proof: { label: "Social Proof", safety: "safe", prompt_prefix: "CREATIVE ANGLE: Social proof first. Foreground = stars rating + customer count badge + quote-style testimonial. Visual must feel like screenshots of real reviews." },
  authority_premium: { label: "Autoridade Premium", safety: "safe", prompt_prefix: "CREATIVE ANGLE: Premium authority. Dark background. Gold or platinum accents. Centered hierarchy. Generous whitespace. Cinematic lighting on subject. Conveys exclusivity without saying 'exclusive'." },
  comparison_us_vs: { label: "Comparação", safety: "safe", prompt_prefix: "CREATIVE ANGLE: Direct comparison layout. Two-column visual: left = competitor (muted, X marks), right = brand (highlighted, check marks)." },
  feature_zoom: { label: "Feature Zoom", safety: "safe", prompt_prefix: "CREATIVE ANGLE: Feature highlight. Extreme close-up or macro shot of the product/UI. Annotation labels with thin lines pointing to key elements." },
  emotional_reaction: { label: "Reação Emocional", safety: "moderate", prompt_prefix: "CREATIVE ANGLE: Emotional reaction. Close-up of a person's face showing genuine surprise, joy, or relief. Slight imperfect framing. Natural skin tones. Eyes engage the viewer." },
  curiosity_gap: { label: "Curiosity Gap", safety: "moderate", prompt_prefix: "CREATIVE ANGLE: Curiosity gap. Provocative question or incomplete statement as the hook. Visual partially obscured (cropped, blurred edges)." },
  urgency_scarcity: { label: "Urgência/Escassez", safety: "moderate", prompt_prefix: "CREATIVE ANGLE: Urgency/scarcity. Visible time pressure element (countdown, calendar, expiring badge). Aggressive typography for time markers. Red/orange accents." },
  beginner_friendly: { label: "Beginner-Friendly", safety: "moderate", prompt_prefix: "CREATIVE ANGLE: Beginner-friendly. Reassuring tone. Simple shapes, friendly colors. Subject = approachable, smiling, ordinary." },
  fomo_aspirational: { label: "FOMO Aspiracional", safety: "moderate", prompt_prefix: "CREATIVE ANGLE: Aspirational FOMO. Lifestyle shot of someone living the upgraded outcome. Slight envy-inducing framing." },
  meme_native: { label: "Meme Native", safety: "experimental", prompt_prefix: "CREATIVE ANGLE: Meme-native. Low-polish aesthetic. Impact font with white-and-black outline. Slightly oversaturated. Visual hierarchy ignores rules." },
  fake_screenshot: { label: "Fake Screenshot", safety: "experimental", prompt_prefix: "CREATIVE ANGLE: Native UI mock. Looks like an iOS/Android push notification, DM thread, or in-app screen capture. Authentic platform fonts." },
  chaotic_typography: { label: "Tipografia Caótica", safety: "experimental", prompt_prefix: "CREATIVE ANGLE: Typography chaos. Numbers/keywords sized enormously (50%+ of frame). Asymmetric placement. Mixed weights." },
  creator_pov: { label: "Creator POV", safety: "experimental", prompt_prefix: "CREATIVE ANGLE: Creator POV. First-person selfie or talking-head shot. Vertical 9:16 framing. Natural ring-light or window light." },
  split_chaos: { label: "Split Chaos", safety: "experimental", prompt_prefix: "CREATIVE ANGLE: Multi-panel chaos. 3-6 visual elements overlapping or in irregular grid. Each panel = different angle of the offer." },
};

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
  const safeCount = Math.max(1, Math.round(n * 0.7));
  const modCount = Math.max(0, Math.round(n * 0.2));
  const expCount = Math.max(0, n - safeCount - modCount);
  return shuffle([
    ...shuffle(safe).slice(0, safeCount),
    ...shuffle(moderate).slice(0, modCount),
    ...shuffle(experimental).slice(0, expCount),
  ]).slice(0, n);
}

async function loadBrandContext(
  sb: ReturnType<typeof createClient>, brandId: string, userId: string,
): Promise<{ name: string; notes: string; assetUrls: string[] } | null> {
  const { data: brand } = await sb
    .from("user_brands").select("name, notes")
    .eq("id", brandId).eq("user_id", userId).maybeSingle();
  if (!brand) return null;
  const { data: assets } = await sb
    .from("brand_assets").select("asset_url")
    .eq("brand_id", brandId).order("position", { ascending: true }).limit(20);
  const allUrls = (assets || []).map(a => a.asset_url as string).filter(Boolean);
  const shuffled = [...allUrls].sort(() => Math.random() - 0.5).slice(0, 3);
  return {
    name: (brand.name as string) || "",
    notes: (brand.notes as string) || "",
    assetUrls: shuffled,
  };
}

interface SlotResult {
  angle_id: string;
  angle_label: string;
  image_url?: string;
  asset_id?: string;
  error?: string;
}

// Background processor — não bloqueia a resposta principal.
// Atualiza studio_runs.results em cada step pra streaming UX.
async function processRunInBackground(params: {
  sb: ReturnType<typeof createClient>;
  runId: string;
  userId: string;
  authToken: string;
  supabaseUrl: string;
  brandId: string | null;
  prompt: string;
  angleIds: string[];
  aspectRatio: string;
  brandCtx: Awaited<ReturnType<typeof loadBrandContext>>;
}) {
  const { sb, runId, userId, authToken, supabaseUrl, brandId, prompt, angleIds, aspectRatio, brandCtx } = params;
  const startedAt = Date.now();

  // Marca como running
  await sb.from("studio_runs").update({ status: "running" }).eq("id", runId);

  // Inicializa results array com placeholders pra cada slot
  const initialResults: SlotResult[] = angleIds.map(id => {
    const a = SERVER_ANGLE_LIBRARY[id];
    return { angle_id: id, angle_label: a?.label || id };
  });
  await sb.from("studio_runs").update({ results: initialResults }).eq("id", runId);

  const brandBlock = brandCtx
    ? `BRAND: ${brandCtx.name}\n${brandCtx.notes ? `BRAND NOTES (rules, tone, restrictions):\n${brandCtx.notes}\n` : ""}${brandCtx.assetUrls.length > 0 ? `BRAND VISUAL REFERENCES: ${brandCtx.assetUrls.length} reference image(s) provided. Use them as visual anchor — same color palette, typography mood, and style direction. Adapt freely to the user prompt and angle, but keep the brand DNA visible.\n` : ""}`
    : "";

  // Generate 1 slot e atualiza results no DB
  const generateSlot = async (idx: number): Promise<void> => {
    const angleId = angleIds[idx];
    const angle = SERVER_ANGLE_LIBRARY[angleId];
    if (!angle) {
      await updateSlotResult(sb, runId, idx, {
        angle_id: angleId, angle_label: angleId, error: "angle_not_found",
      });
      return;
    }

    const finalPrompt = [
      angle.prompt_prefix,
      brandBlock,
      `USER REQUEST:\n${prompt}`,
    ].filter(Boolean).join("\n\n");

    try {
      const r = await fetch(`${supabaseUrl}/functions/v1/generate-image-hub`, {
        method: "POST",
        headers: { "Authorization": authToken, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          aspect_ratio: aspectRatio,
          quality: "medium",
          ...(brandCtx?.assetUrls && brandCtx.assetUrls.length > 0
            ? { input_images_base64: brandCtx.assetUrls }
            : {}),
        }),
      });
      const text = await r.text();
      let payload: { ok?: boolean; image_url?: string; memory_id?: string; message?: string; error?: string };
      try { payload = JSON.parse(text); } catch {
        await updateSlotResult(sb, runId, idx, {
          angle_id: angleId, angle_label: angle.label,
          error: `non_json: ${text.slice(0, 100)}`,
        });
        return;
      }
      if (!payload.ok || !payload.image_url) {
        await updateSlotResult(sb, runId, idx, {
          angle_id: angleId, angle_label: angle.label,
          error: payload.message || payload.error || "image_gen_failed",
        });
        return;
      }

      // Salva em hub_assets pra Library
      let assetId: string | null = null;
      try {
        const { data: inserted } = await sb.from("hub_assets").insert({
          user_id: userId,
          kind: "hub_image",
          content: {
            image_url: payload.image_url,
            prompt,
            full_prompt: finalPrompt,
            aspect_ratio: aspectRatio,
            brand_id: brandId,
            brand_name: brandCtx?.name || null,
            angle_id: angleId,
            angle_label: angle.label,
            source: "studio",
            studio_run_id: runId,
            model: "gpt-image-2",
          },
          created_at: new Date().toISOString(),
        }).select("id").single();
        assetId = (inserted as { id?: string })?.id || null;
      } catch (e) {
        console.warn(`[generate-creatives bg] hub_assets insert failed:`, e);
      }

      await updateSlotResult(sb, runId, idx, {
        angle_id: angleId, angle_label: angle.label,
        image_url: payload.image_url,
        asset_id: assetId || undefined,
      });
    } catch (e) {
      await updateSlotResult(sb, runId, idx, {
        angle_id: angleId, angle_label: angle.label,
        error: String(e).slice(0, 200),
      });
    }
  };

  // Concorrência 3 paralelo
  const CONC = 3;
  const indices = Array.from({ length: angleIds.length }, (_, i) => i);
  for (let i = 0; i < indices.length; i += CONC) {
    const batch = indices.slice(i, i + CONC);
    await Promise.all(batch.map(generateSlot));
  }

  // Marca como done
  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  await sb.from("studio_runs").update({
    status: "done", finished_at: new Date().toISOString(),
  }).eq("id", runId);
  console.log(`[generate-creatives bg] run=${runId} done in ${elapsedSec}s`);
}

// Atualiza UM slot do array results sem race conditions:
// busca o array atual, substitui o índice, salva.
// Pequena chance de perda em races extremos (3 paralelos), mas é
// idempotente — se o frontend recarregar, vai pegar o estado final.
async function updateSlotResult(
  sb: ReturnType<typeof createClient>,
  runId: string, idx: number, result: SlotResult,
): Promise<void> {
  try {
    const { data: row } = await sb.from("studio_runs")
      .select("results").eq("id", runId).maybeSingle();
    const results = (row?.results as SlotResult[] | null) || [];
    results[idx] = result;
    await sb.from("studio_runs").update({ results }).eq("id", runId);
  } catch (e) {
    console.warn(`[generate-creatives bg] update slot ${idx} failed:`, e);
  }
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

    const cleanPrompt = (prompt || "").trim();
    if (cleanPrompt.length < 5) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "invalid_prompt",
        message: "Descreva o anúncio com pelo menos 5 caracteres.",
      }, 400);
    }
    const N = Math.max(1, Math.min(10, Math.floor(count)));

    let angleIds: string[];
    if (Array.isArray(angles) && angles.length > 0) {
      angleIds = angles
        .filter(id => typeof id === "string" && SERVER_ANGLE_LIBRARY[id])
        .slice(0, N);
      if (angleIds.length < N) {
        angleIds = [...angleIds, ...pickBalancedAngles(N - angleIds.length)];
      }
    } else {
      angleIds = pickBalancedAngles(N);
    }

    let brandCtx: Awaited<ReturnType<typeof loadBrandContext>> = null;
    if (brand_id) {
      brandCtx = await loadBrandContext(sb, brand_id, authUser.id);
    }

    // Cria studio_runs row
    const { data: run, error: insErr } = await sb.from("studio_runs").insert({
      user_id: authUser.id,
      status: "pending",
      prompt: cleanPrompt,
      brand_id: brand_id || null,
      count: N,
      aspect_ratio,
      angles: angleIds,
    }).select("id").single();

    if (insErr || !run) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "db_insert_failed",
        message: insErr?.message || "Falha criar run",
      }, 500);
    }

    const runId = (run as { id: string }).id;
    console.log(`[generate-creatives] start runId=${runId} user=${authUser.id} count=${N} brand=${brand_id || "(none)"} brandAssets=${brandCtx?.assetUrls.length || 0}`);

    // Kick off background processing — NÃO bloqueia a resposta
    const bgWork = processRunInBackground({
      sb, runId, userId: authUser.id, authToken: authHeader,
      supabaseUrl: SUPABASE_URL,
      brandId: brand_id, prompt: cleanPrompt,
      angleIds, aspectRatio: aspect_ratio, brandCtx,
    }).catch(async (e) => {
      console.error(`[generate-creatives bg] run=${runId} fatal:`, e);
      await sb.from("studio_runs").update({
        status: "failed", finished_at: new Date().toISOString(),
      }).eq("id", runId);
    });

    // @ts-expect-error EdgeRuntime is Deno-specific
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-expect-error
      EdgeRuntime.waitUntil(bgWork);
    }

    // Resposta imediata — frontend usa run_id pra poll
    return jsonResponse({
      _v: FN_VERSION,
      ok: true,
      run_id: runId,
      count: N,
      angles: angleIds.map(id => ({
        id, label: SERVER_ANGLE_LIBRARY[id]?.label || id,
      })),
    }, 202);

  } catch (e) {
    console.error("[generate-creatives] unexpected:", e);
    return jsonResponse({
      _v: FN_VERSION, ok: false, error: "internal_error",
      message: String(e).slice(0, 300),
    }, 500);
  }
});
