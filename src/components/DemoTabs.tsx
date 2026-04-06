import React from "react";

// ─── Nav items — espelham a sidebar real do produto ──────────────────────────
const NAV = [
  {
    id: "chat",
    icon: "💬",
    label: "IA Chat",
    caption: "ROAS caiu 5.1x → 4.2x",
    images: ["/screenshots/chat-diagnostico.png", "/screenshots/chat-criativos.png"],
  },
  {
    id: "hooks",
    icon: "⚡",
    label: "Hooks",
    caption: "CTR estimado antes de gravar",
    images: ["/screenshots/chat-hooks.png"],
  },
  {
    id: "perf",
    icon: "📈",
    label: "Performance",
    caption: "R$47.832 · 90 dias",
    images: ["/screenshots/performance.png"],
  },
  {
    id: "intel",
    icon: "🧠",
    label: "Inteligência",
    caption: "Padrões salvos automaticamente",
    images: ["/screenshots/inteligencia.png"],
  },
  {
    id: "diario",
    icon: "📋",
    label: "Diário",
    caption: "87% taxa de acerto",
    images: ["/screenshots/diario.png"],
  },
] as const;

export function DemoTabs({ onCTA }: { onCTA: () => void }) {
  const [active, setActive] = React.useState(0);
  const [imgIdx, setImgIdx] = React.useState(0);
  const [fading, setFading] = React.useState(false);

  const item = NAV[active];

  // Alterna imagens dentro do IA Chat a cada 3.5s
  React.useEffect(() => {
    setImgIdx(0);
    if (item.images.length < 2) return;
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => { setImgIdx(p => (p + 1) % item.images.length); setFading(false); }, 280);
    }, 3500);
    return () => clearInterval(id);
  }, [active]);

  function go(i: number) {
    if (i === active) return;
    setFading(true);
    setTimeout(() => { setActive(i); setImgIdx(0); setFading(false); }, 250);
  }

  return (
    <div style={{ position: "relative" }}>

      {/* Glow */}
      <div style={{
        position: "absolute", bottom: -60, left: "10%", right: "10%", height: 140,
        background: "radial-gradient(ellipse, rgba(13,162,231,0.2) 0%, transparent 70%)",
        filter: "blur(36px)", pointerEvents: "none", zIndex: 0,
      }} />

      {/* App frame */}
      <div style={{
        position: "relative", zIndex: 1,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 0 0 1px rgba(13,162,231,0.05), 0 32px 80px rgba(0,0,0,0.7)",
        background: "#07101f",
        display: "flex",
        flexDirection: "column" as const,
      }}>

        {/* ── TOPBAR ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 16px",
          background: "rgba(0,0,0,0.4)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <img src="/ab-avatar.png" alt="ab"
              style={{ width: 26, height: 26, borderRadius: 7, display: "block", flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>
              AdBrief
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Meta badge */}
            <div style={{
              fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.4)",
              padding: "3px 9px", borderRadius: 6,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              letterSpacing: "0.02em",
            }}>
              Meta Ads
            </div>

            {/* Live */}
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 9px", borderRadius: 20,
              background: "rgba(34,197,94,0.07)",
              border: "1px solid rgba(34,197,94,0.22)",
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: "50%", background: "#22c55e",
                boxShadow: "0 0 6px rgba(34,197,94,1)",
                animation: "pulse 2s ease-in-out infinite",
              }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                LIVE
              </span>
            </div>
          </div>
        </div>

        {/* ── BODY: SIDEBAR + CONTENT ── */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

          {/* SIDEBAR */}
          <div style={{
            width: 130,
            flexShrink: 0,
            borderRight: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(0,0,0,0.25)",
            padding: "10px 8px",
            display: "flex",
            flexDirection: "column" as const,
            gap: 3,
          }}>
            {NAV.map((n, i) => {
              const on = i === active;
              return (
                <button key={n.id} onClick={() => go(i)} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 10px",
                  borderRadius: 9,
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left" as const,
                  background: on ? "rgba(13,162,231,0.14)" : "transparent",
                  transition: "background 0.15s ease",
                  position: "relative" as const,
                }}>
                  {on && (
                    <div style={{
                      position: "absolute", left: 0, top: "20%", bottom: "20%",
                      width: 2, borderRadius: 2, background: "#0da2e7",
                    }} />
                  )}
                  <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{n.icon}</span>
                  <span style={{
                    fontSize: 12, fontWeight: on ? 700 : 500,
                    color: on ? "#38bdf8" : "rgba(255,255,255,0.38)",
                    letterSpacing: "-0.01em",
                    transition: "color 0.15s ease",
                    whiteSpace: "nowrap" as const,
                  }}>
                    {n.label}
                  </span>
                </button>
              );
            })}

            {/* Spacer + CTA */}
            <div style={{ flex: 1 }} />
            <button onClick={onCTA} style={{
              margin: "8px 0 2px",
              padding: "9px 10px",
              borderRadius: 9,
              background: "#0da2e7",
              border: "none",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "-0.01em",
              boxShadow: "0 2px 14px rgba(13,162,231,0.4)",
              transition: "all 0.15s ease",
              textAlign: "center" as const,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#0ea5e9"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#0da2e7"; }}
            >
              Começar grátis
            </button>
          </div>

          {/* MAIN CONTENT — screenshot */}
          <div style={{
            flex: 1,
            position: "relative" as const,
            overflow: "hidden",
            background: "#060c18",
            minWidth: 0,
          }}>
            {/* Caption strip */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
              padding: "7px 12px",
              background: "linear-gradient(180deg, rgba(6,12,24,0.95) 0%, transparent 100%)",
              display: "flex", alignItems: "center", gap: 7,
            }}>
              <div style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em",
                padding: "2px 7px", borderRadius: 4,
                background: "rgba(13,162,231,0.15)",
                border: "1px solid rgba(13,162,231,0.3)",
                color: "#0da2e7", textTransform: "uppercase" as const,
                flexShrink: 0,
              }}>
                {item.label}
              </div>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: "0.01em" }}>
                {item.caption}
              </span>

              {/* Dots for multi-image */}
              {item.images.length > 1 && (
                <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
                  {item.images.map((_, i) => (
                    <div key={i} style={{
                      height: 3, borderRadius: 2,
                      width: i === imgIdx ? 16 : 4,
                      background: i === imgIdx ? "#0da2e7" : "rgba(255,255,255,0.2)",
                      transition: "width 0.35s ease",
                    }} />
                  ))}
                </div>
              )}
            </div>

            {/* Screenshot */}
            <img
              key={`${active}-${imgIdx}`}
              src={item.images[imgIdx]}
              alt={item.label}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top left",
                display: "block",
                opacity: fading ? 0 : 1,
                transform: fading ? "scale(1.01)" : "scale(1)",
                transition: "opacity 0.28s ease, transform 0.28s ease",
              }}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
