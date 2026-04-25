// learned-patterns
//
// Phase 3 — turns the action_outcomes dataset into prompt-injectable
// confidence statements that ground every AI recommendation in this
// user's actual track record.
//
// Pipeline (intentionally simple, no ML, no new table):
//   action_outcomes (finalized=true, pattern_candidate=true, improved≠null,
//                    hypothesis.primary_cause ∈ CANONICAL_CAUSES)
//     → group by (action_type, evaluation_metric, primary_cause)
//     → keep groups with n ≥ MIN_N (default 3)
//     → format as
//       "Pausar campanha por fadiga criativa: 3/3 casos (100%)
//        — ~95% spend evitado, R$87/ação | quando CTR ~1.3%, spend ~R$45"
//
// Why bucketize by cause (Phase 3.1):
//   - Same action_type can have very different outcomes depending on WHY.
//     Pausing for creative_fatigue ≠ pausing for budget_starvation.
//   - Without the bucket, a 50% success rate hides "always works for X,
//     never works for Y" — exactly the signal the AI needs to reason.
//
// Why we ALSO compute pre-action context (avg_ctr_before, avg_spend_before):
//   - Lets the AI say "worked when CTR was ~1.3%" instead of just
//     "worked 4/5 times". The first is reasoning; the second is trivia.
//   - Both fields are already stored in metrics_before — zero migration.
//
// Why no new table yet: we don't know the right shape until the data
// shape settles. Aggregating on read is cheap (each user has tens to low
// hundreds of finalized rows) and keeps the loop honest — every chat
// reflects the latest evidence, no stale snapshot.
//
// Honesty principle (mirrors action-outcomes.ts):
//   - n < MIN_N → don't show confidence at all (we say "first time")
//   - improved=null rows are EXCLUDED (they're "not enough signal", not 0)
//   - primary_cause null OR not in CANONICAL_CAUSES → row excluded.
//     Better to drop a row than poison the dataset with strings like
//     "unknown" or random parser drift ("low_ctr" / "ctr_low" / "bad_ctr").
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
const MAX_PATTERN_LINES = 8;

// ── Canonical causes — the only primary_cause values that count ──────────
// MUST match what meta-actions/parseHypothesisFromReasoning emits, plus
// reserved slots for upcoming detector additions. Any cause outside this
// set is treated as noise and the row is excluded from aggregation.
//
// Why a hard whitelist (vs accept-anything):
//   - String free-form drift kills longitudinal datasets. Today the parser
//     emits "low_ctr"; tomorrow someone refactors and it becomes "ctr_low";
//     the dataset silently fragments and patterns stop forming.
//   - Whitelist forces ANY new cause to be added here intentionally,
//     centralizing the contract.
export const CANONICAL_CAUSES = new Set<string>([
  // Currently emitted by parseHypothesisFromReasoning in meta-actions:
  "creative_fatigue",
  "low_hook_strength",
  "wrong_audience",
  "budget_starvation",
  "tracking_gap",
  "high_cpa",
  "low_ctr",
  "low_roas",
  "spend_waste",
  "winning_signal",
  // Reserved — extend the parser to emit these when adding detectors:
  "high_frequency",
  "learning_phase",
  // Lead-quality cause — common in lead-gen + infoproduto flows where
  // people register/opt-in but never convert to actual users/buyers.
  // Different from low_ctr (which is about clicks) or wrong_audience
  // (which is about demographics) — this is about INTENT mismatch:
  // attention is being captured, but by the wrong intent.
  "low_intent_leads",
]);

// PT-BR labels for canonical causes — used only for prompt readability.
// Adding a key here without adding it to CANONICAL_CAUSES has no effect.
const CAUSE_LABELS_PT: Record<string, string> = {
  creative_fatigue: "fadiga criativa",
  low_hook_strength: "hook fraco",
  wrong_audience: "público errado",
  budget_starvation: "budget insuficiente",
  tracking_gap: "tracking quebrado",
  high_cpa: "CPA alto",
  low_ctr: "CTR baixo",
  low_roas: "ROAS baixo",
  spend_waste: "desperdício de spend",
  winning_signal: "winner detectado",
  high_frequency: "frequência alta",
  learning_phase: "fase de aprendizado",
  low_intent_leads: "leads sem intenção real",
};

// ── Types ─────────────────────────────────────────────────────────────────
export type OutcomeRow = {
  action_type: string;
  evaluation_metric: string | null;
  improved: boolean | null;
  recovery_pct: number | null;
  delta_72h: Record<string, number> | null;
  context: Record<string, any> | null;
  hypothesis: { primary_cause?: string | null; expected_effect?: string | null } | null;
  metrics_before: Record<string, any> | null;
};

export type LearnedPattern = {
  action_type: string;
  evaluation_metric: string;
  primary_cause: string;       // always set — bucket key dimension
  n: number;                   // total rows in the group (improved true + false)
  successes: number;           // count where improved = true
  failures: number;            // count where improved = false
  success_rate: number;        // 0–1
  avg_recovery_pct: number | null;     // among successes only; null if none
  avg_avoided_spend_brl: number | null; // pause_* econ value; null otherwise
  // Pre-action context — averaged across ALL rows in the bucket (wins +
  // losses) so the AI sees "the typical situation when this action was
  // taken", not just "the situation when it worked".
  avg_ctr_before: number | null;       // 0–1 (raw ratio, not %)
  avg_spend_before_brl: number | null; // R$
};

// ── Fetch + aggregate ─────────────────────────────────────────────────────
/**
 * Returns the user's learned patterns derived from finalized outcomes.
 * Patterns with n < MIN_N OR with primary_cause not in CANONICAL_CAUSES
 * are EXCLUDED — caller decides how to present the "first time" case.
 * Returns [] when no candidate data exists yet.
 */
export async function getLearnedPatterns(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ patterns: LearnedPattern[]; totalCandidateRows: number }> {
  if (!userId) return { patterns: [], totalCandidateRows: 0 };

  const { data, error } = await supabase
    .from("action_outcomes")
    .select("action_type, evaluation_metric, improved, recovery_pct, delta_72h, context, hypothesis, metrics_before")
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

  // Group by (action_type, evaluation_metric, primary_cause). evaluation_metric=null
  // never enters a bucket (e.g. duplicate_ad has no metric to judge).
  // primary_cause must be in CANONICAL_CAUSES — guards against parser
  // drift and "unknown" pollution.
  const groups = new Map<string, OutcomeRow[]>();
  for (const r of rows) {
    if (!r.evaluation_metric) continue;
    const cause = r.hypothesis?.primary_cause;
    if (!cause || typeof cause !== "string" || !CANONICAL_CAUSES.has(cause)) continue;
    const key = `${r.action_type}::${r.evaluation_metric}::${cause}`;
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }

  const patterns: LearnedPattern[] = [];
  for (const [key, arr] of groups.entries()) {
    if (arr.length < MIN_N) continue;
    const [action_type, evaluation_metric, primary_cause] = key.split("::");
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

    // Pre-action context. Average across ALL rows (wins + losses) — we
    // want "the situation that prompted this action", not "the situation
    // when it worked". The first is what the AI matches on now; the
    // second is hindsight.
    const ctrSamples = arr
      .map((r) => Number(r.metrics_before?.ctr))
      .filter((x) => Number.isFinite(x) && x >= 0);
    const avg_ctr_before = ctrSamples.length
      ? roundTo(ctrSamples.reduce((a, b) => a + b, 0) / ctrSamples.length, 4)
      : null;

    const spendSamples = arr
      .map((r) => Number(r.metrics_before?.spend))
      .filter((x) => Number.isFinite(x) && x >= 0);
    const avg_spend_before_brl = spendSamples.length
      ? round2(spendSamples.reduce((a, b) => a + b, 0) / spendSamples.length)
      : null;

    patterns.push({
      action_type,
      evaluation_metric,
      primary_cause,
      n,
      successes,
      failures,
      success_rate: n > 0 ? successes / n : 0,
      avg_recovery_pct,
      avg_avoided_spend_brl,
      avg_ctr_before,
      avg_spend_before_brl,
    });
  }

  // Sort by evidence strength — score = successes (mathematically equal
  // to n * success_rate, which is the "consistency × volume" metric
  // Martinho specified). Beats the previous (n desc, success_rate desc)
  // sort in the case that matters: 3/3 ranks above 2/10 (3 successes >
  // 2 successes), even though the old sort would surface 2/10 first
  // because n=10 is larger. Surfacing failing-but-large patterns ahead
  // of small-but-clean ones is exactly what we don't want.
  patterns.sort((a, b) => (b.successes - a.successes) || (b.success_rate - a.success_rate));

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

  // Some rows finalized but none reached MIN_N (or none had a canonical
  // cause) → emit a short note. Actively prevents the AI from over-
  // claiming "we always pause these" when we've only seen 1 example.
  if (patterns.length === 0) {
    return [
      "=== APRENDIZADO POR AÇÕES (NESTA CONTA) ===",
      `${totalCandidateRows} ações já foram medidas, mas nenhum padrão atingiu o mínimo de ${MIN_N} amostras com causa identificada.`,
      "REGRA: Quando recomendar uma ação, diga explicitamente 'primeira vez testando isso nesta conta' — NÃO invente histórico.",
    ].join("\n");
  }

  const lines = patterns.map((p) => {
    const causeLabel = CAUSE_LABELS_PT[p.primary_cause] || p.primary_cause;
    const actionLabel = humanizeAction(p.action_type, p.evaluation_metric);
    const pct = Math.round(p.success_rate * 100);
    // Sample-size caveat — when n hits the floor (3), the percentage is
    // arithmetically true but statistically thin. "3/3 (100%)" reads as
    // certainty; "3/3 (amostra pequena, sinal inicial)" reads as the
    // honest signal it is. Removes the % to avoid the fake-confidence
    // anchor while keeping the success count visible.
    const isSmallSample = p.n <= MIN_N;
    const sampleStr = isSmallSample
      ? `${p.successes}/${p.n} casos (amostra pequena — sinal inicial, não conclusivo)`
      : `${p.successes}/${p.n} casos (${pct}% de sucesso)`;
    // "Pausar campanha por fadiga criativa (spend evitado): X/Y casos (...)"
    const main = `  • ${actionLabel} por ${causeLabel}: ${sampleStr}`;

    // ── Outcome detail (what happened) ────────────────────────────────
    const outcome: string[] = [];
    if (p.avg_recovery_pct !== null) {
      const isExec = p.evaluation_metric === "execution";
      outcome.push(isExec
        ? `recuperou ~${p.avg_recovery_pct}% do gasto previsto`
        : `impacto médio +${p.avg_recovery_pct}%`);
    }
    if (p.avg_avoided_spend_brl !== null) {
      outcome.push(`R$${p.avg_avoided_spend_brl.toFixed(2)} de spend evitado por ação`);
    }

    // ── Context detail (when it was taken) ────────────────────────────
    // Surfaces the typical pre-action situation — lets the AI match
    // present conditions against the historical conditions of these wins.
    const context: string[] = [];
    if (p.avg_ctr_before !== null) {
      context.push(`CTR ~${(p.avg_ctr_before * 100).toFixed(2)}%`);
    }
    if (p.avg_spend_before_brl !== null) {
      context.push(`spend ~R$${p.avg_spend_before_brl.toFixed(2)}`);
    }

    const tail: string[] = [];
    if (outcome.length) tail.push(outcome.join(", "));
    if (context.length) tail.push(`quando ${context.join(", ")}`);
    return tail.length ? `${main} — ${tail.join(" | ")}` : main;
  });

  return [
    "=== APRENDIZADO POR AÇÕES (NESTA CONTA) ===",
    `Padrões aprendidos a partir de ${totalCandidateRows} ações já medidas (≥${MIN_N} amostras por bucket causa):`,
    ...lines,
    "",
    "COMO USAR:",
    "- Ao recomendar uma das ações ACIMA, cite o histórico naturalmente: \"funcionou em 4/5 casos similares aqui — pausa por fadiga criativa quando CTR estava perto desse nível\".",
    "- A causa importa MAIS que o tipo de ação. \"Pausar por fadiga\" e \"pausar por budget baixo\" são padrões DIFERENTES — não misture.",
    "- **Match check de similaridade (FAÇA antes de invocar o padrão)**: compare a situação atual contra o contexto pré listado.",
    "    • CTR atual dentro de ±0.5pp do CTR pré E spend atual dentro de ±50% do spend pré → **cenário muito semelhante**, padrão é forte sinal — pode citar o histórico com confiança.",
    "    • Fora desses limites → **cenário diferente**, use o padrão APENAS como referência. NÃO cite o número de sucesso como se aplicasse aqui. Em vez disso, EXPLICITE a diferença com NÚMEROS CONCRETOS: \"Em cenários com CTR ~1.3% essa pausa funcionou bem; aqui estamos em ~3.8%, então o comportamento pode ser diferente — recomendando com cautela.\" Isso mantém transparência E contexto sem criar falsa confiança.",
    "- Se uma linha diz \"amostra pequena — sinal inicial\", NUNCA apresente como certeza. Use \"primeiro indício de que...\", nunca \"sempre funciona\".",
    "- NUNCA invente padrões fora desta lista. Se não estiver aqui, diga \"primeira vez testando isso nesta situação\".",
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
    ctr: "(CTR)",
    cpa: "(CPA)",
    roas: "(ROAS)",
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
function roundTo(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
