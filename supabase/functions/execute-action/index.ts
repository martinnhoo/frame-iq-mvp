import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  supabase: ReturnType<typeof createClient>
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
  supabase: ReturnType<typeof createClient>,
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
  const url = `https://graph.facebook.com/${metaGraphApiVersion}/${adId}?fields=status,daily_budget,name&access_token=${metaAccessToken}`;

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
  supabase: ReturnType<typeof createClient>,
  user: unknown
): Promise<{
  success: boolean;
  action_log_id?: string;
  previous_state?: Record<string, unknown>;
  new_state?: Record<string, unknown>;
  error?: string;
}> {
  const {
    decision_id,
    action_type,
    target_type,
    target_meta_id,
    params = {},
  } = req;

  const userId = (user as { id: string }).id;

  // Get the ad account ID from the decision
  const { data: decisionData, error: decisionError } = await supabase
    .from("decisions")
    .select("ad_account_id, estimated_daily_impact")
    .eq("id", decision_id)
    .eq("user_id", userId)
    .single();

  if (decisionError || !decisionData) {
    throw new Error(
      `Failed to fetch decision: ${decisionError?.message || "Not found"}`
    );
  }

  const { ad_account_id: adAccountId, estimated_daily_impact } = decisionData;

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
      // Get current budget
      const { data: budgetData, error: budgetError } = await supabase
        .from("ad_snapshots")
        .select("daily_budget")
        .eq("meta_id", target_meta_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (budgetError) {
        throw new Error(
          `Failed to fetch current budget: ${budgetError.message}`
        );
      }

      const currentBudget = budgetData?.daily_budget || 0;
      const multiplier = (params.multiplier as number) || 1.2;
      const newBudget = Math.round(currentBudget * multiplier);

      metaApiResult = await callMetaApi(target_meta_id, metaAccessToken, {
        daily_budget: newBudget,
      });

      if (metaApiResult.success) {
        newState = { ...previousState, daily_budget: newBudget };
      }
      break;

    case "duplicate_ad":
      // Duplicate ad by creating copies
      metaApiResult = await callMetaApi(target_meta_id, metaAccessToken, {});
      // For copies endpoint, append /copies to the URL
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

    default:
      throw new Error(`Unknown action type: ${action_type}`);
  }

  if (!metaApiResult.success) {
    // Log failed action
    const { error: logError } = await supabase.from("action_log").insert({
      decision_id,
      user_id: userId,
      action_type,
      target_type,
      target_meta_id,
      previous_state: previousState,
      new_state: null,
      result: "error",
      error_message: metaApiResult.error?.message || "Unknown error",
    });

    if (logError) {
      console.error("Failed to log action error:", logError);
    }

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

  // Log successful action
  const { data: logData, error: logError } = await supabase
    .from("action_log")
    .insert({
      decision_id,
      user_id: userId,
      action_type,
      target_type,
      target_meta_id,
      previous_state: previousState,
      new_state: newState,
      result: "success",
      rollback_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (logError) {
    console.error("Failed to log action:", logError);
    throw new Error(`Failed to log action: ${logError.message}`);
  }

  // Update decision status to 'acted'
  const { error: updateError } = await supabase
    .from("decisions")
    .update({ status: "acted" })
    .eq("id", decision_id);

  if (updateError) {
    console.error("Failed to update decision status:", updateError);
  }

  // Update money_tracker
  if (estimated_daily_impact) {
    // Determine if this is revenue capture or savings based on action type
    const isRevenueCaptureAction = ["increase_budget"].includes(action_type);

    if (isRevenueCaptureAction) {
      const { error: trackerError } = await supabase
        .from("money_tracker")
        .update({
          total_revenue_captured: supabase.rpc(
            "increment_money_tracker_field",
            {
              amount: estimated_daily_impact,
              field: "total_revenue_captured",
            }
          ),
        })
        .eq("ad_account_id", adAccountId)
        .eq("user_id", userId);

      if (trackerError) {
        console.error("Failed to update money tracker revenue:", trackerError);
      }
    } else {
      const { error: trackerError } = await supabase
        .from("money_tracker")
        .update({
          total_saved: supabase.rpc("increment_money_tracker_field", {
            amount: estimated_daily_impact,
            field: "total_saved",
          }),
        })
        .eq("ad_account_id", adAccountId)
        .eq("user_id", userId);

      if (trackerError) {
        console.error("Failed to update money tracker savings:", trackerError);
      }
    }
  }

  return {
    success: true,
    action_log_id: logData?.id,
    previous_state: previousState,
    new_state: newState,
  };
}

async function rollbackAction(
  req: ExecuteActionRequest,
  supabase: ReturnType<typeof createClient>,
  user: unknown
): Promise<{
  success: boolean;
  error?: string;
}> {
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
