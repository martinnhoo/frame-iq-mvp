import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Decision, DecisionAction, ImpactConfidence } from '../../types/v2-database';
import { formatMoney, timeAgo } from '../../lib/format';
import { ConfirmModal } from './ConfirmModal';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

// ── Text hierarchy ──
const L1 = "#F0F6FC";
const L2 = "rgba(255,255,255,0.70)";
const L3 = "rgba(255,255,255,0.40)";

interface DecisionCardProps {
  decision: Decision;
  onAction: (decisionId: string, action: DecisionAction) => Promise<void>;
  isDemo?: boolean;
  isHero?: boolean;
}

const TYPE_CONFIG: Record<string, {
  accentColor: string; label: string;
  btnBg: string; btnHover: string;
  confirmTitle: string; impactLabel: string;
}> = {
  kill: {
    accentColor: '#EF4444', label: 'STOP LOSS',
    btnBg: '#DC2626', btnHover: '#B91C1C',
    confirmTitle: 'Confirmar pausa', impactLabel: 'perda/dia',
  },
  fix: {
    accentColor: '#F59E0B', label: 'CORRIGIR',
    btnBg: '#D97706', btnHover: '#B45309',
    confirmTitle: 'Confirmar ação', impactLabel: 'recuperável/dia',
  },
  scale: {
    accentColor: '#38BDF8', label: 'ESCALAR',
    btnBg: '#0EA5E9', btnHover: '#0284C7',
    confirmTitle: 'Confirmar escala', impactLabel: 'oportunidade/dia',
  },
  pattern: {
    accentColor: '#A78BFA', label: 'PADRÃO',
    btnBg: '#8B5CF6', btnHover: '#7C3AED',
    confirmTitle: 'Confirmar ação', impactLabel: '',
  },
  insight: {
    accentColor: '#94A3B8', label: 'INSIGHT',
    btnBg: '#475569', btnHover: '#334155',
    confirmTitle: 'Confirmar ação', impactLabel: '',
  },
  alert: {
    accentColor: '#FBBF24', label: 'ALERTA',
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

// ── Animated expand/collapse wrapper ──
// Always renders children (hidden when collapsed) so ref is always available
const Expandable: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [settled, setSettled] = useState(!open); // true when fully collapsed

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    if (open) {
      setSettled(false);
      // Measure → animate to full height → settle at auto
      const h = el.scrollHeight;
      setHeight(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(h));
      });
      const timer = setTimeout(() => setHeight(-1), 250); // -1 = "auto" sentinel
      return () => clearTimeout(timer);
    } else {
      // Capture current height → animate to 0 → mark settled
      setHeight(el.scrollHeight);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0));
      });
      const timer = setTimeout(() => setSettled(true), 250);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const isAuto = open && height === -1;

  return (
    <div style={{
      height: isAuto ? 'auto' : height,
      overflow: 'hidden',
      transition: isAuto ? 'none' : 'height 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease',
      opacity: open ? 1 : 0,
      pointerEvents: open ? 'auto' : 'none',
    }}>
      <div ref={contentRef}>
        {children}
      </div>
    </div>
  );
};

export const DecisionCard: React.FC<DecisionCardProps> = ({ decision, onAction, isDemo = false, isHero = false }) => {
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [confirmAction, setConfirmAction] = useState<DecisionAction | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [pressing, setPressing] = useState(false);
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

  const recItems: string[] = [];
  if (actionRec) {
    const colonIdx = actionRec.indexOf(':');
    if (colonIdx > -1) {
      const items = actionRec.slice(colonIdx + 1).split(',').map(s => s.trim()).filter(Boolean);
      recItems.push(...items);
    }
    if (recItems.length === 0) recItems.push(actionRec);
  }

  const moneySize = isHero ? 28 : 22;
  const headlineSize = isHero ? 15 : 13.5;

  // Determine if there's enough "deep" content worth expanding
  const hasDeepContent = reasonLines.length > 1 || recItems.length > 0 ||
    (decision as any).pattern_ref || (decision as any).prediction ||
    (decision.metrics && decision.metrics.length > 0);

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
          background: hovered ? '#0D1117' : 'transparent',
          borderLeft: `2px solid ${cfg.accentColor}`,
          padding: isHero ? '16px 18px' : '14px 16px',
          fontFamily: F,
          transition: 'background 0.15s ease, transform 0.1s ease',
          position: 'relative',
          cursor: hasDeepContent ? 'pointer' : 'default',
          transform: pressing ? 'scale(0.995)' : 'scale(1)',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressing(false); }}
        onMouseDown={() => { if (hasDeepContent) setPressing(true); }}
        onMouseUp={() => setPressing(false)}
        onClick={(e) => {
          // Don't toggle if clicking a button or link
          if ((e.target as HTMLElement).closest('button')) return;
          if (hasDeepContent) setExpanded(prev => !prev);
        }}
      >
        {/* Row 1: Type label + confidence + expand indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 9.5, fontWeight: 800, color: cfg.accentColor,
              letterSpacing: '0.08em', lineHeight: '14px',
            }}>
              {cfg.label}
            </span>
            {decision.score > 0 && (
              <span style={{ color: L3, fontSize: 10, fontWeight: 600 }}>
                {Math.round(decision.score)}
              </span>
            )}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          }}>
            <div style={{
              fontSize: 10, color: L3,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: confidence === 'high' ? '#38BDF8' : confidence === 'medium' ? '#FBBF24' : '#94A3B8',
              }} />
              {basisText.toLowerCase()}
            </div>
            {hasDeepContent && (
              <span style={{
                fontSize: 14, color: L3, lineHeight: 1,
                transition: 'transform 0.2s ease, opacity 0.15s',
                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                opacity: hovered ? 0.8 : 0.3,
              }}>
                ›
              </span>
            )}
          </div>
        </div>

        {/* Context breadcrumb */}
        {contextLine && (
          <div style={{
            fontSize: 10.5, color: L3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginBottom: 8,
          }}>
            {contextLine}
          </div>
        )}

        {/* MONEY — always visible (collapsed state) */}
        {decision.impact_daily > 0 && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{
                fontSize: moneySize, fontWeight: 800,
                color: decision.type === 'scale' ? '#38BDF8' : decision.type === 'kill' ? '#EF4444' : '#F59E0B',
                fontFamily: F, letterSpacing: '-0.04em', lineHeight: 1,
              }}>
                {decision.type === 'scale' ? '+' : '-'}{formatMoney(decision.impact_daily)}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: L3, fontFamily: F }}>
                /{cfg.impactLabel}
              </span>
            </div>
            {has7dProjection && (
              <div style={{ fontSize: 11, fontWeight: 500, marginTop: 3, color: L3 }}>
                7d: {decision.type === 'scale' ? '+' : '-'}{formatMoney(decision.impact_7d)}
              </div>
            )}
          </div>
        )}

        {/* HEADLINE — always visible (collapsed state) */}
        <div style={{
          fontSize: headlineSize, fontWeight: 700, color: L1,
          margin: '0 0 5px', lineHeight: 1.35, letterSpacing: '-0.01em',
          overflowWrap: 'break-word', wordBreak: 'break-word',
        }}>
          {decision.headline}
        </div>

        {groupNote && (
          <div style={{ fontSize: 11, color: L3, marginBottom: 5 }}>
            {groupNote}
          </div>
        )}

        {/* First reason line — always visible as summary */}
        {reasonLines.length > 0 && (
          <div style={{
            fontSize: 12, color: L2, lineHeight: 1.55, marginBottom: hasDeepContent && !expanded ? 4 : 8,
          }}>
            {reasonLines[0]}
          </div>
        )}

        {/* ═══ EXPANDABLE DEEP CONTENT ═══ */}
        <Expandable open={expanded}>
          <div style={{ paddingTop: 4 }}>
            {/* STRUCTURED EVIDENCE */}
            {((decision as any).pattern_ref || (decision as any).prediction) ? (
              <div style={{ marginBottom: 8 }}>
                {(decision as any).pattern_ref && (
                  <div style={{
                    borderLeft: '2px solid rgba(167,139,250,0.35)',
                    paddingLeft: 10, marginBottom: 5,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#A78BFA', letterSpacing: '0.10em' }}>PADRÃO</span>
                      {(decision as any).pattern_ref.impact_pct && (
                        <span style={{
                          fontSize: 10.5, fontWeight: 700,
                          color: (decision as any).pattern_ref.is_winner ? '#38BDF8' : '#F87171',
                        }}>
                          {(decision as any).pattern_ref.impact_pct}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#C4B5FD', fontWeight: 600, lineHeight: 1.4 }}>
                      {(decision as any).pattern_ref.insight}
                    </div>
                  </div>
                )}

                {(decision as any).prediction && (
                  <div style={{
                    borderLeft: '2px solid rgba(56,189,248,0.35)',
                    paddingLeft: 10, marginBottom: 5,
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#38BDF8', letterSpacing: '0.10em', marginBottom: 3 }}>
                      PREVISÃO
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 11.5, color: L3 }}>
                        {(decision as any).prediction.current_value}
                      </span>
                      <span style={{ fontSize: 11.5, color: L3 }}>→</span>
                      <span style={{ fontSize: 12, color: '#38BDF8', fontWeight: 700 }}>
                        {(decision as any).prediction.expected_value}
                      </span>
                    </div>
                    {(decision as any).prediction.estimated_impact && (
                      <div style={{ fontSize: 12.5, color: '#38BDF8', fontWeight: 700 }}>
                        {(decision as any).prediction.estimated_impact}
                      </div>
                    )}
                  </div>
                )}

                {(decision as any).priority_position && (decision as any).priority_position <= 3 && (
                  <div style={{
                    fontSize: 11, fontWeight: 700, marginBottom: 4,
                    color: (decision as any).priority_position === 1 ? '#FBBF24' : L3,
                  }}>
                    #{(decision as any).priority_position}
                    {(decision as any).priority_position === 1 && ' — Ação mais importante agora'}
                  </div>
                )}

                {(decision as any).urgency && (
                  <div style={{ fontSize: 11, color: '#F87171', fontWeight: 500, marginBottom: 4 }}>
                    {(decision as any).urgency.message}
                  </div>
                )}

                {reasonLines.length > 1 && (
                  <div style={{ marginTop: 3 }}>
                    {reasonLines.slice(1).filter(l => !l.startsWith('Padrão detectado:')).map((line, i) => (
                      <div key={i} style={{ fontSize: 11.5, color: L2, lineHeight: 1.55 }}>
                        {line}
                      </div>
                    ))}
                  </div>
                )}

                {(decision as any).money_explanation && (
                  <div style={{ fontSize: 10.5, color: L3, marginTop: 3, lineHeight: 1.4 }}>
                    {(decision as any).money_explanation}
                  </div>
                )}
              </div>
            ) : (
              reasonLines.length > 1 && (
                <div style={{ marginBottom: 8 }}>
                  {reasonLines.slice(1).map((line, i) => (
                    <div key={i} style={{ fontSize: 12, color: L2, lineHeight: 1.55 }}>
                      {line}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* METRICS */}
            {decision.metrics && decision.metrics.length > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 10,
                paddingTop: 8,
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}>
                {decision.metrics.map((m, i) => (
                  <div key={i} style={{ fontSize: 11, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ color: L3, fontWeight: 500 }}>{m.key}</span>
                    <span style={{
                      color: m.trend === 'down' ? '#F87171' : m.trend === 'up' ? '#38BDF8' : L2,
                      fontWeight: 700, fontSize: 12,
                    }}>
                      {m.value}
                    </span>
                    {m.context && (
                      <span style={{ color: L3, fontSize: 10 }}>{m.context}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* NEXT STEP */}
            {recItems.length > 0 && (
              <div style={{
                borderLeft: `2px solid ${cfg.accentColor}44`,
                paddingLeft: 10, marginBottom: 8,
              }}>
                <div style={{
                  fontSize: 9.5, fontWeight: 800, color: L3,
                  letterSpacing: '0.10em', marginBottom: 4,
                }}>
                  PRÓXIMO PASSO
                </div>
                {recItems.map((item, i) => (
                  <div key={i} style={{ fontSize: 12, color: L2, lineHeight: 1.6 }}>
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Expandable>

        {/* Kill urgency — always visible */}
        {isDestructive && decision.status === 'pending' && decision.impact_daily > 0 && (
          <div style={{
            fontSize: 10.5, color: 'rgba(248,113,113,0.60)', fontWeight: 500, marginBottom: 6,
          }}>
            Cada hora ativo mantém esse nível de perda
          </div>
        )}

        {/* ACTIONS — visible on hover (desktop) or always (touch) */}
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
          opacity: hovered || expanded || executingId !== null || actionFeedback ? 1 : 0.7,
          transition: 'opacity 0.15s ease',
        }}>
          {decision.actions && decision.actions.length > 0 ? (
            decision.actions.map((action, idx) => {
              const isPrimary = idx === 0;
              const isRunning = executingId === action.id;
              return (
                <button
                  key={action.id}
                  onClick={(e) => { e.stopPropagation(); handleButtonClick(action); }}
                  disabled={executingId !== null}
                  style={{
                    background: isPrimary ? cfg.btnBg : 'rgba(255,255,255,0.04)',
                    color: isPrimary ? '#fff' : L2,
                    border: isPrimary ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 4,
                    padding: isPrimary ? '9px 18px' : '7px 14px',
                    fontSize: isPrimary ? 12.5 : 11.5,
                    fontWeight: isPrimary ? 700 : 600,
                    cursor: executingId !== null ? 'not-allowed' : 'pointer',
                    opacity: executingId !== null && !isRunning ? 0.4 : 1,
                    fontFamily: F,
                    transition: 'all 0.12s ease',
                    letterSpacing: '-0.01em',
                    transform: isRunning ? 'scale(0.97)' : 'scale(1)',
                  }}
                  onMouseEnter={e => {
                    if (!executingId) {
                      if (isPrimary) {
                        (e.currentTarget as HTMLElement).style.background = cfg.btnHover;
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                      } else {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
                      }
                    }
                  }}
                  onMouseLeave={e => {
                    if (isPrimary) {
                      (e.currentTarget as HTMLElement).style.background = cfg.btnBg;
                      (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                    } else {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                    }
                  }}
                >
                  {isRunning ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff',
                        animation: 'dc-spin 0.6s linear infinite',
                        display: 'inline-block',
                      }} />
                      Executando...
                    </span>
                  ) : action.label}
                </button>
              );
            })
          ) : (
            <span style={{ fontSize: 11, color: L3 }}>Sem ações</span>
          )}

          {isDestructive && !actionFeedback && (
            <span style={{ fontSize: 10, color: L3, marginLeft: 2 }}>
              Reversível
            </span>
          )}

          {actionFeedback && (
            <span style={{
              fontSize: 11, fontWeight: 500, marginLeft: 4,
              color: actionFeedback.type === 'success' ? '#4ADE80' : '#F87171',
              animation: 'dc-fadeIn 0.2s ease',
            }}>
              {actionFeedback.type === 'success' && '✓ '}
              {actionFeedback.msg}
            </span>
          )}
        </div>
      </div>

      <style>{`
        @keyframes dc-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes dc-fadeIn{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </>
  );
};
