/**
 * FeedSidebar — right-hand rail of the Central de Comando (v3, 1:1 with print).
 *
 * Three stacked cards:
 *   1. Saúde da conta       — ring gauge + numbered issue list + CTA
 *   2. Próximo passo reco.  — derived from decisions[0], big impact line, blue CTA
 *   3. Atividade recente    — last executed autopilot actions with colored icon tiles
 *
 * Rules (per spec):
 *   • Nothing hardcoded. Every string, number, and issue is derived.
 *   • Priority = impact × confidence.
 *   • Empty states carry a guided next action — never placeholder fakes.
 */

import React from 'react';
import {
  computeAccountHealth,
  type AccountStatusSummary,
  type PixelHealthLike,
  type AdMetricsLike,
  type HealthIssue,
} from './AccountHealthGauge';
import type { Decision, DecisionAction } from '../../types/v2-database';

// ── Design tokens (mirror FeedPage T) ──────────────────────────────
const T = {
  bg0: '#0A0D14',
  bg1: '#0E1320',
  bg2: '#151B29',
  bg3: '#1B2232',
  border0: 'rgba(240,246,252,0.04)',
  border1: 'rgba(240,246,252,0.08)',
  border2: 'rgba(240,246,252,0.14)',
  text1: '#F0F6FC',
  text2: 'rgba(240,246,252,0.72)',
  text3: 'rgba(240,246,252,0.50)',
  labelColor: 'rgba(240,246,252,0.42)',
  blue: '#2563EB',
  blueSoft: '#3B82F6',
  green: '#22C55E',
  greenSoft: '#4ADE80',
  red: '#EF4444',
  yellow: '#F59E0B',
  yellowSoft: '#FBBF24',
  purple: '#A78BFA',
};
const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

// ── Shared card shell ──────────────────────────────────────────────
const Card: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div style={{
    background: T.bg1,
    border: `1px solid ${T.border1}`,
    borderRadius: 14,
    padding: '18px 18px',
    marginBottom: 14,
    fontFamily: F,
    ...style,
  }}>
    {children}
  </div>
);

// ─── 1) SAÚDE DA CONTA ─────────────────────────────────────────────

type Band = 'ok' | 'warn' | 'critical';
function bandLabel(band: Band): string {
  if (band === 'critical') return 'Crítico';
  if (band === 'warn') return 'Atenção';
  return 'Saudável';
}
function bandColor(band: Band): string {
  if (band === 'critical') return T.red;
  if (band === 'warn') return T.yellow;
  return T.green;
}
function bandHeadline(band: Band, fallback: string): string {
  if (band === 'critical') return 'Sua conta precisa de ação agora';
  if (band === 'warn') return 'Sua conta precisa de atenção';
  return fallback || 'Sua conta está saudável';
}

/** Ring gauge — score on left, orange stroke arc. */
const RingGauge: React.FC<{ score: number; color: string; size?: number }> = ({
  score, color, size = 88,
}) => {
  const r = (size - 10) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const dash = (clamped / 100) * circ;
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r}
          stroke="rgba(255,255,255,0.06)" strokeWidth={6} fill="none" />
        <circle cx={cx} cy={cy} r={r}
          stroke={color} strokeWidth={6} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        lineHeight: 1,
      }}>
        <span style={{
          fontSize: 22, fontWeight: 800, color: T.text1,
          letterSpacing: '-0.03em', fontFamily: F,
        }}>{Math.round(clamped)}</span>
        <span style={{
          fontSize: 9, color: T.text3, marginTop: 3,
          letterSpacing: '-0.005em', fontFamily: F,
        }}>de 100</span>
      </div>
    </div>
  );
};

/** Action label for each issue — drives the right-side colored link. */
function issueActionText(issue: HealthIssue): string {
  const k = issue.key;
  if (k.includes('pixel') || k.includes('tracking') || k.includes('conv')) return 'Verificar tracking';
  if (k.includes('balance') || k.includes('spend_cap') || k.includes('cap')) return 'Repor saldo';
  if (k.includes('disabled') || k.includes('status') || k.includes('account_critical')) return 'Reativar';
  if (k.includes('delivery') || k.includes('ads') || k.includes('freq') || k.includes('active')) return 'Otimizar';
  return 'Verificar';
}

const AccountHealthCard: React.FC<{
  accountStatus: AccountStatusSummary | null;
  accountStatusLoading: boolean;
  accountStatusError: boolean;
  onRetryAccountStatus?: () => void;
  pixelHealth: PixelHealthLike | null;
  pixelHealthLoading: boolean;
  adMetrics: AdMetricsLike | null;
  activeAdsCount: number;
  hasMetaConnection: boolean;
  onOpenDiagnostic?: () => void;
  onActOnIssue?: (issue: HealthIssue) => void;
}> = (props) => {
  const health = computeAccountHealth({
    accountStatus: props.accountStatus,
    accountStatusLoading: props.accountStatusLoading,
    accountStatusError: props.accountStatusError,
    pixelHealth: props.pixelHealth,
    pixelHealthLoading: props.pixelHealthLoading,
    adMetrics: props.adMetrics,
    activeAdsCount: props.activeAdsCount,
    hasMetaConnection: props.hasMetaConnection,
  });

  const band: Band = health.band;
  const sevColor = bandColor(band);
  const sevLabel = bandLabel(band);
  const issues = health.issues || [];

  return (
    <Card>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <span style={{
          fontSize: 14, fontWeight: 700, color: T.text1,
          fontFamily: F, letterSpacing: '-0.01em',
        }}>
          Saúde da conta
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: sevColor,
          background: `${sevColor}1A`,
          border: `1px solid ${sevColor}40`,
          borderRadius: 999,
          padding: '3px 10px',
          fontFamily: F, letterSpacing: '-0.005em',
        }}>
          {sevLabel}
        </span>
      </div>

      {/* Gauge + copy */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        marginBottom: issues.length > 0 ? 16 : 10,
      }}>
        <RingGauge score={health.score} color={sevColor} size={88} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13.5, fontWeight: 700, color: T.text1,
            lineHeight: 1.35, letterSpacing: '-0.01em', marginBottom: 4,
          }}>
            {bandHeadline(band, health.headline)}
          </div>
          <div style={{
            fontSize: 11.5, color: T.text2, lineHeight: 1.5,
            letterSpacing: '-0.005em',
          }}>
            {issues.length > 0
              ? `Detectamos ${issues.length} ${issues.length === 1 ? 'ponto que pode' : 'pontos que podem'} estar limitando seus resultados.`
              : band === 'ok'
                ? 'Tudo rodando dentro do esperado. Continuo monitorando 24/7.'
                : 'Aguardando sinais da sua conta…'}
          </div>
        </div>
      </div>

      {/* Numbered issue list */}
      {issues.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 0,
          marginBottom: 14,
        }}>
          {issues.slice(0, 4).map((issue, idx) => (
            <div key={issue.key} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 0',
              borderTop: idx === 0 ? 'none' : `1px solid ${T.border0}`,
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 6,
                background: 'rgba(255,255,255,0.05)',
                color: T.text2, fontSize: 10.5, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontFamily: F,
              }}>
                {idx + 1}
              </span>
              <span style={{
                flex: 1, fontSize: 12, color: T.text1,
                lineHeight: 1.4, letterSpacing: '-0.005em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {issue.label}
              </span>
              <button
                onClick={() => props.onActOnIssue?.(issue)}
                style={{
                  background: 'transparent', border: 'none',
                  color: T.yellowSoft, fontSize: 11.5, fontWeight: 600,
                  cursor: 'pointer', padding: 0,
                  fontFamily: F, letterSpacing: '-0.005em',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
              >
                {issueActionText(issue)}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Primary CTA */}
      <button
        onClick={props.onOpenDiagnostic}
        style={{
          width: '100%',
          background: T.bg2,
          border: `1px solid ${T.border2}`,
          borderRadius: 10,
          padding: '10px 14px',
          fontSize: 12.5, fontWeight: 700,
          color: T.text1, cursor: 'pointer',
          fontFamily: F, letterSpacing: '-0.005em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = T.bg3;
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.22)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = T.bg2;
          (e.currentTarget as HTMLElement).style.borderColor = T.border2;
        }}
      >
        Ver diagnóstico completo
        <span style={{ fontSize: 14, lineHeight: 1 }}>→</span>
      </button>
    </Card>
  );
};

// ─── 2) PRÓXIMO PASSO RECOMENDADO ──────────────────────────────────

function centsToBrl(cents: number): string {
  const v = cents / 100;
  const abs = Math.abs(v);
  if (abs >= 1000) return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function deriveNextStep(d: Decision | null): {
  description: string;
  impactLabel: string;
  impactValue: string;
  actionLabel: string;
  actionKind: 'destructive' | 'constructive' | 'neutral';
  confidencePct: number;
} | null {
  if (!d) return null;
  const confidence = typeof d.data_confidence === 'number'
    ? d.data_confidence
    : Math.max(0, Math.min(1, (d.score ?? 0) / 100));

  let impactLabel = 'Potencial de impacto';
  let impactValue = '—';
  if (d.impact_daily && d.impact_daily !== 0) {
    const positive = d.impact_type === 'saves' || d.impact_type === 'gain' || d.type === 'scale';
    impactValue = `${positive ? '+' : '-'}${centsToBrl(Math.abs(d.impact_daily))} /dia`;
  } else if (d.impact_7d && d.impact_7d !== 0) {
    const positive = d.impact_type === 'saves' || d.impact_type === 'gain' || d.type === 'scale';
    impactValue = `${positive ? '+' : '-'}${centsToBrl(Math.abs(d.impact_7d))} /7d`;
  }

  const primary = d.actions?.[0];
  const actionLabel = primary?.label || (
    d.type === 'kill' ? 'Pausar agora'
      : d.type === 'scale' ? 'Escalar'
      : d.type === 'fix' ? 'Corrigir'
      : 'Ver recomendações'
  );
  const actionKind: 'destructive' | 'constructive' | 'neutral' =
    primary?.type || (
      d.type === 'kill' ? 'destructive'
      : d.type === 'scale' ? 'constructive'
      : 'neutral'
    );

  const description = (d.reason || d.headline || '').split('\n')[0];

  return {
    description,
    impactLabel,
    impactValue,
    actionLabel,
    actionKind,
    confidencePct: Math.round(confidence * 100),
  };
}

const NextStepCard: React.FC<{
  decision: Decision | null;
  onAction?: (decisionId: string, action: DecisionAction) => void | Promise<void>;
  onOpenAll?: () => void;
  loading?: boolean;
}> = ({ decision, onAction, onOpenAll, loading }) => {
  const derived = deriveNextStep(decision);

  return (
    <Card>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{
          width: 22, height: 22, borderRadius: 7,
          background: `${T.blueSoft}1A`,
          border: `1px solid ${T.blueSoft}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L14.09 8.26L20 9.27L15.5 13.66L17.18 20L12 17.27L6.82 20L8.5 13.66L4 9.27L9.91 8.26L12 2Z"
              stroke={T.blueSoft} strokeWidth={1.8} strokeLinejoin="round" fill="none" />
          </svg>
        </span>
        <span style={{
          fontSize: 14, fontWeight: 700, color: T.text1,
          fontFamily: F, letterSpacing: '-0.01em',
        }}>
          Próximo passo recomendado
        </span>
      </div>

      {!derived ? (
        <div style={{
          fontSize: 12.5, color: T.text2, lineHeight: 1.5,
          letterSpacing: '-0.005em', marginBottom: 14,
        }}>
          {loading
            ? 'Analisando sua conta para encontrar a próxima ação de maior impacto…'
            : 'Nenhuma ação crítica agora. Continuo monitorando — quando algo mudar, aparece aqui.'}
        </div>
      ) : (
        <>
          <div style={{
            fontSize: 12.5, color: T.text2, lineHeight: 1.55,
            letterSpacing: '-0.005em', marginBottom: 16,
          }}>
            {derived.description}
          </div>

          {derived.impactValue !== '—' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 11.5, color: T.text3, fontFamily: F,
                letterSpacing: '-0.005em', marginBottom: 4,
              }}>
                {derived.impactLabel}
              </div>
              <div style={{
                fontSize: 22, fontWeight: 800,
                color: derived.impactValue.startsWith('+') ? T.greenSoft : T.red,
                letterSpacing: '-0.025em', fontFamily: F, lineHeight: 1.15,
              }}>
                {derived.impactValue}
              </div>
            </div>
          )}
        </>
      )}

      <button
        onClick={() => {
          if (decision && onAction && decision.actions?.[0]) {
            onAction(decision.id, decision.actions[0]);
          } else {
            onOpenAll?.();
          }
        }}
        style={{
          width: '100%',
          background: T.blue,
          color: '#fff', border: 'none',
          borderRadius: 10, padding: '11px 14px',
          fontSize: 12.5, fontWeight: 700,
          cursor: 'pointer', fontFamily: F,
          letterSpacing: '-0.005em',
          transition: 'background 0.15s, transform 0.1s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#1D4ED8'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.blue; }}
      >
        {derived?.actionLabel || 'Ver recomendações'}
      </button>
    </Card>
  );
};

// ─── 3) ATIVIDADE RECENTE ──────────────────────────────────────────

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
  if (mins < 60) return `Há ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `Há ${h} h`;
  return `Há ${Math.floor(h / 24)} d`;
}

function activityLabel(type: string): string {
  if (type === 'pause_ad') return 'Anúncio pausado';
  if (type === 'pause_adset') return 'Conjunto pausado';
  if (type === 'pause_campaign') return 'Campanha pausada';
  if (type === 'increase_budget') return 'Budget aumentado';
  if (type === 'decrease_budget') return 'Budget reduzido';
  if (type === 'resume_ad') return 'Anúncio retomado';
  if (type === 'analysis_completed' || type === 'analyze') return 'Análise concluída';
  if (type === 'pattern_learned') return 'IA aprendeu novo padrão';
  if (type === 'opportunity_applied') return 'Oportunidade aplicada';
  return type.replace(/_/g, ' ');
}

interface ActivityIconProps { type: string }
const ActivityIcon: React.FC<ActivityIconProps> = ({ type }) => {
  let bg = 'rgba(255,255,255,0.06)';
  let color = T.text2;
  let icon: React.ReactNode;

  if (type.startsWith('pause')) {
    bg = 'rgba(239,68,68,0.14)'; color = T.red;
    icon = (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <rect x="6" y="5" width="4" height="14" rx="1" fill={color} />
        <rect x="14" y="5" width="4" height="14" rx="1" fill={color} />
      </svg>
    );
  } else if (type.includes('increase') || type.includes('budget') || type.includes('opportunity')) {
    bg = 'rgba(59,130,246,0.14)'; color = T.blueSoft;
    icon = (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <path d="M21 8l-6 6-4-4-7 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 8h6v6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  } else if (type.includes('decrease')) {
    bg = 'rgba(245,158,11,0.14)'; color = T.yellowSoft;
    icon = (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <path d="M21 16l-6-6-4 4-7-7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  } else if (type.includes('resume')) {
    bg = 'rgba(34,197,94,0.14)'; color = T.greenSoft;
    icon = (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <path d="M8 5v14l11-7z" fill={color} />
      </svg>
    );
  } else if (type.includes('pattern') || type.includes('learn')) {
    bg = 'rgba(167,139,250,0.14)'; color = T.purple;
    icon = (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" fill={color} />
      </svg>
    );
  } else {
    bg = 'rgba(34,197,94,0.14)'; color = T.greenSoft;
    icon = (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <path d="M5 12l5 5L20 7" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <span style={{
      width: 26, height: 26, borderRadius: 8,
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {icon}
    </span>
  );
};

const RecentActivityCard: React.FC<{
  events: FeedActivityEvent[];
  loading?: boolean;
  onOpenAll?: () => void;
}> = ({ events, loading, onOpenAll }) => {
  return (
    <Card>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <span style={{
          fontSize: 14, fontWeight: 700, color: T.text1,
          fontFamily: F, letterSpacing: '-0.01em',
        }}>
          Atividade recente
        </span>
        <button
          onClick={onOpenAll}
          style={{
            background: 'transparent', border: 'none',
            color: T.blueSoft, fontSize: 11.5, fontWeight: 600,
            cursor: 'pointer', padding: 0, fontFamily: F,
            letterSpacing: '-0.005em',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
        >
          Ver todas
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: T.text3, fontStyle: 'italic', fontFamily: F }}>
          Carregando…
        </div>
      ) : !events.length ? (
        <div style={{
          fontSize: 12.5, color: T.text2, lineHeight: 1.5,
          letterSpacing: '-0.005em', fontFamily: F,
        }}>
          Nenhuma ação executada nas últimas 48h. Quando o sistema agir, o histórico aparece aqui.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {events.slice(0, 5).map(ev => (
            <div key={ev.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <ActivityIcon type={ev.action_type} />
              <span style={{
                flex: 1, fontSize: 12.5, color: T.text1,
                fontWeight: 500, letterSpacing: '-0.005em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: F,
              }}>
                {activityLabel(ev.action_type)}
              </span>
              <span style={{
                fontSize: 11, color: T.text3, fontWeight: 500,
                flexShrink: 0, fontFamily: F, letterSpacing: '-0.005em',
              }}>
                {timeAgo(ev.executed_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

// ── Exported sidebar ───────────────────────────────────────────────

export const FeedSidebar: React.FC<{
  accountStatus: AccountStatusSummary | null;
  accountStatusLoading: boolean;
  accountStatusError: boolean;
  onRetryAccountStatus?: () => void;
  pixelHealth: PixelHealthLike | null;
  pixelHealthLoading: boolean;
  adMetrics: AdMetricsLike | null;
  activeAdsCount: number;
  hasMetaConnection: boolean;
  topDecision: Decision | null;
  decisionsLoading?: boolean;
  onDecisionAction?: (decisionId: string, action: DecisionAction) => void | Promise<void>;
  onOpenAllDecisions?: () => void;
  onOpenDiagnostic?: () => void;
  onActOnIssue?: (issue: HealthIssue) => void;
  activityEvents: FeedActivityEvent[];
  activityLoading?: boolean;
  onOpenAllActivity?: () => void;
}> = (props) => {
  return (
    <aside
      className="feed-sidebar-col"
      style={{ width: 340, flexShrink: 0, fontFamily: F }}
    >
      <AccountHealthCard
        accountStatus={props.accountStatus}
        accountStatusLoading={props.accountStatusLoading}
        accountStatusError={props.accountStatusError}
        onRetryAccountStatus={props.onRetryAccountStatus}
        pixelHealth={props.pixelHealth}
        pixelHealthLoading={props.pixelHealthLoading}
        adMetrics={props.adMetrics}
        activeAdsCount={props.activeAdsCount}
        hasMetaConnection={props.hasMetaConnection}
        onOpenDiagnostic={props.onOpenDiagnostic}
        onActOnIssue={props.onActOnIssue}
      />
      <NextStepCard
        decision={props.topDecision}
        loading={props.decisionsLoading}
        onAction={props.onDecisionAction}
        onOpenAll={props.onOpenAllDecisions}
      />
      <RecentActivityCard
        events={props.activityEvents}
        loading={props.activityLoading}
        onOpenAll={props.onOpenAllActivity}
      />
    </aside>
  );
};

export default FeedSidebar;
