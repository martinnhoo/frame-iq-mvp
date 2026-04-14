import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface AccountBaseline {
  baseline_p25_ctr: number;
  baseline_median_ctr: number;
  baseline_p75_cpa: number;
  baseline_median_cpa: number;
  baseline_median_roas: number;
  monthly_budget_cents: number;
  cpa_target_cents: number;
}

interface AdMetric {
  ad_id: string;
  impressions: number;
  clicks: number;
  spend_cents: number;
  conversions: number;
  cpa_cents: number;
  roas: number;
  frequency: number;
  hook_rate: number;
  ctr: number;
  created_at: string;
  updated_at: string;
  minutes_active: number;
}

interface Ad {
  id: string;
  account_id: string;
  ad_metrics: AdMetric[];
}

interface Decision {
  ad_id: string;
  account_id: string;
  classification: "KILL" | "FIX" | "SCALE";
  score: number;
  daily_impact_cents: number;
  headline: string;
  reason: string;
  actions: string[];
  metrics_snapshot: Record<string, number>;
}

function formatMoney(centavos: number): string {
  const reais = centavos / 100;
  if (reais >= 100) {
    return `R$${Math.floor(reais).toLocaleString("pt-BR")}`;
  }
  return `R$${reais.toFixed(2).replace(".", ",")}`;
}

function calculateCTR(clicks: number, impressions: number): number {
  if (impressions === 0) return 0;
  return (clicks / impressions) * 100;
}

function calculateScore(
  classification: "KILL" | "FIX" | "SCALE",
  metrics: AdMetric,
  baseline: AccountBaseline
): number {
  let score = 0;

  if (classification === "KILL") {
    // KILL scores: 85-100 based on severity
    const ctrRatio = metrics.ctr / baseline.baseline_p25_ctr;
    const cpaRatio = metrics.cpa_cents / (baseline.cpa_target_cents * 2);
    const spendScore = Math.min((metrics.spend_cents / 5000) * 20, 20);

    if (ctrRatio < 0.5) score += 25;
    else if (ctrRatio < 0.7) score += 15;
    else score += 5;

    if (metrics.conversions === 0 && metrics.spend_cents > baseline.cpa_target_cents * 2) {
      score += 40;
    } else if (cpaRatio > 2.5 && metrics.impressions > 1000) {
      score += 35;
    } else {
      score += 10;
    }

    score += spendScore;
    score = Math.min(score, 100);
  } else if (classification === "FIX") {
    // FIX scores: 60-84 based on fixability
    score = 70;

    if (metrics.ctr > baseline.baseline_median_ctr && metrics.cpa_cents > baseline.baseline_p75_cpa) {
      score += 10;
    }

    if (metrics.hook_rate > 0.4 && metrics.ctr < baseline.baseline_median_ctr) {
      score += 5;
    }

    if (metrics.frequency > 3.0) {
      score += 5;
    }

    score = Math.min(score, 84);
  } else {
    // SCALE scores: 50-69 based on upside potential
    score = 60;

    if (metrics.cpa_cents < baseline.baseline_median_cpa) {
      const cpaDeviation = ((baseline.baseline_median_cpa - metrics.cpa_cents) / baseline.baseline_median_cpa) * 100;
      if (cpaDeviation < 10) score += 8;
      else score += 4;
    }

    if (metrics.roas > baseline.baseline_median_roas * 2) {
      score += 5;
    }

    score = Math.min(score, 69);
  }

  return Math.max(Math.round(score), 0);
}

function classifyAd(
  metrics: AdMetric,
  baseline: AccountBaseline
): "KILL" | "FIX" | "SCALE" | null {
  // Check minimum data threshold
  if (metrics.impressions <= 500 || metrics.minutes_active < 24 * 60) {
    return null;
  }

  // KILL conditions
  const kill1 = metrics.ctr < baseline.baseline_p25_ctr &&
                metrics.spend_cents > 5000 &&
                metrics.minutes_active > 48 * 60;

  const kill2 = metrics.spend_cents > baseline.cpa_target_cents * 2 &&
                metrics.conversions === 0;

  const kill3 = metrics.cpa_cents > baseline.baseline_median_cpa * 2.5 &&
                metrics.impressions > 1000;

  if (kill1 || kill2 || kill3) {
    return "KILL";
  }

  // FIX conditions
  const fix1 = metrics.ctr > baseline.baseline_median_ctr &&
               metrics.cpa_cents > baseline.baseline_p75_cpa;

  const fix2 = metrics.hook_rate > 0.4 &&
               metrics.ctr < baseline.baseline_median_ctr;

  const fix3 = metrics.frequency > 3.0;

  if (fix1 || fix2 || fix3) {
    return "FIX";
  }

  // SCALE conditions
  const cpaDeviation = baseline.baseline_median_cpa > 0
    ? Math.abs((metrics.cpa_cents - baseline.baseline_median_cpa) / baseline.baseline_median_cpa) * 100
    : 0;

  const scale1 = metrics.cpa_cents < baseline.baseline_median_cpa &&
                 cpaDeviation < 10 &&
                 metrics.spend_cents < (baseline.monthly_budget_cents / 30) * 0.5;

  const scale2 = metrics.roas > baseline.baseline_median_roas * 2;

  if (scale1 || scale2) {
    return "SCALE";
  }

  return null;
}

function calculateDailyImpact(
  classification: "KILL" | "FIX" | "SCALE",
  metrics: AdMetric,
  baseline: AccountBaseline
): number {
  if (classification === "KILL") {
    // Daily waste = daily spend for ads with poor performance
    return Math.round(metrics.spend_cents / 7);
  } else if (classification === "FIX") {
    // Potential savings if we improve CPA to baseline median
    if (metrics.conversions > 0) {
      const cpaSavings = metrics.cpa_cents - baseline.baseline_median_cpa;
      const projectedDailyConversions = (metrics.conversions / 7);
      return Math.round(cpaSavings * projectedDailyConversions);
    }
    return 0;
  } else {
    // Potential revenue increase from scaling
    if (metrics.conversions > 0 && metrics.roas > 0) {
      const projectedDailyConversions = (metrics.conversions / 7);
      const additionalRevenuePerConversion = (metrics.cpa_cents / metrics.roas) * (metrics.roas * 2 - metrics.roas);
      return Math.round(additionalRevenuePerConversion * projectedDailyConversions);
    }
    return 0;
  }
}

function generateDecisionCopy(
  classification: "KILL" | "FIX" | "SCALE",
  metrics: AdMetric,
  baseline: AccountBaseline,
  dailyImpact: number
): { headline: string; reason: string } {
  if (classification === "KILL") {
    if (metrics.conversions === 0 && metrics.spend_cents > baseline.cpa_target_cents * 2) {
      return {
        headline: `Anúncio sugando R$${Math.round(metrics.spend_cents / 100)}/dia sem retorno`,
        reason: `Gastou R$${formatMoney(metrics.spend_cents)} e 0 conversões. Sangria pura.`,
      };
    }
    if (metrics.ctr < baseline.baseline_p25_ctr) {
      return {
        headline: `Você está perdendo ${formatMoney(dailyImpact)}/dia aqui`,
        reason: `CTR no fundo do poço (${metrics.ctr.toFixed(2)}%). Já rodou ${Math.round(metrics.minutes_active / 60)}h. Está queimando dinheiro.`,
      };
    }
    if (metrics.cpa_cents > baseline.baseline_median_cpa * 2.5) {
      return {
        headline: `CPA ${(metrics.cpa_cents / baseline.baseline_median_cpa).toFixed(1)}x acima da linha`,
        reason: `Custa ${formatMoney(metrics.cpa_cents)} por conversão. Mediana é ${formatMoney(baseline.baseline_median_cpa)}. Não sobrevive.`,
      };
    }
    return {
      headline: "Esse anúncio não vai funcionar",
      reason: "Métricas ruins demais. Parar antes de piorar.",
    };
  } else if (classification === "FIX") {
    if (metrics.ctr > baseline.baseline_median_ctr && metrics.cpa_cents > baseline.baseline_p75_cpa) {
      return {
        headline: `Ótimo engajamento, mas conversão fraca`,
        reason: `Hook rate ${(metrics.hook_rate * 100).toFixed(0)}% é top. CTR ${metrics.ctr.toFixed(2)}% está bom. Mas CPA ${formatMoney(metrics.cpa_cents)} está caro. Mexe na oferta ou segmentação.`,
      };
    }
    if (metrics.hook_rate > 0.4 && metrics.ctr < baseline.baseline_median_ctr) {
      return {
        headline: `Anúncio prende, mas cliques estão baixos`,
        reason: `Galera vê e aprecia (hook ${(metrics.hook_rate * 100).toFixed(0)}%), mas não clica o suficiente. Mexe no CTA ou copy.`,
      };
    }
    if (metrics.frequency > 3.0) {
      return {
        headline: `Desgaste já visível - frequência alta`,
        reason: `Cada pessoa viu ${metrics.frequency.toFixed(1)}x em média. CTR está caindo. Pausa alguns dias ou segmenta novo público.`,
      };
    }
    return {
      headline: "Anúncio promissor, mas precisa ajuste",
      reason: `Tem potencial. Mas algo não bate. Teste novo creative ou segmentação.`,
    };
  } else {
    // SCALE
    if (metrics.roas > baseline.baseline_median_roas * 2) {
      const roasMultiple = (metrics.roas / baseline.baseline_median_roas).toFixed(1);
      return {
        headline: `ROAS ${roasMultiple}x acima da base - joga mais grana`,
        reason: `Esse anúncio tá voando. ROAS ${metrics.roas.toFixed(2)}x. Mediana é ${baseline.baseline_median_roas.toFixed(2)}x. Aumenta budget em 50-100%.`,
      };
    }
    if (metrics.cpa_cents < baseline.baseline_median_cpa) {
      const cpaSavings = baseline.baseline_median_cpa - metrics.cpa_cents;
      return {
        headline: `CPA ${formatMoney(metrics.cpa_cents)} - ${Math.round((cpaSavings / baseline.baseline_median_cpa) * 100)}% melhor que a média`,
        reason: `Esse anúncio tá barato demais pra ignorar. CPA estável. Aumenta gasto em 50% e vê o que acontece.`,
      };
    }
    return {
      headline: "Anúncio com bom retorno - escala agora",
      reason: `Métrica está consistente e lucrativa. Não deixa na mão. Aumenta budget.`,
    };
  }
}

function getActionsForDecision(
  classification: "KILL" | "FIX" | "SCALE",
  metrics: AdMetric
): string[] {
  if (classification === "KILL") {
    return ["pause_immediately", "analyze_wasted_spend", "review_targeting"];
  } else if (classification === "FIX") {
    return ["test_new_creative", "adjust_offer", "segment_audience", "increase_bid"];
  } else {
    return ["increase_budget", "expand_audience", "duplicate_creative", "extend_duration"];
  }
}

async function fetchAccountBaselines(accountId: string): Promise<AccountBaseline | null> {
  const { data, error } = await supabase
    .from("account_baselines")
    .select(
      "baseline_p25_ctr, baseline_median_ctr, baseline_p75_cpa, baseline_median_cpa, baseline_median_roas, monthly_budget_cents, cpa_target_cents"
    )
    .eq("account_id", accountId)
    .single();

  if (error) {
    console.error("Error fetching account baselines:", error);
    return null;
  }

  return data as AccountBaseline;
}

async function fetchAdsWithMetrics(accountId: string): Promise<Ad[]> {
  const { data, error } = await supabase
    .from("ads")
    .select(
      `
      id,
      account_id,
      ad_metrics (
        ad_id,
        impressions,
        clicks,
        spend_cents,
        conversions,
        cpa_cents,
        roas,
        frequency,
        hook_rate,
        created_at,
        updated_at
      )
    `
    )
    .eq("account_id", accountId)
    .eq("status", "active");

  if (error) {
    console.error("Error fetching ads with metrics:", error);
    return [];
  }

  // Aggregate metrics to 7-day window
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const enrichedAds = (data || []).map((ad: any) => {
    const recentMetrics = (ad.ad_metrics || []).filter((m: any) => {
      const createdAt = new Date(m.created_at);
      return createdAt >= sevenDaysAgo;
    });

    // Aggregate the metrics
    const aggregated: AdMetric = {
      ad_id: ad.id,
      impressions: recentMetrics.reduce((sum: number, m: any) => sum + (m.impressions || 0), 0),
      clicks: recentMetrics.reduce((sum: number, m: any) => sum + (m.clicks || 0), 0),
      spend_cents: recentMetrics.reduce((sum: number, m: any) => sum + (m.spend_cents || 0), 0),
      conversions: recentMetrics.reduce((sum: number, m: any) => sum + (m.conversions || 0), 0),
      cpa_cents: 0,
      roas: recentMetrics.length > 0 ? recentMetrics[recentMetrics.length - 1].roas : 0,
      frequency: recentMetrics.length > 0 ? recentMetrics[recentMetrics.length - 1].frequency : 0,
      hook_rate: recentMetrics.length > 0 ? recentMetrics[recentMetrics.length - 1].hook_rate : 0,
      ctr: 0,
      created_at: recentMetrics[0]?.created_at || now.toISOString(),
      updated_at: recentMetrics[recentMetrics.length - 1]?.updated_at || now.toISOString(),
      minutes_active: 0,
    };

    // Calculate derived metrics
    aggregated.ctr = calculateCTR(aggregated.clicks, aggregated.impressions);
    aggregated.cpa_cents = aggregated.conversions > 0
      ? Math.round(aggregated.spend_cents / aggregated.conversions)
      : 999999;
    aggregated.minutes_active = Math.round(
      (new Date(aggregated.updated_at).getTime() - new Date(aggregated.created_at).getTime()) / (1000 * 60)
    );

    return {
      id: ad.id,
      account_id: ad.account_id,
      ad_metrics: [aggregated],
    };
  });

  return enrichedAds;
}

async function upsertDecisions(decisions: Decision[]): Promise<void> {
  if (decisions.length === 0) return;

  const { error } = await supabase.from("decisions").upsert(
    decisions.map((d) => ({
      ad_id: d.ad_id,
      account_id: d.account_id,
      classification: d.classification,
      score: d.score,
      daily_impact_cents: d.daily_impact_cents,
      headline: d.headline,
      reason: d.reason,
      actions: d.actions,
      metrics_snapshot: d.metrics_snapshot,
      status: "pending",
      created_at: new Date().toISOString(),
    })),
    { onConflict: "ad_id" }
  );

  if (error) {
    console.error("Error upserting decisions:", error);
  }
}

async function updateMoneyTracker(accountId: string, decisions: Decision[]): Promise<void> {
  const leavingNow = decisions
    .filter((d) => d.classification === "KILL")
    .reduce((sum, d) => sum + d.daily_impact_cents, 0);

  const capturableNow = decisions
    .filter((d) => d.classification === "FIX")
    .reduce((sum, d) => sum + d.daily_impact_cents, 0);

  const { error } = await supabase
    .from("money_tracker")
    .upsert(
      {
        account_id: accountId,
        leaking_now: leavingNow,
        capturable_now: capturableNow,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id" }
    );

  if (error) {
    console.error("Error updating money tracker:", error);
  }
}

serve(async (req: Request) => {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const { account_id } = await req.json();

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: "Missing account_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch baselines
    const baseline = await fetchAccountBaselines(account_id);
    if (!baseline) {
      return new Response(
        JSON.stringify({ error: "No baselines found for account" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch ads with metrics
    const ads = await fetchAdsWithMetrics(account_id);

    // Process each ad and generate decisions
    const decisions: Decision[] = [];

    for (const ad of ads) {
      const metrics = ad.ad_metrics[0];
      if (!metrics) continue;

      const classification = classifyAd(metrics, baseline);
      if (!classification) continue;

      const score = calculateScore(classification, metrics, baseline);
      const dailyImpact = calculateDailyImpact(classification, metrics, baseline);
      const { headline, reason } = generateDecisionCopy(classification, metrics, baseline, dailyImpact);
      const actions = getActionsForDecision(classification, metrics);

      decisions.push({
        ad_id: ad.id,
        account_id: account_id,
        classification,
        score,
        daily_impact_cents: dailyImpact,
        headline,
        reason,
        actions,
        metrics_snapshot: {
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          spend_cents: metrics.spend_cents,
          conversions: metrics.conversions,
          ctr: metrics.ctr,
          cpa_cents: metrics.cpa_cents,
          roas: metrics.roas,
          frequency: metrics.frequency,
          hook_rate: metrics.hook_rate,
        },
      });
    }

    // Sort: KILL first (by score desc), then FIX, then SCALE
    decisions.sort((a, b) => {
      const classificationOrder = { KILL: 0, FIX: 1, SCALE: 2 };
      const classCompare = classificationOrder[a.classification] - classificationOrder[b.classification];
      if (classCompare !== 0) return classCompare;
      return b.score - a.score;
    });

    // Upsert decisions
    await upsertDecisions(decisions);

    // Update money tracker
    await updateMoneyTracker(account_id, decisions);

    return new Response(
      JSON.stringify({
        success: true,
        total_decisions: decisions.length,
        kill_count: decisions.filter((d) => d.classification === "KILL").length,
        fix_count: decisions.filter((d) => d.classification === "FIX").length,
        scale_count: decisions.filter((d) => d.classification === "SCALE").length,
        decisions,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
