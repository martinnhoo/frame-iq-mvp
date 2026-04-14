import React from 'react';
import type { Decision } from '../../types/v2-database';

const F = "'Plus Jakarta Sans', sans-serif";

interface SummaryBarProps {
  decisions: Decision[];
}

export const SummaryBar: React.FC<SummaryBarProps> = ({ decisions }) => {
  const killCount = decisions.filter(d => d.type === 'kill').length;
  const fixCount = decisions.filter(d => d.type === 'fix').length;
  const scaleCount = decisions.filter(d => d.type === 'scale').length;

  const handleScroll = (type: string) => {
    const el = document.querySelector(`[data-decision-type="${type}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'rgba(255,255,255,0.45)', padding: '8px 0', fontFamily: F }}>
      {killCount > 0 && (
        <button onClick={() => handleScroll('kill')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontFamily: F, fontSize: 13, padding: 0, transition: 'color 0.12s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; }}>
          🔴 {killCount} para parar
        </button>
      )}
      {fixCount > 0 && (
        <button onClick={() => handleScroll('fix')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontFamily: F, fontSize: 13, padding: 0, transition: 'color 0.12s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fbbf24'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; }}>
          🟡 {fixCount} para corrigir
        </button>
      )}
      {scaleCount > 0 && (
        <button onClick={() => handleScroll('scale')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontFamily: F, fontSize: 13, padding: 0, transition: 'color 0.12s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#34d399'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; }}>
          🟢 {scaleCount} para escalar
        </button>
      )}
    </div>
  );
};
