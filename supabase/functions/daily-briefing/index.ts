/**
 * daily-briefing — Unified morning digest for every active user.
 *
 * Composes signals from across the Brain into one Telegram message + in-app
 * notification. No LLM call — pure aggregation for speed and zero credit cost.
 *
 * Signals combined:
 *   • Autopilot actions last 24h → count + total saved/captured
 *   • money_tracker (per account) → total saved/captured lifetime + today
 *   • Credit balance + burn forecast (runway until reset)
 *   • Top pending decision (highest impact_daily) → "focus for today"
 *   • New learned_patterns discovered yesterday
 *   • Spend alert: daily_spend vs monthly budget (if configured)
 *
 * Delivery:
 *   • Telegram (if user has chat_id configured + opted in)
 *   • notifications row (always, type = 'daily_summary')
 *   • Email (future — payload ready for send-daily-intelligence-email)
 *
 * Authorization: cron (service role) or X-Cron-Secret. Recommended schedule:
 *   pg_cron '0 12 * * *' (daily at 12:00 UTC — midday BRT)
 *
 * Optional body { user_id?: string, dry_run?: boolean } for per-user testing.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";
import { getPlanCreditPool, normalizePlan } from "../_shared/credits.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// ── Types ────────────────────────────────────────────────────────────────────
interface BriefingPayload {
  user_id: string;
  email: string | null;
  language: string;
  // Autopilot
  autopilot_enabled: boolean;
  autopilot_actions_24h: number;
  autopilot_saved_24h: number;
  // Money
  total_saved: number;
  total_revenue_captured: number;
  saved_today: number;
  leaking_now: number;
  capturable_now: number;
  // Credits
  credits_total: number;
  credits_used: number;
  credits_remaining: number;
  credits_usage_pct: number;
  credits_days_until_reset: number;
  credits_runway_days: number | null;
  credits_alert: "critical" | "warning" | "ok";
  // Focus
  top_pending_decision: {
    id: string;
    headline: string;
    reason: string;
    impact_daily: number;
    type: string;
    score: number;
  } | null;
  new_patterns_count: number;
  // Plan
  plan: string;
  is_trialing: boolean;
}

// ── i18n message templates ───────────────────────────────────────────────────
function buildTelegramMessage(p: BriefingPayload): string {
  const lang = p.language || "pt";
  const r = (n: number) => `R$${n.toFixed(2)}`;

  // Headline varies by what's most urgent
  let headline = "☀️ <b>Seu briefing diário</b>";
  if (p.credits_alert === "critical") headline = "🔴 <b>Créditos acabando</b>";
  else if (p.leaking_now > 0) headline = "💰 <b>Você está perdendo dinheiro agora</b>";
  else if (p.autopilot_actions_24h > 0) headline = "🤖 <b>Autopilot trabalhou por você</b>";

  const lines: string[] = [headline, ""];

  // Autopilot block (if enabled)
  if (p.autopilot_enabled) {
    if (p.autopilot_actions_24h > 0) {
      lines.push(`🤖 <b>Autopilot (últimas 24h)</b>`);
      lines.push(`• ${p.autopilot_actions_24h} ações executadas`);
      lines.push(`• ${r(p.autopilot_saved_24h)} em risco gerenciado`);
      lines.push("");
    } else {
      lines.push(`🤖 Autopilot ativo — nada mereceu ação nas últimas 24h.`);
      lines.push("");
    }
  }

  // Money tracker block
  lines.push(`💵 <b>Dinheiro</b>`);
  if (p.leaking_now > 0) {
    lines.push(`• ⚠️ Vazando agora: <b>${r(p.leaking_now)}/dia</b>`);
  }
  if (p.capturable_now > 0) {
    lines.push(`• 📈 A capturar: <b>${r(p.capturable_now)}/dia</b>`);
  }
  lines.push(`• Total economizado: ${r(p.total_saved)}`);
  if (p.total_revenue_captured > 0) {
    lines.push(`• Receita capturada: ${r(p.total_revenue_captured)}`);
  }
  lines.push("");

  // Focus for today
  if (p.top_pending_decision) {
    lines.push(`🎯 <b>Foco do dia</b>`);
    lines.push(`<b>${p.top_pending_decision.headline}</b>`);
    if (p.top_pending_decision.reason) {
      lines.push(`<i>${p.top_pending_decision.reason.substring(0, 160)}${p.top_pending_decision.reason.length > 160 ? "..." : ""}</i>`);
    }
    lines.push(`Impacto: <b>${r(Math.abs(p.top_pending_decision.impact_daily) / 100)}/dia</b> · Confiança: ${p.top_pending_decision.score}%`);
    lines.push("");
  }

  // New learnings
  if (p.new_patterns_count > 0) {
    lines.push(`🧠 <b>Novo aprendizado</b>`);
    lines.push(`${p.new_patterns_count} padrão${p.new_patterns_count > 1 ? "ões" : ""} descoberto${p.new_patterns_count > 1 ? "s" : ""} ontem.`);
    lines.push("");
  }

  // Credits block (always, for awareness)
  const creditIcon = p.credits_alert === "critical" ? "🔴" : p.credits_alert === "warning" ? "🟡" : "🟢";
  lines.push(`${creditIcon} <b>Créditos IA</b> (${p.plan}${p.is_trialing ? " · trial" : ""})`);
  lines.push(`${p.credits_remaining} / ${p.credits_total} restantes (${p.credits_usage_pct}% usado)`);
  if (p.credits_runway_days !== null && p.credits_runway_days < p.credits_days_until_reset) {
    lines.push(`⚠️ No ritmo atual, acabam em ~${p.credits_runway_days}d (reset em ${p.credits_days_until_reset}d)`);
  } else {
    lines.push(`Reset em ${p.credits_days_until_reset}d`);
  }
  lines.push("");

  // Footer CTA
  lines.push("👉 Abra o painel: https://app.adbrief.pro/dashboard/feed");

  // Localize (best effort — PT stays original, EN/ES are simplified translations)
  if (lang === "en") {
    return lines
      .join("\n")
      .replace("Seu briefing diário", "Your daily briefing")
      .replace("Créditos acabando", "Credits running out")
      .replace("Você está perdendo dinheiro agora", "You're losing money right now")
      .replace("Autopilot trabalhou por você", "Autopilot worked for you")
      .replace("últimas 24h", "last 24h")
      .replace("ações executadas", "actions executed")
      .replace("em risco gerenciado", "in managed risk")
      .replace("Autopilot ativo — nada mereceu ação nas últimas 24h.", "Autopilot active — nothing met your threshold in 24h.")
      .replace("Dinheiro", "Money")
      .replace("Vazando agora", "Leaking now")
      .replace("A capturar", "To capture")
      .replace("Total economizado", "Total saved")
      .replace("Receita capturada", "Revenue captured")
      .replace("Foco do dia", "Focus today")
      .replace("Impacto", "Impact")
      .replace("Confiança", "Confidence")
      .replace("Novo aprendizado", "New learning")
      .replace("Créditos IA", "AI Credits")
      .replace("restantes", "remaining")
      .replace("usado", "used")
      .replace("No ritmo atual, acabam em", "At current pace, runs out in")
      .replace("Reset em", "Resets in")
      .replace("Abra o painel", "Open dashboard");
  }
  if (lang === "es") {
    return lines
      .join("\n")
      .replace("Seu briefing diário", "Tu briefing diario")
      .replace("Créditos acabando", "Créditos acabándose")
      .replace("Você está perdendo dinheiro agora", "Estás perdiendo dinero ahora")
      .replace("Autopilot trabalhou por você", "Autopilot trabajó por ti")
      .replace("últimas 24h", "últimas 24h")
      .replace("ações executadas", "acciones ejecutadas")
      .replace("em risco gerenciado", "en riesgo gestionado")
      .replace("Autopilot ativo — nada mereceu ação nas últimas 24h.", "Autopilot activo — nada superó tu umbral en 24h.")
      .replace("Dinheiro", "Dinero")
      .replace("Vazando agora", "Fugando ahora")
      .replace("A capturar", "A capturar")
      .replace("Total economizado", "Total ahorrado")
      .replace("Receita capturada", "Ingresos capturados")
      .replace("Foco do dia", "Foco del día")
      .replace("Impacto", "Impacto")
      .replace("Confiança", "Confianza")
      .replace("Novo aprendizado", "Nuevo aprendizaje")
      .replace("Créditos IA", "Créditos IA")
      .replace("restantes", "restantes")
      .replace("usado", "usado")
      .replace("No ritmo atual, acabam em", "Al ritmo actual, se acaban en")
      .replace("Reset em", "Reinicio en")
      .replace("Abra o painel", "Abre el panel");
  }
  return lines.join("\n");
}

// ── Build payload for one user ───────────────────────────────────────────────
async function buildPayload(sb: SupabaseClient, userId: string): Promise<BriefingPayload | null> {
  // User profile (plan, email, language)
  const { data: profile } = await sb
    .from("profiles")
    .select("email, plan, is_trialing, language")
    .eq("id", userId)
    .maybeSingle();

  const plan = normalizePlan(profile?.plan);
  const isTrialing = !!profile?.is_trialing;
  const language = profile?.language || "pt";
  const email = profile?.email || null;

  // Autopilot
  const { data: apSettings } = await (sb as any)
    .from("autopilot_settings")
    .select("enabled")
    .eq("user_id", userId)
    .maybeSingle();
  const autopilotEnabled = !!apSettings?.enabled;

  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: apActions } = await (sb as any)
    .from("autopilot_action_log")
    .select("amount_at_risk_brl")
    .eq("user_id", userId)
    .eq("status", "executed")
    .gte("executed_at", since24h);
  const autopilotActions24h = (apActions || []).length;
  const autopilotSaved24h = (apActions || []).reduce((s: number, r: { amount_at_risk_brl: number | null }) => s + (Number(r.amount_at_risk_brl) || 0), 0);

  // Money tracker — sum across all ad accounts
  const { data: trackers } = await sb
    .from("money_tracker")
    .select("total_saved, total_revenue_captured, saved_today, leaking_now, capturable_now, account_id")
    .in(
      "account_id",
      (await sb.from("ad_accounts").select("id").eq("user_id", userId)).data?.map((a: { id: string }) => a.id) || ["__none__"]
    );
  const tr = (trackers || []).reduce(
    (acc: Record<string, number>, r: Record<string, number>) => ({
      total_saved: acc.total_saved + (Number(r.total_saved) || 0),
      total_revenue_captured: acc.total_revenue_captured + (Number(r.total_revenue_captured) || 0),
      saved_today: acc.saved_today + (Number(r.saved_today) || 0),
      leaking_now: acc.leaking_now + (Number(r.leaking_now) || 0),
      capturable_now: acc.capturable_now + (Number(r.capturable_now) || 0),
    }),
    { total_saved: 0, total_revenue_captured: 0, saved_today: 0, leaking_now: 0, capturable_now: 0 }
  );

  // Credits
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const { data: credits } = await sb
    .from("user_credits")
    .select("total_credits, used_credits, bonus_credits")
    .eq("user_id", userId)
    .eq("period", period)
    .maybeSingle();

  const creditsTotal = getPlanCreditPool(plan, isTrialing) + (credits?.bonus_credits || 0);
  const creditsUsed = credits?.used_credits || 0;
  const creditsRemaining = Math.max(0, creditsTotal - creditsUsed);
  const creditsUsagePct = creditsTotal > 0 ? Math.round((creditsUsed / creditsTotal) * 100) : 0;

  // Days until reset (next 1st)
  const now = new Date();
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysUntilReset = Math.ceil((nextReset.getTime() - now.getTime()) / 86400_000);

  // Burn rate forecast: use last 7d transactions
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: recentTx } = await sb
    .from("credit_transactions")
    .select("credits")
    .eq("user_id", userId)
    .eq("period", period)
    .gte("created_at", sevenDaysAgo);
  const recent7dUsed = (recentTx || []).reduce((s: number, t: { credits: number }) => s + Math.max(0, Number(t.credits) || 0), 0);
  const dailyBurn = recent7dUsed / 7;
  const runwayDays = dailyBurn > 0 ? Math.floor(creditsRemaining / dailyBurn) : null;

  let creditsAlert: "critical" | "warning" | "ok" = "ok";
  if (creditsUsagePct >= 90 || (runwayDays !== null && runwayDays < 3)) creditsAlert = "critical";
  else if (creditsUsagePct >= 70 || (runwayDays !== null && runwayDays < 7)) creditsAlert = "warning";

  // Top pending decision (highest impact)
  const { data: accountIds } = await sb.from("ad_accounts").select("id").eq("user_id", userId);
  const ids = (accountIds || []).map((a: { id: string }) => a.id);
  let topDecision: BriefingPayload["top_pending_decision"] = null;
  if (ids.length > 0) {
    const { data: decisions } = await sb
      .from("decisions")
      .select("id, headline, reason, impact_daily, type, score")
      .in("account_id", ids)
      .eq("status", "pending")
      .order("score", { ascending: false })
      .limit(5);
    const sorted = (decisions || []).sort(
      (a: { impact_daily: number | null }, b: { impact_daily: number | null }) =>
        Math.abs(Number(b.impact_daily) || 0) - Math.abs(Number(a.impact_daily) || 0)
    );
    if (sorted[0]) {
      topDecision = {
        id: sorted[0].id,
        headline: sorted[0].headline,
        reason: sorted[0].reason,
        impact_daily: Number(sorted[0].impact_daily) || 0,
        type: sorted[0].type,
        score: sorted[0].score,
      };
    }
  }

  // New patterns discovered yesterday
  const yesterdayStart = new Date();
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  let newPatternsCount = 0;
  try {
    const { count } = await (sb as any)
      .from("learned_patterns")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", yesterdayStart.toISOString())
      .lt("created_at", todayStart.toISOString());
    newPatternsCount = count || 0;
  } catch {
    // table may not exist everywhere
  }

  return {
    user_id: userId,
    email,
    language,
    autopilot_enabled: autopilotEnabled,
    autopilot_actions_24h: autopilotActions24h,
    autopilot_saved_24h: autopilotSaved24h,
    total_saved: (tr.total_saved || 0) / 100,
    total_revenue_captured: (tr.total_revenue_captured || 0) / 100,
    saved_today: (tr.saved_today || 0) / 100,
    leaking_now: (tr.leaking_now || 0) / 100,
    capturable_now: (tr.capturable_now || 0) / 100,
    credits_total: creditsTotal,
    credits_used: creditsUsed,
    credits_remaining: creditsRemaining,
    credits_usage_pct: creditsUsagePct,
    credits_days_until_reset: daysUntilReset,
    credits_runway_days: runwayDays,
    credits_alert: creditsAlert,
    top_pending_decision: topDecision,
    new_patterns_count: newPatternsCount,
    plan,
    is_trialing: isTrialing,
  };
}

// ── Deliver to one user ──────────────────────────────────────────────────────
async function deliver(sb: SupabaseClient, payload: BriefingPayload, dryRun: boolean) {
  if (dryRun) return { user_id: payload.user_id, delivered: false, dry_run: true, payload };

  // Write in-app notification (always, so users see it in the notifications center)
  try {
    await sb.from("notifications").insert({
      user_id: payload.user_id,
      channel: "in_app",
      notification_type: "daily_summary",
      title: "Seu briefing diário está pronto",
      body: JSON.stringify({
        autopilot_actions: payload.autopilot_actions_24h,
        saved: payload.total_saved,
        credits_remaining: payload.credits_remaining,
        top_focus: payload.top_pending_decision?.headline || null,
        credits_alert: payload.credits_alert,
      }),
    });
  } catch (e) {
    console.error("[daily-briefing] notifications insert failed", e);
  }

  // Send Telegram
  const { data: userSettings } = await sb
    .from("user_settings")
    .select("telegram_enabled, telegram_chat_id")
    .eq("user_id", payload.user_id)
    .maybeSingle();

  if (userSettings?.telegram_enabled && userSettings?.telegram_chat_id) {
    try {
      const message = buildTelegramMessage(payload);
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-telegram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ user_id: payload.user_id, message }),
      });
    } catch (e) {
      console.error("[daily-briefing] telegram failed", e);
    }
  }

  // Credit alert if critical (reuses existing send-credit-alert)
  if (payload.credits_alert === "critical") {
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-credit-alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          user_id: payload.user_id,
          usage_pct: payload.credits_usage_pct,
          remaining: payload.credits_remaining,
          runway_days: payload.credits_runway_days,
        }),
      });
    } catch {
      // non-fatal
    }
  }

  return { user_id: payload.user_id, delivered: true };
}

// ── Server ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!isCronAuthorized(req)) return unauthorizedResponse(cors);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    let specificUser: string | null = null;
    let dryRun = false;
    try {
      const body = await req.json();
      if (body?.user_id && typeof body.user_id === "string") specificUser = body.user_id;
      if (body?.dry_run === true) dryRun = true;
    } catch {
      /* no body */
    }

    // Eligibility: users with at least one active ad_account in last 14d
    let userIds: string[] = [];
    if (specificUser) {
      userIds = [specificUser];
    } else {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 86400_000).toISOString();
      const { data: active } = await sb
        .from("ad_accounts")
        .select("user_id")
        .gte("updated_at", fourteenDaysAgo);
      userIds = Array.from(new Set((active || []).map((a: { user_id: string }) => a.user_id)));
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: "no_eligible_users" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const uid of userIds) {
      try {
        const payload = await buildPayload(sb, uid);
        if (!payload) {
          results.push({ user_id: uid, ok: false, reason: "no_payload" });
          continue;
        }
        const r = await deliver(sb, payload, dryRun);
        results.push({ ok: true, ...r });
      } catch (e) {
        console.error(`[daily-briefing] user ${uid} failed`, e);
        results.push({ user_id: uid, ok: false, error: e instanceof Error ? e.message : "unknown" });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: userIds.length,
        delivered: results.filter((r) => r.ok && "delivered" in r && r.delivered).length,
        dry_run: dryRun,
        results: dryRun ? results : results.map(({ user_id, ok }) => ({ user_id, ok })),
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[daily-briefing]", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
