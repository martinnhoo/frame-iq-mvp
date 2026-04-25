// action-outcomes-measure-24h
//
// Picks up action_outcomes rows that are 24h+ past their taken_at and
// haven't had a 24h measurement yet. Re-fetches Meta insights for the
// target between taken_at and now (capped at 24h after taken_at), saves
// metrics_after_24h + delta_24h. Does NOT compute improved — that's the
// 72h cron's job. CTR-class signals are observable here; CPA/ROAS need
// the 72h window to fully attribute.
//
// Schedule: every hour at :15 (set in 20260424110000_action_outcomes_crons.sql)
//
// Auth: cron-only (isCronAuthorized check). The pg_cron job posts with the
// service-role key in the Authorization header.

import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";
import {
  fetchSnapshot,
  snapshotToJsonb,
  lookupMetaToken,
  computeDeltaJsonb,
  type MetricsJsonb,
} from "../_shared/action-outcomes.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// How many rows to process per run. Cron is hourly so a small batch
// (50) keeps each run snappy and any backlog drains within a few hours.
const BATCH_LIMIT = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!isCronAuthorized(req)) return unauthorizedResponse(cors);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const t0 = Date.now();
  let processed = 0;
  let measured = 0;
  let skipped_no_token = 0;
  let skipped_snapshot_failed = 0;
  const errors: string[] = [];

  try {
    // Pending: 24h+ old, not yet measured, not finalized.
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await sb.from("action_outcomes")
      .select("id, user_id, persona_id, target_id, target_level, taken_at, metrics_before")
      .is("measured_24h_at", null)
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
          // Don't mark as measured — token might appear later (re-auth). Try
          // again on next cron tick. Bound retries via the unfinalized index.
          continue;
        }

        // Window: from action's taken_at to now (capped at 24h after).
        const sinceISO = String(row.taken_at).slice(0, 10);
        const takenMs = new Date(row.taken_at).getTime();
        const cap = takenMs + 24 * 60 * 60 * 1000;
        const untilDate = new Date(Math.min(Date.now(), cap));
        const untilISO = untilDate.toISOString().slice(0, 10);

        const snapshot = await fetchSnapshot(
          row.target_id,
          row.target_level,
          sinceISO,
          untilISO,
          token,
          1, // 1-day window
        );

        const metricsAfter: MetricsJsonb = snapshotToJsonb(snapshot);
        const delta = computeDeltaJsonb(row.metrics_before as MetricsJsonb, snapshot);

        const { error: upErr } = await sb.from("action_outcomes")
          .update({
            metrics_after_24h: metricsAfter,
            delta_24h: delta,
            measured_24h_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (upErr) {
          errors.push(`row ${row.id}: ${upErr.message || String(upErr)}`);
          continue;
        }

        measured++;
        if (!snapshot) skipped_snapshot_failed++;
      } catch (e) {
        errors.push(`row ${row.id}: ${(e as any)?.message || String(e)}`);
      }
    }

    const elapsed = Date.now() - t0;
    console.log("[measure-24h] done", { processed, measured, skipped_no_token, skipped_snapshot_failed, elapsed_ms: elapsed, errors_count: errors.length });

    return new Response(JSON.stringify({
      ok: true,
      processed,
      measured,
      skipped_no_token,
      skipped_snapshot_failed,
      elapsed_ms: elapsed,
      errors: errors.slice(0, 10),
    }), { headers: { ...cors, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("[measure-24h] fatal", (e as any)?.message || e);
    return new Response(JSON.stringify({
      ok: false,
      error: (e as any)?.message || String(e),
      processed,
      measured,
    }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
