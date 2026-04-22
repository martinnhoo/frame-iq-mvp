/**
 * admin-metrics-overview — cockpit home page metrics. One call, one payload.
 *
 * Output:
 *   {
 *     data: {
 *       generated_at,
 *       users: { total, confirmed, signups_24h, signups_7d, signups_30d },
 *       active_users: { dau, wau, mau, new_vs_returning_7d },
 *       plans: { distribution: { free, maker, pro, studio, ... } },
 *       subscriptions: { active, trialing, past_due, canceled, mrr_brl, mrr_usd },
 *       engagement: { chats_today, chats_7d, decisions_today, decisions_7d,
 *                     actions_today, actions_7d, upgrade_gates_24h },
 *       meta: { accounts_connected, accounts_synced_24h, total_spend_30d_brl },
 *       health: { errors_24h, error_spike_users_24h, past_due_users, trials_ending_3d },
 *       ai: { patterns_total, winners, avg_hook_score_last_7d },
 *       signups_by_day_30d: Array<{ day, count }>,
 *       plan_upgrades_7d: Array<{ from, to, count }>,
 *     }
 *   }
 *
 * Writes one audit log entry per call.
 */

import {
  requireAdmin,
  logAdminAction,
  jsonResponse,
  adminCors,
} from "../_shared/admin-guard.ts";

// Reference monthly prices (BRL). Kept in code because pricing is infrequently
// changed and editing this function is cheaper than hitting Stripe live.
const PLAN_PRICE_BRL: Record<string, number> = {
  maker: 67,
  starter: 97, // legacy alias for Pro
  pro: 97,
  scale: 297, // legacy alias for Studio
  studio: 297,
  // Legacy and free buckets are 0.
  creator: 67,
  free: 0,
};

const USD_FX = 5.0; // rough BRL→USD for dashboard display only.

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: adminCors(req) });
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, { status: 405 }, req);
  }

  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;
  const { admin, supabase } = gate;

  const now = new Date();
  const iso24h = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const iso7d = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const iso30d = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const isoToday = startOfToday.toISOString();

  // ── Parallel block 1: headline counts ────────────────────────────────────
  const [
    usersTotalRes,
    usersConfirmedRes,
    signups24hRes,
    signups7dRes,
    signups30dRes,
    profilesForPlansRes,
    adAccountsTotalRes,
    adAccountsSynced24hRes,
    chatsTodayRes,
    chats7dRes,
    actionsTodayRes,
    actions7dRes,
    upgradeGates24hRes,
    errors24hRes,
    trialsRes,
    pastDueRes,
    patternsTotalRes,
    patternsWinnersRes,
    hookScore7dRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    // `email_confirmed_at` lives on auth.users, not profiles. Use auth admin.
    // We approximate with profiles that have `email` set (MUST be non-null post-signup).
    supabase.from("profiles").select("id", { count: "exact", head: true }).not("email", "is", null),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", iso24h),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", iso7d),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", iso30d),
    supabase.from("profiles").select("plan, subscription_status"),
    supabase.from("ad_accounts").select("id", { count: "exact", head: true }),
    supabase
      .from("ad_accounts")
      .select("id", { count: "exact", head: true })
      .gte("last_fast_sync_at", iso24h),
    supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", isoToday),
    supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", iso7d),
    supabase
      .from("action_log")
      .select("id", { count: "exact", head: true })
      .gte("executed_at", isoToday),
    supabase
      .from("action_log")
      .select("id", { count: "exact", head: true })
      .gte("executed_at", iso7d),
    supabase
      .from("upgrade_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", iso24h),
    supabase
      .from("error_logs")
      .select("user_id, created_at")
      .gte("created_at", iso24h),
    supabase
      .from("profiles")
      .select("id, trial_end")
      .not("trial_end", "is", null)
      .gte("trial_end", now.toISOString())
      .lte("trial_end", new Date(now.getTime() + 3 * 24 * 3600 * 1000).toISOString()),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("subscription_status", "past_due"),
    supabase.from("learned_patterns").select("id", { count: "exact", head: true }),
    supabase
      .from("learned_patterns")
      .select("id", { count: "exact", head: true })
      .eq("is_winner", true),
    supabase
      .from("video_analysis")
      .select("hook_score")
      .gte("created_at", iso7d)
      .not("hook_score", "is", null),
  ]);

  // ── Plans distribution + subscription counts ────────────────────────────
  const plans: Record<string, number> = {};
  const subscriptionStatus: Record<string, number> = {};
  let estimatedMrrBrl = 0;
  for (const p of (profilesForPlansRes.data ?? []) as Array<{
    plan: string | null;
    subscription_status: string | null;
  }>) {
    const planKey = (p.plan ?? "free").toLowerCase();
    plans[planKey] = (plans[planKey] ?? 0) + 1;

    const statusKey = (p.subscription_status ?? "none").toLowerCase();
    subscriptionStatus[statusKey] = (subscriptionStatus[statusKey] ?? 0) + 1;

    if (p.subscription_status === "active" || p.subscription_status === "trialing") {
      estimatedMrrBrl += PLAN_PRICE_BRL[planKey] ?? 0;
    }
  }

  // ── DAU / WAU / MAU — distinct users active in chat or actions ──────────
  // We compute by fetching user_ids in each window and de-duplicating.
  const [dauChats, dauActions, wauChats, wauActions, mauChats, mauActions] = await Promise.all([
    supabase.from("chat_messages").select("user_id").gte("created_at", iso24h),
    supabase.from("action_log").select("user_id").gte("executed_at", iso24h),
    supabase.from("chat_messages").select("user_id").gte("created_at", iso7d),
    supabase.from("action_log").select("user_id").gte("executed_at", iso7d),
    supabase.from("chat_messages").select("user_id").gte("created_at", iso30d),
    supabase.from("action_log").select("user_id").gte("executed_at", iso30d),
  ]);

  const dau = uniqueUsers(dauChats.data, dauActions.data);
  const wau = uniqueUsers(wauChats.data, wauActions.data);
  const mau = uniqueUsers(mauChats.data, mauActions.data);

  // New vs returning (7d): new = signed up in window AND active; returning = active but older signup.
  const wauSet = new Set([
    ...(wauChats.data ?? []).map((r: any) => r.user_id),
    ...(wauActions.data ?? []).map((r: any) => r.user_id),
  ]);
  let newActive7d = 0;
  let returningActive7d = 0;
  if (wauSet.size > 0) {
    const { data: profilesInWau } = await supabase
      .from("profiles")
      .select("id, created_at")
      .in("id", Array.from(wauSet));
    for (const p of (profilesInWau ?? []) as Array<{ id: string; created_at: string }>) {
      if (new Date(p.created_at).getTime() >= now.getTime() - 7 * 24 * 3600 * 1000) {
        newActive7d += 1;
      } else {
        returningActive7d += 1;
      }
    }
  }

  // ── Meta spend (30d) ────────────────────────────────────────────────────
  const { data: metaSpendRows } = await supabase
    .from("ad_accounts")
    .select("total_spend_30d, currency");
  let totalSpend30dBrl = 0;
  for (const r of (metaSpendRows ?? []) as Array<{ total_spend_30d: number | null; currency: string | null }>) {
    const amt = Number(r.total_spend_30d ?? 0);
    if (!Number.isFinite(amt)) continue;
    // Normalize: treat BRL as-is, USD * USD_FX.
    if ((r.currency ?? "BRL").toUpperCase() === "USD") {
      totalSpend30dBrl += amt * USD_FX;
    } else {
      totalSpend30dBrl += amt;
    }
  }

  // ── Error spike users (24h) — users with ≥5 errors ──────────────────────
  const errByUser: Record<string, number> = {};
  for (const e of (errors24hRes.data ?? []) as Array<{ user_id: string | null }>) {
    if (!e.user_id) continue;
    errByUser[e.user_id] = (errByUser[e.user_id] ?? 0) + 1;
  }
  const errorSpikeUsers = Object.values(errByUser).filter((n) => n >= 5).length;

  // ── Decisions today / 7d (no per-user filter) ───────────────────────────
  const [decisionsTodayRes, decisions7dRes] = await Promise.all([
    supabase.from("decisions").select("id", { count: "exact", head: true }).gte("created_at", isoToday),
    supabase.from("decisions").select("id", { count: "exact", head: true }).gte("created_at", iso7d),
  ]);

  // ── Avg hook score (7d) ─────────────────────────────────────────────────
  const hookScores = (hookScore7dRes.data ?? []) as Array<{ hook_score: number | null }>;
  const validScores = hookScores
    .map((h) => (typeof h.hook_score === "number" ? h.hook_score : null))
    .filter((n): n is number => n !== null);
  const avgHookScore7d =
    validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : null;

  // ── Signups by day (30d) ────────────────────────────────────────────────
  const { data: signupRows } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", iso30d)
    .order("created_at", { ascending: true });
  const signupsByDay: Record<string, number> = {};
  for (const r of (signupRows ?? []) as Array<{ created_at: string }>) {
    const day = r.created_at.slice(0, 10);
    signupsByDay[day] = (signupsByDay[day] ?? 0) + 1;
  }
  const signupsSeries: Array<{ day: string; count: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
    signupsSeries.push({ day: d, count: signupsByDay[d] ?? 0 });
  }

  // ── Plan upgrades (7d) ──────────────────────────────────────────────────
  const { data: upgradeRows } = await supabase
    .from("credit_transactions")
    .select("action, metadata")
    .eq("action", "plan_change")
    .gte("created_at", iso7d);
  const upgradeBuckets: Record<string, number> = {};
  for (const u of (upgradeRows ?? []) as Array<{ metadata: Record<string, unknown> | null }>) {
    const from = String(u.metadata?.from_plan ?? "unknown");
    const to = String(u.metadata?.to_plan ?? "unknown");
    const key = `${from}→${to}`;
    upgradeBuckets[key] = (upgradeBuckets[key] ?? 0) + 1;
  }
  const planUpgrades7d = Object.entries(upgradeBuckets).map(([k, count]) => {
    const [from, to] = k.split("→");
    return { from, to, count };
  });

  // ── Audit log ───────────────────────────────────────────────────────────
  await logAdminAction(supabase, {
    admin_user_id: admin.id,
    action: "metrics.overview.view",
    metadata: {},
    req,
  });

  return jsonResponse({
    data: {
      generated_at: now.toISOString(),
      users: {
        total: usersTotalRes.count ?? 0,
        confirmed_approx: usersConfirmedRes.count ?? 0,
        signups_24h: signups24hRes.count ?? 0,
        signups_7d: signups7dRes.count ?? 0,
        signups_30d: signups30dRes.count ?? 0,
      },
      active_users: {
        dau: dau.size,
        wau: wau.size,
        mau: mau.size,
        new_vs_returning_7d: { new: newActive7d, returning: returningActive7d },
      },
      plans: { distribution: plans },
      subscriptions: {
        by_status: subscriptionStatus,
        past_due: pastDueRes.count ?? 0,
        mrr_brl: Math.round(estimatedMrrBrl),
        mrr_usd: Math.round(estimatedMrrBrl / USD_FX),
      },
      engagement: {
        chats_today: chatsTodayRes.count ?? 0,
        chats_7d: chats7dRes.count ?? 0,
        decisions_today: decisionsTodayRes.count ?? 0,
        decisions_7d: decisions7dRes.count ?? 0,
        actions_today: actionsTodayRes.count ?? 0,
        actions_7d: actions7dRes.count ?? 0,
        upgrade_gates_24h: upgradeGates24hRes.count ?? 0,
      },
      meta: {
        accounts_connected: adAccountsTotalRes.count ?? 0,
        accounts_synced_24h: adAccountsSynced24hRes.count ?? 0,
        total_spend_30d_brl: Math.round(totalSpend30dBrl),
      },
      health: {
        errors_24h: (errors24hRes.data ?? []).length,
        error_spike_users_24h: errorSpikeUsers,
        past_due_users: pastDueRes.count ?? 0,
        trials_ending_3d: (trialsRes.data ?? []).length,
      },
      ai: {
        patterns_total: patternsTotalRes.count ?? 0,
        winners: patternsWinnersRes.count ?? 0,
        avg_hook_score_last_7d: avgHookScore7d !== null ? Number(avgHookScore7d.toFixed(2)) : null,
      },
      signups_by_day_30d: signupsSeries,
      plan_upgrades_7d: planUpgrades7d,
    },
  }, {}, req);
});

// ── Helpers ───────────────────────────────────────────────────────────────
function uniqueUsers(
  a: Array<{ user_id: string | null }> | null,
  b: Array<{ user_id: string | null }> | null
): Set<string> {
  const s = new Set<string>();
  for (const r of a ?? []) if (r.user_id) s.add(r.user_id);
  for (const r of b ?? []) if (r.user_id) s.add(r.user_id);
  return s;
}
