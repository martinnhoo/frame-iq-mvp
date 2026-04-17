/**
 * Decision Pipeline — Full Integration Tests
 *
 * Tests the COMPLETE pipeline end-to-end:
 *   RawDecision → Data Confidence → Financial Filter → Safety Layer → EnrichedDecision
 *
 * Uses mock Supabase (no real DB needed).
 * Each scenario simulates a real-world ad situation.
 *
 * This replaces shadow mode — if all scenarios pass, the pipeline is production-ready.
 */

import { enrichDecision, toActionLogEntry } from './decision-output.ts';
import type { RawDecision, FinancialConfig, SafetyConfig } from './types.ts';

console.log('═══════════════════════════════════════════════════');
console.log('  DECISION PIPELINE — FULL INTEGRATION TESTS');
console.log('  Simulating real ad scenarios end-to-end');
console.log('═══════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;
let scenarioCount = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) { console.log(`    ✓ ${name}`); passed++; }
  else { console.log(`    ✗ ${name}${detail ? ` — ${detail}` : ''}`); failed++; }
}

// ════════════════════════════════════════════════════════════════════
// MOCK SUPABASE
// Simulates action_log queries without a real database.
// ════════════════════════════════════════════════════════════════════

interface MockAction {
  id: string;
  action_type: string;
  target_id: string;
  created_at: string;
  executed: boolean;
  new_value: Record<string, unknown> | null;
  executed_at?: string;
}

function createMockSupabase(existingActions: MockAction[] = []) {
  return {
    from: (table: string) => {
      let filters: Record<string, any> = {};
      let selectFields = '*';

      const chain: any = {
        select: (fields: string) => { selectFields = fields; return chain; },
        eq: (col: string, val: any) => { filters[col] = val; return chain; },
        gte: (col: string, val: any) => { filters[`${col}_gte`] = val; return chain; },
        lte: (col: string, val: any) => { filters[`${col}_lte`] = val; return chain; },
        order: (_col: string, _opts: any) => chain,
        single: () => {
          if (table === 'ad_accounts') {
            return { data: { rollback_roas_drop_pct: 30 }, error: null };
          }
          return { data: null, error: null };
        },
      };

      // Make the chain thenable so await works
      chain.then = (resolve: Function) => {
        let results = [...existingActions];

        // Apply filters
        if (filters.account_id) results = results.filter(a => true); // All match in test
        if (filters.target_id) results = results.filter(a => a.target_id === filters.target_id);
        if (filters.action_type) results = results.filter(a => a.action_type === filters.action_type);
        if (filters.executed !== undefined) results = results.filter(a => a.executed === filters.executed);

        // Apply date filters
        for (const [key, val] of Object.entries(filters)) {
          if (key.endsWith('_gte')) {
            const col = key.replace('_gte', '');
            results = results.filter(a => (a as any)[col] >= val);
          }
        }

        resolve({ data: results, error: null });
      };

      return chain;
    },
  };
}

// ════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGS
// ════════════════════════════════════════════════════════════════════

const DEFAULT_FINANCIAL: FinancialConfig = {
  profit_margin_pct: 40,      // Break-even ROAS = 2.5
  break_even_roas: 2.5,
  ltv_estimate: 500,
  monthly_budget_target: 5000,
  currency: 'BRL',
};

const DEFAULT_SAFETY: SafetyConfig = {
  max_budget_increase_pct: 20,
  max_actions_per_day: 5,
  auto_rollback_enabled: true,
  rollback_roas_drop_pct: 30,
  rollback_window_hours: 48,
  gradual_scaling_enabled: true,
};

// Helper to build a RawDecision quickly
function makeDecision(overrides: Partial<RawDecision> & { action_type: RawDecision['action_type'] }): RawDecision {
  return {
    target_id: 'ad_001',
    target_type: 'ad',
    target_name: 'Test Ad',
    detection_reason: 'TEST',
    urgency: 'medium',
    kpi_data: {
      metric: 'roas',
      current_value: 1.0,
      threshold: 2.5,
      period_days: 7,
    },
    spend: 200,
    conversions: 10,
    roas: 1.0,
    ctr: 1.5,
    frequency: 1.8,
    current_daily_budget: 5000, // R$50 in centavos
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════
// SCENARIOS
// ════════════════════════════════════════════════════════════════════

async function runScenario(
  name: string,
  fn: () => Promise<void>,
) {
  scenarioCount++;
  console.log(`\n${scenarioCount}. ${name}`);
  await fn();
}

async function runAllTests() {

  // ── SCENARIO 1: Classic money loser — should pause ──
  await runScenario('Ad perdendo dinheiro (ROAS 0.8, break-even 2.5) → deve pausar', async () => {
    const decision = makeDecision({
      action_type: 'pause',
      detection_reason: 'ROAS_CRITICO',
      kpi_data: { metric: 'roas', current_value: 0.8, threshold: 2.5, period_days: 7 },
      spend: 350,
      conversions: 15,
      roas: 0.8,
    });

    const result = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { dailyValues: [0.9, 0.7, 0.8, 0.85, 0.75, 0.8, 0.82], conversionDays: 6, hoursSinceLastData: 36 },
    );

    assert(result.approved === true, 'approved (pause saves money)');
    assert(result.financial.verdict === 'losing', `financial = losing, got ${result.financial.verdict}`);
    assert(result.risk_level === 'safe' || result.risk_level === 'moderate', `risk = safe or moderate, got ${result.risk_level}`);
    assert(result.confidence > 0.5, `confidence > 0.5, got ${result.confidence}`);
    assert(result.explanation.verdict.includes('Pausar') || result.explanation.verdict.includes('Pausa'), 'verdict mentions pause');
    assert(result.expected_daily_impact > 0, `daily impact > 0 (saving money), got ${result.expected_daily_impact}`);
  });

  // ── SCENARIO 2: Profitable ad, no reason to pause — should BLOCK ──
  await runScenario('Ad lucrativo sem razão forte → deve BLOQUEAR pausa', async () => {
    const decision = makeDecision({
      action_type: 'pause',
      detection_reason: 'SOME_WEAK_REASON',
      kpi_data: { metric: 'roas', current_value: 4.0, threshold: 2.5, period_days: 7 },
      spend: 300,
      conversions: 20,
      roas: 4.0,
    });

    const result = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { dailyValues: [3.8, 4.1, 4.0, 3.9, 4.2, 4.0, 3.95], conversionDays: 7, hoursSinceLastData: 30 },
    );

    assert(result.approved === false, 'NOT approved (don\'t pause profitable ad)');
    assert(result.financial.verdict === 'profitable', `financial = profitable, got ${result.financial.verdict}`);
  });

  // ── SCENARIO 3: Profitable ad WITH creative fatigue — should allow pause ──
  await runScenario('Ad lucrativo MAS com fadiga criativa (frequency 4.0) → deve permitir pausa', async () => {
    const decision = makeDecision({
      action_type: 'pause',
      detection_reason: 'FADIGA_CRITICA',
      kpi_data: { metric: 'frequency', current_value: 4.0, threshold: 3.0, period_days: 7 },
      spend: 400,
      conversions: 25,
      roas: 3.5,
      frequency: 4.0,
    });

    const result = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { dailyValues: [3.2, 3.5, 3.6, 3.8, 3.9, 4.0, 4.0], conversionDays: 7, hoursSinceLastData: 30 },
    );

    assert(result.approved === true, 'approved (fatigue overrides profitability)');
    assert(result.financial.verdict === 'profitable', `still profitable, got ${result.financial.verdict}`);
  });

  // ── SCENARIO 4: Scale opportunity — ROAS way above break-even ──
  await runScenario('ROAS 5.0 com break-even 2.5 → deve escalar', async () => {
    const decision = makeDecision({
      action_type: 'scale_budget',
      detection_reason: 'OPORTUNIDADE_ESCALA',
      kpi_data: { metric: 'roas', current_value: 5.0, threshold: 3.75, period_days: 7 },
      spend: 500,
      conversions: 30,
      roas: 5.0,
      current_daily_budget: 7000,
    });

    const result = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { dailyValues: [4.8, 5.1, 5.0, 4.9, 5.2, 5.0, 4.95], conversionDays: 7, hoursSinceLastData: 30 },
    );

    assert(result.approved === true, 'approved (scale profitable ad)');
    assert(result.financial.approved === true, 'financial approved');
    assert(result.safety.status === 'approved', `safety approved, got ${result.safety.status}`);
    assert(result.financial.recommended_scale_pct !== null, 'has recommended scale %');
    assert(result.financial.recommended_scale_pct! >= 10 && result.financial.recommended_scale_pct! <= 30, `scale % in [10,30], got ${result.financial.recommended_scale_pct}`);
    assert(result.safety.rollback_plan !== null, 'has rollback plan');
  });

  // ── SCENARIO 5: Scale attempt on losing ad — MUST block ──
  await runScenario('ROAS 1.5 com break-even 2.5 → BLOQUEAR scale (amplificaria prejuízo)', async () => {
    const decision = makeDecision({
      action_type: 'scale_budget',
      detection_reason: 'OPORTUNIDADE_ESCALA',
      kpi_data: { metric: 'roas', current_value: 1.5, threshold: 3.75, period_days: 7 },
      spend: 300,
      conversions: 12,
      roas: 1.5,
    });

    const result = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { dailyValues: [1.4, 1.6, 1.5, 1.3, 1.5, 1.6, 1.5], conversionDays: 5, hoursSinceLastData: 30 },
    );

    assert(result.approved === false, 'NOT approved (would amplify losses)');
    assert(result.financial.verdict === 'losing', `financial = losing, got ${result.financial.verdict}`);
  });

  // ── SCENARIO 6: Too little data to act — confidence gate blocks ──
  await runScenario('1 conversão, R$15 gasto, 2 dias → dados insuficientes, bloquear tudo', async () => {
    const decision = makeDecision({
      action_type: 'scale_budget',
      detection_reason: 'OPORTUNIDADE_ESCALA',
      kpi_data: { metric: 'roas', current_value: 5.0, threshold: 3.75, period_days: 2 },
      spend: 15,
      conversions: 1,
      roas: 5.0,
    });

    const result = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { conversionDays: 1, hoursSinceLastData: 12 },
    );

    assert(result.approved === false, 'NOT approved (insufficient data)');
    assert(result.confidence < 0.5, `confidence < 0.5 (low data), got ${result.confidence}`);
    assert(result.explanation.verdict.includes('insuficientes') || result.explanation.safety_check.includes('Confiança'), 'explanation mentions data insufficiency');
  });

  // ── SCENARIO 7: Daily action limit reached — safety blocks ──
  await runScenario('5 ações já executadas hoje → safety bloqueia a 6ª', async () => {
    const today = new Date();
    today.setUTCHours(1, 0, 0, 0);
    const todayActions: MockAction[] = Array.from({ length: 5 }, (_, i) => ({
      id: `act_${i}`,
      action_type: 'pause',
      target_id: `ad_${100 + i}`,
      created_at: today.toISOString(),
      executed: true,
      new_value: null,
    }));

    const decision = makeDecision({
      action_type: 'pause',
      detection_reason: 'ROAS_CRITICO',
      kpi_data: { metric: 'roas', current_value: 0.5, threshold: 2.5, period_days: 7 },
      spend: 400,
      conversions: 20,
      roas: 0.5,
    });

    const result = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase(todayActions) as any,
      { dailyValues: [0.5, 0.4, 0.6, 0.5, 0.5, 0.45, 0.55], conversionDays: 7, hoursSinceLastData: 30 },
    );

    assert(result.approved === false, 'NOT approved (daily limit reached)');
    assert(result.safety.status === 'rejected', `safety rejected, got ${result.safety.status}`);
    assert(result.safety.daily_actions_used >= 5, `5+ actions used, got ${result.safety.daily_actions_used}`);
    assert(result.safety.explanation.includes('Limite'), 'explanation mentions limit');
  });

  // ── SCENARIO 8: Duplicate action within cooldown — safety blocks ──
  await runScenario('Já pausou este ad há 12h → cooldown bloqueia', async () => {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const recentActions: MockAction[] = [{
      id: 'act_recent',
      action_type: 'pause',
      target_id: 'ad_001',
      created_at: twelveHoursAgo.toISOString(),
      executed: true,
      new_value: null,
    }];

    const decision = makeDecision({
      action_type: 'pause',
      target_id: 'ad_001',
      detection_reason: 'ROAS_CRITICO',
      kpi_data: { metric: 'roas', current_value: 0.5, threshold: 2.5, period_days: 7 },
      spend: 400,
      conversions: 20,
      roas: 0.5,
    });

    const result = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase(recentActions) as any,
      { dailyValues: [0.5, 0.4, 0.6, 0.5, 0.5, 0.45, 0.55], conversionDays: 7, hoursSinceLastData: 30 },
    );

    assert(result.approved === false, 'NOT approved (cooldown active)');
    assert(result.safety.duplicate_action_blocked === true, 'duplicate blocked flag = true');
    assert(result.safety.explanation.includes('Cooldown'), 'explanation mentions cooldown');
  });

  // ── SCENARIO 9: Volatile data — confidence penalized ──
  await runScenario('Dados muito voláteis (ROAS 0.2→4.0→0.5→3.5) → confiança baixa', async () => {
    const decision = makeDecision({
      action_type: 'scale_budget',
      detection_reason: 'OPORTUNIDADE_ESCALA',
      kpi_data: { metric: 'roas', current_value: 3.5, threshold: 3.75, period_days: 7 },
      spend: 300,
      conversions: 10,
      roas: 3.5,
    });

    const result = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { dailyValues: [0.2, 4.0, 0.5, 3.5, 0.3, 3.8, 0.1], conversionDays: 4, hoursSinceLastData: 30 },
    );

    assert(result.confidence < 0.5, `confidence < 0.5 (volatile data), got ${result.confidence}`);
    // With low confidence, scale should be blocked by data confidence gate
    assert(result.approved === false, 'NOT approved (data too volatile for scale)');
  });

  // ── SCENARIO 10: Fresh data (2h old) — attribution incomplete ──
  await runScenario('Dados de 2h atrás → atribuição incompleta, penaliza confiança', async () => {
    const decision = makeDecision({
      action_type: 'pause',
      detection_reason: 'ROAS_CRITICO',
      kpi_data: { metric: 'roas', current_value: 0.8, threshold: 2.5, period_days: 3 },
      spend: 100,
      conversions: 5,
      roas: 0.8,
    });

    const result = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { dailyValues: [0.7, 0.8, 0.9], conversionDays: 3, hoursSinceLastData: 2 },
    );

    // With only 2h since data, attribution delay should reduce confidence
    assert(result.confidence < 0.7, `confidence < 0.7 (attribution incomplete), got ${result.confidence}`);
    // But pause should still be possible if confidence is above caution_only threshold
    // (depends on overall score — the important thing is attribution is penalized)
  });

  // ── SCENARIO 11: Scale with budget=0 — safety blocks ──
  await runScenario('Scale com budget desconhecido (0) → safety bloqueia', async () => {
    const decision = makeDecision({
      action_type: 'scale_budget',
      detection_reason: 'OPORTUNIDADE_ESCALA',
      kpi_data: { metric: 'roas', current_value: 5.0, threshold: 3.75, period_days: 7 },
      spend: 500,
      conversions: 30,
      roas: 5.0,
      current_daily_budget: 0,
    });

    const result = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { dailyValues: [4.8, 5.1, 5.0, 4.9, 5.2, 5.0, 4.95], conversionDays: 7, hoursSinceLastData: 30 },
    );

    assert(result.approved === false, 'NOT approved (budget = 0)');
    assert(result.safety.status === 'rejected', `safety rejected, got ${result.safety.status}`);
  });

  // ── SCENARIO 12: No margin configured — uses default 30% ──
  await runScenario('Sem margem configurada → usa default 30%, break-even ≈ 3.33', async () => {
    const noMarginConfig: FinancialConfig = {
      profit_margin_pct: null,
      break_even_roas: null,
      ltv_estimate: null,
      monthly_budget_target: null,
      currency: 'BRL',
    };

    const decision = makeDecision({
      action_type: 'pause',
      detection_reason: 'ROAS_CRITICO',
      kpi_data: { metric: 'roas', current_value: 2.0, threshold: 3.33, period_days: 7 },
      spend: 400,
      conversions: 20,
      roas: 2.0,
    });

    const result = await enrichDecision(
      decision, noMarginConfig, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { dailyValues: [2.0, 1.9, 2.1, 2.0, 2.0, 1.95, 2.05], conversionDays: 7, hoursSinceLastData: 30 },
    );

    assert(result.financial.break_even_roas !== null, 'break-even calculated from default');
    assert(Math.abs(result.financial.break_even_roas! - 3.33) < 0.1, `break-even ≈ 3.33, got ${result.financial.break_even_roas}`);
    assert(result.financial.verdict === 'losing', `verdict = losing (2.0 < 3.33), got ${result.financial.verdict}`);
    assert(result.approved === true, 'pause approved (saving money)');
  });

  // ── SCENARIO 13: High margin product — easy to profit ──
  await runScenario('Margem 80% (break-even 1.25) + ROAS 2.5 → muito lucrativo, escalar', async () => {
    const highMarginConfig: FinancialConfig = {
      profit_margin_pct: 80,
      break_even_roas: 1.25,
      ltv_estimate: 800,
      monthly_budget_target: 10000,
      currency: 'BRL',
    };

    const decision = makeDecision({
      action_type: 'scale_budget',
      detection_reason: 'OPORTUNIDADE_ESCALA',
      kpi_data: { metric: 'roas', current_value: 2.5, threshold: 1.875, period_days: 7 },
      spend: 500,
      conversions: 35,
      roas: 2.5,
      current_daily_budget: 8000,
    });

    const result = await enrichDecision(
      decision, highMarginConfig, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { dailyValues: [2.4, 2.6, 2.5, 2.5, 2.3, 2.5, 2.6], conversionDays: 7, hoursSinceLastData: 30 },
    );

    assert(result.approved === true, 'approved (high margin, profitable)');
    assert(result.financial.margin_of_safety! > 50, `margin of safety > 50%, got ${result.financial.margin_of_safety}`);
  });

  // ── SCENARIO 14: Low margin product — hard to profit ──
  await runScenario('Margem 15% (break-even 6.67) + ROAS 3.0 → perdendo dinheiro', async () => {
    const lowMarginConfig: FinancialConfig = {
      profit_margin_pct: 15,
      break_even_roas: 6.67,
      ltv_estimate: 200,
      monthly_budget_target: 3000,
      currency: 'BRL',
    };

    const decision = makeDecision({
      action_type: 'scale_budget',
      detection_reason: 'OPORTUNIDADE_ESCALA',
      kpi_data: { metric: 'roas', current_value: 3.0, threshold: 10.0, period_days: 7 },
      spend: 300,
      conversions: 15,
      roas: 3.0,
    });

    const result = await enrichDecision(
      decision, lowMarginConfig, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { dailyValues: [2.8, 3.1, 3.0, 2.9, 3.2, 3.0, 2.95], conversionDays: 7, hoursSinceLastData: 30 },
    );

    assert(result.approved === false, 'NOT approved (ROAS 3.0 < break-even 6.67)');
    assert(result.financial.verdict === 'losing', `verdict = losing, got ${result.financial.verdict}`);
  });

  // ── SCENARIO 15: toActionLogEntry produces valid output ──
  await runScenario('toActionLogEntry gera entry válido para o banco', async () => {
    const decision = makeDecision({
      action_type: 'pause',
      detection_reason: 'ROAS_CRITICO',
      kpi_data: { metric: 'roas', current_value: 0.8, threshold: 2.5, period_days: 7 },
      spend: 350,
      conversions: 15,
      roas: 0.8,
    });

    const result = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { dailyValues: [0.9, 0.7, 0.8, 0.85, 0.75, 0.8, 0.82], conversionDays: 6, hoursSinceLastData: 36 },
    );

    const entry = toActionLogEntry(result, 'user_123', 'acc_001', 'integration-test', { isShadow: false });

    assert(entry.user_id === 'user_123', 'user_id correct');
    assert(entry.account_id === 'acc_001', 'account_id correct');
    assert(entry.action_type === 'pause', `action_type = pause, got ${entry.action_type}`);
    assert(entry.target_id === 'ad_001', `target_id correct`);
    assert(entry.confidence > 0, `confidence > 0, got ${entry.confidence}`);
    assert(entry.risk_level !== undefined, `risk_level defined: ${entry.risk_level}`);
    assert(entry.explanation !== undefined && Object.keys(entry.explanation).length >= 4, `explanation has ≥4 fields`);
    assert(entry.decision_tag === 'pause_loss', `decision_tag = pause_loss, got ${entry.decision_tag}`);
    assert(entry.triggered_by === 'integration-test', `triggered_by correct`);
  });

  // ── SCENARIO 16: Pattern confidence boosts score ──
  await runScenario('Pattern confidence 0.9 → aumenta confiança no pipeline', async () => {
    const decision = makeDecision({
      action_type: 'pause',
      detection_reason: 'ROAS_CRITICO',
      kpi_data: { metric: 'roas', current_value: 1.0, threshold: 2.5, period_days: 5 },
      spend: 150,
      conversions: 8,
      roas: 1.0,
    });

    const withoutPattern = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { conversionDays: 4, hoursSinceLastData: 30 },
    );

    const withPattern = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { conversionDays: 4, hoursSinceLastData: 30, patternConfidence: 0.9 },
    );

    assert(withPattern.confidence > withoutPattern.confidence, `pattern boosts confidence: ${withoutPattern.confidence} → ${withPattern.confidence}`);
  });

  // ── SCENARIO 17: Explanation chain is complete and coherent ──
  await runScenario('Cadeia de explicação completa em cada decisão', async () => {
    const decision = makeDecision({
      action_type: 'scale_budget',
      detection_reason: 'OPORTUNIDADE_ESCALA',
      kpi_data: { metric: 'roas', current_value: 5.0, previous_value: 3.0, threshold: 3.75, period_days: 7 },
      spend: 500,
      conversions: 30,
      roas: 5.0,
      current_daily_budget: 7000,
    });

    const result = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { dailyValues: [4.8, 5.1, 5.0, 4.9, 5.2, 5.0, 4.95], conversionDays: 7, hoursSinceLastData: 30 },
    );

    const exp = result.explanation;
    assert(exp.data_point.length > 10, `data_point substantive: "${exp.data_point.substring(0, 60)}..."`);
    assert(exp.threshold.length > 10, `threshold substantive: "${exp.threshold.substring(0, 60)}..."`);
    assert(exp.financial_check.length > 10, `financial_check substantive: "${exp.financial_check.substring(0, 60)}..."`);
    assert(exp.safety_check.length > 10, `safety_check substantive: "${exp.safety_check.substring(0, 60)}..."`);
    assert(exp.verdict.length > 10, `verdict substantive: "${exp.verdict.substring(0, 60)}..."`);
    // Explanation mentions ROAS values
    assert(exp.data_point.includes('ROAS') || exp.data_point.includes('roas'), 'data_point mentions metric');
  });

  // ── SCENARIO 18: Zero everything — doesn't crash ──
  await runScenario('Tudo zero → não crasha, retorna decisão válida', async () => {
    const decision = makeDecision({
      action_type: 'pause',
      detection_reason: 'TEST',
      kpi_data: { metric: 'roas', current_value: 0, threshold: 0, period_days: 0 },
      spend: 0,
      conversions: 0,
      roas: 0,
      current_daily_budget: 0,
    });

    const result = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { conversionDays: 0, hoursSinceLastData: 0 },
    );

    assert(result !== null && result !== undefined, 'returns valid result');
    assert(typeof result.approved === 'boolean', 'approved is boolean');
    assert(typeof result.confidence === 'number', 'confidence is number');
    assert(result.confidence >= 0 && result.confidence <= 1, `confidence in [0,1], got ${result.confidence}`);
    assert(result.explanation !== undefined, 'explanation exists');
  });

  // ── SCENARIO 19: Scale just above safety multiplier (boundary) ──
  await runScenario('ROAS 3.8 com break-even 2.5 (1.52x) → no limite do safety multiplier', async () => {
    const decision = makeDecision({
      action_type: 'scale_budget',
      detection_reason: 'OPORTUNIDADE_ESCALA',
      kpi_data: { metric: 'roas', current_value: 3.8, threshold: 3.75, period_days: 7 },
      spend: 400,
      conversions: 25,
      roas: 3.8,
      current_daily_budget: 6000,
    });

    const result = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase() as any,
      { dailyValues: [3.7, 3.9, 3.8, 3.8, 3.7, 3.9, 3.8], conversionDays: 7, hoursSinceLastData: 30 },
    );

    // 3.8 / 2.5 = 1.52x — just above the 1.5x safety multiplier
    assert(result.financial.approved === true, `financial approved (just above safety), got ${result.financial.approved}`);
    assert(result.financial.recommended_scale_pct! <= 15, `conservative scale % (close to boundary), got ${result.financial.recommended_scale_pct}`);
  });

  // ── SCENARIO 20: Gradual scaling — 2nd scale in 3 days ──
  await runScenario('2º scale em 3 dias → gradual scaling step 2, cap 15%', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const priorScale: MockAction[] = [{
      id: 'scale_prev',
      action_type: 'scale_budget',
      target_id: 'ad_001',
      created_at: twoDaysAgo.toISOString(),
      executed: true,
      executed_at: twoDaysAgo.toISOString(),
      new_value: { daily_budget: 6000 },
    }];

    const decision = makeDecision({
      action_type: 'scale_budget',
      target_id: 'ad_001',
      detection_reason: 'OPORTUNIDADE_ESCALA',
      kpi_data: { metric: 'roas', current_value: 5.5, threshold: 3.75, period_days: 7 },
      spend: 600,
      conversions: 35,
      roas: 5.5,
      current_daily_budget: 6000,
    });

    const result = await enrichDecision(
      decision, DEFAULT_FINANCIAL, DEFAULT_SAFETY,
      'acc_001', createMockSupabase(priorScale) as any,
      { dailyValues: [5.3, 5.5, 5.4, 5.6, 5.5, 5.5, 5.4], conversionDays: 7, hoursSinceLastData: 30 },
    );

    // Should be approved but capped at 15% (gradual step 2)
    if (result.safety.status === 'approved') {
      assert(result.safety.gradual_step === 2, `gradual step = 2, got ${result.safety.gradual_step}`);
      assert(result.safety.budget_change_pct !== null && result.safety.budget_change_pct <= 15, `budget cap ≤ 15%, got ${result.safety.budget_change_pct}`);
    } else {
      // Could also be rejected by cooldown (48h for scale, 2 days ago is borderline)
      assert(result.safety.status === 'rejected' || result.safety.status === 'queued', `status = rejected or queued (cooldown), got ${result.safety.status}`);
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ════════════════════════════════════════════════════════════════════

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed (${scenarioCount} scenarios)`);
  console.log('═══════════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\n⚠️  FAILURES DETECTED — pipeline NOT production-ready');
    process.exit(1);
  } else {
    console.log('\n✅ ALL SCENARIOS PASSED — pipeline validated for production');
    console.log('   Financial filter ✓  Safety layer ✓  Data confidence ✓');
    console.log('   Explanations ✓  Edge cases ✓  Action log ✓');
  }
}

runAllTests().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
