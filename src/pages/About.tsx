// About.tsx — minimal, direct. Story, principles, CTA.
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Target, Zap, Eye, Heart } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

type Lang = "en" | "pt" | "es";

const F = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const BG = "#070d1a";
const SURFACE = "#0d1117";
const ACCENT = "#0ea5e9";
const TEXT = "#f0f2f8";
const TEXT2 = "rgba(255,255,255,0.55)";
const TEXT3 = "rgba(255,255,255,0.35)";
const BORDER = "rgba(255,255,255,0.08)";
const EASE = "cubic-bezier(0.16,1,0.3,1)";

const T: Record<Lang, {
  nav_signin: string;
  hero_eyebrow: string;
  hero_title: string;
  hero_sub: string;
  story_title: string;
  story_paragraphs: string[];
  principles_title: string;
  principles: { icon: React.ReactNode; title: string; body: string }[];
  product_title: string;
  product_body: string;
  cta_title: string;
  cta_sub: string;
  cta_btn: string;
  cta_secondary: string;
}> = {
  pt: {
    nav_signin: "Entrar",
    hero_eyebrow: "Sobre",
    hero_title: "Construímos o gestor de tráfego que gostaríamos de contratar.",
    hero_sub: "AdBrief nasceu de uma frustração: gastar dinheiro em anúncios sem saber exatamente onde o dinheiro tá indo, e ver relatórios bonitos que não viram decisão.",
    story_title: "Por que existimos",
    story_paragraphs: [
      "Agências cobram mensalidade por relatórios que todo mundo consegue gerar em 10 minutos. Ferramentas de analytics mostram o que aconteceu. Nenhuma delas resolve o próximo passo.",
      "A gente achou que a IA deveria fazer o trabalho bruto — ler milhares de linhas de dados, identificar o padrão que importa, escrever a decisão — e deixar o humano fazer o que humano faz melhor: aprovar, ajustar, executar.",
      "Não queremos ser mais um dashboard. Queremos ser a camada de decisão entre seus dados e sua conta de anúncio.",
    ],
    principles_title: "No que acreditamos",
    principles: [
      {
        icon: <Target size={18} />,
        title: "Ação vale mais que análise",
        body: "Um insight que você não aplica é um insight morto. Toda decisão que a gente mostra tem um botão que resolve.",
      },
      {
        icon: <Eye size={18} />,
        title: "Honestidade sobre incerteza",
        body: "Quando a IA não tem dados suficientes, ela diz. Não inventamos números, não mascaramos confiança, não fingimos saber.",
      },
      {
        icon: <Zap size={18} />,
        title: "Velocidade é feature",
        body: "Decisão boa que chega tarde é decisão ruim. Tudo aqui é otimizado pra você agir em segundos, não em reuniões.",
      },
      {
        icon: <Heart size={18} />,
        title: "O usuário é dono dos dados",
        body: "Você pode exportar tudo, apagar tudo, sair quando quiser. Sem lock-in, sem contrato de 12 meses.",
      },
    ],
    product_title: "O que estamos construindo",
    product_body: "Uma IA que olha sua conta do Meta Ads todo dia, detecta o que está errado e o que tem potencial, e te entrega a próxima decisão num card. Sem relatório de 40 páginas. Sem dashboard pra interpretar. Só: \"isso aqui tá ruim, aplica essa mudança, vai funcionar\".",
    cta_title: "Teste você mesmo",
    cta_sub: "3 dias grátis, sem cartão.",
    cta_btn: "Criar conta",
    cta_secondary: "Ver planos",
  },
  en: {
    nav_signin: "Sign in",
    hero_eyebrow: "About",
    hero_title: "We built the media buyer we wish we could hire.",
    hero_sub: "AdBrief started from one frustration: spending money on ads without knowing exactly where it's going, and drowning in pretty reports that never become decisions.",
    story_title: "Why we exist",
    story_paragraphs: [
      "Agencies charge monthly retainers for reports anyone can generate in ten minutes. Analytics tools show you what happened. None of them solve the next step.",
      "We thought AI should do the heavy lifting — read thousands of rows of data, find the pattern that matters, write the decision — and let humans do what humans do best: approve, adjust, execute.",
      "We don't want to be another dashboard. We want to be the decision layer between your data and your ad account.",
    ],
    principles_title: "What we believe",
    principles: [
      {
        icon: <Target size={18} />,
        title: "Action beats analysis",
        body: "An insight you don't apply is a dead insight. Every decision we surface comes with a button that solves it.",
      },
      {
        icon: <Eye size={18} />,
        title: "Honest about uncertainty",
        body: "When AI doesn't have enough data, it says so. We don't invent numbers, inflate confidence, or pretend to know.",
      },
      {
        icon: <Zap size={18} />,
        title: "Speed is a feature",
        body: "A good decision that arrives late is a bad decision. Everything here is optimized for you to act in seconds, not meetings.",
      },
      {
        icon: <Heart size={18} />,
        title: "Your data, your call",
        body: "Export everything, delete everything, leave anytime. No lock-in, no twelve-month contracts.",
      },
    ],
    product_title: "What we're building",
    product_body: "An AI that watches your Meta Ads account every day, detects what's broken and what has potential, and hands you the next decision on a card. No 40-page report. No dashboard to interpret. Just: \"this one's bad, apply this change, here's why it'll work\".",
    cta_title: "Try it yourself",
    cta_sub: "3 days free, no credit card.",
    cta_btn: "Create account",
    cta_secondary: "See pricing",
  },
  es: {
    nav_signin: "Entrar",
    hero_eyebrow: "Sobre",
    hero_title: "Construimos el media buyer que nos gustaría contratar.",
    hero_sub: "AdBrief nació de una frustración: gastar plata en anuncios sin saber exactamente a dónde va, y ver reportes bonitos que no se convierten en decisiones.",
    story_title: "Por qué existimos",
    story_paragraphs: [
      "Las agencias cobran mensualidades por reportes que cualquiera genera en diez minutos. Las herramientas de analítica muestran lo que pasó. Ninguna resuelve el siguiente paso.",
      "Pensamos que la IA debería hacer el trabajo pesado — leer miles de filas de datos, encontrar el patrón que importa, escribir la decisión — y dejar al humano hacer lo que mejor hace: aprobar, ajustar, ejecutar.",
      "No queremos ser un dashboard más. Queremos ser la capa de decisión entre tus datos y tu cuenta de anuncios.",
    ],
    principles_title: "En qué creemos",
    principles: [
      {
        icon: <Target size={18} />,
        title: "La acción vale más que el análisis",
        body: "Un insight que no aplicas es un insight muerto. Toda decisión que mostramos trae un botón que la resuelve.",
      },
      {
        icon: <Eye size={18} />,
        title: "Honestos sobre la incertidumbre",
        body: "Cuando la IA no tiene datos suficientes, lo dice. No inventamos números ni fingimos saber.",
      },
      {
        icon: <Zap size={18} />,
        title: "La velocidad es una feature",
        body: "Una buena decisión que llega tarde es mala. Todo aquí está optimizado para actuar en segundos, no en reuniones.",
      },
      {
        icon: <Heart size={18} />,
        title: "Tus datos, tu decisión",
        body: "Exportá todo, borrá todo, salí cuando quieras. Sin lock-in, sin contratos de 12 meses.",
      },
    ],
    product_title: "Lo que estamos construyendo",
    product_body: "Una IA que mira tu cuenta de Meta Ads todos los días, detecta lo que está mal y lo que tiene potencial, y te entrega la próxima decisión en una tarjeta. Sin reporte de 40 páginas. Sin dashboard para interpretar. Solo: \"esto está mal, aplicá este cambio, va a funcionar\".",
    cta_title: "Probalo vos mismo",
    cta_sub: "3 días gratis, sin tarjeta.",
    cta_btn: "Crear cuenta",
    cta_secondary: "Ver planes",
  },
};

const About = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = ["pt", "es"].includes(language) ? (language as Lang) : "en";
  const t = T[lang];

  return (
    <div style={{ fontFamily: F, background: BG, color: TEXT, minHeight: "100vh" }}>
      <style>{`
        .about-container { max-width: 920px; margin: 0 auto; padding: 0 32px; }
        .about-container-wide { max-width: 1120px; margin: 0 auto; padding: 0 32px; }
        .principles-grid {
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;
        }
        .principle-card {
          background: ${SURFACE};
          border: 1px solid ${BORDER};
          border-radius: 14px;
          padding: 24px;
          transition: border-color .3s ${EASE}, transform .3s ${EASE};
        }
        .principle-card:hover { border-color: rgba(255,255,255,0.16); }
        .icon-tile {
          width: 36px; height: 36px; border-radius: 10px;
          display: inline-flex; align-items: center; justify-content: center;
          background: rgba(14,165,233,0.12); color: ${ACCENT};
          border: 1px solid rgba(14,165,233,0.25);
        }
        .cta-btn {
          height: 44px; padding: 0 22px; border-radius: 10px;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          font-weight: 600; font-size: 14px; cursor: pointer; transition: all .2s ${EASE};
          border: 1px solid ${BORDER}; background: transparent; color: ${TEXT};
          text-decoration: none;
        }
        .cta-btn:hover { border-color: rgba(255,255,255,0.24); background: rgba(255,255,255,0.03); }
        .cta-btn.primary { background: ${ACCENT}; border-color: ${ACCENT}; color: #001018; }
        .cta-btn.primary:hover { filter: brightness(1.08); }
        @media (max-width: 720px) {
          .about-container { padding: 0 20px; }
          .about-container-wide { padding: 0 20px; }
          .principles-grid { grid-template-columns: 1fr; gap: 12px; }
        }
      `}</style>

      {/* ── Nav ────────────────────────────────────────────────── */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(7,13,26,0.80)", backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div
          className="about-container-wide"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}
        >
          <Link to="/" style={{ display: "inline-flex", alignItems: "center" }}>
            <Logo size="md" />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <LanguageSwitcher />
            <Link
              to="/signin"
              style={{
                color: TEXT2, fontSize: 14, fontWeight: 500,
                textDecoration: "none", padding: "8px 14px", borderRadius: 8,
                transition: `color .2s ${EASE}`,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = TEXT)}
              onMouseLeave={(e) => (e.currentTarget.style.color = TEXT2)}
            >
              {t.nav_signin}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="about-container" style={{ paddingTop: 96, paddingBottom: 64 }}>
        <div
          style={{
            fontSize: 12, fontWeight: 600, letterSpacing: "2px",
            color: ACCENT, textTransform: "uppercase", marginBottom: 20,
          }}
        >
          {t.hero_eyebrow}
        </div>
        <h1
          style={{
            fontSize: "clamp(34px, 4.6vw, 52px)", fontWeight: 700,
            letterSpacing: "-0.025em", margin: 0, lineHeight: 1.1,
            maxWidth: 780,
          }}
        >
          {t.hero_title}
        </h1>
        <p
          style={{
            marginTop: 24, fontSize: 18, lineHeight: 1.6, color: TEXT2,
            maxWidth: 680,
          }}
        >
          {t.hero_sub}
        </p>
      </section>

      {/* ── Story ─────────────────────────────────────────────── */}
      <section className="about-container" style={{ paddingBottom: 80 }}>
        <h2
          style={{
            fontSize: 13, fontWeight: 600, letterSpacing: "1.5px",
            color: TEXT3, textTransform: "uppercase", marginBottom: 20,
          }}
        >
          {t.story_title}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {t.story_paragraphs.map((p, i) => (
            <p
              key={i}
              style={{
                fontSize: 17, lineHeight: 1.65, color: TEXT,
                margin: 0, maxWidth: 720,
              }}
            >
              {p}
            </p>
          ))}
        </div>
      </section>

      {/* ── Principles ────────────────────────────────────────── */}
      <section className="about-container" style={{ paddingBottom: 80 }}>
        <h2
          style={{
            fontSize: 13, fontWeight: 600, letterSpacing: "1.5px",
            color: TEXT3, textTransform: "uppercase", marginBottom: 20,
          }}
        >
          {t.principles_title}
        </h2>
        <div className="principles-grid">
          {t.principles.map((p, i) => (
            <div key={i} className="principle-card">
              <div className="icon-tile">{p.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 16, letterSpacing: "-0.01em" }}>
                {p.title}
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: TEXT2, margin: "8px 0 0 0" }}>
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Product line ──────────────────────────────────────── */}
      <section className="about-container" style={{ paddingBottom: 96 }}>
        <div
          style={{
            background: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 16, padding: "32px 28px",
          }}
        >
          <h2
            style={{
              fontSize: 13, fontWeight: 600, letterSpacing: "1.5px",
              color: TEXT3, textTransform: "uppercase", margin: "0 0 14px 0",
            }}
          >
            {t.product_title}
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: TEXT, margin: 0 }}>
            {t.product_body}
          </p>
        </div>
      </section>

      {/* ── Footer CTA ────────────────────────────────────────── */}
      <section className="about-container" style={{ paddingBottom: 120, textAlign: "center" }}>
        <h3 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
          {t.cta_title}
        </h3>
        <p style={{ color: TEXT2, fontSize: 15, margin: "10px 0 28px" }}>
          {t.cta_sub}
        </p>
        <div style={{ display: "inline-flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button className="cta-btn primary" onClick={() => navigate("/signup")}>
            {t.cta_btn}
            <ArrowRight size={14} />
          </button>
          <Link to="/pricing" className="cta-btn">
            {t.cta_secondary}
          </Link>
        </div>
      </section>
    </div>
  );
};

export default About;
