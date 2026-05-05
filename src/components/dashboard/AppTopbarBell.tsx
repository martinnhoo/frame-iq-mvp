/**
 * AppTopbarBell — sino global do topbar.
 *
 * Comportamento dual:
 *   - Em rotas /dashboard/hub*: lê notificações Hub do localStorage
 *     (gerenciadas via @/lib/hubNotifications). Atualiza live por
 *     custom event 'hub-notification-added'. Click na notif navega
 *     pra href dela. Click no sino marca tudo como lido.
 *   - Fora do Hub: lê accountAlerts (props.alerts) como antes —
 *     diagnóstico/feed do AdBrief SaaS.
 *
 * Badge vermelho com contagem aparece sempre que count > 0. Animação
 * sutil de pulse no badge quando uma notificação acabou de chegar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listHubNotifications, unreadHubCount, markAllHubRead, clearHubNotifications,
  type HubNotification,
} from "@/lib/hubNotifications";

const F = "'Plus Jakarta Sans', Inter, system-ui, sans-serif";

interface Alert {
  id: string;
  title?: string | null;
  description?: string | null;
  severity?: string | null;
  created_at?: string | null;
}

interface Props {
  alerts: Alert[];
}

export function AppTopbarBell({ alerts }: Props) {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [hubNotifs, setHubNotifs] = useState<HubNotification[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  const isHubRoute = location.pathname.startsWith("/dashboard/hub");

  // Carrega user ID
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (mounted) setUserId(user?.id || null);
      } catch { /* silent */ }
    })();
    return () => { mounted = false; };
  }, []);

  // Sync inicial + listeners pros eventos do hubNotifications.ts
  const reloadHubNotifs = useCallback(() => {
    if (!userId) { setHubNotifs([]); return; }
    setHubNotifs(listHubNotifications(userId));
  }, [userId]);

  useEffect(() => {
    reloadHubNotifs();
    const onAdded = () => {
      reloadHubNotifs();
      setPulse(true);
      setTimeout(() => setPulse(false), 1400);
    };
    const onRead = () => reloadHubNotifs();
    window.addEventListener("hub-notification-added", onAdded);
    window.addEventListener("hub-notification-read", onRead);
    // Cross-tab sync via storage event
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("hub_notifs_")) reloadHubNotifs();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("hub-notification-added", onAdded);
      window.removeEventListener("hub-notification-read", onRead);
      window.removeEventListener("storage", onStorage);
    };
  }, [reloadHubNotifs]);

  // Click outside / Esc
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unreadHub = useMemo(() => unreadHubCount(userId), [userId, hubNotifs]);
  const hubItems = isHubRoute ? hubNotifs : [];
  const accountItems = !isHubRoute ? (alerts || []) : [];
  const count = isHubRoute ? unreadHub : (alerts?.length || 0);
  const muted = count === 0;

  const handleOpen = () => {
    setOpen(s => {
      const next = !s;
      // Ao abrir, marca como lido (Hub mode)
      if (next && isHubRoute && userId) markAllHubRead(userId);
      return next;
    });
  };

  const handleClickHubNotif = (n: HubNotification) => {
    setOpen(false);
    if (n.href) navigate(n.href);
  };

  const handleClearAll = () => {
    if (!userId) return;
    clearHubNotifications(userId);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={handleOpen}
        title={muted ? "Sem notificações" : `${count} ${count > 1 ? "notificações" : "notificação"}`}
        style={{
          width: 34, height: 34, minWidth: 34, borderRadius: 8, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: open ? "rgba(255,255,255,0.06)" : "transparent",
          border: `1px solid ${open ? "rgba(255,255,255,0.10)" : "transparent"}`,
          cursor: "pointer", transition: "background 0.15s, border-color 0.15s",
          position: "relative", color: muted ? "rgba(255,255,255,0.45)" : "#FFFFFF",
        }}
        onMouseEnter={e => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={e => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "transparent";
        }}>
        <Bell size={17} strokeWidth={muted ? 1.6 : 2} />
        {count > 0 && (
          <span style={{
            position: "absolute", top: 2, right: 2,
            minWidth: 16, height: 16, padding: "0 4px",
            borderRadius: 8,
            background: "#EF4444",
            color: "#fff",
            fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #060A14",
            fontFamily: F,
            lineHeight: 1,
            animation: pulse ? "bellPulse 1.2s ease-out 1" : undefined,
          }}>{count > 9 ? "9+" : count}</span>
        )}
        <style>{`
          @keyframes bellPulse {
            0%   { transform: scale(1);   box-shadow: 0 0 0 0 rgba(239,68,68,0.55); }
            50%  { transform: scale(1.18); box-shadow: 0 0 0 8px rgba(239,68,68,0); }
            100% { transform: scale(1);   box-shadow: 0 0 0 0 rgba(239,68,68,0); }
          }
        `}</style>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificações"
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0,
            width: 340, maxWidth: "calc(100vw - 32px)",
            background: "#0E1424",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
            zIndex: 200,
            overflow: "hidden",
            fontFamily: F,
            animation: "topbarBellIn 140ms cubic-bezier(0.22,1,0.36,1)",
          }}>
          <style>{`
            @keyframes topbarBellIn {
              from { opacity: 0; transform: translateY(-4px); }
              to   { opacity: 1; transform: translateY(0);    }
            }
          `}</style>

          <div style={{
            padding: "12px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", letterSpacing: 0.04 }}>
              {isHubRoute ? "Atividade" : "Alertas"}
            </span>
            {isHubRoute && hubItems.length > 0 ? (
              <button
                onClick={handleClearAll}
                style={{
                  background: "transparent", border: "none",
                  color: "#9CA3AF", fontSize: 11, fontWeight: 600,
                  cursor: "pointer", fontFamily: F, padding: "2px 4px",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#FFFFFF"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#9CA3AF"}
              >
                Limpar tudo
              </button>
            ) : (
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>{isHubRoute ? hubItems.length : count}</span>
            )}
          </div>

          {/* Hub notifs */}
          {isHubRoute ? (
            hubItems.length === 0 ? (
              <EmptyMessage text="Suas ações aparecem aqui assim que rolarem." />
            ) : (
              <div style={{ maxHeight: 380, overflowY: "auto" }}>
                {hubItems.slice(0, 12).map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleClickHubNotif(n)}
                    style={notifBtnStyle(n.read)}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = n.read ? "transparent" : "rgba(59,130,246,0.04)"}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      {!n.read && (
                        <span style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: "#3B82F6", flexShrink: 0, marginTop: 5,
                        }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0, paddingLeft: n.read ? 16 : 0 }}>
                        <p style={{
                          margin: 0, fontSize: 12.5, fontWeight: 700,
                          color: "#FFFFFF", lineHeight: 1.3,
                        }}>{n.title}</p>
                        {n.description && (
                          <p style={{
                            margin: "3px 0 0", fontSize: 11.5, color: "#D1D5DB",
                            lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis",
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                          }}>{n.description}</p>
                        )}
                        <p style={{
                          margin: "5px 0 0", fontSize: 10.5, color: "#9CA3AF",
                          letterSpacing: 0.02,
                        }}>{relativeTime(n.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            // Account alerts (fluxo legado SaaS)
            accountItems.length === 0 ? (
              <EmptyMessage text="Nada por aqui. Quando algo fugir do padrão, aparece." />
            ) : (
              <div style={{ maxHeight: 380, overflowY: "auto" }}>
                {accountItems.slice(0, 8).map(a => (
                  <button
                    key={a.id}
                    onClick={() => { setOpen(false); navigate("/dashboard/feed"); }}
                    style={notifBtnStyle(false)}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.04)"}
                  >
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "#FFFFFF", lineHeight: 1.3 }}>
                      {a.title || "Alerta"}
                    </p>
                    {a.description && (
                      <p style={{
                        margin: "3px 0 0", fontSize: 11.5, color: "#D1D5DB",
                        lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis",
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                      }}>{a.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )
          )}

          {/* Footer só pra account alerts */}
          {!isHubRoute && accountItems.length > 0 && (
            <button
              onClick={() => { setOpen(false); navigate("/dashboard/feed"); }}
              style={{
                width: "100%", padding: "10px 14px",
                background: "rgba(59,130,246,0.06)",
                border: "none", borderTop: "1px solid rgba(255,255,255,0.06)",
                color: "#3B82F6", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: F,
              }}>
              Ver no Feed →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div style={{
      padding: "32px 16px", textAlign: "center",
      fontSize: 12.5, color: "#D1D5DB", lineHeight: 1.5,
    }}>
      {text}
    </div>
  );
}

function notifBtnStyle(read: boolean): React.CSSProperties {
  return {
    display: "block", width: "100%",
    padding: "11px 14px",
    background: read ? "transparent" : "rgba(59,130,246,0.04)",
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    cursor: "pointer", textAlign: "left",
    fontFamily: F, transition: "background 0.1s",
  };
}

function relativeTime(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.round(ms / 60_000);
    if (min < 1) return "agora";
    if (min < 60) return `${min}min atrás`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h}h atrás`;
    const d = Math.round(h / 24);
    if (d < 7) return `${d}d atrás`;
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch { return ""; }
}
