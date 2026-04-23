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
  text2: 'rgba(240,246,252,0.76)',      // bumped from 0.72
  text3: 'rgba(240,246,252,0.62)',      // bumped from 0.50 — captions + issue meta
  labelColor: 'rgba(240,246,252,0.56)', // bumped from 0.42 — uppercase eyebrows
  blue: '#2563EB',
  blueSoft: '#3B82F6',
  // Deeper emerald ramp for health/success signals. Was the candy-
  // bright #22C55E / #4ADE80 pair; swapped for a richer #10B981
  // that reads trustworthy in a money panel.
  green: '#10B981',
  greenSoft: '#10B981',
  red: '#EF4444',
  yellow: '#F59E0B',
  yellowSoft: '#FBBF24',
  purple: '#A78BFA',
};
const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

// ── Shared card shell ──────────────────────────────────────────────
//
// Two flavors:
//   • <Card>       → legacy standalone card (still used in tests / isolated renders).
//   • <CardZone>   → no wrapper, no border. Just padding + a hairline top divider.
//                    Designed to be stacked inside a single <UnifiedCard> so
//                    the sidebar reads as ONE widget with three semantic zones
//                    instead of three floating cards. Matches the approved
//                    mockup that Martinho signed off on.
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

/** Wraps multiple zones in a single elevated surface with subtle divider
 *  hairlines. Premium feel: one card, three zones. */
const UnifiedCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    background: T.bg1,
    border: `1px solid ${T.border1}`,
    borderRadius: 14,
    fontFamily: F,
    overflow: 'hidden',
    boxShadow: `0 0 0 1px ${T.border0}, 0 12px 40px rgba(0,0,0,0.35)`,
    animation: 'feed-sidebar-in 0.42s cubic-bezier(0.22,1,0.36,1) 0.08s both',
  }}>
    {children}
    <style>{`
      @keyframes feed-sidebar-in {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes feed-sidebar-zone {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  </div>
);

/** Single zone inside a UnifiedCard. `divider` adds the 1px hairline on top. */
const CardZone: React.FC<{
  children: React.ReactNode;
  divider?: boolean;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ children, divider, delay = 0, style }) => (
  <div style={{
    padding: '18px 18px',
    borderTop: divider ? `1px solid ${T.border0}` : 'none',
    fontFamily: F,
    animation: `feed-sidebar-zone 0.32s cubic-bezier(0.22,1,0.36,1) ${delay}s both`,
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

/** Action label for each issue — text-based, specific verbs. */
function issueActionText(issue: HealthIssue): string {
  const k = issue.key;
  if (k === 'pixel_missing' || k === 'pixel_stale' || k === 'pixel_orphan') return 'Verificar rastreamento';
  if (k === 'spend_no_conv') return 'Verificar rastreamento';
  if (k === 'no_active_ads') return 'Reativar campanhas';
  if (k === 'balance_critical') return 'Adicionar saldo';
  if (k === 'balance_low') return 'Repor saldo';
  if (k === 'cap_exhausted') return 'Entender o limite';
  if (k === 'cap_pressure_high' || k === 'cap_pressure') return 'Entender o limite';
  if (k === 'account_critical') return 'Reativar conta';
  if (k === 'account_warn') return 'Ajustar conta';
  if (k.includes('delivery') || k.includes('freq')) return 'Ajustar entrega';
  return 'Resolver';
}

/** Ring gauge — SVG arc that visualizes the health score. Muted colors keep
 *  it informative without stealing attention from the data bullets below. */
const RingGauge: React.FC<{
  score: number;
  color: string;
  size?: number;
  stroke?: number;
}> = ({ score, color, size = 68, stroke = 6 }) => {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (s / 100) * c;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ flexShrink: 0, display: 'block' }}
      aria-label={`Saúde da conta: ${s} de 100`}
      role="img"
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={T.border1}
        strokeWidth={stroke}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)' }}
      />
      {/* Score text — premium typography: larger relative size,
          800 weight, tighter tracking. The score is the single
          most important number on the sidebar so it should win
          the visual hierarchy over neighbouring UI. */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={F}
        fontSize={size * 0.42}
        fontWeight={800}
        fill={T.text1}
        letterSpacing="-0.03em"
      >
        {s}
      </text>
    </svg>
  );
};

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
  /** When true the component renders its content WITHOUT the standalone
   *  Card wrapper — used when it's stacked inside a UnifiedCard as a
   *  zone. */
  bare?: boolean;
}> = (props) => {
  const health = computeAccountHealth({
    accountStatus: props.accountStatus,
    accountStatusLoading: props.accountStatusLoading,
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

  const Wrapper: React.FC<{ children: React.ReactNode }> = props.bare
    ? ({ children }) => <>{children}</>
    : ({ children }) => <Card>{children}</Card>;

  return (
    <Wrapper>
      {/* Header row — ring gauge + label/headline column + severity pill. */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        marginBottom: 14,
      }}>
        <RingGauge score={health.score} color={sevColor} size={64} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const,
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: T.text3,
              fontFamily: F, letterSpacing: '0.04em',
              textTransform: 'uppercase' as const,
            }}>
              Saúde da conta
            </span>
            {/* Severity marker — Linear-style: slim vertical bar +
                uppercase colored label. Same vocabulary as the
                Command Deck status strip. No chip, no pill. */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <span aria-hidden style={{
                width: 2, height: 10, background: sevColor, flexShrink: 0,
              }} />
              <span style={{
                fontSize: 10, fontWeight: 800,
                color: sevColor,
                fontFamily: F, letterSpacing: '0.12em',
                textTransform: 'uppercase' as const,
              }}>
                {sevLabel}
              </span>
            </span>
          </div>
          {/* Headline — what's happening, in one line. */}
          <div style={{
            fontSize: 13.5, fontWeight: 700, color: T.text1,
            lineHeight: 1.4, letterSpacing: '-0.01em',
          }}>
            {bandHeadline(band, health.headline)}
          </div>
        </div>
      </div>

      {/* Data bullets — what's specifically wrong, derived from real issues. */}
      {issues.length > 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column',
          gap: 0,
          marginBottom: 16,
          borderTop: `1px solid ${T.border0}`,
        }}>
          {issues.slice(0, 4).map((issue) => (
            <div key={issue.key} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 0',
              borderBottom: `1px solid ${T.border0}`,
            }}>
              <span style={{
                width: 4, height: 4, borderRadius: '50%',
                background: issue.severity === 'critical' ? T.red
                          : issue.severity === 'warn' ? T.yellow
                          : T.text3,
                marginTop: 7, flexShrink: 0,
              }} />
              <div style={{
                flex: 1, minWidth: 0,
                display: 'flex', flexDirection: 'column', gap: 3,
              }}>
                <span style={{
                  fontSize: 12.5, color: T.text1,
                  lineHeight: 1.4, letterSpacing: '-0.005em',
                  fontWeight: 500,
                }}>
                  {issue.label}
                </span>
                <button
                  onClick={() => props.onActOnIssue?.(issue)}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'transparent', border: 'none',
                    color: T.blueSoft, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', padding: 0,
                    fontFamily: F, letterSpacing: '-0.005em',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                >
                  {issueActionText(issue)} →
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          fontSize: 12, color: T.text3, lineHeight: 1.5,
          letterSpacing: '-0.005em', marginBottom: 16,
          fontStyle: 'italic',
        }}>
          {band === 'ok'
            ? 'Nenhum ponto de atenção detectado. Monitoramento contínuo ativo.'
            : 'Aguardando sinais suficientes da sua conta para o diagnóstico.'}
        </div>
      )}

      {/* Ghost CTA — no bg, no border. When the account is healthy
          (majority of views), this lives as a quiet text link so it
          doesn't dominate the zone. Hover underlines + nudges arrow,
          same Linear vocabulary as "Ver todas" in Atividade. */}
      <button
        className="feed-linear-btn"
        onClick={props.onOpenDiagnostic}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '4px 0',
          fontSize: 11.5, fontWeight: 700,
          color: T.blueSoft, cursor: 'pointer',
          fontFamily: F, letterSpacing: '-0.005em',
          display: 'inline-flex', alignItems: 'center', gap: 5,
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.textDecoration = 'underline';
          (e.currentTarget as HTMLElement).style.textUnderlineOffset = '3px';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.textDecoration = 'none';
        }}
      >
        Ver diagnóstico completo
        <span style={{ fontSize: 12, lineHeight: 1 }}>→</span>
      </button>
    </Wrapper>
  );
};

// ─── 2) PRÓXIMO PASSO RECOMENDADO ──────────────────────────────────

// Compact BRL — switches to k/M/B past 10k so the 22px impact number
// never overflows its sidebar zone. Tooltip on the element carries the
// full precise value.
function centsToBrl(cents: number): string {
  const v = cents / 100;
  const abs = Math.abs(v);
  if (abs < 10000) {
    return abs < 1000
      ? `R$ ${v.toFixed(2).replace('.', ',')}`
      : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (abs < 1_000_000) return `R$ ${(v / 1000).toFixed(abs < 100000 ? 1 : 0).replace('.', ',')}k`;
  if (abs < 1_000_000_000) return `R$ ${(v / 1_000_000).toFixed(abs < 10_000_000 ? 1 : 0).replace('.', ',')}M`;
  return `R$ ${(v / 1_000_000_000).toFixed(1).replace('.', ',')}B`;
}
/** Full-precision version for tooltips — no abbreviation, used as title. */
function centsToBrlPrecise(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function deriveNextStep(d: Decision | null): {
  description: string;
  impactLabel: string;
  impactValue: string;
  /** Full-precision form, shown as title/tooltip when impactValue is compact. */
  impactValuePrecise: string;
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
  let impactValuePrecise = '—';
  if (d.impact_daily && d.impact_daily !== 0) {
    const positive = d.impact_type === 'savings' || d.impact_type === 'revenue' || d.type === 'scale';
    const sign = positive ? '+' : '-';
    impactValue = `${sign}${centsToBrl(Math.abs(d.impact_daily))} /dia`;
    impactValuePrecise = `${sign}${centsToBrlPrecise(Math.abs(d.impact_daily))} /dia`;
  } else if (d.impact_7d && d.impact_7d !== 0) {
    const positive = d.impact_type === 'savings' || d.impact_type === 'revenue' || d.type === 'scale';
    const sign = positive ? '+' : '-';
    impactValue = `${sign}${centsToBrl(Math.abs(d.impact_7d))} /7d`;
    impactValuePrecise = `${sign}${centsToBrlPrecise(Math.abs(d.impact_7d))} /7d`;
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
    impactValuePrecise,
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
  /** When true the component renders its content WITHOUT the standalone
   *  Card wrapper — used when stacked inside a UnifiedCard zone. */
  bare?: boolean;
}> = ({ decision, onAction, onOpenAll, loading, bare }) => {
  const derived = deriveNextStep(decision);

  const Wrapper: React.FC<{ children: React.ReactNode }> = bare
    ? ({ children }) => <>{children}</>
    : ({ children }) => <Card>{children}</Card>;

  // ── Calm / empty state ─────────────────────────────────────────────
  // When there's no pending decision we don't invent an action. We tell
  // the truth: the system is monitoring and will surface something when
  // signals justify it. No CTA, no fake urgency.
  if (!derived && !loading) {
    return (
      <Wrapper>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: T.greenSoft, boxShadow: `0 0 8px ${T.greenSoft}66`,
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 14, fontWeight: 700, color: T.text1,
            fontFamily: F, letterSpacing: '-0.01em',
          }}>
            Próximo passo
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            fontSize: 12.5, color: T.text2, lineHeight: 1.5,
            letterSpacing: '-0.005em', fontWeight: 500,
          }}>
            Sistema monitorando sua conta.
          </div>
          <div style={{
            fontSize: 12, color: T.text3, lineHeight: 1.55,
            letterSpacing: '-0.005em',
          }}>
            Nenhuma ação crítica no momento.
          </div>
          <div style={{
            fontSize: 11, color: T.text3, lineHeight: 1.55,
            letterSpacing: '-0.005em', fontStyle: 'italic',
          }}>
            Novas decisões aparecem conforme novos dados.
          </div>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
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
          Analisando sua conta para encontrar a próxima ação de maior impacto…
        </div>
      ) : (
        <>
          <div style={{
            fontSize: 12.5, color: T.text2, lineHeight: 1.55,
            letterSpacing: '-0.005em', marginBottom: 16,
          }}>
            {derived.description}
          </div>

          {derived.impactValue !== '—' && (() => {
            // Step-down font size when the (already compacted) string
            // still exceeds the sidebar zone's comfortable width.
            const len = derived.impactValue.length;
            const base = 22;
            const adjusted = len > 14 ? base - 4 : len > 11 ? base - 2 : base;
            return (
              <div style={{ marginBottom: 14, minWidth: 0 }}>
                <div style={{
                  fontSize: 11.5, color: T.text3, fontFamily: F,
                  letterSpacing: '-0.005em', marginBottom: 4,
                }}>
                  {derived.impactLabel}
                </div>
                <div
                  title={derived.impactValuePrecise !== derived.impactValue ? derived.impactValuePrecise : undefined}
                  style={{
                    fontSize: adjusted, fontWeight: 800,
                    color: derived.impactValue.startsWith('+') ? T.greenSoft : T.red,
                    letterSpacing: '-0.025em', fontFamily: F, lineHeight: 1.15,
                    fontVariantNumeric: 'tabular-nums' as const,
                    minWidth: 0, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {derived.impactValue}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/*
        Blue CTA — only render when we have a real derived step. Previously this
        button rendered during loading too, so users saw a "Ver recomendações"
        flash for a fraction of a second before the calm empty state replaced it.
        Keeping the button gated on `derived` means: no flash during load, no
        orphan CTA when the empty state is what's actually going to show.
      */}
      {derived && (
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
          {derived.actionLabel || 'Ver recomendações'}
        </button>
      )}
    </Wrapper>
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
  bare?: boolean;
}> = ({ events, loading, onOpenAll, bare }) => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = bare
    ? ({ children }) => <>{children}</>
    : ({ children }) => <Card>{children}</Card>;
  return (
    <Wrapper>
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
        // Compact empty state — one line with a small dash icon, not
        // a 3-line paragraph. Respects the sidebar's vertical rhythm.
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: F,
        }}>
          <span aria-hidden style={{
            width: 16, height: 16, borderRadius: 4,
            background: 'rgba(148,163,184,0.06)',
            border: `1px solid ${T.border0}`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: T.text3,
          }}>
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M3 6h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </span>
          <span style={{
            fontSize: 12, color: T.text3, letterSpacing: '-0.005em',
            lineHeight: 1.4,
          }}>
            Nada nas últimas 48h
          </span>
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
    </Wrapper>
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
      // Wider sidebar — 400 vs old 340. Gives health gauge + next step
      // + activity list more breathing room on the 1520px canvas so
      // content doesn't feel cramped against a long main column.
      style={{ width: 400, flexShrink: 0, fontFamily: F }}
    >
      {/* Premium v3: ONE card, THREE zones. Replaces the previous
          3-separate-cards stack. Each zone carries a thin divider
          on top (except the first), and the whole widget shares a
          single drop-shadow + border radius. Matches the mockup. */}
      <UnifiedCard>
        <CardZone delay={0}>
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
            bare
          />
        </CardZone>
        <CardZone divider delay={0.08}>
          <NextStepCard
            decision={props.topDecision}
            loading={props.decisionsLoading}
            onAction={props.onDecisionAction}
            onOpenAll={props.onOpenAllDecisions}
            bare
          />
        </CardZone>
        <CardZone divider delay={0.16}>
          <RecentActivityCard
            events={props.activityEvents}
            loading={props.activityLoading}
            onOpenAll={props.onOpenAllActivity}
            bare
          />
        </CardZone>
      </UnifiedCard>
    </aside>
  );
};

export default FeedSidebar;
