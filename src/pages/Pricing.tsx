// Pricing.tsx — minimal, direct. 4 plans, annual toggle, short FAQ.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Loader2, ChevronDown } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Lang = "en" | "pt" | "es";
type Cycle = "monthly" | "annual";
type PlanKey = "free" | "maker" | "pro" | "studio";

const F = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const BG = "#070d1a";
const SURFACE = "#0d1117";
const ACCENT = "#0ea5e9";
const TEXT = "#f0f2f8";
const TEXT2 = "rgba(255,255,255,0.55)";
const TEXT3 = "rgba(255,255,255,0.35)";
const BORDER = "rgba(255,255,255,0.08)";
const EASE = "cubic-bezier(0.16,1,0.3,1)";

// ── Content ──────────────────────────────────────────────────────────────────
const T: Record<Lang, {
  nav_signin: string;
  hero_title: string;
  hero_sub: string;
  toggle_monthly: string;
  toggle_annual: string;
  toggle_save: string;
  suffix_month: string;
  suffix_annual: string;
  popular: string;
  cta_free: string;
  cta_paid: string;
  trust: string;
  faq_title: string;
  faq: { q: string; a: string }[];
  footer_cta_title: string;
  footer_cta_sub: string;
  footer_cta_btn: string;
  plans: Record<PlanKey, { name: string; tag: string; bullets: string[] }>;
}> = {
  pt: {
    nav_signin: "Entrar",
    hero_title: "Preços",
    hero_sub: "Você paga pelo volume de decisões que a IA aplica na sua conta. Nada mais.",
    toggle_monthly: "Mensal",
    toggle_annual: "Anual",
    toggle_save: "20% off",
    suffix_month: "/mês",
    suffix_annual: "/mês · cobrado anualmente",
    popular: "Mais escolhido",
    cta_free: "Começar grátis",
    cta_paid: "Testar 3 dias grátis",
    trust: "3 dias grátis nos planos pagos · Cancele quando quiser",
    faq_title: "Perguntas frequentes",
    faq: [
      { q: "Como funcionam os créditos?", a: "Crédito é a unidade de consumo. Cada ação da IA — chat, geração de hook, análise de vídeo, melhoria aplicada — consome uma quantidade. Uma melhoria custa 30 créditos no Maker e 15 no Pro. Chat e hooks custam bem menos." },
      { q: "Posso trocar de plano a qualquer hora?", a: "Sim. Upgrades entram em vigor na hora, com ajuste proporcional. Downgrades valem no próximo ciclo. Sem taxas, sem drama." },
      { q: "O que acontece se eu usar tudo no mês?", a: "A IA para de consumir créditos e avisa. Seus dados e campanhas continuam acessíveis — só a automação pausa até o próximo ciclo ou upgrade." },
      { q: "Anual compensa mesmo?", a: "20% off direto. Se você vai usar por 10 meses ou mais, compensa. Se não tem certeza, começa no mensal e troca depois." },
    ],
    footer_cta_title: "Pronto pra começar?",
    footer_cta_sub: "3 dias grátis, sem compromisso.",
    footer_cta_btn: "Criar conta",
    plans: {
      free:   { name: "Free",   tag: "Para explorar",  bullets: ["15 créditos (one-time)", "Chat IA + geração de hooks/scripts", "Análise de vídeo", "Sem contas conectadas"] },
      maker:  { name: "Maker",  tag: "1 conta",         bullets: ["1.000 créditos/mês", "1 conta do Meta Ads", "~33 melhorias aplicadas/mês", "Todas as ferramentas de IA"] },
      pro:    { name: "Pro",    tag: "Até 3 contas",    bullets: ["2.500 créditos/mês", "Até 3 contas do Meta Ads", "~166 melhorias aplicadas/mês", "Melhorias custam 50% menos"] },
      studio: { name: "Studio", tag: "Sem limites",     bullets: ["Créditos ilimitados", "Contas ilimitadas", "Melhorias ilimitadas", "Suporte prioritário"] },
    },
  },
  en: {
    nav_signin: "Sign in",
    hero_title: "Pricing",
    hero_sub: "You pay for the volume of decisions AI applies to your account. Nothing else.",
    toggle_monthly: "Monthly",
    toggle_annual: "Annual",
    toggle_save: "20% off",
    suffix_month: "/mo",
    suffix_annual: "/mo · billed yearly",
    popular: "Most popular",
    cta_free: "Start free",
    cta_paid: "Try 3 days free",
    trust: "3-day free trial on paid plans · Cancel anytime",
    faq_title: "Frequently asked",
    faq: [
      { q: "How do credits work?", a: "A credit is the unit of usage. Every AI action — chat, hook generation, video analysis, applied improvement — consumes some. An improvement costs 30 credits on Maker and 15 on Pro. Chat and hooks cost far less." },
      { q: "Can I change plans anytime?", a: "Yes. Upgrades take effect immediately with prorated charges. Downgrades apply on the next cycle. No fees, no drama." },
      { q: "What if I run out mid-month?", a: "AI stops consuming credits and you get a heads-up. Your data and campaigns stay accessible — only automation pauses until the next cycle or an upgrade." },
      { q: "Is annual worth it?", a: "It's a flat 20% off. If you'll use the product for 10+ months, yes. If unsure, start monthly and switch later." },
    ],
    footer_cta_title: "Ready to start?",
    footer_cta_sub: "3 days free, no strings attached.",
    footer_cta_btn: "Create account",
    plans: {
      free:   { name: "Free",   tag: "To explore",      bullets: ["15 credits (one-time)", "AI chat + hook/script generation", "Video analysis", "No connected accounts"] },
      maker:  { name: "Maker",  tag: "1 account",       bullets: ["1,000 credits/month", "1 Meta Ads account", "~33 applied improvements/month", "All AI tools included"] },
      pro:    { name: "Pro",    tag: "Up to 3 accounts",bullets: ["2,500 credits/month", "Up to 3 Meta Ads accounts", "~166 applied improvements/month", "Improvements cost 50% less"] },
      studio: { name: "Studio", tag: "No limits",       bullets: ["Unlimited credits", "Unlimited accounts", "Unlimited improvements", "Priority support"] },
    },
  },
  es: {
    nav_signin: "Entrar",
    hero_title: "Precios",
    hero_sub: "Pagas por el volumen de decisiones que la IA aplica en tu cuenta. Nada más.",
    toggle_monthly: "Mensual",
    toggle_annual: "Anual",
    toggle_save: "20% off",
    suffix_month: "/mes",
    suffix_annual: "/mes · facturado anualmente",
    popular: "Más elegido",
    cta_free: "Empezar gratis",
    cta_paid: "Probar 3 días gratis",
    trust: "3 días gratis en planes pagos · Cancela cuando quieras",
    faq_title: "Preguntas frecuentes",
    faq: [
      { q: "¿Cómo funcionan los créditos?", a: "El crédito es la unidad de consumo. Cada acción de IA — chat, generación de hook, análisis de video, mejora aplicada — consume una cantidad. Una mejora cuesta 30 créditos en Maker y 15 en Pro." },
      { q: "¿Puedo cambiar de plan?", a: "Sí. Los upgrades se aplican al instante con prorrateo. Los downgrades entran en el próximo ciclo. Sin cargos ni complicaciones." },
      { q: "¿Y si se acaban los créditos?", a: "La IA deja de consumir y te avisa. Tus datos y campañas siguen accesibles — solo pausa la automatización hasta el próximo ciclo o upgrade." },
      { q: "¿Vale la pena anual?", a: "Son 20% off directo. Si lo vas a usar 10 meses o más, sí. Si no, empieza mensual y cambia después." },
    ],
    footer_cta_title: "¿Listo para empezar?",
    footer_cta_sub: "3 días gratis, sin compromiso.",
    footer_cta_btn: "Crear cuenta",
    plans: {
      free:   { name: "Free",   tag: "Para explorar",   bullets: ["15 créditos (one-time)", "Chat IA + generación de hooks/scripts", "Análisis de video", "Sin cuentas conectadas"] },
      maker:  { name: "Maker",  tag: "1 cuenta",        bullets: ["1.000 créditos/mes", "1 cuenta de Meta Ads", "~33 mejoras aplicadas/mes", "Todas las herramientas de IA"] },
      pro:    { name: "Pro",    tag: "Hasta 3 cuentas", bullets: ["2.500 créditos/mes", "Hasta 3 cuentas de Meta Ads", "~166 mejoras aplicadas/mes", "Mejoras 50% más baratas"] },
      studio: { name: "Studio", tag: "Sin límites",     bullets: ["Créditos ilimitados", "Cuentas ilimitadas", "Mejoras ilimitadas", "Soporte prioritario"] },
    },
  },
};

// ── Stripe wiring ───────────────────────────────────────────────────────────
const PLANS = {
  maker:  {
    price_id_monthly: "price_1T9sd1Dr9So14XztT3Mqddch",
    price_id_annual:  "price_1T9sd1Dr9So14XztT3Mqddch",
    monthly: 19, annual: 15.2,
  },
  pro:    {
    price_id_monthly: "price_1T9sdfDr9So14XztPR3tI14Y",
    price_id_annual:  "price_1T9sdfDr9So14XztPR3tI14Y",
    monthly: 49, annual: 39.2,
  },
  studio: {
    price_id_monthly: "price_1TMzhCDr9So14Xzt1rUmfs7h",
    price_id_annual:  "price_1TMzhCDr9So14Xzt1rUmfs7h",
    monthly: 299, annual: 239.2,
  },
} as const;

// ── Component ────────────────────────────────────────────────────────────────
const Pricing = () => {
  const navigate = useNavigate();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const { language } = useLanguage();
  const lang: Lang = ["pt", "es"].includes(language) ? (language as Lang) : "en";
  const t = T[lang];

  const handleUpgrade = async (planKey: Exclude<PlanKey, "free">) => {
    const { data: { session } } = await supabase.auth.getSession();
    // Not logged in → route through signup, preserving billing preference
    if (!session) {
      const billingParam = cycle === "annual" ? "&billing=annual" : "";
      navigate(`/signup?plan=${planKey}${billingParam}`);
      return;
    }
    const plan = PLANS[planKey];
    if (!plan) return;
    setUpgrading(planKey);
    try {
      // Send monthly price_id + billing flag. Edge fn maps to annual via ANNUAL_PRICES.
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          price_id: plan.price_id_monthly,
          billing: cycle === "annual" ? "annual" : "monthly",
        },
      });

      if (error) {
        const errMsg = (error as any)?.message || "";
        const errData = (error as any)?.context?.body;
        let parsed: any = null;
        try { parsed = typeof errData === "string" ? JSON.parse(errData) : errData; } catch {}

        if (parsed?.error_code === "disposable_email") {
          toast.error(lang === "pt" ? "Email temporário não é aceito. Use um email permanente." :
                      lang === "es" ? "Email temporal no aceptado. Usa un email permanente." :
                      "Disposable email not accepted. Use a permanent email.");
        } else if (parsed?.error_code === "ip_rate_limit") {
          toast.error(lang === "pt" ? "Muitas tentativas. Tente novamente em algumas horas." :
                      lang === "es" ? "Demasiados intentos. Intenta en unas horas." :
                      "Too many attempts. Try again in a few hours.");
        } else {
          toast.error(lang === "pt" ? "Não conseguimos iniciar o checkout. Tente novamente." :
                      lang === "es" ? "No pudimos iniciar el checkout. Intenta de nuevo." :
                      "Couldn't start checkout. Please try again.",
                      { description: errMsg || parsed?.error });
        }
        return;
      }

      if (data?.url) { window.location.href = data.url; return; }

      toast.error(lang === "pt" ? "Resposta inesperada do servidor. Tente novamente." :
                  lang === "es" ? "Respuesta inesperada del servidor. Intenta de nuevo." :
                  "Unexpected server response. Please try again.");
    } catch (e) {
      toast.error(lang === "pt" ? "Erro de conexão. Verifique sua internet." :
                  lang === "es" ? "Error de conexión. Verifica tu internet." :
                  "Connection error. Check your internet.",
                  { description: e instanceof Error ? e.message : undefined });
    } finally { setUpgrading(null); }
  };

  const fmt = (n: number) =>
    lang === "en"
      ? `$${n % 1 === 0 ? n : n.toFixed(2)}`
      : `$${(n % 1 === 0 ? n.toString() : n.toFixed(2)).replace(".", ",")}`;

  const priceFor = (key: PlanKey): string => {
    if (key === "free") return "$0";
    const p = PLANS[key];
    return cycle === "annual" ? fmt(p.annual) : fmt(p.monthly);
  };

  const suffixFor = (key: PlanKey): string => {
    if (key === "free") return "";
    return cycle === "annual" ? t.suffix_annual : t.suffix_month;
  };

  const order: PlanKey[] = ["free", "maker", "pro", "studio"];

  return (
    <div style={{ fontFamily: F, background: BG, color: TEXT, minHeight: "100vh" }}>
      <style>{`
        .pricing-container { max-width: 1200px; margin: 0 auto; padding: 0 32px; }
        .pricing-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
        }
        .plan-card {
          background: ${SURFACE};
          border: 1px solid ${BORDER};
          border-radius: 16px;
          padding: 28px 24px;
          display: flex; flex-direction: column;
          position: relative;
          transition: transform .35s ${EASE}, border-color .35s ${EASE}, background .35s ${EASE};
        }
        .plan-card:hover { border-color: rgba(255,255,255,0.16); }
        .plan-card.featured {
          border-color: ${ACCENT};
          background: linear-gradient(180deg, rgba(14,165,233,0.08) 0%, ${SURFACE} 60%);
          box-shadow: 0 0 0 1px ${ACCENT}, 0 20px 60px -20px rgba(14,165,233,0.35);
        }
        .plan-cta {
          width: 100%; height: 44px; border-radius: 10px;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          font-weight: 600; font-size: 14px; cursor: pointer; transition: all .2s ${EASE};
          border: 1px solid ${BORDER}; background: transparent; color: ${TEXT};
        }
        .plan-cta:hover { border-color: rgba(255,255,255,0.24); background: rgba(255,255,255,0.03); }
        .plan-cta.primary { background: ${ACCENT}; border-color: ${ACCENT}; color: #001018; }
        .plan-cta.primary:hover { filter: brightness(1.08); }
        .plan-cta:disabled { opacity: .5; cursor: not-allowed; }
        .toggle-pill {
          display: inline-flex; padding: 4px; border-radius: 999px;
          background: ${SURFACE}; border: 1px solid ${BORDER};
        }
        .toggle-pill button {
          height: 36px; padding: 0 18px; border: 0; background: transparent; color: ${TEXT2};
          border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 600;
          display: inline-flex; align-items: center; gap: 8px;
          transition: all .2s ${EASE};
        }
        .toggle-pill button.active { background: ${TEXT}; color: #001018; }
        .save-badge {
          font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 999px;
          background: rgba(34,197,94,0.15); color: #4ade80; letter-spacing: .3px;
        }
        .faq-item { border-bottom: 1px solid ${BORDER}; }
        .faq-trigger {
          width: 100%; text-align: left; padding: 20px 0;
          display: flex; justify-content: space-between; align-items: center;
          background: transparent; border: 0; color: ${TEXT}; cursor: pointer;
          font-size: 15px; font-weight: 500;
        }
        .faq-body {
          overflow: hidden; transition: max-height .35s ${EASE}, opacity .25s ${EASE};
          color: ${TEXT2}; font-size: 14px; line-height: 1.65;
        }
        @media (max-width: 960px) {
          .pricing-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 560px) {
          .pricing-container { padding: 0 20px; }
          .pricing-grid { grid-template-columns: 1fr; gap: 12px; }
          .plan-card { padding: 24px 20px; }
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
          className="pricing-container"
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

      {/* ── Hero + toggle ──────────────────────────────────────── */}
      <section className="pricing-container" style={{ paddingTop: 96, paddingBottom: 48, textAlign: "center" }}>
        <h1
          style={{
            fontSize: "clamp(40px, 5vw, 56px)", fontWeight: 700,
            letterSpacing: "-0.025em", margin: 0, lineHeight: 1.05,
          }}
        >
          {t.hero_title}
        </h1>
        <p
          style={{
            marginTop: 18, fontSize: 17, lineHeight: 1.55, color: TEXT2,
            maxWidth: 560, marginLeft: "auto", marginRight: "auto",
          }}
        >
          {t.hero_sub}
        </p>

        <div style={{ marginTop: 36, display: "flex", justifyContent: "center" }}>
          <div className="toggle-pill" role="tablist" aria-label="Billing cycle">
            <button
              role="tab"
              aria-selected={cycle === "monthly"}
              className={cycle === "monthly" ? "active" : ""}
              onClick={() => setCycle("monthly")}
            >
              {t.toggle_monthly}
            </button>
            <button
              role="tab"
              aria-selected={cycle === "annual"}
              className={cycle === "annual" ? "active" : ""}
              onClick={() => setCycle("annual")}
            >
              {t.toggle_annual}
              <span className="save-badge">{t.toggle_save}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Plan cards ─────────────────────────────────────────── */}
      <section className="pricing-container" style={{ paddingBottom: 40 }}>
        <div className="pricing-grid">
          {order.map((key) => {
            const plan = t.plans[key];
            const featured = key === "pro";
            const isFree = key === "free";
            return (
              <div key={key} className={`plan-card${featured ? " featured" : ""}`}>
                {featured && (
                  <div
                    style={{
                      position: "absolute", top: -11, left: 24,
                      fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                      padding: "4px 10px", borderRadius: 999,
                      background: ACCENT, color: "#001018",
                    }}
                  >
                    {t.popular}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>{plan.name}</div>
                  <div style={{ fontSize: 12, color: TEXT3, marginTop: 4 }}>{plan.tag}</div>
                </div>

                <div style={{ marginTop: 20, display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em" }}>{priceFor(key)}</span>
                  {!isFree && (
                    <span style={{ fontSize: 12, color: TEXT3 }}>{suffixFor(key)}</span>
                  )}
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "24px 0 0 0", flex: 1 }}>
                  {plan.bullets.map((b, i) => (
                    <li
                      key={i}
                      style={{
                        display: "flex", gap: 10, alignItems: "flex-start",
                        fontSize: 13.5, color: TEXT, lineHeight: 1.5,
                        padding: "8px 0",
                      }}
                    >
                      <Check size={14} style={{ color: ACCENT, flexShrink: 0, marginTop: 3 }} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <div style={{ marginTop: 24 }}>
                  {isFree ? (
                    <button className="plan-cta" onClick={() => navigate("/signup")}>
                      {t.cta_free}
                    </button>
                  ) : (
                    <button
                      className={`plan-cta${featured ? " primary" : ""}`}
                      disabled={upgrading === key}
                      onClick={() => handleUpgrade(key as Exclude<PlanKey, "free">)}
                    >
                      {upgrading === key ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>
                          {t.cta_paid}
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: TEXT3 }}>
          {t.trust}
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────── */}
      <section className="pricing-container" style={{ paddingTop: 80, paddingBottom: 48, maxWidth: 760 }}>
        <h2
          style={{
            fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em",
            margin: "0 0 24px 0", textAlign: "center",
          }}
        >
          {t.faq_title}
        </h2>
        <div>
          {t.faq.map((item, i) => {
            const open = expandedFaq === i;
            return (
              <div key={i} className="faq-item">
                <button
                  className="faq-trigger"
                  aria-expanded={open}
                  onClick={() => setExpandedFaq(open ? null : i)}
                >
                  {item.q}
                  <ChevronDown
                    size={18}
                    style={{
                      color: TEXT2,
                      transform: open ? "rotate(180deg)" : "rotate(0)",
                      transition: `transform .3s ${EASE}`,
                    }}
                  />
                </button>
                <div
                  className="faq-body"
                  style={{
                    maxHeight: open ? 240 : 0,
                    opacity: open ? 1 : 0,
                    paddingBottom: open ? 20 : 0,
                  }}
                >
                  {item.a}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Footer CTA ─────────────────────────────────────────── */}
      <section className="pricing-container" style={{ paddingTop: 48, paddingBottom: 120, textAlign: "center" }}>
        <h3 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
          {t.footer_cta_title}
        </h3>
        <p style={{ color: TEXT2, fontSize: 15, margin: "10px 0 24px" }}>
          {t.footer_cta_sub}
        </p>
        <button
          className="plan-cta primary"
          style={{ width: "auto", padding: "0 28px" }}
          onClick={() => navigate("/signup")}
        >
          {t.footer_cta_btn}
          <ArrowRight size={14} />
        </button>
      </section>
    </div>
  );
};

export default Pricing;
