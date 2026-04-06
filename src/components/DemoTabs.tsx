import React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Tab {
  id: string;
  label: string;
  icon: string;
  headline: string;
  proof: string;
  // IA Chat alterna entre 2 imagens
  images: string[];
}

// ─── Tab data — copy focada em RESULTADO ──────────────────────────────────────
const TABS: Tab[] = [
  {
    id: "diagnostico",
    label: "IA Chat",
    icon: "💬",
    headline: "Por que o ROAS caiu?",
    proof: "Resposta em 30s — sem abrir o Ads Manager",
    images: [
      "/screenshots/chat-diagnostico.png",
      "/screenshots/chat-criativos.png",
    ],
  },
  {
    id: "hooks",
    label: "Hooks",
    icon: "⚡",
    headline: "Hooks com CTR estimado",
    proof: "Gerados do seu criativo vencedor · ROAS 5.8x",
    images: ["/screenshots/chat-hooks.png"],
  },
  {
    id: "performance",
    label: "Performance",
    icon: "📈",
    headline: "90 dias numa tela",
    proof: "R$47.832 · CTR 3.87% · 2.4M impressões",
    images: ["/screenshots/performance.png"],
  },
  {
    id: "inteligencia",
    label: "Inteligência",
    icon: "🧠",
    headline: "A IA aprende com você",
    proof: "Padrões, preferências e contexto da conta salvos",
    images: ["/screenshots/inteligencia.png"],
  },
  {
    id: "diario",
    label: "Diário",
    icon: "📋",
    headline: "Vencedor, Ativo ou Pausar",
    proof: "87% taxa de acerto · R$198.340 retorno estimado",
    images: ["/screenshots/diario.png"],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function DemoTabs({ onCTA }: { onCTA: () => void }) {
  const [activeTab, setActiveTab] = React.useState(0);
  const [imgIdx, setImgIdx] = React.useState(0);
  const [fade, setFade] = React.useState(true);

  const tab = TABS[activeTab];
  const hasMultipleImages = tab.images.length > 1;

  // Alterna imagens dentro da tab IA Chat a cada 3s
  React.useEffect(() => {
    setImgIdx(0);
    if (!hasMultipleImages) return;
    const t = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setImgIdx(i => (i + 1) % tab.images.length);
        setFade(true);
      }, 200);
    }, 3000);
    return () => clearInterval(t);
  }, [activeTab, hasMultipleImages, tab.images.length]);

  // Fade ao trocar tab
  const handleTab = (idx: number) => {
    if (idx === activeTab) return;
    setFade(false);
    setTimeout(() => {
      setActiveTab(idx);
      setImgIdx(0);
      setFade(true);
    }, 180);
  };

  // Restore fade on mount
  React.useEffect(() => { setFade(true); }, []);

  return (
    <div style={{ position: "relative", zIndex: 1 }}>

      {/* Ambient glow */}
      <div style={{
        position: "absolute", bottom: -40, left: "5%", right: "5%", height: 120,
        background: "radial-gradient(ellipse, rgba(13,162,231,0.2) 0%, transparent 70%)",
        pointerEvents: "none", filter: "blur(28px)", zIndex: 0,
      }} />

      {/* Main card */}
      <div style={{
        position: "relative", zIndex: 1, borderRadius: 18, overflow: "hidden",
        background: "#080d1a",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 0 0 1px rgba(13,162,231,0.07), 0 40px 100px rgba(0,0,0,0.75)",
      }}>

        {/* ── TOP BAR ── */}
        <div style={{
          padding: "12px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(0,0,0,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, overflow: "hidden", background: "#0a0c10", flexShrink: 0 }}>
              <img src="/ab-avatar.png" alt="AdBrief" width={28} height={28} style={{ width: 28, height: 28, objectFit: "cover", display: "block" }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2 }}>AdBrief</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>Conta de exemplo · FitCore Brasil</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 20, border: "1px solid rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.06)" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.8)", animation: "pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 11, color: "#4ade80", letterSpacing: "0.06em", textTransform: "uppercase" as const, fontWeight: 600 }}>live</span>
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{
          padding: "10px 16px",
          display: "flex", gap: 5,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          overflowX: "auto" as const,
          scrollbarWidth: "none" as const,
        }}>
          {TABS.map((t, i) => {
            const isAct = i === activeTab;
            return (
              <button
                key={t.id}
                onClick={() => handleTab(i)}
                style={{
                  fontSize: 12, fontWeight: isAct ? 700 : 500,
                  padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                  transition: "all 0.18s", whiteSpace: "nowrap" as const, flexShrink: 0,
                  background: isAct ? "rgba(13,162,231,0.15)" : "rgba(255,255,255,0.04)",
                  color: isAct ? "#38bdf8" : "rgba(255,255,255,0.45)",
                  border: isAct ? "1px solid rgba(13,162,231,0.4)" : "1px solid rgba(255,255,255,0.07)",
                  boxShadow: isAct ? "0 0 14px rgba(13,162,231,0.15)" : "none",
                  letterSpacing: "-0.01em",
                }}
              >
                {t.icon} {t.label}
              </button>
            );
          })}
        </div>

        {/* ── PROOF BADGE ── */}
        <div style={{
          padding: "10px 18px 0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 10px", borderRadius: 6,
            background: "rgba(13,162,231,0.07)",
            border: "1px solid rgba(13,162,231,0.18)",
          }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#0da2e7" }} />
            <span style={{ fontSize: 11, color: "#0da2e7", fontWeight: 600, letterSpacing: "0.04em" }}>
              {tab.proof}
            </span>
          </div>
          {/* Image switcher dots for IA Chat */}
          {hasMultipleImages && (
            <div style={{ display: "flex", gap: 4 }}>
              {tab.images.map((_, i) => (
                <div key={i} style={{
                  width: i === imgIdx ? 16 : 4, height: 4, borderRadius: 2,
                  background: i === imgIdx ? "#0da2e7" : "rgba(255,255,255,0.15)",
                  transition: "all 0.3s ease",
                }} />
              ))}
            </div>
          )}
        </div>

        {/* ── SCREENSHOT ── */}
        <div style={{ padding: "10px 14px 14px", position: "relative" }}>
          <div style={{
            borderRadius: 12, overflow: "hidden",
            border: "1px solid hsl(224,22%,18%)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            opacity: fade ? 1 : 0,
            transform: fade ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 0.2s ease, transform 0.2s ease",
          }}>
            <img
              src={tab.images[imgIdx]}
              alt={tab.headline}
              style={{
                width: "100%", display: "block",
                objectFit: "cover",
                maxHeight: 340,
              }}
            />
          </div>
        </div>

        {/* ── INPUT BAR ── */}
        <div style={{ padding: "0 16px 14px" }}>
          <div style={{
            display: "flex", gap: 8, alignItems: "center",
            padding: "9px 12px 9px 16px", borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", margin: 0, flex: 1, fontStyle: "italic" }}>
              Pergunte sobre sua conta...
            </p>
            <button
              onClick={onCTA}
              style={{
                fontSize: 12, fontWeight: 700, padding: "8px 16px", borderRadius: 8,
                background: "linear-gradient(135deg, #0da2e7, #0284c7)", color: "#fff",
                border: "none", cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0,
                boxShadow: "0 2px 14px rgba(13,162,231,0.4)", transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "translateY(-1px)";
                el.style.boxShadow = "0 4px 20px rgba(13,162,231,0.6)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "none";
                el.style.boxShadow = "0 2px 14px rgba(13,162,231,0.4)";
              }}
            >
              Testar com minha conta →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
