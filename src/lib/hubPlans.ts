/**
 * hubPlans — planos e custos do Hub no frontend.
 * Espelha supabase/functions/_shared/hub-credits.ts e public.hub_plan_config.
 *
 * REGRA: 1 crédito = US$ 0,01 de custo real de provider.
 *
 * Por que ficou mais barato que a primeira proposta ($29/$79/$199):
 * separando ITERAR de FINALIZAR. Rascunho de vídeo custa ~metade do render
 * final; imagem em `low` custa 1 crédito contra 18 da `high`. Como a maior
 * parte das gerações é tentativa descartada, o custo por criativo APROVADO
 * despenca — e isso permitiu derrubar o preço sem comprimir margem.
 */

export const CREDIT_COSTS = {
  video_draft_5s:     22,
  video_draft_10s:    44,
  video_final_5s:     40,
  video_final_10s:    80,
  video_pro_5s:       50,
  video_pro_10s:      100,
  image_draft:        1,
  image_standard:     4,
  image_high:         18,
  bg_remove:          5,
  place_elements:     5,
  faceswap:           3,
  voice_per_1k_chars: 2,
  transcribe_per_min: 1,
  caption:            1,
  hook:               1,
  script:             1,
  ab_variant:         1,
  storyboard_frame:   4,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

export type PlanKey = "free" | "creator" | "pro" | "studio";

export interface HubPlan {
  key: PlanKey;
  label: string;
  credits: number;
  /** Free é concessão única, não mensalidade. */
  renews: boolean;
  usd: number;
  brl: number;
  brands: number;      // -1 = ilimitado
  workflows: number;   // -1 = ilimitado
  watermark: boolean;
  proVideo: boolean;
  highlight?: boolean;
}

export const HUB_PLANS: Record<PlanKey, HubPlan> = {
  free: {
    key: "free", label: "Free",
    credits: 80, renews: false, usd: 0, brl: 0,
    brands: 1, workflows: 0, watermark: true, proVideo: false,
  },
  creator: {
    key: "creator", label: "Creator",
    credits: 700, renews: true, usd: 19, brl: 97,
    brands: 1, workflows: 3, watermark: false, proVideo: true,
  },
  pro: {
    key: "pro", label: "Pro",
    credits: 2000, renews: true, usd: 49, brl: 247,
    brands: 3, workflows: 15, watermark: false, proVideo: true,
    highlight: true,
  },
  studio: {
    key: "studio", label: "Studio",
    credits: 4500, renews: true, usd: 99, brl: 497,
    brands: -1, workflows: -1, watermark: false, proVideo: true,
  },
};

/** Pacote avulso. Mais caro por crédito que qualquer plano — de propósito:
 *  existe pra empurrar upgrade, não pra substituir assinatura. */
export const CREDIT_PACK = {
  credits: 1000, usd: 29, brl: 149, expiresDays: 365,
};

const ALIASES: Record<string, PlanKey> = {
  maker: "creator", starter: "pro", scale: "studio",
  lifetime: "studio", appsumo: "studio", ltd: "studio",
  annual_maker: "creator", annual_pro: "pro", annual_studio: "studio",
};

export function normalizePlan(plan: string | null | undefined): PlanKey {
  const raw = (plan || "free").toLowerCase().trim();
  const mapped = ALIASES[raw] || raw;
  return (mapped in HUB_PLANS ? mapped : "free") as PlanKey;
}

export function getPlan(plan: string | null | undefined): HubPlan {
  return HUB_PLANS[normalizePlan(plan)];
}

export function getCost(action: CreditAction, units = 1): number {
  return Math.max(1, Math.ceil(CREDIT_COSTS[action] * units));
}

/** Custo de locução a partir do texto — mostrado antes de gerar. */
export function getVoiceCost(text: string): number {
  const bytes = new TextEncoder().encode(text).length;
  return Math.max(1, Math.ceil((bytes / 1000) * CREDIT_COSTS.voice_per_1k_chars));
}

export function resolveVideoAction(
  opts: { duration?: number; mode?: string; audio?: boolean },
): CreditAction {
  const long = (opts.duration ?? 5) >= 10;
  if (opts.mode === "pro") return long ? "video_pro_10s" : "video_pro_5s";
  if (!opts.audio) return long ? "video_draft_10s" : "video_draft_5s";
  return long ? "video_final_10s" : "video_final_5s";
}

export function resolveImageAction(quality?: string): CreditAction {
  if (quality === "low") return "image_draft";
  if (quality === "high") return "image_high";
  return "image_standard";
}

/** "≈ 17 vídeos" — o que o plano compra na prática, pra página de preços. */
export function creditsAsVideos(credits: number): number {
  return Math.floor(credits / CREDIT_COSTS.video_final_5s);
}
export function creditsAsImages(credits: number): number {
  return Math.floor(credits / CREDIT_COSTS.image_standard);
}

/** Formata preço na moeda escolhida. */
export function formatPrice(plan: HubPlan, currency: "usd" | "brl"): string {
  if (plan.usd === 0) return currency === "brl" ? "R$ 0" : "$0";
  return currency === "brl"
    ? `R$ ${plan.brl}`
    : `$${plan.usd}`;
}
