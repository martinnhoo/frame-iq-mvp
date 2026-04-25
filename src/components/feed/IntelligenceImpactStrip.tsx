// IntelligenceImpactStrip — persistent header at top of Feed.
//
// Surfaces the cumulative impact of the AI's measured decisions in a
// single thin strip that's ALWAYS visible (vs MoneyBar which only shows
// when there's an active loss). The number comes from action_outcomes
// — the same dataset that drives learned_patterns — so it represents
// real measured wins (improved=true after 72h cron), not predicted
// or speculated savings.
//
// Why a separate strip vs extending MoneyBar:
//   - MoneyBar's "Economizado" pill is contextual (only renders inside
//     the "Dinheiro em risco" zone). When the account is healthy and
//     there's no loss, that pill disappears — exactly when the user
//     would benefit most from seeing cumulative proof.
//   - This strip is independent: cumulative across 30d, lives at top
//     of page, doesn't depend on current-loss state.
//
// Honesty principles (mirrors the rest of the system):
//   - Sums ONLY rows where improved=true AND finalized=true. Pending
//     measurements don't contribute to the headline number.
//   - Shows acertos/total — not just acertos. User sees the failure
//     rate too. Trust > vanity.
//   - Empty state never invents numbers. New accounts see a friendly
//     "primeiros resultados em 24h" message.
//
// Cost: one supabase query per Feed mount, filtered by user_id +
// last 30 days. Aggregation in JS over <500 rows. Cheap.

import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatMoney } from '@/lib/format';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

interface IntelligenceImpactStripProps {
  userId?: string | null;
  windowDays?: number; // defaults to 30
}

type Stats = {
  totalSavedBrl: number;     // sum of avoided_spend_brl from improved rows
  wins: number;               // count where improved=true
  losses: number;             // count where improved=false
  inconclusive: number;       // finalized but improved=null
  measuringNow: number;       // not yet finalized
};

export const IntelligenceImpactStrip: React.FC<IntelligenceImpactStripProps> = ({
  userId,
  windowDays = 30,
}) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const cutoff = new Date(Date.now() - windowDays * 86400000).toISOString();
        const { data, error } = await (supabase as any)
          .from('action_outcomes')
          .select('improved, finalized, context, taken_at')
          .eq('user_id', userId)
          .gte('taken_at', cutoff)
          .limit(500);
        if (cancelled) return;
        if (error || !data) {
          setStats({ totalSavedBrl: 0, wins: 0, losses: 0, inconclusive: 0, measuringNow: 0 });
          setLoading(false);
          return;
        }
        const rows = data as any[];
        let totalSavedBrl = 0;
        let wins = 0, losses = 0, inconclusive = 0, measuringNow = 0;
        for (const r of rows) {
          if (!r.finalized) {
            measuringNow++;
            continue;
          }
          if (r.improved === true) {
            wins++;
            const v = Number(r.context?.avoided_spend_brl);
            if (Number.isFinite(v) && v > 0) totalSavedBrl += v;
          } else if (r.improved === false) {
            losses++;
          } else {
            inconclusive++;
          }
        }
        setStats({ totalSavedBrl, wins, losses, inconclusive, measuringNow });
      } catch {
        if (!cancelled) {
          setStats({ totalSavedBrl: 0, wins: 0, losses: 0, inconclusive: 0, measuringNow: 0 });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, windowDays]);

  // Render nothing while loading — strip appearing late is fine; a flash
  // of "0 economizado" would be jarring.
  if (loading || !stats) return null;

  const totalActions = stats.wins + stats.losses + stats.inconclusive;
  const hasAnyMeasured = totalActions > 0;
  const successRate = stats.wins + stats.losses > 0
    ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100)
    : 0;

  // Empty state — first-week experience. Strip stays visible to
  // communicate that the system is ALREADY watching, just hasn't had
  // time to measure outcomes yet.
  if (!hasAnyMeasured && stats.measuringNow === 0) {
    return (
      <Strip
        accent="#94A3B8"
        leftLabel="IA"
        leftValue="Aprendizado começa após sua 1ª ação"
        rightLabel={null}
        rightValue={null}
        helper="Faça uma ação pelo Estrategista e a medição roda em 24h."
      />
    );
  }

  // Active state — has measurements (some pending or all done).
  // Headline = R$ saved (or, when nothing-finalized-yet, the count of
  // pending measurements as a proxy for "the system is on it").
  if (totalActions === 0 && stats.measuringNow > 0) {
    return (
      <Strip
        accent="#FBBF24"
        leftLabel="IA"
        leftValue="Medindo primeiras decisões"
        rightLabel="Em medição"
        rightValue={`${stats.measuringNow}`}
        helper="Resultado final em até 72h por ação."
      />
    );
  }

  return (
    <Strip
      accent="#34D399"
      leftLabel={`Economizado pela IA · ${windowDays}d`}
      leftValue={formatMoney(Math.round(stats.totalSavedBrl * 100))}
      rightLabel={stats.wins + stats.losses > 0 ? 'Decisões certas' : 'Em medição'}
      rightValue={
        stats.wins + stats.losses > 0
          ? `${stats.wins}/${stats.wins + stats.losses} (${successRate}%)`
          : `${stats.measuringNow}`
      }
      helper={
        stats.measuringNow > 0
          ? `+ ${stats.measuringNow} ${stats.measuringNow === 1 ? 'em medição' : 'em medição'}${stats.inconclusive > 0 ? ` · ${stats.inconclusive} ${stats.inconclusive === 1 ? 'inconclusivo' : 'inconclusivos'}` : ''}`
          : stats.inconclusive > 0
          ? `${stats.inconclusive} ${stats.inconclusive === 1 ? 'inconclusivo' : 'inconclusivos'}`
          : null
      }
    />
  );
};

// ── Internal: visual shell. Kept inline because no other component
// needs this layout, and inlining keeps the styling co-located with
// the data semantics it presents.
function Strip({
  accent,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  helper,
}: {
  accent: string;
  leftLabel: string;
  leftValue: string;
  rightLabel: string | null;
  rightValue: string | null;
  helper: string | null;
}) {
  return (
    <div
      style={{
        fontFamily: F,
        background: 'linear-gradient(180deg, #0E1218 0%, #0B0E14 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `2px solid ${accent}`,
        borderRadius: 6,
        padding: '12px 16px',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      {/* Left: cumulative R$ saved + helper */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {leftLabel}
        </div>
        <div
          style={{
            fontSize: 'clamp(18px,2.6vw,22px)',
            fontWeight: 800,
            color: accent,
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
          }}
        >
          {leftValue}
        </div>
        {helper && (
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.4)',
              fontWeight: 500,
              marginTop: 2,
            }}
          >
            {helper}
          </div>
        )}
      </div>

      {/* Right: success rate column (when applicable) */}
      {rightLabel && rightValue && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 2,
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {rightLabel}
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {rightValue}
          </div>
        </div>
      )}
    </div>
  );
}
