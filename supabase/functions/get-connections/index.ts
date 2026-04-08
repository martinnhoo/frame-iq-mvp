// get-connections — lê platform_connections com service_role (bypassa RLS)
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { user_id, persona_id } = await req.json();
    if (!user_id || !persona_id) return new Response(
      JSON.stringify({ error: "missing params" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );

    // Validate ownership
    const { data: persona } = await sb.from("personas")
      .select("id").eq("id", persona_id).eq("user_id", user_id).maybeSingle();
    if (!persona) return new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
    );

    // service_role bypasses RLS — always works
    const { data: conns } = await sb
      .from("platform_connections")
      .select("id, platform, status, ad_accounts, selected_account_id, connection_label, connected_at, expires_at")
      .eq("user_id", user_id)
      .eq("persona_id", persona_id)
      .eq("status", "active");

    return new Response(
      JSON.stringify({ ok: true, connections: conns || [] }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
