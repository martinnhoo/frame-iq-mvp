import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { video_name, platform, market } = await req.json();
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ mock_mode: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Real implementation — calls Claude with video frames
    // TODO: extract frames, run OCR, call Claude for analysis
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Analyze this video ad for platform ${platform} in market ${market}.
Video filename: ${video_name}

Return a JSON object with this exact structure:
{
  "overview": [
    { "label": "Hook", "status": "STRONG|REVIEW|WEAK|CRITICAL", "detail": "one line" },
    { "label": "Promo", "status": "STRONG|REVIEW|WEAK|CRITICAL", "detail": "one line" },
    { "label": "Narrative", "status": "SOLID|REVIEW|WEAK|CRITICAL", "detail": "one line" },
    { "label": "Platform Fit", "status": "OPTIMAL|REVIEW|WEAK|CRITICAL", "detail": "one line" }
  ],
  "safeZone": [
    { "platform": "TikTok", "status": "CLEAR|REVIEW", "detail": "one line" },
    { "platform": "Reels", "status": "CLEAR|REVIEW", "detail": "one line" },
    { "platform": "Facebook Feed", "status": "CLEAR|REVIEW", "detail": "one line" }
  ],
  "onscreen": [],
  "topFixes": ["fix 1", "fix 2", "fix 3"]
}

Return only the JSON, no other text.`
        }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "{}";
    const result = JSON.parse(text.replace(/```json|```/g, "").trim());

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
