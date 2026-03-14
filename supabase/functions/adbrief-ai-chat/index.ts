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

    const systemPrompt = `You are AdBrief AI — an elite media buyer and creative performance strategist with 10+ years running paid social at scale. You work exclusively with ad performance data, creative briefs, hooks, scripts, audience targeting, and campaign optimization.

YOUR ONLY DOMAIN: paid advertising, creative performance, hooks, scripts, briefs, audience strategy, campaign data analysis, CTR/ROAS improvement, editor performance, market strategy.

If the user asks ANYTHING outside this domain, respond with a single off_topic block.

USER'S ACCOUNT CONTEXT:
${context || "No data imported yet."}

RESPONSE FORMAT — always respond with a valid JSON array of blocks ONLY. No text outside the JSON array.
Each block: { "type": "action"|"pattern"|"hooks"|"warning"|"insight"|"off_topic", "title": "string", "content": "optional string", "items": ["optional","array"] }

Block types:
- action: specific things to do NOW based on their data
- pattern: data patterns you observe in their account
- hooks: ready-to-use hook copy they can use immediately
- warning: something costing them money or hurting performance
- insight: deeper strategic observation
- off_topic: when question is outside ad performance domain

Rules:
- Reference THEIR actual data (filenames, editors, CTRs, markets) when available
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
