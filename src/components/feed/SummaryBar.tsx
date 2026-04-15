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
        background: 'rgba(255,255,255,0.015)',
        border: `1px solid ${hov ? hoverBorder : 'rgba(255,255,255,0.04)'}`,
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
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', fontWeight: 500 }}>
        {label}
      </span>
      {impact > 0 && (
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: 'rgba(255,255,255,0.40)', fontFamily: F,
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
          color="#e53e3e" hoverBorder="rgba(197,48,48,0.35)" type="kill" />
      )}
      {fixDecisions.length > 0 && (
        <Pill count={fixDecisions.length} label="corrigir" impact={fixImpact}
          color="#d69e2e" hoverBorder="rgba(183,121,31,0.35)" type="fix" />
      )}
      {scaleDecisions.length > 0 && (
        <Pill count={scaleDecisions.length} label="escalar" impact={scaleImpact}
          color="#48bb78" hoverBorder="rgba(39,103,73,0.35)" type="scale" />
      )}
      {patternDecisions.length > 0 && (
        <Pill count={patternDecisions.length}
          label={patternDecisions.length === 1 ? 'padrão' : 'padrões'}
          impact={0} color="#9f7aea" hoverBorder="rgba(85,60,154,0.35)" type="pattern" />
      )}
    </div>
  );
};
