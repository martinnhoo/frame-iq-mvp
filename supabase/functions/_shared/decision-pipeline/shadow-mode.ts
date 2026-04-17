/**
 * Shadow Mode — Run new pipeline in parallel with existing system
 *
 * When decision_engine_version = 'v2_shadow':
 *   - Old system runs normally (alerts, actions, everything as-is)
 *   - New pipeline runs in parallel on the SAME data
 *   - New pipeline's decisions are logged to action_log with is_shadow=true
 *   - Nothing is executed — pure observation
 *
 * When decision_engine_version = 'v2_active':
 *   - New pipeline replaces old system for decision-making
 *   - Old detection still runs (thresholds), but pipeline filters + enriches
 *
 * When decision_engine_version = 'v1' (default):
 *   - Nothing changes — current system runs as-is
 *
 * Usage: call `runShadowPipeline()` at the end of check-critical-alerts
 * or daily-intelligence. It reads the alerts that were just generated
 * and processes them through the new pipeline.
 */

import type {
  RawDecision,
  FinancialConfig,
  SafetyConfig,
  EnrichedDecision,
  ActionLogEntry,
} from './types.ts';
import { enrichDecision, toActionLogEntry } from './decision-output.ts';

// Supabase client type
interface SupabaseClient {
  from: (table: string) => any;
}

// ── Alert from check-critical-alerts format ──
export interface AlertInput {
  type: string;
  ad: string;
  campaign: string;
  detail: string;
  urgency: '🔴' | '🟡';
  // Extended data (added by shadow mode integration)
  ad_id?: string;
  spend?: number;
  roas?: number;
  ctr?: number;
  frequency?: number;
  conversions?: number;
  current_daily_budget?: number;
  period_days?: number;
}

/**
 * Check if shadow mode (or v2_active) is enabled for this account.
 */
export async function getEngineVersion(
  accountId: string,
  supabase: SupabaseClient,
): Promise<'v1' | 'v2_shadow' | 'v2_active'> {
  const { data } = await supabase
    .from('ad_accounts')
    .select('decision_engine_version')
    .eq('id', accountId)
    .single();

  return (data?.decision_engine_version as any) || 'v1';
}

/**
 * Load financial + safety config for an account.
 */
export async function loadAccountConfig(
  accountId: string,
  supabase: SupabaseClient,
): Promise<{ financial: FinancialConfig; safety: SafetyConfig }> {
  const { data } = await supabase
    .from('ad_accounts')
    .select(`
      profit_margin_pct, break_even_roas, ltv_estimate,
      monthly_budget_target, currency,
      max_budget_increase_pct, max_actions_per_day,
      auto_rollback_enabled, rollback_roas_drop_pct,
      rollback_window_hours, gradual_scaling_enabled
    `)
    .eq('id', accountId)
    .single();

  const a = data || {};

  return {
    financial: {
      profit_margin_pct: a.profit_margin_pct ?? null,
      break_even_roas: a.break_even_roas ?? null,
      ltv_estimate: a.ltv_estimate ?? null,
      monthly_budget_target: a.monthly_budget_target ?? null,
      currency: a.currency ?? 'BRL',
    },
    safety: {
      max_budget_increase_pct: a.max_budget_increase_pct ?? 20,
      max_actions_per_day: a.max_actions_per_day ?? 5,
      auto_rollback_enabled: a.auto_rollback_enabled ?? true,
      rollback_roas_drop_pct: a.rollback_roas_drop_pct ?? 30,
      rollback_window_hours: a.rollback_window_hours ?? 48,
      gradual_scaling_enabled: a.gradual_scaling_enabled ?? true,
    },
  };
}

/**
 * Run the shadow pipeline on a batch of alerts.
 *
 * Called at the end of check-critical-alerts or daily-intelligence.
 * Logs enriched decisions to action_log with is_shadow=true.
 *
 * Returns: enriched decisions (for logging/debugging) or null if v1.
 */
export async function runShadowPipeline(
  alerts: AlertInput[],
  accountId: string,
  userId: string,
  supabase: SupabaseClient,
  triggeredBy: string,
  options?: { personaId?: string },
): Promise<EnrichedDecision[] | null> {

  // ── Check engine version ──
  const version = await getEngineVersion(accountId, supabase);
  if (version === 'v1') return null; // Shadow mode not enabled

  // ── Load config ──
  const { financial, safety } = await loadAccountConfig(accountId, supabase);

  // ── Process each alert through pipeline ──
  const enriched: EnrichedDecision[] = [];

  for (const alert of alerts) {
    const raw = alertToRawDecision(alert);
    if (!raw) continue;

    try {
      const decision = await enrichDecision(raw, financial, safety, accountId, supabase);
      enriched.push(decision);

      // Log to action_log (shadow mode)
      const logEntry = toActionLogEntry(decision, userId, accountId, triggeredBy, {
        personaId: options?.personaId,
        isShadow: true,
      });

      await supabase.from('action_log').insert({
        ...logEntry,
        is_shadow: version === 'v2_shadow',
        executed: false,
        // Store full pipeline output for later analysis
        execution_result: {
          pipeline_version: 'v2',
          engine_mode: version,
          enriched_decision: {
            approved: decision.approved,
            confidence: decision.confidence,
            risk_level: decision.risk_level,
            financial_verdict: decision.financial.verdict,
            safety_status: decision.safety.status,
            expected_daily_impact: decision.expected_daily_impact,
          },
        },
      });
    } catch (e) {
      console.error(`Shadow pipeline error for alert ${alert.type}:`, String(e));
    }
  }

  return enriched;
}

/**
 * Compare shadow decisions vs what the old system did.
 *
 * Returns a diff report for analysis.
 */
export async function compareShadowVsProduction(
  accountId: string,
  supabase: SupabaseClient,
  days = 7,
): Promise<ShadowComparison> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Fetch shadow logs
  const { data: shadowLogs } = await supabase
    .from('action_log')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_shadow', true)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  // Fetch production alerts (same period)
  const { data: prodAlerts } = await supabase
    .from('account_alerts')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  const shadows = (shadowLogs || []) as any[];
  const prods = (prodAlerts || []) as any[];

  // Count discrepancies
  const blockedByPipeline = shadows.filter(
    s => s.execution_result?.enriched_decision?.approved === false
  );
  const approvedByPipeline = shadows.filter(
    s => s.execution_result?.enriched_decision?.approved === true
  );

  const avgConfidence = shadows.length > 0
    ? shadows.reduce((sum: number, s: any) => sum + (s.confidence || 0), 0) / shadows.length
    : 0;

  return {
    period_days: days,
    shadow_decisions: shadows.length,
    production_alerts: prods.length,
    pipeline_would_block: blockedByPipeline.length,
    pipeline_would_approve: approvedByPipeline.length,
    avg_confidence: Math.round(avgConfidence * 100) / 100,
    blocked_details: blockedByPipeline.map(s => ({
      target: s.target_name,
      action: s.action_type,
      reason: s.explanation?.financial_check || 'Unknown',
      financial_verdict: s.financial_verdict,
    })),
    confidence_distribution: {
      high: shadows.filter(s => s.confidence >= 0.7).length,
      medium: shadows.filter(s => s.confidence >= 0.4 && s.confidence < 0.7).length,
      low: shadows.filter(s => s.confidence < 0.4).length,
    },
  };
}

export interface ShadowComparison {
  period_days: number;
  shadow_decisions: number;
  production_alerts: number;
  pipeline_would_block: number;
  pipeline_would_approve: number;
  avg_confidence: number;
  blocked_details: { target: string; action: string; reason: string; financial_verdict: string }[];
  confidence_distribution: { high: number; medium: number; low: number };
}

// ── Convert alert to RawDecision ──
function alertToRawDecision(alert: AlertInput): RawDecision | null {
  const type = alert.type;

  let actionType: RawDecision['action_type'];
  if (['FADIGA_CRITICA', 'ROAS_CRITICO', 'ROAS_COLAPSOU', 'CTR_COLAPSOU', 'RETENCAO_VIDEO_BAIXA', 'SPEND_SEM_RETORNO'].includes(type)) {
    actionType = 'pause';
  } else if (type === 'OPORTUNIDADE_ESCALA' || type.includes('ESCALA')) {
    actionType = 'scale_budget';
  } else {
    actionType = 'review';
  }

  let metric: string;
  let threshold: number;

  if (type.includes('ROAS')) { metric = 'roas'; threshold = 0.8; }
  else if (type.includes('CTR')) { metric = 'ctr'; threshold = 0.006; }
  else if (type.includes('FADIGA')) { metric = 'frequency'; threshold = 4.0; }
  else if (type.includes('RETENCAO')) { metric = 'thruplay'; threshold = 0.10; }
  else if (type.includes('SPEND')) { metric = 'spend_no_conv'; threshold = 80; }
  else if (type.includes('ESCALA')) { metric = 'roas'; threshold = 2.0; }
  else { metric = 'unknown'; threshold = 0; }

  return {
    action_type: actionType,
    target_id: alert.ad_id || alert.ad || 'unknown',
    target_type: 'ad',
    target_name: alert.ad || 'Unknown',
    detection_reason: type,
    urgency: alert.urgency === '🔴' ? 'high' : 'medium',
    kpi_data: {
      metric,
      current_value: alert.roas ?? alert.ctr ?? alert.frequency ?? 0,
      threshold,
      period_days: alert.period_days ?? 3,
    },
    spend: alert.spend ?? 50,
    conversions: alert.conversions ?? 0,
    roas: alert.roas,
    ctr: alert.ctr,
    frequency: alert.frequency,
    current_daily_budget: alert.current_daily_budget,
  };
}
