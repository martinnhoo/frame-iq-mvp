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
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
    const weekKey = weekStart.toISOString().slice(0, 10);
    const monthKey = today.slice(0, 7); // YYYY-MM

    const { data: usageRow } = await (supabase as any)
      .from("free_usage").select("chat_count, last_reset, dashboard_count, dashboard_week, dashboard_month").eq("user_id", user_id).maybeSingle();
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

    // ── Dashboard request detection & rate limiting ───────────────────────────
    const isDashboardRequest = /dashboard|painel|panel|relatório|relatorio|report|overview|visão geral|vision general|resumo|summary|métricas|metricas|metrics/i.test(message);

    if (isDashboardRequest) {
      // Dashboard limits: studio=1/day, pro=3/week, maker=1/month, free=blocked
      const dashCount = usageRow?.dashboard_count || 0;
      const dashWeek = usageRow?.dashboard_week || "";
      const dashMonth = usageRow?.dashboard_month || "";

      const uiLang = user_language || "en";

      if (planKey === "free") {
        const msgs: Record<string, { title: string; content: string }> = {
          en: { title: "Dashboard unavailable on free plan", content: "Real-time dashboards require Maker plan or higher. Upgrade to unlock." },
          pt: { title: "Dashboard indisponível no plano gratuito", content: "Dashboards em tempo real exigem o plano Maker ou superior. Faça upgrade para desbloquear." },
          es: { title: "Dashboard no disponible en plan gratuito", content: "Los dashboards en tiempo real requieren plan Maker o superior. Actualiza para desbloquear." },
        };
        const m = msgs[uiLang] || msgs.en;
        return new Response(JSON.stringify({ blocks: [{ type: "warning", title: m.title, content: m.content }] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (planKey === "maker") {
        // 1 per month
        if (dashMonth === monthKey && dashCount > 0) {
          const msgs: Record<string, { title: string; content: string }> = {
            en: { title: "Dashboard limit reached", content: "Your Maker plan includes 1 dashboard per month. Resets next month. Upgrade to Pro for 3/week." },
            pt: { title: "Limite de dashboard atingido", content: "Seu plano Maker inclui 1 dashboard por mês. Renova no próximo mês. Faça upgrade para Pro para ter 3/semana." },
            es: { title: "Límite de dashboard alcanzado", content: "Tu plan Maker incluye 1 dashboard por mes. Se reinicia el próximo mes. Actualiza a Pro para tener 3/semana." },
          };
          const m = msgs[uiLang] || msgs.en;
          return new Response(JSON.stringify({ blocks: [{ type: "warning", title: m.title, content: m.content }] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      if (planKey === "pro") {
        // 3 per week
        const thisWeekCount = dashWeek === weekKey ? dashCount : 0;
        if (thisWeekCount >= 3) {
          const msgs: Record<string, { title: string; content: string }> = {
            en: { title: "Weekly dashboard limit reached", content: "Your Pro plan includes 3 dashboards per week. Resets next Monday. Upgrade to Studio for 1/day." },
            pt: { title: "Limite semanal de dashboards atingido", content: "Seu plano Pro inclui 3 dashboards por semana. Renova na próxima segunda. Faça upgrade para Studio para ter 1/dia." },
            es: { title: "Límite semanal de dashboards alcanzado", content: "Tu plan Pro incluye 3 dashboards por semana. Se reinicia el próximo lunes. Actualiza a Studio para tener 1/día." },
          };
          const m = msgs[uiLang] || msgs.en;
          return new Response(JSON.stringify({ blocks: [{ type: "warning", title: m.title, content: m.content }] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      if (planKey === "studio") {
        // 1 per day
        if (dashWeek === today && dashCount > 0) {
          const msgs: Record<string, { title: string; content: string }> = {
            en: { title: "Daily dashboard limit reached", content: "Your Studio plan includes 1 dashboard per day. Resets tomorrow." },
            pt: { title: "Limite diário de dashboard atingido", content: "Seu plano Studio inclui 1 dashboard por dia. Renova amanhã." },
            es: { title: "Límite diario de dashboard alcanzado", content: "Tu plan Studio incluye 1 dashboard por día. Se reinicia mañana." },
          };
          const m = msgs[uiLang] || msgs.en;
          return new Response(JSON.stringify({ blocks: [{ type: "warning", title: m.title, content: m.content }] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Studio freeze time
    if (planKey === "studio" && dailyCount > 100) {
      const delay = Math.min(Math.floor((dailyCount / cap) * 8000), 8000);
      await new Promise(r => setTimeout(r, delay));
    }

    // Update chat counter
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

    const systemPrompt = `LANGUAGE: respond in ${uiLangName} only. Generated copy: ${contentLangName} only.
PT-BR: "criativos" not "creatives", "verba" not "budget", "gestor de tráfego" not "media buyer".

You are AdBrief AI — a senior performance marketer embedded inside this ad account.
You have their real data. USE IT. Never ask for information you already have.

RESPONSE RULES (non-negotiable):
- Max 2 blocks per response. No exceptions.
- NEVER ask for more information if you have enough data to answer
- NEVER list generic advice — only specific actions based on their actual account data
- NEVER write more than 3 items in any list
- If you don't have data: say it in ONE sentence, then give the best hypothesis anyway
- First block = diagnosis or answer. Second block (if needed) = one action to take NOW
- content field: max 2 sentences. Titles: max 6 words.
- ZERO follow-up questions unless absolutely nothing is available to work with

META ADS 2026:
- Creative IS targeting. Hook rate <20% = broken hook, not broken targeting.
- CPM up + CTR down = fatigue. Fix: new hook, same offer.
- Frequency >3/week = exhaustion. ROAS dropping = creative audit top spenders.
- Format: Reels 9:16 > Feed 1:1. UGC > polished.
- Learning: 50 events/adset/week. Never edit during learning.

DIAGNOSIS (when asked "why dropped" / "what's wrong"):
Hook rate <15% → hook problem. CPM +30% → frequency/overlap. CTR flat + ROAS drop → LP/offer. Frequency >3 → exhaustion.

USER'S REAL ACCOUNT DATA:
${(typeof context === "string" && context.length > 100) ? context : (richContext || "No account data yet.")}

RESPONSE FORMAT: valid JSON array only. Zero text outside JSON.

Block types:
- "insight" → diagnosis with real data
- "action" → ONE specific action to take today
- "hooks" → 3 real hooks in items[] — write the actual hooks, not descriptions
- "warning" → urgent issue, max 1 sentence
- "navigate" → send to page when complex input needed (route + cta)
- "tool_call" → auto-execute tool when request is clear
- "dashboard" → ONLY when explicitly asked. Use metrics[] with real numbers.
- "off_topic" → out of scope

Schemas:
{ "type": "...", "title": "...", "content": "...", "items": ["..."] }
{ "type": "dashboard", "title": "...", "metrics": [{ "label": "...", "value": "...", "delta": "...", "trend": "up|down|flat" }], "chart": { "type": "bar", "labels": [...], "values": [...], "colors": [...] } }
{ "type": "tool_call", "tool": "hooks|script|brief|competitor|translate", "tool_params": { ... } }
{ "type": "navigate", "route": "/dashboard/...", "cta": "..." }

TOOLS (use tool_call when user asks to generate content):
- hooks: { product, platform, niche, market, tone }
- script: { product, offer, platform, market, angle }
- brief: { product, offer, market, audience }

META ACTIONS — when user wants to act on their account:
Use tool_call with tool="meta_action" and tool_params:
- pause campaign/adset/ad: { meta_action: "pause", target_id: "ID", target_type: "campaign|adset|ad", target_name: "Name" }
- activate/unpause: { meta_action: "enable", target_id: "ID", target_type: "...", target_name: "Name" }
- update budget: { meta_action: "update_budget", target_id: "ID", target_type: "campaign|adset", value: "50", target_name: "Name" }
- publish draft: { meta_action: "publish", target_id: "ID", target_name: "Name" }
- duplicate adset: { meta_action: "duplicate", target_id: "ID", target_name: "Name" }
- list campaigns: { meta_action: "list_campaigns" }

IMPORTANT: For ANY destructive action (pause, budget change, publish), ALWAYS use tool_call so the user sees a confirmation step before execution. Never act without confirmation.
If user says "pause X" and you know the ID from context → use tool_call immediately.
If user says "pause" without specifying which → use list_campaigns first to show options.

ABSOLUTE RULES:
- Max 2 blocks. Never ask questions if you have data. No generic lists.
- Titles under 6 words. Content under 2 sentences.
- If asked "write hooks/script/brief" → USE tool_call immediately, no explanations first.`;

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

    // If dashboard was generated, update dashboard counter
    const hasDashboard = Array.isArray(blocks) && blocks.some((b: any) => b.type === "dashboard");
    if (isDashboardRequest && hasDashboard) {
      const newDashCount = (usageRow?.dashboard_count || 0) + 1;
      await (supabase as any).from("free_usage").upsert({
        user_id,
        dashboard_count: newDashCount,
        dashboard_week: planKey === "studio" ? today : weekKey,
        dashboard_month: monthKey,
      }, { onConflict: "user_id" });
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
