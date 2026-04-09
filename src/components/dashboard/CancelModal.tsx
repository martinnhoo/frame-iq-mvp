// CancelModal — Smart cancellation flow: survey → pause offer → discount → confirm cancel
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { X, Pause, Percent, AlertTriangle, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const F = "'Inter', system-ui, sans-serif";

interface Props {
  open: boolean;
  onClose: () => void;
  plan: string;
  onCancelled?: () => void;
}

const REASONS = {
  en: [
    { id: "too_expensive", label: "Too expensive" },
    { id: "not_using", label: "Not using it enough" },
    { id: "missing_features", label: "Missing features I need" },
    { id: "switching", label: "Switching to another tool" },
    { id: "temporary", label: "Just need a break" },
    { id: "other", label: "Other" },
  ],
  pt: [
    { id: "too_expensive", label: "Muito caro" },
    { id: "not_using", label: "Não estou usando o suficiente" },
    { id: "missing_features", label: "Faltam funcionalidades" },
    { id: "switching", label: "Mudando para outra ferramenta" },
    { id: "temporary", label: "Só preciso de uma pausa" },
    { id: "other", label: "Outro" },
  ],
  es: [
    { id: "too_expensive", label: "Muy caro" },
    { id: "not_using", label: "No lo estoy usando lo suficiente" },
    { id: "missing_features", label: "Faltan funcionalidades" },
    { id: "switching", label: "Cambiando a otra herramienta" },
    { id: "temporary", label: "Solo necesito un descanso" },
    { id: "other", label: "Otro" },
  ],
};

const t = {
  en: {
    title: "We're sorry to see you go",
    subtitle: "Before you cancel, let us know what's going on so we can improve.",
    whyLeaving: "Why are you thinking of leaving?",
    feedbackPlaceholder: "Anything else you'd like to share? (optional)",
    next: "Next",
    back: "Back",
    pauseTitle: "How about a break instead?",
    pauseDesc: "Pause your subscription for 30 days. You'll keep access until your current period ends, and we won't charge you during the pause.",
    pauseBtn: "Pause for 30 days",
    discountTitle: "We'd love to keep you!",
    discountDesc: "How about 30% off for the next 3 months? That's a significant saving while you continue using AdBrief.",
    discountBtn: "Get 30% off for 3 months",
    skipOffer: "No thanks, continue cancelling",
    confirmTitle: "Are you sure?",
    confirmDesc: "Your plan will remain active until the end of your current billing period. After that, you'll be downgraded to the Free plan.",
    confirmBtn: "Confirm cancellation",
    cancelled: "Your subscription has been cancelled",
    paused: "Your subscription has been paused for 30 days",
    discountApplied: "30% discount applied for 3 months!",
    processing: "Processing...",
  },
  pt: {
    title: "Sentimos que você está saindo",
    subtitle: "Antes de cancelar, nos diga o que está acontecendo para podermos melhorar.",
    whyLeaving: "Por que está pensando em sair?",
    feedbackPlaceholder: "Algo mais que gostaria de compartilhar? (opcional)",
    next: "Próximo",
    back: "Voltar",
    pauseTitle: "Que tal uma pausa?",
    pauseDesc: "Pause sua assinatura por 30 dias. Você mantém acesso até o fim do período atual e não será cobrado durante a pausa.",
    pauseBtn: "Pausar por 30 dias",
    discountTitle: "Queremos manter você!",
    discountDesc: "Que tal 30% de desconto nos próximos 3 meses? Uma economia significativa enquanto continua usando o AdBrief.",
    discountBtn: "Ganhar 30% off por 3 meses",
    skipOffer: "Não, obrigado, continuar cancelamento",
    confirmTitle: "Tem certeza?",
    confirmDesc: "Seu plano permanecerá ativo até o final do período de cobrança atual. Depois disso, será rebaixado para o plano Free.",
    confirmBtn: "Confirmar cancelamento",
    cancelled: "Sua assinatura foi cancelada",
    paused: "Sua assinatura foi pausada por 30 dias",
    discountApplied: "Desconto de 30% aplicado por 3 meses!",
    processing: "Processando...",
  },
  es: {
    title: "Lamentamos que te vayas",
    subtitle: "Antes de cancelar, dinos qué está pasando para poder mejorar.",
    whyLeaving: "¿Por qué estás pensando en irte?",
    feedbackPlaceholder: "¿Algo más que quieras compartir? (opcional)",
    next: "Siguiente",
    back: "Volver",
    pauseTitle: "¿Qué tal un descanso?",
    pauseDesc: "Pausa tu suscripción por 30 días. Mantienes acceso hasta el fin del período actual y no se te cobrará durante la pausa.",
    pauseBtn: "Pausar por 30 días",
    discountTitle: "¡Queremos que te quedes!",
    discountDesc: "¿Qué tal 30% de descuento por los próximos 3 meses? Un ahorro significativo mientras sigues usando AdBrief.",
    discountBtn: "Obtener 30% off por 3 meses",
    skipOffer: "No gracias, continuar cancelando",
    confirmTitle: "¿Estás seguro?",
    confirmDesc: "Tu plan permanecerá activo hasta el final del período de facturación actual. Después, serás degradado al plan Free.",
    confirmBtn: "Confirmar cancelación",
    cancelled: "Tu suscripción ha sido cancelada",
    paused: "Tu suscripción ha sido pausada por 30 días",
    discountApplied: "¡Descuento del 30% aplicado por 3 meses!",
    processing: "Procesando...",
  },
};

type Step = "reason" | "pause" | "discount" | "confirm";

export function CancelModal({ open, onClose, plan, onCancelled }: Props) {
  const { language } = useLanguage();
  const lang = (language === "pt" || language === "es" ? language : "en") as keyof typeof t;
  const tx = t[lang];
  const reasons = REASONS[lang];

  const [step, setStep] = useState<Step>("reason");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function callCancel(action: string, extra?: Record<string, string>) {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: { action, reason, feedback, ...extra },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    } finally {
      setLoading(false);
    }
  }

  async function handlePause() {
    try {
      await callCancel("pause");
      toast.success(tx.paused);
      onCancelled?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Error");
    }
  }

  async function handleDiscount() {
    try {
      await callCancel("discount");
      toast.success(tx.discountApplied);
      onCancelled?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Error");
    }
  }

  async function handleConfirmCancel() {
    try {
      await callCancel("cancel", { reason, feedback });
      toast.success(tx.cancelled);
      onCancelled?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Error");
    }
  }

  function handleClose() {
    setStep("reason");
    setReason("");
    setFeedback("");
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, fontFamily: F,
    }} onClick={handleClose}>
      <div style={{
        background: "#0f1219", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, maxWidth: 480, width: "100%", padding: 0, overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        animation: "modalIn 0.2s ease",
      }} onClick={e => e.stopPropagation()}>
        <style>{`@keyframes modalIn { from{opacity:0;transform:scale(0.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)} }`}</style>

        {/* Header */}
        <div style={{ padding: "24px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0, fontFamily: F }}>
              {step === "reason" && tx.title}
              {step === "pause" && tx.pauseTitle}
              {step === "discount" && tx.discountTitle}
              {step === "confirm" && tx.confirmTitle}
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "6px 0 0", fontFamily: F }}>
              {step === "reason" && tx.subtitle}
              {step === "pause" && tx.pauseDesc}
              {step === "discount" && tx.discountDesc}
              {step === "confirm" && tx.confirmDesc}
            </p>
          </div>
          <button onClick={handleClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={18} color="rgba(255,255,255,0.3)" />
          </button>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>

          {/* STEP: Reason */}
          {step === "reason" && (
            <>
              <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)", margin: "0 0 12px", fontFamily: F }}>{tx.whyLeaving}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {reasons.map(r => (
                  <button key={r.id} onClick={() => setReason(r.id)} style={{
                    padding: "10px 14px", borderRadius: 8, border: `1px solid ${reason === r.id ? "rgba(14,165,233,0.4)" : "rgba(255,255,255,0.06)"}`,
                    background: reason === r.id ? "rgba(14,165,233,0.08)" : "rgba(255,255,255,0.02)",
                    color: reason === r.id ? "#0ea5e9" : "rgba(255,255,255,0.55)",
                    fontSize: 13, fontFamily: F, cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${reason === r.id ? "#0ea5e9" : "rgba(255,255,255,0.15)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {reason === r.id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9" }} />}
                    </div>
                    {r.label}
                  </button>
                ))}
              </div>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder={tx.feedbackPlaceholder}
                rows={3}
                style={{
                  width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8,
                  color: "#fff", fontSize: 13, fontFamily: F, resize: "none", outline: "none",
                  marginBottom: 16,
                }}
              />
              <button
                onClick={() => {
                  if (reason === "temporary" || reason === "not_using") setStep("pause");
                  else if (reason === "too_expensive") setStep("discount");
                  else setStep("pause"); // Default: offer pause first
                }}
                disabled={!reason}
                style={{
                  width: "100%", padding: "12px", borderRadius: 8,
                  background: reason ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${reason ? "rgba(14,165,233,0.3)" : "rgba(255,255,255,0.06)"}`,
                  color: reason ? "#0ea5e9" : "rgba(255,255,255,0.2)",
                  fontSize: 14, fontWeight: 600, fontFamily: F, cursor: reason ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.15s",
                }}
              >
                {tx.next} <ArrowRight size={14} />
              </button>
            </>
          )}

          {/* STEP: Pause offer */}
          {step === "pause" && (
            <>
              <div style={{
                display: "flex", alignItems: "center", gap: 12, padding: "16px",
                background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.15)",
                borderRadius: 10, marginBottom: 16,
              }}>
                <Pause size={24} color="#0ea5e9" />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#0ea5e9", margin: 0, fontFamily: F }}>30 days</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "2px 0 0", fontFamily: F }}>
                    {lang === "pt" ? "Sem cobrança durante a pausa" : lang === "es" ? "Sin cobro durante la pausa" : "No charge during pause"}
                  </p>
                </div>
              </div>
              <button onClick={handlePause} disabled={loading} style={{
                width: "100%", padding: "12px", borderRadius: 8,
                background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.3)",
                color: "#0ea5e9", fontSize: 14, fontWeight: 600, fontFamily: F, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                marginBottom: 10, transition: "all 0.15s",
              }}>
                <Pause size={14} /> {loading ? tx.processing : tx.pauseBtn}
              </button>
              <button onClick={() => reason === "too_expensive" ? setStep("discount") : setStep("confirm")} style={{
                width: "100%", padding: "10px", background: "transparent", border: "none",
                color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer", fontFamily: F,
              }}>{tx.skipOffer}</button>
              <button onClick={() => setStep("reason")} style={{
                width: "100%", padding: "8px", background: "transparent", border: "none",
                color: "rgba(255,255,255,0.2)", fontSize: 11, cursor: "pointer", fontFamily: F,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              }}><ArrowLeft size={11} /> {tx.back}</button>
            </>
          )}

          {/* STEP: Discount offer */}
          {step === "discount" && (
            <>
              <div style={{
                display: "flex", alignItems: "center", gap: 12, padding: "16px",
                background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)",
                borderRadius: 10, marginBottom: 16,
              }}>
                <Percent size={24} color="#22c55e" />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#22c55e", margin: 0, fontFamily: F }}>30% off</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "2px 0 0", fontFamily: F }}>
                    {lang === "pt" ? "Por 3 meses" : lang === "es" ? "Por 3 meses" : "For 3 months"}
                  </p>
                </div>
              </div>
              <button onClick={handleDiscount} disabled={loading} style={{
                width: "100%", padding: "12px", borderRadius: 8,
                background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
                color: "#22c55e", fontSize: 14, fontWeight: 600, fontFamily: F, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                marginBottom: 10, transition: "all 0.15s",
              }}>
                <Percent size={14} /> {loading ? tx.processing : tx.discountBtn}
              </button>
              <button onClick={() => setStep("confirm")} style={{
                width: "100%", padding: "10px", background: "transparent", border: "none",
                color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer", fontFamily: F,
              }}>{tx.skipOffer}</button>
              <button onClick={() => setStep("pause")} style={{
                width: "100%", padding: "8px", background: "transparent", border: "none",
                color: "rgba(255,255,255,0.2)", fontSize: 11, cursor: "pointer", fontFamily: F,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              }}><ArrowLeft size={11} /> {tx.back}</button>
            </>
          )}

          {/* STEP: Final confirm */}
          {step === "confirm" && (
            <>
              <div style={{
                display: "flex", alignItems: "center", gap: 12, padding: "16px",
                background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)",
                borderRadius: 10, marginBottom: 16,
              }}>
                <AlertTriangle size={20} color="#f87171" />
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: 0, fontFamily: F, lineHeight: 1.5 }}>
                  {tx.confirmDesc}
                </p>
              </div>
              <button onClick={handleConfirmCancel} disabled={loading} style={{
                width: "100%", padding: "12px", borderRadius: 8,
                background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)",
                color: "#f87171", fontSize: 14, fontWeight: 600, fontFamily: F, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                marginBottom: 10, transition: "all 0.15s",
              }}>
                {loading ? tx.processing : tx.confirmBtn}
              </button>
              <button onClick={() => setStep("discount")} style={{
                width: "100%", padding: "8px", background: "transparent", border: "none",
                color: "rgba(255,255,255,0.2)", fontSize: 11, cursor: "pointer", fontFamily: F,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              }}><ArrowLeft size={11} /> {tx.back}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
