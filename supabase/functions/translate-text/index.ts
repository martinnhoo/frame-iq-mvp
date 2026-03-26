import { createClient } from "npm:@supabase/supabase-js@2";
import { getEffectivePlan, getLimit } from "../_shared/plans.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    // Using Lovable AI gateway (no separate API key needed)
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
      const { data: profile } = await supabase.from('profiles').select('plan, email').eq('id', user_id).maybeSingle();
      const email = (profile as any)?.email || null;
      const plan = getEffectivePlan(profile?.plan, email);

      // Daily AI rate limit
      const { data: rateCheck } = await supabase.rpc('check_and_increment_ai_usage', { p_user_id: user_id, p_plan: plan });
      if (rateCheck && !rateCheck.allowed) {
        return new Response(JSON.stringify({ error: rateCheck.message, daily_limit: true }), {
          status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      // Monthly translation limit
      const { data: usage } = await supabase.from('usage').select('translations_count').eq('user_id', user_id).eq('period', period).maybeSingle();
      const limit = getLimit('translations', plan);
      const count = usage?.translations_count || 0;
      if (limit !== -1 && count >= limit) {
        return new Response(JSON.stringify({ error: 'limit_reached', plan }), {
          status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
    }

    // Build translation targets
    const targets = multi_targets?.length
      ? multi_targets.map(code => ({ code, name: code }))
      : [{ code: to_language, name: to_language_name }];

    const results: Array<{ lang: string; translated_text: string; cultural_adaptation: string }> = [];

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const LOVABLE_API_URL = 'https://api.lovable.dev/v1/chat/completions';

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

      const res = await fetch(LOVABLE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ],
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('Lovable AI error:', res.status, errText);
        throw new Error(`AI API ${res.status}: ${errText}`);
      }

      const apiData = await res.json();
      const rawContent = apiData.choices?.[0]?.message?.content || '';
      const raw = rawContent.replace(/```json|```/g, '').trim();

      let parsed: { translated: string; cultural_notes: string };
      try {
        // Find JSON boundaries for robust parsing
        const jsonStart = raw.search(/[\{\[]/);
        const jsonEnd = raw.lastIndexOf('}');
        const jsonStr = (jsonStart !== -1 && jsonEnd !== -1) ? raw.substring(jsonStart, jsonEnd + 1) : raw;
        parsed = JSON.parse(jsonStr);
      } catch {
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
// redeploy 202603211609

// force 202603222000
// force-redeploy-with-anthropic-key 20260325
