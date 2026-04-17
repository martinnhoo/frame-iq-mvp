/**
 * Safety Layer
 *
 * Position in pipeline: INPUT → DECISION ENGINE → FINANCIAL FILTER → [SAFETY LAYER] → OUTPUT
 *
 * Purpose: Prevent the system from doing damage even when the financial
 * filter approves an action. Guardrails for autonomous operation.
 *
 * Rules:
 * 1. Max N actions per day per account (default 5)
 * 2. Max budget increase % per single action (default 20%)
 * 3. No duplicate actions on same target within 24h
 * 4. Gradual scaling: step up over days, not all at once
 * 5. Auto-rollback: if ROAS drops >X% within Yh of scale, revert
 * 6. Every action logged with before-state for rollback capability
 */

import type {
  RawDecision,
  SafetyConfig,
  SafetyResult,
  SafetyStatus,
  ActionLogEntry,
} from './types.ts';

// Supabase client type (passed in to avoid import coupling)
interface SupabaseClient {
  from: (table: string) => any;
}

// ── Recent action record from action_log ──
interface RecentAction {
  id: string;
  action_type: string;
  target_id: string;
  created_at: string;
  executed: boolean;
  new_value: Record<string, unknown> | null;
}

/**
 * Run safety validation on a financially-approved decision.
 *
 * Checks: daily limits, budget caps, duplicate prevention, gradual scaling.
 * Returns: safety status + rollback plan.
 */
export async function evaluateSafety(
  decision: RawDecision,
  config: SafetyConfig,
  accountId: string,
  supabase: SupabaseClient,
): Promise<SafetyResult> {

  // ── 1. Fetch today's action count for this account ──
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: todayActions } = await supabase
    .from('action_log')
    .select('id, action_type, target_id, created_at, executed, new_value')
    .eq('account_id', accountId)
    .eq('executed', true)
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false });

  const actionsToday = (todayActions || []) as RecentAction[];
  const executedToday = actionsToday.length;

  // ── 2. Check daily action limit ──
  if (executedToday >= config.max_actions_per_day) {
    return {
      status: 'rejected',
      daily_actions_used: executedToday,
      daily_actions_limit: config.max_actions_per_day,
      budget_change_pct: null,
      budget_limit_pct: config.max_budget_increase_pct,
      duplicate_action_blocked: false,
      gradual_step: null,
      rollback_plan: null,
      explanation: `Limite diário atingido (${executedToday}/${config.max_actions_per_day} ações hoje). Ação será executada amanhã automaticamente.`,
    };
  }

  // ── 3. SMART COOLDOWN — action-type-aware, with escalation ──
  // Pause cooldown: 24h, Scale cooldown: 48h
  // 2nd action on same target within 7 days → requires higher confidence
  const cooldownHours: Record<string, number> = {
    pause: 24,
    enable: 24,
    scale_budget: 48,
    duplicate: 72,
  };
  const cooldownMs = (cooldownHours[decision.action_type] ?? 24) * 60 * 60 * 1000;
  const cooldownSince = new Date(Date.now() - cooldownMs).toISOString();

  const { data: recentTargetActions } = await supabase
    .from('action_log')
    .select('id, action_type, target_id, created_at, executed')
    .eq('account_id', accountId)
    .eq('target_id', decision.target_id)
    .eq('executed', true)
    .gte('created_at', cooldownSince);

  const duplicateExists = (recentTargetActions || []).some(
    (a: RecentAction) => a.action_type === decision.action_type
  );

  if (duplicateExists) {
    const hours = cooldownHours[decision.action_type] ?? 24;
    return {
      status: 'rejected',
      daily_actions_used: executedToday,
      daily_actions_limit: config.max_actions_per_day,
      budget_change_pct: null,
      budget_limit_pct: config.max_budget_increase_pct,
      duplicate_action_blocked: true,
      gradual_step: null,
      rollback_plan: null,
      explanation: `Cooldown ativo: "${decision.action_type}" executada neste target nas últimas ${hours}h. Aguardando métricas estabilizarem.`,
    };
  }

  // Escalation: 2+ actions on same target within 7 days → queued for review
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: weeklyTargetActions } = await supabase
    .from('action_log')
    .select('id')
    .eq('account_id', accountId)
    .eq('target_id', decision.target_id)
    .eq('executed', true)
    .gte('created_at', sevenDaysAgo);

  if ((weeklyTargetActions || []).length >= 2) {
    return {
      status: 'queued',
      daily_actions_used: executedToday,
      daily_actions_limit: config.max_actions_per_day,
      budget_change_pct: null,
      budget_limit_pct: config.max_budget_increase_pct,
      duplicate_action_blocked: false,
      gradual_step: null,
      rollback_plan: null,
      explanation: `${(weeklyTargetActions || []).length} ações neste target nos últimos 7 dias. Ações repetidas indicam instabilidade — requer revisão manual antes de agir novamente.`,
    };
  }

  // ── 4. Budget-specific checks (scale/duplicate) ──
  if (decision.action_type === 'scale_budget' || decision.action_type === 'duplicate') {
    return await evaluateBudgetSafety(decision, config, accountId, supabase, executedToday);
  }

  // ── 5. Pause/Enable — generally safe, just log ──
  const rollbackPlan = decision.action_type === 'pause'
    ? `Se necessário reativar, o budget anterior (R$${decision.current_daily_budget?.toFixed(0) || '?'}) será restaurado.`
    : decision.action_type === 'enable'
      ? `Se performance não melhorar em 48h, será pausado novamente automaticamente.`
      : null;

  return {
    status: 'approved',
    daily_actions_used: executedToday,
    daily_actions_limit: config.max_actions_per_day,
    budget_change_pct: null,
    budget_limit_pct: config.max_budget_increase_pct,
    duplicate_action_blocked: false,
    gradual_step: null,
    rollback_plan: rollbackPlan,
    explanation: `Ação "${decision.action_type}" aprovada. ${executedToday + 1}/${config.max_actions_per_day} ações hoje.`,
  };
}

/**
 * Budget-specific safety: caps increase %, enforces gradual scaling.
 */
async function evaluateBudgetSafety(
  decision: RawDecision,
  config: SafetyConfig,
  accountId: string,
  supabase: SupabaseClient,
  executedToday: number,
): Promise<SafetyResult> {

  const currentBudget = decision.current_daily_budget || 0;

  if (currentBudget <= 0) {
    return {
      status: 'rejected',
      daily_actions_used: executedToday,
      daily_actions_limit: config.max_actions_per_day,
      budget_change_pct: null,
      budget_limit_pct: config.max_budget_increase_pct,
      duplicate_action_blocked: false,
      gradual_step: null,
      rollback_plan: null,
      explanation: `Budget atual desconhecido ou zero. Impossível calcular aumento seguro.`,
    };
  }

  // ── Gradual scaling check ──
  if (config.gradual_scaling_enabled) {
    const gradualResult = await checkGradualScaling(decision, config, accountId, supabase);
    if (gradualResult) {
      return {
        status: gradualResult.status || 'approved',
        budget_change_pct: gradualResult.budget_change_pct ?? null,
        gradual_step: gradualResult.gradual_step ?? null,
        rollback_plan: gradualResult.rollback_plan ?? null,
        explanation: gradualResult.explanation ?? '',
        daily_actions_used: executedToday,
        daily_actions_limit: config.max_actions_per_day,
        budget_limit_pct: config.max_budget_increase_pct,
        duplicate_action_blocked: false,
      };
    }
  }

  // ── Cap the increase ──
  const maxIncreasePct = config.max_budget_increase_pct;
  const maxNewBudget = currentBudget * (1 + maxIncreasePct / 100);
  const cappedPct = Math.min(maxIncreasePct, maxIncreasePct); // Will be overridden by financial filter's recommended_scale_pct

  return {
    status: 'approved',
    daily_actions_used: executedToday,
    daily_actions_limit: config.max_actions_per_day,
    budget_change_pct: cappedPct,
    budget_limit_pct: maxIncreasePct,
    duplicate_action_blocked: false,
    gradual_step: 1,
    rollback_plan: config.auto_rollback_enabled
      ? `Se ROAS cair >${config.rollback_roas_drop_pct}% nas próximas ${config.rollback_window_hours}h, budget reverte para R$${currentBudget.toFixed(0)} automaticamente.`
      : `Rollback automático desativado. Monitorar manualmente.`,
    explanation: `Aumento de budget aprovado (máx ${maxIncreasePct}%). Novo budget máximo: R$${maxNewBudget.toFixed(0)}. ${executedToday + 1}/${config.max_actions_per_day} ações hoje.`,
  };
}

/**
 * Gradual scaling: check if this target has been scaled recently.
 * Day 1: +15%, Day 2: +15%, Day 3: evaluate before next step.
 */
async function checkGradualScaling(
  decision: RawDecision,
  config: SafetyConfig,
  accountId: string,
  supabase: SupabaseClient,
): Promise<Partial<SafetyResult> | null> {

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentScales } = await supabase
    .from('action_log')
    .select('id, created_at, new_value, executed_at')
    .eq('account_id', accountId)
    .eq('target_id', decision.target_id)
    .eq('action_type', 'scale_budget')
    .eq('executed', true)
    .gte('created_at', threeDaysAgo)
    .order('created_at', { ascending: true });

  const scaleCount = (recentScales || []).length;

  if (scaleCount === 0) {
    // First scale in 3 days → approved as step 1
    return null; // Let normal flow handle it
  }

  if (scaleCount === 1) {
    // Second scale in 3 days → approved as step 2, but capped at 15%
    return {
      status: 'approved',
      budget_change_pct: Math.min(15, config.max_budget_increase_pct),
      gradual_step: 2,
      rollback_plan: `Segundo aumento em 3 dias. Se ROAS cair >${config.rollback_roas_drop_pct}% em ${config.rollback_window_hours}h, ambos os aumentos serão revertidos.`,
      explanation: `Scaling gradual — step 2/3. Máx 15% neste step. Próximo aumento requer avaliação de performance.`,
    };
  }

  // 3+ scales in 3 days → needs evaluation, queue it
  return {
    status: 'queued',
    budget_change_pct: null,
    gradual_step: scaleCount + 1,
    rollback_plan: null,
    explanation: `${scaleCount} aumentos nos últimos 3 dias. Scaling gradual requer pausa para avaliação. Ação adicionada à fila para revisão.`,
  };
}

/**
 * Check if any recent scale actions need rollback.
 * Called by a scheduled job (e.g., check-critical-alerts).
 *
 * Returns list of actions that should be rolled back.
 */
export async function checkPendingRollbacks(
  accountId: string,
  supabase: SupabaseClient,
  currentMetrics: { target_id: string; roas: number }[],
): Promise<{ actionId: string; targetId: string; previousBudget: number; reason: string }[]> {

  const { data: pendingActions } = await supabase
    .from('action_log')
    .select('id, target_id, previous_value, new_value, executed_at')
    .eq('account_id', accountId)
    .eq('action_type', 'scale_budget')
    .eq('executed', true)
    .eq('rolled_back', false)
    .gte('executed_at', new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString());

  if (!pendingActions || pendingActions.length === 0) return [];

  const rollbacks: { actionId: string; targetId: string; previousBudget: number; reason: string }[] = [];

  for (const action of pendingActions) {
    const metric = currentMetrics.find(m => m.target_id === action.target_id);
    if (!metric) continue;

    const previousRoas = (action.previous_value as any)?.roas;
    if (previousRoas == null || previousRoas === 0) continue;

    const roasDropPct = ((previousRoas - metric.roas) / previousRoas) * 100;

    // Fetch account's rollback threshold
    const { data: account } = await supabase
      .from('ad_accounts')
      .select('rollback_roas_drop_pct')
      .eq('id', accountId)
      .single();

    const threshold = (account as any)?.rollback_roas_drop_pct ?? 30;

    if (roasDropPct >= threshold) {
      const prevBudget = (action.previous_value as any)?.daily_budget ?? 0;
      rollbacks.push({
        actionId: action.id,
        targetId: action.target_id,
        previousBudget: prevBudget,
        reason: `ROAS caiu ${roasDropPct.toFixed(0)}% (de ${previousRoas.toFixed(1)} para ${metric.roas.toFixed(1)}) após scale. Limite: ${threshold}%. Revertendo budget para R$${(prevBudget / 100).toFixed(0)}.`,
      });
    }
  }

  return rollbacks;
}
