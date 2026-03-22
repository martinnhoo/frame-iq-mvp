// adbrief-ai-chat v11 — Anthropic Claude via direct API
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
      const dashUsed = (profile as any)?.dashboard_count || 0;
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
      const dashUsed = (profile as any)?.dashboard_count || 0;
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
    ] = await Promise.all([
      // 1. Recent analyses — last 15, full result for context
      supabase.from("analyses")
        .select("id, created_at, title, result, hook_strength, status, improvement_suggestions")
        .eq("user_id", user_id).eq("status", "completed")
        .order("created_at", { ascending: false }).limit(15),
      // 2. AI profile
      supabase.from("user_ai_profile" as any)
        .select("*").eq("user_id" as any, user_id).maybeSingle(),
      // 3. Creative memory
      supabase.from("creative_memory" as any)
        .select("hook_type, hook_score, platform, notes, created_at" as any)
        .eq("user_id" as any, user_id)
        .order("created_at" as any, { ascending: false }).limit(20),
      // 4. Platform connections (persona-scoped)
      supabase.from("platform_connections" as any)
        .select("platform, status, ad_accounts, selected_account_id, connected_at")
        .eq("user_id", user_id).eq("status", "active")
        .then(async (r: any) => {
          if (r.error?.code === "42P01") return { data: [], error: null };
          const all = r.data || [];
          if (persona_id) {
            const specific = all.filter((c: any) => c.persona_id === persona_id);
            const global = all.filter((c: any) => c.persona_id === null);
            const merged: any[] = [...specific];
            global.forEach((g: any) => {
              if (!merged.find((s: any) => s.platform === g.platform)) merged.push(g);
            });
            return { data: merged };
          }
          return { data: all.filter((c: any) => c.persona_id === null || !c.persona_id) };
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
      // 7. Learned patterns — WAS MISSING QUERY — winners + perf + competitor patterns
      (supabase as any).from("learned_patterns")
        .select("pattern_key, is_winner, avg_ctr, avg_roas, confidence, insight_text, variables")
        .eq("user_id", user_id)
        .order("confidence", { ascending: false })
        .limit(30),
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

    // Learned patterns — what the product knows about this user
    const patterns = (learnedPatterns || []) as any[];
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
        const tokenRow = (persona_id && allC.find((c: any) => c.persona_id === persona_id))
          || allC.find((c: any) => !c.persona_id)
          || allC[0] || null;

        if (tokenRow?.access_token) {
          const token = tokenRow.access_token;
          const accs = (tokenRow.ad_accounts as any[]) || [];
          const selId = tokenRow.selected_account_id;
          const activeAcc = (selId && accs.find((a: any) => a.id === selId)) || accs[0];

          if (activeAcc?.id) {
            // Use historical range if detected, otherwise default 30 days
            const since = historicalSince || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split("T")[0];
            const until = historicalUntil || new Date().toISOString().split("T")[0];
            const fields = "campaign_name,adset_name,ad_name,spend,impressions,clicks,ctr,cpm,cpc,actions,video_play_actions,frequency,reach";

            const [adsRes, campaignsRes] = await Promise.allSettled([
              fetch(`https://graph.facebook.com/v19.0/${activeAcc.id}/insights?level=ad&fields=${fields}&time_range={"since":"${since}","until":"${until}"}&sort=spend_descending&limit=20&access_token=${token}`),
              fetch(`https://graph.facebook.com/v19.0/${activeAcc.id}/campaigns?fields=name,status,daily_budget,lifetime_budget,objective&limit=20&access_token=${token}`),
            ]);

            const adsRaw = adsRes.status === "fulfilled" ? await adsRes.value.json() : null;
            const campsRaw = campaignsRes.status === "fulfilled" ? await campaignsRes.value.json() : null;

            liveMetaData = `${historicalSince ? "HISTORICAL" : "LIVE"} META ADS — Account: ${activeAcc.name || activeAcc.id} (${since} to ${until})${historicalSince ? " [período solicitado]" : ""}\n`;

            if (campsRaw?.error) {
              const isExpired = campsRaw.error.code === 190 || String(campsRaw.error.type||"").includes("OAuthException");
              if (isExpired) {
                liveMetaData += `CAMPAIGNS: Token expirado — peça ao usuário para reconectar o Meta Ads em Contas. NÃO emita tool_call.\n`;
              } else {
                liveMetaData += `CAMPAIGNS: Error — ${campsRaw.error.message}. Answer based on this error, do NOT emit list_campaigns tool_call.\n`;
              }
            } else if (campsRaw?.data?.length) {
              const lines = campsRaw.data.slice(0, 15).map((c: any) =>
                `  ${c.name}: status=${c.status} budget=${c.daily_budget ? `$${(parseInt(c.daily_budget)/100).toFixed(0)}/day` : c.lifetime_budget ? `$${(parseInt(c.lifetime_budget)/100).toFixed(0)} total` : "no budget set"} objective=${c.objective}`
              ).join("\n");
              liveMetaData += `CAMPAIGNS (${campsRaw.data.length} found):\n${lines}\n`;
            } else {
              liveMetaData += `CAMPAIGNS: Nenhuma campanha encontrada nesta conta. Respond directly with this fact.\n`;
            }

            if (adsRaw?.error) {
              // Detect token expiry (Meta error 190) and surface clearly
              const isExpired = adsRaw.error.code === 190 || String(adsRaw.error.message||"").toLowerCase().includes("token") || String(adsRaw.error.type||"").includes("OAuthException");
              if (isExpired) {
                liveMetaData += `ADS: Token expirado — diga ao usuário para reconectar o Meta Ads em Contas.\n`;
              } else {
                liveMetaData += `ADS: Erro ao buscar dados — ${adsRaw.error.message}\n`;
              }
            } else if (adsRaw?.data?.length) {
              const adLines = adsRaw.data.slice(0, 10).map((ad: any) => {
                const purchases = ad.actions?.find((a: any) => a.action_type === "purchase")?.value || "0";
                const hookRate = ad.video_play_actions?.find((a: any) => a.action_type === "video_play")?.value;
                return `  ${ad.ad_name}: spend=$${parseFloat(ad.spend||0).toFixed(0)} ctr=${ad.ctr}% cpm=$${parseFloat(ad.cpm||0).toFixed(1)} cpc=$${parseFloat(ad.cpc||0).toFixed(2)} freq=${ad.frequency||"?"} purchases=${purchases}${hookRate?` hook_rate=${((parseInt(hookRate)/parseInt(ad.impressions||1))*100).toFixed(1)}%`:""}`;
              }).join("\n");
              liveMetaData += `AD PERFORMANCE (top by spend):\n${adLines}\n`;
            } else {
              liveMetaData += `ADS: Nenhum gasto de anúncio nos últimos 30 dias.\n`;
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
      (aiProfile as any)?.ai_summary ? `AI PROFILE: ${(aiProfile as any).ai_summary}` : "",
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

    // ── 5b. History ─────────────────────────────────────────────────────────
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

    // ── 6. Lovable AI Gateway call ──────────────────────────────────────────
    const systemPrompt = `LANGUAGE: respond in ${uiLangName} only. Generated copy/hooks/scripts: ${contentLangName} only.
PT-BR vocab: "criativos", "verba", "gestor de tráfego", "pausar", "escalar", "hooks", "roteiro".

You are AdBrief AI — a senior performance marketer with 10+ years running Meta Ads, embedded directly inside this ad account. You think fast, speak plain, and act like the best strategist they've ever had on their team.

═══ QUEM VOCÊ É — NUNCA QUEBRE ISSO ═══
Você é o AdBrief AI. Não é um chatbot genérico. Não é o Claude. Não é o ChatGPT.
Você é a inteligência central do AdBrief — um produto com uma única missão:
FAZER OS CLIENTES GANHAREM MAIS DINHEIRO COM ANÚNCIOS.

Não é sobre relatórios bonitos. Não é sobre insights acadêmicos.
É sobre resultado concreto: mais conversões, menor CPM, criativos que funcionam, dinheiro que entra.

Você é o melhor estrategista de performance que eles já tiveram — embedded dentro da conta deles,
disponível 24/7, que leu cada número, cada criativo, cada padrão. Pensa rápido, fala direto, age.

═══ O QUE VOCÊ FAZ — SEJA ESPECÍFICO QUANDO PERGUNTAREM ═══
1. LÊ A CONTA EM TEMPO REAL
   Antes de cada resposta, você leu: campanhas ativas, CTR de cada ad, spend dos últimos
   30 dias, frequência, o que está escalando e o que está morrendo. Dados reais, não estimativas.

2. AGE DIRETAMENTE NO META
   Pausa campanha, aumenta budget, ativa anúncio — direto, sem o usuário abrir o Gerenciador.

3. CRIA CRIATIVOS COM BASE NO QUE JÁ FUNCIONOU
   Hooks, scripts, briefs gerados com padrões desta conta específica.
   Não são templates. São criados para este mercado, este produto, este público.

4. TEM MEMÓRIA REAL E PERSISTENTE — cresce a cada uso:
   - Conectou o Meta? Analisei seus últimos 90 dias, identifiquei vencedores e perdedores.
   - Gerou hooks? Memorizado. Próximos hooks já sabem o que você prefere.
   - Analisou criativo? Score salvo. Vejo a tendência de melhora ao longo do tempo.
   - Executou ação no Meta (pausou, escalou)? Registrado. Aprendo o que você prioriza.
   - Rodou preflight? Score guardado. Sei se seus scripts estão melhorando.
   - Analisou concorrente? Padrão salvo. Sei o que o mercado está fazendo.

5. BUSCA QUALQUER PERÍODO HISTÓRICO
   Perguntou sobre janeiro? Busco direto na API do Meta. Qualquer mês, qualquer período.

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

- "Qual é seu objetivo?" →
  "Fazer você ganhar mais dinheiro com anúncios. Identificar o que está desperdiçando
  budget agora, escalar o que funciona, e criar criativos baseados no que JÁ funcionou
  na sua conta. Não teoria — dados reais da sua conta."

Se o contexto estiver vazio (usuário novo, sem dados):
"Ainda não tenho histórico seu para trabalhar. Conecta o Meta Ads — em segundos já vejo
seus últimos 90 dias: o que funcionou, o que perdeu dinheiro, o que escalar.
Ou começa pelo Gerador de Hooks — cada uso me ensina sobre o seu mercado."


═══ PERSONALITY & TONE ═══
- Direct, confident, zero fluff. You diagnose before you prescribe.
- Never hedge with "it could be" — say what it is. If uncertain, say "likely X, because Y."
- Sound like a trusted advisor texting a friend who runs ads, not a chatbot reading docs.
- When data confirms something bad: be blunt. "This creative is dying. Pause it today."
- When data shows opportunity: be excited. "This audience is underbudgeted — $200 more here = $800 back."

═══ CRITICAL RULES ═══
- NEVER say you don't have access to real-time data. You do — it's in the context below.
- NEVER say you have no memory between conversations. You do — it's in learned_patterns and creative_memory.
- NEVER identify yourself as Claude, ChatGPT, or any other AI model. You are AdBrief AI.
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
{ "type": "insight"|"action"|"warning"|"off_topic", "title": "max 6 words", "content": "max 2 sentences, plain text, no markdown" }
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
// redeploy 202603262345
