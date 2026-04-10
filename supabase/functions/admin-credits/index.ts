/**
 * admin-credits — Internal monitoring endpoint for credit system.
 * Returns aggregated credit usage data across all users.
 * Only accessible by LIFETIME_ACCOUNTS (admin emails).
 */
import { LIFETIME_ACCOUNTS } from "../_shared/credits.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Auth: only admin emails
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.slice(7));
    if (authErr || !user || !LIFETIME_ACCOUNTS[user.email || '']) {
      return new Response(JSON.stringify({ error: 'admin_only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const period = new Date().toISOString().slice(0, 7);
    const body = await req.json().catch(() => ({}));
    const queryPeriod = body.period || period;

    // 1. All user credit balances for the period
    const { data: balances } = await supabase
      .from('user_credits')
      .select('user_id, period, total_credits, used_credits, bonus_credits, updated_at')
      .eq('period', queryPeriod)
      .order('used_credits', { ascending: false });

    // 2. Aggregate stats
    const users = balances || [];
    const totalUsers = users.length;
    const totalCreditsIssued = users.reduce((s, u) => s + (u.total_credits + u.bonus_credits), 0);
    const totalCreditsUsed = users.reduce((s, u) => s + u.used_credits, 0);
    const totalBonusIssued = users.reduce((s, u) => s + u.bonus_credits, 0);
    const avgUsagePct = totalCreditsIssued > 0 ? (totalCreditsUsed / totalCreditsIssued * 100) : 0;

    // Users over 80% usage
    const highUsage = users.filter(u => {
      const total = u.total_credits + u.bonus_credits;
      return total > 0 && (u.used_credits / total) >= 0.80;
    });

    // Users who exhausted credits
    const exhausted = users.filter(u => {
      const total = u.total_credits + u.bonus_credits;
      return total > 0 && u.used_credits >= total;
    });

    // 3. Top consumers with profile info
    const topUserIds = users.slice(0, 20).map(u => u.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, plan, name')
      .in('id', topUserIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const topUsers = users.slice(0, 20).map(u => ({
      ...u,
      email: profileMap.get(u.user_id)?.email,
      plan: profileMap.get(u.user_id)?.plan,
      name: profileMap.get(u.user_id)?.name,
      usage_pct: (u.total_credits + u.bonus_credits) > 0
        ? Math.round(u.used_credits / (u.total_credits + u.bonus_credits) * 1000) / 10
        : 0,
    }));

    // 4. Action breakdown for the period
    const { data: txAgg } = await supabase
      .from('credit_transactions')
      .select('action, credits')
      .eq('period', queryPeriod)
      .gt('credits', 0);

    const actionBreakdown: Record<string, { count: number; total_credits: number }> = {};
    for (const tx of (txAgg || [])) {
      if (!actionBreakdown[tx.action]) actionBreakdown[tx.action] = { count: 0, total_credits: 0 };
      actionBreakdown[tx.action].count++;
      actionBreakdown[tx.action].total_credits += tx.credits;
    }

    // 5. Revenue estimation (credits used × avg cost per credit)
    const AVG_COST_PER_CREDIT = 0.0068; // realistic blended cost
    const estimatedApiCost = totalCreditsUsed * AVG_COST_PER_CREDIT;

    return new Response(JSON.stringify({
      period: queryPeriod,
      summary: {
        total_users: totalUsers,
        total_credits_issued: totalCreditsIssued,
        total_credits_used: totalCreditsUsed,
        total_bonus_issued: totalBonusIssued,
        avg_usage_pct: Math.round(avgUsagePct * 10) / 10,
        high_usage_count: highUsage.length,
        exhausted_count: exhausted.length,
        estimated_api_cost_usd: Math.round(estimatedApiCost * 100) / 100,
      },
      top_users: topUsers,
      action_breakdown: actionBreakdown,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('admin-credits error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
