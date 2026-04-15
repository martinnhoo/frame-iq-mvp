import React, { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../../lib/format';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

interface MoneyBarProps {
  leaking: number;
  capturable: number;
  totalSaved: number;
  urgentCount?: number;
  onStopLosses?: () => void;
  onResolve?: () => void;
}

export const MoneyBar: React.FC<MoneyBarProps> = ({ leaking, capturable, totalSaved, urgentCount = 0, onStopLosses, onResolve }) => {
  const [displayedSaved, setDisplayedSaved] = useState(totalSaved);
  const prevSavedRef = useRef(totalSaved);
  const animationFrameRef = useRef<number | null>(null);
  const [btnHov, setBtnHov] = useState(false);

  useEffect(() => {
    const start = prevSavedRef.current;
    const end = totalSaved;
    const dur = 800;
    const t0 = Date.now();
    if (start === end) return;
    const tick = () => {
      const p = Math.min((Date.now() - t0) / dur, 1);
      setDisplayedSaved(Math.floor(start + (end - start) * p));
      if (p < 1) animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [totalSaved]);
  useEffect(() => { prevSavedRef.current = totalSaved; }, [totalSaved]);

  const hasLoss = leaking > 0;

  return (
    <div style={{ fontFamily: F }}>
      {hasLoss ? (
        <>
          {/* ── HERO BLOCK: Loss alert ── */}
          <div style={{
            background: '#0C1017',
            border: '1px solid rgba(180,35,42,0.12)',
            borderRadius: 6,
            padding: '20px 22px',
            marginBottom: 8,
            position: 'relative',
            overflow: 'hidden',
            animation: 'mb-fadeIn 0.4s ease both',
          }}>
            {/* Subtle red glow at top */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: 'linear-gradient(90deg, transparent, rgba(180,35,42,0.40), transparent)',
            }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                {/* Micro label */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  marginBottom: 10,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#B4232A',
                    boxShadow: '0 0 8px rgba(180,35,42,0.50)',
                    animation: 'mb-pulse 2s ease-in-out infinite',
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#EF4444',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>
                    Perda ativa
                  </span>
                </div>

                {/* HERO NUMBER */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{
                    fontSize: 36, fontWeight: 800, color: '#fff',
                    fontFamily: F, letterSpacing: '-0.04em', lineHeight: 1,
                  }}>
                    {formatMoney(leaking)}
                  </span>
                  <span style={{
                    fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.45)',
                    fontFamily: F, letterSpacing: '-0.02em',
                  }}>
                    /dia
                  </span>
                </div>

                {/* Urgent count */}
                {urgentCount > 0 && (
                  <div style={{
                    fontSize: 11.5, fontWeight: 600, color: '#F87171',
                    marginTop: 8,
                  }}>
                    {urgentCount} {urgentCount === 1 ? 'decisão pode' : 'decisões podem'} reduzir perdas agora
                  </div>
                )}
              </div>

              {/* CTA */}
              {onStopLosses && (
                <button
                  onClick={onStopLosses}
                  onMouseEnter={() => setBtnHov(true)}
                  onMouseLeave={() => setBtnHov(false)}
                  style={{
                    background: btnHov ? '#9A1E23' : '#B4232A',
                    color: '#fff', border: 'none',
                    borderRadius: 4, padding: '12px 24px',
                    fontSize: 13, fontWeight: 700, fontFamily: F,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    transform: btnHov ? 'translateY(-1px) scale(1.02)' : 'none',
                    boxShadow: btnHov ? '0 4px 12px rgba(180,35,42,0.30)' : 'none',
                    letterSpacing: '-0.01em',
                    flexShrink: 0, marginTop: 8,
                  }}
                >
                  Resolver agora
                </button>
              )}
            </div>
          </div>

          {/* ── SECONDARY METRICS ── */}
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{
              flex: 1, background: '#0C1017',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 4, padding: '12px 14px',
              transition: 'border-color 0.15s',
            }}>
              <div style={{
                fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.40)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
              }}>
                Recuperável
              </div>
              <div style={{
                fontSize: 20, fontWeight: 700, color: '#38BDF8',
                fontFamily: F, letterSpacing: '-0.03em', lineHeight: 1,
              }}>
                +{formatMoney(capturable)}
              </div>
            </div>
            <div style={{
              flex: 1, background: '#0C1017',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 4, padding: '12px 14px',
              transition: 'border-color 0.15s',
            }}>
              <div style={{
                fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.40)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
              }}>
                Economizado
              </div>
              <div style={{
                fontSize: 20, fontWeight: 700, color: '#4ADE80',
                fontFamily: F, letterSpacing: '-0.03em', lineHeight: 1,
              }}>
                {formatMoney(displayedSaved)}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* No loss — clean status */
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#4ADE80',
              boxShadow: '0 0 8px rgba(74,222,128,0.40)',
            }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#F0F6FC' }}>
              Sem perdas detectadas
            </span>
            <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.40)' }}>
              Foco: crescimento
            </span>
          </div>
          {onResolve && (
            <button onClick={onResolve} style={{
              background: 'none', color: '#38BDF8', border: 'none',
              fontSize: 11.5, fontWeight: 600, fontFamily: F,
              cursor: 'pointer', padding: 0, transition: 'color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#7DD3FC'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#38BDF8'; }}>
              Criar com IA →
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes mb-pulse{0%,100%{opacity:1;box-shadow:0 0 8px rgba(180,35,42,0.50)}50%{opacity:.6;box-shadow:0 0 4px rgba(180,35,42,0.25)}}
        @keyframes mb-fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
};
