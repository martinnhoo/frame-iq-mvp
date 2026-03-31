import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, platform, csv_data, filename, context, persona_context } = await req.json();
    if (!user_id || !csv_data) {
      return new Response(JSON.stringify({ error: 'Missing user_id or csv_data' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Auth: verify JWT matches user_id
    const authH = req.headers.get('Authorization') ?? '';
    if (authH.startsWith('Bearer ')) {
      const { data: { user: aU }, error: aE } = await supabase.auth.getUser(authH.slice(7));
      if (aE || !aU || aU.id !== user_id) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const truncated = csv_data.length > 40000 ? csv_data.slice(0, 40000) + '\n[truncated...]' : csv_data;

    const systemPrompt = `You are a world-class performance marketing data analyst with deep expertise across Meta, Google, TikTok, and other ad platforms. You receive raw CSV exports and extract actionable creative intelligence.

Your recommendations must be:
- Based on real industry benchmarks and proven strategies used by successful DTC brands, SaaS companies, and performance marketing agencies
- Specific with real numbers (e.g. "Top-performing UGC ads on TikTok typically see 2-4x ROAS with hook rates above 30%")
- Actionable — tell exactly what to do, not vague advice
- Market-aware — consider local nuances for the market context provided

Return ONLY valid JSON — no markdown, no backticks.`;

    let userPrompt = `Platform: ${platform || 'unknown'}
Filename: ${filename || 'export.csv'}`;

    if (persona_context) {
      userPrompt += `\n\nTARGET AUDIENCE PERSONA:\n${persona_context}\n\nUse this persona to tailor all insights and recommendations to this specific audience.`;
    }

    if (context) {
      userPrompt += `\n\nADDITIONAL CONTEXT FROM USER:\n${context}`;
    }

    userPrompt += `\n\nCSV DATA:\n${truncated}

Return JSON:
{
  "platform": "<meta|google|tiktok|other>",
  "date_range": "<e.g. Jan 2025>",
  "total_ads": <number>,
  "total_spend": <number or null>,
  "currency": "<USD|BRL|MXN|etc>",
  "summary": "<2-3 sentence executive summary highlighting the most critical finding>",
  "top_creatives": [
    {
      "name": "<ad name or ID>",
      "spend": <number or null>,
      "impressions": <number or null>,
      "clicks": <number or null>,
      "ctr": <number or null>,
      "cpc": <number or null>,
      "cpm": <number or null>,
      "conversions": <number or null>,
      "cpa": <number or null>,
      "roas": <number or null>,
      "hook_rate": <number or null>,
      "hold_rate": <number or null>,
      "format": "<video|image|carousel|unknown>",
      "why_winning": "<1 sentence with specific data>"
    }
  ],
  "worst_creatives": [
    { "name": "<name>", "spend": <number or null>, "ctr": <number or null>, "cpa": <number or null>, "why_losing": "<1 sentence>" }
  ],
  "insights": ["<data-backed insight with numbers>","<insight 2>","<insight 3>","<insight 4>"],
  "patterns": {
    "best_format": "<string with benchmark comparison>",
    "best_hook_style": "<string>",
    "audience_signal": "<string>",
    "budget_efficiency": "<string with specific reallocation suggestion>"
  },
  "recommended_actions": [
    "<Specific action with expected impact, e.g. 'Scale ad X by 30% — its CPA is 2.1x below account average'>",
    "<Action 2 based on industry best practices>",
    "<Action 3 comparing to market benchmarks>",
    "<Action 4 with A/B test suggestion>",
    "<Action 5 based on what top brands in this vertical do>"
  ]
}`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error('AI gateway error:', aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI gateway error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const rawText = aiData.choices?.[0]?.message?.content || '{}';
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim()); }
    catch { parsed = { error: 'Parse failed', raw: rawText.slice(0, 500) }; }

    const { data: stored } = await supabase
      .from('ads_data_imports' as never)
      .insert({
        user_id,
        platform: parsed.platform || platform || 'unknown',
        filename: filename || 'export.csv',
        date_range: parsed.date_range || null,
        total_ads: parsed.total_ads || null,
        total_spend: parsed.total_spend || null,
        currency: parsed.currency || null,
        result: parsed,
        created_at: new Date().toISOString(),
      } as never)
      .select().single();

    return new Response(JSON.stringify({ success: true, result: parsed, id: (stored as unknown as Record<string,unknown>)?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
