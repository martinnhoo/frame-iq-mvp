import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const F = "'Plus Jakarta Sans', system-ui, sans-serif";
const BRAND = "#6366f1";
const BG = "#050508";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.07)";
const TEXT_MUTED = "rgba(255,255,255,0.55)";

const C = {
  bg: BG,
  surface: CARD_BG,
  border: CARD_BORDER,
  borderHov: "rgba(255,255,255,0.14)",
  text: "#fff",
  textSoft: "rgba(255,255,255,0.6)",
  textMuted: TEXT_MUTED,
  accent: BRAND,
  green: "#22A3A3",
  amber: "#f97316",
  red: "#ef4444",
};

const T: Record<string, {
  hero: string;
  subtitle: string;
  score_label: string;
  works_title: string;
  cta_text: string;
  cta_sub: string;
  signup_cta: string;
  loading: string;
  not_found: string;
}> = {
  pt: {
    hero: "Veja como está seu anúncio",
    subtitle: "Resultado da análise com IA",
    score_label: "/10",
    works_title: "O que funciona",
    cta_text: "Analisar seu anúncio também",
    cta_sub: "Grátis — sem cartão",
    signup_cta: "Começar análise",
    loading: "Carregando...",
    not_found: "Análise não encontrada",
  },
  es: {
    hero: "Ve cómo está tu anuncio",
    subtitle: "Resultado del análisis con IA",
    score_label: "/10",
    works_title: "Lo que funciona",
    cta_text: "Analiza tu anuncio también",
    cta_sub: "Gratis — sin tarjeta",
    signup_cta: "Comenzar análisis",
    loading: "Cargando...",
    not_found: "Análisis no encontrado",
  },
  en: {
    hero: "See how your ad scored",
    subtitle: "AI analysis result",
    score_label: "/10",
    works_title: "What works",
    cta_text: "Analyze your ad too",
    cta_sub: "Free — no card required",
    signup_cta: "Analyze your ad",
    loading: "Loading...",
    not_found: "Analysis not found",
  },
};

interface SharedAnalysis {
  score: number;
  verdict: string;
  hook: string;
  lang: string;
  created_at: string;
}

const KF = `
@keyframes fadeUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
@keyframes fadeUpSlow { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
`;

const scoreColor = (s: number) => s >= 8 ? C.green : s >= 5 ? C.amber : C.red;

export default function DemoShare() {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [analysis, setAnalysis] = useState<SharedAnalysis | null>(null);

  const lang = navigator.language.startsWith("pt") ? "pt" : navigator.language.startsWith("es") ? "es" : "en";
  const t = T[lang] || T.en;

  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!shareId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        // Call the edge function with share_id as query parameter
        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
        const response = await fetch(
          `${supabaseUrl}/functions/v1/demo-share?share_id=${encodeURIComponent(shareId)}`,
          { headers: { "Accept": "application/json" } }
        );

        if (!response.ok) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const result = await response.json() as SharedAnalysis;
        setAnalysis(result);
      } catch (e) {
        console.error("[DemoShare] Error fetching analysis:", e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [shareId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{KF}</style>
        <div style={{ textAlign: "center" }}>
          <Loader2 size={32} color={C.accent} style={{ margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: C.textMuted, fontSize: 14 }}>{t.loading}</p>
        </div>
      </div>
    );
  }

  if (notFound || !analysis) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F }}>
        <style>{KF}</style>
        <nav style={{
          position: "sticky", top: 0, zIndex: 50,
          borderBottom: `1px solid ${C.border}`,
          background: "rgba(5,5,8,0.85)", backdropFilter: "blur(24px) saturate(1.4)",
          padding: "14px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <Link to="/"><Logo size="lg" /></Link>
          <LanguageSwitcher />
        </nav>

        <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
          <h1 style={{
            fontFamily: F, fontWeight: 800,
            fontSize: 32, letterSpacing: "-0.035em",
            color: C.text, marginBottom: 12,
          }}>
            {t.not_found}
          </h1>
          <p style={{ color: C.textMuted, marginBottom: 32, fontSize: 14 }}>
            The analysis you're looking for doesn't exist or has expired.
          </p>
          <button
            onClick={() => navigate("/demo")}
            style={{
              fontFamily: F, fontSize: 14, fontWeight: 700,
              padding: "12px 28px", borderRadius: 10,
              background: C.text, color: C.bg,
              border: "none", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 8,
            }}
          >
            {t.cta_text} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  const ogImageUrl = `${window.location.origin}/api/og-image?score=${analysis.score}`;
  const pageTitle = `My ad scored ${analysis.score}/10 — AdBrief`;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={analysis.verdict} />

        {/* OG Meta Tags */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={analysis.verdict} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={window.location.href} />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={analysis.verdict} />
        <meta name="twitter:image" content={ogImageUrl} />
      </Helmet>

      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F, position: "relative", overflow: "hidden" }}>
        <style>{KF}</style>

        {/* Background glow */}
        <div style={{
          position: "fixed", top: "-20%", left: "50%", transform: "translateX(-50%)",
          width: 900, height: 600, borderRadius: "50%",
          background: `radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)`,
          filter: "blur(80px)", pointerEvents: "none", zIndex: 0,
        }} />

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
              onClick={() => navigate("/demo")}
              style={{
                fontFamily: F, fontSize: 13, fontWeight: 700,
                padding: "9px 20px", borderRadius: 10,
                background: C.text, color: C.bg,
                border: "none", cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}
            >
              {t.signup_cta}
            </button>
          </div>
        </nav>

        {/* Main content */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto", padding: "48px 20px 80px" }}>
          {/* Hero */}
          <div style={{ textAlign: "center", marginBottom: 40, animation: "fadeUp 0.4s ease-out" }}>
            <h1 style={{
              fontFamily: F, fontWeight: 800,
              fontSize: "clamp(26px, 6vw, 40px)",
              letterSpacing: "-0.035em", lineHeight: 1.08,
              color: C.text, marginBottom: 8,
            }}>
              {t.hero}
            </h1>
            <p style={{
              fontFamily: F, fontSize: 15, fontWeight: 400,
              color: TEXT_MUTED, lineHeight: 1.5,
              maxWidth: 340, margin: "0 auto",
            }}>
              {t.subtitle}
            </p>
          </div>

          {/* Score card */}
          <div style={{
            display: "flex", gap: 16, alignItems: "center",
            marginBottom: 20, padding: "24px 28px",
            borderRadius: 16, background: C.surface,
            border: `1px solid ${C.border}`,
            animation: "fadeUp 0.5s ease-out",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 6 }}>
                <span style={{
                  fontFamily: F, fontSize: 48, fontWeight: 800,
                  color: scoreColor(analysis.score), letterSpacing: "-0.04em", lineHeight: 1,
                }}>
                  {analysis.score}
                </span>
                <span style={{ fontFamily: F, fontSize: 16, fontWeight: 500, color: C.textMuted }}>
                  {t.score_label}
                </span>
              </div>
              <p style={{
                fontFamily: F, fontSize: 14, fontWeight: 600,
                color: scoreColor(analysis.score),
              }}>
                {analysis.verdict}
              </p>
            </div>
          </div>

          {/* What works card */}
          <div style={{
            borderRadius: 16, padding: "20px 20px",
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderTop: `3px solid ${C.green}`,
            animation: "fadeUp 0.6s ease-out",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <CheckCircle2 size={16} color={C.green} strokeWidth={2.2} />
              <span style={{
                fontFamily: F, fontSize: 12, fontWeight: 700,
                color: C.green, letterSpacing: "0.04em", textTransform: "uppercase",
              }}>
                {t.works_title}
              </span>
            </div>
            <p style={{
              fontFamily: F, fontSize: 13, fontWeight: 400,
              color: "rgba(255,255,255,0.7)", lineHeight: 1.7,
            }}>
              {analysis.hook}
            </p>
          </div>

          {/* CTA section */}
          <div style={{
            marginTop: 28, padding: "28px 24px", borderRadius: 16,
            background: "rgba(99,102,241,0.04)",
            border: `1px solid rgba(99,102,241,0.12)`,
            textAlign: "center",
            animation: "fadeUpSlow 0.7s ease-out",
          }}>
            <h3 style={{
              fontFamily: F, fontSize: 16, fontWeight: 700,
              color: C.text, marginBottom: 8, letterSpacing: "-0.02em",
            }}>
              {t.cta_text}
            </h3>
            <p style={{
              fontFamily: F, fontSize: 13, fontWeight: 500,
              color: C.textSoft, marginBottom: 20,
            }}>
              Analyze your ads, get a score, and unlock the full analysis with actionable improvements.
            </p>

            <button
              onClick={() => navigate("/demo")}
              style={{
                fontFamily: F, fontSize: 15, fontWeight: 700,
                padding: "14px 40px", borderRadius: 12,
                background: "#fff", color: "#000",
                border: "none", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 8,
                transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
                boxShadow: "0 0 32px rgba(255,255,255,0.08)",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 0 40px rgba(255,255,255,0.15)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "0 0 32px rgba(255,255,255,0.08)";
              }}
            >
              {t.signup_cta} <ArrowRight size={15} />
            </button>
            <p style={{ fontFamily: F, fontSize: 11, fontWeight: 400, color: C.textMuted, marginTop: 10 }}>
              {t.cta_sub}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
