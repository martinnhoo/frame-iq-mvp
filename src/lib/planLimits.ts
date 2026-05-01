/**
 * AdBrief Credit System — Frontend constants
 * Mirrors supabase/functions/_shared/credits.ts
 */

// Credit costs per action
export const CREDIT_COSTS: Record<string, number> = {
  chat:        2,
  analysis:    5,
  hooks:       2,
  brief:       2,
  board:       2,
  script:      2,
  translation: 1,
  persona:     1,
  competitor:  2,
  video:       5,
};

// Plan credit pools (monthly)
export const PLAN_CREDITS: Record<string, number> = {
  free:   15,
  maker:  1000,
  pro:    2500,
  studio: 99999,  // unlimited
};

// Improvement (melhoria) cost per plan in credits
// Higher plans = cheaper improvements → upgrade incentive
export const IMPROVEMENT_COSTS: Record<string, number> = {
  free:   0,      // upgrade wall
  maker:  30,     // ~33/month
  pro:    15,     // ~166/month (50% off)
  studio: 0,      // unlimited
};

// Personas (negócios) per plan (-1 = unlimited)
// Free gets 1 so they can test the product end-to-end. Pro gets 3
// (e.g. an agency starting with a few clients). Studio is unlimited
// for agencies/operators who manage many businesses.
export const PLAN_AD_ACCOUNTS: Record<string, number> = {
  free:   1,
  maker:  1,
  pro:    3,
  studio: -1,
};

// Plan metadata
export const PLAN_LIMITS = {
  free:   { credits: 15,    ad_accounts: 1,  label: "Free",   improvement_cost: 0  },
  maker:  { credits: 1000,  ad_accounts: 1,  label: "Maker",  improvement_cost: 30 },
  pro:    { credits: 2500,  ad_accounts: 3,  label: "Pro",    improvement_cost: 15 },
  studio: { credits: 99999, ad_accounts: -1, label: "Studio", improvement_cost: 0  },
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

export function getImprovementCost(plan: string | null | undefined): number {
  const raw = plan || "free";
  const key = (PLAN_ALIAS[raw] || raw) as string;
  return IMPROVEMENT_COSTS[key] ?? 0;
}

/** @deprecated Use actionLabel instead */
export function creditLabel(action: string): string {
  return actionLabel(action);
}

/** Format action cost as a user-facing label (never exposes "credits") */
export function actionLabel(_action: string): string {
  return "1 ação";
}
