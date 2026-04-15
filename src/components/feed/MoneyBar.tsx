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
          background: 'rgba(197,48,48,0.06)',
          border: '1px solid rgba(197,48,48,0.12)',
          borderLeft: '3px solid #c53030',
          borderRadius: 4, padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{
                fontSize: 28, fontWeight: 700, color: '#fff',
                fontFamily: F, letterSpacing: '-0.04em', lineHeight: 1,
              }}>
                {formatMoney(leaking)}
              </span>
              <span style={{
                fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.40)',
                fontFamily: F, letterSpacing: '-0.02em',
              }}>
                /dia
              </span>
            </div>
            <div style={{
              fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.28)',
              marginTop: 3,
            }}>
              perda potencial identificada
            </div>
            {/* #13: Action direction */}
            {urgentCount > 0 && (
              <div style={{
                fontSize: 10.5, fontWeight: 600, color: 'rgba(229,62,62,0.65)',
                marginTop: 4,
              }}>
                {urgentCount} decisão{urgentCount !== 1 ? 'ões' : ''} urgente{urgentCount !== 1 ? 's' : ''} requer{urgentCount === 1 ? '' : 'em'} ação
              </div>
            )}
          </div>
          {onStopLosses && (
            <button onClick={onStopLosses} style={{
              background: '#c53030', color: '#fff', border: 'none',
              borderRadius: 4, padding: '9px 18px',
              fontSize: 12, fontWeight: 700, fontFamily: F,
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'background 0.1s',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#9b2c2c'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#c53030'; }}>
              Resolver agora
            </button>
          )}
        </div>
      )}

      {/* Metrics row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: hasLoss ? '1fr 1fr' : '1fr 1fr 1fr',
        gap: 8,
      }}>
        {/* Opportunity */}
        <div style={{
          background: 'rgba(255,255,255,0.015)',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: 4, padding: '12px 14px',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.28)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5,
          }}>
            Possível recuperação
          </div>
          <div style={{
            fontSize: 22, fontWeight: 700, color: '#fff',
            fontFamily: F, letterSpacing: '-0.04em', lineHeight: 1,
          }}>
            +{formatMoney(capturable)}
          </div>
        </div>

        {/* Total saved */}
        <div style={{
          background: 'rgba(255,255,255,0.015)',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: 4, padding: '12px 14px',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.28)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5,
          }}>
            Economizado
          </div>
          <div style={{
            fontSize: 22, fontWeight: 700, color: '#fff',
            fontFamily: F, letterSpacing: '-0.04em', lineHeight: 1,
          }}>
            {formatMoney(displayedSaved)}
          </div>
        </div>

        {/* No loss — show status */}
        {!hasLoss && (
          <div style={{
            background: 'rgba(39,103,73,0.04)',
            border: '1px solid rgba(39,103,73,0.10)',
            borderRadius: 4, padding: '12px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.28)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5,
              }}>
                Status
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#48bb78' }}>
                Sem perdas detectadas
              </div>
            </div>
            {onResolve && (
              <button onClick={onResolve} style={{
                background: '#276749', color: '#fff', border: 'none',
                borderRadius: 4, padding: '6px 12px',
                fontSize: 11, fontWeight: 700, fontFamily: F,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#22543d'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#276749'; }}>
                Ver feed
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
