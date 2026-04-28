/**
 * AppTopbarBell — notification bell for the global topbar.
 *
 * Shows a count badge for unread account alerts (passed in from
 * DashboardLayout's accountAlerts state). Click opens a small drawer
 * listing them; clicking an alert navigates to /dashboard/feed with
 * the alert pinned. If there are no alerts the badge is hidden and
 * the bell is muted.
 *
 * Why: today the only signal of pending alerts is a small dot
 * elsewhere. Putting a bell with count in the canonical top-right
 * spot matches user expectation from every modern web app and lets
 * us surface fresh decisions without forcing a sidebar scroll.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";

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
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const count = alerts?.length || 0;

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

  const muted = count === 0;

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen(s => !s)}
        title={muted ? "Sem alertas" : `${count} alerta${count > 1 ? "s" : ""}`}
        style={{
          width: 34, height: 34, minWidth: 34, borderRadius: 8, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: open ? "rgba(255,255,255,0.06)" : "transparent",
          border: `1px solid ${open ? "rgba(255,255,255,0.10)" : "transparent"}`,
          cursor: "pointer", transition: "background 0.15s, border-color 0.15s",
          position: "relative", color: muted ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.65)",
        }}
        onMouseEnter={e => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={e => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "transparent";
        }}>
        <Bell size={16} strokeWidth={muted ? 1.6 : 2} />
        {count > 0 && (
          <span style={{
            position: "absolute", top: 4, right: 4,
            minWidth: 14, height: 14, padding: "0 4px",
            borderRadius: 7,
            background: "#EF4444",
            color: "#fff",
            fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #060A14",
            fontFamily: F,
            lineHeight: 1,
          }}>{count > 9 ? "9+" : count}</span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificações"
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0,
            width: 320, maxWidth: "calc(100vw - 32px)",
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
            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: 0.04 }}>Alertas</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{count}</span>
          </div>

          {count === 0 ? (
            <div style={{
              padding: "32px 16px",
              textAlign: "center",
              fontSize: 12.5,
              color: "rgba(255,255,255,0.45)",
            }}>
              Nada por aqui. Quando algo fugir do padrão, aparece.
            </div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {alerts.slice(0, 8).map(a => (
                <button
                  key={a.id}
                  onClick={() => { setOpen(false); navigate("/dashboard/feed"); }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: F,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                >
                  <p style={{
                    margin: 0,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.88)",
                    lineHeight: 1.3,
                  }}>{a.title || "Alerta"}</p>
                  {a.description && (
                    <p style={{
                      margin: "3px 0 0",
                      fontSize: 11.5,
                      color: "rgba(255,255,255,0.5)",
                      lineHeight: 1.35,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}>{a.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}

          {count > 0 && (
            <button
              onClick={() => { setOpen(false); navigate("/dashboard/feed"); }}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "rgba(13,162,231,0.06)",
                border: "none",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                color: "#0DA2E7",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: F,
              }}>
              Ver no Feed →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
