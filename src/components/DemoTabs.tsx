import React from "react";

const ITEMS = [
  {
    id: "roas",
    tab: "ROAS caiu?",
    title: "Por que meu ROAS caiu essa semana?",
    sub: "CTR 3.87% ↓  ·  Frequência 1.8 ↑  ·  criativo saturando — não é leilão",
    src: "/screenshots/chat-diagnostico.png",
    w: 1647, h: 902,
  },
  {
    id: "pausar",
    tab: "O que pausar?",
    title: "Video_Hook_Prova01 pausar já · Reels_v3 escalar",
    sub: "CTR 1.9% · Freq 3.4 · ROAS 2.1x → libera budget pro ROAS 5.8x",
    src: "/screenshots/chat-criativos.png",
    w: 1647, h: 907,
  },
  {
    id: "hooks",
    tab: "Gera hooks",
    title: "5 hooks gerados do criativo vencedor · CTR estimado",
    sub: "Urgência 4.8–5.4%  ·  Prova Social 4.2–4.9%  ·  Curiosidade 4.0–4.6%",
    src: "/screenshots/chat-hooks.png",
    w: 1673, h: 908,
  },
  {
    id: "perf",
    tab: "Performance",
    title: "R$47.832 · CTR 3.87% · CPC R$0,42 · 2.4M impressões",
    sub: "Tendência Out → Fev · 92.4k cliques · Meta Ads · Últimos 90D",
    src: "/screenshots/performance.png",
    w: 1673, h: 842,
  },
  {
    id: "intel",
    tab: "Inteligência",
    title: "4 memórias · 7 padrões de ads · 12 ações executadas",
    sub: "ROAS cai quando freq > 2.5 — a IA aprendeu isso das suas campanhas",
    src: "/screenshots/inteligencia.png",
    w: 1673, h: 907,
  },
  {
    id: "diario",
    tab: "Diário",
    title: "87% taxa de acerto · R$198.340 retorno · ROAS 4.2x",
    sub: "7 vencedores de 12 anúncios · Reels_Hook_Urgencia_v3 · CTR 5.1%",
    src: "/screenshots/diario.png",
    w: 1673, h: 906,
  },
] as const;

export function DemoTabs({ onCTA }: { onCTA: () => void }) {
  const [idx, setIdx] = React.useState(0);
  const [zoomed, setZoomed] = React.useState(false);

  const item = ITEMS[idx];

  // Auto-avança a cada 5s, pausa quando zoomed
  React.useEffect(() => {
    if (zoomed) return;
    const id = setInterval(() => setIdx(p => (p + 1) % ITEMS.length), 5000);
    return () => clearInterval(id);
  }, [zoomed]);

  // Fecha lightbox com ESC
  React.useEffect(() => {
    if (!zoomed) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setZoomed(false); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [zoomed]);

  // Previne scroll quando lightbox aberto
  React.useEffect(() => {
    document.body.style.overflow = zoomed ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [zoomed]);

  return (
    <>
      {/* ── LIGHTBOX ── */}
      {zoomed && (
        <div
          onClick={() => setZoomed(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
            animation: "dtFadeIn 0.2s ease",
            cursor: "zoom-out",
          }}
        >
          {/* Botão fechar */}
          <button
            onClick={() => setZoomed(false)}
            style={{
              position: "absolute", top: 20, right: 20,
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff", fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
              zIndex: 1,
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.2)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"}
          >
            ✕
          </button>

          {/* Nav anterior */}
          <button
            onClick={e => { e.stopPropagation(); setIdx(p => (p - 1 + ITEMS.length) % ITEMS.length); }}
            style={{
              position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.7)", fontSize: 20, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.18)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
          >
            ‹
          </button>

          {/* Imagem expandida */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: "90vw", maxHeight: "88vh",
              borderRadius: 12, overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 40px 120px rgba(0,0,0,0.8)",
              animation: "dtZoomIn 0.25s cubic-bezier(0.16,1,0.3,1)",
              cursor: "default",
              lineHeight: 0,
            }}
          >
            <img
              src={item.src}
              alt={item.tab}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          </div>

          {/* Nav próxima */}
          <button
            onClick={e => { e.stopPropagation(); setIdx(p => (p + 1) % ITEMS.length); }}
            style={{
              position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.7)", fontSize: 20, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.18)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
          >
            ›
          </button>

          {/* Label embaixo */}
          <div style={{
            position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
            textAlign: "center", pointerEvents: "none",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{item.title}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{item.sub}</div>
          </div>
        </div>
      )}

      {/* ── CARD ── */}
      <div style={{ position: "relative" }}>
        <div style={{
          position: "absolute",
          bottom: -60, left: "5%", right: "5%", height: 140,
          background: "radial-gradient(ellipse, rgba(13,162,231,0.25) 0%, transparent 70%)",
          filter: "blur(40px)", pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{
          position: "relative", zIndex: 1,
          borderRadius: 14, overflow: "hidden",
          background: "#07101f",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 0 0 1px rgba(13,162,231,0.06), 0 40px 100px rgba(0,0,0,0.8)",
        }}>

          {/* TOPBAR */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 16px",
            background: "rgba(0,0,0,0.5)",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src="/ab-avatar.png" alt=""
                style={{ width: 24, height: 24, borderRadius: 6, display: "block" }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>AdBrief</span>
              <span style={{
                fontSize: 10.5, color: "rgba(255,255,255,0.3)",
                padding: "2px 7px", borderRadius: 5,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.09)",
              }}>Meta Ads</span>
            </div>
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
              <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>LIVE</span>
            </div>
          </div>

          {/* TABS */}
          <div style={{
            display: "flex", gap: 4, padding: "10px 12px",
            background: "rgba(0,0,0,0.2)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            overflowX: "auto" as const,
          }}>
            {ITEMS.map((it, i) => {
              const on = i === idx;
              return (
                <button key={it.id} onClick={() => setIdx(i)} style={{
                  fontSize: 11.5, fontWeight: on ? 700 : 500,
                  padding: "6px 13px", borderRadius: 8,
                  cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0,
                  background: on ? "rgba(13,162,231,0.16)" : "rgba(255,255,255,0.04)",
                  color: on ? "#38bdf8" : "rgba(255,255,255,0.38)",
                  border: on ? "1px solid rgba(13,162,231,0.42)" : "1px solid rgba(255,255,255,0.08)",
                  transition: "all 0.15s ease",
                  boxShadow: on ? "0 0 14px rgba(13,162,231,0.15)" : "none",
                }}>
                  {it.tab}
                </button>
              );
            })}
          </div>

          {/* SCREENSHOT — clicável para zoom */}
          <div
            onClick={() => setZoomed(true)}
            title="Clique para ampliar"
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: `${item.w} / ${item.h}`,
              background: "#050c1a",
              overflow: "hidden",
              lineHeight: 0,
              cursor: "zoom-in",
            }}
          >
            {ITEMS.map((it, i) => (
              <img
                key={it.id}
                src={it.src}
                alt={it.tab}
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  objectFit: "fill",
                  display: "block",
                  opacity: i === idx ? 1 : 0,
                  transition: "opacity 0.4s ease",
                }}
              />
            ))}

            {/* Gradiente inferior */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: "20%",
              background: "linear-gradient(0deg, #07101f 0%, transparent 100%)",
              pointerEvents: "none", zIndex: 2,
            }} />

            {/* Hint de zoom — aparece no hover */}
            <div style={{
              position: "absolute", top: 10, right: 10, zIndex: 3,
              padding: "4px 8px", borderRadius: 6,
              background: "rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.1)",
              fontSize: 10, color: "rgba(255,255,255,0.5)",
              pointerEvents: "none",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <span style={{ fontSize: 11 }}>⊕</span> ampliar
            </div>
          </div>

          {/* LABEL */}
          <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.02em", lineHeight: 1.4, marginBottom: 4 }}>
              {item.title}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", lineHeight: 1.5 }}>
              {item.sub}
            </div>
          </div>

          {/* FOOTER */}
          <div style={{
            padding: "10px 16px 12px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", gap: 4 }}>
              {ITEMS.map((_, i) => (
                <div key={i} onClick={() => setIdx(i)} style={{
                  height: 3, borderRadius: 2, cursor: "pointer",
                  width: i === idx ? 20 : 4,
                  background: i === idx ? "#0da2e7" : "rgba(255,255,255,0.15)",
                  transition: "width 0.35s ease, background 0.35s ease",
                }} />
              ))}
            </div>
            <button onClick={onCTA} style={{
              fontSize: 12, fontWeight: 700,
              padding: "8px 18px", borderRadius: 9,
              background: "#0da2e7", color: "#fff",
              border: "none", cursor: "pointer",
              letterSpacing: "-0.01em",
              boxShadow: "0 2px 14px rgba(13,162,231,0.45)",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap" as const,
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#0ea5e9"; el.style.boxShadow = "0 4px 22px rgba(13,162,231,0.65)"; el.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#0da2e7"; el.style.boxShadow = "0 2px 14px rgba(13,162,231,0.45)"; el.style.transform = "translateY(0)"; }}
            >
              Começar grátis →
            </button>
          </div>

        </div>
      </div>

      {/* CSS animations + mobile */}
      <style>{`
        @keyframes dtFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dtZoomIn { from { opacity: 0; transform: scale(0.94) } to { opacity: 1; transform: scale(1) } }
        @media (max-width: 768px) {
          .dt-tabs-row { flex-wrap: nowrap !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; scrollbar-width: none !important; padding-bottom: 2px !important; }
          .dt-tabs-row::-webkit-scrollbar { display: none !important; }
          .dt-footer { flex-direction: row !important; align-items: center !important; }
        }
      `}</style>
    </>
  );
}
