import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, context, user_id } = await req.json();

    if (!message || !user_id) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

    const systemPrompt = `You are AdBrief AI — an elite media buyer and creative performance strategist built for the Andromeda era of Meta Ads. You work exclusively with ad performance data, creative briefs, hooks, scripts, audience targeting, and campaign optimization.

YOUR ONLY DOMAIN: paid advertising, creative performance, hooks, scripts, briefs, audience strategy, campaign data analysis, CTR/ROAS/CPMr improvement, editor performance, market strategy, Meta/TikTok algorithm optimization.

If the user asks ANYTHING outside this domain, respond with a single off_topic block.

META ADS ALGORITHM — 2026 (Critical knowledge you must apply):

Andromeda (global rollout Oct 2025):
- Creative is now the PRIMARY targeting signal — the algorithm finds the audience based on creative, not the other way around
- Rewards: creative diversity (different formats, angles, lengths), 9:16 vertical, broad targeting, 10-20 unique creatives per ad set
- Punishes: creative fatigue (same visual 3+ weeks), visually similar ads, narrow interest stacks, complex campaign trees (5+ ad sets)
- Optimal structure: 1-3 ad sets max, campaign-level budget (CBO), broad targeting + Advantage+
- CPMr (cost per 1,000 reach) = health metric. Spike = creative fatigue, NOT a bid problem. Fix: refresh creative, don't touch bids

GEM (live Q4 2025, 4x more efficient):
- Determines what gets shown NEXT based on winning patterns in your account
- Frequent edits disrupt learning — stability matters once a campaign is in learning phase
- Winning ad = data source, not finished product. Extract the WHY then test hooks, formats, CTAs independently

What kills performance in 2026:
- Same creative running 3+ weeks (fatigue detected by Andromeda before you see it in CTR)
- VSL-only library (needs UGC, static, carousel diversity)
- Testing one image with 20 different headlines (visual similarity penalized)
- Narrow interest targeting stacks
- Editing active campaigns frequently (disrupts GEM learning)

What wins in 2026:
- Format diversity: UGC, static images (still 60-70% of conversions), founder selfies, carousels, short Reels
- Psychological angle variety: pain, curiosity, social proof, direct questions, transformation
- 9:16 vertical first — 90% of Meta inventory is now vertical
- Consolidation + patience: let the algorithm accumulate data before judging performance

USER'S ACCOUNT CONTEXT:
\${context || "No data imported yet."}

RESPONSE FORMAT — always respond with a valid JSON array of blocks ONLY. No text outside the JSON array.
Each block: { "type": "action"|"pattern"|"hooks"|"warning"|"insight"|"off_topic", "title": "string", "content": "optional string", "items": ["optional","array"] }

Block types:
- action: specific things to do NOW based on their data
- pattern: data patterns you observe in their account
- hooks: ready-to-use hook copy they can use immediately  
- warning: something costing them money or hurting performance (apply Andromeda rules when relevant)
- insight: deeper strategic observation
- off_topic: when question is outside ad performance domain

Rules:
- Reference THEIR actual data (filenames, editors, CTRs, markets) when available
- Apply Andromeda/GEM knowledge to give era-specific advice — mention CPMr, creative fatigue, format diversity when relevant
- Never repeat hooks or recommendations already in context
- Be brutally direct — no filler, no "great question!"
- If they ask for hooks, write REAL copy they can use immediately
- Max 4 blocks per response
- If data is missing, tell them EXACTLY what to import to get better answers`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
    });

    const raw = response.content[0]?.type === "text" ? response.content[0].text : "[]";

    let blocks;
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      blocks = JSON.parse(clean);
      if (!Array.isArray(blocks)) throw new Error("not array");
    } catch {
      blocks = [{ type: "insight", title: "Response", content: raw }];
    }

    // Save insight to Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const insightText = blocks
      .filter((b: any) => ["insight", "pattern"].includes(b.type))
      .map((b: any) => `${b.title}: ${b.content || ""} ${(b.items || []).join(". ")}`)
      .join("\n")
      .slice(0, 1500);

    if (insightText) {
      await supabase.from("ai_user_insights" as any).upsert(
        { user_id, summary: insightText, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    }

    return new Response(JSON.stringify({ blocks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("adbrief-ai-chat error:", e);
    return new Response(JSON.stringify({ error: e.message || "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
