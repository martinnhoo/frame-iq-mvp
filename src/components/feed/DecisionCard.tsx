import React, { useState } from 'react';
import type { Decision, DecisionAction, ImpactConfidence } from '../../types/v2-database';
import { formatMoney, timeAgo } from '../../lib/format';

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'Space Grotesk', 'Plus Jakarta Sans', sans-serif";

interface DecisionCardProps {
  decision: Decision;
  onAction: (decisionId: string, action: DecisionAction) => Promise<void>;
}

const TYPE_CONFIG: Record<string, {
  border: string; badgeBg: string; badgeText: string; label: string;
  btnBg: string; btnHover: string; secondaryBg: string; secondaryBorder: string;
  accent: string; impactLabel: string; icon: string;
}> = {
  kill: {
    border: 'rgba(239,68,68,0.5)',
    badgeBg: 'rgba(239,68,68,0.12)',
    badgeText: '#f87171',
    label: 'STOP LOSS',
    btnBg: '#ef4444',
    btnHover: '#dc2626',
    secondaryBg: 'rgba(239,68,68,0.08)',
    secondaryBorder: 'rgba(239,68,68,0.20)',
    accent: '#f87171',
    impactLabel: 'em perda potencial',
    icon: '🛑',
  },
  fix: {
    border: 'rgba(245,158,11,0.5)',
    badgeBg: 'rgba(245,158,11,0.12)',
    badgeText: '#fbbf24',
    label: 'CORRIGIR',
    btnBg: '#f59e0b',
    btnHover: '#d97706',
    secondaryBg: 'rgba(245,158,11,0.08)',
    secondaryBorder: 'rgba(245,158,11,0.20)',
    accent: '#fbbf24',
    impactLabel: 'recuperável com ajuste',
    icon: '🔧',
  },
  scale: {
    border: 'rgba(16,185,129,0.5)',
    badgeBg: 'rgba(16,185,129,0.12)',
    badgeText: '#34d399',
    label: 'ESCALAR',
    btnBg: '#10b981',
    btnHover: '#059669',
    secondaryBg: 'rgba(16,185,129,0.08)',
    secondaryBorder: 'rgba(16,185,129,0.20)',
    accent: '#34d399',
    impactLabel: 'em oportunidade identificada',
    icon: '🚀',
  },
  pattern: {
    border: 'rgba(139,92,246,0.5)',
    badgeBg: 'rgba(139,92,246,0.12)',
    badgeText: '#a78bfa',
    label: 'PADRÃO',
    btnBg: '#8b5cf6',
    btnHover: '#7c3aed',
    secondaryBg: 'rgba(139,92,246,0.08)',
    secondaryBorder: 'rgba(139,92,246,0.20)',
    accent: '#a78bfa',
    impactLabel: 'baseado nos dados',
    icon: '🧠',
  },
  insight: {
    border: 'rgba(13,162,231,0.5)',
    badgeBg: 'rgba(13,162,231,0.12)',
    badgeText: '#0da2e7',
    label: 'INSIGHT',
    btnBg: '#0da2e7',
    btnHover: '#0284c7',
    secondaryBg: 'rgba(13,162,231,0.08)',
    secondaryBorder: 'rgba(13,162,231,0.20)',
    accent: '#0da2e7',
    impactLabel: '',
    icon: '💡',
  },
  alert: {
    border: 'rgba(13,162,231,0.5)',
    badgeBg: 'rgba(13,162,231,0.12)',
    badgeText: '#0da2e7',
    label: 'ALERTA',
    btnBg: '#0da2e7',
    btnHover: '#0284c7',
    secondaryBg: 'rgba(13,162,231,0.08)',
    secondaryBorder: 'rgba(13,162,231,0.20)',
    accent: '#0da2e7',
    impactLabel: '',
    icon: '⚡',
  },
};

const CONFIDENCE_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'rgba(16,185,129,0.10)', text: '#34d399', label: 'Alta' },
  medium: { bg: 'rgba(245,158,11,0.10)', text: '#fbbf24', label: 'Média' },
  low: { bg: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.35)', label: 'Baixa' },
};

export const DecisionCard: React.FC<DecisionCardProps> = ({ decision, onAction }) => {
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const cfg = TYPE_CONFIG[decision.type] || TYPE_CONFIG.insight;

  const handleAction = async (action: DecisionAction) => {
    try {
      setExecutingId(action.id);
      await onAction(decision.id, action);
    } finally {
      setExecutingId(null);
    }
  };

  // Build campaign context line
  const campaignName = decision.ad?.ad_set?.campaign?.name;
  const adName = decision.ad?.name;
  const contextParts: string[] = [];
  if (campaignName) contextParts.push(campaignName);
  if (adName) contextParts.push(adName);
  const contextLine = contextParts.join(' \u2192 ') || '';

  // Time reference
  const createdAgo = decision.created_at ? timeAgo(decision.created_at) : '';
  const basisText = decision.impact_basis || 'Baseado nos últimos 3 dias';

  // Confidence badge
  const confidence = (decision.impact_confidence as ImpactConfidence) || 'medium';
  const confCfg = CONFIDENCE_CONFIG[confidence] || CONFIDENCE_CONFIG.medium;

  return (
    <div
      data-decision-type={decision.type}
      style={{
        background: hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `3px solid ${cfg.border}`,
        borderRadius: 12,
        padding: '20px 24px',
        fontFamily: F,
        transition: 'all 0.15s',
        position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Row 1: Badge + confidence + time */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background: cfg.badgeBg,
            color: cfg.badgeText,
            fontSize: 10.5,
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 6,
            letterSpacing: '0.06em',
          }}>
            {cfg.label}
          </span>
          {decision.score > 0 && (
            <span style={{
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.35)',
              fontSize: 10,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 6,
            }}>
              Score {Math.round(decision.score)}
            </span>
          )}
          <span style={{
            background: confCfg.bg,
            color: confCfg.text,
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 6,
            letterSpacing: '0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: confCfg.text,
              display: 'inline-block',
              flexShrink: 0,
            }} />
            Confiança: {confCfg.label}
          </span>
        </div>
        {createdAgo && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
            {createdAgo}
          </span>
        )}
      </div>

      {/* Row 2: Financial impact — DOMINANT (skip for insights/patterns with 0 impact) */}
      {decision.impact_daily > 0 && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <span style={{
            fontSize: 22, fontWeight: 700,
            color: '#fff',
            fontFamily: M,
            letterSpacing: '-0.03em',
          }}>
            {formatMoney(decision.impact_daily)}/dia
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.35)' }}>
            {cfg.impactLabel}
          </span>
        </div>
      )}

      {/* Row 3: Headline */}
      <h3 style={{
        fontSize: 15, fontWeight: 700, color: '#fff',
        margin: '0 0 4px', lineHeight: 1.4, letterSpacing: '-0.01em',
      }}>
        {decision.headline}
      </h3>

      {/* Row 4: Reason (the "why") */}
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)', margin: '0 0 4px', lineHeight: 1.5 }}>
        {decision.reason}
      </p>

      {/* Row 5: Campaign context (if ad-specific) */}
      {contextLine && (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: '0 0 4px' }}>
          {contextLine}
        </p>
      )}

      {/* Row 6: Time basis */}
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.20)', margin: '0 0 14px' }}>
        {basisText}
      </p>

      {/* Row 7: Metrics pills */}
      {decision.metrics && decision.metrics.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {decision.metrics.map((m, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 6, padding: '5px 10px', fontSize: 11.5,
            }}>
              <span style={{ color: 'rgba(255,255,255,0.40)' }}>{m.key}: </span>
              <span style={{
                color: m.trend === 'down' ? '#f87171' : m.trend === 'up' ? '#34d399' : 'rgba(255,255,255,0.75)',
                fontWeight: 600, fontFamily: M,
              }}>
                {m.value}
              </span>
              {m.context && (
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginLeft: 4 }}>
                  {m.context}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Row 8: Actions — ONE primary, secondaries don't compete */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                  borderRadius: 8, padding: isPrimary ? '9px 20px' : '7px 14px',
                  fontSize: isPrimary ? 13 : 12, fontWeight: isPrimary ? 700 : 600,
                  cursor: executingId !== null ? 'not-allowed' : 'pointer',
                  opacity: executingId !== null && !isRunning ? 0.5 : 1,
                  fontFamily: F, transition: 'all 0.12s',
                  letterSpacing: '-0.01em',
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
