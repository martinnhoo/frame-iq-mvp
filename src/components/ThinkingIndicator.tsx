import { useEffect, useState } from "react";

interface Props {
  lang?: "pt" | "es" | "en";
  variant?: "chat" | "tool" | "inline";
  /** Contextual label — adapts to what the AI is doing. REQUIRED for meaningful UX. */
  label?: string;
  /** User's last message — used to auto-generate contextual label when label is not provided */
  userMessage?: string;
}

const F = "'Plus Jakarta Sans', system-ui, sans-serif";

// ── Contextual label generator — derives a thinking label from the user's message ──
function deriveLabel(msg: string, lang: string): string {
  const m = (msg || "").toLowerCase().trim();

  // Greetings
  if (/^(oi|olá|ola|hey|hi|hello|e aí|e ai|bom dia|boa tarde|boa noite|tudo bem|td bem|salve|hola|buenos|buenas)[\s!?.,]*$/i.test(m))
    return lang === "pt" ? "Preparando..." : lang === "es" ? "Preparando..." : "Getting ready...";

  // Hooks
  if (/hook|gancho|copy|abertura|headline/.test(m))
    return lang === "pt" ? "Criando hooks de alta conversão..." : lang === "es" ? "Creando hooks de alta conversión..." : "Crafting high-converting hooks...";

  // Scripts
  if (/roteiro|script|vídeo|video|ugc|reels/.test(m))
    return lang === "pt" ? "Estruturando roteiro..." : lang === "es" ? "Estructurando guión..." : "Building your script...";

  // Briefs
  if (/brief|editor|direção|direcion|criativ/.test(m))
    return lang === "pt" ? "Montando brief criativo..." : lang === "es" ? "Montando brief creativo..." : "Building creative brief...";

  // Pause / Scale / Budget
  if (/pausa|pause|pausar/.test(m))
    return lang === "pt" ? "Identificando o que pausar..." : lang === "es" ? "Identificando qué pausar..." : "Identifying what to pause...";
  if (/escal|scale|ampliar|grow/.test(m))
    return lang === "pt" ? "Buscando winners para escalar..." : lang === "es" ? "Buscando ganadores para escalar..." : "Finding winners to scale...";
  if (/budget|orçamento|presupuesto/.test(m))
    return lang === "pt" ? "Analisando alocação de budget..." : lang === "es" ? "Analizando asignación de presupuesto..." : "Analyzing budget allocation...";

  // Performance / Metrics
  if (/roas|ctr|cpm|cpc|perform|métrica|metric|resultado|kpi/.test(m))
    return lang === "pt" ? "Analisando performance..." : lang === "es" ? "Analizando rendimiento..." : "Analyzing performance...";

  // Competitors
  if (/concorr|competitor|rival|competid/.test(m))
    return lang === "pt" ? "Decodificando concorrente..." : lang === "es" ? "Decodificando competidor..." : "Decoding competitor...";

  // Persona
  if (/persona|público|audiência|audience|target/.test(m))
    return lang === "pt" ? "Construindo persona..." : lang === "es" ? "Construyendo persona..." : "Building persona...";

  // Image / Creative analysis
  if (/analis|analyz|imagem|image|criativo|creative|anúncio|anuncio|ad\b/.test(m))
    return lang === "pt" ? "Analisando criativo..." : lang === "es" ? "Analizando creativo..." : "Analyzing creative...";

  // Trend / Why drop
  if (/trend|tendência|caiu|drop|queda|bajó/.test(m))
    return lang === "pt" ? "Investigando tendência..." : lang === "es" ? "Investigando tendencia..." : "Investigating trend...";

  // Translation
  if (/traduz|translat|traduc/.test(m))
    return lang === "pt" ? "Traduzindo..." : lang === "es" ? "Traduciendo..." : "Translating...";

  // Short messages — likely quick questions
  if (m.length < 25)
    return lang === "pt" ? "Pensando..." : lang === "es" ? "Pensando..." : "Thinking...";

  // Long/complex messages — deep analysis
  return lang === "pt" ? "Processando sua pergunta..." : lang === "es" ? "Procesando tu pregunta..." : "Processing your question...";
}

export function ThinkingIndicator({ lang = "pt", variant = "chat", label, userMessage }: Props) {
  const [dot, setDot] = useState(0);

  // Derive the thinking text: explicit label > auto-derived from userMessage > fallback
  const text = label || (userMessage ? deriveLabel(userMessage, lang) : (
    lang === "pt" ? "Pensando..." : lang === "es" ? "Pensando..." : "Thinking..."
  ));

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDot(d => (d + 1) % 4);
    }, 500);
    return () => clearInterval(dotTimer);
  }, []);

  if (variant === "inline") {
    return (
      <span style={{ fontFamily: F, fontSize: 12, color: "rgba(148,163,184,0.70)", display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#2563EB", animation: "thinkPulse 1.4s ease-in-out infinite" }} />
        {text}
        <style>{`@keyframes thinkPulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.1)} }`}</style>
      </span>
    );
  }

  if (variant === "tool") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 14, background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.14)", marginBottom: 16 }}>
        <div style={{ position: "relative", width: 20, height: 20, flexShrink: 0 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(37,99,235,0.2)", borderTopColor: "#2563EB", animation: "thinkSpin 0.8s linear infinite" }} />
        </div>
        <span style={{ fontFamily: F, fontSize: 13, color: "rgba(148,163,184,0.80)", fontWeight: 500 }}>{text}</span>
        <style>{`@keyframes thinkSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // chat variant — appears in message stream
  return (
    <div style={{ maxWidth: 680, margin: "0 auto 14px", display: "flex", gap: 10, alignItems: "center" }}>
      {/* AI avatar */}
      <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
        <img src="/ab-avatar.png" alt="AdBrief AI" width={28} height={28} style={{ objectFit: "cover", borderRadius: 7 }} />
      </div>
      {/* Thinking text + animated dots */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 14px", borderRadius: 20, background: "rgba(15,23,42,0.80)", border: "1px solid rgba(148,163,184,0.08)", backdropFilter: "blur(12px)" }}>
        <span style={{ fontFamily: F, fontSize: 12, fontWeight: 500, color: "rgba(148,163,184,0.70)", letterSpacing: "0.01em" }}>
          {text}
        </span>
        <span style={{ display: "inline-flex", gap: 3, marginLeft: 2 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              width: 4, height: 4, borderRadius: "50%", background: "#2563EB",
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
