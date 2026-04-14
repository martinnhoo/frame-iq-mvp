import React, { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../../lib/format';

const F = "'Plus Jakarta Sans', sans-serif";

interface MoneyBarProps {
  leaking: number;
  capturable: number;
  totalSaved: number;
}

/**
 * MoneyBar — THE most important visual in AdBrief
 * Always visible at top of feed. Three big numbers.
 */
export const MoneyBar: React.FC<MoneyBarProps> = ({ leaking, capturable, totalSaved }) => {
  const [displayedSaved, setDisplayedSaved] = useState(totalSaved);
  const prevSavedRef = useRef(totalSaved);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = prevSavedRef.current;
    const endValue = totalSaved;
    const duration = 1000;
    const startTime = Date.now();
    if (startValue === endValue) return;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayedSaved(Math.floor(startValue + (endValue - startValue) * progress));
      if (progress < 1) animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [totalSaved]);

  useEffect(() => { prevSavedRef.current = totalSaved; }, [totalSaved]);

  const hasLeaking = leaking > 0;

  return (
    <>
      <style>{`
        @keyframes money-pulse { 0%,100%{opacity:0.85;text-shadow:0 0 6px rgba(239,68,68,0.25)} 50%{opacity:1;text-shadow:0 0 14px rgba(239,68,68,0.45)} }
        .leak-pulse { animation: money-pulse 2s ease-in-out infinite; }
      `}</style>
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, padding: '20px 16px',
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, textAlign: 'center',
        fontFamily: F,
      }}>
        {/* Leaking */}
        <div>
          {hasLeaking ? (
            <>
              <div className="leak-pulse" style={{ fontSize: 28, fontWeight: 800, color: '#f87171', letterSpacing: '-0.02em', marginBottom: 4 }}>
                {formatMoney(leaking)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                vazando/dia
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#34d399', marginBottom: 4 }}>Sem vazamentos</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>nenhuma perda</div>
            </>
          )}
        </div>

        {/* Capturable */}
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#34d399', letterSpacing: '-0.02em', marginBottom: 4 }}>
            {formatMoney(capturable)}
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            para capturar
          </div>
        </div>

        {/* Total Saved */}
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0da2e7', letterSpacing: '-0.02em', marginBottom: 4 }}>
            {formatMoney(displayedSaved)}
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            total salvo
          </div>
        </div>
      </div>
    </>
  );
};
