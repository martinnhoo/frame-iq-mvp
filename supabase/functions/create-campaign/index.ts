// create-campaign v1 — Meta Marketing API campaign creation
// Creates Campaign → AdSet → (optional Ad) in sequence
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isUserAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BASE = "https://graph.facebook.com/v21.0";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const ok = (d: object) => new Response(JSON.stringify(d), { headers: { ...cors, "Content-Type": "application/json" } });
  const err = (msg: string, step?: string, extra?: object) =>
    new Response(JSON.stringify({ error: msg, step, ...extra }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const { user_id, persona_id, campaign } = body;

    if (!await isUserAuthorized(req, sb, user_id)) return unauthorizedResponse(cors);

    const { data: conn } = await sb.from("platform_connections" as any)
      .select("access_token, ad_accounts, selected_account_id")
      .eq("user_id", user_id).eq("platform", "meta").eq("persona_id", persona_id).maybeSingle();

    if (!conn?.access_token) return err("Meta Ads não conectado para esta conta.");

    const token = conn.access_token;
    const accs = (conn.ad_accounts as any[]) || [];
    const account = (conn.selected_account_id && accs.find((a: any) => a.id === conn.selected_account_id)) || accs[0];
    if (!account?.id) return err("Nenhuma conta de anúncios encontrada.");

    const accountId = account.id;
    const post = async (path: string, payload: object) => {
      const r = await fetch(`${BASE}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, access_token: token }),
      });
      return r.json();
    };

    // ── 1. Campaign ──────────────────────────────────────────────────────────
    const campaignPayload: any = {
      name: campaign.name,
      objective: campaign.objective,
      status: "PAUSED",
      special_ad_categories: campaign.special_ad_categories || [],
    };
    if (campaign.cbo && campaign.daily_budget) {
      campaignPayload.daily_budget = Math.round(parseFloat(campaign.daily_budget) * 100);
      campaignPayload.bid_strategy = "LOWEST_COST_WITHOUT_CAP";
    }

    const cr = await post(`${accountId}/campaigns`, campaignPayload);
    if (cr.error) return err(cr.error.message, "campaign");
    const campaignId = cr.id;

    // ── 2. AdSet ─────────────────────────────────────────────────────────────
    const adsetPayload: any = {
      name: campaign.adset_name || `${campaign.name} — AdSet 1`,
      campaign_id: campaignId,
      status: "PAUSED",
      optimization_goal: campaign.optimization_goal || "LINK_CLICKS",
      billing_event: campaign.billing_event || "IMPRESSIONS",
      targeting: {
        geo_locations: { countries: campaign.countries || ["BR"] },
        age_min: campaign.age_min || 18,
        age_max: campaign.age_max || 65,
        ...(campaign.genders?.length ? { genders: campaign.genders } : {}),
        ...(campaign.interests?.length ? {
          flexible_spec: [{ interests: campaign.interests.map((i: any) => ({ id: i.id, name: i.name })) }]
        } : {}),
      },
    };
    if (!campaign.cbo) {
      adsetPayload.daily_budget = Math.round(parseFloat(campaign.daily_budget || "50") * 100);
    }

    const ar = await post(`${accountId}/adsets`, adsetPayload);
    if (ar.error) return err(ar.error.message, "adset", { campaign_id: campaignId });
    const adsetId = ar.id;

    return ok({
      ok: true,
      campaign_id: campaignId,
      adset_id: adsetId,
      ads_manager_url: `https://www.facebook.com/adsmanager/manage/campaigns?act=${accountId.replace("act_", "")}&selected_campaign_ids=${campaignId}`,
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
