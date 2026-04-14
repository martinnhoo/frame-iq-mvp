'use client';

import React, { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../../lib/format';

interface MoneyBarProps {
  leaking: number;
  capturable: number;
  totalSaved: number;
}

/**
 * MoneyBar - THE most important visual in AdBrief
 * Always visible at top of feed
 * Three big numbers: leaking, capturable, totalSaved
 */
export const MoneyBar: React.FC<MoneyBarProps> = ({
  leaking,
  capturable,
  totalSaved,
}) => {
  const [displayedSaved, setDisplayedSaved] = useState(totalSaved);
  const prevSavedRef = useRef(totalSaved);
  const animationFrameRef = useRef<number | null>(null);

  // Animate saved amount when it changes
  useEffect(() => {
    const startValue = prevSavedRef.current;
    const endValue = totalSaved;
    const duration = 1000; // 1 second
    const startTime = Date.now();

    if (startValue === endValue) return;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentValue = Math.floor(
        startValue + (endValue - startValue) * progress
      );
      setDisplayedSaved(currentValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [totalSaved]);

  useEffect(() => {
    prevSavedRef.current = totalSaved;
  }, [totalSaved]);

  const hasLeaking = leaking > 0;

  return (
    <div className="w-full bg-[#111827] rounded-2xl border border-sky-500/10 p-6">
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.8;
            text-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
          }
          50% {
            opacity: 1;
            text-shadow: 0 0 16px rgba(239, 68, 68, 0.5);
          }
        }
        .leak-pulse {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>

      <div className="grid grid-cols-3 gap-4 text-center">
        {/* Leaking */}
        <div className="flex flex-col items-center">
          {hasLeaking ? (
            <>
              <div className="text-4xl font-bold text-red-400 leak-pulse mb-2">
                {formatMoney(leaking)}
              </div>
              <div className="text-xs text-gray-500 font-medium">vazando</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-emerald-400 mb-2">
                ✅ Sem vazamentos
              </div>
              <div className="text-xs text-gray-500 font-medium">nenhuma perda</div>
            </>
          )}
        </div>

        {/* Capturable */}
        <div className="flex flex-col items-center">
          <div className="text-4xl font-bold text-emerald-400 mb-2">
            {formatMoney(capturable)}
          </div>
          <div className="text-xs text-gray-500 font-medium">para capturar</div>
        </div>

        {/* Total Saved */}
        <div className="flex flex-col items-center">
          <div className="text-4xl font-bold text-sky-400 mb-2">
            {formatMoney(displayedSaved)}
          </div>
          <div className="text-xs text-gray-500 font-medium">salvos</div>
        </div>
      </div>
    </div>
  );
};
