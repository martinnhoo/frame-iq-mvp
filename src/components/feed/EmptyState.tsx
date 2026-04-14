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
  /** When true, Meta is connected — show first-scan / monitoring state */
  connected?: boolean;
  /** Total ads synced so far (from activeAccount) */
  adsSynced?: number;
}

// ── Step item for first-scan progress ──
function StepItem({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 0',
      opacity: done ? 0.5 : active ? 1 : 0.35,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: done
          ? 'rgba(16,185,129,0.15)'
          : active
            ? 'rgba(14,165,233,0.12)'
            : 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${done ? '#10b981' : active ? '#0ea5e9' : 'rgba(255,255,255,0.08)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {done ? (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : active ? (
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            border: '1.5px solid #0ea5e9', borderTopColor: 'transparent',
            animation: 'spin-step 0.8s linear infinite',
          }} />
        ) : (
          <div style={{
            width: 4, height: 4, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
          }} />
        )}
      </div>
      <span style={{
        fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: F,
        color: done ? 'rgba(255,255,255,0.40)' : active ? '#fff' : 'rgba(255,255,255,0.30)',
      }}>
        {label}
      </span>
    </div>
  );
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  totalAds, nextSyncMinutes, todaySummary, connected, adsSynced = 0,
}) => {
  const navigate = useNavigate();
  const hasActivity = todaySummary.paused > 0 || todaySummary.scaled > 0;
  const hasSaved = todaySummary.savedToday > 0;
  const [dots, setDots] = useState('');
  const [elapsed, setElapsed] = useState(0);

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 600);
    return () => clearInterval(interval);
  }, []);

  // Elapsed timer for first scan feel
  useEffect(() => {
    if (!connected) return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [connected]);

  // ── Not connected — nudge to connect ──
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
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#0284c7'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#0ea5e9'; }}
        >
          Conectar conta
        </button>
      </div>
    );
  }

  // ── Connected, has activity from today (returning user, all clear) ──
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
            animation: 'pulse-dot 2s ease-in-out infinite',
          }} />
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Tudo sob controle
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '0 0 4px' }}>
          Nenhuma ação necessária agora. Monitorando{dots}
        </p>

        {/* Today's outcome summary */}
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
              <span style={{
                fontSize: 20, fontWeight: 800, color: '#34d399',
                fontFamily: M, letterSpacing: '-0.02em',
              }}>
                {formatMoney(todaySummary.savedToday)}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                economizado hoje
              </span>
            </div>
          )}

          {hasActivity && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {todaySummary.paused > 0 && (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>
                  {todaySummary.paused} anúncio{todaySummary.paused !== 1 ? 's' : ''} pausado{todaySummary.paused !== 1 ? 's' : ''}
                </span>
              )}
              {todaySummary.scaled > 0 && (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>
                  {todaySummary.scaled} anúncio{todaySummary.scaled !== 1 ? 's' : ''} escalado{todaySummary.scaled !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        <style>{`
          @keyframes pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.85); }
          }
        `}</style>
      </div>
    );
  }

  // ── Connected, first time / no decisions yet — show first-scan progress ──
  // Simulate steps based on whether ads have been synced
  const stepsDone = adsSynced > 0 ? 2 : elapsed > 3 ? 1 : 0;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, padding: '36px 32px',
      fontFamily: F,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'rgba(14,165,233,0.08)',
          border: '1px solid rgba(14,165,233,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <div style={{
            width: 20, height: 20,
            border: '2px solid rgba(14,165,233,0.3)',
            borderTopColor: '#0ea5e9',
            borderRadius: '50%',
            animation: 'spin-step 0.9s linear infinite',
          }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Analisando sua conta{dots}
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: 0, lineHeight: 1.5 }}>
          O Copilot está processando seus dados para gerar as primeiras decisões.
        </p>
      </div>

      {/* Progress steps */}
      <div style={{
        maxWidth: 360, margin: '0 auto',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 10, padding: '8px 20px',
      }}>
        <StepItem label="Conta conectada" done={true} active={false} />
        <StepItem label="Sincronizando anúncios e métricas" done={stepsDone >= 1} active={stepsDone === 0} />
        <StepItem label="Calculando baselines de performance" done={stepsDone >= 2} active={stepsDone === 1} />
        <StepItem label="Gerando decisões inteligentes" done={false} active={stepsDone >= 2} />
      </div>

      {/* Subtle tip */}
      <p style={{
        textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.20)',
        margin: '20px 0 0', lineHeight: 1.5,
      }}>
        A primeira análise pode levar alguns minutos.
        <br />
        Você pode navegar — avisamos quando estiver pronto.
      </p>

      <style>{`
        @keyframes spin-step {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
