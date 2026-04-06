import React from "react";

const TABS = [
  {
    id: "chat",
    label: "IA Chat",
    tag: "DIAGNÓSTICO",
    headline: "ROAS caiu 5.1x → 4.2x",
    sub: "causa identificada em 30s",
    images: ["/screenshots/chat-diagnostico.png", "/screenshots/chat-criativos.png"],
  },
  {
    id: "hooks",
    label: "Hooks",
    tag: "CRIATIVO",
    headline: "CTR estimado antes de gravar",
    sub: "gerado do seu criativo vencedor",
    images: ["/screenshots/chat-hooks.png"],
  },
  {
    id: "perf",
    label: "Performance",
    tag: "90 DIAS",
    headline: "R$47.832 · CTR 3.87%",
    sub: "2.4M impressões · CPC R$0,42",
    images: ["/screenshots/performance.png"],
  },
  {
    id: "intel",
    label: "Inteligência",
    tag: "MEMÓRIA",
    headline: "A IA aprende com cada conversa",
    sub: "padrões e contexto salvos automaticamente",
    images: ["/screenshots/inteligencia.png"],
  },
  {
    id: "diario",
    label: "Diário",
    tag: "DECISÃO",
    headline: "87% taxa de acerto",
    sub: "R$198.340 retorno estimado",
    images: ["/screenshots/diario.png"],
  },
] as const;

export function DemoTabs({ onCTA }: { onCTA: () => void }) {
  const [active, setActive] = React.useState(0);
  const [imgIdx, setImgIdx] = React.useState(0);
  const [opacity, setOpacity] = React.useState(1);
  const [translateY, setTranslateY] = React.useState(0);

  const tab = TABS[active];

  // Smooth crossfade between images within IA Chat
  React.useEffect(() => {
    setImgIdx(0);
    if (tab.images.length < 2) return;
    const id = setInterval(() => {
      setOpacity(0);
      setTranslateY(8);
      setTimeout(() => {
        setImgIdx(p => (p + 1) % tab.images.length);
        setOpacity(1);
        setTranslateY(0);
      }, 300);
    }, 3500);
    return () => clearInterval(id);
  }, [active]);

  function goTab(i: number) {
    if (i === active) return;
    setOpacity(0);
    setTranslateY(8);
    setTimeout(() => {
      setActive(i);
      setImgIdx(0);
      setOpacity(1);
      setTranslateY(0);
    }, 250);
  }

  return (
    <div style={{ position: "relative", userSelect: "none" }}>

      {/* Ambient glow */}
      <div style={{
        position: "absolute",
        inset: "-20px -40px -60px -40px",
        background: "radial-gradient(ellipse 80% 60% at 50% 80%, rgba(13,162,231,0.18) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      <div style={{
        position: "relative",
        zIndex: 1,
        borderRadius: 20,
        overflow: "hidden",
        background: "#07101f",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 0 0 1px rgba(13,162,231,0.06), 0 24px 80px rgba(0,0,0,0.7), 0 4px 0 rgba(255,255,255,0.03) inset",
      }}>

        {/* ── TOP BAR ── */}
        <div style={{
          padding: "13px 18px",
          background: "rgba(0,0,0,0.35)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/ab-avatar.png" alt=""
              style={{ width: 28, height: 28, borderRadius: 8, display: "block" }} />
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>AdBrief</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.3)", marginTop: 3, letterSpacing: "0.02em" }}>
                Meta Ads · conectado
              </div>
            </div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 20,
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.2)",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 8px rgba(34,197,94,1)",
              animation: "pulse 2s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
              LIVE
            </span>
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{
          display: "flex",
          gap: 4,
          padding: "12px 16px",
          background: "rgba(0,0,0,0.15)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          {TABS.map((t, i) => {
            const on = i === active;
            return (
              <button key={t.id} onClick={() => goTab(i)} style={{
                fontSize: 12,
                fontWeight: on ? 700 : 500,
                padding: "7px 14px",
                borderRadius: 9,
                cursor: "pointer",
                border: on ? "1px solid rgba(13,162,231,0.45)" : "1px solid rgba(255,255,255,0.08)",
                background: on ? "rgba(13,162,231,0.15)" : "rgba(255,255,255,0.03)",
                color: on ? "#38bdf8" : "rgba(255,255,255,0.38)",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap" as const,
                boxShadow: on ? "0 0 16px rgba(13,162,231,0.15)" : "none",
                letterSpacing: on ? "-0.01em" : "0",
              }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── META LINE ── */}
        <div style={{
          padding: "9px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em",
              padding: "2px 7px", borderRadius: 4,
              background: "rgba(13,162,231,0.12)",
              border: "1px solid rgba(13,162,231,0.25)",
              color: "#0da2e7",
              textTransform: "uppercase" as const,
            }}>
              {tab.tag}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "-0.01em" }}>
              {tab.headline}
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
              — {tab.sub}
            </span>
          </div>

          {tab.images.length > 1 && (
            <div style={{ display: "flex", gap: 3 }}>
              {tab.images.map((_, i) => (
                <div key={i} style={{
                  height: 3, borderRadius: 2,
                  width: i === imgIdx ? 18 : 4,
                  background: i === imgIdx ? "#0da2e7" : "rgba(255,255,255,0.15)",
                  transition: "width 0.35s ease, background 0.35s ease",
                }} />
              ))}
            </div>
          )}
        </div>

        {/* ── SCREENSHOT ── */}
        <div style={{ padding: "14px 14px 14px" }}>
          <div style={{
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
            background: "#060c18",
            lineHeight: 0,
          }}>
            <img
              src={tab.images[imgIdx]}
              alt={tab.label}
              style={{
                width: "100%",
                display: "block",
                maxHeight: 320,
                objectFit: "cover",
                objectPosition: "top center",
                opacity: opacity,
                transform: `translateY(${translateY}px)`,
                transition: "opacity 0.3s ease, transform 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* ── BOTTOM CTA ── */}
        <div style={{
          padding: "0 14px 14px",
          display: "flex",
          justifyContent: "flex-end",
        }}>
          <button onClick={onCTA} style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "9px 20px",
            borderRadius: 10,
            background: "#0da2e7",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            letterSpacing: "-0.01em",
            boxShadow: "0 2px 16px rgba(13,162,231,0.45)",
            transition: "all 0.15s ease",
          }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "#0ea5e9";
              el.style.transform = "translateY(-1px)";
              el.style.boxShadow = "0 6px 24px rgba(13,162,231,0.6)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "#0da2e7";
              el.style.transform = "translateY(0)";
              el.style.boxShadow = "0 2px 16px rgba(13,162,231,0.45)";
            }}
          >
            Começar grátis →
          </button>
        </div>

      </div>
    </div>
  );
}
