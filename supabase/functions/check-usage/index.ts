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

    // Limits per plan
    const limits = {
      free:   { analyses: 3,   boards: 3,   translations: 3,    preflights: 2 },
      maker:  { analyses: 10,  boards: 10,  translations: 50,   preflights: 10 },
      pro:    { analyses: 30,  boards: 30,  translations: 100,  preflights: 30 },
      studio: { analyses: 500, boards: 300, translations: 1000, preflights: 9999 },
    };

    const planLimits = limits[plan as keyof typeof limits] || limits.free;

    const analyses_used     = usage?.analyses_count     || 0;
    const boards_used       = usage?.boards_count       || 0;
    const translations_used = usage?.translations_count || 0;
    const preflights_used   = usage?.preflights_count   || 0;

    const now = new Date();
    const reset_date = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];

    const analyses_rem     = Math.max(0, planLimits.analyses     - analyses_used);
    const boards_rem       = Math.max(0, planLimits.boards       - boards_used);
    const translations_rem = Math.max(0, planLimits.translations - translations_used);
    const preflights_rem   = Math.max(0, planLimits.preflights   - preflights_used);

    const is_over_limit =
      analyses_used >= planLimits.analyses ||
      boards_used   >= planLimits.boards;

    const show_warning =
      (analyses_rem / planLimits.analyses)     < 0.2 ||
      (boards_rem   / planLimits.boards)        < 0.2 ||
      (translations_rem / planLimits.translations) < 0.2;

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
