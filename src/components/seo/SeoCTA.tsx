import { useNavigate } from "react-router-dom";

interface SeoCTAProps {
  headline?: string;
  sub?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

const jakarta = { fontFamily: "'Plus Jakarta Sans', sans-serif" };

export function SeoCTA({
  headline = "Analyze your first ad free",
  sub = "Upload any video ad and get a hook score, creative breakdown, and improvement suggestions in 60 seconds.",
  primaryLabel = "Start for free",
  primaryHref = "/signup",
  secondaryLabel = "See how it works",
  secondaryHref = "/features",
}: SeoCTAProps) {
  const navigate = useNavigate();

  return (
    <div style={{
      margin: "80px 24px 0",
      borderRadius: 24,
      padding: "56px 40px",
      textAlign: "center",
      background: "linear-gradient(135deg,rgba(167,139,250,0.12) 0%,rgba(244,114,182,0.07) 100%)",
      border: "1px solid rgba(167,139,250,0.18)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Glow */}
      <div style={{
        position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
        width: 300, height: 300, borderRadius: "50%",
        background: "radial-gradient(circle,rgba(167,139,250,0.25),transparent 70%)",
        pointerEvents: "none",
      }} />

      <h2 style={{ ...jakarta, fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12, position: "relative" }}>
        {headline}
      </h2>
      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", maxWidth: 480, margin: "0 auto 28px", lineHeight: 1.6, position: "relative" }}>
        {sub}
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", position: "relative" }}>
        <button onClick={() => navigate(primaryHref)}
          style={{ ...jakarta, padding: "12px 28px", borderRadius: 999, fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,#a78bfa,#f472b6)", color: "#000", border: "none", cursor: "pointer" }}>
          {primaryLabel}
        </button>
        {secondaryLabel && (
          <button onClick={() => navigate(secondaryHref!)}
            style={{ ...jakarta, padding: "12px 24px", borderRadius: 999, fontSize: 14, fontWeight: 600, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
