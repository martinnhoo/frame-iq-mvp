// LiveSystemState — the "system is alive" surface.
//
// Sits between Hero and the decisions stack. Its only job is to make
// the user feel that work IS HAPPENING right now — not vague
// "monitoring" copy, but concrete signals: the action you just
// approved, what the cron is measuring, when the next verdict arrives,
// the first positive signal already detected.
//
// Why this component exists (the brief was specific):
//   - Until now the Feed read as "nothing happened" between visits.
//     Even when the user JUST took an action, the page didn't show
//     any visible system response — the action would silently sit in
//     action_outcomes waiting for the 24h cron.
//   - The brief: "show progress, not waiting". Replace
//     "sincronizando..." with concrete signals like:
//       "3 decisões em medição (resultado em ~12h)"
//       "última ação já evitou R$X até agora"
//       "padrão começando a se formar (2/3 ações)"
//
// Data: action_outcomes (last 10 rows for this user). All computation
// happens client-side; one supabase query per mount. Cheap, real.
//
// Render contract: returns null when there's literally nothing to say
// (no actions ever, no outcomes pending, account is brand new). All
// other states surface SOMETHING — empty-feeling is the failure mode.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Activity, ArrowRight } from 'lucide-react';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

interface LiveSystemStateProps {
  userId?: string | null;
}

type Snapshot = {
  rows: any[];
  lastAction: any | null;
  measuringCount: number;
  finalizedCount: number;
  winCount: number;
  recentWin: any | null;        // most recent improved=true outcome (within 7d)
  recentWinSavedBrl: number | null;
  nextMeasurementMs: number | null; // ms until next 24h or 72h cron picks something up
  formingPattern: { actionType: string; cause: string; n: number } | null;
};

// PT-BR labels for action enum + canonical cause. Local to avoid
// cross-component coupling; identical to the maps in DecisionCard +
// LearningPanel so the vocabulary stays consistent across the page.
const ACTION_LABEL_PT: Record<string, string> = {
  pause_ad: 'Pause de ad',
  pause_adset: 'Pause de conjunto',
  pause_campaign: 'Pause de campanha',
  enable_ad: 'Reativação de ad',
  enable_adset: 'Reativação de conjunto',
  enable_campaign: 'Reativação de campanha',
  budget_increase: 'Aumento de budget',
  budget_decrease: 'Redução de budget',
  duplicate_ad: 'Duplicação de ad',
};
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

export const LiveSystemState: React.FC<LiveSystemStateProps> = ({ userId }) => {
  const navigate = useNavigate();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data, error } = await (supabase as any)
          .from('action_outcomes')
          .select('id, action_type, target_name, hypothesis, taken_at, finalized, improved, recovery_pct, context, metrics_before, metrics_after_24h, measured_24h_at, measured_72h_at')
          .eq('user_id', userId)
          .gte('taken_at', cutoff)
          .order('taken_at', { ascending: false })
          .limit(20);
        if (cancelled || error || !data) {
          setSnap({
            rows: [], lastAction: null, measuringCount: 0,
            finalizedCount: 0, winCount: 0, recentWin: null,
            recentWinSavedBrl: null, nextMeasurementMs: null,
            formingPattern: null,
          });
          setLoading(false);
          return;
        }
        const rows = data as any[];
        const lastAction = rows[0] || null;
        const measuringRows = rows.filter(r => !r.finalized);
        const finalizedRows = rows.filter(r => r.finalized);
        const wins = finalizedRows.filter(r => r.improved === true);
        const recentWin = wins[0] || null;
        const recentWinSavedBrl = recentWin?.context?.avoided_spend_brl
          ? Number(recentWin.context.avoided_spend_brl)
          : null;

        // Next measurement = nearest cron pickup time.
        // Cron 24h picks up rows when (now - taken_at) >= 24h, runs at :15.
        // Cron 72h picks up rows when (now - taken_at) >= 72h, runs at :45.
        // For each measuringRow compute its earliest pickup.
        let nextMs: number | null = null;
        const now = Date.now();
        for (const r of measuringRows) {
          const taken = new Date(r.taken_at).getTime();
          const need24 = !r.measured_24h_at ? Math.max(0, taken + 24 * 3600_000 - now) : Infinity;
          const need72 = Math.max(0, taken + 72 * 3600_000 - now);
          const t = Math.min(need24, need72);
          if (t > 0 && (nextMs === null || t < nextMs)) nextMs = t;
        }

        // Forming pattern = bucket (action_type × primary_cause) with
        // 2 rows close to becoming a pattern (n=3 threshold).
        // Only counts rows that already passed pattern_candidate gate
        // (we don't have that field in the query above — re-add).
        const buckets = new Map<string, number>();
        for (const r of finalizedRows) {
          const cause = r.hypothesis?.primary_cause;
          if (!cause) continue;
          const key = `${r.action_type}::${cause}`;
          buckets.set(key, (buckets.get(key) || 0) + 1);
        }
        let formingPattern: { actionType: string; cause: string; n: number } | null = null;
        for (const [key, n] of buckets.entries()) {
          if (n === 2) { // exactly one short of forming
            const [actionType, cause] = key.split('::');
            formingPattern = { actionType, cause, n };
            break;
          }
        }

        setSnap({
          rows,
          lastAction,
          measuringCount: measuringRows.length,
          finalizedCount: finalizedRows.length,
          winCount: wins.length,
          recentWin,
          recentWinSavedBrl,
          nextMeasurementMs: nextMs,
          formingPattern,
        });
      } catch {
        if (!cancelled) {
          setSnap({
            rows: [], lastAction: null, measuringCount: 0,
            finalizedCount: 0, winCount: 0, recentWin: null,
            recentWinSavedBrl: null, nextMeasurementMs: null,
            formingPattern: null,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading || !snap) return null;
  // Hard guard: if there's literally nothing to say (no rows at all),
  // skip entirely. Other surfaces (Hero, LearningPanel) handle the
  // empty case — repeating it here would be exactly the "weak block"
  // the brief warns against.
  if (snap.rows.length === 0) return null;

  // ── Friendly time formatter ────────────────────────────────────────
  const fmtRemaining = (ms: number): string => {
    const h = Math.max(0, Math.ceil(ms / 3600_000));
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    const r = h % 24;
    return r > 0 ? `${d}d ${r}h` : `${d}d`;
  };
  const fmtAgo = (iso: string): string => {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60_000);
    if (m < 1) return 'agora';
    if (m < 60) return `há ${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    return `há ${d}d`;
  };

  // ── Build the headline + bullet rows ──────────────────────────────
  // Headline reflects the most-positive truthful framing available.
  let headline: string;
  let headlineColor: string;
  if (snap.recentWin && snap.recentWinSavedBrl && snap.recentWinSavedBrl > 0) {
    headline = `Última ação evitou R$ ${snap.recentWinSavedBrl.toFixed(2)} de gasto`;
    headlineColor = '#34D399';
  } else if (snap.measuringCount > 0) {
    headline = `Sistema medindo ${snap.measuringCount} decisão${snap.measuringCount === 1 ? '' : 'ões'}`;
    headlineColor = '#FBBF24';
  } else if (snap.winCount > 0) {
    headline = `${snap.winCount} decisão${snap.winCount === 1 ? '' : 'ões'} já validada${snap.winCount === 1 ? '' : 's'}`;
    headlineColor = '#34D399';
  } else if (snap.finalizedCount > 0) {
    headline = `${snap.finalizedCount} decisão${snap.finalizedCount === 1 ? '' : 'ões'} medida${snap.finalizedCount === 1 ? '' : 's'} recentemente`;
    headlineColor = '#F0F6FC';
  } else {
    headline = `Sistema acompanhando ações recentes`;
    headlineColor = '#F0F6FC';
  }

  type BulletRow = { dot: string; label: string; sub?: string };
  const bullets: BulletRow[] = [];

  // Bullet 1: most recent action — "what you just did"
  if (snap.lastAction) {
    const a = snap.lastAction;
    const actionLabel = ACTION_LABEL_PT[a.action_type] || a.action_type;
    const causeStr = a.hypothesis?.primary_cause
      ? CAUSE_LABEL_PT[a.hypothesis.primary_cause] || a.hypothesis.primary_cause
      : null;
    const target = a.target_name || 'item';
    bullets.push({
      dot: '#38BDF8',
      label: `${actionLabel} · ${target}`,
      sub: `${causeStr ? `por ${causeStr} · ` : ''}${fmtAgo(a.taken_at)}`,
    });
  }

  // Bullet 2: measurement timeline — "when you'll know if it worked"
  if (snap.measuringCount > 0 && snap.nextMeasurementMs !== null && snap.nextMeasurementMs > 0) {
    bullets.push({
      dot: '#FBBF24',
      label: `${snap.measuringCount} em medição`,
      sub: `próximo resultado em ${fmtRemaining(snap.nextMeasurementMs)}`,
    });
  } else if (snap.measuringCount > 0) {
    bullets.push({
      dot: '#FBBF24',
      label: `${snap.measuringCount} em medição`,
      sub: 'aguardando cron de medição',
    });
  }

  // Bullet 3: positive signal already detected (if any) — celebrates
  if (snap.recentWin && snap.recentWin !== snap.lastAction) {
    const w = snap.recentWin;
    const wSaved = snap.recentWinSavedBrl;
    const target = w.target_name || 'item';
    bullets.push({
      dot: '#34D399',
      label: wSaved
        ? `${target} → R$ ${wSaved.toFixed(2)} evitados`
        : `${target} → ação validada`,
      sub: `${w.recovery_pct ? `~${w.recovery_pct.toFixed(0)}% de impacto · ` : ''}${fmtAgo(w.measured_72h_at || w.taken_at)}`,
    });
  }

  // Bullet 4: pattern almost forming — anticipation
  if (snap.formingPattern) {
    const fp = snap.formingPattern;
    const actionLabel = ACTION_LABEL_PT[fp.actionType] || fp.actionType;
    const causeStr = CAUSE_LABEL_PT[fp.cause] || fp.cause;
    bullets.push({
      dot: '#A78BFA',
      label: `Padrão se formando: ${actionLabel} por ${causeStr}`,
      sub: `${fp.n}/3 ações — falta 1 pra virar padrão da conta`,
    });
  }

  // Cap to 4 bullets. Order matters — last action first, then timeline,
  // then validations, then patterns. That's the cognitive hierarchy:
  // "what just happened > when do I know > what worked > what's next".
  const visible = bullets.slice(0, 4);

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(15,23,42,0.7) 0%, rgba(10,15,28,0.85) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 18,
        fontFamily: F,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Activity size={13} strokeWidth={2.2} color="#38BDF8" />
        <span
          style={{
            fontSize: 9.5, fontWeight: 800,
            color: 'rgba(240,246,252,0.45)',
            letterSpacing: '0.10em',
            textTransform: 'uppercase' as const,
          }}
        >
          Sistema ativo
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 12, fontWeight: 700,
            color: headlineColor,
            letterSpacing: '-0.005em',
            fontVariantNumeric: 'tabular-nums' as const,
          }}
        >
          {headline}
        </span>
      </div>

      {/* Bullets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: b.dot, boxShadow: `0 0 6px ${b.dot}80`,
                flexShrink: 0, marginTop: 6,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12.5, fontWeight: 600, color: '#F0F6FC',
                lineHeight: 1.4, letterSpacing: '-0.005em',
              }}>
                {b.label}
              </div>
              {b.sub && (
                <div style={{
                  fontSize: 11, color: 'rgba(240,246,252,0.5)',
                  marginTop: 1, lineHeight: 1.4,
                }}>
                  {b.sub}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer link to History — only renders when there's content
          worth deep-diving into (some finalized outcomes exist). */}
      {snap.finalizedCount > 0 && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={() => navigate('/dashboard/history')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#38BDF8', fontFamily: F,
              fontSize: 11.5, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: 0,
            }}
          >
            ver histórico completo
            <ArrowRight size={11} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  );
};
