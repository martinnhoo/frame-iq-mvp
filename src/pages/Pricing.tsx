// Pricing.tsx — Detailed pricing page · Clarity removes hesitation
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Loader2, ChevronDown, Shield, Zap, BarChart3, TrendingUp, Clock, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Lang = "en" | "pt" | "es";

const F = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const BG = "#070d1a";
const BG2 = "#0a1020";
const SURFACE = "#0d1117";
const ACCENT = "#0ea5e9";
const TEXT = "#f0f2f8";
const TEXT2 = "rgba(255,255,255,0.55)";
const TEXT3 = "rgba(255,255,255,0.35)";
const BORDER = "rgba(255,255,255,0.06)";
const GREEN = "#22c55e";
const INDIGO = "#6366f1";
const EASE = "cubic-bezier(0.16,1,0.3,1)";

// ── Translations ─────────────────────────────────────────────────────────────
const T: Record<Lang, Record<string, any>> = {
  pt: {
    nav_signin: "Entrar",
    // S1 — what you pay for
    s1_title: "Você não paga por acesso.",
    s1_title2: "Você paga por ação.",
    s1_body: "Cada melhoria é uma ação aplicada diretamente na sua campanha. Isso inclui: pausar anúncios com baixo desempenho, escalar o que está performando, ajustar criativos com potencial e aplicar recomendações com base em dados reais.",
    s1_final: "Você não paga por análise. Você paga pelo que melhora sua campanha.",
    // S2 — what's included
    s2_title: "O que está incluído",
    s2_items: [
      { title: "Análise contínua", desc: "Suas campanhas são monitoradas 24/7. O sistema identifica oportunidades automaticamente." },
      { title: "Identificação de oportunidades", desc: "Cada decisão vem com contexto: o que está errado, por quê, e o que fazer." },
      { title: "Sistema de decisão", desc: "Não é um relatório. É uma recomendação acionável que você pode aplicar." },
      { title: "Execução em um clique", desc: "Pause, escale ou ajuste sem sair do AdBrief." },
      { title: "Histórico de ações", desc: "Tudo o que você fez fica registrado. Veja o impacto de cada decisão." },
      { title: "Aprendizado do sistema", desc: "O sistema aprende com cada ação sua e melhora as recomendações futuras." },
    ],
    // S3 — plans
    s3_title: "Compare os planos",
    s3_sub: "Todos incluem análise contínua, identificação de oportunidades e execução em um clique.",
    s3_free: { name: "Free", desc: "Entrada", price: "$0", credits: "15 créditos", improvements: "~15 melhorias", accounts: "0 contas", context: "Para explorar o sistema antes de conectar sua conta de anúncios." },
    s3_maker: { name: "Maker", desc: "Consistência", price: "$19", credits: "1.000 créditos", improvements: "~33 melhorias/mês", accounts: "1 conta", context: "1.000 créditos equivalem a ações contínuas ao longo do mês para uma conta ativa." },
    s3_pro: { name: "Pro", desc: "Escala", price: "$49", credits: "2.500 créditos", improvements: "~166 melhorias/mês", accounts: "3 contas", badge: "Plano mais escolhido", context: "2.500 créditos com custo 50% menor por melhoria. Ideal para múltiplas contas." },
    s3_studio: { name: "Studio", desc: "Sem limites", price: "$299", credits: "Ilimitado", improvements: "Ilimitadas", accounts: "Ilimitadas", context: "O ROI de uma decisão ruim evitada já paga o plano inteiro." },
    s3_cta_free: "Criar conta",
    s3_cta_trial: "Iniciar teste gratuito",
    s3_mo: "/mês",
    s3_trial_note: "Teste gratuito de 3 dias em todos os planos pagos",
    // S4 — how many
    s4_title: "Quantas melhorias você precisa?",
    s4_scenarios: [
      { label: "Conta pequena", desc: "1 campanha ativa, poucos criativos", plan: "Free ou Maker", melhorias: "~5–15/mês" },
      { label: "Conta ativa", desc: "3–5 campanhas, rotação de criativos", plan: "Maker ou Pro", melhorias: "~30–80/mês" },
      { label: "Conta escalando", desc: "Múltiplas campanhas, orçamento crescendo", plan: "Pro", melhorias: "~100–166/mês" },
      { label: "Operação grande", desc: "Agência, várias contas, volume alto", plan: "Studio", melhorias: "Ilimitadas" },
    ],
    // S5 — system behavior
    s5_title: "Como o sistema funciona no dia a dia",
    s5_steps: [
      { title: "Você recebe oportunidades", desc: "O sistema analisa suas campanhas e apresenta decisões prontas." },
      { title: "Aplica rapidamente", desc: "Um clique. Sem abrir Gerenciador. Sem configuração manual." },
      { title: "Sistema continua aprendendo", desc: "Cada ação alimenta o sistema. As recomendações ficam cada vez melhores." },
    ],
    // S6 — final CTA
    s6_title: "Aplique sua primeira melhoria agora.",
    s6_cta: "Começar grátis",
    s6_sub: "Sem cartão · 15 melhorias grátis",
    // FAQ
    faq_title: "Perguntas frequentes",
    faqs: [
      { q: "Posso cancelar a qualquer momento?", a: "Sim. Todos os planos são mês a mês. Cancele nas configurações." },
      { q: "O que acontece quando os créditos acabam?", a: "Você recebe um aviso. Créditos renovam dia 1 de cada mês. Pode fazer upgrade a qualquer momento." },
      { q: "Todas as ferramentas usam créditos?", a: "Sim. Chat IA, análise de vídeo, hooks, scripts e melhorias consomem créditos do pool mensal." },
      { q: "Tem teste gratuito?", a: "Sim. Todos os planos pagos têm 3 dias grátis. Sem cobranças até o final." },
      { q: "Meus dados são seguros?", a: "Sim. Criptografia de 256 bits. Nunca compartilhamos seus dados." },
    ],
    // trust
    trust: ["Criptografia 256-bit", "GDPR Pronto", "99,9% Uptime"],
    // footer
    footer_copy: "© 2026 AdBrief",
    footer_privacy: "Privacidade",
    footer_terms: "Termos",
  },
  en: {
    nav_signin: "Sign in",
    s1_title: "You don't pay for access.",
    s1_title2: "You pay for action.",
    s1_body: "Each improvement is an action applied directly to your campaign. This includes: pausing underperforming ads, scaling what's working, adjusting creatives with potential, and applying recommendations based on real data.",
    s1_final: "You don't pay for analysis. You pay for what improves your campaign.",
    s2_title: "What's included",
    s2_items: [
      { title: "Continuous analysis", desc: "Your campaigns are monitored 24/7. The system identifies opportunities automatically." },
      { title: "Opportunity identification", desc: "Each decision comes with context: what's wrong, why, and what to do." },
      { title: "Decision system", desc: "Not a report. An actionable recommendation you can apply." },
      { title: "One-click execution", desc: "Pause, scale, or adjust without leaving AdBrief." },
      { title: "Action history", desc: "Everything you did is logged. See the impact of each decision." },
      { title: "System learning", desc: "The system learns from each action and improves future recommendations." },
    ],
    s3_title: "Compare plans",
    s3_sub: "All plans include continuous analysis, opportunity identification, and one-click execution.",
    s3_free: { name: "Free", desc: "Entry", price: "$0", credits: "15 credits", improvements: "~15 improvements", accounts: "0 accounts", context: "To explore the system before connecting your ad account." },
    s3_maker: { name: "Maker", desc: "Consistency", price: "$19", credits: "1,000 credits", improvements: "~33 improvements/mo", accounts: "1 account", context: "1,000 credits equal continuous actions throughout the month for an active account." },
    s3_pro: { name: "Pro", desc: "Scale", price: "$49", credits: "2,500 credits", improvements: "~166 improvements/mo", accounts: "3 accounts", badge: "Most chosen plan", context: "2,500 credits at 50% lower cost per improvement. Ideal for multiple accounts." },
    s3_studio: { name: "Studio", desc: "No limits", price: "$299", credits: "Unlimited", improvements: "Unlimited", accounts: "Unlimited", context: "The ROI of one prevented bad decision pays for the entire plan." },
    s3_cta_free: "Create account",
    s3_cta_trial: "Start free trial",
    s3_mo: "/mo",
    s3_trial_note: "3-day free trial on all paid plans",
    s4_title: "How many improvements do you need?",
    s4_scenarios: [
      { label: "Small account", desc: "1 active campaign, few creatives", plan: "Free or Maker", melhorias: "~5–15/mo" },
      { label: "Active account", desc: "3–5 campaigns, creative rotation", plan: "Maker or Pro", melhorias: "~30–80/mo" },
      { label: "Scaling account", desc: "Multiple campaigns, growing budget", plan: "Pro", melhorias: "~100–166/mo" },
      { label: "Large operation", desc: "Agency, multiple accounts, high volume", plan: "Studio", melhorias: "Unlimited" },
    ],
    s5_title: "How the system works day to day",
    s5_steps: [
      { title: "You receive opportunities", desc: "The system analyzes your campaigns and presents ready decisions." },
      { title: "Apply quickly", desc: "One click. No Ads Manager. No manual setup." },
      { title: "System keeps learning", desc: "Each action feeds the system. Recommendations get better over time." },
    ],
    s6_title: "Apply your first improvement now.",
    s6_cta: "Start free",
    s6_sub: "No card · 15 free improvements",
    faq_title: "Frequently asked questions",
    faqs: [
      { q: "Can I cancel anytime?", a: "Yes. All plans are month-to-month. Cancel in settings." },
      { q: "What happens when credits run out?", a: "You'll get a warning. Credits renew on the 1st of each month. Upgrade anytime." },
      { q: "Do all tools use credits?", a: "Yes. AI Chat, video analysis, hooks, scripts, and improvements all consume credits." },
      { q: "Is there a free trial?", a: "Yes. All paid plans include a 3-day free trial. No charge until it ends." },
      { q: "Is my data secure?", a: "Yes. 256-bit encryption. We never share your data." },
    ],
    trust: ["256-bit Encryption", "GDPR Ready", "99.9% Uptime"],
    footer_copy: "© 2026 AdBrief",
    footer_privacy: "Privacy",
    footer_terms: "Terms",
  },
  es: {
    nav_signin: "Iniciar sesión",
    s1_title: "No pagas por acceso.",
    s1_title2: "Pagas por acción.",
    s1_body: "Cada mejora es una acción aplicada directamente a tu campaña. Esto incluye: pausar anuncios con bajo rendimiento, escalar lo que funciona, ajustar creativos con potencial y aplicar recomendaciones basadas en datos reales.",
    s1_final: "No pagas por análisis. Pagas por lo que mejora tu campaña.",
    s2_title: "Qué está incluido",
    s2_items: [
      { title: "Análisis continuo", desc: "Tus campañas son monitoreadas 24/7. El sistema identifica oportunidades automáticamente." },
      { title: "Identificación de oportunidades", desc: "Cada decisión viene con contexto: qué está mal, por qué y qué hacer." },
      { title: "Sistema de decisión", desc: "No es un reporte. Es una recomendación accionable que puedes aplicar." },
      { title: "Ejecución en un clic", desc: "Pausa, escala o ajusta sin salir de AdBrief." },
      { title: "Historial de acciones", desc: "Todo lo que hiciste queda registrado. Ve el impacto de cada decisión." },
      { title: "Aprendizaje del sistema", desc: "El sistema aprende de cada acción y mejora las recomendaciones futuras." },
    ],
    s3_title: "Compara los planes",
    s3_sub: "Todos incluyen análisis continuo, identificación de oportunidades y ejecución en un clic.",
    s3_free: { name: "Free", desc: "Entrada", price: "$0", credits: "15 créditos", improvements: "~15 mejoras", accounts: "0 cuentas", context: "Para explorar el sistema antes de conectar tu cuenta de anuncios." },
    s3_maker: { name: "Maker", desc: "Consistencia", price: "$19", credits: "1.000 créditos", improvements: "~33 mejoras/mes", accounts: "1 cuenta", context: "1.000 créditos equivalen a acciones continuas durante el mes para una cuenta activa." },
    s3_pro: { name: "Pro", desc: "Escala", price: "$49", credits: "2.500 créditos", improvements: "~166 mejoras/mes", accounts: "3 cuentas", badge: "Plan más elegido", context: "2.500 créditos con costo 50% menor por mejora. Ideal para múltiples cuentas." },
    s3_studio: { name: "Studio", desc: "Sin límites", price: "$299", credits: "Ilimitado", improvements: "Ilimitadas", accounts: "Ilimitadas", context: "El ROI de una mala decisión evitada paga el plan entero." },
    s3_cta_free: "Crear cuenta",
    s3_cta_trial: "Iniciar prueba gratuita",
    s3_mo: "/mes",
    s3_trial_note: "Prueba gratuita de 3 días en todos los planes pagos",
    s4_title: "¿Cuántas mejoras necesitas?",
    s4_scenarios: [
      { label: "Cuenta pequeña", desc: "1 campaña activa, pocos creativos", plan: "Free o Maker", melhorias: "~5–15/mes" },
      { label: "Cuenta activa", desc: "3–5 campañas, rotación de creativos", plan: "Maker o Pro", melhorias: "~30–80/mes" },
      { label: "Cuenta escalando", desc: "Múltiples campañas, presupuesto creciendo", plan: "Pro", melhorias: "~100–166/mes" },
      { label: "Operación grande", desc: "Agencia, varias cuentas, volumen alto", plan: "Studio", melhorias: "Ilimitadas" },
    ],
    s5_title: "Cómo funciona el sistema día a día",
    s5_steps: [
      { title: "Recibes oportunidades", desc: "El sistema analiza tus campañas y presenta decisiones listas." },
      { title: "Aplicas rápido", desc: "Un clic. Sin Administrador de Anuncios. Sin configuración manual." },
      { title: "El sistema sigue aprendiendo", desc: "Cada acción alimenta el sistema. Las recomendaciones mejoran con el tiempo." },
    ],
    s6_title: "Aplica tu primera mejora ahora.",
    s6_cta: "Empezar gratis",
    s6_sub: "Sin tarjeta · 15 mejoras gratis",
    faq_title: "Preguntas frecuentes",
    faqs: [
      { q: "¿Puedo cancelar en cualquier momento?", a: "Sí. Todos los planes son mes a mes. Cancela en configuración." },
      { q: "¿Qué pasa cuando se agotan los créditos?", a: "Recibes una advertencia. Los créditos se renuevan el 1 de cada mes. Actualiza cuando quieras." },
      { q: "¿Todas las herramientas usan créditos?", a: "Sí. Chat IA, análisis de video, hooks, scripts y mejoras consumen créditos." },
      { q: "¿Hay prueba gratuita?", a: "Sí. Todos los planes pagos incluyen 3 días gratis. Sin cargos hasta que termine." },
      { q: "¿Mis datos son seguros?", a: "Sí. Cifrado de 256 bits. Nunca compartimos tus datos." },
    ],
    trust: ["Cifrado 256-bit", "GDPR Listo", "99,9% Uptime"],
    footer_copy: "© 2026 AdBrief",
    footer_privacy: "Privacidad",
    footer_terms: "Términos",
  },
};

// ── Stripe mapping ───────────────────────────────────────────────────────────
const PLANS = {
  maker:  { product_id: "prod_U88ul5IK0HHW19", price_id: "price_1T9sd1Dr9So14XztT3Mqddch" },
  pro:    { product_id: "prod_U88v5WVcy2NZV7", price_id: "price_1T9sdfDr9So14XztPR3tI14Y" },
  studio: { product_id: "prod_U88wpX4Bphfifi", price_id: "price_1TMzhCDr9So14Xzt1rUmfs7h" },
};

// ── Component ────────────────────────────────────────────────────────────────
const Pricing = () => {
  const navigate = useNavigate();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const { language } = useLanguage();
  const lang: Lang = ["pt", "es"].includes(language) ? language as Lang : "en";
  const t = T[lang];

  const handleUpgrade = async (planKey: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate(`/signup?plan=${planKey}`); return; }
    const plan = PLANS[planKey as keyof typeof PLANS];
    if (!plan) return;
    setUpgrading(planKey);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { price_id: plan.price_id }
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else toast.error("Could not create checkout session");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally { setUpgrading(null); }
  };

  const plans = [
    { key: "free", ...t.s3_free, cta: t.s3_cta_free, action: () => navigate("/signup"), ctaBg: "rgba(255,255,255,0.04)", ctaColor: TEXT3, ctaBorder: `1px solid ${BORDER}`, highlight: false },
    { key: "maker", ...t.s3_maker, cta: t.s3_cta_trial, action: () => handleUpgrade("maker"), ctaBg: "rgba(14,165,233,0.08)", ctaColor: ACCENT, ctaBorder: `1px solid rgba(14,165,233,0.18)`, highlight: false },
    { key: "pro", ...t.s3_pro, cta: t.s3_cta_trial, action: () => handleUpgrade("pro"), ctaBg: INDIGO, ctaColor: "#fff", ctaBorder: "none", highlight: true },
    { key: "studio", ...t.s3_studio, cta: t.s3_cta_trial, action: () => handleUpgrade("studio"), ctaBg: "rgba(255,255,255,0.04)", ctaColor: TEXT2, ctaBorder: `1px solid rgba(255,255,255,0.06)`, highlight: false },
  ];

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: F }}>

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav style={{ borderBottom: `1px solid ${BORDER}`, padding: "16px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/"><Logo size="lg" /></Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LanguageSwitcher />
            <button onClick={() => navigate("/login")}
              style={{ fontFamily: F, fontSize: 13, color: TEXT3, background: "none", border: "none", cursor: "pointer" }}>
              {t.nav_signin}
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ S1 — What you pay for ═══════════════════════════════════════ */}
      <section style={{ padding: "clamp(72px,10vw,120px) 24px clamp(48px,6vw,72px)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h1 style={{
            fontSize: "clamp(28px,3.5vw,42px)", fontWeight: 800,
            letterSpacing: "-0.04em", lineHeight: 1.1, margin: "0 0 4px",
            color: TEXT3,
          }}>
            {t.s1_title}
          </h1>
          <h1 style={{
            fontSize: "clamp(28px,3.5vw,42px)", fontWeight: 800,
            letterSpacing: "-0.04em", lineHeight: 1.1, margin: "0 0 28px",
            color: TEXT,
          }}>
            {t.s1_title2}
          </h1>
          <p style={{
            fontSize: 15, color: TEXT2, lineHeight: 1.7, margin: "0 0 28px",
          }}>
            {t.s1_body}
          </p>
          <p style={{
            fontSize: 14, color: ACCENT, fontWeight: 600, margin: 0,
            opacity: 0.8,
          }}>
            {t.s1_final}
          </p>
        </div>
      </section>

      {/* ═══ S2 — What's included ════════════════════════════════════════ */}
      <section style={{
        background: BG2, padding: "clamp(64px,8vw,96px) 24px",
        borderTop: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(22px,2.5vw,30px)", fontWeight: 800,
            letterSpacing: "-0.035em", margin: "0 0 48px",
          }}>
            {t.s2_title}
          </h2>

          {/* Structured layout — 2 columns, not a flat grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 36px",
          }} className="s2-grid">
            {(t.s2_items as Array<{title: string; desc: string}>).map((item, i) => {
              const icons = [<BarChart3 size={16} />, <Zap size={16} />, <Sparkles size={16} />, <ArrowRight size={16} />, <Clock size={16} />, <TrendingUp size={16} />];
              const colors = [ACCENT, GREEN, INDIGO, ACCENT, TEXT3, GREEN];
              return (
                <div key={i} style={{
                  padding: "20px", borderRadius: 12,
                  background: SURFACE, border: `1px solid ${BORDER}`,
                  transition: `all 0.3s ${EASE}`,
                }} className="s2-card">
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
                    color: colors[i],
                  }}>
                    {icons[i]}
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: TEXT, letterSpacing: "-0.01em" }}>{item.title}</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: TEXT3, lineHeight: 1.55, margin: 0 }}>{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ S3 — Plan comparison ════════════════════════════════════════ */}
      <section style={{
        padding: "clamp(72px,9vw,100px) 24px",
        borderTop: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(22px,2.5vw,30px)", fontWeight: 800,
            letterSpacing: "-0.035em", margin: "0 0 8px",
          }}>
            {t.s3_title}
          </h2>
          <p style={{ fontSize: 13.5, color: TEXT3, margin: "0 0 48px", maxWidth: 500 }}>
            {t.s3_sub}
          </p>

          {/* Layered cards — not a boring table */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 16,
          }} className="plans-stack">
            {plans.map((plan, i) => (
              <div key={i} className="plan-row" style={{
                display: "grid", gridTemplateColumns: "180px 1fr auto",
                alignItems: "center", gap: "clamp(16px,3vw,32px)",
                padding: plan.highlight ? "28px 28px" : "24px 24px",
                borderRadius: 14,
                background: plan.highlight ? "rgba(99,102,241,0.04)" : SURFACE,
                border: `1px solid ${plan.highlight ? "rgba(99,102,241,0.18)" : BORDER}`,
                position: "relative",
                transition: `all 0.3s ${EASE}`,
              }}>
                {/* Left — identity */}
                <div>
                  {plan.badge && (
                    <span style={{
                      fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: "0.05em",
                      color: INDIGO, display: "inline-block", marginBottom: 6,
                      background: "rgba(99,102,241,0.08)", padding: "2px 8px", borderRadius: 4,
                      border: "1px solid rgba(99,102,241,0.15)",
                    }}>
                      {plan.badge}
                    </span>
                  )}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
                    <span style={{
                      fontSize: plan.highlight ? 18 : 16, fontWeight: 700, color: TEXT,
                      letterSpacing: "-0.02em",
                    }}>
                      {plan.name}
                    </span>
                    <span style={{ fontSize: 11, color: TEXT3, fontWeight: 400 }}>{plan.desc}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                    <span style={{
                      fontSize: plan.highlight ? 32 : 26, fontWeight: 900,
                      color: plan.highlight ? TEXT : "rgba(255,255,255,0.85)",
                      letterSpacing: "-0.04em",
                    }}>
                      {plan.price}
                    </span>
                    {plan.price !== "$0" && (
                      <span style={{ fontSize: 12, color: TEXT3 }}>{t.s3_mo}</span>
                    )}
                  </div>
                </div>

                {/* Middle — details */}
                <div>
                  <div style={{ display: "flex", gap: "clamp(16px,2vw,28px)", flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: TEXT2, fontWeight: 500 }}>{plan.credits}</span>
                    <span style={{ fontSize: 12, color: TEXT2, fontWeight: 500 }}>{plan.improvements}</span>
                    <span style={{ fontSize: 12, color: TEXT2, fontWeight: 500 }}>{plan.accounts}</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: TEXT3, margin: 0, lineHeight: 1.5, maxWidth: 400 }}>
                    {plan.context}
                  </p>
                </div>

                {/* Right — CTA */}
                <button onClick={plan.action} disabled={upgrading !== null} style={{
                  fontFamily: F, fontSize: 13, fontWeight: 700,
                  padding: "10px 28px", borderRadius: 8,
                  background: plan.ctaBg, color: plan.ctaColor,
                  border: plan.ctaBorder, cursor: "pointer",
                  transition: `all 0.2s ${EASE}`,
                  whiteSpace: "nowrap",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  {upgrading === plan.key && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11.5, color: TEXT3, marginTop: 20, opacity: 0.6 }}>
            {t.s3_trial_note}
          </p>
        </div>
      </section>

      {/* ═══ S4 — How many improvements ══════════════════════════════════ */}
      <section style={{
        background: BG2, padding: "clamp(64px,8vw,96px) 24px",
        borderTop: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 740, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(20px,2.3vw,26px)", fontWeight: 800,
            letterSpacing: "-0.03em", margin: "0 0 40px",
          }}>
            {t.s4_title}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(t.s4_scenarios as Array<{label: string; desc: string; plan: string; melhorias: string}>).map((s, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1fr 1fr auto",
                alignItems: "center", gap: 20,
                padding: "18px 20px", borderRadius: 11,
                background: SURFACE, border: `1px solid ${BORDER}`,
              }} className="scenario-row">
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: TEXT, marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 11.5, color: TEXT3 }}>{s.desc}</div>
                </div>
                <div style={{ fontSize: 12.5, color: TEXT2, fontWeight: 500 }}>{s.melhorias}</div>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: ACCENT,
                  padding: "4px 10px", borderRadius: 5,
                  background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.12)",
                  whiteSpace: "nowrap",
                }}>
                  {s.plan}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ S5 — System behavior ════════════════════════════════════════ */}
      <section style={{
        padding: "clamp(64px,8vw,96px) 24px",
        borderTop: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(20px,2.3vw,26px)", fontWeight: 800,
            letterSpacing: "-0.03em", margin: "0 0 44px",
          }}>
            {t.s5_title}
          </h2>

          {(t.s5_steps as Array<{title: string; desc: string}>).map((step, i) => (
            <div key={i} style={{
              display: "flex", gap: 20, marginBottom: i < 2 ? 32 : 0,
              position: "relative",
            }}>
              {/* Step number — not an icon grid */}
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: `${[ACCENT, GREEN, INDIGO][i]}08`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800, color: [ACCENT, GREEN, INDIGO][i],
              }}>
                {i + 1}
              </div>
              {/* Connector line */}
              {i < 2 && (
                <div style={{
                  position: "absolute", left: 15, top: 36, width: 1, height: "calc(100% - 4px)",
                  background: `linear-gradient(to bottom, ${[ACCENT, GREEN][i]}15, transparent)`,
                }} />
              )}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: TEXT, margin: "0 0 4px" }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: TEXT3, lineHeight: 1.55, margin: 0 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FAQ ═════════════════════════════════════════════════════════ */}
      <section style={{
        background: BG2, padding: "clamp(64px,8vw,96px) 24px",
        borderTop: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(20px,2.3vw,26px)", fontWeight: 800,
            letterSpacing: "-0.03em", margin: "0 0 36px",
          }}>
            {t.faq_title}
          </h2>

          {(t.faqs as Array<{q: string; a: string}>).map((faq, i) => (
            <div key={i} style={{
              borderBottom: `1px solid ${BORDER}`,
              paddingBottom: 20, marginBottom: 20,
            }}>
              <button
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: F, fontSize: 14, fontWeight: 600, color: TEXT,
                  padding: 0, textAlign: "left",
                }}
              >
                {faq.q}
                <ChevronDown size={14} style={{
                  color: TEXT3, flexShrink: 0, marginLeft: 12,
                  transform: expandedFaq === i ? "rotate(180deg)" : "none",
                  transition: `transform 0.2s ${EASE}`,
                }} />
              </button>
              <div style={{
                maxHeight: expandedFaq === i ? 200 : 0,
                overflow: "hidden",
                transition: `max-height 0.3s ${EASE}`,
              }}>
                <p style={{
                  fontSize: 13, color: TEXT3, lineHeight: 1.6,
                  margin: "10px 0 0",
                }}>
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ Trust ═══════════════════════════════════════════════════════ */}
      <section style={{ padding: "32px 24px", borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "center", gap: 28, flexWrap: "wrap" }}>
          {(t.trust as string[]).map((badge, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: TEXT3 }}>
              <Shield size={13} style={{ color: GREEN, opacity: 0.7 }} />
              {badge}
            </span>
          ))}
        </div>
      </section>

      {/* ═══ S6 — Final CTA ══════════════════════════════════════════════ */}
      <section style={{
        padding: "clamp(72px,9vw,100px) 24px",
        borderTop: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 440, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(24px,3vw,34px)", fontWeight: 800,
            letterSpacing: "-0.04em", margin: "0 0 32px",
          }}>
            {t.s6_title}
          </h2>
          <button onClick={() => navigate("/signup")} style={{
            fontFamily: F, fontSize: 15, fontWeight: 700,
            padding: "14px 36px", borderRadius: 10,
            background: "#fff", color: "#000", border: "none",
            cursor: "pointer", transition: `all 0.25s ${EASE}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            {t.s6_cta} <ArrowRight size={15} />
          </button>
          <p style={{ fontSize: 11.5, color: TEXT3, marginTop: 10 }}>
            {t.s6_sub}
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "28px 24px" }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12,
        }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.20)" }}>{t.footer_copy}</span>
          <div style={{ display: "flex", gap: 16 }}>
            <Link to="/privacy" style={{ fontSize: 11, color: "rgba(255,255,255,0.20)", textDecoration: "none" }}>{t.footer_privacy}</Link>
            <Link to="/terms" style={{ fontSize: 11, color: "rgba(255,255,255,0.20)", textDecoration: "none" }}>{t.footer_terms}</Link>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Mobile ──────────────────────────────────── */
        @media (max-width: 768px) {
          .s2-grid { grid-template-columns: 1fr !important; }
          .plans-stack .plan-row {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .scenario-row {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
        }

        /* ── Tablet ──────────────────────────────────── */
        @media (min-width: 769px) and (max-width: 1023px) {
          .plans-stack .plan-row {
            grid-template-columns: 1fr 1fr !important;
          }
          .plans-stack .plan-row button {
            grid-column: span 2;
            justify-self: start;
          }
        }

        /* ── Hover ───────────────────────────────────── */
        @media (hover: hover) {
          .s2-card:hover { border-color: rgba(255,255,255,0.10) !important; }
          .plan-row:hover { border-color: rgba(255,255,255,0.10) !important; }
        }
      `}</style>
    </div>
  );
};

export default Pricing;
