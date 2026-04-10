import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Shield, HelpCircle, X, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Lang = "en" | "pt" | "es";

const T: Record<Lang, Record<string, any>> = {
  en: {
    nav_signin: "Sign in",
    hero_title: "Simple, transparent pricing",
    hero_sub: "3-day free trial on all plans. Card required. No charge until day 4. Cancel anytime.",
    monthly: "Monthly",
    annual: "Annual",
    save_badge: "Save 20%",

    plan_free_name: "Free",
    plan_free_price: "$0",
    plan_free_desc: "Try AdBrief with no commitment.",

    plan_maker_name: "Maker",
    plan_maker_desc: "For freelancers and solo buyers.",
    plan_maker_badge: null,

    plan_pro_name: "Pro",
    plan_pro_desc: "For small agencies and performance teams.",
    plan_pro_badge: "Most Popular",

    plan_studio_name: "Studio",
    plan_studio_desc: "For agencies managing multiple clients.",
    plan_studio_badge: null,

    feature_free_1: "15 credits / month",
    feature_free_2: "No ad account",
    feature_free_3: "All tools (limited)",
    feature_free_4: "AI Chat, Hooks, Briefs, Scripts",
    feature_free_5: "Ad Score & Performance",
    feature_free_6: "Basic support",
    feature_free_7: "",

    feature_maker_1: "1,000 credits / month",
    feature_maker_2: "1 ad account connected",
    feature_maker_3: "All tools unlocked",
    feature_maker_4: "AI Chat, Hooks, Briefs, Scripts",
    feature_maker_5: "Boards, Preflight, Translate",
    feature_maker_6: "Competitor Decoder",
    feature_maker_7: "Ad Score & Performance",

    feature_pro_1: "2,500 credits / month",
    feature_pro_2: "3 ad accounts connected",
    feature_pro_3: "All tools unlocked",
    feature_pro_4: "Everything in Maker +",
    feature_pro_5: "51 credits/$ (+3% value)",
    feature_pro_6: "Multi-market support",
    feature_pro_7: "Priority support",

    feature_studio_1: "9,000 credits / month",
    feature_studio_2: "Unlimited ad accounts",
    feature_studio_3: "All tools unlocked",
    feature_studio_4: "Everything in Pro +",
    feature_studio_5: "60 credits/$ (+15% value)",
    feature_studio_6: "Agency workspace",
    feature_studio_7: "Dedicated onboarding",

    cta_free: "Get started",
    cta_trial: "Start free trial",

    faq_title: "Frequently Asked Questions",
    faq_1_q: "Can I cancel anytime?",
    faq_1_a: "Yes. All plans are month-to-month with no long-term contracts. You can cancel or downgrade anytime from your account settings.",
    faq_2_q: "What happens when I run out of credits?",
    faq_2_a: "You'll see a warning when your credits are running low. Credits reset on the 1st of each month. You can upgrade anytime for more credits.",
    faq_3_q: "Is there a free trial for paid plans?",
    faq_3_a: "Yes. All paid plans come with a 3-day free trial. No charge until the trial ends. Cancel anytime.",
    faq_4_q: "How does billing work?",
    faq_4_a: "We bill monthly via credit card (Visa, Mastercard, Amex). For annual billing or custom invoicing, contact our sales team.",
    faq_5_q: "Do you offer refunds?",
    faq_5_a: "We offer a 30-day money-back guarantee on your first payment for Studio plans.",
    faq_6_q: "Is my data secure?",
    faq_6_a: "Yes. AdBrief uses 256-bit encryption at rest and in transit. We never share or sell your data.",

    trust_encryption: "256-bit Encryption",
    trust_gdpr: "GDPR Ready",
    trust_uptime: "99.9% Uptime SLA",
    trust_guarantee: "30-day money-back",

    cta_questions_title: "Still have questions?",
    cta_questions_sub: "Talk to our team. We'll help you find the right plan for your needs.",
    cta_book_demo: "Book a demo",
    cta_contact_sales: "Contact sales",

    footer_prices: "Prices shown in USD. All paid plans include a 3-day free trial. Annual plans billed as one payment. You may cancel at any time before the trial expires.",
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
    plan_free_price: "$0",
    plan_free_desc: "Experimente o AdBrief sem compromisso.",

    plan_maker_name: "Maker",
    plan_maker_desc: "Para gestores de tráfego independentes.",
    plan_maker_badge: null,

    plan_pro_name: "Pro",
    plan_pro_desc: "Para pequenas agências e equipes de performance.",
    plan_pro_badge: "Mais Popular",

    plan_studio_name: "Studio",
    plan_studio_desc: "Para agências gerenciando múltiplos clientes.",
    plan_studio_badge: null,

    feature_free_1: "15 créditos / mês",
    feature_free_2: "Sem conta de anúncios",
    feature_free_3: "Todas as ferramentas (limitado)",
    feature_free_4: "Chat IA, Hooks, Briefs, Scripts",
    feature_free_5: "Ad Score & Performance",
    feature_free_6: "Suporte básico",
    feature_free_7: "",

    feature_maker_1: "1.000 créditos / mês",
    feature_maker_2: "1 conta de anúncios conectada",
    feature_maker_3: "Todas as ferramentas desbloqueadas",
    feature_maker_4: "Chat IA, Hooks, Briefs, Scripts",
    feature_maker_5: "Boards, Preflight, Tradução",
    feature_maker_6: "Decodificador de Concorrentes",
    feature_maker_7: "Ad Score & Performance",

    feature_pro_1: "2.500 créditos / mês",
    feature_pro_2: "3 contas de anúncios conectadas",
    feature_pro_3: "Todas as ferramentas desbloqueadas",
    feature_pro_4: "Tudo do Maker +",
    feature_pro_5: "51 créditos/$ (+3% valor)",
    feature_pro_6: "Suporte multi-mercado",
    feature_pro_7: "Suporte prioritário",

    feature_studio_1: "9.000 créditos / mês",
    feature_studio_2: "Contas de anúncios ilimitadas",
    feature_studio_3: "Todas as ferramentas desbloqueadas",
    feature_studio_4: "Tudo do Pro +",
    feature_studio_5: "60 créditos/$ (+15% valor)",
    feature_studio_6: "Workspace de agência",
    feature_studio_7: "Onboarding dedicado",

    cta_free: "Começar",
    cta_trial: "Iniciar teste gratuito",

    faq_title: "Perguntas Frequentes",
    faq_1_q: "Posso cancelar a qualquer momento?",
    faq_1_a: "Sim. Todos os planos são mês a mês sem contratos de longo prazo. Você pode cancelar ou fazer downgrade a qualquer momento nas configurações da conta.",
    faq_2_q: "O que acontece quando meus créditos acabam?",
    faq_2_a: "Você verá um aviso quando seus créditos estiverem acabando. Os créditos renovam no dia 1 de cada mês. Você pode fazer upgrade a qualquer momento para mais créditos.",
    faq_3_q: "Há teste gratuito para planos pagos?",
    faq_3_a: "Sim. Todos os planos pagos vêm com teste gratuito de 3 dias. Sem cobranças até o final do teste. Cancele quando quiser.",
    faq_4_q: "Como funciona o faturamento?",
    faq_4_a: "Faturamos mensalmente via cartão de crédito (Visa, Mastercard, Amex). Para faturamento anual ou faturamento personalizado, entre em contato com nosso time de vendas.",
    faq_5_q: "Vocês oferecem devoluções?",
    faq_5_a: "Oferecemos garantia de devolução de 30 dias no seu primeiro pagamento para planos Studio.",
    faq_6_q: "Meus dados são seguros?",
    faq_6_a: "Sim. O AdBrief usa criptografia de 256 bits em repouso e em trânsito. Nunca compartilhamos ou vendemos seus dados.",

    trust_encryption: "Criptografia de 256 bits",
    trust_gdpr: "GDPR Pronto",
    trust_uptime: "SLA de 99,9% Uptime",
    trust_guarantee: "Garantia de devolução de 30 dias",

    cta_questions_title: "Ainda tem dúvidas?",
    cta_questions_sub: "Fale com nosso time. Vamos ajudá-lo a encontrar o plano certo para suas necessidades.",
    cta_book_demo: "Agendar demonstração",
    cta_contact_sales: "Contatar vendas",

    footer_prices: "Preços exibidos em USD. Todos os planos pagos incluem teste gratuito de 3 dias. Planos anuais são faturados como um pagamento. Você pode cancelar a qualquer momento antes do teste expirar.",
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
    plan_free_price: "$0",
    plan_free_desc: "Prueba AdBrief sin compromiso.",

    plan_maker_name: "Maker",
    plan_maker_desc: "Para gestores de tráfico independientes.",
    plan_maker_badge: null,

    plan_pro_name: "Pro",
    plan_pro_desc: "Para pequeñas agencias y equipos de performance.",
    plan_pro_badge: "Más Popular",

    plan_studio_name: "Studio",
    plan_studio_desc: "Para agencias que gestionan múltiples clientes.",
    plan_studio_badge: null,

    feature_free_1: "15 créditos / mes",
    feature_free_2: "Sin cuenta de anuncios",
    feature_free_3: "Todas las herramientas (limitado)",
    feature_free_4: "Chat IA, Hooks, Briefs, Scripts",
    feature_free_5: "Ad Score & Performance",
    feature_free_6: "Soporte básico",
    feature_free_7: "",

    feature_maker_1: "1.000 créditos / mes",
    feature_maker_2: "1 cuenta de anuncios conectada",
    feature_maker_3: "Todas las herramientas desbloqueadas",
    feature_maker_4: "Chat IA, Hooks, Briefs, Scripts",
    feature_maker_5: "Boards, Preflight, Traducción",
    feature_maker_6: "Decodificador de Competidores",
    feature_maker_7: "Ad Score & Performance",

    feature_pro_1: "2.500 créditos / mes",
    feature_pro_2: "3 cuentas de anuncios conectadas",
    feature_pro_3: "Todas las herramientas desbloqueadas",
    feature_pro_4: "Todo del Maker +",
    feature_pro_5: "51 créditos/$ (+3% valor)",
    feature_pro_6: "Soporte multi-mercado",
    feature_pro_7: "Soporte prioritario",

    feature_studio_1: "9.000 créditos / mes",
    feature_studio_2: "Cuentas de anuncios ilimitadas",
    feature_studio_3: "Todas las herramientas desbloqueadas",
    feature_studio_4: "Todo del Pro +",
    feature_studio_5: "60 créditos/$ (+15% valor)",
    feature_studio_6: "Workspace de agencia",
    feature_studio_7: "Onboarding dedicado",

    cta_free: "Comenzar",
    cta_trial: "Iniciar prueba gratuita",

    faq_title: "Preguntas Frecuentes",
    faq_1_q: "¿Puedo cancelar en cualquier momento?",
    faq_1_a: "Sí. Todos los planes son mes a mes sin contratos a largo plazo. Puedes cancelar o degradar en cualquier momento desde la configuración de tu cuenta.",
    faq_2_q: "¿Qué pasa cuando se acaban mis créditos?",
    faq_2_a: "Verás una advertencia cuando tus créditos estén agotándose. Los créditos se renuevan el 1 de cada mes. Puedes actualizar en cualquier momento para más créditos.",
    faq_3_q: "¿Hay prueba gratuita para planes pagos?",
    faq_3_a: "Sí. Todos los planes pagos incluyen una prueba gratuita de 3 días. Sin cargos hasta que termine la prueba. Cancela en cualquier momento.",
    faq_4_q: "¿Cómo funciona la facturación?",
    faq_4_a: "Facturamos mensualmente por tarjeta de crédito (Visa, Mastercard, Amex). Para facturación anual o facturación personalizada, ponte en contacto con nuestro equipo de ventas.",
    faq_5_q: "¿Ofrecen reembolsos?",
    faq_5_a: "Ofrecemos una garantía de devolución de dinero de 30 días en tu primer pago para planes Studio.",
    faq_6_q: "¿Mis datos son seguros?",
    faq_6_a: "Sí. AdBrief utiliza cifrado de 256 bits en reposo y en tránsito. Nunca compartimos ni vendemos tus datos.",

    trust_encryption: "Cifrado de 256 bits",
    trust_gdpr: "GDPR Listo",
    trust_uptime: "SLA de 99,9% Uptime",
    trust_guarantee: "Garantía de devolución de 30 días",

    cta_questions_title: "¿Aún tienes preguntas?",
    cta_questions_sub: "Habla con nuestro equipo. Te ayudaremos a encontrar el plan adecuado para tus necesidades.",
    cta_book_demo: "Reservar una demostración",
    cta_contact_sales: "Contactar ventas",

    footer_prices: "Precios mostrados en USD. Todos los planes pagos incluyen una prueba gratuita de 3 días. Los planes anuales se facturan como un pago. Puedes cancelar en cualquier momento antes de que expire la prueba.",
    footer_copyright: "© 2026 AdBrief. Todos los derechos reservados.",
    footer_privacy: "Política de Privacidad",
    footer_terms: "Términos de Servicio",
    footer_refund: "Política de Reembolso",

    period_month: "/mes",
    period_year: "/año",
  },
};

// Stripe product/price mapping
const PLANS = {
  maker:  { product_id: "prod_U88ul5IK0HHW19", price_id: "price_1T9sd1Dr9So14XztT3Mqddch" },
  pro:    { product_id: "prod_U88v5WVcy2NZV7", price_id: "price_1T9sdfDr9So14XztPR3tI14Y" },
  studio: { product_id: "prod_U88wpX4Bphfifi", price_id: "price_1T9seMDr9So14Xzt0vEJNQIX" },
};

const Pricing = () => {
  const navigate = useNavigate();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [annual, setAnnual] = useState(false);
  const { language } = useLanguage();
  const lang: Lang = ["pt", "es"].includes(language) ? language as Lang : "en";
  const t = T[lang];

  const monthlyPrices = { maker: 19, pro: 49, studio: 149 };
  // Annual totals from Stripe: $182, $470.40, $1428
  const annualTotals = { maker: 182, pro: 470, studio: 1428 };

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

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Could not create checkout session");
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
      console.error("Checkout error:", err);
    } finally {
      setUpgrading(null);
    }
  };

  const plans = [
    {
      name: t.plan_free_name,
      price: t.plan_free_price,
      period: "",
      description: t.plan_free_desc,
      features: [
        { text: t.feature_free_1, included: true },
        { text: t.feature_free_2, included: true },
        { text: t.feature_free_3, included: true },
        { text: t.feature_free_4, included: true },
        { text: t.feature_free_5, included: true },
        { text: t.feature_free_6, included: true },
        { text: t.feature_free_7, included: false },
      ],
      cta: t.cta_free,
      ctaAction: () => navigate("/signup"),
      highlighted: false,
    },
    {
      name: t.plan_maker_name,
      price: annual ? `$${annualTotals.maker}` : `$${monthlyPrices.maker}`,
      period: annual ? t.period_year : t.period_month,
      description: t.plan_maker_desc,
      features: [
        { text: t.feature_maker_1, included: true },
        { text: t.feature_maker_2, included: true },
        { text: t.feature_maker_3, included: true },
        { text: t.feature_maker_4, included: true },
        { text: t.feature_maker_5, included: true },
        { text: t.feature_maker_6, included: true },
        { text: t.feature_maker_7, included: false },
      ],
      cta: t.cta_trial,
      ctaAction: () => handleUpgrade("maker"),
      highlighted: false,
    },
    {
      name: t.plan_pro_name,
      price: annual ? `$${annualTotals.pro}` : `$${monthlyPrices.pro}`,
      period: annual ? t.period_year : t.period_month,
      description: t.plan_pro_desc,
      features: [
        { text: t.feature_pro_1, included: true },
        { text: t.feature_pro_2, included: true },
        { text: t.feature_pro_3, included: true },
        { text: t.feature_pro_4, included: true },
        { text: t.feature_pro_5, included: true },
        { text: t.feature_pro_6, included: true },
        { text: t.feature_pro_7, included: true },
      ],
      cta: t.cta_trial,
      ctaAction: () => handleUpgrade("pro"),
      highlighted: true,
      badge: t.plan_pro_badge,
    },
    {
      name: t.plan_studio_name,
      price: annual ? `$${annualTotals.studio}` : `$${monthlyPrices.studio}`,
      period: annual ? t.period_year : t.period_month,
      description: t.plan_studio_desc,
      features: [
        { text: t.feature_studio_1, included: true },
        { text: t.feature_studio_2, included: true },
        { text: t.feature_studio_3, included: true },
        { text: t.feature_studio_4, included: true },
        { text: t.feature_studio_5, included: true },
        { text: t.feature_studio_6, included: true },
        { text: t.feature_studio_7, included: true },
      ],
      cta: t.cta_trial,
      ctaAction: () => handleUpgrade("studio"),
      highlighted: false,
    },
  ];

  const faqs = [
    { q: t.faq_1_q, a: t.faq_1_a },
    { q: t.faq_2_q, a: t.faq_2_a },
    { q: t.faq_3_q, a: t.faq_3_a },
    { q: t.faq_4_q, a: t.faq_4_a },
    { q: t.faq_5_q, a: t.faq_5_a },
    { q: t.faq_6_q, a: t.faq_6_a },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/">
            <Logo size="lg" />
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" className="text-muted-foreground" onClick={() => navigate("/login")}>
              {t.nav_signin}
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-5xl text-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {t.hero_title}
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              {t.hero_sub}
            </p>

            {/* Annual/Monthly Toggle */}
            <div className="flex items-center justify-center gap-3 mt-6">
              <span className={`text-sm font-medium transition-colors ${!annual ? "text-white" : "text-white/40"}`}>{t.monthly}</span>
              <button
                onClick={() => setAnnual(v => !v)}
                className="relative w-11 h-6 rounded-full transition-colors"
                style={{ background: annual ? "linear-gradient(135deg, #0ea5e9, #06b6d4)" : "rgba(255,255,255,0.15)" }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                  style={{ left: annual ? "22px" : "2px" }}
                />
              </button>
              <span className={`text-sm font-medium transition-colors ${annual ? "text-white" : "text-white/40"}`}>{t.annual}</span>
              {annual && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-md"
                  style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
                  {t.save_badge}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-20 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, i) => (
              <div
                key={plan.name}
              >
                <Card
                  className={`relative h-full flex flex-col transition-all duration-300 ${
                    plan.highlighted
                      ? "border-sky-500/50 shadow-xl shadow-sky-500/15 md:scale-105 bg-card"
                      : "border-border bg-card hover:-translate-y-1"
                  }`}
                  style={plan.highlighted ? {
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(236, 72, 153, 0.04))',
                  } : {}}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white border-0">
                        {plan.badge}
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-4 pt-8">
                    <CardTitle className="text-lg text-muted-foreground font-normal mb-2">
                      {plan.name}
                    </CardTitle>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold text-foreground">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-3 flex-1">
                      {plan.features.map((feature, j) => (
                        <li key={j} className="flex items-start gap-3 text-sm">
                          {feature.included ? (
                            <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          ) : (
                            <X className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                          )}
                          <span className={feature.included ? "text-muted-foreground" : "text-muted-foreground/40"}>
                            {feature.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full mt-6 ${
                        plan.highlighted
                          ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-700 hover:to-cyan-700 border-0"
                          : "bg-card text-foreground hover:bg-muted border border-border"
                      }`}
                      onClick={plan.ctaAction}
                      disabled={upgrading !== null}
                    >
                      {upgrading === plan.name.toLowerCase() && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {plan.cta}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="py-12 px-6 border-t border-border/30">
        <div className="container mx-auto max-w-3xl">
          <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-500" />
              {t.trust_encryption}
            </span>
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-500" />
              {t.trust_gdpr}
            </span>
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-500" />
              {t.trust_uptime}
            </span>
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-500" />
              {t.trust_guarantee}
            </span>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-6 border-t border-border/30">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-center mb-10">{t.faq_title}</h2>
          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <div key={i} className="border-b border-border/30 pb-6 last:border-0">
                <h3 className="font-semibold text-foreground flex items-start gap-2 mb-2">
                  <HelpCircle className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  {faq.q}
                </h3>
                <p className="text-sm text-muted-foreground pl-6 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6">
        <div className="container mx-auto max-w-3xl text-center">
          <div
            className="p-10 rounded-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(236, 72, 153, 0.1))",
              border: "1px solid rgba(139, 92, 246, 0.2)",
            }}
          >
            <h2 className="text-2xl font-bold mb-3">{t.cta_questions_title}</h2>
            <p className="text-muted-foreground mb-6">
              {t.cta_questions_sub}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white border-0"
                onClick={() => navigate("/book-demo")}
              >
                {t.cta_book_demo}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                variant="outline"
                className="border-border"
                onClick={() => navigate("/contact")}
              >
                {t.cta_contact_sales}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-xs text-muted-foreground/60 leading-relaxed text-center space-y-2">
            <p>
              {t.footer_prices}
            </p>
            <p className="pt-2">
              {t.footer_copyright}
              {" · "}
              <Link to="/privacy" className="hover:text-foreground transition-colors">{t.footer_privacy}</Link>
              {" · "}
              <Link to="/terms" className="hover:text-foreground transition-colors">{t.footer_terms}</Link>
              {" · "}
              <Link to="/refund" className="hover:text-foreground transition-colors">{t.footer_refund}</Link>
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default Pricing;
