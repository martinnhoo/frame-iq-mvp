/**
 * AdBrief Hub — créditos do Hub Criativo
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REGRA: 1 crédito = US$ 0,01 de custo real de provider.
 *
 * Cada número em HUB_CREDIT_COSTS é o custo medido × 100, arredondado pra
 * cima. A margem de qualquer plano vira uma divisão, e nenhuma feature nova
 * entra no Hub sem uma linha aqui.
 *
 * O buraco que isto fecha: até 02/08/2026 nenhuma function do Hub cobrava
 * crédito. Vídeo Kling (US$ 0,40) era gratuito pra qualquer plano, inclusive
 * Free, inclusive depois do cadastro abrir ao público em 01/08.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * COMO O PREÇO FICOU MAIS BARATO
 *
 * Não foi cortando margem — foi separando ITERAR de FINALIZAR.
 *
 * Antes tudo rodava no modelo caro. Agora existe o modo rascunho: 720p, sem
 * áudio, modelo econômico. Custa ~metade e serve pra testar prompt, que é
 * onde 80% das gerações morrem. Só o render final usa Kling Pro.
 *
 * Na imagem o efeito é ainda maior: qualidade `low` custa US$ 0,005 contra
 * US$ 0,04 da `medium` — 8x menos. Iterar layout em `low` e finalizar em
 * `high` derruba o custo real por criativo aprovado.
 *
 * Resultado: os planos caíram de $29/$79/$199 pra $19/$49/$99 mantendo
 * margem de 55–63% no pior caso (usuário queima 100% do pool no item mais
 * caro). Utilização real de pool fica em 55–70%, então a margem realizada
 * tende a 70–80%.
 */

// ── Custo em créditos por ação ───────────────────────────────────────────────
export const HUB_CREDIT_COSTS = {
  // ── Vídeo — domina o P&L. Um vídeo de 5s = 10 imagens medium.
  video_draft_5s:      22,   // $0.22  720p sem áudio — o default do editor
  video_draft_10s:     44,   // $0.44
  video_final_5s:      40,   // $0.40  Kling 3.0 std 720p (com áudio)
  video_final_10s:     80,   // $0.80
  video_pro_5s:        50,   // $0.50  Kling 3.0 pro 1080p
  video_pro_10s:       100,  // $1.00

  // ── Imagem
  image_draft:         1,    // $0.005 gpt-image-2 low — pra iterar layout
  image_standard:      4,    // $0.04  gpt-image-2 medium
  image_high:          18,   // $0.17  gpt-image-2 high — só no final

  // ── Edição
  bg_remove:           5,    // $0.05  Bria
  place_elements:      5,    // $0.05  Bria
  faceswap:            3,    // $0.02  PiAPI

  // ── Áudio — Fish Audio ($15/1M bytes) no lugar do ElevenLabs (~11x mais caro)
  voice_per_1k_chars:  2,    // $0.015
  transcribe_per_min:  1,    // $0.006 whisper-1

  // ── Texto — quase grátis; cobra 1 só pra evitar abuso em loop
  caption:             1,
  hook:                1,
  script:              1,
  ab_variant:          1,
  storyboard_frame:    4,    // 1 imagem standard por frame
} as const;

export type HubAction = keyof typeof HUB_CREDIT_COSTS;

// ── Pools mensais ────────────────────────────────────────────────────────────
// Espelha public.hub_plan_config. A tabela manda; isto é fallback se o DB
// estiver fora do ar na leitura de configuração.
//
// Nada é ilimitado. O valor antigo studio=99999 viraria uma conta aberta de
// US$ 999/mês por usuário no instante em que o metering ligasse.
export const HUB_PLAN_CREDITS: Record<string, number> = {
  free:     80,    // one-time, não renova. ~3 vídeos rascunho. CAC de $0.80.
  creator:  700,   // $19  / R$ 97   → margem 63% no pior caso
  pro:      2000,  // $49  / R$ 247  → margem 59%
  studio:   4500,  // $99  / R$ 497  → margem 55%
};

export const HUB_PLAN_PRICES = {
  creator: { usd: 19, brl: 97 },
  pro:     { usd: 49, brl: 247 },
  studio:  { usd: 99, brl: 497 },
} as const;

/** Free é concessão única, não mensalidade — fica fora do reset de ciclo. */
export const NON_RENEWING_PLANS = new Set(["free"]);

// ── Bloqueios por plano ──────────────────────────────────────────────────────
// Free não gera 1080p nem imagem high: são os maiores COGS e o principal vetor
// de abuso com contas descartáveis.
export const PLAN_BLOCKED_ACTIONS: Record<string, Set<HubAction>> = {
  free:    new Set<HubAction>(["video_pro_5s", "video_pro_10s", "image_high"]),
  creator: new Set<HubAction>(),
  pro:     new Set<HubAction>(),
  studio:  new Set<HubAction>(),
};

// ── Pacote avulso ────────────────────────────────────────────────────────────
// Preço por crédito MAIOR que o de qualquer assinatura: o pacote existe pra
// empurrar upgrade, não pra substituir plano.
export const CREDIT_PACKS = [
  { id: "pack_1k", credits: 1000, usd: 29, brl: 149, expires_days: 365 },
] as const;

export const WATERMARK_PLANS = new Set(["free"]);

// Taxa de PLANEJAMENTO, não a do dia. Fixada no topo da faixa de 52 semanas
// (4,89–5,63) pra margem BRL aguentar desvalorização sem reprecificar.
export const BRL_PLANNING_RATE = 5.60;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_ALIASES: Record<string, string> = {
  maker: "creator", starter: "pro", scale: "studio",
  lifetime: "studio", appsumo: "studio", ltd: "studio",
  annual_maker: "creator", annual_pro: "pro", annual_studio: "studio",
};

export function normalizeHubPlan(plan: string | null | undefined): string {
  const raw = (plan || "free").toLowerCase().trim();
  const mapped = PLAN_ALIASES[raw] || raw;
  return mapped in HUB_PLAN_CREDITS ? mapped : "free";
}

export function getHubCost(action: HubAction, units = 1): number {
  const base = HUB_CREDIT_COSTS[action];
  if (base === undefined) {
    // Fail-closed. Ação desconhecida não passa de graça — foi exatamente
    // assim que o buraco original nasceu.
    throw new Error(`hub_credits: ação desconhecida "${action}"`);
  }
  return Math.max(1, Math.ceil(base * units));
}

/** Resolve a ação de vídeo a partir dos parâmetros do editor. */
export function resolveVideoAction(
  opts: { duration?: number; mode?: string; audio?: boolean },
): HubAction {
  const long = (opts.duration ?? 5) >= 10;
  if (opts.mode === "pro") return long ? "video_pro_10s" : "video_pro_5s";
  // Sem áudio = rascunho (Kling 2.6, mais barato que o 3.0 com áudio nativo).
  if (!opts.audio) return long ? "video_draft_10s" : "video_draft_5s";
  return long ? "video_final_10s" : "video_final_5s";
}

export function resolveImageAction(quality?: string): HubAction {
  if (quality === "low") return "image_draft";
  if (quality === "high") return "image_high";
  return "image_standard";
}

/** Custo de locução a partir do texto, por 1.000 caracteres. */
export function getVoiceCost(text: string): number {
  const bytes = new TextEncoder().encode(text).length;
  return Math.max(1, Math.ceil((bytes / 1000) * HUB_CREDIT_COSTS.voice_per_1k_chars));
}

export function isActionBlocked(plan: string, action: HubAction): boolean {
  return PLAN_BLOCKED_ACTIONS[normalizeHubPlan(plan)]?.has(action) ?? false;
}

export function needsWatermark(plan: string): boolean {
  return WATERMARK_PLANS.has(normalizeHubPlan(plan));
}

/** Margem bruta no pior caso (usuário queima 100% do pool). Para o admin. */
export function worstCaseMargin(plan: string): number {
  const p = normalizeHubPlan(plan);
  const price = (HUB_PLAN_PRICES as any)[p]?.usd ?? 0;
  const cogs = (HUB_PLAN_CREDITS[p] ?? 0) * 0.01;
  return price > 0 ? (price - cogs) / price : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESERVA → CONFIRMA → ESTORNA
// Ver migration 20260802120000_hub_commercial.sql para o schema e a RPC.
// ─────────────────────────────────────────────────────────────────────────────

export interface ReserveResult {
  ok: boolean;
  reservation_id?: string;
  balance_after?: number;
  reason?: "insufficient_credits" | "action_blocked" | "error";
  needed?: number;
  available?: number;
}

/** Reserva créditos ANTES de chamar o provider. */
export async function reserveCredits(
  sb: any,
  userId: string,
  plan: string,
  action: HubAction,
  units = 1,
): Promise<ReserveResult> {
  if (isActionBlocked(plan, action)) {
    return { ok: false, reason: "action_blocked" };
  }

  const credits = getHubCost(action, units);

  const { data, error } = await sb.rpc("hub_reserve_credits", {
    p_user: userId,
    p_action: action,
    p_credits: credits,
  });

  if (error) {
    console.error("[hub-credits] reserve falhou:", error.message);
    // Fail-CLOSED, ao contrário do cost-cap de texto (que falha aberto porque
    // um chat custa frações de centavo). Aqui um erro de DB não pode liberar
    // um vídeo de US$ 0,50.
    return { ok: false, reason: "error" };
  }

  if (!data?.ok) {
    return {
      ok: false,
      reason: "insufficient_credits",
      needed: credits,
      available: data?.available ?? 0,
    };
  }

  return { ok: true, reservation_id: data.reservation_id, balance_after: data.balance_after };
}

/** Confirma depois que o provider entregou. */
export async function confirmCredits(sb: any, reservationId: string, refId?: string) {
  const { error } = await sb
    .from("hub_credit_ledger")
    .update({ state: "confirmed", settled_at: new Date().toISOString(), ref_id: refId ?? null })
    .eq("id", reservationId)
    .eq("state", "reserved");
  if (error) console.error("[hub-credits] confirm falhou:", error.message);
}

/** Estorna quando o provider falha. Chamar em TODO caminho de erro. */
export async function refundCredits(sb: any, reservationId: string, reason: string) {
  const { error } = await sb
    .from("hub_credit_ledger")
    .update({ state: "refunded", settled_at: new Date().toISOString() })
    .eq("id", reservationId)
    .eq("state", "reserved");
  if (error) console.error("[hub-credits] refund falhou:", error.message);
  else console.log(`[hub-credits] estornado ${reservationId}: ${reason}`);
}

/** 402 padrão — o frontend usa pra abrir o modal de upgrade. */
export function insufficientCreditsResponse(
  r: ReserveResult,
  corsHeaders: Record<string, string>,
) {
  const message =
    r.reason === "action_blocked"
      ? "Este recurso está disponível a partir do plano Creator."
      : r.reason === "error"
      ? "Não foi possível verificar seus créditos agora. Tente novamente."
      : `Créditos insuficientes: esta ação custa ${r.needed} e você tem ${r.available}.`;

  return new Response(
    JSON.stringify({
      ok: false,
      error: r.reason,
      needed: r.needed,
      available: r.available,
      message,
      upgrade_url: "/dashboard/settings?tab=plan",
    }),
    { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/** Plano efetivo do usuário. */
export async function getUserPlan(sb: any, userId: string): Promise<string> {
  try {
    const { data } = await sb
      .from("user_profiles").select("plan").eq("id", userId).maybeSingle();
    return normalizeHubPlan(data?.plan);
  } catch {
    return "free";
  }
}
