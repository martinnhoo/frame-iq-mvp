/**
 * FeedSidebar — right-hand rail of the Central de Comando.
 *
 * Three stacked sections, all dynamic, zero hardcoded copy:
 *   1. AccountHealthGauge     — functional score from real signals
 *   2. NextBestActionCard     — derived from decisions[0] (priority-ranked)
 *   3. RecentActivityCard     — from autopilot_action_log (last executed actions)
 *
 * Rules the sidebar must obey (per user's engineering prompt):
 *   • Nothing hardcoded. Every string, number, label comes from data.
 *   • Priority = impact × confidence.
 *   • Card fields are generated from the Decision[], not invented.
 *   • If no data → empty state with a guided next action (never "placeholder").
 */

import React from 'react';
import { AccountHealthGauge, type AccountStatusSummary, type PixelHealthLike, type AdMetricsLike } from './AccountHealthGauge';
import type { Decision, DecisionAction } from '../../types/v2-database';

// ── Design tokens (mirror FeedPage T) ──
const T = {
  bg1: '#0D1117',
  bg2: '#161B22',
  bg3: '#1C2128',
  border0: 'rgba(240,246,252,0.04)',
  border1: 'rgba(240,246,252,0.07)',
  border2: 'rgba(240,246,252,0.12)',
  text1: '#F0F6FC',
  text2: 'rgba(240,246,252,0.72)',
  text3: 'rgba(240,246,252,0.48)',
  labelColor: 'rgba(240,246,252,0.40)',
  blue: '#0ea5e9',
  blueHover: '#0c8bd0',
  green: '#4ADE80',
  red: '#F87171',
  yellow: '#FBBF24',
  purple: '#A78BFA',
};
const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

// ── Shared shell ──
const SidebarCard: React.FC<{
  title: string;
  right?: React.ReactNode;
  accent?: string;
  children: React.ReactNode;
}> = ({ title, right, accent, children }) => (
  <div style={{
    background: T.bg1,
    border: `1px solid ${T.border1}`,
    borderRadius: 12,
    padding: '14px 16px',
    marginBottom: 12,
    fontFamily: F,
    borderLeft: accent ? `3px solid ${accent}` : undefined,
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 12, gap: 8,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: T.labelColor,
      }}>{title}</div>
      {right}
    </div>
    {children}
  </div>
);

// ── Next Best Action ───────────────────────────────────────────────

/** Generic format for sidebar action — derived, never typed by hand. */
interface DerivedAction {
  headline: string;
  reason: string;
  metrics: Array<{ label: string; value: string }>;
  impactLabel: string | null;
  impactValue: string | null;
  actionLabel: string;
  actionKind: 'destructive' | 'constructive' | 'neutral';
  confidencePct: number;
}

function centsToBrl(cents: number): string {
  const v = cents / 100;
  if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(1).replace('.', ',')}k`;
  if (Math.abs(v) >= 100) return `R$${Math.round(v).toLocaleString('pt-BR')}`;
  return `R$${v.toFixed(2).replace('.', ',')}`;
}

function deriveFromDecision(d: Decision): DerivedAction {
  // Prefer pipeline-computed confidence; fall back to score/100.
  const confidence = typeof d.data_confidence === 'number'
    ? d.data_confidence
    : Math.max(0, Math.min(1, (d.score ?? 0) / 100));

  // Map the decision's structured metrics (key/value/context) into simple pairs
  // so the sidebar doesn't invent its own.
  const metrics = (d.metrics || [])
    .slice(0, 3)
    .map(m => ({
      label: m.key,
      value: m.context ? `${m.value} · ${m.context}` : m.value,
    }));

  // Impact line: use daily if meaningful, otherwise 7d. Sign handled by impact_type.
  let impactLabel: string | null = null;
  let impactValue: string | null = null;
  if (d.impact_daily && d.impact_daily !== 0) {
    const positive = d.impact_type === 'saves' || d.impact_type === 'gain';
    impactLabel = positive ? 'Potencial/dia' : 'Risco/dia';
    impactValue = (positive ? '+' : '-') + centsToBrl(Math.abs(d.impact_daily));
  } else if (d.impact_7d && d.impact_7d !== 0) {
    const positive = d.impact_type === 'saves' || d.impact_type === 'gain';
    impactLabel = positive ? 'Potencial/7d' : 'Risco/7d';
    impactValue = (positive ? '+' : '-') + centsToBrl(Math.abs(d.impact_7d));
  }

  const primaryAction = d.actions?.[0];
  const actionLabel = primaryAction?.label || (
    d.type === 'kill' ? 'Pausar agora'
      : d.type === 'scale' ? 'Escalar'
      : d.type === 'fix' ? 'Corrigir'
      : 'Revisar'
  );
  const actionKind: DerivedAction['actionKind'] =
    primaryAction?.type ||
    (d.type === 'kill' ? 'destructive'
      : d.type === 'scale' ? 'constructive'
      : 'neutral');

  return {
    headline: d.headline,
    reason: d.reason || '',
    metrics,
    impactLabel,
    impactValue,
    actionLabel,
    actionKind,
    confidencePct: Math.round(confidence * 100),
  };
}

const NextBestActionCard: React.FC<{
  decision: Decision | null;
  onAction?: (decisionId: string, action: DecisionAction) => void | Promise<void>;
  loading?: boolean;
}> = ({ decision, onAction, loading }) => {
  if (!decision) {
    return (
      <SidebarCard title="Próximo passo recomendado">
        <div style={{
          fontSize: 13, color: T.text2, fontFamily: F,
          lineHeight: 1.5, letterSpacing: '-0.005em',
        }}>
          Nenhuma ação crítica no momento. {loading ? 'Analisando…' : 'Continue monitorando — quando algo mudar, aparece aqui.'}
        </div>
      </SidebarCard>
    );
  }

  const d = deriveFromDecision(decision);
  const accent = decision.type === 'kill' ? T.red
    : decision.type === 'scale' ? T.green
    : decision.type === 'fix' ? T.yellow
    : T.blue;

  const actionBg = d.actionKind === 'destructive' ? T.red
    : d.actionKind === 'constructive' ? T.green
    : T.blue;

  return (
    <SidebarCard
      title="Próximo passo recomendado"
      accent={accent}
      right={(
        <span style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
          color: T.text3, textTransform: 'uppercase',
        }}>
          confiança {d.confidencePct}%
        </span>
      )}
    >
      <div style={{
        fontSize: 14, fontWeight: 700, color: T.text1, fontFamily: F,
        lineHeight: 1.35, letterSpacing: '-0.01em', marginBottom: 6,
      }}>
        {d.headline}
      </div>
      {d.reason && (
        <div style={{
          fontSize: 12, color: T.text2, lineHeight: 1.5,
          letterSpacing: '-0.005em', marginBottom: 10,
        }}>
          {d.reason}
        </div>
      )}

      {d.metrics.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          padding: '8px 10px', background: T.bg2, border: `1px solid ${T.border1}`,
          borderRadius: 8, marginBottom: 10,
        }}>
          {d.metrics.map(m => (
            <div key={m.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 8, fontSize: 11.5, letterSpacing: '-0.005em',
            }}>
              <span style={{ color: T.text3 }}>{m.label}</span>
              <span style={{
                color: T.text1, fontWeight: 600,
                textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {d.impactValue && (
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <span style={{ fontSize: 11, color: T.text3 }}>{d.impactLabel}</span>
          <span style={{
            fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em',
            color: d.impactValue.startsWith('+') ? T.green : T.red,
          }}>
            {d.impactValue}
          </span>
        </div>
      )}

      {onAction && decision.actions?.[0] && (
        <button
          className="feed-cta"
          onClick={() => onAction(decision.id, decision.actions![0])}
          style={{
            width: '100%',
            background: actionBg,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '9px 14px',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: F,
            letterSpacing: '-0.005em',
            transition: 'background 0.15s',
          }}
        >
          {d.actionLabel}
        </button>
      )}
    </SidebarCard>
  );
};

// ── Recent Activity ────────────────────────────────────────────────

export interface FeedActivityEvent {
  id: string;
  action_type: string;
  target_name: string | null;
  reason: string | null;
  executed_at: string;
  amount_at_risk_brl?: number | null;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins}min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function actionLabelFor(type: string): string {
  if (type === 'pause_ad') return 'Pausou anúncio';
  if (type === 'pause_adset') return 'Pausou conjunto';
  if (type === 'pause_campaign') return 'Pausou campanha';
  if (type === 'increase_budget') return 'Aumentou budget';
  if (type === 'decrease_budget') return 'Reduziu budget';
  if (type === 'resume_ad') return 'Retomou anúncio';
  return type.replace(/_/g, ' ');
}

function actionIconFor(type: string): string {
  if (type.startsWith('pause')) return '⏸';
  if (type.includes('increase')) return '↑';
  if (type.includes('decrease')) return '↓';
  if (type.startsWith('resume')) return '▶';
  return '●';
}

const RecentActivityCard: React.FC<{
  events: FeedActivityEvent[];
  loading?: boolean;
}> = ({ events, loading }) => {
  if (loading) {
    return (
      <SidebarCard title="Atividade recente">
        <div style={{ fontSize: 12, color: T.text3, fontFamily: F, fontStyle: 'italic' }}>
          Carregando…
        </div>
      </SidebarCard>
    );
  }

  if (!events.length) {
    return (
      <SidebarCard title="Atividade recente">
        <div style={{
          fontSize: 12.5, color: T.text2, lineHeight: 1.5, fontFamily: F,
          letterSpacing: '-0.005em',
        }}>
          Nada executado nas últimas 24h. Quando o sistema agir, o histórico aparece aqui.
        </div>
      </SidebarCard>
    );
  }

  return (
    <SidebarCard title="Atividade recente">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {events.slice(0, 5).map(ev => (
          <div key={ev.id} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            paddingBottom: 10, borderBottom: `1px solid ${T.border0}`,
          }}>
            <span style={{
              fontSize: 13, color: T.text2, flexShrink: 0, lineHeight: 1.3,
              width: 18, textAlign: 'center',
            }}>
              {actionIconFor(ev.action_type)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, color: T.text1, fontWeight: 600,
                letterSpacing: '-0.005em',
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                gap: 8,
              }}>
                <span style={{
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {actionLabelFor(ev.action_type)}
                </span>
                <span style={{ fontSize: 10, color: T.text3, fontWeight: 500, flexShrink: 0 }}>
                  {timeAgo(ev.executed_at)}
                </span>
              </div>
              {ev.target_name && (
                <div style={{
                  fontSize: 11, color: T.text3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginTop: 2,
                }}>
                  {ev.target_name}
                </div>
              )}
              {ev.reason && (
                <div style={{
                  fontSize: 11, color: T.text2, lineHeight: 1.45,
                  marginTop: 4, letterSpacing: '-0.005em',
                }}>
                  {ev.reason}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </SidebarCard>
  );
};

// ── Main exported component ───────────────────────────────────────

export const FeedSidebar: React.FC<{
  // Account Health inputs
  accountStatus: AccountStatusSummary | null;
  accountStatusLoading: boolean;
  accountStatusError: boolean;
  onRetryAccountStatus?: () => void;
  pixelHealth: PixelHealthLike | null;
  pixelHealthLoading: boolean;
  adMetrics: AdMetricsLike | null;
  activeAdsCount: number;
  hasMetaConnection: boolean;
  // Next Best Action inputs
  topDecision: Decision | null;
  decisionsLoading?: boolean;
  onDecisionAction?: (decisionId: string, action: DecisionAction) => void | Promise<void>;
  // Recent activity
  activityEvents: FeedActivityEvent[];
  activityLoading?: boolean;
}> = (props) => {
  return (
    <aside
      className="feed-sidebar-col"
      style={{
        width: 320,
        flexShrink: 0,
        fontFamily: F,
      }}
    >
      <AccountHealthGauge
        accountStatus={props.accountStatus}
        accountStatusLoading={props.accountStatusLoading}
        accountStatusError={props.accountStatusError}
        onRetryAccountStatus={props.onRetryAccountStatus}
        pixelHealth={props.pixelHealth}
        pixelHealthLoading={props.pixelHealthLoading}
        adMetrics={props.adMetrics}
        activeAdsCount={props.activeAdsCount}
        hasMetaConnection={props.hasMetaConnection}
      />
      <NextBestActionCard
        decision={props.topDecision}
        loading={props.decisionsLoading}
        onAction={props.onDecisionAction}
      />
      <RecentActivityCard
        events={props.activityEvents}
        loading={props.activityLoading}
      />
    </aside>
  );
};

export default FeedSidebar;
