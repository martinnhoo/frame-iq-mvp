import React, { useState } from 'react';
import type { Decision } from '../../types/v2-database';
import { formatMoney } from '../../lib/format';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

interface SummaryBarProps {
  decisions: Decision[];
}

interface PillProps {
  count: number;
  label: string;
  impact: number;
  color: string;
  hoverBorder: string;
  type: string;
}

function Pill({ count, label, impact, color, hoverBorder, type }: PillProps) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={() => {
        const el = document.querySelector(`[data-decision-type="${type}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#0F141A',
        border: `1px solid ${hov ? hoverBorder : 'rgba(230,237,243,0.04)'}`,
        borderRadius: 3, padding: '5px 9px',
        cursor: 'pointer', fontFamily: F,
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'border-color 0.1s',
      }}
    >
      <span style={{
        fontSize: 13, fontWeight: 700,
        color: color,
        fontFamily: F,
      }}>
        {count}
      </span>
      <span style={{ fontSize: 11, color: '#8B949E', fontWeight: 500, opacity: 0.7 }}>
        {label}
      </span>
      {impact > 0 && (
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: '#8B949E', fontFamily: F,
          marginLeft: 2,
        }}>
          {formatMoney(impact)}
        </span>
      )}
    </button>
  );
}

export const SummaryBar: React.FC<SummaryBarProps> = ({ decisions }) => {
  const killDecisions = decisions.filter(d => d.type === 'kill');
  const fixDecisions = decisions.filter(d => d.type === 'fix');
  const scaleDecisions = decisions.filter(d => d.type === 'scale');
  const patternDecisions = decisions.filter(d => d.type === 'pattern');

  const killImpact = killDecisions.reduce((s, d) => s + (d.impact_daily || 0), 0);
  const fixImpact = fixDecisions.reduce((s, d) => s + (d.impact_daily || 0), 0);
  const scaleImpact = scaleDecisions.reduce((s, d) => s + (d.impact_daily || 0), 0);

  return (
    <div style={{
      display: 'flex', gap: 6, fontFamily: F, flexWrap: 'wrap',
    }}>
      {killDecisions.length > 0 && (
        <Pill count={killDecisions.length} label="stop loss" impact={killImpact}
          color="#D63B3B" hoverBorder="rgba(180,35,42,0.40)" type="kill" />
      )}
      {fixDecisions.length > 0 && (
        <Pill count={fixDecisions.length} label="corrigir" impact={fixImpact}
          color="#C8922A" hoverBorder="rgba(163,107,29,0.40)" type="fix" />
      )}
      {scaleDecisions.length > 0 && (
        <Pill count={scaleDecisions.length} label="escalar" impact={scaleImpact}
          color="#2D9B6E" hoverBorder="rgba(27,110,87,0.40)" type="scale" />
      )}
      {patternDecisions.length > 0 && (
        <Pill count={patternDecisions.length}
          label={patternDecisions.length === 1 ? 'padrão' : 'padrões'}
          impact={0} color="#9f7aea" hoverBorder="rgba(85,60,154,0.40)" type="pattern" />
      )}
    </div>
  );
};
