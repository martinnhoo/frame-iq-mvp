// ReferralNudge — shows once after first AI message to encourage sharing
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const F = "'Plus Jakarta Sans', sans-serif";
const STORAGE_KEY = "adbrief_referral_nudge_dismissed";

const texts = {
  en: { msg: "Know someone who runs ads? Share AdBrief and both get +10 free analyses!", cta: "Share now" },
  pt: { msg: "Conhece alguém que roda anúncios? Compartilhe o AdBrief e ambos ganham +10 melhorias!", cta: "Compartilhar" },
  es: { msg: "¿Conoces a alguien que hace anuncios? Comparte AdBrief y ambos obtienen +10 análisis!", cta: "Compartir" },
};

export function ReferralNudge({ messageCount }: { messageCount: number }) {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang = (language === "pt" || language === "es" ? language : "en") as keyof typeof texts;
  const tx = texts[lang];

  useEffect(() => {
    // Show after first message, only once ever
    if (messageCount === 1 && !localStorage.getItem(STORAGE_KEY)) {
      const timer = setTimeout(() => setShow(true), 2000); // delay 2s for non-intrusive feel
      return () => clearTimeout(timer);
    }
  }, [messageCount]);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    localStorage.setItem(STORAGE_KEY, "1");
  }

  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 1000,
      maxWidth: 360, padding: "14px 16px",
      background: "rgba(14,165,233,0.08)", backdropFilter: "blur(16px)",
      border: "1px solid rgba(14,165,233,0.2)", borderRadius: 12,
      animation: "nudge-in 0.3s ease", fontFamily: F,
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    }}>
      <style>{`@keyframes nudge-in { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }`}</style>
      <button onClick={dismiss} style={{
        position: "absolute", top: 8, right: 8, background: "none", border: "none",
        cursor: "pointer", padding: 4,
      }}>
        <X size={14} color="rgba(255,255,255,0.3)" />
      </button>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Gift size={18} color="#0ea5e9" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: "0 0 10px", lineHeight: 1.45 }}>{tx.msg}</p>
          <button onClick={() => { dismiss(); navigate("/dashboard/referral"); }} style={{
            padding: "6px 14px", background: "rgba(14,165,233,0.15)",
            border: "1px solid rgba(14,165,233,0.3)", borderRadius: 6,
            color: "#0ea5e9", fontSize: 12, fontWeight: 600, cursor: "pointer",
            fontFamily: F, transition: "all 0.15s",
          }}>{tx.cta}</button>
        </div>
      </div>
    </div>
  );
}
