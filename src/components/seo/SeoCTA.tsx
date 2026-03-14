import { useNavigate } from "react-router-dom";

interface SeoCTAProps {
  headline?: string;
  sub?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  context?: "tool" | "guide" | "compare" | "market" | "default";
}

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" };

const CTX: Record<string, { headline: string; sub: string; primaryLabel: string }> = {
  tool:    { headline: "Try it free — no setup required", sub: "Create an account and use this tool instantly. Free plan included.", primaryLabel: "Start for free" },
  guide:   { headline: "Put this into practice in 60 seconds", sub: "Upload any ad and get a hook score, creative breakdown, and fixes immediately.", primaryLabel: "Analyze your first ad" },
  compare: { headline: "See why teams switch to AdBrief", sub: "Free plan available. No credit card. Results in 60 seconds.", primaryLabel: "Try AdBrief free" },
  market:  { headline: "Built for your market", sub: "AdBrief calibrates outputs to your market, language, and audience. Free to start.", primaryLabel: "Get started free" },
  default: { headline: "Analyze your first ad free", sub: "Upload any video ad and get a hook score, creative breakdown, and improvement suggestions in 60 seconds.", primaryLabel: "Start for free" },
};

export function SeoCTA({ headline, sub, primaryLabel, primaryHref = "/signup", secondaryLabel, secondaryHref = "/features", context = "default" }: SeoCTAProps) {
  const navigate = useNavigate();
  const copy = CTX[context] || CTX.default;
  const h = headline ?? copy.headline;
  const s = sub ?? copy.sub;
  const pl = primaryLabel ?? copy.primaryLabel;

  return (
    <div style={{ margin: "80px 24px 0", borderRadius: 24, padding: "56px 40px", textAlign: "center", background: "linear-gradient(135deg,rgba(167,139,250,0.12) 0%,rgba(244,114,182,0.07) 100%)", border: "1px solid rgba(167,139,250,0.18)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(167,139,250,0.25),transparent 70%)", pointerEvents: "none" }} />
      <h2 style={{ ...j, fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12, position: "relative" }}>{h}</h2>
      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", maxWidth: 480, margin: "0 auto 28px", lineHeight: 1.6, position: "relative" }}>{s}</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", position: "relative" }}>
        <button onClick={() => navigate(primaryHref)}
          style={{ ...j, padding: "12px 28px", borderRadius: 999, fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,#a78bfa,#f472b6)", color: "#000", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
          {pl}
        </button>
        {secondaryLabel && (
          <button onClick={() => navigate(secondaryHref!)}
            style={{ ...j, padding: "12px 24px", borderRadius: 999, fontSize: 14, fontWeight: 600, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", whiteSpace: "nowrap" }}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
