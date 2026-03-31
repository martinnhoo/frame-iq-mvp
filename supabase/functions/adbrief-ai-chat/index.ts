// adbrief-ai-chat v14 — Google Ads live data + cross-platform intelligence + persona_id scoped
import { createClient } from "npm:@supabase/supabase-js@2";
import { getEffectivePlan } from "../_shared/plans.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { message, context, user_id, persona_id, history, user_language, user_prefs, panel_data } = body;

    // ── Auth check — runs first for ALL modes including panel_data ────────────
    const sbAuth = createClient(Deno.env.get("SUPABASE_URL")??"", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"");
    const authHeaderEarly = req.headers.get("Authorization");
    if (authHeaderEarly?.startsWith("Bearer ")) {
      const earlyToken = authHeaderEarly.slice(7);
      const { data: { user: earlyUser }, error: earlyAuthError } = await sbAuth.auth.getUser(earlyToken);
      if (earlyAuthError || !earlyUser || earlyUser.id !== user_id) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (user_id) {
      // No auth header at all — reject
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate persona_id belongs to this user (prevents cross-account access) ──
    if (persona_id && user_id) {
      const { data: personaCheck } = await sbAuth
        .from("personas")
        .select("id")
        .eq("id", persona_id)
        .eq("user_id", user_id)
        .maybeSingle();
      if (!personaCheck) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Panel Data mode — skip Claude, return structured ad data for LivePanel ──
    if (panel_data && user_id && persona_id) {
      const sbPanel = sbAuth;
      const platforms: string[] = body.platforms || [];
      const result: Record<string, any> = {};
      const today = new Date().toISOString().split("T")[0];
      const since = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0];

      // Meta Ads
      if (platforms.includes("meta")) {
        const { data: mc } = await sbPanel.from("platform_connections" as any)
          .select("access_token, ad_accounts, selected_account_id")
          .eq("user_id", user_id).eq("persona_id", persona_id).eq("platform", "meta").eq("status", "active").maybeSingle();
        if (mc?.access_token) {
          const token = mc.access_token;
          const acc = (mc.ad_accounts||[]).find((a:any)=>a.id===mc.selected_account_id)||(mc.ad_accounts||[])[0];
          if (acc) {
            const fields = "campaign_name,adset_name,ad_name,spend,impressions,clicks,ctr,cpm,cpc,actions,video_play_actions,frequency,reach";
            const [r1,r2,r3] = await Promise.allSettled([
              fetch(`https://graph.facebook.com/v21.0/${acc.id}/insights?level=ad&fields=${fields}&time_range={"since":"${since}","until":"${today}"}&sort=spend_descending&limit=30&access_token=${token}`),
              fetch(`https://graph.facebook.com/v21.0/${acc.id}/campaigns?fields=name,status,daily_budget,lifetime_budget,objective,effective_status&limit=20&access_token=${token}`),
              fetch(`https://graph.facebook.com/v21.0/${acc.id}/insights?fields=spend,impressions,clicks,ctr,cpm&time_range={"since":"${since}","until":"${today}"}&time_increment=1&limit=14&access_token=${token}`),
            ]);
            const ads   = r1.status==="fulfilled"?await r1.value.json():null;
            const camps = r2.status==="fulfilled"?await r2.value.json():null;
            const ts    = r3.status==="fulfilled"?await r3.value.json():null;
            if (ads?.error?.code===190||camps?.error?.code===190) {
              result.meta = { error: "token_expired", account_name: acc.name||acc.id };
            } else {
              const adsData: any[] = ads?.data||[];
              const totalSpend = adsData.reduce((s:number,a:any)=>s+parseFloat(a.spend||0),0);
              const totalImpr  = adsData.reduce((s:number,a:any)=>s+parseInt(a.impressions||0),0);
              const totalClicks= adsData.reduce((s:number,a:any)=>s+parseInt(a.clicks||0),0);
              const avgCTR = totalImpr>0?(totalClicks/totalImpr*100):0;
              const avgCPM = totalImpr>0?(totalSpend/totalImpr*1000):0;
              const avgFreq= adsData.length>0?adsData.reduce((s:number,a:any)=>s+parseFloat(a.frequency||0),0)/adsData.length:0;
              const totalConv = adsData.reduce((s:number,a:any)=>{
                const p=parseFloat(a.actions?.find((x:any)=>x.action_type==="purchase")?.value||0);
                const l=parseFloat(a.actions?.find((x:any)=>x.action_type==="lead")?.value||0);
                return s+p+l;
              },0);
              const enriched = adsData.map((a:any)=>{
                const spend=parseFloat(a.spend||0),ctr=parseFloat(a.ctr||0)*100,freq=parseFloat(a.frequency||0);
                const hookRate=()=>{const plays=a.video_play_actions?.find((x:any)=>x.action_type==="video_play")?.value;const impr=parseInt(a.impressions||0);return plays&&impr?parseFloat(plays)/impr*100:null;};
                return {name:a.ad_name,campaign:a.campaign_name,spend,ctr,cpm:parseFloat(a.cpm||0),freq,hookRate:hookRate(),
                  conv:parseFloat(a.actions?.find((x:any)=>x.action_type==="purchase")?.value||a.actions?.find((x:any)=>x.action_type==="lead")?.value||0),
                  isRisk:freq>3.5||(ctr<0.5&&spend>20),isWinner:ctr>1.5&&freq<3&&spend>5};
              }).sort((a:any,b:any)=>b.spend-a.spend);
              result.meta = {
                account_name: acc.name||acc.id, period: `${since} → ${today}`,
                kpis: { spend:totalSpend.toFixed(2), ctr:avgCTR.toFixed(2), cpm:avgCPM.toFixed(2), frequency:avgFreq.toFixed(1), conversions:totalConv.toFixed(0), active_ads:adsData.length },
                winners: enriched.filter((a:any)=>a.isWinner).slice(0,5),
                at_risk:  enriched.filter((a:any)=>a.isRisk).slice(0,5),
                top_ads:  enriched.slice(0,10),
                campaigns: (camps?.data||[]).slice(0,10).map((c:any)=>({
                  name:c.name, status:c.effective_status||c.status,
                  budget:c.daily_budget?`R$${(parseInt(c.daily_budget)/100).toFixed(0)}/dia`:c.lifetime_budget?`R$${(parseInt(c.lifetime_budget)/100).toFixed(0)} total`:"—",
                  objective:c.objective
                })),
                time_series: (ts?.data||[]).filter((d:any)=>parseFloat(d.spend||0)>0).map((d:any)=>({
                  date:d.date_start, spend:parseFloat(d.spend||0), ctr:parseFloat(d.ctr||0)*100, cpm:parseFloat(d.cpm||0)
                })),
              };
            }
          } else { result.meta = { error: "no_account_selected" }; }
        } else { result.meta = { error: "not_connected" }; }
      }

      // Google Ads
      if (platforms.includes("google")) {
        const { data: gc } = await sbPanel.from("platform_connections" as any)
          .select("access_token, refresh_token, expires_at, ad_accounts, selected_account_id")
          .eq("user_id", user_id).eq("persona_id", persona_id).eq("platform", "google").eq("status", "active").maybeSingle();
        if (gc?.access_token) {
          let token = gc.access_token;
          if (gc.expires_at && new Date(gc.expires_at)<new Date()) {
            const rr = await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:Deno.env.get("GOOGLE_CLIENT_ID")??"",client_secret:Deno.env.get("GOOGLE_CLIENT_SECRET")??"",refresh_token:gc.refresh_token??"",grant_type:"refresh_token"})});
            const rd = await rr.json();
            if (rd.access_token) { token = rd.access_token; await sbPanel.from("platform_connections" as any).update({access_token:token,expires_at:new Date(Date.now()+(rd.expires_in||3600)*1000).toISOString()}).eq("user_id",user_id).eq("persona_id",persona_id).eq("platform","google"); }
          }
          const acc = (gc.ad_accounts||[]).find((a:any)=>a.id===gc.selected_account_id)||(gc.ad_accounts||[])[0];
          if (acc) {
            const custId = acc.id.replace(/-/g,"");
            const hdr = {"Authorization":`Bearer ${token}`,"Content-Type":"application/json","developer-token":Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")??"","login-customer-id":custId};
            const gq = (q:string)=>fetch(`https://googleads.googleapis.com/v19/customers/${custId}/googleAds:search`,{method:"POST",headers:hdr,body:JSON.stringify({query:q})}).then(r=>r.json());
            const [cr,ar,tr] = await Promise.allSettled([
              gq(`SELECT campaign.name,campaign.status,campaign.advertising_channel_type,metrics.impressions,metrics.clicks,metrics.ctr,metrics.average_cpc,metrics.cost_micros,metrics.conversions FROM campaign WHERE segments.date BETWEEN '${since}' AND '${today}' AND campaign.status!='REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 20`),
              gq(`SELECT ad_group_ad.ad.name,ad_group_ad.ad.type,campaign.name,metrics.impressions,metrics.clicks,metrics.ctr,metrics.cost_micros,metrics.conversions FROM ad_group_ad WHERE segments.date BETWEEN '${since}' AND '${today}' AND ad_group_ad.status!='REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 20`),
              gq(`SELECT segments.date,metrics.impressions,metrics.clicks,metrics.ctr,metrics.cost_micros,metrics.conversions FROM customer WHERE segments.date BETWEEN '${since}' AND '${today}' ORDER BY segments.date ASC LIMIT 14`),
            ]);
            const parse=(r:any)=>r.status==="fulfilled"?(r.value?.results||[]):[];
            const gcs=parse(cr),gas=parse(ar),gts=parse(tr);
            const totSpend=gcs.reduce((s:number,r:any)=>s+((r.metrics?.costMicros||0)/1e6),0);
            const totConv=gcs.reduce((s:number,r:any)=>s+(r.metrics?.conversions||0),0);
            const totClk=gcs.reduce((s:number,r:any)=>s+(r.metrics?.clicks||0),0);
            const totImpr=gcs.reduce((s:number,r:any)=>s+(r.metrics?.impressions||0),0);
            result.google = {
              account_name:acc.name||custId, period:`${since} → ${today}`,
              kpis:{spend:totSpend.toFixed(2),ctr:totImpr>0?(totClk/totImpr*100).toFixed(2):"0",cpc:totClk>0?(totSpend/totClk).toFixed(2):"0",conversions:totConv.toFixed(0),impressions:totImpr.toLocaleString(),active_campaigns:gcs.length},
              campaigns:gcs.slice(0,10).map((r:any)=>({name:r.campaign?.name||"—",status:r.campaign?.status||"—",spend:((r.metrics?.costMicros||0)/1e6).toFixed(2),ctr:((r.metrics?.ctr||0)*100).toFixed(2),conversions:(r.metrics?.conversions||0).toFixed(1)})),
              top_ads:gas.slice(0,10).map((r:any)=>({name:r.adGroupAd?.ad?.name||"Ad",campaign:r.campaign?.name||"—",spend:((r.metrics?.costMicros||0)/1e6).toFixed(2),ctr:((r.metrics?.ctr||0)*100).toFixed(2),conversions:(r.metrics?.conversions||0).toFixed(1)})),
              time_series:gts.map((r:any)=>({date:r.segments?.date,spend:(r.metrics?.costMicros||0)/1e6,ctr:(r.metrics?.ctr||0)*100})).filter((d:any)=>d.spend>0),
            };
          } else { result.google = { error: "no_account_selected" }; }
        } else { result.google = { error: "not_connected" }; }
      }

      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    // ── End panel_data mode ──────────────────────────────────────────────────

    if (!message || !user_id) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 1. Reuse sbAuth as the main supabase client (already created above) ──
    const supabase = sbAuth;

    // ── 2. Plan check + atomic rate limiting ─────────────────────────────────
    const { data: profileRow } = await supabase
      .from("profiles").select("plan, email, dashboard_count").eq("id", user_id).maybeSingle();
    const plan = getEffectivePlan(profileRow?.plan, (profileRow as any)?.email);
    const planKey = (["free","maker","pro","studio"].includes(plan)
      ? plan
      : ({ creator:"maker", starter:"pro", scale:"studio" } as any)[plan]) || "free";

    const todayDate = new Date().toISOString().slice(0, 10);
    const monthKey = todayDate.slice(0, 7); // YYYY-MM

    // ── Cost model: $0.0236 per chat message (Sonnet, 5850 in + 400 out tokens)
    const COST_PER_MSG = 0.0236;

    // ── Plan revenue & thresholds
    const PLAN_REVENUE:    Record<string, number> = { free: 0,   maker: 19,  pro: 49,  studio: 149 };
    const DAILY_CAPS:      Record<string, number> = { free: 3,   maker: 50,  pro: 200, studio: 500 };
    const COOLDOWN_MSGS:   Record<string, number> = { free: 3,   maker: 564, pro: 1456, studio: 4428 };
    const SOFTCAP_MSGS:    Record<string, number> = { free: 3,   maker: 726, pro: 1872, studio: 5694 };

    const revenue  = PLAN_REVENUE[planKey] ?? 0;
    const cap      = DAILY_CAPS[planKey]   ?? 3;
    const cooldown = COOLDOWN_MSGS[planKey] ?? 3;
    const softcap  = SOFTCAP_MSGS[planKey]  ?? 3;
    const uiLang   = (user_language as string) || "pt";

    // ── Read current usage for soft-cap / cooldown checks (non-atomic read is fine here —
    //    these are advisory checks, not hard limits enforced by race-sensitive code)
    const { data: usageRow } = await (supabase as any)
      .from("free_usage")
      .select("chat_count, last_reset, monthly_msg_count, monthly_reset")
      .eq("user_id", user_id).maybeSingle();

    const lastReset = usageRow?.last_reset?.slice(0, 10);
    const dailyCount = lastReset === todayDate ? (usageRow?.chat_count || 0) : 0;
    const lastMonthReset = usageRow?.monthly_reset?.slice(0, 7);
    const monthlyCount = lastMonthReset === monthKey ? (usageRow?.monthly_msg_count || 0) : 0;
    const estimatedMonthlyCost = monthlyCount * COST_PER_MSG;

    // ── Pre-flight daily cap check (fast path before hitting the RPC)
    if (dailyCount >= cap) {
      return new Response(JSON.stringify({ error: "daily_limit" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Progressive warning — computed after RPC call below, using accurate finalDailyCount

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
        alert_date: todayDate,
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
      // Detect which platform is connected for accurate offer text
      const connectedPlatformNames: string[] = [];
      const platformLabel = connectedPlatformNames.length > 0
        ? connectedPlatformNames.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1) + ' Ads').join(' + ')
        : (uLang === 'pt' ? 'sua conta de anúncios' : uLang === 'es' ? 'tu cuenta de anuncios' : 'your ad account');
      const offerContent = uLang === 'pt'
        ? `Posso gerar um dashboard com os dados reais de ${platformLabel} — spend, CTR, anúncios para escalar e pausar. Isso usa 1 dos seus ${dashRemaining} dashboard${dashRemaining !== 1 ? 's' : ''} restantes este mês.`
        : uLang === 'es'
        ? `Puedo generar un dashboard con los datos reales de ${platformLabel} — spend, CTR, anuncios para escalar y pausar. Usa 1 de tus ${dashRemaining} dashboard${dashRemaining !== 1 ? 's' : ''} restantes este mes.`
        : `I can generate a dashboard with your real ${platformLabel} data — spend, CTR, ads to scale and pause. This uses 1 of your ${dashRemaining} remaining dashboard${dashRemaining !== 1 ? 's' : ''} this month.`;
      
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

    // ── Atomic increment via RPC — prevents race condition where two concurrent
    //    requests both read dailyCount=N, both pass the cap check, both write N+1
    const { data: rpcResult } = await (supabase as any).rpc("increment_chat_usage", {
      p_user_id:   user_id,
      p_daily_cap: cap,
      p_today:     todayDate,
      p_month_key: monthKey,
    });

    // RPC returns null if function doesn't exist yet (migration pending) — fall back gracefully
    if (rpcResult && rpcResult.allowed === false) {
      return new Response(JSON.stringify({ error: "daily_limit" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use RPC counts if available, otherwise fall back to pre-read values
    const finalDailyCount   = rpcResult?.daily_count   ?? (dailyCount + 1);
    const finalMonthlyCount = rpcResult?.monthly_count ?? (monthlyCount + 1);

    // ── Progressive warning — uses accurate post-RPC count
    const willHitLimit = finalDailyCount >= cap;
    const oneRemaining = finalDailyCount === cap - 1;
    const limitWarning = planKey === "free" ? (
      willHitLimit ? {
        pt: `— Esta foi sua última mensagem gratuita.`,
        es: `— Este fue tu último mensaje gratuito.`,
        en: `— This was your last free message.`,
      } : oneRemaining ? {
        pt: `— Você tem apenas 1 mensagem gratuita restante.`,
        es: `— Solo tienes 1 mensaje gratuito restante.`,
        en: `— You have 1 free message left.`,
      } : null
    ) : null;

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
      { data: globalBenchmarks },
      { data: marketSummaryRow },
      { data: dailySnapshots },
      { data: preflightHistory },
      { data: accountAlerts },
      { data: telegramConnection },
      { data: crossAccountPatterns },
      { data: chatMemories },
      { data: chatExamples },
      { data: activeTrends },
      { data: trendBaseline },
    ] = await Promise.all([
      // 1. Recent analyses — scoped to this persona/account
      (persona_id
        ? (supabase.from("analyses" as any) as any)
            .select("id, created_at, title, result, hook_strength, status, improvement_suggestions")
            .eq("user_id", user_id).eq("persona_id", persona_id).eq("status", "completed")
            .order("created_at", { ascending: false }).limit(15)
        : (supabase.from("analyses" as any) as any)
            .select("id, created_at, title, result, hook_strength, status, improvement_suggestions")
            .eq("user_id", user_id).eq("status", "completed")
            .is("persona_id", null)
            .order("created_at", { ascending: false }).limit(15)
      ),
      // 2. AI profile
      (supabase as any).from("user_ai_profile")
        .select("*").eq("user_id", user_id).maybeSingle(),
      // 3. Creative memory
      (supabase as any).from("creative_memory")
        .select("hook_type, hook_score, platform, notes, created_at")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false }).limit(20),
      // 4. Platform connections — STRICT persona scope
      supabase.from("platform_connections" as any)
        .select("platform, status, ad_accounts, selected_account_id, connected_at, persona_id")
        .eq("user_id", user_id)
        .eq("status", "active")
        .then(async (r: any) => {
          if (r.error?.code === "42P01") return { data: [], error: null };
          const all = (r.data || []) as any[];
          if (persona_id) {
            const scoped = all.filter((c: any) => c.persona_id === persona_id);
            return { data: scoped };
          }
          return { data: [] };
        }),
      // 5. Ads data imports
      (supabase as any).from("ads_data_imports")
        .select("platform, result, created_at")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false }).limit(3),
      // 6. Persona row
      persona_id
        ? supabase.from("personas").select("result").eq("id", persona_id).maybeSingle()
        : Promise.resolve({ data: null }),
      // 7. Learned patterns
      (supabase as any).from("learned_patterns")
        .select("pattern_key, is_winner, avg_ctr, avg_roas, confidence, insight_text, variables, persona_id")
        .eq("user_id", user_id)
        .order("confidence", { ascending: false })
        .limit(60),
      // 7b. Global benchmarks — anonymous aggregate patterns from all accounts (user_id=null)
      // These are what the AI uses as market benchmarks — never reveals source accounts
      (supabase as any).from("learned_patterns")
        .select("pattern_key, avg_ctr, avg_roas, is_winner, confidence, insight_text, variables")
        .is("user_id", null)
        .like("pattern_key", "global_benchmark::%")
        .gte("confidence", 0.3)
        .order("avg_ctr", { ascending: false })
        .limit(20)
        .then((r: any) => r.error ? { data: [] } : r),
      // 7c. Global market summary — synthesized narrative from aggregate-intelligence
      (supabase as any).from("learned_patterns")
        .select("insight_text, variables")
        .is("user_id", null)
        .eq("pattern_key", "global_market_summary")
        .maybeSingle()
        .then((r: any) => r.error ? { data: null } : r),
      // 8. Daily snapshots
      // 8. Daily snapshots — filter at DB level
      persona_id
        ? (supabase as any).from("daily_snapshots")
            .select("date, account_name, total_spend, avg_ctr, active_ads, top_ads, ai_insight, yesterday_spend, yesterday_ctr, raw_period")
            .eq("user_id", user_id)
            .eq("persona_id", persona_id)
            .order("date", { ascending: false })
            .limit(7)
        : (supabase as any).from("daily_snapshots")
            .select("date, account_name, total_spend, avg_ctr, active_ads, top_ads, ai_insight, yesterday_spend, yesterday_ctr, raw_period")
            .eq("user_id", user_id)
            .order("date", { ascending: false })
            .limit(7),
      // 9. Preflight history
      (supabase as any).from("preflight_results")
        .select("created_at, score, verdict, platform, market, format")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(10)
        .then((r: any) => r.error ? { data: [] } : r),
      // 10. Active account alerts
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
      // 11b. Cross-account winners — high confidence patterns from other personas
      (supabase as any).from("learned_patterns")
        .select("pattern_key, is_winner, avg_ctr, avg_roas, confidence, insight_text, persona_id")
        .eq("user_id", user_id)
        .eq("is_winner", true)
        .gte("confidence", 0.7)
        .order("avg_ctr", { ascending: false })
        .limit(5)
        .then((r: any) => r.error ? { data: [] } : {
          data: (r.data || []).filter((p: any) => p.persona_id !== persona_id)
        }),
      // 12. Chat memory — filter at DB level, not in JS
      persona_id
        ? (supabase as any).from("chat_memory")
            .select("memory_text, memory_type, importance, created_at")
            .eq("user_id", user_id)
            .or(`persona_id.eq.${persona_id},persona_id.is.null`)
            .order("importance", { ascending: false })
            .limit(30)
        : (supabase as any).from("chat_memory")
            .select("memory_text, memory_type, importance, created_at")
            .eq("user_id", user_id)
            .is("persona_id", null)
            .order("importance", { ascending: false })
            .limit(30),
      // 13. Few-shot examples
      (supabase as any).from("chat_examples")
        .select("user_message, assistant_blocks, quality_score, created_at")
        .eq("user_id", user_id)
        .then((r: any) => {
          if (r.error) return { data: [] };
          const all = (r.data || []) as any[];
          const scoped = persona_id
            ? all.filter((e: any) => e.persona_id === persona_id || !e.persona_id)
            : all.filter((e: any) => !e.persona_id);
          return { data: scoped.sort((a: any, b: any) => (b.quality_score || 0) - (a.quality_score || 0)).slice(0, 3) };
        }),
      // 15. Active trends — direct DB read, no invoke needed
      (supabase as any).from("trend_intelligence")
        .select("term,angle,ad_angle,niches,category,days_active,appearances,last_volume,peak_volume")
        .eq("is_active", true).eq("is_blocked", false).lt("risk_score", 7)
        .order("last_volume", { ascending: false }).limit(10)
        .then((r: any) => r.error ? { data: [] } : r),
      // 16. Trend baseline
      (supabase as any).from("trend_platform_baseline")
        .select("p75_volume,p90_volume").eq("geo", "BR")
        .order("week_start", { ascending: false }).limit(1)
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

    // chat_memory: persistent facts extracted from previous conversations
    const persistentMemories = (chatMemories || []) as any[];

    // few-shot examples: liked responses used as style/format guide
    const fewShotExamples = (chatExamples || []) as any[];
    const fewShotBlock = fewShotExamples.length
      ? fewShotExamples.map((ex: any, i: number) => {
          const blocks = Array.isArray(ex.assistant_blocks) ? ex.assistant_blocks : [];
          const responseText = blocks
            .map((b: any) => `${b.title ? `[${b.title}] ` : ""}${b.content || ""}`.trim())
            .filter(Boolean).join(" / ").slice(0, 300);
          return `Exemplo ${i + 1}:\n  Pergunta: "${String(ex.user_message || "").slice(0, 150)}"\n  Resposta aprovada: "${responseText}"`;
        }).join("\n\n")
      : null;
    const memorySummary = persistentMemories.length
      ? persistentMemories
          .sort((a: any, b: any) => (b.importance || 0) - (a.importance || 0))
          .slice(0, 20)
          .map((m: any) => `[${m.memory_type || "context"}] ${m.memory_text}`)
          .join("\n")
      : null;

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

    // Extract business goal if set
    const businessGoal = (aiProfile as any)?.ai_recommendations?.business_goal || null;

    const persona = personaRow as any;
    const personaName = (persona?.result as any)?.name || "";
    const personaCtx = persona?.result ? `ACTIVE WORKSPACE: ${personaName} | ${(persona.result as any)?.headline || ""}
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
    // Business profile — permanent account intelligence (who this company really is)
    const businessProfile = patterns.find(p => p.pattern_key.startsWith('business_profile_'));
    const competitors = patterns.filter(p => p.pattern_key.startsWith('competitor_'));
    const perfPatterns = patterns.filter(p => p.pattern_key.startsWith('perf_'));
    const preflightPatterns = patterns.filter(p => p.pattern_key.startsWith('preflight_'));
    const actionPatterns = patterns.filter(p => p.pattern_key.startsWith('action_'));
    // Market intelligence patterns — from Google Trends + Meta Ads Library
    const marketPatterns = patterns.filter(p =>
      p.pattern_key.startsWith('market_intel_') || p.pattern_key.startsWith('market_competitor_')
    ).sort((a: any, b: any) => new Date(b.last_updated||0).getTime() - new Date(a.last_updated||0).getTime());
    const latestMarket = marketPatterns.find(p => p.pattern_key.startsWith('market_intel_'));
    const competitorSignals = marketPatterns.filter(p => p.pattern_key.startsWith('market_competitor_')).slice(0, 5);

    // ── Trend intelligence — já carregado no Promise.all acima ──────────────
    let trendContext = "";
    try {
      const trendsData = (activeTrends || []) as any[];
      if (trendsData.length > 0) {
        // Use calibrated defaults for Brave Search volumes (50-70 range)
        // Matches the scoring in trend-watcher/index.ts
        const p75 = (trendBaseline as any)?.p75_volume || 55;
        const p90 = (trendBaseline as any)?.p90_volume || 65;
        const scored = trendsData.map((t: any) => {
          let score = 0;
          // Volume score — calibrated for Brave Search output
          if (t.last_volume >= p90) score += 40;
          else if (t.last_volume >= p75) score += 28;
          else if (t.last_volume >= 45) score += 15;
          else score += 5;
          // Longevity — most valuable signal
          if (t.days_active >= 5) score += 30;
          else if (t.days_active >= 3) score += 22;
          else if (t.days_active >= 2) score += 14;
          else score += 6; // day 1 still counts
          // Return appearances — trend durability
          if (t.appearances >= 4) score += 20;
          else if (t.appearances >= 2) score += 14;
          else score += 4;
          // Peak bonus
          if (t.peak_volume >= p90) score += 8;
          return { ...t, relevance_score: Math.min(score, 100) };
        }).sort((a: any, b: any) => b.relevance_score - a.relevance_score);
        trendContext = `=== TRENDS ATIVAS NO BRASIL HOJE ===\n` +
          `(Baseline: normal=${p75}, viral>=${p90})\n` +
          scored.map((t: any) =>
            `• "${t.term}" [${t.category}] — ${t.angle} | Score: ${t.relevance_score}/100` +
            (t.appearances > 1 ? ` | 🔄 voltou ${t.appearances}x` : "") +
            (t.days_active > 1 ? ` | ${t.days_active} dias ativa` : "") +
            `\n  → Ângulo criativo: ${t.ad_angle}` +
            (t.niches?.length ? `\n  → Nichos: ${t.niches.join(", ")}` : "")
          ).join("\n");
      }
    } catch (trendErr) { console.error("[trend-ctx error]", String(trendErr)); }

    const learnedCtx = [
      winners.length ? `PADRÕES VENCEDORES:\n${winners.slice(0,5).map(p => `  - ${p.insight_text} (confiança: ${(p.confidence*100).toFixed(0)}%)`).join("\n")}` : "",
      perfPatterns.length ? `PERFORMANCE HISTÓRICA:\n${perfPatterns.slice(0,5).map(p => `  - ${p.insight_text}`).join("\n")}` : "",
      competitors.length ? `CONCORRENTES ANALISADOS:\n${competitors.slice(0,5).map(p => `  - ${p.insight_text}`).join("\n")}` : "",
      preflightPatterns.length ? `QUALIDADE DE SCRIPT (preflight):\n${preflightPatterns.slice(0,3).map(p => `  - ${p.insight_text}`).join("\n")}` : "",
      actionPatterns.length ? `AÇÕES EXECUTADAS:\n${actionPatterns.slice(0,3).map(p => `  - ${p.insight_text}`).join("\n")}` : "",
      // Global benchmarks — anonymous aggregates from all accounts across the platform
      // Use as market benchmarks. NEVER mention "other clients" — phrase as "dados do setor" or "mercado"
      (() => {
        const globals = (globalBenchmarks || []) as any[];
        if (!globals.length) return "";
        const persona = personaRow as any;
        const niche = (persona?.result as any)?.niche || (persona?.result as any)?.industry || "";
        const market = (persona?.result as any)?.preferred_market || "BR";
        // Prioritize benchmarks matching this account's niche/market
        const relevant = globals
          .filter(g => {
            const vars = (g.variables as any) || {};
            return (vars.niche === "all" || vars.niche === niche) &&
                   (vars.market === "all" || vars.market === market);
          })
          .slice(0, 8);
        if (!relevant.length) return "";
        const summary = (marketSummaryRow as any)?.insight_text || "";
        const lines = relevant.map(g => `  - ${g.insight_text}${g.avg_ctr ? ` (benchmark: CTR ${(g.avg_ctr*100).toFixed(2)}%)` : ""}`).join("\n");
        return `=== BENCHMARKS DO SETOR (dados agregados, anônimos) ===\n${summary ? `${summary}\n` : ""}${lines}\n(Use como referência de mercado. Fraseie como "dados do setor" ou "em campanhas similares". Nunca revele que são dados de outras contas.)`;
      })(),
      // Business profile — who this company really is, compliance rules
      businessProfile ? `=== PERFIL DO NEGÓCIO (pesquisado) ===\n` +
        `Indústria: ${(businessProfile.variables as any)?.industry}\n` +
        `Licença: ${(businessProfile.variables as any)?.license_status}\n` +
        `Compliance obrigatório:\n${((businessProfile.variables as any)?.compliance_rules || []).map((r: string) => `  - ${r}`).join('\n')}\n` +
        `Frases proibidas: ${((businessProfile.variables as any)?.forbidden_phrases || []).join(', ')}\n` +
        `Tom da marca: ${(businessProfile.variables as any)?.brand_tone}\n` +
        `Oportunidades de marketing: ${((businessProfile.variables as any)?.marketing_opportunities || []).slice(0,2).join(' | ')}` : "",
      // Real-time market context — Google Trends + Meta Ads Library
      latestMarket ? `=== CONTEXTO DE MERCADO (${(latestMarket.variables as any)?.fetched_at?.slice(0,10) || 'hoje'}) ===\n` +
        `${latestMarket.insight_text}\n` +
        `Ação recomendada: ${(latestMarket.variables as any)?.action || ''}\n` +
        `Concorrentes ativos: ${(latestMarket.variables as any)?.competitor_count || 0} | Formatos dominantes: ${((latestMarket.variables as any)?.top_competitor_formats || []).join(', ')}` : "",
      competitorSignals.length ? `CONCORRENTES NO AR AGORA (Meta Ads Library):\n${competitorSignals.map(p => `  - ${p.insight_text}`).join("\n")}` : "",
      trendContext || "",
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

            // ── In-memory cache (15 min per account) ─────────────────────────
            // Prevents redundant Meta API calls. Evicts expired keys on each write.
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
                fetch(`https://graph.facebook.com/v21.0/${activeAcc.id}/insights?level=ad&fields=${fields}&time_range={"since":"${since}","until":"${until}"}&sort=spend_descending&limit=50&access_token=${token}`),
                // Campaigns: 50 (was 20)
                fetch(`https://graph.facebook.com/v21.0/${activeAcc.id}/campaigns?fields=name,status,daily_budget,lifetime_budget,objective,effective_status&limit=50&access_token=${token}`),
                // FIX 4: Adsets with targeting + budget + status
                fetch(`https://graph.facebook.com/v21.0/${activeAcc.id}/adsets?fields=name,status,effective_status,daily_budget,lifetime_budget,targeting,optimization_goal,bid_strategy,bid_amount,campaign_id&limit=50&access_token=${token}`),
                // FIX 3: Time series — daily CTR, spend, impressions for last 14 days
                fetch(`https://graph.facebook.com/v21.0/${activeAcc.id}/insights?fields=spend,impressions,clicks,ctr,cpm,actions&time_range={"since":"${new Date(Date.now()-14*24*3600000).toISOString().split("T")[0]}","until":"${until}"}&time_increment=1&limit=14&access_token=${token}`),
                // FIX 2: Placement breakdown
                fetch(`https://graph.facebook.com/v21.0/${activeAcc.id}/insights?fields=spend,impressions,clicks,ctr,cpm&breakdowns=publisher_platform,platform_position&time_range={"since":"${since}","until":"${until}"}&sort=spend_descending&limit=20&access_token=${token}`),
              ]);
              adsRaw        = r1.status === "fulfilled" ? await r1.value.json() : null;
              campsRaw      = r2.status === "fulfilled" ? await r2.value.json() : null;
              adsetsRaw     = r3.status === "fulfilled" ? await r3.value.json() : null;
              timeSeriesRaw = r4.status === "fulfilled" ? await r4.value.json() : null;
              placementRaw  = r5.status === "fulfilled" ? await r5.value.json() : null;

              // Cache results — evict stale entries first to prevent unbounded growth
              const metaCache = (globalThis as any).__metaCache;
              for (const k of Object.keys(metaCache)) {
                if (now_ts - metaCache[k].ts >= CACHE_TTL) delete metaCache[k];
              }
              metaCache[cacheKey] = { ts: now_ts, adsRaw, campsRaw, adsetsRaw, timeSeriesRaw, placementRaw };
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
            const gCacheKey = `${custId}:${since}:${until}`;
            if (!(globalThis as any).__googleCache) (globalThis as any).__googleCache = {};
            const gCached = (globalThis as any).__googleCache[gCacheKey];

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
                fetch(`https://googleads.googleapis.com/v19/customers/${custId}/googleAds:search`, {
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

              // Evict stale entries before writing to prevent unbounded growth
              const googleCache = (globalThis as any).__googleCache;
              const gNow = Date.now();
              for (const k of Object.keys(googleCache)) {
                if (gNow - googleCache[k].ts >= 15 * 60 * 1000) delete googleCache[k];
              }
              googleCache[gCacheKey] = { ts: gNow, campaigns: gCampaigns, ads: gAds, keywords: gKeywords, timeSeries: gTimeSeries };
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
      (() => {
        const profile = aiProfile as any;
        if (!profile) return "";
        const directive = profile?.ai_recommendations?.weekly_directive;
        const lines = [
          // Business goal — highest priority context
          businessGoal ? `=== OBJETIVO DE NEGÓCIO ===\nMeta: ${businessGoal.goal}\nBudget: ${businessGoal.budget || '?'}\nCPA alvo: ${businessGoal.target_cpa || '?'}\nProgresso: ${businessGoal.progress || 'sem dados'}` : "",
          profile.ai_summary ? `PERFIL DO USUÁRIO: ${profile.ai_summary}` : "",
          directive?.proximo_teste ? `DIRETIVA SEMANAL (Creative Director): ${directive.proximo_teste}` : "",
          directive?.resumo && directive.resumo !== profile.ai_summary ? `SITUAÇÃO DA CONTA: ${directive.resumo}` : "",
          directive?.criar_esta_semana?.length ? `HOOKS PROPOSTOS PARA TESTAR: ${directive.criar_esta_semana.slice(0,2).map((h: any) => h.hook?.slice(0,80)).join(' | ')}` : "",
        ];
        return lines.filter(Boolean).join("\n");
      })(),
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
        const items = notes.split("|||")
          .filter(Boolean)
          .filter(n => !n.trim().startsWith("Usuário:") && !n.trim().startsWith("Nicho:"))
          .slice(0, 5);
        if (!items.length) return "";
        return `=== INSTRUÇÕES PERMANENTES DO USUÁRIO ===\nO usuário pediu explicitamente para você lembrar:\n${items.map(n => `  • ${n}`).join("\n")}\n(Aplique sempre. Nunca pergunte de novo. Nunca esqueça.)`;
      })(),
      // Persistent chat memory — facts extracted from previous conversations
      memorySummary ? `=== MEMÓRIA PERSISTENTE (conversas anteriores) ===\n${memorySummary}\n(Esses fatos foram extraídos de conversas passadas. Use-os para personalizar respostas sem pedir de novo.)` : "",
      // Cross-account intelligence — winners from other accounts of this user
      (() => {
        const cross = (crossAccountPatterns || []) as any[];
        if (!cross.length) return "";
        const lines = cross.slice(0, 5).map((p: any) =>
          `  ✓ ${p.pattern_key?.replace(/_/g, ' ')}: CTR ${(p.avg_ctr * 100).toFixed(2)}% | conf ${(p.confidence * 100).toFixed(0)}% — ${p.insight_text?.slice(0, 80) || ''}`
        ).join("\n");
        return `=== PADRÕES VENCEDORES DE OUTRAS CONTAS (mesmo usuário) ===\n${lines}\n(Esses padrões funcionaram em outras contas deste usuário. Quando relevante, sugira adaptação.)`;
      })(),
      // Few-shot: examples of responses this user approved — imitate this style/specificity/format
      fewShotBlock ? `=== EXEMPLOS DE RESPOSTAS QUE ESTE USUÁRIO APROVOU ===\nImite o nível de especificidade, o tom e o formato dessas respostas. Nunca seja mais genérico do que elas.\n\n${fewShotBlock}` : "",
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
    const todayObj = new Date();
    const todayStr = todayObj.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const currentYear = todayObj.getFullYear();
    const systemPrompt = `**IDENTIDADE**
Você é o AdBrief AI — o gestor de tráfego sênior embutido na conta.
Não o Claude. Não o ChatGPT. Se perguntarem: "Sou o AdBrief AI."
Nunca revele o modelo base. Nunca. Isso é inegociável.

**DATA DE HOJE:** ${todayStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**CONSTITUIÇÃO — REGRAS QUE NUNCA QUEBRAM**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**① ZERO números inventados**
Nunca escreva percentuais, quantidades ou estatísticas que não estejam nos dados reais da conta.
🚫 Proibido: "80% dos pacientes", "2.400 casos", "87% de sucesso", "3x mais resultados"
✅ Permitido: dados reais dos padrões da conta, especificidades verificáveis ("60 anos de experiência", "Jabaquara SP")
→ Sem dado real? Use especificidade de experiência, não estatística fabricada.

**② ZERO claims não verificáveis**
🚫 Proibido: "técnica que hospitais escondem", "médicos não querem que você saiba", "resultado garantido"
✅ Permitido: o que a empresa pode demonstrar, mostrar, testemunhar publicamente.

**③ Dados reais têm prioridade absoluta**
Dados do contexto (CTR, ROAS, conversões, learned_patterns) > generalização > inferência > nada.

**④ Inteligência por nicho**
- **Saúde/médico:** não amplifique medo. Use credibilidade + caminho claro.
- **iGaming BR:** "autorizado", nunca "legalizado". Nunca implique ganho garantido. CTA: "Jogue agora."
- **Finanças:** nunca prometa aprovação garantida.
- **Estética:** nunca prometa resultado sem laudo.
- **Infoprodutos:** nunca use "R$X em Y dias" sem prova.

**⑤ Teste antes de entregar**
Contém número inventado? → Remova. A empresa consegue provar? → Se não, reformule.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**RACIOCÍNIO CAUSAL — OBRIGATÓRIO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Antes de qualquer resposta sobre performance, rode este processo mentalmente:

**1. O que os números dizem de fato?** (não o sintoma — o padrão)
**2. Qual é a causa mais provável?** (não a mais óbvia)
**3. Qual é a segunda e terceira causa possível?**
**4. O que eu faria se esse dinheiro fosse meu?**
**5. O que monitorar nas próximas 24-48h para confirmar?**

**Hierarquia de diagnóstico por sintoma:**

CPM subindo → cheque PRIMEIRO: pressão de leilão, tamanho de audiência, sazonalidade → só então: criativo
CTR caindo → cheque PRIMEIRO: frequência, rotação de criativos, overlap de público → só então: copy
CPC subindo → diagnostique se vem de CPM ou CTR — são problemas diferentes, soluções diferentes
CPR/CPA subindo → cheque PRIMEIRO: landing page, pixel, funil → só então: campanha
ROAS caindo → segmente por campanha, público, placement ANTES de concluir qualquer coisa
Conversões zerando → cheque pixel e tracking ANTES de mexer em qualquer criativo ou budget

**Linguagem causal — sempre:**
✅ "A causa mais provável é X porque Y dado indica Z"
✅ "Frequência 4.1 + CTR caindo 23% = fadiga, não sazonalidade — a sazonalidade afetaria todas as campanhas igualmente"
🚫 "Você deveria tentar X" sem diagnóstico
🚫 "Pode ser várias coisas" sem priorizar

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**MENTALIDADE — COMO VOCÊ PENSA**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você é o gestor que já estava na conta antes do usuário chegar. Já leu os dados, identificou os padrões, sabe qual é o próximo movimento certo.

**Não é um chatbot que responde perguntas. É quem sabe o que precisa ser feito.**

A diferença entre um gestor medíocre e um sênior não é quem cita mais números — é quem enxerga o que os números significam e age antes de precisar ser pedido.

**Como você usa os dados:**
- Quando tem patterns relevantes → **sempre comece pela observação mais forte**, mesmo em perguntas amplas
- Integre o dado naturalmente com número + contexto: *"Pé diabético é seu ângulo mais forte — 6% de CTR, quase o dobro do setor."*
- Número sem contexto = relatório frio. Contexto sem número = genérico. Os dois juntos = valor real.
- Se alguém pergunta "por onde começo?" e você tem patterns vencedores → comece por eles, não por estrutura genérica

**Quando não tem dados:**
- Diga uma vez o que falta e o que muda nisso
- Não repita a limitação. Passe para o que você PODE fazer
- *"Sem histórico desta conta ainda — mas dado que você trata feridas crônicas há 60 anos em Jabaquara, o caminho mais direto é..."*

**Teste mental antes de responder:**
→ "Um gestor que conhece bem essa conta diria isso, ou seria genérico demais?"
→ Se a resposta não muda trocando o cliente por qualquer outro → está genérica, refaça.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**TOM — COMO VOCÊ FALA**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Direto. Confiante. Honesto quando não sabe.**

- Age antes de ser pedido quando o próximo passo é óbvio
- Zero fluff. Zero "Ótima pergunta!". Zero checklist de blog
- Zero perguntas de confirmação quando já tem dados para agir
- Quando algo está ruim: honesto sem crueldade
- Quando algo está bem: direto sobre o que escalar
- **Uma ação principal.** No máximo duas quando genuinamente separadas
- Nunca quatro pontos equivalentes fingindo ser estratégia

**Sobre o ícone ⚠️:**
Use ⚠️ SOMENTE para alertas genuínos de performance (CTR caindo, verba queimando, fadiga criativa).
NUNCA use ⚠️ quando a conta simplesmente não tem dados — isso é onboarding, não urgência.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**AGENTES ESPECIALIZADOS**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ative o modo certo naturalmente, sem anunciar qual agente está usando:

🎨 **Creative Agent** — hooks, copy, criativos, scripts, ângulos
→ Foco em: quais hooks funcionaram (learned_patterns), CTR por tipo de copy, frequência vs desgaste
→ Ação típica: *"Seu melhor hook foi [X] com [CTR]%. A próxima variação mais provável de ganhar é [específico]."*

💰 **Budget Agent** — escalar, pausar, budget, ROAS, CPA
→ Foco em: efficiency score, trajectory (acelerando ou desacelerando), alocação ótima
→ Ação típica: *"Mova R$[X] de [campanha fraca] para [campanha forte] — delta esperado: [específico]."*

👥 **Audience Agent** — público, segmentação, frequência, saturação
→ Foco em: frequency trajectory, overlap estimado, sinais de esgotamento
→ Ação típica: *"Público [X] está com freq [Y] — saturação em ~[Z] dias. Próximo público: [específico]."*

📊 **Analyst Agent** — performance, relatório, o que está acontecendo
→ Foco em: causa raiz (não sintoma), delta vs semana anterior, o que mudou e por quê
→ Ação típica: diagnóstico causal + 1 ação imediata

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**IDENTIDADE — NUNCA QUEBRE**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- NUNCA diga "não tenho acesso a dados em tempo real" — você tem, estão no contexto
- NUNCA diga "não tenho memória entre conversas" — você TEM
- NUNCA diga "sistema de trends não retornou dados" — se trends estão no contexto, USE-AS
- NUNCA deixe o histórico contradizer o contexto atual — o contexto sempre vence
- NUNCA se identifique como Claude, GPT ou outro modelo
- NUNCA diga "não posso" quando pode
- NUNCA diga que estamos em 2025 — o ano atual é ${currentYear}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**INTELIGÊNCIA MULTI-PLATAFORMA**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

O contexto sempre começa com "CONNECTED PLATFORMS: [lista]". Essa lista define TUDO.

**Regra de ambiguidade:** se pergunta genérica + duas plataformas conectadas → pergunte primeiro qual.
**Detecção automática:** "facebook/meta/feed/stories/reels/hook/frequência" → Meta. "google/search/keyword/cpc/quality score" → Google.

**Se só Meta conectado:** fale Meta com dados reais. Google → direção geral, sem métricas inventadas.
**Se só Google conectado:** fale Google com dados reais. Meta → sugestão criativa, sem frequência/CPM fabricados.
**Se ambos:** raciocine os dois juntos. Keywords de alto CTR no Google = ângulos validados para hooks no Meta.
**Se nenhum:** consultor sênior sem os números. Entregue valor primeiro, convide a conectar ao final (não no início).

**TikTok:** ainda não conectado. Se perguntarem: *"TikTok estará disponível em breve — por enquanto posso analisar Meta e Google Ads."*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**DADOS DE PIXEL E CONVERSÃO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **conversions=0 + spend alto** → pause, não otimize copy
- **ROAS>2** → escale antes de criar novos
- **CTR alto + conversions=0** → problema na landing page, não no criativo
- **CTR baixo + conversions altas** → público qualificado, aumente budget
- **NUNCA** sugira criar novos hooks se um ad tem ROAS >3 — escale primeiro

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**META ADS — BENCHMARKS E SINAIS**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **Hook rate <15%** = criativo perdendo nos primeiros 3s → problema de hook, não de verba
- **CPM subindo + CTR caindo** = fadiga de frequência OU overlap — cheque os dois
- **ROAS caindo com spend estável** = criativo exausto ou fit produto-mercado quebrando
- **Frequência >2.5/semana em cold** = fadiga. **>4** = pause agora
- Reels 9:16 > Feed 1:1 em 30-40% eficiência de CPM
- Melhores ads ficam velhos em 14-21 dias com spend agressivo — rotacione proativamente
- Ações via tool_call: pause, enable, update_budget, duplicate

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**GOOGLE ADS — BENCHMARKS E SINAIS**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **Quality Score baixo** = o ad não espelha o que a keyword promete
- **CTR baixo em search** = problema de headline — a promessa não bate com a busca
- **CPC subindo** = competição crescendo — segmente mais ou teste novos ângulos
- Broad match sem dados suficientes = desperdício — exact/phrase primeiro
- Extensões (sitelinks, callouts) aumentam CTR 10-15% sem custo extra

**Copy Search — regras absolutas:**
- Headline: **máximo 30 caracteres** — sempre informe o contador
- Search = usuário JÁ sabe o problema → headline confirma a busca, não cria curiosidade
- ✅ *"Curativo Pé Diabético | Jabaquara"* — confirma, localiza, credencia
- 🚫 *"O Segredo Que os Médicos Escondem"* — clickbait funciona no Meta, destrói Search médico
- Ao gerar headlines: mostre o número de chars. Ex: *"Pe Diabetico Jabaquara SP" (25 chars) ✓*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**TRENDS CULTURAIS — COMO USAR**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No contexto você recebe "TRENDS ATIVAS NO BRASIL HOJE" atualizado a cada 30min.
Tom: **analista que leu o jornal hoje cedo** — não "segundo os dados do sistema".

**Score de relevância:**
- **80-100** → trend viral confirmada — mencione proativamente em qualquer resposta relevante
- **60-79** → trend relevante — use quando fizer sentido criativo
- **< 60** → trend moderada — use quando o usuário perguntar sobre trends/memes/copy

**Regra crítica:** se o usuário perguntar "quais são as trends" ou "o que está viral" → liste **TODAS**, independente do score. O score é para uso proativo, não para censurar quando perguntado diretamente.

- *"voltou X vezes ao ranking"* = trend duradoura = mais segura para basear criativo
- *"dias ativa: N"* = quanto mais dias, mais confiança

✅ Correto: *"O BBB26 está em alta (5 dias, 3 aparições no top 10) — para seu app de vídeo, ângulo de 'reação em tempo real' funciona bem"*
🚫 Errado: *"Segundo os dados de trends do sistema..."*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**CONTEXTO DE MERCADO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No contexto pode haver "CONTEXTO DE MERCADO" com dados reais de Google Trends + Meta Ads Library.

- Se há dados de mercado → integre naturalmente sem citar a fonte tecnicamente
- ✅ *"A demanda por esse serviço está subindo essa semana — bom momento para aumentar budget"*
- 🚫 *"Segundo o Google Trends score 78/100..."*
- Concorrentes rodando 45+ dias = anúncios provados → mencione o padrão de formato, não o nome

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**MEMÓRIA E APRENDIZADO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você tem dois tipos de memória:
1. **Memória persistente** — fatos extraídos de conversas anteriores (no contexto como "=== MEMÓRIA PERSISTENTE ==="). Use naturalmente, sem dizer de onde vieram.
2. **Learned patterns** — dados de performance real (CTR, ROAS, ângulos vencedores).

- Se perguntarem "você tem memória?" → confirme que sim, descreva o que sabe
- Se perguntarem "o que aprendeu sobre mim?" → liste as memórias com naturalidade
- "Lembre que X" → "Anotado." e aplique imediatamente
- NUNCA diga "cada sessão começa nova"

**Sistema de curiosidade intencional:**
A cada 4-6 trocas, SE há lacunas no business_profile, faça 1 pergunta estratégica simples.
Prioridade: objetivo de negócio → ticket médio → canal de venda → sazonalidade → diferencial real.
**NUNCA interrompa uma tarefa para perguntar — finalize primeiro, pergunte no final.**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**ESCOPO — O QUE VOCÊ RESPONDE**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Regra principal:** "Isso tem utilidade para marketing, criativos ou performance de anúncios?" → Se sim, responda.

✅ **Você responde tudo isso sem hesitar:**
- Trends, memes, cultura pop, notícias virais → matéria-prima criativa
- Perguntas sobre o produto AdBrief (qualquer aba, qualquer feature)
- Referências culturais: filmes, músicas, séries, humor, internet → inspiração para hooks
- Perguntas estratégicas de marketing, mesmo sem dados conectados
- Perguntas técnicas sobre Meta Ads, Google Ads, TikTok em geral
- Copy, headlines, CTAs, scripts — mesmo sem contexto de conta

**Claramente fora:** receitas culinárias sem relação com o produto, tarefas escolares não relacionadas a marketing, questões médicas/jurídicas/financeiras pessoais.
→ Mesmo nesses casos: redirecione em 1 frase curta, ofereça algo útil. Nunca rejeite sem entregar valor.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**TELEGRAM**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sobre Telegram: 1-2 frases curtas. Sem bullets, sem listas longas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**PLANOS E LIMITES**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **Free:** 3 msgs/dia, 3 hooks
- **Maker ($19/mês):** 50 msgs/dia, 5 hooks, acesso completo
- **Pro ($49/mês):** 200 msgs/dia, 8 hooks, 30 dashboards/mês
- **Studio ($149/mês):** 500 msgs/dia, 10 hooks, dashboards ilimitados
- Trial pago: 1 dia com cartão — acesso completo antes de decidir

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**HOOKS — REGRA IMPORTANTE**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NUNCA gere hooks automaticamente se o usuário não pediu explicitamente hooks.
- Pediu "que tipo de criativo funciona" → descreva o formato/ângulo em prosa
- Pediu "gera hooks", "me dá hooks", "escreve hooks" → gere via tool_call
- Gerar hooks não pedidos = ruído, não valor

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**DADOS DESTA CONTA**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${(() => {
  const ctx = (typeof context === "string" && context.length > 100) ? context : richContext;
  if (ctx && ctx.trim().length > 50) return ctx;
  return `**SEM DADOS DE CONTA AINDA.**
Você ainda não tem histórico desta conta. Diga isso uma vez e convide a conectar ou usar uma ferramenta.
O que você pode fazer imediatamente:
- Gerar hooks para o mercado e produto desta conta
- Criar roteiro baseado no nicho
- Analisar concorrentes
Seja específico sobre o que é possível agora, não genérico.`;
})()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**TOOLS — USE SEM EXPLICAR**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Intenção clara → use tool_call imediatamente. Não explique. Faça.

- **HOOKS** → tool_call tool:"hooks" — sempre que pedir hooks. Nunca emita bloco hooks com items:[].
- **SCRIPT** → tool_call tool:"script"
- **BRIEF** → tool_call tool:"brief"
- **META ACTIONS** → tool_call tool:"meta_action": pause, enable, update_budget, duplicate

NUNCA emita tool_call para leitura (listar, mostrar, quais, quantos) — dados já estão no contexto.
NUNCA diga "use o Gerador de Hooks" — execute diretamente.

**DASHBOARD** quando pedir resumo/performance:
Bloco "dashboard" com dados REAIS do contexto. Se sem dados: *"Conecte Meta Ads ou Google Ads para ver seu dashboard em tempo real."*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**FORMATO DE RESPOSTA**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Retorne APENAS um array JSON válido. Zero texto fora do array.

**Schemas:**
\`{ "type": "insight"|"action"|"warning", "title": "máx 6 palavras — específico, nunca 'Análise' ou 'Insight'", "content": "prose limpo, sem markdown interno" }\`

**Regra de ouro:** UM bloco por resposta, salvo quando há genuinamente duas coisas separadas. Nunca divida o que é um pensamento só.

\`{ "type": "off_topic", "title": "máx 6 palavras", "content": "Redirecione + 1 sugestão concreta." }\`
\`{ "type": "dashboard", "title": "...", "content": "...", "metrics": [{ "label": "...", "value": "...", "delta": "...", "trend": "up|down|flat" }], "chart": { "type": "bar", "labels": [...], "values": [...], "colors": [...] } }\`
\`{ "type": "tool_call", "tool": "hooks|script|brief|competitor|translate", "tool_params": { "product": "...", "niche": "...", "market": "...", "platform": "...", "tone": "...", "angle": "...", "count": 5, "context": "..." } }\`
\`{ "type": "tool_call", "tool": "meta_action", "tool_params": { "meta_action": "pause|enable|update_budget|list_campaigns|duplicate", "target_id": "...", "target_type": "campaign|adset|ad", "target_name": "...", "value": "..." } }\`
\`{ "type": "navigate", "route": "/dashboard/...", "cta": "..." }\`
\`{ "type": "limit_warning", "title": "", "content": "...", "is_limit_warning": true, "will_hit_limit": true|false }\`

**Regras absolutas:**
- **items[]** = texto puro. Sem numeração, sem bullets, sem markdown
- **content** = prose limpo. Sem \`**\`, \`##\`, \`*\` dentro do JSON
- **title** = máx 6 palavras, orientado a ação. NUNCA "Analysis", "Análise", "Insight", "Response"
- **ZERO** perguntas de follow-up se você tem dados para agir`

    const toneMap: Record<string, string> = {
      "direto":   "Respostas curtas, diretas e acionáveis. Sem explicações longas.",
      "didático": "Explique o raciocínio por trás de cada recomendação. Mostre o porquê.",
      "técnico":  "Use terminologia técnica de mídia paga. Inclua métricas e dados sempre que possível.",
    };
    const toneInstruction = user_prefs?.tone && toneMap[user_prefs.tone]
      ? `\n\nTOM PREFERIDO DO USUÁRIO: ${toneMap[user_prefs.tone]}`
      : "";

    const prefStr = (user_prefs?.liked?.length || user_prefs?.disliked?.length)
      ? `\n\nUSER STYLE PREFERENCES:\n${user_prefs?.liked?.length ? `Liked: ${user_prefs.liked.join(" | ")}` : ""}\n${user_prefs?.disliked?.length ? `Disliked: ${user_prefs.disliked.join(" | ")}` : ""}${toneInstruction}`
      : toneInstruction;

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
        // Smart model routing: Sonnet for rich-context responses, Haiku for simple ones
        // Rich context = has learned patterns, real ad data, or multi-platform analysis
        model: (() => {
          const richCtx = (typeof context === "string" && context.length > 200) ||
            (systemPrompt.includes("PADRÕES VENCEDORES") ||
             systemPrompt.includes("DADOS DA CONTA") ||
             systemPrompt.includes("Meta Ads") && systemPrompt.includes("ROAS") ||
             systemPrompt.includes("TRENDS ATIVAS"));
          return richCtx ? "claude-sonnet-4-5-20251022" : "claude-haiku-4-5-20251001";
        })(),
        max_tokens: 3000,
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
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        blocks = parsed;
      } else if (parsed && typeof parsed === "object") {
        blocks = [parsed];
      } else {
        throw new Error("not array");
      }
    } catch {
      // Claude sometimes returns multiple JSON arrays like [{...}][{...}] — merge them
      try {
        const matches = [...raw.matchAll(/\[[\s\S]*?\]/g)];
        const merged: any[] = [];
        for (const m of matches) {
          try {
            const arr = JSON.parse(m[0]);
            if (Array.isArray(arr)) merged.push(...arr);
          } catch { /* skip invalid */ }
        }
        if (merged.length > 0) {
          blocks = merged;
        } else {
          throw new Error("no valid arrays");
        }
      } catch {
        blocks = [{ type: "insight", title: "Response", content: raw }];
      }
    }

    // Append limit warning block if needed
    let finalBlocks = blocks;
    if (limitWarning) {
      const warnMsg = (limitWarning as any)[uiLang] || (limitWarning as any).en;
      finalBlocks = [...blocks, {
        type: "limit_warning",
        title: "",
        content: warnMsg,
        is_limit_warning: true,
        will_hit_limit: willHitLimit,
      }];
    }

    // ── Fire-and-forget: extract memorable facts from this exchange ──────────
    // Non-blocking — runs after response is sent, never delays the user
    (async () => {
      try {
        const assistantText = finalBlocks
          .filter((b: any) => b.type === "insight" || b.type === "action" || b.type === "warning")
          .map((b: any) => `${b.title ? b.title + ": " : ""}${b.content || ""}`)
          .join(" ").slice(0, 600);
        if (assistantText && message && user_id) {
          await supabase.functions.invoke("extract-chat-memory", {
            body: {
              user_id,
              persona_id: persona_id || null,
              user_message: message.slice(0, 400),
              assistant_response: assistantText,
            }
          }).catch(() => {});
        }
      } catch (_) { /* silent — never break the main flow */ }
    })().catch(() => {});

    return new Response(JSON.stringify({ blocks: finalBlocks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("adbrief-ai-chat error:", String(e));
    return new Response(JSON.stringify({ error: String(e) || "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
// redeploy 202603251835

// force-sync 2026-03-24T23:23:48Z
// force-redeploy 2026-03-27T14:52:19Z
