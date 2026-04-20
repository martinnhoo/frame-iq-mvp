/**
 * HealthPanel — always-visible account health snapshot.
 *
 * A compact traffic-light panel shown at the top of the feed whenever the
 * user has Meta connected. Green = tudo certo, yellow = atenção, red =
 * ação urgente. Each row is clickable; click opens the relevant detail.
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

export const HealthPanel: React.FC<{
  signals: HealthSignal[];
  lastCheckedMin?: number;
}> = ({ signals, lastCheckedMin }) => {
  const overall = worstOf(signals);
  const overallColor = sevColor[overall];

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
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
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
          }}>
            · {labelFor(overall)}
          </span>
        </div>
        {typeof lastCheckedMin === 'number' && (
          <span style={{
            fontSize: 9.5, color: 'rgba(255,255,255,0.38)',
            whiteSpace: 'nowrap', fontWeight: 500,
          }}>
            atualizado {lastCheckedMin < 1 ? 'agora' : `${Math.round(lastCheckedMin)}min`}
          </span>
        )}
      </div>

      {/* Signal grid */}
      <div
        className="health-signal-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 8,
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

      <style>{`
        @keyframes health-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.85); }
        }
        @media (max-width: 480px) {
          .health-signal-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default HealthPanel;
