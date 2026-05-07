/**
 * genProgress — wrapper de notificação com progresso pra geradores
 * do Hub.
 *
 * Cada gerador (image, png, video, voice, storyboard, carousel,
 * faceswap) chama esse helper pra que o sino mostre uma notificação
 * COM BARRA DE PROGRESSO LIVE enquanto a geração roda — igual o
 * Workflow já tem hoje.
 *
 * 2 modos:
 *   - estimated: simula progresso por tempo (úteis pra ops síncronas
 *     onde não dá pra polar progresso real). Curva chega a ~90% no
 *     tempo estimado e fica esperando o complete().
 *   - real: caller manda updates explícitos via setProgress(done, total).
 *     Pra ops com polling (video, faceswap) ou batch (storyboard
 *     N cenas).
 *
 * Uso típico (estimated):
 *
 *   const ctrl = startGenProgress(userId, {
 *     title: "Gerando imagem...",
 *     estimateMs: 30_000,
 *     stage: "Aplicando marca",
 *   });
 *   try {
 *     ctrl.setStage("Chamando IA");
 *     const result = await callEdge();
 *     ctrl.setStage("Salvando");
 *     await save();
 *     ctrl.complete({ title: "Imagem pronta", href: "/dashboard/hub/library" });
 *   } catch (e) {
 *     ctrl.fail(String(e));
 *   }
 */

import {
  addHubNotification,
  updateHubNotification,
  type HubNotifKind,
} from "./hubNotifications";

interface StartOpts {
  /** Título mostrado no sino. Ex: "Gerando imagem..." */
  title: string;
  /** Tempo estimado em ms. Define a velocidade da barra (modo estimated). */
  estimateMs: number;
  /** Subtítulo inicial (stage atual). Ex: "Aplicando marca" */
  stage?: string;
  /** Tipo da notif — só visual. Default: workflow_running (cor neutra). */
  kind?: HubNotifKind;
  /** Total de etapas (default 100 → percentual). Pra ops batch use total real. */
  totalSteps?: number;
}

interface CompleteOpts {
  title: string;
  description?: string;
  href?: string;
  /** Default: image_generated (verde) */
  kind?: HubNotifKind;
}

export interface GenProgressController {
  /** Atualiza só o subtítulo (stage atual). Mantém a barra animando. */
  setStage(description: string): void;
  /** Salta pro progresso explícito (modo real — polling/batch). */
  setProgress(done: number, total?: number): void;
  /** Marca como completo (barra some, kind muda pra success). */
  complete(opts: CompleteOpts): void;
  /** Marca como falha (barra some, kind muda pra error). */
  fail(errorMsg: string, optionalKind?: HubNotifKind): void;
}

const NOOP_CONTROLLER: GenProgressController = {
  setStage: () => {},
  setProgress: () => {},
  complete: () => {},
  fail: () => {},
};

/**
 * Inicia uma notificação com progresso. Retorna controller pra
 * atualizar/finalizar. Se userId for null, retorna controller no-op
 * (não quebra fluxo de teste/anônimo).
 */
export function startGenProgress(
  userId: string | null | undefined,
  opts: StartOpts,
): GenProgressController {
  if (!userId) return NOOP_CONTROLLER;

  const total = opts.totalSteps || 100;
  const startedAt = Date.now();
  let stoppedTick = false;

  const notifId = addHubNotification(userId, {
    kind: opts.kind || "workflow_running",
    title: opts.title,
    description: opts.stage,
    progress: { done: 0, total },
  });
  if (!notifId) return NOOP_CONTROLLER;

  // Tick a cada 500ms — barra cresce até 90% no estimateMs e trava
  // (espera complete()/fail() pra fechar).
  const tick = window.setInterval(() => {
    if (stoppedTick) return;
    const elapsed = Date.now() - startedAt;
    const pctTime = Math.min(elapsed / Math.max(1, opts.estimateMs), 1);
    // Curva ease-out — chega rápido aos 60% e devagar nos últimos 30%
    const fakePct = pctTime < 1
      ? 1 - Math.pow(1 - pctTime, 1.7) // ease-out cubic-ish
      : 1;
    const done = Math.floor(fakePct * total * 0.9); // teto 90%
    updateHubNotification(userId, notifId, {
      progress: { done, total },
    });
  }, 500);

  const stopTick = () => {
    stoppedTick = true;
    try { clearInterval(tick); } catch { /* ignore */ }
  };

  return {
    setStage(description: string) {
      updateHubNotification(userId, notifId, { description });
    },
    setProgress(done: number, totalOverride?: number) {
      // Modo real — para a animação simulada, usa números do caller
      stopTick();
      updateHubNotification(userId, notifId, {
        progress: { done, total: totalOverride ?? total },
      });
    },
    complete(c: CompleteOpts) {
      stopTick();
      // Fecha a barra (progress: undefined remove a bar do componente)
      updateHubNotification(userId, notifId, {
        kind: c.kind || "image_generated",
        title: c.title,
        description: c.description,
        href: c.href,
        progress: undefined,
      });
    },
    fail(errorMsg: string, optionalKind?: HubNotifKind) {
      stopTick();
      updateHubNotification(userId, notifId, {
        kind: optionalKind || "image_failed",
        title: "Falhou",
        description: errorMsg.slice(0, 200),
        progress: undefined,
      });
    },
  };
}
