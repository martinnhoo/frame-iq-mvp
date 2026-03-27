/**
 * Shared cron/service auth guard for AdBrief edge functions.
 *
 * Usage:
 *   import { isCronAuthorized, isUserAuthorized } from "../_shared/cron-auth.ts";
 *
 * For cron-only functions (never called by users):
 *   if (!isCronAuthorized(req)) return unauthorized();
 *
 * For functions called both by cron AND authenticated users:
 *   const ok = isCronAuthorized(req) || await isUserAuthorized(req, supabase, user_id);
 *   if (!ok) return unauthorized();
 */

export function isCronAuthorized(req: Request): boolean {
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // Allow service role key (used by pg_cron + internal invocations)
  if (serviceKey && authHeader === `Bearer ${serviceKey}`) return true;

  // Allow explicit CRON_SECRET header for external schedulers
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const xCron = req.headers.get("X-Cron-Secret");
    if (xCron === cronSecret) return true;
  }

  return false;
}

export async function isUserAuthorized(
  req: Request,
  supabase: any,
  expected_user_id?: string
): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;
  if (expected_user_id && user.id !== expected_user_id) return false;
  return true;
}

export function unauthorizedResponse(cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
