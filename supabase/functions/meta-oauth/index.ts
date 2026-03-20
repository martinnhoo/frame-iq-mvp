import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Meta OAuth config
const META_APP_ID = Deno.env.get("META_APP_ID") || "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://adbrief.pro";
const REDIRECT_URI = `${APP_URL}/dashboard/loop/connect/meta/callback`;

// Scopes needed: read ad accounts and insights
const SCOPES = [
  "ads_read",
  "ads_management", 
  "business_management",
].join(",");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { action, code, user_id, state, persona_id } = await req.json();

    // ── Action: get_auth_url ──────────────────────────────────────────────────
    if (action === "get_auth_url") {
      // state encodes user_id and optional persona_id
      const stateParam = btoa(JSON.stringify({ user_id, persona_id: persona_id || null, ts: Date.now() }));
      
      const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
      url.searchParams.set("client_id", META_APP_ID);
      url.searchParams.set("redirect_uri", REDIRECT_URI);
      url.searchParams.set("scope", SCOPES);
      url.searchParams.set("state", stateParam);
      url.searchParams.set("response_type", "code");

      return new Response(JSON.stringify({ url: url.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: exchange_code ─────────────────────────────────────────────────
    if (action === "exchange_code") {
      // Exchange code for short-lived token
      const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
      tokenUrl.searchParams.set("client_id", META_APP_ID);
      tokenUrl.searchParams.set("client_secret", META_APP_SECRET);
      tokenUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      tokenUrl.searchParams.set("code", code);

      const tokenRes = await fetch(tokenUrl.toString());
      const tokenData = await tokenRes.json();

      if (tokenData.error) throw new Error(tokenData.error.message);

      // Exchange for long-lived token (~60 days)
      const longUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
      longUrl.searchParams.set("grant_type", "fb_exchange_token");
      longUrl.searchParams.set("client_id", META_APP_ID);
      longUrl.searchParams.set("client_secret", META_APP_SECRET);
      longUrl.searchParams.set("fb_exchange_token", tokenData.access_token);

      const longRes = await fetch(longUrl.toString());
      const longData = await longRes.json();
      if (longData.error) throw new Error(longData.error.message);

      const accessToken = longData.access_token;
      const expiresIn = longData.expires_in || 5184000; // 60 days default

      // Get user's ad accounts
      const accountsRes = await fetch(
        `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status,currency&access_token=${accessToken}`
      );
      const accountsData = await accountsRes.json();
      const adAccounts = accountsData.data || [];

      // Store connection in Supabase — persona_id optional
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      
      // Decode persona_id from state if present
      let storedPersonaId: string | null = null;
      try {
        if (state) {
          const decoded = JSON.parse(atob(state));
          storedPersonaId = decoded.persona_id || null;
        }
      } catch {}

      const upsertPayload: Record<string, any> = {
        user_id,
        platform: "meta",
        access_token: accessToken,
        expires_at: expiresAt,
        ad_accounts: adAccounts,
        status: "active",
        connected_at: new Date().toISOString(),
      };
      if (storedPersonaId) upsertPayload.persona_id = storedPersonaId;
      
      const { error: upsertError } = await supabase
        .from("platform_connections" as any)
        .upsert(upsertPayload, { onConflict: "user_id,platform" });

      if (upsertError) throw upsertError;

      return new Response(JSON.stringify({
        success: true,
        ad_accounts: adAccounts,
        expires_at: expiresAt,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: get_connections ───────────────────────────────────────────────
    if (action === "get_connections") {
      const { data, error } = await supabase
        .from("platform_connections" as any)
        .select("platform, status, connected_at, expires_at, ad_accounts")
        .eq("user_id", user_id);

      if (error) throw error;

      return new Response(JSON.stringify({ connections: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: disconnect ────────────────────────────────────────────────────
    if (action === "disconnect") {
      const { platform } = await req.json();
      await supabase
        .from("platform_connections" as any)
        .delete()
        .eq("user_id", user_id)
        .eq("platform", platform);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: pull_insights ─────────────────────────────────────────────────
    if (action === "pull_insights") {
      // Get stored token
      const { data: conn } = await supabase
        .from("platform_connections" as any)
        .select("access_token, ad_accounts")
        .eq("user_id", user_id)
        .eq("platform", "meta")
        .single();

      if (!conn) throw new Error("Meta not connected");

      const token = conn.access_token;
      const accounts = (conn.ad_accounts as any[]) || [];
      
      // Pull last 30 days insights for first active account
      const activeAccount = accounts.find((a: any) => a.account_status === 1) || accounts[0];
      if (!activeAccount) throw new Error("No active ad account found");

      const accountId = activeAccount.id;
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split("T")[0];
      const until = new Date().toISOString().split("T")[0];

      const fields = [
        "ad_name", "spend", "impressions", "clicks", "ctr",
        "cpc", "cpm", "actions", "cost_per_action_type",
        "video_play_actions", "video_avg_time_watched_actions",
      ].join(",");

      const insightsUrl = `https://graph.facebook.com/v19.0/${accountId}/insights?` +
        `level=ad&fields=${fields}&time_range={"since":"${since}","until":"${until}"}` +
        `&sort=spend_descending&limit=50&access_token=${token}`;

      const insightsRes = await fetch(insightsUrl);
      const insightsData = await insightsRes.json();

      if (insightsData.error) throw new Error(insightsData.error.message);

      return new Response(JSON.stringify({
        success: true,
        insights: insightsData.data || [],
        account: activeAccount,
        period: { since, until },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
