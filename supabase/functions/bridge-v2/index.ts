// ================================================================
// bridge-v2 — Connects v1 platform_connections to v2 decision engine
//
// This function bridges the existing auth system (platform_connections)
// with the v2 data model (ad_accounts, ads, ad_metrics, etc.)
//
// Flow:
// 1. Read Meta token from platform_connections
// 2. Upsert into ad_accounts (v2)
// 3. Trigger sync-meta-data (full sync)
// 4. Trigger run-decision-engine
// 5. Return feed status
//
// Called by FeedPage on first load or manual "Sincronizar" button.
// ================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }

  const ok = (d: object) => new Response(JSON.stringify(d), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
  const err = (msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });

  try {
    const body = await req.json();
    const { user_id, persona_id } = body;

    if (!user_id || !persona_id) {
      return err("Missing user_id or persona_id");
    }

    // ── 1. Get Meta connection from v1 ──────────────────────────────
    const { data: conn } = await supabase
      .from("platform_connections")
      .select("platform, access_token, ad_accounts, selected_account_id")
      .eq("user_id", user_id)
      .eq("persona_id", persona_id)
      .eq("platform", "meta")
      .eq("status", "active")
      .single();

    if (!conn?.access_token) {
      return err("No active Meta connection found", 404);
    }

    const metaAccounts = (conn.ad_accounts || []) as any[];
    const selectedId = conn.selected_account_id;
    const metaAcc = (selectedId && metaAccounts.find((a: any) => a.id === selectedId)) || metaAccounts[0];

    if (!metaAcc?.id) {
      return err("No ad account found in connection", 404);
    }

    // ── 2. Upsert into v2 ad_accounts ──────────────────────────────
    // The v2 ad_accounts table expects: user_id, meta_account_id, name, access_token
    const metaAccountId = metaAcc.id.replace("act_", ""); // Normalize

    // Check if ad_account already exists
    const { data: existing } = await supabase
      .from("ad_accounts")
      .select("id")
      .eq("user_id", user_id)
      .eq("meta_account_id", metaAccountId)
      .single();

    let v2AccountId: string;

    if (existing?.id) {
      v2AccountId = existing.id;
      // Update token
      await supabase
        .from("ad_accounts")
        .update({
          access_token_encrypted: conn.access_token,
          name: metaAcc.name || "Meta Ads",
          status: "active",
        })
        .eq("id", v2AccountId);
    } else {
      // Create new
      const { data: created, error: createErr } = await supabase
        .from("ad_accounts")
        .insert({
          user_id,
          meta_account_id: metaAccountId,
          name: metaAcc.name || "Meta Ads",
          currency: metaAcc.currency || "BRL",
          timezone: metaAcc.timezone_name || "America/Sao_Paulo",
          status: "active",
          access_token_encrypted: conn.access_token,
        })
        .select("id")
        .single();

      if (createErr || !created) {
        return err(`Failed to create ad_account: ${createErr?.message || "unknown"}`);
      }
      v2AccountId = created.id;
    }

    // ── 3. Trigger sync-meta-data (full sync) ──────────────────────
    let syncResult: any = null;
    try {
      const { data: syncData, error: syncErr } = await supabase.functions.invoke("sync-meta-data", {
        body: { account_id: v2AccountId, sync_type: "full" },
      });
      syncResult = syncErr ? { error: syncErr.message } : syncData;
    } catch (e) {
      syncResult = { error: String(e) };
    }

    // ── 4. Calculate baselines ─────────────────────────────────────
    // Simple baseline calculation from ad_metrics
    try {
      const { data: metrics } = await supabase
        .from("ad_metrics")
        .select("ctr, cpa_cents, roas, spend_cents")
        .eq("account_id", v2AccountId)
        .gt("spend_cents", 100); // Only ads with meaningful spend

      if (metrics && metrics.length >= 3) {
        const ctrs = metrics.map((m: any) => m.ctr || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
        const cpas = metrics.map((m: any) => m.cpa_cents || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
        const roases = metrics.map((m: any) => m.roas || 0).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);

        const percentile = (arr: number[], p: number) => {
          if (arr.length === 0) return 0;
          const idx = Math.floor(arr.length * p);
          return arr[Math.min(idx, arr.length - 1)];
        };

        const dailySpend = metrics.reduce((s: number, m: any) => s + (m.spend_cents || 0), 0) / Math.max(metrics.length, 1);

        await supabase.from("account_baselines").upsert({
          account_id: v2AccountId,
          period_days: 30,
          ctr_p25: percentile(ctrs, 0.25),
          ctr_median: percentile(ctrs, 0.50),
          ctr_p75: percentile(ctrs, 0.75),
          ctr_p95: percentile(ctrs, 0.95),
          cpa_p25: percentile(cpas, 0.25),
          cpa_median: percentile(cpas, 0.50),
          cpa_p75: percentile(cpas, 0.75),
          roas_p25: percentile(roases, 0.25),
          roas_median: percentile(roases, 0.50),
          roas_p75: percentile(roases, 0.75),
          spend_daily_avg: Math.round(dailySpend),
          maturity: metrics.length >= 20 ? "mature" : metrics.length >= 5 ? "establishing" : "new",
          sample_size: metrics.length,
          calculated_at: new Date().toISOString(),
        }, { onConflict: "account_id,period_days" });
      }
    } catch (e) {
      console.error("Baseline calculation error:", e);
    }

    // ── 5. Trigger decision engine ─────────────────────────────────
    let engineResult: any = null;
    try {
      const { data: engineData, error: engineErr } = await supabase.functions.invoke("run-decision-engine", {
        body: { account_id: v2AccountId },
      });
      engineResult = engineErr ? { error: engineErr.message } : engineData;
    } catch (e) {
      engineResult = { error: String(e) };
    }

    return ok({
      ok: true,
      v2_account_id: v2AccountId,
      meta_account_id: metaAcc.id,
      meta_account_name: metaAcc.name,
      sync: syncResult,
      engine: engineResult,
    });

  } catch (e) {
    console.error("Bridge error:", e);
    return err(String(e), 500);
  }
});
