// IndexNew.tsx — Product-led landing page (10/10 conversion refinement)
import { useNavigate } from "react-router-dom";
import { storage } from "@/lib/storage";
import { Globe, ChevronDown, ArrowRight, Check, Zap, TrendingUp, RotateCcw, Info, CheckCircle2 } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import CookieConsent from "@/components/CookieConsent";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";

// ── Design tokens ───────────────────────────────────────────────────────────
const F = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const BG = "#070d1a";
const SURFACE = "#0d1117";
const SURFACE2 = "#161B22";
const ACCENT = "#0ea5e9";
const TEXT = "#f0f2f8";
const TEXT2 = "rgba(255,255,255,0.55)";
const TEXT3 = "rgba(255,255,255,0.35)";
const BORDER = "rgba(255,255,255,0.06)";
const GREEN = "#22c55e";
const RED = "#ef4444";
const YELLOW = "#fbbf24";
const INDIGO = "#6366f1";
const EASE = "cubic-bezier(0.16,1,0.3,1)";

// ── i18n ─────────────────────────────────────────────────────────────────────
type Lang = "en" | "pt" | "es";

const TX: Record<Lang, Record<string, string>> = {
  pt: {
    nav_login: "Entrar",
    nav_signup: "Criar conta",
    // hero — tension + clarity
    hero_title: "Existe performance que\nvocê ainda não está capturando.",
    hero_sub: "Veja exatamente onde melhorar e aplique em um clique.",
    hero_cta: "Criar conta grátis",
    hero_cta_hover: "Aplicando primeira melhoria",
    hero_cta_sub: "Grátis para começar · Sem configuração",
    hero_micro_trust: "Funciona com sua conta atual (Meta Ads)",
    hero_login: "Já tem conta? Entrar",
    // trust — data-driven system feel
    trust_line: "Baseado no comportamento real das suas campanhas · Atualizado em tempo real",
    // how
    how_label: "COMO FUNCIONA",
    how_s1: "Oportunidade aparece",
    how_s1d: "IA encontra o que otimizar",
    how_s2: "Você aplica",
    how_s2d: "Um clique: pausar, escalar ou ajustar",
    how_s3: "Resultado melhora",
    how_s3d: "Performance evolui a cada ação",
    // loop
    loop_label: "CICLO DE MELHORIA",
    loop_title: "Cada melhoria gera a próxima.",
    loop_s1: "Aplica melhoria",
    loop_s2: "Nova oportunidade",
    loop_s3: "Campanha evolui",
    // pricing
    pricing_title: "Quanto você quer melhorar?",
    pricing_free: "Free",
    pricing_free_d: "Para testar",
    pricing_free_cta: "Criar conta",
    pricing_maker: "Maker",
    pricing_maker_d: "Alta capacidade",
    pricing_maker_cta: "Começar",
    pricing_pro: "Pro",
    pricing_pro_d: "Volume para escalar",
    pricing_pro_cta: "Começar com Pro",
    pricing_pro_badge: "Plano mais escolhido",
    pricing_studio: "Studio",
    pricing_studio_d: "Para quem opera em escala real",
    pricing_studio_cta: "Ir para Studio",
    pricing_unlimited: "SEM LIMITES",
    pricing_tooltip_q: "O que é uma melhoria?",
    pricing_tooltip_a: "Uma otimização aplicada na sua campanha — pausar um anúncio, escalar um criativo, ajustar orçamento.",
    pricing_mo: "/mês",
    // final — continuation, not repetition
    final_title: "Você já viu como funciona.",
    final_sub: "Aplique sua primeira melhoria agora.",
    final_cta: "Criar conta grátis",
    final_cta_sub: "Sem custo inicial",
    final_login: "Já tem conta? Entrar",
    // footer
    footer_copy: "© 2026 AdBrief",
    footer_privacy: "Privacidade",
    footer_terms: "Termos",
    // mockup
    mock_decisions: "DECISÕES",
    mock_invested: "INVESTIDO",
    mock_ctr: "CTR",
    mock_cpa: "CPA",
    mock_roas: "ROAS",
    mock_kill: "Pausar — CTR 62% abaixo da média",
    mock_kill_d: "Creative_042 · R$180/dia sem retorno",
    mock_scale: "Escalar — ROAS 4.8x estável",
    mock_scale_d: "Creative_019 · margem para +R$1.080/dia",
    mock_opp: "PRÓXIMA OPORTUNIDADE",
    mock_opp_t: "Próximo ganho: novos criativos",
    mock_opp_cta: "Gerar variação com IA",
    mock_7d: "7 dias",
    mock_pause: "Pausar anúncio",
    mock_scale_cta: "Aumentar budget",
    mock_apply: "Aplicar melhoria",
    mock_applied: "Melhoria aplicada",
    // sticky
    sticky_cta: "Aplicar melhorias agora",
    final_time: "Leva menos de 10 segundos",
    mock_progress: "1 melhoria aplicada",
  },
  en: {
    nav_login: "Log in",
    nav_signup: "Sign up",
    hero_title: "There's performance\nyou're not capturing yet.",
    hero_sub: "See exactly where to improve and apply in one click.",
    hero_cta: "Create free account",
    hero_cta_hover: "Applying first improvement",
    hero_cta_sub: "Free to start · No setup required",
    hero_micro_trust: "Works with your current account (Meta Ads)",
    hero_login: "Already have an account? Log in",
    trust_line: "Based on your real campaign behavior · Updated in real time",
    how_label: "HOW IT WORKS",
    how_s1: "Opportunity appears",
    how_s1d: "AI finds what to optimize",
    how_s2: "You apply it",
    how_s2d: "One click: pause, scale, or adjust",
    how_s3: "Results improve",
    how_s3d: "Performance evolves with each action",
    loop_label: "IMPROVEMENT CYCLE",
    loop_title: "Each improvement generates the next.",
    loop_s1: "Apply improvement",
    loop_s2: "New opportunity",
    loop_s3: "Campaign evolves",
    pricing_title: "How much do you want to improve?",
    pricing_free: "Free",
    pricing_free_d: "To try it out",
    pricing_free_cta: "Create account",
    pricing_maker: "Maker",
    pricing_maker_d: "High capacity",
    pricing_maker_cta: "Get started",
    pricing_pro: "Pro",
    pricing_pro_d: "Volume to scale",
    pricing_pro_cta: "Start with Pro",
    pricing_pro_badge: "Most chosen plan",
    pricing_studio: "Studio",
    pricing_studio_d: "For those who operate at real scale",
    pricing_studio_cta: "Go Studio",
    pricing_unlimited: "UNLIMITED",
    pricing_tooltip_q: "What is an improvement?",
    pricing_tooltip_a: "An optimization applied to your campaign — pause an ad, scale a creative, adjust budget.",
    pricing_mo: "/mo",
    final_title: "You've seen how it works.",
    final_sub: "Apply your first improvement now.",
    final_cta: "Create free account",
    final_cta_sub: "No upfront cost",
    final_login: "Already have an account? Log in",
    footer_copy: "© 2026 AdBrief",
    footer_privacy: "Privacy",
    footer_terms: "Terms",
    mock_decisions: "DECISIONS",
    mock_invested: "INVESTED",
    mock_ctr: "CTR",
    mock_cpa: "CPA",
    mock_roas: "ROAS",
    mock_kill: "Pause — CTR 62% below average",
    mock_kill_d: "Creative_042 · $52/day with no return",
    mock_scale: "Scale — ROAS 4.8x stable",
    mock_scale_d: "Creative_019 · room for +$300/day",
    mock_opp: "NEXT OPPORTUNITY",
    mock_opp_t: "Next gain: new creatives",
    mock_opp_cta: "Generate variation with AI",
    mock_7d: "7 days",
    mock_pause: "Pause ad",
    mock_scale_cta: "Increase budget",
    mock_apply: "Apply improvement",
    mock_applied: "Improvement applied",
    sticky_cta: "Apply improvements now",
    final_time: "Takes less than 10 seconds",
    mock_progress: "1 improvement applied",
  },
  es: {
    nav_login: "Iniciar sesión",
    nav_signup: "Crear cuenta",
    hero_title: "Hay performance que\naún no estás capturando.",
    hero_sub: "Ve exactamente dónde mejorar y aplícalo en un clic.",
    hero_cta: "Crear cuenta gratis",
    hero_cta_hover: "Aplicando primera mejora",
    hero_cta_sub: "Gratis para empezar · Sin configuración",
    hero_micro_trust: "Funciona con tu cuenta actual (Meta Ads)",
    hero_login: "¿Ya tienes cuenta? Entrar",
    trust_line: "Basado en el comportamiento real de tus campañas · Actualizado en tiempo real",
    how_label: "CÓMO FUNCIONA",
    how_s1: "Aparece oportunidad",
    how_s1d: "IA encuentra qué optimizar",
    how_s2: "La aplicas",
    how_s2d: "Un clic: pausar, escalar o ajustar",
    how_s3: "Resultado mejora",
    how_s3d: "Rendimiento evoluciona con cada acción",
    loop_label: "CICLO DE MEJORA",
    loop_title: "Cada mejora genera la siguiente.",
    loop_s1: "Aplica mejora",
    loop_s2: "Nueva oportunidad",
    loop_s3: "Campaña evoluciona",
    pricing_title: "¿Cuánto quieres mejorar?",
    pricing_free: "Free",
    pricing_free_d: "Para probar",
    pricing_free_cta: "Crear cuenta",
    pricing_maker: "Maker",
    pricing_maker_d: "Alta capacidad",
    pricing_maker_cta: "Empezar",
    pricing_pro: "Pro",
    pricing_pro_d: "Volumen para escalar",
    pricing_pro_cta: "Empezar con Pro",
    pricing_pro_badge: "Plan más elegido",
    pricing_studio: "Studio",
    pricing_studio_d: "Para quien opera a escala real",
    pricing_studio_cta: "Ir a Studio",
    pricing_unlimited: "SIN LÍMITES",
    pricing_tooltip_q: "¿Qué es una mejora?",
    pricing_tooltip_a: "Una optimización aplicada a tu campaña — pausar un anuncio, escalar un creativo, ajustar presupuesto.",
    pricing_mo: "/mes",
    final_title: "Ya viste cómo funciona.",
    final_sub: "Aplica tu primera mejora ahora.",
    final_cta: "Crear cuenta gratis",
    final_cta_sub: "Sin costo inicial",
    final_login: "¿Ya tienes cuenta? Entrar",
    footer_copy: "© 2026 AdBrief",
    footer_privacy: "Privacidad",
    footer_terms: "Términos",
    mock_decisions: "DECISIONES",
    mock_invested: "INVERTIDO",
    mock_ctr: "CTR",
    mock_cpa: "CPA",
    mock_roas: "ROAS",
    mock_kill: "Pausar — CTR 62% bajo el promedio",
    mock_kill_d: "Creative_042 · $52/día sin retorno",
    mock_scale: "Escalar — ROAS 4.8x estable",
    mock_scale_d: "Creative_019 · margen para +$300/día",
    mock_opp: "PRÓXIMA OPORTUNIDAD",
    mock_opp_t: "Próxima ganancia: nuevos creativos",
    mock_opp_cta: "Generar variación con IA",
    mock_7d: "7 días",
    mock_pause: "Pausar anuncio",
    mock_scale_cta: "Aumentar presupuesto",
    mock_apply: "Aplicar mejora",
    mock_applied: "Mejora aplicada",
    sticky_cta: "Aplicar mejoras ahora",
    final_time: "Toma menos de 10 segundos",
    mock_progress: "1 mejora aplicada",
  },
};

// ── Language detection ────────────────────────────────────────────────────────
async function detectLang(): Promise<Lang> {
  const stored = storage.get("adbrief_language") as Lang | null;
  if (stored && ["en", "pt", "es"].includes(stored)) return stored;
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    const c = data.country_code as string;
    if (["BR","PT","AO","MZ","CV","GW","ST","TL"].includes(c)) return "pt";
    if (["MX","AR","CO","CL","PE","VE","EC","GT","CU","BO","DO","HN","PY","SV","NI","CR","PA","UY","GQ","ES"].includes(c)) return "es";
    return "en";
  } catch {
    const bl = navigator.language.slice(0, 2).toLowerCase();
    if (bl === "pt") return "pt";
    if (bl === "es") return "es";
    return "en";
  }
}

// ── Language switcher ────────────────────────────────────────────────────────
function LangSwitcher({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  const pick = (l: Lang) => { setLang(l); storage.set("adbrief_language", l); setOpen(false); };
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500,
        padding: "4px 8px", borderRadius: 6, background: "transparent",
        border: "none", color: TEXT3, cursor: "pointer", fontFamily: F,
        transition: `all 0.2s ${EASE}`,
      }}
        onMouseEnter={e => { e.currentTarget.style.color = TEXT2; }}
        onMouseLeave={e => { e.currentTarget.style.color = TEXT3; }}
      >
        <Globe size={11} strokeWidth={1.6} /> {lang.toUpperCase()}
        <ChevronDown size={9} style={{ transition: `transform 0.2s ${EASE}`, transform: open ? "rotate(180deg)" : "none", opacity: 0.5 }} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0,
            background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8,
            overflow: "hidden", zIndex: 999, minWidth: 80,
            boxShadow: "0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
            padding: 3,
          }}>
            {(["en", "pt", "es"] as Lang[]).map(l => (
              <button key={l} onClick={() => pick(l)} style={{
                width: "100%", padding: "6px 10px", display: "flex", alignItems: "center", gap: 6,
                background: lang === l ? "rgba(14,165,233,0.06)" : "transparent", border: "none", borderRadius: 5,
                color: lang === l ? ACCENT : TEXT3, fontSize: 11, fontWeight: lang === l ? 600 : 400,
                cursor: "pointer", fontFamily: F, transition: `all 0.15s ${EASE}`,
              }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ t, lang, setLang }: { t: Record<string, string>; lang: Lang; setLang: (l: Lang) => void }) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? "rgba(7,13,26,0.88)" : "transparent",
      backdropFilter: scrolled ? "blur(20px) saturate(1.4)" : "none",
      WebkitBackdropFilter: scrolled ? "blur(20px) saturate(1.4)" : "none",
      borderBottom: scrolled ? `1px solid ${BORDER}` : "1px solid transparent",
      transition: `all 0.4s ${EASE}`,
    }}>
      <div style={{
        maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center",
        height: 56, padding: "0 clamp(16px,4vw,32px)",
      }}>
        <Logo size="lg" />
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <LangSwitcher lang={lang} setLang={setLang} />
          <button onClick={() => navigate("/login")} className="nav-login-btn" style={{
            fontFamily: F, fontSize: 13, fontWeight: 500, padding: "6px 12px", borderRadius: 7,
            background: "transparent", color: TEXT3, border: "none", cursor: "pointer",
            transition: `color 0.2s ${EASE}`,
          }}
            onMouseEnter={e => { e.currentTarget.style.color = TEXT; }}
            onMouseLeave={e => { e.currentTarget.style.color = TEXT3; }}
          >
            {t.nav_login}
          </button>
          <button onClick={() => navigate("/signup")} className="nav-signup-btn" style={{
            fontFamily: F, fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 7,
            background: "#fff", color: "#000", border: "none", cursor: "pointer",
            transition: `all 0.2s ${EASE}`, letterSpacing: "-0.01em",
          }}>
            {t.nav_signup}
          </button>
        </div>
      </div>
    </nav>
  );
}

// ── Product Mockup (hero visual — with auto-demo loop) ──────────────────────
function ProductMockup({ t }: { t: Record<string, string> }) {
  // Auto-demo: cycles through idle → applied states
  const [applied, setApplied] = useState(false);
  const [roas, setRoas] = useState("3.2x");

  useEffect(() => {
    const doApply = () => {
      setApplied(true);
      setRoas("3.6x");
      setTimeout(() => { setApplied(false); setRoas("3.2x"); }, 2500);
    };
    // Fast first trigger (1.2s), then regular 6s cycle
    const firstTimeout = setTimeout(() => {
      doApply();
    }, 1200);
    const interval = setInterval(doApply, 6000);
    return () => { clearTimeout(firstTimeout); clearInterval(interval); };
  }, []);

  return (
    <div className="product-mockup" style={{
      background: SURFACE, borderRadius: 14, border: `1px solid ${BORDER}`,
      overflow: "hidden",
      boxShadow: `
        0 0 0 1px rgba(255,255,255,0.03),
        0 4px 12px rgba(0,0,0,0.2),
        0 24px 60px rgba(0,0,0,0.45),
        0 48px 100px rgba(0,0,0,0.25)
      `,
      fontFamily: F, width: "100%", maxWidth: 500,
      transform: "perspective(1200px) rotateY(-1deg) rotateX(0.5deg)",
      transition: `all 0.5s ${EASE}`,
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderBottom: `1px solid ${BORDER}`,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: TEXT3, letterSpacing: "0.1em" }}>
          {t.mock_decisions}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.45)", padding: "2px 8px",
          background: "rgba(255,255,255,0.04)", borderRadius: 4,
        }}>{t.mock_7d}</span>
      </div>

      {/* Metrics strip — ROAS reacts to applied state */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
        borderBottom: `1px solid ${BORDER}`, padding: "12px 14px",
      }}>
        {[
          { label: t.mock_invested, value: "R$12.430", color: TEXT },
          { label: t.mock_cpa, value: "R$28,50", color: TEXT },
          { label: t.mock_ctr, value: "2.1%", color: TEXT },
          { label: t.mock_roas, value: roas, color: GREEN },
        ].map((m, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", marginBottom: 3 }}>
              {m.label}
            </div>
            <div style={{
              fontSize: 15, fontWeight: 800, color: m.color, letterSpacing: "-0.02em",
              transition: `all 0.5s ${EASE}`,
            }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Decision cards — slightly dimmed to let opportunity pop */}
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6, opacity: 0.85 }}>
        {/* Kill card */}
        <div style={{
          background: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.10)",
          borderRadius: 8, padding: "10px 12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <div style={{
              width: 5, height: 5, borderRadius: "50%", background: RED,
              boxShadow: "0 0 8px rgba(239,68,68,0.4)",
            }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT, flex: 1, letterSpacing: "-0.01em" }}>
              {t.mock_kill}
            </span>
          </div>
          <p style={{ fontSize: 10.5, color: TEXT3, margin: "0 0 8px", paddingLeft: 12 }}>
            {t.mock_kill_d}
          </p>
          <div style={{ paddingLeft: 12 }}>
            <span style={{
              fontSize: 10.5, fontWeight: 700, color: RED, padding: "4px 10px",
              borderRadius: 5, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.14)",
              cursor: "default", display: "inline-block",
            }}>
              {t.mock_pause}
            </span>
          </div>
        </div>

        {/* Scale card */}
        <div style={{
          background: "rgba(34,197,94,0.03)", border: "1px solid rgba(34,197,94,0.10)",
          borderRadius: 8, padding: "10px 12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <div style={{
              width: 5, height: 5, borderRadius: "50%", background: GREEN,
              boxShadow: "0 0 8px rgba(34,197,94,0.4)",
            }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT, flex: 1, letterSpacing: "-0.01em" }}>
              {t.mock_scale}
            </span>
          </div>
          <p style={{ fontSize: 10.5, color: TEXT3, margin: "0 0 8px", paddingLeft: 12 }}>
            {t.mock_scale_d}
          </p>
          <div style={{ paddingLeft: 12 }}>
            <span style={{
              fontSize: 10.5, fontWeight: 700, color: GREEN, padding: "4px 10px",
              borderRadius: 5, background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.14)",
              cursor: "default", display: "inline-block",
            }}>
              {t.mock_scale_cta}
            </span>
          </div>
        </div>
      </div>

      {/* ★ Opportunity block — FOCAL POINT — with apply/applied state */}
      <div className="mock-opportunity" style={{
        margin: "2px 12px 12px", padding: "14px 16px", borderRadius: 10,
        borderLeft: `2px solid ${applied ? GREEN : ACCENT}`,
        background: applied ? "rgba(34,197,94,0.05)" : "rgba(14,165,233,0.05)",
        boxShadow: applied
          ? "0 0 20px rgba(34,197,94,0.08), 0 0 40px rgba(34,197,94,0.04)"
          : "0 0 20px rgba(14,165,233,0.06), 0 0 40px rgba(14,165,233,0.03)",
        position: "relative",
        transition: `all 0.5s ${EASE}`,
      }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, color: applied ? GREEN : ACCENT, letterSpacing: "0.1em", marginBottom: 5, opacity: 0.7, transition: `color 0.4s ${EASE}` }}>
          {t.mock_opp}
        </div>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: TEXT, margin: "0 0 10px", letterSpacing: "-0.01em" }}>
          {t.mock_opp_t} · <span style={{ color: applied ? GREEN : ACCENT, fontWeight: 700, transition: `color 0.4s ${EASE}` }}>+18% CTR</span>
        </p>

        {/* ★ CTA that toggles to "Applied" confirmation */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="mock-opp-cta" style={{
            fontSize: 11.5, fontWeight: 700, color: "#fff",
            padding: "7px 16px", borderRadius: 7,
            background: applied ? GREEN : ACCENT, cursor: "default",
            display: "inline-flex", alignItems: "center", gap: 5,
            boxShadow: applied ? "0 2px 8px rgba(34,197,94,0.3)" : "0 2px 8px rgba(14,165,233,0.25)",
            transition: `all 0.4s ${EASE}`,
          }}>
            {applied ? (
              <><CheckCircle2 size={13} strokeWidth={2.2} /> {t.mock_applied}</>
            ) : (
              t.mock_apply
            )}
          </span>
          {/* ★ Progress signal — subtle continuity cue */}
          <span style={{
            fontSize: 10, fontWeight: 500, color: GREEN,
            opacity: applied ? 0.7 : 0,
            transition: `opacity 0.5s ${EASE}`,
            whiteSpace: "nowrap",
          }}>
            {t.mock_progress}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ t }: { t: Record<string, string> }) {
  const navigate = useNavigate();
  const [ctaHover, setCtaHover] = useState(false);
  return (
    <section style={{
      minHeight: "100vh", minHeight: "100dvh",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "96px clamp(20px,4vw,40px) 48px",
      background: BG, position: "relative", overflow: "hidden",
    }}>
      {/* Ambient glows */}
      <div style={{
        position: "absolute", top: "5%", right: "10%",
        width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(14,165,233,0.04) 0%, transparent 60%)",
        pointerEvents: "none", filter: "blur(60px)",
      }} />
      <div style={{
        position: "absolute", bottom: "15%", left: "5%",
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,102,241,0.03) 0%, transparent 60%)",
        pointerEvents: "none", filter: "blur(50px)",
      }} />

      <div className="hero-grid" style={{
        maxWidth: 1080, width: "100%", margin: "0 auto",
        display: "grid", gridTemplateColumns: "1fr 1.1fr",
        gap: "clamp(48px,6vw,96px)", alignItems: "center",
      }}>
        {/* Left — copy */}
        <div>
          <h1 style={{
            fontFamily: F, fontSize: "clamp(34px,4.2vw,52px)", fontWeight: 800,
            letterSpacing: "-0.04em", lineHeight: 1.05,
            color: TEXT, margin: "0 0 14px", whiteSpace: "pre-line",
          }}>
            {t.hero_title}
          </h1>
          <p style={{
            fontFamily: F, fontSize: "clamp(14px,1.2vw,16px)", color: TEXT3,
            lineHeight: 1.6, margin: "0 0 32px", maxWidth: 380,
            fontWeight: 400,
          }}>
            {t.hero_sub}
          </p>

          {/* CTA block */}
          <div className="hero-cta-fade">
            <button
              onClick={() => navigate("/signup")}
              onMouseEnter={() => setCtaHover(true)}
              onMouseLeave={() => setCtaHover(false)}
              className="hero-cta-btn"
              style={{
                fontFamily: F, fontSize: 15, fontWeight: 700,
                padding: "14px 36px", borderRadius: 10,
                background: "#fff", color: "#000", border: "none",
                cursor: "pointer", transition: `all 0.25s ${EASE}`,
                letterSpacing: "-0.01em",
                boxShadow: "0 1px 2px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1)",
                minWidth: 220,
              }}
            >
              {ctaHover ? t.hero_cta_hover : t.hero_cta} <ArrowRight size={15} strokeWidth={2.2} style={{ marginLeft: 6, verticalAlign: "middle", position: "relative", top: -0.5 }} />
            </button>

            {/* ★ Entry hook — removes invisible friction */}
            <p className="hero-sub-fade" style={{
              fontFamily: F, fontSize: 11.5, color: "rgba(255,255,255,0.28)",
              margin: "10px 0 0", fontWeight: 400, letterSpacing: "0.01em",
            }}>
              {t.hero_cta_sub}
            </p>
          </div>

          {/* ★ Micro-trust — removes "will this work for me?" doubt */}
          <p className="hero-sub-fade" style={{
            fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.20)",
            margin: "20px 0 0", fontWeight: 400,
          }}>
            {t.hero_micro_trust}
          </p>

          <div style={{ marginTop: 10 }}>
            <a href="/login" style={{
              fontFamily: F, fontSize: 12.5, color: TEXT3,
              textDecoration: "none", transition: `color 0.2s ${EASE}`,
              fontWeight: 400,
            }}
              onMouseEnter={e => { e.currentTarget.style.color = TEXT2; }}
              onMouseLeave={e => { e.currentTarget.style.color = TEXT3; }}
            >
              {t.hero_login}
            </a>
          </div>
        </div>

        {/* Right — product mockup */}
        <div className="hero-mockup" style={{
          display: "flex", justifyContent: "flex-end",
          position: "relative",
        }}>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "80%", height: "80%", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 70%)",
            pointerEvents: "none", filter: "blur(40px)",
          }} />
          <ProductMockup t={t} />
        </div>
      </div>
    </section>
  );
}

// ── Trust line ───────────────────────────────────────────────────────────────
function TrustLine({ t }: { t: Record<string, string> }) {
  return (
    <div style={{
      background: BG, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`,
      padding: "24px clamp(20px,4vw,40px)", textAlign: "center",
    }}>
      <p style={{
        fontFamily: F, fontSize: "clamp(11px, 2.5vw, 12.5px)", color: "rgba(255,255,255,0.28)",
        letterSpacing: "0.01em", margin: 0, fontWeight: 500,
      }}>
        {t.trust_line}
      </p>
    </div>
  );
}

// ── How it works ─────────────────────────────────────────────────────────────
function HowItWorks({ t }: { t: Record<string, string> }) {
  const steps = [
    { icon: <Zap size={18} strokeWidth={1.5} />, color: ACCENT, title: t.how_s1, desc: t.how_s1d },
    { icon: <TrendingUp size={18} strokeWidth={1.5} />, color: GREEN, title: t.how_s2, desc: t.how_s2d },
    { icon: <Check size={18} strokeWidth={1.5} />, color: INDIGO, title: t.how_s3, desc: t.how_s3d },
  ];

  return (
    <section style={{
      background: BG, padding: "clamp(64px,8vw,96px) clamp(20px,4vw,40px)",
    }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <span style={{
          fontFamily: F, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
          color: TEXT3, display: "block", marginBottom: 40,
        }}>
          {t.how_label}
        </span>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "clamp(24px,4vw,48px)",
        }} className="how-grid">
          {steps.map((s, i) => (
            <div key={i} style={{ position: "relative" }}>
              {i < 2 && (
                <div className="how-connector" style={{
                  position: "absolute", top: 17, left: "calc(100% + 2px)",
                  width: "calc(100% - 36px)", height: 1,
                  background: `linear-gradient(to right, ${s.color}20, transparent)`,
                  pointerEvents: "none",
                }} />
              )}
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: `${s.color}08`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: s.color, marginBottom: 16,
              }}>
                {s.icon}
              </div>
              <h3 style={{
                fontFamily: F, fontSize: 14, fontWeight: 700, color: TEXT,
                margin: "0 0 4px", letterSpacing: "-0.01em",
              }}>
                {s.title}
              </h3>
              <p style={{
                fontFamily: F, fontSize: 12.5, color: TEXT3, lineHeight: 1.5, margin: 0,
                fontWeight: 400,
              }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Action Loop ──────────────────────────────────────────────────────────────
function ActionLoop({ t }: { t: Record<string, string> }) {
  const loopSteps = [
    { text: t.loop_s1, color: ACCENT, bg: "rgba(14,165,233,0.05)", border: "rgba(14,165,233,0.12)" },
    { text: t.loop_s2, color: YELLOW, bg: "rgba(251,191,36,0.05)", border: "rgba(251,191,36,0.12)" },
    { text: t.loop_s3, color: GREEN, bg: "rgba(34,197,94,0.05)", border: "rgba(34,197,94,0.12)" },
  ];

  return (
    <section style={{
      background: BG, padding: "clamp(48px,6vw,72px) clamp(20px,4vw,40px)",
      borderTop: `1px solid ${BORDER}`,
    }}>
      <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
        <span style={{
          fontFamily: F, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
          color: TEXT3, display: "block", marginBottom: 10,
        }}>
          {t.loop_label}
        </span>
        <h2 style={{
          fontFamily: F, fontSize: "clamp(22px,2.6vw,30px)", fontWeight: 800,
          letterSpacing: "-0.035em", color: TEXT, margin: "0 0 44px",
        }}>
          {t.loop_title}
        </h2>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 0,
        }} className="loop-flow">
          {loopSteps.map((step, i) => (
            <React.Fragment key={i}>
              <div style={{
                padding: "11px 18px", borderRadius: 8,
                background: step.bg, border: `1px solid ${step.border}`,
                transition: `all 0.3s ${EASE}`,
              }}>
                <span style={{
                  fontFamily: F, fontSize: 12.5, fontWeight: 600,
                  color: step.color, letterSpacing: "-0.01em", whiteSpace: "nowrap",
                }}>
                  {step.text}
                </span>
              </div>
              {i < 2 && (
                <ArrowRight size={14} style={{
                  color: "rgba(255,255,255,0.15)", margin: "0 10px", flexShrink: 0,
                }} />
              )}
            </React.Fragment>
          ))}
          <RotateCcw size={13} style={{
            color: "rgba(255,255,255,0.12)", marginLeft: 14, flexShrink: 0,
          }} />
        </div>
      </div>
    </section>
  );
}

// ── Pricing ──────────────────────────────────────────────────────────────────
function Pricing({ t }: { t: Record<string, string> }) {
  const navigate = useNavigate();
  const [showTooltip, setShowTooltip] = useState(false);

  const plans = [
    {
      name: t.pricing_free, desc: t.pricing_free_d,
      price: null, priceLabel: null,
      cta: t.pricing_free_cta, action: () => navigate("/signup"),
      ctaBg: "transparent", ctaColor: TEXT3,
      ctaBorder: `1px solid ${BORDER}`,
      highlight: false, premium: false, badge: null,
    },
    {
      name: t.pricing_maker, desc: t.pricing_maker_d,
      price: "$19", priceLabel: t.pricing_mo,
      cta: t.pricing_maker_cta, action: () => navigate("/signup?plan=maker"),
      ctaBg: "rgba(255,255,255,0.05)", ctaColor: TEXT2,
      ctaBorder: `1px solid rgba(255,255,255,0.08)`,
      highlight: false, premium: false, badge: null,
    },
    {
      name: t.pricing_pro, desc: t.pricing_pro_d,
      price: "$49", priceLabel: t.pricing_mo,
      cta: t.pricing_pro_cta, action: () => navigate("/signup?plan=pro"),
      ctaBg: INDIGO, ctaColor: "#fff",
      ctaBorder: "none",
      highlight: true, premium: false, badge: t.pricing_pro_badge,
    },
    {
      name: t.pricing_studio, desc: t.pricing_studio_d,
      price: "$299", priceLabel: t.pricing_mo,
      cta: t.pricing_studio_cta, action: () => navigate("/signup?plan=studio"),
      ctaBg: "rgba(255,255,255,0.04)", ctaColor: TEXT2,
      ctaBorder: `1px solid rgba(255,255,255,0.06)`,
      highlight: false, premium: true, badge: null,
    },
  ];

  return (
    <section id="pricing" style={{
      background: BG, padding: "clamp(64px,8vw,96px) clamp(20px,4vw,40px)",
      borderTop: `1px solid ${BORDER}`,
    }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <h2 style={{
            fontFamily: F, fontSize: "clamp(22px,2.6vw,30px)", fontWeight: 800,
            letterSpacing: "-0.035em", color: TEXT, margin: "0 0 12px",
          }}>
            {t.pricing_title}
          </h2>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, position: "relative" }}>
            <button
              onClick={() => setShowTooltip(v => !v)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                background: "none", border: "none", cursor: "pointer",
                fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.25)",
                transition: `color 0.2s ${EASE}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = TEXT3; }}
              onMouseLeave={e => { if (!showTooltip) e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}
            >
              <Info size={12} strokeWidth={1.5} /> {t.pricing_tooltip_q}
            </button>
            {showTooltip && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setShowTooltip(false)} />
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
                  background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 9,
                  padding: "10px 14px", maxWidth: 280, zIndex: 91,
                  boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
                }}>
                  <p style={{ fontFamily: F, fontSize: 12, color: TEXT2, lineHeight: 1.5, margin: 0 }}>
                    {t.pricing_tooltip_a}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="pricing-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, alignItems: "start",
        }}>
          {plans.map((plan, i) => (
            <div key={i} className="pricing-card" style={{
              background: plan.highlight ? "rgba(99,102,241,0.04)" : plan.premium ? "rgba(14,165,233,0.02)" : SURFACE,
              border: `1px solid ${plan.highlight ? "rgba(99,102,241,0.20)" : plan.premium ? "rgba(14,165,233,0.10)" : BORDER}`,
              borderRadius: 12, padding: plan.highlight ? "28px 20px" : "24px 18px",
              position: "relative",
              transition: `all 0.3s ${EASE}`,
              transform: plan.highlight ? "scale(1.02)" : "none",
            }}>
              {/* ★ Pro badge — "Plano mais escolhido" */}
              {plan.badge && (
                <span style={{
                  fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
                  color: INDIGO, marginBottom: 10, display: "inline-block",
                  background: "rgba(99,102,241,0.08)", padding: "3px 8px", borderRadius: 4,
                  border: "1px solid rgba(99,102,241,0.15)",
                }}>
                  {plan.badge}
                </span>
              )}

              {/* Premium label */}
              {plan.premium && (
                <span style={{
                  fontFamily: F, fontSize: 8, fontWeight: 800, letterSpacing: "0.14em",
                  color: "rgba(14,165,233,0.5)", marginBottom: 10, display: "block",
                }}>
                  {t.pricing_unlimited}
                </span>
              )}

              <h3 style={{
                fontFamily: F, fontSize: plan.highlight ? 18 : 15, fontWeight: 700,
                color: plan.highlight ? TEXT : "rgba(255,255,255,0.8)", margin: "0 0 3px", letterSpacing: "-0.02em",
              }}>
                {plan.name}
              </h3>
              <p style={{
                fontFamily: F, fontSize: 11.5, color: TEXT3, margin: "0 0 18px", lineHeight: 1.4,
                fontWeight: 400,
              }}>
                {plan.desc}
              </p>

              {plan.price ? (
                <div style={{ marginBottom: 18 }}>
                  <span style={{
                    fontFamily: F, fontSize: plan.highlight ? 36 : 28, fontWeight: 900,
                    color: plan.highlight ? TEXT : "rgba(255,255,255,0.85)", letterSpacing: "-0.04em",
                  }}>
                    {plan.price}
                  </span>
                  <span style={{ fontFamily: F, fontSize: 12, color: TEXT3, marginLeft: 2 }}>
                    {plan.priceLabel}
                  </span>
                </div>
              ) : (
                <div style={{ marginBottom: 18, height: 34 }}>
                  <span style={{
                    fontFamily: F, fontSize: 28, fontWeight: 900,
                    color: "rgba(255,255,255,0.85)", letterSpacing: "-0.04em",
                  }}>
                    $0
                  </span>
                </div>
              )}

              <button onClick={plan.action} className="pricing-cta-btn" style={{
                width: "100%", fontFamily: F, fontSize: 12.5, fontWeight: plan.highlight ? 700 : 600,
                padding: plan.highlight ? "11px 0" : "9px 0", borderRadius: 7,
                background: plan.ctaBg, color: plan.ctaColor,
                border: plan.ctaBorder,
                cursor: "pointer", transition: `all 0.2s ${EASE}`, letterSpacing: "-0.01em",
              }}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Final CTA ────────────────────────────────────────────────────────────────
function FinalCTA({ t }: { t: Record<string, string> }) {
  const navigate = useNavigate();
  return (
    <section style={{
      background: BG, padding: "clamp(64px,8vw,100px) clamp(20px,4vw,40px)",
      borderTop: `1px solid ${BORDER}`, textAlign: "center",
    }}>
      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        <p style={{
          fontFamily: F, fontSize: "clamp(14px,1.4vw,16px)", color: TEXT3,
          margin: "0 0 6px", fontWeight: 400,
        }}>
          {t.final_title}
        </p>
        <h2 style={{
          fontFamily: F, fontSize: "clamp(24px,3vw,36px)", fontWeight: 800,
          letterSpacing: "-0.04em", color: TEXT, margin: "0 0 32px",
        }}>
          {t.final_sub}
        </h2>

        <div>
          <button onClick={() => navigate("/signup")} className="hero-cta-btn" style={{
            fontFamily: F, fontSize: 15, fontWeight: 700,
            padding: "14px 36px", borderRadius: 10,
            background: "#fff", color: "#000", border: "none",
            cursor: "pointer", transition: `all 0.25s ${EASE}`,
            letterSpacing: "-0.01em",
            boxShadow: "0 1px 2px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1)",
          }}>
            {t.final_cta} <ArrowRight size={15} strokeWidth={2.2} style={{ marginLeft: 6, verticalAlign: "middle", position: "relative", top: -0.5 }} />
          </button>
          <p style={{
            fontFamily: F, fontSize: 11.5, color: "rgba(255,255,255,0.25)",
            margin: "10px 0 0", fontWeight: 400,
          }}>
            {t.final_cta_sub}
          </p>
          <p style={{
            fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.18)",
            margin: "6px 0 0", fontWeight: 400,
          }}>
            {t.final_time}
          </p>
        </div>

        <div style={{ marginTop: 12 }}>
          <a href="/login" style={{
            fontFamily: F, fontSize: 12, color: TEXT3,
            textDecoration: "none", transition: `color 0.2s ${EASE}`,
            fontWeight: 400,
          }}
            onMouseEnter={e => { e.currentTarget.style.color = TEXT2; }}
            onMouseLeave={e => { e.currentTarget.style.color = TEXT3; }}
          >
            {t.final_login}
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────
function Footer({ t }: { t: Record<string, string> }) {
  return (
    <footer style={{
      background: BG, borderTop: `1px solid ${BORDER}`,
      padding: "28px clamp(20px,4vw,40px)",
    }}>
      <div style={{
        maxWidth: 1120, margin: "0 auto",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <span style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.20)" }}>
          {t.footer_copy}
        </span>
        <div style={{ display: "flex", gap: 16 }}>
          <a href="/privacy" style={{
            fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.20)", textDecoration: "none",
            transition: `color 0.2s ${EASE}`,
          }}
            onMouseEnter={e => { e.currentTarget.style.color = TEXT3; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.20)"; }}
          >
            {t.footer_privacy}
          </a>
          <a href="/terms" style={{
            fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.20)", textDecoration: "none",
            transition: `color 0.2s ${EASE}`,
          }}
            onMouseEnter={e => { e.currentTarget.style.color = TEXT3; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.20)"; }}
          >
            {t.footer_terms}
          </a>
        </div>
      </div>
    </footer>
  );
}

// ── Sticky CTA bar (appears after scrolling past hero) ──────────────────────
function StickyBar({ t }: { t: Record<string, string> }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const fn = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="sticky-bar" style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 99,
      background: "rgba(7,13,26,0.92)",
      backdropFilter: "blur(16px) saturate(1.4)",
      WebkitBackdropFilter: "blur(16px) saturate(1.4)",
      borderTop: `1px solid ${BORDER}`,
      padding: "10px clamp(16px,4vw,32px)",
      transform: visible ? "translateY(0)" : "translateY(100%)",
      transition: `transform 0.4s ${EASE}`,
      pointerEvents: visible ? "auto" : "none",
    }}>
      <div style={{
        maxWidth: 1120, margin: "0 auto",
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        gap: 12,
      }}>
        <button onClick={() => navigate("/signup")} className="hero-cta-btn" style={{
          fontFamily: F, fontSize: 13, fontWeight: 700,
          padding: "9px 24px", borderRadius: 8,
          background: "#fff", color: "#000", border: "none",
          cursor: "pointer", transition: `all 0.2s ${EASE}`,
          letterSpacing: "-0.01em",
        }}>
          {t.sticky_cta} <ArrowRight size={13} strokeWidth={2.2} style={{ marginLeft: 4, verticalAlign: "middle" }} />
        </button>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function IndexNew() {
  const { language: ctxLang } = useLanguage();
  const [lang, setLang] = useState<Lang>((ctxLang as Lang) || "pt");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    detectLang().then(l => { setLang(l); setReady(true); });
  }, []);

  const t = TX[lang] || TX.en;

  if (!ready) return <div style={{ background: BG, minHeight: "100vh" }} />;

  const titleMap: Record<Lang, string> = {
    pt: "AdBrief — Melhore seus anúncios em minutos",
    en: "AdBrief — Improve your ads in minutes",
    es: "AdBrief — Mejora tus anuncios en minutos",
  };
  const descMap: Record<Lang, string> = {
    pt: "Conecte seu Meta Ads. Veja o que melhorar. Aplique com um clique.",
    en: "Connect your Meta Ads. See what to improve. Apply with one click.",
    es: "Conecta tu Meta Ads. Ve qué mejorar. Aplica con un clic.",
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT }}>
      <Helmet>
        <title>{titleMap[lang]}</title>
        <meta name="description" content={descMap[lang]} />
        <meta property="og:title" content={titleMap[lang]} />
        <meta property="og:description" content={descMap[lang]} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://adbrief.pro" />
        <link rel="canonical" href="https://adbrief.pro" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "AdBrief",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "url": "https://adbrief.pro",
          "description": descMap.en,
          "offers": [
            { "@type": "Offer", "name": "Maker", "price": "19", "priceCurrency": "USD" },
            { "@type": "Offer", "name": "Pro", "price": "49", "priceCurrency": "USD" },
            { "@type": "Offer", "name": "Studio", "price": "299", "priceCurrency": "USD" },
          ],
        })}</script>
      </Helmet>

      <Nav t={t} lang={lang} setLang={setLang} />
      <Hero t={t} />
      <TrustLine t={t} />
      <HowItWorks t={t} />
      <ActionLoop t={t} />
      <Pricing t={t} />
      <FinalCTA t={t} />
      <Footer t={t} />
      <StickyBar t={t} />
      <CookieConsent />

      <style>{`
        /* ── Mobile (all phones ≤768px) ────────────────────────── */
        @media (max-width: 768px) {
          .nav-signup-btn { display: none !important; }
          .hero-grid {
            grid-template-columns: 1fr !important;
            text-align: center;
          }
          .hero-grid h1 { text-align: center; }
          .hero-grid p { margin-left: auto; margin-right: auto; }
          .hero-mockup {
            justify-content: center !important;
            margin-top: 16px;
          }
          /* ★ FIX: mockup capped to viewport on mobile */
          .product-mockup {
            max-width: 100% !important;
            transform: none !important;
          }
          .how-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
          .how-connector { display: none !important; }
          .pricing-grid {
            grid-template-columns: 1fr !important;
            max-width: 340px;
            margin: 0 auto;
          }
          .pricing-card { transform: none !important; }
          .loop-flow {
            flex-direction: column !important;
            gap: 6px !important;
          }
          .loop-flow > svg {
            transform: rotate(90deg);
          }
          .sticky-bar { display: none !important; }
        }

        /* ── Small phones (iPhone SE, Android 360px) ────────── */
        @media (max-width: 375px) {
          .hero-grid h1 { font-size: 28px !important; line-height: 1.1 !important; }
          .hero-grid p { font-size: 13px !important; }
          .pricing-grid { max-width: 100% !important; }
        }

        /* ── Tablet (iPad Mini, iPad, iPad Pro landscape) ───── */
        @media (min-width: 769px) and (max-width: 1023px) {
          .hero-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 36px !important;
          }
          .product-mockup {
            max-width: 100% !important;
          }
          .pricing-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 14px !important;
          }
          .loop-flow span { white-space: normal !important; }
        }

        /* ── iPad Pro (1024px) — ensure 4-col pricing fits ──── */
        @media (min-width: 1024px) and (max-width: 1120px) {
          .pricing-grid { gap: 10px !important; }
        }

        /* ── Desktop hover interactions ──────────────────────── */
        @media (hover: hover) {
          .hero-cta-btn:hover {
            background: rgba(255,255,255,0.92) !important;
            transform: translateY(-1px) !important;
            box-shadow: 0 4px 16px rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.12) !important;
          }
          .hero-cta-btn:active {
            transform: translateY(0) !important;
            box-shadow: 0 1px 2px rgba(0,0,0,0.15) !important;
          }
          .hero-grid:hover .mock-opportunity {
            box-shadow: 0 0 24px rgba(14,165,233,0.10), 0 0 48px rgba(14,165,233,0.05) !important;
            border-left-color: ${ACCENT} !important;
          }
          .hero-grid:hover .mock-opp-cta {
            box-shadow: 0 2px 12px rgba(14,165,233,0.35) !important;
          }
          .hero-grid:hover .product-mockup {
            transform: perspective(1200px) rotateY(-0.5deg) rotateX(0.3deg) scale(1.005) !important;
          }
          .pricing-cta-btn:hover {
            opacity: 0.85;
            transform: translateY(-0.5px);
          }
          .pricing-cta-btn:active {
            transform: translateY(0);
          }
          .pricing-card:hover {
            border-color: rgba(255,255,255,0.10) !important;
          }
          .nav-signup-btn:hover {
            background: rgba(255,255,255,0.9) !important;
            transform: translateY(-0.5px) !important;
          }
        }

        /* ── CTA fade-in on load ─────────────────────────────── */
        @keyframes ctaFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-cta-fade {
          animation: ctaFadeIn 0.5s ${EASE} 0.2s both;
        }
        /* ★ Staggered subtext — 100ms after CTA */
        .hero-sub-fade {
          animation: ctaFadeIn 0.5s ${EASE} 0.3s both;
        }

        /* ── Global ──────────────────────────────────────────── */
        html { scroll-behavior: smooth; }
        .noise-overlay::before { display: none !important; }
        ::selection { background: rgba(14,165,233,0.25); }

        /* Prevent horizontal overflow globally */
        body, html { overflow-x: hidden; }
      `}</style>
    </div>
  );
}
