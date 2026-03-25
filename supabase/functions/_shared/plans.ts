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
};

/** Returns the effective plan, overriding DB value for lifetime accounts */
export function getEffectivePlan(dbPlan: string | null | undefined, email: string | null | undefined): string {
  if (email && LIFETIME_ACCOUNTS[email]) return LIFETIME_ACCOUNTS[email];
  return dbPlan || "free";
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
