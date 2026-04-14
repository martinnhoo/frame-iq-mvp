'use client';

import React from 'react';
import type { Decision } from '../../types/database';

interface SummaryBarProps {
  decisions: Decision[];
}

/**
 * SummaryBar - Quick summary of decision counts
 * Shows counts by type and allows scrolling to first card of that type
 */
export const SummaryBar: React.FC<SummaryBarProps> = ({ decisions }) => {
  const killCount = decisions.filter((d) => d.type === 'kill').length;
  const fixCount = decisions.filter((d) => d.type === 'fix').length;
  const scaleCount = decisions.filter((d) => d.type === 'scale').length;

  const handleScroll = (type: string) => {
    const element = document.querySelector(`[data-decision-type="${type}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex gap-4 text-sm text-gray-400 py-4">
      {killCount > 0 && (
        <button
          onClick={() => handleScroll('kill')}
          className="cursor-pointer hover:text-red-400 transition-colors"
        >
          🔴 {killCount} para parar
        </button>
      )}

      {fixCount > 0 && (
        <button
          onClick={() => handleScroll('fix')}
          className="cursor-pointer hover:text-amber-400 transition-colors"
        >
          🟡 {fixCount} para corrigir
        </button>
      )}

      {scaleCount > 0 && (
        <button
          onClick={() => handleScroll('scale')}
          className="cursor-pointer hover:text-emerald-400 transition-colors"
        >
          🟢 {scaleCount} para escalar
        </button>
      )}
    </div>
  );
};
