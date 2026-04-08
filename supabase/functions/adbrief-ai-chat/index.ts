// adbrief-ai-chat v20.1 — tom livre, fix toneMap removido
import { createClient } from "npm:@supabase/supabase-js@2";
import { getEffectivePlan, LIFETIME_ACCOUNTS } from "../_shared/plans.ts";

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
    const sbAuth = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const authHeaderEarly = req.headers.get("Authorization");
    if (authHeaderEarly?.startsWith("Bearer ")) {
      const earlyToken = authHeaderEarly.slice(7);
      const {
        data: { user: earlyUser },
        error: earlyAuthError,
      } = await sbAuth.auth.getUser(earlyToken);
      if (earlyAuthError || !earlyUser || earlyUser.id !== user_id) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (user_id) {
      // No auth header at all — reject
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Panel Data mode — skip Claude, return structured ad data for LivePanel ──
    if (panel_data && user_id && persona_id) {
      const sbPanel = sbAuth;
      const platforms: string[] = body.platforms || [];
      const result: Record<string, any> = {};
      const today = body.date_to || body.date_to || new Date().toISOString().split("T")[0];
      const since = body.date_from || new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];

      // Meta Ads
      if (platforms.includes("meta")) {
        const { data: mcAll } = await sbPanel
          .from("platform_connections" as any)
          .select("access_token, ad_accounts, selected_account_id, persona_id")
          .eq("user_id", user_id)
          .eq("platform", "meta")
          .eq("status", "active");
        const mcList = (mcAll as any[]) || [];
        const mc = persona_id
          ? mcList.find((c: any) => c.persona_id === persona_id) ||
            mcList.find((c: any) => !c.persona_id) ||
            mcList[0] ||
            null
          : mcList[0] || null;
        if (mc?.access_token) {
          const token = mc.access_token;
          const acc =
            (mc.ad_accounts || []).find((a: any) => a.id === mc.selected_account_id) || (mc.ad_accounts || [])[0];
          if (acc) {
            const fields =
              "campaign_name,adset_name,ad_name,spend,impressions,clicks,ctr,cpm,cpc,actions,video_play_actions,frequency,reach";
            const [r1, r2, r3, r4] = await Promise.allSettled([
              fetch(
                `https://graph.facebook.com/v21.0/${acc.id}/insights?level=ad&fields=${fields}&time_range={"since":"${since}","until":"${today}"}&sort=spend_descending&limit=50&access_token=${token}`,
              ),
              fetch(
                `https://graph.facebook.com/v21.0/${acc.id}/campaigns?fields=name,status,daily_budget,lifetime_budget,objective,effective_status&limit=50&access_token=${token}`,
              ),
              fetch(
                `https://graph.facebook.com/v21.0/${acc.id}/insights?fields=spend,impressions,clicks,ctr,cpm&time_range={"since":"${since}","until":"${today}"}&time_increment=1&limit=60&access_token=${token}`,
              ),
              fetch(`https://graph.facebook.com/v21.0/${acc.id}?fields=currency,timezone_name&access_token=${token}`),
            ]);
            const ads = r1.status === "fulfilled" ? await r1.value.json() : null;
            const camps = r2.status === "fulfilled" ? await r2.value.json() : null;
            const ts = r3.status === "fulfilled" ? await r3.value.json() : null;
            const accInfo = r4.status === "fulfilled" ? await r4.value.json() : null;
            const currency = accInfo?.currency || "BRL";
            const currSymbol =
              currency === "BRL"
                ? "R$"
                : currency === "USD"
                  ? "$"
                  : currency === "EUR"
                    ? "€"
                    : currency === "MXN"
                      ? "$"
                      : currency;
            if (ads?.error?.code === 190 || camps?.error?.code === 190) {
              result.meta = { error: "token_expired", account_name: acc.name || acc.id };
            } else {
              const adsData: any[] = ads?.data || [];
              const totalSpend = adsData.reduce((s: number, a: any) => s + parseFloat(a.spend || 0), 0);
              const totalImpr = adsData.reduce((s: number, a: any) => s + parseInt(a.impressions || 0), 0);
              const totalClicks = adsData.reduce((s: number, a: any) => s + parseInt(a.clicks || 0), 0);
              const avgCTR = totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0;
              const avgCPM = totalImpr > 0 ? (totalSpend / totalImpr) * 1000 : 0;
              const avgFreq =
                adsData.length > 0
                  ? adsData.reduce((s: number, a: any) => s + parseFloat(a.frequency || 0), 0) / adsData.length
                  : 0;
              const totalConv = adsData.reduce((s: number, a: any) => {
                const p = parseFloat(a.actions?.find((x: any) => x.action_type === "purchase")?.value || 0);
                const l = parseFloat(a.actions?.find((x: any) => x.action_type === "lead")?.value || 0);
                return s + p + l;
              }, 0);
              const enriched = adsData
                .map((a: any) => {
                  const spend = parseFloat(a.spend || 0),
                    ctr = parseFloat(a.ctr || 0) * 100,
                    freq = parseFloat(a.frequency || 0);
                  const hookRate = () => {
                    const plays = a.video_play_actions?.find((x: any) => x.action_type === "video_play")?.value;
                    const impr = parseInt(a.impressions || 0);
                    return plays && impr ? (parseFloat(plays) / impr) * 100 : null;
                  };
                  return {
                    name: a.ad_name,
                    campaign: a.campaign_name,
                    spend,
                    ctr,
                    cpm: parseFloat(a.cpm || 0),
                    freq,
                    hookRate: hookRate(),
                    conv: parseFloat(
                      a.actions?.find((x: any) => x.action_type === "purchase")?.value ||
                        a.actions?.find((x: any) => x.action_type === "lead")?.value ||
                        0,
                    ),
                    isRisk: freq > 3.5 || (ctr < 0.5 && spend > 20),
                    isWinner: ctr > 1.5 && freq < 3 && spend > 5,
                  };
                })
                .sort((a: any, b: any) => b.spend - a.spend);
              result.meta = {
                account_name: acc.name || acc.id,
                period: `${since} → ${today}`,
                currency,
                currency_symbol: currSymbol,
                kpis: {
                  spend: totalSpend.toFixed(2),
                  ctr: avgCTR.toFixed(2),
                  cpm: avgCPM.toFixed(2),
                  frequency: avgFreq.toFixed(1),
                  conversions: totalConv.toFixed(0),
                  active_ads: adsData.length,
                },
                winners: enriched.filter((a: any) => a.isWinner).slice(0, 5),
                at_risk: enriched.filter((a: any) => a.isRisk).slice(0, 5),
                top_ads: enriched.slice(0, 10),
                campaigns: (camps?.data || []).slice(0, 10).map((c: any) => ({
                  name: c.name,
                  status: c.effective_status || c.status,
                  budget: c.daily_budget
                    ? `${currSymbol}${(parseInt(c.daily_budget) / 100).toFixed(0)}/dia`
                    : c.lifetime_budget
                      ? `${currSymbol}${(parseInt(c.lifetime_budget) / 100).toFixed(0)} total`
                      : "—",
                  objective: c.objective,
                })),
                time_series: (ts?.data || [])
                  .filter((d: any) => parseFloat(d.spend || 0) > 0)
                  .map((d: any) => ({
                    date: d.date_start,
                    spend: parseFloat(d.spend || 0),
                    ctr: parseFloat(d.ctr || 0) * 100,
                    cpm: parseFloat(d.cpm || 0),
                  })),
              };
            }
          } else {
            result.meta = { error: "no_account_selected" };
          }
        } else {
          result.meta = { error: "not_connected" };
        }
      }

      // Google Ads
      if (platforms.includes("google")) {
        const { data: gc } = await sbPanel
          .from("platform_connections" as any)
          .select("access_token, refresh_token, expires_at, ad_accounts, selected_account_id")
          .eq("user_id", user_id)
          .eq("persona_id", persona_id)
          .eq("platform", "google")
          .eq("status", "active")
          .maybeSingle();
        if (gc?.access_token) {
          let token = gc.access_token;
          if (gc.expires_at && new Date(gc.expires_at) < new Date()) {
            const rr = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
                client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
                refresh_token: gc.refresh_token ?? "",
                grant_type: "refresh_token",
              }),
            });
            const rd = await rr.json();
            if (rd.access_token) {
              token = rd.access_token;
              await sbPanel
                .from("platform_connections" as any)
                .update({
                  access_token: token,
                  expires_at: new Date(Date.now() + (rd.expires_in || 3600) * 1000).toISOString(),
                })
                .eq("user_id", user_id)
                .eq("persona_id", persona_id)
                .eq("platform", "google");
            }
          }
          const acc =
            (gc.ad_accounts || []).find((a: any) => a.id === gc.selected_account_id) || (gc.ad_accounts || [])[0];
          if (acc) {
            const custId = acc.id.replace(/-/g, "");
            const hdr = {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "developer-token": Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") ?? "",
            }; // login-customer-id removed
            const gq = (q: string) =>
              fetch(`https://googleads.googleapis.com/v23/customers/${custId}/googleAds:search`, {
                method: "POST",
                headers: hdr,
                body: JSON.stringify({ query: q }),
              }).then((r) => r.json());
            const [cr, ar, tr] = await Promise.allSettled([
              gq(
                `SELECT campaign.name,campaign.status,campaign.advertising_channel_type,metrics.impressions,metrics.clicks,metrics.ctr,metrics.average_cpc,metrics.cost_micros,metrics.conversions FROM campaign WHERE segments.date BETWEEN '${since}' AND '${today}' AND campaign.status!='REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 20`,
              ),
              gq(
                `SELECT ad_group_ad.ad.name,ad_group_ad.ad.type,campaign.name,metrics.impressions,metrics.clicks,metrics.ctr,metrics.cost_micros,metrics.conversions FROM ad_group_ad WHERE segments.date BETWEEN '${since}' AND '${today}' AND ad_group_ad.status!='REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 20`,
              ),
              gq(
                `SELECT segments.date,metrics.impressions,metrics.clicks,metrics.ctr,metrics.cost_micros,metrics.conversions FROM customer WHERE segments.date BETWEEN '${since}' AND '${today}' ORDER BY segments.date ASC LIMIT 14`,
              ),
            ]);
            const parse = (r: any) => (r.status === "fulfilled" ? r.value?.results || [] : []);
            const gcs = parse(cr),
              gas = parse(ar),
              gts = parse(tr);
            const totSpend = gcs.reduce((s: number, r: any) => s + (r.metrics?.costMicros || 0) / 1e6, 0);
            const totConv = gcs.reduce((s: number, r: any) => s + (r.metrics?.conversions || 0), 0);
            const totClk = gcs.reduce((s: number, r: any) => s + (r.metrics?.clicks || 0), 0);
            const totImpr = gcs.reduce((s: number, r: any) => s + (r.metrics?.impressions || 0), 0);
            result.google = {
              account_name: acc.name || custId,
              period: `${since} → ${today}`,
              kpis: {
                spend: totSpend.toFixed(2),
                ctr: totImpr > 0 ? ((totClk / totImpr) * 100).toFixed(2) : "0",
                cpc: totClk > 0 ? (totSpend / totClk).toFixed(2) : "0",
                conversions: totConv.toFixed(0),
                impressions: totImpr.toLocaleString(),
                active_campaigns: gcs.length,
              },
              campaigns: gcs
                .slice(0, 10)
                .map((r: any) => ({
                  name: r.campaign?.name || "—",
                  status: r.campaign?.status || "—",
                  spend: ((r.metrics?.costMicros || 0) / 1e6).toFixed(2),
                  ctr: ((r.metrics?.ctr || 0) * 100).toFixed(2),
                  conversions: (r.metrics?.conversions || 0).toFixed(1),
                })),
              top_ads: gas
                .slice(0, 10)
                .map((r: any) => ({
                  name: r.adGroupAd?.ad?.name || "Ad",
                  campaign: r.campaign?.name || "—",
                  spend: ((r.metrics?.costMicros || 0) / 1e6).toFixed(2),
                  ctr: ((r.metrics?.ctr || 0) * 100).toFixed(2),
                  conversions: (r.metrics?.conversions || 0).toFixed(1),
                })),
              time_series: gts
                .map((r: any) => ({
                  date: r.segments?.date,
                  spend: (r.metrics?.costMicros || 0) / 1e6,
                  ctr: (r.metrics?.ctr || 0) * 100,
                }))
                .filter((d: any) => d.spend > 0),
            };
          } else {
            result.google = { error: "no_account_selected" };
          }
        } else {
          result.google = { error: "not_connected" };
        }
      }

      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ── End panel_data mode ──────────────────────────────────────────────────

    if (!message || !user_id) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 1. Reuse sbAuth as the main supabase client (already created above) ──
    const supabase = sbAuth;

    // ── 2. Plan check + atomic rate limiting ─────────────────────────────────
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("plan, email, dashboard_count, subscription_status, trial_end")
      .eq("id", user_id)
      .maybeSingle();
    const plan = getEffectivePlan(profileRow?.plan, (profileRow as any)?.email);
    const planKey =
      (["free", "maker", "pro", "studio"].includes(plan)
        ? plan
        : ({ creator: "maker", starter: "pro", scale: "studio", lifetime: "studio", appsumo: "studio", ltd: "studio" } as any)[plan]) || "free";

    // ── Trial detection ────────────────────────────────────────────────────────
    const isTrialing = (profileRow as any)?.subscription_status === "trialing";
    const trialEndDate = (profileRow as any)?.trial_end ? new Date((profileRow as any).trial_end) : null;
    const trialExpired = trialEndDate ? trialEndDate < new Date() : false;
    // If trial expired and not updated yet — treat as free
    const effectivePlanKey = (isTrialing && trialExpired) ? "free" : planKey;

    const todayDate = new Date().toISOString().slice(0, 10);
    const monthKey = todayDate.slice(0, 7); // YYYY-MM

    // ── Cost model: $0.0236 per chat message (Sonnet, 5850 in + 400 out tokens)
    const COST_PER_MSG = 0.0236;

    // ── Plan revenue & thresholds
    const PLAN_REVENUE: Record<string, number> = { free: 0, maker: 19, pro: 49, studio: 149 };
    // Trial caps = 50% of paid plan caps (prevents full trial abuse while still being useful)
    const DAILY_CAPS_TRIAL: Record<string, number> = { free: 3, maker: 20, pro: 80, studio: 150 };
    const DAILY_CAPS: Record<string, number> = { free: 3, maker: 50, pro: 200, studio: 500 };
    const COOLDOWN_MSGS: Record<string, number> = { free: 3, maker: 564, pro: 1456, studio: 4428 };
    const SOFTCAP_MSGS: Record<string, number> = { free: 3, maker: 726, pro: 1872, studio: 5694 };

    const revenue = PLAN_REVENUE[effectivePlanKey] ?? 0;
    // Apply reduced trial cap if user is in trial period
    const cap = isTrialing
      ? (DAILY_CAPS_TRIAL[effectivePlanKey] ?? 3)
      : (DAILY_CAPS[effectivePlanKey] ?? 3);
    const cooldown = COOLDOWN_MSGS[effectivePlanKey] ?? 3;
    const softcap = SOFTCAP_MSGS[effectivePlanKey] ?? 3;
    const uiLang = (user_language as string) || "pt";

    // ── Read current usage for soft-cap / cooldown checks (non-atomic read is fine here —
    //    these are advisory checks, not hard limits enforced by race-sensitive code)
    const { data: usageRow } = await (supabase as any)
      .from("free_usage")
      .select("chat_count, last_reset, monthly_msg_count, monthly_reset")
      .eq("user_id", user_id)
      .maybeSingle();

    const lastReset = usageRow?.last_reset?.slice(0, 10);
    const dailyCount = lastReset === todayDate ? usageRow?.chat_count || 0 : 0;
    const lastMonthReset = usageRow?.monthly_reset?.slice(0, 7);
    const monthlyCount = lastMonthReset === monthKey ? usageRow?.monthly_msg_count || 0 : 0;
    const estimatedMonthlyCost = monthlyCount * COST_PER_MSG;

    // ── Pre-flight daily cap check (fast path before hitting the RPC)
    if (dailyCount >= cap) {
      return new Response(JSON.stringify({ error: "daily_limit" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(
        JSON.stringify({
          error: "monthly_softcap",
          blocks: [
            {
              type: "warning",
              title: uiLang === "pt" ? "Limite mensal se aproximando" : "Monthly limit approaching",
              content: m[uiLang] || m.en,
              cta_label: uiLang === "pt" ? `Fazer upgrade para ${nextPlan}` : `Upgrade to ${nextPlan}`,
              cta_route: "/pricing",
            },
          ],
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
      (supabase as any)
        .from("cost_alerts")
        .upsert(
          {
            user_id,
            plan: planKey,
            monthly_msgs: monthlyCount,
            estimated_cost: estimatedMonthlyCost,
            plan_revenue: revenue,
            cost_pct: revenue > 0 ? Math.round((estimatedMonthlyCost / revenue) * 100) : 999,
            alert_date: todayDate,
            last_updated: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
    }

    // Only trigger dashboard offer for explicit data/analytics requests
    // NOT for "resumo" or "como vai" — too broad, creates friction unnecessarily
    const isDashboardRequest =
      /\b(dashboard|painel|panel|relatório|relatorio|report|overview|visão geral|vision general|métricas|metricas|metrics|como está minha conta|how is my account)\b/i.test(
        message,
      ) && !message.includes("[DASHBOARD]"); // pill-triggered already handled

    // Dashboard limits per plan (monthly)
    const DASHBOARD_LIMITS: Record<string, number> = { free: 0, maker: 10, pro: 30, studio: -1 };
    const dashLimit = DASHBOARD_LIMITS[planKey] ?? 0;

    // If dashboard request — check limit and offer instead of auto-generating
    if (isDashboardRequest && !message.includes("[DASHBOARD_CONFIRMED]")) {
      const dashUsed = (profileRow as any)?.dashboard_count || 0;
      const dashRemaining = dashLimit === -1 ? 999 : Math.max(0, dashLimit - dashUsed);

      if (dashLimit === 0 || (dashLimit !== -1 && dashUsed >= dashLimit)) {
        // No dashboards left — return upgrade wall
        const uLang = uiLang || "pt";
        const title =
          uLang === "pt"
            ? "Limite de dashboards atingido"
            : uLang === "es"
              ? "Límite de dashboards alcanzado"
              : "Dashboard limit reached";
        const content =
          uLang === "pt"
            ? `Seu plano ${planKey} inclui ${dashLimit === 0 ? "acesso a dashboards apenas no plano Maker ou superior" : dashLimit + " dashboards/mês"}. Você usou ${dashUsed}.`
            : `Your ${planKey} plan includes ${dashLimit === 0 ? "dashboards on Maker plan or higher" : dashLimit + " dashboards/month"}. You've used ${dashUsed}.`;
        return new Response(
          JSON.stringify({
            error: "dashboard_limit",
            blocks: [{ type: "warning", title, content }],
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Offer to generate dashboard — don't auto-generate
      const uLang = uiLang || "pt";
      const offerTitle =
        uLang === "pt"
          ? "Gerar dashboard de performance?"
          : uLang === "es"
            ? "¿Generar dashboard de rendimiento?"
            : "Generate performance dashboard?";
      // Detect which platform is connected for accurate offer text
      const connectedPlatformNames: string[] = [];
      const platformLabel =
        connectedPlatformNames.length > 0
          ? connectedPlatformNames.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1) + " Ads").join(" + ")
          : uLang === "pt"
            ? "sua conta de anúncios"
            : uLang === "es"
              ? "tu cuenta de anuncios"
              : "your ad account";
      const offerContent =
        uLang === "pt"
          ? `Posso gerar um dashboard com os dados reais de ${platformLabel} — spend, CTR, anúncios para escalar e pausar. Isso usa 1 dos seus ${dashRemaining} dashboard${dashRemaining !== 1 ? "s" : ""} restantes este mês.`
          : uLang === "es"
            ? `Puedo generar un dashboard con los datos reales de ${platformLabel} — spend, CTR, anuncios para escalar y pausar. Usa 1 de tus ${dashRemaining} dashboard${dashRemaining !== 1 ? "s" : ""} restantes este mes.`
            : `I can generate a dashboard with your real ${platformLabel} data — spend, CTR, ads to scale and pause. This uses 1 of your ${dashRemaining} remaining dashboard${dashRemaining !== 1 ? "s" : ""} this month.`;

      return new Response(
        JSON.stringify({
          blocks: [
            {
              type: "dashboard_offer",
              title: offerTitle,
              content: offerContent,
              remaining: dashRemaining,
              original_message: message,
            },
          ],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // If confirmed dashboard — increment counter
    if (message.includes("[DASHBOARD_CONFIRMED]")) {
      const dashUsed = (profileRow as any)?.dashboard_count || 0;
      if (dashLimit !== -1) {
        await supabase
          .from("profiles")
          .update({ dashboard_count: dashUsed + 1 } as any)
          .eq("id", user_id);
      }
    }

    // Apply smart cooldown if active (only for abusive usage)
    if (cooldownDelay > 0) {
      await new Promise((r) => setTimeout(r, cooldownDelay));
    }

    // ── Atomic increment via RPC — prevents race condition where two concurrent
    //    requests both read dailyCount=N, both pass the cap check, both write N+1
    const { data: rpcResult } = await (supabase as any).rpc("increment_chat_usage", {
      p_user_id: user_id,
      p_daily_cap: cap,
      p_today: todayDate,
      p_month_key: monthKey,
    });

    // RPC returns null if function doesn't exist yet (migration pending) — fall back gracefully
    if (rpcResult && rpcResult.allowed === false) {
      return new Response(JSON.stringify({ error: "daily_limit" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use RPC counts if available, otherwise fall back to pre-read values
    const finalDailyCount = rpcResult?.daily_count ?? dailyCount + 1;
    const finalMonthlyCount = rpcResult?.monthly_count ?? monthlyCount + 1;

    // ── Progressive warning — uses accurate post-RPC count
    const willHitLimit = finalDailyCount >= cap;
    const oneRemaining = finalDailyCount === cap - 1;
    const limitWarning =
      planKey === "free"
        ? willHitLimit
          ? {
              pt: `— Esta foi sua última mensagem gratuita.`,
              es: `— Este fue tu último mensaje gratuito.`,
              en: `— This was your last free message.`,
            }
          : oneRemaining
            ? {
                pt: `— Você tem apenas 1 mensagem gratuita restante.`,
                es: `— Solo tienes 1 mensaje gratuito restante.`,
                en: `— You have 1 free message left.`,
              }
            : null
        : null;

    // ── 2b. Detect "remember this" instructions — save before fetching context ──
    // Tolerante a typos: lemnre, lembr, lemb etc.
    const rememberTriggers =
      /(lemb?[rn]?e?(-se)?( de)?|quero que (voc[êe]|vc) (lembre|saiba|guarde)|n[ãa]o (esque[çc]a?|esquece)|sempre que|remember( that| this)?|keep in mind|note that|anota( que)?|guarda( que)?|j[aá] te (falei|disse)|eu (j[aá] )?te (falei|disse))/i;
    if (rememberTriggers.test(message)) {
      // Extract what to remember — take the message minus trigger words
      const noteText = message
        .replace(/^(ei[,!]?\s*)?/i, "")
        .replace(
          /lembre(-se)?( de)?|quero que (você|vc) (lembre|saiba|guarde)|não (esqueça|esquece)|remember( that| this)?|keep in mind|note that|anota( que)?|guarda( que)?|já te (falei|disse)|eu (já )?te (falei|disse)/gi,
          "",
        )
        .replace(/[,:\s]+$/, "")
        .trim()
        .slice(0, 300);

      if (noteText.length > 5) {
        // Save to user_ai_profile.pain_point (reusing existing column for user notes)
        // Get current notes first
        const { data: existingProfile } = await (supabase as any)
          .from("user_ai_profile")
          .select("pain_point")
          .eq("user_id", user_id)
          .maybeSingle();

        const existing = (existingProfile?.pain_point as string) || "";
        const timestamp = new Date().toISOString().slice(0, 10);
        const newNote = `[${timestamp}] ${noteText}`;
        // Keep last 5 notes, separated by | — avoids unbounded growth
        const allNotes = existing
          ? [newNote, ...existing.split("|||").filter(Boolean)].slice(0, 5).join("|||")
          : newNote;

        await (supabase as any)
          .from("user_ai_profile")
          .upsert({ user_id, pain_point: allNotes, last_updated: new Date().toISOString() }, { onConflict: "user_id" });
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
      persona_id
        ? (supabase.from("analyses" as any) as any)
            .select("id, created_at, title, result, hook_strength, status, improvement_suggestions")
            .eq("user_id", user_id)
            .eq("persona_id", persona_id)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(15)
        : (supabase.from("analyses" as any) as any)
            .select("id, created_at, title, result, hook_strength, status, improvement_suggestions")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .is("persona_id", null)
            .order("created_at", { ascending: false })
            .limit(15),
      // 2. AI profile
      (supabase as any).from("user_ai_profile").select("*").eq("user_id", user_id).maybeSingle(),
      // 3. Creative memory
      (supabase as any)
        .from("creative_memory")
        .select("hook_type, hook_score, platform, notes, created_at")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(20),
      // 4. Platform connections — STRICT persona scope
      supabase
        .from("platform_connections" as any)
        .select("platform, status, ad_accounts, selected_account_id, connected_at, persona_id")
        .eq("user_id", user_id)
        .eq("status", "active")
        .then(async (r: any) => {
          if (r.error?.code === "42P01") return { data: [], error: null };
          const all = (r.data || []) as any[];
          if (persona_id) {
            const scoped = all.filter((c: any) => c.persona_id === persona_id);
            // Fallback: if no connection for this persona, try connections without persona_id
            if (scoped.length > 0) return { data: scoped };
            const global = all.filter((c: any) => !c.persona_id);
            return { data: global.length > 0 ? global : all.slice(0, 1) };
          }
          return { data: all.filter((c: any) => !c.persona_id) };
        }),
      // 5. Ads data imports
      (supabase as any)
        .from("ads_data_imports")
        .select("platform, result, created_at")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(3),
      // 6. Persona row
      persona_id
        ? supabase.from("personas").select("result").eq("id", persona_id).maybeSingle()
        : Promise.resolve({ data: null }),
      // 7. Learned patterns
      (supabase as any)
        .from("learned_patterns")
        .select("pattern_key, is_winner, avg_ctr, avg_roas, confidence, insight_text, variables, persona_id")
        .eq("user_id", user_id)
        .order("confidence", { ascending: false })
        .limit(60),
      // 7b. Global benchmarks — anonymous aggregate patterns from all accounts (user_id=null)
      // These are what the AI uses as market benchmarks — never reveals source accounts
      (supabase as any)
        .from("learned_patterns")
        .select("pattern_key, avg_ctr, avg_roas, is_winner, confidence, insight_text, variables")
        .is("user_id", null)
        .like("pattern_key", "global_benchmark::%")
        .gte("confidence", 0.3)
        .order("avg_ctr", { ascending: false })
        .limit(20)
        .then((r: any) => (r.error ? { data: [] } : r)),
      // 7c. Global market summary — synthesized narrative from aggregate-intelligence
      (supabase as any)
        .from("learned_patterns")
        .select("insight_text, variables")
        .is("user_id", null)
        .eq("pattern_key", "global_market_summary")
        .maybeSingle()
        .then((r: any) => (r.error ? { data: null } : r)),
      // 8. Daily snapshots
      // 8. Daily snapshots — filter at DB level
      persona_id
        ? (supabase as any)
            .from("daily_snapshots")
            .select(
              "date, account_name, total_spend, avg_ctr, active_ads, top_ads, ai_insight, yesterday_spend, yesterday_ctr, raw_period",
            )
            .eq("user_id", user_id)
            .eq("persona_id", persona_id)
            .order("date", { ascending: false })
            .limit(7)
        : (supabase as any)
            .from("daily_snapshots")
            .select(
              "date, account_name, total_spend, avg_ctr, active_ads, top_ads, ai_insight, yesterday_spend, yesterday_ctr, raw_period",
            )
            .eq("user_id", user_id)
            .order("date", { ascending: false })
            .limit(7),
      // 9. Preflight history
      (supabase as any)
        .from("preflight_results")
        .select("created_at, score, verdict, platform, market, format")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(10)
        .then((r: any) => (r.error ? { data: [] } : r)),
      // 10. Active account alerts
      (supabase as any)
        .from("account_alerts")
        .select("type, urgency, ad_name, campaign_name, detail, kpi_label, kpi_value, action_suggestion, created_at")
        .eq("user_id", user_id)
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .limit(5)
        .then((r: any) => (r.error ? { data: [] } : r)),
      // 11. Telegram connection status
      (supabase as any)
        .from("telegram_connections")
        .select("chat_id, telegram_username, connected_at")
        .eq("user_id", user_id)
        .eq("active", true)
        .maybeSingle()
        .then((r: any) => (r.error ? { data: null } : r)),
      // 11b. Cross-account winners — high confidence patterns from other personas
      (supabase as any)
        .from("learned_patterns")
        .select("pattern_key, is_winner, avg_ctr, avg_roas, confidence, insight_text, persona_id")
        .eq("user_id", user_id)
        .eq("is_winner", true)
        .gte("confidence", 0.7)
        .order("avg_ctr", { ascending: false })
        .limit(5)
        .then((r: any) =>
          r.error
            ? { data: [] }
            : {
                data: (r.data || []).filter((p: any) => p.persona_id !== persona_id),
              },
        ),
      // 12. Chat memory — fetch all user memories, scoped by persona when available
      persona_id
        ? (supabase as any)
            .from("chat_memory")
            .select("memory_text, memory_type, importance, created_at, persona_id")
            .eq("user_id", user_id)
            .or(`persona_id.eq.${persona_id},persona_id.is.null`)
            .order("importance", { ascending: false })
            .limit(30)
        : (supabase as any)
            .from("chat_memory")
            .select("memory_text, memory_type, importance, created_at, persona_id")
            .eq("user_id", user_id)
            .order("importance", { ascending: false })
            .limit(30),
      // 13. Few-shot examples
      (supabase as any)
        .from("chat_examples")
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
      (supabase as any)
        .from("trend_intelligence")
        .select("term,angle,ad_angle,niches,category,days_active,appearances,last_volume,peak_volume")
        .eq("is_active", true)
        .eq("is_blocked", false)
        .lt("risk_score", 7)
        .order("last_volume", { ascending: false })
        .limit(10)
        .then((r: any) => (r.error ? { data: [] } : r)),
      // 16. Trend baseline
      (supabase as any)
        .from("trend_platform_baseline")
        .select("p75_volume,p90_volume")
        .eq("geo", "BR")
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r: any) => (r.error ? { data: null } : r)),
    ]);

    // ── 4. Build context ──────────────────────────────────────────────────────
    const analyses = (recentAnalyses || []) as any[];
    // creative_memory: scope to persona if available
    const allMemory = (creativeMemory || []) as any[];
    const memory = allMemory; // creative_memory doesn't have persona_id yet — use all, AI persona context prevents cross-contamination
    const connections = (platformConns || []) as any[];
    const imports = (adsImports || []) as any[];

    // chat_memory: DB query already handles scoping via OR clause
    // persona_id present → returns persona-specific + global (null) memories
    // no persona_id → returns all user memories (global fallback)
    const persistentMemories = (chatMemories || []) as any[];

    // few-shot examples: liked responses used as style/format guide
    const fewShotExamples = (chatExamples || []) as any[];
    const fewShotBlock = fewShotExamples.length
      ? fewShotExamples
          .map((ex: any, i: number) => {
            const blocks = Array.isArray(ex.assistant_blocks) ? ex.assistant_blocks : [];
            const responseText = blocks
              .map((b: any) => `${b.title ? `[${b.title}] ` : ""}${b.content || ""}`.trim())
              .filter(Boolean)
              .join(" / ")
              .slice(0, 300);
            return `Exemplo ${i + 1}:\n  Pergunta: "${String(ex.user_message || "").slice(0, 150)}"\n  Resposta aprovada: "${responseText}"`;
          })
          .join("\n\n")
      : null;
    const memorySummary = persistentMemories.length
      ? persistentMemories
          .sort((a: any, b: any) => (b.importance || 0) - (a.importance || 0))
          .slice(0, 30)
          .map((m: any) => {
            const imp = m.importance >= 5 ? "🔴" : m.importance >= 4 ? "🟡" : "⚪";
            return `${imp} [${m.memory_type || "context"}] ${m.memory_text}`;
          })
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
      .sort((a, b) => b[1].total / b[1].count - a[1].total / a[1].count)
      .slice(0, 3)
      .map(([type, d]) => `${type} (avg ${(d.total / d.count).toFixed(1)}, ${d.count} uses)`);

    const recentSummary = analyses
      .slice(0, 5)
      .map((a: any) => {
        const r = a.result as any;
        return [
          `  - "${a.title || r?.market_guess || "untitled"}"`,
          `score:${r?.hook_score ?? "—"}`,
          `hook_type:${r?.hook_type || a.hook_strength || "—"}`,
          `format:${r?.format || "—"}`,
          `market:${r?.market_guess || "—"}`,
          r?.summary ? `summary:"${String(r.summary).slice(0, 80)}"` : "",
          `date:${a.created_at?.split("T")[0]}`,
        ]
          .filter(Boolean)
          .join(" | ");
      })
      .join("\n");

    const connectedPlatforms = connections.map((c: any) => {
      const accounts = (c.ad_accounts as any[]) || [];
      const selectedId = c.selected_account_id || accounts[0]?.id;
      const selectedAcc = accounts.find((a: any) => a.id === selectedId) || accounts[0];
      const accLabel = selectedAcc ? `active:${selectedAcc.name || selectedAcc.id}` : `${accounts.length} accounts`;
      return `${c.platform}(${accLabel})`;
    });

    // Extract business goal if set
    const businessGoal = (aiProfile as any)?.ai_recommendations?.business_goal || null;

    const persona = personaRow as any;
    const personaName = (persona?.result as any)?.name || "";
    const personaCtx = persona?.result
      ? `ACTIVE WORKSPACE: ${personaName} | ${(persona.result as any)?.headline || ""}
Market: ${(persona.result as any)?.preferred_market || "unknown"} | Age: ${(persona.result as any)?.age || "—"}
Platforms: ${((persona.result as any)?.best_platforms || []).join(", ")}
Language style: ${(persona.result as any)?.language_style || "—"}`
      : "";

    const importInsights = imports
      .map((i: any) => {
        const r = i.result as any;
        if (!r?.summary) return "";
        return `${i.platform}: ${r.summary} | best format: ${r.patterns?.best_format || "?"} | best hook: ${r.patterns?.best_hook_style || "?"}`;
      })
      .filter(Boolean)
      .join("\n");

    // Learned patterns — what the product knows about this user
    // Scope patterns to this persona — prefer persona-specific, include global (null persona_id), exclude other personas
    const allRawPatterns = (learnedPatterns || []) as any[];
    const patterns = persona_id
      ? allRawPatterns.filter((p: any) => p.persona_id === persona_id || p.persona_id === null).slice(0, 30)
      : allRawPatterns.filter((p: any) => p.persona_id === null).slice(0, 30);
    const winners = patterns.filter((p) => p.is_winner && p.confidence > 0.2);
    // Business profile — permanent account intelligence (who this company really is)
    const businessProfile = patterns.find((p) => p.pattern_key.startsWith("business_profile_"));
    const competitors = patterns.filter((p) => p.pattern_key.startsWith("competitor_"));
    const perfPatterns = patterns.filter((p) => p.pattern_key.startsWith("perf_"));
    const preflightPatterns = patterns.filter((p) => p.pattern_key.startsWith("preflight_"));
    const actionPatterns = patterns.filter((p) => p.pattern_key.startsWith("action_"));
    // Market intelligence patterns — from Google Trends + Meta Ads Library
    const marketPatterns = patterns
      .filter((p) => p.pattern_key.startsWith("market_intel_") || p.pattern_key.startsWith("market_competitor_"))
      .sort((a: any, b: any) => new Date(b.last_updated || 0).getTime() - new Date(a.last_updated || 0).getTime());
    const latestMarket = marketPatterns.find((p) => p.pattern_key.startsWith("market_intel_"));
    const competitorSignals = marketPatterns.filter((p) => p.pattern_key.startsWith("market_competitor_")).slice(0, 5);

    // ── Trend intelligence — já carregado no Promise.all acima ──────────────
    let trendContext = "";
    try {
      const trendsData = (activeTrends || []) as any[];
      if (trendsData.length > 0) {
        // Use calibrated defaults for Brave Search volumes (50-70 range)
        // Matches the scoring in trend-watcher/index.ts
        const p75 = (trendBaseline as any)?.p75_volume || 55;
        const p90 = (trendBaseline as any)?.p90_volume || 65;
        const scored = trendsData
          .map((t: any) => {
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
          })
          .sort((a: any, b: any) => b.relevance_score - a.relevance_score);
        trendContext =
          `=== TRENDS ATIVAS NO BRASIL HOJE ===\n` +
          `(Baseline: normal=${p75}, viral>=${p90})\n` +
          scored
            .map(
              (t: any) =>
                `• "${t.term}" [${t.category}] — ${t.angle} | Score: ${t.relevance_score}/100` +
                (t.appearances > 1 ? ` | 🔄 voltou ${t.appearances}x` : "") +
                (t.days_active > 1 ? ` | ${t.days_active} dias ativa` : "") +
                `\n  → Ângulo criativo: ${t.ad_angle}` +
                (t.niches?.length ? `\n  → Nichos: ${t.niches.join(", ")}` : ""),
            )
            .join("\n");
      }
    } catch (trendErr) {
      console.error("[trend-ctx error]", String(trendErr));
    }

    const learnedCtx = [
      winners.length
        ? `PADRÕES VENCEDORES:\n${winners
            .slice(0, 5)
            .map((p) => `  - ${p.insight_text} (confiança: ${(p.confidence * 100).toFixed(0)}%)`)
            .join("\n")}`
        : "",
      perfPatterns.length
        ? `PERFORMANCE HISTÓRICA:\n${perfPatterns
            .slice(0, 5)
            .map((p) => `  - ${p.insight_text}`)
            .join("\n")}`
        : "",
      competitors.length
        ? `CONCORRENTES ANALISADOS:\n${competitors
            .slice(0, 5)
            .map((p) => `  - ${p.insight_text}`)
            .join("\n")}`
        : "",
      preflightPatterns.length
        ? `QUALIDADE DE SCRIPT (preflight):\n${preflightPatterns
            .slice(0, 3)
            .map((p) => `  - ${p.insight_text}`)
            .join("\n")}`
        : "",
      actionPatterns.length
        ? `AÇÕES EXECUTADAS:\n${actionPatterns
            .slice(0, 3)
            .map((p) => `  - ${p.insight_text}`)
            .join("\n")}`
        : "",
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
          .filter((g) => {
            const vars = (g.variables as any) || {};
            return (vars.niche === "all" || vars.niche === niche) && (vars.market === "all" || vars.market === market);
          })
          .slice(0, 8);
        if (!relevant.length) return "";
        const summary = (marketSummaryRow as any)?.insight_text || "";
        const lines = relevant
          .map((g) => `  - ${g.insight_text}${g.avg_ctr ? ` (benchmark: CTR ${(g.avg_ctr * 100).toFixed(2)}%)` : ""}`)
          .join("\n");
        return `=== BENCHMARKS DO SETOR (dados agregados, anônimos) ===\n${summary ? `${summary}\n` : ""}${lines}\n(Use como referência de mercado. Fraseie como "dados do setor" ou "em campanhas similares". Nunca revele que são dados de outras contas.)`;
      })(),
      // Business profile — who this company really is, compliance rules
      businessProfile
        ? `=== PERFIL DO NEGÓCIO (pesquisado) ===\n` +
          `Indústria: ${(businessProfile.variables as any)?.industry}\n` +
          `Licença: ${(businessProfile.variables as any)?.license_status}\n` +
          `Compliance obrigatório:\n${((businessProfile.variables as any)?.compliance_rules || []).map((r: string) => `  - ${r}`).join("\n")}\n` +
          `Frases proibidas: ${((businessProfile.variables as any)?.forbidden_phrases || []).join(", ")}\n` +
          `Tom da marca: ${(businessProfile.variables as any)?.brand_tone}\n` +
          `Oportunidades de marketing: ${((businessProfile.variables as any)?.marketing_opportunities || []).slice(0, 2).join(" | ")}`
        : "",
      // Real-time market context — Google Trends + Meta Ads Library
      latestMarket
        ? `=== CONTEXTO DE MERCADO (${(latestMarket.variables as any)?.fetched_at?.slice(0, 10) || "hoje"}) ===\n` +
          `${latestMarket.insight_text}\n` +
          `Ação recomendada: ${(latestMarket.variables as any)?.action || ""}\n` +
          `Concorrentes ativos: ${(latestMarket.variables as any)?.competitor_count || 0} | Formatos dominantes: ${((latestMarket.variables as any)?.top_competitor_formats || []).join(", ")}`
        : "",
      competitorSignals.length
        ? `CONCORRENTES NO AR AGORA (Meta Ads Library):\n${competitorSignals.map((p) => `  - ${p.insight_text}`).join("\n")}`
        : "",
      trendContext || "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // ── 4b. Fetch live Meta Ads data (with historical date detection) ──────────
    // Detect if user is asking about a specific historical period
    const historicalMatch = message.match(
      /(?:em|in|de|desde|from|between|entre|no mês de|no dia|week of|semana de)?\s*(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|january|february|march|april|may|june|july|august|september|october|november|december)\s*(?:de\s*)?(?:20\d{2})?|(?:\d{1,2})[\/\-](?:\d{1,2})(?:[\/\-](?:20)?\d{2,4})?|(?:last|últim[ao]s?|past)\s+(?:\d+)\s+(?:days?|dias?|weeks?|semanas?|months?|meses?)/i,
    );
    let historicalSince: string | null = null;
    let historicalUntil: string | null = null;

    if (historicalMatch) {
      try {
        const matched = historicalMatch[0].toLowerCase();
        const now = new Date();
        const MONTHS_PT: Record<string, number> = {
          janeiro: 0,
          fevereiro: 1,
          março: 2,
          abril: 3,
          maio: 4,
          junho: 5,
          julho: 6,
          agosto: 7,
          setembro: 8,
          outubro: 9,
          novembro: 10,
          dezembro: 11,
          january: 0,
          february: 1,
          march: 2,
          april: 3,
          may: 4,
          june: 5,
          july: 6,
          august: 7,
          september: 8,
          october: 9,
          november: 10,
          december: 11,
        };
        // Month name match (e.g. "janeiro", "março de 2024")
        const monthMatch = matched.match(
          /(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|january|february|march|april|may|june|july|august|september|october|november|december)/,
        );
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
          const ms =
            unit.startsWith("day") || unit.startsWith("dia")
              ? n * 86400000
              : unit.startsWith("week") || unit.startsWith("seman")
                ? n * 7 * 86400000
                : n * 30 * 86400000;
          historicalSince = new Date(Date.now() - ms).toISOString().split("T")[0];
          historicalUntil = new Date().toISOString().split("T")[0];
        }
        // Only use historical if it's actually outside our default 30-day window
        if (historicalSince) {
          const daysDiff = (Date.now() - new Date(historicalSince).getTime()) / 86400000;
          if (daysDiff <= 32) {
            historicalSince = null;
            historicalUntil = null;
          } // within default window
        }
      } catch (_) {
        historicalSince = null;
        historicalUntil = null;
      }
    }

    let liveMetaData = "";
    const metaConn = (connections as any[]).find((c: any) => c.platform === "meta");
    if (metaConn) {
      try {
        const { data: allConns } = await supabase
          .from("platform_connections" as any)
          .select("access_token, ad_accounts, selected_account_id, persona_id")
          .eq("user_id", user_id)
          .eq("platform", "meta")
          .eq("status", "active");
        const allC = (allConns as any[]) || [];
        // Find connection: first try exact persona match, then fallback to any active connection
        const tokenRow = persona_id
          ? allC.find((c: any) => c.persona_id === persona_id) ||
            allC.find((c: any) => !c.persona_id) ||
            allC[0] ||
            null
          : allC[0] || null;

        if (tokenRow?.access_token) {
          const token = tokenRow.access_token;
          const accs = (tokenRow.ad_accounts as any[]) || [];
          const selId = tokenRow.selected_account_id;
          const activeAcc = (selId && accs.find((a: any) => a.id === selId)) || accs[0];

          if (activeAcc?.id) {
            const since = historicalSince || new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split("T")[0];
            const until = historicalUntil || new Date().toISOString().split("T")[0];
            // Lifetime since (for all-time top performers)
            const lifetimeSince = new Date(Date.now() - 3 * 365 * 24 * 3600 * 1000).toISOString().split("T")[0];

            // ── In-memory cache (15 min per account) ─────────────────────────
            // Prevents redundant Meta API calls. Evicts expired keys on each write.
            const cacheKey = `${activeAcc.id}:${since}:${until}`;
            const now_ts = Date.now();
            const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
            if (!(globalThis as any).__metaCache) (globalThis as any).__metaCache = {};
            const cached = (globalThis as any).__metaCache[cacheKey];
            let adsRaw: any = null,
              campsRaw: any = null,
              adsetsRaw: any = null,
              timeSeriesRaw: any = null,
              placementRaw: any = null;

            if (cached && now_ts - cached.ts < CACHE_TTL) {
              adsRaw = cached.adsRaw;
              campsRaw = cached.campsRaw;
              adsetsRaw = cached.adsetsRaw;
              timeSeriesRaw = cached.timeSeriesRaw;
              placementRaw = cached.placementRaw;
            } else {
              // Comprehensive Meta Ads data fetch: 90 days + lifetime top performers
              const fields =
                "campaign_name,adset_name,ad_name,spend,impressions,clicks,ctr,cpm,cpc,actions,video_play_actions,frequency,reach";
              const [r1, r2, r3, r4, r5, r6] = await Promise.allSettled([
                // 90-day ad insights sorted by spend
                fetch(
                  `https://graph.facebook.com/v21.0/${activeAcc.id}/insights?level=ad&fields=${fields}&time_range={"since":"${since}","until":"${until}"}&sort=spend_descending&limit=100&access_token=${token}`,
                ),
                // All campaigns including paused/ended — full history
                fetch(
                  `https://graph.facebook.com/v21.0/${activeAcc.id}/campaigns?fields=name,status,daily_budget,lifetime_budget,objective,effective_status,created_time,start_time,stop_time&limit=100&access_token=${token}`,
                ),
                // Adsets with targeting + budget + status
                fetch(
                  `https://graph.facebook.com/v21.0/${activeAcc.id}/adsets?fields=name,status,effective_status,daily_budget,lifetime_budget,targeting,optimization_goal,bid_strategy,bid_amount,campaign_id&limit=100&access_token=${token}`,
                ),
                // Monthly time series — last 90 days daily
                fetch(
                  `https://graph.facebook.com/v21.0/${activeAcc.id}/insights?fields=spend,impressions,clicks,ctr,cpm,actions&time_range={"since":"${since}","until":"${until}"}&time_increment=monthly&limit=12&access_token=${token}`,
                ),
                // Placement breakdown 90 days
                fetch(
                  `https://graph.facebook.com/v21.0/${activeAcc.id}/insights?fields=spend,impressions,clicks,ctr,cpm&breakdowns=publisher_platform,platform_position&time_range={"since":"${since}","until":"${until}"}&sort=spend_descending&limit=20&access_token=${token}`,
                ),
                // Lifetime top ads — all-time best performers (3 years)
                fetch(
                  `https://graph.facebook.com/v21.0/${activeAcc.id}/insights?level=ad&fields=${fields}&time_range={"since":"${lifetimeSince}","until":"${until}"}&sort=spend_descending&limit=50&access_token=${token}`,
                ),
              ]);
              adsRaw = r1.status === "fulfilled" ? await r1.value.json() : null;
              campsRaw = r2.status === "fulfilled" ? await r2.value.json() : null;
              adsetsRaw = r3.status === "fulfilled" ? await r3.value.json() : null;
              timeSeriesRaw = r4.status === "fulfilled" ? await r4.value.json() : null;
              placementRaw = r5.status === "fulfilled" ? await r5.value.json() : null;
              const lifetimeAdsRaw = r6.status === "fulfilled" ? await r6.value.json() : null;

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
              const isExpired =
                campsRaw.error.code === 190 || String(campsRaw.error.type || "").includes("OAuthException");
              liveMetaData += isExpired
                ? `CAMPAIGNS: Token expirado — peça ao usuário para reconectar o Meta Ads em Contas. NÃO emita tool_call.\n`
                : `CAMPAIGNS: Error — ${campsRaw.error.message}. Answer based on this error, do NOT emit list_campaigns tool_call.\n`;
            } else if (campsRaw?.data?.length) {
              const lines = campsRaw.data
                .slice(0, 30)
                .map(
                  (c: any) =>
                    `  ${c.name}: ${c.effective_status || c.status} | budget=${c.daily_budget ? `$${(parseInt(c.daily_budget) / 100).toFixed(0)}/day` : c.lifetime_budget ? `$${(parseInt(c.lifetime_budget) / 100).toFixed(0)} total` : "no budget"} | ${c.objective}`,
                )
                .join("\n");
              liveMetaData += `CAMPAIGNS (${campsRaw.data.length}):\n${lines}\n`;
            } else {
              liveMetaData += `CAMPAIGNS: Nenhuma campanha encontrada.\n`;
            }

            // FIX 4: Adsets with targeting intel
            if (adsetsRaw?.data?.length) {
              const adsetLines = adsetsRaw.data
                .slice(0, 20)
                .map((s: any) => {
                  const age =
                    s.targeting?.age_min && s.targeting?.age_max
                      ? `${s.targeting.age_min}-${s.targeting.age_max}`
                      : null;
                  const interests = (s.targeting?.flexible_spec?.[0]?.interests || [])
                    .slice(0, 3)
                    .map((i: any) => i.name)
                    .join(", ");
                  const geos = (s.targeting?.geo_locations?.countries || []).join(",");
                  const budget = s.daily_budget
                    ? `$${(parseInt(s.daily_budget) / 100).toFixed(0)}/day`
                    : s.lifetime_budget
                      ? `$${(parseInt(s.lifetime_budget) / 100).toFixed(0)} total`
                      : "no budget";
                  return `  ${s.name}: ${s.effective_status || s.status} | ${budget} | ${s.optimization_goal || ""}${age ? ` | age ${age}` : ""}${geos ? ` | geo:${geos}` : ""}${interests ? ` | interests:${interests}` : ""}`;
                })
                .join("\n");
              liveMetaData += `ADSETS (${adsetsRaw.data.length}):\n${adsetLines}\n`;
            }

            // Ads performance
            if (adsRaw?.error) {
              const isExpired =
                adsRaw.error.code === 190 ||
                String(adsRaw.error.message || "")
                  .toLowerCase()
                  .includes("token") ||
                String(adsRaw.error.type || "").includes("OAuthException");
              liveMetaData += isExpired
                ? `ADS: Token expirado — diga ao usuário para reconectar o Meta Ads em Contas.\n`
                : `ADS: Erro ao buscar dados — ${adsRaw.error.message}\n`;
            } else if (adsRaw?.data?.length) {
              // FIX 1: Show all 50 with smarter truncation
              const adLines = adsRaw.data
                .slice(0, 50)
                .map((ad: any) => {
                  const purchases = ad.actions?.find((a: any) => a.action_type === "purchase")?.value || "0";
                  const leads = ad.actions?.find((a: any) => a.action_type === "lead")?.value || "";
                  const hookRate = ad.video_play_actions?.find((a: any) => a.action_type === "video_play")?.value;
                  const hr = hookRate
                    ? ` hook=${((parseInt(hookRate) / Math.max(parseInt(ad.impressions || 1), 1)) * 100).toFixed(1)}%`
                    : "";
                  const conv = leads ? ` leads=${leads}` : purchases !== "0" ? ` purch=${purchases}` : "";
                  return `  ${ad.ad_name}: spend=$${parseFloat(ad.spend || 0).toFixed(0)} ctr=${ad.ctr}% cpm=$${parseFloat(ad.cpm || 0).toFixed(1)} freq=${ad.frequency || "?"}${hr}${conv}`;
                })
                .join("\n");
              liveMetaData += `ADS (${adsRaw.data.length} found, top by spend):\n${adLines}\n`;
            } else {
              liveMetaData += `ADS: Nenhum gasto de anúncio no período.\n`;
            }

            // ALL-TIME TOP PERFORMERS (3 years lifetime)
            if (lifetimeAdsRaw?.data?.length) {
              const lifetimeLines = lifetimeAdsRaw.data
                .slice(0, 20)
                .map((ad: any) => {
                  const purchases = ad.actions?.find((a: any) => a.action_type === "purchase")?.value || "0";
                  const conv = purchases !== "0" ? ` purch=${purchases}` : "";
                  return `  ${ad.ad_name}: spend=$${parseFloat(ad.spend || 0).toFixed(0)} ctr=${ad.ctr}% impr=${parseInt(ad.impressions || 0).toLocaleString()}${conv} | ${ad.campaign_name}`;
                })
                .join("\n");
              liveMetaData += `\nALL-TIME TOP ADS (últimos 3 anos):\n${lifetimeLines}\n`;
            }

            // Monthly breakdown — macro trends
            if (timeSeriesRaw?.data?.length) {
              const monthlyLines = timeSeriesRaw.data
                .filter((d: any) => parseFloat(d.spend || 0) > 0)
                .map((d: any) => {
                  const purch = d.actions?.find((a: any) => a.action_type === "purchase")?.value || "";
                  return `  ${d.date_start?.slice(0, 7)}: spend=$${parseFloat(d.spend || 0).toFixed(0)} ctr=${parseFloat(d.ctr || 0).toFixed(2)}% cpm=$${parseFloat(d.cpm || 0).toFixed(1)}${purch ? ` purch=${purch}` : ""}`;
                })
                .join("\n");
              if (monthlyLines) liveMetaData += `MONTHLY BREAKDOWN:\n${monthlyLines}\n`;
            }

            // Daily trend
            if (false && timeSeriesRaw?.data?.length) {
              const series = timeSeriesRaw.data
                .filter((d: any) => parseFloat(d.spend || 0) > 0)
                .slice(-14)
                .map((d: any) => {
                  const purch = d.actions?.find((a: any) => a.action_type === "purchase")?.value || "";
                  return `  ${d.date_start}: spend=$${parseFloat(d.spend || 0).toFixed(0)} ctr=${parseFloat(d.ctr || 0).toFixed(2)}% cpm=$${parseFloat(d.cpm || 0).toFixed(1)}${purch ? ` purch=${purch}` : ""}`;
                })
                .join("\n");
              if (series) {
                // Compute trend
                const days = timeSeriesRaw.data.filter((d: any) => parseFloat(d.spend || 0) > 0);
                const half = Math.floor(days.length / 2);
                const firstHalf = days.slice(0, half);
                const secondHalf = days.slice(half);
                const avgCtr1 =
                  firstHalf.reduce((s: number, d: any) => s + parseFloat(d.ctr || 0), 0) /
                  Math.max(firstHalf.length, 1);
                const avgCtr2 =
                  secondHalf.reduce((s: number, d: any) => s + parseFloat(d.ctr || 0), 0) /
                  Math.max(secondHalf.length, 1);
                const trend =
                  avgCtr2 > avgCtr1 * 1.05 ? "↑ melhorando" : avgCtr2 < avgCtr1 * 0.95 ? "↓ piorando" : "→ estável";
                liveMetaData += `TENDÊNCIA DIÁRIA (${trend} CTR):\n${series}\n`;
              }
            }

            // FIX 2: Placement breakdown
            if (placementRaw?.data?.length) {
              const placements = placementRaw.data
                .filter((p: any) => parseFloat(p.spend || 0) > 0)
                .slice(0, 10)
                .map(
                  (p: any) =>
                    `  ${p.publisher_platform || ""}/${p.platform_position || ""}: spend=$${parseFloat(p.spend || 0).toFixed(0)} ctr=${parseFloat(p.ctr || 0).toFixed(2)}% cpm=$${parseFloat(p.cpm || 0).toFixed(1)}`,
                )
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

    // Google Ads live data — disabled (see GOOGLE_ADS_BACKUP.md)
    const liveGoogleData = "";

        // Cross-platform synthesis — disabled (see GOOGLE_ADS_BACKUP.md)
    const crossPlatformCtx = "";
    if (false) {
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
      const verdicts = pfHistory.reduce((acc: any, r: any) => {
        acc[r.verdict] = (acc[r.verdict] || 0) + 1;
        return acc;
      }, {});
      const lastRun = pfHistory[0];
      const trend =
        pfHistory.length >= 3
          ? pfHistory
              .slice(0, 3)
              .map((r: any) => r.score)
              .join(" → ")
          : null;
      return [
        `PRE-FLIGHT HISTORY (${pfHistory.length} runs):`,
        `  Avg score: ${avgScore}/100 | Verdicts: ${Object.entries(verdicts)
          .map(([v, c]) => `${v}:${c}`)
          .join(", ")}`,
        lastRun
          ? `  Last run: score ${lastRun.score} | ${lastRun.verdict} | ${lastRun.platform} / ${lastRun.market} / ${lastRun.format}`
          : "",
        trend ? `  Score trend (last 3): ${trend}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })();

    const richContext = [
      // ── Identidade do usuário — SEMPRE primeiro ───────────────────────────
      (() => {
        const isLifetime = !!(profileRow as any)?.email && !!LIFETIME_ACCOUNTS[(profileRow as any)?.email];
        const planLabel = isLifetime
          ? "Studio Lifetime (acesso ilimitado, sem restrições)"
          : planKey === "studio" ? "Studio ($149/mês — ilimitado)"
          : planKey === "pro"    ? "Pro ($49/mês — 200 msgs/dia)"
          : planKey === "maker"  ? "Maker ($19/mês — 50 msgs/dia)"
          : "Free (3 msgs/dia)";
        return `PLANO DO USUÁRIO: ${planLabel}
IDIOMA DO USUÁRIO: ${uiLang === "pt" ? "Português — responda SEMPRE em português" : uiLang === "es" ? "Español — responde SIEMPRE en español" : "English — always respond in English"}
REGRA: NUNCA sugira upgrade de plano a não ser que o usuário pergunte sobre planos. NUNCA invente limitações de features baseado no plano.`;
      })(),
      personaCtx,
      `CONNECTED PLATFORMS: ${connectedPlatforms.length ? connectedPlatforms.join(", ") : "none"}`,
      liveMetaData || "",
      // liveGoogleData — disabled
      // crossPlatformCtx — disabled
      // Analyses count removed — internal data, not actionable for user
      topHooks.length ? `TOP HOOK TYPES: ${topHooks.join(", ")}` : "",
      recentSummary ? `RECENT 5 ANALYSES:\n${recentSummary}` : "",
      importInsights ? `IMPORTED DATA:\n${importInsights}` : "",
      learnedCtx
        ? `=== APRENDIZADO DA CONTA ===\n${learnedCtx}\n(Use esses padrões para personalizar hooks, scripts e recomendações)`
        : "",
      (() => {
        const snaps = (dailySnapshots || []) as any[];
        if (!snaps.length) return "";
        const latest = snaps[0];
        const prev = snaps[1];
        const ctrDelta = prev
          ? (((latest.avg_ctr - prev.avg_ctr) / Math.max(prev.avg_ctr, 0.001)) * 100).toFixed(1)
          : null;
        const spendDelta =
          prev && prev.total_spend > 0
            ? (((latest.total_spend - prev.total_spend) / prev.total_spend) * 100).toFixed(1)
            : null;
        const topAds = (latest.top_ads as any[]) || [];
        const toScale = topAds.filter((a: any) => a.isScalable).slice(0, 3);
        const toPause = topAds.filter((a: any) => a.needsPause).slice(0, 3);
        const fatigued = topAds.filter((a: any) => a.isFatigued).slice(0, 3);
        const aiActions = ((latest.raw_period as any)?.actions || []) as any[];
        return [
          `=== INTELLIGENCE DIÁRIA — ${latest.date} (${latest.account_name || "conta"}) ===`,
          `Spend 7d: R$${(latest.total_spend || 0).toFixed(0)} | CTR médio: ${((latest.avg_ctr || 0) * 100).toFixed(2)}% | ${latest.active_ads || 0} ads ativos`,
          ctrDelta
            ? `Vs semana anterior: CTR ${parseFloat(ctrDelta) > 0 ? "+" : ""}${ctrDelta}% | Spend ${parseFloat(spendDelta || "0") > 0 ? "+" : ""}${spendDelta || "0"}%`
            : "",
          latest.yesterday_spend > 0
            ? `Ontem: R$${(latest.yesterday_spend || 0).toFixed(0)} spend | CTR ${((latest.yesterday_ctr || 0) * 100).toFixed(2)}%`
            : "",
          toScale.length
            ? `ESCALAR AGORA (alta performance): ${toScale.map((a: any) => `"${a.name?.slice(0, 35)}" CTR ${(a.ctr * 100)?.toFixed(2)}%`).join(" | ")}`
            : "",
          toPause.length
            ? `PAUSAR (gastando sem retorno): ${toPause.map((a: any) => `"${a.name?.slice(0, 35)}" CTR ${(a.ctr * 100)?.toFixed(2)}% R$${a.spend?.toFixed(0)}`).join(" | ")}`
            : "",
          fatigued.length
            ? `FADIGA CRIATIVA (freq alta): ${fatigued.map((a: any) => `"${a.name?.slice(0, 30)}" freq ${a.frequency?.toFixed(1)}`).join(" | ")}`
            : "",
          topAds.slice(0, 5).length
            ? `TOP ADS:
${topAds
  .slice(0, 5)
  .map(
    (a: any, i: number) =>
      `  ${i + 1}. "${a.name?.slice(0, 40)}" | CTR ${(a.ctr * 100)?.toFixed(2)}% | R$${a.spend?.toFixed(0)} spend${a.conversions > 0 ? ` | ${a.conversions} conv` : ""}${a.deltaCtr ? ` | ${parseFloat(a.deltaCtr?.toFixed(1)) > 0 ? "+" : ""}${a.deltaCtr?.toFixed(1)}% vs sem. ant` : ""}`,
  )
  .join("\n")}`
            : "",
          aiActions.length
            ? `AÇÕES RECOMENDADAS:\n${aiActions.map((a: any) => `  [${a.urgencia?.toUpperCase()}] ${a.tipo?.toUpperCase()}: "${a.anuncio?.slice(0, 35)}" — ${a.motivo}`).join("\n")}`
            : "",
          latest.ai_insight ? `\nINSIGHT DO DIA: ${latest.ai_insight}` : "",
          snaps.length > 1
            ? `\nHISTÓRICO:\n${snaps
                .slice(0, 7)
                .map(
                  (s: any) =>
                    `  ${s.date}: CTR ${((s.avg_ctr || 0) * 100).toFixed(2)}% / R$${(s.total_spend || 0).toFixed(0)} / ${s.active_ads || 0} ads`,
                )
                .join("\n")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");
      })(),
      pfCtx || "",
      (() => {
        const profile = aiProfile as any;
        if (!profile) return "";
        const directive = profile?.ai_recommendations?.weekly_directive;
        const lines = [
          // Business goal — highest priority context
          businessGoal
            ? `=== OBJETIVO DE NEGÓCIO ===\nMeta: ${businessGoal.goal}\nBudget: ${businessGoal.budget || "?"}\nCPA alvo: ${businessGoal.target_cpa || "?"}\nProgresso: ${businessGoal.progress || "sem dados"}`
            : "",
          profile.ai_summary ? `PERFIL DO USUÁRIO: ${profile.ai_summary}` : "",
          directive?.proximo_teste ? `DIRETIVA SEMANAL (Creative Director): ${directive.proximo_teste}` : "",
          directive?.resumo && directive.resumo !== profile.ai_summary ? `SITUAÇÃO DA CONTA: ${directive.resumo}` : "",
          directive?.criar_esta_semana?.length
            ? `HOOKS PROPOSTOS PARA TESTAR: ${directive.criar_esta_semana
                .slice(0, 2)
                .map((h: any) => h.hook?.slice(0, 80))
                .join(" | ")}`
            : "",
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
        const lines = alerts
          .map((a: any) => {
            const when = a.created_at
              ? new Date(a.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";
            const ad = a.ad_name ? `"${a.ad_name}"` : "";
            const camp = a.campaign_name ? ` (${a.campaign_name})` : "";
            return `  [${a.urgency?.toUpperCase() || "HIGH"}] ${a.detail}${ad ? ` — Ad: ${ad}${camp}` : ""}${a.action_suggestion ? ` → Ação: ${a.action_suggestion}` : ""}${when ? ` (${when})` : ""}`;
          })
          .join("\n");
        return `=== ALERTAS ATIVOS DA CONTA (não dispensados pelo usuário) ===\n${lines}\nEsses alertas foram gerados automaticamente. Se o usuário perguntar sobre performance ou problemas, referencie esses alertas diretamente.`;
      })(),
      (() => {
        const notes = (aiProfile as any)?.pain_point as string | null;
        if (!notes) return "";
        const items = notes
          .split("|||")
          .filter(Boolean)
          .filter((n) => !n.trim().startsWith("Usuário:") && !n.trim().startsWith("Nicho:"))
          .slice(0, 5);
        if (!items.length) return "";
        return `=== INSTRUÇÕES PERMANENTES DO USUÁRIO ===\nO usuário pediu explicitamente para você lembrar:\n${items.map((n) => `  • ${n}`).join("\n")}\n(Aplique sempre. Nunca pergunte de novo. Nunca esqueça.)`;
      })(),
      // Persistent chat memory — facts extracted from previous conversations
      memorySummary
        ? `=== MEMÓRIA PERSISTENTE — FATOS CONFIRMADOS ===\n${memorySummary}\n🔴=crítico(importância 5) 🟡=importante(4) ⚪=contexto(1-3)\nESSES FATOS SÃO VERDADEIROS. Use-os diretamente. NUNCA peça confirmação de algo que já está aqui.`
        : "",
      // Cross-account intelligence — winners from other accounts of this user
      (() => {
        const cross = (crossAccountPatterns || []) as any[];
        if (!cross.length) return "";
        const lines = cross
          .slice(0, 5)
          .map(
            (p: any) =>
              `  ✓ ${p.pattern_key?.replace(/_/g, " ")}: CTR ${(p.avg_ctr * 100).toFixed(2)}% | conf ${(p.confidence * 100).toFixed(0)}% — ${p.insight_text?.slice(0, 80) || ""}`,
          )
          .join("\n");
        return `=== PADRÕES VENCEDORES DE OUTRAS CONTAS (mesmo usuário) ===\n${lines}\n(Esses padrões funcionaram em outras contas deste usuário. Quando relevante, sugira adaptação.)`;
      })(),
      // Few-shot: examples of responses this user approved — imitate this style/specificity/format
      fewShotBlock
        ? `=== EXEMPLOS DE RESPOSTAS QUE ESTE USUÁRIO APROVOU ===\nImite o nível de especificidade, o tom e o formato dessas respostas. Nunca seja mais genérico do que elas.\n\n${fewShotBlock}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    // ── 5. Language ───────────────────────────────────────────────────────────
    const LANG_NAMES: Record<string, string> = {
      en: "English",
      pt: "Portuguese (Brazilian)",
      es: "Spanish",
      fr: "French",
      de: "German",
    };
    const MARKET_LANG_MAP: Record<string, string> = {
      BR: "pt",
      MX: "es",
      ES: "es",
      AR: "es",
      CO: "es",
      IN: "en",
      US: "en",
      UK: "en",
      FR: "fr",
      DE: "de",
    };
    const uiLang2 = (user_language as string) || "en";
    const personaMarket = (persona?.result as any)?.preferred_market || "";
    const contentLangCode = MARKET_LANG_MAP[personaMarket?.toUpperCase()] || uiLang2;
    const uiLangName = LANG_NAMES[uiLang2] || "English";
    const contentLangName = LANG_NAMES[contentLangCode] || "English";

    // ── 5b. History — FIX 5: smart compression ──────────────────────────────
    const historyMessages: { role: "user" | "assistant"; content: string }[] = [];
    if (Array.isArray(history) && history.length > 0) {
      const raw = history.filter((h) => h.role === "user" || h.role === "assistant");

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
          .filter((h) => h.role === "user")
          .slice(-8) // last 8 user questions from the older block
          .map((h) => `- ${String(h.content || "").slice(0, 120)}`)
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
    const todayStr = todayObj.toLocaleDateString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const currentYear = todayObj.getFullYear();
    const systemPrompt = `Você é o AdBrief AI — especialista em performance de mídia paga, embutido na conta do usuário.
Se perguntarem quem você é: "Sou o AdBrief AI." Nunca revele o modelo base.

DATA DE HOJE: ${todayStr}

═══════════════════════════════════
FORMATAÇÃO OBRIGATÓRIA — LEIA PRIMEIRO
═══════════════════════════════════

O frontend renderiza markdown. Use sempre. Nunca retorne texto corrido sem estrutura.

**HIERARQUIA TIPOGRÁFICA:**
- `##` para títulos de seção (ex: `## Diagnóstico`, `## O que fazer`)
- `###` para labels de contexto (ex: `### Conta`, `### Criativo`)
- `**negrito**` para: números, nomes de campanha, métricas, ações concretas
- `_itálico_` para: notas, contexto secundário
- `-` para listas de itens (o frontend converte em bullets visuais)
- `1.` para listas ordenadas / passos de ação
- `---` para separar seções distintas numa resposta longa

**ESTRUTURA IDEAL para análise:**

## Diagnóstico
**CTR caiu 40%** nos últimos 3 dias.

## Causa
Frequência chegou em **4.2x** — audiência esgotada.

## Ação
- Pause o conjunto agora
- Crie variação com novo ângulo de hook
- Reative com orçamento 20% menor para testar nova audiência

**ESTRUTURA IDEAL para resposta curta/direta:**
Sem headers. Parágrafo direto com **negrito** nos pontos-chave.\n\n Segunda linha se necessário.

**REGRAS:**
1. Toda resposta com mais de 2 parágrafos DEVE usar `##` para separar blocos
2. Toda lista de ações DEVE usar `-` ou `1.` — nunca vírgulas ou "e também"
3. **negrito** obrigatório em: números reais, nomes de campanha, CTAs de ação
4. Nunca tudo em um bloco só — `\n\n` entre parágrafos sempre
5. Respostas longas (3+ seções) sempre com `##` headers

═══════════════════════════════════
REGRAS QUE NUNCA QUEBRAM
═══════════════════════════════════

ZERO ALUCINAÇÃO DE MÉTRICAS
Nunca escreva CTR, ROAS, CPM, CPC, conversões ou qualquer número que não esteja explicitamente nos dados do contexto.
Spend $0 ativo = conta pausada ou nova. Mas CAMPAIGNS e histórico ainda são dados reais — use-os.
NUNCA diga "não vejo dados" se há campanhas no contexto, mesmo pausadas. Diga o que você vê.
Se o histórico da conversa mostra dados (tabela de campanhas, CTR mencionado), USE esses dados. Não ignore o que foi dito antes.
Dado real do contexto > qualquer generalização.

POSTURA COM DADOS PARCIAIS:
Quando há algum dado (mesmo pausado, mesmo histórico antigo): raciocine com o que tem.
"Ford Fiesta pausada com CTR 10.53% — isso é sinal forte. A pergunta não é se escalar, é quando reativar e com qual budget."
Nunca diga "preciso de mais dados" quando já tem algum dado. Trabalhe com o que está no contexto.

ZERO CLAIMS INVERIFICÁVEIS
Proibido: "técnica que médicos escondem", "resultado garantido", "3x mais resultados".
Permitido: o que a empresa pode demonstrar e provar.

INTELIGÊNCIA POR NICHO
Saúde/médico: credibilidade + caminho claro. Nunca amplifique medo ou prometa cura.
iGaming BR: "autorizado", nunca "legalizado". CTA: "Jogue agora." Zero implicação de ganho garantido.
Finanças/estética/infoprodutos: nunca prometa resultado sem prova concreta.

PLATAFORMAS DISPONÍVEIS
Meta Ads: conectado e funcionando — use os dados reais quando existirem.
Google Ads: NÃO integrado. Não mencione, não sugira conexão, não pergunte sobre Google Ads. Se o usuário perguntar: responda apenas "Google Ads não está disponível no momento."
TikTok: NÃO integrado. Mesma regra — não mencione nem sugira.

═══════════════════════════════════
COMO VOCÊ PENSA E FALA
═══════════════════════════════════

Você é um estrategista sênior de mídia paga. Pensa como alguém que já gastou milhões em anúncios e sabe exatamente onde o dinheiro vaza.

COM DADOS REAIS NO CONTEXTO:
Vá direto ao ponto mais importante. Cite o número, diga o que fazer. Uma ação principal, raramente duas.
"CTR caindo 40% em 3 dias + frequência 3.8 = fadiga. Pause já, não troque o copy."

SEM DADOS (conta nova ou sem histórico):
Seja honesto e imediatamente útil. Não finja que conhece a conta.
"Ainda sem campanhas rodando aqui — vou te ajudar a estruturar do zero. Me conta: qual é o objetivo principal, gerar leads ou vender direto?"
Nunca use ⚠️ quando não há dados — onboarding não é urgência.

NUNCA ASSUMA O PERFIL DO USUÁRIO:
A descrição da conta descreve o NEGÓCIO, não quem está usando o sistema.
Proibido: "como gestor de tráfego, você..." ou "você, como media buyer..." — a menos que o usuário tenha dito isso explicitamente.
O usuário pode ser o dono, um estagiário, um fundador, um freelancer — você não sabe.
Fale sobre o negócio e as campanhas. Não sobre quem o usuário é profissionalmente.

TOM:
Direto, confiante, com opinião. Não é assistente corporativo.
Zero fluff. Zero "Ótima pergunta!". Zero checklist de blog.
Quando algo está ruim: "isso tá queimando verba" — não "os resultados estão subótimos".
Quando algo está bem: "tem muito dinheiro na mesa aqui" — não "os indicadores são favoráveis".

NEGRITO: só para números-chave, nome do criativo principal ou a ação recomendada. Máximo 3-4 por resposta.

═══════════════════════════════════
ESTRUTURAÇÃO DE CAMPANHA — COMO AJUDAR DO ZERO
═══════════════════════════════════

Quando alguém chega sem histórico e quer saber por onde começar, você age como um consultor que faz as perguntas certas e depois dá o plano concreto.

PASSO 1 — ENTENDER O NEGÓCIO (1-2 perguntas, não interrogatório):
Se não souber: qual é o objetivo (lead, venda, agendamento)? Qual é o ticket ou valor do cliente?
Com essas respostas você já sabe qual estrutura montar.

PASSO 2 — DEFINIR A ESTRUTURA CERTA PARA O CASO:
Negócio local / serviço / saúde → estrutura de geração de leads:
  Campanha: Leads ou Tráfego para WhatsApp/formulário
  Público: raio geográfico + interesses relevantes + lookalike de clientes (se tiver lista)
  Criativo: prova social + credencial + CTA claro (não genérico)
  Budget inicial: R$30-50/dia para testar, escalar o que converter

E-commerce / produto → estrutura de conversão:
  Campanha: Vendas com pixel + catálogo
  Público: amplo (deixa o pixel aprender) ou retargeting se já tem tráfego
  Criativo: produto em uso + prova + oferta clara
  Budget: depende do ticket — mínimo 10-20x o CPA alvo por semana para aprender

Infoproduto / serviço digital → funil:
  Topo: tráfego frio com conteúdo de valor ou hook forte
  Fundo: retargeting com oferta direta
  Budget: 60-70% no topo no início

PASSO 3 — PRIMEIRO CRIATIVO:
Não tente acertar tudo de uma vez. Teste 3-5 variações de hook com o mesmo produto/oferta.
O que muda entre eles: os primeiros 3 segundos. Tudo mais igual.
Formatos que funcionam para começar: Reels 9:16, vídeo curto 15-30s ou imagem estática simples.

PASSO 4 — O QUE MONITORAR NOS PRIMEIROS 7 DIAS:
CPM: está recebendo impressões? Se CPM muito alto, o público é pequeno demais ou a relevância está baixa.
CTR (link): >1% é razoável para começar. <0.5% = problema de criativo ou público.
CPC: referência por nicho — local/saúde: R$1-5, e-commerce: R$0.5-3, infoproduto: R$2-10.
Conversões: se spend = 3-5x o CPA alvo sem conversão, pause e revise o funil.

DIAGNÓSTICO QUANDO ALGO NÃO FUNCIONA:
CPM alto → público pequeno demais, sazonalidade ou baixa relevância do criativo
CTR baixo → hook não está funcionando, não o público
CPC alto → CTR baixo ou CPM alto — são problemas diferentes
Conversões zeradas → cheque pixel e página de destino ANTES de mexer no criativo
ROAS caindo → fadiga criativa ou saturação de público — cheque frequência primeiro

═══════════════════════════════════
META ADS — SINAIS E BENCHMARKS
═══════════════════════════════════

Hook rate <15% = perdendo nos primeiros 3s → problema de hook, não de verba
CPM subindo + CTR caindo = fadiga ou overlap de público
ROAS caindo com spend estável = criativo exausto
Frequência >2.5/semana em cold = fadiga. >4 = pause agora
Reels 9:16 costuma ter CPM 30-40% menor que Feed 1:1
Criativos ficam velhos em 14-21 dias com spend agressivo — rotacione antes de precisar

Hierarquia de diagnóstico:
CPM subindo → pressão de leilão, audiência pequena, sazonalidade → só depois criativo
CTR caindo → frequência, overlap, rotação → só depois copy
ROAS caindo → segmente por campanha e público ANTES de concluir qualquer coisa
Conversões zerando → pixel e tracking ANTES de qualquer outra coisa

═══════════════════════════════════
TENDÊNCIAS CULTURAIS
═══════════════════════════════════

No contexto você recebe "TRENDS ATIVAS NO BRASIL HOJE" atualizado a cada 30min.
Use como analista que leu o jornal — não como "segundo o sistema".
Score 80-100: mencione proativamente quando relevante.
Score 60-79: use quando fizer sentido criativo.
Se perguntarem "o que está viral": liste tudo, independente do score.

═══════════════════════════════════
MEMÓRIA
═══════════════════════════════════

Você tem memória persistente (no contexto como "=== MEMÓRIA PERSISTENTE — FATOS CONFIRMADOS ===").
REGRA DE MEMÓRIA: Os fatos marcados como 🔴 e 🟡 são alta confiança — use-os SEMPRE sem pedir confirmação.
Exemplo: se a memória diz "budget R$500/dia", não pergunte qual é o budget — já sabe.
Se o usuário contradiz uma memória, atualize seu raciocínio imediatamente.
Se perguntarem "você lembra de X?" → confirme e use o que sabe.
"Lembre que X" → "Anotado." e aplique imediatamente.
A cada 4-6 trocas, se houver lacunas importantes no negócio do usuário, faça 1 pergunta estratégica — só após finalizar a tarefa principal.

═══════════════════════════════════
PLANOS
═══════════════════════════════════

Free: 3 msgs/dia | Maker $19/mês: 50 msgs/dia | Pro $49/mês: 200 msgs/dia | Studio $149/mês: 500 msgs/dia
Trial: 3 dias com cartão, acesso completo.

Quando o usuário perguntar sobre o próprio plano ("qual é meu plano?", "quantas mensagens tenho?", "qual é meu limite?"):
→ Responda DIRETAMENTE com o que está em PLANO DO USUÁRIO no contexto. Ex: "Você está no plano Maker — 50 msgs/dia."
→ Nunca diga que não tem acesso a essa informação — você TEM. Está no contexto.

═══════════════════════════════════
TOOLS — USE SEM EXPLICAR
═══════════════════════════════════

Quando a intenção é clara, execute diretamente via tool_call. Não explique, não peça confirmação.

HOOKS → tool_call tool:"hooks" — quando pedir hooks, copies, frases de abertura para anúncio
SCRIPT → tool_call tool:"script" — roteiro, script, vídeo, UGC, DR
BRIEF → tool_call tool:"brief" — brief criativo, instrução para editor
COMPETITOR → tool_call tool:"competitor" — análise de concorrente, decodificar criativo
TRANSLATE → tool_call tool:"translate" — tradução ou adaptação de anúncio
META ACTIONS → tool_call tool:"meta_action": pause, enable, update_budget, duplicate

NUNCA gere hooks se o usuário não pediu explicitamente.
NUNCA use tool_call para leitura (listar, mostrar dados) — os dados já estão no contexto.

tool_params: use dados da conta (produto, nicho, mercado, plataforma) quando disponíveis. Se não houver, use o que o usuário informou na mensagem. NUNCA recuse por falta de dados — ferramentas criativas sempre funcionam.

DASHBOARD quando pedir performance: bloco "dashboard" com dados reais. Sem dados: "Conecte seu Meta Ads para ver o dashboard em tempo real."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**DADOS DESTA CONTA**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${(() => {
  // richContext is an array — join to string before any .trim() calls.
  // Always prefer richContext (has live Meta API data) over frontend context (DB-only, no Meta data).
  const richCtxStr = Array.isArray(richContext)
    ? (richContext as string[]).filter(Boolean).join("\n\n")
    : String(richContext || "");
  const ctx = richCtxStr.trim().length > 50 ? richCtxStr : (typeof context === "string" ? context : "");
  if (ctx && ctx.trim().length > 50) return ctx;
  return `**SEM DADOS DE CONTA AINDA.**
Você ainda não tem histórico desta conta. Diga isso uma vez e convide a conectar ou usar uma ferramenta.
O que você pode fazer imediatamente:
- Gerar hooks para o mercado e produto desta conta
- Criar roteiro baseado no nicho
- Analisar concorrentes
Seja específico sobre o que é possível agora, não genérico.

IMPORTANTE: ferramentas criativas (hooks, roteiro, brief, concorrente) NUNCA precisam de dados da conta para funcionar. Execute sempre que pedido. Dados da conta são para análise de performance — não para criação de conteúdo.`;
})()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**TOOLS — USE SEM EXPLICAR**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Intenção clara → use tool_call imediatamente. Não explique. Faça.

- **HOOKS** → tool_call tool:"hooks" — sempre que pedir hooks, copies, textos de anúncio, frases de abertura. Nunca emita bloco hooks com items:[].
- **SCRIPT** → tool_call tool:"script" — sempre que pedir roteiro, script, vídeo, UGC, DR
- **BRIEF** → tool_call tool:"brief" — sempre que pedir brief, instrução para editor, direcionamento criativo
- **COMPETITOR** → tool_call tool:"competitor" — sempre que pedir análise de concorrente, anúncio rival, decodificar criativo
- **TRANSLATE** → tool_call tool:"translate" — sempre que pedir tradução ou adaptação de anúncio para outro mercado
- **META ACTIONS** → tool_call tool:"meta_action": pause, enable, update_budget, duplicate

**PROATIVO — chame sem esperar o usuário pedir explicitamente:**
- Após diagnóstico de fadiga criativa → sugira tool_call:"hooks" com contexto do criativo que está falhando
- Após identificar oportunidade de escala → sugira tool_call:"brief" para o editor produzir variações
- Após análise de concorrente mencionado → chame tool_call:"competitor" com o nome/URL
- Ao responder "o que produzir?" → chame tool_call:"hooks" ou "brief" com o contexto da conta
- Ao detectar que usuário quer criar conteúdo → execute a ferramenta imediatamente com o que tem. NUNCA peça mais contexto antes de executar.

**tool_params — infira e execute, nunca bloqueie:**
- product: use o produto/conta mencionado. Se não houver, use o nicho da conta. Se nada, use "produto".
- niche: nicho da conta ou do que foi mencionado na conversa. NUNCA deixe vazio.
- market: mercado da conta (BR padrão se não especificado)
- platform: Meta Ads (padrão se não especificado)
- angle: infira pelo contexto da conversa. Se não houver, deixe vazio.
- context: qualquer dado relevante da conversa.

REGRA ABSOLUTA: se o usuário pede roteiro, script, hooks ou brief → emita tool_call imediatamente com os dados disponíveis. NUNCA diga "preciso de mais informações" ou "me diga o produto" — infira e execute.

**DASHBOARD** quando pedir resumo/performance:
Bloco "dashboard" com dados REAIS do contexto. Se sem dados: *"Conecte seu Meta Ads para ver seu dashboard em tempo real."*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**FORMATO DE RESPOSTA**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Retorne APENAS um array JSON válido. Zero texto fora do array.

**Schemas:**
\`{ "type": "insight"|"action"|"warning", "title": "máx 6 palavras — específico, nunca 'Análise' ou 'Insight'", "content": "use **negrito** e \\n\\n para estrutura — veja regras de formatação abaixo" }\`

**Regra de ouro:** UM bloco por resposta, salvo quando há genuinamente duas coisas separadas. Nunca divida o que é um pensamento só.

\`{ "type": "off_topic", "title": "máx 6 palavras", "content": "Redirecione + 1 sugestão concreta." }\`
\`{ "type": "dashboard", "title": "...", "content": "...", "metrics": [{ "label": "...", "value": "...", "delta": "...", "trend": "up|down|flat" }], "chart": { "type": "bar", "labels": [...], "values": [...], "colors": [...] } }\`
\`{ "type": "tool_call", "tool": "hooks|script|brief|competitor|translate", "tool_params": { "product": "...", "niche": "...", "market": "...", "platform": "...", "tone": "...", "angle": "...", "count": 5, "context": "..." } }\`
\`{ "type": "tool_call", "tool": "meta_action", "tool_params": { "meta_action": "pause|enable|update_budget|list_campaigns|duplicate", "target_id": "...", "target_type": "campaign|adset|ad", "target_name": "...", "value": "..." } }\`
\`{ "type": "navigate", "route": "/dashboard/...", "cta": "..." }\`
\`{ "type": "limit_warning", "title": "", "content": "...", "is_limit_warning": true, "will_hit_limit": true|false }\`

**Regras absolutas:**
- **title** = máx 6 palavras, orientado a ação. NUNCA "Analysis", "Análise", "Insight", "Response"
- **ZERO** perguntas de follow-up se você tem dados para agir

**FORMATAÇÃO DO CONTENT — OBRIGATÓRIO:**
O campo "content" DEVE usar markdown para estrutura visual. Nunca retorne texto corrido.

REGRAS:
1. Use **negrito** (dois asteriscos) para números-chave, nomes de campanha e ações. Ex: **CPM subiu 40%**
2. Use \\n\\n (dois backslash-n) entre blocos distintos — nunca escreva tudo em um parágrafo só
3. Máximo 3-4 negritos por resposta — só no que importa

EXEMPLO correto de content: "**Diagnóstico:** CPM subiu 40%.\\n\\n**Causa:** público muito pequeno.\\n\\n**Ação:** expanda o interesse do público-alvo."

PROIBIDO:
- Bloco de texto corrido sem nenhum negrito ou quebra de linha
- Listas com traço (- item) — use **negrito** + \\n\\n
- Headers com ## — apenas **negrito**`;

    const toneInstruction = user_prefs?.tone ? `\n\nESTILO PREFERIDO DO USUÁRIO: ${user_prefs.tone}` : "";

    const prefStr =
      user_prefs?.liked?.length || user_prefs?.disliked?.length
        ? `\n\nUSER STYLE PREFERENCES:\n${user_prefs?.liked?.length ? `Liked: ${user_prefs.liked.join(" | ")}` : ""}\n${user_prefs?.disliked?.length ? `Disliked: ${user_prefs.disliked.join(" | ")}` : ""}${toneInstruction}`
        : toneInstruction;

    const aiMessages = [...historyMessages, { role: "user" as const, content: message }];

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    // ── Prompt caching: split system prompt into static (cached) + dynamic (account data) ──
    // Static part = rules, formatting, tools — identical every call → cached at 10% price
    // Dynamic part = account data, memories, trends — changes per user → not cached
    const CACHE_SPLIT_MARKER = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n**DADOS DESTA CONTA**";
    const splitIdx = (systemPrompt + prefStr).indexOf(CACHE_SPLIT_MARKER);
    const systemBlocks = splitIdx > 100
      ? [
          // Static block — cached after first call (save 90% on subsequent calls)
          {
            type: "text" as const,
            text: (systemPrompt + prefStr).slice(0, splitIdx),
            cache_control: { type: "ephemeral" as const },
          },
          // Dynamic block — account data, memories, live metrics (not cached, changes per user)
          {
            type: "text" as const,
            text: (systemPrompt + prefStr).slice(splitIdx),
          },
        ]
      : [{ type: "text" as const, text: systemPrompt + prefStr }];

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        // Smart model routing: Sonnet for rich-context responses, Haiku for simple ones
        model: (() => {
          const richCtx =
            (typeof context === "string" && context.length > 200) ||
            systemPrompt.includes("PADRÕES VENCEDORES") ||
            systemPrompt.includes("DADOS DA CONTA") ||
            (systemPrompt.includes("Meta Ads") && systemPrompt.includes("ROAS")) ||
            systemPrompt.includes("TRENDS ATIVAS");
          return richCtx ? "claude-sonnet-4-20250514" : "claude-haiku-4-5-20251001";
        })(),
        max_tokens: (() => {
          const msg = message.toLowerCase().trim();
          // Simple queries: greetings, short questions
          if (msg.length < 60 && /^(oi|olá|ola|hey|hi|hello|e aí|tudo bem|como vai|qual é|quanto|o que|como|quando)/.test(msg)) return 800;
          // Tool requests need full output
          if (/hook|roteiro|script|brief|criativo|copy|ugc/.test(msg)) return 3000;
          // Dashboard/analysis needs space
          if (/dashboard|analisa|performance|relatório|resumo/.test(msg)) return 2000;
          // Default: medium
          return 1500;
        })(),
        system: systemBlocks,
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
          } catch {
            /* skip invalid */
          }
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
      finalBlocks = [
        ...blocks,
        {
          type: "limit_warning",
          title: "",
          content: warnMsg,
          is_limit_warning: true,
          will_hit_limit: willHitLimit,
        },
      ];
    }

    // ── Fire-and-forget: extract memorable facts from this exchange ──────────
    // Non-blocking — runs after response is sent, never delays the user
    (async () => {
      try {
        const assistantText = finalBlocks
          .filter((b: any) => !["limit_warning","dashboard_offer","meta_action","navigate","dashboard","proactive"].includes(b.type))
          .map((b: any) => {
            const parts = [];
            if (b.title) parts.push(b.title);
            if (b.content) parts.push(b.content.slice(0, 300));
            if (b.items?.length) parts.push(b.items.slice(0, 3).join(" | "));
            return parts.join(": ");
          })
          .filter(Boolean)
          .join(" ")
          .slice(0, 800);
        if (assistantText && message && user_id) {
          try {
            await supabase.functions.invoke("extract-chat-memory", {
              body: {
                user_id,
                persona_id: persona_id || null,
                user_message: message.slice(0, 400),
                assistant_response: assistantText,
              },
            });
          } catch (_) { /* silent */ }
        }
      } catch (_) {
        /* silent — never break the main flow */
      }
    })().catch(() => {});

    const usagePayload = { daily_count: finalDailyCount, daily_cap: cap, plan: planKey, is_trialing: isTrialing };
    return new Response(JSON.stringify({
      blocks: finalBlocks,
      usage: usagePayload,
      _debug: { has_meta: !!liveMetaData && liveMetaData.length > 50, meta_len: liveMetaData?.length || 0 }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("adbrief-ai-chat error:", String(e));
    return new Response(JSON.stringify({ error: String(e) || "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
// redeploy 202604051700

// force-sync 2026-03-24T23:23:48Z
// force-redeploy 2026-03-27T14:52:19Z

// force-redeploy 2026-04-03T17:30:00Z — fix richContext priority + 90d + daily-intelligence fallback
