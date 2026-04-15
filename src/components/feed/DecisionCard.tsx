import React, { useState, useCallback } from 'react';
import type { Decision, DecisionAction, ImpactConfidence } from '../../types/v2-database';
import { formatMoney, timeAgo } from '../../lib/format';
import { ConfirmModal } from './ConfirmModal';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

interface DecisionCardProps {
  decision: Decision;
  onAction: (decisionId: string, action: DecisionAction) => Promise<void>;
  isDemo?: boolean;
}

// ── AdBrief proprietary color system ──
// Red = deeper/wine (money risk, not form error)
// Green = financial, not gamified
// Teal = "brain" color for IA/smart actions
// Purple = pattern detection
const TYPE_CONFIG: Record<string, {
  border: string; badgeBg: string; badgeText: string; label: string;
  btnBg: string; btnHover: string; secondaryBg: string; secondaryBorder: string;
  accent: string; impactLabel: string; confirmTitle: string;
}> = {
  kill: {
    border: '#B4232A', badgeBg: 'rgba(180,35,42,0.22)', badgeText: '#D63B3B',
    label: 'STOP LOSS', btnBg: '#B4232A', btnHover: '#8A1D22',
    secondaryBg: 'rgba(180,35,42,0.08)', secondaryBorder: 'rgba(180,35,42,0.22)',
    accent: '#D63B3B', impactLabel: 'perda potencial', confirmTitle: 'Confirmar pausa',
  },
  fix: {
    border: '#A36B1D', badgeBg: 'rgba(163,107,29,0.18)', badgeText: '#C8922A',
    label: 'CORRIGIR', btnBg: '#A36B1D', btnHover: '#7D5216',
    secondaryBg: 'rgba(163,107,29,0.07)', secondaryBorder: 'rgba(163,107,29,0.20)',
    accent: '#C8922A', impactLabel: 'recuperável', confirmTitle: 'Confirmar ação',
  },
  scale: {
    border: '#1B6E57', badgeBg: 'rgba(27,110,87,0.18)', badgeText: '#2D9B6E',
    label: 'ESCALAR', btnBg: '#1B6E57', btnHover: '#145443',
    secondaryBg: 'rgba(27,110,87,0.07)', secondaryBorder: 'rgba(27,110,87,0.20)',
    accent: '#2D9B6E', impactLabel: 'oportunidade', confirmTitle: 'Confirmar escala',
  },
  pattern: {
    border: '#553c9a', badgeBg: 'rgba(85,60,154,0.18)', badgeText: '#9f7aea',
    label: 'PADRÃO', btnBg: '#553c9a', btnHover: '#44337a',
    secondaryBg: 'rgba(85,60,154,0.07)', secondaryBorder: 'rgba(85,60,154,0.20)',
    accent: '#9f7aea', impactLabel: '', confirmTitle: 'Confirmar ação',
  },
  insight: {
    border: '#1F3A5F', badgeBg: 'rgba(34,163,163,0.14)', badgeText: '#22A3A3',
    label: 'INSIGHT', btnBg: '#1F3A5F', btnHover: '#162C48',
    secondaryBg: 'rgba(34,163,163,0.06)', secondaryBorder: 'rgba(34,163,163,0.18)',
    accent: '#22A3A3', impactLabel: '', confirmTitle: 'Confirmar ação',
  },
  alert: {
    border: '#1F3A5F', badgeBg: 'rgba(34,163,163,0.14)', badgeText: '#22A3A3',
    label: 'ALERTA', btnBg: '#1F3A5F', btnHover: '#162C48',
    secondaryBg: 'rgba(34,163,163,0.06)', secondaryBorder: 'rgba(34,163,163,0.18)',
    accent: '#22A3A3', impactLabel: '', confirmTitle: 'Confirmar ação',
  },
};

const CONFIDENCE_CONFIG: Record<string, { dot: string; text: string; label: string }> = {
  high: { dot: '#2D9B6E', text: 'rgba(230,237,243,0.60)', label: 'Alta' },
  medium: { dot: '#C8922A', text: 'rgba(230,237,243,0.55)', label: 'Média' },
  low: { dot: '#8B949E', text: 'rgba(230,237,243,0.50)', label: 'Baixa' },
};

// PART 4: Direct ranking signal — clear severity
function getRankingText(score: number, type: string): string | null {
  if (type === 'pattern' || type === 'insight') return null;
  if (type === 'scale') {
    if (score >= 60) return 'Top 10% da conta em performance';
    return 'Acima da média da conta';
  }
  if (score >= 90) return 'Pior criativo ativo da conta';
  if (score >= 80) return 'Entre os 15% piores da conta';
  if (score >= 70) return 'Abaixo de 70% dos anúncios ativos';
  return null;
}

// Build confirmation description with impact context
function buildConfirmDesc(decision: Decision, action: DecisionAction): string {
  const adName = decision.ad?.name;
  const parts: string[] = [];

  if (action.meta_api_action === 'pause_ad' || action.label.toLowerCase().includes('pausar')) {
    if (decision.impact_daily > 0) {
      parts.push(`Impacto estimado: ~${formatMoney(decision.impact_daily)}/dia em perdas evitadas.`);
    }
    if (adName) parts.push(`Anúncio: ${adName}`);
    parts.push('');
    parts.push('Reversível — você pode reativar a qualquer momento.');
  } else if (action.meta_api_action === 'increase_budget') {
    if (decision.impact_daily > 0) {
      parts.push(`Oportunidade estimada: +${formatMoney(decision.impact_daily)}/dia com aumento.`);
    }
    if (adName) parts.push(`Anúncio: ${adName}`);
    parts.push('');
    parts.push('Reversível — você pode ajustar o budget depois.');
  } else if (action.meta_api_action === 'duplicate_ad') {
    parts.push('Cria uma cópia no mesmo conjunto de anúncios.');
    if (adName) parts.push(`Anúncio: ${adName}`);
  } else {
    parts.push(`Ação: ${action.label}`);
    if (adName) parts.push(`Anúncio: ${adName}`);
  }

  return parts.join('\n');
}

export const DecisionCard: React.FC<DecisionCardProps> = ({ decision, onAction, isDemo = false }) => {
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [confirmAction, setConfirmAction] = useState<DecisionAction | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const cfg = TYPE_CONFIG[decision.type] || TYPE_CONFIG.insight;

  // PART 6: Post-action feedback — instant and rewarding
  const executeAction = useCallback(async (action: DecisionAction) => {
    try {
      setExecutingId(action.id);
      setActionFeedback(null);
      await onAction(decision.id, action);
      let feedbackMsg = 'Ação executada';
      if (action.meta_api_action === 'pause_ad' || action.label.toLowerCase().includes('pausar')) {
        feedbackMsg = decision.impact_daily > 0
          ? `Anúncio pausado · ≈${formatMoney(decision.impact_daily)}/dia em perdas interrompidas`
          : 'Anúncio pausado';
      } else if (action.meta_api_action === 'increase_budget') {
        feedbackMsg = 'Budget atualizado';
      } else if (action.meta_api_action === 'duplicate_ad') {
        feedbackMsg = 'Anúncio duplicado';
      }
      setActionFeedback({ type: 'success', msg: feedbackMsg });
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err) {
      setActionFeedback({ type: 'error', msg: 'Erro — tente novamente' });
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

  // Campaign context
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

  // Derived
  const ranking = getRankingText(decision.score, decision.type);
  const isActiveAd = decision.type === 'kill' || decision.type === 'fix';
  const has7dProjection = decision.impact_7d > 0 && decision.impact_daily > 0;
  const isDestructive = decision.type === 'kill';
  const actionRec = decision.action_recommendation;
  const groupNote = decision.group_note;

  // Parse action_recommendation into bullet items if it contains commas/colons
  const recItems: string[] = [];
  if (actionRec) {
    // If format is "Label: item1, item2, item3"
    const colonIdx = actionRec.indexOf(':');
    if (colonIdx > -1) {
      const items = actionRec.slice(colonIdx + 1).split(',').map(s => s.trim()).filter(Boolean);
      recItems.push(...items);
    }
    if (recItems.length === 0) {
      recItems.push(actionRec);
    }
  }

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
          // PART 8: tighter, sharper
          background: hovered ? '#121821' : '#0F141A',
          border: `1px solid ${hovered ? 'rgba(230,237,243,0.08)' : 'rgba(230,237,243,0.04)'}`,
          borderLeft: `3px solid ${cfg.border}`,
          borderRadius: 3,
          padding: '12px 14px',
          fontFamily: F,
          transition: 'border-color 0.12s, background 0.12s',
          position: 'relative',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Campaign context breadcrumb */}
        {contextLine && (
          <div style={{
            fontSize: 10.5, color: 'rgba(255,255,255,0.25)',
            marginBottom: 6, letterSpacing: '0.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {contextLine}
          </div>
        )}

        {/* #7: Confidence + basis — top line */}
        <div style={{
          fontSize: 10, color: confCfg.text,
          marginBottom: 6,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: confCfg.dot, display: 'inline-block',
            }} />
            Confiança: {confCfg.label}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.12)' }}>·</span>
          <span>Baseado em {basisText.toLowerCase()}</span>
          {createdAgo && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.12)' }}>·</span>
              <span style={{ color: 'rgba(255,255,255,0.20)' }}>{createdAgo}</span>
            </>
          )}
        </div>

        {/* Badge row: type + score + active status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              background: cfg.badgeBg, color: cfg.badgeText,
              fontSize: 9.5, fontWeight: 700,
              padding: '2px 6px', borderRadius: 2,
              letterSpacing: '0.08em', lineHeight: '15px',
            }}>
              {cfg.label}
            </span>
            {decision.score > 0 && (
              <span style={{ color: cfg.badgeText, fontSize: 10, fontWeight: 600, opacity: 0.7 }}>
                {Math.round(decision.score)}
              </span>
            )}
          </div>
          {/* #2: Active indicator — stronger */}
          {isActiveAd && decision.status === 'pending' && (
            <span style={{
              fontSize: 9.5, color: 'rgba(214,59,59,0.75)',
              fontWeight: 600,
            }}>
              Ativo — gasto contínuo
            </span>
          )}
        </div>

        {/* ═══ PART 9: HIERARCHY — Money FIRST ═══ */}

        {/* 1. MONEY — largest visual element */}
        {decision.impact_daily > 0 && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{
                fontSize: 24, fontWeight: 700, color: '#fff',
                fontFamily: F, letterSpacing: '-0.03em', lineHeight: 1,
              }}>
                {decision.type === 'scale' ? '+' : '-'}{formatMoney(decision.impact_daily)}
              </span>
              <span style={{
                fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.40)',
                fontFamily: F, letterSpacing: '-0.02em',
              }}>
                /dia
              </span>
              <span style={{
                fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.30)',
                marginLeft: 4,
              }}>
                {cfg.impactLabel}
              </span>
            </div>
          </div>
        )}

        {/* PART 1: Technical 7-day projection — no narrative */}
        {has7dProjection && (
          <div style={{
            fontSize: 11, fontWeight: 500, marginBottom: 8,
            color: decision.type === 'scale'
              ? 'rgba(45,155,110,0.80)'
              : 'rgba(214,59,59,0.75)',
          }}>
            Impacto projetado (7 dias): {decision.type === 'scale' ? '+' : '-'}{formatMoney(decision.impact_7d)}
          </div>
        )}

        {/* 2. PROBLEM — headline */}
        <div style={{
          fontSize: 13, fontWeight: 600, color: '#E6EDF3',
          margin: '0 0 5px', lineHeight: 1.35, letterSpacing: '-0.01em',
        }}>
          {decision.headline}
        </div>

        {/* PART 4: Ranking signal — subtle but visible */}
        {ranking && (
          <div style={{
            fontSize: 10.5, color: 'rgba(255,255,255,0.30)',
            marginBottom: 6,
          }}>
            {ranking}
          </div>
        )}

        {/* Grouping indicator */}
        {groupNote && (
          <div style={{
            fontSize: 10.5, color: 'rgba(255,255,255,0.25)',
            marginBottom: 6,
          }}>
            {groupNote}
          </div>
        )}

        {/* Reason lines — supporting data */}
        {reasonLines.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            {reasonLines.map((line, i) => (
              <div key={i} style={{
                fontSize: 11.5, color: 'rgba(255,255,255,0.50)',
                lineHeight: 1.55,
              }}>
                {line}
              </div>
            ))}
          </div>
        )}

        {/* 4. SUPPORTING DATA — metrics */}
        {decision.metrics && decision.metrics.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 10,
            borderTop: '1px solid rgba(230,237,243,0.04)',
            paddingTop: 8,
          }}>
            {decision.metrics.map((m, i) => (
              <div key={i} style={{
                background: 'rgba(230,237,243,0.02)',
                border: '1px solid rgba(230,237,243,0.04)',
                borderRadius: 2, padding: '3px 7px', fontSize: 10.5,
                display: 'flex', alignItems: 'baseline', gap: 3,
              }}>
                <span style={{ color: '#8B949E', fontWeight: 500 }}>{m.key}</span>
                <span style={{
                  color: m.trend === 'down' ? '#D63B3B' : m.trend === 'up' ? '#2D9B6E' : '#8B949E',
                  fontWeight: 600, fontSize: 11,
                }}>
                  {m.value}
                </span>
                {m.context && (
                  <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 9.5 }}>
                    {m.context}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action recommendation — "decision box" */}
        {recItems.length > 0 && (
          <div style={{
            background: 'rgba(230,237,243,0.04)',
            border: '1px solid rgba(230,237,243,0.07)',
            borderLeft: `3px solid ${cfg.border}`,
            borderRadius: 3,
            padding: '12px 14px',
            marginBottom: 10,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.50)',
              letterSpacing: '0.10em', marginBottom: 7,
            }}>
              PRÓXIMA AÇÃO RECOMENDADA
            </div>
            {recItems.map((item, i) => (
              <div key={i} style={{
                fontSize: 11.5, color: 'rgba(255,255,255,0.65)',
                lineHeight: 1.6, paddingLeft: 2,
              }}>
                · {item}
              </div>
            ))}
          </div>
        )}

        {/* Micro-trigger: urgency on kill cards */}
        {decision.type === 'kill' && decision.status === 'pending' && decision.impact_daily > 0 && (
          <div style={{
            fontSize: 10, color: 'rgba(180,35,42,0.60)',
            fontWeight: 500, marginBottom: 8,
          }}>
            Cada hora ativo mantém esse nível de perda
          </div>
        )}

        {/* 3. ACTION — buttons + feedback */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
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
                    borderRadius: 3,
                    padding: isPrimary ? '7px 16px' : '5px 11px',
                    fontSize: isPrimary ? 11.5 : 10.5,
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
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.18)' }}>Sem ações</span>
          )}

          {/* Reassurance — always visible near destructive actions */}
          {isDestructive && !actionFeedback && (
            <span style={{
              fontSize: 10, color: 'rgba(255,255,255,0.20)',
              marginLeft: 4,
            }}>
              Pode ser desfeito a qualquer momento
            </span>
          )}

          {/* PART 6: Inline feedback */}
          {actionFeedback && (
            <span style={{
              fontSize: 11, fontWeight: 500, marginLeft: 4,
              color: actionFeedback.type === 'success' ? '#2D9B6E' : '#D63B3B',
            }}>
              {actionFeedback.msg}
            </span>
          )}
        </div>
      </div>
    </>
  );
};
