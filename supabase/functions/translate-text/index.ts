import { createClient } from "npm:@supabase/supabase-js@2";
import { getEffectivePlan } from "../_shared/credits.ts";
import { requireCredits } from "../_shared/deductCredits.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── JWT auth — verify caller identity, use verified user_id ──────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    let verified_user_id: string | undefined;
    if (authHeader.startsWith('Bearer ')) {
      const { data: { user: authUser } } = await supabase.auth.getUser(authHeader.slice(7));
      if (authUser) verified_user_id = authUser.id;
    }

    const body = await req.json();
    const source_text: string = body.source_text || body.text || '';
    const to_language: string = body.to_language || body.target_language || 'en';
    const to_language_name: string = body.to_language_name || body.target_language_name || to_language;
    const from_language: string = body.from_language || body.source_language || 'auto';
    const from_language_name: string = body.from_language_name || body.source_language_name || 'auto';
    const tone: string = body.tone || 'Aggressive / Urgent';
    const context: string = body.context || '';
    // Always use verified JWT identity — ignore body user_id to prevent spoofing
    const user_id: string | undefined = verified_user_id;
    const multi_targets: string[] | undefined = body.multi_targets;

    if (!source_text) {
      return new Response(JSON.stringify({ error: 'Missing source_text' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // Check credits for translation
    if (user_id) {
      const creditCheck = await requireCredits(supabase, user_id, "translation");
      if (!creditCheck.allowed) return new Response(JSON.stringify(creditCheck.error), { status: 402, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Build translation targets
    const targets = multi_targets?.length
      ? multi_targets.map(code => ({ code, name: code }))
      : [{ code: to_language, name: to_language_name }];

    const results: Array<{ lang: string; translated_text: string; cultural_adaptation: string }> = [];

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

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

      // Use Claude Haiku 4.5 via Anthropic's native Messages API — matches the
      // rest of the codebase (was previously pointed at Anthropic URL but with
      // OpenAI-style headers and a Gemini model ID, which always 401'd).
      const res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1200,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userMsg },
          ],
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('Anthropic API error:', res.status, errText.slice(0, 400));
        throw new Error(`AI API ${res.status}`);
      }

      const apiData = await res.json();
      const rawContent = apiData.content?.[0]?.text || '';
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
