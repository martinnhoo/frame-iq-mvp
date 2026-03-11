import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const { product, niche, market, platform, tone, user_id, count = 10 } = await req.json();

    if (!product) return new Response(JSON.stringify({ error: 'Missing product' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    // Rate limit check
    if (user_id) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user_id).single();
      const { data: rateCheck } = await supabase.rpc('check_and_increment_ai_usage', { p_user_id: user_id, p_plan: profile?.plan || 'free' });
      if (rateCheck && !rateCheck.allowed) {
        return new Response(JSON.stringify({ error: rateCheck.message, daily_limit: true }), {
          status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
    }

    // Load user AI profile for personalization
    let userContext = '';
    if (user_id) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      const { data: profile } = await supabase.from('user_ai_profile')
        .select('top_performing_models, best_platforms, avg_hook_score, creative_style, ai_summary')
        .eq('user_id', user_id).maybeSingle();
      if (profile) {
        userContext = `\nUSER CONTEXT: Their avg hook score is ${profile.avg_hook_score}/10. Best models: ${(profile.top_performing_models || []).join(', ')}. Creative style: ${profile.creative_style || 'unknown'}.`;
      }
    }

    if (!ANTHROPIC_API_KEY) {
      // Mock response
      const mockHooks = Array.from({ length: count }, (_, i) => ({
        hook: `Hook variation ${i + 1} for ${product} — ${['Stop scrolling', 'This changed everything', 'Nobody talks about this', 'I tested this for 30 days', 'The truth about'][i % 5]} ${product}`,
        hook_type: ['curiosity', 'social_proof', 'pattern_interrupt', 'direct_offer', 'emotional'][i % 5],
        predicted_score: Math.round((6 + Math.random() * 3) * 10) / 10,
        hook_strength: ['medium', 'high', 'high', 'viral', 'medium'][i % 5],
        platform_fit: [platform || 'TikTok'],
        why: `This hook works because it creates immediate curiosity about ${product}.`,
        cta_suggestion: 'Swipe up to learn more',
      }));
      return new Response(JSON.stringify({ hooks: mockHooks, mock_mode: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `You are a world-class performance marketing creative director specializing in high-converting ad hooks.
${userContext}

Generate ${count} unique, high-converting hook variations for:
- Product/Service: ${product}
- Niche/Industry: ${niche || 'general'}
- Target Market: ${market || 'global'}
- Primary Platform: ${platform || 'TikTok/Reels'}
- Tone: ${tone || 'aggressive, urgent, direct'}

Rules for hooks:
- Each must stop the scroll in the FIRST 3 SECONDS
- Vary the hook TYPE across the set (curiosity, social proof, pattern interrupt, direct offer, emotional, question, statement, controversy)
- Be specific — no generic hooks
- Some should be controversial or counterintuitive
- Include exact words, not descriptions
- Predict score honestly — not everything is viral

Return ONLY valid JSON (no markdown):
{
  "hooks": [
    {
      "hook": "Exact opening words/sentence — what the creator says or what appears on screen",
      "hook_type": "curiosity|social_proof|pattern_interrupt|direct_offer|emotional|question|statement|controversy",
      "predicted_score": 8.5,
      "hook_strength": "low|medium|high|viral",
      "platform_fit": ["TikTok", "Reels"],
      "why": "One sentence explaining why this hook works psychologically",
      "cta_suggestion": "Best CTA to pair with this hook"
    }
  ]
}`
        }]
      })
    });

    if (!res.ok) throw new Error(`Claude API: ${res.status}`);
    const data = await res.json();
    const text = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    return new Response(JSON.stringify({ hooks: parsed.hooks, mock_mode: false }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('generate-hooks:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
