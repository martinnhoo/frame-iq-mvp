/**
 * DataSourceFooter — single source of truth for the "where this number
 * comes from" footnote that appears below customer-facing money KPIs.
 *
 * Why this exists: the product talks about money (R$X gasto, ROAS Yx)
 * everywhere, and customers ask "is this number exact?". Adding a
 * tiny, consistent footer below money cards turns "we might be wrong"
 * into a visible feature: we tell you exactly what the number is and
 * isn't, before you ask.
 *
 * Three signals get surfaced (in priority order):
 *   1. Source — "Meta Ads API" (always shown)
 *   2. Attribution window — "7d click + 1d view" (Meta default; always
 *      shown so users don't think we picked it)
 *   3. Conversion lag — "podem crescer ~20% em 72h" (only when the
 *      visible period.to falls within the last 3 days, since that's
 *      when delayed purchases still trickle in)
 *
 * The link to /metodologia gives users a single place to dig deeper.
 */
import { Link } from "react-router-dom";

interface Props {
  /** ISO date (YYYY-MM-DD) of the period end. When within last 3 days,
   *  the conversion-lag notice appears. Pass undefined to suppress lag. */
  periodTo?: string | null;
  /** Override Meta default attribution display (rare — use when account
   *  has been switched to a custom window). */
  attribution?: string;
  /** Compact mode strips the link and shrinks padding for tight contexts
   *  (per-card footers vs. section footers). */
  compact?: boolean;
  /** Override the language. Defaults to pt. */
  lang?: "pt" | "en" | "es";
  /** Optional className for layout overrides. */
  className?: string;
}

const COPY = {
  pt: {
    source: "Fonte: Meta Ads API",
    attribution: (a: string) => `atribuição ${a}`,
    lag: "conversões dos últimos 3 dias podem crescer ~20% em 72h",
    method: "como calculamos",
    sep: " · ",
  },
  en: {
    source: "Source: Meta Ads API",
    attribution: (a: string) => `attribution ${a}`,
    lag: "conversions from the last 3 days can grow ~20% in 72h",
    method: "how we calculate",
    sep: " · ",
  },
  es: {
    source: "Fuente: Meta Ads API",
    attribution: (a: string) => `atribución ${a}`,
    lag: "las conversiones de los últimos 3 días pueden crecer ~20% en 72h",
    method: "cómo calculamos",
    sep: " · ",
  },
} as const;

/** Returns true when periodTo falls within the last 3 days (lag window).
 *  Returns false on null/undefined/invalid input — no lag note shown. */
function isConversionLagPeriod(periodTo: string | null | undefined): boolean {
  if (!periodTo || typeof periodTo !== "string") return false;
  const t = new Date(periodTo);
  if (Number.isNaN(t.getTime())) return false;
  const ageMs = Date.now() - t.getTime();
  // 3 days in ms; values <= 0 (today/future) also count as lag.
  return ageMs < 3 * 86400 * 1000;
}

export function DataSourceFooter({
  periodTo,
  attribution = "7d click + 1d view",
  compact = false,
  lang = "pt",
  className,
}: Props) {
  const t = COPY[lang] || COPY.pt;
  const showLag = isConversionLagPeriod(periodTo);

  const parts: string[] = [
    t.source,
    t.attribution(attribution),
  ];
  if (showLag) parts.push(t.lag);

  return (
    <p
      className={className}
      style={{
        margin: compact ? "4px 0 0" : "8px 0 0",
        fontSize: 10,
        lineHeight: 1.45,
        color: "rgba(240,246,252,0.38)",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        letterSpacing: "0.01em",
        // Allow wrap on narrow screens — better than overflow with ellipsis,
        // since the user wants to read the whole disclaimer.
        whiteSpace: "normal",
        // Keep the footer visually anchored to the data above it; never
        // floats up into a section's title area.
        display: "block",
      }}
    >
      {parts.join(t.sep)}
      {!compact && (
        <>
          {t.sep}
          <Link
            to="/metodologia"
            target="_blank"
            rel="noopener"
            style={{
              color: "rgba(56,189,248,0.65)",
              textDecoration: "none",
              borderBottom: "1px dotted rgba(56,189,248,0.30)",
            }}
          >
            {t.method}
          </Link>
        </>
      )}
    </p>
  );
}

export default DataSourceFooter;
