import { useState } from "react";
import { X, Check, Zap, ChevronRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PLANS = [
  {
    id: "maker",
    name: "Maker",
    price: "$19",
    period: "/mo",
    gradient: "from-blue-500/20 to-blue-900/5",
    border: "border-blue-500/20 hover:border-blue-500/40",
    accent: "text-blue-400",
    badge: null,
    features: ["20 analyses/mo", "20 boards/mo", "Unlimited hooks", "20 pre-flights/mo", "No cooldown", "All templates"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    period: "/mo",
    gradient: "from-purple-500/20 to-purple-900/5",
    border: "border-purple-500/20 hover:border-purple-500/40",
    accent: "text-purple-400",
    badge: "Popular",
    features: ["60 analyses/mo", "60 boards/mo", "Unlimited hooks", "Unlimited translations", "AI learning profile", "Persona intelligence"],
  },
  {
    id: "studio",
    name: "Studio",
    price: "$149",
    period: "/mo",
    gradient: "from-pink-500/20 to-pink-900/5",
    border: "border-pink-500/20 hover:border-pink-500/40",
    accent: "text-pink-400",
    badge: "Unlimited",
    features: ["Unlimited analyses", "Unlimited boards", "Unlimited everything", "API access", "Priority support", "Priority processing"],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  currentPlan?: string;
}

export function PlanUpgradeModal({ open, onClose, currentPlan = "free" }: Props) {
  const navigate = useNavigate();
  const [selecting, setSelecting] = useState<string | null>(null);

  const handleSelect = async (planId: string) => {
    setSelecting(planId);
    // Paddle integration placeholder
    await new Promise(r => setTimeout(r, 800));
    setSelecting(null);
    navigate("/pricing");
    onClose();
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

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="modal-enter w-full max-w-3xl bg-[#0d0d0d] rounded-3xl border border-white/[0.08] shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-7 py-5 border-b border-white/[0.06]">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-400" />
                Upgrade your plan
              </h2>
              <p className="text-xs text-white/30 mt-0.5">Unlock more analyses, boards, and AI features</p>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Plans grid */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PLANS.map(plan => {
              const isCurrent = plan.id === currentPlan;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border bg-gradient-to-br ${plan.gradient} ${plan.border} p-4 flex flex-col transition-all duration-150 ${isCurrent ? "opacity-40 cursor-default" : "cursor-pointer hover:scale-[1.02]"}`}
                  onClick={() => !isCurrent && handleSelect(plan.id)}
                >
                  {plan.badge && (
                    <span className={`absolute -top-2 left-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0d0d0d] border border-white/10 ${plan.accent}`}>
                      {plan.badge}
                    </span>
                  )}

                  <div className="mb-3">
                    <p className={`text-base font-bold ${plan.accent}`}>{plan.name}</p>
                    <p className="mt-1">
                      <span className="text-2xl font-black text-white">{plan.price}</span>
                      <span className="text-xs text-white/30">{plan.period}</span>
                    </p>
                  </div>

                  <div className="space-y-1.5 flex-1">
                    {plan.features.map(f => (
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
                        ? "bg-white/5 text-white/20 cursor-default"
                        : "bg-white/10 text-white hover:bg-white/15 active:scale-95"
                    }`}
                  >
                    {selecting === plan.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isCurrent ? (
                      "Current plan"
                    ) : (
                      <>Select {plan.name} <ChevronRight className="h-3 w-3" /></>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="px-7 pb-5 text-center">
            <p className="text-[11px] text-white/15">Payments via Paddle · Cancel anytime · No hidden fees</p>
          </div>
        </div>
      </div>
    </>
  );
}
