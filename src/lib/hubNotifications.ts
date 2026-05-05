/**
 * hubNotifications — sistema de notificações do Hub interno.
 *
 * Persiste em localStorage (sem DB) — pra cada user_id mantém uma
 * fila de no máximo 50 notificações com flag read.
 *
 * Pub-sub: addHubNotification dispara um window event
 * 'hub-notification-added' que componentes (sino, etc) escutam pra
 * atualizar live sem polling.
 *
 * Cada ação completada no Hub deve chamar addHubNotification:
 *   - Imagem gerada → "Nova imagem pronta"
 *   - License composta → "Disclaimer aplicado"
 *   - Futuro: PNG gerado, transcrição pronta, etc.
 */

export type HubNotifKind =
  | "image_generated"
  | "image_failed"
  | "license_applied"
  | "library_updated"
  | "info";

export interface HubNotification {
  id: string;
  kind: HubNotifKind;
  title: string;
  description?: string;
  href?: string; // rota pra navegar ao clicar
  createdAt: string; // ISO
  read: boolean;
}

const MAX_NOTIFS = 50;
const KEY_PREFIX = "hub_notifs_";

function key(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

function safeRead(userId: string): HubNotification[] {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValid) : [];
  } catch {
    return [];
  }
}

function isValid(n: unknown): n is HubNotification {
  if (!n || typeof n !== "object") return false;
  const o = n as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.title === "string" && typeof o.createdAt === "string";
}

function safeWrite(userId: string, notifs: HubNotification[]): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify(notifs.slice(0, MAX_NOTIFS)));
  } catch { /* quota? silent */ }
}

export function listHubNotifications(userId: string | null | undefined): HubNotification[] {
  if (!userId) return [];
  return safeRead(userId);
}

export function unreadHubCount(userId: string | null | undefined): number {
  if (!userId) return 0;
  return safeRead(userId).filter(n => !n.read).length;
}

export function addHubNotification(
  userId: string | null | undefined,
  notif: Omit<HubNotification, "id" | "createdAt" | "read">,
): void {
  if (!userId) return;
  const existing = safeRead(userId);
  const fresh: HubNotification = {
    ...notif,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    read: false,
  };
  const updated = [fresh, ...existing].slice(0, MAX_NOTIFS);
  safeWrite(userId, updated);

  // Dispara evento pro sino atualizar live (sem polling)
  try {
    window.dispatchEvent(new CustomEvent("hub-notification-added", { detail: fresh }));
  } catch { /* SSR safe */ }
}

export function markAllHubRead(userId: string | null | undefined): void {
  if (!userId) return;
  const list = safeRead(userId);
  if (list.every(n => n.read)) return; // noop
  const updated = list.map(n => ({ ...n, read: true }));
  safeWrite(userId, updated);
  try {
    window.dispatchEvent(new CustomEvent("hub-notification-read"));
  } catch { /* SSR safe */ }
}

export function clearHubNotifications(userId: string | null | undefined): void {
  if (!userId) return;
  try { localStorage.removeItem(key(userId)); } catch {}
  try {
    window.dispatchEvent(new CustomEvent("hub-notification-read"));
  } catch {}
}
