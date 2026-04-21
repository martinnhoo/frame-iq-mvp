/**
 * HealthPanel — always-visible account health snapshot.
 *
 * A compact traffic-light panel shown at the top of the feed whenever the
 * user has Meta connected. Green = tudo certo, yellow = atenção, red =
 * ação urgente. Each row is clickable; click opens the relevant detail.
 *
 * Collapsible: starts closed by default and shows a single-line summary.
 * State persists in localStorage key `feed:health-panel:expanded`.
 *
 * Inputs are all state we already compute in FeedPage — no new fetches.
 * Unknown signals (e.g. learning phase, hard spend cap) are shown as a
 * grey dot + "Sem dados" until we wire them up.
 */
import React from 'react';

type Severity = 'ok' | 'warn' | 'error' | 'unknown';

export interface HealthSignal {
  key: string;
  label: string;
  status: Severity;
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

/**
 * Short summary string: how many OK / warnings / errors, plus a
 * tiny hint about the first signal that's non-OK so the user knows
 * at a glance what to look at without expanding.
 */
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

  // Highlight the first non-OK signal so the user knows *what* to look at
  const headline =
    signals.find((s) => s.status === 'error') ||
    signals.find((s) => s.status === 'warn');

  if (headline) {
    return `${parts.join(' · ')} — ${headline.label}: ${headline.detail}`;
  }
  return parts.join(' · ');
}

export const HealthPanel: React.FC<{
  signals: HealthSignal[];
  lastCheckedMin?: number;
}> = ({ signals, lastCheckedMin }) => {
  const overall = worstOf(signals);
  const overallColor = sevColor[overall];

  const [expanded, setExpanded] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Auto-expand when something becomes critical, so errors aren't hidden.
  // Only fires on transition into 'error' — respects user's preference otherwise.
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
        background: '#0D1117',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: `3px solid ${overallColor}`,
        borderRadius: 10,
        padding: 'clamp(10px, 2.4vw, 14px) clamp(12px, 2.6vw, 16px)',
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'pointer',
          fontFamily: F,
          color: 'inherit',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
          <span
            style={{
              width: 7, height: 7, borderRadius: '50%',
              background: overallColor,
              boxShadow: `0 0 8px ${sevGlow[overall]}`,
              flexShrink: 0,
              animation: overall === 'error' ? 'health-pulse 1.4s ease-in-out infinite' : 'none',
            }}
          />
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)',
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
                fontSize: 10.5,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.50)',
                marginLeft: 6,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
              }}
              title={summary}
            >
              · {summary}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18, height: 18,
              borderRadius: 4,
              color: 'rgba(255,255,255,0.55)',
              transition: 'transform 0.18s ease, color 0.12s',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            ▾
          </span>
        </div>
      </button>

      {/* Expanded body — signal grid */}
      {expanded && (
        <div
          id="health-panel-body"
          className="health-signal-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 8,
            marginTop: 10,
          }}
        >
          {signals.map((sig) => (
            <button
              key={sig.key}
              onClick={sig.onClick}
              disabled={!sig.onClick}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: 'rgba(255,255,255,0.015)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 7,
                padding: '8px 10px',
                fontFamily: F,
                textAlign: 'left',
                cursor: sig.onClick ? 'pointer' : 'default',
                transition: 'background 0.12s, border-color 0.12s',
                minWidth: 0,
              }}
              onMouseEnter={(e) => {
                if (!sig.onClick) return;
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
              }}
            >
              <span
                style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: sevColor[sig.status],
                  boxShadow: `0 0 6px ${sevGlow[sig.status]}`,
                  marginTop: 4, flexShrink: 0,
                  animation: sig.status === 'error' ? 'health-pulse 1.4s ease-in-out infinite' : 'none',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.88)',
                  letterSpacing: '0.01em', marginBottom: 1,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {sig.label}
                </div>
                <div style={{
                  fontSize: 10.5, color: 'rgba(255,255,255,0.48)',
                  fontWeight: 500, lineHeight: 1.35,
                }}>
                  {sig.detail}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes health-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.85); }
        }
        @media (max-width: 480px) {
          .health-signal-grid {
            grid-template-columns: 1fr !important;
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
