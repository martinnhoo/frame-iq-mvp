import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const body = await req.json();
    // Support both old field names (source_text) and new ones (text)
    const source_text = body.source_text || body.text || '';
    const to_language = body.to_language || body.target_language || 'en';
    const to_language_name = body.to_language_name || body.target_language_name || to_language;
    const from_language = body.from_language || body.source_language || 'auto';
    const from_language_name = body.from_language_name || body.source_language_name || from_language;
    const tone = body.tone || '';
    const context = body.context || '';
    const user_id = body.user_id;
    const multi_targets = body.multi_targets as string[] | undefined; // array of lang codes for multi-translate
    const cultural_notes = body.cultural_notes !== false; // default true

    if (!source_text) {
      return new Response(JSON.stringify({ error: 'Missing source_text' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Usage check
    if (user_id) {
      const period = new Date().toISOString().slice(0, 7);
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user_id).single();
      const { data: usage } = await supabase.from('usage').select('translations_count').eq('user_id', user_id).eq('period', period).single();
      const limits: Record<string, number> = { free: 10, creator: 10, starter: 50, studio: 200, scale: 2000 };
      const plan = profile?.plan || 'free';
      const count = usage?.translations_count || 0;
      if (count >= (limits[plan] ?? 10)) {
        return new Response(JSON.stringify({ error: 'limit_reached', plan }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }

    // No API key — return mock
    if (!ANTHROPIC_API_KEY) {
      const mockResult = {
        translated_text: `[MOCK] ${source_text.slice(0, 80)}... → translated to ${to_language_name}`,
        cultural_adaptation: `Cultural note for ${to_language_name}: adapt slang and regional references for local market.`,
        mock_mode: true,
        message: 'Add ANTHROPIC_API_KEY to Supabase Secrets for real translation'
      };
      if (multi_targets?.length) {
        mockResult['multi'] = multi_targets.map(lang => ({
          lang,
          translated_text: `[MOCK] ${source_text.slice(0, 60)}... → ${lang}`,
          cultural_adaptation: `Cultural note for ${lang}`
        }));
      }
      return new Response(JSON.stringify(mockResult), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Build translation targets
    const targets = multi_targets?.length
      ? multi_targets.map(l => ({ code: l, name: l }))
      : [{ code: to_language, name: to_language_name }];

    const results: Array<{ lang: string; translated_text: string; cultural_adaptation: string }> = [];

    for (const target of targets) {
      const systemPrompt = `You are an expert advertising translator and cultural strategist. Your job is to translate ad scripts, captions, and VO copy so they feel native — not translated.

Rules:
- Preserve the hook strength and urgency. Never soften a CTA.
- Adapt idioms, slang, and cultural references to what works in the target market
- Keep emojis if present. Keep all caps if used for emphasis.
- Output format: respond with a JSON object with two fields:
  - "translated": the full translated text, ready to use as-is
  - "cultural_notes": 2-3 bullet points of specific cultural adaptations made (e.g. "Changed 'bro' to 'mano' for BR market")
- No explanations outside the JSON.`;

      const userMsg = `Translate this ad content FROM ${from_language_name} TO ${target.name}:

---
${source_text}
---

${tone ? `Tone: ${tone}` : ''}
${context ? `Context: ${context}` : ''}

Return ONLY valid JSON: {"translated": "...", "cultural_notes": "..."}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMsg }]
        })
      });

      if (!res.ok) throw new Error(`Claude API ${res.status}`);
      const data = await res.json();
      const raw = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
      let parsed: { translated: string; cultural_notes: string };
      try { parsed = JSON.parse(raw); }
      catch { parsed = { translated: raw, cultural_notes: '' }; }

      results.push({ lang: target.code, translated_text: parsed.translated, cultural_adaptation: parsed.cultural_notes });
    }

    // Increment usage
    if (user_id) {
      const period = new Date().toISOString().slice(0, 7);
      const { data: usage } = await supabase.from('usage').select('translations_count').eq('user_id', user_id).eq('period', period).single();
      await supabase.from('usage').upsert({ user_id, period, translations_count: (usage?.translations_count || 0) + 1 }, { onConflict: 'user_id,period' });
    }

    const primary = results[0];
    return new Response(JSON.stringify({
      success: true,
      translated_text: primary.translated_text,
      cultural_adaptation: primary.cultural_adaptation,
      multi: results.length > 1 ? results : undefined,
      mock_mode: false,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('translate-text error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
