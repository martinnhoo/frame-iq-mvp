import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIKTOK_APP_ID = Deno.env.get("TIKTOK_APP_ID") || "";
const TIKTOK_APP_SECRET = Deno.env.get("TIKTOK_APP_SECRET") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://www.adbrief.pro";
const REDIRECT_URI = `${APP_URL}/dashboard/loop/connect/tiktok/callback`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { action, code, user_id, state } = await req.json();

    if (action === "get_auth_url") {
      const stateParam = btoa(JSON.stringify({ user_id, ts: Date.now() }));
      const url = new URL("https://business-api.tiktok.com/open_api/v1.3/oauth2/authorize/");
      url.searchParams.set("app_id", TIKTOK_APP_ID);
      url.searchParams.set("redirect_uri", REDIRECT_URI);
      url.searchParams.set("state", stateParam);
      url.searchParams.set("scope", "ads.management,report.read");
      return new Response(JSON.stringify({ url: url.toString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "exchange_code") {
      const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: TIKTOK_APP_ID, auth_code: code, secret: TIKTOK_APP_SECRET }),
      });
      const data = await res.json();
      if (data.code !== 0) throw new Error(data.message || "TikTok auth failed");

      const token = data.data.access_token;
      const advertisers = data.data.advertiser_ids || [];

      await supabase.from("platform_connections" as any).upsert({
        user_id, platform: "tiktok", access_token: token,
        ad_accounts: advertisers.map((id: string) => ({ id })),
        status: "active", connected_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000 * 30).toISOString(), // 30 days
      }, { onConflict: "user_id,platform" });

      return new Response(JSON.stringify({ success: true, advertiser_ids: advertisers }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get_connections") {
      const { data } = await supabase.from("platform_connections" as any)
        .select("platform, status, connected_at, ad_accounts").eq("user_id", user_id);
      return new Response(JSON.stringify({ connections: data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "pull_insights") {
      const { data: conn } = await supabase.from("platform_connections" as any)
        .select("access_token, ad_accounts").eq("user_id", user_id).eq("platform", "tiktok").single();
      if (!conn) throw new Error("TikTok not connected");

      const advertiserId = (conn.ad_accounts as any[])[0]?.id;
      if (!advertiserId) throw new Error("No advertiser found");

      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

      const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/", {
        method: "POST",
        headers: { "Access-Token": conn.access_token, "Content-Type": "application/json" },
        body: JSON.stringify({
          advertiser_id: advertiserId, report_type: "BASIC", data_level: "AUCTION_AD",
          dimensions: ["ad_id"], start_date: startDate, end_date: endDate,
          metrics: ["ad_name", "spend", "impressions", "clicks", "ctr", "cpc", "cpm", "video_play_actions", "hook_rate"],
          page_size: 50, page: 1,
        }),
      });
      const data = await res.json();
      return new Response(JSON.stringify({ success: true, insights: data?.data?.list || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
