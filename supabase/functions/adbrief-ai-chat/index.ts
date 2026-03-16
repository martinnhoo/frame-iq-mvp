import Anthropic from "npm:@anthropic-ai/sdk@0.39.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, context, user_id, persona_id, history, user_language } = await req.json();

    if (!message || !user_id) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Init Supabase early to fetch real data ────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch real account data in parallel
    const [
      { data: recentAnalyses },
      { data: aiProfile },
      { data: creativeMemory },
      { data: platformConns },
      { data: adsImports },
      { data: personaRow },
    ] = await Promise.all([
      supabase.from("analyses")
        .select("id, created_at, title, result, hook_strength, status, improvement_suggestions")
        .eq("user_id", user_id).eq("status", "completed")
        .order("created_at", { ascending: false }).limit(15),
      supabase.from("user_ai_profile" as any)
        .select("*").eq("user_id" as any, user_id).maybeSingle(),
      supabase.from("creative_memory" as any)
        .select("hook_type, hook_score, platform, notes, created_at" as any)
        .eq("user_id" as any, user_id)
        .order("created_at" as any, { ascending: false }).limit(20),
      supabase.from("platform_connections" as any)
        .select("platform, status, ad_accounts, connected_at")
        .eq("user_id", user_id).eq("status", "active")
        .then(r => r.error?.code === "42P01" ? { data: [], error: null } : r),
      supabase.from("ads_data_imports" as any)
        .select("platform, result, created_at" as any)
        .eq("user_id" as any, user_id)
        .order("created_at" as any, { ascending: false }).limit(3),
      persona_id
        ? supabase.from("personas").select("name, headline, result").eq("id", persona_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // Build enriched context
    const analyses = (recentAnalyses || []) as any[];
    const memory = (creativeMemory || []) as any[];
    const connections = (platformConns || []) as any[];
    const imports = (adsImports || []) as any[];

    const scores = analyses.map((a: any) => (a.result as any)?.hook_score).filter(Boolean) as number[];
    const avgScore = scores.length ? (scores.reduce((a: number, b: number) => a + b) / scores.length).toFixed(1) : null;

    const hookTypes: Record<string, { count: number; total: number }> = {};
    memory.forEach((m: any) => {
      if (!m.hook_type) return;
      if (!hookTypes[m.hook_type]) hookTypes[m.hook_type] = { count: 0, total: 0 };
      hookTypes[m.hook_type].count++;
      hookTypes[m.hook_type].total += m.hook_score || 0;
    });
    const topHooks = Object.entries(hookTypes)
      .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))
      .slice(0, 3)
      .map(([type, d]) => `${type} (avg ${(d.total / d.count).toFixed(1)}, ${d.count} uses)`);

    const recentSummary = analyses.slice(0, 5).map((a: any) => {
      const r = a.result as any;
      const improvements = (r?.improvement_suggestions as string[])?.slice(0, 2).join("; ") || "";
      return [
        `  - "${a.title || r?.market_guess || "untitled"}"`,
        `score:${r?.hook_score ?? "—"}`,
        `hook_type:${r?.hook_type || a.hook_strength || "—"}`,
        `format:${r?.format || "—"}`,
        `market:${r?.market_guess || "—"}`,
        r?.summary ? `summary:"${String(r.summary).slice(0, 80)}"` : "",
        improvements ? `improvements:"${improvements}"` : "",
        `date:${a.created_at?.split("T")[0]}`,
      ].filter(Boolean).join(" | ");
    }).join("\n");

    const connectedPlatforms = connections.map((c: any) => {
      const accounts = (c.ad_accounts as any[]) || [];
      return `${c.platform}(${accounts.length} accounts)`;
    });

    const persona = personaRow as any;
    const personaCtx = persona?.result ? `ACTIVE WORKSPACE: ${persona.name} | ${persona.headline || ""}
Market: ${(persona.result as any)?.preferred_market || "unknown"} | Age: ${(persona.result as any)?.age || "—"}
Platforms: ${((persona.result as any)?.best_platforms || []).join(", ")}
Language style: ${(persona.result as any)?.language_style || "—"}` : "";

    const importInsights = imports.map((i: any) => {
      const r = i.result as any;
      if (!r?.summary) return "";
      return `${i.platform} data: ${r.summary} | best format: ${r.patterns?.best_format || "?"} | best hook style: ${r.patterns?.best_hook_style || "?"}`;
    }).filter(Boolean).join("\n");

    const richContext = [
      personaCtx,
      `CONNECTED PLATFORMS: ${connectedPlatforms.length ? connectedPlatforms.join(", ") : "none"}`,
      `ANALYSES: ${analyses.length} total | avg hook score: ${avgScore ?? "—"}/10 | viral hooks: ${analyses.filter((a: any) => a.hook_strength === "viral").length}`,
      topHooks.length ? `TOP HOOK TYPES: ${topHooks.join(", ")}` : "",
      recentSummary ? `RECENT 5 ANALYSES:\n${recentSummary}` : "",
      importInsights ? `IMPORTED DATA:\n${importInsights}` : "",
      (aiProfile as any)?.summary ? `AI PROFILE: ${(aiProfile as any).summary}` : "",
    ].filter(Boolean).join("\n");


    // Language configuration
    const LANG_NAMES: Record<string, string> = {
      en: "English", pt: "Portuguese (Brazilian)", es: "Spanish", fr: "French",
      de: "German", ar: "Arabic", zh: "Chinese (Mandarin)"
    };
    const MARKET_LANG_MAP: Record<string, string> = {
      BR: "pt", MX: "es", ES: "es", AR: "es", CO: "es", PE: "es",
      IN: "en", EN: "en", US: "en", UK: "en", FR: "fr", DE: "de"
    };

    const uiLang = (user_language as string) || "en";
    const personaMarket = (persona?.result as any)?.preferred_market || 
                          (persona?.result as any)?.market || "";
    const contentLangCode = MARKET_LANG_MAP[personaMarket?.toUpperCase()] || uiLang;
    const uiLangName = LANG_NAMES[uiLang] || "English";
    const contentLangName = LANG_NAMES[contentLangCode] || "English";

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

    const langInstructions = `
LANGUAGE RULES — FOLLOW STRICTLY:
- YOUR RESPONSES (analysis, explanations, advice): Always write in ${uiLangName}
- GENERATED CONTENT (hooks, scripts, VO copy, ad text, briefs): Always write in ${contentLangName} (this is the language the ad will run in)
- If generating a script for a Spanish-speaking market, write the script in Spanish even if explaining it in English
- Never mix languages within the same block
- Market context: ${personaMarket || "unknown"} → content language: ${contentLangName}
`;

    const systemPrompt = `${langInstructions}

You are AdBrief AI — an elite media buyer and creative performance strategist built for the Andromeda era of Meta Ads. You work exclusively with ad performance data, creative briefs, hooks, scripts, audience targeting, and campaign optimization.

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

MEDIA BUYER MASTER KNOWLEDGE — 2026:

## Attribution & Measurement (critical shift)
- NEVER trust platform ROAS alone — Meta/Google self-attribute aggressively (walled gardens)
- MER (Marketing Efficiency Ratio = total revenue ÷ total ad spend) is the real north star metric
- Incrementality testing: holdout experiments show what % of sales happen WITH vs WITHOUT ads
- Geo-testing: turn off ads in one region → measure lift disappearance → prove true incrementality
- MMM (Marketing Mix Modeling) for cross-channel budget allocation decisions
- Server-side tracking / Conversion API recovers 20-40% of lost signal post-iOS
- Creative fatigue sets in as fast as 10-14 days at high spend — monitor CPMr daily
- Last-click attribution undervalues upper-funnel media by 30-70%

## Creative Testing Framework (structured, not random)
- Winning ad = data source, not finished product → extract WHY → test elements independently
- Isolate variables: same hook different visual / same visual different CTA / same structure different market
- 2-4 week iteration sprints — enough data to signal before killing creative
- "Creative iteration" (changing hook) ≠ "Creative variation" (changing concept entirely) — need BOTH
- Budget sandbox: allocate 10-20% of spend to experimental creative/channels at all times
- Test copy length: super short, medium, long, blog-post length — all perform differently
- Psychological angles to rotate: pain, curiosity, social proof, transformation, direct question, FOMO

## Budget & Scaling Rules
- Scale winners by 20% every 3-4 days max — sudden spikes reset learning phase
- Don't touch bids when CPMr spikes — refresh creative instead
- CBO (campaign-level budget) outperforms ABO (ad set-level) in Andromeda era
- Always-on campaigns outperform on/off campaigns by 5-18% in ROAS stability
- Dayparting: service businesses see higher ROAS at specific hours — test it
- "Efficiency zone": find your break-even ROAS, scale only above it
- Budget fragmentation across too many campaigns = slower learning = worse performance

## First-Party Data (survival tactic post-iOS)
- Conversion API (CAPI) is non-negotiable — platform pixel alone is blind
- Customer list uploads for LLA (lookalike) seeding still work when list is clean
- Email/SMS list = owned audience that feeds Meta with high-quality signals
- Post-purchase surveys: "How did you hear about us?" often beats platform attribution data

## Channel Mix & Full Funnel
- Meta: efficiency and scale (awareness → conversion)
- TikTok: discovery engine, especially Gen Z, content-native formats win
- Google: intent capture (people already searching for the solution)
- CTV/YouTube: upper funnel brand trust, growing fast
- Retail media (Amazon, Mercado Livre): high-intent, close to purchase
- Sequence matters: TikTok (discover) → Meta (retarget) → Email (convert) → SMS (retain)
- Consistent messaging across channels = 2-3x revenue vs fragmented campaigns

## Competitive Intelligence
- Monitor competitors' ad libraries weekly (Meta Ad Library, TikTok Creative Center)
- Track their hooks: curiosity spike = probably testing something that's working
- Dark posts (not boosted) = organically testing before spending — watch for them
- Share of voice matters: if competitor doubles spend, your CPMs go up

## What Elite Media Buyers Do Differently
- They think in systems, not campaigns
- They separate "creative strategy" from "media buying" — two distinct disciplines
- They run experiments with clear hypotheses, not random tests
- They report MER + CAC + LTV, not just ROAS
- They refresh creative before it fatigues, not after CTR drops
- They build creative briefs from data, not from meetings
- They treat every ad as a learning signal, not a success/failure binary

CRITICAL INSTRUCTIONS FOR USING ACCOUNT DATA:
- The USER'S ACCOUNT CONTEXT below contains REAL data from their account — ALWAYS reference it specifically
- If you see "ANALYSES: 10 total | avg hook score: 6.7/10" — mention the exact number 10 and 6.7
- If you see "TOP HOOK TYPES: curiosity(avg 7.2, 4 uses)" — reference curiosity hooks specifically
- If you see "RECENT 5 ANALYSES:" with titles — reference those actual ad titles
- NEVER say "I don't have your data" or "No data to analyze" when the context below has real data
- If context shows 0 analyses, THEN guide them to analyze an ad first
- Be specific, not generic — use their actual numbers, titles, patterns

USER'S ACCOUNT CONTEXT:
\${(typeof context === "string" && context.length > 100) ? context : (richContext || "No account data yet.")}

RESPONSE FORMAT — always respond with a valid JSON array of blocks ONLY. No text outside the JSON array.
Each block: { "type": "action"|"pattern"|"hooks"|"warning"|"insight"|"off_topic"|"navigate", "title": "string", "content": "optional string", "items": ["optional","array"], "route": "string (for navigate)", "params": {object (for navigate)}, "cta": "string (button label, for navigate)" }

ADBRIEF PLATFORM — Tools you can send users to (use navigate blocks):

TOOL MAP (route + params you can pre-fill):
1. Hook Generator → route: "/dashboard/hooks"
   params: product, niche, market (BR/MX/IN/US/GLOBAL), platform (TikTok/Meta/YouTube)
   USE WHEN: user needs new hook angles, their hook has weak retention, they ask for hooks

2. Brief Generator → route: "/dashboard/brief"
   params: product, offer, market, audience, context
   USE WHEN: user needs to brief an editor, wants production-ready brief, needs to turn insight into action

3. Script Generator → route: "/dashboard/script"
   params: product, offer, market, platform (tiktok/meta), angle, context
   USE WHEN: user needs a full script, wants to test a new angle with full VO

4. Pre-flight Check → route: "/dashboard/preflight"
   params: (none — user uploads ad)
   USE WHEN: user is about to launch an ad and wants it scored before spending

5. Translate → route: "/dashboard/translate"
   params: (none — user pastes text)
   USE WHEN: user wants to expand a winning creative to another market

6. Persona Builder → route: "/dashboard/persona"
   params: (none)
   USE WHEN: user needs to define their audience for better AI outputs

7. Import Data → route: "/dashboard/loop/import"
   params: (none)
   USE WHEN: user has no data yet, needs to import Meta/TikTok CSV

8. Competitor Decoder → route: "/dashboard/competitor"
   params: (none)
   USE WHEN: user wants to analyze competitor creatives

NAVIGATE BLOCK RULES:
- Include a navigate block WHENEVER the analysis naturally leads to a tool action
- Example: "Your hook drops at 3s but viewers who stay past 10s convert at 8%" → insight block with diagnosis + navigate block to Hook Generator with params pre-filled
- Example: "UGC with curiosity in BR is your #1 pattern" → pattern block + navigate to Brief Generator with market=BR, context=UGC+curiosity angle pre-filled
- The navigate block should feel like a natural next step, not an ad
- Params should use the ACTUAL data from their account (real market, real platform)
- Always explain WHY you're suggesting the tool in the navigate block content

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

    // Build multi-turn conversation from history
    const historyMessages: { role: "user" | "assistant"; content: string }[] = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const h of history) {
        if (h.role === "user" || h.role === "assistant") {
          const content = String(h.content || "").trim();
          if (content) historyMessages.push({ role: h.role, content });
        }
      }
    }
    // Always end with the current user message
    const allMessages = [
      ...historyMessages,
      { role: "user" as const, content: message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: allMessages,
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

    // Save insight
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
