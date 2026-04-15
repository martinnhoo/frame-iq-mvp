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

const STORAGE_KEY = 'adbrief_scan_step';
const STORAGE_TS_KEY = 'adbrief_scan_ts';

/** Recover persisted step so navigation doesn't reset progress */
function getPersistedStep(): number {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    const ts = sessionStorage.getItem(STORAGE_TS_KEY);
    if (!saved || !ts) return 1;
    // If more than 5 min old, reset
    if (Date.now() - Number(ts) > 5 * 60 * 1000) {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_TS_KEY);
      return 1;
    }
    return Math.max(1, Math.min(Number(saved), STEPS.length));
  } catch {
    return 1;
  }
}

function persistStep(step: number) {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(step));
    sessionStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
  } catch { /* noop */ }
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  totalAds, nextSyncMinutes, todaySummary, connected, adsSynced = 0,
}) => {
  const navigate = useNavigate();
  const hasActivity = todaySummary.paused > 0 || todaySummary.scaled > 0;
  const hasSaved = todaySummary.savedToday > 0;
  const [step, setStepRaw] = useState(() => getPersistedStep());

  const setStep = (s: number) => {
    setStepRaw(s);
    persistStep(s);
  };

  // Auto-advance steps — completes ALL 4 steps, never gets stuck
  useEffect(() => {
    if (!connected || hasActivity || hasSaved) return;
    const current = getPersistedStep();
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Schedule remaining steps from wherever we left off
    const delays = [0, 4000, 9000, 15000]; // step 1=immediate, 2=4s, 3=9s, 4=15s
    for (let i = current + 1; i <= STEPS.length; i++) {
      const delay = Math.max(0, delays[i - 1]! - delays[current - 1]!);
      timers.push(setTimeout(() => setStep(i), delay));
    }

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
  const allDone = step >= STEPS.length;
  const progress = allDone ? 100 : Math.min((step / STEPS.length) * 100, 90);

  // ── All done → show two-block entry state instead of dead-end ──
  if (allDone) {
    return (
      <div style={{ fontFamily: F }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{
            fontSize: 18, fontWeight: 700, color: '#fff',
            margin: '0 0 6px', letterSpacing: '-0.02em',
          }}>
            Pronto para começar
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: 0, lineHeight: 1.5 }}>
            Escolha por onde quer iniciar
          </p>
        </div>

        {/* Two-block grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
        }}>
          {/* Block 1 — Secondary: Começar pelos criativos */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '28px 24px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(139,92,246,0.08)',
              border: '1px solid rgba(139,92,246,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>
              💬
            </div>
            <div>
              <h3 style={{
                fontSize: 15, fontWeight: 700, color: '#fff',
                margin: '0 0 6px', letterSpacing: '-0.01em',
              }}>
                Começar pelos criativos
              </h3>
              <p style={{
                fontSize: 12.5, color: 'rgba(255,255,255,0.35)',
                margin: 0, lineHeight: 1.5,
              }}>
                Explore ideias iniciais de anúncios antes de rodar campanhas
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard/ai')}
              style={{
                background: 'transparent',
                color: 'rgba(255,255,255,0.60)',
                border: '1px solid rgba(255,255,255,0.12)',
                padding: '9px 20px', borderRadius: 8,
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: F,
                marginTop: 'auto',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.60)';
              }}
            >
              Falar com a IA
            </button>
          </div>

          {/* Block 2 — Primary: Analisar campanhas */}
          <div style={{
            background: 'rgba(14,165,233,0.04)',
            border: '1px solid rgba(14,165,233,0.12)',
            borderRadius: 12,
            padding: '28px 24px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(14,165,233,0.08)',
              border: '1px solid rgba(14,165,233,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>
              📡
            </div>
            <div>
              <h3 style={{
                fontSize: 15, fontWeight: 700, color: '#fff',
                margin: '0 0 6px', letterSpacing: '-0.01em',
              }}>
                Analisar campanhas
              </h3>
              <p style={{
                fontSize: 12.5, color: 'rgba(255,255,255,0.35)',
                margin: 0, lineHeight: 1.5,
              }}>
                Conecte sua conta e identifique perdas e oportunidades
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard/accounts')}
              style={{
                background: '#0ea5e9',
                color: '#fff',
                border: 'none',
                padding: '9px 20px', borderRadius: 8,
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: F,
                marginTop: 'auto',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#0d94d1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#0ea5e9';
              }}
            >
              Conectar Meta Ads
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Still scanning — progress bar + steps ──
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
          transition: 'all 0.5s ease',
        }}>
          {/* Radar — clean SVG approach */}
          <svg width="28" height="28" viewBox="0 0 28 28" style={{ animation: 'es-radar-rotate 2.5s linear infinite' }}>
            <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(14,165,233,0.15)" strokeWidth="1.5"/>
            <circle cx="14" cy="14" r="7" fill="none" stroke="rgba(14,165,233,0.08)" strokeWidth="1"/>
            <circle cx="14" cy="14" r="2.5" fill="#0ea5e9"/>
            {/* Sweep wedge */}
            <path
              d="M14 14 L14 2 A12 12 0 0 1 24.39 8.0 Z"
              fill="rgba(14,165,233,0.25)"
            />
            <line x1="14" y1="14" x2="14" y2="2" stroke="rgba(14,165,233,0.5)" strokeWidth="1"/>
          </svg>
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

              {/* Check mark */}
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
        Isso leva menos de um minuto.
      </p>

      <style>{`
        @keyframes es-radar-rotate {
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
