const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    const { ad_text, industry, market, context, persona_context } = await req.json();
    if (!ad_text) return new Response(JSON.stringify({ error: 'Provide ad_text' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    let prompt = `You are a ruthless performance marketing strategist who has run $100M+ in ad spend across Meta, TikTok, Google, and YouTube. You decode competitor ads with surgical precision.

Decode this competitor ad and provide analysis based on REAL industry benchmarks and what top-performing brands actually do in this vertical.

AD:
${ad_text}

Industry: ${industry || 'unknown'} | Market: ${market || 'global'}`;

    if (persona_context) {
      prompt += `\n\nTARGET AUDIENCE PERSONA (the user's audience — use this to make the counter strategy hyper-relevant):
${persona_context}`;
    }

    if (context) {
      prompt += `\n\nADDITIONAL CONTEXT:
${context}`;
    }

    prompt += `\n\nReturn ONLY valid JSON:
{
  "framework": "<the persuasion framework used, e.g. AIDA, PAS, Before-After-Bridge>",
  "hook_type": "curiosity|pain_point|social_proof|pattern_interrupt|direct_offer|emotional|question",
  "hook_score": <1-10 based on real benchmarks for this industry>,
  "hook_strength": "low|medium|high|viral",
  "emotional_triggers": ["<specific trigger>", ...],
  "persuasion_tactics": ["<specific tactic>", ...],
  "target_audience": "<detailed audience description>",
  "creative_model": "UGC|Testimonial|Tutorial|Problem-Solution|Before-After|Promo|Demo|Talking-Head|Slideshow",
  "strengths": ["<specific strength with WHY it works, referencing real data>", ...],
  "weaknesses": ["<specific weakness with benchmark comparison>", ...],
  "counter_strategy": "<detailed 3-4 sentence strategy based on what the top brands in ${industry || 'this vertical'} do to beat this type of ad. Include specific tactics, hook formulas, and creative approaches that have proven ROI>",
  "steal_worthy": ["<element worth adapting with HOW to adapt it>", ...],
  "threat_level": "low|medium|high|critical"
}`;

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error('AI gateway error:', res.status, t);
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again shortly.' }), {
          status: 429, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
          status: 402, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI ${res.status}`);
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(rawContent.replace(/```json|```/g, '').trim());
    return new Response(JSON.stringify({ ...parsed, mock_mode: false }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
