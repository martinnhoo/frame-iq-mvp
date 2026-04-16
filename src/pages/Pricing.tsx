import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Shield, HelpCircle, X, Loader2, Zap, Crown, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Lang = "en" | "pt" | "es";

/* ── Design tokens (aligned with dashboard & landing) ────────────────────── */
const BRAND = "#0ea5e9";
const F = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

/* ── Translations ─────────────────────────────────────────────────────────── */
const T: Record<Lang, Record<string, any>> = {
  en: {
    nav_signin: "Sign in",
    hero_title: "Simple, transparent pricing",
    hero_sub: "3-day free trial on all plans. Card required. No charge until day 4. Cancel anytime.",
    monthly: "Monthly",
    annual: "Annual",
    save_badge: "Save 20%",

    // Plan names & descriptions
    plan_free_name: "Free",
    plan_maker_name: "Maker",
    plan_pro_name: "Pro",
    plan_studio_name: "Studio",
    plan_free_desc: "Preview the platform before committing.",
    plan_maker_desc: "For solo advertisers managing one brand.",
    plan_pro_desc: "For media buyers running multiple accounts.",
    plan_studio_desc: "For agencies and teams at scale.",

    // Key metrics
    metric_credits: "credits",
    metric_improvements: "improvements",
    metric_accounts: "ad account",
    metric_accounts_plural: "ad accounts",
    metric_unlimited: "Unlimited",
    metric_all_tools: "All tools included",
    metric_per_improvement: "per improvement",

    // Feature labels
    feat_free_1: "15 credits to explore",
    feat_free_2: "Connect Meta Ads account",
    feat_free_3: "AI Chat, Hooks, Scripts & more",
    feat_free_4: "No real-time actions",

    feat_maker_1: "1 ad account",
    feat_maker_2: "~33 improvements/mo",
    feat_maker_3: "All AI tools unlocked",
    feat_maker_4: "30 credits per improvement",

    feat_pro_1: "3 ad accounts",
    feat_pro_2: "~166 improvements/mo",
    feat_pro_3: "All AI tools unlocked",
    feat_pro_4: "15 credits per improvement",
    feat_pro_5: "50% cheaper actions",

    feat_studio_1: "Unlimited ad accounts",
    feat_studio_2: "Unlimited improvements",
    feat_studio_3: "Unlimited credits",
    feat_studio_4: "Priority support",
    feat_studio_5: "Dedicated onboarding",

    // Badges
    badge_popular: "Most Popular",
    badge_agencies: "For Agencies",
    badge_discount_pro: "50% off per action",
    badge_unlimited: "Everything unlimited",

    // CTAs
    cta_free: "Get started",
    cta_trial: "Start free trial",
    cta_contact: "Contact sales",

    // Improvements explainer
    explainer_title: "What are improvements?",
    explainer_body: "Improvements are real actions on your ad account — pause underperforming campaigns, scale winners, adjust budgets, activate new ads, and more. Every improvement is tracked and costs credits. The higher your plan, the cheaper each improvement gets.",
    explainer_examples: "Pause campaign · Scale budget · Activate ad · Stop loss · Fix targeting",

    // FAQ
    faq_title: "Frequently Asked Questions",
    faq_1_q: "Can I cancel anytime?",
    faq_1_a: "Yes. All plans are month-to-month with no long-term contracts. Cancel or downgrade anytime from your account settings.",
    faq_2_q: "What happens when I run out of credits?",
    faq_2_a: "You'll see a warning as you approach the limit. Credits reset on the 1st of each month. You can upgrade anytime for more capacity.",
    faq_3_q: "Do all tools use credits?",
    faq_3_a: "Yes. AI Chat, video analysis, hooks, scripts, and improvements all consume credits from your monthly pool. The ~ symbol indicates that the exact number of improvements depends on how you use your other tools.",
    faq_4_q: "Is there a free trial?",
    faq_4_a: "Yes. All paid plans come with a 3-day free trial. No charge until the trial ends. Cancel anytime.",
    faq_5_q: "Why is Studio a different price?",
    faq_5_a: "Studio is built for agencies managing multiple brands. Unlimited accounts, unlimited credits, and unlimited improvements — no caps, no surprises. The ROI of one prevented bad decision pays for itself.",
    faq_6_q: "Is my data secure?",
    faq_6_a: "Yes. AdBrief uses 256-bit encryption at rest and in transit. We never share or sell your data.",

    // Trust
    trust_encryption: "256-bit Encryption",
    trust_gdpr: "GDPR Ready",
    trust_uptime: "99.9% Uptime SLA",
    trust_guarantee: "30-day money-back",

    // Bottom CTA
    cta_questions_title: "Still have questions?",
    cta_questions_sub: "Talk to our team. We'll help you find the right plan.",
    cta_book_demo: "Book a demo",
    cta_contact_sales: "Contact sales",

    // Footer
    footer_prices: "Prices shown in USD. All paid plans include a 3-day free trial. Annual plans billed as one payment. Cancel at any time before the trial expires.",
    footer_copyright: "© 2026 AdBrief. All rights reserved.",
    footer_privacy: "Privacy Policy",
    footer_terms: "Terms of Service",
    footer_refund: "Refund Policy",

    period_month: "/mo",
    period_year: "/year",
  },
  pt: {
    nav_signin: "Entrar",
    hero_title: "Preços simples e transparentes",
    hero_sub: "Teste gratuito de 3 dias em todos os planos. Cartão obrigatório. Sem cobranças até o 4º dia. Cancele quando quiser.",
    monthly: "Mensal",
    annual: "Anual",
    save_badge: "Economize 20%",

    plan_free_name: "Gratuito",
    plan_maker_name: "Maker",
    plan_pro_name: "Pro",
    plan_studio_name: "Studio",
    plan_free_desc: "Conheça a plataforma antes de assinar.",
    plan_maker_desc: "Para anunciantes solo gerenciando uma marca.",
    plan_pro_desc: "Para gestores rodando múltiplas contas.",
    plan_studio_desc: "Para agências e times em escala.",

    metric_credits: "créditos",
    metric_improvements: "melhorias",
    metric_accounts: "conta de anúncios",
    metric_accounts_plural: "contas de anúncios",
    metric_unlimited: "Ilimitado",
    metric_all_tools: "Todas as ferramentas inclusas",
    metric_per_improvement: "por melhoria",

    feat_free_1: "15 créditos para explorar",
    feat_free_2: "Conecte sua conta Meta Ads",
    feat_free_3: "Chat IA, Hooks, Scripts e mais",
    feat_free_4: "Sem ações em tempo real",

    feat_maker_1: "1 conta de anúncios",
    feat_maker_2: "~33 melhorias/mês",
    feat_maker_3: "Todas as ferramentas IA",
    feat_maker_4: "30 créditos por melhoria",

    feat_pro_1: "3 contas de anúncios",
    feat_pro_2: "~166 melhorias/mês",
    feat_pro_3: "Todas as ferramentas IA",
    feat_pro_4: "15 créditos por melhoria",
    feat_pro_5: "Ações 50% mais baratas",

    feat_studio_1: "Contas ilimitadas",
    feat_studio_2: "Melhorias ilimitadas",
    feat_studio_3: "Créditos ilimitados",
    feat_studio_4: "Suporte prioritário",
    feat_studio_5: "Onboarding dedicado",

    badge_popular: "Mais Popular",
    badge_agencies: "Para Agências",
    badge_discount_pro: "50% off por ação",
    badge_unlimited: "Tudo ilimitado",

    cta_free: "Começar",
    cta_trial: "Iniciar teste gratuito",
    cta_contact: "Falar com vendas",

    explainer_title: "O que são melhorias?",
    explainer_body: "Melhorias são ações reais na sua conta de anúncios — pausar campanhas ruins, escalar vencedoras, ajustar budgets, ativar novos anúncios e mais. Cada melhoria é rastreada e consome créditos. Quanto maior seu plano, mais barato fica cada melhoria.",
    explainer_examples: "Pausar campanha · Escalar budget · Ativar anúncio · Stop loss · Corrigir segmentação",

    faq_title: "Perguntas Frequentes",
    faq_1_q: "Posso cancelar a qualquer momento?",
    faq_1_a: "Sim. Todos os planos são mês a mês. Cancele ou faça downgrade quando quiser nas configurações da conta.",
    faq_2_q: "O que acontece quando os créditos acabam?",
    faq_2_a: "Você verá um aviso conforme se aproxima do limite. Os créditos renovam no dia 1 de cada mês. Faça upgrade a qualquer momento para mais capacidade.",
    faq_3_q: "Todas as ferramentas usam créditos?",
    faq_3_a: "Sim. Chat IA, análise de vídeo, hooks, scripts e melhorias consomem créditos do seu pool mensal. O símbolo ~ indica que o número exato de melhorias depende de como você usa as outras ferramentas.",
    faq_4_q: "Tem teste gratuito?",
    faq_4_a: "Sim. Todos os planos pagos vêm com 3 dias de teste gratuito. Sem cobranças até o final. Cancele quando quiser.",
    faq_5_q: "Por que o Studio tem outro preço?",
    faq_5_a: "Studio é feito para agências gerenciando múltiplas marcas. Contas, créditos e melhorias ilimitadas — sem tetos, sem surpresas. O ROI de uma decisão ruim evitada já paga o plano.",
    faq_6_q: "Meus dados são seguros?",
    faq_6_a: "Sim. O AdBrief usa criptografia de 256 bits. Nunca compartilhamos ou vendemos seus dados.",

    trust_encryption: "Criptografia de 256 bits",
    trust_gdpr: "GDPR Pronto",
    trust_uptime: "SLA de 99,9% Uptime",
    trust_guarantee: "Garantia de devolução de 30 dias",

    cta_questions_title: "Ainda tem dúvidas?",
    cta_questions_sub: "Fale com nosso time. Vamos ajudar a encontrar o plano certo.",
    cta_book_demo: "Agendar demonstração",
    cta_contact_sales: "Contatar vendas",

    footer_prices: "Preços exibidos em USD. Todos os planos pagos incluem teste gratuito de 3 dias. Planos anuais faturados em pagamento único. Cancele a qualquer momento.",
    footer_copyright: "© 2026 AdBrief. Todos os direitos reservados.",
    footer_privacy: "Política de Privacidade",
    footer_terms: "Termos de Serviço",
    footer_refund: "Política de Reembolso",

    period_month: "/mês",
    period_year: "/ano",
  },
  es: {
    nav_signin: "Iniciar sesión",
    hero_title: "Precios simples y transparentes",
    hero_sub: "Prueba gratuita de 3 días en todos los planes. Tarjeta requerida. Sin cargos hasta el día 4. Cancela en cualquier momento.",
    monthly: "Mensual",
    annual: "Anual",
    save_badge: "Ahorra 20%",

    plan_free_name: "Gratuito",
    plan_maker_name: "Maker",
    plan_pro_name: "Pro",
    plan_studio_name: "Studio",
    plan_free_desc: "Explora la plataforma antes de suscribirte.",
    plan_maker_desc: "Para anunciantes solo gestionando una marca.",
    plan_pro_desc: "Para gestores operando múltiples cuentas.",
    plan_studio_desc: "Para agencias y equipos a escala.",

    metric_credits: "créditos",
    metric_improvements: "mejoras",
    metric_accounts: "cuenta de anuncios",
    metric_accounts_plural: "cuentas de anuncios",
    metric_unlimited: "Ilimitado",
    metric_all_tools: "Todas las herramientas incluidas",
    metric_per_improvement: "por mejora",

    feat_free_1: "15 créditos para explorar",
    feat_free_2: "Conecta tu cuenta Meta Ads",
    feat_free_3: "Chat IA, Hooks, Scripts y más",
    feat_free_4: "Sin acciones en tiempo real",

    feat_maker_1: "1 cuenta de anuncios",
    feat_maker_2: "~33 mejoras/mes",
    feat_maker_3: "Todas las herramientas IA",
    feat_maker_4: "30 créditos por mejora",

    feat_pro_1: "3 cuentas de anuncios",
    feat_pro_2: "~166 mejoras/mes",
    feat_pro_3: "Todas las herramientas IA",
    feat_pro_4: "15 créditos por mejora",
    feat_pro_5: "Acciones 50% más baratas",

    feat_studio_1: "Cuentas ilimitadas",
    feat_studio_2: "Mejoras ilimitadas",
    feat_studio_3: "Créditos ilimitados",
    feat_studio_4: "Soporte prioritario",
    feat_studio_5: "Onboarding dedicado",

    badge_popular: "Más Popular",
    badge_agencies: "Para Agencias",
    badge_discount_pro: "50% off por acción",
    badge_unlimited: "Todo ilimitado",

    cta_free: "Comenzar",
    cta_trial: "Iniciar prueba gratuita",
    cta_contact: "Hablar con ventas",

    explainer_title: "¿Qué son las mejoras?",
    explainer_body: "Las mejoras son acciones reales en tu cuenta de anuncios — pausar campañas malas, escalar ganadoras, ajustar presupuestos, activar nuevos anuncios y más. Cada mejora se rastrea y consume créditos. Cuanto mayor tu plan, más barato cada mejora.",
    explainer_examples: "Pausar campaña · Escalar presupuesto · Activar anuncio · Stop loss · Corregir segmentación",

    faq_title: "Preguntas Frecuentes",
    faq_1_q: "¿Puedo cancelar en cualquier momento?",
    faq_1_a: "Sí. Todos los planes son mes a mes. Cancela o degrada cuando quieras desde la configuración de tu cuenta.",
    faq_2_q: "¿Qué pasa cuando se agotan los créditos?",
    faq_2_a: "Verás una advertencia al acercarte al límite. Los créditos se renuevan el 1 de cada mes. Actualiza en cualquier momento para más capacidad.",
    faq_3_q: "¿Todas las herramientas usan créditos?",
    faq_3_a: "Sí. Chat IA, análisis de video, hooks, scripts y mejoras consumen créditos de tu pool mensual. El símbolo ~ indica que el número exacto depende de cómo uses las otras herramientas.",
    faq_4_q: "¿Hay prueba gratuita?",
    faq_4_a: "Sí. Todos los planes pagos incluyen 3 días de prueba gratuita. Sin cargos hasta que termine. Cancela cuando quieras.",
    faq_5_q: "¿Por qué Studio tiene otro precio?",
    faq_5_a: "Studio está hecho para agencias gestionando múltiples marcas. Cuentas, créditos y mejoras ilimitadas — sin topes, sin sorpresas. El ROI de una mala decisión evitada ya paga el plan.",
    faq_6_q: "¿Mis datos son seguros?",
    faq_6_a: "Sí. AdBrief usa cifrado de 256 bits. Nunca compartimos ni vendemos tus datos.",

    trust_encryption: "Cifrado de 256 bits",
    trust_gdpr: "GDPR Listo",
    trust_uptime: "SLA de 99,9% Uptime",
    trust_guarantee: "Garantía de devolución de 30 días",

    cta_questions_title: "¿Aún tienes preguntas?",
    cta_questions_sub: "Habla con nuestro equipo. Te ayudaremos a encontrar el plan adecuado.",
    cta_book_demo: "Reservar demostración",
    cta_contact_sales: "Contactar ventas",

    footer_prices: "Precios en USD. Todos los planes pagos incluyen prueba gratuita de 3 días. Planes anuales facturados como pago único. Cancela en cualquier momento.",
    footer_copyright: "© 2026 AdBrief. Todos los derechos reservados.",
    footer_privacy: "Política de Privacidad",
    footer_terms: "Términos de Servicio",
    footer_refund: "Política de Reembolso",

    period_month: "/mes",
    period_year: "/año",
  },
};

/* ── Stripe product/price mapping ─────────────────────────────────────────── */
const PLANS = {
  maker:  { product_id: "prod_U88ul5IK0HHW19", price_id: "price_1T9sd1Dr9So14XztT3Mqddch" },
  pro:    { product_id: "prod_U88v5WVcy2NZV7", price_id: "price_1T9sdfDr9So14XztPR3tI14Y" },
  studio: { product_id: "prod_U88wpX4Bphfifi", price_id: "price_1TMzhCDr9So14Xzt1rUmfs7h" },
};

/* ── Component ────────────────────────────────────────────────────────────── */
const Pricing = () => {
  const navigate = useNavigate();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [annual, setAnnual] = useState(false);
  const { language } = useLanguage();
  const lang: Lang = ["pt", "es"].includes(language) ? language as Lang : "en";
  const t = T[lang];

  const monthlyPrices = { maker: 19, pro: 49, studio: 299 };
  const annualTotals  = { maker: 182, pro: 470, studio: 2870 };

  const handleUpgrade = async (planKey: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate(`/signup?plan=${planKey}${annual ? "&billing=annual" : ""}`);
      return;
    }
    const plan = PLANS[planKey as keyof typeof PLANS];
    if (!plan) return;
    setUpgrading(planKey);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { price_id: plan.price_id, billing: annual ? "annual" : undefined }
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else toast.error("Could not create checkout session");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setUpgrading(null);
    }
  };

  const faqs = [
    { q: t.faq_1_q, a: t.faq_1_a },
    { q: t.faq_2_q, a: t.faq_2_a },
    { q: t.faq_3_q, a: t.faq_3_a },
    { q: t.faq_4_q, a: t.faq_4_a },
    { q: t.faq_5_q, a: t.faq_5_a },
    { q: t.faq_6_q, a: t.faq_6_a },
  ];

  /* ── Shared card styles ──────────────────────────────────────────────────── */
  const cardBase: React.CSSProperties = {
    borderRadius: 16, padding: "32px 24px", display: "flex", flexDirection: "column",
    transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)", position: "relative", overflow: "hidden",
  };

  const btnBase: React.CSSProperties = {
    fontFamily: F, fontSize: 14, fontWeight: 700, padding: "12px 0", borderRadius: 10,
    border: "none", cursor: "pointer", width: "100%", transition: "all 0.2s",
    letterSpacing: "-0.01em",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#070d1a", color: "#F0F6FC", fontFamily: F }}>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/"><Logo size="lg" /></Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LanguageSwitcher />
            <button onClick={() => navigate("/login")}
              style={{ fontFamily: F, fontSize: 14, color: "rgba(255,255,255,0.5)", background: "none", border: "none", cursor: "pointer" }}>
              {t.nav_signin}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: "72px 24px 48px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.15, margin: "0 0 12px" }}>
            {t.hero_title}
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: "0 0 28px" }}>
            {t.hero_sub}
          </p>

          {/* Annual/Monthly toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: !annual ? "#fff" : "rgba(255,255,255,0.35)" }}>{t.monthly}</span>
            <button onClick={() => setAnnual(v => !v)}
              style={{
                position: "relative", width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                background: annual ? "linear-gradient(135deg, #0ea5e9, #06b6d4)" : "rgba(255,255,255,0.12)",
                transition: "background 0.2s",
              }}>
              <span style={{
                position: "absolute", top: 2, width: 20, height: 20, borderRadius: 10, background: "#fff",
                transition: "left 0.2s", left: annual ? 22 : 2, boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
              }} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, color: annual ? "#fff" : "rgba(255,255,255,0.35)" }}>{t.annual}</span>
            {annual && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", background: "rgba(52,211,153,0.1)", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(52,211,153,0.2)" }}>
                {t.save_badge}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── Plan Cards ────────────────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Top row: Free + Maker + Pro */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 20 }}>

            {/* ── FREE ─────────────────────────────────────────────────────── */}
            <div style={{
              ...cardBase,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.45)", marginBottom: 12 }}>{t.plan_free_name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                  <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.04em" }}>$0</span>
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{t.plan_free_desc}</div>
              </div>

              {/* Key metric */}
              <div style={{
                padding: "12px 14px", borderRadius: 10, marginBottom: 20,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
              }}>
                <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>15</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginLeft: 6 }}>{t.metric_credits}</span>
              </div>

              <div style={{ flex: 1 }}>
                {[t.feat_free_1, t.feat_free_2, t.feat_free_3].map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                    <Check size={14} style={{ color: "#34d399", marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                  <X size={14} style={{ color: "rgba(255,255,255,0.2)", marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>{t.feat_free_4}</span>
                </div>
              </div>

              <button onClick={() => navigate("/signup")}
                style={{ ...btnBase, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}>
                {t.cta_free}
              </button>
            </div>

            {/* ── MAKER ────────────────────────────────────────────────────── */}
            <div style={{
              ...cardBase,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: BRAND, marginBottom: 12 }}>{t.plan_maker_name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                  <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.04em" }}>
                    ${annual ? Math.round(annualTotals.maker / 12) : monthlyPrices.maker}
                  </span>
                  <span style={{ fontSize: 15, color: "rgba(255,255,255,0.4)" }}>{t.period_month}</span>
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{t.plan_maker_desc}</div>
              </div>

              {/* Key metrics */}
              <div style={{
                padding: "12px 14px", borderRadius: 10, marginBottom: 20,
                background: "rgba(14,165,233,0.04)", border: "1px solid rgba(14,165,233,0.10)",
              }}>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>~33</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginLeft: 6 }}>{t.metric_improvements}{lang !== "en" ? "/"+t.period_month.replace("/","") : "/mo"}</span>
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)" }}>
                  30 {t.metric_credits} {t.metric_per_improvement} · 1,000 {t.metric_credits} {lang === "en" ? "total" : "total"}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                {[t.feat_maker_1, t.feat_maker_2, t.feat_maker_3, t.feat_maker_4].map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                    <Check size={14} style={{ color: "#34d399", marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => handleUpgrade("maker")} disabled={upgrading !== null}
                style={{ ...btnBase, background: "rgba(14,165,233,0.12)", color: BRAND, border: `1px solid rgba(14,165,233,0.25)` }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(14,165,233,0.20)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(14,165,233,0.12)"; }}>
                {upgrading === "maker" && <Loader2 size={14} style={{ marginRight: 6, animation: "spin 1s linear infinite" }} />}
                {t.cta_trial}
              </button>
            </div>

            {/* ── PRO (highlighted) ────────────────────────────────────────── */}
            <div style={{
              ...cardBase,
              background: "linear-gradient(165deg, rgba(14,165,233,0.06) 0%, rgba(99,102,241,0.04) 100%)",
              border: "1px solid rgba(14,165,233,0.25)",
              boxShadow: "0 0 40px rgba(14,165,233,0.08), 0 8px 32px rgba(0,0,0,0.2)",
            }}>
              {/* Badge */}
              <div style={{
                position: "absolute", top: 0, right: 0,
                background: "linear-gradient(135deg, #0ea5e9, #6366f1)", color: "#fff",
                fontSize: 11, fontWeight: 700, padding: "6px 16px 6px 14px",
                borderRadius: "0 16px 0 12px", letterSpacing: "0.02em",
              }}>
                {t.badge_popular}
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: BRAND, marginBottom: 12 }}>{t.plan_pro_name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                  <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.04em" }}>
                    ${annual ? Math.round(annualTotals.pro / 12) : monthlyPrices.pro}
                  </span>
                  <span style={{ fontSize: 15, color: "rgba(255,255,255,0.4)" }}>{t.period_month}</span>
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{t.plan_pro_desc}</div>
              </div>

              {/* Key metrics */}
              <div style={{
                padding: "12px 14px", borderRadius: 10, marginBottom: 20,
                background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.15)",
              }}>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>~166</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginLeft: 6 }}>{t.metric_improvements}{lang !== "en" ? "/"+t.period_month.replace("/","") : "/mo"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "rgba(255,255,255,0.30)" }}>
                  <span>15 {t.metric_credits} {t.metric_per_improvement} · 2,500 {t.metric_credits} total</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "#34d399", background: "rgba(52,211,153,0.1)",
                    padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(52,211,153,0.15)",
                  }}>
                    {t.badge_discount_pro}
                  </span>
                </div>
              </div>

              <div style={{ flex: 1 }}>
                {[t.feat_pro_1, t.feat_pro_2, t.feat_pro_3, t.feat_pro_4, t.feat_pro_5].map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                    <Check size={14} style={{ color: "#34d399", marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => handleUpgrade("pro")} disabled={upgrading !== null}
                style={{
                  ...btnBase, color: "#fff",
                  background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
                  boxShadow: "0 0 20px rgba(14,165,233,0.25)",
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 32px rgba(14,165,233,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 20px rgba(14,165,233,0.25)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                {upgrading === "pro" && <Loader2 size={14} style={{ marginRight: 6, animation: "spin 1s linear infinite" }} />}
                {t.cta_trial}
              </button>
            </div>
          </div>

          {/* ── STUDIO — full-width premium card ──────────────────────────── */}
          <div style={{
            ...cardBase,
            background: "linear-gradient(135deg, rgba(168,85,247,0.06) 0%, rgba(236,72,153,0.04) 40%, rgba(14,165,233,0.04) 100%)",
            border: "1px solid rgba(168,85,247,0.20)",
            boxShadow: "0 0 60px rgba(168,85,247,0.08), 0 0 120px rgba(236,72,153,0.04), 0 12px 48px rgba(0,0,0,0.25)",
            flexDirection: "row", flexWrap: "wrap", gap: 32,
            padding: "40px 36px",
          }}>
            {/* Decorative gradient orb */}
            <div style={{
              position: "absolute", top: -80, right: -80, width: 260, height: 260, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", bottom: -60, left: -60, width: 200, height: 200, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />

            {/* Left side — info */}
            <div style={{ flex: "1 1 320px", minWidth: 280, position: "relative" }}>
              {/* Badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16,
                background: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(236,72,153,0.10))",
                border: "1px solid rgba(168,85,247,0.25)", borderRadius: 8, padding: "5px 12px",
              }}>
                <Crown size={12} style={{ color: "#a855f7" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#c084fc", letterSpacing: "0.04em" }}>{t.badge_agencies}</span>
              </div>

              <div style={{ fontSize: 15, fontWeight: 600, color: "#c084fc", marginBottom: 12 }}>{t.plan_studio_name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.04em", background: "linear-gradient(135deg, #c084fc, #f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  ${annual ? Math.round(annualTotals.studio / 12) : monthlyPrices.studio}
                </span>
                <span style={{ fontSize: 16, color: "rgba(255,255,255,0.35)" }}>{t.period_month}</span>
              </div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, maxWidth: 400, margin: "0 0 24px" }}>
                {t.plan_studio_desc}
              </p>

              <button onClick={() => handleUpgrade("studio")} disabled={upgrading !== null}
                style={{
                  ...btnBase, width: "auto", padding: "14px 40px", color: "#fff",
                  background: "linear-gradient(135deg, #a855f7, #ec4899)",
                  boxShadow: "0 0 24px rgba(168,85,247,0.3), 0 0 48px rgba(236,72,153,0.15)",
                  fontSize: 15,
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 40px rgba(168,85,247,0.45), 0 0 64px rgba(236,72,153,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 24px rgba(168,85,247,0.3), 0 0 48px rgba(236,72,153,0.15)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                {upgrading === "studio" && <Loader2 size={14} style={{ marginRight: 6, animation: "spin 1s linear infinite" }} />}
                {t.cta_trial}
              </button>
            </div>

            {/* Right side — features */}
            <div style={{ flex: "1 1 280px", minWidth: 240, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
              {/* Unlimited badge */}
              <div style={{
                padding: "14px 18px", borderRadius: 12, marginBottom: 20,
                background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <Sparkles size={18} style={{ color: "#c084fc" }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#F0F6FC", letterSpacing: "-0.01em" }}>{t.badge_unlimited}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                    {t.metric_credits} · {t.metric_improvements} · {lang === "en" ? "ad accounts" : lang === "pt" ? "contas" : "cuentas"}
                  </div>
                </div>
              </div>

              {[t.feat_studio_1, t.feat_studio_2, t.feat_studio_3, t.feat_studio_4, t.feat_studio_5].map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                  <Check size={14} style={{ color: "#c084fc", marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Improvements Explainer ─────────────────────────────────────────── */}
      <section style={{ padding: "48px 24px 0" }}>
        <div style={{
          maxWidth: 700, margin: "0 auto", padding: "28px 28px", borderRadius: 14,
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Zap size={16} style={{ color: BRAND }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>{t.explainer_title}</h3>
          </div>
          <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, margin: "0 0 14px" }}>
            {t.explainer_body}
          </p>
          <div style={{
            fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "monospace",
            padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)", letterSpacing: "0.02em",
          }}>
            {t.explainer_examples}
          </div>
        </div>
      </section>

      {/* ── Trust badges ──────────────────────────────────────────────────── */}
      <section style={{ padding: "48px 24px 0" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 24 }}>
          {[t.trust_encryption, t.trust_gdpr, t.trust_uptime, t.trust_guarantee].map((badge, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
              <Shield size={14} style={{ color: "#34d399" }} />
              {badge}
            </span>
          ))}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section style={{ padding: "56px 24px 0" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, textAlign: "center", marginBottom: 36, letterSpacing: "-0.02em" }}>{t.faq_title}</h2>
          {faqs.map((faq, i) => (
            <div key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 24, marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <HelpCircle size={14} style={{ color: BRAND, marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>{faq.q}</span>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, margin: 0, paddingLeft: 22 }}>{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section style={{ padding: "48px 24px" }}>
        <div style={{
          maxWidth: 700, margin: "0 auto", padding: "48px 36px", borderRadius: 20, textAlign: "center",
          background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(236,72,153,0.06))",
          border: "1px solid rgba(139,92,246,0.15)",
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 10, letterSpacing: "-0.02em" }}>{t.cta_questions_title}</h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>{t.cta_questions_sub}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => navigate("/book-demo")}
              style={{
                fontFamily: F, fontSize: 14, fontWeight: 700, padding: "12px 28px", borderRadius: 10, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #0ea5e9, #6366f1)", color: "#fff",
                display: "flex", alignItems: "center", gap: 6,
              }}>
              {t.cta_book_demo}
              <ArrowRight size={14} />
            </button>
            <button onClick={() => navigate("/contact")}
              style={{
                fontFamily: F, fontSize: 14, fontWeight: 600, padding: "12px 28px", borderRadius: 10, cursor: "pointer",
                background: "none", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)",
              }}>
              {t.cta_contact_sales}
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "32px 24px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", lineHeight: 1.8, marginBottom: 8 }}>
            {t.footer_prices}
          </p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
            {t.footer_copyright}
            {" · "}
            <Link to="/privacy" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>{t.footer_privacy}</Link>
            {" · "}
            <Link to="/terms" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>{t.footer_terms}</Link>
            {" · "}
            <Link to="/refund" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>{t.footer_refund}</Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
