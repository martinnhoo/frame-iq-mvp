/**
 * money.ts — single source of truth for ratio + currency helpers.
 *
 * The whole product talks about money. When calculations spread out across
 * 30+ files, it's easy for one person to write `revenue / spend` without
 * a guard, and once a single ad has spend=0 with conversions, the user
 * sees `Infinity%` ROAS and trust is gone.
 *
 * Use these helpers for ANY new code that does ratio math on financial
 * fields. Existing code that already has explicit `> 0` guards is fine —
 * don't refactor for refactor's sake.
 */

/**
 * Divide two numbers, returning null when the denominator is <= 0,
 * NaN, or not a finite number. Same behavior whether the numerator is
 * undefined/NaN/Infinity. Use anywhere you'd write `a / b` for a metric
 * that might be undefined.
 *
 * Examples:
 *   safeRatio(100, 4)    // 25
 *   safeRatio(100, 0)    // null
 *   safeRatio(0, 4)      // 0  — zero numerator with positive denom is a real value
 *   safeRatio(100, NaN)  // null
 *   safeRatio(NaN, 4)    // null
 *   safeRatio(undefined, 4)  // null  — TS won't allow this but runtime guards it
 */
export function safeRatio(num: number | null | undefined, denom: number | null | undefined): number | null {
  const n = typeof num === 'number' ? num : NaN;
  const d = typeof denom === 'number' ? denom : NaN;
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return n / d;
}

/**
 * Spend-weighted average of a per-ad ratio metric. Use this only when
 * you genuinely cannot compute sum-then-divide because the underlying
 * components (clicks/impressions for CTR, etc.) aren't available.
 *
 * For metrics where you DO have the components (CTR from
 * clicks+impressions; CPA from spend+conversions; CPC from spend+clicks),
 * compute sum/sum directly — that's the only mathematically correct way.
 *
 * Examples:
 *   weightedAvg([{value: 0.01, weight: 100}, {value: 0.05, weight: 1}])
 *     // ≈ 0.0104  — the high-weight ad dominates
 *   weightedAvg([{value: 0.01, weight: 100}, {value: 0.05, weight: 1}], 'simple')
 *     // 0.03  — wrong number that treats both ads equally
 */
export function weightedAvg(
  items: Array<{ value: number | null | undefined; weight: number | null | undefined }>,
  mode: 'weighted' | 'simple' = 'weighted',
): number | null {
  const valid = items.filter(i => typeof i.value === 'number' && Number.isFinite(i.value));
  if (valid.length === 0) return null;
  if (mode === 'simple') {
    return valid.reduce((s, i) => s + (i.value as number), 0) / valid.length;
  }
  let weightedSum = 0;
  let totalWeight = 0;
  for (const i of valid) {
    const w = typeof i.weight === 'number' && Number.isFinite(i.weight) && i.weight > 0 ? i.weight : 0;
    weightedSum += (i.value as number) * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

/**
 * Format a ratio for display. Returns the suffix (e.g. "—") when the
 * value is null, NaN, or non-finite. Use everywhere a number reaches
 * the UI to prevent "NaNx" or "Infinity%" rendering.
 *
 * Examples:
 *   formatRatio(4.523, { decimals: 2, suffix: 'x' })   // "4.52x"
 *   formatRatio(null,  { decimals: 2, suffix: 'x' })   // "—"
 *   formatRatio(NaN,   { decimals: 2, suffix: 'x' })   // "—"
 *   formatRatio(0.025, { decimals: 2, suffix: '%', asPercent: true })  // "2.50%"
 */
export function formatRatio(
  v: number | null | undefined,
  opts: { decimals?: number; suffix?: string; asPercent?: boolean; placeholder?: string } = {},
): string {
  const { decimals = 2, suffix = '', asPercent = false, placeholder = '—' } = opts;
  if (typeof v !== 'number' || !Number.isFinite(v)) return placeholder;
  const display = asPercent ? v * 100 : v;
  return `${display.toFixed(decimals)}${suffix}`;
}

/**
 * Format money in centavos for display. Always returns a string with the
 * provided currency symbol prefix (defaults to "R$").
 *
 * The product stores money in centavos for precision. Anywhere we display
 * it, we have to divide by 100 — and that's where bugs happen. Use this.
 *
 * Examples:
 *   formatMoneyCents(12345)            // "R$123,45"
 *   formatMoneyCents(12345, { decimals: 0 })  // "R$123"
 *   formatMoneyCents(null)             // "R$—"
 *   formatMoneyCents(0)                // "R$0,00"
 */
export function formatMoneyCents(
  cents: number | null | undefined,
  opts: { symbol?: string; decimals?: number; placeholder?: string; locale?: string } = {},
): string {
  const { symbol = 'R$', decimals = 2, placeholder = '—', locale = 'pt-BR' } = opts;
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return `${symbol}${placeholder}`;
  const reais = cents / 100;
  return `${symbol}${reais.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Convert centavos → reais as a number. Use when you need the value for
 * further math (not display). Returns null when input is invalid.
 */
export function centsToReais(cents: number | null | undefined): number | null {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return null;
  return cents / 100;
}

/**
 * Convert reais → centavos as an integer. Use at the boundary where the
 * UI (which works in reais) hands a value to the storage layer (which
 * works in centavos). Always rounds to avoid floating-point drift.
 */
export function reaisToCents(reais: number | null | undefined): number | null {
  if (typeof reais !== 'number' || !Number.isFinite(reais)) return null;
  return Math.round(reais * 100);
}

/**
 * Compute break-even ROAS from a profit margin percentage.
 * If a user's margin is 30%, every R$1 of revenue keeps R$0.30 — so
 * the campaign needs ROAS >= 1/0.30 ≈ 3.33x just to NOT lose money.
 * Use this anywhere you compare a campaign's ROAS to "is it making the
 * customer money?".
 *
 * Examples:
 *   breakEvenRoas(30)   // 3.333...
 *   breakEvenRoas(50)   // 2
 *   breakEvenRoas(100)  // 1     — selling at zero margin, break-even = 1x
 *   breakEvenRoas(0)    // null  — can't be break-even at 0% margin
 *   breakEvenRoas(null) // null
 */
export function breakEvenRoas(profitMarginPct: number | null | undefined): number | null {
  if (typeof profitMarginPct !== 'number' || !Number.isFinite(profitMarginPct)) return null;
  if (profitMarginPct <= 0 || profitMarginPct > 100) return null;
  return 100 / profitMarginPct;
}
