// ================================================================
// ADBRIEF DECISION ENGINE v2
// The brain of the product.
//
// Detects problems, quantifies financial impact, explains why,
// recommends actions. Outputs prioritized feed of decisions.
//
// Rules:
// - ZERO manual input from user
// - Feed NEVER empty (low data mode)
// - Every item has confidence scoring
// - Anti-spam: cluster similar issues
// - Include PAUSED ads (learning data)
// - Financial impact on every item
// ================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ================================================================
// TYPES
// ================================================================

interface AccountBaseline {
  baseline_p25_ctr: number;
  baseline_median_ctr: number;
  baseline_p75_ctr: number;
  baseline_p75_cpa: number;
  baseline_median_cpa: number;
  baseline_median_roas: number;
  monthly_budget_cents: number;
  cpa_target_cents: number;
  sample_size: number;
  maturity_level: string;
}

interface AggregatedMetrics {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  adset_name: string;
  ad_status: string;
  effective_status: string;
  // Creative features
  cta_type: string | null;
  creative_format: string | null;
  body_text: string | null;
  has_hook: boolean;
  hook_rate: number;
  // Metrics (7d aggregate)
  impressions: number;
  clicks: number;
  spend_cents: number;
  conversions: number;
  revenue_cents: number;
  ctr: number;
  cpa_cents: number;
  cpc_cents: number;
  cpm_cents: number;
  roas: number;
  frequency: number;
  // Derived
  days_active: number;
  daily_spend_cents: number;
  // Previous period (for deltas)
  prev_ctr: number;
  prev_cpa_cents: number;
  prev_cpm_cents: number;
  prev_frequency: number;
}

type DecisionType = "kill" | "fix" | "scale" | "pattern" | "insight";
type Confidence = "high" | "medium" | "low";

interface FeedItem {
  ad_id: string | null;
  account_id: string;
  type: DecisionType;
  score: number;
  headline: string;
  reason: string;
  impact_type: "waste" | "savings" | "revenue" | "learning";
  impact_daily_cents: number;
  impact_7d_cents: number;
  confidence: Confidence;
  impact_basis: string;
  metrics_snapshot: Record<string, unknown>;
  actions: ActionDef[];
  // Clustering
  cluster_key: string;
  // Pattern-specific
  pattern_type?: string;
  pattern_sample_size?: number;
  pattern_impact_pct?: number;
}

interface ActionDef {
  id: string;
  label: string;
  type: "destructive" | "constructive" | "neutral";
  requires_confirmation: boolean;
  meta_api_action?: string;
}

// ================================================================
// HELPERS
// ================================================================

function formatMoney(centavos: number): string {
  const reais = Math.abs(centavos) / 100;
  if (reais >= 100) return `R$${Math.floor(reais).toLocaleString("pt-BR")}`;
  return `R$${reais.toFixed(2).replace(".", ",")}`;
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function uuid(): string {
  return crypto.randomUUID();
}

// ================================================================
// PART 1 — DECISION ENGINE (PROBLEMS)
// ================================================================

function detectProblems(
  ads: AggregatedMetrics[],
  baseline: AccountBaseline
): FeedItem[] {
  const items: FeedItem[] = [];

  for (const ad of ads) {
    // Skip ads with too little data for KILL/FIX (but not for insights)
    const hasMinData = ad.impressions >= 500 && ad.days_active >= 2;

    // ── KILL CONDITIONS ──────────────────────────────────────────
    if (hasMinData) {
      // 1. Creative issue: CTR ↓ AND CPA ↑
      const ctrDrop = ad.prev_ctr > 0 ? pctChange(ad.ctr, ad.prev_ctr) : null;
      const cpaDelta = ad.prev_cpa_cents > 0 ? pctChange(ad.cpa_cents, ad.prev_cpa_cents) : null;

      if (
        ad.ctr < baseline.baseline_p25_ctr &&
        ad.spend_cents > 5000 &&
        ad.days_active >= 3
      ) {
        const dailyWaste = ad.daily_spend_cents;
        items.push({
          ad_id: ad.ad_id,
          account_id: "",
          type: "kill",
          score: calculateKillScore(ad, baseline),
          headline: `${formatMoney(dailyWaste)}/dia em perda potencial identificada`,
          reason: `CTR ${(ad.ctr * 100).toFixed(2)}% — ${Math.round((1 - ad.ctr / baseline.baseline_median_ctr) * 100)}% abaixo da mediana\nGasto: ${formatMoney(ad.spend_cents)} em ${ad.days_active} dias sem retorno proporcional`,
          impact_type: "waste",
          impact_daily_cents: dailyWaste,
          impact_7d_cents: dailyWaste * 7,
          confidence: dailyWaste > 5000 ? "high" : ad.days_active >= 5 ? "high" : "medium",
          impact_basis: `Baseado nos últimos ${ad.days_active} dias de gasto`,
          metrics_snapshot: buildMetricsSnapshot(ad, baseline),
          actions: [
            { id: uuid(), label: "Pausar anúncio", type: "destructive", requires_confirmation: true, meta_api_action: "pause_ad" },
            { id: uuid(), label: "Ver detalhes", type: "neutral", requires_confirmation: false },
          ],
          cluster_key: `kill_low_ctr_${ad.campaign_name}`,
        });
        continue;
      }

      // 2. Zero conversions with high spend
      if (ad.conversions === 0 && ad.spend_cents > baseline.cpa_target_cents * 2) {
        const dailyWaste = ad.daily_spend_cents;
        items.push({
          ad_id: ad.ad_id,
          account_id: "",
          type: "kill",
          score: clamp(85 + Math.min((ad.spend_cents / baseline.cpa_target_cents) * 5, 15), 85, 100),
          headline: `Estimativa de ${formatMoney(dailyWaste)}/dia sem conversão`,
          reason: `Gasto: ${formatMoney(ad.spend_cents)} nos últimos ${ad.days_active} dias\nConversões: 0 — orçamento melhor alocado em anúncios que convertem`,
          impact_type: "waste",
          impact_daily_cents: dailyWaste,
          impact_7d_cents: dailyWaste * 7,
          confidence: "high",
          impact_basis: "Baseado em zero conversões com gasto significativo",
          metrics_snapshot: buildMetricsSnapshot(ad, baseline),
          actions: [
            { id: uuid(), label: "Pausar agora", type: "destructive", requires_confirmation: true, meta_api_action: "pause_ad" },
            { id: uuid(), label: "Ver detalhes", type: "neutral", requires_confirmation: false },
          ],
          cluster_key: `kill_no_conv_${ad.campaign_name}`,
        });
        continue;
      }

      // 3. CPA way above baseline
      if (ad.cpa_cents > baseline.baseline_median_cpa * 2.5 && ad.conversions > 0) {
        const excessDaily = Math.round((ad.cpa_cents - baseline.baseline_median_cpa) * (ad.conversions / Math.max(ad.days_active, 1)));
        items.push({
          ad_id: ad.ad_id,
          account_id: "",
          type: "kill",
          score: clamp(85 + Math.min((ad.cpa_cents / baseline.baseline_median_cpa - 2) * 5, 15), 85, 100),
          headline: `CPA ${(ad.cpa_cents / baseline.baseline_median_cpa).toFixed(1)}x acima da mediana`,
          reason: `CPA: ${formatMoney(ad.cpa_cents)} vs mediana ${formatMoney(baseline.baseline_median_cpa)}\nBaseado em ${ad.conversions} conversões — tendência insustentável`,
          impact_type: "waste",
          impact_daily_cents: excessDaily,
          impact_7d_cents: excessDaily * 7,
          confidence: ad.conversions >= 3 ? "high" : "medium",
          impact_basis: `Baseado em ${ad.conversions} conversões nos últimos ${ad.days_active} dias`,
          metrics_snapshot: buildMetricsSnapshot(ad, baseline),
          actions: [
            { id: uuid(), label: "Pausar anúncio", type: "destructive", requires_confirmation: true, meta_api_action: "pause_ad" },
            { id: uuid(), label: "Testar novo criativo", type: "constructive", requires_confirmation: false },
          ],
          cluster_key: `kill_high_cpa_${ad.campaign_name}`,
        });
        continue;
      }

      // ── FIX CONDITIONS ───────────────────────────────────────────

      // 4. Audience issue: CPM ↑ AND CPA ↑
      if (
        ad.prev_cpm_cents > 0 &&
        ad.cpm_cents > ad.prev_cpm_cents * 1.3 &&
        ad.cpa_cents > baseline.baseline_p75_cpa
      ) {
        const savings = Math.round((ad.cpa_cents - baseline.baseline_median_cpa) * (ad.conversions / Math.max(ad.days_active, 1)));
        items.push({
          ad_id: ad.ad_id,
          account_id: "",
          type: "fix",
          score: clamp(70 + Math.min(savings / 1000, 14), 60, 84),
          headline: "CPM subindo — possível saturação de público",
          reason: `CPM: +${Math.round(((ad.cpm_cents / ad.prev_cpm_cents) - 1) * 100)}% vs período anterior\nCPA: ${formatMoney(ad.cpa_cents)} — acima do p75 da conta`,
          impact_type: "savings",
          impact_daily_cents: savings,
          impact_7d_cents: savings * 7,
          confidence: ad.days_active >= 4 ? "medium" : "low",
          impact_basis: "Baseado na diferença entre CPA atual e mediana da conta",
          metrics_snapshot: buildMetricsSnapshot(ad, baseline),
          actions: [
            { id: uuid(), label: "Ajustar público", type: "constructive", requires_confirmation: false },
            { id: uuid(), label: "Duplicar com novo público", type: "constructive", requires_confirmation: false },
          ],
          cluster_key: `fix_audience_${ad.campaign_name}`,
        });
        continue;
      }

      // 5. Creative fatigue: frequency > threshold AND CPA ↑
      if (ad.frequency > 3.0 && ad.cpa_cents > baseline.baseline_median_cpa * 1.3) {
        const dailySavings = Math.round(ad.daily_spend_cents * 0.3); // 30% waste from fatigue
        items.push({
          ad_id: ad.ad_id,
          account_id: "",
          type: "fix",
          score: clamp(65 + Math.min(ad.frequency * 3, 19), 60, 84),
          headline: `Fadiga criativa detectada — frequência ${ad.frequency.toFixed(1)}x`,
          reason: `Frequência: ${ad.frequency.toFixed(1)}x por pessoa\nCPA: ${formatMoney(ad.cpa_cents)} — subindo com a repetição`,
          impact_type: "savings",
          impact_daily_cents: dailySavings,
          impact_7d_cents: dailySavings * 7,
          confidence: ad.frequency > 4.5 ? "high" : "medium",
          impact_basis: `Frequência ${ad.frequency.toFixed(1)}x — estimativa de 30% de perda por fadiga`,
          metrics_snapshot: buildMetricsSnapshot(ad, baseline),
          actions: [
            { id: uuid(), label: "Pausar 3 dias", type: "neutral", requires_confirmation: true, meta_api_action: "pause_ad" },
            { id: uuid(), label: "Gerar novo hook", type: "constructive", requires_confirmation: false, meta_api_action: "generate_hook" },
          ],
          cluster_key: `fix_fatigue_${ad.campaign_name}`,
        });
        continue;
      }

      // 6. Good hook but low clicks — CTA/copy issue
      if (ad.has_hook && ad.hook_rate > 0.4 && ad.ctr < baseline.baseline_median_ctr) {
        const potentialClicks = Math.round(ad.impressions * baseline.baseline_median_ctr) - ad.clicks;
        const potentialSavings = ad.conversions > 0 ? Math.round(potentialClicks * (ad.conversions / ad.clicks) * ad.cpa_cents * 0.3) : 0;
        items.push({
          ad_id: ad.ad_id,
          account_id: "",
          type: "fix",
          score: clamp(70 + (ad.hook_rate > 0.6 ? 10 : 5), 60, 84),
          headline: "Hook forte, mas CTR abaixo do esperado",
          reason: `Hook rate: ${(ad.hook_rate * 100).toFixed(0)}% — retém atenção\nCTR: ${(ad.ctr * 100).toFixed(2)}% — abaixo da mediana. CTA ou copy pode melhorar`,
          impact_type: "savings",
          impact_daily_cents: Math.round(potentialSavings / Math.max(ad.days_active, 1)),
          impact_7d_cents: potentialSavings,
          confidence: "medium",
          impact_basis: "Baseado no potencial de cliques se CTR atingir a mediana",
          metrics_snapshot: buildMetricsSnapshot(ad, baseline),
          actions: [
            { id: uuid(), label: "Testar novo CTA", type: "constructive", requires_confirmation: false },
            { id: uuid(), label: "Gerar variação", type: "constructive", requires_confirmation: false, meta_api_action: "generate_variation" },
          ],
          cluster_key: `fix_cta_${ad.campaign_name}`,
        });
        continue;
      }

      // 7. Funnel issue: CVR ↓ (good CTR but bad conversion rate)
      if (
        ad.ctr > baseline.baseline_median_ctr &&
        ad.cpa_cents > baseline.baseline_p75_cpa &&
        ad.conversions > 0
      ) {
        const excessCpa = Math.round((ad.cpa_cents - baseline.baseline_median_cpa) * (ad.conversions / Math.max(ad.days_active, 1)));
        items.push({
          ad_id: ad.ad_id,
          account_id: "",
          type: "fix",
          score: clamp(68 + Math.min(excessCpa / 500, 16), 60, 84),
          headline: "Engajamento alto, conversão abaixo do esperado",
          reason: `CTR: ${(ad.ctr * 100).toFixed(2)}% — acima da mediana\nCPA: ${formatMoney(ad.cpa_cents)} — ${(ad.cpa_cents / baseline.baseline_median_cpa).toFixed(1)}x a mediana. Possível problema no funil`,
          impact_type: "savings",
          impact_daily_cents: excessCpa,
          impact_7d_cents: excessCpa * 7,
          confidence: ad.conversions >= 5 ? "high" : "medium",
          impact_basis: "Baseado na diferença de CPA vs mediana da conta",
          metrics_snapshot: buildMetricsSnapshot(ad, baseline),
          actions: [
            { id: uuid(), label: "Entender impacto", type: "neutral", requires_confirmation: false },
            { id: uuid(), label: "Revisar dados", type: "constructive", requires_confirmation: false },
          ],
          cluster_key: `fix_funnel_${ad.campaign_name}`,
        });
        continue;
      }

      // ── SCALE CONDITIONS ──────────────────────────────────────────

      // 8. ROAS muito acima da base
      if (ad.roas > baseline.baseline_median_roas * 2 && ad.conversions >= 2) {
        const roasMultiple = (ad.roas / Math.max(baseline.baseline_median_roas, 0.01)).toFixed(1);
        const additionalRevenue = Math.round(ad.daily_spend_cents * ad.roas * 0.5); // Revenue from 50% budget increase
        items.push({
          ad_id: ad.ad_id,
          account_id: "",
          type: "scale",
          score: clamp(55 + Math.min(ad.roas * 3, 14), 50, 69),
          headline: `ROAS ${roasMultiple}x acima da base — oportunidade de escala`,
          reason: `ROAS: ${ad.roas.toFixed(2)}x vs mediana ${baseline.baseline_median_roas.toFixed(2)}x\nBudget atual sub-utilizado — projeção de +50% com retorno proporcional`,
          impact_type: "revenue",
          impact_daily_cents: additionalRevenue,
          impact_7d_cents: additionalRevenue * 7,
          confidence: ad.conversions >= 5 ? "high" : ad.conversions >= 3 ? "medium" : "low",
          impact_basis: `Projeção com +50% de budget (${ad.conversions} conversões atuais)`,
          metrics_snapshot: buildMetricsSnapshot(ad, baseline),
          actions: [
            { id: uuid(), label: "Aumentar budget +50%", type: "constructive", requires_confirmation: true, meta_api_action: "increase_budget" },
            { id: uuid(), label: "Duplicar anúncio", type: "constructive", requires_confirmation: false, meta_api_action: "duplicate_ad" },
          ],
          cluster_key: `scale_roas_${ad.campaign_name}`,
        });
        continue;
      }

      // 9. CPA muito abaixo da mediana — oportunidade de escala
      if (ad.cpa_cents < baseline.baseline_median_cpa * 0.7 && ad.conversions >= 2) {
        const savings = baseline.baseline_median_cpa - ad.cpa_cents;
        const savingsPct = Math.round((savings / baseline.baseline_median_cpa) * 100);
        items.push({
          ad_id: ad.ad_id,
          account_id: "",
          type: "scale",
          score: clamp(55 + Math.min(savingsPct / 3, 14), 50, 69),
          headline: `CPA ${formatMoney(ad.cpa_cents)} — ${savingsPct}% abaixo da mediana`,
          reason: `CPA: ${formatMoney(ad.cpa_cents)} vs mediana ${formatMoney(baseline.baseline_median_cpa)}\nPerformance estável com margem para escalar`,
          impact_type: "revenue",
          impact_daily_cents: Math.round(ad.daily_spend_cents * 0.5 * ad.roas),
          impact_7d_cents: Math.round(ad.daily_spend_cents * 0.5 * ad.roas * 7),
          confidence: ad.conversions >= 5 ? "high" : "medium",
          impact_basis: `CPA ${savingsPct}% abaixo da mediana com ${ad.conversions} conversões`,
          metrics_snapshot: buildMetricsSnapshot(ad, baseline),
          actions: [
            { id: uuid(), label: "Aumentar budget +50%", type: "constructive", requires_confirmation: true, meta_api_action: "increase_budget" },
            { id: uuid(), label: "Expandir público", type: "constructive", requires_confirmation: false },
          ],
          cluster_key: `scale_cpa_${ad.campaign_name}`,
        });
        continue;
      }
    }
  }

  return items;
}

function calculateKillScore(ad: AggregatedMetrics, baseline: AccountBaseline): number {
  let score = 85;
  const ctrRatio = ad.ctr / Math.max(baseline.baseline_p25_ctr, 0.0001);
  if (ctrRatio < 0.5) score += 8;
  else if (ctrRatio < 0.7) score += 4;
  if (ad.conversions === 0 && ad.spend_cents > baseline.cpa_target_cents * 2) score += 5;
  if (ad.days_active >= 5) score += 2;
  return clamp(score, 85, 100);
}

function buildMetricsSnapshot(ad: AggregatedMetrics, baseline: AccountBaseline): Record<string, unknown> {
  return {
    impressions: ad.impressions,
    clicks: ad.clicks,
    spend_cents: ad.spend_cents,
    conversions: ad.conversions,
    ctr: ad.ctr,
    cpa_cents: ad.cpa_cents,
    roas: ad.roas,
    frequency: ad.frequency,
    hook_rate: ad.hook_rate,
    baseline_ctr: baseline.baseline_median_ctr,
    baseline_cpa: baseline.baseline_median_cpa,
    baseline_roas: baseline.baseline_median_roas,
  };
}

// ================================================================
// PART 2 — PATTERN ENGINE (LEARNING)
// ================================================================

interface PatternGroup {
  key: string;
  label: string;
  ads: AggregatedMetrics[];
}

function detectPatterns(
  ads: AggregatedMetrics[],
  baseline: AccountBaseline
): FeedItem[] {
  const items: FeedItem[] = [];
  const groups: PatternGroup[] = [];

  // ── Group by CTA type ──
  const ctaGroups = groupBy(ads, a => a.cta_type || "unknown");
  for (const [cta, adsList] of Object.entries(ctaGroups)) {
    if (adsList.length >= 3) {
      groups.push({ key: `cta_${cta}`, label: `CTA "${cta.replace(/_/g, " ")}"`, ads: adsList });
    }
  }

  // ── Group by creative format ──
  const formatGroups = groupBy(ads, a => a.creative_format || "unknown");
  for (const [fmt, adsList] of Object.entries(formatGroups)) {
    if (adsList.length >= 3) {
      groups.push({ key: `format_${fmt}`, label: `Formato "${fmt}"`, ads: adsList });
    }
  }

  // ── Group by text length ──
  const textLenGroups = groupBy(ads, a => {
    const len = (a.body_text || "").length;
    if (len === 0) return "sem_texto";
    if (len < 80) return "curto";
    if (len < 200) return "medio";
    return "longo";
  });
  for (const [tl, adsList] of Object.entries(textLenGroups)) {
    if (adsList.length >= 3) {
      groups.push({ key: `textlen_${tl}`, label: `Texto ${tl}`, ads: adsList });
    }
  }

  // ── Analyze each group vs baseline ──
  for (const group of groups) {
    const avgCtr = average(group.ads, a => a.ctr);
    const avgCpa = average(group.ads.filter(a => a.conversions > 0), a => a.cpa_cents);
    const totalSpend = group.ads.reduce((s, a) => s + a.spend_cents, 0);

    if (totalSpend < 5000) continue; // Not enough spend to be meaningful

    const ctrDelta = baseline.baseline_median_ctr > 0
      ? ((avgCtr - baseline.baseline_median_ctr) / baseline.baseline_median_ctr) * 100
      : 0;

    const cpaDelta = baseline.baseline_median_cpa > 0 && avgCpa > 0
      ? ((avgCpa - baseline.baseline_median_cpa) / baseline.baseline_median_cpa) * 100
      : null;

    // Only report meaningful differences (> 15%)
    if (Math.abs(ctrDelta) < 15 && (cpaDelta === null || Math.abs(cpaDelta) < 15)) continue;

    const isPositive = ctrDelta > 15 || (cpaDelta !== null && cpaDelta < -15);
    const sampleSize = group.ads.length;
    const confidence: Confidence = sampleSize >= 10 ? "high" : sampleSize >= 5 ? "medium" : "low";

    if (isPositive) {
      const impactPct = Math.abs(ctrDelta) > 15 ? Math.round(ctrDelta) : Math.round(-(cpaDelta || 0));
      items.push({
        ad_id: null,
        account_id: "",
        type: "pattern",
        score: clamp(40 + Math.min(impactPct / 2, 20) + sampleSize, 30, 55),
        headline: `Padrão identificado: ${group.label}`,
        reason: ctrDelta > 15
          ? `+${Math.round(ctrDelta)}% CTR vs baseline da conta (${sampleSize} anúncios analisados)`
          : `CPA ${Math.round(-(cpaDelta || 0))}% menor vs baseline (${sampleSize} anúncios)`,
        impact_type: "learning",
        impact_daily_cents: Math.round(totalSpend / Math.max(group.ads[0]?.days_active || 7, 7) * 0.1),
        impact_7d_cents: Math.round(totalSpend * 0.1),
        confidence,
        impact_basis: `Baseado em ${sampleSize} anúncios com ${formatMoney(totalSpend)} de gasto total`,
        metrics_snapshot: {
          avg_ctr: avgCtr,
          avg_cpa: avgCpa,
          baseline_ctr: baseline.baseline_median_ctr,
          baseline_cpa: baseline.baseline_median_cpa,
          ctr_delta_pct: ctrDelta,
          cpa_delta_pct: cpaDelta,
          sample_size: sampleSize,
          total_spend: totalSpend,
        },
        actions: [
          { id: uuid(), label: "Priorizar esse padrão", type: "constructive", requires_confirmation: false },
          { id: uuid(), label: "Ver anúncios", type: "neutral", requires_confirmation: false },
        ],
        cluster_key: `pattern_positive_${group.key}`,
        pattern_type: group.key,
        pattern_sample_size: sampleSize,
        pattern_impact_pct: Math.round(ctrDelta),
      });
    } else {
      const impactPct = Math.abs(ctrDelta) > 15 ? Math.round(Math.abs(ctrDelta)) : Math.round(cpaDelta || 0);
      items.push({
        ad_id: null,
        account_id: "",
        type: "pattern",
        score: clamp(30 + Math.min(impactPct / 3, 15), 20, 45),
        headline: `Padrão negativo: ${group.label}`,
        reason: ctrDelta < -15
          ? `${Math.round(ctrDelta)}% CTR vs baseline (${sampleSize} anúncios)`
          : `CPA ${Math.round(cpaDelta || 0)}% maior vs baseline (${sampleSize} anúncios)`,
        impact_type: "waste",
        impact_daily_cents: Math.round(totalSpend / Math.max(group.ads[0]?.days_active || 7, 7) * 0.15),
        impact_7d_cents: Math.round(totalSpend * 0.15),
        confidence,
        impact_basis: `Baseado em ${sampleSize} anúncios com ${formatMoney(totalSpend)} de gasto total`,
        metrics_snapshot: {
          avg_ctr: avgCtr,
          avg_cpa: avgCpa,
          baseline_ctr: baseline.baseline_median_ctr,
          baseline_cpa: baseline.baseline_median_cpa,
          ctr_delta_pct: ctrDelta,
          cpa_delta_pct: cpaDelta,
          sample_size: sampleSize,
          total_spend: totalSpend,
        },
        actions: [
          { id: uuid(), label: "Evitar esse padrão", type: "neutral", requires_confirmation: false },
        ],
        cluster_key: `pattern_negative_${group.key}`,
        pattern_type: group.key,
        pattern_sample_size: sampleSize,
        pattern_impact_pct: Math.round(ctrDelta),
      });
    }
  }

  return items;
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

function average<T>(arr: T[], valFn: (item: T) => number): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, item) => s + valFn(item), 0) / arr.length;
}

// ================================================================
// LOW DATA MODE — ALWAYS PRODUCE VALUE
// ================================================================

function generateLowDataInsights(
  ads: AggregatedMetrics[],
  baseline: AccountBaseline | null,
  accountId: string
): FeedItem[] {
  const items: FeedItem[] = [];

  if (ads.length === 0) {
    // Zero ads — still provide value
    items.push({
      ad_id: null,
      account_id: accountId,
      type: "insight",
      score: 20,
      headline: "Conta conectada — pronta para análise",
      reason: "Quando seus anúncios começarem a rodar, as decisões aparecerão aqui automaticamente. O sistema monitora 24/7.",
      impact_type: "learning",
      impact_daily_cents: 0,
      impact_7d_cents: 0,
      confidence: "low",
      impact_basis: "Aguardando dados de campanha",
      metrics_snapshot: {},
      actions: [
        { id: uuid(), label: "Criar campanha", type: "constructive", requires_confirmation: false },
      ],
      cluster_key: "insight_no_ads",
    });
    return items;
  }

  // Few ads — contextual insights
  for (const ad of ads.slice(0, 3)) {
    if (ad.impressions < 500) {
      // Too early to judge but give feedback
      items.push({
        ad_id: ad.ad_id,
        account_id: accountId,
        type: "insight",
        score: 15,
        headline: "Anúncio em fase de aprendizado",
        reason: `${ad.ad_name} tem ${ad.impressions} impressões. Precisa de pelo menos 500 para gerar análise confiável. Aguarde mais ${Math.max(1, Math.ceil((500 - ad.impressions) / Math.max(ad.impressions / Math.max(ad.days_active, 1), 50)))} dia(s).`,
        impact_type: "learning",
        impact_daily_cents: ad.daily_spend_cents,
        impact_7d_cents: ad.daily_spend_cents * 7,
        confidence: "low",
        impact_basis: "Dados insuficientes para análise completa",
        metrics_snapshot: { impressions: ad.impressions, spend_cents: ad.spend_cents, days_active: ad.days_active },
        actions: [
          { id: uuid(), label: "Aguardar", type: "neutral", requires_confirmation: false },
        ],
        cluster_key: `insight_learning_${ad.ad_id}`,
      });
      continue;
    }

    // Has enough impressions but no baseline — provide raw metric insight
    if (!baseline) {
      if (ad.ctr < 0.01) {
        items.push({
          ad_id: ad.ad_id,
          account_id: accountId,
          type: "insight",
          score: 30,
          headline: "CTR abaixo do esperado para o nível de gasto",
          reason: `${ad.ad_name} tem CTR de ${(ad.ctr * 100).toFixed(2)}%. Para a maioria dos nichos, o mínimo saudável é 1%. Considere testar novo criativo.`,
          impact_type: "waste",
          impact_daily_cents: ad.daily_spend_cents,
          impact_7d_cents: ad.daily_spend_cents * 7,
          confidence: "low",
          impact_basis: "Baseado em benchmarks gerais do mercado",
          metrics_snapshot: buildSimpleSnapshot(ad),
          actions: [
            { id: uuid(), label: "Testar novo criativo", type: "constructive", requires_confirmation: false },
          ],
          cluster_key: `insight_low_ctr_${ad.ad_id}`,
        });
      } else if (ad.frequency > 3.0) {
        items.push({
          ad_id: ad.ad_id,
          account_id: accountId,
          type: "insight",
          score: 25,
          headline: `Frequência alta — ${ad.frequency.toFixed(1)}x por pessoa`,
          reason: `Quando o público vê o mesmo anúncio muitas vezes, a eficiência cai. Considere expandir o público ou renovar o criativo.`,
          impact_type: "savings",
          impact_daily_cents: Math.round(ad.daily_spend_cents * 0.2),
          impact_7d_cents: Math.round(ad.daily_spend_cents * 0.2 * 7),
          confidence: "low",
          impact_basis: "Estimativa conservadora de perda por fadiga",
          metrics_snapshot: buildSimpleSnapshot(ad),
          actions: [
            { id: uuid(), label: "Expandir público", type: "constructive", requires_confirmation: false },
          ],
          cluster_key: `insight_freq_${ad.ad_id}`,
        });
      }
    }
  }

  return items;
}

function buildSimpleSnapshot(ad: AggregatedMetrics): Record<string, unknown> {
  return {
    impressions: ad.impressions,
    clicks: ad.clicks,
    spend_cents: ad.spend_cents,
    conversions: ad.conversions,
    ctr: ad.ctr,
    frequency: ad.frequency,
    days_active: ad.days_active,
  };
}

// ================================================================
// ANTI-SPAM — CLUSTER SIMILAR ISSUES
// ================================================================

function clusterAndDeduplicate(items: FeedItem[]): FeedItem[] {
  const clusters: Record<string, FeedItem[]> = {};

  for (const item of items) {
    if (!clusters[item.cluster_key]) clusters[item.cluster_key] = [];
    clusters[item.cluster_key].push(item);
  }

  const result: FeedItem[] = [];

  for (const [key, cluster] of Object.entries(clusters)) {
    if (cluster.length === 1) {
      result.push(cluster[0]);
      continue;
    }

    // Multiple items in same cluster — keep highest score and summarize
    cluster.sort((a, b) => b.score - a.score);
    const primary = { ...cluster[0] };

    if (cluster.length > 2) {
      // Merge into a single cluster item
      const totalImpact = cluster.reduce((s, c) => s + c.impact_daily_cents, 0);
      primary.headline = `${primary.headline} (+${cluster.length - 1} similares)`;
      primary.impact_daily_cents = totalImpact;
      primary.impact_7d_cents = totalImpact * 7;
      primary.reason += ` Mais ${cluster.length - 1} anúncios com o mesmo problema.`;
    } else {
      // Just 2 — keep both
      result.push(cluster[0]);
      result.push(cluster[1]);
      continue;
    }

    result.push(primary);
  }

  return result;
}

// ================================================================
// PRIORITIZATION — RANKED BY FINANCIAL IMPACT
// ================================================================

function prioritize(items: FeedItem[]): FeedItem[] {
  return items.sort((a, b) => {
    // 1. Type priority: kill > fix > scale > pattern > insight
    const typeOrder: Record<DecisionType, number> = { kill: 0, fix: 1, scale: 2, pattern: 3, insight: 4 };
    const typeDiff = (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
    if (typeDiff !== 0) return typeDiff;

    // 2. Within same type, sort by financial impact descending
    const impactDiff = b.impact_daily_cents - a.impact_daily_cents;
    if (impactDiff !== 0) return impactDiff;

    // 3. Then by score descending
    return b.score - a.score;
  });
}

// ================================================================
// DEMO MODE — REALISTIC SAMPLE FEED
// ================================================================

function generateDemoFeed(accountId: string): FeedItem[] {
  return [
    {
      ad_id: "demo_ad_001",
      account_id: accountId,
      type: "kill",
      score: 94,
      headline: "Você está perdendo R$180/dia aqui",
      reason: "CTR caiu 34% nos últimos 3 dias. CPA subiu 28% para R$47,50. Esse anúncio já ultrapassou o ponto de retorno.",
      impact_type: "waste",
      impact_daily_cents: 18000,
      impact_7d_cents: 126000,
      confidence: "high",
      impact_basis: "Baseado nos últimos 5 dias de performance",
      metrics_snapshot: {
        impressions: 24500, clicks: 196, spend_cents: 54000,
        conversions: 2, ctr: 0.008, cpa_cents: 27000,
        roas: 0.4, frequency: 2.8,
        baseline_ctr: 0.021, baseline_cpa: 8500,
      },
      actions: [
        { id: "demo_1a", label: "Pausar anúncio", type: "destructive", requires_confirmation: true, meta_api_action: "pause_ad" },
        { id: "demo_1b", label: "Analisar gasto", type: "neutral", requires_confirmation: false },
      ],
      cluster_key: "demo_kill_1",
    },
    {
      ad_id: "demo_ad_002",
      account_id: accountId,
      type: "kill",
      score: 89,
      headline: "Anúncio sugando R$95/dia sem retorno",
      reason: "Gastou R$665 nos últimos 7 dias e 0 conversões. Sangria pura. Orçamento melhor alocado em anúncios que convertem.",
      impact_type: "waste",
      impact_daily_cents: 9500,
      impact_7d_cents: 66500,
      confidence: "high",
      impact_basis: "Baseado em zero conversões com gasto significativo",
      metrics_snapshot: {
        impressions: 18200, clicks: 145, spend_cents: 66500,
        conversions: 0, ctr: 0.008, cpa_cents: 999999,
        roas: 0, frequency: 3.2,
        baseline_ctr: 0.021, baseline_cpa: 8500,
      },
      actions: [
        { id: "demo_2a", label: "Pausar agora", type: "destructive", requires_confirmation: true, meta_api_action: "pause_ad" },
        { id: "demo_2b", label: "Ver detalhes", type: "neutral", requires_confirmation: false },
      ],
      cluster_key: "demo_kill_2",
    },
    {
      ad_id: "demo_ad_003",
      account_id: accountId,
      type: "fix",
      score: 78,
      headline: "Desgaste já visível — frequência 4.2x",
      reason: "Cada pessoa viu 4.2x em média. CPA subiu para R$32,00. Pausa alguns dias ou renova o criativo para recuperar eficiência.",
      impact_type: "savings",
      impact_daily_cents: 7200,
      impact_7d_cents: 50400,
      confidence: "medium",
      impact_basis: "Frequência 4.2x — estimativa de 30% de perda por fadiga",
      metrics_snapshot: {
        impressions: 31000, clicks: 620, spend_cents: 24000,
        conversions: 6, ctr: 0.020, cpa_cents: 4000,
        roas: 2.1, frequency: 4.2,
        baseline_ctr: 0.021, baseline_cpa: 8500,
      },
      actions: [
        { id: "demo_3a", label: "Pausar 3 dias", type: "neutral", requires_confirmation: true, meta_api_action: "pause_ad" },
        { id: "demo_3b", label: "Gerar novo hook", type: "constructive", requires_confirmation: false, meta_api_action: "generate_hook" },
      ],
      cluster_key: "demo_fix_1",
    },
    {
      ad_id: "demo_ad_004",
      account_id: accountId,
      type: "fix",
      score: 72,
      headline: "Ótimo engajamento, mas conversão fraca",
      reason: "Hook rate 68% é top. CTR 2.4% está bom. Mas CPA R$38,00 está caro. Problema na oferta ou landing page.",
      impact_type: "savings",
      impact_daily_cents: 5400,
      impact_7d_cents: 37800,
      confidence: "medium",
      impact_basis: "Baseado na diferença de CPA vs mediana da conta",
      metrics_snapshot: {
        impressions: 15000, clicks: 360, spend_cents: 19000,
        conversions: 5, ctr: 0.024, cpa_cents: 3800,
        roas: 1.5, frequency: 1.8,
        hook_rate: 0.68,
        baseline_ctr: 0.021, baseline_cpa: 8500,
      },
      actions: [
        { id: "demo_4a", label: "Entender impacto", type: "neutral", requires_confirmation: false },
        { id: "demo_4b", label: "Testar novo CTA", type: "constructive", requires_confirmation: false },
      ],
      cluster_key: "demo_fix_2",
    },
    {
      ad_id: "demo_ad_005",
      account_id: accountId,
      type: "scale",
      score: 65,
      headline: "ROAS 4.8x acima da base — joga mais grana",
      reason: "Esse anúncio tá voando. ROAS 4.8x. Mediana é 1.6x. CPA R$18,00 muito abaixo do teto. Aumenta budget em 50-100%.",
      impact_type: "revenue",
      impact_daily_cents: 32000,
      impact_7d_cents: 224000,
      confidence: "high",
      impact_basis: "Projeção com +50% de budget (12 conversões atuais)",
      metrics_snapshot: {
        impressions: 22000, clicks: 550, spend_cents: 21600,
        conversions: 12, ctr: 0.025, cpa_cents: 1800,
        roas: 4.8, frequency: 1.4,
        baseline_ctr: 0.021, baseline_cpa: 8500, baseline_roas: 1.6,
      },
      actions: [
        { id: "demo_5a", label: "Aumentar budget +50%", type: "constructive", requires_confirmation: true, meta_api_action: "increase_budget" },
        { id: "demo_5b", label: "Duplicar anúncio", type: "constructive", requires_confirmation: false, meta_api_action: "duplicate_ad" },
      ],
      cluster_key: "demo_scale_1",
    },
    {
      ad_id: null,
      account_id: accountId,
      type: "pattern",
      score: 48,
      headline: 'Padrão identificado: CTA "Saiba mais"',
      reason: "+33% CTR vs baseline da conta (8 anúncios analisados). Seus anúncios com esse CTA consistentemente superam os demais.",
      impact_type: "learning",
      impact_daily_cents: 4500,
      impact_7d_cents: 31500,
      confidence: "medium",
      impact_basis: "Baseado em 8 anúncios com R$1.200 de gasto total",
      metrics_snapshot: {
        avg_ctr: 0.028, avg_cpa: 6200,
        baseline_ctr: 0.021, baseline_cpa: 8500,
        ctr_delta_pct: 33, sample_size: 8, total_spend: 120000,
      },
      actions: [
        { id: "demo_6a", label: "Priorizar esse padrão", type: "constructive", requires_confirmation: false },
        { id: "demo_6b", label: "Ver anúncios", type: "neutral", requires_confirmation: false },
      ],
      cluster_key: "demo_pattern_1",
      pattern_type: "cta_learn_more",
      pattern_sample_size: 8,
      pattern_impact_pct: 33,
    },
    {
      ad_id: null,
      account_id: accountId,
      type: "pattern",
      score: 42,
      headline: "Padrão identificado: vídeo UGC",
      reason: "CPA 25% menor vs baseline (6 anúncios). Formato UGC está superando estúdio e imagem estática na sua conta.",
      impact_type: "learning",
      impact_daily_cents: 3200,
      impact_7d_cents: 22400,
      confidence: "medium",
      impact_basis: "Baseado em 6 anúncios com R$890 de gasto total",
      metrics_snapshot: {
        avg_ctr: 0.023, avg_cpa: 6375,
        baseline_ctr: 0.021, baseline_cpa: 8500,
        ctr_delta_pct: 9.5, cpa_delta_pct: -25, sample_size: 6, total_spend: 89000,
      },
      actions: [
        { id: "demo_7a", label: "Priorizar esse formato", type: "constructive", requires_confirmation: false },
      ],
      cluster_key: "demo_pattern_2",
      pattern_type: "format_ugc",
      pattern_sample_size: 6,
      pattern_impact_pct: -25,
    },
  ];
}

// ================================================================
// DATA FETCHING — Bridge v1 platform_connections + v2 tables
// ================================================================

async function fetchAdsWithMetrics(accountId: string): Promise<AggregatedMetrics[]> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  // Fetch ads with their creatives and metrics
  const { data: ads, error: adsErr } = await supabase
    .from("ads")
    .select(`
      id, name, status, effective_status, created_time,
      ad_sets!inner ( name, campaigns!inner ( name ) ),
      creatives ( cta_type, format, body, has_hook, hook_rate ),
      ad_metrics ( date, impressions, clicks, spend_cents, conversions, revenue, ctr, cpc, cpa_cents, roas, frequency, reach )
    `)
    .eq("account_id", accountId);

  if (adsErr || !ads) {
    console.error("Failed to fetch ads:", adsErr);
    return [];
  }

  return (ads as any[]).map((ad) => {
    const metrics = (ad.ad_metrics || []) as any[];
    const curr = metrics.filter((m: any) => m.date >= fmt(sevenDaysAgo));
    const prev = metrics.filter((m: any) => m.date >= fmt(fourteenDaysAgo) && m.date < fmt(sevenDaysAgo));

    const sumField = (rows: any[], field: string) => rows.reduce((s, r) => s + (r[field] || 0), 0);
    const avgField = (rows: any[], field: string) => rows.length > 0 ? sumField(rows, field) / rows.length : 0;

    const impressions = sumField(curr, "impressions");
    const clicks = sumField(curr, "clicks");
    const spend = sumField(curr, "spend_cents");
    const conversions = sumField(curr, "conversions");
    const revenue = sumField(curr, "revenue");
    const daysActive = curr.length || 1;

    const creative = ad.creatives as any;
    const adset = (ad.ad_sets as any);
    const campaign = adset?.campaigns as any;

    return {
      ad_id: ad.id,
      ad_name: ad.name || "",
      campaign_name: campaign?.name || "",
      adset_name: adset?.name || "",
      ad_status: ad.status || "UNKNOWN",
      effective_status: ad.effective_status || "UNKNOWN",
      cta_type: creative?.cta_type || null,
      creative_format: creative?.format || null,
      body_text: creative?.body || null,
      has_hook: creative?.has_hook || false,
      hook_rate: creative?.hook_rate || 0,
      impressions,
      clicks,
      spend_cents: spend,
      conversions,
      revenue_cents: revenue,
      ctr: impressions > 0 ? clicks / impressions : 0,
      cpa_cents: conversions > 0 ? Math.round(spend / conversions) : 999999,
      cpc_cents: clicks > 0 ? Math.round(spend / clicks) : 0,
      cpm_cents: impressions > 0 ? Math.round((spend / impressions) * 1000) : 0,
      roas: spend > 0 ? revenue / spend : 0,
      frequency: avgField(curr, "frequency"),
      days_active: daysActive,
      daily_spend_cents: Math.round(spend / daysActive),
      prev_ctr: (() => {
        const pi = sumField(prev, "impressions");
        const pc = sumField(prev, "clicks");
        return pi > 0 ? pc / pi : 0;
      })(),
      prev_cpa_cents: (() => {
        const ps = sumField(prev, "spend_cents");
        const pconv = sumField(prev, "conversions");
        return pconv > 0 ? Math.round(ps / pconv) : 0;
      })(),
      prev_cpm_cents: (() => {
        const pi = sumField(prev, "impressions");
        const ps = sumField(prev, "spend_cents");
        return pi > 0 ? Math.round((ps / pi) * 1000) : 0;
      })(),
      prev_frequency: avgField(prev, "frequency"),
    };
  });
}

async function fetchAccountBaseline(accountId: string): Promise<AccountBaseline | null> {
  const { data, error } = await supabase
    .from("account_baselines")
    .select("*")
    .eq("account_id", accountId)
    .order("period_days", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    baseline_p25_ctr: data.ctr_p25 || 0.005,
    baseline_median_ctr: data.ctr_median || 0.015,
    baseline_p75_ctr: data.ctr_p75 || 0.025,
    baseline_p75_cpa: data.cpa_p75 || 15000,
    baseline_median_cpa: data.cpa_median || 8500,
    baseline_median_roas: data.roas_median || 1.5,
    monthly_budget_cents: data.spend_daily_avg ? data.spend_daily_avg * 30 : 300000,
    cpa_target_cents: data.cpa_median || 8500,
    sample_size: data.sample_size || 0,
    maturity_level: data.maturity || "new",
  };
}

// ================================================================
// PERSISTENCE
// ================================================================

async function persistDecisions(accountId: string, items: FeedItem[]): Promise<void> {
  if (items.length === 0) return;

  // Map feed items to decisions table format
  const rows = items.map((item, idx) => ({
    id: uuid(),
    ad_id: item.ad_id,
    account_id: accountId,
    type: item.type,
    score: item.score,
    priority_rank: idx + 1,
    headline: item.headline,
    reason: item.reason,
    impact_type: item.impact_type,
    impact_daily: item.impact_daily_cents,
    impact_7d: item.impact_7d_cents,
    impact_confidence: item.confidence,
    impact_basis: item.impact_basis,
    metrics_snapshot: item.metrics_snapshot,
    actions: item.actions,
    status: "pending",
    created_at: new Date().toISOString(),
  }));

  // Clear old pending decisions for this account
  await supabase
    .from("decisions")
    .delete()
    .eq("account_id", accountId)
    .eq("status", "pending");

  // Insert new decisions
  const { error } = await supabase.from("decisions").insert(rows);
  if (error) console.error("Failed to persist decisions:", error);
}

async function updateMoneyTracker(accountId: string, items: FeedItem[]): Promise<void> {
  const leaking = items
    .filter(i => i.type === "kill")
    .reduce((s, i) => s + i.impact_daily_cents, 0);

  const capturable = items
    .filter(i => i.type === "fix" || i.type === "scale")
    .reduce((s, i) => s + i.impact_daily_cents, 0);

  await supabase
    .from("money_tracker")
    .upsert({
      account_id: accountId,
      leaking_now: leaking,
      capturable_now: capturable,
      updated_at: new Date().toISOString(),
    }, { onConflict: "account_id" });
}

async function persistPatterns(accountId: string, items: FeedItem[]): Promise<void> {
  const patterns = items.filter(i => i.type === "pattern" && i.pattern_type);
  if (patterns.length === 0) return;

  const rows = patterns.map(p => ({
    id: uuid(),
    account_id: accountId,
    pattern_type: p.pattern_type!.split("_")[0] || "creative",
    title: p.headline,
    description: p.reason,
    sample_size: p.pattern_sample_size || 0,
    strength: clamp((p.pattern_sample_size || 0) / 20, 0, 1),
    impact_percentage: p.pattern_impact_pct || null,
    status: (p.pattern_sample_size || 0) >= 5 ? "active" : "weak",
    discovered_at: new Date().toISOString(),
  }));

  // Upsert patterns — we just replace all for now
  await supabase
    .from("account_patterns")
    .delete()
    .eq("account_id", accountId);

  const { error } = await supabase.from("account_patterns").insert(rows);
  if (error) console.error("Failed to persist patterns:", error);
}

// ================================================================
// MAIN HANDLER
// ================================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }

  try {
    const body = await req.json();
    const { account_id, demo_mode = false } = body;

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: "Missing account_id" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── DEMO MODE ──────────────────────────────────────────────────
    if (demo_mode) {
      const demoFeed = generateDemoFeed(account_id);
      return new Response(
        JSON.stringify({
          ok: true,
          mode: "demo",
          total: demoFeed.length,
          kill_count: demoFeed.filter(d => d.type === "kill").length,
          fix_count: demoFeed.filter(d => d.type === "fix").length,
          scale_count: demoFeed.filter(d => d.type === "scale").length,
          pattern_count: demoFeed.filter(d => d.type === "pattern").length,
          insight_count: demoFeed.filter(d => d.type === "insight").length,
          feed: demoFeed,
          money: {
            leaking_now: demoFeed.filter(d => d.type === "kill").reduce((s, d) => s + d.impact_daily_cents, 0),
            capturable_now: demoFeed.filter(d => d.type === "fix" || d.type === "scale").reduce((s, d) => s + d.impact_daily_cents, 0),
            total_saved: 0,
          },
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── REAL MODE ──────────────────────────────────────────────────

    // 1. Fetch data
    const [ads, baseline] = await Promise.all([
      fetchAdsWithMetrics(account_id),
      fetchAccountBaseline(account_id),
    ]);

    let allItems: FeedItem[] = [];

    if (ads.length >= 3 && baseline) {
      // Full analysis mode
      const problems = detectProblems(ads, baseline);
      const patterns = detectPatterns(ads, baseline);
      allItems = [...problems, ...patterns];
    } else if (ads.length > 0 && baseline) {
      // Some data — run problems only, add low data insights
      const problems = detectProblems(ads, baseline);
      const lowData = generateLowDataInsights(ads, baseline, account_id);
      allItems = [...problems, ...lowData];
    } else {
      // Low data mode — still provide value
      allItems = generateLowDataInsights(ads, baseline, account_id);
    }

    // 2. Anti-spam clustering
    allItems = clusterAndDeduplicate(allItems);

    // 3. Prioritize by financial impact
    allItems = prioritize(allItems);

    // 4. Set account_id on all items
    for (const item of allItems) {
      item.account_id = account_id;
    }

    // 5. FEED NEVER EMPTY guarantee
    if (allItems.length === 0) {
      allItems.push({
        ad_id: null,
        account_id: account_id,
        type: "insight",
        score: 10,
        headline: "Conta saudável — nenhum problema detectado",
        reason: "Suas campanhas estão rodando dentro dos parâmetros esperados. Continue monitorando.",
        impact_type: "learning",
        impact_daily_cents: 0,
        impact_7d_cents: 0,
        confidence: "medium",
        impact_basis: "Baseado na análise completa da conta",
        metrics_snapshot: {},
        actions: [
          { id: uuid(), label: "Ver métricas", type: "neutral", requires_confirmation: false },
        ],
        cluster_key: "insight_healthy",
      });
    }

    // 6. Persist
    await Promise.all([
      persistDecisions(account_id, allItems),
      updateMoneyTracker(account_id, allItems),
      persistPatterns(account_id, allItems),
    ]);

    // 7. Response
    return new Response(
      JSON.stringify({
        ok: true,
        mode: "live",
        total: allItems.length,
        kill_count: allItems.filter(d => d.type === "kill").length,
        fix_count: allItems.filter(d => d.type === "fix").length,
        scale_count: allItems.filter(d => d.type === "scale").length,
        pattern_count: allItems.filter(d => d.type === "pattern").length,
        insight_count: allItems.filter(d => d.type === "insight").length,
        feed: allItems,
        money: {
          leaking_now: allItems.filter(d => d.type === "kill").reduce((s, d) => s + d.impact_daily_cents, 0),
          capturable_now: allItems.filter(d => d.type === "fix" || d.type === "scale").reduce((s, d) => s + d.impact_daily_cents, 0),
        },
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Decision engine error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
