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
 *     inactive_7d?: boolean,       // true = last_seen_at older than 7d (or null)
 *     signup_since?: string,       // ISO date — only users who signed up after
 *     sort?: "signup_desc" | "signup_asc" | "last_action_desc" | "plan_asc",
 *   }
 *
 * "Last seen" signal:
 *   We compute last_seen_at = MAX(last_ai_action_at, last_sign_in_at).
 *   Previously we used last_ai_action_at alone, which only ticked when the
 *   user chatted with the AI — users who opened the app daily but didn't
 *   chat were wrongly marked inactive. Now a real login also counts.
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
  if (req.method === "OPTIONS") return new Response(null, { headers: adminCors(req) });
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, { status: 405 }, req);
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
  const nowMs = now.getTime();
  const iso7d = new Date(nowMs - 7 * 24 * 3600 * 1000).toISOString();

  // ── 1a. Build the base profiles filter (search/plan/status/signup_since).
  // We split the query into two shapes:
  //   FAST PATH — when sort/filter only need fields on profiles, let Postgres
  //   paginate server-side. Best performance.
  //   MEMORY PATH — when sort is "last_action_desc" or inactive_7d filter is
  //   on, we need last_seen_at (which depends on auth.users.last_sign_in_at
  //   and isn't a column on profiles). We fetch all matching IDs, enrich,
  //   sort/filter in memory, then paginate the result set.
  const needsMemoryPass = inactive7d || sort === "last_action_desc";

  const applyBaseFilters = (q: any) => {
    if (search) {
      const safe = search.replace(/[%,]/g, " ").trim();
      if (safe) {
        q = q.or(`email.ilike.%${safe}%,name.ilike.%${safe}%`);
      }
    }
    if (plan) q = q.eq("plan", plan);
    if (status) q = q.eq("subscription_status", status);
    if (signupSince) q = q.gte("created_at", signupSince);
    return q;
  };

  // ── 1b. Fetch auth users → userId → last_sign_in_at map. Needed in every
  // path so we can always return last_seen_at to the frontend (used for the
  // "Last seen" column display and inactive flag).
  // auth.admin.listUsers paginates; we take up to 10 pages of 1000 (10k users)
  // which is comfortably above the current AdBrief user base.
  const lastSignInByUser = new Map<string, string | null>();
  try {
    for (let authPage = 1; authPage <= 10; authPage++) {
      const { data: authList, error: authErr } = await supabase.auth.admin.listUsers({
        page: authPage,
        perPage: 1000,
      });
      if (authErr) break;
      const users = authList?.users ?? [];
      for (const u of users) {
        lastSignInByUser.set(u.id, (u as any).last_sign_in_at ?? null);
      }
      if (users.length < 1000) break; // end reached
    }
  } catch { /* best-effort enrichment */ }

  // Helper: compute last_seen_at from the two signals.
  const computeLastSeen = (lastAi: string | null, lastSignIn: string | null): string | null => {
    const aiMs = lastAi ? new Date(lastAi).getTime() : 0;
    const siMs = lastSignIn ? new Date(lastSignIn).getTime() : 0;
    const m = Math.max(aiMs, siMs);
    return m > 0 ? new Date(m).toISOString() : null;
  };

  let profileRows: any[] = [];
  let totalCount = 0;

  const SELECT_COLS =
    "id, email, name, avatar_url, plan, subscription_status, trial_end, current_period_end, plan_started_at, last_ai_action_at, created_at";

  if (!needsMemoryPass) {
    // ── FAST PATH — server-side sort + paginate ─────────────────────────────
    let q = supabase
      .from("profiles")
      .select(SELECT_COLS, { count: "exact" });
    q = applyBaseFilters(q);

    switch (sort) {
      case "signup_asc":
        q = q.order("created_at", { ascending: true });
        break;
      case "plan_asc":
        q = q.order("plan", { ascending: true }).order("created_at", { ascending: false });
        break;
      case "signup_desc":
      default:
        q = q.order("created_at", { ascending: false });
        break;
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    q = q.range(from, to);

    const { data, count, error: profileErr } = await q;
    if (profileErr) {
      return jsonResponse(
        { error: "profiles_query_failed", detail: profileErr.message },
        { status: 500 }, req,
      );
    }
    profileRows = data ?? [];
    totalCount = count ?? 0;
  } else {
    // ── MEMORY PATH — fetch matching IDs, enrich, sort/filter, paginate ─────
    let q = supabase.from("profiles").select(SELECT_COLS);
    q = applyBaseFilters(q);
    // Defensive cap to avoid pulling the entire table if filters are loose.
    q = q.limit(10000);

    const { data, error: profileErr } = await q;
    if (profileErr) {
      return jsonResponse(
        { error: "profiles_query_failed", detail: profileErr.message },
        { status: 500 }, req,
      );
    }

    const allRows = (data ?? []) as any[];

    // Attach last_seen + inactive flag for memory-pass sorting / filtering.
    const withSeen = allRows.map((p) => {
      const lsi = lastSignInByUser.get(p.id) ?? null;
      const seen = computeLastSeen(p.last_ai_action_at ?? null, lsi);
      const inactive = !seen || new Date(seen).getTime() < nowMs - 7 * 24 * 3600 * 1000;
      return { ...p, __last_seen_at: seen, __inactive_7d: inactive };
    });

    const filtered = inactive7d
      ? withSeen.filter((r) => r.__inactive_7d)
      : withSeen;

    const sorted = [...filtered].sort((a, b) => {
      // sort === "last_action_desc" → most recent seen first, nulls last.
      const am = a.__last_seen_at ? new Date(a.__last_seen_at).getTime() : -1;
      const bm = b.__last_seen_at ? new Date(b.__last_seen_at).getTime() : -1;
      return bm - am;
    });

    totalCount = sorted.length;
    const from = (page - 1) * pageSize;
    profileRows = sorted.slice(from, from + pageSize);
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
    const lastAction = p.last_ai_action_at ?? null;
    const lastSignIn = lastSignInByUser.get(p.id) ?? null;
    // Memory-pass already computed __last_seen_at; fast path recomputes.
    const lastSeen = p.__last_seen_at ?? computeLastSeen(lastAction, lastSignIn);
    const inactive = !lastSeen || new Date(lastSeen).getTime() < nowMs - 7 * 24 * 3600 * 1000;
    const trialEndMs = p.trial_end ? new Date(p.trial_end).getTime() : null;
    const trialEndingSoon =
      trialEndMs !== null &&
      trialEndMs >= nowMs &&
      trialEndMs - nowMs <= 3 * 24 * 3600 * 1000;

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
      last_ai_action_at: lastAction,
      last_sign_in_at: lastSignIn,
      last_seen_at: lastSeen,
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
  }, {}, req);
});
