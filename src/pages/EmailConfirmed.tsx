import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

const F = "'Plus Jakarta Sans', system-ui, sans-serif";
const BRAND = "#6366f1";
const BG = "#050508";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.07)";

type Lang = "pt" | "es" | "en";

const T: Record<Lang, {
  title: string; sub: string;
  cta_onboarding: string; cta_dashboard: string;
  footer: string;
}> = {
  pt: {
    title: "Email confirmado.",
    sub: "Tudo certo — sua conta está verificada. Agora é só continuar.",
    cta_onboarding: "Continuar configuração",
    cta_dashboard: "Ir para o dashboard",
    footer: "Você já pode fechar esta aba se preferir.",
  },
  es: {
    title: "Email confirmado.",
    sub: "Todo listo — tu cuenta está verificada. Ahora solo sigue adelante.",
    cta_onboarding: "Continuar configuración",
    cta_dashboard: "Ir al dashboard",
    footer: "Puedes cerrar esta pestaña si prefieres.",
  },
  en: {
    title: "Email confirmed.",
    sub: "All set — your account is verified. Now just keep going.",
    cta_onboarding: "Continue setup",
    cta_dashboard: "Go to dashboard",
    footer: "You can close this tab if you prefer.",
  },
};

const KF = `
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes checkDraw{from{stroke-dashoffset:24}to{stroke-dashoffset:0}}
@keyframes ringScale{from{transform:scale(0.8);opacity:0}to{transform:scale(1);opacity:1}}
`;

export default function EmailConfirmed() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = ["pt", "es"].includes(language) ? (language as Lang) : "en";
  const t = T[lang];
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  // Check if user has completed onboarding (has a profile)
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setHasProfile(false); return; }
      const { data } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", session.user.id)
        .maybeSingle();
      setHasProfile(!!data?.name);
    })();
  }, []);

  const handleContinue = () => {
    if (hasProfile) {
      navigate("/dashboard/ai");
    } else {
      navigate("/onboarding");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: BG, fontFamily: F,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden", padding: "40px 20px",
    }}>
      <style>{KF}</style>

      {/* Background glow */}
      <div style={{
        position: "fixed", top: "-20%", left: "50%", transform: "translateX(-50%)",
        width: 700, height: 500, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(99,102,241,0.07) 0%, transparent 70%)",
        filter: "blur(80px)", pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        maxWidth: 420, width: "100%", textAlign: "center",
        animation: "fadeUp 0.5s ease-out",
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 40 }}>
          <Link to="/"><Logo size="lg" /></Link>
        </div>

        {/* Success icon */}
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 28px",
          animation: "ringScale 0.4s ease-out",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" style={{
              strokeDasharray: 24, strokeDashoffset: 0,
              animation: "checkDraw 0.5s ease-out 0.2s both",
            }} />
          </svg>
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: F, fontWeight: 800,
          fontSize: 28, letterSpacing: "-0.04em",
          color: "#fff", marginBottom: 10, lineHeight: 1.15,
        }}>
          {t.title}
        </h1>

        <p style={{
          fontFamily: F, fontSize: 15, fontWeight: 400,
          color: "rgba(255,255,255,0.5)", lineHeight: 1.6,
          marginBottom: 36, maxWidth: 340, margin: "0 auto 36px",
        }}>
          {t.sub}
        </p>

        {/* CTA */}
        <button
          onClick={handleContinue}
          style={{
            fontFamily: F, fontSize: 15, fontWeight: 700,
            padding: "14px 40px", borderRadius: 12,
            background: "#fff", color: "#000",
            border: "none", cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 8,
            transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
            boxShadow: "0 0 32px rgba(255,255,255,0.06)",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 0 40px rgba(255,255,255,0.12)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 0 32px rgba(255,255,255,0.06)"; }}
        >
          {hasProfile ? t.cta_dashboard : t.cta_onboarding}
          <span style={{ fontSize: 16 }}>→</span>
        </button>

        <p style={{
          fontFamily: F, fontSize: 12, fontWeight: 400,
          color: "rgba(255,255,255,0.2)", marginTop: 24,
        }}>
          {t.footer}
        </p>
      </div>
    </div>
  );
}
