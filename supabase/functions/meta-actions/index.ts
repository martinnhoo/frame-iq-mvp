// meta-actions v2 — pause/activate/budget/publish/duplicate via Meta Marketing API v21
// Now also writes to action_log so every action appears in Histórico
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BASE = "https://graph.facebook.com/v21.0";

function ok(data: object) {
  return new Response(JSON.stringify(data), { headers: { ...cors, "Content-Type": "application/json" } });
}
function errResp(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Map meta-actions action names to action_log action_type format
function mapActionType(action: string, targetType: string): string {
  const t = targetType || "ad";
  switch (action) {
    case "pause": return `pause_${t}`;
    case "enable":
    case "publish": return `reactivate_${t}`;
    case "update_budget": return `increase_budget`; // will refine below if decrease
    case "duplicate": return `duplicate_${t}`;
    default: return action;
  }
}

// Fetch target info from Meta API
async function fetchTargetInfo(targetId: string, targetType: string, token: string): Promise<{ name: string | null; daily_budget: number | null }> {
  try {
    const fields = targetType === "ad" ? "name,adset_id" : "name,daily_budget";
    const r = await fetch(`${BASE}/${targetId}?fields=${fields}&access_token=${token}`);
    const d = await r.json();
    const budget = d.daily_budget ? Number(d.daily_budget) / 100 : null; // cents → reais
    return { name: d.name || null, daily_budget: budget };
  } catch {
    return { name: null, daily_budget: null };
  }
}

// For ads: estimate proportional daily impact from parent adset
async function estimateAdDailyImpact(targetId: string, token: string): Promise<number | null> {
  try {
    // Get parent adset_id
    const r1 = await fetch(`${BASE}/${targetId}?fields=adset_id&access_token=${token}`);
    const d1 = await r1.json();
    if (!d1.adset_id) return null;

    // Get adset daily_budget + count active ads
    const [budgetRes, adsRes] = await Promise.all([
      fetch(`${BASE}/${d1.adset_id}?fields=daily_budget&access_token=${token}`),
      fetch(`${BASE}/${d1.adset_id}/ads?fields=effective_status&limit=50&access_token=${token}`),
    ]);
    const budgetData = await budgetRes.json();
    const adsData = await adsRes.json();

    if (!budgetData.daily_budget) return null;
    const adsetBudget = Number(budgetData.daily_budget) / 100;
    const activeAds = (adsData.data || []).filter((a: any) => a.effective_status === "ACTIVE").length;
    if (activeAds <= 0) return null;

    return Math.round((adsetBudget / activeAds) * 100) / 100; // proportional share
  } catch {
    return null;
  }
}

// Write to action_log so it appears in Histórico de Ações
async function logToActionHistory(
  supabase: any,
  userId: string,
  action: string,
  targetId: string,
  targetType: string,
  targetName: string | null,
  previousState: object | null,
  newState: object | null,
  estimatedDailyImpact: number | null = null,
) {
  try {
    // Get user's ad_account id (our internal UUID)
    const { data: adAccount } = await supabase
      .from("ad_accounts")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!adAccount?.id) {
      console.warn("[meta-actions] No ad_account found for user, skipping action_log");
      return;
    }

    const actionType = mapActionType(action, targetType);

    const row: Record<string, any> = {
      account_id: adAccount.id,
      user_id: userId,
      action_type: actionType,
      target_type: targetType || "ad",
      target_meta_id: targetId,
      target_name: targetName,
      previous_state: previousState || {},
      new_state: newState || {},
      result: "success",
      executed_at: new Date().toISOString(),
      rollback_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
    if (estimatedDailyImpact && estimatedDailyImpact > 0) {
      row.estimated_daily_impact = estimatedDailyImpact;
    }
    await supabase.from("action_log").insert(row);
  } catch (e) {
    // Never block the response because of logging failure
    console.error("[meta-actions] Failed to write action_log:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const { action, user_id, persona_id, target_id, target_type, value } = body;

    if (!user_id || !action) return errResp("missing user_id or action");

    // ── JWT auth — prevent user_id spoofing on write actions ──────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errResp("unauthorized", 401);
    const { data: { user: authUser } } = await supabase.auth.getUser(authHeader.slice(7));
    if (!authUser || authUser.id !== user_id) return errResp("unauthorized", 401);

    // Get token — scoped to persona if provided, with fallback to any active connection
    let conn: any = null;
    if (persona_id) {
      const { data } = await supabase.from("platform_connections" as any)
        .select("access_token, ad_accounts")
        .eq("user_id", user_id).eq("platform", "meta").eq("status", "active").eq("persona_id", persona_id)
        .maybeSingle();
      conn = data;
    }
    // Fallback: try without persona filter (covers persona mismatch or legacy connections)
    if (!conn?.access_token) {
      const { data } = await supabase.from("platform_connections" as any)
        .select("access_token, ad_accounts")
        .eq("user_id", user_id).eq("platform", "meta").eq("status", "active")
        .limit(1).maybeSingle();
      conn = data;
    }

    if (!conn?.access_token) return errResp("Meta Ads não conectado. Conecte sua conta em Contas.");
    const token = conn.access_token;

    const post = async (path: string, payload: object) => {
      const r = await fetch(`${BASE}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, access_token: token }),
      });
      return r.json();
    };

    const get = async (path: string) => {
      const r = await fetch(`${BASE}/${path}&access_token=${token}`);
      return r.json();
    };

    // ── Validate target_id for write actions ────────────────────────────
    const WRITE_ACTIONS = ["pause", "enable", "update_budget", "publish", "duplicate"];
    if (WRITE_ACTIONS.includes(action) && (!target_id || target_id === "undefined" || target_id === "null")) {
      return errResp(`target_id obrigatório para ação "${action}". Peça ao usuário identificar o item ou use list_campaigns primeiro.`);
    }

    // ── Write actions (pause, enable, budget, publish, duplicate) ────────

    if (action === "pause" || action === "enable") {
      const status = action === "pause" ? "PAUSED" : "ACTIVE";
      const tType = target_type || "ad";

      // Fetch info before action
      const info = await fetchTargetInfo(target_id, tType, token);
      const targetName = body.target_name || info.name;

      // Estimate daily impact for pause actions
      let dailyImpact: number | null = null;
      if (action === "pause") {
        if (tType === "ad") {
          dailyImpact = await estimateAdDailyImpact(target_id, token);
        } else {
          dailyImpact = info.daily_budget; // campaign/adset: direct budget
        }
      }

      const d = await post(target_id, { status });
      if (d.error) return errResp(d.error.message);

      // Log to action_log (non-blocking)
      logToActionHistory(supabase, user_id, action, target_id, tType, targetName,
        { status: action === "pause" ? "ACTIVE" : "PAUSED" },
        { status },
        dailyImpact,
      );

      const label = target_type === "campaign" ? "Campanha" : target_type === "adset" ? "Conjunto" : "Anúncio";
      return ok({ success: true, status, target_id, message: `${label} ${action === "pause" ? "pausado" : "ativado"} com sucesso.` });
    }

    if (action === "update_budget") {
      if (!value) return errResp("value required");
      const cents = Math.round(parseFloat(String(value)) * 100);
      const budgetField = (body.budget_type === "lifetime") ? "lifetime_budget" : "daily_budget";
      const info = await fetchTargetInfo(target_id, target_type || "campaign", token);
      const targetName = body.target_name || info.name;
      const d = await post(target_id, { [budgetField]: cents });
      if (d.error) return errResp(d.error.message);

      logToActionHistory(supabase, user_id, action, target_id, target_type || "campaign", targetName,
        {},
        { [budgetField]: cents }
      );

      const label = budgetField === "lifetime_budget" ? "vitalício" : "/dia";
      return ok({ success: true, target_id, new_budget: value, message: `Orçamento atualizado para R$${value}${label}.` });
    }

    if (action === "publish") {
      const info = await fetchTargetInfo(target_id, target_type || "ad", token);
      const targetName = body.target_name || info.name;
      const d = await post(target_id, { status: "ACTIVE" });
      if (d.error) return errResp(d.error.message);

      logToActionHistory(supabase, user_id, action, target_id, target_type || "ad", targetName,
        { status: "PAUSED" },
        { status: "ACTIVE" }
      );

      return ok({ success: true, target_id, message: `Publicado e definido como ATIVO.` });
    }

    if (action === "duplicate") {
      const info = await fetchTargetInfo(target_id, target_type || "ad", token);
      const targetName = body.target_name || info.name;
      const copyEndpoint = `${target_id}/copies`;
      const d = await post(copyEndpoint, { deep_copy: true, status_option: "PAUSED" });
      if (d.error) return errResp(d.error.message);
      const newId = d.copied_adset_id || d.copied_ad_id || d.id;

      logToActionHistory(supabase, user_id, action, target_id, target_type || "ad", targetName,
        {},
        { new_id: newId, status: "PAUSED" }
      );

      return ok({ success: true, new_id: newId, message: `Duplicado e pausado. Novo ID: ${newId}` });
    }

    // ── Read-only actions (no logging needed) ────────────────────────────

    if (action === "list_campaigns") {
      const accs = (conn.ad_accounts as any[]) || [];
      const acc = accs.find((a: any) => a.account_status === 1) || accs[0];
      if (!acc) return errResp("No active ad account");
      const accId = acc.id.startsWith("act_") ? acc.id : `act_${acc.id}`;
      const d = await get(`${accId}/campaigns?fields=id,name,status,daily_budget,lifetime_budget,effective_status&limit=30`);
      if (d.error) return errResp(d.error.message);
      return ok({ success: true, campaigns: d.data || [] });
    }

    if (action === "list_adsets") {
      const d = await get(`${target_id}/adsets?fields=id,name,status,daily_budget,effective_status&limit=30`);
      if (d.error) return errResp(d.error.message);
      return ok({ success: true, adsets: d.data || [] });
    }

    if (action === "list_ads") {
      const d = await get(`${target_id}/ads?fields=id,name,status,effective_status&limit=30`);
      if (d.error) return errResp(d.error.message);
      return ok({ success: true, ads: d.data || [] });
    }

    return errResp(`Unknown action: ${action}`);

  } catch (e: any) {
    return errResp(e.message || "internal error");
  }
});
