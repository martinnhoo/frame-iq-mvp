/**
 * detect-alerts.ts — PURE RULE-BASED ALERT DETECTOR (zero LLM cost).
 *
 * Philosophy (two-layer design):
 *   Layer 1 (this file): cheap polling every 15–30 min, pure rules, no AI.
 *     Reads Meta insights + learned_patterns, emits structured alerts.
 *     Cost per run: ~0 (just Postgres reads + Meta Insights calls).
 *
 *   Layer 2 (check-critical-alerts): when Layer 1 emits ≥1 alert AND daily
 *     email cap not yet hit, Claude Haiku composes ONE sharp summary line.
 *     LLM cost only exists when something is actually wrong.
 *
 * Extracted from check-critical-alerts/index.ts so that:
 *   - autopilot-executor can use the same rules to double-check before acting
 *   - unit tests can exercise the rules without fetching Meta
 *   - thresholds live in ONE place
 *
 * Every threshold is kept IDENTICAL to the original so deployment is a
 * behavior-preserving refactor.
 */

// ── Thresholds ───────────────────────────────────────────────────────────────
export const T = {
  FREQ_CRITICAL: 4.0,
  CTR_DROP_PCT: 45,
  CTR_DROP_MIN: 0.006,
  SPEND_NO_CONV: 80,
  SCALE_CTR: 0.030,
  SCALE_SPEND_MAX: 50,
  SCALE_SPEND_MIN: 8,
  PATTERN_CONF: 0.55,
} as const;

// ── Types ────────────────────────────────────────────────────────────────────
export type AlertType =
  | "FADIGA_CRITICA"
  | "ROAS_CRITICO"
  | "ROAS_COLAPSOU"
  | "CTR_COLAPSOU"
  | "RETENCAO_VIDEO_BAIXA"
  | "SPEND_SEM_RETORNO"
  | "PADRAO_DE_RISCO"
  | "OPORTUNIDADE_ESCALA";

export interface DetectedAlert {
  type: AlertType;
  ad: string;
  ad_id?: string;
  campaign: string;
  detail: string;
  urgency: "high" | "medium";
  /** e.g. "2026-04-20_1234567_FADIGA_CRITICA" */
  dedup_key: string;
  /** Raw metrics at time of detection, useful for log and revalidation */
  metrics: {
    spend: number;
    ctr: number;
    frequency: number;
    conversions: number;
    roas: number | null;
    thruplay: number | null;
  };
}

export interface LearnedPattern {
  pattern_key?: string;
  is_winner?: boolean;
  avg_ctr?: number;
  confidence?: number;
  insight_text?: string;
  // deno-lint-ignore no-explicit-any
  variables?: Record<string, any>;
  sample_size?: number;
}

export interface DetectInput {
  /** Current 24h Meta insights rows at ad level (from /insights?level=ad) */
  currentInsights: Array<Record<string, unknown>>;
  /** Previous 24h rows, same shape, keyed by ad_id for drop detection */
  previousInsights: Array<Record<string, unknown>>;
  /** Campaign.name → objective map, used to select primary KPI per ad */
  campaignObjectiveMap: Record<string, string>;
  /** Already-fired alerts by dedup_key (from profiles.usage_alert_flags) */
  alreadyFiredFlags: Record<string, boolean>;
  /** ISO week key (Mon-Sun), used as part of dedup_key */
  weekKey: string;
  /** User's learned patterns (at least PATTERN_CONF confidence) */
  learnedPatterns?: LearnedPattern[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const parseN = (v: unknown) => parseFloat((v as string) || "0");

function getConv(ad: Record<string, unknown>): number {
  const actions = (ad.actions as Array<{ action_type?: string; value?: string }>) || [];
  const c = actions.find((x) =>
    ["purchase", "lead", "complete_registration", "app_install"].includes(x.action_type || "")
  );
  return c?.value ? parseFloat(c.value) : 0;
}

function getRoas(ad: Record<string, unknown>): number | null {
  const arr = (ad.website_purchase_roas as Array<{ value?: string }>) || [];
  if (arr[0]?.value) return parseFloat(arr[0].value);
  const vals = (ad.action_values as Array<{ action_type?: string; value?: string }>) || [];
  const pv = vals.find((a) => a.action_type === "purchase");
  const spend = parseFloat((ad.spend as string) || "0");
  return pv?.value && spend > 0 ? parseFloat(pv.value) / spend : null;
}

function getThruPlayRate(ad: Record<string, unknown>): number | null {
  const playsArr = (ad.video_play_actions as Array<{ value?: string }>) || [];
  const thruArr = (ad.video_thruplay_watched_actions as Array<{ value?: string }>) || [];
  const plays = parseFloat(playsArr[0]?.value || "0");
  const thru = parseFloat(thruArr[0]?.value || "0");
  return plays > 0 ? thru / plays : null;
}

function getPrimaryKpi(objective: string): "roas" | "cpl" | "cpi" | "thruplay" | "cpm" | "ctr" {
  const o = (objective || "").toUpperCase();
  if (o.includes("PURCHASE") || o.includes("SALES")) return "roas";
  if (o.includes("LEAD")) return "cpl";
  if (o.includes("APP")) return "cpi";
  if (o.includes("VIDEO")) return "thruplay";
  if (o.includes("REACH") || o.includes("BRAND")) return "cpm";
  return "ctr";
}

// ── Main entry ───────────────────────────────────────────────────────────────
export function detectAlerts(input: DetectInput): DetectedAlert[] {
  const {
    currentInsights,
    previousInsights,
    campaignObjectiveMap,
    alreadyFiredFlags,
    weekKey,
    learnedPatterns = [],
  } = input;

  if (!currentInsights.length) return [];

  const prevMap: Record<string, Record<string, unknown>> = {};
  previousInsights.forEach((a) => {
    const id = (a.ad_id as string) || (a.ad_name as string);
    prevMap[id] = a;
  });

  const failurePatterns = learnedPatterns.filter(
    (p) => p.is_winner === false && (p.sample_size ?? 0) >= 3
  );
  const winnerPatterns = learnedPatterns.filter(
    (p) => p.is_winner === true && (p.sample_size ?? 0) >= 3
  );

  const alerts: DetectedAlert[] = [];

  for (const ad of currentInsights) {
    const adId = (ad.ad_id as string) || (ad.ad_name as string);
    const adIdStr = String(adId || "");
    const ctr = parseN(ad.ctr);
    const spend = parseN(ad.spend);
    const freq = parseN(ad.frequency);
    const conv = getConv(ad);
    const roas = getRoas(ad);
    const thru = getThruPlayRate(ad);
    const prevAd = prevMap[adIdStr];
    const prevCtr = prevAd ? parseN(prevAd.ctr) : null;
    const prevRoas = prevAd ? getRoas(prevAd) : null;
    const adName = ((ad.ad_name as string) || "Sem nome").slice(0, 55);
    const camp = ((ad.campaign_name as string) || "").slice(0, 45);
    const objective = campaignObjectiveMap[(ad.campaign_name as string) || ""] || "";
    const primaryKpi = getPrimaryKpi(objective);

    const metrics = { spend, ctr, frequency: freq, conversions: conv, roas, thruplay: thru };

    const push = (
      type: AlertType,
      detail: string,
      urgency: "high" | "medium"
    ) => {
      const dedup = `${weekKey}_${adIdStr}_${type}`;
      if (alreadyFiredFlags[dedup]) return;
      alerts.push({
        type,
        ad: adName,
        ad_id: adIdStr,
        campaign: camp,
        detail,
        urgency,
        dedup_key: dedup,
        metrics,
      });
    };

    // ─── CRITICAL SIGNALS — KPI-AWARE ────────────────────────────────────────

    // 🔴 Frequência crítica
    if (freq >= T.FREQ_CRITICAL) {
      push(
        "FADIGA_CRITICA",
        `Frequência ${freq.toFixed(1)}x — audiência esgotada. Pause hoje e troque o criativo.`,
        "high"
      );
    }

    // 🔴 ROAS colapsou
    if (primaryKpi === "roas" && roas !== null && roas < 0.8 && spend > 40) {
      push(
        "ROAS_CRITICO",
        `ROAS ${roas.toFixed(2)}x — cada R$1 gasto retorna menos de R$0,80. ` +
          `Campanha não está se pagando. Revise criativo e oferta.`,
        "high"
      );
    }

    // 🔴 ROAS caiu > 40% vs ontem
    if (
      primaryKpi === "roas" &&
      roas !== null &&
      prevRoas !== null &&
      prevRoas > 1.0 &&
      roas < prevRoas * 0.6
    ) {
      const drop = Math.round(((prevRoas - roas) / prevRoas) * 100);
      push(
        "ROAS_COLAPSOU",
        `ROAS caiu ${drop}% em 72h: ${prevRoas.toFixed(2)}x → ${roas.toFixed(2)}x. ` +
          `Criativo perdendo força ou audiência saturando.`,
        "high"
      );
    }

    // 🔴 CTR colapsou
    if (
      (primaryKpi === "ctr" || primaryKpi === "cpl") &&
      prevCtr !== null &&
      prevCtr >= T.CTR_DROP_MIN &&
      ctr < prevCtr * ((100 - T.CTR_DROP_PCT) / 100)
    ) {
      const drop = Math.round(((prevCtr - ctr) / prevCtr) * 100);
      push(
        "CTR_COLAPSOU",
        `CTR caiu ${drop}% em 72h: ${(prevCtr * 100).toFixed(2)}% → ${(ctr * 100).toFixed(2)}%. ` +
          `Cheque frequência e copy.`,
        "high"
      );
    }

    // 🔴 ThruPlay rate baixo
    if (primaryKpi === "thruplay" && thru !== null && thru < 0.10 && spend > 20) {
      push(
        "RETENCAO_VIDEO_BAIXA",
        `Só ${(thru * 100).toFixed(1)}% assistiram o vídeo até o fim. ` +
          `Hook ou ritmo do vídeo fraco. Teste versão mais curta ou novo hook.`,
        "high"
      );
    }

    // 🔴 Spend alto sem nenhuma conversão
    if (["roas", "cpl", "cpi"].includes(primaryKpi) && spend >= T.SPEND_NO_CONV && conv === 0) {
      push(
        "SPEND_SEM_RETORNO",
        `R$${spend.toFixed(0)} gastos hoje sem uma única conversão. ` +
          `Pause e revise oferta, criativo ou público.`,
        "high"
      );
    }

    // ─── PATTERN-BASED ALERTS ────────────────────────────────────────────────
    if (failurePatterns.length > 0 && spend > 15) {
      for (const pattern of failurePatterns.slice(0, 5)) {
        const vars = pattern.variables || {};
        const histFreqs = ((vars.history as Array<{ frequency?: number }>) || [])
          .map((h) => h.frequency || 0)
          .filter((f) => f > 0);
        if (histFreqs.length < 2) continue;
        const patternAvgFreq = histFreqs.reduce((s, f) => s + f, 0) / histFreqs.length;

        if (freq > patternAvgFreq * 0.8 && freq >= 2.5 && (pattern.confidence ?? 0) > 0.6) {
          const dedup = `${weekKey}_${adIdStr}_PADRAO_DE_RISCO`;
          if (!alreadyFiredFlags[dedup]) {
            alerts.push({
              type: "PADRAO_DE_RISCO",
              ad: adName,
              ad_id: adIdStr,
              campaign: camp,
              detail:
                `Frequência ${freq.toFixed(1)}x está se aproximando do nível onde criativos similares falharam na sua conta ` +
                `(média ${patternAvgFreq.toFixed(1)}x). ` +
                `Histórico mostra que vale criar variação agora antes do CTR cair.`,
              urgency: "medium",
              dedup_key: dedup,
              metrics,
            });
          }
          break;
        }
      }
    }

    // ─── OPPORTUNITY SIGNAL ──────────────────────────────────────────────────
    const isScaleOpp = (() => {
      if (spend < T.SCALE_SPEND_MIN || spend > T.SCALE_SPEND_MAX) return false;
      if (primaryKpi === "roas") return roas !== null && roas >= 2.0;
      if (primaryKpi === "cpl") return conv > 0 && spend / conv < 30;
      if (primaryKpi === "thruplay") return thru !== null && thru >= 0.20;
      return ctr >= T.SCALE_CTR;
    })();

    if (isScaleOpp) {
      const kpiStr =
        primaryKpi === "roas"
          ? `ROAS ${roas?.toFixed(2)}x`
          : primaryKpi === "cpl"
          ? `CPL R$${(spend / conv).toFixed(0)}`
          : primaryKpi === "thruplay"
          ? `ThruPlay ${((thru || 0) * 100).toFixed(1)}%`
          : `CTR ${(ctr * 100).toFixed(2)}%`;

      const confirmedByPattern = winnerPatterns.some((p) => {
        const vars = p.variables || {};
        const adsetVar = vars.adset as string | undefined;
        const adsetName = ad.adset_name as string | undefined;
        return (
          adsetVar &&
          adsetName &&
          adsetVar.toLowerCase().includes(adsetName.slice(0, 10).toLowerCase())
        );
      });

      push(
        "OPORTUNIDADE_ESCALA",
        `${kpiStr} com apenas R$${spend.toFixed(0)} de budget hoje. ` +
          (confirmedByPattern ? `Padrão similar já performou bem na sua conta. ` : ``) +
          `Aumente o budget em 20-30% e monitore.`,
        "medium"
      );
    }
  }

  return alerts;
}

/**
 * Sort alerts: high urgency first, then medium. Returns the top N.
 */
export function topAlerts(alerts: DetectedAlert[], n = 3): DetectedAlert[] {
  return [...alerts]
    .sort((a, b) => (a.urgency === "high" ? -1 : 1) - (b.urgency === "high" ? -1 : 1))
    .slice(0, n);
}
