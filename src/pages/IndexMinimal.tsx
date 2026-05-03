// IndexMinimal — Landing page enxuta.
//
// Estratégia (Martinho, 2026-05-03):
//   • Filtro de qualidade vem do targeting do Meta Ads, não da LP. Quem
//     clica no anúncio JÁ é gestor de tráfego — LP não precisa "explicar
//     o produto" pra esse público. Atrito zero, conversão maior.
//   • Sem pricing visível. Pricing é objeção. User entra free, usa, sente
//     valor. Quando os créditos do free acabam, o capExceededResponse já
//     orienta upgrade — conversão pós-valor é 3-5× melhor que pré-valor.
//   • A página é só: fundo vivo + tagline + 1 botão. Nada mais a clicar.
//
// SEO — a página é minimalista visualmente mas tem meta tags ricas via
// react-helmet-async pra rankear "gestor de tráfego", "meta ads ai", etc.
// Conteúdo profundo de SEO ainda existe em /sobre, /features, /seo/* —
// essas continuam respondendo busca orgânica.
//
// Eventos:
//   • PageView dispara automaticamente (PostHog + Meta Pixel via index.html)
//   • Click no CTA → trackEvent("lp_cta_signup_click") + navega /signup
//   • Signup completo → fireMetaPixelSignup() já existe em /signup
//
// Voltar pra LP antiga: trocar o re-export em src/pages/Index.tsx
// (mantemos IndexNew.tsx no repo como fallback / fonte pra extrair
// seções pra LPs alternativas no futuro).

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useLanguage } from "@/i18n/LanguageContext";
import { Logo } from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { trackEvent } from "@/lib/posthog";

const COPY = {
  pt: {
    headline: "A nova era da gestão de tráfego.",
    sub: "AI sênior embutida na sua conta Meta Ads. Diagnostica, decide e age — sem dashboard, sem ruído.",
    cta: "Começar agora",
    secondary: "Já tem conta? Entrar",
    metaTitle: "AdBrief — A nova era da gestão de tráfego",
    metaDesc: "Inteligência artificial sênior para gestores de tráfego em Meta Ads. Diagnóstico de conta em tempo real, decisões executáveis, criativo gerado a partir do que funciona na sua conta.",
  },
  en: {
    headline: "The new era of media buying.",
    sub: "Senior AI embedded in your Meta Ads account. Diagnoses, decides and acts — no dashboard, no noise.",
    cta: "Start now",
    secondary: "Already have an account? Log in",
    metaTitle: "AdBrief — The new era of media buying",
    metaDesc: "Senior AI for Meta Ads media buyers. Real-time account diagnostic, actionable decisions, creatives generated from what works in your account.",
  },
  es: {
    headline: "La nueva era de la gestión de tráfico.",
    sub: "IA senior integrada en tu cuenta Meta Ads. Diagnostica, decide y actúa — sin dashboard, sin ruido.",
    cta: "Empezar ahora",
    secondary: "¿Ya tienes cuenta? Entrar",
    metaTitle: "AdBrief — La nueva era de la gestión de tráfico",
    metaDesc: "IA senior para media buyers de Meta Ads. Diagnóstico de cuenta en tiempo real, decisiones accionables, creativos generados a partir de lo que funciona.",
  },
};

export default function IndexMinimal() {
  const { language } = useLanguage();
  const lang = (["pt", "en", "es"] as const).includes(language as "pt" | "en" | "es") ? (language as "pt" | "en" | "es") : "en";
  const t = COPY[lang];

  // Track entry to LP. PostHog SDK in lib/posthog handles dedup, so calling
  // here doesn't double-fire if a previous PageView already happened.
  useEffect(() => {
    try { trackEvent("lp_minimal_view", { lang }); } catch { /* no-op */ }
  }, [lang]);

  const onCtaClick = () => {
    try { trackEvent("lp_cta_signup_click", { lang, source: "lp_minimal" }); } catch { /* no-op */ }
  };

  return (
    <>
      <Helmet>
        <title>{t.metaTitle}</title>
        <meta name="description" content={t.metaDesc} />
        <meta property="og:title" content={t.metaTitle} />
        <meta property="og:description" content={t.metaDesc} />
        <meta property="og:url" content="https://adbrief.pro/" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={t.metaTitle} />
        <meta name="twitter:description" content={t.metaDesc} />
        <link rel="canonical" href="https://adbrief.pro/" />
      </Helmet>

      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8 sm:py-4 relative overflow-hidden">
        {/* ── Animated orbs (mesmo padrão do Signup pra continuidade visual) ── */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, hsla(199, 83%, 58%, 0.14) 0%, transparent 60%)", filter: "blur(80px)", animation: "lpOrbDrift1 22s ease-in-out infinite" }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, hsla(320, 80%, 60%, 0.12) 0%, transparent 60%)", filter: "blur(80px)", animation: "lpOrbDrift2 28s ease-in-out infinite" }}
        />
        <div
          className="absolute w-[350px] h-[350px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, hsla(180, 70%, 50%, 0.06) 0%, transparent 60%)", filter: "blur(60px)", animation: "lpOrbDrift3 18s ease-in-out infinite" }}
        />

        {/* ── Subtle grid (purple lines, low opacity — copy do signup) ── */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(139, 92, 246, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* ── Floating particles ── */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full pointer-events-none"
            style={{
              background: i % 2 === 0 ? "rgba(139, 92, 246, 0.4)" : "rgba(236, 72, 153, 0.4)",
              left: `${15 + i * 10}%`,
              top: `${10 + (i % 3) * 30}%`,
              opacity: 0.4,
              animation: `lpParticleFloat ${12 + i * 1.3}s ease-in-out infinite`,
              animationDelay: `${i * 0.7}s`,
            }}
          />
        ))}

        {/* ── Top right: language switcher only (sem nav, sem clutter) ── */}
        <div className="absolute top-4 right-4 z-10">
          <LanguageSwitcher />
        </div>

        {/* ── Top left: logo small (so visitor knows the brand) ── */}
        <div className="absolute top-4 left-4 z-10">
          <Logo size="md" />
        </div>

        {/* ── Center: tagline + CTA ── */}
        <div className="w-full max-w-3xl relative z-10 flex flex-col items-center text-center" style={{ animation: "lpFadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          {/* Headline */}
          <h1
            style={{
              fontSize: "clamp(36px, 7vw, 72px)",
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              margin: "0 0 20px",
              maxWidth: 900,
            }}
          >
            {t.headline}
          </h1>

          {/* Subheadline — small and faded so headline + CTA dominate */}
          <p
            style={{
              fontSize: "clamp(15px, 2vw, 18px)",
              color: "rgba(255,255,255,0.55)",
              margin: "0 0 48px",
              maxWidth: 540,
              lineHeight: 1.55,
              fontWeight: 400,
            }}
          >
            {t.sub}
          </p>

          {/* CTA — single big button */}
          <Link
            to="/signup"
            onClick={onCtaClick}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "20px 56px",
              borderRadius: 16,
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "#000",
              background: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
              border: "1px solid rgba(14, 165, 233, 0.6)",
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.10) inset, 0 12px 32px rgba(14, 165, 233, 0.45), 0 0 64px rgba(14, 165, 233, 0.25)",
              cursor: "pointer",
              textDecoration: "none",
              transition: "transform 0.18s ease, box-shadow 0.18s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
              e.currentTarget.style.boxShadow =
                "0 0 0 1px rgba(255,255,255,0.15) inset, 0 16px 40px rgba(14, 165, 233, 0.55), 0 0 80px rgba(14, 165, 233, 0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow =
                "0 0 0 1px rgba(255,255,255,0.10) inset, 0 12px 32px rgba(14, 165, 233, 0.45), 0 0 64px rgba(14, 165, 233, 0.25)";
            }}
          >
            {t.cta}
            <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>→</span>
          </Link>

          {/* Secondary — small login link below */}
          <Link
            to="/login"
            style={{
              marginTop: 22,
              fontSize: 13,
              color: "rgba(255,255,255,0.40)",
              textDecoration: "none",
              transition: "color 0.15s",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.40)"; }}
          >
            {t.secondary}
          </Link>
        </div>

        {/* Hidden SEO content — visible to crawlers, not visually rendered.
            Mantém a página rankeável pra "gestor de tráfego", "meta ads AI",
            etc, sem poluir o visual. Não usa display:none (Google penaliza),
            usa sr-only pattern (visualmente invisível mas no DOM). */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden",
            clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0,
          }}
        >
          <h2>AdBrief — IA para gestores de tráfego em Meta Ads</h2>
          <p>
            AdBrief é uma plataforma de inteligência artificial para gestores
            de tráfego pago. Conecta-se à conta Meta Ads do usuário, diagnostica
            performance em tempo real, detecta fadiga criativa, identifica
            anúncios para escalar ou pausar, e gera hooks, scripts e briefs
            criativos baseados nos padrões reais de performance da conta.
            Construído com Claude Haiku 4.5. Compatível com Meta Ads (Facebook
            & Instagram), Google Ads e TikTok Ads.
          </p>
          <ul>
            <li>Diagnóstico de conta em tempo real</li>
            <li>Detecção automática de fadiga criativa</li>
            <li>Geração de hooks e scripts baseados em padrões da sua conta</li>
            <li>Análise de concorrentes (spy mode)</li>
            <li>Pré-flight de anúncio antes de subir</li>
            <li>Alertas via Telegram e email quando algo crítico acontece</li>
            <li>Sincronização automática com Meta Ads, Google Ads, TikTok Ads</li>
          </ul>
        </div>

        {/* Local keyframes — não suja CSS global */}
        <style>{`
          @keyframes lpFadeInUp {
            0% { opacity: 0; transform: translateY(24px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes lpOrbDrift1 {
            0%, 100% { transform: translate(-12%, -8%); }
            50% { transform: translate(8%, 6%); }
          }
          @keyframes lpOrbDrift2 {
            0%, 100% { transform: translate(15%, 10%); }
            50% { transform: translate(-10%, -6%); }
          }
          @keyframes lpOrbDrift3 {
            0%, 100% { transform: translate(-8%, 12%); }
            50% { transform: translate(12%, -8%); }
          }
          @keyframes lpParticleFloat {
            0%, 100% { transform: translate(0, 0); opacity: 0.3; }
            50% { transform: translate(8px, -12px); opacity: 0.6; }
          }
        `}</style>
      </div>
    </>
  );
}
// build trigger 2026-05-03T19:42:05Z
