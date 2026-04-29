/**
 * money.ts — single source of truth for ratio + currency helpers (Deno).
 *
 * Mirror of src/lib/money.ts on the frontend. Keep them in sync —
 * any addition here should also land on the client side.
 *
 * Whenever a new edge function does ratio math on financial fields,
 * import safeRatio() / formatRatio() / centsToReais() instead of
 * doing `a / b` directly. This is what prevents "Infinity%" or "NaNx"
 * from leaking into customer-visible output.
 */

/** Divide num by denom, returning null when denom <= 0 / NaN / non-finite. */
export function safeRatio(
  num: number | null | undefined,
  denom: number | null | undefined,
): number | null {
  const n = typeof num === "number" ? num : NaN;
  const d = typeof denom === "number" ? denom : NaN;
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return n / d;
}

/** Format a ratio for display. Returns placeholder ("—") for null/NaN. */
export function formatRatio(
  v: number | null | undefined,
  opts: { decimals?: number; suffix?: string; asPercent?: boolean; placeholder?: string } = {},
): string {
  const { decimals = 2, suffix = "", asPercent = false, placeholder = "—" } = opts;
  if (typeof v !== "number" || !Number.isFinite(v)) return placeholder;
  const display = asPercent ? v * 100 : v;
  return `${display.toFixed(decimals)}${suffix}`;
}

/** Format money in centavos for display ("R$123,45"). */
export function formatMoneyCents(
  cents: number | null | undefined,
  opts: { symbol?: string; decimals?: number; placeholder?: string; locale?: string } = {},
): string {
  const { symbol = "R$", decimals = 2, placeholder = "—", locale = "pt-BR" } = opts;
  if (typeof cents !== "number" || !Number.isFinite(cents)) return `${symbol}${placeholder}`;
  const reais = cents / 100;
  return `${symbol}${reais.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** Convert centavos → reais as a number, or null on invalid input. */
export function centsToReais(cents: number | null | undefined): number | null {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return null;
  return cents / 100;
}

/** Convert reais → centavos as a rounded integer, or null on invalid input. */
export function reaisToCents(reais: number | null | undefined): number | null {
  if (typeof reais !== "number" || !Number.isFinite(reais)) return null;
  return Math.round(reais * 100);
}

/**
 * Break-even ROAS from profit margin %. Margin 30% → 3.33x.
 * Returns null when margin is invalid (<=0 or >100).
 */
export function breakEvenRoas(profitMarginPct: number | null | undefined): number | null {
  if (typeof profitMarginPct !== "number" || !Number.isFinite(profitMarginPct)) return null;
  if (profitMarginPct <= 0 || profitMarginPct > 100) return null;
  return 100 / profitMarginPct;
}
