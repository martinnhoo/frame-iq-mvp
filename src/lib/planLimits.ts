/**
 * AdBrief Credit System — Frontend constants
 * Mirrors supabase/functions/_shared/credits.ts
 */

// Credit costs per action
export const CREDIT_COSTS: Record<string, number> = {
  chat:        2,
  analysis:    3,
  hooks:       2,
  brief:       2,
  preflight:   2,
  board:       2,
  script:      2,
  translation: 1,
  persona:     1,
  competitor:  2,
  video:       3,
};

// Plan credit pools (monthly)
export const PLAN_CREDITS: Record<string, number> = {
  free:   15,
  maker:  1000,
  pro:    2500,
  studio: 9000,
};

// Ad accounts per plan (-1 = unlimited)
export const PLAN_AD_ACCOUNTS: Record<string, number> = {
  free:   0,
  maker:  1,
  pro:    3,
  studio: -1,
};

// Plan metadata
export const PLAN_LIMITS = {
  free:   { credits: 15,   ad_accounts: 0,  label: "Free"   },
  maker:  { credits: 1000, ad_accounts: 1,  label: "Maker"  },
  pro:    { credits: 2500, ad_accounts: 3,  label: "Pro"    },
  studio: { credits: 9000, ad_accounts: -1, label: "Studio" },
} as const;

// Legacy plan aliases
const PLAN_ALIAS: Record<string, keyof typeof PLAN_LIMITS> = {
  creator: "maker",
  starter: "pro",
  scale:   "studio",
};

export type PlanKey = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: string | null | undefined) {
  const raw = plan || "free";
  const key = (PLAN_ALIAS[raw] || raw) as PlanKey;
  return PLAN_LIMITS[key] || PLAN_LIMITS.free;
}

export function isFree(plan: string | null | undefined) {
  return !plan || plan === "free";
}

export function getPlanCredits(plan: string | null | undefined): number {
  const raw = plan || "free";
  const key = (PLAN_ALIAS[raw] || raw) as string;
  return PLAN_CREDITS[key] ?? PLAN_CREDITS.free;
}

export function getAdAccountLimit(plan: string | null | undefined): number {
  const raw = plan || "free";
  const key = (PLAN_ALIAS[raw] || raw) as string;
  return PLAN_AD_ACCOUNTS[key] ?? PLAN_AD_ACCOUNTS.free;
}

export function getCreditCost(action: string): number {
  return CREDIT_COSTS[action] ?? 0;
}

/** Format credit cost as readable label */
export function creditLabel(action: string): string {
  const cost = getCreditCost(action);
  return cost === 1 ? "1 crédito" : `${cost} créditos`;
}
