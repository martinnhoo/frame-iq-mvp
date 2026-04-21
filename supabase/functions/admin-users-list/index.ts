/**
 * admin-users-list — paginated, searchable, filterable user directory for the
 * cockpit. Returns 50 per page by default, sorted by signup desc.
 *
 * Input (POST JSON, all fields optional):
 *   {
 *     page?: number,               // default 1
 *     page_size?: number,          // default 50, max 200
 *     search?: string,             // matches email OR name (ilike)
 *     plan?: string | "any",       // free | maker | pro | studio | any
 *     status?: string | "any",     // active | trialing | past_due | canceled | any
 *     has_meta?: boolean,          // true = only users with ≥1 ad_account
 *     inactive_7d?: boolean,       // true = last_ai_action_at older than 7d (or null)
 *     signup_since?: string,       // ISO date — only users who signed up after
 *     sort?: "signup_desc" | "signup_asc" | "last_action_desc" | "plan_asc",
 *   }
 *
 * Output:
 *   {
 *     data: {
 *       rows: Array<{
 *         user_id, email, name, avatar_url, plan, subscription_status,
 *         trial_end, current_period_end,
 *         signup_at, email_confirmed, last_sign_in_at, last_ai_action_at,
 *         meta_accounts_count, meta_connected,
 *         chats_7d, actions_7d,
 *         flags: { inactive_7d, no_meta, past_due, trial_ending_soon },
 *       }>,
 *       page, page_size, total_count, total_pages,
 *     }
 *   }
 *
 * Notes on performance:
 *   - We page the `profiles` table first (stable, indexed).
 *   - chats_7d / actions_7d are computed by pulling raw rows for the current
 *     page's user_ids and counting in-memory. 7-day windows keep the set small.
 *   - meta_accounts_count uses one aggregated query over the page's user_ids.
 *
 * Writes a single audit log entry per call.
 */

import {
  requireAdmin,
  logAdminAction,
  jsonResponse,
  adminCors,
} from "../_shared/admin-guard.ts";

type SortKey = "signup_desc" | "signup_asc" | "last_action_desc" | "plan_asc";

interface ListBody {
  page?: number;
  page_size?: number;
  search?: string;
  plan?: string;
  status?: string;
  has_meta?: boolean;
  inactive_7d?: boolean;
  signup_since?: string;
  sort?: SortKey;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: adminCors });
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, { status: 405 });
  }

  let body: ListBody = {};
  try {
    body = await req.json();
  } catch {
    // Allow empty body — defaults kick in.
  }

  const page = Math.max(1, Math.floor(body.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(body.page_size ?? 50)));
  const search = (body.search ?? "").trim();
  const plan = body.plan && body.plan !== "any" ? body.plan : null;
  const status = body.status && body.status !== "any" ? body.status : null;
  const hasMeta = body.has_meta === true;
  const inactive7d = body.inactive_7d === true;
  const signupSince = body.signup_since ?? null;
  const sort: SortKey = body.sort ?? "signup_desc";

  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;
  const { admin, supabase } = gate;

  const now = new Date();
  const iso7d = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();

  // ── 1. Build profiles query ──────────────────────────────────────────────
  // We intentionally keep the column set tight to minimize payload.
  let q = supabase
    .from("profiles")
    .select(
      "id, email, name, avatar_url, plan, subscription_status, trial_end, current_period_end, plan_started_at, last_ai_action_at, created_at",
      { count: "exact" }
    );

  if (search) {
    // Escape % and , which have special meaning in PostgREST `or` filter strings.
    const safe = search.replace(/[%,]/g, " ").trim();
    if (safe) {
      q = q.or(`email.ilike.%${safe}%,name.ilike.%${safe}%`);
    }
  }
  if (plan) q = q.eq("plan", plan);
  if (status) q = q.eq("subscription_status", status);
  if (signupSince) q = q.gte("created_at", signupSince);

  // inactive_7d is an "OR null" filter — PostgREST: `or(last_ai_action_at.lt.X,last_ai_action_at.is.null)`.
  if (inactive7d) {
    q = q.or(`last_ai_action_at.lt.${iso7d},last_ai_action_at.is.null`);
  }

  // Sort
  switch (sort) {
    case "signup_asc":
      q = q.order("created_at", { ascending: true });
      break;
    case "last_action_desc":
      q = q.order("last_ai_action_at", { ascending: false, nullsFirst: false });
      break;
    case "plan_asc":
      q = q.order("plan", { ascending: true }).order("created_at", { ascending: false });
      break;
    case "signup_desc":
    default:
      q = q.order("created_at", { ascending: false });
      break;
  }

  // Pagination (inclusive range)
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.range(from, to);

  const { data: profileRows, count: totalCount, error: profileErr } = await q;
  if (profileErr) {
    return jsonResponse(
      { error: "profiles_query_failed", detail: profileErr.message },
      { status: 500 }
    );
  }

  const userIds = (profileRows ?? []).map((p: any) => p.id);

  // ── 2. Enrich: meta accounts count + chats/actions in last 7d ────────────
  const [metaAcctsRes, chat7dRes, action7dRes] = await Promise.all([
    userIds.length
      ? supabase
          .from("ad_accounts")
          .select("user_id, id, status, last_fast_sync_at")
          .in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),

    userIds.length
      ? supabase
          .from("chat_messages")
          .select("user_id")
          .in("user_id", userIds)
          .gte("created_at", iso7d)
      : Promise.resolve({ data: [], error: null }),

    userIds.length
      ? supabase
          .from("action_log")
          .select("user_id")
          .in("user_id", userIds)
          .gte("executed_at", iso7d)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const metaCountByUser: Record<string, number> = {};
  const metaHasSyncedByUser: Record<string, boolean> = {};
  for (const a of (metaAcctsRes.data ?? []) as Array<any>) {
    metaCountByUser[a.user_id] = (metaCountByUser[a.user_id] ?? 0) + 1;
    if (a.last_fast_sync_at) metaHasSyncedByUser[a.user_id] = true;
  }
  const chats7dByUser: Record<string, number> = {};
  for (const c of (chat7dRes.data ?? []) as Array<{ user_id: string }>) {
    chats7dByUser[c.user_id] = (chats7dByUser[c.user_id] ?? 0) + 1;
  }
  const actions7dByUser: Record<string, number> = {};
  for (const a of (action7dRes.data ?? []) as Array<{ user_id: string }>) {
    actions7dByUser[a.user_id] = (actions7dByUser[a.user_id] ?? 0) + 1;
  }

  // ── 3. Compose rows + apply has_meta filter if requested ─────────────────
  // has_meta is applied post-filter (not on the profiles query) so it works
  // alongside all other filters without a join.
  const composed = (profileRows ?? []).map((p: any) => {
    const metaCount = metaCountByUser[p.id] ?? 0;
    const lastAction = p.last_ai_action_at;
    const inactive =
      !lastAction || new Date(lastAction).getTime() < now.getTime() - 7 * 24 * 3600 * 1000;
    const trialEndMs = p.trial_end ? new Date(p.trial_end).getTime() : null;
    const trialEndingSoon =
      trialEndMs !== null &&
      trialEndMs >= now.getTime() &&
      trialEndMs - now.getTime() <= 3 * 24 * 3600 * 1000;

    return {
      user_id: p.id,
      email: p.email ?? null,
      name: p.name ?? null,
      avatar_url: p.avatar_url ?? null,
      plan: p.plan ?? "free",
      subscription_status: p.subscription_status ?? null,
      trial_end: p.trial_end ?? null,
      current_period_end: p.current_period_end ?? null,
      signup_at: p.created_at,
      last_ai_action_at: lastAction ?? null,
      meta_accounts_count: metaCount,
      meta_connected: metaCount > 0,
      meta_has_synced: !!metaHasSyncedByUser[p.id],
      chats_7d: chats7dByUser[p.id] ?? 0,
      actions_7d: actions7dByUser[p.id] ?? 0,
      flags: {
        inactive_7d: inactive,
        no_meta: metaCount === 0,
        past_due: p.subscription_status === "past_due",
        trial_ending_soon: trialEndingSoon,
      },
    };
  });

  const filtered = hasMeta ? composed.filter((r) => r.meta_connected) : composed;

  // ── 4. Audit log ─────────────────────────────────────────────────────────
  await logAdminAction(supabase, {
    admin_user_id: admin.id,
    action: "users.list",
    metadata: {
      page,
      page_size: pageSize,
      search: search || null,
      plan,
      status,
      has_meta: hasMeta,
      inactive_7d: inactive7d,
      sort,
      result_count: filtered.length,
    },
    req,
  });

  // ── 5. Response ──────────────────────────────────────────────────────────
  const total = totalCount ?? 0;
  return jsonResponse({
    data: {
      rows: filtered,
      page,
      page_size: pageSize,
      total_count: total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
      returned_count: filtered.length,
    },
  });
});
