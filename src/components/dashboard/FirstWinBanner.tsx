import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Plug, ArrowRight, X, Sparkles, BarChart3, MessageSquare } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { storage } from "@/lib/storage";

const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";
const STORAGE_KEY = "adbrief_first_win_dismissed";

const C = {
  accent: "#0da2e7",
  green: "#22A3A3",
  amber: "#f97316",
  text: "#fff",
  textSoft: "rgba(255,255,255,0.6)",
  textMuted: "rgba(255,255,255,0.32)",
  border: "rgba(255,255,255,0.07)",
  surface: "rgba(255,255,255,0.03)",
};

type Lang = "pt" | "es" | "en";

const T: Record<Lang, {
  welcome: string;
  sub: string;
  action1_title: string; action1_sub: string;
  action2_title: string; action2_sub: string;
  action3_title: string; action3_sub: string;
}> = {
  pt: {
    welcome: "Sua conta está pronta",
    sub: "Escolha por onde começar — cada ação deixa a IA mais inteligente sobre o seu negócio.",
    action1_title: "Analise seu primeiro anúncio",
    action1_sub: "Upload de imagem ou vídeo para receber score + melhorias",
    action2_title: "Conecte sua conta Meta Ads",
    action2_sub: "A IA lê seus dados reais para dar recomendações precisas",
    action3_title: "Pergunte algo à IA",
    action3_sub: "Ex: \"Qual criativo devo testar primeiro?\"",
  },
  es: {
    welcome: "Tu cuenta está lista",
    sub: "Elige por dónde empezar — cada acción hace la IA más inteligente sobre tu negocio.",
    action1_title: "Analiza tu primer anuncio",
    action1_sub: "Sube una imagen o video para recibir score + mejoras",
    action2_title: "Conecta tu cuenta Meta Ads",
    action2_sub: "La IA lee tus datos reales para dar recomendaciones precisas",
    action3_title: "Pregúntale algo a la IA",
    action3_sub: "Ej: \"¿Qué creativo debo probar primero?\"",
  },
  en: {
    welcome: "Your account is ready",
    sub: "Choose where to start — each action makes the AI smarter about your business.",
    action1_title: "Analyze your first ad",
    action1_sub: "Upload an image or video to get score + improvements",
    action2_title: "Connect your Meta Ads account",
    action2_sub: "AI reads your real data for precise recommendations",
    action3_title: "Ask the AI something",
    action3_sub: "E.g. \"Which creative should I test first?\"",
  },
};

interface FirstWinBannerProps {
  userName?: string;
  hasAdAccount?: boolean;
}

export default function FirstWinBanner({ userName, hasAdAccount }: FirstWinBannerProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = ["pt", "es"].includes(language) ? (language as Lang) : "en";
  const t = T[lang];

  const [dismissed, setDismissed] = useState(() => {
    try { return storage.get(STORAGE_KEY) === "1"; } catch { return false; }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try { storage.set(STORAGE_KEY, "1"); } catch {}
    setDismissed(true);
  };

  const actions = [
    {
      icon: Upload,
      color: C.amber,
      title: t.action1_title,
      sub: t.action1_sub,
      onClick: () => { dismiss(); navigate("/dashboard/analysis"); },
    },
    ...(!hasAdAccount ? [{
      icon: Plug,
      color: C.accent,
      title: t.action2_title,
      sub: t.action2_sub,
      onClick: () => { dismiss(); navigate("/dashboard/accounts"); },
    }] : []),
    {
      icon: MessageSquare,
      color: C.green,
      title: t.action3_title,
      sub: t.action3_sub,
      onClick: () => { dismiss(); },  // Already on /dashboard/ai
    },
  ];

  return (
    <div style={{
      borderRadius: 16,
      padding: "24px",
      background: C.surface,
      border: `1px solid ${C.border}`,
      marginBottom: 20,
      position: "relative",
      animation: "firstWinIn 0.4s ease-out",
    }}>
      <style>{`@keyframes firstWinIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Dismiss */}
      <button onClick={dismiss} style={{
        position: "absolute", top: 14, right: 14,
        background: "none", border: "none", cursor: "pointer",
        color: C.textMuted, padding: 4, borderRadius: 6,
        transition: "color 0.15s",
      }}
        onMouseEnter={e => e.currentTarget.style.color = C.textSoft}
        onMouseLeave={e => e.currentTarget.style.color = C.textMuted}
      >
        <X size={16} />
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <Sparkles size={18} color="#0da2e7" strokeWidth={2} />
        <span style={{
          fontFamily: BODY, fontSize: 18, fontWeight: 800,
          color: C.text, letterSpacing: "-0.03em",
        }}>
          {userName ? `${t.welcome}, ${userName}` : t.welcome}
        </span>
      </div>
      <p style={{
        fontFamily: BODY, fontSize: 13, fontWeight: 400,
        color: "rgba(255,255,255,0.40)", marginBottom: 20, lineHeight: 1.55,
        maxWidth: 420,
      }}>
        {t.sub}
      </p>

      {/* Action cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={action.onClick}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "14px 16px", borderRadius: 12,
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${C.border}`,
              cursor: "pointer", textAlign: "left",
              transition: "all 0.15s",
              width: "100%",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.02)";
              e.currentTarget.style.borderColor = C.border;
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              border: `1px solid ${action.color}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <action.icon size={18} color={action.color} strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: BODY, fontSize: 13, fontWeight: 600,
                color: C.text, marginBottom: 2,
              }}>
                {action.title}
              </p>
              <p style={{
                fontFamily: BODY, fontSize: 11, fontWeight: 400,
                color: C.textMuted,
              }}>
                {action.sub}
              </p>
            </div>
            <ArrowRight size={14} color={C.textMuted} style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}
