// IndexNew.tsx — Concept-driven landing · Decision engine for Meta Ads
import { useNavigate } from "react-router-dom";
import { storage } from "@/lib/storage";
import { Globe, ChevronDown, ArrowRight, CheckCircle2, Pause, TrendingUp, Sparkles, BarChart3 } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import CookieConsent from "@/components/CookieConsent";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";

// ── Design tokens ───────────────────────────────────────────────────────────
const F = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const BG = "#070d1a";
const BG2 = "#0a1020";
const SURFACE = "#0d1117";
const SURFACE2 = "#161B22";
const ACCENT = "#0ea5e9";
const TEXT = "#f0f2f8";
const TEXT2 = "rgba(255,255,255,0.55)";
const TEXT3 = "rgba(255,255,255,0.35)";
const BORDER = "rgba(255,255,255,0.06)";
const GREEN = "#22c55e";
const RED = "#ef4444";
const INDIGO = "#6366f1";
const EASE = "cubic-bezier(0.16,1,0.3,1)";

// ── i18n ─────────────────────────────────────────────────────────────────────
type Lang = "en" | "pt" | "es";

const TX: Record<Lang, Record<string, string>> = {
  pt: {
    nav_login: "Entrar",
    nav_signup: "Criar conta",
    // hero
    hero_tag: "MOTOR DE DECISÃO PARA META ADS",
    hero_title: "Sua campanha te diz\no que fazer agora.",
    hero_sub: "AdBrief analisa suas campanhas em tempo real, identifica o que precisa mudar e deixa você aplicar em um clique.",
    hero_cta: "Começar grátis",
    hero_cta_hover: "Aplicando primeira melhoria",
    hero_cta_sub: "Sem cartão · Sem configuração · 15 melhorias grátis",
    hero_login: "Já tem conta? Entrar",
    // system — what it does
    sys_tag: "O QUE O SISTEMA FAZ",
    sys_title: "Não é um dashboard.\nÉ um sistema de decisão.",
    sys_scan: "Análise contínua",
    sys_scan_d: "O sistema monitora suas campanhas 24/7 e identifica oportunidades que você perderia.",
    sys_decide: "Decisões claras",
    sys_decide_d: "Cada oportunidade vem com uma recomendação específica: pausar, escalar ou ajustar.",
    sys_act: "Execução em um clique",
    sys_act_d: "Você não precisa abrir o Gerenciador de Anúncios. Aplique a melhoria direto no AdBrief.",
    // proof — live mockup
    mock_decisions: "DECISÕES ATIVAS",
    mock_7d: "Últimos 7 dias",
    mock_invested: "INVESTIDO",
    mock_cpa: "CPA",
    mock_ctr: "CTR",
    mock_roas: "ROAS",
    mock_kill: "Pausar — CTR 62% abaixo da média",
    mock_kill_d: "Creative_042 · R$180/dia sem retorno",
    mock_scale: "Escalar — ROAS 4.8x estável há 5 dias",
    mock_scale_d: "Creative_019 · margem para +R$1.080/dia",
    mock_opp: "PRÓXIMA OPORTUNIDADE",
    mock_opp_t: "Próximo ganho: variação de criativo",
    mock_apply: "Aplicar melhoria",
    mock_applied: "Melhoria aplicada",
    mock_progress: "1 de 3 melhorias aplicadas",
    mock_pause: "Pausar anúncio",
    mock_scale_cta: "Aumentar budget",
    // loop
    loop_tag: "CICLO CONTÍNUO",
    loop_title: "Cada melhoria gera a próxima.",
    loop_sub: "O sistema aprende com cada ação. Quanto mais você usa, melhores ficam as recomendações.",
    loop_s1: "Oportunidade identificada",
    loop_s2: "Você aplica",
    loop_s3: "Sistema aprende",
    loop_s4: "Nova oportunidade",
    // pricing
    pricing_tag: "PLANOS",
    pricing_title: "Quanto você quer melhorar?",
    pricing_sub: "Comece grátis. Evolua conforme cresce.",
    pricing_free: "Free",
    pricing_free_d: "Para testar",
    pricing_free_f1: "15 melhorias",
    pricing_free_f2: "Acesso ao sistema",
    pricing_free_cta: "Criar conta",
    pricing_maker: "Maker",
    pricing_maker_d: "Para consistência",
    pricing_maker_f1: "1.000 melhorias",
    pricing_maker_f2: "Ideal para contas ativas",
    pricing_maker_cta: "Começar",
    pricing_pro: "Pro",
    pricing_pro_badge: "Plano mais escolhido",
    pricing_pro_d: "Escala com clareza",
    pricing_pro_f1: "2.500 melhorias",
    pricing_pro_f2: "Escala com clareza",
    pricing_pro_cta: "Começar com Pro",
    pricing_studio: "Studio",
    pricing_studio_d: "Sem limites",
    pricing_studio_f1: "Melhorias ilimitadas",
    pricing_studio_f2: "Operação em escala",
    pricing_studio_cta: "Ir para Studio",
    pricing_details: "Ver todos os detalhes",
    pricing_mo: "/mês",
    // final
    final_title: "Você já viu como funciona.",
    final_sub: "Aplique sua primeira melhoria agora.",
    final_cta: "Começar grátis",
    final_sub2: "Leva menos de 10 segundos",
    final_login: "Já tem conta? Entrar",
    // sticky
    sticky_cta: "Aplicar melhorias agora",
    // footer
    footer_copy: "© 2026 AdBrief",
    footer_privacy: "Privacidade",
    footer_terms: "Termos",
  },
  en: {
    nav_login: "Log in",
    nav_signup: "Sign up",
    hero_tag: "DECISION ENGINE FOR META ADS",
    hero_title: "Your campaign tells you\nwhat to do now.",
    hero_sub: "AdBrief analyzes your campaigns in real time, identifies what needs to change, and lets you apply it in one click.",
    hero_cta: "Start free",
    hero_cta_hover: "Applying first improvement",
    hero_cta_sub: "No card · No setup · 15 free improvements",
    hero_login: "Already have an account? Log in",
    sys_tag: "WHAT THE SYSTEM DOES",
    sys_title: "Not a dashboard.\nA decision system.",
    sys_scan: "Continuous analysis",
    sys_scan_d: "The system monitors your campaigns 24/7 and identifies opportunities you'd miss.",
    sys_decide: "Clear decisions",
    sys_decide_d: "Each opportunity comes with a specific recommendation: pause, scale, or adjust.",
    sys_act: "One-click execution",
    sys_act_d: "You don't need to open Ads Manager. Apply the improvement directly in AdBrief.",
    mock_decisions: "ACTIVE DECISIONS",
    mock_7d: "Last 7 days",
    mock_invested: "INVESTED",
    mock_cpa: "CPA",
    mock_ctr: "CTR",
    mock_roas: "ROAS",
    mock_kill: "Pause — CTR 62% below average",
    mock_kill_d: "Creative_042 · $52/day with no return",
    mock_scale: "Scale — ROAS 4.8x stable for 5 days",
    mock_scale_d: "Creative_019 · room for +$300/day",
    mock_opp: "NEXT OPPORTUNITY",
    mock_opp_t: "Next gain: creative variation",
    mock_apply: "Apply improvement",
    mock_applied: "Improvement applied",
    mock_progress: "1 of 3 improvements applied",
    mock_pause: "Pause ad",
    mock_scale_cta: "Increase budget",
    loop_tag: "CONTINUOUS CYCLE",
    loop_title: "Each improvement generates the next.",
    loop_sub: "The system learns from each action. The more you use it, the better the recommendations.",
    loop_s1: "Opportunity identified",
    loop_s2: "You apply it",
    loop_s3: "System learns",
    loop_s4: "New opportunity",
    pricing_tag: "PLANS",
    pricing_title: "How much do you want to improve?",
    pricing_sub: "Start free. Upgrade as you grow.",
    pricing_free: "Free",
    pricing_free_d: "To try it out",
    pricing_free_f1: "15 improvements",
    pricing_free_f2: "Full system access",
    pricing_free_cta: "Create account",
    pricing_maker: "Maker",
    pricing_maker_d: "For consistency",
    pricing_maker_f1: "1,000 improvements",
    pricing_maker_f2: "Ideal for active accounts",
    pricing_maker_cta: "Get started",
    pricing_pro: "Pro",
    pricing_pro_badge: "Most chosen plan",
    pricing_pro_d: "Scale with clarity",
    pricing_pro_f1: "2,500 improvements",
    pricing_pro_f2: "Scale with clarity",
    pricing_pro_cta: "Start with Pro",
    pricing_studio: "Studio",
    pricing_studio_d: "No limits",
    pricing_studio_f1: "Unlimited improvements",
    pricing_studio_f2: "Operation at scale",
    pricing_studio_cta: "Go Studio",
    pricing_details: "See all details",
    pricing_mo: "/mo",
    final_title: "You've seen how it works.",
    final_sub: "Apply your first improvement now.",
    final_cta: "Start free",
    final_sub2: "Takes less than 10 seconds",
    final_login: "Already have an account? Log in",
    sticky_cta: "Apply improvements now",
    footer_copy: "© 2026 AdBrief",
    footer_privacy: "Privacy",
    footer_terms: "Terms",
  },
  es: {
    nav_login: "Iniciar sesión",
    nav_signup: "Crear cuenta",
    hero_tag: "MOTOR DE DECISIÓN PARA META ADS",
    hero_title: "Tu campaña te dice\nqué hacer ahora.",
    hero_sub: "AdBrief analiza tus campañas en tiempo real, identifica qué necesita cambiar y te deja aplicarlo en un clic.",
    hero_cta: "Empezar gratis",
    hero_cta_hover: "Aplicando primera mejora",
    hero_cta_sub: "Sin tarjeta · Sin configuración · 15 mejoras gratis",
    hero_login: "¿Ya tienes cuenta? Entrar",
    sys_tag: "QUÉ HACE EL SISTEMA",
    sys_title: "No es un dashboard.\nEs un sistema de decisión.",
    sys_scan: "Análisis continuo",
    sys_scan_d: "El sistema monitorea tus campañas 24/7 e identifica oportunidades que perderías.",
    sys_decide: "Decisiones claras",
    sys_decide_d: "Cada oportunidad viene con una recomendación específica: pausar, escalar o ajustar.",
    sys_act: "Ejecución en un clic",
    sys_act_d: "No necesitas abrir el Administrador de Anuncios. Aplica la mejora directo en AdBrief.",
    mock_decisions: "DECISIONES ACTIVAS",
    mock_7d: "Últimos 7 días",
    mock_invested: "INVERTIDO",
    mock_cpa: "CPA",
    mock_ctr: "CTR",
    mock_roas: "ROAS",
    mock_kill: "Pausar — CTR 62% bajo el promedio",
    mock_kill_d: "Creative_042 · $52/día sin retorno",
    mock_scale: "Escalar — ROAS 4.8x estable hace 5 días",
    mock_scale_d: "Creative_019 · margen para +$300/día",
    mock_opp: "PRÓXIMA OPORTUNIDAD",
    mock_opp_t: "Próxima ganancia: variación de creativo",
    mock_apply: "Aplicar mejora",
    mock_applied: "Mejora aplicada",
    mock_progress: "1 de 3 mejoras aplicadas",
    mock_pause: "Pausar anuncio",
    mock_scale_cta: "Aumentar presupuesto",
    loop_tag: "CICLO CONTINUO",
    loop_title: "Cada mejora genera la siguiente.",
    loop_sub: "El sistema aprende de cada acción. Cuanto más lo usas, mejores son las recomendaciones.",
    loop_s1: "Oportunidad identificada",
    loop_s2: "La aplicas",
    loop_s3: "Sistema aprende",
    loop_s4: "Nueva oportunidad",
    pricing_tag: "PLANES",
    pricing_title: "¿Cuánto quieres mejorar?",
    pricing_sub: "Empieza gratis. Evoluciona conforme creces.",
    pricing_free: "Free",
    pricing_free_d: "Para probar",
    pricing_free_f1: "15 mejoras",
    pricing_free_f2: "Acceso al sistema",
    pricing_free_cta: "Crear cuenta",
    pricing_maker: "Maker",
    pricing_maker_d: "Para consistencia",
    pricing_maker_f1: "1.000 mejoras",
    pricing_maker_f2: "Ideal para cuentas activas",
    pricing_maker_cta: "Empezar",
    pricing_pro: "Pro",
    pricing_pro_badge: "Plan más elegido",
    pricing_pro_d: "Escala con claridad",
    pricing_pro_f1: "2.500 mejoras",
    pricing_pro_f2: "Escala con claridad",
    pricing_pro_cta: "Empezar con Pro",
    pricing_studio: "Studio",
    pricing_studio_d: "Sin límites",
    pricing_studio_f1: "Mejoras ilimitadas",
    pricing_studio_f2: "Operación a escala",
    pricing_studio_cta: "Ir a Studio",
    pricing_details: "Ver todos los detalles",
    pricing_mo: "/mes",
    final_title: "Ya viste cómo funciona.",
    final_sub: "Aplica tu primera mejora ahora.",
    final_cta: "Empezar gratis",
    final_sub2: "Toma menos de 10 segundos",
    final_login: "¿Ya tienes cuenta? Entrar",
    sticky_cta: "Aplicar mejoras ahora",
    footer_copy: "© 2026 AdBrief",
    footer_privacy: "Privacidad",
    footer_terms: "Términos",
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
      }}>
        <Globe size={11} strokeWidth={1.6} /> {lang.toUpperCase()}
        <ChevronDown size={9} style={{ transform: open ? "rotate(180deg)" : "none", opacity: 0.5, transition: `transform 0.2s ${EASE}` }} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0,
            background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8,
            overflow: "hidden", zIndex: 999, minWidth: 80,
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)", padding: 3,
          }}>
            {(["en", "pt", "es"] as Lang[]).map(l => (
              <button key={l} onClick={() => pick(l)} style={{
                width: "100%", padding: "6px 10px", display: "flex", alignItems: "center", gap: 6,
                background: lang === l ? "rgba(14,165,233,0.06)" : "transparent", border: "none", borderRadius: 5,
                color: lang === l ? ACCENT : TEXT3, fontSize: 11, fontWeight: lang === l ? 600 : 400,
                cursor: "pointer", fontFamily: F,
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
      background: scrolled ? "rgba(7,13,26,0.92)" : "transparent",
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
          }}>
            {t.nav_login}
          </button>
          <button onClick={() => navigate("/signup")} className="nav-signup-btn" style={{
            fontFamily: F, fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 7,
            background: "#fff", color: "#000", border: "none", cursor: "pointer",
            transition: `all 0.2s ${EASE}`,
          }}>
            {t.nav_signup}
          </button>
        </div>
      </div>
    </nav>
  );
}

// ── Live Product (hero visual — auto-demo) ──────────────────────────────────
function LiveProduct({ t }: { t: Record<string, string> }) {
  const [applied, setApplied] = useState(false);
  const [roas, setRoas] = useState("3.2x");
  const [progress, setProgress] = useState(false);

  useEffect(() => {
    const doApply = () => {
      setApplied(true);
      setRoas("3.6x");
      setTimeout(() => setProgress(true), 400);
      setTimeout(() => { setApplied(false); setRoas("3.2x"); setProgress(false); }, 3000);
    };
    const first = setTimeout(doApply, 1400);
    const interval = setInterval(doApply, 7000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, []);

  return (
    <div className="product-mockup" style={{
      background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`,
      overflow: "hidden",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 8px 24px rgba(0,0,0,0.3), 0 32px 80px rgba(0,0,0,0.5)",
      fontFamily: F, width: "100%", maxWidth: 520,
      transform: "perspective(1400px) rotateY(-1.5deg) rotateX(0.5deg)",
      transition: `all 0.6s ${EASE}`,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "11px 16px", borderBottom: `1px solid ${BORDER}`,
      }}>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: TEXT3, letterSpacing: "0.12em" }}>
          {t.mock_decisions}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.35)", padding: "2px 8px",
          background: "rgba(255,255,255,0.03)", borderRadius: 4,
        }}>{t.mock_7d}</span>
      </div>

      {/* Metrics */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
        borderBottom: `1px solid ${BORDER}`, padding: "14px 16px",
      }}>
        {[
          { label: t.mock_invested, value: "R$12.430", color: TEXT },
          { label: t.mock_cpa, value: "R$28,50", color: TEXT },
          { label: t.mock_ctr, value: "2.1%", color: TEXT },
          { label: t.mock_roas, value: roas, color: GREEN },
        ].map((m, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 8, fontWeight: 800, color: "rgba(255,255,255,0.22)", letterSpacing: "0.1em", marginBottom: 4 }}>
              {m.label}
            </div>
            <div style={{
              fontSize: 16, fontWeight: 800, color: m.color, letterSpacing: "-0.02em",
              transition: `all 0.5s ${EASE}`,
            }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Decision cards */}
      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Kill */}
        <div style={{
          background: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.08)",
          borderRadius: 9, padding: "10px 14px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: RED, boxShadow: "0 0 8px rgba(239,68,68,0.4)" }} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: TEXT, flex: 1 }}>{t.mock_kill}</span>
          </div>
          <p style={{ fontSize: 10, color: TEXT3, margin: "0 0 7px", paddingLeft: 12, opacity: 0.8 }}>{t.mock_kill_d}</p>
          <div style={{ paddingLeft: 12 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: RED, padding: "3px 10px",
              borderRadius: 5, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              <Pause size={9} /> {t.mock_pause}
            </span>
          </div>
        </div>

        {/* Scale */}
        <div style={{
          background: "rgba(34,197,94,0.03)", border: "1px solid rgba(34,197,94,0.08)",
          borderRadius: 9, padding: "10px 14px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN, boxShadow: "0 0 8px rgba(34,197,94,0.4)" }} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: TEXT, flex: 1 }}>{t.mock_scale}</span>
          </div>
          <p style={{ fontSize: 10, color: TEXT3, margin: "0 0 7px", paddingLeft: 12, opacity: 0.8 }}>{t.mock_scale_d}</p>
          <div style={{ paddingLeft: 12 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: GREEN, padding: "3px 10px",
              borderRadius: 5, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.12)",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              <TrendingUp size={9} /> {t.mock_scale_cta}
            </span>
          </div>
        </div>
      </div>

      {/* Opportunity — focal point */}
      <div className="mock-opportunity" style={{
        margin: "2px 14px 14px", padding: "14px 16px", borderRadius: 10,
        borderLeft: `2px solid ${applied ? GREEN : ACCENT}`,
        background: applied ? "rgba(34,197,94,0.04)" : "rgba(14,165,233,0.04)",
        boxShadow: applied
          ? "0 0 24px rgba(34,197,94,0.06)"
          : "0 0 24px rgba(14,165,233,0.04)",
        transition: `all 0.5s ${EASE}`,
      }}>
        <div style={{ fontSize: 8, fontWeight: 800, color: applied ? GREEN : ACCENT, letterSpacing: "0.12em", marginBottom: 6, opacity: 0.6, transition: `color 0.4s ${EASE}` }}>
          {t.mock_opp}
        </div>
        <p style={{ fontSize: 12, fontWeight: 600, color: TEXT, margin: "0 0 10px" }}>
          {t.mock_opp_t} · <span style={{ color: applied ? GREEN : ACCENT, fontWeight: 700, transition: `color 0.4s ${EASE}` }}>+18% CTR</span>
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="mock-opp-cta" style={{
            fontSize: 11, fontWeight: 700, color: "#fff",
            padding: "7px 16px", borderRadius: 7,
            background: applied ? GREEN : ACCENT, cursor: "default",
            display: "inline-flex", alignItems: "center", gap: 5,
            boxShadow: applied ? "0 2px 10px rgba(34,197,94,0.25)" : "0 2px 10px rgba(14,165,233,0.2)",
            transition: `all 0.4s ${EASE}`,
          }}>
            {applied ? <><CheckCircle2 size={12} strokeWidth={2.2} /> {t.mock_applied}</> : t.mock_apply}
          </span>
          <span style={{
            fontSize: 9.5, fontWeight: 500, color: GREEN,
            opacity: progress ? 0.6 : 0,
            transition: `opacity 0.5s ${EASE}`,
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
      padding: "100px clamp(20px,4vw,40px) 56px",
      background: BG, position: "relative", overflow: "hidden",
    }}>
      {/* Ambient */}
      <div style={{
        position: "absolute", top: "0%", right: "5%",
        width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(14,165,233,0.035) 0%, transparent 55%)",
        pointerEvents: "none", filter: "blur(80px)",
      }} />
      <div style={{
        position: "absolute", bottom: "10%", left: "0%",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,102,241,0.025) 0%, transparent 55%)",
        pointerEvents: "none", filter: "blur(60px)",
      }} />

      <div className="hero-grid" style={{
        maxWidth: 1100, width: "100%", margin: "0 auto",
        display: "grid", gridTemplateColumns: "1fr 1.15fr",
        gap: "clamp(48px,6vw,96px)", alignItems: "center",
      }}>
        {/* Left — positioning */}
        <div>
          <span className="hero-tag-fade" style={{
            fontFamily: F, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
            color: ACCENT, display: "inline-block", marginBottom: 20,
            opacity: 0.7,
          }}>
            {t.hero_tag}
          </span>
          <h1 style={{
            fontFamily: F, fontSize: "clamp(32px,4vw,50px)", fontWeight: 800,
            letterSpacing: "-0.04em", lineHeight: 1.08,
            color: TEXT, margin: "0 0 18px", whiteSpace: "pre-line",
          }}>
            {t.hero_title}
          </h1>
          <p className="hero-sub-fade" style={{
            fontFamily: F, fontSize: "clamp(14px,1.15vw,16px)", color: TEXT2,
            lineHeight: 1.65, margin: "0 0 36px", maxWidth: 420,
            fontWeight: 400,
          }}>
            {t.hero_sub}
          </p>

          {/* CTA */}
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
                letterSpacing: "-0.01em", minWidth: 220,
                boxShadow: "0 1px 3px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.08)",
              }}
            >
              {ctaHover ? t.hero_cta_hover : t.hero_cta} <ArrowRight size={15} strokeWidth={2.2} style={{ marginLeft: 6, verticalAlign: "middle", position: "relative", top: -0.5 }} />
            </button>
            <p className="hero-detail-fade" style={{
              fontFamily: F, fontSize: 11.5, color: "rgba(255,255,255,0.25)",
              margin: "10px 0 0", fontWeight: 400,
            }}>
              {t.hero_cta_sub}
            </p>
          </div>

          <div style={{ marginTop: 14 }}>
            <a href="/login" style={{
              fontFamily: F, fontSize: 12.5, color: TEXT3,
              textDecoration: "none", fontWeight: 400,
            }}>
              {t.hero_login}
            </a>
          </div>
        </div>

        {/* Right — live product */}
        <div className="hero-mockup" style={{
          display: "flex", justifyContent: "flex-end", position: "relative",
        }}>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "85%", height: "85%", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(14,165,233,0.05) 0%, transparent 65%)",
            pointerEvents: "none", filter: "blur(50px)",
          }} />
          <LiveProduct t={t} />
        </div>
      </div>
    </section>
  );
}

// ── System (what it does — asymmetric layout) ───────────────────────────────
function SystemSection({ t }: { t: Record<string, string> }) {
  const capabilities = [
    { icon: <BarChart3 size={20} strokeWidth={1.5} />, color: ACCENT, title: t.sys_scan, desc: t.sys_scan_d },
    { icon: <Sparkles size={20} strokeWidth={1.5} />, color: INDIGO, title: t.sys_decide, desc: t.sys_decide_d },
    { icon: <ArrowRight size={20} strokeWidth={1.5} />, color: GREEN, title: t.sys_act, desc: t.sys_act_d },
  ];

  return (
    <section style={{
      background: BG2, padding: "clamp(80px,10vw,120px) clamp(20px,4vw,40px)",
      borderTop: `1px solid ${BORDER}`,
    }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Asymmetric header — left-aligned, not centered */}
        <span style={{
          fontFamily: F, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
          color: TEXT3, display: "block", marginBottom: 14,
        }}>
          {t.sys_tag}
        </span>
        <h2 style={{
          fontFamily: F, fontSize: "clamp(26px,3.2vw,40px)", fontWeight: 800,
          letterSpacing: "-0.04em", lineHeight: 1.1,
          color: TEXT, margin: "0 0 64px", whiteSpace: "pre-line", maxWidth: 500,
        }}>
          {t.sys_title}
        </h2>

        {/* Capabilities — staggered, not equal grid */}
        <div className="sys-grid" style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 20,
        }}>
          {capabilities.map((cap, i) => (
            <div key={i} className="sys-card" style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 14, padding: "28px 24px",
              position: "relative", overflow: "hidden",
              transition: `all 0.3s ${EASE}`,
              // Stagger: each card slightly offset vertically
              marginTop: i === 1 ? 24 : i === 2 ? 48 : 0,
            }}>
              {/* Subtle top accent line */}
              <div style={{
                position: "absolute", top: 0, left: 24, right: 24, height: 1,
                background: `linear-gradient(to right, transparent, ${cap.color}30, transparent)`,
              }} />
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `${cap.color}08`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: cap.color, marginBottom: 20,
              }}>
                {cap.icon}
              </div>
              <h3 style={{
                fontFamily: F, fontSize: 15, fontWeight: 700, color: TEXT,
                margin: "0 0 8px", letterSpacing: "-0.02em",
              }}>
                {cap.title}
              </h3>
              <p style={{
                fontFamily: F, fontSize: 13, color: TEXT3, lineHeight: 1.6, margin: 0,
                fontWeight: 400,
              }}>
                {cap.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Loop ─────────────────────────────────────────────────────────────────────
function LoopSection({ t }: { t: Record<string, string> }) {
  const steps = [
    { text: t.loop_s1, color: ACCENT },
    { text: t.loop_s2, color: GREEN },
    { text: t.loop_s3, color: INDIGO },
    { text: t.loop_s4, color: ACCENT },
  ];

  return (
    <section style={{
      background: BG, padding: "clamp(72px,9vw,100px) clamp(20px,4vw,40px)",
      borderTop: `1px solid ${BORDER}`,
    }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <span style={{
          fontFamily: F, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
          color: TEXT3, display: "block", marginBottom: 14,
        }}>
          {t.loop_tag}
        </span>
        <h2 style={{
          fontFamily: F, fontSize: "clamp(24px,2.8vw,34px)", fontWeight: 800,
          letterSpacing: "-0.04em", color: TEXT, margin: "0 0 10px",
        }}>
          {t.loop_title}
        </h2>
        <p style={{
          fontFamily: F, fontSize: 14, color: TEXT3, lineHeight: 1.6,
          margin: "0 0 48px", maxWidth: 480,
        }}>
          {t.loop_sub}
        </p>

        {/* Visual loop — horizontal with wrap-around indicator */}
        <div className="loop-flow" style={{
          display: "flex", alignItems: "center", gap: 0, position: "relative",
        }}>
          {steps.map((step, i) => (
            <React.Fragment key={i}>
              <div style={{
                padding: "10px 18px", borderRadius: 8,
                background: `${step.color}06`,
                border: `1px solid ${step.color}15`,
              }}>
                <span style={{
                  fontFamily: F, fontSize: 12.5, fontWeight: 600,
                  color: step.color, whiteSpace: "nowrap",
                }}>
                  {step.text}
                </span>
              </div>
              {i < 3 && (
                <ArrowRight size={13} style={{
                  color: "rgba(255,255,255,0.12)", margin: "0 8px", flexShrink: 0,
                }} />
              )}
            </React.Fragment>
          ))}
          {/* Loop-back indicator */}
          <div style={{
            position: "absolute", bottom: -20, left: "12%", right: "12%", height: 1,
            background: `linear-gradient(to right, ${ACCENT}15, rgba(255,255,255,0.04), ${ACCENT}15)`,
          }} />
        </div>
      </div>
    </section>
  );
}

// ── Pricing (simplified — landing version) ──────────────────────────────────
function PricingSection({ t }: { t: Record<string, string> }) {
  const navigate = useNavigate();

  const plans = [
    {
      name: t.pricing_free, desc: t.pricing_free_d, price: "$0",
      f1: t.pricing_free_f1, f2: t.pricing_free_f2,
      cta: t.pricing_free_cta, action: () => navigate("/signup"),
      bg: SURFACE, border: BORDER, ctaBg: "rgba(255,255,255,0.04)", ctaColor: TEXT3, ctaBorder: `1px solid ${BORDER}`,
      highlight: false, badge: null,
    },
    {
      name: t.pricing_maker, desc: t.pricing_maker_d, price: "$19",
      f1: t.pricing_maker_f1, f2: t.pricing_maker_f2,
      cta: t.pricing_maker_cta, action: () => navigate("/signup?plan=maker"),
      bg: SURFACE, border: "rgba(255,255,255,0.08)", ctaBg: "rgba(255,255,255,0.06)", ctaColor: TEXT2, ctaBorder: `1px solid rgba(255,255,255,0.08)`,
      highlight: false, badge: null,
    },
    {
      name: t.pricing_pro, desc: t.pricing_pro_d, price: "$49",
      f1: t.pricing_pro_f1, f2: t.pricing_pro_f2,
      cta: t.pricing_pro_cta, action: () => navigate("/signup?plan=pro"),
      bg: "rgba(99,102,241,0.04)", border: "rgba(99,102,241,0.18)", ctaBg: INDIGO, ctaColor: "#fff", ctaBorder: "none",
      highlight: true, badge: t.pricing_pro_badge,
    },
    {
      name: t.pricing_studio, desc: t.pricing_studio_d, price: "$299",
      f1: t.pricing_studio_f1, f2: t.pricing_studio_f2,
      cta: t.pricing_studio_cta, action: () => navigate("/signup?plan=studio"),
      bg: "rgba(14,165,233,0.02)", border: "rgba(14,165,233,0.10)", ctaBg: "rgba(255,255,255,0.04)", ctaColor: TEXT2, ctaBorder: `1px solid rgba(255,255,255,0.06)`,
      highlight: false, badge: null,
    },
  ];

  return (
    <section id="pricing" style={{
      background: BG2, padding: "clamp(72px,9vw,100px) clamp(20px,4vw,40px)",
      borderTop: `1px solid ${BORDER}`,
    }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <span style={{
          fontFamily: F, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
          color: TEXT3, display: "block", marginBottom: 14,
        }}>
          {t.pricing_tag}
        </span>
        <h2 style={{
          fontFamily: F, fontSize: "clamp(24px,2.8vw,34px)", fontWeight: 800,
          letterSpacing: "-0.04em", color: TEXT, margin: "0 0 8px",
        }}>
          {t.pricing_title}
        </h2>
        <p style={{
          fontFamily: F, fontSize: 14, color: TEXT3, margin: "0 0 48px",
        }}>
          {t.pricing_sub}
        </p>

        <div className="pricing-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, alignItems: "start",
        }}>
          {plans.map((plan, i) => (
            <div key={i} className="pricing-card" style={{
              background: plan.bg,
              border: `1px solid ${plan.border}`,
              borderRadius: 13, padding: plan.highlight ? "28px 20px" : "24px 18px",
              position: "relative", transition: `all 0.3s ${EASE}`,
              transform: plan.highlight ? "scale(1.02)" : "none",
            }}>
              {plan.badge && (
                <span style={{
                  fontFamily: F, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.05em",
                  color: INDIGO, marginBottom: 10, display: "inline-block",
                  background: "rgba(99,102,241,0.08)", padding: "3px 9px", borderRadius: 5,
                  border: "1px solid rgba(99,102,241,0.15)",
                }}>
                  {plan.badge}
                </span>
              )}

              <h3 style={{
                fontFamily: F, fontSize: plan.highlight ? 17 : 15, fontWeight: 700,
                color: plan.highlight ? TEXT : "rgba(255,255,255,0.8)", margin: "0 0 3px", letterSpacing: "-0.02em",
              }}>
                {plan.name}
              </h3>
              <p style={{
                fontFamily: F, fontSize: 11.5, color: TEXT3, margin: "0 0 16px", fontWeight: 400,
              }}>
                {plan.desc}
              </p>

              <div style={{ marginBottom: 16 }}>
                <span style={{
                  fontFamily: F, fontSize: plan.highlight ? 36 : 28, fontWeight: 900,
                  color: plan.highlight ? TEXT : "rgba(255,255,255,0.85)", letterSpacing: "-0.04em",
                }}>
                  {plan.price}
                </span>
                {plan.price !== "$0" && (
                  <span style={{ fontFamily: F, fontSize: 12, color: TEXT3, marginLeft: 2 }}>{t.pricing_mo}</span>
                )}
              </div>

              {/* Two key features — no clutter */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontFamily: F, fontSize: 12, color: TEXT2, margin: "0 0 4px", fontWeight: 500 }}>{plan.f1}</p>
                <p style={{ fontFamily: F, fontSize: 11.5, color: TEXT3, margin: 0, fontWeight: 400 }}>{plan.f2}</p>
              </div>

              <button onClick={plan.action} className="pricing-cta-btn" style={{
                width: "100%", fontFamily: F, fontSize: 12.5, fontWeight: plan.highlight ? 700 : 600,
                padding: plan.highlight ? "11px 0" : "9px 0", borderRadius: 7,
                background: plan.ctaBg, color: plan.ctaColor,
                border: plan.ctaBorder, cursor: "pointer",
                transition: `all 0.2s ${EASE}`,
              }}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* "Ver todos os detalhes" link */}
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <a href="/pricing" style={{
            fontFamily: F, fontSize: 13, fontWeight: 500, color: TEXT3,
            textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5,
            transition: `color 0.2s ${EASE}`,
          }}
            onMouseEnter={e => { e.currentTarget.style.color = ACCENT; }}
            onMouseLeave={e => { e.currentTarget.style.color = TEXT3; }}
          >
            {t.pricing_details} <ArrowRight size={13} />
          </a>
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
      background: BG, padding: "clamp(72px,9vw,100px) clamp(20px,4vw,40px)",
      borderTop: `1px solid ${BORDER}`,
    }}>
      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        <p style={{
          fontFamily: F, fontSize: 14, color: TEXT3, margin: "0 0 8px",
        }}>
          {t.final_title}
        </p>
        <h2 style={{
          fontFamily: F, fontSize: "clamp(24px,3vw,36px)", fontWeight: 800,
          letterSpacing: "-0.04em", color: TEXT, margin: "0 0 36px",
        }}>
          {t.final_sub}
        </h2>

        <div>
          <button onClick={() => navigate("/signup")} className="hero-cta-btn" style={{
            fontFamily: F, fontSize: 15, fontWeight: 700,
            padding: "14px 36px", borderRadius: 10,
            background: "#fff", color: "#000", border: "none",
            cursor: "pointer", transition: `all 0.25s ${EASE}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.08)",
          }}>
            {t.final_cta} <ArrowRight size={15} strokeWidth={2.2} style={{ marginLeft: 6, verticalAlign: "middle", position: "relative", top: -0.5 }} />
          </button>
          <p style={{
            fontFamily: F, fontSize: 11.5, color: "rgba(255,255,255,0.22)",
            margin: "10px 0 0",
          }}>
            {t.final_sub2}
          </p>
        </div>

        <div style={{ marginTop: 14 }}>
          <a href="/login" style={{ fontFamily: F, fontSize: 12, color: TEXT3, textDecoration: "none" }}>
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
        <span style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.20)" }}>{t.footer_copy}</span>
        <div style={{ display: "flex", gap: 16 }}>
          <a href="/privacy" style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.20)", textDecoration: "none" }}>{t.footer_privacy}</a>
          <a href="/terms" style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.20)", textDecoration: "none" }}>{t.footer_terms}</a>
        </div>
      </div>
    </footer>
  );
}

// ── Sticky CTA bar ──────────────────────────────────────────────────────────
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
        display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12,
      }}>
        <button onClick={() => navigate("/signup")} className="hero-cta-btn" style={{
          fontFamily: F, fontSize: 13, fontWeight: 700,
          padding: "9px 24px", borderRadius: 8,
          background: "#fff", color: "#000", border: "none",
          cursor: "pointer", transition: `all 0.2s ${EASE}`,
        }}>
          {t.sticky_cta} <ArrowRight size={13} strokeWidth={2.2} style={{ marginLeft: 4, verticalAlign: "middle" }} />
        </button>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
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
    pt: "AdBrief — Motor de decisão para Meta Ads",
    en: "AdBrief — Decision engine for Meta Ads",
    es: "AdBrief — Motor de decisión para Meta Ads",
  };
  const descMap: Record<Lang, string> = {
    pt: "Analisa suas campanhas, mostra o que fazer e deixa você aplicar em um clique.",
    en: "Analyzes your campaigns, shows what to do, and lets you apply it in one click.",
    es: "Analiza tus campañas, muestra qué hacer y te deja aplicarlo en un clic.",
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
      <SystemSection t={t} />
      <LoopSection t={t} />
      <PricingSection t={t} />
      <FinalCTA t={t} />
      <Footer t={t} />
      <StickyBar t={t} />
      <CookieConsent />

      <style>{`
        /* ── Load animations ──────────────────────────────────── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-tag-fade { animation: fadeUp 0.6s ${EASE} 0.05s both; }
        .hero-sub-fade { animation: fadeUp 0.6s ${EASE} 0.15s both; }
        .hero-cta-fade { animation: fadeUp 0.6s ${EASE} 0.25s both; }
        .hero-detail-fade { animation: fadeUp 0.5s ${EASE} 0.35s both; }

        /* ── Mobile ≤768px ────────────────────────────────────── */
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
            margin-top: 20px;
          }
          .product-mockup {
            max-width: 100% !important;
            transform: none !important;
          }
          .sys-grid {
            grid-template-columns: 1fr !important;
          }
          .sys-card { margin-top: 0 !important; }
          .pricing-grid {
            grid-template-columns: 1fr !important;
            max-width: 340px;
            margin: 0 auto;
          }
          .pricing-card { transform: none !important; }
          .loop-flow {
            flex-direction: column !important;
            gap: 6px !important;
            align-items: flex-start !important;
          }
          .loop-flow > svg { transform: rotate(90deg); }
          .sticky-bar { display: none !important; }
        }

        /* ── Small phones ≤375px ──────────────────────────────── */
        @media (max-width: 375px) {
          .hero-grid h1 { font-size: 26px !important; line-height: 1.12 !important; }
          .hero-grid p { font-size: 13px !important; }
          .pricing-grid { max-width: 100% !important; }
        }

        /* ── Tablet 769-1023px ────────────────────────────────── */
        @media (min-width: 769px) and (max-width: 1023px) {
          .hero-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 36px !important;
          }
          .product-mockup { max-width: 100% !important; }
          .sys-grid { grid-template-columns: 1fr 1fr !important; }
          .sys-card { margin-top: 0 !important; }
          .sys-card:last-child { grid-column: span 2; max-width: 50%; margin: 0 auto; }
          .pricing-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 14px !important;
          }
          .loop-flow span { white-space: normal !important; }
        }

        /* ── iPad Pro gap ──────────────────────────────────────── */
        @media (min-width: 1024px) and (max-width: 1120px) {
          .pricing-grid { gap: 10px !important; }
        }

        /* ── Hover (desktop only) ─────────────────────────────── */
        @media (hover: hover) {
          .hero-cta-btn:hover {
            background: rgba(255,255,255,0.92) !important;
            transform: translateY(-1px) !important;
            box-shadow: 0 4px 20px rgba(255,255,255,0.06), 0 0 0 1px rgba(255,255,255,0.1) !important;
          }
          .hero-cta-btn:active {
            transform: translateY(0) !important;
          }
          .hero-grid:hover .product-mockup {
            transform: perspective(1400px) rotateY(-0.5deg) rotateX(0.3deg) scale(1.005) !important;
          }
          .hero-grid:hover .mock-opportunity {
            box-shadow: 0 0 28px rgba(14,165,233,0.08) !important;
          }
          .sys-card:hover {
            border-color: rgba(255,255,255,0.10) !important;
            transform: translateY(-2px) !important;
          }
          .pricing-cta-btn:hover { opacity: 0.85; transform: translateY(-0.5px); }
          .pricing-card:hover { border-color: rgba(255,255,255,0.10) !important; }
          .nav-signup-btn:hover { background: rgba(255,255,255,0.9) !important; }
        }

        /* ── Global ──────────────────────────────────────────── */
        html { scroll-behavior: smooth; }
        ::selection { background: rgba(14,165,233,0.25); }
        body, html { overflow-x: hidden; }
      `}</style>
    </div>
  );
}
