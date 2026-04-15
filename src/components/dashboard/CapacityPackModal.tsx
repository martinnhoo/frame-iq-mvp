/**
 * CapacityPackModal — Dedicated modal for purchasing extra capacity.
 *
 * Trigger points:
 *  - Soft hint at 80% usage (link in UsageBar)
 *  - Hard block at 100% when user attempts any action
 *
 * NOT shown on pricing page or upgrade modals.
 * Free users see "Upgrade to unlock full system" instead.
 */
import { useState } from "react";
import { X, Zap, ChevronRight, Loader2, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

const PACKS = [
  { id: "pack_100",  actions: 100,  price: "$29",  popular: false },
  { id: "pack_300",  actions: 300,  price: "$79",  popular: true },
  { id: "pack_1000", actions: 1000, price: "$197", popular: false },
] as const;

const T = {
  pt: {
    title: "Você atingiu seu limite mensal",
    subtitle: "Sua ação atual está pausada até a capacidade ser restaurada.",
    actions: "ações",
    bestValue: "Melhor valor",
    unlock: "Desbloquear",
    upgradeInstead: "Ou faça upgrade do seu plano",
    footer: "Pagamento único · Stripe · Créditos adicionados na hora",
    error: "Algo deu errado. Tente novamente.",
    freeBlock: "Faça upgrade para desbloquear o sistema completo",
    freeBlockSub: "Capacity packs estão disponíveis para planos pagos.",
    upgradeCta: "Ver planos",
  },
  es: {
    title: "Has alcanzado tu límite mensual",
    subtitle: "Tu acción actual está pausada hasta restaurar la capacidad.",
    actions: "acciones",
    bestValue: "Mejor valor",
    unlock: "Desbloquear",
    upgradeInstead: "O mejora tu plan",
    footer: "Pago único · Stripe · Créditos agregados al instante",
    error: "Algo salió mal. Inténtalo de nuevo.",
    freeBlock: "Mejora tu plan para desbloquear el sistema completo",
    freeBlockSub: "Los packs de capacidad están disponibles para planes pagos.",
    upgradeCta: "Ver planes",
  },
  en: {
    title: "You've reached your monthly limit",
    subtitle: "Your current action is paused until capacity is restored.",
    actions: "actions",
    bestValue: "Best value",
    unlock: "Unlock",
    upgradeInstead: "Or upgrade your plan instead",
    footer: "One-time payment · Stripe · Capacity added instantly",
    error: "Something went wrong. Please try again.",
    freeBlock: "Upgrade to unlock the full system",
    freeBlockSub: "Capacity packs are available for paid plans.",
    upgradeCta: "View plans",
  },
};

interface Props {
  open: boolean;
  onClose: () => void;
  onUpgrade?: () => void;    // opens PlanUpgradeModal instead
  plan?: string;
  onSuccess?: () => void;    // called after successful purchase (refresh usage, retry action)
}

export function CapacityPackModal({ open, onClose, onUpgrade, plan = "free", onSuccess }: Props) {
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const { language } = useLanguage();
  const lang = (language === "pt" || language === "es" || language === "en") ? language : "pt";
  const t = T[lang];
  const isFree = plan === "free";

  const handlePurchase = async (packId: string) => {
    setPurchasing(packId);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-capacity-pack", {
        body: { pack: packId },
      });
      if (error) throw error;

      if (data?.error === "upgrade_required") {
        // Free user somehow got here — redirect to upgrade
        onUpgrade?.();
        onClose();
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error(t.error);
      }
    } catch {
      toast.error(t.error);
    } finally {
      setPurchasing(null);
    }
  };

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes capModalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .cap-modal-enter { animation: capModalIn 0.22s cubic-bezier(.23,1,.32,1) both; }
      `}</style>

      <div
        className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="cap-modal-enter w-full max-w-md rounded-3xl overflow-hidden"
          style={{
            background: "linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(12,15,26,0.98) 100%)",
            border: "1px solid rgba(14,165,233,0.30)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset, 0 32px 80px rgba(0,0,0,0.7), 0 0 80px rgba(14,165,233,0.08)",
            backdropFilter: "blur(24px)",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08]">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-400" />
                {isFree ? t.freeBlock : t.title}
              </h2>
              <p className="text-xs text-white/40 mt-0.5">
                {isFree ? t.freeBlockSub : t.subtitle}
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5">
            {isFree ? (
              /* Free users — just show upgrade CTA */
              <button
                onClick={() => { onUpgrade?.(); onClose(); }}
                className="w-full py-3 rounded-xl bg-sky-500/20 text-sky-400 font-semibold text-sm hover:bg-sky-500/30 transition-all flex items-center justify-center gap-2"
              >
                {t.upgradeCta}
                <ArrowUpRight className="h-4 w-4" />
              </button>
            ) : (
              /* Paid users — show capacity packs */
              <div className="space-y-2.5">
                {PACKS.map(pack => (
                  <div
                    key={pack.id}
                    onClick={() => !purchasing && handlePurchase(pack.id)}
                    className={`relative flex items-center justify-between rounded-2xl border px-5 py-4 cursor-pointer transition-all duration-150 ${
                      pack.popular
                        ? "border-sky-500/30 bg-sky-500/[0.06] hover:border-sky-500/50 hover:bg-sky-500/[0.10]"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]"
                    } ${purchasing === pack.id ? "opacity-60 pointer-events-none" : "hover:scale-[1.01] active:scale-[0.99]"}`}
                  >
                    {pack.popular && (
                      <span className="absolute -top-2 left-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0d0d0d] border border-sky-500/20 text-sky-400">
                        {t.bestValue}
                      </span>
                    )}

                    {/* Left: actions count */}
                    <div>
                      <p className="text-lg font-black text-white">
                        +{pack.actions.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-white/30">{t.actions}</p>
                    </div>

                    {/* Right: price + CTA */}
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold text-sky-400">{pack.price}</span>
                      <button
                        disabled={!!purchasing}
                        className={`flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          pack.popular
                            ? "bg-sky-500/20 text-sky-300 hover:bg-sky-500/30"
                            : "bg-white/10 text-white/80 hover:bg-white/15"
                        }`}
                      >
                        {purchasing === pack.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            {t.unlock}
                            <ChevronRight className="h-3 w-3" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Secondary: upgrade plan link (for paid users) */}
            {!isFree && onUpgrade && (
              <button
                onClick={() => { onUpgrade(); onClose(); }}
                className="mt-4 w-full text-center text-xs text-white/30 hover:text-white/50 transition-colors flex items-center justify-center gap-1"
              >
                {t.upgradeInstead}
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Footer */}
          {!isFree && (
            <div className="px-6 pb-4 text-center">
              <p className="text-[11px] text-white/15">{t.footer}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
