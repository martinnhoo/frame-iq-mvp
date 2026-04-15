/**
 * check-usage v2 — Credit-based usage system
 * Returns credit balance, usage breakdown, and plan info.
 */
import { getEffectivePlan, getPlanCreditPool, PLAN_CREDITS, PLAN_AD_ACCOUNTS, CREDIT_COSTS } from "../_shared/credits.ts";
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

    // Auth: verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use anon-key client with user's token to verify identity
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: authUser }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authUser) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const user_id = body.user_id || authUser.id;

    // Ensure JWT user matches requested user_id
    if (user_id !== authUser.id) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get profile
    const { data: profile } = await supabase
      .from('profiles').select('plan, email, subscription_status').eq('id', user_id).maybeSingle();

    const plan = getEffectivePlan(profile?.plan, profile?.email);
    const isTrialing = profile?.subscription_status === 'trialing';
    const creditPool = getPlanCreditPool(plan, isTrialing);

    // Get credit balance via RPC
    const { data: balance } = await supabase.rpc('get_credit_balance', { p_user_id: user_id });

    // Note: ?? doesn't catch 0, so use explicit null/undefined check for balance fields
    const hasBalance = balance && balance.total !== undefined && balance.total > 0;
    const total = hasBalance ? balance.total : creditPool;
    const used = balance?.used ?? 0;
    const bonus = balance?.bonus ?? 0;
    const remaining = hasBalance ? balance.remaining : creditPool;
    const period = balance?.period ?? new Date().toISOString().slice(0, 7);

    // Usage breakdown by action (last 30 days of transactions)
    const { data: txns } = await supabase
      .from('credit_transactions')
      .select('action, credits')
      .eq('user_id', user_id)
      .eq('period', period)
      .gt('credits', 0); // only deductions (positive = consumed)

    const breakdown: Record<string, { count: number; credits: number }> = {};
    for (const tx of (txns || [])) {
      if (!breakdown[tx.action]) breakdown[tx.action] = { count: 0, credits: 0 };
      breakdown[tx.action].count++;
      breakdown[tx.action].credits += tx.credits;
    }

    // Usage percentage and warning thresholds
    const totalPool = total + bonus;
    const usagePct = totalPool > 0 ? used / totalPool : 0;
    const isOverLimit = remaining <= 0;
    const showWarning = usagePct >= 0.80 && !isOverLimit;

    // Reset date = first of next month
    const now = new Date();
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];

    // Trigger usage alert at 75% (paid plans only, fire-and-forget)
    if (PLAN_CREDITS[plan] > 0 && usagePct >= 0.75 && usagePct < 0.76) {
      supabase.functions.invoke('notify-usage-alert', {
        body: {
          user_id, plan,
          cost_ratio: usagePct,
          estimated_cost: used,
          plan_revenue: PLAN_CREDITS[plan],
        }
      }).catch(() => {/* silent */});
    }

    return new Response(JSON.stringify({
      plan,
      credits: {
        total: totalPool,
        used,
        bonus,
        remaining,
        pool: creditPool,  // plan base (without bonus)
      },
      usage_pct: Math.round(usagePct * 1000) / 1000,
      breakdown,
      credit_costs: CREDIT_COSTS,
      ad_accounts: PLAN_AD_ACCOUNTS[plan] ?? 0,
      reset_date: resetDate,
      period,
      is_over_limit: isOverLimit,
      show_warning: showWarning,
      is_trialing: isTrialing,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('check-usage error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
