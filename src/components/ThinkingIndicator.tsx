import { useEffect, useState } from "react";

interface Props {
  lang?: "pt" | "es" | "en";
  variant?: "chat" | "tool" | "inline";
  label?: string;
}

const THINKING_STEPS: Record<string, string[]> = {
  pt: [
    "Lendo sua conta...",
    "Analisando padrões...",
    "Cruzando com histórico...",
    "Verificando dados ao vivo...",
    "Calculando...",
    "Preparando recomendação...",
    "Processando...",
  ],
  es: [
    "Leyendo tu cuenta...",
    "Analizando patrones...",
    "Cruzando con historial...",
    "Verificando datos en vivo...",
    "Calculando...",
    "Preparando recomendación...",
    "Procesando...",
  ],
  en: [
    "Reading your account...",
    "Analyzing patterns...",
    "Checking live data...",
    "Cross-referencing history...",
    "Calculating...",
    "Preparing recommendation...",
    "Processing...",
  ],
};

const F = "'Inter', sans-serif";

export function ThinkingIndicator({ lang = "pt", variant = "chat", label }: Props) {
  const [phase, setPhase] = useState(0);
  const [dot, setDot] = useState(0);
  const steps = THINKING_STEPS[lang] || THINKING_STEPS.en;

  useEffect(() => {
    const phraseTimer = setInterval(() => {
      setPhase(p => (p + 1) % steps.length);
    }, 2200);
    const dotTimer = setInterval(() => {
      setDot(d => (d + 1) % 4);
    }, 400);
    return () => { clearInterval(phraseTimer); clearInterval(dotTimer); };
  }, [steps.length]);

  const dots = ".".repeat(dot);
  const text = label || steps[phase];

  if (variant === "inline") {
    return (
      <span style={{ fontFamily: F, fontSize: 12, color: "rgba(238,240,246,0.45)", display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#0ea5e9", animation: "thinkPulse 1s ease-in-out infinite" }} />
        {text}{dots}
        <style>{`@keyframes thinkPulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.1)} }`}</style>
      </span>
    );
  }

  if (variant === "tool") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 14, background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.12)", marginBottom: 16 }}>
        <div style={{ position: "relative", width: 20, height: 20, flexShrink: 0 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(14,165,233,0.2)", borderTopColor: "#0ea5e9", animation: "thinkSpin 0.8s linear infinite" }} />
        </div>
        <span style={{ fontFamily: F, fontSize: 13, color: "rgba(238,240,246,0.65)", fontWeight: 500 }}>{text}{dots}</span>
        <style>{`@keyframes thinkSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // chat variant — appears in message stream
  return (
    <div style={{ maxWidth: 680, margin: "0 auto 14px", display: "flex", gap: 10, alignItems: "center" }}>
      {/* AI avatar */}
      <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, rgba(14,165,233,0.25), rgba(99,102,241,0.15))", border: "1px solid rgba(14,165,233,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#0ea5e9" opacity="0.9"/>
        </svg>
      </div>
      {/* Thinking text + animated dots */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 14px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <span style={{ fontFamily: F, fontSize: 12, fontWeight: 500, color: "rgba(238,240,246,0.50)", letterSpacing: "0.01em" }}>
          {text}
        </span>
        <span style={{ display: "inline-flex", gap: 3, marginLeft: 2 }}>
          {[0,1,2].map(i => (
            <span key={i} style={{
              width: 4, height: 4, borderRadius: "50%", background: "#0ea5e9",
              display: "inline-block",
              animation: `thinkBounce 1.2s ease-in-out ${i * 0.18}s infinite`,
              opacity: 0.7,
            }} />
          ))}
        </span>
      </div>
      <style>{`
        @keyframes thinkBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
