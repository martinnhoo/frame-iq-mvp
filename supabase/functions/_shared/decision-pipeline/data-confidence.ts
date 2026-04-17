/**
 * Data Confidence Score
 *
 * Before ANY decision, we calculate how much we can trust the data.
 * This is the gatekeeper: low confidence → don't act.
 *
 * Formula:
 *   data_confidence = f(
 *     conversion_volume,      — more conversions = stronger signal
 *     historical_consistency, — stable metrics = more reliable
 *     attribution_delay,      — recent data may be incomplete
 *     variance,               — high variance = unreliable signal
 *     spend_volume,           — more spend = more data points
 *     data_freshness          — stale data = less actionable
 *   )
 *
 * Output: 0.0 to 1.0
 *   < 0.3  → DO NOT ACT (data unreliable)
 *   0.3-0.5 → ACT WITH CAUTION (only pause, no scale)
 *   0.5-0.7 → MODERATE CONFIDENCE (pause + conservative scale)
 *   > 0.7  → HIGH CONFIDENCE (full action range)
 */

// ── Thresholds for action gating ──
export const CONFIDENCE_GATES = {
  DO_NOT_ACT: 0.30,
  CAUTION_ONLY: 0.50,    // Only pause allowed
  MODERATE: 0.70,         // Pause + conservative scale
  HIGH: 0.85,             // Full action range
} as const;

// ── Weight distribution ──
const W = {
  conversion_volume: 0.22,
  historical_consistency: 0.20,
  attribution_delay: 0.15,
  variance: 0.18,
  spend_volume: 0.13,
  data_freshness: 0.12,
};

export interface DataConfidenceInput {
  // Conversion signal
  conversions: number;            // Total conversions in period
  conversion_days: number;        // Days with at least 1 conversion

  // Historical consistency (daily metric values)
  daily_values?: number[];        // e.g. [0.5, 0.6, 0.4, 0.55, ...] — daily ROAS/CTR
  metric_name?: string;           // For context in explanation

  // Attribution
  hours_since_last_data?: number; // How old is the newest data point
  attribution_window_hours?: number; // Platform attribution window (default 72h for Meta)

  // Spend
  spend: number;                  // Total spend in period
  period_days: number;            // How many days of data

  // Pattern matching
  pattern_confidence?: number;    // From learned_patterns (0-1)
}

export interface DataConfidenceResult {
  score: number;                  // 0.0 to 1.0
  gate: 'do_not_act' | 'caution_only' | 'moderate' | 'high';
  components: {
    conversion_volume: number;
    historical_consistency: number;
    attribution_delay: number;
    variance: number;
    spend_volume: number;
    data_freshness: number;
  };
  explanation: string;            // Human-readable summary
  action_allowed: {
    pause: boolean;
    scale: boolean;
    duplicate: boolean;
    enable: boolean;
  };
}

/**
 * Calculate data confidence score.
 *
 * This runs BEFORE the financial filter — if confidence is too low,
 * we don't even evaluate the decision financially.
 */
export function calculateDataConfidence(input: DataConfidenceInput): DataConfidenceResult {

  // ── 1. Conversion volume score ──
  // 0 conv → 0, 3 conv → 0.3, 10 conv → 0.6, 30+ conv → 1.0
  const convScore = Math.min(1, Math.sqrt(input.conversions / 30));

  // Bonus for consistent conversion days (not all in one day)
  const convDayRatio = input.period_days > 0
    ? Math.min(1, input.conversion_days / Math.max(1, input.period_days * 0.5))
    : 0;
  const convFinal = convScore * 0.7 + convDayRatio * 0.3;

  // ── 2. Historical consistency (coefficient of variation) ──
  let consistencyScore = 0.5; // Default if no daily data
  if (input.daily_values && input.daily_values.length >= 3) {
    const cv = coefficientOfVariation(input.daily_values);
    // CV < 0.2 → very consistent (score ~0.9)
    // CV 0.5 → moderately variable (score ~0.5)
    // CV > 1.0 → very volatile (score ~0.1)
    consistencyScore = Math.max(0.05, Math.min(0.95, 1 - cv));
  }

  // ── 3. Attribution delay factor ──
  // Meta has up to 72h attribution window
  // If data is < 24h old, some conversions haven't been attributed yet
  const attrWindow = input.attribution_window_hours ?? 72;
  const hoursSinceData = input.hours_since_last_data ?? 12;
  // Score increases as we move past the attribution window
  const attrScore = Math.min(1, hoursSinceData / attrWindow);
  // But also penalize very stale data (> 7 days)
  const attrFinal = hoursSinceData > 168 ? attrScore * 0.3 : attrScore;

  // ── 4. Variance penalty ──
  let varianceScore = 0.5;
  if (input.daily_values && input.daily_values.length >= 3) {
    const std = standardDeviation(input.daily_values);
    const mean = average(input.daily_values);
    if (mean > 0) {
      // Normalized variance: std/mean (same as CV but used differently)
      const normVar = std / mean;
      // Low variance → high score
      varianceScore = Math.max(0.05, Math.min(0.95, 1 - normVar * 0.8));
    }
  }

  // ── 5. Spend volume ──
  // R$0 → 0, R$30 → 0.3, R$100 → 0.6, R$500+ → 1.0
  const spendScore = Math.min(1, Math.sqrt(input.spend / 500));

  // ── 6. Data freshness ──
  // 0 days → 1.0, 3 days → 0.6, 7+ days → 0.2
  const ageDays = (input.hours_since_last_data ?? 12) / 24;
  const freshnessScore = Math.max(0.1, 1 - (ageDays / 10));

  // ── Weighted composite ──
  const rawScore =
    convFinal * W.conversion_volume +
    consistencyScore * W.historical_consistency +
    attrFinal * W.attribution_delay +
    varianceScore * W.variance +
    spendScore * W.spend_volume +
    freshnessScore * W.data_freshness;

  // Pattern confidence bonus (if available)
  const patternBonus = (input.pattern_confidence ?? 0) * 0.08;

  // Clamp to [0.02, 0.98]
  const score = Math.round(Math.max(0.02, Math.min(0.98, rawScore + patternBonus)) * 100) / 100;

  // ── Determine gate ──
  const gate: DataConfidenceResult['gate'] =
    score >= CONFIDENCE_GATES.HIGH ? 'high' :
    score >= CONFIDENCE_GATES.MODERATE ? 'moderate' :
    score >= CONFIDENCE_GATES.CAUTION_ONLY ? 'caution_only' :
    'do_not_act';

  // ── Actions allowed per gate ──
  const action_allowed = {
    pause: gate !== 'do_not_act',                          // Allowed from caution_only+
    scale: gate === 'moderate' || gate === 'high',         // Only moderate+
    duplicate: gate === 'high',                            // Only high confidence
    enable: gate !== 'do_not_act',                         // Same as pause
  };

  // ── Explanation ──
  const explanation = buildExplanation(score, gate, {
    convFinal, consistencyScore, attrFinal, varianceScore, spendScore, freshnessScore,
  }, input);

  return {
    score,
    gate,
    components: {
      conversion_volume: round(convFinal),
      historical_consistency: round(consistencyScore),
      attribution_delay: round(attrFinal),
      variance: round(varianceScore),
      spend_volume: round(spendScore),
      data_freshness: round(freshnessScore),
    },
    explanation,
    action_allowed,
  };
}

/**
 * Quick check: should we even evaluate this decision?
 */
export function shouldEvaluate(confidence: DataConfidenceResult, actionType: string): boolean {
  if (confidence.gate === 'do_not_act') return false;
  if (actionType === 'scale_budget' && confidence.gate === 'caution_only') return false;
  if (actionType === 'duplicate' && confidence.gate !== 'high') return false;
  return true;
}

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

function coefficientOfVariation(values: number[]): number {
  const mean = average(values);
  if (mean === 0) return 1; // Max variability
  const std = standardDeviation(values);
  return std / Math.abs(mean);
}

function standardDeviation(values: number[]): number {
  const mean = average(values);
  const squareDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(average(squareDiffs));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildExplanation(
  score: number,
  gate: string,
  components: Record<string, number>,
  input: DataConfidenceInput,
): string {
  const parts: string[] = [];

  parts.push(`Confiança nos dados: ${(score * 100).toFixed(0)}% (${gate.replace('_', ' ')}).`);

  // Weakest component
  const weakest = Object.entries(components)
    .sort((a, b) => a[1] - b[1])[0];

  const weakLabels: Record<string, string> = {
    convFinal: `Poucas conversões (${input.conversions})`,
    consistencyScore: 'Métricas instáveis dia a dia',
    attrFinal: 'Dados podem estar incompletos (janela de atribuição)',
    varianceScore: 'Alta variância nas métricas',
    spendScore: `Gasto baixo (R$${input.spend.toFixed(0)})`,
    freshnessScore: 'Dados não são recentes',
  };

  if (weakest && weakest[1] < 0.4) {
    parts.push(`Ponto fraco: ${weakLabels[weakest[0]] || weakest[0]}.`);
  }

  if (gate === 'do_not_act') {
    parts.push('Recomendação: NÃO agir. Aguardar mais dados.');
  } else if (gate === 'caution_only') {
    parts.push('Recomendação: apenas pausas preventivas. Escalar não é seguro com esses dados.');
  }

  return parts.join(' ');
}
