import React from "react";

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  {
    id: "chat",
    label: "IA Chat",
    proof: "ROAS 5.1x → 4.2x · causa identificada em 30s",
    images: [
      "/screenshots/chat-diagnostico.png",
      "/screenshots/chat-criativos.png",
    ],
  },
  {
    id: "hooks",
    label: "Hooks",
    proof: "5 hooks gerados · CTR estimado antes de gravar",
    images: ["/screenshots/chat-hooks.png"],
  },
  {
    id: "performance",
    label: "Performance",
    proof: "R$47.832 · CTR 3.87% · 2.4M impressões",
    images: ["/screenshots/performance.png"],
  },
  {
    id: "inteligencia",
    label: "Inteligência",
    proof: "Padrões e contexto da conta salvos automaticamente",
    images: ["/screenshots/inteligencia.png"],
  },
  {
    id: "diario",
    label: "Diário",
    proof: "87% taxa de acerto · R$198.340 retorno estimado",
    images: ["/screenshots/diario.png"],
  },
];

export function DemoTabs({ onCTA }: { onCTA: () => void }) {
  const [activeTab, setActiveTab] = React.useState(0);
  const [imgIdx, setImgIdx]       = React.useState(0);
  const [visible, setVisible]     = React.useState(true);

  const tab = TABS[activeTab];

  // Alterna imagens dentro de IA Chat a cada 3s
  React.useEffect(() => {
    setImgIdx(0);
    if (tab.images.length < 2) return;
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setImgIdx(i => (i + 1) % tab.images.length); setVisible(true); }, 180);
    }, 3000);
    return () => clearInterval(t);
  }, [activeTab]);

  const switchTab = (idx: number) => {
    if (idx === activeTab) return;
    setVisible(false);
    setTimeout(() => { setActiveTab(idx); setImgIdx(0); setVisible(true); }, 180);
  };

  React.useEffect(() => {
    const id = "demo-tabs-style";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      .dt-tab:hover { background: rgba(255,255,255,0.07) !important; color: rgba(255,255,255,0.8) !important; }
      .dt-cta:hover { transform: translateY(-1px) !important; box-shadow: 0 6px 24px rgba(13,162,231,0.55) !important; }
    `;
    document.head.appendChild(s);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        position: "absolute", bottom: -50, left: "10%", right: "10%", height: 100,
        background: "radial-gradient(ellipse, rgba(13,162,231,0.22) 0%, transparent 70%)",
        filter: "blur(30px)", pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        borderRadius: 16,
        background: "linear-gradient(180deg, #0b1220 0%, #080d18 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 2px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(13,162,231,0.06), 0 32px 80px rgba(0,0,0,0.7)",
        overflow: "hidden",
      }}>

        {/* TOPBAR */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.055)",
          background: "rgba(0,0,0,0.25)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <img src="/ab-avatar.png" alt="" width={26} height={26}
              style={{ borderRadius: 7, display: "block", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.025em", lineHeight: 1 }}>AdBrief</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 2 }}>FitCore Brasil</div>
            </div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 20,
            background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.22)",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", background: "#22c55e",
              boxShadow: "0 0 8px rgba(34,197,94,0.9)",
              animation: "livePulse 2s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#4ade80", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>LIVE</span>
          </div>
        </div>

        {/* TABS */}
        <div style={{
          display: "flex", gap: 4, padding: "10px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          overflowX: "auto" as const,
        }}>
          {TABS.map((t, i) => {
            const active = i === activeTab;
            return (
              <button key={t.id} onClick={() => switchTab(i)}
                className={active ? undefined : "dt-tab"}
                style={{
                  fontSize: 11.5, fontWeight: active ? 700 : 500,
                  padding: "6px 13px", borderRadius: 7,
                  cursor: "pointer", whiteSpace: "nowrap" as const,
                  flexShrink: 0, transition: "all 0.16s",
                  background: active ? "rgba(13,162,231,0.14)" : "rgba(255,255,255,0.04)",
                  color: active ? "#38bdf8" : "rgba(255,255,255,0.4)",
                  border: active ? "1px solid rgba(13,162,231,0.38)" : "1px solid transparent",
                  boxShadow: active ? "0 0 12px rgba(13,162,231,0.12)" : "none",
                  letterSpacing: "-0.01em",
                }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* PROOF LINE */}
        <div style={{
          padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#0da2e7", flexShrink: 0 }} />
            <span style={{
              fontSize: 11, color: "rgba(13,162,231,0.85)", fontWeight: 600, letterSpacing: "0.015em",
              opacity: visible ? 1 : 0, transition: "opacity 0.18s",
            }}>{tab.proof}</span>
          </div>
          {tab.images.length > 1 && (
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              {tab.images.map((_, i) => (
                <div key={i} style={{
                  height: 3, borderRadius: 2,
                  width: i === imgIdx ? 14 : 3,
                  background: i === imgIdx ? "#0da2e7" : "rgba(255,255,255,0.18)",
                  transition: "all 0.3s ease",
                }} />
              ))}
            </div>
          )}
        </div>

        {/* SCREENSHOT */}
        <div style={{ padding: "10px 12px 0" }}>
          <div style={{
            borderRadius: 10, overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0px)" : "translateY(5px)",
            transition: "opacity 0.2s ease, transform 0.2s ease",
            lineHeight: 0,
          }}>
            <img
              key={`${activeTab}-${imgIdx}`}
              src={tab.images[imgIdx]}
              alt={tab.label}
              style={{
                width: "100%", display: "block",
                maxHeight: 300, objectFit: "cover", objectPosition: "top",
              }}
            />
          </div>
        </div>

        {/* INPUT BAR */}
        <div style={{ padding: "10px 12px 12px" }}>
          <div style={{
            display: "flex", gap: 8, alignItems: "center",
            padding: "8px 8px 8px 14px", borderRadius: 10,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.2)", flex: 1, fontStyle: "italic" }}>
              Pergunte sobre sua conta...
            </span>
            <button onClick={onCTA} className="dt-cta" style={{
              fontSize: 11.5, fontWeight: 700, padding: "7px 15px", borderRadius: 8,
              background: "#0da2e7", color: "#fff", border: "none", cursor: "pointer",
              whiteSpace: "nowrap" as const, flexShrink: 0,
              boxShadow: "0 2px 14px rgba(13,162,231,0.38)", transition: "all 0.15s",
              letterSpacing: "-0.01em",
            }}>
              Testar com minha conta →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
