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

    // First try: list accessible customers (doesn't require knowing the customer ID)
    console.log("[verify-google] Trying listAccessibleCustomers first...");
    const listRes = await fetch("https://googleads.googleapis.com/v23/customers:listAccessibleCustomers", {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + token,
        "developer-token": DEV_TOKEN,
      },
    });
    const listText = await listRes.text();
    console.log("[verify-google] listAccessibleCustomers status:", listRes.status, "| body:", listText.slice(0, 500));

    let loginCustomerId = "";
    if (listRes.ok) {
      try {
        const listData = JSON.parse(listText);
        const resourceNames: string[] = listData.resourceNames || [];
        const accessibleIds = resourceNames.map((r: string) => r.replace("customers/", ""));
        console.log("[verify-google] Accessible customer IDs:", accessibleIds.join(", "));

        // Check if the requested customer ID is directly accessible
        if (!accessibleIds.includes(custId)) {
          // The custId might be under a manager account — try using each accessible ID as login-customer-id
          console.log("[verify-google] custId", custId, "not directly accessible, will try with manager accounts");
          // Use the first accessible account as the login-customer-id (typically MCC)
          if (accessibleIds.length > 0) {
            loginCustomerId = accessibleIds[0];
          }
        }
      } catch (e) {
        console.log("[verify-google] Failed to parse listAccessibleCustomers:", String(e));
      }
    }

    // Query the account info
    const query = "SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1";
    
    const tryQuery = async (loginId: string) => {
      const headers: Record<string, string> = {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "developer-token": DEV_TOKEN,
      };
      if (loginId) headers["login-customer-id"] = loginId;
      
      console.log("[verify-google] Querying custId:", custId, "| login-customer-id:", loginId || "(none)");
      
      const r = await fetch("https://googleads.googleapis.com/v23/customers/" + custId + "/googleAds:search", {
        method: "POST", headers, body: JSON.stringify({ query }),
      });
      const text = await r.text();
      console.log("[verify-google] Query response status:", r.status, "| body:", text.slice(0, 500));
      
      if (text.trim().startsWith("<")) return null;
      try { return JSON.parse(text); } catch { return null; }
    };

    // Try without login-customer-id first
    let result = await tryQuery("");
    
    // If failed and we have a login customer ID, try with it
    if (!result || result.error) {
      if (loginCustomerId && loginCustomerId !== custId) {
        console.log("[verify-google] Retrying with login-customer-id:", loginCustomerId);
        result = await tryQuery(loginCustomerId);
      }
    }
    
    // Also try with custId as login-customer-id
    if (!result || result.error) {
      console.log("[verify-google] Retrying with custId as login-customer-id");
      result = await tryQuery(custId);
    }

    if (!result) {
      return new Response(JSON.stringify({ valid: false, reason: "not_found" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (result.error) {
      const status = result.error?.status || "";
      const msg = result.error?.message || "";
      console.log("[verify-google] API error:", status, msg);
      const reason = status === "PERMISSION_DENIED" ? "no_access" : "not_found";
      return new Response(JSON.stringify({ valid: false, reason, message: msg }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const customer = result.results?.[0]?.customer;
    if (!customer) {
      console.log("[verify-google] No customer in results");
      return new Response(JSON.stringify({ valid: false, reason: "not_found" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const name = customer.descriptiveName
      ? customer.descriptiveName
      : "Account " + custId;

    console.log("[verify-google] SUCCESS:", name, customer.currencyCode);

    return new Response(JSON.stringify({ valid: true, name, currency: customer.currencyCode || "USD" }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[verify-google] Error:", String(e));
    return new Response(JSON.stringify({ valid: false, reason: "error", message: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
