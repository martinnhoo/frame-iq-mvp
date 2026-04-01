import { useState } from "react";
import { X, Check, Zap, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PLAN_PRICES: Record<string, string> = {
  maker:  "price_1T9sd1Dr9So14XztT3Mqddch",
  pro:    "price_1T9sdfDr9So14XztPR3tI14Y",
  studio: "price_1T9seMDr9So14Xzt0vEJNQIX",
};

const PLANS = [
  {
    id: "maker",
    name: "Maker",
    price: "$19",
    gradient: "from-blue-500/20 to-blue-900/5",
    border: "border-blue-500/20 hover:border-blue-500/40",
    accent: "text-blue-400",
    badge: null,
    features: {
      pt: ["50 mensagens de IA/dia", "1 conta de anúncios", "Todas as ferramentas", "3 personas"],
      es: ["50 mensajes de IA/día", "1 cuenta de anuncios", "Todas las herramientas", "3 personas"],
      en: ["50 AI messages/day", "1 ad account", "All tools", "3 personas"],
    },
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    gradient: "from-sky-500/20 to-sky-900/5",
    border: "border-sky-500/20 hover:border-sky-500/40",
    accent: "text-sky-400",
    badge: { pt: "Mais popular", es: "Más popular", en: "Most Popular" },
    features: {
      pt: ["200 mensagens de IA/dia", "3 contas de anúncios", "Todas as ferramentas", "Personas ilimitadas", "Multi-mercado"],
      es: ["200 mensajes de IA/día", "3 cuentas de anuncios", "Todas las herramientas", "Personas ilimitadas", "Multi-mercado"],
      en: ["200 AI messages/day", "3 ad accounts", "All tools", "Unlimited personas", "Multi-market"],
    },
  },
  {
    id: "studio",
    name: "Studio",
    price: "$149",
    gradient: "from-pink-500/20 to-pink-900/5",
    border: "border-pink-500/20 hover:border-pink-500/40",
    accent: "text-pink-400",
    badge: { pt: "Melhor valor", es: "Mejor valor", en: "Best value" },
    features: {
      pt: ["IA ilimitada", "Contas ilimitadas", "Todas as ferramentas", "Workspace agência", "Suporte prioritário"],
      es: ["IA ilimitada", "Cuentas ilimitadas", "Todas las herramientas", "Workspace agencia", "Soporte prioritario"],
      en: ["Unlimited AI", "Unlimited accounts", "All tools", "Agency workspace", "Priority support"],
    },
  },
];

const T = {
  pt: {
    title: "Faça upgrade do seu plano",
    subtitle: "3 dias grátis em todos os planos · Cancele quando quiser",
    current: "Plano atual",
    start: "Começar",
    footer: "Powered by Stripe · Cancele quando quiser · Sem taxas ocultas",
    period: "/mês",
    error: "Algo deu errado. Tente novamente.",
    error_checkout: "Não foi possível criar a sessão de pagamento.",
  },
  es: {
    title: "Mejora tu plan",
    subtitle: "3 días gratis en todos los planes · Cancela cuando quieras",
    current: "Plan actual",
    start: "Comenzar",
    footer: "Powered by Stripe · Cancela cuando quieras · Sin tarifas ocultas",
    period: "/mes",
    error: "Algo salió mal. Inténtalo de nuevo.",
    error_checkout: "No se pudo crear la sesión de pago.",
  },
  en: {
    title: "Upgrade your plan",
    subtitle: "3-day free trial on all plans · Cancel anytime",
    current: "Current plan",
    start: "Start",
    footer: "Powered by Stripe · Cancel anytime · No hidden fees",
    period: "/mo",
    error: "Something went wrong. Please try again.",
    error_checkout: "Could not create checkout session.",
  },
};

interface Props {
  open: boolean;
  onClose: () => void;
  currentPlan?: string;
  language?: string;
}

export function PlanUpgradeModal({ open, onClose, currentPlan = "free", language = "pt" }: Props) {
  const [selecting, setSelecting] = useState<string | null>(null);
  const lang = (language === "pt" || language === "es" || language === "en") ? language : "pt";
  const t = T[lang];

  const handleSelect = async (planId: string) => {
    setSelecting(planId);
    try {
      const priceId = PLAN_PRICES[planId];
      if (!priceId) return;
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { price_id: priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error(t.error_checkout);
      }
    } catch {
      toast.error(t.error);
    } finally {
      setSelecting(null);
    }
  };

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .modal-enter { animation: modalIn 0.22s cubic-bezier(.23,1,.32,1) both; }
      `}</style>

      <div
        className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="modal-enter w-full max-w-3xl bg-[#0d0d0d] rounded-3xl border border-white/[0.15] shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-7 py-5 border-b border-white/[0.12]">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-400" />
                {t.title}
              </h2>
              <p className="text-xs text-white/50 mt-0.5">{t.subtitle}</p>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Plans */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PLANS.map(plan => {
              const isCurrent = plan.id === currentPlan;
              const features = plan.features[lang] || plan.features.en;
              const badge = plan.badge ? plan.badge[lang] : null;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border bg-gradient-to-br ${plan.gradient} ${plan.border} p-4 flex flex-col transition-all duration-150 ${
                    isCurrent ? "opacity-40 cursor-default" : "cursor-pointer hover:scale-[1.02]"
                  }`}
                  onClick={() => !isCurrent && handleSelect(plan.id)}
                >
                  {badge && (
                    <span className={`absolute -top-2 left-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0d0d0d] border border-white/10 ${plan.accent}`}>
                      {badge}
                    </span>
                  )}
                  <div className="mb-3">
                    <p className={`text-base font-bold ${plan.accent}`}>{plan.name}</p>
                    <p className="mt-1">
                      <span className="text-2xl font-black text-white">{plan.price}</span>
                      <span className="text-xs text-white/50">{t.period}</span>
                    </p>
                  </div>
                  <div className="space-y-1.5 flex-1">
                    {features.map((f: string) => (
                      <div key={f} className="flex items-center gap-1.5">
                        <Check className={`h-3 w-3 shrink-0 ${plan.accent}`} />
                        <span className="text-xs text-white/60">{f}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    disabled={isCurrent || selecting === plan.id}
                    className={`mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isCurrent
                        ? "bg-white/5 text-white/40 cursor-default"
                        : "bg-white/10 text-white hover:bg-white/15 active:scale-95"
                    }`}
                  >
                    {selecting === plan.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isCurrent ? (
                      t.current
                    ) : (
                      <>{t.start} {plan.name} <ChevronRight className="h-3 w-3" /></>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="px-7 pb-5 text-center">
            <p className="text-[11px] text-white/15">{t.footer}</p>
          </div>
        </div>
      </div>
    </>
  );
}
