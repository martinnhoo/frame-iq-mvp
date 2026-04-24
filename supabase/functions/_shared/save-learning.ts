// _shared/save-learning.ts
//
// ONE place for AI features to write their output back into the
// shared brain. Pair of load-user-context.ts — together they close
// the learning loop so every Claude call both READS past knowledge
// AND WRITES the new output back so the brain accumulates.
//
// DESIGN RULES (do not break):
//   1. FIRE-AND-FORGET by default. All writes return Promise<void>
//      and are designed so the caller can do `saveX(...).catch(() => {})`
//      without blocking the user's response.
//   2. IDEMPOTENT. Calling twice shouldn't create duplicate rows.
//      We use upserts + stable keys (hash of content where useful).
//   3. PERSONA-SCOPED. Every row carries persona_id. Never cross
//      personas.
//   4. BOUNDED. Each function caps the payload it writes so we don't
//      stuff 50KB of AI text into a row.
//   5. GRACEFUL FAILURE. Never throws. On failure, console.error and
//      return — the user's response already went out.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

function getClient(supabase?: SupabaseClient): SupabaseClient {
  return supabase
    ?? createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
}

// ────────────────────────────────────────────────────────────────────
// Creative output — hooks, scripts, briefs, captions, personas, variants
//
// Writes to creative_memory so future generations can reference what
// the user has seen / liked / rejected before. A hook generated today
// becomes example context for tomorrow's script or brief.
// ────────────────────────────────────────────────────────────────────

export interface SaveCreativeOutputOpts {
  userId: string;
  personaId?: string | null;
  /** Feature that created this output ('hooks', 'script', 'brief',
   *  'persona', 'captions', 'ab_variant', etc.) — used as tag. */
  feature: string;
  /** A short human-readable label for the output — e.g. the first
   *  hook line, the brief title. Kept short so it doesn't bloat
   *  the row. */
  label: string;
  /** Machine-readable body. Gets stringified + truncated to 4KB. */
  payload: unknown;
  /** Optional tags — format, hook type, objective, etc. Indexed for
   *  fast filtering in future reads. */
  tags?: string[];
  supabase?: SupabaseClient;
}

export async function saveCreativeOutput(opts: SaveCreativeOutputOpts): Promise<void> {
  try {
    const sb = getClient(opts.supabase);
    const payloadStr = typeof opts.payload === "string"
      ? opts.payload
      : JSON.stringify(opts.payload);

    // creative_memory schema (prod) has NO persona_id / metric_type /
    // insight_text / tags / payload columns. It was designed for video
    // analysis rows. We map our creative-output shape onto the columns
    // that DO exist by packing label + tags + payload into `notes` as a
    // JSON blob, and using `hook_type` for the feature name. Readers
    // that know this convention can decode; legacy rows stay untouched.
    const label = (opts.label || "").slice(0, 200);
    const tags = [opts.feature, ...(opts.tags || [])].slice(0, 10);
    const notesObj = {
      v: 1, // schema version marker so future readers can evolve
      persona_id: opts.personaId ?? null,
      feature: opts.feature,
      label,
      tags,
      payload: payloadStr,
    };
    let notesStr = JSON.stringify(notesObj);
    if (notesStr.length > 5500) {
      // Trim the payload field to keep the whole row under Postgres TEXT
      // limits comfortably. Label + tags stay intact for fast filtering.
      const overflow = notesStr.length - 5500;
      notesObj.payload = payloadStr.slice(0, Math.max(200, payloadStr.length - overflow - 100)) + "…";
      notesStr = JSON.stringify(notesObj);
    }

    // Infer platform / market from tags when the caller put them there
    // (generators do — see generate-hooks / captions / ab-variants).
    const tagsLower = tags.map(t => String(t).toLowerCase());
    const platform = ["meta", "tiktok", "reels", "facebook", "linkedin", "instagram"]
      .find(p => tagsLower.includes(p)) ?? null;
    const market = tagsLower.find(t => /^(br|us|global|generic|[a-z]{2}_[a-z]{2})$/i.test(t)) ?? null;

    const { error } = await (sb as any).from("creative_memory").insert({
      user_id: opts.userId,
      hook_type: opts.feature.slice(0, 40),
      creative_model: "claude-haiku-4-5",
      platform,
      market,
      notes: notesStr,
      created_at: new Date().toISOString(),
    });
    if (error) console.error("[save-learning] creative insert error:", error.message || error);
  } catch (e) {
    console.error("[save-learning] creative failed:", (e as any)?.message || e);
  }
}

// ────────────────────────────────────────────────────────────────────
// Pattern discovery — when a detector / analyzer finds something
// about the account, persist it as a learned pattern so the brain
// remembers "we saw X before". Upsert by (user, persona, pattern_key)
// so repeated discoveries bump sample_size instead of creating
// duplicates.
// ────────────────────────────────────────────────────────────────────

export interface SavePatternOpts {
  userId: string;
  personaId?: string | null;
  /** Stable key for the pattern — same key should reliably identify
   *  the same insight across reruns. e.g. "freq_high_spike",
   *  "competitor_hook_urgency", "trend_ugc_rising". */
  patternKey: string;
  /** Short human label. */
  label?: string;
  /** 0.0 - 1.0 confidence. Default 0.7 if caller doesn't know. */
  confidence?: number;
  /** Whether this pattern marks a WIN (good thing to lean into) vs
   *  a LOSS (bad pattern to avoid). Null if neutral/informational. */
  isWinner?: boolean | null;
  /** Text the AI can cite back in future prompts. ≤ 400 chars. */
  insightText?: string;
  /** Pattern category — routes it into the right read scope later.
   *  Known: 'perf' (performance), 'market' (trend), 'trend',
   *  'competitor', 'detected', 'preflight', 'gap'. */
  featureType?: string;
  /** Free-form structured blob. */
  variables?: Record<string, unknown>;
  /** Metrics observed (for reference). */
  avgCtr?: number | null;
  avgRoas?: number | null;
  sampleSize?: number;
  supabase?: SupabaseClient;
}

export async function savePatternDiscovery(opts: SavePatternOpts): Promise<void> {
  try {
    const sb = getClient(opts.supabase);
    const patternKey = opts.patternKey.slice(0, 120);

    // learned_patterns schema (prod) has: user_id, persona_id,
    // pattern_key, variables, avg_ctr/cpc/roas/thumb_stop, sample_size,
    // confidence, is_winner, insight_text, last_updated, created_at.
    // There is NO `label` or `feature_type` column — we fold label into
    // insight_text and feature_type into the pattern_key prefix
    // (already done by all callers: "competitor_", "trend_",
    // "preflight_", "alert_"). Timestamp column is `last_updated`.
    const insightCombined = [
      opts.label ? opts.label.slice(0, 120) : null,
      opts.insightText ? opts.insightText.slice(0, 400) : null,
    ].filter(Boolean).join(" — ").slice(0, 500) || null;

    const variablesWithMeta = {
      ...(opts.variables || {}),
      feature_type: opts.featureType ?? "detected",
      ...(opts.label ? { label: opts.label.slice(0, 200) } : {}),
    };

    const row: Record<string, unknown> = {
      user_id: opts.userId,
      persona_id: opts.personaId ?? null,
      pattern_key: patternKey,
      confidence: opts.confidence ?? 0.7,
      is_winner: opts.isWinner ?? null,
      insight_text: insightCombined,
      variables: variablesWithMeta,
      avg_ctr: opts.avgCtr ?? null,
      avg_roas: opts.avgRoas ?? null,
      sample_size: opts.sampleSize ?? 1,
      last_updated: new Date().toISOString(),
    };

    // Upsert by (user_id, persona_id, pattern_key). When the row
    // already exists we bump sample_size and update the metrics
    // instead of creating a duplicate. Supabase .is(col, null) only
    // matches NULL — for a concrete UUID we must use .eq, so we branch.
    let existingQuery = (sb as any).from("learned_patterns")
      .select("id, sample_size")
      .eq("user_id", opts.userId)
      .eq("pattern_key", patternKey);
    existingQuery = opts.personaId
      ? existingQuery.eq("persona_id", opts.personaId)
      : existingQuery.is("persona_id", null);
    const existing = await existingQuery.limit(1).maybeSingle();

    if (existing?.data?.id) {
      const { error } = await (sb as any).from("learned_patterns")
        .update({
          ...row,
          sample_size: (existing.data.sample_size || 0) + (opts.sampleSize ?? 1),
        })
        .eq("id", existing.data.id);
      if (error) console.error("[save-learning] pattern update error:", error.message || error);
    } else {
      const { error } = await (sb as any).from("learned_patterns").insert({
        ...row,
        created_at: new Date().toISOString(),
      });
      if (error) console.error("[save-learning] pattern insert error:", error.message || error);
    }
  } catch (e) {
    console.error("[save-learning] pattern failed:", (e as any)?.message || e);
  }
}

// ────────────────────────────────────────────────────────────────────
// Competitive / trend insight — specialized pattern save with a
// conventional key prefix so reads can filter by source.
// ────────────────────────────────────────────────────────────────────

export interface SaveCompetitiveInsightOpts {
  userId: string;
  personaId?: string | null;
  /** Domain or competitor identifier. */
  competitor: string;
  /** What we learned. */
  insightText: string;
  /** Tactics / hooks / angles extracted. */
  tactics?: string[];
  confidence?: number;
  supabase?: SupabaseClient;
}

export async function saveCompetitiveInsight(opts: SaveCompetitiveInsightOpts): Promise<void> {
  const key = `competitor_${opts.competitor.replace(/[^a-z0-9]+/gi, "_").toLowerCase().slice(0, 80)}`;
  return savePatternDiscovery({
    userId: opts.userId,
    personaId: opts.personaId,
    patternKey: key,
    label: `Competitor: ${opts.competitor}`,
    insightText: opts.insightText,
    featureType: "competitor",
    confidence: opts.confidence ?? 0.75,
    variables: { tactics: (opts.tactics || []).slice(0, 20), competitor: opts.competitor },
    supabase: opts.supabase,
  });
}

export interface SaveTrendInsightOpts {
  userId: string;
  personaId?: string | null;
  /** Trend label — "ugc_rising", "storytelling_format", etc. */
  trendKey: string;
  insightText: string;
  confidence?: number;
  supabase?: SupabaseClient;
}

export async function saveTrendInsight(opts: SaveTrendInsightOpts): Promise<void> {
  const key = `trend_${opts.trendKey.replace(/[^a-z0-9]+/gi, "_").toLowerCase().slice(0, 80)}`;
  return savePatternDiscovery({
    userId: opts.userId,
    personaId: opts.personaId,
    patternKey: key,
    label: `Tendência: ${opts.trendKey}`,
    insightText: opts.insightText,
    featureType: "trend",
    confidence: opts.confidence ?? 0.65,
    supabase: opts.supabase,
  });
}

// ────────────────────────────────────────────────────────────────────
// Preflight / alert findings — detector output. Same shape as
// patterns with a feature_type discriminator so future calls can
// read "what did preflight tell us last time".
// ────────────────────────────────────────────────────────────────────

export interface SaveDetectionOpts {
  userId: string;
  personaId?: string | null;
  detector: "preflight" | "alert" | "diagnostic";
  findingKey: string;
  insightText: string;
  severity?: "low" | "medium" | "high" | "critical";
  variables?: Record<string, unknown>;
  supabase?: SupabaseClient;
}

export async function saveDetectionFinding(opts: SaveDetectionOpts): Promise<void> {
  const confidenceBySeverity = {
    low: 0.5,
    medium: 0.65,
    high: 0.8,
    critical: 0.9,
  };
  return savePatternDiscovery({
    userId: opts.userId,
    personaId: opts.personaId,
    patternKey: `${opts.detector}_${opts.findingKey.replace(/[^a-z0-9]+/gi, "_").toLowerCase().slice(0, 80)}`,
    label: `${opts.detector}: ${opts.findingKey}`,
    insightText: opts.insightText,
    featureType: opts.detector,
    confidence: confidenceBySeverity[opts.severity || "medium"],
    isWinner: false,
    variables: { severity: opts.severity || "medium", ...(opts.variables || {}) },
    supabase: opts.supabase,
  });
}
