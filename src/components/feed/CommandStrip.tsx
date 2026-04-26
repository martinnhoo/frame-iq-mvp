// CommandStrip — sticky operations strip at the top of the Feed.
//
// Replaces IntelligenceImpactStrip with a denser, more capable version.
// The strip is the user's persistent "I always know what's going on"
// surface: at any scroll position they can see status, last analysis,
// money saved, and decision accuracy. It's the dashboard-of-the-system
// in 28px of vertical real estate.
//
// 4 cells, left to right (responsive: stacks below 720px):
//
//   1) STATUS PILL   — derived from kill count + alerts:
//                      🟢 ESTÁVEL  ·  🟡 ATENÇÃO  ·  🔴 URGENTE
//      Visible always. Color-coded for peripheral vision parsing.
//
//   2) FRESHNESS     — "última análise: há Xmin"
//                      Sourced from latest action_log/snapshot timestamp.
//                      Establishes "this is monitoring you" belief.
//
//   3) MONEY SAVED   — sum of avoided_spend_brl from action_outcomes
//                      where improved=true (last 30d). Honest accounting.
//
//   4) ACCURACY      — wins / (wins+losses) from finalized outcomes.
//                      Format: "X/Y (Z%)". Excludes inconclusive.
//
// The strip is sticky on scroll (top:0) so it's the persistent
// command line the user can always glance at. Background gradient
// matches the dark theme but with ~96% opacity + backdrop blur so
// content scrolling under it stays subtly visible.

import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatMoney } from '@/lib/format';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

interface CommandStripProps {
  userId?: string | null;
  /** Number of pending kill-type decisions — drives the status pill. */
  killCount?: number;
  /** Number of active critical alerts — boosts urgency one tier. */
  criticalAlertCount?: number;
  /** ISO timestamp of last sync / analysis pass — drives the freshness label. */
  lastAnalysisAt?: string | null;
  /** Account-level severity from Meta (spend cap, billing, etc).
   *  When 'critical', forces the status pill to URGENTE regardless
   *  of decision counts. */
  accountSeverity?: 'ok' | 'warn' | 'critical' | 'unknown' | null;
  /** Specific human message tied to accountSeverity. Used to derive a
   *  contextual status pill label so we don't say "CONTA BLOQUEADA"
   *  (alarmist, sounds like Meta-imposed penalty) when the real cause
   *  is something benign like prepaid balance running out. */
  accountStatusMessage?: string | null;
}

type Stats = {
  totalSavedBrl: number;     // R$, last 30d, improved=true
  wins: number;
  losses: number;
  measuringCount: number;
  /** Of measuringCount, how many already passed the 24h checkpoint
   *  (preliminary signals captured, awaiting final 72h verdict). */
  prelimReadyCount: number;
  /** Of prelim-ready, how many show positive delta (CTR up / CPC down).
   *  Lets us hint "X mostrando melhora cedo" while still honest about
   *  the unfinalized state. */
  prelimImprovingCount: number;
  /** Hours until the next pending measurement finalizes (72h post taken_at).
   *  null when no pendings or all are overdue. */
  hoursToNextFinalize: number | null;
};

export const CommandStrip: React.FC<CommandStripProps> = ({
  userId,
  killCount = 0,
  criticalAlertCount = 0,
  lastAnalysisAt = null,
  accountSeverity = null,
  accountStatusMessage = null,
}) => {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data } = await (supabase as any)
          .from('action_outcomes')
          .select('improved, finalized, context, taken_at, measured_24h_at, delta_24h')
          .eq('user_id', userId)
          .gte('taken_at', cutoff)
          .limit(500);
        if (cancelled || !data) return;
        let totalSavedBrl = 0;
        let wins = 0, losses = 0, measuringCount = 0;
        let prelimReadyCount = 0, prelimImprovingCount = 0;
        let nextFinalizeMs: number | null = null;
        const now = Date.now();
        for (const r of data as any[]) {
          if (!r.finalized) {
            measuringCount++;
            // Track soonest 72h finalize across pendings — only count rows
            // whose taken_at + 72h is still in the future (overdue ones
            // are stuck waiting for the cron, not "X hours away").
            const finalizeAt = new Date(r.taken_at).getTime() + 72 * 3600_000;
            if (finalizeAt > now && (nextFinalizeMs === null || finalizeAt < nextFinalizeMs)) {
              nextFinalizeMs = finalizeAt;
            }
            // Once measured_24h_at is set, we have preliminary delta —
            // surface it so the user sees real progress instead of a
            // perpetual "validando".
            if (r.measured_24h_at) {
              prelimReadyCount++;
              const d = r.delta_24h || {};
              // Prefer CTR delta (most reliable fast signal). Fallback to
              // CPC (lower is better) and CPA (lower is better).
              const ctrDelta = Number(d.ctr_delta_pct ?? d.ctr_pct);
              const cpcDelta = Number(d.cpc_delta_pct ?? d.cpc_pct);
              const cpaDelta = Number(d.cpa_delta_pct ?? d.cpa_pct);
              const positive =
                (Number.isFinite(ctrDelta) && ctrDelta > 5) ||
                (Number.isFinite(cpcDelta) && cpcDelta < -5) ||
                (Number.isFinite(cpaDelta) && cpaDelta < -5);
              if (positive) prelimImprovingCount++;
            }
            continue;
          }
          if (r.improved === true) {
            wins++;
            const v = Number(r.context?.avoided_spend_brl);
            if (Number.isFinite(v) && v > 0) totalSavedBrl += v;
          } else if (r.improved === false) losses++;
        }
        const hoursToNextFinalize = nextFinalizeMs === null
          ? null
          : Math.max(1, Math.round((nextFinalizeMs - now) / 3600_000));
        setStats({
          totalSavedBrl, wins, losses, measuringCount,
          prelimReadyCount, prelimImprovingCount, hoursToNextFinalize,
        });
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Status logic ─────────────────────────────────────────────────────
  // Priority: account-critical > critical alert > active kill > stable.
  // When the account is critical, derive the pill label from the actual
  // cause (saldo, limite, status Meta) instead of the generic "CONTA
  // BLOQUEADA" — which sounds like Meta imposed a penalty/suspension and
  // alarms users when the real cause is something benign like prepaid
  // balance running out (recoverable in 30s).
  const status = (() => {
    if (accountSeverity === 'critical') {
      const m = (accountStatusMessage || '').toLowerCase();
      // Prepaid balance — most common, least alarming
      let label = 'AÇÃO REQUERIDA';
      if (m.includes('saldo') && m.includes('zerado')) label = 'SALDO ZERADO';
      else if (m.includes('saldo')) label = 'SALDO BAIXO';
      // Spend cap (large user-set) — wallet limit, not Meta penalty
      else if (m.includes('limite de gastos')) label = 'LIMITE ATINGIDO';
      // Real Meta-side issues (account_status 2/3/8/101)
      else if (m.includes('desativada') || m.includes('encerrada') || m.includes('pendência')) label = 'CONTA SUSPENSA';
      else if (m.includes('revisão')) label = 'EM REVISÃO';
      return { label, color: '#EF4444', dot: '#F87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.24)' };
    }
    if (criticalAlertCount > 0) return { label: 'URGENTE', color: '#EF4444', dot: '#F87171', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.20)' };
    if (killCount > 0) return { label: 'ATENÇÃO', color: '#F59E0B', dot: '#FBBF24', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.20)' };
    return { label: 'MONITORANDO', color: '#10B981', dot: '#34D399', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.18)' };
  })();

  // ── Freshness label ──────────────────────────────────────────────────
  const freshness = (() => {
    if (!lastAnalysisAt) return 'sincronizando…';
    const diffMs = Date.now() - new Date(lastAnalysisAt).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min}min`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `há ${hr}h`;
    return `há ${Math.floor(hr / 24)}d`;
  })();

  // ── Stats labels ─────────────────────────────────────────────────────
  // Result-framed states with progress transparency. The previous
  // version showed a static "validando" forever, which felt stuck —
  // user complained the dashboard "só fica validando". Now we surface
  // (a) preliminary 24h signals when available, and (b) a countdown
  // to the 72h verdict so the wait feels measured, not abandoned.
  const moneyLabel = stats && stats.totalSavedBrl > 0
    ? formatMoney(Math.round(stats.totalSavedBrl * 100))
    : (stats && stats.prelimImprovingCount > 0
        ? `+${stats.prelimImprovingCount} prelim.`
        : (stats && stats.measuringCount > 0
            ? (stats.hoursToNextFinalize ? `verdict em ${stats.hoursToNextFinalize}h` : 'validando…')
            : 'aguardando 1ª ação'));
  const accuracyLabel = stats && (stats.wins + stats.losses > 0)
    ? `${stats.wins}/${stats.wins + stats.losses} (${Math.round((stats.wins / (stats.wins + stats.losses)) * 100)}%)`
    : (stats && stats.measuringCount > 0
        ? (stats.prelimReadyCount > 0
            ? `${stats.prelimReadyCount}/${stats.measuringCount} com sinal 24h`
            : `${stats.measuringCount} medindo · 24h`)
        : 'aguardando 1ª ação');

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'linear-gradient(180deg, rgba(10,15,28,0.96) 0%, rgba(6,10,20,0.94) 100%)',
        backdropFilter: 'blur(14px) saturate(140%)',
        WebkitBackdropFilter: 'blur(14px) saturate(140%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '10px clamp(14px, 3vw, 24px)',
        marginBottom: 18,
        fontFamily: F,
      }}
      className="cmd-strip"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(12px, 2.4vw, 28px)',
          flexWrap: 'wrap',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        {/* CELL 1 — STATUS PILL */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderRadius: 99,
            background: status.bg,
            border: `1px solid ${status.border}`,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: status.dot,
              boxShadow: `0 0 6px ${status.dot}80`,
            }}
            className={status.label !== 'ESTÁVEL' ? 'cmd-pulse' : undefined}
          />
          <span
            style={{
              fontSize: 10.5, fontWeight: 800,
              color: status.color,
              letterSpacing: '0.10em',
            }}
          >
            {status.label}
          </span>
        </div>

        {/* CELL 2 — FRESHNESS */}
        <Cell label="Última análise" value={freshness} valueColor="#F0F6FC" />

        {/* Divider */}
        <span style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} aria-hidden />

        {/* CELL 3 — MONEY SAVED */}
        <Cell
          label="Economizado · 30d"
          value={moneyLabel}
          valueColor={stats && stats.totalSavedBrl > 0 ? '#34D399' : 'rgba(240,246,252,0.55)'}
        />

        {/* CELL 4 — ACCURACY */}
        <Cell
          label="Decisões certas"
          value={accuracyLabel}
          valueColor={
            stats && stats.wins + stats.losses > 0
              ? (stats.wins / (stats.wins + stats.losses) >= 0.7 ? '#34D399' : '#F0F6FC')
              : 'rgba(240,246,252,0.55)'
          }
        />

        {/* Tail — preliminary signal hint or generic measuring count.
            When at least one row passed the 24h checkpoint, we can be
            specific: "X de Y já mostram melhora cedo". When none did
            yet, fall back to the generic counter. */}
        {stats && stats.measuringCount > 0 && (
          <span
            style={{
              fontSize: 10.5, fontWeight: 600,
              color: stats.prelimImprovingCount > 0 ? '#34D399' : '#FBBF24',
              marginLeft: 'auto',
              opacity: 0.85,
              flexShrink: 0,
            }}
          >
            {stats.prelimImprovingCount > 0
              ? `${stats.prelimImprovingCount}/${stats.measuringCount} melhorando`
              : `${stats.measuringCount} medindo`}
          </span>
        )}
      </div>

      <style>{`
        @keyframes cmd-pulse-anim {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        .cmd-pulse { animation: cmd-pulse-anim 1.6s ease-in-out infinite; }
        @media (max-width: 720px) {
          .cmd-strip > div {
            gap: 10px !important;
          }
        }
      `}</style>
    </div>
  );
};

// ── Cell — small label + value pair, vertical stack ────────────────────
function Cell({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1.1 }}>
      <span
        style={{
          fontSize: 9, fontWeight: 700,
          color: 'rgba(240,246,252,0.40)',
          letterSpacing: '0.10em',
          textTransform: 'uppercase' as const,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13, fontWeight: 700,
          color: valueColor,
          fontVariantNumeric: 'tabular-nums' as const,
          letterSpacing: '-0.005em',
        }}
      >
        {value}
      </span>
    </div>
  );
}
