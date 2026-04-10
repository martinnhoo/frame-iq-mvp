import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";

const F = "'Plus Jakarta Sans', system-ui, sans-serif";
const BG = "#050508";

type Lang = "pt" | "es" | "en";

const T: Record<Lang, { title: string; sub: string; redirecting: string }> = {
  pt: {
    title: "Email verificado.",
    sub: "Sua conta está confirmada.",
    redirecting: "Redirecionando...",
  },
  es: {
    title: "Email verificado.",
    sub: "Tu cuenta está confirmada.",
    redirecting: "Redirigiendo...",
  },
  en: {
    title: "Email verified.",
    sub: "Your account is confirmed.",
    redirecting: "Redirecting...",
  },
};

const KF = `
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes checkDraw{from{stroke-dashoffset:24}to{stroke-dashoffset:0}}
@keyframes ringScale{from{transform:scale(0.85);opacity:0}to{transform:scale(1);opacity:1}}
`;

export default function EmailConfirmed() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = ["pt", "es"].includes(language) ? (language as Lang) : "en";
  const t = T[lang];

  // Auto-redirect to dashboard after 2.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => navigate("/dashboard/ai", { replace: true }), 2500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div style={{
      minHeight: "100vh", background: BG, fontFamily: F,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
    }}>
      <style>{KF}</style>

      <div style={{
        position: "fixed", top: "-20%", left: "50%", transform: "translateX(-50%)",
        width: 600, height: 400, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(34,197,94,0.06) 0%, transparent 70%)",
        filter: "blur(80px)", pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{
        position: "relative", zIndex: 1, textAlign: "center",
        animation: "fadeUp 0.45s ease-out",
      }}>
        {/* Checkmark */}
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px",
          animation: "ringScale 0.35s ease-out",
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" style={{ strokeDasharray: 24, strokeDashoffset: 0, animation: "checkDraw 0.4s ease-out 0.15s both" }} />
          </svg>
        </div>

        <h1 style={{
          fontFamily: F, fontWeight: 800, fontSize: 24,
          letterSpacing: "-0.035em", color: "#fff",
          marginBottom: 6,
        }}>
          {t.title}
        </h1>

        <p style={{
          fontFamily: F, fontSize: 14, fontWeight: 400,
          color: "rgba(255,255,255,0.4)", marginBottom: 28,
        }}>
          {t.sub}
        </p>

        <p style={{
          fontFamily: F, fontSize: 12, fontWeight: 500,
          color: "rgba(255,255,255,0.2)",
        }}>
          {t.redirecting}
        </p>
      </div>
    </div>
  );
}
