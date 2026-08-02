/**
 * video-limits — tetos de vídeo por plano.
 *
 * Crédito e teto resolvem problemas diferentes, e é por isso que os dois
 * existem:
 *
 *   Crédito  → controla CUSTO. Impede que o usuário gaste mais do que pagou.
 *   Teto     → controla OPERAÇÃO. Impede que um usuário sozinho esgote o
 *              saldo pré-pago da PiAPI ou estoure o limite de concorrência,
 *              derrubando a geração para todos os outros pagantes.
 *
 * Um usuário com 2.000 créditos pode legitimamente disparar 50 vídeos numa
 * madrugada. Ele pagou por isso. Mas o efeito colateral é o produto cair para
 * quem não fez nada — foi o que aconteceu em 01/08.
 */

export interface VideoLimits {
  maxMonth: number | null;
  maxDay: number | null;
  maxConcurrent: number;
}

export interface VideoUsage {
  month: number;
  day: number;
  inFlight: number;
}

export interface LimitCheck {
  allowed: boolean;
  reason?: "month_cap" | "day_cap" | "concurrent_cap";
  message?: string;
  usage?: VideoUsage;
  limits?: VideoLimits;
}

/** Fallback se `hub_plan_config` estiver inacessível. Conservador de propósito. */
const FALLBACK: Record<string, VideoLimits> = {
  free:    { maxMonth: 1,  maxDay: 1,  maxConcurrent: 1 },
  creator: { maxMonth: 12, maxDay: 6,  maxConcurrent: 1 },
  pro:     { maxMonth: 30, maxDay: 12, maxConcurrent: 3 },
  studio:  { maxMonth: 65, maxDay: 25, maxConcurrent: 5 },
};

export async function getVideoLimits(sb: any, plan: string): Promise<VideoLimits> {
  try {
    const { data } = await sb
      .from("hub_plan_config")
      .select("max_videos_month, max_videos_day, max_concurrent")
      .eq("plan", plan)
      .maybeSingle();

    if (data) {
      return {
        maxMonth: data.max_videos_month ?? null,
        maxDay: data.max_videos_day ?? null,
        maxConcurrent: data.max_concurrent ?? 1,
      };
    }
  } catch (e) {
    console.error("[video-limits] falha ao ler config:", e);
  }
  return FALLBACK[plan] ?? FALLBACK.free;
}

export async function getVideoUsage(sb: any, userId: string): Promise<VideoUsage> {
  try {
    const { data } = await sb.rpc("hub_video_usage", { p_user: userId });
    const row = Array.isArray(data) ? data[0] : data;
    return {
      month: Number(row?.month_count) || 0,
      day: Number(row?.day_count) || 0,
      inFlight: Number(row?.in_flight) || 0,
    };
  } catch (e) {
    console.error("[video-limits] falha ao ler uso:", e);
    // Fail-closed: sem saber o uso, não liberamos vídeo.
    return { month: Number.MAX_SAFE_INTEGER, day: 0, inFlight: 0 };
  }
}

/** Roda ANTES da reserva de crédito — o usuário não deve pagar por algo barrado. */
export async function checkVideoLimits(
  sb: any, userId: string, plan: string,
): Promise<LimitCheck> {
  const [limits, usage] = await Promise.all([
    getVideoLimits(sb, plan),
    getVideoUsage(sb, userId),
  ]);

  if (usage.inFlight >= limits.maxConcurrent) {
    return {
      allowed: false, reason: "concurrent_cap", usage, limits,
      message: limits.maxConcurrent === 1
        ? "Você já tem um vídeo sendo gerado. Aguarde ele terminar."
        : `Você já tem ${limits.maxConcurrent} vídeos sendo gerados ao mesmo tempo.`,
    };
  }

  if (limits.maxDay !== null && usage.day >= limits.maxDay) {
    return {
      allowed: false, reason: "day_cap", usage, limits,
      message: `Você atingiu o limite de ${limits.maxDay} vídeos por dia. O contador zera amanhã.`,
    };
  }

  if (limits.maxMonth !== null && usage.month >= limits.maxMonth) {
    return {
      allowed: false, reason: "month_cap", usage, limits,
      message: `Você usou os ${limits.maxMonth} vídeos do seu plano neste mês.`,
    };
  }

  return { allowed: true, usage, limits };
}

/** 429 no caso de concorrência (é temporário), 402 nos tetos (exige upgrade). */
export function videoLimitResponse(check: LimitCheck, cors: Record<string, string>) {
  const temporary = check.reason === "concurrent_cap" || check.reason === "day_cap";
  return new Response(
    JSON.stringify({
      ok: false,
      error: check.reason,
      message: check.message,
      usage: check.usage,
      limits: check.limits,
      upgrade_url: temporary ? undefined : "/dashboard/plans",
    }),
    {
      status: temporary ? 429 : 402,
      headers: { ...cors, "Content-Type": "application/json" },
    },
  );
}
