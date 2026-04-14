import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatMoney } from '../../lib/format';

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'DM Mono', 'JetBrains Mono', monospace";

interface TodaySummary {
  paused: number;
  scaled: number;
  savedToday: number;
  revenueToday: number;
}

interface EmptyStateProps {
  totalAds: number;
  nextSyncMinutes: number;
  todaySummary: TodaySummary;
  connected?: boolean;
  adsSynced?: number;
}

const STEPS = [
  'Conta conectada',
  'Sincronizando anúncios',
  'Calculando baselines',
  'Gerando decisões',
];

export const EmptyState: React.FC<EmptyStateProps> = ({
  totalAds, nextSyncMinutes, todaySummary, connected, adsSynced = 0,
}) => {
  const navigate = useNavigate();
  const hasActivity = todaySummary.paused > 0 || todaySummary.scaled > 0;
  const hasSaved = todaySummary.savedToday > 0;
  const [step, setStep] = useState(1); // starts at step 1 (conta conectada = done)

  // Auto-advance steps for first-scan feel (timed, not stuck)
  useEffect(() => {
    if (!connected || hasActivity || hasSaved) return;
    const timers = [
      setTimeout(() => setStep(2), 4000),
      setTimeout(() => setStep(3), 9000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [connected, hasActivity, hasSaved]);

  // ── Not connected ──
  if (!connected) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, padding: '48px 32px',
        textAlign: 'center', fontFamily: F,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'rgba(13,162,231,0.08)',
          border: '1px solid rgba(13,162,231,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 22,
        }}>
          📡
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          Conecte uma conta Meta Ads
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '0 0 16px', lineHeight: 1.5 }}>
          O Copilot vai analisar seus anúncios e gerar decisões automaticamente.
        </p>
        <button
          onClick={() => navigate('/dashboard/accounts')}
          style={{
            background: '#0ea5e9', color: '#fff', border: 'none',
            padding: '10px 24px', borderRadius: 8, fontSize: 13,
            fontWeight: 600, cursor: 'pointer', fontFamily: F,
          }}
        >
          Conectar conta
        </button>
      </div>
    );
  }

  // ── Connected, returning user with activity today ──
  if (hasActivity || hasSaved) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, padding: '40px 32px',
        textAlign: 'center', fontFamily: F,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'rgba(16,185,129,0.06)',
          border: '1px solid rgba(16,185,129,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: '#34d399',
            boxShadow: '0 0 8px rgba(52,211,153,0.4)',
            animation: 'es-pulse 2s ease-in-out infinite',
          }} />
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Tudo sob controle
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
          Nenhuma ação necessária agora
        </p>

        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 10, padding: '16px 20px', textAlign: 'left',
          maxWidth: 420, margin: '24px auto 0',
        }}>
          <h3 style={{
            fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.30)',
            textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px',
          }}>
            Resultado do dia
          </h3>
          {hasSaved && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: hasActivity ? 12 : 0 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#34d399', fontFamily: M, letterSpacing: '-0.02em' }}>
                {formatMoney(todaySummary.savedToday)}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>economizado hoje</span>
            </div>
          )}
          {hasActivity && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {todaySummary.paused > 0 && (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>
                  {todaySummary.paused} pausado{todaySummary.paused !== 1 ? 's' : ''}
                </span>
              )}
              {todaySummary.scaled > 0 && (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>
                  {todaySummary.scaled} escalado{todaySummary.scaled !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        <style>{`@keyframes es-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}`}</style>
      </div>
    );
  }

  // ── Connected, first scan — progress bar + steps ──
  const progress = Math.min((step / STEPS.length) * 100, 95);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, padding: '36px 32px',
      fontFamily: F,
    }}>
      {/* Header with scanning animation */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'rgba(14,165,233,0.06)',
          border: '1px solid rgba(14,165,233,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', position: 'relative',
        }}>
          {/* Radar sweep animation */}
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '2px solid rgba(14,165,233,0.15)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              width: '50%', height: '50%',
              background: 'conic-gradient(from 0deg, transparent 0deg, rgba(14,165,233,0.5) 60deg, transparent 60deg)',
              transformOrigin: '0 0',
              animation: 'es-radar 2s linear infinite',
            }} />
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              width: 4, height: 4, borderRadius: '50%',
              background: '#0ea5e9', transform: 'translate(-50%, -50%)',
            }} />
          </div>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Analisando sua conta
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: 0, lineHeight: 1.5 }}>
          Processando dados para gerar as primeiras decisões
        </p>
      </div>

      {/* Progress bar */}
      <div style={{
        maxWidth: 380, margin: '0 auto 24px',
        height: 3, borderRadius: 2,
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: '#0ea5e9',
          width: `${progress}%`,
          transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>

      {/* Steps — linear, all visible, progressive highlight */}
      <div style={{
        maxWidth: 380, margin: '0 auto',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {STEPS.map((label, i) => {
          const isDone = i < step;
          const isActive = i === step;
          const isPending = i > step;

          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 16px',
              borderRadius: 8,
              background: isActive ? 'rgba(14,165,233,0.06)' : 'transparent',
              transition: 'all 0.4s ease',
            }}>
              {/* Step indicator */}
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDone
                  ? 'rgba(16,185,129,0.15)'
                  : isActive
                    ? 'rgba(14,165,233,0.15)'
                    : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${
                  isDone ? '#10b981' : isActive ? '#0ea5e9' : 'rgba(255,255,255,0.08)'
                }`,
                transition: 'all 0.4s ease',
              }}>
                {isDone ? (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : isActive ? (
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#0ea5e9',
                    animation: 'es-blink 1.2s ease-in-out infinite',
                  }} />
                ) : (
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.20)' }}>
                    {i + 1}
                  </span>
                )}
              </div>

              {/* Label */}
              <span style={{
                fontSize: 13, fontFamily: F,
                fontWeight: isDone || isActive ? 500 : 400,
                color: isDone
                  ? 'rgba(255,255,255,0.50)'
                  : isActive
                    ? '#fff'
                    : 'rgba(255,255,255,0.25)',
                transition: 'color 0.3s ease',
              }}>
                {label}
              </span>

              {/* Connector line */}
              {isDone && (
                <span style={{
                  marginLeft: 'auto', fontSize: 10, fontWeight: 500,
                  color: '#10b981', opacity: 0.7,
                }}>
                  ✓
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Tip */}
      <p style={{
        textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.20)',
        margin: '24px 0 0', lineHeight: 1.5,
      }}>
        Pode levar alguns minutos. Você pode navegar normalmente.
      </p>

      <style>{`
        @keyframes es-radar {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes es-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};
