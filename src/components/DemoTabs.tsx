import React from "react";

// Cada item: o que aparece NA IMAGEM, não uma descrição genérica
const ITEMS = [
  {
    id: "roas",
    tab: "ROAS caiu?",
    title: "Por que meu ROAS caiu essa semana?",
    answer: "CTR 3.87% · CPM R$18,40 · Freq 1.8 — criativo saturando",
    src: "/screenshots/chat-diagnostico.png",
  },
  {
    id: "pausar",
    tab: "O que pausar?",
    title: "Quais criativos pausar primeiro?",
    answer: "Video_Hook_Prova01 · ROAS 2.1x · Freq 3.4 → pausar já",
    src: "/screenshots/chat-criativos.png",
  },
  {
    id: "hooks",
    tab: "Gera hooks",
    title: "5 hooks do criativo vencedor — CTR estimado",
    answer: "Urgência · Prova Social · Curiosidade · Dor · Resultado",
    src: "/screenshots/chat-hooks.png",
  },
  {
    id: "perf",
    tab: "Performance",
    title: "R$47.832 investido · CTR 3.87% · 2.4M impressões",
    answer: "Tendência Out→Fev · CPC R$0,42 · 92.4k cliques",
    src: "/screenshots/performance.png",
  },
  {
    id: "intel",
    tab: "Inteligência",
    title: "4 memórias · 7 padrões · 12 ações executadas",
    answer: "ROAS cai quando freq > 2.5 — a IA já sabe disso",
    src: "/screenshots/inteligencia.png",
  },
  {
    id: "diario",
    tab: "Diário",
    title: "87% taxa de acerto · R$198.340 retorno estimado",
    answer: "Reels_Hook_Urgencia_v3 · 5.1% CTR · Vencedor",
    src: "/screenshots/diario.png",
  },
] as const;

export function DemoTabs({ onCTA }: { onCTA: () => void }) {
  const [idx, setIdx] = React.useState(0);
  const [fading, setFading] = React.useState(false);

  const item = ITEMS[idx];

  function go(i: number) {
    if (i === idx) return;
    setFading(true);
    setTimeout(() => { setIdx(i); setFading(false); }, 220);
  }

  // Auto-avança a cada 5s
  React.useEffect(() => {
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => { setIdx(p => (p + 1) % ITEMS.length); setFading(false); }, 220);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ position: "relative" }}>

      {/* Glow azul atrás do card */}
      <div style={{
        position: "absolute",
        bottom: -50, left: "8%", right: "8%", height: 120,
        background: "radial-gradient(ellipse, rgba(13,162,231,0.22) 0%, transparent 70%)",
        filter: "blur(32px)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* Card principal */}
      <div style={{
        position: "relative", zIndex: 1,
        borderRadius: 16,
        overflow: "hidden",
        background: "#07101f",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 0 0 1px rgba(13,162,231,0.06), 0 32px 80px rgba(0,0,0,0.75)",
      }}>

        {/* ── SCREENSHOT — ocupa tudo, sem corte ── */}
        <div style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1673 / 908",   // ratio exato dos prints
          overflow: "hidden",
          background: "#060c18",
          lineHeight: 0,
        }}>
          {/* Sobreposição superior com topbar do produto */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            zIndex: 2,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px",
            background: "linear-gradient(180deg, rgba(5,10,22,0.92) 0%, rgba(5,10,22,0.5) 70%, transparent 100%)",
          }}>
            {/* Brand */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src="/ab-avatar.png" alt=""
                style={{ width: 22, height: 22, borderRadius: 6, display: "block" }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>
                AdBrief
              </span>
            </div>
            {/* Live */}
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "3px 8px", borderRadius: 20,
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,1)",
                animation: "pulse 2s ease-in-out infinite",
              }} />
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#4ade80", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                LIVE
              </span>
            </div>
          </div>

          {/* Screenshot */}
          <img
            key={item.id}
            src={item.src}
            alt={item.title}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              objectPosition: "top center",
              display: "block",
              opacity: fading ? 0 : 1,
              transform: fading ? "scale(1.02)" : "scale(1)",
              transition: "opacity 0.22s ease, transform 0.22s ease",
            }}
          />

          {/* Gradiente inferior — suaviza o corte */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "30%",
            background: "linear-gradient(0deg, #07101f 0%, transparent 100%)",
            pointerEvents: "none", zIndex: 2,
          }} />
        </div>

        {/* ── LABEL — muda com cada screenshot ── */}
        <div style={{
          padding: "14px 18px 10px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          opacity: fading ? 0 : 1,
          transition: "opacity 0.22s ease",
        }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: "#fff",
            letterSpacing: "-0.02em", lineHeight: 1.3,
            marginBottom: 4,
          }}>
            {item.title}
          </div>
          <div style={{
            fontSize: 11.5, color: "rgba(255,255,255,0.38)",
            letterSpacing: "0.01em",
          }}>
            {item.answer}
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{
          padding: "10px 14px 12px",
          display: "flex",
          gap: 5,
          flexWrap: "wrap" as const,
        }}>
          {ITEMS.map((it, i) => {
            const on = i === idx;
            return (
              <button key={it.id} onClick={() => go(i)} style={{
                fontSize: 11.5,
                fontWeight: on ? 700 : 500,
                padding: "6px 12px",
                borderRadius: 8,
                cursor: "pointer",
                border: on ? "1px solid rgba(13,162,231,0.45)" : "1px solid rgba(255,255,255,0.09)",
                background: on ? "rgba(13,162,231,0.15)" : "rgba(255,255,255,0.04)",
                color: on ? "#38bdf8" : "rgba(255,255,255,0.38)",
                transition: "all 0.15s ease",
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap" as const,
              }}>
                {it.tab}
              </button>
            );
          })}

          {/* Progress dots + CTA */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", gap: 3 }}>
              {ITEMS.map((_, i) => (
                <div key={i} style={{
                  height: 3, borderRadius: 2,
                  width: i === idx ? 16 : 3,
                  background: i === idx ? "#0da2e7" : "rgba(255,255,255,0.15)",
                  transition: "width 0.35s ease, background 0.35s ease",
                  cursor: "pointer",
                }} onClick={() => go(i)} />
              ))}
            </div>
            <button onClick={onCTA} style={{
              fontSize: 11.5, fontWeight: 700,
              padding: "6px 14px", borderRadius: 8,
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
