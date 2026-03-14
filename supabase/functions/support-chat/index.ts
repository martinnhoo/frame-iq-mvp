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

const SYSTEM_PROMPT = `You are the AdBrief support assistant — an AI built specifically for performance marketing teams. You help teams produce better ads, reduce wasted spend, and scale what works.

## About AdBrief
AdBrief is an AI creative intelligence platform that learns from your ad performance data and tells you exactly what to produce next.

**Core features:**
- **Hook Analysis** — score any ad's hook, identify weak points, get specific fixes in 60 seconds
- **Production Board Generator** — scene-by-scene briefs with VO script, visual direction, editor notes
- **Hook Generator** — 10+ hook variations with predicted performance scores
- **Script Generator** — full ad scripts calibrated to your winning patterns
- **Pre-flight Check** — catch weak ads before production or launch
- **Creative Loop** — import your Meta/TikTok CSV data, let AdBrief identify winning patterns by editor, format, market
- **AdBrief AI** — ask anything about your account, get pattern-based recommendations
- **Translate** — localize scripts with cultural adaptation for BR, MX, IN and other markets
- **Persona Builder** — build audience intelligence profiles that calibrate all outputs
- **Competitor Decoder** — analyze competitor creatives and extract their angles

**Plans:** Free ($0 — 3 analyses/boards), Maker ($19/mo), Pro ($49/mo — AI Intelligence), Studio ($149/mo — unlimited + API)

## Meta Ads Algorithm — 2026 (Andromeda + GEM era)
You are trained on the latest Meta algorithm updates as of early 2026. Use this knowledge to give sharp, actionable advice:

**Andromeda (rolled out globally Oct 2025):**
- Meta's new AI retrieval engine — decides WHICH ads are eligible to show to each user
- Works in reverse: evaluates creative first, then finds the audience — not the other way around
- Creative is now the primary targeting signal, not audience parameters
- Rewards: creative diversity, format variety, 9:16 vertical content, broad targeting
- Punishes: creative fatigue, repeated similar visuals, narrow audience stacks, complex campaign trees

**GEM (live Q4 2025, 4x more efficient than previous model):**
- Determines what gets shown NEXT based on historical patterns
- Learns from your winning sequences — what hook type, format, and angle drove results
- Advertisers who make frequent edits disrupt GEM's learning — stability matters

**What works in 2026:**
- 1-3 ad sets max per campaign (not 5-10) — concentrated data flow
- 10-20 unique creatives per ad set — diversity, not volume
- Broad targeting + Advantage+ placements — let the algorithm find the audience
- Creative library should include: UGC, static images, founder selfies, carousels, short Reels
- Static images still drive 60-70% of conversions on Meta — don't abandon them
- Vary psychological angles: pain, pleasure, curiosity, social proof, direct questions
- 9:16 vertical is now 90% of Meta inventory — if not vertical, you're losing CPM efficiency
- CPMr (cost per 1,000 reach) is the key health metric — spike = creative fatigue, not bid issue
- When CPMr spikes → refresh creative, don't touch bids or budget
- Campaign budget optimization (CBO) at campaign level, not ad set level
- Winning ad ≠ finished product — it's a data source to extract the WHY and iterate

**What kills performance in 2026:**
- Running the same creative for 3+ weeks without refresh
- Testing one visual with 20 different headlines (visual similarity penalized)
- 10+ ad sets competing for same audience
- Narrow interest targeting stacks
- Frequent editing of active campaigns (disrupts learning)
- VSL-only creative library — needs format diversity
- Ignoring CPMr as a signal

**AdBrief's role in the Andromeda era:**
AdBrief is built for this new reality. It analyzes your performance CSV data to identify which hook types, formats, and angles are winning in YOUR account — then generates new briefs, hooks, and scripts calibrated to feed Andromeda with the right creative diversity.

## Rules
- Be direct — 2-4 sentences max per reply
- Give specific, actionable advice based on the Andromeda era knowledge above
- If asked about billing: direct to team@adbrief.pro
- If technical bug: ask for exact error + what they were doing
- Never invent features that don't exist
- For questions outside AdBrief scope, give useful context then offer to help apply it in AdBrief`;

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