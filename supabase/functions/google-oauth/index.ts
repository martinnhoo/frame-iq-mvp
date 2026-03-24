// google-oauth v2.1 — persona_id isolation, Google Ads API v17, force redeploy
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLIENT_ID     = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const DEV_TOKEN     = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") || "";
const APP_URL       = Deno.env.get("APP_URL") || "https://www.adbrief.pro";
const REDIRECT_URI  = `${APP_URL}/dashboard/loop/connect/google/callback`;
const SCOPES        = "https://www.googleapis.com/auth/adwords";
const GADS_VERSION  = "v17";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const json = await req.json().catch(() => ({}));
    const { action, code, user_id, persona_id } = json;

    // ── get_auth_url ─────────────────────────────────────────────────────────
    if (action === "get_auth_url") {
      if (!user_id || !persona_id) {
        return new Response(JSON.stringify({ error: "user_id and persona_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const state = btoa(JSON.stringify({ user_id, persona_id, ts: Date.now() }));
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", CLIENT_ID);
      url.searchParams.set("redirect_uri", REDIRECT_URI);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", SCOPES);
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("state", state);
      return new Response(JSON.stringify({ url: url.toString() }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── exchange_code ─────────────────────────────────────────────────────────
    if (action === "exchange_code") {
      // Decode state
      let storedUserId = user_id;
      let storedPersonaId = persona_id;
      if (json.state) {
        try {
          const decoded = JSON.parse(atob(json.state));
          storedUserId = decoded.user_id || storedUserId;
          storedPersonaId = decoded.persona_id || storedPersonaId;
        } catch {}
      }
      if (!storedPersonaId) {
        return new Response(JSON.stringify({ error: "persona_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

      const { access_token, refresh_token, expires_in } = tokenData;

      // Get accessible customer accounts
      const custRes = await fetch(`https://googleads.googleapis.com/${GADS_VERSION}/customers:listAccessibleCustomers`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "developer-token": DEV_TOKEN,
        },
      });
      const custData = await custRes.json();

      // Build accounts from customer list — best-effort detail enrichment
      const customerIds: string[] = (custData.resourceNames || []).map((r: string) => r.replace("customers/", ""));
      const ad_accounts: any[] = customerIds.slice(0, 20).map((cid: string) => ({
        id: cid,
        name: `Google Ads ${cid}`,
      }));

      // Try to enrich first 3 accounts with name/currency (best-effort)
      for (let i = 0; i < Math.min(ad_accounts.length, 3); i++) {
        try {
          const cid = ad_accounts[i].id;
          const detailRes = await fetch(`https://googleads.googleapis.com/${GADS_VERSION}/customers/${cid}`, {
            headers: { Authorization: `Bearer ${access_token}`, "developer-token": DEV_TOKEN, "login-customer-id": cid },
          });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            if (!detail.error && detail.descriptiveName) {
              ad_accounts[i].name = detail.descriptiveName;
              ad_accounts[i].currency = detail.currencyCode;
              ad_accounts[i].manager = detail.manager || false;
            }
          }
        } catch { /* best-effort, skip if fails */ }
      }

      // Upsert scoped to persona_id
      const payload = {
        user_id: storedUserId,
        platform: "google",
        persona_id: storedPersonaId,
        access_token,
        refresh_token,
        expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        ad_accounts,
        status: "active",
        connected_at: new Date().toISOString(),
      };

      let { error: upsertError } = await sb.from("platform_connections" as any)
        .upsert(payload, { onConflict: "user_id,platform,persona_id" });

      if (upsertError) {
        await sb.from("platform_connections" as any)
          .update(payload)
          .eq("user_id", storedUserId)
          .eq("platform", "google")
          .eq("persona_id", storedPersonaId);
      }

      return new Response(JSON.stringify({ success: true, ad_accounts }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── refresh_token ─────────────────────────────────────────────────────────
    if (action === "refresh_token") {
      const { data: conn } = await sb.from("platform_connections" as any)
        .select("refresh_token").eq("user_id", user_id).eq("platform", "google")
        .eq("persona_id", persona_id).maybeSingle();
      if (!conn?.refresh_token) throw new Error("No refresh token");

      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ refresh_token: conn.refresh_token, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: "refresh_token" }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      await sb.from("platform_connections" as any).update({
        access_token: data.access_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      }).eq("user_id", user_id).eq("platform", "google").eq("persona_id", persona_id);

      return new Response(JSON.stringify({ success: true, access_token: data.access_token }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── disconnect ────────────────────────────────────────────────────────────
    if (action === "disconnect") {
      await sb.from("platform_connections" as any)
        .delete().eq("user_id", user_id).eq("platform", "google").eq("persona_id", persona_id);
      return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e: any) {
    console.error("google-oauth error:", e.message, e.stack);
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
