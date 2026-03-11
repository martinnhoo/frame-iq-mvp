import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { answers } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are an expert performance marketing strategist. Create a highly detailed buyer persona for paid advertising.

INPUT:
- Product/offer: ${answers.product}
- Gender: ${answers.gender}
- Age: ${answers.age}
- Income: ${answers.income}
- Market/Country: ${answers.market}
- Main platform: ${answers.platform}
- Core pain: ${answers.pain}

Return ONLY a valid JSON object with these exact keys:
{
  "name": "fictional first name that fits the demographic",
  "age": "specific age",
  "gender": "gender",
  "headline": "one-line persona description (e.g. The Weekend Warrior Bettor)",
  "bio": "2-3 sentence vivid description of their daily life and mindset",
  "pains": ["3-4 specific pain points"],
  "desires": ["3-4 deep desires and aspirations"],
  "objections": ["3 common objections to buying"],
  "triggers": ["3-4 emotional/rational purchase triggers"],
  "media_habits": ["3-4 specific media consumption habits"],
  "best_platforms": ["2-3 best platforms to reach them"],
  "best_formats": ["3-4 best ad formats for this persona"],
  "hook_angles": ["4-5 specific hook angles that work for this persona"],
  "language_style": "description of how they speak and what resonates (slang, formality, etc)",
  "cta_style": "what kind of CTA works best and why",
  "avatar_emoji": "one emoji that represents them"
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const status = aiRes.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded — try again in a moment" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted — please add credits" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${status}`);
    }

    const aiData = await aiRes.json();
    const rawText = aiData.choices?.[0]?.message?.content || "{}";
    const clean = rawText.replace(/```json|```/g, "").trim();
    const persona = JSON.parse(clean);

    return new Response(JSON.stringify({ success: true, persona }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-persona error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
