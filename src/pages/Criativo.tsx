import { useNavigate, Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Type, Film, Crosshair, Shield, ArrowRight } from "lucide-react";

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
    sub: "Hooks, roteiros, briefs e análise competitiva — treinados no que funciona no seu nicho.",
    cta: "Começar a criar",
    ctaSub: "3 dias grátis · sem cartão",
    nav_cta: "Começar grátis",
    features: [
      { title: "Gerador de Hooks", desc: "Hooks com score de engajamento previsto, baseados no que realmente performa no seu segmento." },
      { title: "Roteirista de anúncios", desc: "Roteiros completos pra vídeo com estrutura de conversão. Prontos pra gravar ou editar." },
      { title: "Decodificador de concorrentes", desc: "Analisa o que seus concorrentes estão rodando e por quê funciona. Sem achismo." },
      { title: "Preflight Check", desc: "Valida seu anúncio antes de publicar. Pega erros de copy, CTA fraco e problemas de compliance." },
    ],
  },
  es: {
    hero: "Anuncios que escalan,\ncreados por IA",
    sub: "Hooks, guiones, briefs y análisis competitivo — entrenados en lo que funciona en tu nicho.",
    cta: "Empezar a crear",
    ctaSub: "3 días gratis · sin tarjeta",
    nav_cta: "Comenzar gratis",
    features: [
      { title: "Generador de Hooks", desc: "Hooks con score de engagement previsto, basados en lo que realmente funciona en tu segmento." },
      { title: "Guionista de anuncios", desc: "Guiones completos para video con estructura de conversión. Listos para grabar o editar." },
      { title: "Decodificador de competidores", desc: "Analiza lo que tus competidores están corriendo y por qué funciona. Sin suposiciones." },
      { title: "Preflight Check", desc: "Valida tu anuncio antes de publicar. Detecta errores de copy, CTA débil y problemas de compliance." },
    ],
  },
  en: {
    hero: "Ads that scale,\ncreated by AI",
    sub: "Hooks, scripts, briefs and competitive analysis — trained on what works in your niche.",
    cta: "Start creating",
    ctaSub: "3 days free · no card",
    nav_cta: "Start free",
    features: [
      { title: "Hook Generator", desc: "Hooks with predicted engagement scores, based on what actually performs in your segment." },
      { title: "Ad Scriptwriter", desc: "Full video scripts with conversion structure. Ready to record or edit." },
      { title: "Competitor Decoder", desc: "Analyzes what your competitors are running and why it works. No guesswork." },
      { title: "Preflight Check", desc: "Validates your ad before publishing. Catches copy errors, weak CTAs and compliance issues." },
    ],
  },
};

const ICONS = [
  { Icon: Type,      color: C.amber },
  { Icon: Film,      color: C.accent },
  { Icon: Crosshair, color: C.red },
  { Icon: Shield,    color: C.green },
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
      <div style={{ position: "relative", zIndex: 1, maxWidth: 620, margin: "0 auto", padding: "64px 20px 100px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 56, animation: "aFadeUp 0.5s ease-out" }}>
          <h1 style={{
            fontFamily: BODY, fontWeight: 800,
            fontSize: "clamp(28px, 5.5vw, 42px)",
            letterSpacing: "-0.035em", lineHeight: 1.1,
            color: C.text, marginBottom: 16, whiteSpace: "pre-line",
          }}>
            {t.hero}
          </h1>
          <p style={{
            fontFamily: BODY, fontSize: 15, fontWeight: 400,
            color: C.textSoft, lineHeight: 1.6,
            maxWidth: 420, margin: "0 auto",
          }}>
            {t.sub}
          </p>
        </div>

        {/* Feature grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 12, marginBottom: 56,
        }}>
          {t.features.map((f, i) => {
            const ic = ICONS[i];
            return (
              <div
                key={i}
                style={{
                  padding: "22px 20px", borderRadius: 14,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${ic.color}`,
                  animation: `aFadeUp ${0.5 + i * 0.08}s ease-out`,
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.borderHov}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
              >
                <ic.Icon size={18} color={ic.color} strokeWidth={1.8} style={{ marginBottom: 12 }} />
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
              padding: "14px 36px", borderRadius: 10,
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
