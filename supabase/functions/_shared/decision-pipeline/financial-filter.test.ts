/**
 * Financial Filter — Unit Tests
 *
 * Tests the core financial logic that determines whether to approve/block
 * decisions based on margin, break-even ROAS, and LTV.
 *
 * Edge cases tested:
 * - Missing margin data (defaults)
 * - Zero/negative values
 * - Break-even boundary conditions
 * - LTV-adjusted CPA
 * - Scale % calculation at different ROAS levels
 * - Profitable ad getting paused (creative fatigue)
 */

import { evaluateFinancial } from './financial-filter.ts';
import type { RawDecision, FinancialConfig } from './types.ts';

// ── Test helpers ──

function makeDecision(overrides: Partial<RawDecision> = {}): RawDecision {
  return {
    action_type: 'pause',
    target_id: 'ad_123',
    target_type: 'ad',
    target_name: 'Test Ad',
    detection_reason: 'ROAS_CRITICO',
    urgency: 'high',
    kpi_data: {
      metric: 'roas',
      current_value: 0.5,
      threshold: 0.8,
      period_days: 3,
    },
    spend: 100,
    conversions: 2,
    roas: 0.5,
    ctr: 0.02,
    frequency: 2.0,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<FinancialConfig> = {}): FinancialConfig {
  return {
    profit_margin_pct: 40,
    break_even_roas: 2.5,   // 1 / 0.4
    ltv_estimate: null,
    monthly_budget_target: null,
    currency: 'BRL',
    ...overrides,
  };
}

// ── Tests ──

console.log('=== Financial Filter Unit Tests ===\n');
let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ── 1. PAUSE: losing money ──
console.log('1. Pause — losing money (ROAS < break-even)');
{
  const result = evaluateFinancial(
    makeDecision({ roas: 0.5, spend: 100 }),
    makeConfig({ profit_margin_pct: 40, break_even_roas: 2.5 }),
  );
  assert(result.verdict === 'losing', 'verdict = losing');
  assert(result.approved === true, 'approved = true (pause saves money)');
  assert(result.break_even_roas === 2.5, 'break_even_roas = 2.5');
  assert(result.explanation.includes('break-even'), 'explanation mentions break-even');
}

// ── 2. PAUSE: profitable ad with creative fatigue ──
console.log('\n2. Pause — profitable ad with creative fatigue');
{
  const result = evaluateFinancial(
    makeDecision({
      roas: 3.5,
      frequency: 5.0,
      detection_reason: 'FADIGA_CRITICA',
      kpi_data: { metric: 'frequency', current_value: 5.0, threshold: 4.0, period_days: 3 },
    }),
    makeConfig(),
  );
  assert(result.verdict === 'profitable', 'verdict = profitable');
  assert(result.approved === true, 'approved = true (fatigue override)');
  assert(result.explanation.includes('fadiga'), 'explanation mentions fadiga');
}

// ── 3. PAUSE: profitable ad WITHOUT strong reason → blocked ──
console.log('\n3. Pause — profitable ad without strong reason');
{
  const result = evaluateFinancial(
    makeDecision({
      roas: 3.5,
      detection_reason: 'SOME_MILD_REASON',
      kpi_data: { metric: 'ctr', current_value: 0.01, threshold: 0.006, period_days: 3 },
    }),
    makeConfig(),
  );
  assert(result.verdict === 'profitable', 'verdict = profitable');
  assert(result.approved === false, 'approved = false (no strong reason to pause profitable)');
  assert(result.explanation.includes('lucrativo'), 'explanation says lucrativo');
}

// ── 4. SCALE: well above break-even → approved with calculated % ──
console.log('\n4. Scale — ROAS well above break-even');
{
  const result = evaluateFinancial(
    makeDecision({ action_type: 'scale_budget', roas: 5.0, spend: 200 }),
    makeConfig({ profit_margin_pct: 40, break_even_roas: 2.5 }),
  );
  assert(result.verdict === 'profitable', 'verdict = profitable');
  assert(result.approved === true, 'approved = true');
  assert(result.recommended_scale_pct !== null, 'has recommended_scale_pct');
  assert(result.recommended_scale_pct! >= 10 && result.recommended_scale_pct! <= 30, `scale_pct in [10,30]: got ${result.recommended_scale_pct}`);
}

// ── 5. SCALE: just above break-even but below safety multiplier → blocked ──
console.log('\n5. Scale — ROAS just above break-even (below safety)');
{
  const result = evaluateFinancial(
    makeDecision({ action_type: 'scale_budget', roas: 3.0, spend: 100 }),
    makeConfig({ profit_margin_pct: 40, break_even_roas: 2.5 }),
  );
  // Safety multiplier is 1.5x, so needs ROAS > 2.5 * 1.5 = 3.75
  assert(result.approved === false, 'approved = false (below safety multiplier)');
  assert(result.explanation.includes('margem de segurança'), 'explanation mentions safety margin');
}

// ── 6. SCALE: losing money → blocked ──
console.log('\n6. Scale — ROAS below break-even');
{
  const result = evaluateFinancial(
    makeDecision({ action_type: 'scale_budget', roas: 1.0, spend: 150 }),
    makeConfig({ profit_margin_pct: 40, break_even_roas: 2.5 }),
  );
  assert(result.verdict === 'losing', 'verdict = losing');
  assert(result.approved === false, 'approved = false');
  assert(result.explanation.includes('amplificar a perda'), 'explanation warns about amplifying loss');
}

// ── 7. Missing margin data → uses defaults ──
console.log('\n7. Missing margin data — defaults to 30%');
{
  const result = evaluateFinancial(
    makeDecision({ roas: 2.0, spend: 100 }),
    makeConfig({ profit_margin_pct: null, break_even_roas: null }),
  );
  // Default margin 30% → break-even = 1/0.3 ≈ 3.33
  assert(result.break_even_roas !== null, 'calculated break_even from default');
  assert(Math.abs(result.break_even_roas! - 3.33) < 0.1, `break_even ≈ 3.33, got ${result.break_even_roas}`);
  assert(result.verdict === 'losing', 'verdict = losing (2.0 < 3.33)');
}

// ── 8. Low spend → insufficient data ──
console.log('\n8. Low spend — insufficient data');
{
  const result = evaluateFinancial(
    makeDecision({ spend: 5, roas: 0.3 }),
    makeConfig(),
  );
  assert(result.verdict === 'unknown', 'verdict = unknown');
  assert(result.approved === true, 'approved = true (pause allowed as precaution)');
  assert(result.explanation.includes('insuficiente'), 'explanation mentions insufficient');
}

// ── 9. Low spend + scale → blocked ──
console.log('\n9. Low spend — scale blocked');
{
  const result = evaluateFinancial(
    makeDecision({ action_type: 'scale_budget', spend: 5, roas: 5.0 }),
    makeConfig(),
  );
  assert(result.verdict === 'unknown', 'verdict = unknown');
  assert(result.approved === false, 'approved = false (can\'t scale on insufficient data)');
}

// ── 10. LTV-adjusted CPA limit ──
console.log('\n10. LTV-adjusted CPA limit');
{
  const result = evaluateFinancial(
    makeDecision({ spend: 100 }),
    makeConfig({ ltv_estimate: 500 }),
  );
  assert(result.ltv_adjusted_cpa_limit === 150, `LTV CPA limit = 500 * 0.3 = 150, got ${result.ltv_adjusted_cpa_limit}`);
}

// ── 11. Break-even edge: exactly at boundary ──
console.log('\n11. Break-even boundary (within 5% tolerance)');
{
  const result = evaluateFinancial(
    makeDecision({ roas: 2.45, spend: 100 }),
    makeConfig({ profit_margin_pct: 40, break_even_roas: 2.5 }),
  );
  // 2.45 is within 5% of 2.5 (2.5 * 0.95 = 2.375), so not "losing"
  assert(result.verdict === 'break_even', `verdict = break_even (2.45 ≈ 2.5), got ${result.verdict}`);
}

// ── 12. Scale % calculation at different ROAS levels ──
console.log('\n12. Scale % varies by ROAS distance from break-even');
{
  // ROAS 4.0 vs break-even 2.5 → ratio 1.6 → moderate scale
  const r1 = evaluateFinancial(
    makeDecision({ action_type: 'scale_budget', roas: 4.0, spend: 200 }),
    makeConfig({ profit_margin_pct: 40, break_even_roas: 2.5 }),
  );
  // ROAS 8.0 vs break-even 2.5 → ratio 3.2 → aggressive scale
  const r2 = evaluateFinancial(
    makeDecision({ action_type: 'scale_budget', roas: 8.0, spend: 200 }),
    makeConfig({ profit_margin_pct: 40, break_even_roas: 2.5 }),
  );

  if (r1.recommended_scale_pct && r2.recommended_scale_pct) {
    assert(r2.recommended_scale_pct > r1.recommended_scale_pct, `higher ROAS → higher scale % (${r1.recommended_scale_pct}% < ${r2.recommended_scale_pct}%)`);
    assert(r2.recommended_scale_pct <= 30, `max scale capped at 30%, got ${r2.recommended_scale_pct}%`);
  } else {
    assert(false, 'both should have recommended_scale_pct');
  }
}

// ── 13. High margin product (80%) → low break-even ──
console.log('\n13. High margin product (80%) → break-even ROAS = 1.25');
{
  const result = evaluateFinancial(
    makeDecision({ action_type: 'scale_budget', roas: 2.5, spend: 200 }),
    makeConfig({ profit_margin_pct: 80, break_even_roas: 1.25 }),
  );
  // ROAS 2.5 is well above break-even 1.25 (ratio 2.0) → should approve
  assert(result.approved === true, 'approved = true (high margin, easy to profit)');
  assert(result.margin_of_safety! > 80, `margin of safety > 80%, got ${result.margin_of_safety}%`);
}

// ── 14. Low margin product (15%) → high break-even ──
console.log('\n14. Low margin product (15%) → break-even ROAS ≈ 6.67');
{
  const result = evaluateFinancial(
    makeDecision({ action_type: 'scale_budget', roas: 5.0, spend: 200 }),
    makeConfig({ profit_margin_pct: 15, break_even_roas: 6.67 }),
  );
  // ROAS 5.0 is BELOW break-even 6.67 → losing money
  assert(result.verdict === 'losing', 'verdict = losing (low margin needs high ROAS)');
  assert(result.approved === false, 'approved = false');
}

// ── Summary ──
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  console.log('FAILURES DETECTED — review before enabling pipeline.');
} else {
  console.log('ALL TESTS PASSED — financial filter logic is sound.');
}
