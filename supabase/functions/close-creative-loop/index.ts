// close-creative-loop — Fecha o loop criativo: pattern/ad vencedor → draft pronto
//
// Input:  { user_id, source_type: 'pattern'|'winning_ad'|'decision_scale', source_id, source_snapshot? }
// Output: { draft_id, brief, copy_variants, image_variants, predicted_score, credits_remaining }
//
// Pipeline:
//   1. Load brain_context(user_id) — patterns + facts + profile + winning creatives
//   2. Haiku generates brief (based on what THIS account has learned works)
//   3. Haiku generates 3 copy variants (headline + primary + CTA + hook_type)
//   4. Best-effort: generate 3 image variants via Claude Haiku (multimodal)
//   5. Haiku scores the set (predicted_ctr, predicted_roas)
//   6. Persist draft in creative_loop_drafts
//
// Credit cost: 8 (via shared requireCredits)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCredits } from "../_shared/deductCredits.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

interface CopyVariant {
  headline: string;
  primary: string;
  cta: string;
  hook_type: string;
  angle: string;
}

interface ImageVariant {
  url: string | null;
  prompt: string;
  model: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!ANTHROPIC_API_KEY) {
      return json({ error: "ANTHROPIC_API_KEY not configured" }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const {
      user_id,
      source_type,
      source_id,
      source_snapshot = {},
      generate_images = true,
      variant_count = 3,
    } = body;

    if (!user_id || !source_type || !source_id) {
      return json({ error: "Missing user_id / source_type / source_id" }, 400);
    }
    if (!["pattern", "winning_ad", "decision_scale"].includes(source_type)) {
      return json({ error: `Invalid source_type: ${source_type}` }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── 1. Credit gate ──────────────────────────────────────────────────────
    const credits = await requireCredits(supabase, user_id, "creative_loop", {
      source_type,
      source_id,
    });
    if (!credits.allowed) {
      return json(credits.error ?? { error: "insufficient_credits" }, 402);
    }

    // ── 2. Load brain context ──────────────────────────────────────────────
    const { data: brainData, error: brainErr } = await supabase.rpc("brain_context", {
      p_user_id: user_id,
    });
    if (brainErr) console.warn("[close-creative-loop] brain_context failed:", brainErr.message);
    const brain = brainData ?? { patterns: [], facts: [], profile: {}, winning_creatives: [] };

    // ── 3. Resolve source details (pattern row or ad row) ───────────────────
    let sourceDetails: any = source_snapshot;
    if (source_type === "pattern" && (!sourceDetails || !sourceDetails.pattern_key)) {
      const { data: p } = await supabase
        .from("learned_patterns" as any)
        .select("*")
        .eq("id", source_id)
        .eq("user_id", user_id)
        .maybeSingle();
      if (p) sourceDetails = p;
    }

    // ── 4. Build system prompt with brain context ───────────────────────────
    const brainSummary = summarizeBrain(brain);
    const sourceSummary = summarizeSource(source_type, sourceDetails);

    const systemPrompt = `You are a senior performance media buyer for AdBrief.pro. You are generating a NEW ad creative variation that builds on what has already worked on THIS specific account. You must base every recommendation on the account's real learned patterns — never invent numbers or generic advice.

ACCOUNT BRAIN (what this specific account has learned):
${brainSummary}

SOURCE OF THIS VARIATION:
${sourceSummary}

OUTPUT REQUIREMENTS:
- Return STRICT JSON (no markdown, no prose outside JSON).
- Language: Portuguese (Brazil) unless the profile specifies otherwise.
- Schema:
{
  "brief": "<120-200 word brief explaining WHY this will work for this account, grounded in the patterns above>",
  "angle": "<single-sentence core angle>",
  "copy_variants": [
    {
      "headline": "<max 40 chars>",
      "primary": "<80-140 chars, hook-forward>",
      "cta": "<3-5 word CTA>",
      "hook_type": "<e.g. UGC|authority|before-after|social-proof|curiosity>",
      "angle": "<one-sentence angle>"
    }
    // exactly ${variant_count} variants, each with a different angle
  ],
  "image_prompts": [
    "<photorealistic prompt for image 1, concrete subject/location/lighting, no text>",
    "<image 2>",
    "<image 3>"
  ],
  "predicted_ctr": 0.00-0.08,
  "predicted_roas": 0-10,
  "predicted_score": 0-1000,
  "reasoning": "<1-2 sentences explaining the prediction, anchored in sample sizes from the brain>"
}`;

    // ── 5. Haiku call for brief + copy + scoring ────────────────────────────
    const haikuStart = Date.now();
    const haikuRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: `Generate the variation now. Remember: STRICT JSON only, exactly ${variant_count} copy variants with DIFFERENT angles.` }],
      }),
    });

    if (!haikuRes.ok) {
      const errText = await haikuRes.text();
      console.error("[close-creative-loop] Haiku error:", haikuRes.status, errText);
      return json({ error: "ai_generation_failed", details: errText.slice(0, 500) }, 502);
    }

    const haikuData = await haikuRes.json();
    const rawText = haikuData?.content?.[0]?.text ?? "";
    const parsed = safeParseJson(rawText);
    if (!parsed) {
      console.error("[close-creative-loop] Failed to parse Haiku response:", rawText.slice(0, 500));
      return json({ error: "ai_parse_failed", raw: rawText.slice(0, 500) }, 502);
    }

    const brief: string = parsed.brief ?? "";
    const angle: string = parsed.angle ?? "";
    const copy_variants: CopyVariant[] = Array.isArray(parsed.copy_variants) ? parsed.copy_variants : [];
    const imagePrompts: string[] = Array.isArray(parsed.image_prompts) ? parsed.image_prompts : [];
    const predicted_ctr = clamp(parsed.predicted_ctr ?? 0, 0, 0.2);
    const predicted_roas = clamp(parsed.predicted_roas ?? 0, 0, 20);
    const predicted_score = Math.round(clamp(parsed.predicted_score ?? 0, 0, 1000));

    console.log(`[close-creative-loop] Haiku done in ${Date.now() - haikuStart}ms, ${copy_variants.length} copy variants`);

    // ── 6. Image generation (best-effort, parallel) ─────────────────────────
    let image_variants: ImageVariant[] = [];
    if (generate_images && imagePrompts.length > 0) {
      const results = await Promise.allSettled(
        imagePrompts.slice(0, variant_count).map((prompt, idx) => generateImage(ANTHROPIC_API_KEY, prompt, idx))
      );
      image_variants = results.map((r, idx) =>
        r.status === "fulfilled"
          ? r.value
          : { url: null, prompt: imagePrompts[idx], model: ANTHROPIC_MODEL, error: String(r.reason).slice(0, 200) }
      );
    }

    // ── 7. Persist draft ────────────────────────────────────────────────────
    const { data: draft, error: insErr } = await supabase
      .from("creative_loop_drafts" as any)
      .insert({
        user_id,
        source_type,
        source_id,
        source_snapshot: sourceDetails,
        brief,
        angle,
        copy_variants,
        image_variants,
        predicted_score,
        predicted_ctr,
        predicted_roas,
        credits_used: 8,
      })
      .select()
      .single();

    if (insErr) {
      console.error("[close-creative-loop] Insert failed:", insErr.message);
      return json({ error: "persist_failed", details: insErr.message }, 500);
    }

    // ── 8. Register account fact: "variation generated from X" ──────────────
    await supabase.from("account_facts" as any).insert({
      user_id,
      fact_type: "outcome",
      subject: `draft:${draft.id}`,
      predicate: "generated_from",
      object: `${source_type}:${source_id}`,
      confidence: 0.5,
      evidence: {
        predicted_ctr,
        predicted_roas,
        predicted_score,
        variant_count: copy_variants.length,
      },
      source: "creative_loop",
      source_id: draft.id,
    }).catch((e: any) => console.warn("[close-creative-loop] fact insert failed:", e.message));

    return json({
      draft_id: draft.id,
      brief,
      angle,
      copy_variants,
      image_variants,
      predicted_ctr,
      predicted_roas,
      predicted_score,
      reasoning: parsed.reasoning ?? "",
      credits_remaining: credits.remaining,
    });
  } catch (err) {
    console.error("[close-creative-loop] fatal:", err);
    return json({ error: "internal_error", details: String(err).slice(0, 500) }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function clamp(v: number, lo: number, hi: number): number {
  const n = Number(v);
  if (!isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function safeParseJson(txt: string): any | null {
  if (!txt) return null;
  // Strip markdown fences if present
  const cleaned = txt
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract first JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}

function summarizeBrain(brain: any): string {
  const parts: string[] = [];

  if (Array.isArray(brain.patterns) && brain.patterns.length > 0) {
    parts.push(`WINNING PATTERNS (top ${brain.patterns.length}):`);
    brain.patterns.slice(0, 8).forEach((p: any, i: number) => {
      const ctr = p.avg_ctr ? `CTR ${((p.avg_ctr > 1 ? p.avg_ctr : p.avg_ctr * 100)).toFixed(2)}%` : "";
      const roas = p.avg_roas ? `ROAS ${Number(p.avg_roas).toFixed(1)}x` : "";
      parts.push(`  ${i + 1}. [${p.pattern_key}] ${p.insight_text || ""} — ${ctr} ${roas} (n=${p.sample_size}, conf=${(p.confidence * 100).toFixed(0)}%)`);
    });
  }

  if (Array.isArray(brain.facts) && brain.facts.length > 0) {
    parts.push(`\nACCOUNT FACTS (high confidence):`);
    brain.facts.slice(0, 10).forEach((f: any) => {
      parts.push(`  - ${f.subject} ${f.predicate} ${f.object} (${(f.confidence * 100).toFixed(0)}% conf, source: ${f.source})`);
    });
  }

  if (Array.isArray(brain.winning_creatives) && brain.winning_creatives.length > 0) {
    parts.push(`\nTOP CREATIVES BY ROAS (last 10):`);
    brain.winning_creatives.slice(0, 6).forEach((c: any, i: number) => {
      parts.push(`  ${i + 1}. ${c.hook_type || "?"} / ${c.market || "?"} / ${c.platform || "?"} — CTR ${c.ctr ? (c.ctr * 100).toFixed(2) + "%" : "—"}, ROAS ${c.roas ? Number(c.roas).toFixed(1) + "x" : "—"}`);
    });
  }

  if (brain.profile && typeof brain.profile === "object") {
    const p = brain.profile;
    if (p.business_goal || p.brand_voice || p.target_audience) {
      parts.push(`\nPROFILE:`);
      if (p.business_goal) parts.push(`  goal: ${p.business_goal}`);
      if (p.brand_voice) parts.push(`  voice: ${p.brand_voice}`);
      if (p.target_audience) parts.push(`  audience: ${p.target_audience}`);
      if (p.pain_point) parts.push(`  pain: ${p.pain_point}`);
    }
  }

  if (parts.length === 0) {
    parts.push("(This account has no learned patterns yet — rely on best practices and be explicit about the uncertainty.)");
  }

  return parts.join("\n");
}

function summarizeSource(source_type: string, details: any): string {
  if (!details) return `source_type=${source_type}, no details`;
  if (source_type === "pattern") {
    const vars = details.variables ? Object.entries(details.variables).filter(([, v]) => v && v !== "unknown").map(([k, v]) => `${k}=${v}`).join(", ") : "";
    return `Winning pattern: ${details.pattern_key || details.id}
Variables: ${vars}
Performance: CTR ${details.avg_ctr ? ((details.avg_ctr > 1 ? details.avg_ctr : details.avg_ctr * 100)).toFixed(2) + "%" : "—"}, ROAS ${details.avg_roas ? Number(details.avg_roas).toFixed(1) + "x" : "—"}, n=${details.sample_size || 0}
Insight: ${details.insight_text || "(none)"}`;
  }
  if (source_type === "winning_ad") {
    return `Winning ad: ${details.name || details.id}
Hook: ${details.hook_type || "?"} / ${details.hook_angle || "?"}
Performance: CTR ${details.ctr ? (details.ctr * 100).toFixed(2) + "%" : "—"}, ROAS ${details.roas ? Number(details.roas).toFixed(1) + "x" : "—"}`;
  }
  if (source_type === "decision_scale") {
    return `SCALE decision on ad: ${details.ad_name || details.ad_id || "?"}
Why it's winning: ${details.why || details.reasoning || "(see decision payload)"}`;
  }
  return JSON.stringify(details).slice(0, 500);
}

async function generateImage(apiKey: string, prompt: string, index: number): Promise<ImageVariant> {
  const fullPrompt = `Create a photorealistic, cinematic ad creative image. No text, no watermarks, no borders, no UI overlays. Professional advertising production quality.

Visual: ${prompt}`;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        messages: [{ role: "user", content: fullPrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { url: null, prompt, model: ANTHROPIC_MODEL, error: `${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = await res.json();
    const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
    return { url, prompt, model: ANTHROPIC_MODEL };
  } catch (e) {
    return { url: null, prompt, model: ANTHROPIC_MODEL, error: String(e).slice(0, 200) };
  }
}
