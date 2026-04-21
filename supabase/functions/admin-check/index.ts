/**
 * admin-check — cheap boolean endpoint the frontend calls on every cockpit
 * route mount. Returns { admin: true/false, email }. Does NOT write to the
 * audit log (too chatty; real admin actions log their own entries).
 *
 * Security: validates JWT, looks up admin_users. Returns 200 with
 * { admin:false } for non-admins — never 403 — so the absence/presence of
 * the endpoint can't be used to enumerate admins.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ admin: false, error: "misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ admin: false });
  }
  const token = authHeader.slice(7);

  // Validate the JWT (anon client so we can't accidentally trust a forged user_id).
  const anon = createClient(SUPABASE_URL, ANON_KEY || SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await anon.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json({ admin: false });
  }
  const user = userData.user;

  // Look up admin_users with service role.
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: row } = await supabase
    .from("admin_users")
    .select("user_id, revoked_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const isAdmin = !!row && !row.revoked_at;

  return json({
    admin: isAdmin,
    email: isAdmin ? user.email ?? null : null,
  });
});
