import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Decision, DecisionAction, ImpactConfidence } from '../../types/v2-database';
import { formatMoney, timeAgo } from '../../lib/format';
import { ConfirmModal } from './ConfirmModal';
import { supabase } from '@/integrations/supabase/client';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

// ── Pattern lookup types + helpers (Phase 3 enrichment) ───────────────────
// Same shape & semantics as the chat-card lookup; duplicated locally to
// keep this component self-contained (no shared utility yet because the
// two callers differ enough — chat card derives cause from structured
// hypothesis, Feed card derives from decision.type + signals).

type CardPattern = {
  n: number;
  wins: number;
  success_rate: number;          // 0-1
  avg_recovery_pct: number | null;
  avg_avoided_spend_brl: number | null;
  avg_ctr_before: number | null; // raw 0-1 ratio
};

// Maps the Feed Decision pipeline output to the canonical 12-cause
// taxonomy used in action_outcomes. The Decision Engine doesn't emit
// canonical causes directly (it predates the taxonomy), so we infer:
//   - decision.type narrows the action category (kill / scale / fix / ...)
//   - keyword scan over headline + metrics keys narrows the cause within
// Returns null when nothing maps cleanly — better to skip pattern lookup
// than guess and pollute the comparison.
function deriveCanonicalCause(decision: Decision): string | null {
  const haystack = (
    (decision.headline || '') + ' ' +
    (decision.reason || '') + ' ' +
    (decision.metrics || []).map(m => `${m.key} ${m.value} ${m.context || ''}`).join(' ')
  ).toLowerCase();
  const t = decision.type;

  // Cause priority within each type — first match wins.
  const has = (re: RegExp) => re.test(haystack);

  if (t === 'scale') return 'winning_signal';

  if (t === 'kill') {
    if (has(/fadiga|fatigue|frequ[êe]ncia|frequency|cansa[çc]o|saturad/)) return 'creative_fatigue';
    if (has(/freq\b|freq:|freq\.|frequ[êe]ncia [3-9]|\bfreq [3-9]/)) return 'high_frequency';
    if (has(/cpa\s*(?:alto|acima|elevado|caro)|high\s*cpa/)) return 'high_cpa';
    if (has(/roas\s*(?:baix|caiu|abaixo|fraco)|low\s*roas/)) return 'low_roas';
    if (has(/ctr\s*(?:baix|caiu|abaixo|fraco|0[.,]\d|\b0%|\b1%)/)) return 'low_ctr';
    if (has(/track|pixel|atribui|conversion(?:\s+gap)?/)) return 'tracking_gap';
    return 'spend_waste'; // sensible default for kill
  }

  if (t === 'fix') {
    if (has(/ctr\s*(?:baix|caiu|abaixo|fraco)|low\s*ctr/)) return 'low_ctr';
    if (has(/cpa\s*(?:alto|acima|elevado|caro)|high\s*cpa/)) return 'high_cpa';
    if (has(/roas\s*(?:baix|caiu|abaixo|fraco)|low\s*roas/)) return 'low_roas';
    if (has(/budget\s*(?:baix|insuficient|sub-?escal)|budget\s*starv/)) return 'budget_starvation';
    if (has(/p[úu]blico|audi[êe]ncia|targeting|audience/)) return 'wrong_audience';
    if (has(/aprendizado|learning|early\s*phase/)) return 'learning_phase';
    if (has(/hook|primeiros\s*\d+s/)) return 'low_hook_strength';
    return 'low_ctr'; // most common fix scenario
  }

  return null; // pattern, insight, alert — no fixed action mapping
}

// Maps the Decision's primary action (first item in decision.actions[])
// to the action_type enum stored in action_outcomes. Returns null when
// the action isn't represented in the enum (e.g. read-only or alert).
function deriveActionType(decision: Decision): string | null {
  const action = decision.actions?.[0];
  if (!action) return null;
  const meta = action.meta_api_action;
  if (!meta) return null;
  // Direct passthrough — these enum values match action_outcomes.
  if (meta === 'pause_ad' || meta === 'pause_adset' || meta === 'pause_campaign') return meta;
  if (meta === 'enable_ad' || meta === 'enable_adset' || meta === 'enable_campaign') return meta;
  if (meta === 'increase_budget') return 'budget_increase';
  if (meta === 'decrease_budget') return 'budget_decrease';
  if (meta === 'duplicate_ad') return 'duplicate_ad';
  return null;
}

// PT-BR labels for canonical causes — parallels the chat card's CAUSE_LABELS.
const CAUSE_LABEL_PT: Record<string, string> = {
  creative_fatigue: 'fadiga criativa',
  low_hook_strength: 'hook fraco',
  wrong_audience: 'público errado',
  budget_starvation: 'budget insuficiente',
  tracking_gap: 'tracking quebrado',
  high_cpa: 'CPA alto',
  low_ctr: 'CTR baixo',
  low_roas: 'ROAS baixo',
  spend_waste: 'desperdício de spend',
  winning_signal: 'winner detectado',
  high_frequency: 'frequência alta',
  learning_phase: 'fase de aprendizado',
  low_intent_leads: 'leads sem intenção real',
};

// ── Text hierarchy ──
const L1 = "#F0F6FC";
const L2 = "rgba(255,255,255,0.70)";
const L3 = "rgba(255,255,255,0.40)";

interface DecisionCardProps {
  decision: Decision;
  onAction: (decisionId: string, action: DecisionAction) => Promise<void>;
  isDemo?: boolean;
  isHero?: boolean;
  /** Compact rendering for inline use (chat bubbles, etc). Tighter
   *  padding, no expanded footer, but every action and signal is
   *  preserved 1:1 with the Feed render. Same component, same logic. */
  compact?: boolean;
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

export const DecisionCard: React.FC<DecisionCardProps> = ({ decision, onAction, isDemo = false, isHero = false, compact = false }) => {
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [confirmAction, setConfirmAction] = useState<DecisionAction | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [pressing, setPressing] = useState(false);
  const cfg = TYPE_CONFIG[decision.type] || TYPE_CONFIG.insight;

  // ── Phase 3 enrichment: derived cause + pattern lookup ─────────────────
  // Self-fetched userId via supabase.auth — avoids prop drilling through
  // the 4 different render sites of DecisionCard. One auth call per card
  // mount is cheap and cached by the supabase client.
  const [userId, setUserId] = useState<string | null>(null);
  const [pattern, setPattern] = useState<CardPattern | null>(null);
  const [patternLoading, setPatternLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  // Cause + action_type derivation runs on every render (cheap, pure).
  // Memoize-by-id implicitly via React's render flow — no useMemo needed.
  const derivedCause = deriveCanonicalCause(decision);
  const derivedActionType = deriveActionType(decision);

  // Pattern lookup — fires when we have user + cause + action_type. Same
  // filter as the chat card and the chat-prompt aggregator: finalized +
  // pattern_candidate + improved IS NOT NULL, scoped to this user's
  // (action_type × primary_cause) bucket.
  useEffect(() => {
    if (isDemo) {
      // Demo mode shouldn't query real data — show a synthetic pattern
      // so the card still demonstrates the section visually.
      setPattern({ n: 4, wins: 4, success_rate: 1, avg_recovery_pct: 62, avg_avoided_spend_brl: 87.5, avg_ctr_before: 0.013 });
      setPatternLoading(false);
      return;
    }
    if (!userId || !derivedCause || !derivedActionType) {
      setPatternLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // action_outcomes isn't in v2-database types (separate outcomes
        // domain). Cast the client to skip the schema check; we narrow the
        // returned rows below with OutcomeRow.
        type OutcomeRow = {
          improved: boolean | null;
          recovery_pct: number | null;
          context: { avoided_spend_brl?: number } | null;
          metrics_before: { ctr?: number } | null;
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('action_outcomes')
          .select('improved, recovery_pct, context, metrics_before')
          .eq('user_id', userId)
          .eq('action_type', derivedActionType)
          .eq('pattern_candidate', true)
          .eq('finalized', true)
          .not('improved', 'is', null)
          .filter('hypothesis->>primary_cause', 'eq', derivedCause)
          .order('taken_at', { ascending: false })
          .limit(50);
        if (cancelled) return;
        if (error || !data || data.length === 0) {
          setPattern(null);
          setPatternLoading(false);
          return;
        }
        const rows = data as OutcomeRow[];
        const wins = rows.filter(r => r.improved === true).length;
        const n = rows.length;
        const recoveries = rows
          .filter(r => r.improved === true && typeof r.recovery_pct === 'number')
          .map(r => Number(r.recovery_pct));
        const avoided = rows
          .filter(r => r.improved === true)
          .map(r => Number(r.context?.avoided_spend_brl))
          .filter(x => Number.isFinite(x) && x > 0);
        const ctrs = rows
          .map(r => Number(r.metrics_before?.ctr))
          .filter(x => Number.isFinite(x) && x >= 0);
        setPattern({
          n,
          wins,
          success_rate: n > 0 ? wins / n : 0,
          avg_recovery_pct: recoveries.length
            ? Math.round((recoveries.reduce((a, b) => a + b, 0) / recoveries.length) * 10) / 10
            : null,
          avg_avoided_spend_brl: avoided.length
            ? Math.round((avoided.reduce((a, b) => a + b, 0) / avoided.length) * 100) / 100
            : null,
          avg_ctr_before: ctrs.length
            ? Math.round((ctrs.reduce((a, b) => a + b, 0) / ctrs.length) * 10000) / 10000
            : null,
        });
      } catch {
        if (!cancelled) setPattern(null);
      } finally {
        if (!cancelled) setPatternLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, derivedCause, derivedActionType, isDemo]);

  // Similarity check — compares current target's CTR with the bucket's
  // historical avg_ctr_before. If both are known and within ±0.5pp, the
  // present scenario looks like the past wins → pattern is strong signal.
  // If they diverge, surface a caution badge.
  const currentCtr: number | null = (() => {
    const lm = decision.ad?.latest_metrics;
    const v = Number(lm?.ctr);
    return Number.isFinite(v) && v >= 0 ? v : null;
  })();
  const similarity: 'match' | 'mismatch' | 'unknown' = (() => {
    if (!pattern?.avg_ctr_before || currentCtr === null) return 'unknown';
    const diffPp = Math.abs((currentCtr - pattern.avg_ctr_before) * 100);
    return diffPp <= 0.5 ? 'match' : 'mismatch';
  })();

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

  // ── Pipeline v2 data ──
  const hasPipeline = !!decision.pipeline_mode && decision.pipeline_mode !== 'v1';
  const pipelineConfidence = decision.data_confidence;
  const riskLevel = decision.risk_level;
  const financialVerdict = decision.financial_verdict;
  const safetyStatus = decision.safety_status;
  const explanationChain = decision.explanation_chain;
  const pipelineApproved = decision.pipeline_approved;
  const confidenceGate = decision.confidence_gate;
  const breakEvenRoas = decision.break_even_roas;
  const marginOfSafety = decision.margin_of_safety;

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
    decision.pattern_ref || decision.prediction ||
    (decision.metrics && decision.metrics.length > 0) ||
    (hasPipeline && explanationChain);

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
          // Width discipline. Without these, AI-generated long sentences
          // (especially with URLs / numbers / arrows like "spend r$137
          // → projeção +300% = r$548/dia") were pushing the card wider
          // than its parent, leaking past the chat container's right
          // edge. min-width:0 is the critical bit — flex items default
          // to min-width:auto which refuses to shrink below content
          // size, defeating any max-width on a parent. Combined with
          // overflowWrap + wordBreak this guarantees the card stays
          // within its column at any text length.
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box' as const,
          overflowWrap: 'break-word' as const,
          wordBreak: 'break-word' as const,
          background: hovered ? '#0D1117' : 'transparent',
          borderLeft: `2px solid ${cfg.accentColor}`,
          padding: compact ? '12px 14px' : isHero ? '16px 18px' : '14px 16px',
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
            {/* Pipeline confidence % — muted palette + sonar pulse.
                The bright amber/orange (#FBBF24, #F97316) jumped out
                as classic "tutorial app" yellow next to the rest of
                the card. Replaced with the same warm-tan / cool-cyan /
                neutral set used by the CONFIANÇA badge below so the
                two indicators read as one consistent design language.
                The dot also gets a sonar pulse (functional, not
                decorative): communicates "the system is measuring this
                signal right now, continuously" — kills the contradiction
                of static cards that claim live measurement. */}
            {hasPipeline && pipelineConfidence != null ? (
              <div style={{
                fontSize: 10, color: L3,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{
                  position: 'relative',
                  width: 5, height: 5,
                  flexShrink: 0,
                  display: 'inline-block',
                }}>
                  <span
                    aria-hidden
                    className="dc-conf-sonar"
                    style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      background: pipelineConfidence >= 0.70 ? '#7BC4D8'
                        : pipelineConfidence >= 0.50 ? '#D9B26B'
                        : pipelineConfidence >= 0.30 ? '#C9805A'
                        : '#94A3B8',
                    }}
                  />
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      background: pipelineConfidence >= 0.70 ? '#7BC4D8'
                        : pipelineConfidence >= 0.50 ? '#D9B26B'
                        : pipelineConfidence >= 0.30 ? '#C9805A'
                        : '#94A3B8',
                      boxShadow: pipelineConfidence >= 0.70 ? '0 0 4px rgba(123,196,216,0.40)' : 'none',
                    }}
                  />
                </span>
                <span style={{ fontWeight: 600 }}>{Math.round(pipelineConfidence * 100)}%</span>
              </div>
            ) : (
              <div style={{
                fontSize: 10, color: L3,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{
                  position: 'relative',
                  width: 5, height: 5,
                  flexShrink: 0,
                  display: 'inline-block',
                }}>
                  <span
                    aria-hidden
                    className="dc-conf-sonar"
                    style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      background: confidence === 'high' ? '#7BC4D8'
                        : confidence === 'medium' ? '#D9B26B'
                        : '#94A3B8',
                    }}
                  />
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      background: confidence === 'high' ? '#7BC4D8'
                        : confidence === 'medium' ? '#D9B26B'
                        : '#94A3B8',
                    }}
                  />
                </span>
                {basisText.toLowerCase()}
              </div>
            )}
            {/* Risk badge — only for pipeline v2 */}
            {hasPipeline && riskLevel && (
              <span style={{
                fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em',
                padding: '1px 5px', borderRadius: 2,
                background: riskLevel === 'safe' ? 'rgba(74,222,128,0.12)' : riskLevel === 'moderate' ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)',
                color: riskLevel === 'safe' ? '#4ADE80' : riskLevel === 'moderate' ? '#FBBF24' : '#F87171',
              }}>
                {riskLevel === 'safe' ? 'SEGURO' : riskLevel === 'moderate' ? 'MODERADO' : 'ALTO RISCO'}
              </span>
            )}
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

        {/* Context breadcrumb — let it wrap. Previously had
            whiteSpace:nowrap + textOverflow:ellipsis which truncated
            substantive content (spend projections, math) with "...".
            For a card pretending to "show its math", silently hiding
            half the math contradicted the affordance. Wraps now;
            line-height kept tight so two lines stay readable. */}
        {contextLine && (
          <div style={{
            fontSize: 10.5, color: L3,
            lineHeight: 1.45,
            marginBottom: 8,
            wordBreak: 'break-word' as const,
            overflowWrap: 'break-word' as const,
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

        {/* CONFIDENCE BADGE — explicit "CONFIANÇA: Alta/Média/Baixa".
            The dot+percent in the top row was too subtle for users to
            anchor a clicking decision on. This is a verbal commitment:
            the system tells you how sure it is, in plain words, before
            you act. Derived from impact_confidence (high/medium/low).
            Dot also pulses (sonar) for high/medium — same signal as the
            top-row %: "this confidence reading is live, the system is
            re-measuring continuously". Low confidence: still dot — no
            point pulsing what we're not sure about. */}
        {decision.impact_confidence && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginBottom: 6,
            fontSize: 9.5, fontWeight: 700,
            letterSpacing: '0.10em',
            color: confidence === 'high' ? '#7BC4D8'
              : confidence === 'medium' ? '#D9B26B'
              : 'rgba(240,246,252,0.50)',
          }}>
            <span style={{
              position: 'relative',
              width: 5, height: 5,
              flexShrink: 0,
              display: 'inline-block',
            }}>
              {confidence !== 'low' && (
                <span
                  aria-hidden
                  className="dc-conf-sonar"
                  style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: confidence === 'high' ? '#7BC4D8' : '#D9B26B',
                  }}
                />
              )}
              <span
                aria-hidden
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: confidence === 'high' ? '#7BC4D8'
                    : confidence === 'medium' ? '#D9B26B'
                    : 'rgba(240,246,252,0.42)',
                }}
              />
            </span>
            CONFIANÇA: {confidence === 'high' ? 'ALTA' : confidence === 'medium' ? 'MÉDIA' : 'BAIXA'}
          </div>
        )}

        {/* TRAIT CHIPS — always visible scan row (top 3 metrics, non-empty) */}
        {decision.metrics && decision.metrics.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6,
            marginBottom: 8, marginTop: 4,
          }}>
            {decision.metrics.slice(0, 3).map((m, i) => {
              const trendColor = m.trend === 'down' ? '#F87171'
                : m.trend === 'up' ? '#38BDF8'
                : L2;
              return (
                <span key={i} style={{
                  fontSize: 10.5, fontWeight: 600,
                  color: trendColor,
                  background: 'rgba(255,255,255,0.035)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 999,
                  padding: '2px 8px',
                  lineHeight: 1.35,
                  fontFamily: F,
                  letterSpacing: '-0.005em',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ color: L3, fontWeight: 500 }}>{m.key}</span>
                  <span>{m.value}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* HISTÓRICO NESTA CONTA — Phase 3 enrichment.
            Always-visible section that materializes the moat: what's the
            track record of this exact (action × cause) pair on THIS user's
            account? Three states, all honest:
              loading                   → tiny spinner-style label
              n=0 / no derivable cause  → "Primeira vez testando aqui"
              1 ≤ n < 3                 → "X caso(s) — sinal inicial"
              n >= 3                    → progress bar + similarity badge

            We render the whole block (instead of conditionally hiding) so
            the structural rhythm of the card stays consistent — the user's
            eye can rely on this section being there. */}
        {(derivedCause && derivedActionType) && (
          <div style={{
            marginBottom: 8, marginTop: 2,
            padding: '8px 10px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 4,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 5, gap: 8,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 800, color: L3,
                letterSpacing: '0.10em', textTransform: 'uppercase' as const,
              }}>
                Histórico nesta conta
              </span>
              {/* Causa chip — small, always shown when derivable */}
              <span style={{
                fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.55)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 99, padding: '2px 7px',
                whiteSpace: 'nowrap' as const,
                fontVariantNumeric: 'tabular-nums' as const,
                letterSpacing: '-0.005em',
              }}>
                causa: {CAUSE_LABEL_PT[derivedCause] || derivedCause}
              </span>
            </div>

            {patternLoading ? (
              <div style={{ fontSize: 11, color: L3, fontStyle: 'italic' as const }}>
                buscando padrão…
              </div>
            ) : !pattern || pattern.n === 0 ? (
              <div style={{ fontSize: 11.5, color: L2, lineHeight: 1.5 }}>
                <span style={{ color: L3, marginRight: 4 }}>○</span>
                Primeira vez testando esse padrão aqui — recomendação baseada só no diagnóstico atual.
              </div>
            ) : pattern.n < 3 ? (
              <div style={{ fontSize: 11.5, color: L2, lineHeight: 1.5 }}>
                <span style={{ color: L3, marginRight: 4 }}>○</span>
                {pattern.n} caso{pattern.n === 1 ? '' : 's'} até agora — sinal inicial, não conclusivo.
              </div>
            ) : (
              <>
                {/* Visual bar + count — wins / total. */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
                }}>
                  <div style={{
                    flex: 1, height: 4, borderRadius: 2, maxWidth: 160,
                    background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, Math.round(pattern.success_rate * 100))}%`,
                      background: pattern.success_rate >= 0.7 ? '#34D399'
                        : pattern.success_rate >= 0.4 ? '#FBBF24' : '#F87171',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: pattern.success_rate >= 0.7 ? '#34D399'
                      : pattern.success_rate >= 0.4 ? '#FBBF24' : '#F87171',
                    fontVariantNumeric: 'tabular-nums' as const,
                  }}>
                    {pattern.wins}/{pattern.n}
                  </span>
                  <span style={{ fontSize: 10.5, color: L3, fontVariantNumeric: 'tabular-nums' as const }}>
                    ({Math.round(pattern.success_rate * 100)}%)
                  </span>
                </div>
                {/* Similarity badge — surfaces context match/mismatch when
                    we know both the historical avg and the current CTR. */}
                {pattern.avg_ctr_before !== null && (
                  similarity === 'match' ? (
                    <div style={{ fontSize: 11, color: '#4ADE80', fontWeight: 500, lineHeight: 1.4 }}>
                      ✓ Cenário muito semelhante (CTR pré ~{(pattern.avg_ctr_before * 100).toFixed(2)}%)
                    </div>
                  ) : similarity === 'mismatch' ? (
                    <div style={{ fontSize: 11, color: '#FBBF24', fontWeight: 500, lineHeight: 1.4 }}>
                      ⚠ Cenário diferente — funcionou com CTR ~{(pattern.avg_ctr_before * 100).toFixed(2)}%, atual ~{((currentCtr ?? 0) * 100).toFixed(2)}%
                    </div>
                  ) : (
                    <div style={{ fontSize: 10.5, color: L3, fontWeight: 500, lineHeight: 1.4 }}>
                      Contexto típico de sucesso: CTR ~{(pattern.avg_ctr_before * 100).toFixed(2)}%
                    </div>
                  )
                )}
                {/* Avoided spend — only when historical bucket has it. */}
                {pattern.avg_avoided_spend_brl !== null && (
                  <div style={{ fontSize: 10.5, color: L3, marginTop: 3 }}>
                    Spend evitado médio: R${pattern.avg_avoided_spend_brl.toFixed(2)}/ação
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Financial verdict bar — pipeline v2 */}
        {hasPipeline && financialVerdict && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
            padding: '5px 8px', borderRadius: 4,
            background: financialVerdict === 'losing' ? 'rgba(248,113,113,0.06)' :
                        financialVerdict === 'profitable' ? 'rgba(74,222,128,0.06)' :
                        'rgba(255,255,255,0.03)',
          }}>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
              color: financialVerdict === 'losing' ? '#F87171' :
                     financialVerdict === 'profitable' ? '#4ADE80' :
                     financialVerdict === 'break_even' ? '#FBBF24' : L3,
            }}>
              {financialVerdict === 'losing' ? 'PERDENDO DINHEIRO' :
               financialVerdict === 'profitable' ? 'LUCRATIVO' :
               financialVerdict === 'break_even' ? 'NO BREAK-EVEN' : 'SEM DADOS'}
            </span>
            {breakEvenRoas != null && (
              <span style={{ fontSize: 10, color: L3, fontWeight: 500 }}>
                BE ROAS: {breakEvenRoas.toFixed(1)}x
              </span>
            )}
            {marginOfSafety != null && Math.abs(marginOfSafety) > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: marginOfSafety > 0 ? '#4ADE80' : '#F87171',
              }}>
                {marginOfSafety > 0 ? '+' : ''}{Math.round(marginOfSafety)}% margem
              </span>
            )}
          </div>
        )}

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
            {(decision.pattern_ref || decision.prediction) ? (
              <div style={{ marginBottom: 8 }}>
                {decision.pattern_ref && (
                  <div style={{
                    borderLeft: '2px solid rgba(167,139,250,0.35)',
                    paddingLeft: 10, marginBottom: 5,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#A78BFA', letterSpacing: '0.10em' }}>PADRÃO</span>
                      {decision.pattern_ref.impact_pct && (
                        <span style={{
                          fontSize: 10.5, fontWeight: 700,
                          color: decision.pattern_ref.is_winner ? '#38BDF8' : '#F87171',
                        }}>
                          {decision.pattern_ref.impact_pct}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#C4B5FD', fontWeight: 600, lineHeight: 1.4 }}>
                      {decision.pattern_ref.insight}
                    </div>
                  </div>
                )}

                {decision.prediction && (
                  <div style={{
                    borderLeft: '2px solid rgba(56,189,248,0.35)',
                    paddingLeft: 10, marginBottom: 5,
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#38BDF8', letterSpacing: '0.10em', marginBottom: 3 }}>
                      PREVISÃO
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 11.5, color: L3 }}>
                        {decision.prediction.current_value}
                      </span>
                      <span style={{ fontSize: 11.5, color: L3 }}>→</span>
                      <span style={{ fontSize: 12, color: '#38BDF8', fontWeight: 700 }}>
                        {decision.prediction.expected_value}
                      </span>
                    </div>
                    {decision.prediction.estimated_impact && (
                      <div style={{ fontSize: 12.5, color: '#38BDF8', fontWeight: 700 }}>
                        {decision.prediction.estimated_impact}
                      </div>
                    )}
                  </div>
                )}

                {decision.priority_position && decision.priority_position <= 3 && (
                  <div style={{
                    fontSize: 11, fontWeight: 700, marginBottom: 4,
                    color: decision.priority_position === 1 ? '#FBBF24' : L3,
                  }}>
                    #{decision.priority_position}
                    {decision.priority_position === 1 && ' — Ação mais importante agora'}
                  </div>
                )}

                {decision.urgency && (
                  <div style={{ fontSize: 11, color: '#F87171', fontWeight: 500, marginBottom: 4 }}>
                    {decision.urgency.message}
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

                {decision.money_explanation && (
                  <div style={{ fontSize: 10.5, color: L3, marginTop: 3, lineHeight: 1.4 }}>
                    {decision.money_explanation}
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

            {/* PIPELINE EXPLANATION CHAIN — transparent reasoning */}
            {hasPipeline && explanationChain && (
              <div style={{
                marginBottom: 10, paddingTop: 8,
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 800, color: L3,
                  letterSpacing: '0.10em', marginBottom: 6,
                }}>
                  CADEIA DE DECISÃO
                </div>
                {[
                  { label: 'DADO', value: explanationChain.data_point, color: L2 },
                  { label: 'REGRA', value: explanationChain.threshold, color: L3 },
                  { label: 'FINANCEIRO', value: explanationChain.financial_check, color: financialVerdict === 'losing' ? '#F87171' : financialVerdict === 'profitable' ? '#4ADE80' : L3 },
                  { label: 'SEGURANÇA', value: explanationChain.safety_check, color: safetyStatus === 'approved' ? '#4ADE80' : safetyStatus === 'rejected' ? '#F87171' : L3 },
                  { label: 'VEREDICTO', value: explanationChain.verdict, color: pipelineApproved ? '#38BDF8' : '#F87171' },
                ].map((step, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, marginBottom: 4,
                    alignItems: 'flex-start',
                  }}>
                    <span style={{
                      fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                      color: L3, minWidth: 62, paddingTop: 2, flexShrink: 0,
                    }}>
                      {step.label}
                    </span>
                    <span style={{
                      fontSize: 11, color: step.color, lineHeight: 1.45,
                      wordBreak: 'break-word',
                    }}>
                      {step.value}
                    </span>
                  </div>
                ))}

                {/* Safety details if relevant */}
                {safetyStatus && safetyStatus !== 'approved' && (
                  <div style={{
                    marginTop: 4, padding: '4px 8px', borderRadius: 3,
                    background: safetyStatus === 'rejected' ? 'rgba(248,113,113,0.06)' : 'rgba(251,191,36,0.06)',
                    fontSize: 10, color: safetyStatus === 'rejected' ? '#F87171' : '#FBBF24',
                    fontWeight: 600,
                  }}>
                    {safetyStatus === 'rejected' ? 'Bloqueado pela camada de segurança' :
                     safetyStatus === 'queued' ? 'Na fila — aguardando condições seguras' :
                     safetyStatus === 'needs_gradual' ? 'Escala gradual recomendada' : safetyStatus}
                  </div>
                )}
              </div>
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

        {/* LOSS-OF-INACTION line — shown ONLY for scale/fix decisions
            (not kills, where the loss frame is already explicit on the
            recoverable amount). Quantifies what NOT clicking costs over
            7 days. Pressure that moves intent without crying wolf. */}
        {decision.impact_daily > 0 && (decision.type === 'scale' || decision.type === 'fix') && (
          <div style={{
            margin: '4px 0 8px',
            padding: '6px 10px',
            background: 'rgba(248,113,113,0.05)',
            border: '1px solid rgba(248,113,113,0.18)',
            borderRadius: 6,
            fontSize: 12,
            color: 'rgba(245,165,150,0.92)',
            lineHeight: 1.45,
            fontFamily: F,
            fontWeight: 500,
          }}>
            <span style={{ marginRight: 5, fontWeight: 700 }}>⚠</span>
            Sem ação hoje: ~{formatMoney(decision.impact_daily * 7)} não capturados em 7 dias.
          </div>
        )}

        {/* INVALIDATOR — falsifier surfaced verbatim. Bumped padding +
            font + label intensity so it reads as a real safety net
            ("posso testar sem medo") instead of a tiny footnote. */}
        {decision.invalidator && (
          <div style={{
            margin: '6px 0 12px',
            padding: '10px 12px',
            background: 'rgba(217,178,107,0.07)',
            border: '1px solid rgba(217,178,107,0.28)',
            borderRadius: 8,
            fontSize: 12.5,
            color: 'rgba(240,246,252,0.78)',
            lineHeight: 1.5,
            fontFamily: F,
          }}>
            <div style={{
              fontSize: 9.5, fontWeight: 800,
              letterSpacing: '0.12em',
              color: '#E5C485',
              marginBottom: 3,
            }}>
              QUANDO PARAR
            </div>
            {decision.invalidator}
          </div>
        )}

        {/* ACTIONS — visible on hover (desktop) or always (touch) */}
        <div className="feed-micro-btn" style={{
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
                  ) : (
                    // Primary buttons get a specific suffix with the
                    // money number — turns "Ativar agora" into
                    // "Ativar agora · +R$5/dia". Specific buttons get
                    // clicked more than generic ones; this is the cheapest
                    // way to inject specificity without changing data.
                    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                      {action.label}
                      {isPrimary && decision.impact_daily > 0 && (
                        <span style={{
                          fontSize: 11.5, fontWeight: 600, opacity: 0.82,
                          fontVariantNumeric: 'tabular-nums' as const,
                          letterSpacing: '-0.005em',
                        }}>
                          · {decision.type === 'scale' ? '+' : ''}{formatMoney(decision.impact_daily)}/dia
                        </span>
                      )}
                    </span>
                  )}
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
        /* Sonar pulse on confidence dots — communicates "this signal
           is being re-measured continuously" instead of letting a
           still dot contradict the card's own claim of live tracking. */
        @keyframes dc-conf-sonar {
          0%   { transform: scale(1);   opacity: 0.55; }
          70%  { transform: scale(2.6); opacity: 0.04; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        .dc-conf-sonar { animation: dc-conf-sonar 2.8s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .dc-conf-sonar { animation: none; opacity: 0.25; }
        }
      `}</style>
    </>
  );
};
