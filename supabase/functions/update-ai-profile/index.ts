import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const { user_id, trigger } = await req.json();

    if (!user_id) return new Response(JSON.stringify({ error: 'Missing user_id' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    const [
      { data: analyses },
      { data: boards },
      { data: memory },
      { data: currentProfile },
      { data: feedback },
    ] = await Promise.all([
      supabase.from('analyses').select('result, hook_strength, created_at').eq('user_id', user_id).eq('status', 'completed').order('created_at', { ascending: false }).limit(50),
      supabase.from('boards').select('prompt, market, platform, duration_seconds, created_at').eq('user_id', user_id).order('created_at', { ascending: false }).limit(50),
      supabase.from('creative_memory').select('hook_type, creative_model, platform, market, hook_score, ctr, roas').eq('user_id', user_id).limit(100),
      supabase.from('user_ai_profile').select('*').eq('user_id', user_id).maybeSingle(),
      supabase.from('output_feedback').select('source_type, rating, output_text, context, created_at').eq('user_id', user_id).order('created_at', { ascending: false }).limit(50),
    ]);

    if (!analyses?.length && !boards?.length) {
      return new Response(JSON.stringify({ skipped: 'Not enough data yet' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Build stats ──────────────────────────────────────────────────────────
    const hookCounts: Record<string, number> = {};
    const modelCounts: Record<string, number> = {};
    const platformCounts: Record<string, number> = {};
    const marketCounts: Record<string, number> = {};
    const scores: number[] = [];
    const prompts: string[] = [];

    analyses?.forEach(a => {
      if (a.hook_strength) hookCounts[a.hook_strength] = (hookCounts[a.hook_strength] || 0) + 1;
      const r = a.result as Record<string, unknown> | null;
      if (r?.creative_model) modelCounts[String(r.creative_model)] = (modelCounts[String(r.creative_model)] || 0) + 1;
      if (r?.hook_score) scores.push(Number(r.hook_score));
      if (r?.recommended_platforms) {
        (r.recommended_platforms as string[]).forEach((p: string) => { platformCounts[p] = (platformCounts[p] || 0) + 1; });
      }
    });

    boards?.forEach(b => {
      if (b.market) marketCounts[b.market] = (marketCounts[b.market] || 0) + 1;
      if (b.platform) platformCounts[b.platform] = (platformCounts[b.platform] || 0) + 1;
      if (b.prompt) prompts.push(b.prompt.substring(0, 200));
    });

    memory?.forEach(m => {
      if (m.hook_score) scores.push(Number(m.hook_score));
    });

    // ── Feedback signals ─────────────────────────────────────────────────────
    const positiveFeedback = feedback?.filter(f => f.rating === 1) ?? [];
    const negativeFeedback = feedback?.filter(f => f.rating === -1) ?? [];
    const feedbackSummary = feedback?.length
      ? `User has rated ${positiveFeedback.length} outputs as helpful and ${negativeFeedback.length} as unhelpful. ` +
        (positiveFeedback.length > 0
          ? `Liked: ${positiveFeedback.slice(0, 3).map(f => f.source_type + (f.output_text ? ` ("${f.output_text.slice(0, 60)}...")` : '')).join(' | ')}. `
          : '') +
        (negativeFeedback.length > 0
          ? `Disliked: ${negativeFeedback.slice(0, 3).map(f => f.source_type + (f.output_text ? ` ("${f.output_text.slice(0, 60)}...")` : '')).join(' | ')}.`
          : '')
      : 'No explicit feedback yet.';

    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const topModels = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    const topPlatforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    const topMarkets = Object.entries(marketCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    const topHooks = Object.entries(hookCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);

    let aiSummary = (currentProfile as Record<string, unknown> | null)?.ai_summary as string | null || null;
    let aiRecommendations: string[] = (currentProfile as Record<string, unknown> | null)?.ai_recommendations as string[] || [];
    let creativeStyle = (currentProfile as Record<string, unknown> | null)?.creative_style as string | null || null;

    // ── Anthropic AI analysis (if enough data) ───────────────────────────────
    if (ANTHROPIC_API_KEY && (analyses?.length || 0) >= 3) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            messages: [{
              role: 'user',
              content: `You are a creative intelligence analyst for a performance marketing SaaS. Analyze this user's creative patterns and feedback to generate personalized insights.

DATA:
- Analyses: ${analyses?.length || 0} | Boards: ${boards?.length || 0}
- Avg hook score: ${avgScore.toFixed(1)}/10
- Top creative models: ${topModels.join(', ') || 'none'}
- Top platforms: ${topPlatforms.join(', ') || 'none'}
- Top markets: ${topMarkets.join(', ') || 'none'}
- Hook strengths: ${JSON.stringify(hookCounts)}
- Recent prompt themes: ${prompts.slice(0, 5).join(' | ')}
- Feedback signals: ${feedbackSummary}

Return ONLY valid JSON (no markdown):
{"summary":"2-3 sentence personalized insight about their creative style and patterns","recommendations":["specific actionable tip 1","specific actionable tip 2","specific actionable tip 3"],"creative_style":"brief label e.g. Performance UGC Specialist"}`
            }]
          })
        });

        if (!response.ok) {
          throw new Error(`Claude API error: ${response.status}`);
        }

        const msg = await response.json();
        const text = (msg.content?.[0]?.type === 'text' ? msg.content[0].text : '').replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(text);
        aiSummary = parsed.summary;
        aiRecommendations = parsed.recommendations || [];
        if (parsed.creative_style) creativeStyle = parsed.creative_style;
      } catch (e) {
        console.error('Anthropic AI error:', e);
      }
    }

    await supabase.from('user_ai_profile').upsert({
      user_id,
      top_performing_hooks: topHooks,
      top_performing_models: topModels,
      best_markets: topMarkets,
      best_platforms: topPlatforms,
      avg_hook_score: Math.round(avgScore * 10) / 10,
      total_analyses: analyses?.length || 0,
      ai_summary: aiSummary,
      ai_recommendations: aiRecommendations,
      creative_style: creativeStyle,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return new Response(JSON.stringify({ success: true, trigger, feedback_signals: feedback?.length || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('update-ai-profile:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
