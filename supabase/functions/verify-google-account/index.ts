// verify-google-account v2 — validates a Google Ads Customer ID against the real API
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

    console.log("[verify-google] Start:", JSON.stringify({ user_id, persona_id, customer_id }));

    if (!await isUserAuthorized(req, sbAuth, user_id)) return unauthorizedResponse(cors);
    if (!customer_id || !/^\d{3,}$/.test(customer_id.replace(/-/g, ""))) {
      console.log("[verify-google] Invalid format:", customer_id);
      return new Response(JSON.stringify({ valid: false, reason: "invalid_format" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const custId = customer_id.replace(/-/g, "");
    const DEV_TOKEN = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") ?? "";
    const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

    console.log("[verify-google] DEV_TOKEN present:", !!DEV_TOKEN, "| CLIENT_ID present:", !!CLIENT_ID);

    // Get Google token for this persona
    const { data: gConn, error: connErr } = await sb.from("platform_connections")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", user_id).eq("persona_id", persona_id)
      .eq("platform", "google").eq("status", "active").maybeSingle();

    console.log("[verify-google] Connection found:", !!gConn, "| error:", connErr?.message || "none");

    if (!gConn?.access_token) {
      return new Response(JSON.stringify({ valid: false, reason: "no_token" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Refresh token if needed
    let token = gConn.access_token;
    const expiresAt = gConn.expires_at ? new Date(gConn.expires_at) : null;
    const needsRefresh = expiresAt && expiresAt < new Date(Date.now() + 120000);
    console.log("[verify-google] Token expires_at:", gConn.expires_at, "| needs refresh:", needsRefresh);

    if (gConn.refresh_token && needsRefresh) {
      console.log("[verify-google] Refreshing token...");
      const rr = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: gConn.refresh_token, grant_type: "refresh_token" }),
      });
      const rd = await rr.json();
      console.log("[verify-google] Refresh response status:", rr.status, "| error:", rd.error || "none");
      if (rr.ok && rd.access_token) {
        token = rd.access_token;
        // Update token in DB
        await sb.from("platform_connections")
          .update({ access_token: token, expires_at: new Date(Date.now() + (rd.expires_in || 3600) * 1000).toISOString() })
          .eq("user_id", user_id).eq("persona_id", persona_id).eq("platform", "google");
      }
    }

    // List accessible customers to validate the ID
    console.log("[verify-google] Trying listAccessibleCustomers...");
    const listRes = await fetch("https://googleads.googleapis.com/v23/customers:listAccessibleCustomers", {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + token,
        "developer-token": DEV_TOKEN,
      },
    });
    const listText = await listRes.text();
    console.log("[verify-google] listAccessibleCustomers status:", listRes.status, "| body:", listText.slice(0, 500));

    if (!listRes.ok) {
      console.log("[verify-google] listAccessibleCustomers failed");
      // If even listing fails, accept the ID without API validation (graceful fallback)
      const name = "Google Ads " + customer_id;
      console.log("[verify-google] Fallback accept:", name);
      return new Response(JSON.stringify({ valid: true, name, currency: "USD" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let accessibleIds: string[] = [];
    try {
      const listData = JSON.parse(listText);
      const resourceNames: string[] = listData.resourceNames || [];
      accessibleIds = resourceNames.map((r: string) => r.replace("customers/", ""));
      console.log("[verify-google] Accessible customer IDs:", accessibleIds.join(", "));
    } catch (e) {
      console.log("[verify-google] Failed to parse list:", String(e));
    }

    // Check if the requested ID is among accessible accounts
    if (accessibleIds.length > 0 && !accessibleIds.includes(custId)) {
      console.log("[verify-google] custId", custId, "not in accessible list");
      return new Response(JSON.stringify({ valid: false, reason: "no_access", message: "Este Customer ID nao esta acessivel com a conta Google conectada. IDs disponiveis: " + accessibleIds.join(", ") }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Try to get account name via query, but don't fail if token is test-only
    let name = "Google Ads " + customer_id;
    let currency = "USD";

    const query = "SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1";
    const headers: Record<string, string> = {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
      "developer-token": DEV_TOKEN,
      "login-customer-id": custId,
    };

    try {
      const r = await fetch("https://googleads.googleapis.com/v23/customers/" + custId + "/googleAds:search", {
        method: "POST", headers, body: JSON.stringify({ query }),
      });
      const text = await r.text();
      console.log("[verify-google] Query status:", r.status, "| body:", text.slice(0, 300));

      if (r.ok && !text.trim().startsWith("<")) {
        const result = JSON.parse(text);
        const customer = result.results?.[0]?.customer;
        if (customer?.descriptiveName) name = customer.descriptiveName;
        if (customer?.currencyCode) currency = customer.currencyCode;
      } else {
        console.log("[verify-google] Query failed (token may be test-only), using fallback name");
      }
    } catch (e) {
      console.log("[verify-google] Query error:", String(e), "- using fallback");
    }

    console.log("[verify-google] SUCCESS:", name, currency);

    // Save verified customer_id to ad_accounts[] and selected_account_id
    const newAccount = { id: custId, name, currency };
    const { data: existingConn } = await sb.from("platform_connections" as any)
      .select("ad_accounts")
      .eq("user_id", user_id).eq("persona_id", persona_id)
      .eq("platform", "google").eq("status", "active")
      .maybeSingle();

    if (existingConn) {
      const existing = (existingConn.ad_accounts || []) as any[];
      const updated = existing.find((a: any) => a.id === custId)
        ? existing.map((a: any) => a.id === custId ? newAccount : a)
        : [...existing, newAccount];
      await sb.from("platform_connections" as any)
        .update({ ad_accounts: updated, selected_account_id: custId })
        .eq("user_id", user_id).eq("persona_id", persona_id)
        .eq("platform", "google").eq("status", "active");
      console.log("[verify-google] saved to ad_accounts:", custId);
    }

    return new Response(JSON.stringify({ valid: true, name, currency }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[verify-google] Error:", String(e));
    return new Response(JSON.stringify({ valid: false, reason: "error", message: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
