/**
 * admin-user-summary — returns an exhaustive, AdBrief-specific summary of
 * a single user. Designed for the cockpit UserDetail page.
 *
 * Input: { target_user_id?: string } OR { target_email?: string }
 *
 * Output sections:
 *   • identity         — email, name, signup_at, email_confirmed, last_sign_in
 *   • billing          — plan, status, stripe_customer_id, trial_end, period_end
 *   • ad_accounts      — connected Meta accounts (name, spend_30d, last_sync)
 *   • usage            — counts over 24h / 7d / 30d / all for:
 *                        chat_messages, action_log (by type), decisions
 *                        (pending/acted/dismissed), credit_transactions,
 *                        upgrade_events
 *   • timeline         — last 50 events merged from chat_messages, action_log,
 *                        decisions, upgrade_events
 *   • ai_intelligence  — user_ai_profile + learned_patterns (count + top 3)
 *   • credits          — current period balance + 30d usage
 *   • free_usage       — chat_count + last_reset (for free-tier debugging)
 *   • errors           — last 20 rows from error_logs
 *   • anomalies        — computed flags (inactive 7d, trial ending, past_due,
 *                        error spike, connected but never synced, etc.)
 *
 * Writes an admin_audit_log entry on every call.
 */

import {
  requireAdmin,
  logAdminAction,
  jsonResponse,
  adminCors,
} from "../_shared/admin-guard.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: adminCors });
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, { status: 405 });
  }

  // Parse input
  let body: { target_user_id?: string; target_email?: string } = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, { status: 400 });
  }
  const { target_user_id, target_email } = body;
  if (!target_user_id && !target_email) {
    return jsonResponse(
      { error: "missing_target", hint: "provide target_user_id or target_email" },
      { status: 400 }
    );
  }

  // Gate
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;
  const { admin, supabase } = gate;

  // ── 1. Resolve target user ────────────────────────────────────────────────
  // Prefer user_id; fall back to email lookup via auth admin API.
  let targetId: string | null = target_user_id ?? null;
  let targetEmail: string | null = null;
  let targetAuthUser: {
    id: string;
    email: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    email_confirmed_at: string | null;
  } | null = null;

  if (!targetId && target_email) {
    // Service-role getUserByEmail is not a first-class method; iterate via listUsers.
    // (We filter client-side because the target set is small during admin usage.)
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) {
      return jsonResponse({ error: "auth_list_failed", detail: listErr.message }, { status: 500 });
    }
    const match = list.users.find(
      (u) => (u.email ?? "").toLowerCase() === target_email.toLowerCase()
    );
    if (!match) {
      await logAdminAction(supabase, {
        admin_user_id: admin.id,
        action: "user_summary.not_found",
        metadata: { target_email },
        req,
      });
      return jsonResponse({ error: "target_not_found", target_email }, { status: 404 });
    }
    targetId = match.id;
  }

  if (targetId) {
    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(targetId);
    if (authErr || !authUser?.user) {
      return jsonResponse(
        { error: "target_not_found", target_user_id: targetId, detail: authErr?.message },
        { status: 404 }
      );
    }
    targetAuthUser = {
      id: authUser.user.id,
      email: authUser.user.email ?? null,
      created_at: authUser.user.created_at,
      last_sign_in_at: authUser.user.last_sign_in_at ?? null,
      email_confirmed_at: authUser.user.email_confirmed_at ?? null,
    };
    targetEmail = targetAuthUser.email;
  }
  if (!targetId || !targetAuthUser) {
    return jsonResponse({ error: "target_resolution_failed" }, { status: 500 });
  }

  // ── 2. Parallel fetches — profile, accounts, aggregates ──────────────────
  const now = new Date();
  const iso24h = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const iso7d = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const iso30d = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();

  const [
    profileRes,
    adAccountsRes,
    chats24hRes,
    chats7dRes,
    chats30dRes,
    chatsAllRes,
    actions24hRes,
    actions7dRes,
    actions30dRes,
    actionsAllRes,
    decisionsAllRes,
    decisionsActedRes,
    decisionsDismissedRes,
    creditTxAllRes,
    upgradeEventsRes,
    userAiProfileRes,
    patternsCountRes,
    patternsTop3Res,
    userCreditsRes,
    freeUsageRes,
    errorLogsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, email, name, avatar_url, plan, subscription_status, stripe_customer_id, trial_end, current_period_end, plan_started_at, last_ai_action_at, onboarding_data"
      )
      .eq("id", targetId)
      .maybeSingle(),

    supabase
      .from("ad_accounts")
      .select(
        "id, meta_account_id, name, currency, status, total_spend_30d, total_ads_synced, last_fast_sync_at, last_full_sync_at, last_deep_sync_at, created_at"
      )
      .eq("user_id", targetId)
      .order("created_at", { ascending: false }),

    supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("user_id", targetId).gte("created_at", iso24h),
    supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("user_id", targetId).gte("created_at", iso7d),
    supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("user_id", targetId).gte("created_at", iso30d),
    supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("user_id", targetId),

    supabase.from("action_log").select("action_type", { count: "exact" }).eq("user_id", targetId).gte("executed_at", iso24h),
    supabase.from("action_log").select("action_type", { count: "exact" }).eq("user_id", targetId).gte("executed_at", iso7d),
    supabase.from("action_log").select("action_type", { count: "exact" }).eq("user_id", targetId).gte("executed_at", iso30d),
    supabase.from("action_log").select("action_type").eq("user_id", targetId),

    // decisions are per account, not per user. Join via ad_accounts.user_id.
    // Simpler: fetch decisions for this user's account_ids in a follow-up step.
    Promise.resolve({ data: null, error: null }),
    Promise.resolve({ data: null, error: null }),
    Promise.resolve({ data: null, error: null }),

    supabase
      .from("credit_transactions")
      .select("action, credits, created_at, metadata")
      .eq("user_id", targetId)
      .gte("created_at", iso30d)
      .order("created_at", { ascending: false })
      .limit(200),

    supabase
      .from("upgrade_events")
      .select("trigger, created_at")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("user_ai_profile")
      .select("pain_point, avg_hook_score, creative_style, ai_summary, ai_recommendations")
      .eq("user_id", targetId)
      .maybeSingle(),

    supabase
      .from("learned_patterns")
      .select("id", { count: "exact", head: true })
      .eq("user_id", targetId),

    supabase
      .from("learned_patterns")
      .select("pattern_key, avg_ctr, avg_roas, confidence, is_winner, insight_text, last_updated")
      .eq("user_id", targetId)
      .order("confidence", { ascending: false })
      .limit(3),

    supabase
      .from("user_credits")
      .select("period, total_credits, used_credits, bonus_credits, updated_at")
      .eq("user_id", targetId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase.from("free_usage").select("chat_count, last_reset").eq("user_id", targetId).maybeSingle(),

    supabase
      .from("error_logs")
      .select("error_type, message, component, url, created_at")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // ── 3. Decisions & recent chat timeline need the account_ids ─────────────
  const accountIds = (adAccountsRes.data ?? []).map((a: any) => a.id);

  let decisionsStats = { total: 0, acted: 0, dismissed: 0, pending: 0, last24h: 0, last7d: 0 };
  let recentDecisions: any[] = [];
  if (accountIds.length > 0) {
    const [dAll, dActed, dDismissed, d24h, d7d, dRecent] = await Promise.all([
      supabase.from("decisions").select("id", { count: "exact", head: true }).in("account_id", accountIds),
      supabase.from("decisions").select("id", { count: "exact", head: true }).in("account_id", accountIds).not("acted_at", "is", null),
      supabase.from("decisions").select("id", { count: "exact", head: true }).in("account_id", accountIds).not("dismissed_at", "is", null),
      supabase.from("decisions").select("id", { count: "exact", head: true }).in("account_id", accountIds).gte("created_at", iso24h),
      supabase.from("decisions").select("id", { count: "exact", head: true }).in("account_id", accountIds).gte("created_at", iso7d),
      supabase
        .from("decisions")
        .select("id, type, score, headline, reason, status, acted_at, dismissed_at, created_at")
        .in("account_id", accountIds)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    decisionsStats = {
      total: dAll.count ?? 0,
      acted: dActed.count ?? 0,
      dismissed: dDismissed.count ?? 0,
      pending: Math.max(0, (dAll.count ?? 0) - (dActed.count ?? 0) - (dDismissed.count ?? 0)),
      last24h: d24h.count ?? 0,
      last7d: d7d.count ?? 0,
    };
    recentDecisions = dRecent.data ?? [];
  }

  // ── 4. Build activity timeline (merge & sort) ────────────────────────────
  const [chatRecentRes, actionRecentRes] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("action_log")
      .select("id, action_type, target_type, target_name, result, executed_at, estimated_daily_impact")
      .eq("user_id", targetId)
      .order("executed_at", { ascending: false })
      .limit(20),
  ]);

  const timeline: Array<{
    kind: string;
    ts: string;
    summary: string;
    data: Record<string, unknown>;
  }> = [];

  for (const m of chatRecentRes.data ?? []) {
    const preview = summarizeChat(m.content);
    timeline.push({
      kind: "chat",
      ts: m.created_at,
      summary: `${m.role === "user" ? "User:" : "AI:"} ${preview}`,
      data: { role: m.role, preview },
    });
  }
  for (const a of actionRecentRes.data ?? []) {
    timeline.push({
      kind: "action",
      ts: a.executed_at,
      summary: `${a.action_type} on ${a.target_type}${a.target_name ? ` — ${a.target_name}` : ""} (${a.result ?? "pending"})`,
      data: a,
    });
  }
  for (const d of recentDecisions) {
    timeline.push({
      kind: "decision",
      ts: d.created_at,
      summary: `Decision ${d.type}/${d.score}: ${d.headline}`,
      data: d,
    });
  }
  for (const u of upgradeEventsRes.data ?? []) {
    timeline.push({
      kind: "upgrade_event",
      ts: u.created_at,
      summary: `Upgrade gate: ${u.trigger}`,
      data: u,
    });
  }
  timeline.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const timelineTop = timeline.slice(0, 50);

  // ── 5. Action breakdown ──────────────────────────────────────────────────
  const actionsAll = (actionsAllRes.data ?? []) as Array<{ action_type: string }>;
  const actionBreakdown: Record<string, number> = {};
  for (const a of actionsAll) {
    actionBreakdown[a.action_type] = (actionBreakdown[a.action_type] ?? 0) + 1;
  }

  // ── 6. Anomaly detection ─────────────────────────────────────────────────
  const profile = profileRes.data;
  const anomalies: Array<{ code: string; severity: "info" | "warn" | "critical"; note: string }> = [];

  const lastActivityTs =
    profile?.last_ai_action_at ??
    chatRecentRes.data?.[0]?.created_at ??
    actionRecentRes.data?.[0]?.executed_at ??
    null;

  if (!lastActivityTs) {
    anomalies.push({ code: "no_activity_ever", severity: "warn", note: "Never used AI features" });
  } else if (new Date(lastActivityTs).getTime() < now.getTime() - 7 * 24 * 3600 * 1000) {
    anomalies.push({
      code: "inactive_7d",
      severity: "warn",
      note: `Last activity ${new Date(lastActivityTs).toISOString()}`,
    });
  }

  if (profile?.subscription_status === "past_due") {
    anomalies.push({ code: "stripe_past_due", severity: "critical", note: "Stripe subscription past_due" });
  }
  if (profile?.trial_end) {
    const trialEnd = new Date(profile.trial_end).getTime();
    const daysLeft = Math.floor((trialEnd - now.getTime()) / (24 * 3600 * 1000));
    if (daysLeft >= 0 && daysLeft <= 3) {
      anomalies.push({
        code: "trial_ending_soon",
        severity: "info",
        note: `Trial ends in ${daysLeft} day(s)`,
      });
    }
  }
  if ((adAccountsRes.data ?? []).some((a: any) => a.status === "connected" && !a.last_fast_sync_at)) {
    anomalies.push({
      code: "connected_never_synced",
      severity: "warn",
      note: "Meta account connected but never synced",
    });
  }
  const errCount = (errorLogsRes.data ?? []).filter(
    (e: any) => new Date(e.created_at).getTime() > now.getTime() - 24 * 3600 * 1000
  ).length;
  if (errCount >= 5) {
    anomalies.push({
      code: "error_spike_24h",
      severity: "critical",
      note: `${errCount} client errors in last 24h`,
    });
  }

  // ── 7. Audit log ─────────────────────────────────────────────────────────
  await logAdminAction(supabase, {
    admin_user_id: admin.id,
    action: "user_summary.view",
    target_user_id: targetId,
    target_resource: "user",
    target_resource_id: targetId,
    metadata: { target_email: targetEmail },
    req,
  });

  // ── 8. Compose response ──────────────────────────────────────────────────
  const summary = {
    identity: {
      user_id: targetId,
      email: targetEmail,
      name: profile?.name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      signup_at: targetAuthUser.created_at,
      email_confirmed: !!targetAuthUser.email_confirmed_at,
      last_sign_in_at: targetAuthUser.last_sign_in_at,
      last_ai_action_at: profile?.last_ai_action_at ?? null,
      onboarding_data: profile?.onboarding_data ?? null,
    },
    billing: {
      plan: profile?.plan ?? "free",
      subscription_status: profile?.subscription_status ?? null,
      stripe_customer_id: profile?.stripe_customer_id ?? null,
      trial_end: profile?.trial_end ?? null,
      current_period_end: profile?.current_period_end ?? null,
      plan_started_at: profile?.plan_started_at ?? null,
    },
    ad_accounts: adAccountsRes.data ?? [],
    usage: {
      chats: {
        last_24h: chats24hRes.count ?? 0,
        last_7d: chats7dRes.count ?? 0,
        last_30d: chats30dRes.count ?? 0,
        all_time: chatsAllRes.count ?? 0,
      },
      actions_executed: {
        last_24h: actions24hRes.count ?? 0,
        last_7d: actions7dRes.count ?? 0,
        last_30d: actions30dRes.count ?? 0,
        all_time: actionsAll.length,
        by_type: actionBreakdown,
      },
      decisions: decisionsStats,
      upgrade_gates_triggered: (upgradeEventsRes.data ?? []).length,
    },
    credits: {
      current: userCreditsRes.data ?? null,
      recent_transactions: creditTxAllRes.data ?? [],
    },
    free_usage: freeUsageRes.data ?? null,
    ai_intelligence: {
      profile: userAiProfileRes.data ?? null,
      patterns_total: patternsCountRes.count ?? 0,
      top_patterns: patternsTop3Res.data ?? [],
    },
    timeline: timelineTop,
    errors: errorLogsRes.data ?? [],
    anomalies,
  };

  return jsonResponse({ data: summary });
});

// ── Helpers ─────────────────────────────────────────────────────────────────
function summarizeChat(content: unknown): string {
  if (!content) return "(empty)";
  if (typeof content === "string") return clip(content);
  if (typeof content === "object") {
    // Common shapes: { text } | { content } | { parts: [{ text }] }
    const obj = content as Record<string, unknown>;
    if (typeof obj.text === "string") return clip(obj.text);
    if (typeof obj.content === "string") return clip(obj.content as string);
    if (Array.isArray(obj.parts)) {
      const first = obj.parts[0] as Record<string, unknown> | undefined;
      if (first && typeof first.text === "string") return clip(first.text);
    }
    try {
      return clip(JSON.stringify(content));
    } catch {
      return "(unserializable)";
    }
  }
  return String(content);
}

function clip(s: string, max = 120): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}
