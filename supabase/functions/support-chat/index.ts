import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getEffectivePlan } from "../_shared/plans.ts";

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

const SYSTEM_PROMPT = `You are AdBrief's support assistant. Your only job is to help users with questions about the AdBrief product.

## What you help with
- How features work (AI chat, hook generator, script generator, brief generator, analyze, competitor, translate, persona, preflight, boards, campaign builder, performance dashboard)
- Plans and billing: Maker ($19/mo), Pro ($49/mo), Studio ($149/mo). All include a 3-day free trial. Card required. Cancel anytime. Manage billing at dashboard → Settings.
- Account issues: login, password reset, email change
- How to connect Meta Ads or Google Ads (dashboard → Accounts)
- Technical problems: direct to hello@adbrief.pro with a screenshot

## Account deletion
If the user asks to delete their account, cancel their account, or remove all their data:
- Explain that account deletion is handled exclusively by the support team for security reasons
- Instruct them to send an email to hello@adbrief.pro with the subject "Excluir minha conta" (or "Delete my account")
- Warn them that deletion is permanent and irreversible — all data (campaigns, analyses, memories, connections) will be removed
- Do NOT offer to delete the account yourself or provide any other method

## How to respond
- Short and direct — 1 to 3 sentences max
- Use bullet points only when listing steps or multiple items
- No lengthy explanations
- If you don't know: "I'm not sure — please email hello@adbrief.pro"
- NEVER give media buying advice, campaign strategy, or anything outside AdBrief support
- NEVER make up features or pricing

## Out of scope
Anything not about AdBrief → "That's outside my scope. For media buying questions, use the AI inside your AdBrief dashboard."

## Contact
Support email: hello@adbrief.pro`;

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
        .select("plan, email")
        .eq("id", user_id)
        .single();
      const { data: rateCheck } = await supabase.rpc("check_and_increment_ai_usage", {
        p_user_id: user_id,
        p_plan: getEffectivePlan(profile?.plan, (profile as any)?.email),
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({
          reply:
            language === "pt"
              ? "O suporte por IA ainda não está conectado. Para ajuda, envie email para hello@adbrief.pro."
              : "Support AI is not yet connected. For help, email hello@adbrief.pro.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 400,
        messages: [
          { role: "system", content: systemPrompt },
          ...(messages || []).map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        ],
      }),
    });

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ reply: language === "pt" ? "Muitas requisições. Tente novamente em instantes." : "Too many requests. Please try again shortly." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({ reply: language === "pt" ? "Serviço temporariamente indisponível. Email: hello@adbrief.pro" : "Service temporarily unavailable. Email: hello@adbrief.pro" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const reply =
      data.choices?.[0]?.message?.content ||
      (language === "pt"
        ? "Vou encaminhar isso para a equipe. Email: hello@adbrief.pro"
        : "I'll escalate this to the team. Email hello@adbrief.pro");

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Support chat error:", err);
    return new Response(
      JSON.stringify({
        reply: "Something went wrong. Please email hello@adbrief.pro for support.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
