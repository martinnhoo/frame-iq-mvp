/**
 * provider-balance — guarda de saldo dos providers pré-pagos.
 *
 * O problema real: a PiAPI é pré-paga. Em 01/08/2026 o saldo acabou no meio
 * do dia e a geração de vídeo caiu para TODOS os usuários — inclusive os
 * pagantes. O commit `2d65181b "Fixed PiAPI credit error msg"` só melhorou a
 * mensagem de erro; não evitou a queda.
 *
 * O que isto faz:
 *   • Consulta o saldo da PiAPI (cache de 5 min — não dá pra consultar a cada
 *     geração sem virar gargalo).
 *   • Abaixo do piso crítico, bloqueia geração de vídeo do plano Free antes
 *     de queimar o resto do saldo. Pagante continua atendido até o fim.
 *   • Registra em `provider_balance_log` pra você ver a curva e recarregar
 *     antes de o problema acontecer, em vez de depois.
 *
 * A escolha de proteger o pagante e cortar o Free é deliberada: quando o
 * recurso é escasso, quem paga tem prioridade.
 */

const PIAPI_BALANCE_URL = "https://api.piapi.ai/api/v1/balance";

/** Abaixo disso, só plano pago gera vídeo. */
const CRITICAL_USD = 5;
/** Abaixo disso, alerta no log (e no e-mail, se você plugar). */
const WARNING_USD = 20;

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; usd: number | null } = { at: 0, usd: null };

export interface BalanceStatus {
  usd: number | null;
  level: "ok" | "warning" | "critical" | "unknown";
  /** Free deve ser bloqueado agora? */
  restrictFreeTier: boolean;
}

export async function getPiapiBalance(apiKey: string): Promise<BalanceStatus> {
  const now = Date.now();
  if (cache.usd !== null && now - cache.at < CACHE_TTL_MS) {
    return classify(cache.usd);
  }

  try {
    const r = await fetch(PIAPI_BALANCE_URL, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return { usd: null, level: "unknown", restrictFreeTier: false };

    const data = await r.json().catch(() => null);
    // A PiAPI já mudou esse shape antes; tenta os campos conhecidos.
    const raw = data?.data?.balance ?? data?.balance ?? data?.data?.quota ?? null;
    const usd = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(usd)) return { usd: null, level: "unknown", restrictFreeTier: false };

    cache = { at: now, usd };
    return classify(usd);
  } catch {
    // Falha ao consultar não bloqueia ninguém — o objetivo é evitar a queda,
    // não criar uma nova causa de queda.
    return { usd: null, level: "unknown", restrictFreeTier: false };
  }
}

function classify(usd: number): BalanceStatus {
  if (usd <= CRITICAL_USD) return { usd, level: "critical", restrictFreeTier: true };
  if (usd <= WARNING_USD) return { usd, level: "warning", restrictFreeTier: false };
  return { usd, level: "ok", restrictFreeTier: false };
}

/** Grava o saldo pra virar série temporal. Silencioso em caso de falha. */
export async function logBalance(sb: any, provider: string, status: BalanceStatus) {
  if (status.usd === null) return;
  try {
    await sb.from("provider_balance_log").insert({
      provider, balance_usd: status.usd, level: status.level,
    });
  } catch { /* telemetria nunca derruba a geração */ }
}

/**
 * Checagem única para usar antes de gerar vídeo.
 * Devolve uma mensagem quando a geração deve ser barrada.
 */
export async function checkVideoCapacity(
  sb: any, apiKey: string, plan: string,
): Promise<{ allowed: boolean; message?: string; balance: BalanceStatus }> {
  const balance = await getPiapiBalance(apiKey);

  if (balance.level === "warning" || balance.level === "critical") {
    await logBalance(sb, "piapi", balance);
  }

  const isFree = plan === "free";
  if (balance.restrictFreeTier && isFree) {
    return {
      allowed: false,
      balance,
      message: "A geração de vídeo está temporariamente indisponível no plano Free. Assine para continuar gerando.",
    };
  }

  return { allowed: true, balance };
}
