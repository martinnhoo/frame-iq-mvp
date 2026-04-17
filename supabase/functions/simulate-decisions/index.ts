/**
 * simulate-decisions
 *
 * Replays historical alert + snapshot data through the new decision pipeline.
 * Does NOT execute anything — pure read-only analysis.
 *
 * Usage: POST /simulate-decisions
 * Body: { account_id, days?: 30 }
 *
 * Returns: simulation report showing how the new pipeline would have
 * changed each historical decision (upgraded, downgraded, blocked, approved).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
  RawDecision,
  FinancialConfig,
  SafetyConfig,
  EnrichedDecision,
} from "../_shared/decision-pipeline/types.ts";
import { evaluateFinancial } from "../_shared/decision-pipeline/financial-filter.ts";

// Note: We DON'T call safety-layer in simulation because it depends on
// real-time action_log state. We only simulate the financial filter +
// confidence + explanation layers.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { account_id, days = 30 } = body;

    if (!account_id) {
      return new Response(JSON.stringify({ error: "account_id required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── 1. Load account financial config ──
    const { data: account } = await sb
      .from("ad_accounts")
      .select("id, profit_margin_pct, break_even_roas, ltv_estimate, monthly_budget_target, currency, max_budget_increase_pct, max_actions_per_day, auto_rollback_enabled, rollback_roas_drop_pct, rollback_window_hours, gradual_scaling_enabled")
      .eq("id", account_id)
      .single();

    const financialConfig: FinancialConfig = {
      profit_margin_pct: account?.profit_margin_pct ?? null,
      break_even_roas: account?.break_even_roas ?? null,
      ltv_estimate: account?.ltv_estimate ?? null,
      monthly_budget_target: account?.monthly_budget_target ?? null,
      currency: account?.currency ?? "BRL",
    };

    // ── 2. Load historical alerts ──
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: alerts } = await sb
      .from("account_alerts")
      .select("*")
      .eq("user_id", body.user_id || account?.user_id)
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    // ── 3. Load historical daily_snapshots (for ad-level data) ──
    const { data: snapshots } = await sb
      .from("daily_snapshots")
      .select("date, top_ads, raw_period, ai_insight")
      .eq("account_id", account_id)
      .gte("date", since.split("T")[0])
      .order("date", { ascending: false });

    // ── 4. Convert historical alerts to RawDecision format ──
    const rawDecisions: (RawDecision & { original_alert: any; snapshot_date?: string })[] = [];

    // From alerts
    for (const alert of (alerts || [])) {
      const raw = alertToRawDecision(alert);
      if (raw) rawDecisions.push({ ...raw, original_alert: alert });
    }

    // From daily_snapshots (AI actions)
    for (const snap of (snapshots || [])) {
      const period = snap.raw_period as any;
      if (!period?.actions) continue;
      for (const action of period.actions) {
        const raw = snapshotActionToRawDecision(action, snap);
        if (raw) rawDecisions.push({ ...raw, original_alert: null, snapshot_date: snap.date });
      }
    }

    // ── 5. Run each through financial filter ──
    const results: SimulationResult[] = [];

    for (const decision of rawDecisions) {
      const financial = evaluateFinancial(decision, financialConfig);

      // Calculate confidence (simplified — no pattern data in simulation)
      const confidence = simpleConfidence(decision);

      results.push({
        date: decision.original_alert?.created_at || decision.snapshot_date || 'unknown',
        target_name: decision.target_name,
        action_type: decision.action_type,
        detection_reason: decision.detection_reason,
        urgency: decision.urgency,

        // Old behavior (current system)
        old_verdict: decision.urgency === 'high' ? 'would_execute' : 'would_suggest',

        // New pipeline verdict
        new_verdict: financial.approved ? 'approved' : 'blocked',
        financial_verdict: financial.verdict,
        break_even_roas: financial.break_even_roas,
        actual_roas: financial.actual_roas,
        margin_of_safety: financial.margin_of_safety,
        recommended_scale_pct: financial.recommended_scale_pct,
        confidence,
        explanation: financial.explanation,

        // Delta
        changed: (decision.urgency === 'high' && !financial.approved) ||
                 (decision.urgency !== 'high' && financial.approved),
        change_type: !financial.approved && decision.urgency === 'high'
          ? 'blocked_by_financial'  // Was going to execute, now blocked
          : financial.approved && decision.urgency !== 'high'
            ? 'upgraded_to_approved' // Was just suggestion, now approved
            : 'no_change',
      });
    }

    // ── 6. Generate summary ──
    const summary = {
      total_decisions: results.length,
      would_change: results.filter(r => r.changed).length,
      blocked_by_financial: results.filter(r => r.change_type === 'blocked_by_financial').length,
      upgraded_to_approved: results.filter(r => r.change_type === 'upgraded_to_approved').length,
      no_change: results.filter(r => r.change_type === 'no_change').length,
      financial_config_used: {
        margin_pct: financialConfig.profit_margin_pct ?? '(default 30%)',
        break_even_roas: financialConfig.break_even_roas ?? '(calculated from default)',
        ltv: financialConfig.ltv_estimate ?? '(not set)',
      },
      confidence_distribution: {
        high: results.filter(r => r.confidence >= 0.7).length,
        medium: results.filter(r => r.confidence >= 0.4 && r.confidence < 0.7).length,
        low: results.filter(r => r.confidence < 0.4).length,
      },
      // Group by type for quick overview
      by_action: {
        pause: results.filter(r => r.action_type === 'pause').length,
        scale: results.filter(r => r.action_type === 'scale_budget').length,
        other: results.filter(r => !['pause', 'scale_budget'].includes(r.action_type)).length,
      },
    };

    return new Response(JSON.stringify({
      ok: true,
      summary,
      decisions: results,
      days_analyzed: days,
      account_id,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

// ════════════════════════════════════════════════════════════════════
// CONVERTERS — historical data → RawDecision
// ════════════════════════════════════════════════════════════════════

interface SimulationResult {
  date: string;
  target_name: string;
  action_type: string;
  detection_reason: string;
  urgency: string;
  old_verdict: string;
  new_verdict: string;
  financial_verdict: string;
  break_even_roas: number | null;
  actual_roas: number | null;
  margin_of_safety: number | null;
  recommended_scale_pct: number | null;
  confidence: number;
  explanation: string;
  changed: boolean;
  change_type: string;
}

function alertToRawDecision(alert: any): RawDecision | null {
  const type = alert.type as string;

  // Map alert type to action
  let actionType: RawDecision['action_type'];
  let metric: string;
  let threshold: number;

  if (['FADIGA_CRITICA', 'ROAS_CRITICO', 'ROAS_COLAPSOU', 'CTR_COLAPSOU', 'RETENCAO_VIDEO_BAIXA', 'SPEND_SEM_RETORNO'].includes(type)) {
    actionType = 'pause';
  } else if (type === 'OPORTUNIDADE_ESCALA' || type.includes('ESCALA')) {
    actionType = 'scale_budget';
  } else {
    actionType = 'review';
  }

  // Extract KPI from alert detail (best effort)
  const roasMatch = alert.detail?.match(/ROAS\s+([\d.]+)/i);
  const ctrMatch = alert.detail?.match(/CTR.*?([\d.]+)%/i);
  const spendMatch = alert.detail?.match(/R\$\s*([\d.,]+)/);
  const freqMatch = alert.detail?.match(/Frequ[eê]ncia\s+([\d.]+)/i);

  const roas = roasMatch ? parseFloat(roasMatch[1]) : undefined;
  const ctr = ctrMatch ? parseFloat(ctrMatch[1]) / 100 : undefined;
  const spend = spendMatch ? parseFloat(spendMatch[1].replace('.', '').replace(',', '.')) : 50; // Default if not parsed
  const frequency = freqMatch ? parseFloat(freqMatch[1]) : undefined;

  // Determine primary metric
  if (type.includes('ROAS')) { metric = 'roas'; threshold = 0.8; }
  else if (type.includes('CTR')) { metric = 'ctr'; threshold = 0.006; }
  else if (type.includes('FADIGA')) { metric = 'frequency'; threshold = 4.0; }
  else if (type.includes('RETENCAO')) { metric = 'thruplay'; threshold = 0.10; }
  else if (type.includes('SPEND')) { metric = 'spend_no_conv'; threshold = 80; }
  else if (type.includes('ESCALA')) { metric = 'roas'; threshold = 2.0; }
  else { metric = 'unknown'; threshold = 0; }

  return {
    action_type: actionType,
    target_id: alert.ad_name || 'unknown', // We don't have Meta ID in alerts
    target_type: 'ad',
    target_name: alert.ad_name || 'Unknown',
    detection_reason: type,
    urgency: alert.urgency === 'high' ? 'high' : 'medium',
    kpi_data: {
      metric,
      current_value: roas ?? ctr ?? frequency ?? 0,
      threshold,
      period_days: 3, // alerts use 72h windows
    },
    spend,
    conversions: 0, // Not available in alert data
    roas,
    ctr,
    frequency,
  };
}

function snapshotActionToRawDecision(action: any, snapshot: any): RawDecision | null {
  const tipo = action.tipo as string;

  let actionType: RawDecision['action_type'];
  if (tipo === 'pausar') actionType = 'pause';
  else if (tipo === 'escalar') actionType = 'scale_budget';
  else if (tipo === 'criar') actionType = 'create_variant';
  else if (tipo === 'revisar') actionType = 'review';
  else return null;

  // Try to find this ad in top_ads
  const topAds = (snapshot.top_ads || []) as any[];
  const matchedAd = topAds.find((a: any) =>
    (a.ad_name || '').includes(action.anuncio) || action.anuncio?.includes(a.ad_name)
  );

  return {
    action_type: actionType,
    target_id: matchedAd?.ad_id || action.anuncio || 'unknown',
    target_type: 'ad',
    target_name: action.anuncio || 'Unknown',
    detection_reason: `AI_${tipo.toUpperCase()}`,
    urgency: action.urgencia === 'alta' ? 'high' : action.urgencia === 'media' ? 'medium' : 'low',
    kpi_data: {
      metric: 'ai_generated',
      current_value: 0,
      threshold: 0,
      period_days: 7,
    },
    spend: matchedAd?.spend ? parseFloat(matchedAd.spend) : 0,
    conversions: matchedAd?.conversions ? parseInt(matchedAd.conversions) : 0,
    roas: matchedAd?.roas ? parseFloat(matchedAd.roas) : undefined,
    ctr: matchedAd?.ctr ? parseFloat(matchedAd.ctr) : undefined,
    frequency: matchedAd?.frequency ? parseFloat(matchedAd.frequency) : undefined,
  };
}

function simpleConfidence(d: RawDecision): number {
  let score = 0.3; // Base
  if (d.spend > 50) score += 0.15;
  if (d.spend > 200) score += 0.10;
  if (d.conversions > 0) score += 0.15;
  if (d.conversions > 10) score += 0.10;
  if (d.roas != null) score += 0.10;
  if (d.kpi_data.period_days >= 7) score += 0.10;
  return Math.min(0.95, Math.max(0.05, score));
}
