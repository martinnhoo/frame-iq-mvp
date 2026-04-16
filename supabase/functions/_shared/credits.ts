/**
 * AdBrief Credit System — Single source of truth
 *
 * Every AI action costs credits. Plans grant a monthly credit pool.
 * Safeguards:
 *  - Worst-case margin ≥ 10% (Studio) even if 100% chat with 20-msg conversations
 *  - Realistic margin ~60%+ across all plans (mixed usage)
 *  - Conversation cap at 20 messages to prevent unbounded context cost
 *
 * Credit costs per action:
 *  Chat message   = 2 credits (most expensive per-credit due to context growth)
 *  Análise Vídeo  = 5 credits (visual + audio analysis via Gemini multimodal)
 *  Gerar Hooks    = 2 credits
 *  Criar Brief    = 2 credits
 *  Preflight      = 2 credits
 *  Board          = 2 credits
 *  Script         = 2 credits
 *  Tradução       = 1 credit
 *  Persona        = 1 credit
 *  Competitor     = 2 credits
 */

// ── Credit cost per action ────────────────────────────────────────────────────
export const CREDIT_COSTS: Record<string, number> = {
  chat:        2,
  analysis:    5,
  hooks:       2,
  brief:       2,
  preflight:   2,
  board:       2,
  script:      2,
  translation: 1,
  persona:     1,
  competitor:  2,
  video:       5,  // generate-video (visual + audio multimodal analysis)
};

// ── Plan credit pools (monthly) ───────────────────────────────────────────────
export const PLAN_CREDITS: Record<string, number> = {
  free:   15,
  maker:  1000,
  pro:    2500,
  studio: 99999,  // unlimited (effectively uncapped)
};

// ── Improvement (melhoria) cost per plan ──────────────────────────────────────
// "Melhorias" = real actions on ad account: pause, scale, activate, budget, etc.
// Higher plans get cheaper improvements → natural upgrade incentive.
// Free = 0 (upgrade wall), Studio = 0 (unlimited, no credit cost).
export const IMPROVEMENT_COSTS: Record<string, number> = {
  free:   0,
  maker:  30,   // ~33 improvements/month from 1000 credits
  pro:    15,   // ~166 improvements/month from 2500 credits (50% off)
  studio: 0,    // unlimited
};

// ── Ad accounts per plan ──────────────────────────────────────────────────────
export const PLAN_AD_ACCOUNTS: Record<string, number> = {
  free:   0,
  maker:  1,
  pro:    3,
  studio: -1,  // -1 = unlimited
};

// ── Trial: 40% of paid plan credits ──────────────────────────────────────────
export const TRIAL_CREDITS: Record<string, number> = {
  free:   15,
  maker:  400,
  pro:    1000,
  studio: 99999,  // Studio trial = full access
};

// ── Referral bonus ────────────────────────────────────────────────────────────
export const REFERRAL_BONUS_CREDITS = 10;

// ── Conversation cap (safety: prevents unbounded context cost) ────────────────
export const MAX_CONVERSATION_MESSAGES = 20;

// ── Disposable email domains blocked from referral ───────────────────────────
export const BLOCKED_EMAIL_DOMAINS = [
  "yopmail.com", "tempmail.com", "guerrillamail.com", "mailinator.com",
  "10minutemail.com", "throwaway.email", "dispostable.com", "sharklasers.com",
  "trashmail.com", "temp-mail.org", "guerrillamail.info", "grr.la",
  "guerrillamail.net", "guerrillamail.de", "tmail.com", "tmpmail.net",
  "tmpmail.org", "binka.me", "bobmail.info", "chammy.info", "devnullmail.com",
  "letthemeatspam.com", "maildrop.cc", "mailnesia.com", "mintemail.com",
  "mt2015.com", "nospam.ze.tc", "trash-mail.com", "yopmail.fr",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Get credits for a plan, considering trial status */
export function getPlanCreditPool(plan: string, isTrialing = false): number {
  const p = normalizePlan(plan);
  if (isTrialing) return TRIAL_CREDITS[p] ?? TRIAL_CREDITS.free;
  return PLAN_CREDITS[p] ?? PLAN_CREDITS.free;
}

/** Get credit cost for an action. Returns 0 if action unknown. */
export function getCreditCost(action: string): number {
  return CREDIT_COSTS[action] ?? 0;
}

/** Get improvement cost for a plan. 0 = free/unlimited or upgrade wall. */
export function getImprovementCost(plan: string): number {
  const p = normalizePlan(plan);
  return IMPROVEMENT_COSTS[p] ?? 0;
}

/** Get ad account limit for a plan. -1 = unlimited. */
export function getAdAccountLimit(plan: string): number {
  const p = normalizePlan(plan);
  return PLAN_AD_ACCOUNTS[p] ?? PLAN_AD_ACCOUNTS.free;
}

/** Check if email domain is blocked for referral */
export function isBlockedEmailDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? BLOCKED_EMAIL_DOMAINS.includes(domain) : true;
}

/** Normalize legacy plan names */
const PLAN_ALIASES: Record<string, string> = {
  creator:  "maker",
  starter:  "pro",
  scale:    "studio",
  lifetime: "studio",
  appsumo:  "studio",
  ltd:      "studio",
  annual_maker:  "maker",
  annual_pro:    "pro",
  annual_studio: "studio",
};

export function normalizePlan(plan: string | null | undefined): string {
  const raw = plan || "free";
  return PLAN_ALIASES[raw] || raw;
}

/** Admin emails — used only for admin-credits endpoint access */
export const ADMIN_EMAILS: string[] = [
  "martinhovff@gmail.com",
  "denis.magalhaes10@gmail.com",
  "denis@adbrief.pro",
];

/** Get effective plan (normalizes aliases, no special overrides) */
export function getEffectivePlan(dbPlan: string | null | undefined, _email?: string | null): string {
  return normalizePlan(dbPlan);
}
