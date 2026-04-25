// learned-patterns
//
// Phase 3 — turns the action_outcomes dataset into prompt-injectable
// confidence statements that ground every AI recommendation in this
// user's actual track record.
//
// Pipeline (intentionally simple, no ML, no new table):
//   action_outcomes (finalized=true, pattern_candidate=true, improved≠null)
//     → group by (action_type, evaluation_metric)
//     → keep groups with n ≥ MIN_N (default 3)
//     → format as "X improved Y in N1/N2 cases (Z% success, +W% recovery)"
//
// Why no new table yet: we don't know the right shape until the data
// shape settles. Aggregating on read is cheap (each user has tens to low
// hundreds of finalized rows) and keeps the loop honest — every chat
// reflects the latest evidence, no stale snapshot.
//
// Honesty principle (mirrors action-outcomes.ts):
//   - n < MIN_N → don't show confidence at all (we say "first time")
//   - improved=null rows are EXCLUDED (they're "not enough signal", not 0)
//   - we never invent or extrapolate; pattern lines are tied 1:1 to evidence

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Minimum sample for a pattern to leave the "first time" zone.
// 3 is low but defensible — a 3/3 success is genuine signal in a single
// account, and waiting for 10+ would mean most accounts never see any
// confidence statement during their first months.
export const MIN_N = 3;

// Cap on how many candidate rows we pull per user. Aggregation is in JS
// so this bounds CPU/memory; per-user volume should stay well under
// this for the first year+ of operation.
const ROW_FETCH_CAP = 500;

// How many pattern lines to surface to the model. More than this and
// the prompt block gets noisy; the most-evidence-first sort keeps the
// strongest signals.
const MAX_PATTERN_LINES = 6;

// ── Types ─────────────────────────────────────────────────────────────────
export type OutcomeRow = {
  action_type: string;
  evaluation_metric: string | null;
  improved: boolean | null;
  recovery_pct: number | null;
  delta_72h: Record<string, number> | null;
  context: Record<string, any> | null;
};

export type LearnedPattern = {
  action_type: string;
  evaluation_metric: string;
  n: number;            // total rows in the group (improved true + false)
  successes: number;    // count where improved = true
  failures: number;     // count where improved = false
  success_rate: number; // 0–1
  avg_recovery_pct: number | null; // among successes only; null if none
  // For pause_*: the average avoided spend per success (R$). Surfaces
  // economic value, not just "did it work" — pivotal for the pause loop.
  avg_avoided_spend_brl: number | null;
};

// ── Fetch + aggregate ─────────────────────────────────────────────────────
/**
 * Returns the user's learned patterns derived from finalized outcomes.
 * Patterns with n < MIN_N are EXCLUDED — caller decides how to present
 * the "first time" case. Returns [] when no candidate data exists yet.
 */
export async function getLearnedPatterns(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ patterns: LearnedPattern[]; totalCandidateRows: number }> {
  if (!userId) return { patterns: [], totalCandidateRows: 0 };

  const { data, error } = await supabase
    .from("action_outcomes")
    .select("action_type, evaluation_metric, improved, recovery_pct, delta_72h, context")
    .eq("user_id", userId)
    .eq("finalized", true)
    .eq("pattern_candidate", true)
    .not("improved", "is", null)
    .order("taken_at", { ascending: false })
    .limit(ROW_FETCH_CAP);

  if (error) {
    console.error("[learned-patterns] fetch error:", error.message || String(error));
    return { patterns: [], totalCandidateRows: 0 };
  }

  const rows = (data || []) as OutcomeRow[];
  const totalCandidateRows = rows.length;
  if (!rows.length) return { patterns: [], totalCandidateRows: 0 };

  // Group by (action_type, evaluation_metric). evaluation_metric=null
  // means the row has no judgeable metric (e.g. duplicate_ad) — those
  // never become patterns.
  const groups = new Map<string, OutcomeRow[]>();
  for (const r of rows) {
    if (!r.evaluation_metric) continue;
    const key = `${r.action_type}::${r.evaluation_metric}`;
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }

  const patterns: LearnedPattern[] = [];
  for (const [key, arr] of groups.entries()) {
    if (arr.length < MIN_N) continue;
    const [action_type, evaluation_metric] = key.split("::");
    const successes = arr.filter((r) => r.improved === true).length;
    const failures = arr.filter((r) => r.improved === false).length;
    const n = successes + failures; // ignore stragglers (shouldn't exist after filter)

    // Recovery is meaningful only on the wins — averaging a true (+62%)
    // with a false (which has no recovery pct) would dilute the signal.
    const successRecoveries = arr
      .filter((r) => r.improved === true && typeof r.recovery_pct === "number")
      .map((r) => r.recovery_pct as number);
    const avg_recovery_pct = successRecoveries.length
      ? round1(successRecoveries.reduce((a, b) => a + b, 0) / successRecoveries.length)
      : null;

    // For pause_* actions, surface avoided spend — the killer number that
    // proves these decisions saved real money, not just "improved a metric".
    const avoidedNumbers = arr
      .filter((r) => r.improved === true)
      .map((r) => Number(r.context?.avoided_spend_brl))
      .filter((x) => Number.isFinite(x) && x > 0);
    const avg_avoided_spend_brl = avoidedNumbers.length
      ? round2(avoidedNumbers.reduce((a, b) => a + b, 0) / avoidedNumbers.length)
      : null;

    patterns.push({
      action_type,
      evaluation_metric,
      n,
      successes,
      failures,
      success_rate: n > 0 ? successes / n : 0,
      avg_recovery_pct,
      avg_avoided_spend_brl,
    });
  }

  // Sort by evidence strength — biggest n first, then by success_rate.
  // This keeps "we tried this 12 times" above "we tried this 3 times"
  // even when the latter has higher % success but weaker base.
  patterns.sort((a, b) => (b.n - a.n) || (b.success_rate - a.success_rate));

  return { patterns: patterns.slice(0, MAX_PATTERN_LINES), totalCandidateRows };
}

// ── Format for prompt injection ───────────────────────────────────────────
/**
 * Returns a prompt-ready Portuguese block, or "" when the data is too
 * thin to be honest. The empty-string return is intentional: callers
 * concat directly without a guard, and the section header only appears
 * when we have real signal.
 */
export function formatLearnedPatternsBlock(
  patterns: LearnedPattern[],
  totalCandidateRows: number,
): string {
  // Nothing finalized at all → silent. The rest of the prompt already
  // covers the "no data" case in DADOS DESTA CONTA.
  if (totalCandidateRows === 0) return "";

  // Some rows finalized but none reached MIN_N → emit a short note.
  // This actively prevents the AI from over-claiming "we always pause
  // these" when we've only seen 1 example.
  if (patterns.length === 0) {
    return [
      "=== APRENDIZADO POR AÇÕES (NESTA CONTA) ===",
      `${totalCandidateRows} ações já foram medidas, mas nenhum padrão atingiu o mínimo de ${MIN_N} amostras ainda.`,
      "REGRA: Quando recomendar uma ação, diga explicitamente 'primeira vez testando isso nesta conta' — NÃO invente histórico.",
    ].join("\n");
  }

  const lines = patterns.map((p) => {
    const label = humanizeAction(p.action_type, p.evaluation_metric);
    const pct = Math.round(p.success_rate * 100);
    const main = `  • ${label}: ${p.successes}/${p.n} casos (${pct}% de sucesso)`;
    const detail: string[] = [];
    if (p.avg_recovery_pct !== null) {
      // execution metric (used for pause_*) is binary-ish — recovery_pct
      // is the % of expected spend avoided. Phrase accordingly.
      const isExec = p.evaluation_metric === "execution";
      detail.push(isExec ? `recuperou ~${p.avg_recovery_pct}% do gasto previsto` : `impacto médio +${p.avg_recovery_pct}%`);
    }
    if (p.avg_avoided_spend_brl !== null) {
      detail.push(`R$${p.avg_avoided_spend_brl.toFixed(2)} de spend evitado por ação`);
    }
    return detail.length ? `${main} — ${detail.join(", ")}` : main;
  });

  return [
    "=== APRENDIZADO POR AÇÕES (NESTA CONTA) ===",
    `Padrões aprendidos a partir de ${totalCandidateRows} ações já medidas (≥${MIN_N} amostras cada):`,
    ...lines,
    "",
    "COMO USAR:",
    "- Ao recomendar uma dessas ações, cite o histórico naturalmente: \"funcionou em 4/5 casos aqui antes\".",
    "- NUNCA invente padrões fora desta lista. Se a ação não está aqui, diga \"primeira vez testando isso nesta conta\".",
    "- Esses números são evidência, não promessa — apresente como histórico, não garantia futura.",
  ].join("\n");
}

// ── helpers ───────────────────────────────────────────────────────────────
function humanizeAction(actionType: string, evalMetric: string): string {
  // Map (action_type, evaluation_metric) → natural-language label. Used
  // only for prompt readability; NOT stored anywhere.
  const A: Record<string, string> = {
    pause_ad: "Pausar ad",
    pause_adset: "Pausar conjunto",
    pause_campaign: "Pausar campanha",
    enable_ad: "Reativar ad",
    enable_adset: "Reativar conjunto",
    enable_campaign: "Reativar campanha",
    budget_increase: "Aumentar budget",
    budget_decrease: "Reduzir budget",
    duplicate_ad: "Duplicar ad",
    change_creative: "Trocar criativo",
    change_audience: "Trocar público",
  };
  const M: Record<string, string> = {
    ctr: "para melhorar CTR",
    cpa: "para melhorar CPA",
    roas: "para melhorar ROAS",
    execution: "(spend evitado)",
  };
  return `${A[actionType] || actionType} ${M[evalMetric] || `(${evalMetric})`}`.trim();
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
