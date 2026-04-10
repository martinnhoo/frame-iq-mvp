/**
 * Legacy compatibility layer — re-exports from credits.ts
 * All new code should import directly from credits.ts
 * TODO: Remove this file once all edge functions are migrated
 */
export { getEffectivePlan, LIFETIME_ACCOUNTS, normalizePlan as getEffectivePlanNormalized } from "./credits.ts";
export { PLAN_CREDITS as PLAN_LIMITS_CREDITS } from "./credits.ts";

// ── Legacy exports for functions not yet migrated ────────────────────────────
// These are the old shape — keeping them so nothing breaks during transition

export type PlanKey = "free" | "maker" | "pro" | "studio";
export type LimitKey = "daily_messages" | "translations" | "hooks" | "scripts" | "boards" | "analyses" | "personas" | "preflights";

/** @deprecated Use credits.ts instead */
export const PLAN_LIMITS = {
  daily_messages: { free: 5, maker: 50, pro: 200, studio: -1 },
  translations:   { free: 10, maker: 100, pro: 500, studio: -1 },
  hooks:          { free: 5, maker: 100, pro: 500, studio: -1 },
  scripts:        { free: 3, maker: 50, pro: 200, studio: -1 },
  boards:         { free: 3, maker: 50, pro: 200, studio: -1 },
  analyses:       { free: 5, maker: 50, pro: 200, studio: -1 },
  personas:       { free: 1, maker: 10, pro: 50, studio: -1 },
  preflights:     { free: 3, maker: 50, pro: 200, studio: -1 },
} as const;

/** @deprecated Use credits.ts instead */
export const TRIAL_LIMITS = {
  daily_messages: { free: 5, maker: 20, pro: 80, studio: -1 },
  translations:   { free: 10, maker: 40, pro: 200, studio: -1 },
  hooks:          { free: 5, maker: 40, pro: 200, studio: -1 },
  scripts:        { free: 3, maker: 20, pro: 80, studio: -1 },
  boards:         { free: 3, maker: 20, pro: 80, studio: -1 },
  analyses:       { free: 5, maker: 20, pro: 80, studio: -1 },
  personas:       { free: 1, maker: 4, pro: 20, studio: -1 },
  preflights:     { free: 3, maker: 20, pro: 80, studio: -1 },
} as const;

/** @deprecated Use credits.ts getEffectivePlan instead */
export function getLimit(action: LimitKey, plan: string): number {
  const p = (["free","maker","pro","studio"].includes(plan) ? plan : "free") as PlanKey;
  return PLAN_LIMITS[action][p];
}

/** @deprecated Use credits.ts instead */
export function isWithinLimit(action: LimitKey, plan: string, currentUsage: number): boolean {
  const limit = getLimit(action, plan);
  if (limit === -1) return true;
  return currentUsage < limit;
}

/** @deprecated Use credits.ts instead */
export function getEffectiveLimit(action: LimitKey, plan: string, subscriptionStatus?: string | null): number {
  const isTrialing = subscriptionStatus === "trialing";
  const p = (["free","maker","pro","studio"].includes(plan) ? plan : "free") as PlanKey;
  if (isTrialing) return TRIAL_LIMITS[action][p];
  return PLAN_LIMITS[action][p];
}
