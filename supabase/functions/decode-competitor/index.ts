// decode-competitor v4 — densidade máxima, zero fluff, idioma do anúncio
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });

    const { ad_text, observation, persona_context, ui_language } = await req.json();
    if (!ad_text) return new Response(JSON.stringify({ error: 'ad_text required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    // Determine response language based on ui_language or ad content
    const langInstructions: Record<string, string> = {
      pt: 'Respond in Brazilian Portuguese (PT-BR). All labels, descriptions, hooks, strategy — everything in PT-BR.',
      es: 'Respond in Spanish. All labels, descriptions, hooks, strategy — everything in Spanish.',
      en: 'Respond in English. All labels, descriptions, hooks, strategy — everything in English.',
    };
    const langInstruction = langInstructions[ui_language || 'pt'] || langInstructions.pt;

    const systemPrompt = `You are a performance marketing strategist who has spent $100M+ on ads.
You decode competitor ads with extreme precision and zero fluff.

LANGUAGE RULE: ${langInstruction}
The ad content may be in any language — your ANALYSIS AND OUTPUT must be in the language specified above.

RULES:
1. Be surgical — every sentence must add value. No filler.
2. Identify industry/niche FROM THE AD CONTENT itself — never assume.
3. If the input looks like a URL (starts with http), respond noting it cannot be processed directly and ask for the transcript or copy.
4. If observation is given, weight your entire analysis toward that question.
5. Return ONLY valid JSON. No markdown.`;

    const userPrompt = `Decode this competitor ad:

AD CONTENT:
${ad_text}

${observation ? `USER FOCUS: ${observation}` : ''}
${persona_context ? `MY ACCOUNT CONTEXT: ${persona_context}` : ''}

Return exactly this JSON (all string values in the specified language):
{
  "industry": "<auto-detected: be specific, e.g. 'iGaming/Cassino', 'E-commerce moda feminina', 'SaaS B2B'>",
  "market": "<detected market/country from language, currency, slang>",
  "mismatch_detected": false,
  "mismatch_reason": "",
  
  "hook_score": <1.0-10.0>,
  "hook_type": "<type in detected language, e.g. 'Prova Social', 'Curiosidade', 'Oferta Direta'>",
  "hook_formula": "<exact formula extracted from first 3 seconds>",
  "hook_dissection": "<2 sentences: why this hook works or fails — be direct>",
  
  "format": "<UGC|Depoimento|Tutorial|Problema-Solução|Antes-Depois|Promo|Demo|Talking Head|Slideshow|Nativo>",
  "target_audience": "<1 sentence: age, intent, pain state>",
  "emotional_triggers": ["<trigger>", "<trigger>", "<trigger>"],
  
  "strengths": ["<strength + why it works>"],
  "weaknesses": ["<weakness + what's missing>"],
  
  "threat_level": "<low|medium|high|critical>",
  "counter_strategy": "<3 sentences max: concrete tactics to beat this ad. Name hook angle, trigger, format.>",
  
  "steal_worthy": ["<element + how to adapt>"],
  
  "ready_hooks": [
    { "hook": "<copy-paste ready hook>", "angle": "<3-5 words: what makes it different>" },
    { "hook": "<different emotional trigger>", "angle": "<angle>" },
    { "hook": "<pattern interrupt approach>", "angle": "<angle>" }
  ],
  
  "immediate_action": "<1 concrete action to take TODAY. Specific, not vague.>"
}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
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
// redeploy 202603251600
