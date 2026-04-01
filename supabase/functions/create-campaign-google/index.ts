// create-campaign-google v1 — Google Ads API campaign creation
// Creates Campaign → AdGroup → (optional Ad) via Google Ads API v19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isUserAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  const ok = (d: object) => new Response(JSON.stringify(d), { headers: { ...cors, "Content-Type": "application/json" } });
  const err = (msg: string, step?: string) =>
    new Response(JSON.stringify({ error: msg, step }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const { user_id, persona_id, campaign } = body;

    if (!await isUserAuthorized(req, sb, user_id)) return unauthorizedResponse(cors);

    const DEV_TOKEN    = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") ?? "";
    const CLIENT_ID    = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
    if (!DEV_TOKEN) return err("Google Ads developer token não configurado.");

    // Get connection + refresh token if needed
    const { data: conn } = await sb.from("platform_connections" as any)
      .select("access_token, refresh_token, expires_at, ad_accounts, selected_account_id")
      .eq("user_id", user_id).eq("platform", "google").eq("persona_id", persona_id).maybeSingle();

    if (!conn?.access_token) return err("Google Ads não conectado para esta conta.");

    let token = conn.access_token;
    if (conn.refresh_token && conn.expires_at && new Date(conn.expires_at) < new Date()) {
      const rr = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: conn.refresh_token, grant_type: "refresh_token" }),
      });
      if (rr.ok) {
        const rd = await rr.json();
        if (rd.access_token) {
          token = rd.access_token;
          await sb.from("platform_connections" as any).update({ access_token: token, expires_at: new Date(Date.now() + (rd.expires_in || 3600) * 1000).toISOString() })
            .eq("user_id", user_id).eq("platform", "google").eq("persona_id", persona_id);
        }
      }
    }

    const accs = (conn.ad_accounts || []) as any[];
    const acc  = (conn.selected_account_id && accs.find((a: any) => a.id === conn.selected_account_id)) || accs[0];
    if (!acc?.id) return err("Nenhuma conta Google Ads encontrada.");

    const custId = acc.id.replace(/-/g, "");
    const hdr = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "developer-token": DEV_TOKEN,
      "login-customer-id": custId,
    };
    const base = `https://googleads.googleapis.com/v23/customers/${custId}`;

    // ── 1. Create Campaign ───────────────────────────────────────────────────
    const budgetMicros = Math.round(parseFloat(campaign.daily_budget || "50") * 1_000_000);

    // First create campaign budget
    const budgetRes = await fetch(`${base}/campaignBudgets:mutate`, {
      method: "POST", headers: hdr,
      body: JSON.stringify({
        operations: [{
          create: {
            name: `Budget — ${campaign.name}`,
            amountMicros: budgetMicros,
            deliveryMethod: "STANDARD",
          }
        }]
      }),
    });
    const budgetData = await budgetRes.json();
    if (budgetData.error) return err(budgetData.error.message || "Erro ao criar orçamento", "budget");
    const budgetResourceName = budgetData.results?.[0]?.resourceName;
    if (!budgetResourceName) return err("Não foi possível criar o orçamento", "budget");

    // Create campaign
    const campaignPayload: any = {
      name: campaign.name,
      status: "PAUSED",
      advertisingChannelType: campaign.channel_type || "SEARCH",
      campaignBudget: budgetResourceName,
      manualCpc: { enhancedCpcEnabled: false },
      networkSettings: {
        targetGoogleSearch: true,
        targetSearchNetwork: campaign.channel_type !== "DISPLAY",
        targetContentNetwork: campaign.channel_type === "DISPLAY",
        targetPartnerSearchNetwork: false,
      },
    };

    if (campaign.start_date) {
      campaignPayload.startDate = campaign.start_date.replace(/-/g, "");
    }

    const campaignRes = await fetch(`${base}/campaigns:mutate`, {
      method: "POST", headers: hdr,
      body: JSON.stringify({ operations: [{ create: campaignPayload }] }),
    });
    const campaignData = await campaignRes.json();
    if (campaignData.error) return err(campaignData.error.message || "Erro ao criar campanha", "campaign");
    const campaignResourceName = campaignData.results?.[0]?.resourceName;
    if (!campaignResourceName) return err("Não foi possível criar a campanha", "campaign");

    // ── 2. Create AdGroup ────────────────────────────────────────────────────
    const adGroupRes = await fetch(`${base}/adGroups:mutate`, {
      method: "POST", headers: hdr,
      body: JSON.stringify({
        operations: [{
          create: {
            name: campaign.adgroup_name || `${campaign.name} — Grupo 1`,
            campaign: campaignResourceName,
            status: "PAUSED",
            type: campaign.channel_type === "DISPLAY" ? "DISPLAY_STANDARD" : "SEARCH_STANDARD",
            cpcBidMicros: Math.round(parseFloat(campaign.cpc_bid || "1") * 1_000_000),
          }
        }]
      }),
    });
    const adGroupData = await adGroupRes.json();
    const adGroupResourceName = adGroupData.results?.[0]?.resourceName || null;

    // Extract campaign ID from resource name: customers/{cid}/campaigns/{id}
    const campaignId = campaignResourceName.split("/").pop();
    const adGroupId  = adGroupResourceName ? adGroupResourceName.split("/").pop() : null;

    return ok({
      ok: true,
      campaign_id: campaignId,
      campaign_resource_name: campaignResourceName,
      adgroup_id: adGroupId,
      google_ads_url: `https://ads.google.com/aw/campaigns?campaignId=${campaignId}&__e=${custId}`,
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
