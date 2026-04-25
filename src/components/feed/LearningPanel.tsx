// LearningPanel — surfaces what the system has learned from THIS account.
//
// Until now, learned patterns were INVISIBLE to the user — they only
// existed inside the chat AI's prompt context. The whole moat ("system
// learns from your real actions") was happening offstage.
//
// This panel makes it visible. Pulls from action_outcomes (finalized
// + pattern_candidate + improved≠null), groups by canonical cause,
// and renders the top patterns with honest sample-size framing.
//
// Three honest states (mirror chat card + history pill philosophy):
//
//   ACTIVE        — has ≥1 pattern with n ≥ 3. Render top 4 by score.
//                   Each row: action + cause + bar + n/m + context range.
//   FORMING       — has measured outcomes but none reach n ≥ 3 yet.
//                   Render progress: "X/Y necessary for first pattern".
//                   Encourages continued use without faking signal.
//   EMPTY         — zero finalized outcomes. Render motivational empty
//                   state pointing at first action.
//
// Why a panel and not a section in History:
//   - History = past EVENTS. Learning panel = abstracted PATTERNS.
//     Different cognitive level: events answer "what did I do",
//     patterns answer "what does the system know about me".
//   - Renders on Feed (decision surface) so the user sees patterns
//     RIGHT WHEN they're about to make a decision — not in a separate
//     review tab they might never visit.
//
// Sample-size honesty preserved end-to-end:
//   - n < 3 patterns are excluded from "active" rendering.
//   - n = 3 patterns DO show but with explicit "amostra pequena" caveat.
//   - Empty / forming states say so plainly — never invent signal.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Brain, ArrowRight } from 'lucide-react';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

interface LearningPanelProps {
  userId?: string | null;
  /** Optional cap on top-N patterns rendered. Default 4. */
  maxRows?: number;
}

type PatternRow = {
  action_type: string;
  primary_cause: string;
  n: number;
  wins: number;
  successRate: number;     // 0-1
  avgCtrBefore: number | null; // 0-1 raw ratio
  avgAvoidedBrl: number | null; // R$
  score: number;           // wins, used for sorting
};

// Translation maps — kept local to the component because the panel
// renders human-facing text in PT-BR. Mirrors chat-card + DecisionCard
// labels so vocabulary stays consistent across surfaces.
const ACTION_LABEL_PT: Record<string, string> = {
  pause_ad: 'Pausar ad',
  pause_adset: 'Pausar conjunto',
  pause_campaign: 'Pausar campanha',
  enable_ad: 'Reativar ad',
  enable_adset: 'Reativar conjunto',
  enable_campaign: 'Reativar campanha',
  budget_increase: 'Aumentar budget',
  budget_decrease: 'Reduzir budget',
  duplicate_ad: 'Duplicar ad',
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

export const LearningPanel: React.FC<LearningPanelProps> = ({ userId, maxRows = 4 }) => {
  const navigate = useNavigate();
  const [patterns, setPatterns] = useState<PatternRow[] | null>(null);
  const [thinSamples, setThinSamples] = useState(0); // outcomes that exist but don't reach n=3 yet
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        // Pull TWO datasets in parallel:
        //
        //   1) FINALIZED + pattern_candidate outcomes — these are the
        //      raw evidence that becomes a learned pattern (n ≥ 3
        //      same action × cause). Used for the active rendering.
        //   2) ALL outcomes with a primary_cause — used to count
        //      "in-flight" measurements (not yet finalized) and
        //      finalized-but-thin-bucket rows so the FORMING state can
        //      report honest progress instead of falling through to
        //      "primeira decisão" emptiness when the user has 10
        //      actions actively being measured.
        const [finalizedRes, allRes] = await Promise.all([
          (supabase as any)
            .from('action_outcomes')
            .select('action_type, hypothesis, improved, recovery_pct, context, metrics_before')
            .eq('user_id', userId)
            .eq('finalized', true)
            .eq('pattern_candidate', true)
            .not('improved', 'is', null)
            .order('taken_at', { ascending: false })
            .limit(500),
          (supabase as any)
            .from('action_outcomes')
            .select('action_type, hypothesis, finalized')
            .eq('user_id', userId)
            .order('taken_at', { ascending: false })
            .limit(500),
        ]);
        const data = finalizedRes?.data;
        const allRows = (allRes?.data || []) as any[];
        if (cancelled || finalizedRes?.error || !data) {
          // Even if finalized query fails, derive thinSamples from
          // the all-outcomes query so the panel can still report
          // forming state instead of pristine.
          const inflight = allRows.filter((r: any) =>
            r.hypothesis?.primary_cause &&
            (!r.finalized || true)
          ).length;
          setPatterns([]);
          setThinSamples(inflight);
          setLoading(false);
          return;
        }
        // Group by (action_type, primary_cause)
        const groups = new Map<string, any[]>();
        for (const r of data as any[]) {
          const cause = r.hypothesis?.primary_cause;
          if (!cause || typeof cause !== 'string') continue;
          const key = `${r.action_type}::${cause}`;
          const arr = groups.get(key);
          if (arr) arr.push(r);
          else groups.set(key, [r]);
        }
        const computed: PatternRow[] = [];
        let thin = 0;
        for (const [key, rows] of groups.entries()) {
          if (rows.length < 3) {
            thin += rows.length;
            continue;
          }
          const [action_type, primary_cause] = key.split('::');
          const wins = rows.filter(r => r.improved === true).length;
          const n = rows.length;
          const ctrs = rows
            .map(r => Number(r.metrics_before?.ctr))
            .filter(x => Number.isFinite(x) && x >= 0);
          const avoided = rows
            .filter(r => r.improved === true)
            .map(r => Number(r.context?.avoided_spend_brl))
            .filter(x => Number.isFinite(x) && x > 0);
          computed.push({
            action_type,
            primary_cause,
            n,
            wins,
            successRate: n > 0 ? wins / n : 0,
            avgCtrBefore: ctrs.length
              ? Math.round((ctrs.reduce((a, b) => a + b, 0) / ctrs.length) * 10000) / 10000
              : null,
            avgAvoidedBrl: avoided.length
              ? Math.round((avoided.reduce((a, b) => a + b, 0) / avoided.length) * 100) / 100
              : null,
            score: wins,
          });
        }
        // Sort by score (= wins, mathematically n × success_rate)
        computed.sort((a, b) => b.score - a.score || b.successRate - a.successRate);
        // Add IN-FLIGHT measurements (not finalized yet) to thin so the
        // forming-state copy reports honest progress when the user has
        // active actions being measured.
        const inflight = allRows.filter((r: any) =>
          r.hypothesis?.primary_cause && !r.finalized
        ).length;
        if (!cancelled) {
          setPatterns(computed);
          setThinSamples(thin + inflight);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setPatterns([]);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Empty / loading guards ─────────────────────────────────────────
  if (loading) {
    return (
      <Shell>
        <Header label="Aprendizado da conta" sub="" />
        <div style={{ padding: '24px 16px', fontSize: 12, color: 'rgba(240,246,252,0.4)', fontStyle: 'italic' as const }}>
          carregando padrões…
        </div>
      </Shell>
    );
  }

  if (!patterns || patterns.length === 0) {
    // Two empty sub-states with deliberately different copy:
    //  - FORMING: user has measured outcomes but no bucket reached n=3.
    //    Surface progress + next-pattern timeline.
    //  - PRISTINE: zero outcomes. Surface the deal — "first action unlocks
    //    the loop", not "system is empty".
    const isForming = thinSamples > 0;
    return (
      <Shell>
        <Header
          label="Aprendizado da conta"
          sub={isForming
            ? `${thinSamples} ${thinSamples === 1 ? 'ação sendo catalogada' : 'ações sendo catalogadas'} — primeiro padrão em até 72h`
            : 'cada ação aprovada vira evidência'}
        />
        <div style={{ padding: '18px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Brain size={26} strokeWidth={1.6} color="rgba(56,189,248,0.55)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {isForming ? (
              <>
                <p style={{ fontSize: 13, color: '#F0F6FC', lineHeight: 1.55, margin: '0 0 6px', fontWeight: 600 }}>
                  {thinSamples === 1
                    ? '1 ação já catalogada por causa.'
                    : `${thinSamples} ações já catalogadas por causa.`}
                </p>
                <p style={{ fontSize: 12.5, color: 'rgba(240,246,252,0.6)', lineHeight: 1.5, margin: 0 }}>
                  Cada combinação <strong style={{ color: '#F0F6FC' }}>(ação × causa)</strong> precisa de 3 medições
                  pra virar padrão confiável dessa conta. A medição leva ~72h por ação — assim que a 3ª
                  do mesmo tipo finalizar, ela aparece aqui como conhecimento permanente.
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: '#F0F6FC', lineHeight: 1.55, margin: '0 0 6px', fontWeight: 600 }}>
                  O loop começa na sua próxima decisão.
                </p>
                <p style={{ fontSize: 12.5, color: 'rgba(240,246,252,0.6)', lineHeight: 1.5, margin: 0 }}>
                  Toda ação aprovada (pause, escala, ajuste) vira evidência catalogada por causa.
                  3 ações da mesma combinação = primeiro padrão da SUA conta.
                </p>
              </>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // ── Active state — render top patterns ─────────────────────────────
  const visible = patterns.slice(0, maxRows);
  const remaining = patterns.length - visible.length;

  return (
    <Shell>
      <Header
        label="Aprendizado da conta"
        sub={`${patterns.length} padr${patterns.length === 1 ? 'ão' : 'ões'} aprendid${patterns.length === 1 ? 'o' : 'os'}`}
      />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {visible.map((p, i) => (
          <PatternRowView key={i} p={p} divider={i < visible.length - 1} />
        ))}
      </div>
      {(remaining > 0 || thinSamples > 0) && (
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 11, color: 'rgba(240,246,252,0.4)' }}>
            {remaining > 0 && `+${remaining} padr${remaining === 1 ? 'ão' : 'ões'}`}
            {remaining > 0 && thinSamples > 0 && ' · '}
            {thinSamples > 0 && `${thinSamples} ${thinSamples === 1 ? 'em formação' : 'em formação'}`}
          </span>
          <button
            onClick={() => navigate('/dashboard/history')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: F,
              fontSize: 11.5,
              fontWeight: 600,
              color: '#38BDF8',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: 0,
            }}
          >
            ver histórico
            <ArrowRight size={11} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </Shell>
  );
};

// ── Internal: visual shell + header ───────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(15,23,42,0.7) 0%, rgba(10,15,28,0.85) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        overflow: 'hidden',
        fontFamily: F,
      }}
    >
      {children}
    </div>
  );
}

function Header({ label, sub }: { label: string; sub: string }) {
  return (
    <div
      style={{
        padding: '12px 14px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 800,
          color: 'rgba(240,246,252,0.42)',
          letterSpacing: '0.10em',
          textTransform: 'uppercase' as const,
        }}
      >
        {label}
      </span>
      {sub && (
        <span style={{ fontSize: 11.5, color: 'rgba(240,246,252,0.55)', fontWeight: 500 }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ── Pattern row — one learned pattern, presented with honesty ─────────
function PatternRowView({ p, divider }: { p: PatternRow; divider: boolean }) {
  const action = ACTION_LABEL_PT[p.action_type] || p.action_type;
  const cause = CAUSE_LABEL_PT[p.primary_cause] || p.primary_cause;
  const pct = Math.round(p.successRate * 100);
  const isSmall = p.n <= 3; // sample-size caveat threshold
  const successColor = p.successRate >= 0.7 ? '#34D399' : p.successRate >= 0.4 ? '#FBBF24' : '#F87171';

  return (
    <div
      style={{
        padding: '12px 14px',
        borderBottom: divider ? '1px solid rgba(255,255,255,0.04)' : 'none',
      }}
    >
      {/* Top row: title + n/m */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#F0F6FC', lineHeight: 1.3 }}>
          {action} <span style={{ color: 'rgba(240,246,252,0.55)', fontWeight: 500 }}>por {cause}</span>
        </p>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: successColor,
            fontVariantNumeric: 'tabular-nums' as const,
            flexShrink: 0,
          }}
        >
          {p.wins}/{p.n}
        </span>
      </div>

      {/* Visual bar */}
      <div
        style={{
          height: 3,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
          marginBottom: 6,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, pct)}%`,
            background: successColor,
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Honest detail line */}
      <p style={{ margin: 0, fontSize: 11, color: 'rgba(240,246,252,0.5)', lineHeight: 1.45 }}>
        {isSmall
          ? <>amostra pequena · sinal inicial</>
          : (
            <>
              {pct}% de sucesso
              {p.avgCtrBefore !== null && (
                <> · funciona quando CTR ~{(p.avgCtrBefore * 100).toFixed(2)}%</>
              )}
              {p.avgAvoidedBrl !== null && (
                <> · ~R$ {p.avgAvoidedBrl.toFixed(2)}/ação evitados</>
              )}
            </>
          )}
      </p>
    </div>
  );
}
