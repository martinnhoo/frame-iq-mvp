import { useNavigate } from "react-router-dom";
import { ArrowRight, X, Zap, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BRAND = "linear-gradient(135deg, #0ea5e9, #06b6d4)";
const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;

const PRICE_IDS: Record<string, string> = {
  maker:  "price_1T9sd1Dr9So14XztT3Mqddch",
  pro:    "price_1T9sdfDr9So14XztPR3tI14Y",
  studio: "price_1T9seMDr9So14Xzt0vEJNQIX",
};

interface UpgradeWallProps {
  onClose?: () => void;
  trigger?: "chat" | "tool" | "account";
  inline?: boolean; // render inline in chat instead of modal
}

const MESSAGES = {
  chat: {
    icon: "💬",
    title: "You've used your 3 free messages.",
    sub: "Upgrade to keep the conversation going — your AI strategy partner is waiting.",
  },
  tool: {
    icon: "⚡",
    title: "This tool requires a plan.",
    sub: "Upgrade to unlock all tools — hooks, scripts, briefs, competitor analysis and more.",
  },
  account: {
    icon: "🔗",
    title: "Connect ad accounts with a paid plan.",
    sub: "Upgrade to connect Meta, TikTok or Google Ads and get AI answers from your real data.",
  },
};

const PLANS = [
  {
    name: "Maker", price: "$19", desc: "/mo",
    features: ["50 AI messages/day", "1 ad account", "All tools unlocked", "3 personas"],
    action: "/signup?plan=maker", highlight: false,
  },
  {
    name: "Pro", price: "$49", desc: "/mo",
    badge: "Most popular",
    features: ["200 AI messages/day", "3 ad accounts", "All tools unlocked", "Unlimited personas", "Multi-market"],
    action: "/signup?plan=pro", highlight: true,
  },
  {
    name: "Studio", price: "$149", desc: "/mo",
    features: ["Unlimited AI messages", "Unlimited accounts", "All tools unlocked", "Agency workspace"],
    action: "/signup?plan=studio", highlight: false,
  },
];

export default function UpgradeWall({ onClose, trigger = "chat", inline = false }: UpgradeWallProps) {
  const navigate = useNavigate();
  const msg = MESSAGES[trigger];
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handlePlan = async (planKey: string, fallbackUrl: string) => {
    // Check if user is already logged in — if so go straight to checkout
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setLoadingPlan(planKey);
      try {
        const { data, error } = await supabase.functions.invoke("create-checkout", {
          body: { price_id: PRICE_IDS[planKey] },
        });
        if (!error && data?.url) { window.location.href = data.url; return; }
      } catch {}
      setLoadingPlan(null);
    }
    navigate(fallbackUrl);
  };

  const content = (
    <div style={{ width: "100%", maxWidth: inline ? "100%" : 680, background: "#0a0b1a", border: "1px solid rgba(255,255,255,0.09)", borderRadius: inline ? 16 : 24, padding: inline ? "24px" : "36px 32px", boxShadow: inline ? "none" : "0 40px 100px rgba(0,0,0,0.6)", position: "relative" }}>
      {onClose && !inline && (
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X size={13} color="rgba(255,255,255,0.4)" />
        </button>
      )}

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{msg.icon}</div>
        <h2 style={{ ...j, fontSize: inline ? 18 : 22, fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: "-0.03em", lineHeight: 1.2 }}>{msg.title}</h2>
        <p style={{ ...j, fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, maxWidth: 420, margin: "0 auto 14px" }}>{msg.sub}</p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)" }}>
          <Zap size={12} color="#0ea5e9" />
          <span style={{ ...j, fontSize: 12, color: "#0ea5e9", fontWeight: 600 }}>1-day free trial on any plan · Cancel anytime</span>
        </div>
      </div>

      {/* Plans */}
      <div className="upgrade-wall-plans" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {PLANS.map(plan => (
          <div key={plan.name} style={{ padding: "18px 16px", borderRadius: 14, background: plan.highlight ? "rgba(14,165,233,0.07)" : "rgba(255,255,255,0.02)", border: `1px solid ${plan.highlight ? "rgba(14,165,233,0.28)" : "rgba(255,255,255,0.07)"}`, display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
            {plan.badge && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: BRAND, borderRadius: 999, padding: "2px 12px" }}><span style={{ ...j, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#000", fontWeight: 700 }}>{plan.badge}</span></div>}
            <div>
              <p style={{ ...j, fontSize: 10, color: "rgba(255,255,255,0.28)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>{plan.name.toUpperCase()}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span style={{ ...j, fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>{plan.price}</span>
                <span style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{plan.desc}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
              {plan.features.map(f => (
                <div key={f} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                  <span style={{ color: "#0ea5e9", fontSize: 11, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ ...j, fontSize: 11.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>{f}</span>
                </div>
              ))}
            </div>
            <button onClick={() => handlePlan(plan.name.toLowerCase(), plan.action)}
              disabled={loadingPlan === plan.name.toLowerCase()}
              style={{ ...j, width: "100%", padding: "11px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: plan.highlight ? BRAND : "rgba(255,255,255,0.06)", color: plan.highlight ? "#000" : "rgba(255,255,255,0.6)", border: `1px solid ${plan.highlight ? "transparent" : "rgba(255,255,255,0.09)"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, opacity: loadingPlan && loadingPlan !== plan.name.toLowerCase() ? 0.5 : 1 }}>
              {loadingPlan === plan.name.toLowerCase() ? <Loader2 size={12} className="animate-spin" /> : <>Start trial <ArrowRight size={11} /></>}
            </button>
          </div>
        ))}
      </div>

      <p style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.18)", textAlign: "center", marginTop: 14 }}>
        Card required · No charge for 24 hours · Cancel before trial ends and pay nothing
      </p>
    </div>
  );

  if (inline) return content;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }} className="sm:items-center sm:p-6">
      <div style={{ position: "absolute", inset: 0, background: "rgba(6,8,18,0.9)", backdropFilter: "blur(12px)" }} onClick={onClose} />
      <div style={{ position: "relative" }}>{content}</div>
    </div>
  );
}
