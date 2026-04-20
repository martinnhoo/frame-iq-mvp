/**
 * autopilot-executor — Cron endpoint that executes HIGH-CONFIDENCE decisions
 * automatically, on behalf of users who have explicitly opted in.
 *
 * Guardrails (all configurable per-user via `autopilot_settings`):
 *   • enabled = true AND accepted_terms_at IS NOT NULL
 *   • paused_until IS NULL OR paused_until < now()
 *   • decision.score >= min_confidence * 100
 *   • decision.impact_confidence = 'high'
 *   • abs(decision.impact_daily) >= min_amount_at_risk_brl * 100 (centavos)
 *   • decision action type ∈ allowed_action_types
 *   • user has not exceeded daily_action_cap today
 *   • idempotency: one autopilot_action_log row per (user_id, decision_id)
 *
 * Authorization:
 *   • Service role bearer token (pg_cron / internal invocations) — isCronAuthorized()
 *   • X-Cron-Secret header (external schedulers like GitHub Actions or uptime monitors)
 *
 * Schedule (recommended): pg_cron every 5 minutes
 *   SELECT cron.schedule('autopilot-tick', '*/5 * * * *',
 *     $$SELECT net.http_post(
 *       'https://<proj>.supabase.co/functions/v1/autopilot-executor',
 *       '{}'::jsonb,
 *       '{}'::jsonb,
 *       ARRAY[net.http_header('Authorization', 'Bearer ' || current_setting('app.service_role_key'))]
 *     );$$);
 *
 * Returns: { ok, processed, executed, skipped, errors, results[] }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";
import { checkAutopilotGuards, type GuardTarget } from "../_shared/autopilot-guards.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const META_API_VERSION = "v21.0";
const UNDO_WINDOW_HOURS = 24;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// ── Types ────────────────────────────────────────────────────────────────────
interface AutopilotSettings {
  user_id: string;
  enabled: boolean;
  accepted_terms_at: string | null;
  min_confidence: number;
  min_amount_at_risk_brl: number;
  daily_action_cap: number;
  allowed_action_types: string[];
  notify_telegram: boolean;
  notify_email: boolean;
  paused_until: string | null;
  undo_window_hours: number;
}

interface DecisionRow {
  id: string;
  account_id: string;
  ad_id: string | null;
  type: string;
  score: number;
  headline: string;
  reason: string;
  impact_type: string | null;
  impact_daily: number | null;
  impact_confidence: string | null;
  actions: Array<{
    id?: string;
    label?: string;
    type?: string;
    meta_api_action?: string;
    params?: Record<string, unknown>;
  }>;
  status: string;
}

interface ExecResult {
  user_id: string;
  decision_id?: string;
  action_type?: string;
  status: "executed" | "skipped" | "error";
  reason?: string;
  amount_at_risk_brl?: number;
}

// ── Meta API ─────────────────────────────────────────────────────────────────
async function callMetaApi(
  targetId: string,
  token: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${targetId}`;
  const form = new URLSearchParams();
  form.append("access_token", token);
  for (const [k, v] of Object.entries(payload)) {
    if (v !== null && v !== undefined) form.append(k, String(v));
  }
  try {
    const res = await fetch(url, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error?.message || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

async function snapshotTarget(
  targetId: string,
  targetKind: "ad" | "adset" | "campaign",
  token: string
): Promise<Record<string, unknown>> {
  const fields = targetKind === "ad" ? "status,name" : "status,daily_budget,name";
  const url = `https://graph.facebook.com/${META_API_VERSION}/${targetId}?fields=${fields}&access_token=${token}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) return { id: targetId, target_kind: targetKind, error: data?.error?.message };
    return {
      id: targetId,
      target_kind: targetKind,
      status: data.status,
      daily_budget: data.daily_budget,
      name: data.name,
      snapshot_at: new Date().toISOString(),
    };
  } catch {
    return { id: targetId, target_kind: targetKind };
  }
}

// ── Pick the primary action from a decision that the user has allowed ────────
// Decision.actions JSON structure: [{ id, label, type, meta_api_action, params }]
// User allowed_action_types: ['pause', 'scale_budget', 'reject']
function mapAllowed(metaApiAction: string): string | null {
  if (metaApiAction.startsWith("pause_")) return "pause";
  if (metaApiAction === "increase_budget") return "scale_budget";
  if (metaApiAction === "decrease_budget") return "scale_budget";
  return null;
}

function pickAction(
  decision: DecisionRow,
  allowed: string[]
): { meta_api_action: string; params: Record<string, unknown> } | null {
  if (!Array.isArray(decision.actions) || decision.actions.length === 0) return null;
  for (const a of decision.actions) {
    const mapi = a?.meta_api_action;
    if (!mapi) continue;
    const mapped = mapAllowed(mapi);
    if (mapped && allowed.includes(mapped)) {
      return { meta_api_action: mapi, params: a.params || {} };
    }
  }
  return null;
}

// ── Execute one decision for one user ────────────────────────────────────────
async function executeOne(
  sb: SupabaseClient,
  settings: AutopilotSettings,
  decision: DecisionRow
): Promise<ExecResult> {
  const userId = settings.user_id;
  const picked = pickAction(decision, settings.allowed_action_types);
  if (!picked) {
    return {
      user_id: userId,
      decision_id: decision.id,
      status: "skipped",
      reason: "no_allowed_action_in_decision",
    };
  }

  // Idempotency: skip if this decision already has an autopilot log
  const { data: existingLog } = await sb
    .from("autopilot_action_log")
    .select("id")
    .eq("user_id", userId)
    .eq("decision_id", decision.id)
    .maybeSingle();

  if (existingLog) {
    return {
      user_id: userId,
      decision_id: decision.id,
      status: "skipped",
      reason: "already_logged",
    };
  }

  // Resolve target kind from action name (pause_ad / pause_adset / pause_campaign)
  let targetKind: "ad" | "adset" | "campaign" = "ad";
  if (picked.meta_api_action.endsWith("_adset")) targetKind = "adset";
  else if (picked.meta_api_action.endsWith("_campaign")) targetKind = "campaign";
  else if (picked.meta_api_action.startsWith("increase_") || picked.meta_api_action.startsWith("decrease_")) {
    targetKind = "adset"; // budget lives on adset or campaign; we default adset
  }

  // Resolve Meta ID from ads table
  let targetMetaId: string | null = null;
  let targetName: string | null = null;
  if (decision.ad_id) {
    const { data: adRow } = await sb
      .from("ads")
      .select("meta_ad_id, name, ad_set_id")
      .eq("id", decision.ad_id)
      .maybeSingle();

    if (targetKind === "ad" && adRow?.meta_ad_id) {
      targetMetaId = adRow.meta_ad_id;
      targetName = adRow.name;
    } else if (targetKind === "adset" && adRow?.ad_set_id) {
      const { data: adsetRow } = await sb
        .from("ad_sets")
        .select("meta_adset_id, name")
        .eq("id", adRow.ad_set_id)
        .maybeSingle();
      targetMetaId = adsetRow?.meta_adset_id || null;
      targetName = adsetRow?.name || null;
    } else if (targetKind === "campaign") {
      const { data: adsetRow } = await sb
        .from("ad_sets")
        .select("campaign_id")
        .eq("id", adRow?.ad_set_id || "")
        .maybeSingle();
      if (adsetRow?.campaign_id) {
        const { data: campaignRow } = await sb
          .from("campaigns")
          .select("meta_campaign_id, name")
          .eq("id", adsetRow.campaign_id)
          .maybeSingle();
        targetMetaId = campaignRow?.meta_campaign_id || null;
        targetName = campaignRow?.name || null;
      }
    }
  }

  if (!targetMetaId) {
    return {
      user_id: userId,
      decision_id: decision.id,
      status: "skipped",
      reason: "no_meta_target_resolvable",
    };
  }

  // Fetch Meta access token from ad_accounts
  const { data: account } = await sb
    .from("ad_accounts")
    .select("meta_access_token, currency")
    .eq("id", decision.account_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!account?.meta_access_token) {
    return {
      user_id: userId,
      decision_id: decision.id,
      status: "skipped",
      reason: "no_meta_token",
    };
  }

  const token = account.meta_access_token as string;

  // Snapshot previous state (needed for undo)
  const previousState = await snapshotTarget(targetMetaId, targetKind, token);

  // Build payload for Meta API
  let payload: Record<string, unknown> = {};
  if (picked.meta_api_action.startsWith("pause_")) {
    payload = { status: "PAUSED" };
  } else if (picked.meta_api_action.startsWith("reactivate_")) {
    payload = { status: "ACTIVE" };
  } else if (picked.meta_api_action === "increase_budget" || picked.meta_api_action === "decrease_budget") {
    const currentBudget = Number(previousState.daily_budget) || 0;
    if (currentBudget <= 0) {
      return {
        user_id: userId,
        decision_id: decision.id,
        status: "skipped",
        reason: "no_current_budget",
      };
    }
    const mult = picked.meta_api_action === "increase_budget" ? 1.3 : 0.7; // conservative
    const paramMult = Number(picked.params?.multiplier);
    const effectiveMult = isFinite(paramMult) && paramMult > 0 ? paramMult : mult;
    const newBudget = Math.max(100, Math.round(currentBudget * effectiveMult));
    payload = { daily_budget: newBudget };
  } else {
    return {
      user_id: userId,
      decision_id: decision.id,
      status: "skipped",
      reason: `unsupported_action:${picked.meta_api_action}`,
    };
  }

  const impactCents = Math.abs(Number(decision.impact_daily) || 0);
  const amountAtRiskBrl = impactCents / 100;
  const confidence = Math.min(1, Math.max(0, Number(decision.score) / 100));

  // ── HARD SAFETY FLOOR ──────────────────────────────────────────────────────
  // Runs beneath user settings — even if user says "be aggressive", these 5
  // guards STILL gate the action. See _shared/autopilot-guards.ts.
  const guardTarget: GuardTarget = {
    kind: targetKind,
    meta_id: targetMetaId,
    db_ad_id: decision.ad_id ?? null,
    account_id: decision.account_id,
    user_id: userId,
  };
  const guard = await checkAutopilotGuards({
    sb,
    decision: {
      id: decision.id,
      ad_id: decision.ad_id,
      account_id: decision.account_id,
      impact_type: decision.impact_type,
      meta_api_action: picked.meta_api_action,
    },
    target: guardTarget,
    metaToken: token,
  });

  if (!guard.pass) {
    // Record the skip in autopilot_action_log so the audit log explains
    // exactly why autopilot held off. No Meta call, no decision status change.
    try {
      await sb.from("autopilot_action_log").insert({
        user_id: userId,
        decision_id: decision.id,
        action_type: picked.meta_api_action,
        target_kind: targetKind,
        target_id: targetMetaId,
        target_name: targetName || decision.headline,
        reason: `[guard:${guard.failed}] ${guard.detail || ""} — decision: ${decision.reason || decision.headline}`,
        confidence,
        amount_at_risk_brl: amountAtRiskBrl,
        payload: {
          guard_failed: guard.failed,
          guard_detail: guard.detail,
          effective_status: guard.effective_status,
          days_active: guard.days_active,
          impressions: guard.impressions,
          spend_cents: guard.spend_cents,
          current_roas: guard.current_roas,
          decision_actions: decision.actions,
        },
        status: "skipped",
      });
    } catch {
      // non-fatal — the skip decision itself is what matters
    }
    return {
      user_id: userId,
      decision_id: decision.id,
      action_type: picked.meta_api_action,
      status: "skipped",
      reason: `guard:${guard.failed}:${guard.detail || ""}`,
    };
  }

  // ── LOG-FIRST: create row BEFORE Meta call so we never lose audit trail ────
  const expiresUndo = new Date(Date.now() + (settings.undo_window_hours || UNDO_WINDOW_HOURS) * 3600_000).toISOString();
  const { data: logRow, error: logErr } = await sb
    .from("autopilot_action_log")
    .insert({
      user_id: userId,
      decision_id: decision.id,
      action_type: picked.meta_api_action,
      target_kind: targetKind,
      target_id: targetMetaId,
      target_name: targetName || decision.headline,
      reason: decision.reason || decision.headline,
      confidence,
      amount_at_risk_brl: amountAtRiskBrl,
      payload: {
        request: payload,
        decision_actions: decision.actions,
        previous_state: previousState,
        guards_passed: {
          effective_status: guard.effective_status,
          days_active: guard.days_active,
          impressions: guard.impressions,
          spend_cents: guard.spend_cents,
          current_roas: guard.current_roas,
        },
      },
      status: "pending",
      expires_undo_at: expiresUndo,
    })
    .select()
    .single();

  if (logErr || !logRow) {
    return {
      user_id: userId,
      decision_id: decision.id,
      status: "error",
      reason: `log_insert_failed:${logErr?.message}`,
    };
  }

  // Execute against Meta
  const meta = await callMetaApi(targetMetaId, token, payload);
  if (!meta.ok) {
    await sb.from("autopilot_action_log").update({ status: "error", reason: `${decision.reason || decision.headline} — meta_error: ${meta.error}` }).eq("id", logRow.id);
    return {
      user_id: userId,
      decision_id: decision.id,
      action_type: picked.meta_api_action,
      status: "error",
      reason: `meta:${meta.error}`,
    };
  }

  // Mark log as executed
  await sb.from("autopilot_action_log").update({ status: "executed", executed_at: new Date().toISOString() }).eq("id", logRow.id);

  // Mark decision as acted
  await sb.from("decisions").update({ status: "acted", acted_at: new Date().toISOString() }).eq("id", decision.id);

  // Also write to action_log for consistency with manual actions
  try {
    await sb.from("action_log").insert({
      user_id: userId,
      account_id: decision.account_id,
      decision_id: decision.id,
      action_type: picked.meta_api_action,
      target_type: targetKind,
      target_meta_id: targetMetaId,
      target_name: targetName,
      previous_state: previousState,
      new_state: { ...previousState, ...payload, autopilot: true },
      estimated_daily_impact: Math.abs(Number(decision.impact_daily) || 0),
      result: "success",
      rollback_available: true,
      rollback_expires_at: expiresUndo,
    });
  } catch {
    // non-fatal; autopilot_action_log is the source of truth for autopilot ops
  }

  // Increment money_tracker (savings / revenue captured)
  try {
    const isRevenue = ["increase_budget", "reactivate_ad", "reactivate_adset", "reactivate_campaign"].includes(picked.meta_api_action);
    const field = isRevenue ? "total_revenue_captured" : "total_saved";
    await sb.rpc("increment_money_tracker", {
      p_account_id: decision.account_id,
      p_field: field,
      p_amount: Math.abs(Number(decision.impact_daily) || 0),
    });
  } catch {
    // non-fatal
  }

  // Telegram notification (fire-and-forget)
  if (settings.notify_telegram) {
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-telegram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          user_id: userId,
          message:
            `🤖 <b>Autopilot agiu</b>\n\n` +
            `<b>Ação:</b> ${picked.meta_api_action.replace(/_/g, " ")}\n` +
            `<b>Alvo:</b> ${targetName || targetMetaId}\n` +
            `<b>Razão:</b> ${decision.reason || decision.headline}\n` +
            `<b>Impacto estimado:</b> R$${amountAtRiskBrl.toFixed(2)}/dia\n` +
            `<b>Confiança:</b> ${Math.round(confidence * 100)}%\n\n` +
            `Você pode desfazer em até ${settings.undo_window_hours}h no painel.`,
        }),
      });
    } catch {
      // non-fatal
    }
  }

  return {
    user_id: userId,
    decision_id: decision.id,
    action_type: picked.meta_api_action,
    status: "executed",
    amount_at_risk_brl: amountAtRiskBrl,
  };
}

// ── Process one user ─────────────────────────────────────────────────────────
async function processUser(sb: SupabaseClient, settings: AutopilotSettings): Promise<ExecResult[]> {
  const out: ExecResult[] = [];

  // Count today's executed actions
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: todayCount } = await sb
    .from("autopilot_action_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", settings.user_id)
    .eq("status", "executed")
    .gte("executed_at", todayStart.toISOString());

  const remaining = Math.max(0, (settings.daily_action_cap || 5) - (todayCount || 0));
  if (remaining === 0) {
    return [{ user_id: settings.user_id, status: "skipped", reason: "daily_cap_reached" }];
  }

  // Fetch candidate decisions for this user
  // Join via account_id → ad_accounts → user_id
  const { data: accounts } = await sb
    .from("ad_accounts")
    .select("id")
    .eq("user_id", settings.user_id);

  if (!accounts || accounts.length === 0) {
    return [{ user_id: settings.user_id, status: "skipped", reason: "no_ad_accounts" }];
  }

  const accountIds = accounts.map((a: { id: string }) => a.id);
  const minScore = Math.round((settings.min_confidence || 0.95) * 100);
  const minImpactCents = Math.round((settings.min_amount_at_risk_brl || 500) * 100);

  const { data: decisions } = await sb
    .from("decisions")
    .select("id, account_id, ad_id, type, score, headline, reason, impact_type, impact_daily, impact_confidence, actions, status")
    .in("account_id", accountIds)
    .eq("status", "pending")
    .eq("impact_confidence", "high")
    .gte("score", minScore)
    .order("score", { ascending: false })
    .limit(remaining * 3); // over-fetch; some will be filtered by impact_daily / action mapping

  if (!decisions || decisions.length === 0) {
    return [{ user_id: settings.user_id, status: "skipped", reason: "no_qualifying_decisions" }];
  }

  const qualifying = (decisions as DecisionRow[]).filter(
    (d) => Math.abs(Number(d.impact_daily) || 0) >= minImpactCents
  );

  if (qualifying.length === 0) {
    return [{ user_id: settings.user_id, status: "skipped", reason: "no_decisions_met_min_amount" }];
  }

  let executedCount = 0;
  for (const d of qualifying) {
    if (executedCount >= remaining) break;
    const result = await executeOne(sb, settings, d);
    out.push(result);
    if (result.status === "executed") executedCount++;
  }

  return out;
}

// ── Server ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!isCronAuthorized(req)) return unauthorizedResponse(cors);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Optional: restrict to a specific user (for debugging / manual tick)
    let specificUser: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.user_id === "string") specificUser = body.user_id;
    } catch {
      // no body — full tick
    }

    // Fetch all eligible autopilot settings
    const nowIso = new Date().toISOString();
    let q = sb
      .from("autopilot_settings")
      .select("user_id, enabled, accepted_terms_at, min_confidence, min_amount_at_risk_brl, daily_action_cap, allowed_action_types, notify_telegram, notify_email, paused_until, undo_window_hours")
      .eq("enabled", true)
      .not("accepted_terms_at", "is", null);

    if (specificUser) q = q.eq("user_id", specificUser);

    const { data: settingsRows, error: settingsErr } = await q;
    if (settingsErr) throw settingsErr;

    // Filter out paused users
    const eligible: AutopilotSettings[] = (settingsRows || []).filter(
      (s: AutopilotSettings) => !s.paused_until || s.paused_until < nowIso
    );

    if (eligible.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, executed: 0, skipped: 0, errors: 0, results: [], message: "no_eligible_users" }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const allResults: ExecResult[] = [];
    for (const settings of eligible) {
      try {
        const r = await processUser(sb, settings);
        allResults.push(...r);
      } catch (e) {
        allResults.push({
          user_id: settings.user_id,
          status: "error",
          reason: e instanceof Error ? e.message : "unknown_error",
        });
      }
    }

    const executed = allResults.filter((r) => r.status === "executed").length;
    const skipped = allResults.filter((r) => r.status === "skipped").length;
    const errors = allResults.filter((r) => r.status === "error").length;

    return new Response(
      JSON.stringify({
        ok: true,
        processed: eligible.length,
        executed,
        skipped,
        errors,
        results: allResults,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[autopilot-executor]", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
