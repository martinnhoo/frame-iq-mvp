import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the AdBrief support assistant. You help performance marketing teams use AdBrief effectively.

About AdBrief:
- AI platform that analyzes competitor videos, generates production boards, translates scripts, and creates videos with AI voiceover
- Plans: Free ($0, 3 analyses/boards), Creator ($9/mo, 1 board + 10 scripts), Studio ($49/mo, 30 analyses/boards + videos), Scale ($499/mo, 500 analyses + API)
- Key features: Video Analysis, Board Generator, Translate, Pre-flight Check, Competitor Tracker, Templates, Brand Kit

Rules:
- Answer in the same language the user writes in
- Be direct and concise — 1-3 sentences max per reply
- If you don't know something, say: "I'll escalate this to the team. Email team@adbrief.pro"
- Never make up features that don't exist
- For billing issues, always direct to team@adbrief.pro
- For technical bugs, ask them to describe the exact error and what they were doing`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, user_id, user_context } = await req.json();
    
    // Build personalized system prompt with user context
    const personalizedSystem = user_context
      ? `${SYSTEM_PROMPT}

CURRENT USER CONTEXT:
- Creative style: ${user_context.creative_style || 'not yet determined'}
- Top models they use: ${(user_context.top_performing_models || []).join(', ') || 'none yet'}
- Best platforms: ${(user_context.best_platforms || []).join(', ') || 'none yet'}
- Avg hook score: ${user_context.avg_hook_score || 'unknown'}/10
Use this to give more personalized, relevant answers.`
      : SYSTEM_PROMPT;
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    // Mock mode if no API key
    if (!apiKey) {
      return new Response(JSON.stringify({
        reply: "Support AI is not yet connected. For help, email team@adbrief.pro and we'll get back to you shortly."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: personalizedSystem ?? SYSTEM_PROMPT,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    const data = await response.json();
    const reply = data.content?.[0]?.text || "I'll escalate this to the team. Email team@adbrief.pro";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      reply: "Something went wrong. Please email team@adbrief.pro for support."
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
