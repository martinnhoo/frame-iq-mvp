import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, platform, csv_data, filename } = await req.json();
    if (!user_id || !csv_data) {
      return new Response(JSON.stringify({ error: 'Missing user_id or csv_data' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const truncated = csv_data.length > 40000 ? csv_data.slice(0, 40000) + '\n[truncated...]' : csv_data;

    const systemPrompt = `You are a performance marketing data analyst. You receive raw CSV exports from ad platforms (Meta Ads, Google Ads, TikTok Ads) and extract creative intelligence. Return ONLY valid JSON — no markdown, no backticks.`;

    const userPrompt = `Platform: ${platform || 'unknown'}
Filename: ${filename || 'export.csv'}

CSV DATA:
${truncated}

Return JSON:
{
  "platform": "<meta|google|tiktok|unknown>",
  "date_range": "<e.g. Jan 2025>",
  "total_ads": <number>,
  "total_spend": <number or null>,
  "currency": "<USD|BRL|MXN|etc>",
  "summary": "<2-3 sentence plain-language summary>",
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
      "why_winning": "<1 sentence>"
    }
  ],
  "worst_creatives": [
    { "name": "<name>", "spend": <number or null>, "ctr": <number or null>, "cpa": <number or null>, "why_losing": "<1 sentence>" }
  ],
  "insights": ["<insight 1>","<insight 2>","<insight 3>","<insight 4>"],
  "patterns": {
    "best_format": "<string>",
    "best_hook_style": "<string>",
    "audience_signal": "<string>",
    "budget_efficiency": "<string>"
  },
  "recommended_actions": ["<action 1>","<action 2>","<action 3>"]
}`;

    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const aiData = await aiResp.json();
    const rawText = aiData.content?.[0]?.text || '{}';
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

    return new Response(JSON.stringify({ success: true, result: parsed, id: (stored as Record<string,unknown>)?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
