/**
 * Decision Output — Pipeline Orchestrator
 *
 * Full pipeline: INPUT → DECISION ENGINE → FINANCIAL FILTER → SAFETY LAYER → OUTPUT
 *
 * This module orchestrates the entire pipeline:
 * 1. Takes a raw decision from the detection engine
 * 2. Runs it through the financial filter
 * 3. Runs it through the safety layer
 * 4. Produces an EnrichedDecision with confidence, risk, explanation
 *
 * The enriched output is what the user sees. Every decision must explain WHY.
 */

import type {
  RawDecision,
  FinancialConfig,
  SafetyConfig,
  EnrichedDecision,
  RiskLevel,
  ActionLogEntry,
  DecisionTag,
} from './types.ts';
import { evaluateFinancial } from './financial-filter.ts';
import { evaluateSafety } from './safety-layer.ts';
import {
  calculateDataConfidence,
  shouldEvaluate,
  CONFIDENCE_GATES,
  type DataConfidenceInput,
  type DataConfidenceResult,
} from './data-confidence.ts';

// Supabase client type
interface SupabaseClient {
  from: (table: string) => any;
}

// ── Legacy confidence weights (kept for fallback) ──
const CONFIDENCE_WEIGHTS = {
  spend: 0.25,
  days: 0.20,
  sample_size: 0.15,
  pattern_match: 0.15,
  data_freshness: 0.15,
  consistency: 0.10,
};

/**
 * Run a raw decision through the full pipeline.
 *
 * Returns EnrichedDecision with all layers applied.
 * Does NOT execute anything — pure evaluation.
 */
export async function enrichDecision(
  decision: RawDecision,
  financialConfig: FinancialConfig,
  safetyConfig: SafetyConfig,
  accountId: string,
  supabase: SupabaseClient,
  options?: {
    patternConfidence?: number;  // 0-1, from learned_patterns
    dataFreshnessDays?: number;  // how old is the newest data point
    trendConsistency?: number;   // 0-1, how consistent is the metric trend
    dailyValues?: number[];      // daily metric values for variance/consistency
    conversionDays?: number;     // days with at least 1 conversion
    hoursSinceLastData?: number; // freshness of newest data
  },
): Promise<EnrichedDecision> {

  // ── Step 0: DATA CONFIDENCE GATE ──
  // Before anything else — can we trust this data?
  const dataConfidence = calculateDataConfidence({
    conversions: decision.conversions,
    conversion_days: options?.conversionDays ?? Math.min(decision.conversions, decision.kpi_data.period_days),
    daily_values: options?.dailyValues,
    metric_name: decision.kpi_data.metric,
    hours_since_last_data: options?.hoursSinceLastData ?? (options?.dataFreshnessDays ?? 1) * 24,
    spend: decision.spend,
    period_days: decision.kpi_data.period_days,
    pattern_confidence: options?.patternConfidence,
  });

  // If data confidence is too low for this action type, block immediately
  if (!shouldEvaluate(dataConfidence, decision.action_type)) {
    const rejectedFinancial = evaluateFinancial(decision, financialConfig);
    return {
      raw: decision,
      financial: rejectedFinancial,
      safety: {
        status: 'rejected',
        daily_actions_used: 0,
        daily_actions_limit: safetyConfig.max_actions_per_day,
        budget_change_pct: null,
        budget_limit_pct: safetyConfig.max_budget_increase_pct,
        duplicate_action_blocked: false,
        gradual_step: null,
        rollback_plan: null,
        explanation: `Bloqueado por baixa confiança nos dados (${(dataConfidence.score * 100).toFixed(0)}%).`,
      },
      approved: false,
      confidence: dataConfidence.score,
      risk_level: 'high',
      expected_daily_impact: 0,
      explanation: {
        data_point: `${decision.kpi_data.metric.toUpperCase()} ${decision.kpi_data.current_value} nos últimos ${decision.kpi_data.period_days} dias.`,
        threshold: `Confiança mínima para ${decision.action_type}: ${(CONFIDENCE_GATES.CAUTION_ONLY * 100).toFixed(0)}%.`,
        financial_check: rejectedFinancial.explanation,
        safety_check: dataConfidence.explanation,
        verdict: `Dados insuficientes para agir. ${dataConfidence.explanation}`,
      },
    };
  }

  // ── Step 1: Financial Filter ──
  const financial = evaluateFinancial(decision, financialConfig);

  // ── Step 2: Safety Layer (only if financially approved) ──
  let safety;
  if (financial.approved) {
    safety = await evaluateSafety(decision, safetyConfig, accountId, supabase);
  } else {
    safety = {
      status: 'rejected' as const,
      daily_actions_used: 0,
      daily_actions_limit: safetyConfig.max_actions_per_day,
      budget_change_pct: null,
      budget_limit_pct: safetyConfig.max_budget_increase_pct,
      duplicate_action_blocked: false,
      gradual_step: null,
      rollback_plan: null,
      explanation: 'Bloqueado pelo filtro financeiro — safety check não necessário.',
    };
  }

  // ── Step 3: Calculate confidence (use data confidence as primary) ──
  const confidence = dataConfidence.score;

  // ── Step 4: Determine risk level ──
  const riskLevel = determineRiskLevel(decision, financial, safety, confidence);

  // ── Step 5: Estimate daily impact ──
  const expectedDailyImpact = estimateDailyImpact(decision, financial);

  // ── Step 6: Assemble explanation chain ──
  const explanation = assembleExplanation(decision, financial, safety);

  // ── Step 7: Final approval ──
  const approved = financial.approved && safety.status === 'approved';

  return {
    raw: decision,
    financial,
    safety,
    approved,
    confidence,
    risk_level: riskLevel,
    expected_daily_impact: expectedDailyImpact,
    explanation,
  };
}

/**
 * Convert an EnrichedDecision to an ActionLogEntry for persistence.
 */
export function toActionLogEntry(
  enriched: EnrichedDecision,
  userId: string,
  accountId: string,
  triggeredBy: string,
  options?: { personaId?: string; isShadow?: boolean },
): ActionLogEntry {
  return {
    user_id: userId,
    account_id: accountId,
    persona_id: options?.personaId,
    action_type: enriched.raw.action_type,
    target_id: enriched.raw.target_id,
    target_type: enriched.raw.target_type,
    target_name: enriched.raw.target_name,
    previous_value: {
      daily_budget: enriched.raw.current_daily_budget,
      roas: enriched.raw.roas,
      ctr: enriched.raw.ctr,
      frequency: enriched.raw.frequency,
      spend: enriched.raw.spend,
    },
    new_value: enriched.approved
      ? {
          action: enriched.raw.action_type,
          scale_pct: enriched.financial.recommended_scale_pct,
          new_daily_budget: enriched.raw.current_daily_budget && enriched.financial.recommended_scale_pct
            ? Math.round(enriched.raw.current_daily_budget * (1 + enriched.financial.recommended_scale_pct / 100))
            : null,
        }
      : undefined,
    confidence: enriched.confidence,
    risk_level: enriched.risk_level,
    financial_verdict: enriched.financial.verdict,
    explanation: enriched.explanation,
    source: 'system',
    triggered_by: triggeredBy,
    decision_tag: classifyDecisionTag(enriched),
  };
}

// ════════════════════════════════════════════════════════════════════
// CONFIDENCE SCORING
// ════════════════════════════════════════════════════════════════════

function calculateConfidence(
  decision: RawDecision,
  options?: {
    patternConfidence?: number;
    dataFreshnessDays?: number;
    trendConsistency?: number;
  },
): number {
  const w = CONFIDENCE_WEIGHTS;

  // Spend score: R$0→0, R$50→0.5, R$200+→1.0
  const spendScore = Math.min(1, decision.spend / 200);

  // Days score: 1d→0.2, 3d→0.5, 7d→0.85, 14d+→1.0
  const days = decision.kpi_data.period_days;
  const daysScore = Math.min(1, days / 14);

  // Sample size (conversions): 0→0, 5→0.5, 20+→1.0
  const sampleScore = Math.min(1, decision.conversions / 20);

  // Pattern match: from learned_patterns confidence (0-1), default 0.3
  const patternScore = options?.patternConfidence ?? 0.3;

  // Data freshness: 0 days old → 1.0, 3 days → 0.5, 7+ days → 0.1
  const freshnessDays = options?.dataFreshnessDays ?? 1;
  const freshnessScore = Math.max(0.1, 1 - (freshnessDays / 7) * 0.9);

  // Trend consistency: directly from caller, default 0.5
  const consistencyScore = options?.trendConsistency ?? 0.5;

  const raw =
    spendScore * w.spend +
    daysScore * w.days +
    sampleScore * w.sample_size +
    patternScore * w.pattern_match +
    freshnessScore * w.data_freshness +
    consistencyScore * w.consistency;

  // Clamp to [0.05, 0.95] — never 0% or 100% confident
  return Math.round(Math.max(0.05, Math.min(0.95, raw)) * 100) / 100;
}

// ════════════════════════════════════════════════════════════════════
// RISK LEVEL
// ════════════════════════════════════════════════════════════════════

function determineRiskLevel(
  decision: RawDecision,
  financial: { verdict: string; margin_of_safety: number | null },
  safety: { status: string; gradual_step: number | null },
  confidence: number,
): RiskLevel {
  // High risk: scale with low confidence, or losing money with enable
  if (decision.action_type === 'scale_budget' && confidence < 0.4) return 'high';
  if (decision.action_type === 'enable' && financial.verdict === 'losing') return 'high';
  if (safety.status === 'queued') return 'high'; // Queued = system is unsure

  // Moderate: scale with moderate confidence, or first gradual step
  if (decision.action_type === 'scale_budget' && confidence < 0.65) return 'moderate';
  if (safety.gradual_step && safety.gradual_step > 1) return 'moderate';
  if (decision.action_type === 'pause' && financial.verdict === 'profitable') return 'moderate';

  return 'safe';
}

// ════════════════════════════════════════════════════════════════════
// DAILY IMPACT ESTIMATION
// ════════════════════════════════════════════════════════════════════

function estimateDailyImpact(
  decision: RawDecision,
  financial: { verdict: string; break_even_roas: number | null; actual_roas: number | null },
): number {
  const dailySpend = decision.kpi_data.period_days > 0
    ? decision.spend / decision.kpi_data.period_days
    : 0;

  switch (decision.action_type) {
    case 'pause': {
      if (financial.verdict === 'losing' && financial.break_even_roas && financial.actual_roas) {
        // Savings = daily spend * (1 - actual/breakeven)
        const wasteRatio = Math.max(0, 1 - (financial.actual_roas / financial.break_even_roas));
        return Math.round(dailySpend * wasteRatio * 100) / 100;
      }
      return dailySpend; // Worst case: all spend is saved
    }
    case 'scale_budget': {
      if (financial.actual_roas && financial.break_even_roas) {
        // Gain = extra spend * (ROAS - breakeven) / breakeven
        const profitRatio = (financial.actual_roas - financial.break_even_roas) / financial.break_even_roas;
        const scalePct = financial.break_even_roas ? 15 : 0; // Conservative estimate
        const extraSpend = dailySpend * (scalePct / 100);
        return Math.round(extraSpend * profitRatio * 100) / 100;
      }
      return 0;
    }
    default:
      return 0;
  }
}

// ════════════════════════════════════════════════════════════════════
// EXPLANATION CHAIN
// ════════════════════════════════════════════════════════════════════

function assembleExplanation(
  decision: RawDecision,
  financial: {
    verdict: string;
    break_even_roas: number | null;
    actual_roas: number | null;
    explanation: string;
    margin_of_safety: number | null;
  },
  safety: { explanation: string; rollback_plan: string | null; status: string },
): EnrichedDecision['explanation'] {

  const kpi = decision.kpi_data;

  // Data point: what was observed
  const dataPoint = `${kpi.metric.toUpperCase()} ${kpi.current_value.toFixed(kpi.metric === 'frequency' ? 1 : 2)}${
    kpi.previous_value != null ? ` (era ${kpi.previous_value.toFixed(2)} → queda de ${Math.abs(((kpi.current_value - kpi.previous_value) / kpi.previous_value) * 100).toFixed(0)}%)` : ''
  } nos últimos ${kpi.period_days} dias. Gasto: R$${decision.spend.toFixed(0)}.`;

  // Threshold: what rule was triggered
  const threshold = financial.break_even_roas
    ? `Break-even ROAS = ${financial.break_even_roas.toFixed(1)} (margem configurada). Threshold de detecção: ${kpi.threshold}.`
    : `Threshold de detecção: ${kpi.metric} ${decision.action_type === 'pause' ? '<' : '>'} ${kpi.threshold}.`;

  // Financial check
  const financialCheck = financial.explanation;

  // Safety check
  const safetyCheck = safety.explanation;

  // Final verdict
  let verdict: string;
  if (financial.verdict === 'losing' && decision.action_type === 'pause') {
    const dailyLoss = estimateDailyImpact(decision, financial as any);
    verdict = `Pausar justificado — economia estimada de ~R$${dailyLoss.toFixed(0)}/dia.`;
  } else if (decision.action_type === 'scale_budget' && safety.status === 'approved') {
    verdict = `Escalar aprovado com rollback automático. ${safety.rollback_plan || ''}`;
  } else if (safety.status === 'rejected') {
    verdict = `Ação bloqueada: ${safety.explanation}`;
  } else if (safety.status === 'queued') {
    verdict = `Ação na fila — aguardando condições seguras.`;
  } else {
    verdict = `${decision.action_type === 'pause' ? 'Pausa' : 'Ação'} aprovada com confiança.`;
  }

  return { data_point: dataPoint, threshold, financial_check: financialCheck, safety_check: safetyCheck, verdict };
}

// ════════════════════════════════════════════════════════════════════
// DECISION TAGGING
// ════════════════════════════════════════════════════════════════════

/**
 * Classify each decision with a strategy tag for performance analysis.
 * This enables answering: "which strategy types deliver the best outcomes?"
 */
function classifyDecisionTag(enriched: EnrichedDecision): DecisionTag | undefined {
  const { raw, financial } = enriched;

  switch (raw.action_type) {
    case 'pause': {
      if (financial.verdict === 'losing') return 'pause_loss';
      if (raw.detection_reason === 'FADIGA_CRITICA' || (raw.frequency && raw.frequency >= 3.5)) return 'pause_fatigue';
      if (raw.detection_reason.includes('COLAPSOU')) return 'pause_collapse';
      return 'pause_loss'; // Default pause
    }
    case 'scale_budget': {
      const scalePct = financial.recommended_scale_pct ?? 0;
      if (scalePct > 25) return 'scale_aggressive';
      return 'scale_safe';
    }
    case 'enable': {
      return 'recover_test';
    }
    case 'duplicate': {
      return 'scale_safe'; // Duplication is a form of safe scaling
    }
    case 'create_variant': {
      return 'creative_refresh';
    }
    case 'review': {
      return undefined; // Informational, no tag needed
    }
    default:
      return undefined;
  }
}
