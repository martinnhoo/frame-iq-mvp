import { useNavigate, Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { BarChart3, BookOpen, Users, ArrowRight } from "lucide-react";

/* ── Tokens ───────────────────────────────────────────────────────────── */
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";
const C = {
  bg:         "#050508",
  surface:    "rgba(255,255,255,0.03)",
  border:     "rgba(255,255,255,0.07)",
  borderHov:  "rgba(255,255,255,0.14)",
  text:       "#fff",
  textSoft:   "rgba(255,255,255,0.6)",
  textMuted:  "rgba(255,255,255,0.32)",
  accent:     "#6366f1",
  green:      "#22A3A3",
  purple:     "#a855f7",
};

const KF = `
@keyframes aFadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
`;

type Lang = "pt" | "es" | "en";

const T: Record<Lang, {
  hero: string; sub: string; cta: string; ctaSub: string; nav_cta: string;
  features: { title: string; desc: string }[];
}> = {
  pt: {
    hero: "Central de comando\ndos seus anúncios",
    sub: "Veja tudo num lugar só. Sem alternar entre abas do Ads Manager.",
    cta: "Começar grátis",
    ctaSub: "3 dias grátis · sem cartão",
    nav_cta: "Começar grátis",
    features: [
      { title: "Dashboard unificado", desc: "Métricas em tempo real, KPIs e tendências numa visão única. O que importa, sem ruído." },
      { title: "Diário de Ads", desc: "Registro automático do que aconteceu em cada campanha — gerado pela IA, sincronizado diariamente." },
      { title: "Múltiplas contas", desc: "Gerencie várias contas Meta com contexto dedicado. A IA aprende o nicho de cada uma." },
    ],
  },
  es: {
    hero: "Centro de comando\nde tus anuncios",
    sub: "Mira todo en un solo lugar. Sin alternar entre pestañas del Ads Manager.",
    cta: "Comenzar gratis",
    ctaSub: "3 días gratis · sin tarjeta",
    nav_cta: "Comenzar gratis",
    features: [
      { title: "Dashboard unificado", desc: "Métricas en tiempo real, KPIs y tendencias en una vista única. Lo que importa, sin ruido." },
      { title: "Diario de Ads", desc: "Registro automático de lo que pasó en cada campaña — generado por IA, sincronizado diariamente." },
      { title: "Múltiples cuentas", desc: "Gestiona varias cuentas Meta con contexto dedicado. La IA aprende el nicho de cada una." },
    ],
  },
  en: {
    hero: "Command center\nfor your ads",
    sub: "See everything in one place. No more switching between Ads Manager tabs.",
    cta: "Start free",
    ctaSub: "3 days free · no card",
    nav_cta: "Start free",
    features: [
      { title: "Unified dashboard", desc: "Real-time metrics, KPIs and trends in one single view. What matters, without noise." },
      { title: "Ad Diary", desc: "Automatic daily log of what happened in each campaign — AI-generated, synced daily." },
      { title: "Multiple accounts", desc: "Manage several Meta accounts with dedicated context. AI learns each account's niche." },
    ],
  },
};

const ICONS = [
  { Icon: BarChart3, color: C.accent },
  { Icon: BookOpen,  color: C.green },
  { Icon: Users,     color: C.purple },
];

/* ══════════════════════════════════════════════════════════════════════════ */
export default function Gestao() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = ["pt", "es"].includes(language) ? (language as Lang) : "en";
  const t = T[lang];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: BODY, position: "relative", overflow: "hidden" }}>
      <style>{KF}</style>

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        borderBottom: `1px solid ${C.border}`,
        background: "rgba(5,5,8,0.85)", backdropFilter: "blur(24px) saturate(1.4)",
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link to="/"><Logo size="lg" /></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LanguageSwitcher />
          <button
            onClick={() => navigate("/signup")}
            style={{
              fontFamily: BODY, fontSize: 13, fontWeight: 700,
              padding: "9px 20px", borderRadius: 10,
              background: C.text, color: C.bg,
              border: "none", cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}
          >
            {t.nav_cta}
          </button>
        </div>
      </nav>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 560, margin: "0 auto", padding: "64px 20px 100px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 52, animation: "aFadeUp 0.5s ease-out" }}>
          <h1 style={{
            fontFamily: BODY, fontWeight: 800,
            fontSize: "clamp(26px, 5.5vw, 38px)",
            letterSpacing: "-0.035em", lineHeight: 1.1,
            color: C.text, marginBottom: 14, whiteSpace: "pre-line",
          }}>
            {t.hero}
          </h1>
          <p style={{
            fontFamily: BODY, fontSize: 14, fontWeight: 400,
            color: C.textSoft, lineHeight: 1.6,
            maxWidth: 380, margin: "0 auto",
          }}>
            {t.sub}
          </p>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", marginBottom: 48, animation: "aFadeUp 0.6s ease-out" }}>
          <button
            onClick={() => navigate("/signup")}
            style={{
              fontFamily: BODY, fontSize: 15, fontWeight: 700,
              padding: "14px 36px", borderRadius: 12,
              background: C.text, color: C.bg,
              border: "none", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 8,
              transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(255,255,255,0.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
          >
            {t.cta} <ArrowRight size={15} />
          </button>
          <p style={{ fontFamily: BODY, fontSize: 12, fontWeight: 400, color: C.textMuted, marginTop: 12 }}>
            {t.ctaSub}
          </p>
        </div>

        {/* Features */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {t.features.map((f, i) => {
            const ic = ICONS[i];
            return (
              <div
                key={i}
                style={{
                  padding: "20px 20px", borderRadius: 14,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${ic.color}`,
                  animation: `aFadeUp ${0.7 + i * 0.1}s ease-out`,
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.borderHov}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <ic.Icon size={16} color={ic.color} strokeWidth={1.8} />
                  <span style={{
                    fontFamily: BODY, fontSize: 14, fontWeight: 700,
                    color: C.text, letterSpacing: "-0.02em",
                  }}>
                    {f.title}
                  </span>
                </div>
                <p style={{
                  fontFamily: BODY, fontSize: 13, fontWeight: 400,
                  color: C.textSoft, lineHeight: 1.6, paddingLeft: 26,
                }}>
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
