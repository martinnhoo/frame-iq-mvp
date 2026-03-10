const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const { ad_text, industry, market } = await req.json();
    if (!ad_text) return new Response(JSON.stringify({ error: 'Provide ad_text' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({
        framework: "Problem-Solution-CTA", hook_type: "pain_point", hook_score: 7.2, hook_strength: "high",
        emotional_triggers: ["fear of missing out", "social proof", "authority"],
        persuasion_tactics: ["scarcity", "testimonial", "risk reversal"],
        target_audience: "Adults 25-45 interested in improvement",
        creative_model: "Testimonial",
        strengths: ["Clear problem identification", "Strong social proof", "Specific numbers used"],
        weaknesses: ["CTA could be more urgent", "Hook takes 4s to land — too slow"],
        counter_strategy: "Lead with the outcome, not the problem. Use a hook under 2s with a direct benefit statement. Add a time-limited CTA.",
        steal_worthy: ["The specific stat format: 'X% of users see results in N days'", "Risk reversal framing at the end"],
        threat_level: "medium", mock_mode: true
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 2000,
        messages: [{ role: 'user', content: `You are a ruthless performance marketing strategist. Decode this competitor ad.\n\nAD:\n${ad_text}\n\nIndustry: ${industry || 'unknown'} | Market: ${market || 'global'}\n\nReturn ONLY valid JSON:\n{"framework":"","hook_type":"curiosity|pain_point|social_proof|pattern_interrupt|direct_offer|emotional|question","hook_score":7.5,"hook_strength":"low|medium|high|viral","emotional_triggers":[],"persuasion_tactics":[],"target_audience":"","creative_model":"UGC|Testimonial|Tutorial|Problem-Solution|Before-After|Promo|Demo|Talking-Head|Slideshow","strengths":[],"weaknesses":[],"counter_strategy":"","steal_worthy":[],"threat_level":"low|medium|high|critical"}` }]
      })
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse((data.content?.[0]?.text || '').replace(/```json|```/g, '').trim());
    return new Response(JSON.stringify({ ...parsed, mock_mode: false }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
