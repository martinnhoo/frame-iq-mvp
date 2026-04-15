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
  type: string;
}

function Pill({ count, label, impact, color, type }: PillProps) {
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
        background: hov ? 'rgba(255,255,255,0.03)' : 'transparent',
        border: 'none',
        borderRadius: 3, padding: '4px 10px',
        cursor: 'pointer', fontFamily: F,
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'background 0.15s ease',
      }}
    >
      <span style={{
        fontSize: 15, fontWeight: 800, color,
        fontFamily: F, lineHeight: 1,
      }}>
        {count}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
        <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.40)', fontWeight: 600 }}>
          {label}
        </span>
        {impact > 0 && (
          <span style={{
            fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.22)',
            fontFamily: F,
          }}>
            {formatMoney(impact)}/dia
          </span>
        )}
      </div>
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
    <div style={{ display: 'flex', gap: 4, fontFamily: F, flexWrap: 'wrap' }}>
      {killDecisions.length > 0 && (
        <Pill count={killDecisions.length} label="stop loss" impact={killImpact}
          color="#DC2626" type="kill" />
      )}
      {fixDecisions.length > 0 && (
        <Pill count={fixDecisions.length} label="corrigir" impact={fixImpact}
          color="#D97706" type="fix" />
      )}
      {scaleDecisions.length > 0 && (
        <Pill count={scaleDecisions.length} label="escalar" impact={scaleImpact}
          color="#0EA5E9" type="scale" />
      )}
      {patternDecisions.length > 0 && (
        <Pill count={patternDecisions.length}
          label={patternDecisions.length === 1 ? 'padrão' : 'padrões'}
          impact={0} color="#8B5CF6" type="pattern" />
      )}
    </div>
  );
};
