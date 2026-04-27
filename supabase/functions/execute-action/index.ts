import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const metaGraphApiVersion = "v21.0";

interface ExecuteActionRequest {
  decision_id: string;
  action_type: string;
  target_type: string;
  target_meta_id: string;
  params?: Record<string, unknown>;
  action_log_id?: string; // for rollback operations
}

interface MetaApiResponse {
  success: boolean;
  id?: string;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getAuthUser(
  req: Request,
  supabase: SupabaseClient
) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Invalid or expired token");
  }

  return data.user;
}

async function getAdAccountMetaToken(
  supabase: SupabaseClient,
  adAccountId: string,
  userId: string
) {
  // Schema reality: ad_accounts has NO meta_access_token column. The Meta
  // OAuth token lives on platform_connections. Resolve via:
  //   ad_accounts.id (UUID) → user_id + meta_account_id → platform_connections.access_token
  // First, fetch the ad_accounts row to confirm ownership + get meta_account_id.
  const { data: acc, error: accErr } = await supabase
    .from("ad_accounts")
    .select("id, user_id, meta_account_id")
    .eq("id", adAccountId)
    .eq("user_id", userId)
    .single();

  if (accErr || !acc) {
    throw new Error(`Failed to fetch ad account: ${accErr?.message || "not found"}`);
  }

  // Then read the active Meta connection for this user. We pick the one
  // that owns this meta_account_id when possible; fall back to the first
  // active meta connection if the JSONB ad_accounts list isn't queryable.
  const { data: conns, error: connErr } = await supabase
    .from("platform_connections")
    .select("access_token, ad_accounts, selected_account_id")
    .eq("user_id", userId)
    .eq("platform", "meta")
    .eq("status", "active");

  if (connErr || !conns?.length) {
    throw new Error(`No active Meta connection for user: ${connErr?.message || "none"}`);
  }

  const wantId = acc.meta_account_id;
  const wantNorm = wantId?.replace(/^act_/, "");
  const conn = conns.find((c: any) => {
    if (c.selected_account_id === wantId || c.selected_account_id === wantNorm) return true;
    const list = Array.isArray(c.ad_accounts) ? c.ad_accounts : [];
    return list.some((a: any) =>
      a?.account_id === wantId || a?.account_id === wantNorm ||
      a?.id === wantId || a?.id === wantNorm,
    );
  }) || conns[0];

  if (!conn?.access_token) {
    throw new Error("Meta connection has no access_token");
  }

  return conn.access_token;
}

async function snapshotAdState(
  adId: string,
  targetType: string,
  metaAccessToken: string
): Promise<Record<string, unknown>> {
  // daily_budget only exists on campaigns and adsets, NOT on individual ads
  const fields = targetType === "ad"
    ? "status,name"
    : "status,daily_budget,name";
  // Pass the token via Authorization header so it never lands in URLs (which
  // get captured by access logs, traces, CDN edges, etc).
  const url = `https://graph.facebook.com/${metaGraphApiVersion}/${adId}?fields=${fields}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${metaAccessToken}` },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Failed to snapshot ad state: ${data.error?.message || "Unknown error"}`
    );
  }

  return {
    id: adId,
    target_type: targetType,
    status: data.status,
    daily_budget: data.daily_budget,
    name: data.name,
    timestamp: new Date().toISOString(),
  };
}

async function callMetaApi(
  targetId: string,
  metaAccessToken: string,
  payload: Record<string, unknown>
): Promise<MetaApiResponse> {
  const url = `https://graph.facebook.com/${metaGraphApiVersion}/${targetId}`;

  const formData = new URLSearchParams();
  formData.append("access_token", metaAccessToken);

  for (const [key, value] of Object.entries(payload)) {
    if (value !== null && value !== undefined) {
      formData.append(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: data.error,
    };
  }

  return {
    success: true,
    id: data.id,
  };
}

// ─── Cascade activation helpers ──────────────────────────────────────────────
// Why: a Meta ad serves only when the entire chain is ACTIVE
// (campaign → adset → ad). Flipping just one level leaves the others
// paused, so the user clicks "reativar" and *nothing serves*. We cascade
// UP unconditionally (parents are singletons, low risk) and cascade DOWN
// only when no child is currently delivering — protects users who
// intentionally paused individual creatives.
async function metaGet(path: string, token: string): Promise<any> {
  const r = await fetch(`https://graph.facebook.com/${metaGraphApiVersion}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`Meta GET ${path} failed: ${d.error?.message || "unknown"}`);
  return d;
}

async function fetchEntityHierarchy(
  metaId: string,
  type: "ad" | "adset" | "campaign",
  token: string,
): Promise<{ ad?: string; adset?: string; campaign?: string }> {
  if (type === "campaign") return { campaign: metaId };
  if (type === "adset") {
    const d = await metaGet(`${metaId}?fields=campaign_id`, token);
    return { adset: metaId, campaign: d.campaign_id };
  }
  const d = await metaGet(`${metaId}?fields=adset_id,campaign_id`, token);
  return { ad: metaId, adset: d.adset_id, campaign: d.campaign_id };
}

async function getEntityStatus(metaId: string, token: string): Promise<string> {
  const d = await metaGet(`${metaId}?fields=status`, token);
  return d.status as string;
}

async function getChildren(
  parentId: string,
  child: "adsets" | "ads",
  token: string,
): Promise<{ id: string; status: string }[]> {
  const d = await metaGet(`${parentId}/${child}?fields=id,status&limit=200`, token);
  return Array.isArray(d.data) ? d.data : [];
}

async function setActive(metaId: string, token: string): Promise<MetaApiResponse> {
  return await callMetaApi(metaId, token, { status: "ACTIVE" });
}

interface CascadeResult {
  target: string;
  cascadeUp: string[];   // parents we had to activate
  cascadeDown: string[]; // children we had to activate so something serves
}

async function cascadeActivate(
  metaId: string,
  type: "ad" | "adset" | "campaign",
  token: string,
): Promise<CascadeResult> {
  const cascadeUp: string[] = [];
  const cascadeDown: string[] = [];

  // 1. Activate the named target itself
  const r0 = await setActive(metaId, token);
  if (!r0.success) {
    throw new Error(r0.error?.message || `Failed to activate ${type} ${metaId}`);
  }

  // 2. Walk parents — activate any that are PAUSED so the chain serves
  const h = await fetchEntityHierarchy(metaId, type, token);
  if (h.adset && h.adset !== metaId) {
    const s = await getEntityStatus(h.adset, token);
    if (s !== "ACTIVE") {
      const r = await setActive(h.adset, token);
      if (r.success) cascadeUp.push(h.adset);
    }
  }
  if (h.campaign && h.campaign !== metaId) {
    const s = await getEntityStatus(h.campaign, token);
    if (s !== "ACTIVE") {
      const r = await setActive(h.campaign, token);
      if (r.success) cascadeUp.push(h.campaign);
    }
  }

  // 3. Walk children — only if the family currently delivers nothing.
  //    If at least one child is ACTIVE we leave the rest alone (user may
  //    have paused them on purpose).
  if (type === "campaign") {
    const adsets = await getChildren(metaId, "adsets", token);
    const anyAdsetActive = adsets.some((a) => a.status === "ACTIVE");
    if (!anyAdsetActive) {
      for (const a of adsets) {
        if (a.status !== "ACTIVE") {
          const r = await setActive(a.id, token);
          if (r.success) cascadeDown.push(a.id);
        }
      }
      // For each (now active) adset, ensure at least one ad delivers
      for (const a of adsets) {
        const ads = await getChildren(a.id, "ads", token);
        const anyAdActive = ads.some((x) => x.status === "ACTIVE");
        if (!anyAdActive) {
          for (const ad of ads) {
            if (ad.status !== "ACTIVE") {
              const r = await setActive(ad.id, token);
              if (r.success) cascadeDown.push(ad.id);
            }
          }
        }
      }
    }
  } else if (type === "adset") {
    const ads = await getChildren(metaId, "ads", token);
    const anyAdActive = ads.some((x) => x.status === "ACTIVE");
    if (!anyAdActive) {
      for (const ad of ads) {
        if (ad.status !== "ACTIVE") {
          const r = await setActive(ad.id, token);
          if (r.success) cascadeDown.push(ad.id);
        }
      }
    }
  }

  return { target: metaId, cascadeUp, cascadeDown };
}

async function executeAction(
  req: ExecuteActionRequest,
  supabase: SupabaseClient,
  user: unknown
): Promise<Record<string, unknown>> {
  const {
    decision_id,
    action_type: originalActionType,
    target_type,
    target_meta_id,
    params = {},
  } = req;

  // action_type may be corrected later (e.g., budget direction fix)
  let action_type = originalActionType;

  const userId = (user as { id: string }).id;

  // ── Idempotency guard — prevent double execution of same decision ────
  // Check for both "success" and "pending" (in-flight) to block double-clicks
  const { data: existingAction } = await supabase
    .from("action_log")
    .select("id, result, executed_at")
    .eq("decision_id", decision_id)
    .eq("action_type", action_type)
    .in("result", ["success", "pending"])
    .maybeSingle();

  if (existingAction) {
    console.log(`[execute-action] Already ${existingAction.result}: decision=${decision_id} action=${action_type} log=${existingAction.id}`);
    return {
      success: true,
      already_executed: true,
      action_log_id: existingAction.id,
    };
  }

  // Get the ad account ID and headline from the decision.
  // The decisions table has `account_id` (not `ad_account_id`) and no
  // `user_id` column — ownership is enforced downstream by
  // getAdAccountMetaToken which requires a matching (id, user_id) on
  // ad_accounts. An invalid user will fail there with a meaningful
  // error instead of silently returning no decision.
  const { data: decisionData, error: decisionError } = await supabase
    .from("decisions")
    .select("account_id, impact_daily, headline, type, source, metrics")
    .eq("id", decision_id)
    .single();

  if (decisionError || !decisionData) {
    throw new Error(
      `Failed to fetch decision: ${decisionError?.message || "Not found"}`
    );
  }

  const { account_id: adAccountId, impact_daily: estimated_daily_impact } = decisionData;

  // Get Meta access token
  const metaAccessToken = await getAdAccountMetaToken(
    supabase,
    adAccountId,
    userId
  );

  // Snapshot previous state
  const previousState = await snapshotAdState(
    target_meta_id,
    target_type,
    metaAccessToken
  );

  // action_log CHECK constraint accepts:
  //   pause_ad/adset/campaign | reactivate_ad/adset | increase_budget |
  //   decrease_budget | duplicate_ad | generate_hook | generate_variation
  //
  // The Meta-side / AI naming is `enable_*` (Meta API standard), so we
  // map enable_ad → reactivate_ad and enable_adset → reactivate_adset
  // before insert. enable_campaign isn't in the constraint at all (the
  // current schema only supports adset-level reactivate); fall through
  // to the same mapping and let the constraint reject if invalid.
  const ACTION_LOG_MAP: Record<string, string> = {
    enable_ad: "reactivate_ad",
    enable_adset: "reactivate_adset",
    enable_campaign: "reactivate_campaign", // requires the CHECK constraint
                                            // expansion shipped 2026-04-27
  };
  const loggedActionType = ACTION_LOG_MAP[action_type] ?? action_type;

  // ── Log-first pattern: create pending log BEFORE calling Meta API ────
  // This prevents the "action executed but never logged" scenario
  const { data: logData, error: pendingLogError } = await supabase
    .from("action_log")
    .insert({
      decision_id,
      account_id: adAccountId,
      user_id: userId,
      action_type: loggedActionType,
      target_type,
      target_meta_id,
      target_name: (previousState.name as string) || decisionData.headline || null,
      previous_state: previousState,
      // new_state is NOT NULL with default '{}' — passing literal null
      // bypasses the default and trips the constraint. Empty object now,
      // overwritten with the real new_state after the Meta API call.
      new_state: {},
      result: "pending",
      estimated_daily_impact: estimated_daily_impact || 0,
    })
    .select()
    .single();

  if (pendingLogError || !logData) {
    console.error("Failed to create pending action log:", pendingLogError);
    throw new Error(`Failed to create action log: ${pendingLogError?.message}`);
  }

  const logId = logData.id;

  let metaApiResult: MetaApiResponse;
  let newState: Record<string, unknown> | null = null;

  // Execute appropriate action
  switch (action_type) {
    case "pause_ad":
    case "pause_adset":
    case "pause_campaign":
      metaApiResult = await callMetaApi(target_meta_id, metaAccessToken, {
        status: "PAUSED",
      });
      break;

    case "reactivate_ad":
    case "reactivate_adset":
    case "reactivate_campaign": {
      // Cascade — reactivating a single entity isn't enough; the entire
      // chain has to be ACTIVE for delivery. cascadeActivate flips the
      // target, walks parents up, and walks children down (only if no
      // sibling is currently delivering, to avoid clobbering paused
      // creatives). Records the chain in new_state for transparency.
      try {
        const cascade = await cascadeActivate(target_meta_id, target_type as "ad" | "adset" | "campaign", metaAccessToken);
        metaApiResult = { success: true, id: target_meta_id };
        newState = {
          ...previousState,
          status: "ACTIVE",
          cascade: {
            target: cascade.target,
            also_activated_up: cascade.cascadeUp,
            also_activated_down: cascade.cascadeDown,
            total_activated: 1 + cascade.cascadeUp.length + cascade.cascadeDown.length,
          },
        };
        console.log(`[execute-action] cascade activate ${target_type} ${target_meta_id}`, {
          up: cascade.cascadeUp.length,
          down: cascade.cascadeDown.length,
        });
      } catch (e) {
        metaApiResult = {
          success: false,
          error: { message: (e as any)?.message || "Cascade activation failed", type: "cascade_error", code: 0 },
        };
      }
      break;
    }

    case "increase_budget":
    case "decrease_budget": {
      // Get current budget from Meta API snapshot (already captured above)
      const snapshotBudget = previousState.daily_budget
        ? Number(previousState.daily_budget)
        : 0;

      // Fallback: try ad_snapshots table if snapshot didn't have budget
      let currentBudget = snapshotBudget;
      if (!currentBudget) {
        const { data: budgetData } = await supabase
          .from("ad_snapshots")
          .select("daily_budget")
          .eq("meta_id", target_meta_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        currentBudget = budgetData?.daily_budget ? Number(budgetData.daily_budget) : 0;
      }

      // Safety: never set budget to zero or negative
      if (!currentBudget || currentBudget <= 0) {
        throw new Error(
          "Cannot adjust budget: current budget is unknown or zero. Check the campaign in Ads Manager."
        );
      }

      // Support explicit new_budget from params (user-specified value)
      let newBudget: number;
      if (params.new_budget && Number(params.new_budget) > 0) {
        newBudget = Math.max(100, Math.round(Number(params.new_budget)));
      } else {
        const defaultMultiplier = action_type === "increase_budget" ? 1.5 : 0.7;
        const multiplier = (params.multiplier as number) || defaultMultiplier;
        newBudget = Math.max(100, Math.round(currentBudget * multiplier)); // min 100 cents ($1)
      }

      // ── Correct action_type based on ACTUAL direction ──
      action_type = newBudget > currentBudget ? "increase_budget" : "decrease_budget";

      metaApiResult = await callMetaApi(target_meta_id, metaAccessToken, {
        daily_budget: newBudget,
      });

      if (metaApiResult.success) {
        newState = {
          ...previousState,
          daily_budget: newBudget,
          // Store specific change details for accurate history
          budget_change: {
            from: currentBudget,
            to: newBudget,
            direction: action_type === "increase_budget" ? "increase" : "decrease",
            change_pct: Math.round(((newBudget - currentBudget) / currentBudget) * 100),
          },
        };

        // ── Fix action_log to reflect actual direction + specific values ──
        await supabase.from("action_log").update({
          action_type,
        }).eq("id", logId);

        console.log(`[execute-action] Budget ${action_type}: ${currentBudget} → ${newBudget} (${Math.round(((newBudget - currentBudget) / currentBudget) * 100)}%)`);
      }
      break;
    }

    case "duplicate_ad": {
      // Use Meta Ads API /copies endpoint directly
      const copiesUrl = `https://graph.facebook.com/${metaGraphApiVersion}/${target_meta_id}/copies`;

      const formData = new URLSearchParams();
      formData.append("access_token", metaAccessToken);

      const copiesResponse = await fetch(copiesUrl, {
        method: "POST",
        body: formData,
      });

      const copiesData = await copiesResponse.json();

      if (!copiesResponse.ok) {
        metaApiResult = {
          success: false,
          error: copiesData.error,
        };
      } else {
        metaApiResult = {
          success: true,
          id: copiesData.id,
        };
      }
      break;
    }

    case "generate_hook":
    case "generate_variation": {
      // These are creative generation actions — no Meta API call needed.
      // Mark as success; the frontend navigates to the appropriate generator.
      metaApiResult = { success: true };
      newState = { ...previousState, action: action_type, note: "Creative generation triggered" };
      break;
    }

    default:
      throw new Error(`Unknown action type: ${action_type}`);
  }

  if (!metaApiResult.success) {
    // Update log to error status
    await supabase.from("action_log").update({
      result: "error",
      error_message: metaApiResult.error?.message || "Unknown error",
    }).eq("id", logId);

    throw new Error(
      `Meta API call failed: ${metaApiResult.error?.message || "Unknown error"}`
    );
  }

  // Snapshot new state
  if (!newState) {
    newState = await snapshotAdState(
      target_meta_id,
      target_type,
      metaAccessToken
    );
  }

  // Update log to success with new state (retry once on failure)
  let logError = (await supabase
    .from("action_log")
    .update({
      new_state: newState,
      result: "success",
      rollback_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .eq("id", logId)).error;

  if (logError) {
    console.warn("[execute-action] Log update failed, retrying in 500ms...", logError.message);
    await new Promise(r => setTimeout(r, 500));
    logError = (await supabase
      .from("action_log")
      .update({ new_state: newState, result: "success", rollback_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() })
      .eq("id", logId)).error;
    if (logError) {
      console.error("[execute-action] Log update FAILED after retry — pending log orphaned:", logError.message);
    }
  }

  // ── action_outcomes — REQUIRED for the 24h/72h measurement cron ──
  //
  // Without a row here, the cron never measures the result of this
  // action and the decision loop is broken end-to-end. Was missing
  // entirely — only meta-actions wrote action_outcomes, but
  // execute-action (used by Feed AND chat DecisionCard) didn't.
  //
  // Mapped to the canonical action_type_enum:
  //   pause_ad/adset/campaign  → identity
  //   enable_ad/adset/campaign → identity
  //   increase_budget          → budget_increase
  //   decrease_budget          → budget_decrease
  //   duplicate_ad             → duplicate_ad
  // Anything else → skip (action_outcomes_enum doesn't cover it,
  // e.g. generate_hook routes — those are creative-side, not measurable).
  const ACTION_TYPE_MAP: Record<string, string> = {
    pause_ad: "pause_ad", pause_adset: "pause_adset", pause_campaign: "pause_campaign",
    enable_ad: "enable_ad", enable_adset: "enable_adset", enable_campaign: "enable_campaign",
    increase_budget: "budget_increase", decrease_budget: "budget_decrease",
    duplicate_ad: "duplicate_ad",
  };
  const outcomeActionType = ACTION_TYPE_MAP[action_type];
  if (outcomeActionType) {
    try {
      // metrics_before: try to extract from decision.metrics (the engine
      // stores it there) so the cron has a baseline to delta against.
      // Falls back to {} which is a valid JSONB and won't fail the
      // not-null check — cron will just produce a sparse delta.
      const decisionMetrics = (decisionData as any).metrics;
      const metricsBefore = (() => {
        if (!Array.isArray(decisionMetrics) || decisionMetrics.length === 0) return {};
        const out: Record<string, unknown> = {};
        for (const m of decisionMetrics) {
          if (m?.key && m?.value != null) out[String(m.key).toLowerCase()] = m.value;
        }
        return out;
      })();
      const { error: aoErr } = await supabase.from("action_outcomes").insert({
        user_id: userId,
        action_type: outcomeActionType,
        target_level: target_type,                  // ad | adset | campaign
        target_id: target_meta_id,                  // Meta numeric id
        target_name: (previousState as any)?.name || decisionData.headline || null,
        source: (decisionData as any).source === "ai_chat" ? "chat" : "feed",
        ai_reasoning: decisionData.headline || null,
        metrics_before: metricsBefore,
        metrics_window: "d7",
        impact_snapshot: estimated_daily_impact || null,
        // taken_at uses default now() — cron filters by this
      });
      if (aoErr) {
        console.error("[execute-action] action_outcomes insert failed:", {
          message: aoErr.message,
          code: (aoErr as any).code,
          details: (aoErr as any).details,
          decision_id,
          action_type: outcomeActionType,
        });
      } else {
        console.log("[execute-action] action_outcomes created", {
          decision_id,
          action_type: outcomeActionType,
          target_id: target_meta_id,
          source: (decisionData as any).source === "ai_chat" ? "chat" : "feed",
        });
      }
    } catch (e) {
      console.error("[execute-action] action_outcomes insert threw:", (e as any)?.message || e);
    }
  } else {
    console.log("[execute-action] skipping action_outcomes — action_type not in enum:", action_type);
  }

  // Update decision status to 'acted'
  const { error: updateError } = await supabase
    .from("decisions")
    .update({ status: "acted" })
    .eq("id", decision_id);

  if (updateError) {
    console.error("Failed to update decision status:", updateError);
  }

  // Update money_tracker — atomic increment with 1 retry
  // Use the actual action that happened (budget may have been corrected from increase→decrease)
  if (estimated_daily_impact) {
    const isRevenueCaptureAction = ["increase_budget", "reactivate_ad", "reactivate_adset", "reactivate_campaign"].includes(action_type);
    const field = isRevenueCaptureAction ? "total_revenue_captured" : "total_saved";
    const rpcParams = { p_account_id: adAccountId, p_field: field, p_amount: estimated_daily_impact };

    let trackerError = (await supabase.rpc("increment_money_tracker", rpcParams)).error;
    if (trackerError) {
      console.warn(`[execute-action] money_tracker.${field} failed, retrying...`, trackerError.message);
      await new Promise(r => setTimeout(r, 500));
      trackerError = (await supabase.rpc("increment_money_tracker", rpcParams)).error;
      if (trackerError) {
        console.error(`[execute-action] money_tracker.${field} FAILED after retry:`, trackerError.message);
      }
    }
  }

  // Send Telegram notification (fire-and-forget — never blocks the response)
  try {
    const targetName = decisionData.headline || target_meta_id;
    const dailyImpact = estimated_daily_impact || 0;

    // Get total saved for context
    const { data: tracker } = await supabase
      .from("money_tracker")
      .select("total_saved")
      .eq("account_id", adAccountId)
      .maybeSingle();

    await supabase.functions.invoke("send-telegram", {
      body: {
        user_id: userId,
        payload: {
          type: "action_feedback",
          actionType: action_type,
          targetName,
          dailyImpact,
          totalSaved: tracker?.total_saved || 0,
        },
      },
    });
  } catch (e) {
    // Never fail the action because Telegram failed
    console.error("[execute-action] Telegram notification failed:", e);
  }

  return {
    success: true,
    action_log_id: logId,
    previous_state: previousState,
    new_state: newState,
  };
}

async function rollbackAction(
  req: ExecuteActionRequest,
  supabase: SupabaseClient,
  user: unknown
): Promise<Record<string, unknown>> {
  const { action_log_id } = req;
  const userId = (user as { id: string }).id;

  if (!action_log_id) {
    throw new Error("action_log_id is required for rollback");
  }

  // Get the action log entry
  const { data: logData, error: logError } = await supabase
    .from("action_log")
    .select("*")
    .eq("id", action_log_id)
    .eq("user_id", userId)
    .single();

  if (logError || !logData) {
    throw new Error(`Failed to fetch action log: ${logError?.message}`);
  }

  // Check if rollback window has expired
  const rollbackExpiresAt = new Date(logData.rollback_expires_at);
  if (new Date() > rollbackExpiresAt) {
    throw new Error("Rollback window has expired (30 minutes)");
  }

  // Get Meta access token (rollback path). Same note as above:
  // decisions uses `account_id`, not `ad_account_id`.
  const { data: decisionData, error: decisionError } = await supabase
    .from("decisions")
    .select("account_id")
    .eq("id", logData.decision_id)
    .single();

  if (decisionError || !decisionData) {
    throw new Error("Failed to fetch decision");
  }

  const metaAccessToken = await getAdAccountMetaToken(
    supabase,
    decisionData.account_id,
    userId
  );

  const previousState = logData.previous_state;

  // Restore previous state via Meta API
  const restorePayload: Record<string, unknown> = {};

  if (previousState.status) {
    restorePayload.status = previousState.status;
  }
  if (previousState.daily_budget) {
    restorePayload.daily_budget = previousState.daily_budget;
  }

  const metaApiResult = await callMetaApi(
    logData.target_meta_id,
    metaAccessToken,
    restorePayload
  );

  if (!metaApiResult.success) {
    throw new Error(
      `Failed to restore state: ${metaApiResult.error?.message || "Unknown error"}`
    );
  }

  // Update action log with rolled_back status
  const { error: updateError } = await supabase
    .from("action_log")
    .update({ result: "rolled_back" })
    .eq("id", action_log_id);

  if (updateError) {
    console.error("Failed to update action log:", updateError);
  }

  return {
    success: true,
  };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const user = await getAuthUser(req, supabase);

    // Parse request body
    const body: ExecuteActionRequest = await req.json();

    // Validate required fields
    if (!body.action_type || !body.target_type || !body.target_meta_id) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: action_type, target_type, target_meta_id",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let result;

    // Route to rollback or execute
    if (body.action_type === "rollback") {
      result = await rollbackAction(body, supabase, user);
    } else {
      if (!body.decision_id) {
        return new Response(
          JSON.stringify({
            error: "Missing required field: decision_id",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      result = await executeAction(body, supabase, user);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error("Error in execute-action function:", errorMessage);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
