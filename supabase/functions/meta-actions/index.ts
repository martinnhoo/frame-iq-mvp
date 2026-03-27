// meta-actions v1 — pause/activate/budget/publish/duplicate via Meta Marketing API v19
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BASE = "https://graph.facebook.com/v21.0";

function ok(data: object) {
  return new Response(JSON.stringify(data), { headers: { ...cors, "Content-Type": "application/json" } });
}
function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const { action, user_id, target_id, target_type, value } = body;

    if (!user_id || !action) return err("missing user_id or action");

    // Get token
    const { data: conn } = await supabase
      .from("platform_connections" as any)
      .select("access_token, ad_accounts")
      .eq("user_id", user_id).eq("platform", "meta").maybeSingle();

    if (!conn?.access_token) return err("Meta Ads not connected.");
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

    if (action === "pause" || action === "enable") {
      const status = action === "pause" ? "PAUSED" : "ACTIVE";
      const d = await post(target_id, { status });
      if (d.error) return err(d.error.message);
      return ok({ success: true, status, target_id, message: `${target_type || "Ad"} ${action === "pause" ? "pausado" : "ativado"} com sucesso.` });
    }

    if (action === "update_budget") {
      if (!value) return err("value required");
      const cents = Math.round(parseFloat(String(value)) * 100);
      const d = await post(target_id, { daily_budget: cents });
      if (d.error) return err(d.error.message);
      return ok({ success: true, target_id, new_budget: value, message: `Orçamento atualizado para $${value}/dia.` });
    }

    if (action === "publish") {
      const d = await post(target_id, { status: "ACTIVE" });
      if (d.error) return err(d.error.message);
      return ok({ success: true, target_id, message: `Publicado e definido como ATIVO.` });
    }

    if (action === "duplicate") {
      const d = await post(`${target_id}/copies`, { deep_copy: true, status_option: "PAUSED" });
      if (d.error) return err(d.error.message);
      return ok({ success: true, new_id: d.copied_adset_id || d.id, message: `Duplicado (pausado). Novo ID: ${d.copied_adset_id || d.id}` });
    }

    if (action === "list_campaigns") {
      const accs = (conn.ad_accounts as any[]) || [];
      const acc = accs.find((a: any) => a.account_status === 1) || accs[0];
      if (!acc) return err("No active ad account");
      const accId = acc.id.startsWith("act_") ? acc.id : `act_${acc.id}`;
      const d = await get(`${accId}/campaigns?fields=id,name,status,daily_budget,lifetime_budget,effective_status&limit=30`);
      if (d.error) return err(d.error.message);
      return ok({ success: true, campaigns: d.data || [] });
    }

    if (action === "list_adsets") {
      const d = await get(`${target_id}/adsets?fields=id,name,status,daily_budget,effective_status&limit=30`);
      if (d.error) return err(d.error.message);
      return ok({ success: true, adsets: d.data || [] });
    }

    if (action === "list_ads") {
      const d = await get(`${target_id}/ads?fields=id,name,status,effective_status&limit=30`);
      if (d.error) return err(d.error.message);
      return ok({ success: true, ads: d.data || [] });
    }

    return err(`Unknown action: ${action}`);

  } catch (e: any) {
    return err(e.message || "internal error");
  }
});
