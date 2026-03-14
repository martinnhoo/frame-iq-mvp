import { createClient } from "npm:@supabase/supabase-js@2";

// ── Cost-based progressive throttle ──────────────────────────────────────────
const _COST_PER = { analysis:(3000/1e6*3)+(800/1e6*15), board:(2500/1e6*3)+(700/1e6*15), preflight:(2000/1e6*3)+(600/1e6*15), translation:(800/1e6*3)+(400/1e6*15), hook:(1500/1e6*3)+(400/1e6*15) };
const _PLAN_REV: Record<string,number> = { free:0, maker:19, pro:49, studio:149, creator:19, starter:49, scale:149 };
async function checkThrottle(sb: ReturnType<typeof createClient>, uid: string): Promise<{allowed:boolean;retry_after:number}> {
  const period = new Date().toISOString().slice(0,7);
  const [{data:prof},{data:usage}] = await Promise.all([
    sb.from('profiles').select('plan,last_ai_action_at').eq('id',uid).single(),
    sb.from('usage').select('analyses_count,boards_count,translations_count,preflights_count,hooks_count').eq('user_id',uid).eq('period',period).single(),
  ]);
  const rev = _PLAN_REV[prof?.plan||'free']??0;
  if(rev<=0) return {allowed:true,retry_after:0};
  const cost=(usage?.analyses_count||0)*_COST_PER.analysis+(usage?.boards_count||0)*_COST_PER.board+(usage?.translations_count||0)*_COST_PER.translation+(usage?.preflights_count||0)*_COST_PER.preflight+(usage?.hooks_count||0)*_COST_PER.hook;
  const ratio=cost/rev;
  if(ratio<0.80) return {allowed:true,retry_after:0};
  const maxSec=480;
  const cooldown=ratio>=1?maxSec:Math.round(((ratio-0.80)/0.20)*maxSec);
  const elapsed=prof?.last_ai_action_at?(Date.now()-new Date(prof.last_ai_action_at).getTime())/1000:cooldown+1;
  const wait=Math.max(0,Math.ceil(cooldown-elapsed));
  if(wait>0) return {allowed:false,retry_after:wait};
  await sb.from('profiles').update({last_ai_action_at:new Date().toISOString()}).eq('id',uid);
  return {allowed:true,retry_after:0};
}
// ─────────────────────────────────────────────────────────────────────────────


const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const { product, niche, market, platform, tone, user_id, count = 10, persona_context, funnel_stage = "tofu" } = await req.json();

    const FUNNEL_CONTEXT: Record<string, string> = {
      tofu: "TOP OF FUNNEL (cold audience) — hooks must generate AWARENESS. Interrupt the scroll, spark curiosity or emotion. No assumptions about brand knowledge. Lead with a problem, insight, or bold claim.",
      mofu: "MIDDLE OF FUNNEL (warm audience) — hooks must drive CONSIDERATION. The person knows the category but is evaluating. Lead with differentiation, social proof, or deeper benefit.",
      bofu: "BOTTOM OF FUNNEL (hot audience) — hooks must trigger CONVERSION. The person is ready to decide. Lead with urgency, specific offer, risk reversal, or final push.",
    };

    if (!product) return new Response(JSON.stringify({ error: 'Missing product' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    // ── Cost-based throttle check ──
    if (user_id) {
      const _sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      const throttle = await checkThrottle(_sb, user_id);
      if (!throttle.allowed) {
        return new Response(JSON.stringify({
          error: 'rate_limited',
          message: 'Processing will be available shortly. Please try again in a moment.',
          retry_after_seconds: throttle.retry_after,
        }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }

    // Load user AI profile + loop context for personalization
    let userContext = '';
    if (user_id) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      const { data: profile } = await supabase.from('user_ai_profile')
        .select('top_performing_models, best_platforms, avg_hook_score, creative_style, ai_summary')
        .eq('user_id', user_id).maybeSingle();
      if (profile) {
        userContext = `\nUSER CONTEXT: Their avg hook score is ${profile.avg_hook_score}/10. Best models: ${(profile.top_performing_models || []).join(', ')}. Creative style: ${profile.creative_style || 'unknown'}.`;
      }

      // Fetch loop context (learned patterns + creative memory)
      try {
        const loopRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/creative-loop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
          },
          body: JSON.stringify({ action: 'get_context', user_id }),
        });
        if (loopRes.ok) {
          const loopData = await loopRes.json();
          if (loopData.has_data && loopData.context) {
            userContext += `\n\n--- ACCOUNT CREATIVE INTELLIGENCE (from real ad data) ---\n${loopData.context}\n--- Use these patterns to generate hooks that match proven winners. ---`;
          }
        }
      } catch { /* optional */ }
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
${persona_context ? `\nACTIVE AUDIENCE PERSONA — write every hook FOR THIS SPECIFIC PERSON:\n- Name: ${persona_context.name} (${persona_context.age}, ${persona_context.gender})\n- Core pains: ${persona_context.pains?.join(', ')}\n- Desires: ${persona_context.desires?.join(', ')}\n- Triggers: ${persona_context.triggers?.join(', ')}\n- Language style: ${persona_context.language_style}\n- Best platforms: ${persona_context.best_platforms?.join(', ')}\n- Proven hook angles for this persona: ${persona_context.hook_angles?.join(' | ')}\nEvery hook must resonate specifically with this person's psychology, not a generic audience.\n` : ''}
FUNNEL STAGE: ${FUNNEL_CONTEXT[funnel_stage] || FUNNEL_CONTEXT.tofu}
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
