import React, { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../../lib/format';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

interface MoneyBarProps {
  leaking: number;
  capturable: number;
  totalSaved: number;
  urgentCount?: number; // #13: how many decisions need action
  onStopLosses?: () => void;
  onResolve?: () => void;
}

export const MoneyBar: React.FC<MoneyBarProps> = ({ leaking, capturable, totalSaved, urgentCount = 0, onStopLosses, onResolve }) => {
  const [displayedSaved, setDisplayedSaved] = useState(totalSaved);
  const prevSavedRef = useRef(totalSaved);
  const animationFrameRef = useRef<number | null>(null);

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
      {/* Primary: loss alert */}
      {hasLoss && (
        <div style={{
          background: 'rgba(180,35,42,0.08)',
          border: '1px solid rgba(180,35,42,0.15)',
          borderLeft: '3px solid #B4232A',
          borderRadius: 3, padding: '10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{
                fontSize: 28, fontWeight: 700, color: '#E6EDF3',
                fontFamily: F, letterSpacing: '-0.04em', lineHeight: 1,
              }}>
                {formatMoney(leaking)}
              </span>
              <span style={{
                fontSize: 14, fontWeight: 600, color: '#8B949E',
                fontFamily: F, letterSpacing: '-0.02em',
              }}>
                /dia
              </span>
            </div>
            <div style={{
              fontSize: 11, fontWeight: 500, color: 'rgba(139,148,158,0.70)',
              marginTop: 3,
            }}>
              perda potencial identificada
            </div>
            {/* #13: Action direction */}
            {urgentCount > 0 && (
              <div style={{
                fontSize: 10.5, fontWeight: 600, color: 'rgba(214,59,59,0.70)',
                marginTop: 4,
              }}>
                {urgentCount} {urgentCount === 1 ? 'decisão pode' : 'decisões podem'} reduzir perdas imediatamente
              </div>
            )}
          </div>
          {onStopLosses && (
            <button onClick={onStopLosses} style={{
              background: '#B4232A', color: '#fff', border: 'none',
              borderRadius: 3, padding: '8px 16px',
              fontSize: 12, fontWeight: 700, fontFamily: F,
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'background 0.1s',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#8A1D22'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#B4232A'; }}>
              Resolver agora
            </button>
          )}
        </div>
      )}

      {/* Metrics row — only when there are actual losses/savings */}
      {hasLoss && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
        }}>
          <div style={{
            background: '#0F141A',
            border: '1px solid rgba(230,237,243,0.04)',
            borderRadius: 3, padding: '10px 12px',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600, color: '#8B949E',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5,
              opacity: 0.6,
            }}>
              Possível recuperação
            </div>
            <div style={{
              fontSize: 22, fontWeight: 700, color: '#E6EDF3',
              fontFamily: F, letterSpacing: '-0.04em', lineHeight: 1,
            }}>
              +{formatMoney(capturable)}
            </div>
          </div>
          <div style={{
            background: '#0F141A',
            border: '1px solid rgba(230,237,243,0.04)',
            borderRadius: 3, padding: '10px 12px',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600, color: '#8B949E',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5,
              opacity: 0.6,
            }}>
              Economizado
            </div>
            <div style={{
              fontSize: 22, fontWeight: 700, color: '#E6EDF3',
              fontFamily: F, letterSpacing: '-0.04em', lineHeight: 1,
            }}>
              {formatMoney(displayedSaved)}
            </div>
          </div>
        </div>
      )}

      {/* No loss — single clean status line, no R$0 grid */}
      {!hasLoss && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#E6EDF3' }}>
              Sem perdas detectadas
            </span>
            <span style={{ fontSize: 11, color: 'rgba(139,148,158,0.45)' }}>
              · Foco atual: crescimento
            </span>
          </div>
          {onResolve && (
            <button onClick={onResolve} style={{
              background: 'none', color: 'rgba(139,148,158,0.50)', border: 'none',
              fontSize: 10.5, fontWeight: 600, fontFamily: F,
              cursor: 'pointer', padding: 0, transition: 'color 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B949E'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(139,148,158,0.50)'; }}>
              Criar com IA →
            </button>
          )}
        </div>
      )}
    </div>
  );
};
