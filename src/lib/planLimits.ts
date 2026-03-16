// Plan limits — single source of truth for entire app
export const PLAN_LIMITS = {
  free:   { chat_daily: 3,   chat_total: 3,   tools: false, ad_accounts: 0,   label: "Free"   },
  maker:  { chat_daily: 50,  chat_total: null, tools: true,  ad_accounts: 1,   label: "Maker"  },
  pro:    { chat_daily: 200, chat_total: null, tools: true,  ad_accounts: 3,   label: "Pro"    },
  studio: { chat_daily: null, chat_total: null, tools: true, ad_accounts: null, label: "Studio" },
} as const;

export type PlanKey = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: string | null | undefined) {
  const key = (plan || "free") as PlanKey;
  return PLAN_LIMITS[key] || PLAN_LIMITS.free;
}

export function isFree(plan: string | null | undefined) {
  return !plan || plan === "free";
}

export function canUseTools(plan: string | null | undefined) {
  return getPlanLimits(plan).tools;
}

export function chatDailyLimit(plan: string | null | undefined) {
  return getPlanLimits(plan).chat_daily;
}
// build: Mon Mar 16 02:27:59 UTC 2026
