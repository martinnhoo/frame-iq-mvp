import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Zap, Loader2, Check, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'Plus Jakarta Sans', system-ui, sans-serif";

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

// ── Copy ──────────────────────────────────────────────────────────────────────
const HEADLINE: Record<string, Record<string, string>> = {
  chat: {
    pt: "3 dias grátis.\nSem cobrança agora.",
    es: "3 días gratis.\nSin cobro ahora.",
    en: "3 days free.\nNo charge now.",
  },
  tool: {
    pt: "Todas as ferramentas.\n3 dias grátis.",
    es: "Todas las herramientas.\n3 días gratis.",
    en: "All tools unlocked.\n3 days free.",
  },
  account: {
    pt: "3 dias grátis.\nSem cobrança agora.",
    es: "3 días gratis.\nSin cobro ahora.",
    en: "3 days free.\nNo charge now.",
  },
};

const SUBLINE: Record<string, Record<string, string>> = {
  chat: {
    pt: "Você usou suas 5 mensagens gratuitas. Continue com a IA conectada na sua conta real.",
    es: "Usaste tus 5 mensajes gratuitos. Continúa con la IA conectada a tu cuenta real.",
    en: "You've used your 5 free messages. Keep going with the AI connected to your real account.",
  },
  tool: {
    pt: "Desbloqueie todas as ferramentas — Hook Generator, Roteiro, Tradução, Check Criativo, Templates e mais.",
    es: "Desbloquea todas las herramientas — Hook Generator, Guión, Traducción, Check Creativo, Templates y más.",
    en: "Unlock all tools — Hook Generator, Script Writer, Translator, Creative Check, Templates and more.",
  },
  account: {
    pt: "Conecte sua conta e desbloqueie a IA com seus dados reais.",
    es: "Conecta tu cuenta y desbloquea la IA con tus datos reales.",
    en: "Connect your account and unlock AI with your real data.",
  },
};

const BADGES: Record<string, string[]> = {
  pt: ["IA ilimitada", "Multi-contas", "Todas as tools", "Hooks + Roteiros", "Alertas Telegram"],
  es: ["IA ilimitada", "Multi-cuentas", "Todas las tools", "Hooks + Guiones", "Alertas Telegram"],
  en: ["Unlimited AI", "Multiple accounts", "All tools unlocked", "Hooks + Scripts", "Telegram alerts"],
};

const PLANS: Record<string, { name: string; price: string; badge?: string; features: Record<string, string[]>; key: string; action: string; highlight: boolean }[]> = {
  en: [
    {
      key: "maker", name: "Maker", price: "$19/mo", highlight: false, action: "/signup?plan=maker",
      features: { en: ["1 ad account", "Creative tools", "Basic decision support"] },
    },
    {
      key: "pro", name: "Pro", price: "$49/mo", badge: "Most popular", highlight: true, action: "/signup?plan=pro",
      features: { en: ["3 ad accounts", "Full decision engine", "Real-time monitoring", "Multi-market"] },
    },
    {
      key: "studio", name: "Studio", price: "$149/mo", highlight: false, action: "/signup?plan=studio",
      features: { en: ["Unlimited accounts", "Faster analysis", "Priority processing", "Agency workspace"] },
    },
  ],
  pt: [
    {
      key: "maker", name: "Maker", price: "$19/mês", highlight: false, action: "/signup?plan=maker",
      features: { pt: ["1 conta de anúncios", "Ferramentas de criação", "Suporte a decisões básico"] },
    },
    {
      key: "pro", name: "Pro", price: "$49/mês", badge: "Mais popular", highlight: true, action: "/signup?plan=pro",
      features: { pt: ["3 contas de anúncios", "Decision engine completo", "Monitoramento em tempo real", "Multi-mercado"] },
    },
    {
      key: "studio", name: "Studio", price: "$149/mês", highlight: false, action: "/signup?plan=studio",
      features: { pt: ["Contas ilimitadas", "Análise acelerada", "Processamento prioritário", "Workspace agência"] },
    },
  ],
  es: [
    {
      key: "maker", name: "Maker", price: "$19/mes", highlight: false, action: "/signup?plan=maker",
      features: { es: ["1 cuenta de anuncios", "Herramientas de creación", "Soporte a decisiones básico"] },
    },
    {
      key: "pro", name: "Pro", price: "$49/mes", badge: "Más popular", highlight: true, action: "/signup?plan=pro",
      features: { es: ["3 cuentas de anuncios", "Decision engine completo", "Monitoreo en tiempo real", "Multi-mercado"] },
    },
    {
      key: "studio", name: "Studio", price: "$149/mes", highlight: false, action: "/signup?plan=studio",
      features: { es: ["Cuentas ilimitadas", "Análisis acelerado", "Procesamiento prioritario", "Workspace agencia"] },
    },
  ],
};

const FOOTER: Record<string, string> = {
  pt: "Cartão obrigatório · Sem cobrança por 3 dias · Cancele a qualquer momento",
  es: "Tarjeta requerida · Sin cargo 3 días · Cancela cuando quieras",
  en: "Card required · No charge for 3 days · Cancel anytime",
};

// ── Extra capacity packs ────────────────────────────────────────────────────
const CAPACITY_PACKS = [
  { actions: 100, price: "$29", id: "pack_100" },
  { actions: 300, price: "$79", id: "pack_300" },
  { actions: 1000, price: "$197", id: "pack_1000" },
];

const CAPACITY_LABEL: Record<string, Record<string, string>> = {
  title: {
    pt: "Ou adicione capacidade extra",
    es: "O agrega capacidad extra",
    en: "Or add extra capacity",
  },
  subtitle: {
    pt: "Sem mudar de plano · uso imediato",
    es: "Sin cambiar de plan · uso inmediato",
    en: "No plan change · instant access",
  },
  actions_label: {
    pt: "ações",
    es: "acciones",
    en: "actions",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function UpgradeWall({ onClose, trigger = "chat", inline = false }: UpgradeWallProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang = ["pt", "es"].includes(language) ? language : "en";
  const [loading, setLoading] = useState<string | null>(null);
  const plans = PLANS[lang] || PLANS.en;
  const sub = SUBLINE[trigger]?.[lang] || SUBLINE[trigger]?.en || "";
  const badges = BADGES[lang] || BADGES.en;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      (supabase as any).from("upgrade_events").insert({
        user_id: session.user.id, trigger,
        created_at: new Date().toISOString(),
      }).catch(() => {});
    });
  }, [trigger]);

  const handlePlan = async (planKey: string, fallback: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setLoading(planKey);
      try {
        const { data, error } = await supabase.functions.invoke("create-checkout", {
          body: { price_id: PRICE_IDS[planKey] },
        });
        if (!error && data?.url) { window.location.href = data.url; return; }
      } catch {}
      setLoading(null);
    }
    navigate(fallback);
  };

  // ── MOBILE: bottom sheet ──────────────────────────────────────────────────
  const MobileSheet = () => (
    <div style={{ width: "100%", background: "#0d1117", borderRadius: "20px 20px 0 0", overflow: "hidden", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
      {/* Handle bar */}
      <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
      </div>

      {/* Scrollable content */}
      <div style={{ overflowY: "auto", padding: "8px 20px 32px", flex: 1 }}>
        {/* Close */}
        {onClose && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} color="rgba(255,255,255,0.4)" />
            </button>
          </div>
        )}

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)", marginBottom: 14 }}>
            <Zap size={11} color="#0ea5e9" />
            <span style={{ fontFamily: M, fontSize: 12, color: "#0ea5e9", fontWeight: 600 }}>
              {lang === "pt" ? "3 dias grátis · Cancele quando quiser" : lang === "es" ? "3 días gratis · Cancela cuando quieras" : "3 days free · Cancel anytime"}
            </span>
          </div>
          <h2 style={{ fontFamily: F, fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 10, whiteSpace: "pre-line" }}>
            {(HEADLINE[trigger] || HEADLINE.chat)[lang] || (HEADLINE[trigger] || HEADLINE.chat).en}
          </h2>
          <p style={{ fontFamily: M, fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, maxWidth: 320, margin: "0 auto" }}>{sub}</p>
        </div>

        {/* Feature badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 24 }}>
          {badges.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Check size={10} color="#34d399" strokeWidth={3} />
              <span style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{b}</span>
            </div>
          ))}
        </div>

        {/* Plans — vertical on mobile */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {plans.map(plan => (
            <div key={plan.key} style={{ padding: "16px", borderRadius: 14, background: plan.highlight ? "linear-gradient(135deg, rgba(14,165,233,0.08), rgba(99,102,241,0.06))" : "rgba(255,255,255,0.03)", border: `1px solid ${plan.highlight ? "rgba(14,165,233,0.25)" : "rgba(255,255,255,0.07)"}`, position: "relative" }}>
              {plan.badge && (
                <div style={{ position: "absolute", top: -9, left: 16, background: "#0ea5e9", borderRadius: 5, padding: "2px 10px" }}>
                  <span style={{ fontFamily: F, fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase" }}>{plan.badge}</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <p style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>{plan.name}</p>
                  <p style={{ fontFamily: F, fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>{plan.price}</p>
                </div>
                <button
                  onClick={() => handlePlan(plan.key, plan.action)}
                  disabled={!!loading}
                  style={{ fontFamily: F, fontSize: 13, fontWeight: 700, padding: "10px 20px", borderRadius: 10, background: plan.highlight ? "#0ea5e9" : "rgba(255,255,255,0.08)", color: plan.highlight ? "#fff" : "rgba(255,255,255,0.6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, opacity: loading && loading !== plan.key ? 0.5 : 1, flexShrink: 0 }}>
                  {loading === plan.key ? <Loader2 size={13} className="animate-spin" /> : <>{lang === "pt" ? "Testar grátis" : lang === "es" ? "Probar gratis" : "Start free"} <ArrowRight size={12} /></>}
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {((plan.features as any)[lang] || (plan.features as any).en).map((f: string) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Check size={10} color={plan.highlight ? "#0ea5e9" : "rgba(255,255,255,0.3)"} strokeWidth={2.5} />
                    <span style={{ fontFamily: M, fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Extra capacity packs */}
        <div style={{ marginTop: 20, padding: "16px 0 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 4 }}>
            {CAPACITY_LABEL.title[lang] || CAPACITY_LABEL.title.en}
          </p>
          <p style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", marginBottom: 12 }}>
            {CAPACITY_LABEL.subtitle[lang] || CAPACITY_LABEL.subtitle.en}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {CAPACITY_PACKS.map(pack => (
              <button key={pack.id} onClick={() => handlePlan(pack.id, `/dashboard?pack=${pack.id}`)} disabled={!!loading}
                style={{ flex: 1, padding: "10px 6px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", textAlign: "center", transition: "all 0.15s", opacity: loading && loading !== pack.id ? 0.5 : 1 }}>
                <p style={{ fontFamily: F, fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>+{pack.actions.toLocaleString()}</p>
                <p style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>{CAPACITY_LABEL.actions_label[lang] || "actions"}</p>
                <p style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#0ea5e9" }}>{pack.price}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
          {FOOTER[lang] || FOOTER.en}
        </p>
      </div>
    </div>
  );

  // ── DESKTOP: centered modal ───────────────────────────────────────────────
  const DesktopModal = () => (
    <div style={{ width: "100%", maxWidth: 640, background: inline ? "transparent" : "#0d1117", border: inline ? "none" : "1px solid rgba(255,255,255,0.08)", borderRadius: inline ? 0 : 24, padding: inline ? "0" : "36px 32px", boxShadow: inline ? "none" : "0 40px 100px rgba(0,0,0,0.7)", position: "relative" }}>
      {onClose && !inline && (
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={13} color="rgba(255,255,255,0.4)" />
        </button>
      )}

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 20, background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)", marginBottom: 18 }}>
          <Zap size={12} color="#0ea5e9" />
          <span style={{ fontFamily: M, fontSize: 12, color: "#0ea5e9", fontWeight: 600 }}>
            {lang === "pt" ? "3 dias grátis em qualquer plano · Cancele quando quiser" : lang === "es" ? "3 días gratis · Cancela cuando quieras" : "3 days free on any plan · Cancel anytime"}
          </span>
        </div>
        <h2 style={{ fontFamily: F, fontSize: 32, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: 12, whiteSpace: "pre-line" }}>
          {(HEADLINE[trigger] || HEADLINE.chat)[lang] || (HEADLINE[trigger] || HEADLINE.chat).en}
        </h2>
        <p style={{ fontFamily: M, fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, maxWidth: 400, margin: "0 auto 20px" }}>{sub}</p>

        {/* Feature badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
          {badges.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Check size={10} color="#34d399" strokeWidth={3} />
              <span style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{b}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plans — 3 columns on desktop */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {plans.map(plan => (
          <div key={plan.key} style={{ padding: "20px 16px", borderRadius: 14, background: plan.highlight ? "linear-gradient(135deg, rgba(14,165,233,0.08), rgba(99,102,241,0.06))" : "rgba(255,255,255,0.02)", border: `1px solid ${plan.highlight ? "rgba(14,165,233,0.28)" : "rgba(255,255,255,0.07)"}`, display: "flex", flexDirection: "column", gap: 14, position: "relative", boxShadow: plan.highlight ? "0 0 32px rgba(14,165,233,0.08)" : "none" }}>
            {plan.badge && (
              <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: "#0ea5e9", borderRadius: 6, padding: "3px 12px", whiteSpace: "nowrap", boxShadow: "0 0 12px rgba(14,165,233,0.3)" }}>
                <span style={{ fontFamily: F, fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: "0.08em", textTransform: "uppercase" }}>{plan.badge}</span>
              </div>
            )}
            <div>
              <p style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>{plan.name}</p>
              <p style={{ fontFamily: F, fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1 }}>{plan.price}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
              {((plan.features as any)[lang] || (plan.features as any).en).map((f: string) => (
                <div key={f} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <Check size={11} color={plan.highlight ? "#0ea5e9" : "rgba(255,255,255,0.25)"} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontFamily: M, fontSize: 12, color: plan.highlight ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>{f}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => handlePlan(plan.key, plan.action)}
              disabled={!!loading}
              style={{ fontFamily: F, width: "100%", padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: plan.highlight ? "#0ea5e9" : "rgba(255,255,255,0.07)", color: plan.highlight ? "#fff" : "rgba(255,255,255,0.5)", border: plan.highlight ? "none" : "1px solid rgba(255,255,255,0.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, opacity: loading && loading !== plan.key ? 0.5 : 1, boxShadow: plan.highlight ? "0 0 20px rgba(14,165,233,0.2)" : "none", transition: "all 0.15s" }}>
              {loading === plan.key ? <Loader2 size={12} className="animate-spin" /> : <>{lang === "pt" ? "Testar grátis" : lang === "es" ? "Probar gratis" : "Start free trial"} <ArrowRight size={11} /></>}
            </button>
          </div>
        ))}
      </div>

      {/* Extra capacity packs */}
      <div style={{ marginTop: 16, padding: "16px 0 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>
            {CAPACITY_LABEL.title[lang] || CAPACITY_LABEL.title.en}
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>·</span>
          <span style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.22)" }}>
            {CAPACITY_LABEL.subtitle[lang] || CAPACITY_LABEL.subtitle.en}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {CAPACITY_PACKS.map(pack => (
            <button key={pack.id} onClick={() => handlePlan(pack.id, `/dashboard?pack=${pack.id}`)} disabled={!!loading}
              style={{ padding: "12px 8px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", textAlign: "center", transition: "all 0.15s", opacity: loading && loading !== pack.id ? 0.5 : 1 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(14,165,233,0.25)"; e.currentTarget.style.background = "rgba(14,165,233,0.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}>
              <p style={{ fontFamily: F, fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>+{pack.actions.toLocaleString()}</p>
              <p style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.30)", marginBottom: 3 }}>{CAPACITY_LABEL.actions_label[lang] || "actions"}</p>
              <p style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: "#0ea5e9" }}>{pack.price}</p>
            </button>
          ))}
        </div>
      </div>

      <p style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.18)", textAlign: "center", marginTop: 12 }}>
        {FOOTER[lang] || FOOTER.en}
      </p>
    </div>
  );

  if (inline) return (
    <div style={{ width: "100%", maxWidth: 640 }}>
      <DesktopModal />
    </div>
  );

  return (
    <>
      {/* Responsive: bottom sheet on mobile, centered modal on desktop */}
      <style>{`
        @media (max-width: 640px) { .upgrade-desktop { display: none !important; } .upgrade-mobile { display: flex !important; } }
        @media (min-width: 641px) { .upgrade-mobile { display: none !important; } .upgrade-desktop { display: flex !important; } }
      `}</style>

      {/* Mobile bottom sheet */}
      <div className="upgrade-mobile" style={{ position: "fixed", inset: 0, zIndex: 9999, alignItems: "flex-end", justifyContent: "center", overflowY: "auto" }}>
        <div role="button" aria-label="Close" tabIndex={0} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }} onClick={onClose} onKeyDown={e => e.key === "Escape" && onClose?.()} />
        <div style={{ position: "relative", width: "100%" }}>
          <MobileSheet />
        </div>
      </div>

      {/* Desktop centered modal */}
      <div className="upgrade-desktop" style={{ position: "fixed", inset: 0, zIndex: 9999, alignItems: "flex-start", justifyContent: "center", padding: "24px 24px 40px", overflowY: "auto" }}>
        <div role="button" aria-label="Close" tabIndex={0} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)" }} onClick={onClose} onKeyDown={e => e.key === "Escape" && onClose?.()} />
        <div style={{ position: "relative" }}>
          <DesktopModal />
        </div>
      </div>
    </>
  );
}
