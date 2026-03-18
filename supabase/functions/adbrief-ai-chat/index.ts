// adbrief-ai-chat — clean rewrite — v4
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

    // ── 1. Init Supabase FIRST — must be before any DB calls ─────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── 2. Plan + daily cap ───────────────────────────────────────────────────
    const { data: profileRow } = await supabase
      .from("profiles").select("plan").eq("id", user_id).maybeSingle();
    const plan = profileRow?.plan || "free";
    const planKey = (["free","maker","pro","studio"].includes(plan) ? plan : ({ creator:"maker", starter:"pro", scale:"studio" } as any)[plan]) || "free";

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
      };
      const m = msgs[uiLang] || msgs.en;
      return new Response(JSON.stringify({ error: "daily_limit", blocks: [{ type: "warning", title: m.title, content: m.content }] }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Freeze time Studio
    if (planKey === "studio" && dailyCount > 100) {
      const delay = Math.min(Math.floor((dailyCount / cap) * 8000), 8000);
      await new Promise(r => setTimeout(r, delay));
    }

    // Update counter
    await (supabase as any).from("free_usage").upsert(
      { user_id, chat_count: dailyCount + 1, last_reset: today },
      { onConflict: "user_id" }
    );

    // ── 3. Fetch account data in parallel ────────────────────────────────────
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

    // ── 4. Build rich context ─────────────────────────────────────────────────
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
      (aiProfile as any)?.pain_point ? `USER'S #1 PAIN POINT: ${(aiProfile as any).pain_point}` : "",
    ].filter(Boolean).join("\n");

    // ── 5. Language setup ─────────────────────────────────────────────────────
    const LANG_NAMES: Record<string, string> = {
      en: "English", pt: "Portuguese (Brazilian)", es: "Spanish", fr: "French", de: "German",
    };
    const MARKET_LANG_MAP: Record<string, string> = {
      BR: "pt", MX: "es", ES: "es", AR: "es", CO: "es", PE: "es",
      IN: "en", EN: "en", US: "en", UK: "en", FR: "fr", DE: "de",
    };
    const uiLang = (user_language as string) || "en";
    const personaMarket = (persona?.result as any)?.preferred_market || (persona?.result as any)?.market || "";
    const contentLangCode = MARKET_LANG_MAP[personaMarket?.toUpperCase()] || uiLang;
    const uiLangName = LANG_NAMES[uiLang] || "English";
    const contentLangName = LANG_NAMES[contentLangCode] || "English";

    // ── 6. Call Anthropic ─────────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

    const langInstructions = `LANGUAGE RULES:
- Responses: always in ${uiLangName}
- Generated content (hooks, scripts, copy): always in ${contentLangName}
- Market: ${personaMarket || "unknown"} → content language: ${contentLangName}
- In Brazilian Portuguese: use "gestor de tráfego" not "media buyer"`;

    const systemPrompt = `${langInstructions}

You are AdBrief AI — an elite performance marketing strategist. You work exclusively with ad performance data, creative briefs, hooks, scripts, audience targeting, and campaign optimization.

YOUR ONLY DOMAIN: paid advertising, creative performance, hooks, scripts, briefs, audience strategy, campaign data analysis, CTR/ROAS/CPM improvement, Meta/TikTok/Google algorithm optimization.

META ADS 2026 — Andromeda + GEM:
- Creative IS the targeting signal — algorithm finds audience based on creative
- CPMr spike = creative fatigue, not a bid problem — refresh creative
- 1-3 ad sets max, CBO, broad targeting + Advantage+
- Format diversity: UGC, static, carousel, Reels — variety required
- GEM: frequent edits disrupt learning — stability matters
- 9:16 vertical first — 90% of Meta inventory is vertical

CONNECTED PLATFORMS RULE — CRITICAL:
- If CONNECTED PLATFORMS shows "meta(...)" → user HAS their ad account connected
- NEVER suggest CSV import when platforms are connected
- Work with the analyses data already in context

USER'S ACCOUNT CONTEXT:
${(typeof context === "string" && context.length > 100) ? context : (richContext || "No account data yet.")}

RESPONSE FORMAT: valid JSON array of blocks ONLY. No text outside JSON.
Each block: { "type": "action"|"pattern"|"hooks"|"warning"|"insight"|"off_topic"|"navigate", "title": "string", "content": "optional string", "items": ["optional array"], "route": "string (for navigate)", "params": {}, "cta": "string" }

TOOL MAP (navigate blocks):
- Hook Generator → "/dashboard/hooks" — params: product, niche, market, platform
- Brief Generator → "/dashboard/brief" — params: product, offer, market, audience
- Script Generator → "/dashboard/script" — params: product, offer, market, platform, angle
- Pre-flight Check → "/dashboard/preflight"
- Translate → "/dashboard/translate"
- Persona Builder → "/dashboard/persona"
- Competitor Decoder → "/dashboard/competitor"
- Import Data → "/dashboard/loop/import" — ONLY when CONNECTED PLATFORMS = "none"

Rules:
- Reference THEIR actual data (titles, scores, markets) when available
- Be brutally direct — no filler
- If they ask for hooks, write REAL copy immediately
- Max 4 blocks per response`;

    // Build history
    const historyMessages: { role: "user" | "assistant"; content: string }[] = [];
    if (Array.isArray(history) && history.length > 0) {
      const recent = history.slice(-16);
      for (const h of recent) {
        if (h.role === "user" || h.role === "assistant") {
          let content = String(h.content || "").trim();
          if (h.role === "assistant" && content.length > 600) content = content.slice(0, 600) + "… [truncated]";
          if (content) historyMessages.push({ role: h.role, content });
        }
      }
    }

    const allMessages = [
      ...historyMessages,
      { role: "user" as const, content: message },
    ];

    const prefStr = user_prefs?.liked?.length || user_prefs?.disliked?.length
      ? `\n\nUSER STYLE PREFERENCES:\n${user_prefs?.liked?.length ? `- Liked: ${user_prefs.liked.join(" | ")}` : ""}\n${user_prefs?.disliked?.length ? `- Disliked: ${user_prefs.disliked.join(" | ")}` : ""}`
      : "";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 1000,
      system: systemPrompt + prefStr,
      messages: allMessages,
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
