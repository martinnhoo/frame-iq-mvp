import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * cleanup-old-data — Weekly TTL cron for unbounded tables.
 * Schedule: Every Sunday at 3 AM (low traffic)
 *
 * Tables cleaned:
 *  - credit_transactions: > 12 months
 *  - action_log: > 12 months
 *  - processed_webhook_events: > 30 days
 *  - signup_rate_limits: > 24 hours
 *  - checkout_attempts: > 7 days
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[CLEANUP] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    logStep("Cleanup started");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const results: Record<string, number> = {};

    // 1. credit_transactions > 12 months
    const { count: txCount } = await supabase
      .from("credit_transactions")
      .delete()
      .lt("created_at", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
      .select("*", { count: "exact", head: true });
    // Actually delete
    const { error: txErr } = await supabase
      .from("credit_transactions")
      .delete()
      .lt("created_at", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());
    results.credit_transactions = txErr ? -1 : (txCount ?? 0);
    logStep("credit_transactions", { deleted: results.credit_transactions, error: txErr?.message });

    // 2. action_log > 12 months
    const { error: alErr } = await supabase
      .from("action_log")
      .delete()
      .lt("executed_at", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());
    results.action_log = alErr ? -1 : 0;
    logStep("action_log", { error: alErr?.message });

    // 3. processed_webhook_events > 30 days
    const { error: weErr } = await supabase
      .from("processed_webhook_events")
      .delete()
      .lt("processed_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    results.processed_webhook_events = weErr ? -1 : 0;
    logStep("processed_webhook_events", { error: weErr?.message });

    // 4. signup_rate_limits > 24 hours
    const { error: rlErr } = await supabase
      .from("signup_rate_limits")
      .delete()
      .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    results.signup_rate_limits = rlErr ? -1 : 0;
    logStep("signup_rate_limits", { error: rlErr?.message });

    // 5. checkout_attempts > 7 days
    const { error: caErr } = await supabase
      .from("checkout_attempts")
      .delete()
      .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    results.checkout_attempts = caErr ? -1 : 0;
    logStep("checkout_attempts", { error: caErr?.message });

    logStep("Cleanup complete", results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
