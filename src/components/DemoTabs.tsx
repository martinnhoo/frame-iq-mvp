import React from "react";

const ITEMS = [
  {
    id: "roas",
    tab: "ROAS caiu?",
    title: "Por que meu ROAS caiu essa semana?",
    sub: "CTR 3.87% ↓  ·  Freq 1.8 ↑  ·  criativo saturando",
    src: "/screenshots/chat-diagnostico.png",
  },
  {
    id: "pausar",
    tab: "O que pausar?",
    title: "Quais criativos pausar primeiro?",
    sub: "Video_Hook_Prova01 · ROAS 2.1x · Freq 3.4 → pausar já",
    src: "/screenshots/chat-criativos.png",
  },
  {
    id: "hooks",
    tab: "Gera hooks",
    title: "5 hooks do criativo vencedor — CTR estimado",
    sub: "Urgência · Prova Social · Curiosidade · Dor · Resultado",
    src: "/screenshots/chat-hooks.png",
  },
  {
    id: "perf",
    tab: "Performance",
    title: "R$47.832 investido · CTR 3.87% · 2.4M impressões",
    sub: "Tendência Out→Fev · CPC R$0,42 · 92.4k cliques",
    src: "/screenshots/performance.png",
  },
  {
    id: "intel",
    tab: "Inteligência",
    title: "4 memórias · 7 padrões · 12 ações executadas",
    sub: "ROAS cai quando freq > 2.5 — a IA já sabe disso",
    src: "/screenshots/inteligencia.png",
  },
  {
    id: "diario",
    tab: "Diário",
    title: "87% taxa de acerto · R$198.340 retorno estimado",
    sub: "Reels_Hook_Urgencia_v3 · CTR 5.1% · Vencedor",
    src: "/screenshots/diario.png",
  },
] as const;

export function DemoTabs({ onCTA }: { onCTA: () => void }) {
  const [idx, setIdx] = React.useState(0);

  // Auto-avança sem nenhum setTimeout
  React.useEffect(() => {
    const id = setInterval(() => setIdx(p => (p + 1) % ITEMS.length), 4000);
    return () => clearInterval(id);
  }, []);

  const item = ITEMS[idx];

  return (
    <div style={{ position: "relative" }}>

      {/* Glow */}
      <div style={{
        position: "absolute",
        bottom: -50, left: "8%", right: "8%", height: 120,
        background: "radial-gradient(ellipse, rgba(13,162,231,0.22) 0%, transparent 70%)",
        filter: "blur(32px)", pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        borderRadius: 16, overflow: "hidden",
        background: "#07101f",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 0 0 1px rgba(13,162,231,0.06), 0 32px 80px rgba(0,0,0,0.75)",
      }}>

        {/* TOPBAR */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px",
          background: "rgba(0,0,0,0.4)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/ab-avatar.png" alt=""
              style={{ width: 24, height: 24, borderRadius: 6, display: "block" }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>
              AdBrief
            </span>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "3px 9px", borderRadius: 20,
            background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.22)",
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

        {/* SCREENSHOT — todas as imagens no DOM, só troca opacity */}
        <div style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1673 / 908",
          overflow: "hidden",
          background: "#060c18",
        }}>
          {ITEMS.map((it, i) => (
            <img
              key={it.id}
              src={it.src}
              alt={it.tab}
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                objectFit: "cover", objectPosition: "top center",
                display: "block",
                opacity: i === idx ? 1 : 0,
                transition: "opacity 0.35s ease",
                // sem transform, sem scale — só opacity
              }}
            />
          ))}

          {/* Gradiente inferior para suavizar */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "28%",
            background: "linear-gradient(0deg, #07101f 0%, transparent 100%)",
            pointerEvents: "none", zIndex: 2,
          }} />
        </div>

        {/* LABEL — sincronizado com idx, sem delay */}
        <div style={{ padding: "12px 18px 8px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", marginBottom: 3 }}>
            {item.title}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.01em" }}>
            {item.sub}
          </div>
        </div>

        {/* TABS + CTA */}
        <div style={{
          padding: "8px 14px 12px",
          display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" as const,
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}>
          {ITEMS.map((it, i) => {
            const on = i === idx;
            return (
              <button key={it.id} onClick={() => setIdx(i)} style={{
                fontSize: 11, fontWeight: on ? 700 : 500,
                padding: "5px 11px", borderRadius: 7,
                cursor: "pointer", whiteSpace: "nowrap" as const,
                background: on ? "rgba(13,162,231,0.15)" : "rgba(255,255,255,0.04)",
                color: on ? "#38bdf8" : "rgba(255,255,255,0.35)",
                border: on ? "1px solid rgba(13,162,231,0.4)" : "1px solid rgba(255,255,255,0.08)",
                transition: "all 0.15s ease",
                letterSpacing: "-0.01em",
              }}>
                {it.tab}
              </button>
            );
          })}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {/* Progress dots */}
            <div style={{ display: "flex", gap: 3 }}>
              {ITEMS.map((_, i) => (
                <div key={i} onClick={() => setIdx(i)} style={{
                  height: 3, borderRadius: 2, cursor: "pointer",
                  width: i === idx ? 16 : 3,
                  background: i === idx ? "#0da2e7" : "rgba(255,255,255,0.15)",
                  transition: "width 0.35s ease, background 0.35s ease",
                }} />
              ))}
            </div>
            <button onClick={onCTA} style={{
              fontSize: 11.5, fontWeight: 700,
              padding: "7px 14px", borderRadius: 8,
              background: "#0da2e7", color: "#fff",
              border: "none", cursor: "pointer",
              letterSpacing: "-0.01em",
              boxShadow: "0 2px 12px rgba(13,162,231,0.4)",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap" as const,
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#0ea5e9"; el.style.boxShadow = "0 4px 20px rgba(13,162,231,0.6)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#0da2e7"; el.style.boxShadow = "0 2px 12px rgba(13,162,231,0.4)"; }}
            >
              Começar grátis →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
