import React, { useState, useEffect, useRef, useCallback } from "react";

const ITEMS = [
  {
    id: "roas",
    tab: "ROAS caiu?",
    title: "Por que meu ROAS caiu essa semana?",
    sub: "A IA identificou queda no CTR e aumento de frequência — criativo saturando, não é leilão.",
    src: "/screenshots/chat-diagnostico.png",
    w: 1647, h: 902,
  },
  {
    id: "pausar",
    tab: "O que pausar?",
    title: "2 criativos para pausar, 1 para escalar",
    sub: "A IA analisou seus 12 anúncios ativos e recomendou ações imediatas por prioridade.",
    src: "/screenshots/chat-criativos.png",
    w: 1647, h: 907,
  },
  {
    id: "hooks",
    tab: "Gera hooks",
    title: "5 hooks gerados do seu criativo vencedor",
    sub: "Cada hook com CTR estimado — urgência, prova social e curiosidade prontos para testar.",
    src: "/screenshots/chat-hooks.png",
    w: 1673, h: 908,
  },
  {
    id: "perf",
    tab: "Performance",
    title: "Dashboard completo dos seus últimos 90 dias",
    sub: "Investimento, CTR, CPC e tendências — tudo em uma visão que seu gerente de conta nunca fez.",
    src: "/screenshots/performance.png",
    w: 1673, h: 842,
  },
  {
    id: "intel",
    tab: "Inteligência",
    title: "A IA aprendeu os padrões da sua conta",
    sub: "Memórias, padrões e ações executadas — a IA evolui com cada campanha que você roda.",
    src: "/screenshots/inteligencia.png",
    w: 1673, h: 907,
  },
  {
    id: "diario",
    tab: "Diário",
    title: "Histórico completo de cada criativo",
    sub: "Veredito, taxa de acerto e retorno — o diário que transforma dados em decisões.",
    src: "/screenshots/diario.png",
    w: 1673, h: 906,
  },
] as const;

export function DemoTabs({ onCTA }: { onCTA: () => void }) {
  const [idx, setIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const item = ITEMS[idx];

  const goTo = useCallback((i: number) => {
    if (i === idx || isTransitioning) return;
    setIsTransitioning(true);
    setIdx(i);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [idx, isTransitioning]);

  // Auto-advance
  useEffect(() => {
    if (zoomed) return;
    const id = setInterval(() => goTo((idx + 1) % ITEMS.length), 5000);
    return () => clearInterval(id);
  }, [zoomed, idx, goTo]);

  // ESC to close lightbox
  useEffect(() => {
    if (!zoomed) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setZoomed(false); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [zoomed]);

  // Prevent scroll when lightbox open
  useEffect(() => {
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
            background: "rgba(0,0,0,0.95)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
            animation: "dtFadeIn 0.3s cubic-bezier(0.16,1,0.3,1)",
            cursor: "zoom-out",
            backdropFilter: "blur(20px)",
          }}
        >
          <button onClick={() => setZoomed(false)} style={{
            position: "absolute", top: 20, right: 20,
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.6)", fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
          ></button>

          <button onClick={e => { e.stopPropagation(); goTo((idx - 1 + ITEMS.length) % ITEMS.length); }} style={{
            position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)",
            width: 48, height: 48, borderRadius: "50%",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.5)", fontSize: 24, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          >‹</button>

          <div onClick={e => e.stopPropagation()} style={{
            maxWidth: "90vw", maxHeight: "85vh",
            borderRadius: 16, overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 60px 160px rgba(0,0,0,0.9), 0 0 80px rgba(14,165,233,0.1)",
            animation: "dtZoomIn 0.35s cubic-bezier(0.16,1,0.3,1)",
            cursor: "default", lineHeight: 0,
          }}>
            <img src={item.src} alt={item.tab} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
          </div>

          <button onClick={e => { e.stopPropagation(); goTo((idx + 1) % ITEMS.length); }} style={{
            position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)",
            width: 48, height: 48, borderRadius: "50%",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.5)", fontSize: 24, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          >›</button>

          <div style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", textAlign: "center", pointerEvents: "none" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>{item.title}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{item.sub}</div>
          </div>
        </div>
      )}

      {/* ── MAIN DEMO CARD ── */}
      <div ref={containerRef} className="demo-premium-wrapper" style={{ position: "relative", width: "100%", perspective: 1200 }}>

        {/* Ambient glow behind card */}
        <div className="demo-ambient-glow" />

        {/* The card with animated gradient border */}
        <div className="demo-card-outer">
          <div className="demo-card-inner">

            {/* ── TOPBAR ── */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 16px",
              background: "linear-gradient(180deg, rgba(14,165,233,0.04) 0%, transparent 100%)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Traffic lights */}
                <div style={{ display: "flex", gap: 6, marginRight: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57", boxShadow: "0 0 4px rgba(255,95,87,0.4)" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e", boxShadow: "0 0 4px rgba(255,189,46,0.4)" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840", boxShadow: "0 0 4px rgba(40,200,64,0.4)" }} />
                </div>
                <img src="/ab-avatar.png" alt="" style={{ width: 22, height: 22, borderRadius: 6 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.03em" }}>AdBrief</span>
                <span style={{
                  fontSize: 10, color: "rgba(255,255,255,0.35)",
                  padding: "2px 8px", borderRadius: 5,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  letterSpacing: "0.04em",
                }}>Meta Ads</span>
              </div>
              <div className="demo-live-badge">
                <div className="demo-live-dot" />
                <span style={{ fontSize: 10, fontWeight: 700, color: "#2ECECE", letterSpacing: "0.12em" }}>LIVE</span>
              </div>
            </div>

            {/* ── TABS ── */}
            <div className="demo-tabs-strip">
              {ITEMS.map((it, i) => {
                const on = i === idx;
                return (
                  <button key={it.id} onClick={() => goTo(i)} className={`demo-tab-btn ${on ? 'demo-tab-active' : ''}`}>
                    {it.tab}
                  </button>
                );
              })}
            </div>

            {/* ── SCREENSHOT VIEWPORT ── */}
            <div
              onClick={() => setZoomed(true)}
              className="demo-viewport"
              style={{ aspectRatio: `${item.w} / ${item.h}` }}
            >
              {ITEMS.map((it, i) => (
                <img
                  key={it.id}
                  src={it.src}
                  alt={it.tab}
                  className={`demo-screenshot ${i === idx ? 'demo-screenshot-active' : ''}`}
                />
              ))}

              {/* Bottom fade */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: "25%",
                background: "linear-gradient(0deg, #080e1e 0%, transparent 100%)",
                pointerEvents: "none", zIndex: 2,
              }} />

              {/* Zoom hint */}
              <div className="demo-zoom-hint">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>
                </svg>
                <span>ampliar</span>
              </div>
            </div>

            {/* ── INFO BAR ── */}
            <div style={{ padding: "14px 18px 10px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="demo-info-title">{item.title}</div>
              <div className="demo-info-sub">{item.sub}</div>
            </div>

            {/* ── FOOTER ── */}
            <div style={{
              padding: "10px 18px 14px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderTop: "1px solid rgba(255,255,255,0.04)",
            }}>
              {/* Progress dots */}
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {ITEMS.map((_, i) => (
                  <button key={i} onClick={() => goTo(i)} style={{
                    height: 3, borderRadius: 2, cursor: "pointer",
                    border: "none", padding: 0,
                    width: i === idx ? 24 : 5,
                    background: i === idx
                      ? "linear-gradient(90deg, #0ea5e9, #06b6d4)"
                      : "rgba(255,255,255,0.12)",
                    transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
                    boxShadow: i === idx ? "0 0 12px rgba(14,165,233,0.4)" : "none",
                  }} />
                ))}
              </div>
              <button onClick={onCTA} className="demo-cta-btn">
                Começar grátis
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
                  <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Reflection */}
        <div className="demo-reflection" />
      </div>

      <style>{`
        /* ── AMBIENT GLOW ── */
        .demo-ambient-glow {
          position: absolute;
          bottom: -80px; left: 5%; right: 5%; height: 200px;
          background: radial-gradient(ellipse 80% 100%, rgba(14,165,233,0.18) 0%, rgba(6,182,212,0.08) 40%, transparent 70%);
          filter: blur(60px);
          pointer-events: none; z-index: 0;
          animation: demoGlowPulse 4s ease-in-out infinite;
        }
        @keyframes demoGlowPulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }

        /* ── CARD OUTER (animated gradient border) ── */
        .demo-card-outer {
          position: relative; z-index: 1;
          padding: 1px;
          border-radius: 16px;
          background: conic-gradient(
            from var(--demo-border-angle, 0deg),
            rgba(14,165,233,0.5),
            rgba(6,182,212,0.2),
            rgba(99,102,241,0.15),
            rgba(14,165,233,0.05),
            rgba(6,182,212,0.2),
            rgba(14,165,233,0.5)
          );
          animation: demoBorderRotate 6s linear infinite;
          box-shadow:
            0 0 0 1px rgba(14,165,233,0.08),
            0 40px 100px -20px rgba(0,0,0,0.8),
            0 0 60px -10px rgba(14,165,233,0.12);
        }
        @property --demo-border-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes demoBorderRotate {
          to { --demo-border-angle: 360deg; }
        }

        /* ── CARD INNER ── */
        .demo-card-inner {
          background: linear-gradient(180deg, #0a1628 0%, #070e1e 40%, #060b18 100%);
          border-radius: 15px;
          overflow: hidden;
        }

        /* ── LIVE BADGE ── */
        .demo-live-badge {
          display: flex; align-items: center; gap: 6px;
          padding: 4px 10px; border-radius: 20;
          background: rgba(34,197,94,0.06);
          border: 1px solid rgba(34,197,94,0.18);
          border-radius: 20px;
        }
        .demo-live-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #22A3A3;
          box-shadow: 0 0 8px rgba(34,197,94,0.8);
          animation: demoLivePulse 2s ease-in-out infinite;
        }
        @keyframes demoLivePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(34,197,94,0.8); }
          50% { opacity: 0.5; box-shadow: 0 0 4px rgba(34,197,94,0.4); }
        }

        /* ── TABS ── */
        .demo-tabs-strip {
          display: flex; gap: 4px; padding: 8px 12px;
          background: rgba(0,0,0,0.3);
          border-bottom: 1px solid rgba(255,255,255,0.04);
          overflow-x: auto; scrollbar-width: none;
        }
        .demo-tabs-strip::-webkit-scrollbar { display: none; }

        .demo-tab-btn {
          font-size: 11.5px; font-weight: 500;
          padding: 6px 14px; border-radius: 8px;
          cursor: pointer; white-space: nowrap; flex-shrink: 0;
          background: rgba(255,255,255,0.03);
          color: rgba(255,255,255,0.32);
          border: 1px solid rgba(255,255,255,0.05);
          transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
        }
        .demo-tab-btn:hover {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.5);
        }
        .demo-tab-active {
          background: rgba(14,165,233,0.12) !important;
          color: #38bdf8 !important;
          border-color: rgba(14,165,233,0.35) !important;
          font-weight: 700 !important;
          box-shadow: 0 0 16px rgba(14,165,233,0.12), inset 0 0 12px rgba(14,165,233,0.06);
        }

        /* ── VIEWPORT ── */
        .demo-viewport {
          position: relative; width: 100%;
          background: #050a16; overflow: hidden;
          cursor: zoom-in; line-height: 0;
        }
        .demo-screenshot {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: fill; display: block;
          opacity: 0;
          transform: scale(1.02);
          filter: blur(4px);
          transition: opacity 0.5s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1), filter 0.5s ease;
        }
        .demo-screenshot-active {
          opacity: 1;
          transform: scale(1);
          filter: blur(0);
        }

        /* ── ZOOM HINT ── */
        .demo-zoom-hint {
          position: absolute; top: 12px; right: 12px; z-index: 3;
          padding: 5px 10px; border-radius: 8px;
          background: rgba(0,0,0,0.7);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 10px; color: rgba(255,255,255,0.4);
          display: flex; align-items: center; gap: 5px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s;
          backdrop-filter: blur(8px);
        }
        .demo-viewport:hover .demo-zoom-hint { opacity: 1; }

        /* ── INFO ── */
        .demo-info-title {
          font-size: 13px; font-weight: 700;
          color: #e2e8f0; letter-spacing: -0.02em;
          line-height: 1.4; margin-bottom: 5px;
          transition: all 0.3s;
        }
        .demo-info-sub {
          font-size: 11.5px; color: rgba(255,255,255,0.28);
          line-height: 1.55;
          transition: all 0.3s;
        }

        /* ── CTA BUTTON ── */
        .demo-cta-btn {
          font-size: 12px; font-weight: 700;
          padding: 9px 20px; border-radius: 10px;
          background: linear-gradient(135deg, #0ea5e9, #0891d2);
          color: #fff; border: none; cursor: pointer;
          letter-spacing: -0.01em;
          display: flex; align-items: center;
          box-shadow: 0 4px 20px rgba(14,165,233,0.35), inset 0 1px 0 rgba(255,255,255,0.1);
          transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
          white-space: nowrap;
        }
        .demo-cta-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 28px rgba(14,165,233,0.5), inset 0 1px 0 rgba(255,255,255,0.15);
          background: linear-gradient(135deg, #38bdf8, #0ea5e9);
        }

        /* ── REFLECTION ── */
        .demo-reflection {
          position: relative; z-index: 0;
          height: 80px; margin-top: -1px;
          background: linear-gradient(180deg,
            rgba(10,22,40,0.6) 0%,
            transparent 100%
          );
          border-radius: 0 0 16px 16px;
          mask-image: linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 100%);
          -webkit-mask-image: linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 100%);
          pointer-events: none;
        }

        /* ── ANIMATIONS ── */
        @keyframes dtFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dtZoomIn { from { opacity: 0; transform: scale(0.92) } to { opacity: 1; transform: scale(1) } }

        /* ── MOBILE ── */
        @media (max-width: 768px) {
          .demo-premium-wrapper { perspective: none !important; }
          .demo-ambient-glow { height: 120px !important; bottom: -40px !important; filter: blur(40px) !important; }
          .demo-card-outer { box-shadow: 0 20px 60px -10px rgba(0,0,0,0.7), 0 0 30px -5px rgba(14,165,233,0.08) !important; }
          .demo-reflection { height: 40px !important; }
          .demo-tabs-strip { padding: 6px 10px !important; gap: 3px !important; }
          .demo-tab-btn { font-size: 10.5px !important; padding: 5px 10px !important; }
          .demo-cta-btn { font-size: 11px !important; padding: 8px 16px !important; }
          .demo-info-title { font-size: 12px !important; }
          .demo-info-sub { font-size: 10.5px !important; }
        }
      `}</style>
    </>
  );
}
