// health-scoring — daily cron job to compute user health scores
// Score 0-1 based on: login recency, feature breadth, usage volume, streak
// Flags users with score < 0.3 for churn risk outreach

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, d?: unknown) =>
  console.log(`[HEALTH-SCORING] ${step}${d ? ` — ${JSON.stringify(d)}` : ""}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get all paid users (scoring only matters for retention of paid users)
    const { data: users, error: usersErr } = await supabase
      .from("profiles")
      .select("id, email, plan, last_login_at, last_ai_action_at, created_at, login_streak, total_actions")
      .neq("plan", "free");

    if (usersErr) throw usersErr;
    if (!users?.length) {
      log("No paid users to score");
      return new Response(JSON.stringify({ scored: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    let scored = 0, flagged = 0;

    for (const user of users) {
      try {
        // ── 1. Login recency (0-0.3) ──────────────────────────────────────────
        const lastLogin = user.last_login_at || user.last_ai_action_at || user.created_at;
        const daysSinceLogin = (now - new Date(lastLogin).getTime()) / 86400000;
        // 0 days = 0.3, 7+ days = 0
        const loginScore = Math.max(0, 0.3 * (1 - daysSinceLogin / 7));

        // ── 2. Feature breadth (0-0.3) ────────────────────────────────────────
        // Check how many distinct features user has used this month
        const period = new Date().toISOString().slice(0, 7); // YYYY-MM
        const { data: usage } = await supabase
          .from("usage")
          .select("analyses_count, boards_count, translations_count, preflights_count, hooks_count")
          .eq("user_id", user.id)
          .eq("period", period)
          .maybeSingle();

        let featuresUsed = 0;
        if (usage) {
          if ((usage.analyses_count || 0) > 0) featuresUsed++;
          if ((usage.boards_count || 0) > 0) featuresUsed++;
          if ((usage.translations_count || 0) > 0) featuresUsed++;
          if ((usage.preflights_count || 0) > 0) featuresUsed++;
          if ((usage.hooks_count || 0) > 0) featuresUsed++;
        }

        // Also check chat usage
        const { data: freeUsage } = await supabase
          .from("free_usage")
          .select("chat_count")
          .eq("user_id", user.id)
          .maybeSingle();
        if ((freeUsage?.chat_count || 0) > 0) featuresUsed++;

        // 6 possible features → 0.3 max
        const breadthScore = 0.3 * Math.min(featuresUsed / 4, 1); // 4+ features = max

        // ── 3. Usage volume (0-0.2) ───────────────────────────────────────────
        const totalMonthlyActions = usage
          ? (usage.analyses_count || 0) + (usage.boards_count || 0) +
            (usage.translations_count || 0) + (usage.preflights_count || 0) +
            (usage.hooks_count || 0)
          : 0;
        // 10+ actions = max
        const volumeScore = 0.2 * Math.min(totalMonthlyActions / 10, 1);

        // ── 4. Streak bonus (0-0.2) ───────────────────────────────────────────
        const streak = user.login_streak || 0;
        // 5+ day streak = max
        const streakScore = 0.2 * Math.min(streak / 5, 1);

        // ── TOTAL ─────────────────────────────────────────────────────────────
        const score = Math.round((loginScore + breadthScore + volumeScore + streakScore) * 100) / 100;
        const isRisk = score < 0.3;

        // Update profile
        await supabase.from("profiles").update({
          health_score: score,
          health_updated_at: new Date().toISOString(),
          health_risk_flagged: isRisk,
          total_actions: (user.total_actions || 0) + totalMonthlyActions,
        } as any).eq("id", user.id);

        scored++;
        if (isRisk) flagged++;

      } catch (e) {
        log(`Error scoring user ${user.id}`, { error: String(e) });
      }
    }

    log("Scoring complete", { scored, flagged, total: users.length });

    return new Response(JSON.stringify({ scored, flagged, total: users.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    log("ERROR", { error: String(e) });
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
