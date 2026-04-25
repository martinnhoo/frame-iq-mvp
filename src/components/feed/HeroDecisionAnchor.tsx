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

import React from 'react';
import { ArrowRight } from 'lucide-react';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

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
}

export const HeroDecisionAnchor: React.FC<HeroDecisionAnchorProps> = ({
  recoverableDailyCents,
  killCount,
  otherActionCount,
  topOpportunityName,
  hasData,
  onPrimaryClick,
}) => {
  const recoverableBrl = Math.round(recoverableDailyCents / 100);
  const totalActions = killCount + otherActionCount;

  // ── Variant resolution ─────────────────────────────────────────────────
  let variant: 'urgent' | 'stable' | 'loading';
  if (!hasData) variant = 'loading';
  else if (killCount > 0 || recoverableBrl > 0) variant = 'urgent';
  else variant = 'stable';

  // Color tokens per variant. Discipline: each variant uses ONE accent
  // color. No mix. The user reads the color before the words.
  const tokens = {
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

  return (
    <div
      style={{
        position: 'relative',
        marginBottom: 18,
        padding: 'clamp(22px, 4vw, 32px) clamp(20px, 3vw, 28px)',
        borderRadius: 14,
        background: 'linear-gradient(180deg, #0E1218 0%, #0A0F1C 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
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
          {t.kicker}
        </span>
      </div>

      {/* Hero content */}
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
            Conta operando estável
          </h2>
          <p
            style={{
              margin: '12px 0 0',
              fontSize: 'clamp(13px, 1.4vw, 15px)',
              color: 'rgba(240,246,252,0.62)',
              lineHeight: 1.5,
              maxWidth: 540,
            }}
          >
            Sem urgência detectada agora. Continuo monitorando a cada 15 min — te aviso assim que algo mudar.
          </p>
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
      {(variant === 'urgent' || (variant === 'stable' && totalActions > 0)) && onPrimaryClick && (
        <div style={{ marginTop: 22 }}>
          <button
            onClick={onPrimaryClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 22px',
              borderRadius: 10,
              background: t.ctaBg,
              color: variant === 'urgent' ? '#fff' : 'rgba(240,246,252,0.92)',
              border: variant === 'urgent' ? 'none' : '1px solid rgba(255,255,255,0.10)',
              fontFamily: F,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              letterSpacing: '-0.005em',
              boxShadow: variant === 'urgent' ? `0 0 24px ${t.ambientGlow}` : 'none',
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
            {variant === 'urgent' ? 'Resolver agora' : 'Explorar oportunidades'}
            <ArrowRight size={14} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  );
};
