import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, X, Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

const BRAND = "linear-gradient(135deg, #0ea5e9, #06b6d4)";
const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;

const PRICE_IDS: Record<string, string> = {
  maker:  "price_1T9sd1Dr9So14XztT3Mqddch",
  pro:    "price_1T9sdfDr9So14XztPR3tI14Y",
  studio: "price_1T9seMDr9So14Xzt0vEJNQIX",
};

interface UpgradeWallProps {
  onClose?: () => void;
  trigger?: "chat" | "tool" | "account";
  inline?: boolean;
}

const MESSAGES: Record<string, Record<string, { icon: string; title: string; sub: string }>> = {
  en: {
    chat:    { icon: "💬", title: "You've used your 3 free messages.", sub: "Upgrade to keep asking — your data is connected, now let's actually use it." },
    tool:    { icon: "⚡", title: "This tool requires a paid plan.", sub: "Upgrade to unlock all tools — hooks, scripts, briefs, competitor analysis and more." },
    account: { icon: "🔗", title: "Connect your Meta Ads account.", sub: "Connect once and the AI reads your real data. Free plan includes 3 messages to try it." },
  },
  pt: {
    chat:    { icon: "💬", title: "Você usou suas 3 mensagens gratuitas.", sub: "Faça upgrade para continuar — seus dados já estão conectados, agora é hora de usar." },
    tool:    { icon: "⚡", title: "Esta ferramenta requer um plano pago.", sub: "Faça upgrade para desbloquear todas as ferramentas — hooks, roteiros, briefs, análise de concorrentes e mais." },
    account: { icon: "🔗", title: "Conecte sua conta do Meta Ads.", sub: "Conecte uma vez e a IA lê seus dados reais. O plano gratuito inclui 3 mensagens para testar." },
  },
  es: {
    chat:    { icon: "💬", title: "Has usado tus 3 mensajes gratuitos.", sub: "Mejora tu plan para seguir — tus datos ya están conectados, ahora úsalos." },
    tool:    { icon: "⚡", title: "Esta herramienta requiere un plan de pago.", sub: "Mejora tu plan para desbloquear todas las herramientas — hooks, guiones, briefs, análisis de competidores y más." },
    account: { icon: "🔗", title: "Conecta tu cuenta de Meta Ads.", sub: "Conecta una vez y la IA lee tus datos reales. El plan gratuito incluye 3 mensajes para probarlo." },
  },
  fr: {
    chat:    { icon: "💬", title: "Vous avez utilisé vos 3 messages gratuits.", sub: "Passez à un plan supérieur pour continuer — vos données sont connectées, maintenant utilisez-les." },
    tool:    { icon: "⚡", title: "Cet outil nécessite un abonnement payant.", sub: "Passez à un plan supérieur pour débloquer tous les outils." },
    account: { icon: "🔗", title: "Connectez votre compte Meta Ads.", sub: "Connectez une fois et l'IA lit vos données réelles. Le plan gratuit inclut 3 messages d'essai." },
  },
  de: {
    chat:    { icon: "💬", title: "Sie haben Ihre 3 kostenlosen Nachrichten verwendet.", sub: "Upgraden Sie, um fortzufahren — Ihre Daten sind verbunden, jetzt nutzen Sie sie." },
    tool:    { icon: "⚡", title: "Dieses Tool erfordert einen bezahlten Plan.", sub: "Upgraden Sie, um alle Tools freizuschalten." },
    account: { icon: "🔗", title: "Verbinden Sie Ihr Meta Ads-Konto.", sub: "Einmal verbinden und die KI liest Ihre echten Daten. Kostenloser Plan beinhaltet 3 Testnachrichten." },
  },
};

const TRIAL_TEXT: Record<string, string> = {
  en: "3-day free trial on any plan · Cancel anytime",
  pt: "1 dia de teste grátis em qualquer plano · Cancele quando quiser",
  es: "1 día de prueba gratis en cualquier plan · Cancela cuando quieras",
  fr: "1 jour d'essai gratuit sur n'importe quel plan · Annulez à tout moment",
  de: "1 Tag kostenloser Test auf jedem Plan · Jederzeit kündbar",
};

const FOOTER_TEXT: Record<string, string> = {
  en: "Card required · No charge for 72 hours (3 days) · Cancel within 3 days and pay nothing",
  pt: "Cartão obrigatório · Sem cobrança por 72 horas (3 dias) · Cancele dentro de 3 dias e não pague nada",
  es: "Tarjeta requerida · Sin cargo por 72 horas (3 dias) · Cancela dentro de 3 días y no pagas nada",
  fr: "Carte requise · Aucun frais pendant 24 heures · Annulez avant la fin de l'essai et ne payez rien",
  de: "Karte erforderlich · 24 Stunden keine Gebühr · Kündigen Sie vor Ende des Tests und zahlen Sie nichts",
};

const START_TRIAL_TEXT: Record<string, string> = {
  en: "Start trial",
  pt: "Iniciar trial",
  es: "Iniciar prueba",
  fr: "Démarrer l'essai",
  de: "Test starten",
};

const MOST_POPULAR_TEXT: Record<string, string> = {
  en: "Most popular",
  pt: "Mais popular",
  es: "Más popular",
  fr: "Le plus populaire",
  de: "Am beliebtesten",
};

const PLANS_DATA = (lang: string) => [
  {
    name: "Maker", price: "$19", desc: "/mo",
    features: {
      en: ["50 AI messages/day", "1 ad account", "All tools unlocked", "3 personas"],
      pt: ["50 mensagens de IA/dia", "1 conta de anúncios", "Todas as ferramentas", "3 personas"],
      es: ["50 mensajes de IA/día", "1 cuenta de anuncios", "Todas las herramientas", "3 personas"],
      fr: ["50 messages IA/jour", "1 compte publicitaire", "Tous les outils", "3 personas"],
      de: ["50 KI-Nachrichten/Tag", "1 Anzeigenkonto", "Alle Tools", "3 Personas"],
    },
    action: "/signup?plan=maker", highlight: false,
  },
  {
    name: "Pro", price: "$49", desc: "/mo",
    features: {
      en: ["200 AI messages/day", "3 ad accounts", "All tools unlocked", "Unlimited personas", "Multi-market"],
      pt: ["200 mensagens de IA/dia", "3 contas de anúncios", "Todas as ferramentas", "Personas ilimitadas", "Multi-mercado"],
      es: ["200 mensajes de IA/día", "3 cuentas de anuncios", "Todas las herramientas", "Personas ilimitadas", "Multi-mercado"],
      fr: ["200 messages IA/jour", "3 comptes publicitaires", "Tous les outils", "Personas illimitées", "Multi-marché"],
      de: ["200 KI-Nachrichten/Tag", "3 Anzeigenkonten", "Alle Tools", "Unbegrenzte Personas", "Multi-Markt"],
    },
    action: "/signup?plan=pro", highlight: true,
  },
  {
    name: "Studio", price: "$149", desc: "/mo",
    features: {
      en: ["Unlimited AI messages", "Unlimited accounts", "All tools unlocked", "Agency workspace"],
      pt: ["Mensagens de IA ilimitadas", "Contas ilimitadas", "Todas as ferramentas", "Workspace para agências"],
      es: ["Mensajes de IA ilimitados", "Cuentas ilimitadas", "Todas las herramientas", "Workspace para agencias"],
      fr: ["Messages IA illimités", "Comptes illimités", "Tous les outils", "Espace de travail agence"],
      de: ["Unbegrenzte KI-Nachrichten", "Unbegrenzte Konten", "Alle Tools", "Agentur-Workspace"],
    },
    action: "/signup?plan=studio", highlight: false,
  },
];

export default function UpgradeWall({ onClose, trigger = "chat", inline = false }: UpgradeWallProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang = ["en","pt","es","fr","de"].includes(language) ? language : "en";
  const messages = MESSAGES[lang] || MESSAGES.en;
  const msg = messages[trigger];
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Track which gate triggers upgrade wall — fires once on mount, silent
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      (supabase as any).from("upgrade_events").insert({
        user_id: session.user.id,
        trigger,
        created_at: new Date().toISOString(),
      }).catch(() => {});
    });
  }, [trigger]);
  const plans = PLANS_DATA(lang);

  const handlePlan = async (planKey: string, fallbackUrl: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setLoadingPlan(planKey);
      try {
        const { data, error } = await supabase.functions.invoke("create-checkout", {
          body: { price_id: PRICE_IDS[planKey] },
        });
        if (!error && data?.url) { window.location.href = data.url; return; }
      } catch {}
      setLoadingPlan(null);
    }
    navigate(fallbackUrl);
  };

  const content = (
    <div style={{ width: "100%", maxWidth: inline ? "100%" : 680, background: "#0a0b1a", border: "1px solid rgba(255,255,255,0.09)", borderRadius: inline ? 16 : 24, padding: inline ? "24px" : "36px 32px", boxShadow: inline ? "none" : "0 40px 100px rgba(0,0,0,0.6)", position: "relative" }}>
      {onClose && !inline && (
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.10)", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X size={13} color="rgba(255,255,255,0.4)" />
        </button>
      )}

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{msg.icon}</div>
        <h2 style={{ ...j, fontSize: inline ? 18 : 22, fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: "-0.03em", lineHeight: 1.2 }}>{msg.title}</h2>
        <p style={{ ...j, fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, maxWidth: 420, margin: "0 auto 14px" }}>{msg.sub}</p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)" }}>
          <Zap size={12} color="#0ea5e9" />
          <span style={{ ...j, fontSize: 12, color: "#0ea5e9", fontWeight: 600 }}>{TRIAL_TEXT[lang] || TRIAL_TEXT.en}</span>
        </div>
      </div>

      {/* Plans */}
      <div className="upgrade-wall-plans" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <style>{`.upgrade-wall-plans{grid-template-columns:repeat(3,1fr)}@media(max-width:600px){.upgrade-wall-plans{grid-template-columns:1fr!important}}`}</style>
        {plans.map(plan => {
          const features = (plan.features as any)[lang] || (plan.features as any).en;
          const planKey = plan.name.toLowerCase();
          return (
            <div key={plan.name} style={{ padding: "18px 16px", borderRadius: 14, background: plan.highlight ? "rgba(14,165,233,0.07)" : "rgba(255,255,255,0.02)", border: `1px solid ${plan.highlight ? "rgba(14,165,233,0.28)" : "rgba(255,255,255,0.10)"}`, display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
              {plan.highlight && (
                <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: BRAND, borderRadius: 6, padding: "2px 12px", whiteSpace: "nowrap" }}>
                  <span style={{ ...j, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "#000", fontWeight: 800 }}>{MOST_POPULAR_TEXT[lang] || MOST_POPULAR_TEXT.en}</span>
                </div>
              )}
              <div>
                <p style={{ ...j, fontSize: 10, color: "rgba(255,255,255,0.28)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>{plan.name.toUpperCase()}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                  <span style={{ ...j, fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>{plan.price}</span>
                  <span style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{plan.desc}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
                {features.map((f: string) => (
                  <div key={f} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                    <span style={{ color: "#0ea5e9", fontSize: 11, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ ...j, fontSize: 11.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => handlePlan(planKey, plan.action)}
                disabled={loadingPlan === planKey}
                style={{ ...j, width: "100%", padding: "11px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: plan.highlight ? BRAND : "rgba(255,255,255,0.10)", color: plan.highlight ? "#000" : "rgba(255,255,255,0.6)", border: `1px solid ${plan.highlight ? "transparent" : "rgba(255,255,255,0.09)"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, opacity: loadingPlan && loadingPlan !== planKey ? 0.5 : 1 }}>
                {loadingPlan === planKey ? <Loader2 size={12} className="animate-spin" /> : <>{START_TRIAL_TEXT[lang] || START_TRIAL_TEXT.en} <ArrowRight size={11} /></>}
              </button>
            </div>
          );
        })}
      </div>

      <p style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.18)", textAlign: "center", marginTop: 14 }}>
        {FOOTER_TEXT[lang] || FOOTER_TEXT.en}
      </p>
    </div>
  );

  if (inline) return content;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }} className="sm:items-center sm:p-6">
      <div style={{ position: "absolute", inset: 0, background: "rgba(6,8,18,0.9)", backdropFilter: "blur(12px)" }} onClick={onClose} />
      <div style={{ position: "relative" }}>{content}</div>
    </div>
  );
}
