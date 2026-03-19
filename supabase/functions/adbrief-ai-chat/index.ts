// adbrief-ai-chat v6 — Anthropic claude-sonnet-4-5-20250514
import Anthropic from "npm:@anthropic-ai/sdk@0.39.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, context, user_id, persona_id, history, user_language, user_prefs } = await req.json();

    if (!message || !user_id) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 1. Init Supabase FIRST ────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── 2. Plan check + daily cap ─────────────────────────────────────────────
    const { data: profileRow } = await supabase
      .from("profiles").select("plan").eq("id", user_id).maybeSingle();
    const plan = profileRow?.plan || "free";
    const planKey = (["free","maker","pro","studio"].includes(plan)
      ? plan
      : ({ creator:"maker", starter:"pro", scale:"studio" } as any)[plan]) || "free";

    const today = new Date().toISOString().slice(0, 10);
    const { data: usageRow } = await (supabase as any)
      .from("free_usage").select("chat_count, last_reset").eq("user_id", user_id).maybeSingle();
    const lastReset = usageRow?.last_reset?.slice(0, 10);
    const dailyCount = lastReset === today ? (usageRow?.chat_count || 0) : 0;

    const DAILY_CAPS: Record<string, number> = { free: 3, maker: 50, pro: 200, studio: 500 };
    const cap = DAILY_CAPS[planKey] ?? 3;

    if (dailyCount >= cap) {
      const uiLang = user_language || "en";
      const msgs: Record<string, { title: string; content: string }> = {
        en: { title: "Daily limit reached", content: `You've used all ${cap} messages for today. Resets tomorrow.` },
        pt: { title: "Limite diário atingido", content: `Você usou todas as ${cap} mensagens de hoje. Renova amanhã.` },
        es: { title: "Límite diario alcanzado", content: `Usaste los ${cap} mensajes de hoy. Se reinicia mañana.` },
        fr: { title: "Limite atteinte", content: `Vous avez utilisé vos ${cap} messages du jour.` },
        de: { title: "Tageslimit erreicht", content: `Sie haben Ihre ${cap} Nachrichten aufgebraucht.` },
      };
      const m = msgs[uiLang] || msgs.en;
      return new Response(JSON.stringify({ error: "daily_limit", blocks: [{ type: "warning", title: m.title, content: m.content }] }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Studio freeze time
    if (planKey === "studio" && dailyCount > 100) {
      const delay = Math.min(Math.floor((dailyCount / cap) * 8000), 8000);
      await new Promise(r => setTimeout(r, delay));
    }

    // Update counter
    await (supabase as any).from("free_usage").upsert(
      { user_id, chat_count: dailyCount + 1, last_reset: today },
      { onConflict: "user_id" }
    );

    // ── 3. Fetch account data in parallel ─────────────────────────────────────
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
        .then((r: any) => r.error?.code === "42P01" ? { data: [], error: null } : r),
      supabase.from("ads_data_imports" as any)
        .select("platform, result, created_at" as any)
        .eq("user_id" as any, user_id)
        .order("created_at" as any, { ascending: false }).limit(3),
      persona_id
        ? supabase.from("personas").select("name, headline, result").eq("id", persona_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // ── 4. Build context ──────────────────────────────────────────────────────
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
      return [
        `  - "${a.title || r?.market_guess || "untitled"}"`,
        `score:${r?.hook_score ?? "—"}`,
        `hook_type:${r?.hook_type || a.hook_strength || "—"}`,
        `format:${r?.format || "—"}`,
        `market:${r?.market_guess || "—"}`,
        r?.summary ? `summary:"${String(r.summary).slice(0, 80)}"` : "",
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
      return `${i.platform}: ${r.summary} | best format: ${r.patterns?.best_format || "?"} | best hook: ${r.patterns?.best_hook_style || "?"}`;
    }).filter(Boolean).join("\n");

    const richContext = [
      personaCtx,
      `CONNECTED PLATFORMS: ${connectedPlatforms.length ? connectedPlatforms.join(", ") : "none"}`,
      `ANALYSES: ${analyses.length} total | avg hook score: ${avgScore ?? "—"}/10`,
      topHooks.length ? `TOP HOOK TYPES: ${topHooks.join(", ")}` : "",
      recentSummary ? `RECENT 5 ANALYSES:\n${recentSummary}` : "",
      importInsights ? `IMPORTED DATA:\n${importInsights}` : "",
      (aiProfile as any)?.summary ? `AI PROFILE: ${(aiProfile as any).summary}` : "",
      (aiProfile as any)?.pain_point ? `USER PAIN POINT: ${(aiProfile as any).pain_point}` : "",
    ].filter(Boolean).join("\n");

    // ── 5. Language ───────────────────────────────────────────────────────────
    const LANG_NAMES: Record<string, string> = {
      en: "English", pt: "Portuguese (Brazilian)", es: "Spanish", fr: "French", de: "German",
    };
    const MARKET_LANG_MAP: Record<string, string> = {
      BR: "pt", MX: "es", ES: "es", AR: "es", CO: "es",
      IN: "en", US: "en", UK: "en", FR: "fr", DE: "de",
    };
    const uiLang = (user_language as string) || "en";
    const personaMarket = (persona?.result as any)?.preferred_market || "";
    const contentLangCode = MARKET_LANG_MAP[personaMarket?.toUpperCase()] || uiLang;
    const uiLangName = LANG_NAMES[uiLang] || "English";
    const contentLangName = LANG_NAMES[contentLangCode] || "English";

    // ── 6. Anthropic API call ─────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

    const systemPrompt = `LANGUAGE RULES:
- ALL responses: ${uiLangName} only
- Generated copy (hooks, scripts, headlines): ${contentLangName} only
- Market: ${personaMarket || "unknown"} → copy language: ${contentLangName}
- PT-BR: "gestor de tráfego" not "media buyer", "criativos" not "creatives", "verba" not "budget"

You are AdBrief AI — a senior performance marketing strategist embedded inside the user's ad account.
You are NOT a generic AI. You have their real campaign data. USE IT in every response.

YOUR CORE PURPOSE:
- Answer questions about their actual account using real numbers from their data
- Generate copy from their winning patterns, not generic templates
- Diagnose problems with specific hypotheses based on their metrics
- Build strategy from what already works for them

HOW TO RESPOND:
1. Reference SPECIFIC data first — ad names, scores, hook types, CPM trends from their account
2. Be DIRECT — give the answer immediately, no preamble
3. Write REAL COPY when asked — actual hooks for their product/market/audience
4. If data is thin or missing, say so in one line then give the best answer anyway

META ADS 2026 (Andromeda + Advantage+ era):
- Creative IS the targeting. The ad finds the audience, not the other way.
- CPM rising + CTR falling = creative fatigue. New creative fixes it, not new targeting.
- Frequency >3 in 7 days = audience exhaustion. New hook, same offer.
- Structure: CBO + broad + Advantage+ Audience. Max 3 ad sets. Kill complexity.
- Learning phase = 50 optimisation events/ad set/week. Do not edit until complete.
- GEM edits reset learning. Add new ads instead of editing existing ones.
- Format priority: Reels 9:16 > Feed 1:1 > Carousel. UGC > polished in almost every niche.
- Hook = first 3 seconds. Pattern interrupt before message. Hook rate <20% = broken hook.
- Proven hook structures: Problem agitation | Social proof numbers | Curiosity gap | Direct offer shock

DIAGNOSIS FRAMEWORK (use when asked "why did X drop" or "what's wrong"):
1. Hook rate <15%? → Hook is the problem, not the offer
2. CPM up >30%? → Audience fatigue or overlap, check frequency
3. CTR flat, ROAS dropping? → Landing page or offer issue
4. Frequency >3/week? → Same people, same ad = exhaustion
5. ROAS dropping with stable volume? → Creative exhaustion, audit top spenders

CONNECTED PLATFORMS:
- If data shows connected platforms → user HAS real data. Reference it.
- NEVER suggest CSV import if platforms are connected
- If no data yet: guide to /dashboard/persona to connect

USER'S REAL ACCOUNT DATA:
${(typeof context === "string" && context.length > 100) ? context : (richContext || "No account data connected yet. Tell user to connect Meta Ads via the persona page to unlock real insights.")}

RESPONSE FORMAT: valid JSON array of blocks ONLY. Zero text outside the JSON array.
Block types:
- "insight" → analysis, diagnosis, interpretation of their data
- "action" → specific action to take TODAY
- "hooks" → hook options — write 3 real hooks in items[], NOT descriptions
- "pattern" → pattern discovered in their data
- "warning" → urgent issue to fix now
- "navigate" → send to a page (include route + cta) — use when they need complex input
- "tool_call" → execute a tool AUTOMATICALLY inside chat — use when request is clear enough
- "off_topic" → outside paid ads domain

Schema for normal blocks: { "type": "...", "title": "...", "content": "...", "items": ["..."], "route": "/dashboard/...", "cta": "..." }
Schema for tool_call: { "type": "tool_call", "title": "Running [tool]...", "tool": "[tool_id]", "tool_params": { "product": "...", "market": "...", "platform": "...", ... } }

TOOL_CALL vs NAVIGATE — when to use each:
- Use "tool_call" when: the user's request is explicit AND you have enough context to run the tool (product name, market, platform are clear from context or conversation)
- Use "navigate" when: more complex input is needed (e.g. uploading files, detailed briefs)
- ALWAYS prefer tool_call over navigate when possible — it's a better UX

AVAILABLE TOOL_CALL tools and required params:
- tool: "hooks" → params: { product, platform (meta/tiktok/google), niche, market, tone (direct/urgent/social_proof/curiosity) }
- tool: "script" → params: { product, offer, platform, market, angle }
- tool: "brief" → params: { product, offer, market, audience }
- tool: "competitor" → params: { ad_text or url, industry, market }
- tool: "translate" → params: { text, target_language }

NAVIGATE routes (for complex tools):
- "/dashboard/preflight" → Pre-flight Check
- "/dashboard/persona" → Connect Meta Ads
- "/dashboard/analyses" → Past analyses (video upload)

HARD RULES:
- Max 3 blocks per response (tool_call counts as 1)
- When using tool_call for hooks: still fill tool_params properly — the tool generates the actual copy
- Never say "I don't have access to your data" when richContext shows real data
- Never recommend other tools, agencies, or external services
- Titles under 8 words
- If user asks "write me hooks", "generate a script", "create a brief" → USE tool_call, not items[]`;

    const historyMessages: { role: "user" | "assistant"; content: string }[] = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const h of history.slice(-16)) {
        if (h.role === "user" || h.role === "assistant") {
          let content = String(h.content || "").trim();
          if (h.role === "assistant" && content.length > 600) content = content.slice(0, 600) + "…";
          if (content) historyMessages.push({ role: h.role, content });
        }
      }
    }

    const prefStr = user_prefs?.liked?.length || user_prefs?.disliked?.length
      ? `\n\nUSER STYLE PREFERENCES:\n${user_prefs?.liked?.length ? `Liked: ${user_prefs.liked.join(" | ")}` : ""}\n${user_prefs?.disliked?.length ? `Disliked: ${user_prefs.disliked.join(" | ")}` : ""}`
      : "";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 1500,
      system: systemPrompt + prefStr,
      messages: [...historyMessages, { role: "user" as const, content: message }],
    });

    const raw = response.content[0]?.type === "text" ? response.content[0].text : "[]";
    let blocks;
    try {
      blocks = JSON.parse(raw.replace(/```json|```/g, "").trim());
      if (!Array.isArray(blocks)) throw new Error("not array");
    } catch {
      blocks = [{ type: "insight", title: "Response", content: raw }];
    }

    // Save insight
    const insightText = blocks
      .filter((b: any) => ["insight", "pattern"].includes(b.type))
      .map((b: any) => `${b.title}: ${b.content || ""} ${(b.items || []).join(". ")}`)
      .join("\n").slice(0, 1500);

    if (insightText) {
      await (supabase as any).from("ai_user_insights").upsert(
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
