// verify-google-account — validates a Google Ads Customer ID against the real API
import { createClient } from "npm:@supabase/supabase-js@2";
import { isUserAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const sbAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { user_id, persona_id, customer_id } = await req.json();

    if (!await isUserAuthorized(req, sbAuth, user_id)) return unauthorizedResponse(cors);
    if (!customer_id || !/^\d{10}$/.test(customer_id.replace(/-/g, ""))) {
      return new Response(JSON.stringify({ valid: false, reason: "invalid_format" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const custId = customer_id.replace(/-/g, "");
    const DEV_TOKEN = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") ?? "";
    const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

    // Get Google token for this persona
    const { data: gConn } = await sb.from("platform_connections" as any)
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", user_id).eq("persona_id", persona_id)
      .eq("platform", "google").eq("status", "active").maybeSingle();

    if (!gConn?.access_token) {
      return new Response(JSON.stringify({ valid: false, reason: "no_token" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Refresh token if needed
    let token = gConn.access_token;
    if (gConn.refresh_token && gConn.expires_at && new Date(gConn.expires_at) < new Date(Date.now() + 60000)) {
      const rr = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: gConn.refresh_token, grant_type: "refresh_token" }),
      });
      if (rr.ok) { const rd = await rr.json(); if (rd.access_token) token = rd.access_token; }
    }

    // Query the account info
    const query = "SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1";
    const tryQuery = async (withLoginId: boolean) => {
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "developer-token": DEV_TOKEN,
      };
      if (withLoginId) headers["login-customer-id"] = custId;
      const r = await fetch(`https://googleads.googleapis.com/v19/customers/${custId}/googleAds:search`, {
        method: "POST", headers, body: JSON.stringify({ query }),
      });
      const text = await r.text();
      if (text.trim().startsWith("<")) return null;
      return JSON.parse(text);
    };

    let result = await tryQuery(false);
    if (!result) result = await tryQuery(true);

    if (!result) {
      return new Response(JSON.stringify({ valid: false, reason: "not_found" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (result.error) {
      const status = result.error?.status || "";
      const reason = status === "PERMISSION_DENIED" ? "no_access" : "not_found";
      return new Response(JSON.stringify({ valid: false, reason, message: result.error?.message }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const customer = result.results?.[0]?.customer;
    if (!customer) {
      return new Response(JSON.stringify({ valid: false, reason: "not_found" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const name = customer.descriptiveName
      ? `${customer.descriptiveName}`
      : `Account ${custId}`;

    return new Response(JSON.stringify({ valid: true, name, currency: customer.currencyCode || "USD" }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ valid: false, reason: "error", message: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
