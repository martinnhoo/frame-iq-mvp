import { useNavigate, Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { BarChart3, BookOpen, Brain, Users, ArrowRight } from "lucide-react";

/* ── Tokens ───────────────────────────────────────────────────────────── */
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";
const C = {
  bg:         "#050508",
  surface:    "rgba(255,255,255,0.025)",
  border:     "rgba(255,255,255,0.06)",
  borderHov:  "rgba(255,255,255,0.12)",
  text:       "#fff",
  textSoft:   "rgba(255,255,255,0.55)",
  textMuted:  "rgba(255,255,255,0.3)",
  accent:     "#0ea5e9",
  accentSoft: "rgba(14,165,233,0.12)",
  green:      "#34d399",
  greenSoft:  "rgba(52,211,153,0.12)",
  amber:      "#f59e0b",
  amberSoft:  "rgba(245,158,11,0.12)",
  purple:     "#a78bfa",
  purpleSoft: "rgba(167,139,250,0.12)",
};

const KF = `
@keyframes aFadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes orbFloat{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.12)}}
`;

type Lang = "pt" | "es" | "en";

const T: Record<Lang, {
  hero: string; sub: string; cta: string; ctaSub: string; nav_cta: string;
  features: { title: string; desc: string }[];
}> = {
  pt: {
    hero: "Central de comando\ndos seus anúncios",
    sub: "Dashboards, relatórios automáticos, diário de ads e alertas inteligentes. Tudo num lugar só.",
    cta: "Começar grátis",
    ctaSub: "3 dias grátis · sem cartão",
    nav_cta: "Começar grátis",
    features: [
      { title: "Dashboard em tempo real", desc: "Métricas atualizadas, KPIs e tendências numa visão unificada. Sem precisar abrir o Ads Manager." },
      { title: "Diário de Ads automático", desc: "Registro diário do que aconteceu em cada campanha — gerado pela IA, pronto pra consulta." },
      { title: "Inteligência semanal", desc: "Relatório com padrões descobertos, oportunidades escondidas e riscos antes que virem problema." },
      { title: "Múltiplas contas", desc: "Gerencie várias contas Meta com contexto dedicado. A IA aprende o nicho de cada uma." },
    ],
  },
  es: {
    hero: "Centro de comando\nde tus anuncios",
    sub: "Dashboards, reportes automáticos, diario de ads y alertas inteligentes. Todo en un solo lugar.",
    cta: "Comenzar gratis",
    ctaSub: "3 días gratis · sin tarjeta",
    nav_cta: "Comenzar gratis",
    features: [
      { title: "Dashboard en tiempo real", desc: "Métricas actualizadas, KPIs y tendencias en una vista unificada. Sin abrir el Ads Manager." },
      { title: "Diario de Ads automático", desc: "Registro diario de lo que pasó en cada campaña — generado por IA, listo para consulta." },
      { title: "Inteligencia semanal", desc: "Reporte con patrones descubiertos, oportunidades ocultas y riesgos antes de que se vuelvan problema." },
      { title: "Múltiples cuentas", desc: "Gestiona varias cuentas Meta con contexto dedicado. La IA aprende el nicho de cada una." },
    ],
  },
  en: {
    hero: "Command center\nfor your ads",
    sub: "Dashboards, automated reports, ad diary and smart alerts. Everything in one place.",
    cta: "Start free",
    ctaSub: "3 days free · no card",
    nav_cta: "Start free",
    features: [
      { title: "Real-time dashboard", desc: "Up-to-date metrics, KPIs and trends in one unified view. No more Ads Manager tab-hopping." },
      { title: "Automatic Ad Diary", desc: "Daily log of what happened in each campaign — AI-generated, ready for review." },
      { title: "Weekly intelligence", desc: "Report with discovered patterns, hidden opportunities and risks before they become problems." },
      { title: "Multiple accounts", desc: "Manage several Meta accounts with dedicated context. AI learns each account's niche." },
    ],
  },
};

const ICONS = [
  { Icon: BarChart3, bg: C.accentSoft, color: C.accent },
  { Icon: BookOpen,  bg: C.greenSoft,  color: C.green },
  { Icon: Brain,     bg: C.amberSoft,  color: C.amber },
  { Icon: Users,     bg: C.purpleSoft, color: C.purple },
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

      {/* Ambient orbs */}
      <div style={{
        position: "fixed", top: "18%", left: "48%", width: 500, height: 500,
        background: "radial-gradient(circle, rgba(14,165,233,0.05) 0%, transparent 70%)",
        transform: "translate(-50%,-50%)", pointerEvents: "none",
        animation: "orbFloat 9s ease-in-out infinite",
      }} />
      <div style={{
        position: "fixed", top: "60%", left: "60%", width: 350, height: 350,
        background: "radial-gradient(circle, rgba(167,139,250,0.04) 0%, transparent 70%)",
        transform: "translate(-50%,-50%)", pointerEvents: "none",
        animation: "orbFloat 11s ease-in-out infinite 2s",
      }} />

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        borderBottom: `1px solid ${C.border}`,
        background: "rgba(5,5,8,0.8)", backdropFilter: "blur(24px) saturate(1.4)",
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
              border: "none", cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}
          >
            {t.nav_cta}
          </button>
        </div>
      </nav>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 620, margin: "0 auto", padding: "64px 20px 100px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 56, animation: "aFadeUp 0.5s ease-out" }}>
          <h1 style={{
            fontFamily: BODY, fontWeight: 800,
            fontSize: "clamp(28px, 5.5vw, 42px)",
            letterSpacing: "-0.035em", lineHeight: 1.1,
            color: C.text, marginBottom: 16,
            whiteSpace: "pre-line",
          }}>
            {t.hero}
          </h1>
          <p style={{
            fontFamily: BODY, fontSize: 15, fontWeight: 400,
            color: C.textSoft, lineHeight: 1.6,
            maxWidth: 440, margin: "0 auto",
            letterSpacing: "-0.01em",
          }}>
            {t.sub}
          </p>
        </div>

        {/* Feature grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 14,
          marginBottom: 56,
        }}>
          {t.features.map((f, i) => {
            const ic = ICONS[i];
            return (
              <div
                key={i}
                style={{
                  padding: "24px 22px", borderRadius: 18,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  backdropFilter: "blur(8px)",
                  animation: `aFadeUp ${0.5 + i * 0.08}s ease-out`,
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.borderHov}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: ic.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 14,
                }}>
                  <ic.Icon size={17} color={ic.color} strokeWidth={2.2} />
                </div>
                <p style={{
                  fontFamily: BODY, fontSize: 14, fontWeight: 700,
                  color: C.text, marginBottom: 6, letterSpacing: "-0.02em",
                }}>
                  {f.title}
                </p>
                <p style={{
                  fontFamily: BODY, fontSize: 13, fontWeight: 400,
                  color: C.textSoft, lineHeight: 1.55,
                }}>
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", animation: "aFadeUp 0.9s ease-out" }}>
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
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(255,255,255,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
          >
            {t.cta} <ArrowRight size={15} />
          </button>
          <p style={{
            fontFamily: BODY, fontSize: 12, fontWeight: 400,
            color: C.textMuted, marginTop: 12,
          }}>
            {t.ctaSub}
          </p>
        </div>
      </div>
    </div>
  );
}
