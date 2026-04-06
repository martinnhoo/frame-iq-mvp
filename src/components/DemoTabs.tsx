import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// DemoTabs — Hero visual right column
// Standalone. Zero dependency on parent state.
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  {
    id: "chat",
    label: "IA Chat",
    badge: "Diagnóstico ao vivo",
    proof: "ROAS 5.1x → 4.2x · causa identificada em 30s",
    images: [
      "/screenshots/chat-diagnostico.png",
      "/screenshots/chat-criativos.png",
    ],
  },
  {
    id: "hooks",
    label: "Hooks",
    badge: "Baseado nos seus winners",
    proof: "CTR estimado antes de gravar",
    images: ["/screenshots/chat-hooks.png"],
  },
  {
    id: "performance",
    label: "Performance",
    badge: "Últimos 90 dias",
    proof: "R$47.832 · CTR 3.87% · 2.4M impressões",
    images: ["/screenshots/performance.png"],
  },
  {
    id: "inteligencia",
    label: "Inteligência",
    badge: "Memória da conta",
    proof: "Padrões salvos automaticamente",
    images: ["/screenshots/inteligencia.png"],
  },
  {
    id: "diario",
    label: "Diário",
    badge: "Classificação automática",
    proof: "87% acerto · R$198.340 retorno estimado",
    images: ["/screenshots/diario.png"],
  },
] as const;

// Inject CSS once
const CSS = `
  @keyframes demoPulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(34,197,94,0.4)} 50%{opacity:0.5;box-shadow:0 0 0 4px rgba(34,197,94,0)} }
  @keyframes demoFadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .dt-tab-btn { transition: all 0.15s ease !important; }
  .dt-tab-btn:hover { background: rgba(255,255,255,0.08) !important; color: rgba(255,255,255,0.85) !important; border-color: rgba(255,255,255,0.15) !important; }
  .dt-cta-btn { transition: all 0.15s ease !important; }
  .dt-cta-btn:hover { background: #0ea5e9 !important; box-shadow: 0 4px 20px rgba(13,162,231,0.6) !important; transform: translateY(-1px) !important; }
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected || typeof document === "undefined") return;
  const s = document.createElement("style");
  s.textContent = CSS;
  document.head.appendChild(s);
  cssInjected = true;
}

export function DemoTabs({ onCTA }: { onCTA: () => void }) {
  injectCSS();

  const [tab, setTab]       = React.useState(0);
  const [img, setImg]       = React.useState(0);
  const [show, setShow]     = React.useState(true);
  const [key, setKey]       = React.useState(0);

  const current = TABS[tab];

  // Auto-rotate images inside IA Chat every 3s
  React.useEffect(() => {
    setImg(0);
    if (current.images.length < 2) return;
    const id = setInterval(() => {
      setShow(false);
      setTimeout(() => {
        setImg(p => (p + 1) % current.images.length);
        setShow(true);
        setKey(k => k + 1);
      }, 200);
    }, 3000);
    return () => clearInterval(id);
  }, [tab]);

  function goTab(i: number) {
    if (i === tab) return;
    setShow(false);
    setTimeout(() => {
      setTab(i);
      setImg(0);
      setShow(true);
      setKey(k => k + 1);
    }, 180);
  }

  // ─── Styles ──────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    borderRadius: 20,
    background: "#080e1c",
    border: "1px solid rgba(255,255,255,0.07)",
    boxShadow: [
      "0 0 0 1px rgba(13,162,231,0.05)",
      "0 8px 16px rgba(0,0,0,0.4)",
      "0 40px 100px rgba(0,0,0,0.6)",
    ].join(", "),
    overflow: "hidden",
    position: "relative",
  };

  const topbar: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(0,0,0,0.3)",
  };

  const tabsRow: React.CSSProperties = {
    display: "flex",
    gap: 6,
    padding: "10px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  };

  const proofBar: React.CSSProperties = {
    padding: "7px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 36,
  };

  const imgWrap: React.CSSProperties = {
    margin: "12px 14px 0",
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.06)",
    background: "#060b16",
    opacity: show ? 1 : 0,
    transform: show ? "translateY(0)" : "translateY(6px)",
    transition: "opacity 0.2s ease, transform 0.2s ease",
    lineHeight: 0,
  };

  const inputRow: React.CSSProperties = {
    margin: "10px 14px 14px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 8px 8px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Glow behind card */}
      <div style={{
        position: "absolute",
        bottom: -60, left: "15%", right: "15%", height: 120,
        background: "radial-gradient(ellipse, rgba(13,162,231,0.25) 0%, transparent 70%)",
        filter: "blur(32px)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      <div style={{ ...card, position: "relative", zIndex: 1 }}>

        {/* ── TOP BAR ────────────────────────────────────────────────── */}
        <div style={topbar}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="/ab-avatar.png" alt="AdBrief"
              style={{ width: 28, height: 28, borderRadius: 8, display: "block", flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>
                AdBrief
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 3, letterSpacing: "0.01em" }}>
                Conectado · Meta Ads
              </div>
            </div>
          </div>

          {/* Live */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 20,
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.2)",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#22c55e",
              animation: "demoPulse 2s ease infinite",
            }} />
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#4ade80",
              letterSpacing: "0.1em", textTransform: "uppercase" as const,
            }}>LIVE</span>
          </div>
        </div>

        {/* ── TABS ───────────────────────────────────────────────────── */}
        <div style={tabsRow}>
          {TABS.map((t, i) => {
            const active = i === tab;
            return (
              <button
                key={t.id}
                onClick={() => goTab(i)}
                className="dt-tab-btn"
                style={{
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  padding: "6px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                  whiteSpace: "nowrap" as const,
                  flexShrink: 0,
                  background: active ? "rgba(13,162,231,0.15)" : "transparent",
                  color: active ? "#38bdf8" : "rgba(255,255,255,0.38)",
                  border: active
                    ? "1px solid rgba(13,162,231,0.4)"
                    : "1px solid rgba(255,255,255,0.08)",
                  letterSpacing: "-0.01em",
                  boxShadow: active ? "0 0 14px rgba(13,162,231,0.15)" : "none",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── PROOF BAR ──────────────────────────────────────────────── */}
        <div style={proofBar}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{
              padding: "2px 8px", borderRadius: 5,
              background: "rgba(13,162,231,0.1)",
              border: "1px solid rgba(13,162,231,0.2)",
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#0da2e7", letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
                {current.badge}
              </span>
            </div>
            <span style={{
              fontSize: 11, color: "rgba(255,255,255,0.38)", letterSpacing: "0.01em",
              opacity: show ? 1 : 0, transition: "opacity 0.18s",
            }}>
              {current.proof}
            </span>
          </div>

          {/* Image switcher dots */}
          {current.images.length > 1 && (
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {current.images.map((_, i) => (
                <div key={i} style={{
                  height: 3, borderRadius: 2,
                  width: i === img ? 16 : 4,
                  background: i === img ? "#0da2e7" : "rgba(255,255,255,0.15)",
                  transition: "all 0.35s ease",
                }} />
              ))}
            </div>
          )}
        </div>

        {/* ── SCREENSHOT ─────────────────────────────────────────────── */}
        <div style={imgWrap}>
          <img
            key={key}
            src={current.images[img]}
            alt={current.label}
            style={{
              width: "100%",
              display: "block",
              maxHeight: 310,
              objectFit: "cover",
              objectPosition: "top center",
              animation: "demoFadeUp 0.25s ease both",
            }}
          />
        </div>

        {/* ── INPUT BAR ──────────────────────────────────────────────── */}
        <div style={inputRow}>
          <span style={{
            fontSize: 12, color: "rgba(255,255,255,0.18)",
            fontStyle: "italic", flex: 1,
          }}>
            Pergunte sobre sua conta...
          </span>
          <button
            onClick={onCTA}
            className="dt-cta-btn"
            style={{
              fontSize: 12, fontWeight: 700,
              padding: "8px 16px", borderRadius: 9,
              background: "#0da2e7",
              color: "#fff", border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap" as const,
              flexShrink: 0,
              letterSpacing: "-0.01em",
              boxShadow: "0 2px 16px rgba(13,162,231,0.4)",
            }}
          >
            Testar com minha conta →
          </button>
        </div>

      </div>
    </div>
  );
}
