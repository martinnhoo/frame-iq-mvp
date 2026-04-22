/**
 * AI Cost Cap — hard safety guard against runaway Anthropic API spend.
 *
 * Usage in an edge function:
 *   import { checkCostCap, recordCost, estimateCostUsd } from "../_shared/cost-cap.ts";
 *
 *   // Before calling Anthropic (user-attributable calls only):
 *   const cap = await checkCostCap(sb, userId, plan);
 *   if (!cap.allowed) return capExceededResponse(cap);
 *
 *   // After the response:
 *   await recordCost(sb, userId, model, usage.input_tokens, usage.output_tokens);
 *
 * For background/cron calls (daily-intelligence, trend-watcher) you can still call
 * recordCost(..., null, ...) — we track it under the account owner to get visibility.
 */

// Anthropic pricing (USD per 1M tokens) — as of 2026-04
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 1.0,  output: 5.0  },
  "claude-sonnet-4-20250514":  { input: 3.0,  output: 15.0 },
  "claude-opus-4-20250514":    { input: 15.0, output: 75.0 },
};

// Fallback caps if ai_cost_config is unreachable
const FALLBACK_CAPS: Record<string, number> = {
  free:   0.10,
  maker:  0.75,
  pro:    2.00,
  studio: 6.00,
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function estimateCostUsd(
  model: string | null | undefined,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = (model && PRICING[model]) || PRICING["claude-haiku-4-5-20251001"];
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export interface CostCapStatus {
  allowed: boolean;
  spent_usd: number;
  cap_usd: number;
  call_count: number;
}

/**
 * Check whether the user is allowed to make another AI call today.
 * Fails OPEN if the DB is unreachable — we never want to block users on our infra errors.
 */
export async function checkCostCap(
  sb: any,
  userId: string | null,
  plan: string = "free",
): Promise<CostCapStatus> {
  if (!userId) return { allowed: true, spent_usd: 0, cap_usd: 0, call_count: 0 };

  let cap_usd = FALLBACK_CAPS[plan] ?? FALLBACK_CAPS.free;
  try {
    const { data: cfg } = await sb
      .from("ai_cost_config")
      .select("daily_usd_cap")
      .eq("plan", plan)
      .maybeSingle();
    if (cfg?.daily_usd_cap != null) cap_usd = Number(cfg.daily_usd_cap);
  } catch (_) { /* use fallback */ }

  try {
    const { data } = await sb
      .from("ai_cost_daily")
      .select("spent_usd, call_count")
      .eq("user_id", userId)
      .eq("date", today())
      .maybeSingle();

    const spent_usd = Number(data?.spent_usd || 0);
    const call_count = Number(data?.call_count || 0);
    return {
      allowed: spent_usd < cap_usd,
      spent_usd,
      cap_usd,
      call_count,
    };
  } catch (e) {
    console.error("[cost-cap] checkCostCap failed (failing open):", e);
    return { allowed: true, spent_usd: 0, cap_usd, call_count: 0 };
  }
}

/**
 * Record the actual USD cost of a completed AI call.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function recordCost(
  sb: any,
  userId: string | null,
  model: string | null | undefined,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  if (!userId) return;
  const usd = estimateCostUsd(model, inputTokens, outputTokens);
  if (usd <= 0) return;

  try {
    const t = today();
    const { data: existing } = await sb
      .from("ai_cost_daily")
      .select("spent_usd, call_count")
      .eq("user_id", userId)
      .eq("date", t)
      .maybeSingle();

    if (existing) {
      await sb
        .from("ai_cost_daily")
        .update({
          spent_usd: Number(existing.spent_usd) + usd,
          call_count: Number(existing.call_count) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("date", t);
    } else {
      await sb.from("ai_cost_daily").insert({
        user_id: userId,
        date: t,
        spent_usd: usd,
        call_count: 1,
      });
    }
  } catch (e) {
    console.error("[cost-cap] recordCost failed (non-fatal):", e);
  }
}

export function capExceededResponse(cap: CostCapStatus, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      blocks: [{
        type: "warning",
        title: "Limite diário atingido",
        content:
          `Você atingiu o limite de uso de IA para hoje ($${cap.spent_usd.toFixed(2)} de $${cap.cap_usd.toFixed(2)}). ` +
          `O contador zera à meia-noite (UTC). Faça upgrade do plano para mais espaço.`,
      }],
      error: "daily_cost_cap_exceeded",
      cap,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
