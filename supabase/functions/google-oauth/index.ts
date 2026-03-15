import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://www.adbrief.pro";
const REDIRECT_URI = `${APP_URL}/dashboard/loop/connect/google/callback`;
const SCOPES = "https://www.googleapis.com/auth/adwords";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { action, code, user_id } = await req.json();

    if (action === "get_auth_url") {
      const state = btoa(JSON.stringify({ user_id, ts: Date.now() }));
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      url.searchParams.set("redirect_uri", REDIRECT_URI);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", SCOPES);
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("state", state);
      return new Response(JSON.stringify({ url: url.toString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "exchange_code") {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

      const { access_token, refresh_token, expires_in } = tokenData;

      // Get customer list from Google Ads
      const custRes = await fetch("https://googleads.googleapis.com/v16/customers:listAccessibleCustomers", {
        headers: { Authorization: `Bearer ${access_token}`, "developer-token": Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") || "" },
      });
      const custData = await custRes.json();
      const customers = (custData.resourceNames || []).map((r: string) => ({ id: r.replace("customers/", ""), resource: r }));

      await supabase.from("platform_connections" as any).upsert({
        user_id, platform: "google", access_token, refresh_token,
        expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        ad_accounts: customers, status: "active", connected_at: new Date().toISOString(),
      }, { onConflict: "user_id,platform" });

      return new Response(JSON.stringify({ success: true, customers }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "refresh_token") {
      const { data: conn } = await supabase.from("platform_connections" as any)
        .select("refresh_token").eq("user_id", user_id).eq("platform", "google").single();
      if (!conn?.refresh_token) throw new Error("No refresh token");

      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ refresh_token: conn.refresh_token, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, grant_type: "refresh_token" }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      await supabase.from("platform_connections" as any).update({
        access_token: data.access_token, expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      }).eq("user_id", user_id).eq("platform", "google");

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
