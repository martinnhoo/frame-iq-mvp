import React, { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../../lib/format';

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'Space Grotesk', 'Plus Jakarta Sans', sans-serif";

interface MoneyBarProps {
  leaking: number;
  capturable: number;
  totalSaved: number;
  onStopLosses?: () => void;
}

export const MoneyBar: React.FC<MoneyBarProps> = ({ leaking, capturable, totalSaved, onStopLosses }) => {
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
      {/* Primary: financial impact headline */}
      {hasLoss && (
        <div style={{
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.12)',
          borderRadius: 10, padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#fff', fontFamily: M, letterSpacing: '-0.03em' }}>
                {formatMoney(leaking)}/dia
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>
                em perda potencial
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', margin: '4px 0 0' }}>
              Baseado no desempenho recente da conta
            </p>
          </div>
          {onStopLosses && (
            <button onClick={onStopLosses} style={{
              background: '#ef4444', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 20px',
              fontSize: 13, fontWeight: 700, fontFamily: F,
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#dc2626'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#ef4444'; }}>
              Parar perdas agora
            </button>
          )}
        </div>
      )}

      {/* Secondary: metrics row */}
      <div style={{
        display: 'grid', gridTemplateColumns: hasLoss ? '1fr 1fr' : '1fr 1fr 1fr', gap: 12,
      }}>
        {/* Opportunity */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10, padding: '16px 20px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Oportunidade identificada
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: M, letterSpacing: '-0.03em' }}>
            {formatMoney(capturable)}
          </div>
        </div>

        {/* Total saved */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10, padding: '16px 20px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Total economizado
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: M, letterSpacing: '-0.03em' }}>
            {formatMoney(displayedSaved)}
          </div>
        </div>

        {/* No loss — show status */}
        {!hasLoss && (
          <div style={{
            background: 'rgba(16,185,129,0.04)',
            border: '1px solid rgba(16,185,129,0.10)',
            borderRadius: 10, padding: '16px 20px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Status
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#34d399' }}>
              Nenhuma perda potencial
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
