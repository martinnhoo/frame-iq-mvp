/**
 * RoasDisplay — colored ROAS rendering against the user's break-even line.
 *
 * Why this exists: showing "ROAS 2.5x" with no context lets the user
 * think it's good. But if their profit margin is 30%, break-even ROAS
 * is ~3.3x — the ad is actually destroying margin. This component
 * fixes that visceral gap by:
 *
 *   1. Coloring the number (red below break-even, green above).
 *   2. Showing the break-even line as a small chip next to it.
 *   3. Falling back to neutral display when no margin is configured.
 *
 * Use this anywhere a customer sees a ROAS number with stakes.
 */
import { breakEvenRoas, formatRatio } from "@/lib/money";

interface Props {
  /** The ad/campaign/account ROAS multiple (e.g. 4.5 for 4.5x). null
   *  when no spend or no revenue tracked — renders as the placeholder. */
  roas: number | null | undefined;
  /** User's profit margin in percent (1-100). When null/undefined,
   *  coloring is disabled and the number renders neutral (white). */
  profitMarginPct?: number | null;
  /** Show the small "break-even Xx" chip next to the ROAS. Defaults to
   *  true. Pass false in dense displays where the chip is redundant. */
  showBreakEven?: boolean;
  /** Decimal places for the ROAS number. Defaults to 1 for compact
   *  displays (4.5x), pass 2 for higher precision contexts (4.52x). */
  decimals?: number;
  /** Font size for the main number. Chip auto-scales relative to this. */
  fontSize?: number;
  /** Bold weight (700-900). Defaults to 800 — KPI cards usually want strong. */
  fontWeight?: number;
  /** Override the placeholder when ROAS is null. Defaults to "—". */
  placeholder?: string;
  /** className for the wrapping span (layout overrides). */
  className?: string;
}

const RED = "#EF4444";
const GREEN = "#22A3A3";
const NEUTRAL = "#F1F5F9";
const CHIP_DIM = "rgba(240,246,252,0.42)";

export function RoasDisplay({
  roas,
  profitMarginPct,
  showBreakEven = true,
  decimals = 1,
  fontSize = 18,
  fontWeight = 800,
  placeholder = "—",
  className,
}: Props) {
  const breakEven = breakEvenRoas(profitMarginPct);
  const hasRoas = typeof roas === "number" && Number.isFinite(roas) && roas > 0;
  const canColor = hasRoas && breakEven != null;

  // Color rule: ≥ break-even is GREEN (margin healthy), strictly below
  // is RED (destroying margin). We use a 5% tolerance band around the
  // line so jitter near break-even doesn't flip colors every poll.
  let color = NEUTRAL;
  if (canColor && hasRoas) {
    if (roas! >= breakEven! * 0.95) color = GREEN;
    else color = RED;
  }

  const value = hasRoas ? `${(roas as number).toFixed(decimals)}x` : placeholder;

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          fontSize,
          fontWeight,
          color,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums" as React.CSSProperties["fontVariantNumeric"],
        }}
      >
        {value}
      </span>
      {showBreakEven && breakEven != null && (
        <span
          title={`Break-even calculado a partir da sua margem de ${profitMarginPct}%`}
          style={{
            fontSize: Math.max(9, Math.round(fontSize * 0.55)),
            fontWeight: 600,
            color: CHIP_DIM,
            letterSpacing: 0.02,
            // Chip is intentionally muted — informational, not a CTA.
            // No box / border so the eye stays on the number itself.
            lineHeight: 1,
          }}
        >
          break-even {formatRatio(breakEven, { decimals: 1, suffix: "x", placeholder })}
        </span>
      )}
    </span>
  );
}

export default RoasDisplay;
