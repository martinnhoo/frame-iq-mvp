/**
 * Shared plan utilities for AdBrief edge functions.
 * Single source of truth for plan limits and lifetime account overrides.
 */

// Lifetime accounts — always treated as studio, never limited
export const LIFETIME_ACCOUNTS: Record<string, string> = {
  "martinhovff@gmail.com": "studio",
  "victoriafnogueira@hotmail.com": "studio",
  "isadoradblima@gmail.com": "studio",
  "denis.magalhaes10@gmail.com": "studio",
  "denis@adbrief.pro": "studio",
};

// Legacy plan name normalization — maps old/alternate plan names to current canonical names
const PLAN_ALIASES: Record<string, string> = {
  "creator":  "maker",
  "starter":  "pro",
  "scale":    "studio",
  "lifetime": "studio",
  "appsumo":  "studio",
  "ltd":      "studio",
  "annual_maker":  "maker",
  "annual_pro":    "pro",
  "annual_studio": "studio",
};

/** Returns the effective plan, overriding DB value for lifetime accounts */
export function getEffectivePlan(dbPlan: string | null | undefined, email: string | null | undefined): string {
  if (email && LIFETIME_ACCOUNTS[email]) return LIFETIME_ACCOUNTS[email];
  const raw = dbPlan || "free";
  // Normalize legacy/alias plan names to canonical
  return PLAN_ALIASES[raw] || raw;
}

/** Per-plan limits. -1 = unlimited */
export const PLAN_LIMITS = {
  // Monthly AI chat messages (daily cap)
  daily_messages:    { free: 3,   maker: 50,  pro: 200,  studio: -1 },
  // Monthly translations
  translations:      { free: 10,  maker: 100, pro: 500,  studio: -1 },
  // Monthly hook generations
  hooks:             { free: 5,   maker: 100, pro: 500,  studio: -1 },
  // Monthly scripts
  scripts:           { free: 3,   maker: 50,  pro: 200,  studio: -1 },
  // Monthly boards
  boards:            { free: 3,   maker: 50,  pro: 200,  studio: -1 },
  // Monthly analyses
  analyses:          { free: 5,   maker: 50,  pro: 200,  studio: -1 },
  // Monthly personas
  personas:          { free: 1,   maker: 10,  pro: 50,   studio: -1 },
  // Monthly preflights
  preflights:        { free: 3,   maker: 50,  pro: 200,  studio: -1 },
} as const;

/**
 * Trial limits = 40% of paid plan limits.
 * Applied when subscription_status = "trialing".
 * Prevents full 3-day trial abuse while still delivering real value.
 */
export const TRIAL_LIMITS = {
  daily_messages:    { free: 3,   maker: 20,  pro: 80,   studio: -1 },
  translations:      { free: 10,  maker: 40,  pro: 200,  studio: -1 },
  hooks:             { free: 5,   maker: 40,  pro: 200,  studio: -1 },
  scripts:           { free: 3,   maker: 20,  pro: 80,   studio: -1 },
  boards:            { free: 3,   maker: 20,  pro: 80,   studio: -1 },
  analyses:          { free: 5,   maker: 20,  pro: 80,   studio: -1 },
  personas:          { free: 1,   maker: 4,   pro: 20,   studio: -1 },
  preflights:        { free: 3,   maker: 20,  pro: 80,   studio: -1 },
} as const;

export type PlanKey = "free" | "maker" | "pro" | "studio";
export type LimitKey = keyof typeof PLAN_LIMITS;

/** Returns the limit for a given plan and action. -1 = unlimited */
export function getLimit(action: LimitKey, plan: string): number {
  const p = (["free","maker","pro","studio"].includes(plan) ? plan : "free") as PlanKey;
  return PLAN_LIMITS[action][p];
}

/** Returns true if usage is within limits (false = blocked) */
export function isWithinLimit(action: LimitKey, plan: string, currentUsage: number): boolean {
  const limit = getLimit(action, plan);
  if (limit === -1) return true; // unlimited
  return currentUsage < limit;
}

/**
 * Returns the effective limit for an action, applying trial caps when trialing.
 * Pass subscriptionStatus from profiles.subscription_status.
 */
export function getEffectiveLimit(
  action: LimitKey,
  plan: string,
  subscriptionStatus?: string | null
): number {
  const isTrialing = subscriptionStatus === "trialing";
  const p = (["free","maker","pro","studio"].includes(plan) ? plan : "free") as PlanKey;
  if (isTrialing) return TRIAL_LIMITS[action][p];
  return PLAN_LIMITS[action][p];
}
