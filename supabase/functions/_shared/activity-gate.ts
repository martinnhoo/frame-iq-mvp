/**
 * activity-gate.ts — Shared helper pra gatear loops de cron por atividade
 * recente do user.
 *
 * Por quê:
 *   Crons como daily-intelligence, market-intelligence, creative-director,
 *   weekly-report loopam por TODA conta ativa (platform_connections.status =
 *   'active'). Mas "active" no schema só significa "Meta token não expirou" —
 *   não significa "user ainda está usando o produto". Resultado: cron queima
 *   Claude/Brave/Resend pra dezenas de contas zumbi todo dia.
 *
 *   Esse módulo expõe um filtro: só processa user que LOGOU/USOU app nos
 *   últimos N dias. Quem sumiu, skipa. Custo de cron cai pra ~zero quando
 *   ninguém tá usando.
 *
 * Como definimos "ativo":
 *   auth.users.last_sign_in_at é setado a TODA login (incluindo refresh
 *   silencioso). Default: últimos 7 dias = ativo. Override via param days.
 *
 * Uso:
 *   import { getActiveUserIds } from "../_shared/activity-gate.ts";
 *   const activeIds = await getActiveUserIds(sb, 7);
 *   for (const target of targets) {
 *     if (!activeIds.has(target.user_id)) continue;
 *     // ... custosa lógica de Claude/Brave aqui
 *   }
 *
 * Whitelist:
 *   ALWAYS_ACTIVE_USERS — emails de admin/dev nunca são filtrados, mesmo
 *   se last_sign_in_at for antigo (a gente pode estar testando flows
 *   sem logar visualmente).
 */

export const ALWAYS_ACTIVE_EMAILS = new Set([
  "martinho@adbrief.pro",
  "martinhovff@gmail.com",
]);

/**
 * Bulk fetch — uma única chamada à auth.admin.listUsers cobre até 1000
 * users, o que é suficiente até passarmos do MVP. Bem melhor que invocar
 * getUserById dentro de loop (N+1).
 */
export async function getActiveUserIds(
  sb: any,
  days: number = 7,
): Promise<Set<string>> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const activeIds = new Set<string>();

  try {
    // listUsers paginação — page 1 cobre 1000, suficiente até MVP escalar
    const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
    if (error) {
      console.warn("[activity-gate] listUsers failed, falling back to allow-all:", error.message);
      // Fallback seguro: se listUsers falhar, devolve null sentinel via Set
      // vazio com flag — caller deve tratar tamanho 0 como "não filtrar"
      // pra evitar bloquear cron por erro transitório.
      return new Set(); // caller checa: if size 0 → não gatear
    }

    for (const u of data?.users || []) {
      const lastSign = u.last_sign_in_at;
      const email = (u.email || "").toLowerCase();
      if (ALWAYS_ACTIVE_EMAILS.has(email)) {
        activeIds.add(u.id);
        continue;
      }
      if (lastSign && lastSign >= since) {
        activeIds.add(u.id);
      }
    }

    return activeIds;
  } catch (e) {
    console.warn("[activity-gate] unexpected error, allow-all fallback:", String(e));
    return new Set();
  }
}

/**
 * Helper pra cron decidir se deve abortar TUDO porque ninguém tá usando o
 * app. Útil em crons globais como trend-watcher que não loopam por user
 * mas ainda fazem chamadas pagas.
 */
export async function hasAnyActiveUser(sb: any, days: number = 7): Promise<boolean> {
  const ids = await getActiveUserIds(sb, days);
  // Set vazio significa fallback (listUsers falhou) — não aborta nesse caso
  if (ids.size === 0) {
    // Re-checa: se listUsers falhou de fato, deixa cron rodar.
    // Se devolveu mesmo array vazio (zero users), aí sim aborta.
    try {
      const { data } = await sb.auth.admin.listUsers({ perPage: 1 });
      const totalUsers = data?.users?.length || 0;
      if (totalUsers === 0) return false; // zero users no projeto = aborta
      // Tem users mas nenhum ativo no período → aborta
      return false;
    } catch {
      return true; // erro transitório → não bloqueia
    }
  }
  return true;
}

/**
 * Helper de logging consistente pra ver no painel quanto cron skipa.
 */
export function logGate(
  fn: string,
  totalTargets: number,
  activeCount: number,
): void {
  const skipped = totalTargets - activeCount;
  console.log(
    `[activity-gate:${fn}] processing ${activeCount}/${totalTargets} targets ` +
      `(${skipped} skipped — dormant users, no API spend on them)`,
  );
}
