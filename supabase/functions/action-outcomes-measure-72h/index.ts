// action-outcomes-measure-72h
//
// Final measurement + verdict for action_outcomes rows that are 72h+ past
// their taken_at. Re-fetches Meta insights for the target between
// taken_at and now (capped at 72h after taken_at), saves
// metrics_after_72h + delta_72h, then runs the decision tree to compute
// evaluation_metric, improved, recovery_pct. Marks finalized=true so
// the row is done.
//
// The decision tree is in _shared/action-outcomes.ts (computeOutcomeVerdict)
// and is the heart of Phase 2b. It honestly returns null for improved when
// data is insufficient, sample is low, or delta is within noise band — we
// never fake true/false to look smart. The pattern_candidate flag (set by
// meta-actions when source=chat AND hypothesis valid AND metrics real)
// already filters which rows can EVER feed learned_patterns; this cron
// finalizes the data those rows depend on.
//
// Special handling for pause_*: we don't measure CPA/ROAS impact (that
// requires account-level baseline; deferred to v2). Instead we measure
// AVOIDED SPEND — the difference between pre-pause per-day spend × 3
// and the actual 72h spend. Surfaces the economic value of every pause.
//
// Schedule: every hour at :45 (set in 20260424110000_action_outcomes_crons.sql)
//
// Auth: cron-only.

import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";
import {
  fetchSnapshot,
  snapshotToJsonb,
  lookupMetaToken,
  computeOutcomeVerdict,
  type MetricsJsonb,
} from "../_shared/action-outcomes.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BATCH_LIMIT = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!isCronAuthorized(req)) return unauthorizedResponse(cors);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const t0 = Date.now();
  let processed = 0;
  let finalized = 0;
  let improved_true = 0;
  let improved_false = 0;
  let improved_null = 0;
  let skipped_no_token = 0;
  const errors: string[] = [];

  try {
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await sb.from("action_outcomes")
      .select("id, user_id, persona_id, action_type, target_id, target_level, taken_at, metrics_before, context")
      .is("measured_72h_at", null)
      .eq("finalized", false)
      .lte("taken_at", cutoff)
      .order("taken_at", { ascending: true })
      .limit(BATCH_LIMIT);

    if (error) throw error;
    const pending = rows || [];
    processed = pending.length;

    for (const row of pending) {
      try {
        const token = await lookupMetaToken(sb, row.user_id, row.persona_id);
        if (!token) {
          skipped_no_token++;
          continue;
        }

        // Window: taken_at → min(now, taken_at + 72h).
        const sinceISO = String(row.taken_at).slice(0, 10);
        const takenMs = new Date(row.taken_at).getTime();
        const cap = takenMs + 72 * 60 * 60 * 1000;
        const untilDate = new Date(Math.min(Date.now(), cap));
        const untilISO = untilDate.toISOString().slice(0, 10);

        const snapshot = await fetchSnapshot(
          row.target_id,
          row.target_level,
          sinceISO,
          untilISO,
          token,
          3, // 3-day window
        );

        const metricsAfter: MetricsJsonb = snapshotToJsonb(snapshot);

        // Decision tree — heart of the cron.
        const verdict = computeOutcomeVerdict(
          row.action_type,
          row.metrics_before as MetricsJsonb,
          snapshot,
        );

        // Merge new context_note with whatever was already in context.
        const mergedContext = {
          ...(row.context as Record<string, any> || {}),
          ...verdict.context_note,
          measured_at_iso: new Date().toISOString(),
        };

        const { error: upErr } = await sb.from("action_outcomes")
          .update({
            metrics_after_72h: metricsAfter,
            delta_72h: verdict.delta_72h,
            evaluation_metric: verdict.evaluation_metric,
            improved: verdict.improved,
            recovery_pct: verdict.recovery_pct,
            measured_72h_at: new Date().toISOString(),
            finalized: true,
            context: mergedContext,
          })
          .eq("id", row.id);

        if (upErr) {
          errors.push(`row ${row.id}: ${upErr.message || String(upErr)}`);
          continue;
        }

        finalized++;
        if (verdict.improved === true) improved_true++;
        else if (verdict.improved === false) improved_false++;
        else improved_null++;
      } catch (e) {
        errors.push(`row ${row.id}: ${(e as any)?.message || String(e)}`);
      }
    }

    const elapsed = Date.now() - t0;
    console.log("[measure-72h] done", {
      processed, finalized, improved_true, improved_false, improved_null,
      skipped_no_token, elapsed_ms: elapsed, errors_count: errors.length,
    });

    return new Response(JSON.stringify({
      ok: true,
      processed,
      finalized,
      verdicts: { improved_true, improved_false, improved_null },
      skipped_no_token,
      elapsed_ms: elapsed,
      errors: errors.slice(0, 10),
    }), { headers: { ...cors, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("[measure-72h] fatal", (e as any)?.message || e);
    return new Response(JSON.stringify({
      ok: false,
      error: (e as any)?.message || String(e),
      processed,
      finalized,
    }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
