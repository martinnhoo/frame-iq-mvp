import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { isFree } from "@/lib/planLimits";
import { useLanguage } from "@/i18n/LanguageContext";
import { Zap, X } from "lucide-react";

interface ToolGateProps {
  children: React.ReactNode;
}

const NUDGE: Record<string, Record<string, string>> = {
  banner: {
    pt: "Plano Free — uso limitado. Faça upgrade para desbloquear todas as funcionalidades.",
    es: "Plan Free — uso limitado. Haz upgrade para desbloquear todas las funciones.",
    en: "Free plan — limited usage. Upgrade to unlock full access.",
  },
  cta: { pt: "Ver planos", es: "Ver planes", en: "View plans" },
};

/**
 * Wraps any tool page. Free users now get limited access to all tools
 * (backend enforces per-tool usage caps via plans.ts).
 * Shows a soft upgrade nudge banner for free users.
 */
export default function ToolGate({ children }: ToolGateProps) {
  const ctx = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang = ["pt", "es"].includes(language) ? language : "en";
  const [dismissed, setDismissed] = useState(false);
  const plan = ctx?.profile?.plan;

  // Profile still loading — show spinner
  if (ctx?.profile === null || ctx?.profile === undefined) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <>
      {/* Soft upgrade nudge for free users */}
      {isFree(plan) && !dismissed && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          padding: "8px 16px", margin: "0 16px 12px",
          background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.15)",
          borderRadius: 10, flexWrap: "wrap",
        }}>
          <Zap size={13} color="#0ea5e9" style={{ flexShrink: 0 }} />
          <span style={{
            fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)",
            lineHeight: 1.5, flex: 1, minWidth: 200,
          }}>
            {NUDGE.banner[lang]}
          </span>
          <button
            onClick={() => navigate("/pricing")}
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 700,
              padding: "5px 12px", borderRadius: 7,
              background: "rgba(14,165,233,0.12)", color: "#0ea5e9",
              border: "1px solid rgba(14,165,233,0.25)", cursor: "pointer",
              whiteSpace: "nowrap", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(14,165,233,0.2)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(14,165,233,0.12)"; }}
          >
            {NUDGE.cta[lang]}
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              width: 22, height: 22, borderRadius: 6,
              background: "transparent", border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <X size={12} color="rgba(255,255,255,0.25)" />
          </button>
        </div>
      )}
      {children}
    </>
  );
}
