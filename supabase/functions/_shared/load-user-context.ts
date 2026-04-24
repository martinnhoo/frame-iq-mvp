// _shared/load-user-context.ts
//
// ONE place to hydrate a Claude prompt with everything we know about
// a user + (optional) persona. Every AI feature — generators,
// detectors, analyzers — calls this so the brain is actually shared:
// a hook generated today carries the same context the daily-intelligence
// read this morning, which is the same context the Estrategista chat
// has access to.
//
// DESIGN RULES (do not break):
//   1. READ-ONLY. This helper never writes. Writes go through
//      save-learning.ts.
//   2. GRACEFUL DEGRADATION. Every table fetch is wrapped — if one
//      table errors or is empty, the others still return. The caller
//      ALWAYS gets a valid AdbriefBrainContext, never a throw.
//   3. PERSONA-SCOPED. When persona_id is provided, queries filter
//      by it; when null, queries use `.is('persona_id', null)` so
//      we read the user's GLOBAL brain only (no cross-persona leak).
//   4. CHEAP. 5 parallel queries, capped rows, no joins. Target
//      under 500ms on a warm connection.
//   5. BACKWARD-COMPATIBLE. Callers that don't pass persona_id still
//      get a valid (global) context back.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// ────────────────────────────────────────────────────────────────────
// Public types — every feature imports this shape.
// ────────────────────────────────────────────────────────────────────

export interface BrainProfile {
  objective?: string | null;
  primary_metric?: string | null;
  target_value?: number | null;
  tone?: string | null;
  avoid?: string[] | null;
  winning_style?: string | null;
  losing_style?: string | null;
  brand_voice?: string | null;
  last_updated?: string | null;
}

export interface BrainPattern {
  pattern_key: string;
  label?: string | null;
  insight_text?: string | null;
  avg_ctr?: number | null;
  avg_roas?: number | null;
  sample_size?: number | null;
  confidence?: number | null;
  is_winner?: boolean | null;
  feature_type?: string | null;
  variables?: Record<string, unknown> | null;
}

export interface BrainMemory {
  memory_text: string;
  memory_type?: string | null;
  importance?: number | null;
}

export interface BrainSnapshotLite {
  date: string;
  total_spend?: number | null;
  avg_ctr?: number | null;
  avg_roas?: number | null;
  active_ads?: number | null;
  winners_count?: number | null;
  losers_count?: number | null;
  ai_insight?: string | null;
}

export interface BrainCreativeMemory {
  // Projected from the real creative_memory columns. `hook_type`
  // doubles as our "feature" name (hooks / script / brief / ...).
  // `notes` is JSON we pack at save time — decoded into label/tags.
  hook_type?: string | null;
  creative_model?: string | null;
  platform?: string | null;
  market?: string | null;
  hook_score?: number | null;
  ctr?: number | null;
  roas?: number | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface BrainKnowledge {
  knowledge_type: string;
  slug: string;
  data: Record<string, unknown>;
  confidence?: number | null;
}

export interface AdbriefBrainContext {
  /** True when at least one of the reads succeeded. Callers can fall
   *  back to a generic prompt when false (first-time users). */
  hasAny: boolean;
  profile: BrainProfile | null;
  patterns: BrainPattern[];         // top-N, sorted by priority
  memories: BrainMemory[];          // top-N by importance
  recentSnapshots: BrainSnapshotLite[]; // last 7 days max
  creativeMemory: BrainCreativeMemory[]; // top-N winners
  knowledge: BrainKnowledge[];      // account_knowledge rows
  /** Persona scope used for this fetch (mirrored back for callers). */
  personaId: string | null;
  /** Wall-clock ms the load took — useful for debugging slow loads. */
  loadMs: number;
}

// ────────────────────────────────────────────────────────────────────
// Options
// ────────────────────────────────────────────────────────────────────

export interface LoadContextOptions {
  userId: string;
  personaId?: string | null;
  /** Client to use. Pass a service-role client when calling from an
   *  edge function that's already authed. If omitted, we build one
   *  from env vars. */
  supabase?: SupabaseClient;
  /** Limit rows per table. Keep small — this is context injection,
   *  not a data dump. Default: reasonable per-table caps. */
  maxPatterns?: number;
  maxMemories?: number;
  maxSnapshots?: number;
  maxCreativeMemory?: number;
  maxKnowledge?: number;
}

const DEFAULT_CAPS = {
  patterns: 20,
  memories: 15,
  snapshots: 7,
  creativeMemory: 10,
  knowledge: 15,
};

// ────────────────────────────────────────────────────────────────────
// Main API
// ────────────────────────────────────────────────────────────────────

/**
 * Load the full brain context for an AI call.
 *
 * Always resolves. Never throws. On total failure, returns an empty
 * context with `hasAny: false` — the caller should fall back to a
 * generic prompt but still produce output.
 *
 * ```ts
 * const ctx = await loadUserContext({ userId, personaId });
 * const contextBlock = ctx.hasAny ? formatContextBlock(ctx) : "";
 * const prompt = systemPrompt + contextBlock + userPrompt;
 * ```
 */
export async function loadUserContext(opts: LoadContextOptions): Promise<AdbriefBrainContext> {
  const t0 = Date.now();
  const userId = opts.userId;
  const personaId = opts.personaId ?? null;
  const caps = {
    patterns: opts.maxPatterns ?? DEFAULT_CAPS.patterns,
    memories: opts.maxMemories ?? DEFAULT_CAPS.memories,
    snapshots: opts.maxSnapshots ?? DEFAULT_CAPS.snapshots,
    creativeMemory: opts.maxCreativeMemory ?? DEFAULT_CAPS.creativeMemory,
    knowledge: opts.maxKnowledge ?? DEFAULT_CAPS.knowledge,
  };

  const sb: SupabaseClient = opts.supabase
    ?? createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

  // Persona scoping helper: when personaId provided, match it;
  // when null, restrict to global (persona_id IS NULL) rows so we
  // don't accidentally leak another persona's data into a global call.
  const scopePersona = <T extends { eq: (k: string, v: unknown) => T; is: (k: string, v: unknown) => T }>(q: T): T =>
    personaId ? q.eq("persona_id", personaId) : q.is("persona_id", null);

  // Fire all reads in parallel. Each is wrapped in its own try so
  // one failure doesn't cascade.
  const safely = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
    try { return await p; } catch { return fallback; }
  };

  const [profileR, patternsR, memoriesR, snapshotsR, creativeR, knowledgeR] = await Promise.all([
    safely(
      (scopePersona((sb as any).from("user_ai_profile")
        .select("objective,primary_metric,target_value,tone,avoid,winning_style,losing_style,brand_voice,last_updated")
        .eq("user_id", userId)) as any)
        .limit(1)
        .maybeSingle() as Promise<{ data: BrainProfile | null }>,
      { data: null },
    ),
    safely(
      // learned_patterns (prod) has no `label` / `feature_type` columns.
      // Both are carried inside `variables` JSONB by save-learning.ts.
      // We project those fields back on the client side below.
      (scopePersona((sb as any).from("learned_patterns")
        .select("pattern_key,insight_text,avg_ctr,avg_roas,sample_size,confidence,is_winner,variables")
        .eq("user_id", userId)) as any)
        .order("is_winner", { ascending: false })
        .order("confidence", { ascending: false, nullsFirst: false })
        .limit(caps.patterns) as Promise<{ data: BrainPattern[] | null }>,
      { data: [] },
    ),
    safely(
      (scopePersona((sb as any).from("chat_memory")
        .select("memory_text,memory_type,importance")
        .eq("user_id", userId)) as any)
        .order("importance", { ascending: false })
        .limit(caps.memories) as Promise<{ data: BrainMemory[] | null }>,
      { data: [] },
    ),
    safely(
      (scopePersona((sb as any).from("daily_snapshots")
        .select("date,total_spend,avg_ctr,avg_roas,active_ads,winners_count,losers_count,ai_insight")
        .eq("user_id", userId)) as any)
        .order("date", { ascending: false })
        .limit(caps.snapshots) as Promise<{ data: BrainSnapshotLite[] | null }>,
      { data: [] },
    ),
    safely(
      // creative_memory (prod) schema: hook_type, creative_model,
      // platform, market, hook_score, ctr, cpc, roas, analysis_id,
      // notes, created_at. save-learning.ts packs {label, tags,
      // payload} into `notes` as JSON, and stores the feature name
      // in `hook_type`. We decode both below when formatting.
      (scopePersona((sb as any).from("creative_memory")
        .select("hook_type,creative_model,platform,market,hook_score,ctr,roas,notes,created_at")
        .eq("user_id", userId)) as any)
        .order("created_at", { ascending: false })
        .limit(caps.creativeMemory) as Promise<{ data: BrainCreativeMemory[] | null }>,
      { data: [] },
    ),
    safely(
      (scopePersona((sb as any).from("account_knowledge")
        .select("knowledge_type,slug,data,confidence")
        .eq("user_id", userId)) as any)
        .order("confidence", { ascending: false, nullsFirst: false })
        .limit(caps.knowledge) as Promise<{ data: BrainKnowledge[] | null }>,
      { data: [] },
    ),
  ]);

  const profile = (profileR as any)?.data ?? null;
  const patterns = ((patternsR as any)?.data ?? []) as BrainPattern[];
  const memories = ((memoriesR as any)?.data ?? []) as BrainMemory[];
  const recentSnapshots = ((snapshotsR as any)?.data ?? []) as BrainSnapshotLite[];
  const creativeMemory = ((creativeR as any)?.data ?? []) as BrainCreativeMemory[];
  const knowledge = ((knowledgeR as any)?.data ?? []) as BrainKnowledge[];

  const hasAny = !!profile
    || patterns.length > 0
    || memories.length > 0
    || recentSnapshots.length > 0
    || creativeMemory.length > 0
    || knowledge.length > 0;

  return {
    hasAny,
    profile,
    patterns,
    memories,
    recentSnapshots,
    creativeMemory,
    knowledge,
    personaId,
    loadMs: Date.now() - t0,
  };
}

// ────────────────────────────────────────────────────────────────────
// Prompt formatting — the single source of truth for how brain
// context appears in a Claude prompt. Every feature should use this
// so the brain "voice" is consistent across the product.
// ────────────────────────────────────────────────────────────────────

/**
 * Format the brain context as a system-prompt block (pt-BR).
 *
 * Callers append this to their feature-specific instructions, AFTER
 * the generic behavior rules and BEFORE the user's current request.
 *
 * Returns empty string when ctx is empty — the caller should fall
 * through to generic behavior in that case (don't inject an empty
 * "== Contexto vazio ==" block, it just noises up the prompt).
 */
export function formatContextBlock(ctx: AdbriefBrainContext): string {
  if (!ctx.hasAny) return "";

  const parts: string[] = [];
  parts.push("# CONTEXTO APRENDIDO DA CONTA");
  parts.push("Use isso pra guiar a geração. Não repita literal, mas respeite tom, foco e histórico.");
  parts.push("");

  if (ctx.profile) {
    const p = ctx.profile;
    const bits: string[] = [];
    if (p.objective) bits.push(`objetivo: ${p.objective}`);
    if (p.primary_metric) bits.push(`métrica principal: ${p.primary_metric}`);
    if (p.target_value) bits.push(`meta: ${p.target_value}`);
    if (p.tone) bits.push(`tom: ${p.tone}`);
    if (p.brand_voice) bits.push(`voz da marca: ${p.brand_voice}`);
    if (p.winning_style) bits.push(`estilo que funciona: ${p.winning_style}`);
    if (p.losing_style) bits.push(`estilo a evitar: ${p.losing_style}`);
    if (p.avoid && p.avoid.length) bits.push(`não usar: ${p.avoid.join(", ")}`);
    if (bits.length) {
      parts.push("## PERFIL DA CONTA");
      parts.push("- " + bits.join("\n- "));
      parts.push("");
    }
  }

  if (ctx.patterns.length) {
    parts.push(`## PADRÕES APRENDIDOS (top ${Math.min(8, ctx.patterns.length)})`);
    for (const p of ctx.patterns.slice(0, 8)) {
      const tag = p.is_winner ? "✓" : "·";
      const conf = p.confidence != null ? ` (${Math.round((p.confidence || 0) * 100)}%)` : "";
      const metric = p.avg_roas != null ? ` ROAS ${p.avg_roas.toFixed(1)}x`
        : p.avg_ctr != null ? ` CTR ${(p.avg_ctr * 100).toFixed(2)}%`
        : "";
      const insight = p.insight_text ? ` — ${p.insight_text}` : "";
      // label lives in variables.label when save-learning.ts wrote it
      const labelFromVars = (p.variables as any)?.label as string | undefined;
      const displayLabel = p.label || labelFromVars || p.pattern_key;
      parts.push(`${tag} ${displayLabel}${metric}${conf}${insight}`);
    }
    parts.push("");
  }

  if (ctx.creativeMemory.length) {
    parts.push(`## CRIATIVOS DE REFERÊNCIA (últimos ${Math.min(5, ctx.creativeMemory.length)})`);
    for (const c of ctx.creativeMemory.slice(0, 5)) {
      // Decode the JSON blob we pack into `notes` at save time so we can
      // surface label + tags back into the prompt. Older rows that
      // predate save-learning.ts (e.g. analyze-video analysis rows) won't
      // parse — we fall back to showing the raw note as insight.
      let label = "";
      let tags: string[] = [];
      let insightFromNotes = "";
      if (c.notes) {
        try {
          const parsed = JSON.parse(c.notes);
          if (parsed && typeof parsed === "object") {
            label = (parsed.label as string) || "";
            tags = Array.isArray(parsed.tags) ? parsed.tags : [];
          }
        } catch {
          insightFromNotes = c.notes.slice(0, 120);
        }
      }
      const feature = c.hook_type || "criativo";
      const score = c.hook_score != null ? ` — score ${c.hook_score}`
        : c.roas != null ? ` — ROAS ${Number(c.roas).toFixed(1)}x`
        : c.ctr != null ? ` — CTR ${(Number(c.ctr) * 100).toFixed(2)}%`
        : "";
      const tagStr = tags.length ? ` [${tags.slice(0, 4).join(", ")}]` : "";
      const labelStr = label ? ` — ${label}` : (insightFromNotes ? ` — ${insightFromNotes}` : "");
      parts.push(`· ${feature}${score}${tagStr}${labelStr}`);
    }
    parts.push("");
  }

  if (ctx.memories.length) {
    parts.push("## MEMÓRIAS DO USUÁRIO (top 6 por importância)");
    for (const m of ctx.memories.slice(0, 6)) {
      parts.push(`· ${m.memory_text}`);
    }
    parts.push("");
  }

  if (ctx.recentSnapshots.length) {
    const s = ctx.recentSnapshots[0];
    if (s) {
      parts.push("## SNAPSHOT ATUAL");
      const bits: string[] = [];
      if (s.total_spend != null) bits.push(`spend ${(s.total_spend / 100).toFixed(0)}`);
      if (s.avg_ctr != null) bits.push(`CTR ${(s.avg_ctr * 100).toFixed(2)}%`);
      if (s.avg_roas != null) bits.push(`ROAS ${s.avg_roas.toFixed(1)}x`);
      if (s.active_ads != null) bits.push(`${s.active_ads} ads ativos`);
      if (s.winners_count != null && s.losers_count != null)
        bits.push(`${s.winners_count} vencendo · ${s.losers_count} perdendo`);
      parts.push(`- ${bits.join(" · ")}`);
      if (s.ai_insight) parts.push(`- insight do dia: ${s.ai_insight}`);
      parts.push("");
    }
  }

  if (ctx.knowledge.length) {
    parts.push("## FATOS ESTRUTURADOS");
    for (const k of ctx.knowledge.slice(0, 8)) {
      const summary = typeof k.data === "object" && k.data
        ? JSON.stringify(k.data).slice(0, 160)
        : String(k.data).slice(0, 160);
      parts.push(`· [${k.knowledge_type}] ${k.slug}: ${summary}`);
    }
    parts.push("");
  }

  parts.push("# FIM DO CONTEXTO");
  return parts.join("\n");
}
