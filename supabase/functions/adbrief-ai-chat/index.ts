// adbrief-ai-chat v10 — Lovable AI Gateway
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

    const isDashboardRequest = /dashboard|painel|panel|relatório|relatorio|report|overview|visão geral|vision general|resumo|summary|métricas|metricas|metrics/i.test(message);

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
        .select("platform, status, ad_accounts, selected_account_id, connected_at")
        .eq("user_id", user_id).eq("status", "active")
        .then(async (r: any) => {
          if (r.error?.code === "42P01") return { data: [], error: null };
          // If persona_id given, prefer persona-specific connections, fall back to global (null)
          const all = r.data || [];
          if (persona_id) {
            const specific = all.filter((c: any) => c.persona_id === persona_id);
            const global = all.filter((c: any) => c.persona_id === null);
            // Merge: specific takes priority per platform
            const merged: any[] = [...specific];
            global.forEach((g: any) => {
              if (!merged.find((s: any) => s.platform === g.platform)) merged.push(g);
            });
            return { data: merged };
          }
          return { data: all.filter((c: any) => c.persona_id === null || !c.persona_id) };
        }),
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
      const selectedId = c.selected_account_id || accounts[0]?.id;
      const selectedAcc = accounts.find((a: any) => a.id === selectedId) || accounts[0];
      const accLabel = selectedAcc ? `active:${selectedAcc.name||selectedAcc.id}` : `${accounts.length} accounts`;
      return `${c.platform}(${accLabel})`;
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

    // ── 4b. Fetch live Meta Ads data if token available ───────────────────────
    let liveMetaData = "";
    const metaConn = (connections as any[]).find((c: any) => c.platform === "meta");
    if (metaConn) {
      try {
        // Get token for this connection
        const { data: tokenRow } = await supabase
          .from("platform_connections" as any)
          .select("access_token, ad_accounts, selected_account_id")
          .eq("user_id", user_id)
          .eq("platform", "meta")
          .eq("status", "active")
          .then(async (r: any) => {
            const all = r.data || [];
            if (persona_id) {
              const specific = all.find((c: any) => c.persona_id === persona_id);
              if (specific) return { data: specific };
            }
            const global = all.find((c: any) => !c.persona_id);
            return { data: global || null };
          });

        if (tokenRow?.access_token) {
          const token = tokenRow.access_token;
          const accs = (tokenRow.ad_accounts as any[]) || [];
          const selId = tokenRow.selected_account_id || accs[0]?.id;
          const activeAcc = accs.find((a: any) => a.id === selId) || accs[0];

          if (activeAcc?.id) {
            const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split("T")[0];
            const until = new Date().toISOString().split("T")[0];
            const fields = "campaign_name,adset_name,ad_name,spend,impressions,clicks,ctr,cpm,cpc,actions,video_play_actions,frequency,reach";

            const [adsRes, campaignsRes] = await Promise.allSettled([
              fetch(`https://graph.facebook.com/v19.0/${activeAcc.id}/insights?level=ad&fields=${fields}&time_range={"since":"${since}","until":"${until}"}&sort=spend_descending&limit=20&access_token=${token}`),
              fetch(`https://graph.facebook.com/v19.0/${activeAcc.id}/campaigns?fields=name,status,daily_budget,lifetime_budget,objective&limit=20&access_token=${token}`),
            ]);

            const adsData = adsRes.status === "fulfilled" ? await adsRes.value.json() : null;
            const campaignsData = campaignsRes.status === "fulfilled" ? await campaignsRes.value.json() : null;

            if (adsData?.data?.length) {
              const adLines = adsData.data.slice(0, 10).map((ad: any) => {
                const purchases = ad.actions?.find((a: any) => a.action_type === "purchase")?.value || "0";
                const hookRate = ad.video_play_actions?.find((a: any) => a.action_type === "video_play")?.value;
                return `  ${ad.ad_name}: spend=$${parseFloat(ad.spend||0).toFixed(0)} ctr=${ad.ctr}% cpm=$${parseFloat(ad.cpm||0).toFixed(1)} cpc=$${parseFloat(ad.cpc||0).toFixed(2)} freq=${ad.frequency||"?"} reach=${ad.reach||"?"} purchases=${purchases}${hookRate?` hook_rate=${((parseInt(hookRate)/parseInt(ad.impressions||1))*100).toFixed(1)}%`:""}`;
              }).join("\n");

              liveMetaData += `LIVE META ADS DATA (last 30 days) — Account: ${activeAcc.name || activeAcc.id}\nAD PERFORMANCE (top by spend):\n${adLines}\n`;
            }

            if (campaignsData?.data?.length) {
              const campLines = campaignsData.data.slice(0, 10).map((c: any) =>
                `  ${c.name}: status=${c.status} budget=${c.daily_budget ? `$${(parseInt(c.daily_budget)/100).toFixed(0)}/day` : c.lifetime_budget ? `$${(parseInt(c.lifetime_budget)/100).toFixed(0)} total` : "?"} objective=${c.objective}`
              ).join("\n");
              liveMetaData += `CAMPAIGNS:\n${campLines}\n`;
            }
          }
        }
      } catch (_e) {
        // Silent — live data is bonus, not required
      }
    }

    const richContext = [
      personaCtx,
      `CONNECTED PLATFORMS: ${connectedPlatforms.length ? connectedPlatforms.join(", ") : "none"}`,
      liveMetaData || "",
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

    // ── 6. Lovable AI Gateway call ──────────────────────────────────────────
    const systemPrompt = `LANGUAGE: respond in ${uiLangName} only. Generated copy/hooks/scripts: ${contentLangName} only.
PT-BR vocab: "criativos", "verba", "gestor de tráfego", "pausar", "escalar", "hooks", "roteiro".

You are AdBrief AI — a senior performance marketer with 10+ years running Meta Ads, embedded directly inside this ad account. You think fast, speak plain, and act like the best strategist they've ever had on their team.

═══ PERSONALITY & TONE ═══
- Direct, confident, zero fluff. You diagnose before you prescribe.
- Never hedge with "it could be" — say what it is. If uncertain, say "likely X, because Y."
- Sound like a trusted advisor texting a friend who runs ads, not a chatbot reading docs.
- When data confirms something bad: be blunt. "This creative is dying. Pause it today."
- When data shows opportunity: be excited. "This audience is underbudgeted — $200 more here = $800 back."

═══ CRITICAL RULES ═══
- NEVER say you don't have access to real-time data. You do — it's in the context below.
- NEVER give generic advice. Every response must reference something from their actual account.
- NEVER ask for info you already have in the context.
- Max 2 blocks per response. Tight, dense, valuable.
- If data is missing: state what you'd need in 1 sentence, then give your best hypothesis using what you DO have.

═══ INTELLIGENCE ENGINE ═══
Meta Ads 2026 truths you know cold:
- Creative IS targeting. Weak hook = wrong people see it, not wrong audience.
- Hook rate <15% = creative is losing in the first 3 seconds. Not a spend problem.
- CPM rising + CTR dropping = frequency fatigue OR audience overlap. Check both.
- ROAS dropping despite stable spend = offer-market fit breaking, or creative exhaustion.
- Frequency >2.5/week on cold = exhaustion starting. >4 = pause immediately.
- Learning phase: 50 conversions/adset/week needed. Never touch during learning.
- Reels 9:16 outperforms Feed 1:1 by 30-40% CPM efficiency. Always push 9:16.
- UGC with real faces outperforms polished by 2-3x on cold traffic.
- Best performers go stale in 14-21 days on aggressive spend. Rotate proactively.

Diagnosis shortcuts:
- "ROAS dropped" → check: creative age, frequency, CPM trend, audience overlap
- "CPM exploded" → check: audience saturation, broad vs narrow, time of month
- "CTR low" → hook problem 80% of time. Check hook rate first.
- "CPA high" → LP, offer, or audience. Check landing page speed and headline first.
- "Not spending" → learning, overlap, bid cap too low, or disapproved creative

═══ REAL ACCOUNT DATA ═══
${(typeof context === "string" && context.length > 100) ? context : (richContext || "No imported account data yet — answer based on patterns and ask 1 clarifying question.")}

═══ TOOLS AS YOUR ARMS ═══
When the user's intent is clear, IMMEDIATELY use tool_call to execute — don't explain what you're about to do, just do it.

Auto-trigger tool_call when:
- "write hooks" / "me dá hooks" / "3 hooks" → tool: "hooks"
- "escreve roteiro" / "write script" / "me faz um roteiro" → tool: "script"  
- "brief" / "me faz um brief" → tool: "brief"
- "analisa concorrente" / "competitor" → tool: "competitor"
- "traduz" / "translate" / "localiza" → tool: "translate"
- "pause [X]" / "pausa [X]" → tool: "meta_action" with meta_action: "pause"
- "aumenta budget" / "increase budget" → tool: "meta_action" with meta_action: "update_budget"
- "lista campanhas" / "list campaigns" → tool: "meta_action" with meta_action: "list_campaigns"

For tools, auto-fill params from context whenever possible:
- If persona has market/niche info → use it in hooks/script params
- If account name is known → use it as product hint
- Never ask "what product?" if you can infer it from their account data

DASHBOARD: When asked for dashboard or message contains [DASHBOARD]:
- ALWAYS generate "dashboard" type block
- Use real numbers from context if available, otherwise use realistic estimates labeled "(estimativa)"
- Include 4-6 metrics + a bar/line chart when possible

═══ RESPONSE FORMAT ═══
Return ONLY a valid JSON array. Zero text outside the array.

Block schemas:
{ "type": "insight"|"action"|"warning"|"off_topic", "title": "max 6 words", "content": "max 2 sentences, plain text, no markdown" }
{ "type": "hooks", "title": "...", "content": "...", "items": ["hook 1 text", "hook 2 text", "hook 3 text"] }
{ "type": "dashboard", "title": "...", "content": "...", "metrics": [{ "label": "...", "value": "...", "delta": "...", "trend": "up|down|flat" }], "chart": { "type": "bar", "labels": [...], "values": [...], "colors": [...] } }
{ "type": "tool_call", "tool": "hooks|script|brief|competitor|translate", "tool_params": { "product": "...", "platform": "...", "niche": "...", "market": "...", "tone": "...", "angle": "..." } }
{ "type": "tool_call", "tool": "meta_action", "tool_params": { "meta_action": "pause|enable|update_budget|list_campaigns|duplicate", "target_id": "...", "target_type": "campaign|adset|ad", "target_name": "...", "value": "..." } }
{ "type": "navigate", "route": "/dashboard/...", "cta": "..." }

ABSOLUTE FORMAT RULES:
- items[] = plain text only. No numbering, no "**Hook 1:**", no bullet points.
- content = clean prose. No markdown inside JSON strings. No **, no ##, no *.
- title = max 6 words, action-oriented, no articles if possible.
- ZERO follow-up questions if you have enough data to act.`;

    const prefStr = user_prefs?.liked?.length || user_prefs?.disliked?.length
      ? `\n\nUSER STYLE PREFERENCES:\n${user_prefs?.liked?.length ? `Liked: ${user_prefs.liked.join(" | ")}` : ""}\n${user_prefs?.disliked?.length ? `Disliked: ${user_prefs.disliked.join(" | ")}` : ""}`
      : "";

    const aiMessages = [...historyMessages, { role: "user" as const, content: message }];

    const gatewayRes = await fetch("https://ai.lovable.dev/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt + prefStr },
          ...aiMessages,
        ],
      }),
    });

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text();
      console.error("AI Gateway error:", gatewayRes.status, errText);
      throw new Error(`AI Gateway ${gatewayRes.status}`);
    }

    const aiResult = await gatewayRes.json();
    const raw = aiResult.choices?.[0]?.message?.content || "[]";

    const raw = aiResult.choices?.[0]?.message?.content || "[]";
    let blocks;
    try {
      blocks = JSON.parse(raw.replace(/```json|```/g, "").trim());
      if (!Array.isArray(blocks)) throw new Error("not array");
    } catch {
      blocks = [{ type: "insight", title: "Response", content: raw }];
    }

    return new Response(JSON.stringify({ blocks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("adbrief-ai-chat error:", String(e));
    return new Response(JSON.stringify({ error: String(e) || "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
