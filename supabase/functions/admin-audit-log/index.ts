/**
 * admin-audit-log — paginated viewer over admin_audit_log.
 *
 * Input (POST JSON, all fields optional):
 *   {
 *     page?: number,             // default 1
 *     page_size?: number,        // default 50, max 200
 *     admin_user_id?: string,    // filter by admin who performed the action
 *     target_user_id?: string,   // filter by user who was the target
 *     action?: string,           // e.g. "user_summary.view"
 *     action_prefix?: string,    // e.g. "users." — matches "users.list", "users.*"
 *     since?: string,            // ISO — only entries at/after this timestamp
 *     until?: string,            // ISO — only entries before this timestamp
 *   }
 *
 * Output:
 *   {
 *     data: {
 *       rows: Array<{
 *         id, created_at, action, metadata, ip, user_agent, request_id,
 *         admin: { user_id, email|null },
 *         target: { user_id|null, email|null, resource|null, resource_id|null },
 *       }>,
 *       page, page_size, total_count, total_pages
 *     }
 *   }
 *
 * Does NOT write a log entry for itself — this endpoint is the log, and the
 * cockpit already captures the viewer via "audit_log.view" at the page level
 * if Martinho wants (disabled by default because it creates noise).
 */

import {
  requireAdmin,
  jsonResponse,
  adminCors,
} from "../_shared/admin-guard.ts";

interface LogBody {
  page?: number;
  page_size?: number;
  admin_user_id?: string;
  target_user_id?: string;
  action?: string;
  action_prefix?: string;
  since?: string;
  until?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: adminCors });
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, { status: 405 });
  }

  let body: LogBody = {};
  try {
    body = await req.json();
  } catch {
    // empty body OK
  }

  const page = Math.max(1, Math.floor(body.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(body.page_size ?? 50)));

  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;
  const { supabase } = gate;

  // ── 1. Build query ───────────────────────────────────────────────────────
  let q = supabase
    .from("admin_audit_log")
    .select(
      "id, created_at, admin_user_id, action, target_user_id, target_resource, target_resource_id, metadata, ip, user_agent, request_id",
      { count: "exact" }
    );

  if (body.admin_user_id) q = q.eq("admin_user_id", body.admin_user_id);
  if (body.target_user_id) q = q.eq("target_user_id", body.target_user_id);
  if (body.action) q = q.eq("action", body.action);
  if (body.action_prefix) {
    const safe = body.action_prefix.replace(/[%,]/g, "");
    q = q.like("action", `${safe}%`);
  }
  if (body.since) q = q.gte("created_at", body.since);
  if (body.until) q = q.lt("created_at", body.until);

  q = q.order("created_at", { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.range(from, to);

  const { data: rows, count: totalCount, error } = await q;
  if (error) {
    return jsonResponse(
      { error: "audit_query_failed", detail: error.message },
      { status: 500 }
    );
  }

  // ── 2. Enrich with admin + target emails (one batched lookup each) ──────
  const adminIds = new Set<string>();
  const targetIds = new Set<string>();
  for (const r of (rows ?? []) as Array<any>) {
    if (r.admin_user_id) adminIds.add(r.admin_user_id);
    if (r.target_user_id) targetIds.add(r.target_user_id);
  }

  const emailById = new Map<string, string>();

  // Use auth admin listUsers once; cheaper than N calls for dashboard-sized
  // audit windows, and works without joining auth.users via SQL.
  if (adminIds.size + targetIds.size > 0) {
    try {
      const { data: list } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      for (const u of list?.users ?? []) {
        if (adminIds.has(u.id) || targetIds.has(u.id)) {
          emailById.set(u.id, u.email ?? "");
        }
      }
    } catch (_e) {
      // Soft-fail — still return rows, just without emails.
    }
  }

  const enriched = (rows ?? []).map((r: any) => ({
    id: r.id,
    created_at: r.created_at,
    action: r.action,
    metadata: r.metadata ?? {},
    ip: r.ip ?? null,
    user_agent: r.user_agent ?? null,
    request_id: r.request_id ?? null,
    admin: {
      user_id: r.admin_user_id,
      email: emailById.get(r.admin_user_id) ?? null,
    },
    target: {
      user_id: r.target_user_id ?? null,
      email: r.target_user_id ? emailById.get(r.target_user_id) ?? null : null,
      resource: r.target_resource ?? null,
      resource_id: r.target_resource_id ?? null,
    },
  }));

  const total = totalCount ?? 0;
  return jsonResponse({
    data: {
      rows: enriched,
      page,
      page_size: pageSize,
      total_count: total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
});
