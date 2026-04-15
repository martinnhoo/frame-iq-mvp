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
  "Access-Control-Allow-Headers": "authorization, content-type",
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
  const { data, error } = await supabase
    .from("ad_accounts")
    .select("meta_access_token")
    .eq("id", adAccountId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch ad account meta token: ${error?.message}`);
  }

  return data.meta_access_token;
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
  const url = `https://graph.facebook.com/${metaGraphApiVersion}/${adId}?fields=${fields}&access_token=${metaAccessToken}`;

  const response = await fetch(url);
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

async function executeAction(
  req: ExecuteActionRequest,
  supabase: SupabaseClient,
  user: unknown
): Promise<Record<string, unknown>> {
  const {
    decision_id,
    action_type,
    target_type,
    target_meta_id,
    params = {},
  } = req;

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

  // Get the ad account ID and headline from the decision
  const { data: decisionData, error: decisionError } = await supabase
    .from("decisions")
    .select("ad_account_id, impact_daily, headline, type")
    .eq("id", decision_id)
    .eq("user_id", userId)
    .single();

  if (decisionError || !decisionData) {
    throw new Error(
      `Failed to fetch decision: ${decisionError?.message || "Not found"}`
    );
  }

  const { ad_account_id: adAccountId, impact_daily: estimated_daily_impact } = decisionData;

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

  // ── Log-first pattern: create pending log BEFORE calling Meta API ────
  // This prevents the "action executed but never logged" scenario
  const { data: logData, error: pendingLogError } = await supabase
    .from("action_log")
    .insert({
      decision_id,
      account_id: adAccountId,
      user_id: userId,
      action_type,
      target_type,
      target_meta_id,
      target_name: (previousState.name as string) || decisionData.headline || null,
      previous_state: previousState,
      new_state: null,
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
    case "reactivate_campaign":
      metaApiResult = await callMetaApi(target_meta_id, metaAccessToken, {
        status: "ACTIVE",
      });
      break;

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

      const defaultMultiplier = action_type === "increase_budget" ? 1.5 : 0.7;
      const multiplier = (params.multiplier as number) || defaultMultiplier;
      const newBudget = Math.max(100, Math.round(currentBudget * multiplier)); // min 100 cents ($1)

      metaApiResult = await callMetaApi(target_meta_id, metaAccessToken, {
        daily_budget: newBudget,
      });

      if (metaApiResult.success) {
        newState = { ...previousState, daily_budget: newBudget };
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

  // Update decision status to 'acted'
  const { error: updateError } = await supabase
    .from("decisions")
    .update({ status: "acted" })
    .eq("id", decision_id);

  if (updateError) {
    console.error("Failed to update decision status:", updateError);
  }

  // Update money_tracker — atomic increment with 1 retry
  if (estimated_daily_impact) {
    const isRevenueCaptureAction = ["increase_budget"].includes(action_type);
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

  // Get Meta access token
  const { data: decisionData, error: decisionError } = await supabase
    .from("decisions")
    .select("ad_account_id")
    .eq("id", logData.decision_id)
    .single();

  if (decisionError || !decisionData) {
    throw new Error("Failed to fetch decision");
  }

  const metaAccessToken = await getAdAccountMetaToken(
    supabase,
    decisionData.ad_account_id,
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
