import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    let user_id: string | null = null;

    if (authHeader) {
      const { data: { user } } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
      user_id = user?.id ?? null;
    }

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('plan, last_ai_action_at')
      .eq('id', user_id)
      .single();

    const plan = profile?.plan || 'free';

    const currentPeriod = new Date().toISOString().slice(0, 7);
    const { data: usage } = await supabaseClient
      .from('usage')
      .select('*')
      .eq('user_id', user_id)
      .eq('period', currentPeriod)
      .single();

    // ── Plan definitions ──────────────────────────────────────────────────
    // -1 = unlimited
    const limits: Record<string, {
      analyses: number; boards: number; translations: number; preflights: number;
      hooks_unlimited: boolean; cooldown_hours: number | null;
    }> = {
      free:   { analyses: 3,  boards: 3,  translations: 5,    preflights: 3,  hooks_unlimited: false, cooldown_hours: 24 },
      maker:  { analyses: 20, boards: 20, translations: 100,  preflights: 20, hooks_unlimited: true,  cooldown_hours: null },
      pro:    { analyses: 60, boards: 60, translations: -1,   preflights: 60, hooks_unlimited: true,  cooldown_hours: null },
      studio: { analyses: -1, boards: -1, translations: -1,   preflights: -1, hooks_unlimited: true,  cooldown_hours: null },
      // legacy names kept for backwards compatibility
      creator: { analyses: 20, boards: 20, translations: 100, preflights: 20, hooks_unlimited: true,  cooldown_hours: null },
      scale:   { analyses: -1, boards: -1, translations: -1,  preflights: -1, hooks_unlimited: true,  cooldown_hours: null },
    };

    const planLimits = limits[plan] || limits.free;

    const analyses_used     = usage?.analyses_count     || 0;
    const boards_used       = usage?.boards_count       || 0;
    const translations_used = usage?.translations_count || 0;
    const preflights_used   = usage?.preflights_count   || 0;

    const now = new Date();
    const reset_date = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];

    const safeRem = (used: number, limit: number) =>
      limit === -1 ? -1 : Math.max(0, limit - used);

    const analyses_rem     = safeRem(analyses_used, planLimits.analyses);
    const boards_rem       = safeRem(boards_used, planLimits.boards);
    const translations_rem = safeRem(translations_used, planLimits.translations);
    const preflights_rem   = safeRem(preflights_used, planLimits.preflights);

    // Cooldown logic for free plan
    let cooldown_active = false;
    let cooldown_ends_at: string | null = null;
    if (planLimits.cooldown_hours && profile?.last_ai_action_at) {
      const lastAction = new Date(profile.last_ai_action_at);
      const cooldownMs = planLimits.cooldown_hours * 60 * 60 * 1000;
      const endsAt = new Date(lastAction.getTime() + cooldownMs);
      if (now < endsAt) {
        cooldown_active = true;
        cooldown_ends_at = endsAt.toISOString();
      }
    }

    const isOverLimit = (used: number, limit: number) => limit !== -1 && used >= limit;

    const is_over_limit =
      isOverLimit(analyses_used, planLimits.analyses) ||
      isOverLimit(boards_used, planLimits.boards);

    const show_warning =
      (planLimits.analyses !== -1 && (safeRem(analyses_used, planLimits.analyses) / planLimits.analyses) < 0.25) ||
      (planLimits.boards !== -1   && (safeRem(boards_used,   planLimits.boards)   / planLimits.boards)   < 0.25);

    return new Response(JSON.stringify({
      plan,
      analyses:     { used: analyses_used,     limit: planLimits.analyses,     remaining: analyses_rem },
      boards:       { used: boards_used,        limit: planLimits.boards,        remaining: boards_rem },
      translations: { used: translations_used,  limit: planLimits.translations,  remaining: translations_rem },
      preflights:   { used: preflights_used,    limit: planLimits.preflights,    remaining: preflights_rem },
      hooks_unlimited: planLimits.hooks_unlimited,
      cooldown_active,
      cooldown_ends_at,
      reset_date,
      is_over_limit,
      show_warning,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in check-usage:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
