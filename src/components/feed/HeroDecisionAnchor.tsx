// HeroDecisionAnchor — the visual anchor of the Feed.
//
// One dominant block sitting just below the CommandStrip. Its job is
// to make the user feel — in the first 1.2 seconds of the page — what
// matters most about their account RIGHT NOW. It absorbs what was
// previously the "Dinheiro em risco" zone + part of the MoneyBar
// hero, but reframed as a single decisive statement.
//
// Three variants based on account state, in priority order:
//
//   URGENT   — kills exist OR critical alerts active.
//              Big red number = recoverable R$/day.
//              Subline = count of items + biggest by name.
//              CTA = "Resolver agora" (scrolls to decisions).
//
//   STABLE   — no kills, no critical alerts, has some account history.
//              Soft green status. Calm framing — "operando estável".
//              CTA = "Explorar oportunidades" (still active stance).
//
//   LOADING  — no data yet (first sync in progress / no decisions).
//              Cyan info palette. Communicates "system is at work".
//              No CTA — just expectation-setting.
//
// Why this and not just MoneyBar:
//   - MoneyBar shows leaking + capturable + saved as 3 boxes. Good
//     dashboard, weak hero. The user has to assemble meaning.
//   - HeroDecisionAnchor commits to ONE number, ONE state, ONE next
//     move. It's a decision surface, not an information surface.
//   - MoneyBar can stay below the fold for users who want the full
//     breakdown — but the lead message lives here.
//
// Visual budget: ~28% of viewport height on desktop, ~22% on mobile.
// Enough to dominate, not enough to push everything else off the
// fold.

import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

// "Last validated win" — the most recent improved=true outcome with a
// real avoided_spend_brl number. Hero's stable variant uses it to surface
// concrete proof ("Última perda evitada: R$87 em UGC 03 · há 4d") instead
// of generic monitoring copy. Returns null when no such win exists.
type LastWin = {
  targetName: string | null;
  avoidedSpendBrl: number;
  measuredAt: string;          // ISO — the verdict timestamp
};

function useLastWin(userId?: string | null): LastWin | null {
  const [win, setWin] = useState<LastWin | null>(null);
  useEffect(() => {
    if (!userId) { setWin(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data } = await (supabase as any)
          .from('action_outcomes')
          .select('target_name, context, measured_72h_at, taken_at')
          .eq('user_id', userId)
          .eq('finalized', true)
          .eq('improved', true)
          .gte('taken_at', cutoff)
          .order('measured_72h_at', { ascending: false })
          .limit(5);
        if (cancelled || !data) return;
        for (const r of data as any[]) {
          const v = Number(r.context?.avoided_spend_brl);
          if (Number.isFinite(v) && v > 0) {
            setWin({
              targetName: r.target_name || null,
              avoidedSpendBrl: v,
              measuredAt: r.measured_72h_at || r.taken_at,
            });
            return;
          }
        }
        setWin(null);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [userId]);
  return win;
}

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

interface HeroDecisionAnchorProps {
  /** R$/day at risk (cents). Positive number = there's loss to recover. */
  recoverableDailyCents: number;
  /** Number of pending kill-type decisions. */
  killCount: number;
  /** Number of non-kill (fix/scale) decisions in the queue. */
  otherActionCount: number;
  /** Name of the single biggest opportunity (any type). */
  topOpportunityName?: string | null;
  /** Whether the account has been synced + has any data at all. */
  hasData: boolean;
  /** Click handler for the primary CTA. */
  onPrimaryClick?: () => void;
  /** Account-level severity from Meta status (spend cap, billing, etc).
   *  When 'critical', overrides everything else and Hero renders the
   *  account-level alert instead of decision-driven copy. */
  accountSeverity?: 'ok' | 'warn' | 'critical' | 'unknown' | null;
  /** Specific human message tied to accountSeverity (e.g. "Limite de gastos
   *  atingido — entrega pausada pela Meta"). Only used when severity is
   *  critical or warn. */
  accountStatusMessage?: string | null;
  /** Optional CTA label override (used when accountSeverity is critical
   *  to show "Entender o limite" instead of "Resolver agora"). */
  primaryCtaLabel?: string;
  /** When true, the Hero renders WITHOUT bottom corner radius and with
   *  zero marginBottom — designed for visual fusion with LiveSystemState
   *  rendered immediately below. Set this from the parent based on
   *  whether LiveSystemState will actually render. */
  fuseBottom?: boolean;
  /** Optional userId — when provided, Hero's stable variant pulls the
   *  most recent validated win from action_outcomes and surfaces it
   *  as concrete proof ("Última perda evitada: R$87 em UGC 03 · há 4d")
   *  instead of generic monitoring copy. */
  userId?: string | null;
  /** When the user resolves the upstream issue (e.g. just deposited
   *  saldo on Meta), this callback re-runs the account status check
   *  with cache bypass so the Hero updates immediately instead of
   *  waiting for the 15-min server-side TTL. Only rendered on the
   *  critical_account variant. */
  onRetryAccountStatus?: () => void;
}

export const HeroDecisionAnchor: React.FC<HeroDecisionAnchorProps> = ({
  recoverableDailyCents,
  killCount,
  otherActionCount,
  topOpportunityName,
  hasData,
  onPrimaryClick,
  accountSeverity = null,
  accountStatusMessage = null,
  primaryCtaLabel,
  fuseBottom = false,
  userId,
  onRetryAccountStatus,
}) => {
  const recoverableBrl = Math.round(recoverableDailyCents / 100);
  const totalActions = killCount + otherActionCount;
  const lastWin = useLastWin(userId);

  // ── Variant resolution (priority order) ───────────────────────────────
  // accountSeverity='critical' takes precedence over decision-level signals
  // because Meta-level issues (spend cap, billing, disabled account) BLOCK
  // ALL other actions. No point recommending "pause this ad" when delivery
  // is paused for the entire account.
  let variant: 'critical_account' | 'urgent' | 'stable' | 'loading';
  if (accountSeverity === 'critical') variant = 'critical_account';
  else if (!hasData) variant = 'loading';
  else if (killCount > 0 || recoverableBrl > 0) variant = 'urgent';
  else variant = 'stable';

  // Color tokens per variant. Discipline: each variant uses ONE accent
  // color. No mix. The user reads the color before the words.
  const tokens = {
    critical_account: {
      // Same red palette as urgent but kicker copy frames the account-
      // level nature of the issue ("CONTA BLOQUEADA" vs "AÇÃO REQUERIDA").
      // Tighter ambient glow because the message is text-heavy not number-heavy.
      kicker: 'CONTA BLOQUEADA POR META',
      kickerColor: '#F87171',
      kickerBg: 'rgba(239,68,68,0.12)',
      kickerBorder: 'rgba(239,68,68,0.28)',
      number: '#F87171',
      ctaBg: '#DC2626',
      ctaHover: '#B91C1C',
      ambientGlow: 'rgba(239,68,68,0.14)',
    },
    urgent: {
      kicker: 'AÇÃO REQUERIDA',
      kickerColor: '#F87171',
      kickerBg: 'rgba(239,68,68,0.10)',
      kickerBorder: 'rgba(239,68,68,0.22)',
      number: '#F87171',
      ctaBg: '#DC2626',
      ctaHover: '#B91C1C',
      ambientGlow: 'rgba(239,68,68,0.10)',
    },
    stable: {
      kicker: 'CONTA ESTÁVEL',
      kickerColor: '#34D399',
      kickerBg: 'rgba(16,185,129,0.08)',
      kickerBorder: 'rgba(16,185,129,0.20)',
      number: '#F0F6FC',
      ctaBg: 'rgba(255,255,255,0.05)',
      ctaHover: 'rgba(255,255,255,0.09)',
      ambientGlow: 'rgba(16,185,129,0.06)',
    },
    loading: {
      kicker: 'PRIMEIRA ANÁLISE',
      kickerColor: '#38BDF8',
      kickerBg: 'rgba(56,189,248,0.08)',
      kickerBorder: 'rgba(56,189,248,0.22)',
      number: '#F0F6FC',
      ctaBg: 'transparent',
      ctaHover: 'transparent',
      ambientGlow: 'rgba(56,189,248,0.06)',
    },
  } as const;

  const t = tokens[variant];

  // Critical_account kicker derives from the message so balance, cap,
  // and Meta-lock cases each get the right label. The colors stay the
  // same red palette — only the wording changes so the user immediately
  // knows whether to add saldo, wait for cap raise, or contact Meta.
  const criticalKicker = (() => {
    if (variant !== 'critical_account') return t.kicker;
    const m = (accountStatusMessage || '').toLowerCase();
    if (m.includes('saldo') && m.includes('zerado')) return 'SALDO PRÉ-PAGO ZERADO';
    if (m.includes('saldo')) return 'SALDO PRÉ-PAGO BAIXO';
    if (m.includes('limite de gastos')) return 'LIMITE DE GASTOS ATINGIDO';
    return t.kicker; // fallback: original "CONTA BLOQUEADA POR META"
  })();

  return (
    <div
      style={{
        position: 'relative',
        // Fusion mode: kill bottom radius + bottom margin so LiveSystemState
        // can sit flush below as a continuation of the same card.
        marginBottom: fuseBottom ? 0 : 18,
        padding: 'clamp(22px, 4vw, 32px) clamp(20px, 3vw, 28px)',
        borderRadius: fuseBottom ? '14px 14px 0 0' : 14,
        background: 'linear-gradient(180deg, #0E1218 0%, #0A0F1C 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderBottom: fuseBottom ? 'none' : '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
        fontFamily: F,
      }}
    >
      {/* Ambient glow tied to variant accent — radial, subtle */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -120, left: '50%',
          transform: 'translateX(-50%)',
          width: 600, height: 280,
          background: `radial-gradient(ellipse at center, ${t.ambientGlow} 0%, transparent 70%)`,
          pointerEvents: 'none' as const,
        }}
      />

      {/* Kicker */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '4px 10px',
          borderRadius: 99,
          background: t.kickerBg,
          border: `1px solid ${t.kickerBorder}`,
          marginBottom: 16,
          position: 'relative',
        }}
      >
        <span
          style={{
            width: 5, height: 5, borderRadius: '50%',
            background: t.kickerColor,
            boxShadow: `0 0 6px ${t.kickerColor}90`,
          }}
        />
        <span
          style={{
            fontSize: 10, fontWeight: 800,
            color: t.kickerColor,
            letterSpacing: '0.14em',
            textTransform: 'uppercase' as const,
          }}
        >
          {criticalKicker}
        </span>
      </div>

      {/* Hero content */}
      {variant === 'critical_account' && (() => {
        // Tailored paragraph per cause. Balance gets a 30s-resolution nudge,
        // cap gets a "Meta will raise" reminder, default falls back to the
        // generic Meta-blocked copy.
        const m = (accountStatusMessage || '').toLowerCase();
        const supporting = m.includes('saldo') && m.includes('zerado')
          ? 'Em contas pré-pagas, a entrega pausa quando o saldo zera. Resolução leva ~30s na Meta (Cobrança · Adicionar saldo). Eu te explico o passo-a-passo e quanto colocar pra segurar a próxima semana sem travar de novo.'
          : m.includes('limite de gastos')
            ? 'A Meta atingiu o limite de gastos da conta e pausou a entrega. Costuma ser elevado automaticamente em algumas horas. Eu te explico o que aconteceu e o que dá pra fazer enquanto isso.'
            : 'Enquanto isso, qualquer recomendação de pause / escala fica em espera — nada vai entregar até resolver isso primeiro. Eu te ajudo a entender o que aconteceu e o que dá pra fazer agora.';
        return (
          <>
            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(26px, 4.4vw, 36px)',
                fontWeight: 800,
                color: '#F0F6FC',
                letterSpacing: '-0.035em',
                lineHeight: 1.18,
                maxWidth: 720,
              }}
            >
              {accountStatusMessage || 'A Meta bloqueou a entrega da sua conta.'}
            </h2>
            <p
              style={{
                margin: '12px 0 0',
                fontSize: 'clamp(13px, 1.4vw, 15px)',
                color: 'rgba(240,246,252,0.65)',
                lineHeight: 1.5,
                maxWidth: 580,
              }}
            >
              {supporting}
            </p>
          </>
        );
      })()}

      {variant === 'urgent' && (
        <>
          <h2
            style={{
              margin: 0,
              fontSize: 'clamp(36px, 7vw, 56px)',
              fontWeight: 900,
              color: t.number,
              letterSpacing: '-0.045em',
              lineHeight: 1.04,
              fontVariantNumeric: 'tabular-nums' as const,
            }}
          >
            R$ {recoverableBrl.toLocaleString('pt-BR')}
            <span
              style={{
                fontSize: 'clamp(18px, 2.6vw, 24px)',
                fontWeight: 700,
                color: 'rgba(248,113,113,0.65)',
                marginLeft: 8,
              }}
            >
              /dia em risco
            </span>
          </h2>
          <p
            style={{
              margin: '12px 0 0',
              fontSize: 'clamp(13px, 1.4vw, 15px)',
              color: 'rgba(240,246,252,0.65)',
              lineHeight: 1.5,
              maxWidth: 580,
            }}
          >
            {killCount > 0 && (
              <>
                <strong style={{ color: '#F0F6FC' }}>{killCount}</strong>
                {' '}{killCount === 1 ? 'anúncio' : 'anúncios'} consumindo orçamento sem retorno
                {otherActionCount > 0 && (
                  <> · {otherActionCount} {otherActionCount === 1 ? 'oportunidade' : 'oportunidades'} extra</>
                )}
              </>
            )}
            {killCount === 0 && otherActionCount > 0 && (
              <>
                <strong style={{ color: '#F0F6FC' }}>{otherActionCount}</strong>
                {' '}{otherActionCount === 1 ? 'oportunidade detectada' : 'oportunidades detectadas'}
              </>
            )}
            {topOpportunityName && (
              <> — maior impacto: <strong style={{ color: '#F0F6FC' }}>{topOpportunityName}</strong></>
            )}
            .
          </p>
        </>
      )}

      {variant === 'stable' && (
        <>
          {/* Headline — when there's a recent win, lead with the
              concrete proof ("R$ 87 já evitados na sua conta"). When
              there isn't, keep the protective framing but still active
              ("Sistema ativo · proteção em andamento"). The brief was
              clear: never neutral state, always show value or activity. */}
          {lastWin ? (
            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(28px, 4.6vw, 38px)',
                fontWeight: 800,
                color: '#F0F6FC',
                letterSpacing: '-0.035em',
                lineHeight: 1.15,
              }}
            >
              R$ {lastWin.avoidedSpendBrl.toFixed(2)} já evitados na sua conta
            </h2>
          ) : (
            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(28px, 4.6vw, 38px)',
                fontWeight: 800,
                color: '#F0F6FC',
                letterSpacing: '-0.035em',
                lineHeight: 1.15,
              }}
            >
              Sistema ativo · proteção em andamento
            </h2>
          )}
          {/* Sub — different copy depending on whether we surfaced a
              concrete win or are in pure protection mode. Both are
              forward-looking, both name the specific work being done. */}
          {lastWin ? (
            <p
              style={{
                margin: '12px 0 0',
                fontSize: 'clamp(13px, 1.4vw, 15px)',
                color: 'rgba(240,246,252,0.62)',
                lineHeight: 1.5,
                maxWidth: 580,
              }}
            >
              {lastWin.targetName ? <><strong style={{ color: '#F0F6FC' }}>{lastWin.targetName}</strong> · </> : ''}
              última decisão validada {fmtAgo(lastWin.measuredAt)}.
              Sigo lendo CTR, CPA e frequência a cada 15 min — te aviso aqui assim que outra
              perda aparecer.
            </p>
          ) : (
            <p
              style={{
                margin: '12px 0 0',
                fontSize: 'clamp(13px, 1.4vw, 15px)',
                color: 'rgba(240,246,252,0.62)',
                lineHeight: 1.5,
                maxWidth: 580,
              }}
            >
              Releitura a cada 15 min sobre CTR, CPA e frequência. Assim que algo fugir do padrão,
              você recebe a decisão pronta aqui — antes da perda crescer.
            </p>
          )}
        </>
      )}

      {variant === 'loading' && (
        <>
          <h2
            style={{
              margin: 0,
              fontSize: 'clamp(28px, 4.6vw, 38px)',
              fontWeight: 800,
              color: '#F0F6FC',
              letterSpacing: '-0.035em',
              lineHeight: 1.15,
            }}
          >
            Lendo seus dados…
          </h2>
          <p
            style={{
              margin: '12px 0 0',
              fontSize: 'clamp(13px, 1.4vw, 15px)',
              color: 'rgba(240,246,252,0.62)',
              lineHeight: 1.5,
              maxWidth: 520,
            }}
          >
            Mapeando 30 dias de spend, identificando padrões anômalos. As primeiras decisões aparecem em segundos.
          </p>
        </>
      )}

      {/* CTA — primary action, only renders when there's something to do */}
      {(variant === 'critical_account'
        || variant === 'urgent'
        || (variant === 'stable' && totalActions > 0)) && onPrimaryClick && (
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const }}>
          <button
            onClick={onPrimaryClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 22px',
              borderRadius: 10,
              background: t.ctaBg,
              color: variant === 'urgent' || variant === 'critical_account' ? '#fff' : 'rgba(240,246,252,0.92)',
              border: variant === 'urgent' || variant === 'critical_account' ? 'none' : '1px solid rgba(255,255,255,0.10)',
              fontFamily: F,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              letterSpacing: '-0.005em',
              boxShadow: variant === 'urgent' || variant === 'critical_account' ? `0 0 24px ${t.ambientGlow}` : 'none',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = t.ctaHover;
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = t.ctaBg;
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            {primaryCtaLabel
              || (variant === 'critical_account' ? 'Entender o que fazer'
                : variant === 'urgent' ? 'Resolver agora'
                : 'Explorar oportunidades')}
            <ArrowRight size={14} strokeWidth={2.4} />
          </button>

          {/* Auto-resolve runs silently in the parent: 60s polling while
              critical + immediate re-check on tab focus. No UI surface —
              when they fix it on Meta, Hero just collapses to stable on
              the next poll. */}
        </div>
      )}
    </div>
  );
};
