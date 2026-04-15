import React, { useState } from 'react';
import type { Decision } from '../../types/v2-database';
import { formatMoney } from '../../lib/format';

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'Space Grotesk', 'Plus Jakarta Sans', sans-serif";

interface SummaryBarProps {
  decisions: Decision[];
}

interface PillProps {
  count: number;
  label: string;
  impact: number;
  color: string;
  hoverColor: string;
  type: string;
}

function Pill({ count, label, impact, color, hoverColor, type }: PillProps) {
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
        background: hov ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8, padding: '8px 14px',
        cursor: 'pointer', fontFamily: F,
        display: 'flex', alignItems: 'center', gap: 10,
        transition: 'all 0.12s',
      }}
    >
      <span style={{
        fontSize: 13, fontWeight: 700,
        color: hov ? hoverColor : color,
        transition: 'color 0.12s',
      }}>
        {count}
      </span>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>
        {label}
      </span>
      {impact > 0 && (
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: color, fontFamily: M,
          marginLeft: 'auto',
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
      display: 'flex', gap: 8, fontFamily: F, flexWrap: 'wrap',
    }}>
      {killDecisions.length > 0 && (
        <Pill
          count={killDecisions.length}
          label="para parar"
          impact={killImpact}
          color="#f87171"
          hoverColor="#fca5a5"
          type="kill"
        />
      )}
      {fixDecisions.length > 0 && (
        <Pill
          count={fixDecisions.length}
          label="para corrigir"
          impact={fixImpact}
          color="#fbbf24"
          hoverColor="#fde68a"
          type="fix"
        />
      )}
      {scaleDecisions.length > 0 && (
        <Pill
          count={scaleDecisions.length}
          label="para escalar"
          impact={scaleImpact}
          color="#34d399"
          hoverColor="#6ee7b7"
          type="scale"
        />
      )}
      {patternDecisions.length > 0 && (
        <Pill
          count={patternDecisions.length}
          label={patternDecisions.length === 1 ? 'padrão' : 'padrões'}
          impact={0}
          color="#a78bfa"
          hoverColor="#c4b5fd"
          type="pattern"
        />
      )}
    </div>
  );
};
