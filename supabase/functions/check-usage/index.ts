import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Cost model (USD) ──────────────────────────────────────────────────────────
// Sonnet 4/4.5: $3/MTok input, $15/MTok output
// Estimates per action (tokens × price)
const COST_PER_ACTION = {
  analysis:    (3000 / 1_000_000 * 3) + (800  / 1_000_000 * 15), // ~$0.021
  board:       (2500 / 1_000_000 * 3) + (700  / 1_000_000 * 15), // ~$0.018
  preflight:   (2000 / 1_000_000 * 3) + (600  / 1_000_000 * 15), // ~$0.015
  translation: (800  / 1_000_000 * 3) + (400  / 1_000_000 * 15), // ~$0.008
  hook:        (1500 / 1_000_000 * 3) + (400  / 1_000_000 * 15), // ~$0.0105
};

// ── Plan revenue (monthly) ────────────────────────────────────────────────────
const PLAN_REVENUE: Record<string, number> = {
  free: 0, maker: 19, pro: 49, studio: 149,
};

// Legacy plan aliases — map old plan keys to current plans
const PLAN_ALIAS: Record<string, string> = {
  creator: "maker", starter: "pro", scale: "studio",
};

// ── Hard quantity limits (display only — throttle is cost-based) ──────────────
const PLAN_LIMITS: Record<string, { analyses: number; boards: number; translations: number; preflights: number }> = {
  free:    { analyses: 3,  boards: 3,  translations: 3,   preflights: 3  },
  maker:   { analyses: 20, boards: 20, translations: 100, preflights: 20 },
  pro:     { analyses: 60, boards: 60, translations: -1,  preflights: 60 },
  studio:  { analyses: -1, boards: -1, translations: -1,  preflights: -1 },

};

/**
 * Compute cost-based throttle cooldown in seconds.
 *
 * Logic:
 * - estimate_cost = actions_used × cost_per_action
 * - budget        = plan_revenue (monthly)
 * - ratio         = estimate_cost / budget
 * - below 0.80    → 0s cooldown (free run)
 * - 0.80 – 1.00   → cooldown scales linearly  0s → max_seconds
 * - above 1.00    → max_seconds fixed (never lose money)
 *
 * Free plan: hard daily cap enforced elsewhere; no cost throttle needed.
 */
function computeCooldownSeconds(
  estimatedCost: number,
  planRevenue: number,
  maxCooldownSeconds = 480, // 8 min absolute max
): number {
  if (planRevenue <= 0) return 0; // free plan — handled separately
  const ratio = estimatedCost / planRevenue;
  if (ratio < 0.80) return 0;
  if (ratio >= 1.00) return maxCooldownSeconds;
  // linear scale: 0.80→1.00 maps to 0→maxCooldownSeconds
  return Math.round(((ratio - 0.80) / 0.20) * maxCooldownSeconds);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Missing user_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles').select('plan, last_ai_action_at').eq('id', user_id).single();

    const plan = profile?.plan || 'free';
    const planRevenue = PLAN_REVENUE[plan] ?? 0;
    const planLimits  = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    const currentPeriod = new Date().toISOString().slice(0, 7);
    const { data: usage } = await supabase
      .from('usage').select('*').eq('user_id', user_id).eq('period', currentPeriod).single();

    const analyses_used     = usage?.analyses_count     || 0;
    const boards_used       = usage?.boards_count       || 0;
    const translations_used = usage?.translations_count || 0;
    const preflights_used   = usage?.preflights_count   || 0;
    // hooks not stored in usage table separately — estimate from creative_memory count
    const hooks_used        = usage?.hooks_count        || 0;

    // ── Estimated API cost this month ─────────────────────────────────────────
    const estimatedCost =
      analyses_used     * COST_PER_ACTION.analysis    +
      boards_used       * COST_PER_ACTION.board        +
      translations_used * COST_PER_ACTION.translation  +
      preflights_used   * COST_PER_ACTION.preflight    +
      hooks_used        * COST_PER_ACTION.hook;

    const costRatio = planRevenue > 0 ? estimatedCost / planRevenue : 0;

    // ── Cooldown (cost-based throttle) ────────────────────────────────────────
    const cooldown_seconds = computeCooldownSeconds(estimatedCost, planRevenue);
    const cooldown_active = cooldown_seconds > 0;

    // Check if currently in cooldown window
    let retry_after_seconds = 0;
    if (cooldown_active && profile?.last_ai_action_at) {
      const lastAction = new Date(profile.last_ai_action_at).getTime();
      const elapsed    = (Date.now() - lastAction) / 1000;
      retry_after_seconds = Math.max(0, Math.ceil(cooldown_seconds - elapsed));
    }

    const now      = new Date();
    const reset_date = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];

    const safeRem = (used: number, limit: number) =>
      limit === -1 ? -1 : Math.max(0, limit - used);

    const isOver    = (used: number, limit: number) => limit !== -1 && used >= limit;
    const nearLimit = (used: number, limit: number) =>
      limit !== -1 && limit > 0 && (limit - used) / limit < 0.2;

    const is_over_limit =
      isOver(analyses_used, planLimits.analyses) ||
      isOver(boards_used,   planLimits.boards);

    const show_warning =
      nearLimit(analyses_used, planLimits.analyses) ||
      nearLimit(boards_used,   planLimits.boards)   ||
      nearLimit(translations_used, planLimits.translations);

    // ── Trigger usage alert email at 75% cost ratio (paid plans only) ─────────
    // Fire-and-forget: don't await, don't block the response
    const shouldAlert = planRevenue > 0 && costRatio >= 0.75 && costRatio < 0.76;
    if (shouldAlert) {
      supabase.functions.invoke('notify-usage-alert', {
        body: { user_id, plan, cost_ratio: costRatio, estimated_cost: estimatedCost, plan_revenue: planRevenue }
      }).catch(() => {/* silent */});
    }

    return new Response(JSON.stringify({
      plan,
      estimated_cost:   Math.round(estimatedCost * 10000) / 10000,
      cost_ratio:       Math.round(costRatio * 1000) / 1000,
      cooldown_seconds,
      cooldown_active,
      retry_after_seconds, // 0 = can act now; >0 = wait this many seconds
      analyses:     { used: analyses_used,     limit: planLimits.analyses,     remaining: safeRem(analyses_used,     planLimits.analyses) },
      boards:       { used: boards_used,        limit: planLimits.boards,        remaining: safeRem(boards_used,       planLimits.boards)   },
      translations: { used: translations_used,  limit: planLimits.translations,  remaining: safeRem(translations_used, planLimits.translations) },
      preflights:   { used: preflights_used,    limit: planLimits.preflights,    remaining: safeRem(preflights_used,   planLimits.preflights) },
      reset_date,
      is_over_limit,
      show_warning,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('check-usage error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
