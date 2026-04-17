/**
 * Financial Filter
 *
 * Position in pipeline: INPUT → DECISION ENGINE → [FINANCIAL FILTER] → SAFETY LAYER → OUTPUT
 *
 * Purpose: Every decision must pass financial validation.
 * - Is pausing this ad saving real money?
 * - Is scaling this ad actually profitable?
 * - What's the right scale % based on margin distance?
 *
 * Principle: Fewer decisions, but financially sound ones.
 */

import type {
  RawDecision,
  FinancialConfig,
  FinancialResult,
  FinancialVerdict,
} from './types.ts';

// ── Default thresholds when user hasn't configured margin ──
const DEFAULTS = {
  ASSUMED_MARGIN_PCT: 30,              // Conservative default (30% margin)
  MIN_SPEND_FOR_DECISION: 15,         // R$15 minimum spend to make any decision
  SCALE_SAFETY_MULTIPLIER: 1.5,       // Only scale if ROAS > break_even * 1.5
  MAX_SCALE_PCT: 30,                  // Never recommend more than 30% increase
  MIN_SCALE_PCT: 10,                  // Never recommend less than 10% increase
  LTV_CPA_MULTIPLIER: 0.3,           // Max CPA = LTV * 30% (payback in ~3 months)
};

/**
 * Run financial validation on a raw decision.
 *
 * Returns: financial verdict + approval + recommended scale %
 */
export function evaluateFinancial(
  decision: RawDecision,
  config: FinancialConfig,
): FinancialResult {
  const margin = config.profit_margin_pct ?? DEFAULTS.ASSUMED_MARGIN_PCT;
  const breakEven = config.break_even_roas ?? (margin > 0 ? round(1 / (margin / 100)) : null);
  const actualRoas = decision.roas ?? null;

  // ── Insufficient data → can't validate financially ──
  if (decision.spend < DEFAULTS.MIN_SPEND_FOR_DECISION) {
    return {
      verdict: 'unknown',
      approved: decision.action_type === 'pause' ? true : false, // Allow pause on low spend (precaution), block scale
      break_even_roas: breakEven,
      actual_roas: actualRoas,
      margin_of_safety: null,
      recommended_scale_pct: null,
      ltv_adjusted_cpa_limit: calculateLtvCpaLimit(config),
      explanation: `Gasto insuficiente (R$${decision.spend.toFixed(0)}) para validação financeira confiável. Mínimo: R$${DEFAULTS.MIN_SPEND_FOR_DECISION}.`,
    };
  }

  // ── Determine financial verdict ──
  const verdict = determineVerdict(actualRoas, breakEven);
  const marginOfSafety = calculateMarginOfSafety(actualRoas, breakEven);

  // ── Evaluate by action type ──
  switch (decision.action_type) {
    case 'pause':
      return evaluatePause(decision, verdict, breakEven, actualRoas, marginOfSafety, config);
    case 'scale_budget':
      return evaluateScale(decision, verdict, breakEven, actualRoas, marginOfSafety, config);
    case 'duplicate':
      return evaluateScale(decision, verdict, breakEven, actualRoas, marginOfSafety, config); // Same logic as scale
    case 'enable':
      return evaluateEnable(decision, verdict, breakEven, actualRoas, marginOfSafety, config);
    default:
      // review, create_variant — approve by default (informational)
      return {
        verdict,
        approved: true,
        break_even_roas: breakEven,
        actual_roas: actualRoas,
        margin_of_safety: marginOfSafety,
        recommended_scale_pct: null,
        ltv_adjusted_cpa_limit: calculateLtvCpaLimit(config),
        explanation: `Ação informativa (${decision.action_type}). Veredicto financeiro: ${verdict}.`,
      };
  }
}

// ── PAUSE evaluation ──
function evaluatePause(
  decision: RawDecision,
  verdict: FinancialVerdict,
  breakEven: number | null,
  actualRoas: number | null,
  marginOfSafety: number | null,
  config: FinancialConfig,
): FinancialResult {
  const ltv_limit = calculateLtvCpaLimit(config);

  // Pause when losing money → always approved
  if (verdict === 'losing') {
    const dailyLoss = estimateDailyLoss(decision, breakEven);
    return {
      verdict,
      approved: true,
      break_even_roas: breakEven,
      actual_roas: actualRoas,
      margin_of_safety: marginOfSafety,
      recommended_scale_pct: null,
      ltv_adjusted_cpa_limit: ltv_limit,
      explanation: breakEven
        ? `ROAS ${actualRoas?.toFixed(1)} está abaixo do break-even (${breakEven.toFixed(1)}). Margem ${config.profit_margin_pct ?? DEFAULTS.ASSUMED_MARGIN_PCT}% requer ROAS mínimo de ${breakEven.toFixed(1)}. Perda estimada: ~R$${dailyLoss.toFixed(0)}/dia.`
        : `Performance abaixo do aceitável. Pausar para evitar perda contínua.`,
    };
  }

  // Pause when break-even → approved but flag it
  if (verdict === 'break_even') {
    return {
      verdict,
      approved: true,
      break_even_roas: breakEven,
      actual_roas: actualRoas,
      margin_of_safety: marginOfSafety,
      recommended_scale_pct: null,
      ltv_adjusted_cpa_limit: ltv_limit,
      explanation: `ROAS ${actualRoas?.toFixed(1)} está no break-even (${breakEven?.toFixed(1)}). Sem lucro nem perda. Pausa recomendada para realocar budget.`,
    };
  }

  // Pause when profitable → only if detection has strong reason (frequency, CTR collapse)
  if (verdict === 'profitable') {
    const hasStrongReason = decision.kpi_data.metric === 'frequency' || decision.detection_reason.includes('COLAPSOU');
    return {
      verdict,
      approved: hasStrongReason,
      break_even_roas: breakEven,
      actual_roas: actualRoas,
      margin_of_safety: marginOfSafety,
      recommended_scale_pct: null,
      ltv_adjusted_cpa_limit: ltv_limit,
      explanation: hasStrongReason
        ? `Anúncio lucrativo (ROAS ${actualRoas?.toFixed(1)}) mas com ${decision.detection_reason === 'FADIGA_CRITICA' ? 'fadiga criativa (freq ' + decision.frequency?.toFixed(1) + ')' : 'queda abrupta de performance'}. Pausa preventiva para proteger performance.`
        : `Anúncio lucrativo (ROAS ${actualRoas?.toFixed(1)}, ${marginOfSafety?.toFixed(0)}% acima do break-even). Pausa NÃO recomendada financeiramente — reconsidere.`,
    };
  }

  // Unknown → approve pause (precautionary)
  return {
    verdict,
    approved: true,
    break_even_roas: breakEven,
    actual_roas: actualRoas,
    margin_of_safety: marginOfSafety,
    recommended_scale_pct: null,
    ltv_adjusted_cpa_limit: ltv_limit,
    explanation: `Dados insuficientes para veredicto financeiro. Pausa aprovada como precaução.`,
  };
}

// ── SCALE evaluation ──
function evaluateScale(
  decision: RawDecision,
  verdict: FinancialVerdict,
  breakEven: number | null,
  actualRoas: number | null,
  marginOfSafety: number | null,
  config: FinancialConfig,
): FinancialResult {
  const ltv_limit = calculateLtvCpaLimit(config);

  // Can't scale if losing money
  if (verdict === 'losing' || verdict === 'break_even') {
    return {
      verdict,
      approved: false,
      break_even_roas: breakEven,
      actual_roas: actualRoas,
      margin_of_safety: marginOfSafety,
      recommended_scale_pct: null,
      ltv_adjusted_cpa_limit: ltv_limit,
      explanation: verdict === 'losing'
        ? `ROAS ${actualRoas?.toFixed(1)} está abaixo do break-even (${breakEven?.toFixed(1)}). Escalar iria amplificar a perda. Bloqueado.`
        : `ROAS ${actualRoas?.toFixed(1)} está no break-even. Escalar sem margem de segurança é arriscado. Bloqueado.`,
    };
  }

  // Profitable → calculate how much to scale
  if (verdict === 'profitable' && breakEven && actualRoas) {
    const safetyMultiplier = DEFAULTS.SCALE_SAFETY_MULTIPLIER;

    // Only scale if well above break-even
    if (actualRoas < breakEven * safetyMultiplier) {
      return {
        verdict,
        approved: false,
        break_even_roas: breakEven,
        actual_roas: actualRoas,
        margin_of_safety: marginOfSafety,
        recommended_scale_pct: null,
        ltv_adjusted_cpa_limit: ltv_limit,
        explanation: `ROAS ${actualRoas.toFixed(1)} é lucrativo mas não atinge margem de segurança (${(breakEven * safetyMultiplier).toFixed(1)}x). Aguarde mais dados antes de escalar.`,
      };
    }

    // Calculate dynamic scale %
    // Closer to break-even → conservative (10-15%)
    // Far above break-even → aggressive (20-30%)
    const scalePct = calculateScalePct(actualRoas, breakEven);

    return {
      verdict,
      approved: true,
      break_even_roas: breakEven,
      actual_roas: actualRoas,
      margin_of_safety: marginOfSafety,
      recommended_scale_pct: scalePct,
      ltv_adjusted_cpa_limit: ltv_limit,
      explanation: `ROAS ${actualRoas.toFixed(1)} está ${marginOfSafety?.toFixed(0)}% acima do break-even (${breakEven.toFixed(1)}). Escalar ${scalePct}% recomendado — margem confortável.`,
    };
  }

  // Unknown verdict → don't scale (conservative)
  return {
    verdict: 'unknown',
    approved: false,
    break_even_roas: breakEven,
    actual_roas: actualRoas,
    margin_of_safety: marginOfSafety,
    recommended_scale_pct: null,
    ltv_adjusted_cpa_limit: ltv_limit,
    explanation: `Dados insuficientes para validar escala. Mantenha budget atual até ter ROAS claro.`,
  };
}

// ── ENABLE evaluation ──
function evaluateEnable(
  decision: RawDecision,
  verdict: FinancialVerdict,
  breakEven: number | null,
  actualRoas: number | null,
  marginOfSafety: number | null,
  config: FinancialConfig,
): FinancialResult {
  const ltv_limit = calculateLtvCpaLimit(config);

  // Only re-enable if we have reason to believe it will be profitable
  return {
    verdict,
    approved: verdict === 'profitable' || verdict === 'unknown',
    break_even_roas: breakEven,
    actual_roas: actualRoas,
    margin_of_safety: marginOfSafety,
    recommended_scale_pct: null,
    ltv_adjusted_cpa_limit: ltv_limit,
    explanation: verdict === 'profitable'
      ? `Reativação aprovada — último ROAS (${actualRoas?.toFixed(1)}) era lucrativo.`
      : verdict === 'unknown'
        ? `Dados insuficientes. Reativação permitida para coleta de dados.`
        : `Último ROAS (${actualRoas?.toFixed(1)}) era ${verdict}. Reativação não recomendada.`,
  };
}

// ── Helper: determine financial verdict ──
function determineVerdict(actualRoas: number | null, breakEven: number | null): FinancialVerdict {
  if (actualRoas == null || breakEven == null) return 'unknown';
  if (actualRoas < breakEven * 0.95) return 'losing';       // 5% tolerance
  if (actualRoas < breakEven * 1.1) return 'break_even';    // 10% band
  return 'profitable';
}

// ── Helper: margin of safety (% above or below break-even) ──
function calculateMarginOfSafety(actualRoas: number | null, breakEven: number | null): number | null {
  if (actualRoas == null || breakEven == null || breakEven === 0) return null;
  return round(((actualRoas - breakEven) / breakEven) * 100);
}

// ── Helper: dynamic scale % ──
function calculateScalePct(actualRoas: number, breakEven: number): number {
  const ratio = actualRoas / breakEven;
  // ratio 1.5 → 10%, ratio 2.0 → 15%, ratio 3.0 → 22%, ratio 4.0+ → 30%
  const pct = Math.min(
    DEFAULTS.MAX_SCALE_PCT,
    Math.max(
      DEFAULTS.MIN_SCALE_PCT,
      Math.round(5 + (ratio - 1) * 10)
    )
  );
  return pct;
}

// ── Helper: estimate daily loss ──
function estimateDailyLoss(decision: RawDecision, breakEven: number | null): number {
  if (!decision.roas || !breakEven || !decision.spend || !decision.kpi_data.period_days) return 0;
  const dailySpend = decision.spend / decision.kpi_data.period_days;
  // Loss = spend that doesn't return enough revenue
  // If ROAS is 0.6 and break-even is 2.5, every R$1 spent only returns R$0.24 of required R$1
  const returnPerReal = decision.roas / breakEven; // What fraction of break-even we're getting
  const lossPerReal = Math.max(0, 1 - returnPerReal);
  return round(dailySpend * lossPerReal);
}

// ── Helper: LTV-adjusted CPA limit ──
function calculateLtvCpaLimit(config: FinancialConfig): number | null {
  if (!config.ltv_estimate) return null;
  return round(config.ltv_estimate * DEFAULTS.LTV_CPA_MULTIPLIER);
}

function round(n: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
