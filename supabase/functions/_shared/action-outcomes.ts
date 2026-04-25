// Shared logic for the action_outcomes system. Imported by:
//   • meta-actions      — writes the row at action time (snapshot before)
//   • action-outcomes-measure-24h — fast-effect measurement (CTR-class)
//   • action-outcomes-measure-72h — final verdict + improved + recovery
//
// The whole file is pure helpers + decision rules. No side effects except
// the explicit fetch calls to Meta API (which take a token + ids — caller
// is responsible for sourcing those).
//
// Design rules baked in:
//   1. Snapshot uses hierarchical fallback (direct → adsets → ads). Returns
//      null only when EVERYTHING is empty — caller writes a no_data marker.
//   2. Aggregation recomputes ratios from sums (averaging averages lies).
//   3. evaluation_metric is mapped from action_type and stored alongside
//      improved, so the success function can iterate without invalidating
//      history (we always know which rule judged each row).
//   4. improved=null is honest. We use it for: insufficient data, low
//      sample, inconclusive delta. Better than fake true/false.
//   5. Pause uses evaluation_metric="execution" + recovery_pct measured as
//      avoided_spend_pct vs the per-day baseline. Tracks both that the
//      pause executed AND how much waste was prevented.

const BASE = "https://graph.facebook.com/v21.0";

// ── Types ────────────────────────────────────────────────────────────────
export type MetricsSnapshot = {
  conversions: number;
  spend: number;        // R$
  ctr: number;          // decimal (0.0213 = 2.13%)
  cpa: number | null;
  roas: number | null;
  impressions: number;
  clicks: number;
  frequency: number | null;
  cpc: number | null;
  cpm: number | null;
  // Window covered by this snapshot, in days. Crons set this to actual
  // hours / 24 (e.g. 1 for the 24h cron, 3 for the 72h cron); meta-actions
  // sets 7 for the pre-action snapshot. Used to normalize per-day rates
  // when comparing across windows.
  days: number;
  source_level?: "direct" | "aggregated_from_adsets" | "aggregated_from_ads";
};

// JSONB shape stored in action_outcomes.metrics_before / metrics_after_*
export type MetricsJsonb =
  | (Record<string, any> & {
      ctr: number; cpa: number | null; roas: number | null;
      spend: number; conversions: number; impressions: number;
      clicks: number; frequency: number | null;
      cpc: number | null; cpm: number | null;
      source_level: string;
      days: number;
    })
  | { no_data: true; reason: string };

// ── Insights parsing (single-row Meta API response) ──────────────────────
export function parseInsightsRow(row: any): {
  spend: number; impressions: number; clicks: number;
  conversions: number; revenue: number;
  ctr: number; frequency: number | null; cpc: number | null; cpm: number | null;
  roas: number | null;
} {
  const spend = parseFloat(row.spend || "0");
  const impressions = parseInt(row.impressions || "0", 10);
  const clicks = parseInt(row.clicks || "0", 10);
  const ctr = parseFloat(row.ctr || "0") / 100;
  const frequency = row.frequency ? parseFloat(row.frequency) : null;
  const cpc = row.cpc ? parseFloat(row.cpc) : null;
  const cpm = row.cpm ? parseFloat(row.cpm) : null;
  const actions = (row.actions || []) as any[];
  const convTypes = ["purchase", "lead", "complete_registration", "app_install", "submit_application", "subscribe"];
  const conversions = actions
    .filter((a: any) => convTypes.includes(a.action_type))
    .reduce((s, a) => s + parseFloat(a.value || "0"), 0);
  const actionValues = (row.action_values || []) as any[];
  const revenue = actionValues
    .filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase")
    .reduce((s, a) => s + parseFloat(a.value || "0"), 0);
  const roasArr = (row.website_purchase_roas || []) as any[];
  const roas = roasArr[0]?.value ? parseFloat(roasArr[0].value) : null;
  return { spend, impressions, clicks, conversions, revenue, ctr, frequency, cpc, cpm, roas };
}

// ── Single-target insights fetch (one Meta object, one date range) ───────
const INSIGHTS_FIELDS = "spend,clicks,impressions,ctr,cpc,cpm,frequency,actions,action_values,website_purchase_roas";

async function fetchDirect(targetId: string, sinceISO: string, untilISO: string, token: string): Promise<any | null> {
  try {
    const url = `${BASE}/${targetId}/insights?fields=${INSIGHTS_FIELDS}&time_range={"since":"${sinceISO}","until":"${untilISO}"}&access_token=${token}`;
    const r = await fetch(url);
    const d = await r.json();
    return (d.data || [])[0] || null;
  } catch (e) {
    console.warn("[snapshot] direct insights failed", targetId, (e as any)?.message || e);
    return null;
  }
}

// ── Hierarchical aggregation (bottom-up sums, recomputed ratios) ─────────
async function aggregateFromChildren(childIds: string[], sinceISO: string, untilISO: string, token: string, daysWindow: number): Promise<MetricsSnapshot | null> {
  if (childIds.length === 0) return null;
  const rows = await Promise.all(childIds.slice(0, 25).map(id => fetchDirect(id, sinceISO, untilISO, token)));
  const valid = rows.filter(Boolean).map(parseInsightsRow);
  if (valid.length === 0) return null;
  const sum = (k: keyof ReturnType<typeof parseInsightsRow>) =>
    valid.reduce((s, r) => s + (r[k] as number || 0), 0);
  const spend = sum("spend");
  const impressions = sum("impressions");
  const clicks = sum("clicks");
  const conversions = sum("conversions");
  const revenue = sum("revenue");
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const cpc = clicks > 0 ? spend / clicks : null;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : null;
  const cpa = conversions > 0 ? spend / conversions : null;
  const roas = spend > 0 && revenue > 0 ? revenue / spend : null;
  const totalImpr = impressions || 1;
  const weightedFreq = valid.reduce((s, r) => s + ((r.frequency || 0) * (r.impressions || 0)), 0) / totalImpr;
  const frequency = weightedFreq > 0 ? weightedFreq : null;
  return { conversions, spend, ctr, cpa, roas, days: daysWindow, impressions, clicks, frequency, cpc, cpm };
}

// ── PUBLIC: snapshot with hierarchical fallback ──────────────────────────
// Used by meta-actions (window = last 7 days) and by both crons (window =
// since action's taken_at). Returns null only when EVERYTHING fails.
export async function fetchSnapshot(
  targetId: string,
  targetType: string,
  sinceISO: string,
  untilISO: string,
  token: string,
  daysWindow: number,
): Promise<MetricsSnapshot | null> {
  const direct = await fetchDirect(targetId, sinceISO, untilISO, token);
  if (direct) {
    const p = parseInsightsRow(direct);
    return {
      conversions: p.conversions, spend: p.spend, ctr: p.ctr,
      cpa: p.conversions > 0 ? p.spend / p.conversions : null,
      roas: p.roas, days: daysWindow,
      impressions: p.impressions, clicks: p.clicks,
      frequency: p.frequency, cpc: p.cpc, cpm: p.cpm,
      source_level: "direct",
    };
  }
  console.log("[snapshot] direct empty for", { targetId, targetType }, "trying fallback");

  if (targetType === "campaign") {
    try {
      const r = await fetch(`${BASE}/${targetId}/adsets?fields=id&limit=50&access_token=${token}`);
      const d = await r.json();
      const adsetIds: string[] = (d.data || []).map((x: any) => x.id).filter(Boolean);
      const agg = await aggregateFromChildren(adsetIds, sinceISO, untilISO, token, daysWindow);
      if (agg) return { ...agg, source_level: "aggregated_from_adsets" };
      console.log("[snapshot] adset agg empty, drilling to ads");
      const allAds: string[] = [];
      for (const asid of adsetIds.slice(0, 25)) {
        const ar = await fetch(`${BASE}/${asid}/ads?fields=id&limit=50&access_token=${token}`);
        const ad = await ar.json();
        for (const a of (ad.data || [])) if (a.id) allAds.push(a.id);
      }
      const adAgg = await aggregateFromChildren(allAds, sinceISO, untilISO, token, daysWindow);
      if (adAgg) return { ...adAgg, source_level: "aggregated_from_ads" };
    } catch (e) {
      console.warn("[snapshot] campaign fallback failed", (e as any)?.message || e);
    }
  }

  if (targetType === "adset") {
    try {
      const r = await fetch(`${BASE}/${targetId}/ads?fields=id&limit=50&access_token=${token}`);
      const d = await r.json();
      const adIds: string[] = (d.data || []).map((x: any) => x.id).filter(Boolean);
      const agg = await aggregateFromChildren(adIds, sinceISO, untilISO, token, daysWindow);
      if (agg) return { ...agg, source_level: "aggregated_from_ads" };
    } catch (e) {
      console.warn("[snapshot] adset fallback failed", (e as any)?.message || e);
    }
  }

  console.log("[snapshot] all paths empty for", { targetId, targetType });
  return null;
}

// ── PUBLIC: snapshot → jsonb shape stored in DB ──────────────────────────
export function snapshotToJsonb(snapshot: MetricsSnapshot | null): MetricsJsonb {
  if (!snapshot) return { no_data: true, reason: "no_insights_available" };
  return {
    ctr: snapshot.ctr,
    cpa: snapshot.cpa,
    roas: snapshot.roas,
    spend: snapshot.spend,
    conversions: snapshot.conversions,
    impressions: snapshot.impressions,
    clicks: snapshot.clicks,
    frequency: snapshot.frequency,
    cpc: snapshot.cpc,
    cpm: snapshot.cpm,
    source_level: snapshot.source_level || "direct",
    days: snapshot.days,
  };
}

// ── PUBLIC: Meta token lookup (used by cron) ─────────────────────────────
export async function lookupMetaToken(supabase: any, userId: string, personaId: string | null): Promise<string | null> {
  let conn: any = null;
  if (personaId) {
    const { data } = await supabase.from("platform_connections")
      .select("access_token")
      .eq("user_id", userId).eq("platform", "meta").eq("status", "active").eq("persona_id", personaId)
      .maybeSingle();
    conn = data;
  }
  if (!conn?.access_token) {
    const { data } = await supabase.from("platform_connections")
      .select("access_token")
      .eq("user_id", userId).eq("platform", "meta").eq("status", "active")
      .limit(1).maybeSingle();
    conn = data;
  }
  return conn?.access_token || null;
}

// ── Decision logic (the heart of Phase 2b) ───────────────────────────────

// Map action_type → which metric to judge by. Decoupled from the action
// itself so the success function can change without invalidating history
// (every row stores the metric it was judged with).
export function mapEvaluationMetric(actionType: string): string | null {
  if (actionType.startsWith("pause_")) return "execution";  // see avoided_spend logic in computeVerdict
  if (actionType.startsWith("enable_")) return "ctr";
  if (actionType === "budget_increase") return "cpa";
  if (actionType === "budget_decrease") return "cpa";
  if (actionType === "duplicate_ad") return null;            // copy enters paused — defer to v2
  return null;
}

// Sample-size minimums by metric. Below these, we don't trust the data
// enough to call improved true/false — return null instead.
function sampleSufficient(metric: string, snap: MetricsSnapshot | null): boolean {
  if (!snap) return false;
  switch (metric) {
    case "execution":  return true;                              // pause: 0 spend = 0 impressions ok
    case "ctr":        return snap.impressions >= 100;
    case "cpa":        return snap.conversions >= 3;
    case "roas":       return snap.conversions >= 3 && (snap.roas != null);
    default:           return false;
  }
}

// The minimum |delta_pct| required to call "improved" rather than null.
// Keeps the system honest about banded noise. Tunable per metric.
function noiseBandPct(metric: string): number {
  switch (metric) {
    case "execution":  return 10;  // pause must avoid ≥10% of expected spend to count
    case "ctr":        return 5;
    case "cpa":        return 5;
    case "roas":       return 5;
    default:           return 5;
  }
}

// Verdict shape returned by computeOutcomeVerdict.
export type Verdict = {
  evaluation_metric: string | null;
  improved: boolean | null;
  recovery_pct: number | null;
  delta_72h: Record<string, number>;
  context_note: Record<string, any>; // skip_reason / sample_size / source_level / avoided_spend_brl etc.
};

// THE decision tree. Pure function of (action_type, before, after).
// Returns null fields when honest measurement isn't possible — never fakes.
export function computeOutcomeVerdict(
  actionType: string,
  before: MetricsJsonb,
  after: MetricsSnapshot | null,
): Verdict {
  const ctx: Record<string, any> = {};

  // 1. Insufficient data (either side missing).
  if ((before as any).no_data || !after) {
    return {
      evaluation_metric: null,
      improved: null,
      recovery_pct: null,
      delta_72h: {},
      context_note: { skip_reason: "insufficient_data" },
    };
  }
  ctx.source_level_before = (before as any).source_level || "unknown";
  ctx.source_level_after = after.source_level || "direct";

  // 2. Map action_type → eval metric. duplicate_ad is intentionally null in v1.
  const metric = mapEvaluationMetric(actionType);
  if (!metric) {
    return {
      evaluation_metric: null,
      improved: null,
      recovery_pct: null,
      delta_72h: computeDeltaJsonb(before, after),
      context_note: { ...ctx, skip_reason: "no_eval_metric_v1" },
    };
  }

  const delta = computeDeltaJsonb(before, after);

  // 3. Sample sufficiency.
  if (!sampleSufficient(metric, after)) {
    ctx.sample_size = {
      impressions: after.impressions,
      conversions: after.conversions,
    };
    return {
      evaluation_metric: metric,
      improved: null,
      recovery_pct: null,
      delta_72h: delta,
      context_note: { ...ctx, skip_reason: "low_sample" },
    };
  }

  // 4. Per-metric verdict.
  if (metric === "execution") {
    // PAUSE: improved = target effectively stopped spending, AND we measure
    // how much waste was avoided vs the pre-action per-day baseline.
    const beforeDays = Number((before as any).days || 7);
    const beforeSpend = Number((before as any).spend || 0);
    const beforePerDay = beforeDays > 0 ? beforeSpend / beforeDays : 0;
    const expectedSpend72h = beforePerDay * 3;  // 3 days of expected burn at pre-pause rate
    const actualSpend72h = after.spend;
    const avoided = Math.max(0, expectedSpend72h - actualSpend72h);
    const avoidedPct = expectedSpend72h > 0 ? (avoided / expectedSpend72h) * 100 : 0;
    ctx.expected_spend_brl = round2(expectedSpend72h);
    ctx.actual_spend_brl = round2(actualSpend72h);
    ctx.avoided_spend_brl = round2(avoided);
    // "executed cleanly" = actual is under 30% of expected (target really stopped)
    const executed = actualSpend72h < expectedSpend72h * 0.30;
    if (!executed) {
      // Pause didn't take — Meta is still spending. False negative on action.
      return {
        evaluation_metric: metric,
        improved: false,
        recovery_pct: -round2(avoidedPct),
        delta_72h: delta,
        context_note: { ...ctx, note: "target_still_spending" },
      };
    }
    // Executed cleanly. Improved iff avoided ≥ noise band.
    if (avoidedPct < noiseBandPct(metric)) {
      return {
        evaluation_metric: metric,
        improved: null,
        recovery_pct: round2(avoidedPct),
        delta_72h: delta,
        context_note: { ...ctx, skip_reason: "no_meaningful_avoidance" },
      };
    }
    return {
      evaluation_metric: metric,
      improved: true,
      recovery_pct: round2(avoidedPct),
      delta_72h: delta,
      context_note: ctx,
    };
  }

  if (metric === "ctr") {
    // Higher CTR = better.
    const beforeCtr = Number((before as any).ctr || 0);
    const afterCtr = after.ctr;
    if (beforeCtr <= 0) {
      // No before baseline — can't compute relative. Fall back to absolute presence.
      return {
        evaluation_metric: metric,
        improved: afterCtr > 0 ? true : null,
        recovery_pct: null,
        delta_72h: delta,
        context_note: { ...ctx, note: "no_before_baseline" },
      };
    }
    const deltaPct = ((afterCtr - beforeCtr) / beforeCtr) * 100;
    return verdictFromDelta(metric, deltaPct, delta, ctx, "higher_better");
  }

  if (metric === "cpa") {
    // Lower CPA = better. For budget_increase we tolerate ≤10% degradation
    // as long as scale actually happened (volume protection).
    const beforeCpa = Number((before as any).cpa || 0);
    const afterCpa = after.cpa;
    if (beforeCpa <= 0 || afterCpa == null) {
      return {
        evaluation_metric: metric,
        improved: null,
        recovery_pct: null,
        delta_72h: delta,
        context_note: { ...ctx, skip_reason: "no_cpa_baseline" },
      };
    }
    const deltaPct = ((afterCpa - beforeCpa) / beforeCpa) * 100; // positive = CPA went up = bad

    if (actionType === "budget_increase") {
      const beforeSpend = Number((before as any).spend || 0);
      const beforeDays = Number((before as any).days || 7);
      const beforePerDay = beforeDays > 0 ? beforeSpend / beforeDays : 0;
      const afterPerDay = after.spend / Math.max(after.days, 1);
      const scaledOk = afterPerDay > beforePerDay * 1.2;  // actually scaled
      ctx.scaled = scaledOk;
      if (!scaledOk) {
        return {
          evaluation_metric: metric,
          improved: false,
          recovery_pct: round2(-Math.abs(deltaPct)),
          delta_72h: delta,
          context_note: { ...ctx, note: "budget_change_not_realized" },
        };
      }
      // Scale happened. Improved iff CPA didn't degrade > 10%.
      if (deltaPct <= 10) {
        return {
          evaluation_metric: metric,
          improved: true,
          recovery_pct: round2(-deltaPct), // negative deltaPct = CPA dropped = positive recovery
          delta_72h: delta,
          context_note: ctx,
        };
      }
      return {
        evaluation_metric: metric,
        improved: false,
        recovery_pct: round2(-deltaPct),
        delta_72h: delta,
        context_note: { ...ctx, note: "cpa_degraded_beyond_tolerance" },
      };
    }

    // budget_decrease: improved iff CPA dropped or held.
    return verdictFromDelta(metric, deltaPct, delta, ctx, "lower_better");
  }

  if (metric === "roas") {
    // Higher ROAS = better.
    const beforeRoas = Number((before as any).roas || 0);
    const afterRoas = after.roas;
    if (beforeRoas <= 0 || afterRoas == null) {
      return {
        evaluation_metric: metric,
        improved: null,
        recovery_pct: null,
        delta_72h: delta,
        context_note: { ...ctx, skip_reason: "no_roas_baseline" },
      };
    }
    const deltaPct = ((afterRoas - beforeRoas) / beforeRoas) * 100;
    return verdictFromDelta(metric, deltaPct, delta, ctx, "higher_better");
  }

  return {
    evaluation_metric: metric,
    improved: null,
    recovery_pct: null,
    delta_72h: delta,
    context_note: { ...ctx, skip_reason: "unhandled_metric" },
  };
}

// Helper: turn deltaPct into a verdict respecting direction + noise band.
function verdictFromDelta(
  metric: string,
  deltaPct: number,
  delta: Record<string, number>,
  ctx: Record<string, any>,
  direction: "higher_better" | "lower_better",
): Verdict {
  const band = noiseBandPct(metric);
  const abs = Math.abs(deltaPct);
  if (abs < band) {
    return {
      evaluation_metric: metric,
      improved: null,
      recovery_pct: round2(deltaPct),
      delta_72h: delta,
      context_note: { ...ctx, skip_reason: "below_noise_band" },
    };
  }
  const isImprovement = direction === "higher_better" ? deltaPct > 0 : deltaPct < 0;
  // Recovery_pct is signed — positive when good, negative when bad.
  const recovery = direction === "higher_better" ? deltaPct : -deltaPct;
  return {
    evaluation_metric: metric,
    improved: isImprovement,
    recovery_pct: round2(recovery),
    delta_72h: delta,
    context_note: ctx,
  };
}

// ── Delta computation across all comparable fields (always saved) ────────
export function computeDeltaJsonb(before: MetricsJsonb, after: MetricsSnapshot | null): Record<string, number> {
  if ((before as any).no_data || !after) return {};
  const b = before as any;
  const out: Record<string, number> = {};
  // Ratios — direct diff
  if (typeof b.ctr === "number") out.ctr = round4(after.ctr - b.ctr);
  if (typeof b.cpc === "number" && after.cpc != null) out.cpc = round4(after.cpc - b.cpc);
  if (typeof b.cpm === "number" && after.cpm != null) out.cpm = round4(after.cpm - b.cpm);
  if (typeof b.cpa === "number" && b.cpa != null && after.cpa != null) out.cpa = round4(after.cpa - b.cpa);
  if (typeof b.roas === "number" && b.roas != null && after.roas != null) out.roas = round4(after.roas - b.roas);
  if (typeof b.frequency === "number" && b.frequency != null && after.frequency != null) {
    out.frequency = round4(after.frequency - b.frequency);
  }
  // Volumes — normalize per-day before diff (windows differ)
  const bDays = Number(b.days || 7);
  const aDays = Math.max(after.days, 1);
  if (typeof b.spend === "number") out.spend_per_day = round4((after.spend / aDays) - (b.spend / bDays));
  if (typeof b.conversions === "number") out.conversions_per_day = round4((after.conversions / aDays) - (b.conversions / bDays));
  return out;
}

// ── Numeric helpers ──────────────────────────────────────────────────────
function round2(n: number): number { return Math.round(n * 100) / 100; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }
