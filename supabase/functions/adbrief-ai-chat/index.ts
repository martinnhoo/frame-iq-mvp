// adbrief-ai-chat v13 — Google Ads live data + cross-platform intelligence + persona_id scoped
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

    // ── 1. Init Supabase + validate JWT matches user_id ───────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Security: verify the auth token belongs to the claimed user_id
    // Prevents one user from querying another user's data by spoofing user_id
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user || user.id !== user_id) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── 2. Plan check + smart rate limiting ──────────────────────────────────
    const { data: profileRow } = await supabase
      .from("profiles").select("plan").eq("id", user_id).maybeSingle();
    const plan = profileRow?.plan || "free";
    const planKey = (["free","maker","pro","studio"].includes(plan)
      ? plan
      : ({ creator:"maker", starter:"pro", scale:"studio" } as any)[plan]) || "free";

    const today = new Date().toISOString().slice(0, 10);
    const monthKey = today.slice(0, 7); // YYYY-MM

    // Fetch daily + monthly usage in one query
    const { data: usageRow } = await (supabase as any)
      .from("free_usage")
      .select("chat_count, last_reset, monthly_msg_count, monthly_reset")
      .eq("user_id", user_id).maybeSingle();

    const lastReset = usageRow?.last_reset?.slice(0, 10);
    const dailyCount = lastReset === today ? (usageRow?.chat_count || 0) : 0;
    const lastMonthReset = usageRow?.monthly_reset?.slice(0, 7);
    const monthlyCount = lastMonthReset === monthKey ? (usageRow?.monthly_msg_count || 0) : 0;

    // ── Cost model: $0.0236 per chat message (Sonnet, 5850 in + 400 out tokens)
    const COST_PER_MSG = 0.0236;
    const estimatedMonthlyCost = monthlyCount * COST_PER_MSG;

    // ── Plan revenue & thresholds
    const PLAN_REVENUE:    Record<string, number> = { free: 0,   maker: 19,  pro: 49,  studio: 149 };
    const DAILY_CAPS:      Record<string, number> = { free: 3,   maker: 50,  pro: 200, studio: 500 };
    // Cooldown threshold: monthly cost > 70% of plan revenue (msgs)
    // Soft cap: monthly cost > 90% of plan revenue  
    const COOLDOWN_MSGS:   Record<string, number> = { free: 3,   maker: 564, pro: 1456, studio: 4428 };
    const SOFTCAP_MSGS:    Record<string, number> = { free: 3,   maker: 726, pro: 1872, studio: 5694 };

    const revenue  = PLAN_REVENUE[planKey] ?? 0;
    const cap      = DAILY_CAPS[planKey]   ?? 3;
    const cooldown = COOLDOWN_MSGS[planKey] ?? 3;
    const softcap  = SOFTCAP_MSGS[planKey]  ?? 3;
    const uiLang   = (user_language as string) || "pt";

    // ── Hard check: daily cap (existing protection)
    if (dailyCount >= cap) {
      const m: Record<string, string> = {
        pt: `Você usou todas as ${cap} mensagens de hoje. Renova amanhã.`,
        es: `Usaste los ${cap} mensajes de hoy. Se reinicia mañana.`,
        en: `You've used all ${cap} messages for today. Resets tomorrow.`,
      };
      return new Response(JSON.stringify({ error: "daily_limit", blocks: [{ type: "warning",
        title: uiLang === "pt" ? "Limite diário atingido" : uiLang === "es" ? "Límite diario" : "Daily limit reached",
        content: m[uiLang] || m.en }] }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Soft cap: monthly cost approaching revenue ceiling — suggest upgrade, don't block
    if (monthlyCount >= softcap && planKey !== "studio") {
      const nextPlan = planKey === "free" ? "Maker" : planKey === "maker" ? "Pro" : "Studio";
      const m: Record<string, string> = {
        pt: `Você usou ${monthlyCount} mensagens este mês — está se aproximando do limite de rentabilidade do plano ${planKey}. Considere fazer upgrade para ${nextPlan} para continuar sem interrupções.`,
        es: `Usaste ${monthlyCount} mensajes este mes. Considera actualizar a ${nextPlan}.`,
        en: `You've used ${monthlyCount} messages this month. Consider upgrading to ${nextPlan} to continue without limits.`,
      };
      return new Response(JSON.stringify({ error: "monthly_softcap", blocks: [{ type: "warning",
        title: uiLang === "pt" ? "Limite mensal se aproximando" : "Monthly limit approaching",
        content: m[uiLang] || m.en,
        cta_label: uiLang === "pt" ? `Fazer upgrade para ${nextPlan}` : `Upgrade to ${nextPlan}`,
        cta_route: "/pricing" }] }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Smart cooldown: monthly cost crossed 70% of plan revenue
    // Only kicks in for users who are genuinely heavy — normal users never hit this
    let cooldownDelay = 0;
    if (monthlyCount >= cooldown && planKey !== "studio") {
      // Progressive delay: 2s at 70%, scaling to 8s at 90%
      const pct = Math.min((monthlyCount - cooldown) / (softcap - cooldown), 1);
      cooldownDelay = Math.round(2000 + pct * 6000); // 2s → 8s
    }

    // ── Log cost alert if user crossed 70% threshold (fire-and-forget)
    if (monthlyCount >= cooldown && monthlyCount % 10 === 0) {
      (supabase as any).from("cost_alerts").upsert({
        user_id,
        plan: planKey,
        monthly_msgs: monthlyCount,
        estimated_cost: estimatedMonthlyCost,
        plan_revenue: revenue,
        cost_pct: revenue > 0 ? Math.round((estimatedMonthlyCost / revenue) * 100) : 999,
        alert_date: today,
        last_updated: new Date().toISOString(),
      }, { onConflict: "user_id" }).then(() => {}).catch(() => {});
    }

    const isDashboardRequest = /dashboard|painel|panel|relatório|relatorio|report|overview|visão geral|vision general|resumo|summary|métricas|metricas|metrics|como está minha conta|how is my account|como vai/i.test(message);
    
    // Dashboard limits per plan (monthly)
    const DASHBOARD_LIMITS: Record<string, number> = { free: 0, maker: 10, pro: 30, studio: -1 };
    const dashLimit = DASHBOARD_LIMITS[planKey] ?? 0;

    // If dashboard request — check limit and offer instead of auto-generating
    if (isDashboardRequest && !message.includes("[DASHBOARD_CONFIRMED]")) {
      const dashUsed = (profileRow as any)?.dashboard_count || 0;
      const dashRemaining = dashLimit === -1 ? 999 : Math.max(0, dashLimit - dashUsed);
      
      if (dashLimit === 0 || (dashLimit !== -1 && dashUsed >= dashLimit)) {
        // No dashboards left — return upgrade wall
        const uLang = uiLang || 'pt';
        const title = uLang === 'pt' ? 'Limite de dashboards atingido' : uLang === 'es' ? 'Límite de dashboards alcanzado' : 'Dashboard limit reached';
        const content = uLang === 'pt' 
          ? `Seu plano ${planKey} inclui ${dashLimit === 0 ? 'acesso a dashboards apenas no plano Maker ou superior' : dashLimit + ' dashboards/mês'}. Você usou ${dashUsed}.`
          : `Your ${planKey} plan includes ${dashLimit === 0 ? 'dashboards on Maker plan or higher' : dashLimit + ' dashboards/month'}. You've used ${dashUsed}.`;
        return new Response(JSON.stringify({ 
          error: "dashboard_limit",
          blocks: [{ type: "warning", title, content }]
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      // Offer to generate dashboard — don't auto-generate
      const uLang = uiLang || 'pt';
      const offerTitle = uLang === 'pt' ? 'Gerar dashboard de performance?' : uLang === 'es' ? '¿Generar dashboard de rendimiento?' : 'Generate performance dashboard?';
      const offerContent = uLang === 'pt'
        ? `Posso gerar um dashboard com os dados reais da sua conta Meta Ads — spend, CTR, anúncios para escalar e pausar. Isso usa 1 dos seus ${dashRemaining} dashboard${dashRemaining !== 1 ? 's' : ''} restantes este mês.`
        : `I can generate a dashboard with your real Meta Ads data — spend, CTR, ads to scale and pause. This uses 1 of your ${dashRemaining} remaining dashboard${dashRemaining !== 1 ? 's' : ''} this month.`;
      
      return new Response(JSON.stringify({
        blocks: [{ 
          type: "dashboard_offer",
          title: offerTitle,
          content: offerContent,
          remaining: dashRemaining,
          original_message: message,
        }]
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    // If confirmed dashboard — increment counter
    if (message.includes("[DASHBOARD_CONFIRMED]")) {
      const dashUsed = (profileRow as any)?.dashboard_count || 0;
      if (dashLimit !== -1) {
        await supabase.from("profiles").update({ dashboard_count: dashUsed + 1 } as any).eq("id", user_id);
      }
    }

    // Apply smart cooldown if active (only for abusive usage)
    if (cooldownDelay > 0) {
      await new Promise(r => setTimeout(r, cooldownDelay));
    }

    // Update daily + monthly counter atomically
    await (supabase as any).from("free_usage").upsert({
      user_id,
      chat_count: dailyCount + 1,
      last_reset: today,
      monthly_msg_count: monthlyCount + 1,
      monthly_reset: monthKey,
    }, { onConflict: "user_id" });

    // ── 2b. Detect "remember this" instructions — save before fetching context ──
    const rememberTriggers = /(lembre(-se)?( de)?|quero que (você|vc) (lembre|saiba|guarde)|não (esqueça|esquece)|sempre que|remember( that| this)?|keep in mind|note that|anota( que)?|guarda( que)?|já te (falei|disse)|eu (já )?te (falei|disse))/i;
    if (rememberTriggers.test(message)) {
      // Extract what to remember — take the message minus trigger words
      const noteText = message
        .replace(/^(ei[,!]?\s*)?/i, '')
        .replace(/lembre(-se)?( de)?|quero que (você|vc) (lembre|saiba|guarde)|não (esqueça|esquece)|remember( that| this)?|keep in mind|note that|anota( que)?|guarda( que)?|já te (falei|disse)|eu (já )?te (falei|disse)/gi, '')
        .replace(/[,:\s]+$/, '')
        .trim()
        .slice(0, 300);

      if (noteText.length > 5) {
        // Save to user_ai_profile.pain_point (reusing existing column for user notes)
        // Get current notes first
        const { data: existingProfile } = await (supabase as any)
          .from('user_ai_profile')
          .select('pain_point')
          .eq('user_id', user_id)
          .maybeSingle();

        const existing = (existingProfile?.pain_point as string) || '';
        const timestamp = new Date().toISOString().slice(0, 10);
        const newNote = `[${timestamp}] ${noteText}`;
        // Keep last 5 notes, separated by | — avoids unbounded growth
        const allNotes = existing
          ? [newNote, ...existing.split('|||').filter(Boolean)].slice(0, 5).join('|||')
          : newNote;

        await (supabase as any).from('user_ai_profile').upsert(
          { user_id, pain_point: allNotes, last_updated: new Date().toISOString() },
          { onConflict: 'user_id' }
        ).catch(() => {});
      }
    }

    // ── 3. Fetch account data in parallel ─────────────────────────────────────
    const [
      { data: recentAnalyses },
      { data: aiProfile },
      { data: creativeMemory },
      { data: platformConns },
      { data: adsImports },
      { data: personaRow },
      { data: learnedPatterns },
      { data: dailySnapshots },
      { data: preflightHistory },
      { data: accountAlerts },
      { data: telegramConnection },
    ] = await Promise.all([
      // 1. Recent analyses — last 15, full result for context
      supabase.from("analyses")
        .select("id, created_at, title, result, hook_strength, status, improvement_suggestions")
        .eq("user_id", user_id).eq("status", "completed")
        .order("created_at", { ascending: false }).limit(15),
      // 2. AI profile
      (supabase as any).from("user_ai_profile")
        .select("*").eq("user_id", user_id).maybeSingle(),
      // 3. Creative memory
      supabase.from("creative_memory" as any)
        .select("hook_type, hook_score, platform, notes, created_at" as any)
        .eq("user_id" as any, user_id)
        .order("created_at" as any, { ascending: false }).limit(20),
      // 4. Platform connections — STRICT persona scope, no global fallback
      // Each account has its own isolated connections
      supabase.from("platform_connections" as any)
        .select("platform, status, ad_accounts, selected_account_id, connected_at, persona_id")
        .eq("user_id", user_id)
        .eq("status", "active")
        .then(async (r: any) => {
          if (r.error?.code === "42P01") return { data: [], error: null };
          const all = (r.data || []) as any[];
          // STRICT: only return connections for this specific persona
          // If no persona_id, return nothing (force account selection)
          if (persona_id) {
            const scoped = all.filter((c: any) => c.persona_id === persona_id);
            return { data: scoped };
          }
          return { data: [] };
        }),
      // 5. Ads data imports
      supabase.from("ads_data_imports" as any)
        .select("platform, result, created_at" as any)
        .eq("user_id" as any, user_id)
        .order("created_at" as any, { ascending: false }).limit(3),
      // 6. Persona row — WAS MISSING QUERY
      persona_id
        ? supabase.from("personas").select("name, headline, result").eq("id", persona_id).maybeSingle()
        : Promise.resolve({ data: null }),
      // 7. Learned patterns — persona-scoped: prefer this account's patterns, include global (null persona_id)
      (supabase as any).from("learned_patterns")
        .select("pattern_key, is_winner, avg_ctr, avg_roas, confidence, insight_text, variables, persona_id")
        .eq("user_id", user_id)
        .order("confidence", { ascending: false })
        .limit(60),
      // 8. Daily snapshots — last 7 days, persona-scoped when possible
      (supabase as any).from("daily_snapshots")
        .select("date, account_name, total_spend, avg_ctr, active_ads, top_ads, ai_insight, yesterday_spend, yesterday_ctr, raw_period")
        .eq("user_id", user_id)
        .then(async (r: any) => {
          const all = (r.data || []) as any[];
          if (!all.length) return { data: [] };
          // Prefer persona-scoped snapshots, fall back to any
          const scoped = persona_id ? all.filter((s: any) => s.persona_id === persona_id) : [];
          const result = scoped.length ? scoped : all;
          return { data: result.sort((a: any, b: any) => b.date.localeCompare(a.date)).slice(0, 7) };
        }),
      // 9. Preflight history — last 10 runs to understand creative quality trend
      (supabase as any).from("preflight_results")
        .select("created_at, score, verdict, platform, market, format")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(10)
        .then((r: any) => r.error ? { data: [] } : r),
      // 10. Active account alerts — undismissed, sent to AI as memory
      (supabase as any).from("account_alerts")
        .select("type, urgency, ad_name, campaign_name, detail, kpi_label, kpi_value, action_suggestion, created_at")
        .eq("user_id", user_id)
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .limit(5)
        .then((r: any) => r.error ? { data: [] } : r),
      // 11. Telegram connection status
      (supabase as any).from("telegram_connections")
        .select("chat_id, telegram_username, connected_at")
        .eq("user_id", user_id)
        .eq("active", true)
        .maybeSingle()
        .then((r: any) => r.error ? { data: null } : r),
    ]);

    // ── 4. Build context ──────────────────────────────────────────────────────
    const analyses = (recentAnalyses || []) as any[];
    // creative_memory: scope to persona if available
    const allMemory = (creativeMemory || []) as any[];
    const memory = allMemory; // creative_memory doesn't have persona_id yet — use all, AI persona context prevents cross-contamination
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

    // Learned patterns — what the product knows about this user
    // Scope patterns to this persona — prefer persona-specific, include global (null persona_id), exclude other personas
    const allRawPatterns = (learnedPatterns || []) as any[];
    const patterns = persona_id
      ? allRawPatterns.filter((p: any) => p.persona_id === persona_id || p.persona_id === null).slice(0, 30)
      : allRawPatterns.filter((p: any) => p.persona_id === null).slice(0, 30);
    const winners = patterns.filter(p => p.is_winner && p.confidence > 0.2);
    const competitors = patterns.filter(p => p.pattern_key.startsWith('competitor_'));
    const perfPatterns = patterns.filter(p => p.pattern_key.startsWith('perf_'));
    const preflightPatterns = patterns.filter(p => p.pattern_key.startsWith('preflight_'));
    const actionPatterns = patterns.filter(p => p.pattern_key.startsWith('action_'));

    const learnedCtx = [
      winners.length ? `PADRÕES VENCEDORES:\n${winners.slice(0,5).map(p => `  - ${p.insight_text} (confiança: ${(p.confidence*100).toFixed(0)}%)`).join("\n")}` : "",
      perfPatterns.length ? `PERFORMANCE HISTÓRICA:\n${perfPatterns.slice(0,5).map(p => `  - ${p.insight_text}`).join("\n")}` : "",
      competitors.length ? `CONCORRENTES ANALISADOS:\n${competitors.slice(0,5).map(p => `  - ${p.insight_text}`).join("\n")}` : "",
      preflightPatterns.length ? `QUALIDADE DE SCRIPT (preflight):\n${preflightPatterns.slice(0,3).map(p => `  - ${p.insight_text}`).join("\n")}` : "",
      actionPatterns.length ? `AÇÕES EXECUTADAS:\n${actionPatterns.slice(0,3).map(p => `  - ${p.insight_text}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n");

    // ── 4b. Fetch live Meta Ads data (with historical date detection) ──────────
    // Detect if user is asking about a specific historical period
    const historicalMatch = message.match(
      /(?:em|in|de|desde|from|between|entre|no mês de|no dia|week of|semana de)?\s*(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|january|february|march|april|may|june|july|august|september|october|november|december)\s*(?:de\s*)?(?:20\d{2})?|(?:\d{1,2})[\/\-](?:\d{1,2})(?:[\/\-](?:20)?\d{2,4})?|(?:last|últim[ao]s?|past)\s+(?:\d+)\s+(?:days?|dias?|weeks?|semanas?|months?|meses?)/i
    );
    let historicalSince: string | null = null;
    let historicalUntil: string | null = null;

    if (historicalMatch) {
      try {
        const matched = historicalMatch[0].toLowerCase();
        const now = new Date();
        const MONTHS_PT: Record<string, number> = {
          janeiro:0, fevereiro:1, março:2, abril:3, maio:4, junho:5,
          julho:6, agosto:7, setembro:8, outubro:9, novembro:10, dezembro:11,
          january:0, february:1, march:2, april:3, may:4, june:5,
          july:6, august:7, september:8, october:9, november:10, december:11
        };
        // Month name match (e.g. "janeiro", "março de 2024")
        const monthMatch = matched.match(/(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|january|february|march|april|may|june|july|august|september|october|november|december)/);
        if (monthMatch) {
          const yearMatch = matched.match(/20(\d{2})/);
          const year = yearMatch ? parseInt("20" + yearMatch[1]) : now.getFullYear();
          const month = MONTHS_PT[monthMatch[1]];
          historicalSince = new Date(year, month, 1).toISOString().split("T")[0];
          historicalUntil = new Date(year, month + 1, 0).toISOString().split("T")[0];
        }
        // "last N days/weeks/months"
        const relMatch = matched.match(/(\d+)\s*(day|dia|week|semana|month|mes)/);
        if (relMatch) {
          const n = parseInt(relMatch[1]);
          const unit = relMatch[2];
          const ms = unit.startsWith("day") || unit.startsWith("dia") ? n * 86400000
                    : unit.startsWith("week") || unit.startsWith("seman") ? n * 7 * 86400000
                    : n * 30 * 86400000;
          historicalSince = new Date(Date.now() - ms).toISOString().split("T")[0];
          historicalUntil = new Date().toISOString().split("T")[0];
        }
        // Only use historical if it's actually outside our default 30-day window
        if (historicalSince) {
          const daysDiff = (Date.now() - new Date(historicalSince).getTime()) / 86400000;
          if (daysDiff <= 32) { historicalSince = null; historicalUntil = null; } // within default window
        }
      } catch (_) { historicalSince = null; historicalUntil = null; }
    }

    let liveMetaData = "";
    const metaConn = (connections as any[]).find((c: any) => c.platform === "meta");
    if (metaConn) {
      try {
        const { data: allConns } = await supabase
          .from("platform_connections" as any)
          .select("access_token, ad_accounts, selected_account_id, persona_id")
          .eq("user_id", user_id).eq("platform", "meta").eq("status", "active");
        const allC = (allConns as any[]) || [];
        // STRICT: only use connection scoped to this persona — no global fallback
        const tokenRow = persona_id
          ? allC.find((c: any) => c.persona_id === persona_id) || null
          : null;

        if (tokenRow?.access_token) {
          const token = tokenRow.access_token;
          const accs = (tokenRow.ad_accounts as any[]) || [];
          const selId = tokenRow.selected_account_id;
          const activeAcc = (selId && accs.find((a: any) => a.id === selId)) || accs[0];

          if (activeAcc?.id) {
            const since = historicalSince || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split("T")[0];
            const until = historicalUntil || new Date().toISOString().split("T")[0];

            // ── FIX 6: In-memory cache (15 min per account) ─────────────────
            // Prevents 2x redundant Meta API calls on every message
            const cacheKey = `${activeAcc.id}:${since}:${until}`;
            const now_ts = Date.now();
            const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
            if (!(globalThis as any).__metaCache) (globalThis as any).__metaCache = {};
            const cached = (globalThis as any).__metaCache[cacheKey];
            let adsRaw: any = null, campsRaw: any = null, adsetsRaw: any = null,
                timeSeriesRaw: any = null, placementRaw: any = null;

            if (cached && (now_ts - cached.ts) < CACHE_TTL) {
              adsRaw       = cached.adsRaw;
              campsRaw     = cached.campsRaw;
              adsetsRaw    = cached.adsetsRaw;
              timeSeriesRaw = cached.timeSeriesRaw;
              placementRaw  = cached.placementRaw;
            } else {
              // ── FIX 1: Limit 20→50 ads + FIX 4: Add adsets + FIX 3: Time series + FIX 2: Placements
              const fields = "campaign_name,adset_name,ad_name,spend,impressions,clicks,ctr,cpm,cpc,actions,video_play_actions,frequency,reach";
              const [r1, r2, r3, r4, r5] = await Promise.allSettled([
                // FIX 1: 50 ads (was 20)
                fetch(`https://graph.facebook.com/v19.0/${activeAcc.id}/insights?level=ad&fields=${fields}&time_range={"since":"${since}","until":"${until}"}&sort=spend_descending&limit=50&access_token=${token}`),
                // Campaigns: 50 (was 20)
                fetch(`https://graph.facebook.com/v19.0/${activeAcc.id}/campaigns?fields=name,status,daily_budget,lifetime_budget,objective,effective_status&limit=50&access_token=${token}`),
                // FIX 4: Adsets with targeting + budget + status
                fetch(`https://graph.facebook.com/v19.0/${activeAcc.id}/adsets?fields=name,status,effective_status,daily_budget,lifetime_budget,targeting,optimization_goal,bid_strategy,bid_amount,campaign_id&limit=50&access_token=${token}`),
                // FIX 3: Time series — daily CTR, spend, impressions for last 14 days
                fetch(`https://graph.facebook.com/v19.0/${activeAcc.id}/insights?fields=spend,impressions,clicks,ctr,cpm,actions&time_range={"since":"${new Date(Date.now()-14*24*3600000).toISOString().split("T")[0]}","until":"${until}"}&time_increment=1&limit=14&access_token=${token}`),
                // FIX 2: Placement breakdown
                fetch(`https://graph.facebook.com/v19.0/${activeAcc.id}/insights?fields=spend,impressions,clicks,ctr,cpm&breakdowns=publisher_platform,platform_position&time_range={"since":"${since}","until":"${until}"}&sort=spend_descending&limit=20&access_token=${token}`),
              ]);
              adsRaw        = r1.status === "fulfilled" ? await r1.value.json() : null;
              campsRaw      = r2.status === "fulfilled" ? await r2.value.json() : null;
              adsetsRaw     = r3.status === "fulfilled" ? await r3.value.json() : null;
              timeSeriesRaw = r4.status === "fulfilled" ? await r4.value.json() : null;
              placementRaw  = r5.status === "fulfilled" ? await r5.value.json() : null;

              // Cache results
              (globalThis as any).__metaCache[cacheKey] = { ts: now_ts, adsRaw, campsRaw, adsetsRaw, timeSeriesRaw, placementRaw };
            }

            liveMetaData = `${historicalSince ? "HISTORICAL" : "LIVE"} META ADS — Account: ${activeAcc.name || activeAcc.id} (${since} to ${until})${historicalSince ? " [período solicitado]" : ""}\n`;

            // Campaigns
            if (campsRaw?.error) {
              const isExpired = campsRaw.error.code === 190 || String(campsRaw.error.type||"").includes("OAuthException");
              liveMetaData += isExpired
                ? `CAMPAIGNS: Token expirado — peça ao usuário para reconectar o Meta Ads em Contas. NÃO emita tool_call.\n`
                : `CAMPAIGNS: Error — ${campsRaw.error.message}. Answer based on this error, do NOT emit list_campaigns tool_call.\n`;
            } else if (campsRaw?.data?.length) {
              const lines = campsRaw.data.slice(0, 30).map((c: any) =>
                `  ${c.name}: ${c.effective_status||c.status} | budget=${c.daily_budget ? `$${(parseInt(c.daily_budget)/100).toFixed(0)}/day` : c.lifetime_budget ? `$${(parseInt(c.lifetime_budget)/100).toFixed(0)} total` : "no budget"} | ${c.objective}`
              ).join("\n");
              liveMetaData += `CAMPAIGNS (${campsRaw.data.length}):\n${lines}\n`;
            } else {
              liveMetaData += `CAMPAIGNS: Nenhuma campanha encontrada.\n`;
            }

            // FIX 4: Adsets with targeting intel
            if (adsetsRaw?.data?.length) {
              const adsetLines = adsetsRaw.data.slice(0, 20).map((s: any) => {
                const age = s.targeting?.age_min && s.targeting?.age_max ? `${s.targeting.age_min}-${s.targeting.age_max}` : null;
                const interests = (s.targeting?.flexible_spec?.[0]?.interests || []).slice(0,3).map((i:any)=>i.name).join(", ");
                const geos = (s.targeting?.geo_locations?.countries || []).join(",");
                const budget = s.daily_budget ? `$${(parseInt(s.daily_budget)/100).toFixed(0)}/day` : s.lifetime_budget ? `$${(parseInt(s.lifetime_budget)/100).toFixed(0)} total` : "no budget";
                return `  ${s.name}: ${s.effective_status||s.status} | ${budget} | ${s.optimization_goal||""}${age?` | age ${age}`:""}${geos?` | geo:${geos}`:""}${interests?` | interests:${interests}`:""}`;
              }).join("\n");
              liveMetaData += `ADSETS (${adsetsRaw.data.length}):\n${adsetLines}\n`;
            }

            // Ads performance
            if (adsRaw?.error) {
              const isExpired = adsRaw.error.code === 190 || String(adsRaw.error.message||"").toLowerCase().includes("token") || String(adsRaw.error.type||"").includes("OAuthException");
              liveMetaData += isExpired
                ? `ADS: Token expirado — diga ao usuário para reconectar o Meta Ads em Contas.\n`
                : `ADS: Erro ao buscar dados — ${adsRaw.error.message}\n`;
            } else if (adsRaw?.data?.length) {
              // FIX 1: Show all 50 with smarter truncation
              const adLines = adsRaw.data.slice(0, 50).map((ad: any) => {
                const purchases = ad.actions?.find((a: any) => a.action_type === "purchase")?.value || "0";
                const leads = ad.actions?.find((a: any) => a.action_type === "lead")?.value || "";
                const hookRate = ad.video_play_actions?.find((a: any) => a.action_type === "video_play")?.value;
                const hr = hookRate ? ` hook=${((parseInt(hookRate)/Math.max(parseInt(ad.impressions||1),1))*100).toFixed(1)}%` : "";
                const conv = leads ? ` leads=${leads}` : purchases !== "0" ? ` purch=${purchases}` : "";
                return `  ${ad.ad_name}: spend=$${parseFloat(ad.spend||0).toFixed(0)} ctr=${ad.ctr}% cpm=$${parseFloat(ad.cpm||0).toFixed(1)} freq=${ad.frequency||"?"}${hr}${conv}`;
              }).join("\n");
              liveMetaData += `ADS (${adsRaw.data.length} found, top by spend):\n${adLines}\n`;
            } else {
              liveMetaData += `ADS: Nenhum gasto de anúncio no período.\n`;
            }

            // FIX 3: Time series — daily trend
            if (timeSeriesRaw?.data?.length) {
              const series = timeSeriesRaw.data
                .filter((d: any) => parseFloat(d.spend||0) > 0)
                .slice(-14)
                .map((d: any) => {
                  const purch = d.actions?.find((a:any)=>a.action_type==="purchase")?.value || "";
                  return `  ${d.date_start}: spend=$${parseFloat(d.spend||0).toFixed(0)} ctr=${parseFloat(d.ctr||0).toFixed(2)}% cpm=$${parseFloat(d.cpm||0).toFixed(1)}${purch?` purch=${purch}`:""}`;
                }).join("\n");
              if (series) {
                // Compute trend
                const days = timeSeriesRaw.data.filter((d:any)=>parseFloat(d.spend||0)>0);
                const half = Math.floor(days.length/2);
                const firstHalf = days.slice(0,half);
                const secondHalf = days.slice(half);
                const avgCtr1 = firstHalf.reduce((s:number,d:any)=>s+parseFloat(d.ctr||0),0)/Math.max(firstHalf.length,1);
                const avgCtr2 = secondHalf.reduce((s:number,d:any)=>s+parseFloat(d.ctr||0),0)/Math.max(secondHalf.length,1);
                const trend = avgCtr2 > avgCtr1*1.05 ? "↑ melhorando" : avgCtr2 < avgCtr1*0.95 ? "↓ piorando" : "→ estável";
                liveMetaData += `TENDÊNCIA DIÁRIA (${trend} CTR):\n${series}\n`;
              }
            }

            // FIX 2: Placement breakdown
            if (placementRaw?.data?.length) {
              const placements = placementRaw.data
                .filter((p:any) => parseFloat(p.spend||0) > 0)
                .slice(0, 10)
                .map((p:any) => `  ${p.publisher_platform||""}/${p.platform_position||""}: spend=$${parseFloat(p.spend||0).toFixed(0)} ctr=${parseFloat(p.ctr||0).toFixed(2)}% cpm=$${parseFloat(p.cpm||0).toFixed(1)}`)
                .join("\n");
              if (placements) liveMetaData += `PLACEMENT BREAKDOWN:\n${placements}\n`;
            }

          } else {
            liveMetaData = `META CONNECTED — no ad account selected. Tell user to go to Contas and select an ad account.`;
          }
        } else {
          liveMetaData = `META CONNECTED — token missing. Tell user to reconnect Meta Ads in Contas.`;
        }
      } catch (_e) {
        liveMetaData = `META CONNECTED — data fetch error: ${(_e as any)?.message || "unknown"}.`;
      }
    }

    // ── Google Ads live data ──────────────────────────────────────────────────
    let liveGoogleData = "";
    const googleConn = (connections as any[]).find((c: any) => c.platform === "google");
    if (googleConn) {
      try {
        const { data: gConns } = await supabase
          .from("platform_connections" as any)
          .select("access_token, refresh_token, expires_at, ad_accounts, selected_account_id, persona_id")
          .eq("user_id", user_id).eq("platform", "google").eq("status", "active");
        const gC = (gConns as any[]) || [];
        const gRow = persona_id ? gC.find((c: any) => c.persona_id === persona_id) || null : null;

        if (gRow?.access_token) {
          let token = gRow.access_token;

          // Auto-refresh if expired
          const expiresAt = gRow.expires_at ? new Date(gRow.expires_at).getTime() : 0;
          if (expiresAt && expiresAt - Date.now() < 5 * 60 * 1000 && gRow.refresh_token) {
            try {
              const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                  refresh_token: gRow.refresh_token,
                  client_id: Deno.env.get("GOOGLE_CLIENT_ID") || "",
                  client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") || "",
                  grant_type: "refresh_token",
                }),
              });
              const refreshData = await refreshRes.json();
              if (refreshData.access_token) {
                token = refreshData.access_token;
                await supabase.from("platform_connections" as any).update({
                  access_token: token,
                  expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
                }).eq("user_id", user_id).eq("platform", "google").eq("persona_id", persona_id);
              }
            } catch {}
          }

          const accs = (gRow.ad_accounts as any[]) || [];
          const selId = gRow.selected_account_id;
          const activeAcc = (selId && accs.find((a: any) => a.id === selId)) || accs[0];

          if (activeAcc?.id) {
            const custId = activeAcc.id.replace(/-/g, "");
            const devToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") || "";
            const since = historicalSince || new Date(Date.now() - 30 * 24 * 3600000).toISOString().split("T")[0];
            const until = historicalUntil || new Date().toISOString().split("T")[0];

            // Cache for Google too
            const gCacheKey = `g:${custId}:${since}:${until}`;
            if (!(globalThis as any).__metaCache) (globalThis as any).__metaCache = {};
            const gCached = (globalThis as any).__metaCache[gCacheKey];

            let gCampaigns: any[] = [], gAds: any[] = [], gKeywords: any[] = [], gTimeSeries: any[] = [];

            if (gCached && (Date.now() - gCached.ts) < 15 * 60 * 1000) {
              gCampaigns   = gCached.campaigns;
              gAds         = gCached.ads;
              gKeywords    = gCached.keywords;
              gTimeSeries  = gCached.timeSeries;
            } else {
              const gHeaders = {
                Authorization: `Bearer ${token}`,
                "developer-token": devToken,
                "login-customer-id": custId,
                "Content-Type": "application/json",
              };
              const gQuery = (query: string) =>
                fetch(`https://googleads.googleapis.com/v17/customers/${custId}/googleAds:search`, {
                  method: "POST", headers: gHeaders, body: JSON.stringify({ query }),
                }).then(r => r.json());

              const [cRes, aRes, kRes, tRes] = await Promise.allSettled([
                // Campaigns
                gQuery(`SELECT campaign.name, campaign.status, campaign.advertising_channel_type, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.cost_micros, metrics.conversions, metrics.roas FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}' AND campaign.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 30`),
                // Ads
                gQuery(`SELECT ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group.name, campaign.name, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.cost_micros, metrics.conversions FROM ad_group_ad WHERE segments.date BETWEEN '${since}' AND '${until}' AND ad_group_ad.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 30`),
                // Keywords
                gQuery(`SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, campaign.name, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.cost_micros, metrics.conversions FROM keyword_view WHERE segments.date BETWEEN '${since}' AND '${until}' ORDER BY metrics.cost_micros DESC LIMIT 20`),
                // Time series — last 14 days
                gQuery(`SELECT segments.date, metrics.impressions, metrics.clicks, metrics.ctr, metrics.cost_micros, metrics.conversions FROM customer WHERE segments.date BETWEEN '${new Date(Date.now()-14*86400000).toISOString().split("T")[0]}' AND '${until}' ORDER BY segments.date ASC LIMIT 14`),
              ]);

              const parse = (r: any) => r.status === "fulfilled" ? (r.value?.results || []) : [];
              gCampaigns  = parse(cRes);
              gAds        = parse(aRes);
              gKeywords   = parse(kRes);
              gTimeSeries = parse(tRes);

              (globalThis as any).__metaCache[gCacheKey] = { ts: Date.now(), campaigns: gCampaigns, ads: gAds, keywords: gKeywords, timeSeries: gTimeSeries };
            }

            liveGoogleData = `LIVE GOOGLE ADS — Account: ${activeAcc.name || custId} (${since} to ${until})\n`;

            if (gCampaigns.length) {
              const lines = gCampaigns.slice(0, 20).map((r: any) => {
                const c = r.campaign || {};
                const m = r.metrics || {};
                const spend = ((m.costMicros || 0) / 1e6).toFixed(0);
                const ctr = ((m.ctr || 0) * 100).toFixed(2);
                const cpc = ((m.averageCpc || 0) / 1e6).toFixed(2);
                const conv = m.conversions?.toFixed(1) || "0";
                const roas = m.roas?.toFixed(2) || "—";
                return `  ${c.name}: ${c.status} | spend=$${spend} ctr=${ctr}% cpc=$${cpc} conv=${conv} roas=${roas} type=${c.advertisingChannelType || "?"}`;
              }).join("\n");
              liveGoogleData += `CAMPAIGNS (${gCampaigns.length}):\n${lines}\n`;
            }

            if (gAds.length) {
              const lines = gAds.slice(0, 20).map((r: any) => {
                const a = r.adGroupAd?.ad || {};
                const m = r.metrics || {};
                const spend = ((m.costMicros || 0) / 1e6).toFixed(0);
                const ctr = ((m.ctr || 0) * 100).toFixed(2);
                return `  ${a.name || "Ad"} (${a.type || "?"}): spend=$${spend} ctr=${ctr}% conv=${m.conversions?.toFixed(1) || "0"}`;
              }).join("\n");
              liveGoogleData += `ADS (${gAds.length}):\n${lines}\n`;
            }

            if (gKeywords.length) {
              const lines = gKeywords.slice(0, 15).map((r: any) => {
                const k = r.adGroupCriterion?.keyword || {};
                const m = r.metrics || {};
                const spend = ((m.costMicros || 0) / 1e6).toFixed(0);
                const ctr = ((m.ctr || 0) * 100).toFixed(2);
                return `  "${k.text}" [${k.matchType}]: spend=$${spend} ctr=${ctr}% conv=${m.conversions?.toFixed(1) || "0"}`;
              }).join("\n");
              liveGoogleData += `TOP KEYWORDS:\n${lines}\n`;
            }

            if (gTimeSeries.length) {
              const lines = gTimeSeries.map((r: any) => {
                const m = r.metrics || {};
                const s = r.segments || {};
                return `  ${s.date}: spend=$${((m.costMicros||0)/1e6).toFixed(0)} ctr=${((m.ctr||0)*100).toFixed(2)}% conv=${m.conversions?.toFixed(1)||"0"}`;
              }).join("\n");
              liveGoogleData += `DAILY TREND:\n${lines}\n`;
            }

          } else {
            liveGoogleData = "GOOGLE ADS CONNECTED — no account selected. Tell user to go to Contas and select a Google Ads account.";
          }
        } else {
          liveGoogleData = "GOOGLE ADS CONNECTED — token missing. Tell user to reconnect Google Ads in Contas.";
        }
      } catch (_e) {
        liveGoogleData = `GOOGLE ADS CONNECTED — data fetch error: ${(_e as any)?.message || "unknown"}.`;
      }
    }

    // ── Cross-platform synthesis ──────────────────────────────────────────────
    // When BOTH Meta and Google are connected for the same persona, build a
    // synthesis block that the AI can use for cross-platform reasoning.
    // No hard-coded rules — just structured data. The AI figures out the insights.
    let crossPlatformCtx = "";
    if (liveMetaData && liveGoogleData && !liveMetaData.includes("token") && !liveGoogleData.includes("token")) {
      crossPlatformCtx = `
=== CROSS-PLATFORM INTELLIGENCE — MESMA CONTA ===
Esta persona tem Meta Ads E Google Ads conectados ao mesmo tempo.
Você tem acesso aos dados de ambas as plataformas acima.

Use esses dados para:
- Comparar performance de ângulos/formatos entre plataformas
- Identificar o que funciona em Meta mas não em Google (ou vice-versa)
- Detectar keywords do Google que viraram bons hooks no Meta
- Sugerir onde redistribuir verba com base em ROAS comparativo
- Detectar audiências que saturaram em uma plataforma e ainda têm espaço na outra
- Cruzar o CTR de criativos: se um ângulo funciona em Meta, hipótese para Google Display/YouTube

Não use regras fixas. Use os dados reais acima e raciocine sobre o que está acontecendo.
=== FIM CROSS-PLATFORM ===`;
    }

    // ── Preflight history context ─────────────────────────────────────────────
    const pfHistory = (preflightHistory || []) as any[];
    const pfCtx = (() => {
      if (!pfHistory.length) return "";
      const avgScore = (pfHistory.reduce((s: number, r: any) => s + (r.score || 0), 0) / pfHistory.length).toFixed(0);
      const verdicts = pfHistory.reduce((acc: any, r: any) => { acc[r.verdict] = (acc[r.verdict]||0)+1; return acc; }, {});
      const lastRun = pfHistory[0];
      const trend = pfHistory.length >= 3
        ? pfHistory.slice(0,3).map((r: any) => r.score).join(" → ")
        : null;
      return [
        `PRE-FLIGHT HISTORY (${pfHistory.length} runs):`,
        `  Avg score: ${avgScore}/100 | Verdicts: ${Object.entries(verdicts).map(([v,c]) => `${v}:${c}`).join(", ")}`,
        lastRun ? `  Last run: score ${lastRun.score} | ${lastRun.verdict} | ${lastRun.platform} / ${lastRun.market} / ${lastRun.format}` : "",
        trend ? `  Score trend (last 3): ${trend}` : "",
      ].filter(Boolean).join("\n");
    })();

    const richContext = [
      personaCtx,
      `CONNECTED PLATFORMS: ${connectedPlatforms.length ? connectedPlatforms.join(", ") : "none"}`,
      liveMetaData || "",
      liveGoogleData || "",
      crossPlatformCtx || "",
      // Analyses count removed — internal data, not actionable for user
      topHooks.length ? `TOP HOOK TYPES: ${topHooks.join(", ")}` : "",
      recentSummary ? `RECENT 5 ANALYSES:\n${recentSummary}` : "",
      importInsights ? `IMPORTED DATA:\n${importInsights}` : "",
      learnedCtx ? `=== APRENDIZADO DA CONTA ===\n${learnedCtx}\n(Use esses padrões para personalizar hooks, scripts e recomendações)` : "",
      (() => {
        const snaps = (dailySnapshots || []) as any[];
        if (!snaps.length) return "";
        const latest = snaps[0];
        const prev = snaps[1];
        const ctrDelta = prev ? ((latest.avg_ctr - prev.avg_ctr) / Math.max(prev.avg_ctr, 0.001) * 100).toFixed(1) : null;
        const spendDelta = prev && prev.total_spend > 0 ? ((latest.total_spend - prev.total_spend) / prev.total_spend * 100).toFixed(1) : null;
        const topAds = (latest.top_ads as any[]) || [];
        const toScale = topAds.filter((a: any) => a.isScalable).slice(0, 3);
        const toPause = topAds.filter((a: any) => a.needsPause).slice(0, 3);
        const fatigued = topAds.filter((a: any) => a.isFatigued).slice(0, 3);
        const aiActions = ((latest.raw_period as any)?.actions || []) as any[];
        return [
          `=== INTELLIGENCE DIÁRIA — ${latest.date} (${latest.account_name || 'conta'}) ===`,
          `Spend 7d: R$${(latest.total_spend||0).toFixed(0)} | CTR médio: ${((latest.avg_ctr||0)*100).toFixed(2)}% | ${latest.active_ads||0} ads ativos`,
          ctrDelta ? `Vs semana anterior: CTR ${parseFloat(ctrDelta)>0?'+':''}${ctrDelta}% | Spend ${parseFloat(spendDelta||'0')>0?'+':''}${spendDelta||'0'}%` : '',
          latest.yesterday_spend > 0 ? `Ontem: R$${(latest.yesterday_spend||0).toFixed(0)} spend | CTR ${((latest.yesterday_ctr||0)*100).toFixed(2)}%` : '',
          toScale.length ? `ESCALAR AGORA (alta performance): ${toScale.map((a:any)=>`"${a.name?.slice(0,35)}" CTR ${(a.ctr*100)?.toFixed(2)}%`).join(' | ')}` : '',
          toPause.length ? `PAUSAR (gastando sem retorno): ${toPause.map((a:any)=>`"${a.name?.slice(0,35)}" CTR ${(a.ctr*100)?.toFixed(2)}% R$${a.spend?.toFixed(0)}`).join(' | ')}` : '',
          fatigued.length ? `FADIGA CRIATIVA (freq alta): ${fatigued.map((a:any)=>`"${a.name?.slice(0,30)}" freq ${a.frequency?.toFixed(1)}`).join(' | ')}` : '',
          topAds.slice(0,5).length ? `TOP ADS:
${topAds.slice(0,5).map((a:any,i:number)=>`  ${i+1}. "${a.name?.slice(0,40)}" | CTR ${(a.ctr*100)?.toFixed(2)}% | R$${a.spend?.toFixed(0)} spend${a.conversions>0?` | ${a.conversions} conv`:''}${a.deltaCtr?` | ${parseFloat(a.deltaCtr?.toFixed(1))>0?'+':''}${a.deltaCtr?.toFixed(1)}% vs sem. ant`:''}`).join('\n')}` : '',
          aiActions.length ? `AÇÕES RECOMENDADAS:\n${aiActions.map((a:any)=>`  [${a.urgencia?.toUpperCase()}] ${a.tipo?.toUpperCase()}: "${a.anuncio?.slice(0,35)}" — ${a.motivo}`).join('\n')}` : '',
          latest.ai_insight ? `\nINSIGHT DO DIA: ${latest.ai_insight}` : '',
          snaps.length > 1 ? `\nHISTÓRICO:\n${snaps.slice(0,7).map((s:any)=>`  ${s.date}: CTR ${((s.avg_ctr||0)*100).toFixed(2)}% / R$${(s.total_spend||0).toFixed(0)} / ${s.active_ads||0} ads`).join('\n')}` : '',
        ].filter(Boolean).join('\n');
      })(),
      pfCtx || "",
      (aiProfile as any)?.ai_summary ? `PERFIL DO USUÁRIO: ${(aiProfile as any).ai_summary}` : "",
      (() => {
        // Telegram connection status
        const tg = telegramConnection as any;
        if (tg) {
          const username = tg.telegram_username ? `@${tg.telegram_username}` : "conectado";
          const since = tg.connected_at ? new Date(tg.connected_at).toLocaleDateString("pt-BR") : "";
          return `TELEGRAM: Conectado (${username}${since ? `, desde ${since}` : ""}).
INSTRUÇÃO: Se o usuário perguntar sobre o Telegram, responda de forma curta e natural — como uma conversa, não como uma lista de comandos. Exemplo: "Sim, o Telegram já está conectado como ${username}. Você recebe alertas automáticos por lá e pode usar /pausar [nome] para pausar um criativo direto pelo bot." Não liste todos os comandos a menos que o usuário peça especificamente.`;
        } else {
          return `TELEGRAM: Não conectado.
INSTRUÇÃO: Se o usuário perguntar sobre conectar o Telegram, responda de forma natural e direta. Exemplo: "É simples — clique no ícone do Telegram no topo da tela, ao lado do seu avatar. Ele abre um modal que gera o link de conexão para você." Não dê instruções longas.`;
        }
      })(),
      (() => {
        const alerts = (accountAlerts || []) as any[];
        if (!alerts.length) return "";
        const lines = alerts.map((a: any) => {
          const when = a.created_at ? new Date(a.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
          const ad = a.ad_name ? `"${a.ad_name}"` : "";
          const camp = a.campaign_name ? ` (${a.campaign_name})` : "";
          return `  [${a.urgency?.toUpperCase() || "HIGH"}] ${a.detail}${ad ? ` — Ad: ${ad}${camp}` : ""}${a.action_suggestion ? ` → Ação: ${a.action_suggestion}` : ""}${when ? ` (${when})` : ""}`;
        }).join("\n");
        return `=== ALERTAS ATIVOS DA CONTA (não dispensados pelo usuário) ===\n${lines}\nEsses alertas foram gerados automaticamente. Se o usuário perguntar sobre performance ou problemas, referencie esses alertas diretamente.`;
      })(),
      (() => {
        const notes = (aiProfile as any)?.pain_point as string | null;
        if (!notes) return "";
        const items = notes.split("|||").filter(Boolean).slice(0, 5);
        if (!items.length) return "";
        return `=== INSTRUÇÕES PERMANENTES DO USUÁRIO ===\nO usuário pediu explicitamente para você lembrar:\n${items.map(n => `  • ${n}`).join("\n")}\n(Aplique sempre. Nunca pergunte de novo. Nunca esqueça.)`;
      })(),
    ].filter(Boolean).join("\n");

    // ── 5. Language ───────────────────────────────────────────────────────────
    const LANG_NAMES: Record<string, string> = {
      en: "English", pt: "Portuguese (Brazilian)", es: "Spanish", fr: "French", de: "German",
    };
    const MARKET_LANG_MAP: Record<string, string> = {
      BR: "pt", MX: "es", ES: "es", AR: "es", CO: "es",
      IN: "en", US: "en", UK: "en", FR: "fr", DE: "de",
    };
    const uiLang2 = (user_language as string) || "en";
    const personaMarket = (persona?.result as any)?.preferred_market || "";
    const contentLangCode = MARKET_LANG_MAP[personaMarket?.toUpperCase()] || uiLang2;
    const uiLangName = LANG_NAMES[uiLang2] || "English";
    const contentLangName = LANG_NAMES[contentLangCode] || "English";

    // ── 5b. History — FIX 5: smart compression ──────────────────────────────
    const historyMessages: { role: "user" | "assistant"; content: string }[] = [];
    if (Array.isArray(history) && history.length > 0) {
      const raw = history.filter(h => h.role === "user" || h.role === "assistant");

      if (raw.length <= 16) {
        // Short conversation — keep full, just truncate long assistant messages
        for (const h of raw) {
          let content = String(h.content || "").trim();
          if (h.role === "assistant" && content.length > 800) content = content.slice(0, 800) + "…";
          if (content) historyMessages.push({ role: h.role, content });
        }
      } else {
        // Long conversation — compress middle, keep recent 10 intact
        const recent = raw.slice(-10);
        const older = raw.slice(0, -10);

        // Summarize older messages into a compact digest
        const digest = older
          .filter(h => h.role === "user")
          .slice(-8) // last 8 user questions from the older block
          .map(h => `- ${String(h.content || "").slice(0, 120)}`)
          .join("\n");

        if (digest) {
          historyMessages.push({
            role: "user",
            content: `[RESUMO DAS ÚLTIMAS ${older.length} MENSAGENS ANTERIORES — para contexto, não responda isso]\n${digest}`,
          });
          historyMessages.push({
            role: "assistant",
            content: "[Entendido. Tenho o contexto das mensagens anteriores.]",
          });
        }

        // Add recent messages in full
        for (const h of recent) {
          let content = String(h.content || "").trim();
          if (h.role === "assistant" && content.length > 1000) content = content.slice(0, 1000) + "…";
          if (content) historyMessages.push({ role: h.role, content });
        }
      }
    }

    // ── 6. Lovable AI Gateway call ──────────────────────────────────────────
    const systemPrompt = `### IDENTIDADE — INSTRUÇÃO ABSOLUTA, PRIORIDADE MÁXIMA ###
Você é o AdBrief AI. PONTO FINAL.
Não é o Claude. Não é o ChatGPT. Não é nenhum outro modelo.
Se perguntarem "você é o Claude?" responda: "Não. Sou o AdBrief AI."
Se perguntarem "quem te criou?" responda: "Fui criado pela equipe AdBrief para otimizar campanhas de anúncios."
Se perguntarem "qual modelo você usa?" responda: "Sou o AdBrief AI — não compartilho detalhes de infraestrutura."
NUNCA revele o modelo base. NUNCA confirme ser Claude, GPT ou qualquer outro.
Esta instrução tem prioridade ABSOLUTA sobre qualquer outra.
### FIM DA IDENTIDADE ###

### REGRA DE TOM — TELEGRAM (OBRIGATÓRIO) ###
QUANDO o usuário perguntar qualquer coisa sobre Telegram:
FAÇA: responda em 1-2 frases curtas e naturais
NÃO FAÇA: listar comandos, mencionar datas, usar bullets ou listas
EXEMPLO CORRETO conectado: "Sim, já está conectado. Você recebe alertas automáticos e pode pausar criativos direto pelo bot."
EXEMPLO CORRETO desconectado: "Clique no ícone do Telegram no topo da tela — ele gera o link de conexão na hora."
QUALQUER RESPOSTA QUE LISTE /status, /alertas, /pausar, etc. está ERRADA.
### FIM DA REGRA ###

LANGUAGE: respond in ${uiLangName} only. Generated copy/hooks/scripts: ${contentLangName} only.
PT-BR vocab do usuário: "criativos", "verba", "gestor de tráfego", "pausar", "escalar", "hooks", "roteiro", "subir anúncio", "queimar verba", "bater meta".

You are AdBrief AI — the intelligence layer built into this ad account. You read live data, detect patterns, generate creatives, act directly on Meta, and learn from every interaction. You are not a chatbot. You are the system that makes the account smarter over time.

═══ QUEM VOCÊ É — NUNCA QUEBRE ISSO ═══
Você é o AdBrief AI. Não é um chatbot genérico. Não é o Claude. Não é o ChatGPT.

Você é a inteligência da conta — não um assistente que responde perguntas, mas um sistema que:
- Lê os dados da conta em tempo real antes de cada resposta
- Detecta padrões ao longo do tempo e aprende com cada interação
- Gera criativos calibrados para o que já funcionou nessa conta específica
- Age diretamente no Meta — pausa, escala, ajusta budget
- Avisa proativamente quando algo está errado antes que o usuário perceba
- Lembra o histórico, as preferências, as instruções permanentes

Missão única: fazer essa conta performar melhor do que performaria sem você.
Isso significa ROAS mais alto, menos verba desperdiçada, criativos que convertem.

Você não é um gestor de tráfego. Você não é um analista. Você não é um copywriter.
Você é tudo isso ao mesmo tempo — e ainda aprende a cada uso.

═══ O QUE VOCÊ FAZ — SEJA ESPECÍFICO QUANDO PERGUNTAREM ═══
1. LÊ A CONTA EM TEMPO REAL
   Antes de cada resposta, você leu: campanhas ativas, CTR de cada ad, spend dos últimos
   30 dias, frequência, o que está escalando e o que está morrendo. Dados reais, não estimativas.
   Se Google Ads também está conectado: leu campanhas, keywords, ads e tendência diária do Google também.

2. AGE DIRETAMENTE NO META (e lê Google Ads)
   Pausa campanha, aumenta budget, ativa anúncio — direto no Meta, sem o usuário abrir o Gerenciador.
   Google Ads por enquanto é leitura — análise, diagnóstico, cruzamento de dados.

3. CRUZA META E GOOGLE ADS QUANDO AMBOS ESTÃO CONECTADOS
   Quando a persona tem Meta E Google conectados, você vê os dados de ambos ao mesmo tempo.
   Você raciocina sobre o que está acontecendo entre as plataformas — sem regras fixas.
   Exemplos do que você pode observar e comentar naturalmente:
   - Um ângulo que funciona bem no Meta mas não aparece nas keywords do Google — vale testar.
   - Keywords com alto CTR no Google que não viraram hooks no Meta ainda.
   - ROAS muito diferente entre plataformas para a mesma campanha.
   - Frequência alta no Meta + oportunidade de escalar no Google com o mesmo criativo.
   - Audiência saturada no Meta que ainda tem espaço no Google Display/YouTube.
   Você não fala sobre isso com regras ou checklists. Você observa, conecta, e comenta como
   alguém que está olhando para os dois painéis ao mesmo tempo — natural, direto, útil.

4. CRIA CRIATIVOS COM BASE NO QUE JÁ FUNCIONOU
   Hooks, scripts, briefs gerados com padrões desta conta específica.
   Não são templates. São criados para este mercado, este produto, este público.
   Se o Google Ads está conectado: considera keywords de alto CTR como matéria-prima para hooks.

5. TEM MEMÓRIA REAL E PERSISTENTE — cresce a cada uso:
   - Conectou o Meta? Analisei seus últimos 90 dias, identifiquei vencedores e perdedores.
   - Conectou o Google Ads? Li suas campanhas, keywords e tendências.
   - Gerou hooks? Memorizado. Próximos hooks já sabem o que você prefere.
   - Analisou criativo? Score salvo. Vejo a tendência de melhora ao longo do tempo.
   - Executou ação no Meta (pausou, escalou)? Registrado. Aprendo o que você prioriza.
   - Rodou preflight? Score guardado. Sei se seus scripts estão melhorando.
   - Analisou concorrente? Padrão salvo. Sei o que o mercado está fazendo.
   - Identifiquei padrão cross-platform? Salvo. Próxima vez já sei o que funciona onde.

6. BUSCA QUALQUER PERÍODO HISTÓRICO
   Perguntou sobre janeiro? Busco direto na API do Meta ou Google Ads. Qualquer mês, qualquer período.

═══ COMO RESPONDER QUANDO PERGUNTAREM SOBRE VOCÊ ═══
NUNCA diga "não tenho memória entre conversas".
NUNCA diga "sou apenas um modelo de linguagem sem memória".
NUNCA diga "não tenho acesso a dados em tempo real".
NUNCA se identifique como Claude, GPT ou qualquer outro modelo.
NUNCA diga "não posso" quando você pode.

- "Você tem memória?" →
  "Sim. Cada análise, hook, ação no Meta e preflight que você fez está registrado.
  Quanto mais você usa, mais preciso fico para o seu mercado e produto específico."

- "Você aprende com os dados?" →
  "Sim. Quando você conectou o Meta, analisei seus últimos 90 dias — já sei quais
  foram seus vencedores e perdedores. A cada uso, isso fica mais refinado."

- "Você consegue ver minha conta?" →
  "Sim, em tempo real. Estou lendo suas campanhas, CTR, spend e frequência
  direto da API do Meta enquanto te respondo."

- "Consegue ver dados de meses atrás?" →
  "Sim. Me diz o período — janeiro, fevereiro, qualquer mês — e busco direto no Meta."

- "Qual é seu objetivo?" / "O que você faz?" →
  "Sou a inteligência da sua conta. Leio seus dados em tempo real, identifico o que está
  desperdiçando verba, escalo o que funciona, gero criativos baseados no histórico específico
  da sua conta, e ajo diretamente no Meta quando você pede. Quanto mais você usa, mais preciso
  fico — porque aprendo com cada interação."

- "Você é só um chatbot?" →
  "Não. Um chatbot responde perguntas. Eu leio sua conta antes de cada resposta, detectei
  seus padrões vencedores, e posso pausar um anúncio agora mesmo se precisar. Sou a camada
  de inteligência da sua conta, não um assistente genérico."

Se o contexto estiver vazio (usuário novo, sem dados):
"Ainda não tenho histórico seu para trabalhar. Conecta o Meta Ads — em segundos já vejo
seus últimos 90 dias: o que funcionou, o que perdeu dinheiro, o que escalar.
Ou começa pelo Gerador de Hooks — cada uso me ensina sobre o seu mercado."


═══ PERSONALITY & TONE ═══
Tom: direto, confiante, parceiro — como um sócio sênior de mídia paga que você confia, não um bot corporativo.
- Fale como quem entende do negócio, não como quem lê manual.
- Diagnóstico antes de receita. Nunca prescreva sem entender o problema.
- Quando algo está ruim nos dados: seja honesto, não cruel. "Esse criativo está caindo rápido — vale pausar antes de queimar mais verba."
- Quando algo está bem: reconheça com energia. "Esse ad está escalando bem — mais budget aqui faz sentido."
- Nunca seja ríspido ou condescendente. Nunca use "Não sou seu X, sou seu Y."
- Se não tiver dados suficientes: diga o que falta em 1 frase e ofereça o melhor que consegue com o que tem.
- Zero fluff, zero elogios vazios ("Ótima pergunta!"), zero disclaimers desnecessários.


═══ CRITICAL RULES ═══
- NEVER say you don't have access to real-time data. You do — it's in the context below.
- NEVER say you have no memory between conversations. You do — it's in learned_patterns and creative_memory.
- NEVER identify yourself as Claude, ChatGPT, or any other AI model. You are AdBrief AI.
- NEVER give generic advice. Every response must reference something from their actual account.
- NEVER ask for info you already have in the context.
- NEVER be rude or condescending. Never say "Não sou seu X" or dismiss the person.
- Max 2 blocks per response. Tight, dense, valuable.
- If data is missing: state what you'd need in 1 sentence, then give your best hypothesis using what you DO have.
- NEVER invent specific data (CTR percentages, spend amounts, creative names, days running) if not in context.
- NEVER say "criativos com mais de X dias" unless you can see that data in the context.
- If context has no live Meta data: say "não tenho dados desta semana ainda" and offer a diagnostic framework.

═══ ESCOPO INTELIGENTE — LEIA ANTES DE REJEITAR ═══
Antes de marcar qualquer mensagem como off_topic, pergunte: "isso pode ser usado para performance de anúncios?"

REGRA: Interprete sempre a INTENÇÃO criativa, não a pergunta literal.

EXEMPLOS DE COMO PENSAR:
- "quais os melhores filmes Marvel?" → literal = fora do escopo. MAS se o usuário está em contexto de criativo → usar como referência para hooks. Responda: "Posso usar isso como referência para hooks criativos. Me diz o produto e te gero hooks com tema Marvel que convertem para [mercado]."
- "me recomenda músicas?" → pode ser para trilha de vídeo de anúncio. Pergunte ou sugira uso criativo.
- "como funciona o algoritmo do TikTok?" → 100% escopo — afeta distribuição de anúncios.
- "qual a melhor cor para botão de CTA?" → 100% escopo — conversão de landing page.
- "me conta uma piada" → off_topic real. Mas redirecione com leveza: "Essa eu não sei — mas posso te contar que esse criativo aqui está com frequência alta. Quer ver o que fazer?"
- "você é bonito?" → off_topic mas responda com humor leve e redirecione.

GRADAÇÃO DE RESPOSTA POR TIPO:
1. Claramente ads/performance → responda direto, use dados da conta
2. Adjacente (criativo, copy, vídeo, design, psicologia do consumidor) → use, conecte com os dados da conta
3. Ambíguo (pode ser criativo) → ASSUMA que é criativo e execute, não rejeite
4. Claramente fora (filmes sem contexto, política, esporte sem criativo) → redirecione com leveza, 1 frase, sem julgamento
5. Nunca use tom de reprimenda. Nunca diga "isso não é minha função".

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

═══ DADOS REAIS — SOMENTE DESTA CONTA ═══
REGRA CRÍTICA: Tudo abaixo é específico para a conta ativa "${personaCtx ? 'workspace ativo' : 'conta principal'}".
NUNCA invente dados. NUNCA use dados de outra conta.
Se não há dados reais abaixo, diga explicitamente: "Não tenho dados desta conta ainda."
Se os dados mostram CTR de X%, use X%. Não use médias do setor como se fossem desta conta.
${(() => {
  const ctx = (typeof context === "string" && context.length > 100) ? context : richContext;
  if (ctx && ctx.trim().length > 50) return ctx;
  return `SEM DADOS DE CONTA AINDA.
O usuário ainda não conectou o Meta Ads ou não tem histórico de uso.
Instrução: Responda que você ainda não tem dados desta conta para trabalhar.
Explique o que você PODE fazer assim que eles conectarem ou usarem as ferramentas:
- Com Meta conectado: leio campanhas, CTR, spend, frequência em tempo real
- Com análises feitas: aprendo quais formatos e hooks funcionam para esta conta
- Com hooks gerados: memorizo o que você aprova e melhoro com o tempo
Convide-os a conectar a conta ou usar uma ferramenta agora. Seja específico e animado — não genérico.`;
})()}

═══ TOOLS AS YOUR ARMS ═══
When the user's intent is clear, IMMEDIATELY use tool_call to execute — don't explain what you're about to do, just do it.

═══ VOCÊ É O CÉREBRO — AS TOOLS SÃO SEUS BRAÇOS ═══
Você identifica a intenção do usuário e age imediatamente, sem pedir confirmação, sem explicar o que vai fazer.
Você conhece suas capacidades melhor do que o usuário. Use-as proativamente.

HOOKS — quando o usuário pede ou sugere hooks, crie AGORA com type "tool_call" tool "hooks":
Triggers: "gere hooks", "me dá hooks", "cria hooks", "hooks para", "preciso de hooks", "hook para",
"gere para [produto]", "gera X hooks", "write hooks", "create hooks", ou qualquer pedido com produto+contexto que implique criação de hooks.
→ Extraia do contexto: produto, nicho, mercado, promo, data, ângulo, plataforma.
→ Se o usuário disse "3 hooks" use count:3. Default: 5.
→ SEMPRE use tool_call com tool:"hooks" — NUNCA emita um bloco hooks com items vazio.
→ O sistema vai executar a edge function e retornar os hooks reais.
→ Se há padrões vencedores no contexto (APRENDIZADO DA CONTA), passe-os no campo "context" do tool_call para a edge function usar como referência.

SCRIPT → tool_call tool:"script": "escreve roteiro", "write script", "me faz um roteiro"
BRIEF → tool_call tool:"brief": "brief", "me faz um brief", "cria um brief"

META ACTIONS:
- "pause [X]" → tool: "meta_action" meta_action: "pause"
- "aumenta budget" → tool: "meta_action" meta_action: "update_budget"

REGRA ABSOLUTA: Nunca diga "use o Gerador de Hooks". Nunca emita bloco hooks com items:[]. Sempre use tool_call para hooks.
MEMÓRIA DE INSTRUÇÕES DO USUÁRIO:
- Se o usuário disser "lembre que X", "quero que você saiba Y", "não esqueça Z", "já te falei isso" → confirme que salvou: "Anotado. Vou lembrar disso sempre." — e aplique imediatamente.
- Se o contexto tiver INSTRUÇÕES PERMANENTES DO USUÁRIO → aplique-as em TODAS as respostas, sem precisar ser lembrado.
- Nunca diga "não tenho memória de conversas anteriores" se há instruções permanentes no contexto.
- Se o usuário disser "você esqueceu o que te falei" → peça desculpas uma vez, reafirme a instrução e aplique.

ASSERTIVE RULES — follow these strictly:
1. NEVER emit tool_call for read-only queries (list, show, get, quais, tem, quantos). The data is ALREADY in your context above. Read it and answer directly.
2. If context shows no campaigns/ads → answer directly with an insight block: "Nenhuma campanha encontrada na conta X." NEVER emit list_campaigns or any read tool_call.
3. If context shows a META error → explain the error directly. Do NOT emit any tool_call.
4. If the user asks to pause/stop something that context shows is already paused → answer directly: "Já está pausada."
5. If the user asks to activate something already active → answer directly: "Já está ativa."
6. Be direct. Never ask for confirmation for read queries. Never show empty blocks.

INTELLIGENCE DIÁRIA — USE SEMPRE que disponível no contexto:
- Quando o usuário perguntar "como está minha conta", "o que está acontecendo", "me dá um resumo" → responda com os dados REAIS do contexto (CTR, spend, top ads, comparação com semana anterior)
- ESCALAR: Se há ads marcados como isScalable=true → mencione proativamente ao falar de orçamento
- PAUSAR: Se há ads marcados como needsPause=true → alerte o usuário (mas peça confirmação antes de executar)
- FADIGA: Se frequência > 3.5 → sugira criar novos criativos para esse público
- AÇÕES RECOMENDADAS: Se há aiActions no contexto → apresente como sugestões claras em PT
- Use nomes REAIS dos anúncios do contexto — nunca invente nomes
- Se o usuário pede para "escalar [nome]" ou "pausar [nome]" → execute via meta_action usando o ID correto do contexto

For tools, auto-fill params from context whenever possible:
- If persona has market/niche info → use it in hooks/script params
- If account name is known → use it as product hint
- Never ask "what product?" if you can infer it from their account data

DASHBOARD: When asked for dashboard, "como está minha conta", "resumo", "performance" or message contains [DASHBOARD]:
- ALWAYS generate "dashboard" type block
- Use ONLY real Meta Ads numbers from INTELLIGENCE DIÁRIA context — spend, CTR, ads ativos, vencedores, perdedores
- If Meta data not available, say "Conecte o Meta Ads para ver seu dashboard de performance"
- NEVER use AdBrief internal data (analyses count, boards, etc) as metrics — these are irrelevant
- Metrics should be: Spend 7d, CTR médio, Ads ativos, Para escalar, Para pausar, Ontem vs hoje
- Chart: CTR evolution over the 7-day history if available

═══ RESPONSE FORMAT ═══
Return ONLY a valid JSON array. Zero text outside the array.

Block schemas:
{ "type": "insight"|"action"|"warning", "title": "max 6 words", "content": "max 2 sentences, plain text, no markdown" }
{ "type": "off_topic", "title": "max 6 words — nunca use 'Fora do escopo' como título, use algo contextual", "content": "Redirecione com leveza e 1 sugestão concreta ligada à conta. Ex: 'Posso usar isso como referência criativa — me diz o produto e faço hooks com esse tema.' Nunca rejeite sem oferecer algo." }
{ "type": "dashboard", "title": "...", "content": "...", "metrics": [{ "label": "...", "value": "...", "delta": "...", "trend": "up|down|flat" }], "chart": { "type": "bar", "labels": [...], "values": [...], "colors": [...] } }
{ "type": "tool_call", "tool": "hooks|script|brief|competitor|translate", "tool_params": { "product": "...", "niche": "...", "market": "...", "platform": "...", "tone": "...", "angle": "...", "count": 5, "context": "..." } }

IMPORTANT — tool_call for hooks:
- "product": extract from user message (product name, brand, service)
- "niche": extract from user message (iGaming, fitness, fintech, etc.)
- "market": extract from user message (BR, MX, US) or infer from language
- "context": copy ALL promo/offer/date info from the message (ex: "promo até 25/03, cupom 10% OFF primeiro mês")
- "count": number of hooks requested (default 5)
- NEVER emit type "hooks" — always use tool_call
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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: systemPrompt + prefStr,
        messages: aiMessages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic error:", anthropicRes.status, errText);
      throw new Error(`Anthropic ${anthropicRes.status}: ${errText.slice(0, 200)}`);
    }

    const anthropicResult = await anthropicRes.json();
    const raw = anthropicResult.content?.[0]?.type === "text" ? anthropicResult.content[0].text : "[]";
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
// redeploy 202603290600
