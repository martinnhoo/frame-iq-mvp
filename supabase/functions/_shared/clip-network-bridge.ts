import { createClient } from "npm:@supabase/supabase-js@2";

const NEW_SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const NEW_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const LEGACY_SUPABASE_URL = "https://mtrovtowcpttdqygtrwq.supabase.co";
const LEGACY_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10cm92dG93Y3B0dGRxeWd0cndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTU5MjgsImV4cCI6MjA4ODU5MTkyOH0.lgMpc0SGlgXjvShD-1cZpZBENJtbT5TthtmOhoaAXsQ";

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

  const response = await fetch(`${LEGACY_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: authorization,
      apikey: LEGACY_ANON_KEY,
    },
  });

  if (!response.ok) throw new Error("unauthorized");

  const user = await response.json();
  if (!user?.id) throw new Error("unauthorized");

  return {
    supabase: clipServiceClient(),
    user: user as { id: string; email?: string },
  };
}
