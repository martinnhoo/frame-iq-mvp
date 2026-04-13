/**
 * account-diagnostic — Diagnóstico instantâneo da conta Meta Ads
 *
 * Chamado uma vez após OAuth (primeira conexão) e semanalmente via cron.
 * Puxa 30 dias de dados, classifica cada ad deterministicamente,
 * calcula Account Health Score, dinheiro desperdiçado, ROAS projetado,
 * e usa Haiku apenas para contextualizar os números em insights.
 *
 * Zero chute. Tudo é math. Haiku só traduz dados em texto humano.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized, isUserAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface DiagnosticResult {
  ad_account_id: string;
  ad_account_name: string;
  currency: string;
  period_days: number;

  // Hero numbers
  wasted_spend: number;
  wasted_spend_monthly: number;
  current_roas: number | null;
  projected_roas: number | null;
  roas_improvement_pct: number | null;

  // Account Health Score (0-100)
  score: number;
  score_breakdown: {
    roas_score: number;        // 0-35
    cpa_score: number;         // 0-25
    ctr_score: number;         // 0-20
    budget_efficiency: number; // 0-10
    creative_health: number;   // 0-10
  };

  // Aggregated metrics
  metrics: {
    total_spend: number;
    total_impressions: number;
    total_clicks: number;
    total_conversions: number;
    total_revenue: number;
    avg_ctr: number;
    avg_cpc: number;
    avg_cpm: number;
    avg_frequency: number;
    active_ads: number;
    active_campaigns: number;
  };

  // Benchmark comparison
  benchmarks: {
    ctr: { yours: number; benchmark: number; verdict: "above" | "below" | "at" };
    cpm: { yours: number; benchmark: number; verdict: "above" | "below" | "at" };
    cpc: { yours: number; benchmark: number; verdict: "above" | "below" | "at" };
    frequency: { yours: number; benchmark: number; verdict: "above" | "below" | "at" };
  };

  // Classified ads
  ads_to_pause: ClassifiedAd[];
  ads_to_scale: ClassifiedAd[];
  ads_fatigued: ClassifiedAd[];
  top_performers: ClassifiedAd[];

  // Haiku-contextualized insights (3 max)
  insights: DiagnosticInsight[];
}

interface ClassifiedAd {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  adset_name: string;
  spend: number;
  impressions: number;
  ctr: number;
  cpc: number;
  conversions: number;
  roas: number | null;
  cpa: number | null;
  frequency: number;
  primary_kpi: string;
  primary_kpi_value: number | null;
  primary_kpi_threshold: number;
  reason: string;
}

interface DiagnosticInsight {
  type: "waste" | "opportunity" | "health";
  title: string;
  description: string;
  impact: string; // e.g. "R$ 2.340/mês"
  urgency: "alta" | "media" | "baixa";
}

// ═══════════════════════════════════════════════════════════════════════════
// KPI CONFIG (mirrored from daily-intelligence — single source of truth)
// ═══════════════════════════════════════════════════════════════════════════

interface KpiConfig {
  primary: string;
  primaryLabel: string;
  secondary: string[];
  winnerThreshold: Record<string, number>;
}

function getKpiConfig(objective: string): KpiConfig {
  const o = (objective || "").toUpperCase();

  if (o.includes("PURCHASE") || o.includes("CONVERSIONS") || o.includes("OUTCOME_SALES"))
    return {
      primary: "roas", primaryLabel: "ROAS",
      secondary: ["cpa", "ctr", "cpc"],
      winnerThreshold: { roas: 2.0, cpa: 50, ctr: 0.01 },
    };

  if (o.includes("LEAD") || o.includes("OUTCOME_LEADS"))
    return {
      primary: "cpl", primaryLabel: "CPL",
      secondary: ["ctr", "conv_rate", "cpc"],
      winnerThreshold: { cpl: 20, ctr: 0.012, conv_rate: 0.05 },
    };

  if (o.includes("APP") || o.includes("MOBILE_APP"))
    return {
      primary: "cpi", primaryLabel: "CPI",
      secondary: ["ctr", "cpc", "cpm"],
      winnerThreshold: { cpi: 8, ctr: 0.01 },
    };

  if (o.includes("VIDEO") || o.includes("VIDEO_VIEWS"))
    return {
      primary: "thruplay_rate", primaryLabel: "ThruPlay%",
      secondary: ["hook_rate", "hold_rate", "cpm"],
      winnerThreshold: { thruplay_rate: 0.15, hook_rate: 0.25 },
    };

  if (o.includes("REACH") || o.includes("BRAND") || o.includes("AWARENESS"))
    return {
      primary: "cpm", primaryLabel: "CPM",
      secondary: ["frequency", "reach", "impressions"],
      winnerThreshold: { cpm: 15 },
    };

  if (o.includes("ENGAGEMENT") || o.includes("POST_ENGAGEMENT"))
    return {
      primary: "engagement_rate", primaryLabel: "Eng%",
      secondary: ["ctr", "cpc", "cpm"],
      winnerThreshold: { engagement_rate: 0.03, ctr: 0.015 },
    };

  // Default: traffic / link clicks
  return {
    primary: "ctr", primaryLabel: "CTR",
    secondary: ["cpc", "cpm", "frequency"],
    winnerThreshold: { ctr: 0.018, cpc: 2.0 },
  };
}

const COST_KPIS = ["cpa", "cpl", "cpi", "cpm", "cpc"];

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARKS (Meta Ads industry averages — updated quarterly)
// ═══════════════════════════════════════════════════════════════════════════

const BENCHMARKS = {
  ctr: 0.015,       // 1.5% avg across verticals
  cpm: 12.0,        // R$12 for Brazil
  cpc: 1.50,        // R$1.50
  frequency: 2.5,   // healthy upper limit
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const parseN = (v: any): number => parseFloat(v || "0") || 0;

function getConversions(ad: any): number {
  const actions = (ad.actions || []) as any[];
  const conv = actions.find((a: any) =>
    ["purchase", "lead", "complete_registration", "app_install"].includes(a.action_type)
  );
  return conv ? parseFloat(conv.value || "0") : 0;
}

function getRoas(ad: any, spend: number): number | null {
  const purchaseRoasArr = (ad.website_purchase_roas || []) as any[];
  const realRoas = purchaseRoasArr.length ? parseN(purchaseRoasArr[0]?.value) : null;
  if (realRoas) return realRoas;

  const actionValues = (ad.action_values || []) as any[];
  const purchaseValue = actionValues.find((a: any) => a.action_type === "purchase")?.value;
  return purchaseValue && spend > 0 ? parseN(purchaseValue) / spend : null;
}

function getRevenue(ad: any): number {
  const actionValues = (ad.action_values || []) as any[];
  const purchase = actionValues.find((a: any) => a.action_type === "purchase");
  return purchase ? parseN(purchase.value) : 0;
}

function getKpiValue(
  kpiPrimary: string, ad: { roas: number | null; cpa: number | null; ctr: number; cpm: number; thruPlayRate: number | null; hookRate: number | null; engagementRate: number | null }
): number | null {
  switch (kpiPrimary) {
    case "roas":            return ad.roas;
    case "cpl":             return ad.cpa;
    case "cpi":             return ad.cpa;
    case "thruplay_rate":   return ad.thruPlayRate;
    case "hook_rate":       return ad.hookRate;
    case "cpm":             return ad.cpm;
    case "engagement_rate": return ad.engagementRate;
    default:                return ad.ctr;
  }
}

function benchmarkVerdict(yours: number, benchmark: number, lowerIsBetter = false): "above" | "below" | "at" {
  const margin = benchmark * 0.1;
  if (lowerIsBetter) {
    if (yours < benchmark - margin) return "above"; // spending less = good
    if (yours > benchmark + margin) return "below";
    return "at";
  }
  if (yours > benchmark + margin) return "above";
  if (yours < benchmark - margin) return "below";
  return "at";
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY");
    const body = await req.json().catch(() => ({}));
    const { user_id, persona_id, account_id: requestedAccountId } = body;

    // ── Auth ────────────────────────────────────────────────────────────
    const authed = isCronAuthorized(req) || await isUserAuthorized(req, sb, user_id);
    if (!authed) return unauthorizedResponse(cors);

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Get Meta connection ─────────────────────────────────────────────
    const connQuery = sb
      .from("platform_connections")
      .select("*")
      .eq("user_id", user_id)
      .eq("platform", "meta")
      .eq("status", "active");

    if (persona_id) connQuery.eq("persona_id", persona_id);

    const { data: connections, error: connErr } = await connQuery;
    if (connErr || !connections?.length) {
      return new Response(JSON.stringify({ error: "no_meta_connection", message: "Conecte sua conta Meta Ads primeiro" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const conn = connections[0];
    const token = conn.access_token;
    const adAccounts = conn.ad_accounts || [];
    const selectedAccountId = requestedAccountId || conn.selected_account_id || adAccounts[0]?.account_id;

    if (!selectedAccountId) {
      return new Response(JSON.stringify({ error: "no_account_selected" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const accountMeta = adAccounts.find((a: any) => a.account_id === selectedAccountId) || {};
    let accountName = accountMeta.account_name || accountMeta.name || "";
    const currency = accountMeta.currency || "BRL";

    // ── Fetch Meta API data in parallel ─────────────────────────────────
    const now = new Date();
    const since30d = new Date(now.getTime() - 30 * 24 * 3600_000).toISOString().slice(0, 10);
    const until = now.toISOString().slice(0, 10);

    const insightsFields = [
      "ad_id", "ad_name", "campaign_name", "adset_name",
      "spend", "impressions", "clicks", "ctr", "cpc", "cpm",
      "actions", "action_values", "website_purchase_roas",
      "frequency", "reach",
      "video_play_actions", "video_thruplay_watched_actions",
      "video_avg_time_watched_actions",
    ].join(",");

    const actId = selectedAccountId.startsWith("act_") ? selectedAccountId : `act_${selectedAccountId}`;

    const [adsRes, campsRes, accountInsightsRes, accountInfoRes] = await Promise.all([
      // Ad-level insights (last 30 days, limit 200)
      fetch(
        `https://graph.facebook.com/v21.0/${actId}/insights?` +
        `fields=${insightsFields}&level=ad&date_preset=last_30d&limit=200&access_token=${token}`
      ),
      // Campaign list with objectives
      fetch(
        `https://graph.facebook.com/v21.0/${actId}/campaigns?` +
        `fields=name,objective,status&limit=100&access_token=${token}`
      ),
      // Account-level aggregated metrics
      fetch(
        `https://graph.facebook.com/v21.0/${actId}/insights?` +
        `fields=spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,website_purchase_roas,frequency,reach` +
        `&date_preset=last_30d&access_token=${token}`
      ),
      // Account name (fallback if not stored in platform_connections)
      fetch(
        `https://graph.facebook.com/v21.0/${actId}?fields=name,currency,account_id&access_token=${token}`
      ),
    ]);

    if (!adsRes.ok) {
      const errBody = await adsRes.text();
      return new Response(JSON.stringify({ error: "meta_api_error", detail: errBody }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const adsData = await adsRes.json();
    const campsData = await campsRes.json().catch(() => ({ data: [] }));
    const accountData = await accountInsightsRes.json().catch(() => ({ data: [] }));

    // Get account name from API if not stored
    if (!accountName) {
      try {
        const accountInfo = await accountInfoRes.json();
        accountName = accountInfo.name || selectedAccountId;
      } catch { accountName = selectedAccountId; }
    }

    const rawAds: any[] = adsData.data || [];

    // Handle pagination — fetch all ads (not just first 200)
    let nextPage = adsData.paging?.next;
    while (nextPage && rawAds.length < 500) {
      try {
        const pageRes = await fetch(nextPage);
        if (!pageRes.ok) break;
        const pageData = await pageRes.json();
        rawAds.push(...(pageData.data || []));
        nextPage = pageData.paging?.next;
      } catch { break; }
    }

    // ── Build campaign → objective map ──────────────────────────────────
    const campObjectiveMap: Record<string, string> = {};
    ((campsData.data || []) as any[]).forEach((c: any) => {
      if (c.name) campObjectiveMap[c.name] = c.objective || "OUTCOME_TRAFFIC";
    });

    // ── Enrich & classify each ad ───────────────────────────────────────
    const enrichedAds = rawAds.map((ad: any) => {
      const spend = parseN(ad.spend);
      // Meta API returns CTR as percentage string (e.g. "8.32" means 8.32%)
      // Convert to fraction (0.0832) for all calculations
      const ctr = parseN(ad.ctr) / 100;
      const clicks = parseN(ad.clicks);
      const cpc = parseN(ad.cpc);
      const cpm = parseN(ad.cpm);
      const impressions = parseN(ad.impressions);
      const frequency = parseN(ad.frequency);
      const conversions = getConversions(ad);
      const roas = getRoas(ad, spend);
      const revenue = getRevenue(ad);
      const cpa = conversions > 0 && spend > 0 ? spend / conversions : null;

      // Video KPIs
      const videoPlays = parseN((ad.video_play_actions || [])[0]?.value);
      const thruPlays = parseN((ad.video_thruplay_watched_actions || [])[0]?.value);
      const hookRate = impressions > 0 ? videoPlays / impressions : null;
      const thruPlayRate = videoPlays > 0 ? thruPlays / videoPlays : null;

      // Engagement
      const engagements = (ad.actions || []).find((a: any) => a.action_type === "post_engagement");
      const engagementRate = impressions > 0 && engagements ? parseN(engagements.value) / impressions : null;

      // KPI-aware classification
      const objective = campObjectiveMap[ad.campaign_name] || "OUTCOME_TRAFFIC";
      const kpiCfg = getKpiConfig(objective);
      const kpiValue = getKpiValue(kpiCfg.primary, { roas, cpa, ctr, cpm, thruPlayRate, hookRate, engagementRate });
      const threshold = kpiCfg.winnerThreshold[kpiCfg.primary] ?? 0;

      const isPrimaryGood = kpiValue !== null
        ? (COST_KPIS.includes(kpiCfg.primary) ? kpiValue <= threshold : kpiValue >= threshold)
        : false;

      // ── Deterministic classification (same as daily-intelligence) ──
      const isFatigued = frequency > 3.5;

      // Only scalable if: KPI is good, spent > $10, is ACTIVE, and has conversions
      const isScalable = isPrimaryGood && spend > 10 && ad.status === "ACTIVE" && conversions > 0;

      const needsPause =
        (!isPrimaryGood && spend > 20 && conversions === 0 && ctr < 0.005)
        || (roas !== null && roas < 0.5 && spend > 50)
        || (cpa !== null && cpa > 200 && spend > 40);

      // Build reason string
      let reason = "";
      if (needsPause) {
        if (roas !== null && roas < 0.5 && spend > 50) reason = `ROAS ${roas.toFixed(2)}x com R$${spend.toFixed(0)} gastos`;
        else if (cpa !== null && cpa > 200) reason = `CPA R$${cpa.toFixed(0)} (muito alto) com R$${spend.toFixed(0)} gastos`;
        else reason = `${conversions} conversões, CTR ${(ctr * 100).toFixed(2)}%, R$${spend.toFixed(0)} gastos`;  // ctr already fraction, *100 for display
      } else if (isScalable) {
        reason = `${kpiCfg.primaryLabel} ${kpiValue !== null ? (COST_KPIS.includes(kpiCfg.primary) ? `R$${kpiValue.toFixed(2)}` : kpiCfg.primary === "roas" ? `${kpiValue.toFixed(2)}x` : `${(kpiValue * 100).toFixed(1)}%`) : "N/A"} (acima do threshold)`;
      } else if (isFatigued) {
        reason = `Frequência ${frequency.toFixed(1)}x (acima de 3.5)`;
      }

      return {
        ad_id: ad.ad_id,
        ad_name: ad.ad_name || "Sem nome",
        campaign_name: ad.campaign_name || "",
        adset_name: ad.adset_name || "",
        spend,
        impressions,
        clicks,
        ctr,
        cpc,
        cpm,
        conversions,
        revenue,
        roas,
        cpa,
        frequency,
        hookRate,
        thruPlayRate,
        engagementRate,
        objective,
        kpiPrimary: kpiCfg.primary,
        kpiLabel: kpiCfg.primaryLabel,
        kpiValue,
        threshold,
        isPrimaryGood,
        needsPause,
        isScalable,
        isFatigued,
        reason,
      };
    });

    // ── Aggregate metrics ───────────────────────────────────────────────
    const totalSpend = enrichedAds.reduce((s, a) => s + a.spend, 0);
    const totalImpressions = enrichedAds.reduce((s, a) => s + a.impressions, 0);
    const totalClicks = enrichedAds.reduce((s, a) => s + a.clicks, 0);
    const totalConversions = enrichedAds.reduce((s, a) => s + a.conversions, 0);
    const totalRevenue = enrichedAds.reduce((s, a) => s + a.revenue, 0);

    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const avgFrequency = enrichedAds.length > 0
      ? enrichedAds.reduce((s, a) => s + a.frequency, 0) / enrichedAds.length
      : 0;

    const activeCampaigns = new Set(enrichedAds.map(a => a.campaign_name)).size;

    // ── Wasted spend (deterministic) ────────────────────────────────────
    const adsToPause = enrichedAds.filter(a => a.needsPause).sort((a, b) => b.spend - a.spend);
    const adsToScale = enrichedAds.filter(a => a.isScalable && !a.isFatigued).sort((a, b) => b.spend - a.spend);
    const adsFatigued = enrichedAds.filter(a => a.isFatigued).sort((a, b) => b.frequency - a.frequency);
    const topPerformers = enrichedAds.filter(a => a.isPrimaryGood && !a.needsPause).sort((a, b) => b.spend - a.spend).slice(0, 10);

    const wastedSpend = adsToPause.reduce((s, a) => s + a.spend, 0);
    const wastedSpendMonthly = wastedSpend; // Already 30 days

    // ── Current ROAS vs projected ───────────────────────────────────────
    const currentRoas = totalSpend > 0 && totalRevenue > 0 ? totalRevenue / totalSpend : null;

    // Projected: remove wasted ads' spend but keep good ads' revenue
    const goodAdsSpend = totalSpend - wastedSpend;
    const goodAdsRevenue = enrichedAds
      .filter(a => !a.needsPause)
      .reduce((s, a) => s + a.revenue, 0);

    const projectedRoas = goodAdsSpend > 0 && goodAdsRevenue > 0
      ? goodAdsRevenue / goodAdsSpend
      : currentRoas;

    const roasImprovementPct = currentRoas && projectedRoas && currentRoas > 0
      ? ((projectedRoas - currentRoas) / currentRoas) * 100
      : null;

    // ── Account Health Score (0-100) ────────────────────────────────────
    const roasScore = (() => {
      if (currentRoas === null) return 17; // neutral if no revenue data
      if (currentRoas >= 4.0) return 35;
      if (currentRoas >= 3.0) return 30;
      if (currentRoas >= 2.0) return 25;
      if (currentRoas >= 1.0) return 15;
      if (currentRoas >= 0.5) return 8;
      return 3;
    })();

    const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : null;
    const cpaScore = (() => {
      if (avgCpa === null) return 12; // neutral
      if (avgCpa <= 15) return 25;
      if (avgCpa <= 30) return 22;
      if (avgCpa <= 50) return 18;
      if (avgCpa <= 100) return 12;
      if (avgCpa <= 200) return 6;
      return 2;
    })();

    const ctrScore = (() => {
      if (avgCtr >= 0.03) return 20;
      if (avgCtr >= 0.02) return 17;
      if (avgCtr >= 0.015) return 14;
      if (avgCtr >= 0.01) return 10;
      if (avgCtr >= 0.005) return 5;
      return 2;
    })();

    const budgetEfficiency = (() => {
      if (totalSpend === 0) return 5;
      const wasteRatio = wastedSpend / totalSpend;
      if (wasteRatio <= 0.05) return 10;
      if (wasteRatio <= 0.15) return 8;
      if (wasteRatio <= 0.30) return 6;
      if (wasteRatio <= 0.50) return 3;
      return 1;
    })();

    const creativeHealth = (() => {
      const total = enrichedAds.length;
      if (total === 0) return 5;
      const fatiguedRatio = adsFatigued.length / total;
      const scalableRatio = adsToScale.length / total;
      let score = 5;
      if (scalableRatio >= 0.3) score += 3;
      else if (scalableRatio >= 0.15) score += 2;
      if (fatiguedRatio <= 0.1) score += 2;
      else if (fatiguedRatio <= 0.25) score += 1;
      return Math.min(score, 10);
    })();

    const totalScore = roasScore + cpaScore + ctrScore + budgetEfficiency + creativeHealth;

    // ── Benchmarks ──────────────────────────────────────────────────────
    const benchmarks = {
      ctr: { yours: avgCtr, benchmark: BENCHMARKS.ctr, verdict: benchmarkVerdict(avgCtr, BENCHMARKS.ctr) },
      cpm: { yours: avgCpm, benchmark: BENCHMARKS.cpm, verdict: benchmarkVerdict(avgCpm, BENCHMARKS.cpm, true) },
      cpc: { yours: avgCpc, benchmark: BENCHMARKS.cpc, verdict: benchmarkVerdict(avgCpc, BENCHMARKS.cpc, true) },
      frequency: { yours: avgFrequency, benchmark: BENCHMARKS.frequency, verdict: benchmarkVerdict(avgFrequency, BENCHMARKS.frequency, true) },
    };

    // ── Format classified ads for response ──────────────────────────────
    const formatAd = (a: typeof enrichedAds[0]): ClassifiedAd => ({
      ad_id: a.ad_id,
      ad_name: a.ad_name,
      campaign_name: a.campaign_name,
      adset_name: a.adset_name,
      spend: Math.round(a.spend * 100) / 100,
      impressions: a.impressions,
      ctr: a.ctr,
      cpc: Math.round(a.cpc * 100) / 100,
      conversions: a.conversions,
      roas: a.roas ? Math.round(a.roas * 100) / 100 : null,
      cpa: a.cpa ? Math.round(a.cpa * 100) / 100 : null,
      frequency: Math.round(a.frequency * 10) / 10,
      primary_kpi: a.kpiLabel,
      primary_kpi_value: a.kpiValue ? Math.round(a.kpiValue * 1000) / 1000 : null,
      primary_kpi_threshold: a.threshold,
      reason: a.reason,
    });

    // ── Haiku insights (contextualizes, never decides) ──────────────────
    let insights: DiagnosticInsight[] = [];

    if (ANTHROPIC) {
      try {
        const context = {
          currency,
          totalSpend: Math.round(totalSpend),
          wastedSpend: Math.round(wastedSpend),
          wastedPct: totalSpend > 0 ? Math.round((wastedSpend / totalSpend) * 100) : 0,
          currentRoas: currentRoas ? currentRoas.toFixed(2) : "N/A",
          projectedRoas: projectedRoas ? projectedRoas.toFixed(2) : "N/A",
          score: totalScore,
          activeAds: enrichedAds.length,
          adsToPause: adsToPause.length,
          adsToScale: adsToScale.length,
          adsFatigued: adsFatigued.length,
          avgCtr: (avgCtr * 100).toFixed(2) + "%",  // avgCtr is fraction (0.08), display as 8.00%
          avgFrequency: avgFrequency.toFixed(1),
          topPauseAds: adsToPause.slice(0, 3).map(a => `${a.ad_name}: R$${a.spend.toFixed(0)} gastos, ${a.reason}`),
          topScaleAds: adsToScale.slice(0, 3).map(a => `${a.ad_name}: R$${a.spend.toFixed(0)} gastos, ${a.reason}`),
          benchmarks: {
            ctr: `${(avgCtr * 100).toFixed(2)}% vs benchmark ${(BENCHMARKS.ctr * 100).toFixed(1)}%`,
            cpm: `R$${avgCpm.toFixed(2)} vs benchmark R$${BENCHMARKS.cpm}`,
          },
        };

        const haikuRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 600,
            system: `Você é o motor de insights do AdBrief.pro. Recebe dados REAIS de uma conta Meta Ads e gera EXATAMENTE 3 insights em JSON.

REGRAS ABSOLUTAS:
- Todos os números vêm dos dados fornecidos. NUNCA invente números.
- Cada insight deve citar o dado exato que o sustenta.
- Tipo "waste": foque no dinheiro desperdiçado e quais ads pausar.
- Tipo "opportunity": foque nos ads escaláveis e potencial de crescimento.
- Tipo "health": foque no estado geral da conta (frequência, CTR, score).
- impact: sempre em formato monetário (R$) ou percentual concreto.
- Escreva em português brasileiro, tom direto e profissional.

Responda APENAS com JSON array, sem markdown, sem explicação.`,
            messages: [{
              role: "user",
              content: `Dados da conta Meta Ads (últimos 30 dias):\n${JSON.stringify(context, null, 2)}\n\nGere exatamente 3 insights no formato:\n[{"type":"waste"|"opportunity"|"health","title":"string curto","description":"2 frases com dados reais","impact":"R$ X ou X%","urgency":"alta|media|baixa"}]`,
            }],
          }),
        });

        if (haikuRes.ok) {
          const haikuData = await haikuRes.json();
          const text = haikuData.content?.[0]?.text || "";
          try {
            // Extract JSON from response (handle potential markdown wrapping)
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              insights = JSON.parse(jsonMatch[0]);
            }
          } catch { /* insights stay empty — UI handles this gracefully */ }
        }
      } catch { /* Haiku failed — continue without insights */ }
    }

    // ── Build final result ──────────────────────────────────────────────
    const result: DiagnosticResult = {
      ad_account_id: selectedAccountId,
      ad_account_name: accountName,
      currency,
      period_days: 30,

      wasted_spend: Math.round(wastedSpend * 100) / 100,
      wasted_spend_monthly: Math.round(wastedSpendMonthly * 100) / 100,
      current_roas: currentRoas ? Math.round(currentRoas * 100) / 100 : null,
      projected_roas: projectedRoas ? Math.round(projectedRoas * 100) / 100 : null,
      roas_improvement_pct: roasImprovementPct ? Math.round(roasImprovementPct * 10) / 10 : null,

      score: totalScore,
      score_breakdown: {
        roas_score: roasScore,
        cpa_score: cpaScore,
        ctr_score: ctrScore,
        budget_efficiency: budgetEfficiency,
        creative_health: creativeHealth,
      },

      metrics: {
        total_spend: Math.round(totalSpend * 100) / 100,
        total_impressions: Math.round(totalImpressions),
        total_clicks: Math.round(totalClicks),
        total_conversions: totalConversions,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        avg_ctr: Math.round(avgCtr * 10000) / 10000,
        avg_cpc: Math.round(avgCpc * 100) / 100,
        avg_cpm: Math.round(avgCpm * 100) / 100,
        avg_frequency: Math.round(avgFrequency * 10) / 10,
        active_ads: enrichedAds.length,
        active_campaigns: activeCampaigns,
      },

      benchmarks,

      ads_to_pause: adsToPause.slice(0, 20).map(formatAd),
      ads_to_scale: adsToScale.slice(0, 20).map(formatAd),
      ads_fatigued: adsFatigued.slice(0, 15).map(formatAd),
      top_performers: topPerformers.map(formatAd),

      insights,
    };

    // ── Store in DB ─────────────────────────────────────────────────────
    try {
      await sb.from("account_diagnostics").upsert({
        user_id,
        persona_id: persona_id || null,
        ad_account_id: selectedAccountId,
        wasted_spend: result.wasted_spend,
        wasted_spend_monthly: result.wasted_spend_monthly,
        projected_roas: result.projected_roas,
        current_roas: result.current_roas,
        roas_improvement_pct: result.roas_improvement_pct,
        score: result.score,
        score_breakdown: result.score_breakdown,
        metrics: result.metrics,
        benchmarks: result.benchmarks,
        ads_to_pause: result.ads_to_pause,
        ads_to_scale: result.ads_to_scale,
        ads_fatigued: result.ads_fatigued,
        top_performers: result.top_performers,
        insights: result.insights,
        created_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,ad_account_id",
      });
    } catch (dbErr) {
      console.error("Failed to store diagnostic:", dbErr);
      // Non-fatal — return result anyway
    }

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("account-diagnostic error:", err);
    return new Response(JSON.stringify({ error: "internal_error", message: err.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
