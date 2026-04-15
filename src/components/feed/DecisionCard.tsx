import React, { useState, useCallback } from 'react';
import type { Decision, DecisionAction, ImpactConfidence } from '../../types/v2-database';
import { formatMoney, timeAgo } from '../../lib/format';
import { ConfirmModal } from './ConfirmModal';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

interface DecisionCardProps {
  decision: Decision;
  onAction: (decisionId: string, action: DecisionAction) => Promise<void>;
  isDemo?: boolean;
  totalDecisions?: number; // for ranking context
}

// ── Financial-grade muted palette ──
const TYPE_CONFIG: Record<string, {
  border: string; badgeBg: string; badgeText: string; label: string;
  btnBg: string; btnHover: string; secondaryBg: string; secondaryBorder: string;
  accent: string; impactLabel: string; confirmTitle: string;
}> = {
  kill: {
    border: '#c53030', badgeBg: 'rgba(197,48,48,0.14)', badgeText: '#e53e3e',
    label: 'STOP LOSS', btnBg: '#c53030', btnHover: '#9b2c2c',
    secondaryBg: 'rgba(197,48,48,0.06)', secondaryBorder: 'rgba(197,48,48,0.18)',
    accent: '#e53e3e', impactLabel: 'perda potencial', confirmTitle: 'Confirmar pausa',
  },
  fix: {
    border: '#b7791f', badgeBg: 'rgba(183,121,31,0.14)', badgeText: '#d69e2e',
    label: 'CORRIGIR', btnBg: '#b7791f', btnHover: '#975a16',
    secondaryBg: 'rgba(183,121,31,0.06)', secondaryBorder: 'rgba(183,121,31,0.18)',
    accent: '#d69e2e', impactLabel: 'recuperável', confirmTitle: 'Confirmar ação',
  },
  scale: {
    border: '#276749', badgeBg: 'rgba(39,103,73,0.14)', badgeText: '#48bb78',
    label: 'ESCALAR', btnBg: '#276749', btnHover: '#22543d',
    secondaryBg: 'rgba(39,103,73,0.06)', secondaryBorder: 'rgba(39,103,73,0.18)',
    accent: '#48bb78', impactLabel: 'oportunidade', confirmTitle: 'Confirmar escala',
  },
  pattern: {
    border: '#553c9a', badgeBg: 'rgba(85,60,154,0.14)', badgeText: '#9f7aea',
    label: 'PADRÃO', btnBg: '#553c9a', btnHover: '#44337a',
    secondaryBg: 'rgba(85,60,154,0.06)', secondaryBorder: 'rgba(85,60,154,0.18)',
    accent: '#9f7aea', impactLabel: '', confirmTitle: 'Confirmar ação',
  },
  insight: {
    border: '#2b6cb0', badgeBg: 'rgba(43,108,176,0.14)', badgeText: '#63b3ed',
    label: 'INSIGHT', btnBg: '#2b6cb0', btnHover: '#2c5282',
    secondaryBg: 'rgba(43,108,176,0.06)', secondaryBorder: 'rgba(43,108,176,0.18)',
    accent: '#63b3ed', impactLabel: '', confirmTitle: 'Confirmar ação',
  },
  alert: {
    border: '#2b6cb0', badgeBg: 'rgba(43,108,176,0.14)', badgeText: '#63b3ed',
    label: 'ALERTA', btnBg: '#2b6cb0', btnHover: '#2c5282',
    secondaryBg: 'rgba(43,108,176,0.06)', secondaryBorder: 'rgba(43,108,176,0.18)',
    accent: '#63b3ed', impactLabel: '', confirmTitle: 'Confirmar ação',
  },
};

const CONFIDENCE_CONFIG: Record<string, { dot: string; text: string; label: string }> = {
  high: { dot: '#48bb78', text: 'rgba(255,255,255,0.50)', label: 'Alta' },
  medium: { dot: '#d69e2e', text: 'rgba(255,255,255,0.40)', label: 'Média' },
  low: { dot: 'rgba(255,255,255,0.25)', text: 'rgba(255,255,255,0.30)', label: 'Baixa' },
};

// Priority label based on score
function getPriorityLabel(score: number, type: string): { text: string; color: string } | null {
  if (type === 'pattern' || type === 'insight') return null;
  if (score >= 85) return { text: 'Prioridade alta — ação recomendada agora', color: '#e53e3e' };
  if (score >= 65) return { text: 'Prioridade média — revisar nas próximas horas', color: '#d69e2e' };
  return null;
}

// Account ranking text from score percentile
function getRankingText(score: number, type: string): string | null {
  if (type === 'pattern' || type === 'insight') return null;
  if (type === 'scale') {
    if (score >= 60) return 'Performance entre os top 10% da conta';
    return 'Performance acima da média da conta';
  }
  // kill/fix — lower is worse
  if (score >= 90) return 'Este anúncio está entre os piores 5% da conta';
  if (score >= 80) return 'Performance abaixo de 85% dos anúncios ativos';
  if (score >= 70) return 'Performance abaixo de 70% dos anúncios ativos';
  return null;
}

// Build confirmation description with impact context
function buildConfirmDesc(decision: Decision, action: DecisionAction): string {
  const adName = decision.ad?.name;
  const parts: string[] = [];

  if (action.meta_api_action === 'pause_ad' || action.label.toLowerCase().includes('pausar')) {
    if (decision.impact_daily > 0) {
      parts.push(`Pausar este anúncio pode evitar ~${formatMoney(decision.impact_daily)}/dia em perdas.`);
    }
    if (adName) parts.push(`Anúncio: ${adName}`);
    parts.push('');
    parts.push('Você pode reativar a qualquer momento.');
  } else if (action.meta_api_action === 'increase_budget') {
    if (decision.impact_daily > 0) {
      parts.push(`Oportunidade estimada: +${formatMoney(decision.impact_daily)}/dia com aumento de budget.`);
    }
    if (adName) parts.push(`Anúncio: ${adName}`);
    parts.push('');
    parts.push('Você pode reverter o budget depois.');
  } else if (action.meta_api_action === 'duplicate_ad') {
    parts.push('Isso vai criar uma cópia deste anúncio no mesmo conjunto.');
    if (adName) parts.push(`Anúncio: ${adName}`);
  } else {
    parts.push(`Ação: ${action.label}`);
    if (adName) parts.push(`Anúncio: ${adName}`);
  }

  return parts.join('\n');
}

export const DecisionCard: React.FC<DecisionCardProps> = ({ decision, onAction, isDemo = false, totalDecisions }) => {
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [confirmAction, setConfirmAction] = useState<DecisionAction | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const cfg = TYPE_CONFIG[decision.type] || TYPE_CONFIG.insight;

  const executeAction = useCallback(async (action: DecisionAction) => {
    try {
      setExecutingId(action.id);
      setActionFeedback(null);
      await onAction(decision.id, action);
      // Post-action feedback with savings context (#10)
      const savingsMsg = decision.impact_daily > 0
        ? `Ação executada — ~${formatMoney(decision.impact_daily)}/dia em perdas interrompidas`
        : 'Ação executada';
      setActionFeedback({ type: 'success', msg: savingsMsg });
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err) {
      setActionFeedback({ type: 'error', msg: 'Erro ao executar — tente novamente' });
      setTimeout(() => setActionFeedback(null), 4000);
    } finally {
      setExecutingId(null);
      setConfirmAction(null);
    }
  }, [decision.id, decision.impact_daily, onAction]);

  const handleButtonClick = useCallback((action: DecisionAction) => {
    if (isDemo) {
      setActionFeedback({ type: 'success', msg: 'Demo — conecte sua conta para executar' });
      setTimeout(() => setActionFeedback(null), 2500);
      return;
    }
    if (action.requires_confirmation) {
      setConfirmAction(action);
    } else {
      executeAction(action);
    }
  }, [isDemo, executeAction]);

  // Campaign context breadcrumb
  const campaignName = decision.ad?.ad_set?.campaign?.name;
  const adSetName = decision.ad?.ad_set?.name;
  const adName = decision.ad?.name;
  const contextParts: string[] = [];
  if (campaignName) contextParts.push(campaignName);
  if (adSetName) contextParts.push(adSetName);
  if (adName) contextParts.push(adName);
  const contextLine = contextParts.join(' → ') || '';

  const createdAgo = decision.created_at ? timeAgo(decision.created_at) : '';
  const basisText = decision.impact_basis || 'Últimos 3 dias';
  const confidence = (decision.impact_confidence as ImpactConfidence) || 'medium';
  const confCfg = CONFIDENCE_CONFIG[confidence] || CONFIDENCE_CONFIG.medium;
  const reasonLines = (decision.reason || '').split('\n').filter(Boolean);

  // Derived urgency data
  const priority = getPriorityLabel(decision.score, decision.type);
  const ranking = getRankingText(decision.score, decision.type);
  const isActiveAd = decision.type === 'kill' || decision.type === 'fix';
  const has7dProjection = decision.impact_7d > 0 && decision.impact_daily > 0;

  return (
    <>
      <ConfirmModal
        open={confirmAction !== null}
        title={cfg.confirmTitle}
        description={confirmAction ? buildConfirmDesc(decision, confirmAction) : ''}
        confirmLabel={confirmAction?.label || 'Confirmar'}
        confirmColor={cfg.btnBg}
        onConfirm={() => { if (confirmAction) executeAction(confirmAction); }}
        onCancel={() => setConfirmAction(null)}
        loading={executingId !== null}
      />

      <div
        data-decision-type={decision.type}
        style={{
          background: hovered ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.015)',
          border: `1px solid ${hovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
          borderLeft: `3px solid ${cfg.border}`,
          borderRadius: 4,
          padding: '14px 16px',
          fontFamily: F,
          transition: 'border-color 0.12s, background 0.12s',
          position: 'relative',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Campaign context */}
        {contextLine && (
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.28)',
            marginBottom: 8, letterSpacing: '0.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {contextLine}
          </div>
        )}

        {/* Badge row: type + score + confidence + active status + time */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              background: cfg.badgeBg, color: cfg.badgeText,
              fontSize: 10, fontWeight: 700,
              padding: '2px 7px', borderRadius: 3,
              letterSpacing: '0.08em', lineHeight: '16px',
            }}>
              {cfg.label}
            </span>
            {decision.score > 0 && (
              <span style={{ color: 'rgba(255,255,255,0.30)', fontSize: 10, fontWeight: 600 }}>
                {Math.round(decision.score)}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 2 }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: confCfg.dot, display: 'inline-block',
              }} />
              <span style={{ fontSize: 10, color: confCfg.text, fontWeight: 500 }}>
                {confCfg.label}
              </span>
            </span>
            {/* #3: "Still active" urgency indicator */}
            {isActiveAd && decision.status === 'pending' && (
              <span style={{
                fontSize: 9.5, color: 'rgba(229,62,62,0.70)',
                fontWeight: 600, letterSpacing: '0.02em',
              }}>
                Anúncio ativo — gasto contínuo
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.20)' }}>
              {basisText}
            </span>
            {createdAgo && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>
                {createdAgo}
              </span>
            )}
          </div>
        </div>

        {/* #4: Priority label */}
        {priority && (
          <div style={{
            fontSize: 11, fontWeight: 600, color: priority.color,
            marginBottom: 8, letterSpacing: '-0.01em',
          }}>
            {priority.text}
          </div>
        )}

        {/* Financial impact */}
        {decision.impact_daily > 0 && (
          <div style={{ marginBottom: 8 }}>
            <span style={{
              fontSize: 26, fontWeight: 700, color: '#fff',
              fontFamily: F, letterSpacing: '-0.03em', lineHeight: 1,
            }}>
              {formatMoney(decision.impact_daily)}
            </span>
            <span style={{
              fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.45)',
              fontFamily: F, letterSpacing: '-0.02em', marginLeft: 4,
            }}>
              /dia
            </span>
            <div style={{
              fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)',
              marginTop: 2,
            }}>
              {cfg.impactLabel}
            </div>
          </div>
        )}

        {/* #1: FUTURE CONSEQUENCE — 7-day projection */}
        {has7dProjection && (
          <div style={{
            background: decision.type === 'scale'
              ? 'rgba(39,103,73,0.06)'
              : 'rgba(197,48,48,0.05)',
            border: `1px solid ${decision.type === 'scale'
              ? 'rgba(39,103,73,0.12)'
              : 'rgba(197,48,48,0.10)'}`,
            borderRadius: 3,
            padding: '7px 10px',
            marginBottom: 10,
            fontSize: 11.5,
            color: decision.type === 'scale'
              ? 'rgba(72,187,120,0.85)'
              : 'rgba(229,62,62,0.80)',
            fontWeight: 500,
          }}>
            {decision.type === 'scale'
              ? `Se escalar agora: +${formatMoney(decision.impact_7d)} possíveis nos próximos 7 dias`
              : `Se nenhuma ação for tomada: ~${formatMoney(decision.impact_7d)} perdidos nos próximos 7 dias`
            }
          </div>
        )}

        {/* Headline */}
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,0.88)',
          margin: '0 0 6px', lineHeight: 1.35, letterSpacing: '-0.01em',
        }}>
          {decision.headline}
        </div>

        {/* Reason lines */}
        {reasonLines.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            {reasonLines.map((line, i) => (
              <div key={i} style={{
                fontSize: 12, color: 'rgba(255,255,255,0.55)',
                lineHeight: 1.6,
              }}>
                {line}
              </div>
            ))}
          </div>
        )}

        {/* #2: Account ranking context */}
        {ranking && (
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.30)',
            marginBottom: 8, fontStyle: 'italic',
          }}>
            {ranking}
          </div>
        )}

        {/* #7: Grouping indicator */}
        {(decision as any).group_note && (
          <div style={{
            fontSize: 10.5, color: 'rgba(255,255,255,0.28)',
            marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>⊟</span>
            {(decision as any).group_note}
          </div>
        )}

        {/* #5: Specific action recommendation */}
        {(decision as any).action_recommendation && (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: 3,
            padding: '6px 10px',
            marginBottom: 8,
            fontSize: 11,
            color: 'rgba(255,255,255,0.40)',
            lineHeight: 1.5,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.22)', fontWeight: 600, fontSize: 10, marginRight: 6 }}>
              RECOMENDAÇÃO
            </span>
            {(decision as any).action_recommendation}
          </div>
        )}

        {/* Metrics */}
        {decision.metrics && decision.metrics.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12,
            borderTop: '1px solid rgba(255,255,255,0.04)',
            paddingTop: 10,
          }}>
            {decision.metrics.map((m, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: 3, padding: '4px 8px', fontSize: 11,
                display: 'flex', alignItems: 'baseline', gap: 4,
              }}>
                <span style={{ color: 'rgba(255,255,255,0.32)', fontWeight: 500 }}>{m.key}</span>
                <span style={{
                  color: m.trend === 'down' ? '#e53e3e' : m.trend === 'up' ? '#48bb78' : 'rgba(255,255,255,0.65)',
                  fontWeight: 600, fontSize: 11.5,
                }}>
                  {m.value}
                </span>
                {m.context && (
                  <span style={{ color: 'rgba(255,255,255,0.20)', fontSize: 10 }}>
                    {m.context}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions + feedback */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {decision.actions && decision.actions.length > 0 ? (
            decision.actions.map((action, idx) => {
              const isPrimary = idx === 0;
              const isRunning = executingId === action.id;
              return (
                <button
                  key={action.id}
                  onClick={() => handleButtonClick(action)}
                  disabled={executingId !== null}
                  style={{
                    background: isPrimary ? cfg.btnBg : cfg.secondaryBg,
                    color: isPrimary ? '#fff' : cfg.accent,
                    border: isPrimary ? 'none' : `1px solid ${cfg.secondaryBorder}`,
                    borderRadius: 4,
                    padding: isPrimary ? '8px 18px' : '6px 12px',
                    fontSize: isPrimary ? 12 : 11,
                    fontWeight: isPrimary ? 700 : 600,
                    cursor: executingId !== null ? 'not-allowed' : 'pointer',
                    opacity: executingId !== null && !isRunning ? 0.4 : 1,
                    fontFamily: F, transition: 'all 0.1s',
                    letterSpacing: '-0.01em',
                  }}
                  onMouseEnter={e => {
                    if (isPrimary && !executingId) (e.currentTarget as HTMLElement).style.background = cfg.btnHover;
                  }}
                  onMouseLeave={e => {
                    if (isPrimary) (e.currentTarget as HTMLElement).style.background = cfg.btnBg;
                  }}
                >
                  {isRunning ? 'Executando...' : action.label}
                </button>
              );
            })
          ) : (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.20)' }}>Sem ações</span>
          )}

          {/* Inline feedback (#10) */}
          {actionFeedback && (
            <span style={{
              fontSize: 11, fontWeight: 500, marginLeft: 4,
              color: actionFeedback.type === 'success' ? '#48bb78' : '#e53e3e',
            }}>
              {actionFeedback.msg}
            </span>
          )}
        </div>

        {/* #15: Subtle urgency micro-text for kill decisions */}
        {decision.type === 'kill' && decision.status === 'pending' && !actionFeedback && (
          <div style={{
            fontSize: 10, color: 'rgba(255,255,255,0.18)',
            marginTop: 8,
          }}>
            Cada hora ativo mantém esse nível de perda
          </div>
        )}
      </div>
    </>
  );
};
