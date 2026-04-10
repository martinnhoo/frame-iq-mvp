import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

type Lang = "en" | "pt" | "es";

const BRAND = "linear-gradient(135deg, #0ea5e9, #06b6d4)";
const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;

const T: Record<Lang, Record<string, any>> = {
  en: {
    label: "CHOOSE A PLAN TO CONTINUE",
    title_default: "Start your free trial",
    title_feature: (f: string) => `"${f}" requires a plan`,
    trial_intro: "Every plan includes a ",
    trial_bold: "3-day free trial",
    trial_after: ". No charge until it's over. Cancel anytime.",
    requirements: "Card required · ",
    no_charge: "No charge for 72 hours (3 days)",
    terms: "By starting a trial you agree to our Terms of Service. Cancel before 72 hours (3 days) and you won't be charged.",

    plan_maker_name: "Maker",
    plan_maker_price: "$19",
    plan_maker_period: "/mo",
    plan_maker_f1: "1 ad account connected",
    plan_maker_f2: "Unlimited AI chat",
    plan_maker_f3: "AI memory up to 20 analyses",

    plan_pro_name: "Pro",
    plan_pro_price: "$49",
    plan_pro_period: "/mo",
    plan_pro_badge: "Most popular",
    plan_pro_f1: "3 ad accounts",
    plan_pro_f2: "Unlimited AI chat",
    plan_pro_f3: "Multi-market support",
    plan_pro_f4: "AI memory up to 60 analyses",

    plan_studio_name: "Studio",
    plan_studio_price: "$149",
    plan_studio_period: "/mo",
    plan_studio_f1: "Unlimited ad accounts",
    plan_studio_f2: "Unlimited AI chat",
    plan_studio_f3: "Agency client workspace",
    plan_studio_f4: "Full account memory",

    cta: "Start trial",
  },
  pt: {
    label: "ESCOLHA UM PLANO PARA CONTINUAR",
    title_default: "Inicie seu teste gratuito",
    title_feature: (f: string) => `"${f}" requer um plano`,
    trial_intro: "Todo plano inclui um ",
    trial_bold: "teste gratuito de 3 dias",
    trial_after: ". Sem cobrança até o final. Cancele quando quiser.",
    requirements: "Cartão obrigatório · ",
    no_charge: "Sem cobrança por 72 horas (3 dias)",
    terms: "Ao iniciar um teste, você concorda com nossos Termos de Serviço. Cancele antes de 72 horas (3 dias) e você não será cobrado.",

    plan_maker_name: "Maker",
    plan_maker_price: "$19",
    plan_maker_period: "/mês",
    plan_maker_f1: "1 conta de anúncios conectada",
    plan_maker_f2: "Chat IA ilimitado",
    plan_maker_f3: "Memória IA até 20 análises",

    plan_pro_name: "Pro",
    plan_pro_price: "$49",
    plan_pro_period: "/mês",
    plan_pro_badge: "Mais popular",
    plan_pro_f1: "3 contas de anúncios",
    plan_pro_f2: "Chat IA ilimitado",
    plan_pro_f3: "Suporte multi-mercado",
    plan_pro_f4: "Memória IA até 60 análises",

    plan_studio_name: "Studio",
    plan_studio_price: "$149",
    plan_studio_period: "/mês",
    plan_studio_f1: "Contas de anúncios ilimitadas",
    plan_studio_f2: "Chat IA ilimitado",
    plan_studio_f3: "Workspace de agência",
    plan_studio_f4: "Memória completa da conta",

    cta: "Iniciar teste",
  },
  es: {
    label: "ELIGE UN PLAN PARA CONTINUAR",
    title_default: "Inicia tu prueba gratuita",
    title_feature: (f: string) => `"${f}" requiere un plan`,
    trial_intro: "Todos los planes incluyen una ",
    trial_bold: "prueba gratuita de 3 días",
    trial_after: ". Sin cargos hasta que termine. Cancela en cualquier momento.",
    requirements: "Tarjeta requerida · ",
    no_charge: "Sin cargos por 72 horas (3 días)",
    terms: "Al iniciar una prueba, aceptas nuestros Términos de Servicio. Cancela antes de 72 horas (3 días) y no serás cobrado.",

    plan_maker_name: "Maker",
    plan_maker_price: "$19",
    plan_maker_period: "/mes",
    plan_maker_f1: "1 cuenta de anuncios conectada",
    plan_maker_f2: "Chat IA ilimitado",
    plan_maker_f3: "Memoria IA hasta 20 análisis",

    plan_pro_name: "Pro",
    plan_pro_price: "$49",
    plan_pro_period: "/mes",
    plan_pro_badge: "Más popular",
    plan_pro_f1: "3 cuentas de anuncios",
    plan_pro_f2: "Chat IA ilimitado",
    plan_pro_f3: "Soporte multi-mercado",
    plan_pro_f4: "Memoria IA hasta 60 análisis",

    plan_studio_name: "Studio",
    plan_studio_price: "$149",
    plan_studio_period: "/mes",
    plan_studio_f1: "Cuentas de anuncios ilimitadas",
    plan_studio_f2: "Chat IA ilimitado",
    plan_studio_f3: "Workspace de agencia",
    plan_studio_f4: "Memoria completa de cuenta",

    cta: "Iniciar prueba",
  },
};

interface PlanWallProps {
  onClose?: () => void;
  feature?: string;
}

export default function PlanWall({ onClose, feature }: PlanWallProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = ["pt", "es"].includes(language) ? language as Lang : "en";
  const t = T[lang];

  const PLANS = [
    { name: t.plan_maker_name, price: t.plan_maker_price, desc: t.plan_maker_period, features: [t.plan_maker_f1, t.plan_maker_f2, t.plan_maker_f3], action: "/signup?plan=maker", highlight: false },
    { name: t.plan_pro_name, price: t.plan_pro_price, desc: t.plan_pro_period, features: [t.plan_pro_f1, t.plan_pro_f2, t.plan_pro_f3, t.plan_pro_f4], action: "/signup?plan=pro", highlight: true, badge: t.plan_pro_badge },
    { name: t.plan_studio_name, price: t.plan_studio_price, desc: t.plan_studio_period, features: [t.plan_studio_f1, t.plan_studio_f2, t.plan_studio_f3, t.plan_studio_f4], action: "/signup?plan=studio", highlight: false },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {/* Backdrop */}
      <div role="button" aria-label="Close" tabIndex={0} style={{ position: "absolute", inset: 0, background: "rgba(6,8,18,0.92)", backdropFilter: "blur(12px)" }} onClick={onClose} onKeyDown={e => e.key === "Escape" && onClose?.()} />

      {/* Modal */}
      <div style={{ position: "relative", width: "100%", maxWidth: 720, background: "#0a0b1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "40px 36px", boxShadow: "0 40px 100px rgba(0,0,0,0.6)" }}>
        {onClose && (
          <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={14} color="rgba(255,255,255,0.4)" />
          </button>
        )}

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ ...j, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(14,165,233,0.7)", fontWeight: 600, marginBottom: 10 }}>{t.label}</p>
          <h2 style={{ ...j, fontSize: "clamp(22px,3vw,32px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", marginBottom: 10, lineHeight: 1.2 }}>
            {feature ? t.title_feature(feature) : t.title_default}
          </h2>
          <p style={{ ...j, fontSize: 14, color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>
            {t.trial_intro}<strong style={{ color: "rgba(255,255,255,0.7)" }}>{t.trial_bold}</strong>{t.trial_after}
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, padding: "7px 14px", borderRadius: 9, background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.15)" }}>
            <span style={{ fontSize: 13 }}></span>
            <span style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{t.requirements}<strong style={{ color: "#fff" }}>{t.no_charge}</strong></span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {PLANS.map((plan) => (
            <div key={plan.name} style={{ padding: "22px 18px", borderRadius: 16, background: plan.highlight ? "rgba(14,165,233,0.07)" : "rgba(255,255,255,0.02)", border: `1px solid ${plan.highlight ? "rgba(14,165,233,0.28)" : "rgba(255,255,255,0.07)"}`, display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>
              {plan.badge && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: BRAND, borderRadius: 999, padding: "2px 12px" }}><span style={{ ...j, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "#000", fontWeight: 700 }}>{plan.badge}</span></div>}
              <div>
                <p style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.28)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6 }}>{plan.name.toUpperCase()}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                  <span style={{ ...j, fontSize: 32, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>{plan.price}</span>
                  <span style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.28)" }}>{plan.desc}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Check size={11} color="#0ea5e9" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate(plan.action)}
                style={{ ...j, width: "100%", padding: "11px", borderRadius: 11, fontSize: 12, fontWeight: 700, background: plan.highlight ? BRAND : "rgba(255,255,255,0.06)", color: plan.highlight ? "#000" : "rgba(255,255,255,0.6)", border: `1px solid ${plan.highlight ? "transparent" : "rgba(255,255,255,0.08)"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                {t.cta} <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>

        <p style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.18)", textAlign: "center", marginTop: 20 }}>
          {t.terms}
        </p>
      </div>
    </div>
  );
}
