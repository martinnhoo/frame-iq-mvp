import { useNavigate, Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Type, Shield, Crosshair, ArrowRight } from "lucide-react";

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
  green:      "#22c55e",
  amber:      "#f97316",
  red:        "#ef4444",
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
    hero: "Anúncios que escalam,\ncriados por IA",
    sub: "Hooks, análise competitiva e validação — treinados no que funciona no seu nicho.",
    cta: "Começar a criar",
    ctaSub: "3 dias grátis · sem cartão",
    nav_cta: "Começar grátis",
    features: [
      { title: "Gerador de Hooks", desc: "Hooks com score de engajamento previsto, baseados no que realmente performa no seu segmento." },
      { title: "Preflight Check", desc: "Valida seu anúncio antes de publicar. Pega erros de copy, CTA fraco e problemas de compliance." },
      { title: "Decodificador de concorrentes", desc: "Analisa o que seus concorrentes estão rodando e por quê funciona. Sem achismo." },
    ],
  },
  es: {
    hero: "Anuncios que escalan,\ncreados por IA",
    sub: "Hooks, análisis competitivo y validación — entrenados en lo que funciona en tu nicho.",
    cta: "Empezar a crear",
    ctaSub: "3 días gratis · sin tarjeta",
    nav_cta: "Comenzar gratis",
    features: [
      { title: "Generador de Hooks", desc: "Hooks con score de engagement previsto, basados en lo que realmente funciona en tu segmento." },
      { title: "Preflight Check", desc: "Valida tu anuncio antes de publicar. Detecta errores de copy, CTA débil y problemas de compliance." },
      { title: "Decodificador de competidores", desc: "Analiza lo que tus competidores están corriendo y por qué funciona. Sin suposiciones." },
    ],
  },
  en: {
    hero: "Ads that scale,\ncreated by AI",
    sub: "Hooks, competitive analysis and validation — trained on what works in your niche.",
    cta: "Start creating",
    ctaSub: "3 days free · no card",
    nav_cta: "Start free",
    features: [
      { title: "Hook Generator", desc: "Hooks with predicted engagement scores, based on what actually performs in your segment." },
      { title: "Preflight Check", desc: "Validates your ad before publishing. Catches copy errors, weak CTAs and compliance issues." },
      { title: "Competitor Decoder", desc: "Analyzes what your competitors are running and why it works. No guesswork." },
    ],
  },
};

const ICONS = [
  { Icon: Type,      color: C.amber },
  { Icon: Shield,    color: C.green },
  { Icon: Crosshair, color: C.red },
];

/* ══════════════════════════════════════════════════════════════════════════ */
export default function Criativo() {
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
