/**
 * Shared credit deduction helper for all edge functions.
 * Drop-in replacement for the old checkThrottle() pattern.
 *
 * Usage in any edge function:
 *   import { requireCredits } from "../_shared/deductCredits.ts";
 *   const check = await requireCredits(supabase, user_id, "analysis");
 *   if (!check.allowed) return new Response(JSON.stringify(check.error), { status: 402, headers });
 */
import { getEffectivePlan, getPlanCreditPool, getCreditCost, LIFETIME_ACCOUNTS } from "./credits.ts";

interface CreditCheck {
  allowed: boolean;
  remaining?: number;
  used?: number;
  total?: number;
  error?: { error: string; code: string; remaining?: number; upgrade_needed?: boolean };
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
    console.warn('[deduct_credits] No profile found for user:', userId);
    return { allowed: true }; // fail open — don't block if profile missing
  }

  const email = profile?.email;

  // Lifetime accounts = unlimited
  if (email && LIFETIME_ACCOUNTS[email]) {
    return { allowed: true, remaining: -1 };
  }

  const plan = getEffectivePlan(profile?.plan, email);
  const isTrialing = profile?.subscription_status === 'trialing';
  const creditPool = getPlanCreditPool(plan, isTrialing);

  // Deduct via atomic RPC
  const { data, error } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_action: action,
    p_credits: cost,
    p_total_credits: creditPool,
    p_bonus_credits: 0,
    p_metadata: metadata ? JSON.stringify(metadata) : null,
  });

  if (error) {
    console.error('[deduct_credits] RPC error:', error);
    // On error, allow the action (fail open) to not block users
    return { allowed: true };
  }

  if (!data?.allowed) {
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

  return {
    allowed: true,
    remaining: data.remaining,
    used: data.used,
    total: data.total,
  };
}
