import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Missing user_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabaseClient
      .from('profiles').select('plan').eq('id', user_id).single();

    const plan = profile?.plan || 'free';

    const currentPeriod = new Date().toISOString().slice(0, 7);
    const { data: usage } = await supabaseClient
      .from('usage').select('*').eq('user_id', user_id).eq('period', currentPeriod).single();

    // Limits per plan — must match src/pages/Pricing.tsx
    // -1 = unlimited
    const limits: Record<string, { analyses: number; boards: number; translations: number; preflights: number }> = {
      free:    { analyses: 3,   boards: 3,   translations: 3,   preflights: 3   },
      maker:   { analyses: 20,  boards: 20,  translations: 100, preflights: 20  },
      pro:     { analyses: 60,  boards: 60,  translations: -1,  preflights: 60  },
      studio:  { analyses: -1,  boards: -1,  translations: -1,  preflights: -1  },
      // legacy plan names — map to nearest equivalent
      creator: { analyses: 20,  boards: 20,  translations: 100, preflights: 20  },
      starter: { analyses: 60,  boards: 60,  translations: -1,  preflights: 60  },
      scale:   { analyses: -1,  boards: -1,  translations: -1,  preflights: -1  },
    };

    const planLimits = limits[plan] || limits.free;

    const analyses_used     = usage?.analyses_count     || 0;
    const boards_used       = usage?.boards_count       || 0;
    const translations_used = usage?.translations_count || 0;
    const preflights_used   = usage?.preflights_count   || 0;

    const now = new Date();
    const reset_date = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];

    // -1 means unlimited — remaining is also -1
    const safeRem = (used: number, limit: number) => limit === -1 ? -1 : Math.max(0, limit - used);

    const analyses_rem     = safeRem(analyses_used,     planLimits.analyses);
    const boards_rem       = safeRem(boards_used,       planLimits.boards);
    const translations_rem = safeRem(translations_used, planLimits.translations);
    const preflights_rem   = safeRem(preflights_used,   planLimits.preflights);

    const isOver = (used: number, limit: number) => limit !== -1 && used >= limit;

    const is_over_limit = isOver(analyses_used, planLimits.analyses) || isOver(boards_used, planLimits.boards);

    const nearLimit = (used: number, limit: number) =>
      limit !== -1 && (limit - used) / limit < 0.2;

    const show_warning =
      nearLimit(analyses_used, planLimits.analyses) ||
      nearLimit(boards_used, planLimits.boards) ||
      nearLimit(translations_used, planLimits.translations);

    return new Response(JSON.stringify({
      plan,
      analyses:     { used: analyses_used,     limit: planLimits.analyses,     remaining: analyses_rem },
      boards:       { used: boards_used,        limit: planLimits.boards,        remaining: boards_rem },
      translations: { used: translations_used,  limit: planLimits.translations,  remaining: translations_rem },
      preflights:   { used: preflights_used,    limit: planLimits.preflights,    remaining: preflights_rem },
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
