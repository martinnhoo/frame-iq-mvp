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

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('plan')
      .eq('id', user_id)
      .single();

    const plan = profile?.plan || 'free';

    // Get current usage
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const { data: usage } = await supabaseClient
      .from('usage')
      .select('*')
      .eq('user_id', user_id)
      .eq('period', currentPeriod)
      .single();

    // Define limits per plan
    const limits = {
      free: {
        analyses: 3,
        boards: 3,
        videos: 0,
        translations: 10
      },
      studio: {
        analyses: 30,
        boards: 30,
        videos: 5,
        translations: 100
      },
      scale: {
        analyses: 500,
        boards: 300,
        videos: 300,
        translations: 1000
      }
    };

    const planLimits = limits[plan as keyof typeof limits] || limits.free;

    const analyses_used = usage?.analyses_count || 0;
    const boards_used = usage?.boards_count || 0;
    const videos_used = usage?.videos_count || 0;
    const translations_used = usage?.translations_count || 0;

    // Calculate reset date (first day of next month)
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const reset_date = nextMonth.toISOString().split('T')[0];

    // Check if over limit
    const is_over_limit = 
      analyses_used >= planLimits.analyses ||
      boards_used >= planLimits.boards ||
      videos_used >= planLimits.videos ||
      translations_used >= planLimits.translations;

    // Check if any limit is below 20%
    const analyses_remaining_pct = ((planLimits.analyses - analyses_used) / planLimits.analyses) * 100;
    const boards_remaining_pct = ((planLimits.boards - boards_used) / planLimits.boards) * 100;
    const videos_remaining_pct = planLimits.videos > 0 ? ((planLimits.videos - videos_used) / planLimits.videos) * 100 : 100;
    const translations_remaining_pct = ((planLimits.translations - translations_used) / planLimits.translations) * 100;

    const show_warning = 
      analyses_remaining_pct < 20 ||
      boards_remaining_pct < 20 ||
      (planLimits.videos > 0 && videos_remaining_pct < 20) ||
      translations_remaining_pct < 20;

    return new Response(
      JSON.stringify({
        plan,
        analyses: {
          used: analyses_used,
          limit: planLimits.analyses,
          remaining: Math.max(0, planLimits.analyses - analyses_used)
        },
        boards: {
          used: boards_used,
          limit: planLimits.boards,
          remaining: Math.max(0, planLimits.boards - boards_used)
        },
        videos: {
          used: videos_used,
          limit: planLimits.videos,
          remaining: Math.max(0, planLimits.videos - videos_used)
        },
        translations: {
          used: translations_used,
          limit: planLimits.translations,
          remaining: Math.max(0, planLimits.translations - translations_used)
        },
        reset_date,
        is_over_limit,
        show_warning
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-usage:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
