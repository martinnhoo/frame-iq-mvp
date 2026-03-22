// decode-competitor v3 — surgical analysis, zero fluff, max actionability
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });

    const { ad_text, industry, market, context, persona_context } = await req.json();
    if (!ad_text) return new Response(JSON.stringify({ error: 'ad_text required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    const systemPrompt = `You are a $100M+ ad spend strategist. You decode competitor ads with surgical precision.

RULES:
1. Every field must be SPECIFIC to this exact ad — no generic marketing copy
2. counter_strategy and ready_hooks must be in the SAME LANGUAGE as the ad_text
3. ready_hooks must be immediately usable — copy-paste ready, not templates
4. If context about the user's brand is given, every recommendation must be tailored to BEAT this specific ad for that brand
5. Mismatch check: if ad content clearly belongs to a different industry than stated context, set mismatch_detected: true
6. Return ONLY valid JSON. No markdown. No text outside JSON.`;

    const userPrompt = `Decode this competitor ad with maximum precision:

AD CONTENT:
${ad_text}

INDUSTRY: ${industry || 'Not specified'}
MARKET: ${market || 'Global'}
${context ? `\nMY BRAND CONTEXT: ${context}` : ''}
${persona_context ? `\nMY AUDIENCE: ${persona_context}` : ''}

Return this exact JSON:
{
  "mismatch_detected": <true|false>,
  "mismatch_reason": "<if true: explain exactly what the ad is vs what was stated. If false: empty string>",
  
  "hook_type": "<curiosity|pain_point|social_proof|pattern_interrupt|direct_offer|emotional|question>",
  "hook_formula": "<the EXACT formula extracted from first 3 seconds, e.g.: '[Shocking number] + [desire] + [secret implication]'>",
  "hook_score": <1.0-10.0 — benchmark against top 10% of ${industry} ads in ${market}>,
  "hook_strength": "<low|medium|high|viral>",
  
  "framework": "<AIDA|PAS|BAB|Hook-Story-Offer|4Ps|before-after|problem-agitate-solve|other>",
  "creative_model": "<UGC|Testimonial|Tutorial|Problem-Solution|Before-After|Promo|Demo|Talking-Head|Slideshow|Native>",
  "pacing": "<fast-cut|slow-build|shock-open|social-scroll|talking-head-direct>",
  
  "target_audience": "<specific: age range, intent, pain state, awareness level — 1 sentence max>",
  "emotional_triggers": ["<exact trigger name, 3-6 words max>"],
  "persuasion_tactics": ["<exact tactic, 3-6 words max>"],
  
  "hook_dissection": "<2 sentences max explaining EXACTLY why this hook works or doesn't work — specific to this ad>",
  
  "strengths": ["<strength + WHY it works in 1 sentence>"],
  "weaknesses": ["<weakness + what's missing in 1 sentence>"],
  
  "threat_level": "<low|medium|high|critical>",
  "threat_reason": "<1 sentence: why this threat level — specific to ${industry} in ${market}>",
  
  "counter_strategy": "<3 sentences max. Specific tactics to beat this exact ad. Name the hook angle, emotional trigger, and format to use. In the same language as the ad.>",
  
  "steal_worthy": ["<element to steal + HOW to adapt it in 1 sentence>"],
  
  "ready_hooks": [
    {
      "hook": "<ready-to-use hook — copy-paste, same language as ad>",
      "type": "<hook type>",
      "angle": "<what makes this different from competitor: 3-5 words>"
    },
    {
      "hook": "<different emotional trigger — same language>",
      "type": "<hook type>",
      "angle": "<angle in 3-5 words>"
    },
    {
      "hook": "<different format/pacing approach — same language>",
      "type": "<hook type>",
      "angle": "<angle in 3-5 words>"
    },
    {
      "hook": "<pain-point attack on competitor weakness — same language>",
      "type": "<hook type>",
      "angle": "<angle in 3-5 words>"
    },
    {
      "hook": "<curiosity/pattern interrupt approach — same language>",
      "type": "<hook type>",
      "angle": "<angle in 3-5 words>"
    }
  ],
  
  "immediate_action": "<1 specific action to take TODAY based on this analysis. Concrete, not vague. In same language as ad.>"
}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) { const t = await res.text(); throw new Error(`Anthropic ${res.status}: ${t.slice(0,200)}`); }
    const data = await res.json();
    const raw = data.content?.[0]?.type === 'text' ? data.content[0].text : '{}';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return new Response(JSON.stringify({ ...parsed, mock_mode: false }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('decode-competitor error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
// redeploy 202603231600
