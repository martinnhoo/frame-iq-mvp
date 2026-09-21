import { createClient } from "npm:@supabase/supabase-js@2";

const NEW_SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const NEW_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export const clipCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...clipCors, "Content-Type": "application/json" },
  });
}

export function clipServiceClient() {
  return createClient(NEW_SUPABASE_URL, NEW_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireClipBridgeUser(req: Request) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("unauthorized");

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new Error("unauthorized");

  const supabase = clipServiceClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user?.id) throw new Error("unauthorized");

  return {
    supabase,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  };
}
