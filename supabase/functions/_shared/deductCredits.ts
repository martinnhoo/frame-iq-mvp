/**
 * Shared credit deduction helper for all edge functions.
 * Drop-in replacement for the old checkThrottle() pattern.
 *
 * Usage in any edge function:
 *   import { requireCredits } from "../_shared/deductCredits.ts";
 *   const check = await requireCredits(supabase, user_id, "analysis");
 *   if (!check.allowed) return new Response(JSON.stringify(check.error), { status: 402, headers });
 */
import { getEffectivePlan, getPlanCreditPool, getCreditCost } from "./credits.ts";

interface CreditCheck {
  allowed: boolean;
  remaining?: number;
  used?: number;
  total?: number;
  error?: { error: string; code: string; remaining?: number; upgrade_needed?: boolean };
}

/**
 * Fire-and-forget: send credit usage email alert when crossing 80% or 100%.
 * Never blocks or throws — runs in background.
 */
function maybeSendCreditAlert(
  supabase: any,
  userId: string,
  remaining: number,
  total: number,
  plan: string,
  cost: number,
): void {
  if (total <= 0) return; // no pool = no alert

  const usedPct = Math.round(((total - remaining) / total) * 100);
  const prevRemaining = remaining + cost; // what remaining was BEFORE this deduction
  const prevPct = Math.round(((total - prevRemaining) / total) * 100);

  let alertType: string | null = null;

  // Crossed 100% (remaining hit 0 or below)
  if (remaining <= 0 && prevRemaining > 0) {
    alertType = "exhausted";
  }
  // Crossed 80% threshold
  else if (usedPct >= 80 && prevPct < 80) {
    alertType = "warning";
  }

  if (!alertType) return;

  // Fire and forget — invoke send-credit-alert edge function
  console.log(`[deduct_credits] Triggering ${alertType} email for user ${userId} (${usedPct}%)`);
  supabase.functions.invoke("send-credit-alert", {
    body: { user_id: userId, type: alertType, remaining, total, used_pct: usedPct, plan },
  }).catch((e: any) => {
    console.error("[deduct_credits] Failed to send credit alert:", e);
  });
}

export async function requireCredits(
  supabase: any,
  userId: string,
  action: string,
  metadata?: Record<string, unknown>,
): Promise<CreditCheck> {
  const cost = getCreditCost(action);
  if (cost === 0) return { allowed: true }; // unknown action = free (safety)

  // Get user plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, email, subscription_status')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    console.error('[deduct_credits] No profile found for user:', userId);
    return {
      allowed: false,
      error: {
        error: 'system_error',
        code: 'PROFILE_NOT_FOUND',
        remaining: 0,
        upgrade_needed: false,
      },
    };
  }

  const plan = getEffectivePlan(profile?.plan, profile?.email);
  const isTrialing = profile?.subscription_status === 'trialing';
  const creditPool = getPlanCreditPool(plan, isTrialing);

  // Deduct via atomic RPC — fail-closed with 1 retry
  const rpcParams = {
    p_user_id: userId,
    p_action: action,
    p_credits: cost,
    p_total_credits: creditPool,
    p_bonus_credits: 0,
    p_metadata: metadata ? JSON.stringify(metadata) : null,
  };

  let data: any = null;
  let error: any = null;

  // Attempt 1
  const attempt1 = await supabase.rpc('deduct_credits', rpcParams);
  data = attempt1.data;
  error = attempt1.error;

  // Retry once on transient error (network, timeout, lock contention)
  if (error) {
    console.warn('[deduct_credits] RPC error on attempt 1, retrying...', error.message);
    await new Promise(r => setTimeout(r, 500)); // 500ms backoff
    const attempt2 = await supabase.rpc('deduct_credits', rpcParams);
    data = attempt2.data;
    error = attempt2.error;
  }

  if (error) {
    console.error('[deduct_credits] RPC error after 2 attempts — BLOCKING action:', error);
    // Fail closed — do NOT allow free usage on system error
    return {
      allowed: false,
      error: {
        error: 'system_error',
        code: 'CREDIT_SYSTEM_UNAVAILABLE',
        remaining: 0,
        upgrade_needed: false,
      },
    };
  }

  if (!data?.allowed) {
    // Credits exhausted — trigger email alert (fire & forget)
    maybeSendCreditAlert(supabase, userId, 0, data?.total ?? creditPool, plan, cost);

    return {
      allowed: false,
      remaining: data?.remaining ?? 0,
      used: data?.used ?? 0,
      total: data?.total ?? 0,
      error: {
        error: 'insufficient_credits',
        code: 'CREDITS_EXHAUSTED',
        remaining: data?.remaining ?? 0,
        upgrade_needed: plan === 'free',
      },
    };
  }

  // Success — check if we crossed a threshold (fire & forget)
  maybeSendCreditAlert(supabase, userId, data.remaining, data.total, plan, cost);

  return {
    allowed: true,
    remaining: data.remaining,
    used: data.used,
    total: data.total,
  };
}
