import Anthropic from "npm:@anthropic-ai/sdk@0.52.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { product, offer, objective, market, audience, competitors, extra_context } = await req.json();

    if (!product) return new Response(JSON.stringify({ error: "Missing product" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "" });

    const systemPrompt = `You are a senior creative strategist at a performance marketing agency. You write campaign briefs that editors and creative teams can execute immediately — specific, actionable, no filler.

A good brief:
- Tells the editor exactly who they're talking to and why that person should care
- Defines the ONE core message — not five
- Gives format recommendations with rationale based on the objective and audience
- Includes visual direction that's concrete (not "dynamic and engaging")
- Lists what NOT to do — this is as important as what to do
- Respects compliance rules for the market and industry

You never write generic briefs. Every line should feel specific to this product and this audience.`;

    const userPrompt = `Create a complete campaign creative brief for:

Product: ${product}
${offer ? `Offer/Promotion: ${offer}` : ""}
Objective: ${objective}
Market: ${market}
${audience ? `Audience notes: ${audience}` : ""}
${competitors ? `Competitors/References: ${competitors}` : ""}
${extra_context ? `Extra context: ${extra_context}` : ""}

Return ONLY a JSON object — no markdown, no explanation:
{
  "campaign_name": "short descriptive name",
  "objective": "specific campaign objective in 2-3 sentences",
  "target_audience": {
    "demographics": "age, gender, location, income level",
    "psychographics": "lifestyle, interests, behavior, values",
    "pain_points": ["pain 1", "pain 2", "pain 3"],
    "triggers": ["trigger 1", "trigger 2", "trigger 3"]
  },
  "core_message": "the single most important thing to communicate",
  "value_proposition": "why this product, why now, why for them",
  "tone_and_voice": "specific tone description with examples",
  "formats": [
    {"format": "format name", "rationale": "why this format", "duration": "15s/30s/60s"}
  ],
  "key_messages": ["message 1", "message 2", "message 3"],
  "cta": "exact CTA text",
  "compliance_notes": "compliance rules or empty string",
  "visual_direction": "specific visual style — concrete not vague",
  "reference_style": "describe reference creative style",
  "kpis": ["KPI 1", "KPI 2", "KPI 3"],
  "do_not": ["avoid 1", "avoid 2", "avoid 3", "avoid 4"]
}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
    let brief;
    try {
      brief = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ brief }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("generate-brief error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
