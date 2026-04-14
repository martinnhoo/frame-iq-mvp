import React, { useState } from 'react';
import type { Decision, DecisionAction } from '../../types/v2-database';
import { formatMoney } from '../../lib/format';

const F = "'Plus Jakarta Sans', sans-serif";

interface DecisionCardProps {
  decision: Decision;
  onAction: (decisionId: string, action: DecisionAction) => Promise<void>;
}

const TYPE_CONFIG = {
  kill: {
    border: 'rgba(239,68,68,0.5)',
    badgeBg: 'rgba(239,68,68,0.12)',
    badgeText: '#f87171',
    label: 'PARAR',
    emoji: '🛑',
    btnBg: '#ef4444',
    btnHover: '#dc2626',
    secondaryBg: 'rgba(239,68,68,0.08)',
    secondaryBorder: 'rgba(239,68,68,0.20)',
    accent: '#f87171',
  },
  fix: {
    border: 'rgba(245,158,11,0.5)',
    badgeBg: 'rgba(245,158,11,0.12)',
    badgeText: '#fbbf24',
    label: 'CORRIGIR',
    emoji: '⚙️',
    btnBg: '#f59e0b',
    btnHover: '#d97706',
    secondaryBg: 'rgba(245,158,11,0.08)',
    secondaryBorder: 'rgba(245,158,11,0.20)',
    accent: '#fbbf24',
  },
  scale: {
    border: 'rgba(16,185,129,0.5)',
    badgeBg: 'rgba(16,185,129,0.12)',
    badgeText: '#34d399',
    label: 'ESCALAR',
    emoji: '📈',
    btnBg: '#10b981',
    btnHover: '#059669',
    secondaryBg: 'rgba(16,185,129,0.08)',
    secondaryBorder: 'rgba(16,185,129,0.20)',
    accent: '#34d399',
  },
  insight: {
    border: 'rgba(13,162,231,0.5)',
    badgeBg: 'rgba(13,162,231,0.12)',
    badgeText: '#0da2e7',
    label: 'INSIGHT',
    emoji: '💡',
    btnBg: '#0da2e7',
    btnHover: '#0284c7',
    secondaryBg: 'rgba(13,162,231,0.08)',
    secondaryBorder: 'rgba(13,162,231,0.20)',
    accent: '#0da2e7',
  },
  alert: {
    border: 'rgba(13,162,231,0.5)',
    badgeBg: 'rgba(13,162,231,0.12)',
    badgeText: '#0da2e7',
    label: 'ALERTA',
    emoji: '⚡',
    btnBg: '#0da2e7',
    btnHover: '#0284c7',
    secondaryBg: 'rgba(13,162,231,0.08)',
    secondaryBorder: 'rgba(13,162,231,0.20)',
    accent: '#0da2e7',
  },
};

export const DecisionCard: React.FC<DecisionCardProps> = ({ decision, onAction }) => {
  const [executingId, setExecutingId] = useState<string | null>(null);
  const cfg = TYPE_CONFIG[decision.type] || TYPE_CONFIG.insight;

  const handleAction = async (action: DecisionAction) => {
    try {
      setExecutingId(action.id);
      await onAction(decision.id, action);
    } finally {
      setExecutingId(null);
    }
  };

  const impactText = decision.impact_daily > 0
    ? `${formatMoney(decision.impact_daily)}/dia`
    : '';

  return (
    <div
      data-decision-type={decision.type}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `3px solid ${cfg.border}`,
        borderRadius: 12,
        padding: '20px 24px',
        fontFamily: F,
        transition: 'border-color 0.15s, background 0.15s',
        position: 'relative',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.borderLeftColor = cfg.border; }}
    >
      {/* Badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{
          background: cfg.badgeBg,
          color: cfg.badgeText,
          fontSize: 11,
          fontWeight: 700,
          padding: '3px 10px',
          borderRadius: 6,
          letterSpacing: '0.04em',
        }}>
          {cfg.emoji} {cfg.label}
        </span>
        <span style={{
          background: 'rgba(255,255,255,0.04)',
          color: 'rgba(255,255,255,0.40)',
          fontSize: 10,
          fontWeight: 600,
          padding: '3px 8px',
          borderRadius: 6,
        }}>
          Score: {Math.round(decision.score)}
        </span>
        {impactText && (
          <span style={{
            marginLeft: 'auto',
            color: cfg.accent,
            fontSize: 13,
            fontWeight: 700,
          }}>
            {impactText}
          </span>
        )}
      </div>

      {/* Headline */}
      <h3 style={{
        fontSize: 16, fontWeight: 700, color: '#fff',
        margin: '0 0 6px', lineHeight: 1.35, letterSpacing: '-0.01em',
      }}>
        {decision.headline}
      </h3>

      {/* Ad name */}
      <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.35)', margin: '0 0 12px' }}>
        {decision.ad?.name || decision.reason || ''}
      </p>

      {/* Metrics */}
      {decision.metrics && decision.metrics.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {decision.metrics.map((m, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 6, padding: '4px 10px', fontSize: 11.5,
            }}>
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>{m.key}: </span>
              <span style={{ color: 'rgba(255,255,255,0.80)', fontWeight: 600 }}>{m.value}</span>
              {m.context && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginLeft: 4 }}>({m.context})</span>}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {decision.actions && decision.actions.length > 0 ? (
          decision.actions.map((action, idx) => {
            const isPrimary = idx === 0;
            const isRunning = executingId === action.id;
            return (
              <button
                key={action.id}
                onClick={() => handleAction(action)}
                disabled={executingId !== null}
                style={{
                  background: isPrimary ? cfg.btnBg : cfg.secondaryBg,
                  color: isPrimary ? '#fff' : cfg.accent,
                  border: isPrimary ? 'none' : `1px solid ${cfg.secondaryBorder}`,
                  borderRadius: 8, padding: '8px 18px',
                  fontSize: 13, fontWeight: 700,
                  cursor: executingId !== null ? 'not-allowed' : 'pointer',
                  opacity: executingId !== null && !isRunning ? 0.5 : 1,
                  fontFamily: F, transition: 'all 0.12s',
                }}
              >
                {isRunning ? 'Executando...' : action.label}
              </button>
            );
          })
        ) : (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>Sem ações disponíveis</span>
        )}
      </div>
    </div>
  );
};
