import { useEffect, useState } from "react";
import { X, Loader2, Sparkles, CheckCircle2, Copy, Download, Zap, AlertTriangle, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DESIGN_TOKENS as T } from "@/hooks/useDesignTokens";

const m = { fontFamily: T.font } as const;

export interface CreativeLoopDraftSource {
  type: "pattern" | "winning_ad" | "decision_scale";
  id: string;
  snapshot?: any;
  label?: string; // e.g. pattern key or ad name, shown in header
}

interface CopyVariant {
  headline: string;
  primary: string;
  cta: string;
  hook_type: string;
  angle: string;
}

interface ImageVariant {
  url: string | null;
  prompt: string;
  model: string;
  error?: string;
}

interface Draft {
  draft_id: string;
  brief: string;
  angle: string;
  copy_variants: CopyVariant[];
  image_variants: ImageVariant[];
  predicted_ctr: number;
  predicted_roas: number;
  predicted_score: number;
  reasoning?: string;
  credits_remaining?: number;
}

interface Props {
  open: boolean;
  userId: string;
  source: CreativeLoopDraftSource | null;
  onClose: () => void;
  onApproved?: (draftId: string, variantIndex: number) => void;
}

export default function CreativeLoopDraftModal({ open, userId, source, onClose, onApproved }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (!open || !source) return;
    setDraft(null);
    setError(null);
    setSelectedIdx(0);
    setLoading(true);

    (async () => {
      try {
        const { data, error: err } = await supabase.functions.invoke("close-creative-loop", {
          body: {
            user_id: userId,
            source_type: source.type,
            source_id: source.id,
            source_snapshot: source.snapshot ?? {},
            generate_images: true,
            variant_count: 3,
          },
        });

        if (err) throw err;
        if (!data || data.error) throw new Error(data?.error || "generation_failed");

        setDraft(data as Draft);
      } catch (e: any) {
        const msg = e?.message || e?.context?.body?.error || "Falha ao gerar variação";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, source, userId]);

  const approve = async () => {
    if (!draft) return;
    setApproving(true);
    try {
      const { error: err } = await supabase
        .from("creative_loop_drafts" as any)
        .update({ status: "approved", approved_variant_index: selectedIdx })
        .eq("id", draft.draft_id);
      if (err) throw err;
      toast.success("Variante aprovada. Disponível em Drafts.");
      onApproved?.(draft.draft_id, selectedIdx);
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Falha ao aprovar");
    } finally {
      setApproving(false);
    }
  };

  const reject = async () => {
    if (!draft) return;
    try {
      await supabase
        .from("creative_loop_drafts" as any)
        .update({ status: "rejected" })
        .eq("id", draft.draft_id);
      toast.message("Draft descartado.");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Falha ao descartar");
    }
  };

  const copyText = (variant: CopyVariant) => {
    const text = `${variant.headline}\n\n${variant.primary}\n\nCTA: ${variant.cta}`;
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copy copiado"),
      () => toast.error("Não foi possível copiar")
    );
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 16px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 760,
          background: "#0d1117",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "linear-gradient(135deg,#a78bfa,#7c3aed)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Sparkles size={16} color="#fff" />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
                Loop criativo
              </p>
              <p
                style={{
                  ...m,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.35)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {source?.label || source?.type || "gerando variação"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "rgba(255,255,255,0.5)",
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <Loader2 size={22} className="animate-spin" style={{ color: "#a78bfa", margin: "0 auto 14px" }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
              Gerando variação com base no que funciona na sua conta
            </p>
            <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              Consultando padrões, redigindo brief, criando variantes...
            </p>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div style={{ padding: "32px 24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "14px 16px",
                borderRadius: 12,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
              }}
            >
              <AlertTriangle size={16} style={{ color: "#ef4444", marginTop: 2, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                  Falha ao gerar variação
                </p>
                <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                  {error === "insufficient_credits"
                    ? "Créditos insuficientes. Faça upgrade ou aguarde a próxima renovação."
                    : error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Draft result ── */}
        {!loading && !error && draft && (
          <div>
            {/* Predictions strip */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 1,
                background: "rgba(255,255,255,0.05)",
              }}
            >
              <Stat label="Score previsto" value={`${draft.predicted_score}/1000`} color="#a78bfa" />
              <Stat label="CTR previsto" value={`${(draft.predicted_ctr * 100).toFixed(2)}%`} color="#34d399" />
              <Stat label="ROAS previsto" value={`${draft.predicted_roas.toFixed(1)}x`} color="#fbbf24" />
            </div>

            {/* Brief */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <p
                style={{
                  ...m,
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.3)",
                  marginBottom: 8,
                }}
              >
                Brief
              </p>
              <p style={{ ...m, fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.65 }}>
                {draft.brief}
              </p>
              {draft.angle && (
                <p style={{ ...m, fontSize: 12, color: "#a78bfa", marginTop: 8, fontStyle: "italic" }}>
                  Ângulo: {draft.angle}
                </p>
              )}
            </div>

            {/* Variants */}
            <div style={{ padding: "18px 24px" }}>
              <p
                style={{
                  ...m,
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.3)",
                  marginBottom: 10,
                }}
              >
                Escolha uma variante
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {draft.copy_variants.map((v, i) => {
                  const img = draft.image_variants?.[i];
                  const selected = selectedIdx === i;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedIdx(i)}
                      style={{
                        textAlign: "left",
                        padding: "14px 16px",
                        borderRadius: 14,
                        background: selected ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.025)",
                        border: `1px solid ${selected ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.06)"}`,
                        cursor: "pointer",
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        transition: "all 0.15s",
                      }}
                    >
                      {/* Thumb */}
                      <div
                        style={{
                          width: 84,
                          height: 84,
                          borderRadius: 10,
                          background: "rgba(255,255,255,0.04)",
                          overflow: "hidden",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {img?.url ? (
                          <img
                            src={img.url}
                            alt={`Variação ${i + 1}`}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <ImageIcon size={20} style={{ color: "rgba(255,255,255,0.25)" }} />
                        )}
                      </div>

                      {/* Copy */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 6,
                          }}
                        >
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              background: selected ? "#a78bfa" : "rgba(255,255,255,0.05)",
                              border: `1.5px solid ${selected ? "#a78bfa" : "rgba(255,255,255,0.15)"}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {selected && <CheckCircle2 size={11} color="#000" />}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
                            {v.headline}
                          </span>
                          <span
                            style={{
                              ...m,
                              fontSize: 10,
                              textTransform: "uppercase",
                              letterSpacing: "0.1em",
                              padding: "2px 6px",
                              borderRadius: 999,
                              background: "rgba(167,139,250,0.12)",
                              color: "#a78bfa",
                              marginLeft: "auto",
                              flexShrink: 0,
                            }}
                          >
                            {v.hook_type}
                          </span>
                        </div>
                        <p
                          style={{
                            ...m,
                            fontSize: 12,
                            color: "rgba(255,255,255,0.65)",
                            lineHeight: 1.55,
                            marginBottom: 6,
                          }}
                        >
                          {v.primary}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span
                            style={{
                              ...m,
                              fontSize: 11,
                              color: "#34d399",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: "rgba(52,211,153,0.08)",
                            }}
                          >
                            CTA: {v.cta}
                          </span>
                          {v.angle && (
                            <span style={{ ...m, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                              {v.angle}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyText(v);
                            }}
                            style={{
                              marginLeft: "auto",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              color: "rgba(255,255,255,0.5)",
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            <Copy size={10} /> Copiar
                          </button>
                        </div>
                        {img?.error && (
                          <p style={{ ...m, fontSize: 10, color: "#fbbf24", marginTop: 6 }}>
                            (imagem falhou: {img.error.slice(0, 60)})
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {draft.reasoning && (
                <p style={{ ...m, fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 12, lineHeight: 1.5 }}>
                  <Zap size={10} style={{ display: "inline", marginRight: 4, color: "#a78bfa" }} />
                  {draft.reasoning}
                </p>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                background: "rgba(255,255,255,0.015)",
              }}
            >
              <p style={{ ...m, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                {typeof draft.credits_remaining === "number"
                  ? `Créditos restantes: ${draft.credits_remaining}`
                  : "Variante será salva em Drafts"}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={reject}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Descartar
                </button>
                <button
                  onClick={approve}
                  disabled={approving}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "9px 18px",
                    borderRadius: 10,
                    background: approving
                      ? "rgba(167,139,250,0.3)"
                      : "#7c3aed",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: approving ? "wait" : "pointer",
                    border: "none",
                  }}
                >
                  {approving ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  {approving ? "Aprovando..." : `Aprovar variante ${selectedIdx + 1}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: "14px 16px", background: "#0d1117" }}>
      <p
        style={{
          ...m,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.3)",
          marginBottom: 4,
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</p>
    </div>
  );
}
