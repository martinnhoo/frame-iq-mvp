import React, { useState, useCallback } from 'react';
import type { Decision, DecisionAction, ImpactConfidence } from '../../types/v2-database';
import { formatMoney, timeAgo } from '../../lib/format';
import { ConfirmModal } from './ConfirmModal';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

interface DecisionCardProps {
  decision: Decision;
  onAction: (decisionId: string, action: DecisionAction) => Promise<void>;
  isDemo?: boolean;
  isHero?: boolean; // Level 1 — highest priority card
}

// ── Color system: minimal, signal-only ──
// Red = financial risk / loss
// Green = gain / positive outcome
// Blue = action / opportunity
// Amber = caution / fix
// Neutral = everything else
const TYPE_CONFIG: Record<string, {
  accentColor: string; label: string; labelBg: string;
  btnBg: string; btnHover: string;
  confirmTitle: string; impactLabel: string;
}> = {
  kill: {
    accentColor: '#DC2626', label: 'STOP LOSS', labelBg: 'rgba(220,38,38,0.12)',
    btnBg: '#DC2626', btnHover: '#B91C1C',
    confirmTitle: 'Confirmar pausa', impactLabel: 'perda/dia',
  },
  fix: {
    accentColor: '#D97706', label: 'CORRIGIR', labelBg: 'rgba(217,119,6,0.12)',
    btnBg: '#D97706', btnHover: '#B45309',
    confirmTitle: 'Confirmar ação', impactLabel: 'recuperável/dia',
  },
  scale: {
    accentColor: '#0EA5E9', label: 'ESCALAR', labelBg: 'rgba(14,165,233,0.12)',
    btnBg: '#0EA5E9', btnHover: '#0284C7',
    confirmTitle: 'Confirmar escala', impactLabel: 'oportunidade/dia',
  },
  pattern: {
    accentColor: '#8B5CF6', label: 'PADRÃO', labelBg: 'rgba(139,92,246,0.12)',
    btnBg: '#8B5CF6', btnHover: '#7C3AED',
    confirmTitle: 'Confirmar ação', impactLabel: '',
  },
  insight: {
    accentColor: '#64748B', label: 'INSIGHT', labelBg: 'rgba(100,116,139,0.12)',
    btnBg: '#475569', btnHover: '#334155',
    confirmTitle: 'Confirmar ação', impactLabel: '',
  },
  alert: {
    accentColor: '#F59E0B', label: 'ALERTA', labelBg: 'rgba(245,158,11,0.12)',
    btnBg: '#F59E0B', btnHover: '#D97706',
    confirmTitle: 'Confirmar ação', impactLabel: '',
  },
};

function buildConfirmDesc(decision: Decision, action: DecisionAction): string {
  const adName = decision.ad?.name;
  const parts: string[] = [];
  if (action.meta_api_action === 'pause_ad' || action.label.toLowerCase().includes('pausar')) {
    if (decision.impact_daily > 0) parts.push(`≈${formatMoney(decision.impact_daily)}/dia em perdas evitadas.`);
    if (adName) parts.push(`Anúncio: ${adName}`);
    parts.push(''); parts.push('Reversível — reative a qualquer momento.');
  } else if (action.meta_api_action === 'increase_budget') {
    if (decision.impact_daily > 0) parts.push(`Oportunidade: +${formatMoney(decision.impact_daily)}/dia.`);
    if (adName) parts.push(`Anúncio: ${adName}`);
    parts.push(''); parts.push('Reversível — ajuste o budget depois.');
  } else if (action.meta_api_action === 'duplicate_ad') {
    parts.push('Cria cópia no mesmo conjunto.');
    if (adName) parts.push(`Anúncio: ${adName}`);
  } else {
    parts.push(`Ação: ${action.label}`);
    if (adName) parts.push(`Anúncio: ${adName}`);
  }
  return parts.join('\n');
}

export const DecisionCard: React.FC<DecisionCardProps> = ({ decision, onAction, isDemo = false, isHero = false }) => {
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
      let feedbackMsg = 'Ação enviada ao Meta';
      if (action.meta_api_action === 'pause_ad' || action.label.toLowerCase().includes('pausar')) {
        feedbackMsg = decision.impact_daily > 0
          ? `Pausa enviada · ≈${formatMoney(decision.impact_daily)}/dia em perdas evitadas`
          : 'Pausa enviada ao Meta';
      } else if (action.meta_api_action === 'increase_budget') {
        feedbackMsg = 'Ajuste de budget enviado ao Meta';
      } else if (action.meta_api_action === 'duplicate_ad') {
        feedbackMsg = 'Duplicação enviada ao Meta';
      }
      setActionFeedback({ type: 'success', msg: feedbackMsg });
      setTimeout(() => setActionFeedback(null), 5000);
    } catch {
      setActionFeedback({ type: 'error', msg: 'Erro — tente novamente' });
      setTimeout(() => setActionFeedback(null), 4000);
    } finally {
      setExecutingId(null); setConfirmAction(null);
    }
  }, [decision.id, decision.impact_daily, onAction]);

  const handleButtonClick = useCallback((action: DecisionAction) => {
    if (isDemo) {
      setActionFeedback({ type: 'success', msg: 'Demo — conecte sua conta para executar' });
      setTimeout(() => setActionFeedback(null), 2500);
      return;
    }
    if (action.requires_confirmation) setConfirmAction(action);
    else executeAction(action);
  }, [isDemo, executeAction]);

  // Data
  const campaignName = decision.ad?.ad_set?.campaign?.name;
  const adSetName = decision.ad?.ad_set?.name;
  const adName = decision.ad?.name;
  const contextParts: string[] = [];
  if (campaignName) contextParts.push(campaignName);
  if (adSetName) contextParts.push(adSetName);
  if (adName) contextParts.push(adName);
  const contextLine = contextParts.join(' → ') || '';

  const basisText = decision.impact_basis || 'Últimos 3 dias';
  const confidence = (decision.impact_confidence as ImpactConfidence) || 'medium';
  const reasonLines = (decision.reason || '').split('\n').filter(Boolean);
  const has7dProjection = decision.impact_7d > 0 && decision.impact_daily > 0;
  const isDestructive = decision.type === 'kill';
  const actionRec = decision.action_recommendation;
  const groupNote = decision.group_note;

  // Parse recommendation
  const recItems: string[] = [];
  if (actionRec) {
    const colonIdx = actionRec.indexOf(':');
    if (colonIdx > -1) {
      const items = actionRec.slice(colonIdx + 1).split(',').map(s => s.trim()).filter(Boolean);
      recItems.push(...items);
    }
    if (recItems.length === 0) recItems.push(actionRec);
  }

  // Hero sizing
  const moneySize = isHero ? 30 : 22;
  const headlineSize = isHero ? 15 : 13.5;
  const cardPadding = isHero ? '18px 20px' : '14px 16px';

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
          background: hovered ? '#0E1319' : '#0C1017',
          border: `1px solid ${hovered ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'}`,
          borderLeft: `3px solid ${cfg.accentColor}`,
          borderRadius: 4,
          padding: cardPadding,
          fontFamily: F,
          transition: 'all 0.18s ease',
          transform: hovered ? 'translateY(-1px)' : 'none',
          boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.20)' : 'none',
          position: 'relative',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* ── ROW 1: Context breadcrumb + confidence ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          {contextLine && (
            <div style={{
              fontSize: 10, color: 'rgba(255,255,255,0.20)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1, marginRight: 8,
            }}>
              {contextLine}
            </div>
          )}
          <div style={{
            fontSize: 9.5, color: 'rgba(255,255,255,0.20)',
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
          }}>
            <span style={{
              width: 4, height: 4, borderRadius: '50%',
              background: confidence === 'high' ? '#0EA5E9' : confidence === 'medium' ? '#D97706' : '#64748B',
            }} />
            {basisText.toLowerCase()}
          </div>
        </div>

        {/* ── ROW 2: Type badge + active indicator ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              background: cfg.labelBg, color: cfg.accentColor,
              fontSize: 9, fontWeight: 800,
              padding: '3px 7px', borderRadius: 3,
              letterSpacing: '0.10em', lineHeight: '14px',
            }}>
              {cfg.label}
            </span>
            {decision.score > 0 && (
              <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10, fontWeight: 600 }}>
                {Math.round(decision.score)}
              </span>
            )}
          </div>
          {isDestructive && decision.status === 'pending' && (
            <span style={{
              fontSize: 9.5, color: 'rgba(220,38,38,0.55)', fontWeight: 600,
            }}>
              gasto contínuo
            </span>
          )}
        </div>

        {/* ── ROW 3: MONEY — the dominant signal ── */}
        {decision.impact_daily > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{
                fontSize: moneySize, fontWeight: 800,
                color: decision.type === 'scale' ? '#0EA5E9' : decision.type === 'kill' ? '#DC2626' : '#D97706',
                fontFamily: F, letterSpacing: '-0.04em', lineHeight: 1,
              }}>
                {decision.type === 'scale' ? '+' : '-'}{formatMoney(decision.impact_daily)}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.25)',
                fontFamily: F,
              }}>
                /{cfg.impactLabel}
              </span>
            </div>
            {has7dProjection && (
              <div style={{
                fontSize: 11, fontWeight: 500, marginTop: 4,
                color: 'rgba(255,255,255,0.20)',
              }}>
                7d: {decision.type === 'scale' ? '+' : '-'}{formatMoney(decision.impact_7d)}
              </div>
            )}
          </div>
        )}

        {/* ── ROW 4: HEADLINE — what's happening ── */}
        <div style={{
          fontSize: headlineSize, fontWeight: 700, color: '#E6EDF3',
          margin: '0 0 6px', lineHeight: 1.35, letterSpacing: '-0.01em',
        }}>
          {decision.headline}
        </div>

        {/* Group note */}
        {groupNote && (
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.18)', marginBottom: 6 }}>
            {groupNote}
          </div>
        )}

        {/* ── ROW 5: STRUCTURED EVIDENCE ── */}
        {((decision as any).pattern_ref || (decision as any).prediction) ? (
          <div style={{ marginBottom: 10 }}>
            {/* Problem line */}
            {reasonLines[0] && (
              <div style={{
                fontSize: 11.5, color: 'rgba(255,255,255,0.40)', lineHeight: 1.55, marginBottom: 6,
              }}>
                {reasonLines[0]}
              </div>
            )}

            {/* Pattern ref */}
            {(decision as any).pattern_ref && (
              <div style={{
                background: 'rgba(139,92,246,0.05)',
                border: '1px solid rgba(139,92,246,0.10)',
                borderRadius: 3, padding: '8px 10px', marginBottom: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <span style={{
                    fontSize: 8.5, fontWeight: 800, color: '#8B5CF6',
                    letterSpacing: '0.10em',
                  }}>PADRÃO</span>
                  {(decision as any).pattern_ref.impact_pct && (
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: (decision as any).pattern_ref.is_winner ? '#0EA5E9' : '#DC2626',
                    }}>
                      {(decision as any).pattern_ref.impact_pct}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: '#8B5CF6', fontWeight: 600, lineHeight: 1.4 }}>
                  {(decision as any).pattern_ref.insight}
                </div>
              </div>
            )}

            {/* Prediction */}
            {(decision as any).prediction && (
              <div style={{
                background: 'rgba(14,165,233,0.04)',
                border: '1px solid rgba(14,165,233,0.08)',
                borderRadius: 3, padding: '8px 10px', marginBottom: 6,
              }}>
                <div style={{ fontSize: 8.5, fontWeight: 800, color: '#0EA5E9', letterSpacing: '0.10em', marginBottom: 4 }}>
                  PREVISÃO
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                    {(decision as any).prediction.current_value}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.12)' }}>→</span>
                  <span style={{ fontSize: 11.5, color: '#0EA5E9', fontWeight: 700 }}>
                    {(decision as any).prediction.expected_value}
                  </span>
                </div>
                {(decision as any).prediction.estimated_impact && (
                  <div style={{ fontSize: 12, color: '#0EA5E9', fontWeight: 700 }}>
                    {(decision as any).prediction.estimated_impact}
                  </div>
                )}
              </div>
            )}

            {/* Priority */}
            {(decision as any).priority_position && (decision as any).priority_position <= 3 && (
              <div style={{
                fontSize: 10.5, fontWeight: 700, marginBottom: 4,
                color: (decision as any).priority_position === 1 ? '#F59E0B' : 'rgba(255,255,255,0.35)',
              }}>
                #{(decision as any).priority_position}
                {(decision as any).priority_position === 1 && ' — Ação mais importante agora'}
              </div>
            )}

            {/* Urgency */}
            {(decision as any).urgency && (
              <div style={{ fontSize: 10.5, color: 'rgba(220,38,38,0.50)', fontWeight: 500, marginBottom: 4 }}>
                {(decision as any).urgency.message}
              </div>
            )}

            {/* Remaining reason lines */}
            {reasonLines.length > 1 && (
              <div style={{ marginTop: 4 }}>
                {reasonLines.slice(1).filter(l => !l.startsWith('Padrão detectado:')).map((line, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.55 }}>
                    {line}
                  </div>
                ))}
              </div>
            )}

            {/* Money explanation */}
            {(decision as any).money_explanation && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', marginTop: 4, lineHeight: 1.4 }}>
                {(decision as any).money_explanation}
              </div>
            )}
          </div>
        ) : (
          /* Fallback reason lines */
          reasonLines.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {reasonLines.map((line, i) => (
                <div key={i} style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.40)', lineHeight: 1.55 }}>
                  {line}
                </div>
              ))}
            </div>
          )
        )}

        {/* ── METRICS ROW ── */}
        {decision.metrics && decision.metrics.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10,
            borderTop: '1px solid rgba(255,255,255,0.03)',
            paddingTop: 10,
          }}>
            {decision.metrics.map((m, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.03)',
                borderRadius: 3, padding: '4px 8px', fontSize: 10.5,
                display: 'flex', alignItems: 'baseline', gap: 4,
              }}>
                <span style={{ color: 'rgba(255,255,255,0.30)', fontWeight: 500 }}>{m.key}</span>
                <span style={{
                  color: m.trend === 'down' ? '#DC2626' : m.trend === 'up' ? '#0EA5E9' : 'rgba(255,255,255,0.50)',
                  fontWeight: 700, fontSize: 11.5,
                }}>
                  {m.value}
                </span>
                {m.context && (
                  <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 9.5 }}>{m.context}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── RECOMMENDED ACTION BOX ── */}
        {recItems.length > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderLeft: `2px solid ${cfg.accentColor}`,
            borderRadius: 3, padding: '10px 12px', marginBottom: 10,
          }}>
            <div style={{
              fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.30)',
              letterSpacing: '0.10em', marginBottom: 6,
            }}>
              PRÓXIMO PASSO
            </div>
            {recItems.map((item, i) => (
              <div key={i} style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                {item}
              </div>
            ))}
          </div>
        )}

        {/* Kill urgency micro-trigger */}
        {isDestructive && decision.status === 'pending' && decision.impact_daily > 0 && (
          <div style={{
            fontSize: 10, color: 'rgba(220,38,38,0.35)', fontWeight: 500, marginBottom: 8,
          }}>
            Cada hora ativo mantém esse nível de perda
          </div>
        )}

        {/* ── ACTION BUTTONS ── */}
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
                    background: isPrimary ? cfg.btnBg : 'rgba(255,255,255,0.03)',
                    color: isPrimary ? '#fff' : 'rgba(255,255,255,0.45)',
                    border: isPrimary ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 4,
                    padding: isPrimary ? (isHero ? '10px 24px' : '8px 18px') : '6px 12px',
                    fontSize: isPrimary ? 12.5 : 11,
                    fontWeight: isPrimary ? 700 : 600,
                    cursor: executingId !== null ? 'not-allowed' : 'pointer',
                    opacity: executingId !== null && !isRunning ? 0.4 : 1,
                    fontFamily: F,
                    transition: 'all 0.15s ease',
                    letterSpacing: '-0.01em',
                    transform: 'translateY(0)',
                  }}
                  onMouseEnter={e => {
                    if (!executingId) {
                      if (isPrimary) {
                        (e.currentTarget as HTMLElement).style.background = cfg.btnHover;
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px ${cfg.accentColor}33`;
                      } else {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)';
                      }
                    }
                  }}
                  onMouseLeave={e => {
                    if (isPrimary) {
                      (e.currentTarget as HTMLElement).style.background = cfg.btnBg;
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    } else {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                    }
                  }}
                >
                  {isRunning ? 'Executando...' : action.label}
                </button>
              );
            })
          ) : (
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.12)' }}>Sem ações</span>
          )}

          {isDestructive && !actionFeedback && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', marginLeft: 4 }}>
              Reversível
            </span>
          )}

          {actionFeedback && (
            <span style={{
              fontSize: 11, fontWeight: 500, marginLeft: 4,
              color: actionFeedback.type === 'success' ? '#34D399' : '#DC2626',
            }}>
              {actionFeedback.msg}
            </span>
          )}
        </div>
      </div>
    </>
  );
};
