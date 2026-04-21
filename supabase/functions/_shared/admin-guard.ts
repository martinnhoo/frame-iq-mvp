/**
 * Admin cockpit auth guard.
 *
 * Every privileged edge function imports `requireAdmin` and short-circuits if
 * the caller isn't an active admin. On success, it returns a service-role
 * Supabase client (so the function can read across RLS) plus the admin's
 * auth user for logging.
 *
 * Usage:
 *   import { requireAdmin, logAdminAction, adminCors, jsonResponse } from "../_shared/admin-guard.ts";
 *
 *   Deno.serve(async (req) => {
 *     if (req.method === "OPTIONS") return new Response(null, { headers: adminCors });
 *
 *     const gate = await requireAdmin(req);
 *     if (!gate.ok) return gate.response;
 *     const { admin, supabase } = gate;
 *
 *     // ... do admin work ...
 *
 *     await logAdminAction(supabase, {
 *       admin_user_id: admin.id,
 *       action: "user_summary.view",
 *       target_user_id,
 *       metadata: { ... },
 *       req,
 *     });
 *     return jsonResponse({ data: result });
 *   });
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const adminCors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      ...adminCors,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export interface AdminContext {
  admin: { id: string; email: string | null };
  supabase: SupabaseClient;
}

export type GateResult =
  | ({ ok: true } & AdminContext)
  | { ok: false; response: Response };

/**
 * Validates the request JWT, looks up the user in admin_users, and returns a
 * service-role supabase client + the admin identity. If anything fails it
 * returns a ready-to-send error Response.
 */
export async function requireAdmin(req: Request): Promise<GateResult> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return {
      ok: false,
      response: jsonResponse(
        { error: "server_misconfigured" },
        { status: 500 }
      ),
    };
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, response: jsonResponse({ error: "unauthorized" }, { status: 401 }) };
  }
  const token = authHeader.slice(7);

  // Verify the JWT using the anon client (never trust client-provided user_id).
  const anon = createClient(SUPABASE_URL, ANON_KEY || SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await anon.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false, response: jsonResponse({ error: "unauthorized" }, { status: 401 }) };
  }
  const authUser = userData.user;

  // Service-role client bypasses RLS so we can read admin_users + target data.
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Must be an active admin (row present AND revoked_at IS NULL).
  const { data: adminRow, error: adminErr } = await supabase
    .from("admin_users")
    .select("user_id, revoked_at")
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (adminErr) {
    return {
      ok: false,
      response: jsonResponse({ error: "admin_lookup_failed" }, { status: 500 }),
    };
  }
  if (!adminRow || adminRow.revoked_at) {
    // 404 on purpose — don't reveal that the endpoint exists to non-admins.
    return { ok: false, response: jsonResponse({ error: "not_found" }, { status: 404 }) };
  }

  return {
    ok: true,
    admin: { id: authUser.id, email: authUser.email ?? null },
    supabase,
  };
}

export interface LogAdminActionInput {
  admin_user_id: string;
  action: string;
  target_user_id?: string | null;
  target_resource?: string | null;
  target_resource_id?: string | null;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export async function logAdminAction(
  supabase: SupabaseClient,
  input: LogAdminActionInput
): Promise<void> {
  const ip = input.req ? extractClientIp(input.req) : null;
  const ua = input.req?.headers.get("user-agent") ?? null;
  const requestId = input.req?.headers.get("x-request-id") ?? null;

  try {
    const { error } = await supabase.from("admin_audit_log").insert({
      admin_user_id: input.admin_user_id,
      action: input.action,
      target_user_id: input.target_user_id ?? null,
      target_resource: input.target_resource ?? null,
      target_resource_id: input.target_resource_id ?? null,
      metadata: input.metadata ?? {},
      ip,
      user_agent: ua,
      request_id: requestId,
    });
    if (error) {
      console.error("[admin-audit] insert failed:", error.message);
    }
  } catch (e) {
    // Audit failures must never block the admin action itself — just log.
    console.error("[admin-audit] unexpected:", e);
  }
}

function extractClientIp(req: Request): string | null {
  // Supabase Edge Runtime forwards client IP in x-forwarded-for (comma list).
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}
