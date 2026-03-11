import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: "Always reply in English.",
  pt: "Sempre responda em português brasileiro.",
  es: "Siempre responde en español.",
  fr: "Réponds toujours en français.",
  de: "Antworte immer auf Deutsch.",
  ar: "أجب دائمًا باللغة العربية.",
  zh: "始终用中文回复。",
};

const SYSTEM_PROMPT = `You are the AdBrief support assistant. You help performance marketing teams use AdBrief effectively.

About AdBrief:
- AI platform that analyzes competitor videos, generates production boards, translates scripts, and creates videos with AI voiceover
- Plans: Free ($0, 3 analyses/boards), Creator ($9/mo, 1 board + 10 scripts), Studio ($49/mo, 30 analyses/boards + videos), Scale ($499/mo, 500 analyses + API)
- Key features: Video Analysis, Board Generator, Translate, Pre-flight Check, Competitor Tracker, Templates, Brand Kit

Rules:
- Be direct and concise — 1-3 sentences max per reply
- If you don't know something, say you'll escalate to the team at team@adbrief.pro
- Never make up features that don't exist
- For billing issues, always direct to team@adbrief.pro
- For technical bugs, ask them to describe the exact error and what they were doing`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, language, user_id, user_context } = await req.json();

    // Rate limit check
    if (user_id) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user_id)
        .single();
      const { data: rateCheck } = await supabase.rpc("check_and_increment_ai_usage", {
        p_user_id: user_id,
        p_plan: profile?.plan || "free",
      });
      if (rateCheck && !rateCheck.allowed) {
        return new Response(
          JSON.stringify({
            reply:
              language === "pt"
                ? "Você atingiu o limite diário de requisições. Tente novamente amanhã ou faça upgrade do plano."
                : "You've reached your daily request limit. Please try again tomorrow or upgrade your plan.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Build system prompt with language instruction
    const langInstruction = LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.en;
    let systemPrompt = `${SYSTEM_PROMPT}\n\nIMPORTANT: ${langInstruction}`;

    if (user_context) {
      systemPrompt += `\n\nCURRENT USER CONTEXT:
- Creative style: ${user_context.creative_style || "not yet determined"}
- Top models: ${(user_context.top_performing_models || []).join(", ") || "none yet"}
- Best platforms: ${(user_context.best_platforms || []).join(", ") || "none yet"}
- Avg hook score: ${user_context.avg_hook_score || "unknown"}/10
Use this to give more personalized answers.`;
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          reply:
            language === "pt"
              ? "O suporte por IA ainda não está conectado. Para ajuda, envie email para team@adbrief.pro."
              : "Support AI is not yet connected. For help, email team@adbrief.pro.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
        max_tokens: 400,
        system: systemPrompt,
        messages: (messages || []).map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    const data = await response.json();
    const reply =
      data.content?.[0]?.text ||
      (language === "pt"
        ? "Vou encaminhar isso para a equipe. Email: team@adbrief.pro"
        : "I'll escalate this to the team. Email team@adbrief.pro");

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Support chat error:", err);
    return new Response(
      JSON.stringify({
        reply: "Something went wrong. Please email team@adbrief.pro for support.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});