/**
 * autopilot-guards.ts — HARD SAFETY FLOOR for autopilot execution.
 *
 * Philosophy (from founder): an autopilot that errs 1 in 20 is worse than no
 * autopilot at all, because the first time it breaks trust the user turns it
 * off forever. So this file is a *non-configurable* floor: even if user
 * settings say "be aggressive", these guards STILL run and STILL block
 * uncertain actions.
 *
 * The 5 guards (every autopilot action must pass ALL 5):
 *
 *   1. LEARNING_PHASE_LOCK
 *      • Never touch an ad/adset/campaign whose Meta effective_status is
 *        LEARNING or LEARNING_LIMITED. Pausing or scaling during learning
 *        wastes the learning budget Meta already spent. Wait for exit.
 *
 *   2. SAMPLE_SIZE_FLOOR
 *      • The target must have at least 7 days of activity AND ≥1000
 *        impressions AND ≥R$50 spend before autopilot will act.
 *      • Small samples lie. A 200-impression CTR is noise.
 *
 *   3. MANUAL_ACTION_COOLDOWN
 *      • If the user took ANY manual action on this target in the last 24h,
 *        autopilot stays hands-off. The user is actively managing it.
 *
 *   4. SCALE_SANITY
 *      • Only applies to "increase_budget" actions.
 *      • Require 3 consecutive days with ROAS > 1.0. No scaling a one-day
 *        flash — that's how you 10x a fluke.
 *
 *   5. LIVE_REVALIDATION
 *      • Before acting, re-hit the Meta Insights API for the target over the
 *        last 24h and confirm the problem (or opportunity) STILL exists.
 *      • Decisions can age. A decision fired 2h ago on a 3h-old data window
 *        might already be stale.
 *
 * Calling convention:
 *   const guard = await checkAutopilotGuards({ sb, settings, decision, target, metaToken });
 *   if (!guard.pass) return { status: 'skipped', reason: `guard:${guard.failed}`, detail: guard.detail };
 *
 * Each guard is exported individually too, for unit-testability and so that
 * other contexts (pre-execution dry-run, settings UI, simulation mode) can
 * call them without the orchestrator.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const META_API_VERSION = "v21.0";

export interface GuardTarget {
  kind: "ad" | "adset" | "campaign";
  meta_id: string;
  /** Internal DB id if we have one (for cooldown lookup in action_log) */
  db_ad_id?: string | null;
  db_adset_id?: string | null;
  db_campaign_id?: string | null;
  account_id: string;
  user_id: string;
}

export interface GuardInput {
  sb: SupabaseClient;
  decision: {
    id: string;
    ad_id: string | null;
    account_id: string;
    impact_type?: string | null;
    // meta_api_action from picked action, e.g. "pause_ad" | "increase_budget"
    meta_api_action: string;
  };
  target: GuardTarget;
  metaToken: string;
}

export interface GuardResult {
  pass: boolean;
  /** Which specific guard failed (undefined if pass === true) */
  failed?:
    | "LEARNING_PHASE_LOCK"
    | "SAMPLE_SIZE_FLOOR"
    | "MANUAL_ACTION_COOLDOWN"
    | "SCALE_SANITY"
    | "LIVE_REVALIDATION";
  detail?: string;
  /** Enriched data the caller may want to log */
  effective_status?: string;
  days_active?: number;
  impressions?: number;
  spend_cents?: number;
  current_roas?: number | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers

async function fetchMetaInsights(
  targetMetaId: string,
  token: string,
  sinceDaysAgo: number,
  level: "ad" | "adset" | "campaign" = "ad"
): Promise<Array<Record<string, unknown>>> {
  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - sinceDaysAgo * 86400_000).toISOString().slice(0, 10);
  const fields = "spend,impressions,ctr,frequency,actions,action_values,website_purchase_roas,date_start,date_stop";
  const url =
    `https://graph.facebook.com/${META_API_VERSION}/${targetMetaId}/insights` +
    `?level=${level}` +
    `&fields=${fields}` +
    `&time_range={"since":"${since}","until":"${until}"}` +
    `&time_increment=1` +
    `&access_token=${token}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) return [];
    return (data?.data as Array<Record<string, unknown>>) || [];
  } catch {
    return [];
  }
}

async function fetchMetaStatus(
  targetMetaId: string,
  token: string
): Promise<{ effective_status?: string; created_time?: string; status?: string } | null> {
  const url =
    `https://graph.facebook.com/${META_API_VERSION}/${targetMetaId}` +
    `?fields=effective_status,status,created_time,name` +
    `&access_token=${token}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) return null;
    return data;
  } catch {
    return null;
  }
}

function getRoasFromInsightRow(row: Record<string, unknown>): number | null {
  const purchaseRoas = row.website_purchase_roas as Array<{ value?: string }> | undefined;
  if (purchaseRoas?.[0]?.value) return parseFloat(purchaseRoas[0].value!);
  const actionValues = row.action_values as Array<{ action_type?: string; value?: string }> | undefined;
  const spend = parseFloat((row.spend as string) || "0");
  const pv = actionValues?.find((a) => a.action_type === "purchase");
  if (pv?.value && spend > 0) return parseFloat(pv.value) / spend;
  return null;
}

function getConversionsFromInsightRow(row: Record<string, unknown>): number {
  const actions = row.actions as Array<{ action_type?: string; value?: string }> | undefined;
  const c = actions?.find((a) =>
    ["purchase", "lead", "complete_registration", "app_install"].includes(a.action_type || "")
  );
  return c?.value ? parseFloat(c.value) : 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Guard 1: LEARNING_PHASE_LOCK

export async function guardLearningPhase(input: GuardInput): Promise<GuardResult> {
  const status = await fetchMetaStatus(input.target.meta_id, input.metaToken);
  if (!status) {
    return {
      pass: false,
      failed: "LEARNING_PHASE_LOCK",
      detail: "could_not_fetch_meta_status",
    };
  }
  const eff = (status.effective_status || "").toUpperCase();
  if (eff === "LEARNING" || eff === "LEARNING_LIMITED") {
    return {
      pass: false,
      failed: "LEARNING_PHASE_LOCK",
      detail: `effective_status=${eff}`,
      effective_status: eff,
    };
  }
  // Also short-circuit if already paused, archived, deleted, etc.
  if (["PAUSED", "ARCHIVED", "DELETED", "DISAPPROVED", "PENDING_REVIEW", "IN_PROCESS"].includes(eff)) {
    return {
      pass: false,
      failed: "LEARNING_PHASE_LOCK",
      detail: `effective_status=${eff}_not_actionable`,
      effective_status: eff,
    };
  }
  return { pass: true, effective_status: eff };
}

// ────────────────────────────────────────────────────────────────────────────
// Guard 2: SAMPLE_SIZE_FLOOR

const MIN_DAYS_ACTIVE = 7;
const MIN_IMPRESSIONS = 1000;
const MIN_SPEND_BRL = 50; // R$50
const MIN_SPEND_CENTS = MIN_SPEND_BRL * 100;

export async function guardSampleSize(input: GuardInput): Promise<GuardResult> {
  const level = input.target.kind;
  const rows = await fetchMetaInsights(input.target.meta_id, input.metaToken, 30, level);
  if (rows.length === 0) {
    return {
      pass: false,
      failed: "SAMPLE_SIZE_FLOOR",
      detail: "no_insights_data",
      days_active: 0,
      impressions: 0,
      spend_cents: 0,
    };
  }

  // Count days that actually had spend
  const daysActive = rows.filter((r) => parseFloat((r.spend as string) || "0") > 0).length;
  const totalImpressions = rows.reduce(
    (sum, r) => sum + parseInt((r.impressions as string) || "0", 10),
    0
  );
  const totalSpendBrl = rows.reduce(
    (sum, r) => sum + parseFloat((r.spend as string) || "0"),
    0
  );
  const totalSpendCents = Math.round(totalSpendBrl * 100);

  if (daysActive < MIN_DAYS_ACTIVE) {
    return {
      pass: false,
      failed: "SAMPLE_SIZE_FLOOR",
      detail: `days_active=${daysActive}<${MIN_DAYS_ACTIVE}`,
      days_active: daysActive,
      impressions: totalImpressions,
      spend_cents: totalSpendCents,
    };
  }
  if (totalImpressions < MIN_IMPRESSIONS) {
    return {
      pass: false,
      failed: "SAMPLE_SIZE_FLOOR",
      detail: `impressions=${totalImpressions}<${MIN_IMPRESSIONS}`,
      days_active: daysActive,
      impressions: totalImpressions,
      spend_cents: totalSpendCents,
    };
  }
  if (totalSpendCents < MIN_SPEND_CENTS) {
    return {
      pass: false,
      failed: "SAMPLE_SIZE_FLOOR",
      detail: `spend_brl=${(totalSpendCents / 100).toFixed(2)}<${MIN_SPEND_BRL}`,
      days_active: daysActive,
      impressions: totalImpressions,
      spend_cents: totalSpendCents,
    };
  }

  return {
    pass: true,
    days_active: daysActive,
    impressions: totalImpressions,
    spend_cents: totalSpendCents,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Guard 3: MANUAL_ACTION_COOLDOWN

const MANUAL_COOLDOWN_HOURS = 24;

export async function guardManualCooldown(input: GuardInput): Promise<GuardResult> {
  const cutoff = new Date(Date.now() - MANUAL_COOLDOWN_HOURS * 3600_000).toISOString();

  // action_log has `target_meta_id` — check if the user manually touched
  // this target in the last 24h. Any action_log row NOT tied to an
  // autopilot decision_id counts as "manual" for cooldown purposes.
  const { data: recent } = await input.sb
    .from("action_log")
    .select("id, created_at, decision_id, source")
    .eq("user_id", input.target.user_id)
    .eq("target_meta_id", input.target.meta_id)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!recent || recent.length === 0) return { pass: true };

  // Any row where source is 'manual' or 'user' → cooldown
  // (be liberal: if we can't tell, treat as manual)
  const isAutopilotLabel = (r: { source?: string | null; decision_id?: string | null }) =>
    r.source === "autopilot" || r.source === "autopilot_executor";

  const manualRow = (recent as Array<{ created_at: string; decision_id?: string | null; source?: string | null }>)
    .find((r) => !isAutopilotLabel(r));

  if (manualRow) {
    const hoursAgo = ((Date.now() - new Date(manualRow.created_at).getTime()) / 3600_000).toFixed(1);
    return {
      pass: false,
      failed: "MANUAL_ACTION_COOLDOWN",
      detail: `manual_action_${hoursAgo}h_ago`,
    };
  }

  return { pass: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Guard 4: SCALE_SANITY

const SCALE_MIN_CONSECUTIVE_DAYS = 3;
const SCALE_MIN_ROAS = 1.0;

export async function guardScaleSanity(input: GuardInput): Promise<GuardResult> {
  // Only applies to increase_budget. For other actions, pass.
  if (input.decision.meta_api_action !== "increase_budget") {
    return { pass: true };
  }

  // Pull last 5 days at daily granularity, take last 3, check all > ROAS floor.
  // We pull at the adset level because that's where budgets live on CBO-off accounts.
  const level = input.target.kind === "campaign" ? "campaign" : "adset";
  const rows = await fetchMetaInsights(input.target.meta_id, input.metaToken, 5, level);

  if (rows.length < SCALE_MIN_CONSECUTIVE_DAYS) {
    return {
      pass: false,
      failed: "SCALE_SANITY",
      detail: `only_${rows.length}_days_of_data`,
    };
  }

  // Sort by date ascending, take last N
  const sorted = [...rows].sort((a, b) => {
    const da = (a.date_start as string) || "";
    const db = (b.date_start as string) || "";
    return da.localeCompare(db);
  });
  const lastN = sorted.slice(-SCALE_MIN_CONSECUTIVE_DAYS);

  for (const row of lastN) {
    const roas = getRoasFromInsightRow(row);
    const conv = getConversionsFromInsightRow(row);
    const spend = parseFloat((row.spend as string) || "0");

    // If no conversions + meaningful spend → fails
    if (spend > 20 && conv === 0) {
      return {
        pass: false,
        failed: "SCALE_SANITY",
        detail: `day_${row.date_start}_zero_conversions_spend=${spend.toFixed(2)}`,
      };
    }

    if (roas === null) {
      return {
        pass: false,
        failed: "SCALE_SANITY",
        detail: `day_${row.date_start}_no_roas_data`,
      };
    }

    if (roas < SCALE_MIN_ROAS) {
      return {
        pass: false,
        failed: "SCALE_SANITY",
        detail: `day_${row.date_start}_roas=${roas.toFixed(2)}<${SCALE_MIN_ROAS}`,
        current_roas: roas,
      };
    }
  }

  // All last N days cleared the ROAS floor
  const latestRoas = getRoasFromInsightRow(lastN[lastN.length - 1]);
  return { pass: true, current_roas: latestRoas };
}

// ────────────────────────────────────────────────────────────────────────────
// Guard 5: LIVE_REVALIDATION

export async function guardLiveRevalidation(input: GuardInput): Promise<GuardResult> {
  const action = input.decision.meta_api_action;
  const level = input.target.kind;
  const rows = await fetchMetaInsights(input.target.meta_id, input.metaToken, 2, level);

  if (rows.length === 0) {
    return {
      pass: false,
      failed: "LIVE_REVALIDATION",
      detail: "no_recent_insights",
    };
  }

  // Aggregate the last 2 days into one row for revalidation
  const totals = rows.reduce<{ spend: number; impressions: number; frequency: number; conversions: number }>(
    (acc, r) => {
      acc.spend += parseFloat((r.spend as string) || "0");
      acc.impressions += parseInt((r.impressions as string) || "0", 10);
      acc.frequency = Math.max(acc.frequency, parseFloat((r.frequency as string) || "0"));
      acc.conversions += getConversionsFromInsightRow(r);
      return acc;
    },
    { spend: 0, impressions: 0, frequency: 0, conversions: 0 }
  );
  const latest = rows[rows.length - 1];
  const roas = getRoasFromInsightRow(latest);

  // Action-specific revalidation rules — the problem we fired on must still exist
  if (action.startsWith("pause_")) {
    // We're about to pause. Confirm the ad still looks bad.
    const freq = totals.frequency;
    const stillFatigued = freq >= 3.5;
    const stillBleedingSpend = totals.spend >= 60 && totals.conversions === 0;
    const stillBadRoas = roas !== null && roas < 0.8 && totals.spend > 40;

    if (!(stillFatigued || stillBleedingSpend || stillBadRoas)) {
      return {
        pass: false,
        failed: "LIVE_REVALIDATION",
        detail: `problem_no_longer_present freq=${freq.toFixed(2)} spend=${totals.spend.toFixed(0)} conv=${totals.conversions} roas=${roas?.toFixed(2) ?? "na"}`,
        current_roas: roas,
      };
    }
    return { pass: true, current_roas: roas };
  }

  if (action === "increase_budget") {
    // We're about to scale. Confirm the opportunity still looks real.
    const stillGoodRoas = roas !== null && roas >= 1.8;
    const stillProfitable = totals.conversions > 0 && roas !== null && roas >= 1.5;

    if (!(stillGoodRoas || stillProfitable)) {
      return {
        pass: false,
        failed: "LIVE_REVALIDATION",
        detail: `opportunity_faded roas=${roas?.toFixed(2) ?? "na"} conv=${totals.conversions}`,
        current_roas: roas,
      };
    }
    return { pass: true, current_roas: roas };
  }

  if (action === "decrease_budget") {
    const stillUnderperforming = roas !== null && roas < 1.2;
    if (!stillUnderperforming) {
      return {
        pass: false,
        failed: "LIVE_REVALIDATION",
        detail: `no_longer_underperforming roas=${roas?.toFixed(2) ?? "na"}`,
        current_roas: roas,
      };
    }
    return { pass: true, current_roas: roas };
  }

  // Unknown action → default deny
  return {
    pass: false,
    failed: "LIVE_REVALIDATION",
    detail: `action_${action}_has_no_revalidation_rule`,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Orchestrator — run all 5 guards in fail-fast order (cheapest first)

export async function checkAutopilotGuards(input: GuardInput): Promise<GuardResult> {
  // 1. Manual cooldown (DB-only, cheapest)
  const cooldown = await guardManualCooldown(input);
  if (!cooldown.pass) return cooldown;

  // 2. Learning phase (one Meta call)
  const learning = await guardLearningPhase(input);
  if (!learning.pass) return learning;

  // 3. Sample size (one Meta insights call, 30 days)
  const sample = await guardSampleSize(input);
  if (!sample.pass) return sample;

  // 4. Scale sanity (one Meta insights call, only if applicable)
  const scale = await guardScaleSanity(input);
  if (!scale.pass) return scale;

  // 5. Live revalidation (one Meta insights call, 2 days)
  const revalidation = await guardLiveRevalidation(input);
  if (!revalidation.pass) return revalidation;

  // All passed — merge enriched data
  return {
    pass: true,
    effective_status: learning.effective_status,
    days_active: sample.days_active,
    impressions: sample.impressions,
    spend_cents: sample.spend_cents,
    current_roas: revalidation.current_roas ?? scale.current_roas,
  };
}
