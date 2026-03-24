import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, X } from "lucide-react";

const BRAND = "linear-gradient(135deg, #0ea5e9, #06b6d4)";
const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;

const PLANS = [
  { name: "Maker", price: "$19", desc: "/mo", features: ["1 ad account connected", "Unlimited AI chat", "3 personas or brands", "AI memory up to 20 analyses"], action: "/signup?plan=maker", highlight: false },
  { name: "Pro", price: "$49", desc: "/mo", features: ["3 ad accounts", "Unlimited AI chat", "Unlimited personas + brands", "Multi-market support", "AI memory up to 60 analyses"], action: "/signup?plan=pro", highlight: true, badge: "Most popular" },
  { name: "Studio", price: "$149", desc: "/mo", features: ["Unlimited ad accounts", "Unlimited AI chat", "Agency client workspace", "Full account memory"], action: "/signup?plan=studio", highlight: false },
];

interface PlanWallProps {
  onClose?: () => void;
  feature?: string;
}

export default function PlanWall({ onClose, feature }: PlanWallProps) {
  const navigate = useNavigate();

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {/* Backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(6,8,18,0.92)", backdropFilter: "blur(12px)" }} onClick={onClose} />

      {/* Modal */}
      <div style={{ position: "relative", width: "100%", maxWidth: 720, background: "#0a0b1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "40px 36px", boxShadow: "0 40px 100px rgba(0,0,0,0.6)" }}>
        {onClose && (
          <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={14} color="rgba(255,255,255,0.4)" />
          </button>
        )}

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ ...j, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(14,165,233,0.7)", fontWeight: 600, marginBottom: 10 }}>CHOOSE A PLAN TO CONTINUE</p>
          <h2 style={{ ...j, fontSize: "clamp(22px,3vw,32px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", marginBottom: 10, lineHeight: 1.2 }}>
            {feature ? `"${feature}" requires a plan` : "Start your free trial"}
          </h2>
          <p style={{ ...j, fontSize: 14, color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>
            Every plan includes a <strong style={{ color: "rgba(255,255,255,0.7)" }}>3-day free trial</strong>. No charge until it's over. Cancel anytime.
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, padding: "7px 14px", borderRadius: 9, background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.15)" }}>
            <span style={{ fontSize: 13 }}>💳</span>
            <span style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Card required · <strong style={{ color: "#fff" }}>No charge for 72 hours (3 days)</strong></span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {PLANS.map((plan) => (
            <div key={plan.name} style={{ padding: "22px 18px", borderRadius: 16, background: plan.highlight ? "rgba(14,165,233,0.07)" : "rgba(255,255,255,0.02)", border: `1px solid ${plan.highlight ? "rgba(14,165,233,0.28)" : "rgba(255,255,255,0.07)"}`, display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>
              {plan.badge && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: BRAND, borderRadius: 999, padding: "2px 12px" }}><span style={{ ...j, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#000", fontWeight: 700 }}>{plan.badge}</span></div>}
              <div>
                <p style={{ ...j, fontSize: 10, color: "rgba(255,255,255,0.28)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6 }}>{plan.name.toUpperCase()}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                  <span style={{ ...j, fontSize: 32, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>{plan.price}</span>
                  <span style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.28)" }}>{plan.desc}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Check size={11} color="#0ea5e9" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ ...j, fontSize: 11.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate(plan.action)}
                style={{ ...j, width: "100%", padding: "11px", borderRadius: 11, fontSize: 12, fontWeight: 700, background: plan.highlight ? BRAND : "rgba(255,255,255,0.06)", color: plan.highlight ? "#000" : "rgba(255,255,255,0.6)", border: `1px solid ${plan.highlight ? "transparent" : "rgba(255,255,255,0.08)"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                Start trial <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>

        <p style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.18)", textAlign: "center", marginTop: 20 }}>
          By starting a trial you agree to our Terms of Service. Cancel before 72 hours (3 days) and you won't be charged.
        </p>
      </div>
    </div>
  );
}
