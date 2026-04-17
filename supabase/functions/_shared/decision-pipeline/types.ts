/**
 * Decision Pipeline — Shared Types
 *
 * Architecture: INPUT → DECISION ENGINE → FINANCIAL FILTER → SAFETY LAYER → OUTPUT
 *
 * Every decision flows through this pipeline before reaching the user.
 * The types here define the contract between each layer.
 */

// ── Financial config (from ad_accounts table) ──

export interface FinancialConfig {
  profit_margin_pct: number | null;   // e.g. 40 = 40%
  break_even_roas: number | null;     // auto-calculated: 1 / (margin/100)
  ltv_estimate: number | null;        // customer lifetime value
  monthly_budget_target: number | null;
  currency: string;                    // default 'BRL'
}

// ── Safety config (from ad_accounts table) ──

export interface SafetyConfig {
  max_budget_increase_pct: number;     // default 20
  max_actions_per_day: number;         // default 5
  auto_rollback_enabled: boolean;      // default true
  rollback_roas_drop_pct: number;      // default 30
  rollback_window_hours: number;       // default 48
  gradual_scaling_enabled: boolean;    // default true
}

// ── Raw decision from detection engine (before pipeline) ──

export interface RawDecision {
  action_type: 'pause' | 'enable' | 'scale_budget' | 'duplicate' | 'create_variant' | 'review';
  target_id: string;
  target_type: 'ad' | 'adset' | 'campaign';
  target_name: string;

  // Detection data
  detection_reason: string;           // e.g. "ROAS_CRITICO", "OPORTUNIDADE_ESCALA"
  urgency: 'high' | 'medium' | 'low';
  kpi_data: {
    metric: string;                   // e.g. "roas", "ctr", "cpa", "frequency"
    current_value: number;
    previous_value?: number;
    threshold: number;
    period_days: number;
  };

  // Ad context
  spend: number;
  conversions: number;
  roas?: number;
  ctr?: number;
  frequency?: number;
  current_daily_budget?: number;
}

// ── Financial verdict (output of financial filter) ──

export type FinancialVerdict = 'profitable' | 'break_even' | 'losing' | 'unknown';

export interface FinancialResult {
  verdict: FinancialVerdict;
  approved: boolean;
  break_even_roas: number | null;
  actual_roas: number | null;
  margin_of_safety: number | null;    // how far above/below break-even (%)
  recommended_scale_pct: number | null; // calculated scale %, null if not scale action
  ltv_adjusted_cpa_limit: number | null;
  explanation: string;                 // human-readable why
}

// ── Safety check result (output of safety layer) ──

export type SafetyStatus = 'approved' | 'queued' | 'rejected' | 'needs_gradual';

export interface SafetyResult {
  status: SafetyStatus;
  daily_actions_used: number;
  daily_actions_limit: number;
  budget_change_pct: number | null;
  budget_limit_pct: number;
  duplicate_action_blocked: boolean;
  gradual_step: number | null;        // e.g. 1, 2, 3 (which day of gradual scaling)
  rollback_plan: string | null;       // what happens if this fails
  explanation: string;
}

// ── Enriched decision (final output of pipeline) ──

export type RiskLevel = 'safe' | 'moderate' | 'high';

export interface EnrichedDecision {
  // Original decision
  raw: RawDecision;

  // Pipeline results
  financial: FinancialResult;
  safety: SafetyResult;

  // Final verdict
  approved: boolean;                   // both financial + safety approved
  confidence: number;                  // 0.0 to 1.0
  risk_level: RiskLevel;
  expected_daily_impact: number;       // R$ saved or gained per day (estimated)

  // Explanation chain (user-facing)
  explanation: {
    data_point: string;                // "ROAS 0.6 nos últimos 3 dias"
    threshold: string;                 // "Break-even ROAS = 2.5 (margem 40%)"
    financial_check: string;           // "ROAS < break-even → perdendo dinheiro"
    safety_check: string;              // "Dentro do limite diário (2/5 ações)"
    verdict: string;                   // "Pausar justificado — economia ~R$45/dia"
  };
}

// ── Action log entry (for database) ──

export interface ActionLogEntry {
  user_id: string;
  account_id: string;
  persona_id?: string;
  action_type: string;
  target_id: string;
  target_type: string;
  target_name?: string;
  previous_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  confidence: number;
  risk_level: RiskLevel;
  financial_verdict?: FinancialVerdict;
  explanation: Record<string, string>;
  source: 'system' | 'user' | 'auto_pilot';
  triggered_by: string;
  decision_tag?: DecisionTag;
}

// ── Decision tags for strategy performance analysis ──
export type DecisionTag =
  | 'scale_aggressive'     // Budget increase > 25%
  | 'scale_safe'           // Budget increase 10-25%
  | 'pause_loss'           // Paused because losing money (ROAS < break-even)
  | 'pause_fatigue'        // Paused because creative fatigue (frequency)
  | 'pause_collapse'       // Paused because sudden KPI collapse
  | 'recover_test'         // Re-enabled after cooldown period
  | 'budget_rebalance'     // Cross-campaign budget move
  | 'creative_refresh'     // Suggested new creative variant
  | 'audience_shift';      // Suggested audience change
