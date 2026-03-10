import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const source_text: string = body.source_text || body.text || '';
    const to_language: string = body.to_language || body.target_language || 'en';
    const to_language_name: string = body.to_language_name || body.target_language_name || to_language;
    const from_language: string = body.from_language || body.source_language || 'auto';
    const from_language_name: string = body.from_language_name || body.source_language_name || 'auto';
    const tone: string = body.tone || 'Aggressive / Urgent';
    const context: string = body.context || '';
    const user_id: string | undefined = body.user_id;
    const multi_targets: string[] | undefined = body.multi_targets;

    if (!source_text) {
      return new Response(JSON.stringify({ error: 'Missing source_text' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // Usage check — use maybeSingle to avoid errors on missing rows
    if (user_id) {
      const period = new Date().toISOString().slice(0, 7);
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user_id).maybeSingle();
      const { data: usage } = await supabase.from('usage').select('translations_count').eq('user_id', user_id).eq('period', period).maybeSingle();
      const limits: Record<string, number> = { free: 10, creator: 10, starter: 50, studio: 200, scale: 2000 };
      const plan = profile?.plan || 'free';
      const count = usage?.translations_count || 0;
      if (count >= (limits[plan] ?? 10)) {
        return new Response(JSON.stringify({ error: 'limit_reached', plan }), {
          status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
    }

    // No API key — return friendly mock
    if (!ANTHROPIC_API_KEY) {
      console.log('No ANTHROPIC_API_KEY — returning mock');
      const targets = multi_targets?.length ? multi_targets : [to_language];
      const multi = targets.map(lang => ({
        lang,
        translated_text: `[No API key] ${source_text.slice(0, 100)}`,
        cultural_adaptation: `Add ANTHROPIC_API_KEY in Supabase Secrets to enable real translation.`
      }));
      return new Response(JSON.stringify({
        success: true,
        translated_text: multi[0].translated_text,
        cultural_adaptation: multi[0].cultural_adaptation,
        multi: multi.length > 1 ? multi : undefined,
        mock_mode: true,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Build translation targets
    const targets = multi_targets?.length
      ? multi_targets.map(code => ({ code, name: code }))
      : [{ code: to_language, name: to_language_name }];

    const results: Array<{ lang: string; translated_text: string; cultural_adaptation: string }> = [];

    for (const target of targets) {
      const systemPrompt = `You are an expert advertising translator and cultural strategist specializing in performance marketing ads. Your job is to translate ad scripts, captions, hooks, and VO copy so they feel native — not translated.

CRITICAL RULES:
- Preserve hook strength, urgency, and conversion intent. Never soften a CTA.
- Adapt idioms, slang, and cultural references so they land in the target market.
- Keep emojis if present. Keep ALL CAPS if used for emphasis.
- Respond ONLY with a valid JSON object. No markdown, no preamble.

Response format:
{"translated": "<full translated text ready to use>", "cultural_notes": "<2-3 bullet points of specific adaptations made>"}`;

      const userMsg = `Translate this ad content FROM ${from_language_name} TO ${target.name}:

---
${source_text}
---

${tone ? `Tone: ${tone}` : ''}
${context ? `Context: ${context}` : ''}

Return ONLY valid JSON.`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMsg }]
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('Claude API error:', res.status, errText);
        throw new Error(`Claude API ${res.status}: ${errText}`);
      }

      const apiData = await res.json();
      const raw = (apiData.content?.[0]?.text || '').replace(/```json|```/g, '').trim();

      let parsed: { translated: string; cultural_notes: string };
      try {
        parsed = JSON.parse(raw);
      } catch {
        // If JSON parse fails, treat the whole response as the translation
        console.warn('JSON parse failed, using raw text as translation');
        parsed = { translated: raw, cultural_notes: '' };
      }

      results.push({
        lang: target.code,
        translated_text: parsed.translated || raw,
        cultural_adaptation: parsed.cultural_notes || ''
      });
    }

    // Increment usage count
    if (user_id) {
      const period = new Date().toISOString().slice(0, 7);
      const { data: usage } = await supabase.from('usage').select('translations_count').eq('user_id', user_id).eq('period', period).maybeSingle();
      await supabase.from('usage').upsert(
        { user_id, period, translations_count: (usage?.translations_count || 0) + 1 },
        { onConflict: 'user_id,period' }
      );
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
    console.error('translate-text fatal error:', error);
    return new Response(
      JSON.stringify({ error: String(error), details: 'Check edge function logs in Supabase dashboard' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
