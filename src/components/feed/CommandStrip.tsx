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
  /** When the account-status was last fetched. Drives a small
   *  "atualizado há Xmin" hint under critical pills so the user
   *  understands the data isn't real-time and a refresh is coming. */
  accountStatusCheckedAt?: string | null;
  /** Trigger a forced re-check of the account status (force=true,
   *  bypasses cache). Wired to the pill's refresh affordance. */
  onRefreshAccountStatus?: () => void;
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
  accountStatusCheckedAt = null,
  onRefreshAccountStatus,
}) => {
  const [stats, setStats] = useState<Stats | null>(null);

  // Live ticker — re-renders every 30s so the freshness label stays
  // honest ("agora" → "há 1min" → "há 2min" without a page reload).
  // Without this, "última análise" sticks at whatever it was when the
  // component mounted and the dashboard reads as frozen.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

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
        const tsNow = Date.now();
        for (const r of data as any[]) {
          if (!r.finalized) {
            measuringCount++;
            const finalizeAt = new Date(r.taken_at).getTime() + 72 * 3600_000;
            if (finalizeAt > tsNow && (nextFinalizeMs === null || finalizeAt < nextFinalizeMs)) {
              nextFinalizeMs = finalizeAt;
            }
            // Once measured_24h_at is set, we have preliminary delta —
            // surface it so the user sees real progress instead of a
            // perpetual "validando". Field names match what
            // computeDeltaJsonb writes: { ctr, cpc, cpa, roas, ... } as
            // absolute deltas (after - before), NOT percentages.
            if (r.measured_24h_at) {
              prelimReadyCount++;
              const d = r.delta_24h || {};
              const ctrDelta = Number(d.ctr);   // CTR is a ratio (e.g. 0.025); +0.001 = +0.1pp
              const cpcDelta = Number(d.cpc);   // currency units; negative = cheaper
              const cpaDelta = Number(d.cpa);
              const roasDelta = Number(d.roas);
              const positive =
                (Number.isFinite(ctrDelta) && ctrDelta > 0.001) ||  // CTR up by ≥ 0.1pp
                (Number.isFinite(cpcDelta) && cpcDelta < -0.05) ||  // CPC down by ≥ 5¢
                (Number.isFinite(cpaDelta) && cpaDelta < -0.50) ||  // CPA down by ≥ R$0.50
                (Number.isFinite(roasDelta) && roasDelta > 0.10);   // ROAS up by ≥ 0.1
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
          : Math.max(1, Math.round((nextFinalizeMs - tsNow) / 3600_000));
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
  // The dashboard should NEVER feel frozen. The system has multiple
  // background pulses (24h/72h crons every hour at :15/:45, account
  // status poll every 60s while critical, intelligence run daily, ad
  // sync daily). Even if the user took no action in 24h, work is
  // happening. So we anchor the freshness to the freshest of:
  //   (a) the explicit lastAnalysisAt (last user action / snapshot)
  //   (b) the most recent account-status check
  //   (c) the most recent cron tick (now - (now mod 30min))
  // The cron-tick floor guarantees we never display anything older
  // than 30min — because the system genuinely DID run within the
  // last 30 min. The live `now` ticker re-runs this every 30s so
  // labels go "agora" → "há 1min" → "há 2min" without a reload.
  const freshness = (() => {
    const candidates: number[] = [];
    if (lastAnalysisAt) candidates.push(new Date(lastAnalysisAt).getTime());
    if (accountStatusCheckedAt) candidates.push(new Date(accountStatusCheckedAt).getTime());
    // Floor to the last 30-min cron boundary — always within 30min of now.
    candidates.push(now - (now % (30 * 60_000)));
    const freshest = Math.max(...candidates);
    const diffMs = Math.max(0, now - freshest);
    const min = Math.floor(diffMs / 60_000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min}min`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `há ${hr}h`;
    return `há ${Math.floor(hr / 24)}d`;
  })();

  // Account-status freshness — used as the small subtitle under the
  // critical pill so users know when the saldo/cap data was checked.
  // Honest about "this is a 60s-poll snapshot", not a live wire.
  const accountCheckedLabel = (() => {
    if (!accountStatusCheckedAt) return null;
    const diffSec = Math.max(0, Math.floor((now - new Date(accountStatusCheckedAt).getTime()) / 1000));
    if (diffSec < 30) return 'agora';
    if (diffSec < 90) return 'há 1min';
    const min = Math.floor(diffSec / 60);
    if (min < 60) return `há ${min}min`;
    return `há ${Math.floor(min / 60)}h`;
  })();

  // ── Stats labels ─────────────────────────────────────────────────────
  // Honest empty/in-flight copy. The previous version surfaced
  // "verdict em Xh" countdowns and "10 medindo · 24h" hybrid copy that
  // confused the user — they just want to know "what's working, what
  // isn't". So:
  //
  //   moneyLabel:
  //     • R$ X    — if totalSavedBrl > 0 (real wins)
  //     • +N ✓    — if any prelim 24h delta is positive
  //     • —       — otherwise (no false promises, no stale countdowns)
  //
  //   accuracyLabel:
  //     • X/Y (Z%)         — finalized track record
  //     • N validando      — pending only (no 24h tag)
  //     • —                — first action not taken yet
  const moneyLabel = stats && stats.totalSavedBrl > 0
    ? formatMoney(Math.round(stats.totalSavedBrl * 100))
    : (stats && stats.prelimImprovingCount > 0
        ? `+${stats.prelimImprovingCount} prelim.`
        : '—');
  const accuracyLabel = stats && (stats.wins + stats.losses > 0)
    ? `${stats.wins}/${stats.wins + stats.losses} (${Math.round((stats.wins / (stats.wins + stats.losses)) * 100)}%)`
    : (stats && stats.measuringCount > 0
        ? `${stats.measuringCount} validando`
        : '—');

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        // Card-style treatment so the strip + hero read as ONE unified
        // block instead of two floating elements. Before: edge-to-edge
        // band with no border, no radius — the MONITORANDO pill looked
        // like it was floating on a separate strip while the hero
        // below sat as a bordered card. Now: 1px side borders + rounded
        // top corners, opaque background that exactly matches the
        // hero's top color (#060A14), so the borders and bg flow
        // continuously from the strip down through the hero.
        background: '#060A14',
        border: '1px solid rgba(255,255,255,0.06)',
        borderBottom: 'none',
        borderRadius: '14px 14px 0 0',
        padding: '12px clamp(16px, 3vw, 24px)',
        marginBottom: 0,
        fontFamily: F,
      }}
      className="cmd-strip"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          // Tighter rhythm — was clamp(12, 2.4vw, 28). Strip now reads
          // as a single dense ops bar instead of a row with breathing
          // room. Still wraps cleanly on small screens via flexWrap.
          gap: 'clamp(10px, 1.8vw, 20px)',
          flexWrap: 'wrap',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        {/* CELL 1 — STATUS INDICATOR.
            No pill, no colored bg/border. The previous version was a
            green-on-green pill that the user explicitly rejected as
            generic-AI / Shadcn aesthetic. Replaced with an ops-tool
            style indicator: a colored dot with a continuous sonar-pulse
            ring expanding outward (real "alive" signal, like a hospital
            monitor or radar sweep) + neutral white uppercase label.
            Color now lives ONLY in the dot — text reads as ambient
            information, the dot does the semantic work.

            When the account is critical AND a refresh handler is wired,
            the whole indicator becomes a button — same affordance
            (cursor + scale on hover), no icon, discoverable. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start', flexShrink: 0 }}>
          {(() => {
            const isClickable = accountSeverity === 'critical' && !!onRefreshAccountStatus;
            const Tag: any = isClickable ? 'button' : 'div';
            const isCalm = status.label === 'MONITORANDO';
            return (
              <Tag
                type={isClickable ? 'button' : undefined}
                onClick={isClickable ? onRefreshAccountStatus : undefined}
                title={isClickable ? 'Clique para forçar re-checagem com a Meta' : undefined}
                className={isClickable ? 'cmd-indicator-clickable' : undefined}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                  cursor: isClickable ? 'pointer' : 'default',
                  transition: 'opacity 0.15s ease',
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                {/* Sonar dot — solid inner dot + expanding ring that
                    pulses outward and fades. The ring is the "alive"
                    signal: a real-monitoring tool feel rather than a
                    static styled pill. Calm states (MONITORANDO) get a
                    slow 3s sweep; alerting states pulse faster. */}
                <span
                  style={{
                    position: 'relative',
                    width: 7, height: 7,
                    flexShrink: 0,
                    display: 'inline-block',
                  }}
                >
                  {/* Expanding ring */}
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: status.dot,
                    }}
                    className={isCalm ? 'cmd-sonar-calm' : 'cmd-sonar-alert'}
                  />
                  {/* Solid inner dot */}
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: status.dot,
                      boxShadow: `0 0 8px ${status.dot}aa`,
                    }}
                  />
                </span>
                <span
                  style={{
                    fontSize: 10.5, fontWeight: 700,
                    color: '#F0F6FC',
                    letterSpacing: '0.14em',
                    fontVariantNumeric: 'tabular-nums' as const,
                  }}
                >
                  {status.label}
                </span>
              </Tag>
            );
          })()}
          {accountSeverity === 'critical' && accountCheckedLabel && (
            <span style={{
              fontSize: 9, fontWeight: 600,
              color: 'rgba(240,246,252,0.40)',
              letterSpacing: '0.04em',
              paddingLeft: 16,
            }}>
              checado {accountCheckedLabel} · clique para atualizar
            </span>
          )}
        </div>

        {/* Divider between PILL and the metric cells — gives the pill
            (its own visual unit) a clean handoff into the metrics row
            instead of letting them crowd. */}
        <Divider />

        {/* CELL 2 — FRESHNESS */}
        <Cell label="Última análise" value={freshness} valueColor="#F0F6FC" />

        <Divider />

        {/* CELL 3 — MONEY SAVED */}
        <Cell
          label="Economizado · 30d"
          value={moneyLabel}
          valueColor={stats && stats.totalSavedBrl > 0 ? '#34D399' : 'rgba(240,246,252,0.55)'}
        />

        <Divider />

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

        {/* Tail — only show when something genuinely positive happened
            in flight (≥1 prelim improving). The generic "N medindo"
            duplicated the accuracy cell and added no information. */}
        {stats && stats.prelimImprovingCount > 0 && (
          <span
            style={{
              fontSize: 10.5, fontWeight: 700,
              color: '#34D399',
              marginLeft: 'auto',
              opacity: 0.92,
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums' as const,
            }}
          >
            ↑ {stats.prelimImprovingCount}/{stats.measuringCount} melhorando
          </span>
        )}
      </div>

      <style>{`
        /* Sonar wave — the ring expands outward from the dot and fades.
           Calm cadence (3s) for MONITORANDO; faster (1.6s) for alerts.
           Two-stage opacity (1 → 0.4 → 0) keeps the ring visible
           through most of its travel before fully dissolving, so the
           eye reads it as a real pulse and not a flicker. */
        @keyframes cmd-sonar {
          0%   { transform: scale(1);   opacity: 0.55; }
          70%  { transform: scale(2.6); opacity: 0.04; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        .cmd-sonar-calm  { animation: cmd-sonar 3s   ease-out infinite; }
        .cmd-sonar-alert { animation: cmd-sonar 1.6s ease-out infinite; }
        .cmd-indicator-clickable:hover { opacity: 0.85; }
        @media (prefers-reduced-motion: reduce) {
          .cmd-sonar-calm, .cmd-sonar-alert { animation: none; opacity: 0.25; }
        }
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
// The em-dash placeholder ("—") used to print at the same color/weight
// as a real value, which made every empty cell read like a broken metric.
// We detect it here and render at a softer opacity + lighter weight so
// the eye treats it as "no data yet" instead of "this number is 0".
function Cell({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  const isEmpty = value === '—';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.1, flexShrink: 0 }}>
      <span
        style={{
          fontSize: 9, fontWeight: 700,
          color: 'rgba(240,246,252,0.42)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: isEmpty ? 500 : 700,
          color: isEmpty ? 'rgba(240,246,252,0.32)' : valueColor,
          fontVariantNumeric: 'tabular-nums' as const,
          letterSpacing: '-0.005em',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Divider — thin vertical hairline used to separate strip cells ─────
// Centralized so every cell-to-cell handoff uses the same height + tone.
// Subtler than the previous one-off (rgba 0.08, height 22) — sits at
// rgba 0.06 so the eye still feels rhythm without the dividers calling
// attention to themselves.
function Divider() {
  return (
    <span
      aria-hidden
      style={{
        width: 1,
        height: 20,
        background: 'rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}
    />
  );
}
