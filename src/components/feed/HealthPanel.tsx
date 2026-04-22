/**
 * HealthPanel — instrumented account-health cockpit.
 *
 * Each tile is a mini KPI card:
 *   [● LABEL]
 *   BIG VALUE          ← headline number or status word
 *   detail context     ← secondary muted line
 *
 * Traffic-light dot encodes severity (green / yellow / red / grey unknown).
 * Default state is EXPANDED — this is the account's vitals, users should see
 * them at a glance. localStorage still honors a manual collapse, but first-run
 * always opens. Critical signals auto-expand regardless.
 *
 * All numbers arrive pre-formatted from FeedPage; no new fetches here.
 */
import React from 'react';

type Severity = 'ok' | 'warn' | 'error' | 'unknown';

export interface HealthSignal {
  key: string;
  label: string;
  status: Severity;
  /** Headline value — a number ("R$ 112", "2") or a short word ("Parou", "Instalado"). */
  value?: string;
  /** Muted secondary line underneath. */
  detail: string;
  onClick?: () => void;
}

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";
const STORAGE_KEY = 'feed:health-panel:expanded';

const sevColor: Record<Severity, string> = {
  ok: '#22C55E',
  warn: '#FBBF24',
  error: '#EF4444',
  unknown: 'rgba(255,255,255,0.30)',
};
const sevGlow: Record<Severity, string> = {
  ok: 'rgba(34,197,94,0.45)',
  warn: 'rgba(251,191,36,0.55)',
  error: 'rgba(239,68,68,0.60)',
  unknown: 'transparent',
};
// Subtle tint on the tile border depending on severity — keeps the cockpit
// readable without going full neon.
const sevBorder: Record<Severity, string> = {
  ok: 'rgba(34,197,94,0.18)',
  warn: 'rgba(251,191,36,0.22)',
  error: 'rgba(239,68,68,0.28)',
  unknown: 'rgba(255,255,255,0.06)',
};
const sevValueColor: Record<Severity, string> = {
  ok: 'rgba(255,255,255,0.95)',
  warn: 'rgba(255,255,255,0.95)',
  error: '#FCA5A5',
  unknown: 'rgba(255,255,255,0.55)',
};

function worstOf(signals: HealthSignal[]): Severity {
  if (signals.some((s) => s.status === 'error')) return 'error';
  if (signals.some((s) => s.status === 'warn')) return 'warn';
  if (signals.every((s) => s.status === 'unknown')) return 'unknown';
  return 'ok';
}

function labelFor(s: Severity): string {
  switch (s) {
    case 'ok': return 'Tudo certo';
    case 'warn': return 'Atenção';
    case 'error': return 'Ação necessária';
    default: return 'Sem dados';
  }
}

function summarize(signals: HealthSignal[]): string {
  if (!signals.length) return 'Sem sinais';
  const counts = { ok: 0, warn: 0, error: 0, unknown: 0 };
  for (const s of signals) counts[s.status]++;

  const parts: string[] = [];
  if (counts.error) parts.push(`${counts.error} crítico${counts.error === 1 ? '' : 's'}`);
  if (counts.warn) parts.push(`${counts.warn} alerta${counts.warn === 1 ? '' : 's'}`);
  if (counts.ok) parts.push(`${counts.ok} OK`);
  if (counts.unknown && !counts.error && !counts.warn) {
    parts.push(`${counts.unknown} sem dados`);
  }

  const headline =
    signals.find((s) => s.status === 'error') ||
    signals.find((s) => s.status === 'warn');

  if (headline) {
    return `${parts.join(' · ')} — ${headline.label}: ${headline.detail}`;
  }
  return parts.join(' · ');
}

/**
 * Single cockpit tile. Clicking triggers the signal's onClick (if any).
 * The whole tile is the hit target — no separate "open" affordance.
 */
const HealthTile: React.FC<{ sig: HealthSignal }> = ({ sig }) => {
  const clickable = !!sig.onClick;
  const valueText = sig.value || '—';
  return (
    <button
      type="button"
      onClick={sig.onClick}
      disabled={!clickable}
      aria-label={`${sig.label}: ${valueText} — ${sig.detail}`}
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'stretch', justifyContent: 'flex-start',
        gap: 6, textAlign: 'left',
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${sevBorder[sig.status]}`,
        borderRadius: 9,
        padding: '12px 14px',
        fontFamily: F,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'background 0.14s ease, border-color 0.14s ease, transform 0.12s ease',
        minWidth: 0,
        minHeight: 92,
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!clickable) return;
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
        e.currentTarget.style.borderColor = sig.status === 'unknown'
          ? 'rgba(255,255,255,0.14)'
          : sevColor[sig.status].replace(/0\.\d+/, '0.35');
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
        e.currentTarget.style.borderColor = sevBorder[sig.status];
      }}
    >
      {/* top strip: dot + label (+ hover arrow) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <span
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: sevColor[sig.status],
            boxShadow: `0 0 7px ${sevGlow[sig.status]}`,
            flexShrink: 0,
            animation: sig.status === 'error' ? 'health-pulse 1.4s ease-in-out infinite' : 'none',
          }}
        />
        <span style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          flex: 1, minWidth: 0,
        }}>
          {sig.label}
        </span>
        {clickable && (
          <span
            className="health-tile-arrow"
            aria-hidden
            style={{
              fontSize: 11, color: 'rgba(255,255,255,0.32)',
              opacity: 0, transition: 'opacity 0.14s ease',
              marginLeft: 4, flexShrink: 0,
            }}
          >
            ↗
          </span>
        )}
      </div>

      {/* big value */}
      <div
        style={{
          fontSize: 'clamp(18px, 3.2vw, 22px)',
          fontWeight: 700,
          color: sevValueColor[sig.status],
          letterSpacing: '-0.01em',
          lineHeight: 1.15,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {valueText}
      </div>

      {/* detail */}
      <div style={{
        fontSize: 10.5,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.50)',
        lineHeight: 1.35,
        marginTop: 'auto',
      }}>
        {sig.detail}
      </div>
    </button>
  );
};

export const HealthPanel: React.FC<{
  signals: HealthSignal[];
  lastCheckedMin?: number;
}> = ({ signals, lastCheckedMin }) => {
  const overall = worstOf(signals);
  const overallColor = sevColor[overall];

  // Default expanded: cockpit needs to read at a glance. localStorage still
  // persists a manual collapse so users who prefer it compact keep that.
  const [expanded, setExpanded] = React.useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === '0') return false;
      if (stored === '1') return true;
      return true;
    } catch {
      return true;
    }
  });

  // Auto-expand when something becomes critical, so errors aren't hidden.
  const prevOverall = React.useRef<Severity>(overall);
  React.useEffect(() => {
    if (prevOverall.current !== 'error' && overall === 'error') {
      setExpanded(true);
    }
    prevOverall.current = overall;
  }, [overall]);

  const toggle = React.useCallback(() => {
    setExpanded((v) => {
      const next = !v;
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  }, []);

  const summary = summarize(signals);

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(13,17,23,1) 0%, rgba(10,13,18,1) 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: `3px solid ${overallColor}`,
        borderRadius: 12,
        padding: 'clamp(12px, 2.4vw, 16px) clamp(14px, 2.6vw, 18px)',
        marginBottom: 12,
        fontFamily: F,
        animation: 'feed-fadeUp 0.3s ease',
      }}
    >
      {/* Header row — always visible, clickable to toggle */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls="health-panel-body"
        style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 8,
          width: '100%', background: 'transparent',
          border: 'none', padding: 0, margin: 0,
          cursor: 'pointer', fontFamily: F, color: 'inherit',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
          <span
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: overallColor,
              boxShadow: `0 0 10px ${sevGlow[overall]}`,
              flexShrink: 0,
              animation: overall === 'error' ? 'health-pulse 1.4s ease-in-out infinite' : 'none',
            }}
          />
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)',
            flexShrink: 0,
          }}>
            Saúde da conta
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: overall === 'ok' ? '#22C55E'
                 : overall === 'warn' ? '#FBBF24'
                 : overall === 'error' ? '#EF4444'
                 : 'rgba(255,255,255,0.40)',
            letterSpacing: '0.01em',
            flexShrink: 0,
          }}>
            · {labelFor(overall)}
          </span>

          {/* Inline summary — only when collapsed */}
          {!expanded && (
            <span
              className="health-summary-text"
              style={{
                fontSize: 10.5, fontWeight: 500,
                color: 'rgba(255,255,255,0.50)',
                marginLeft: 6, minWidth: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                flex: 1,
              }}
              title={summary}
            >
              · {summary}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {typeof lastCheckedMin === 'number' && (
            <span style={{
              fontSize: 9.5, color: 'rgba(255,255,255,0.38)',
              whiteSpace: 'nowrap', fontWeight: 500,
            }}>
              atualizado {lastCheckedMin < 1 ? 'agora' : `há ${Math.round(lastCheckedMin)} min`}
            </span>
          )}
          <span
            aria-hidden
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: 4,
              color: 'rgba(255,255,255,0.55)',
              transition: 'transform 0.18s ease, color 0.12s',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              fontSize: 12, lineHeight: 1,
            }}
          >
            ▾
          </span>
        </div>
      </button>

      {/* Expanded body — cockpit tile grid */}
      {expanded && (
        <div
          id="health-panel-body"
          className="health-signal-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 10,
            marginTop: 12,
          }}
        >
          {signals.map((sig) => (
            <HealthTile key={sig.key} sig={sig} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes health-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.85); }
        }
        @media (hover: hover) {
          .health-signal-grid button:hover .health-tile-arrow {
            opacity: 1 !important;
          }
        }
        @media (max-width: 480px) {
          .health-signal-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .health-summary-text {
            font-size: 10px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default HealthPanel;
