import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Upload, Loader2, Lock, ArrowRight, Check, Zap, Star, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const F = "'Inter', system-ui, sans-serif";
const M = "'Inter', sans-serif";

type Lang = "pt" | "es" | "en";

const T: Record<Lang, {
  hero: string; sub: string; upload_cta: string; uploading: string;
  analyzing: string; drop: string; score: string; verdict: string;
  hook: string; message_label: string; cta_label: string; actions_label: string;
  locked_title: string; locked_sub: string; email_placeholder: string;
  unlock_cta: string; signup_cta: string; signup_sub: string;
  rate_limit: string; error: string; drag_text: string;
  or_text: string; formats: string;
}> = {
  pt: {
    hero: "Analise seu anúncio em 10 segundos.",
    sub: "Faça upload de um criativo — a IA avalia hook, mensagem, CTA e dá nota de 1 a 10. Grátis, sem conta.",
    upload_cta: "Upload do criativo",
    uploading: "Enviando...",
    analyzing: "Analisando seu criativo...",
    drop: "Solte a imagem aqui",
    score: "Score",
    verdict: "Veredicto",
    hook: "Hook Visual",
    message_label: "Mensagem",
    cta_label: "Call-to-Action",
    actions_label: "Top 3 Ações",
    locked_title: "Quer ver a análise completa?",
    locked_sub: "Deixe seu email para desbloquear mensagem, CTA e as 3 ações para melhorar.",
    email_placeholder: "seu@email.com",
    unlock_cta: "Desbloquear análise completa",
    signup_cta: "Criar conta grátis",
    signup_sub: "5 mensagens/dia + todas as tools",
    rate_limit: "Limite atingido! Crie uma conta grátis para continuar.",
    error: "Erro ao analisar. Tente novamente.",
    drag_text: "Arraste ou clique para upload",
    or_text: "ou",
    formats: "PNG, JPG, WEBP — até 10MB",
  },
  es: {
    hero: "Analiza tu anuncio en 10 segundos.",
    sub: "Sube un creativo — la IA evalúa hook, mensaje, CTA y da una nota de 1 a 10. Gratis, sin cuenta.",
    upload_cta: "Subir creativo",
    uploading: "Subiendo...",
    analyzing: "Analizando tu creativo...",
    drop: "Suelta la imagen aquí",
    score: "Score",
    verdict: "Veredicto",
    hook: "Hook Visual",
    message_label: "Mensaje",
    cta_label: "Call-to-Action",
    actions_label: "Top 3 Acciones",
    locked_title: "¿Quieres ver el análisis completo?",
    locked_sub: "Deja tu email para desbloquear mensaje, CTA y las 3 acciones para mejorar.",
    email_placeholder: "tu@email.com",
    unlock_cta: "Desbloquear análisis completo",
    signup_cta: "Crear cuenta gratis",
    signup_sub: "5 mensajes/día + todas las tools",
    rate_limit: "¡Límite alcanzado! Crea una cuenta gratis para continuar.",
    error: "Error al analizar. Intenta de nuevo.",
    drag_text: "Arrastra o haz clic para subir",
    or_text: "o",
    formats: "PNG, JPG, WEBP — hasta 10MB",
  },
  en: {
    hero: "Analyze your ad in 10 seconds.",
    sub: "Upload a creative — the AI evaluates hook, message, CTA and rates it 1 to 10. Free, no account needed.",
    upload_cta: "Upload creative",
    uploading: "Uploading...",
    analyzing: "Analyzing your creative...",
    drop: "Drop image here",
    score: "Score",
    verdict: "Verdict",
    hook: "Visual Hook",
    message_label: "Message",
    cta_label: "Call-to-Action",
    actions_label: "Top 3 Actions",
    locked_title: "Want the full analysis?",
    locked_sub: "Enter your email to unlock message, CTA and 3 actions to improve.",
    email_placeholder: "your@email.com",
    unlock_cta: "Unlock full analysis",
    signup_cta: "Create free account",
    signup_sub: "5 messages/day + all tools",
    rate_limit: "Daily limit reached! Sign up free to keep going.",
    error: "Analysis failed. Try again.",
    drag_text: "Drag or click to upload",
    or_text: "or",
    formats: "PNG, JPG, WEBP — up to 10MB",
  },
};

type Phase = "upload" | "analyzing" | "result";

interface AnalysisResult {
  full: boolean;
  score: number;
  verdict: string;
  hook: string;
  message?: string;
  cta?: string;
  actions?: string[];
}

export default function Demo() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = ["pt", "es"].includes(language) ? (language as Lang) : "en";
  const t = T[lang];
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [email, setEmail] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);

  const analyze = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Max 10MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    setPhase("analyzing");

    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("lang", lang);

      const { data, error } = await supabase.functions.invoke("analyze-demo", { body: fd });

      if (error) throw error;

      if (data?.error === "rate_limited") {
        setRateLimited(true);
        setPhase("upload");
        return;
      }

      setResult(data as AnalysisResult);
      setPhase("result");
    } catch (e) {
      console.error("Demo analysis error:", e);
      toast.error(t.error);
      setPhase("upload");
    }
  };

  const unlockFull = async () => {
    if (!email || !email.includes("@")) return;
    setUnlocking(true);

    try {
      const fd = new FormData();
      // Re-fetch the image from preview
      const blob = await (await fetch(preview!)).blob();
      fd.append("image", blob, "ad.jpg");
      fd.append("email", email);
      fd.append("lang", lang);

      const { data, error } = await supabase.functions.invoke("analyze-demo", { body: fd });
      if (error) throw error;

      setResult(data as AnalysisResult);
    } catch {
      toast.error(t.error);
    } finally {
      setUnlocking(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) analyze(file);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) analyze(file);
  };

  const scoreColor = (s: number) =>
    s >= 8 ? "#34d399" : s >= 5 ? "#f59e0b" : "#ef4444";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e14", fontFamily: F }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
        padding: "12px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link to="/"><Logo size="lg" /></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LanguageSwitcher />
          <button
            onClick={() => navigate("/signup")}
            style={{
              fontFamily: F, fontSize: 13, fontWeight: 700, padding: "8px 18px",
              borderRadius: 10, background: "#0ea5e9", color: "#fff",
              border: "none", cursor: "pointer",
            }}
          >
            {t.signup_cta}
          </button>
        </div>
      </nav>

      <div style={{
        maxWidth: 640, margin: "0 auto", padding: "48px 20px 80px",
      }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 14px", borderRadius: 20,
            background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)",
            marginBottom: 20,
          }}>
            <Zap size={12} color="#0ea5e9" />
            <span style={{ fontFamily: M, fontSize: 12, color: "#0ea5e9", fontWeight: 600 }}>
              {lang === "pt" ? "100% grátis · sem login" : lang === "es" ? "100% gratis · sin login" : "100% free · no login"}
            </span>
          </div>
          <h1 style={{
            fontSize: 32, fontWeight: 900, color: "#fff",
            letterSpacing: "-0.04em", lineHeight: 1.15, marginBottom: 14,
          }}>
            {t.hero}
          </h1>
          <p style={{
            fontFamily: M, fontSize: 15, color: "rgba(255,255,255,0.45)",
            lineHeight: 1.65, maxWidth: 460, margin: "0 auto",
          }}>
            {t.sub}
          </p>
        </div>

        {/* Rate Limited */}
        {rateLimited && (
          <div style={{
            textAlign: "center", padding: "32px 24px",
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 16, marginBottom: 24,
          }}>
            <p style={{ fontFamily: M, fontSize: 14, color: "rgba(239,68,68,0.8)", marginBottom: 16 }}>
              {t.rate_limit}
            </p>
            <button
              onClick={() => navigate("/signup")}
              style={{
                fontFamily: F, fontSize: 14, fontWeight: 700, padding: "12px 28px",
                borderRadius: 12, background: "#0ea5e9", color: "#fff",
                border: "none", cursor: "pointer",
              }}
            >
              {t.signup_cta} <ArrowRight size={14} style={{ marginLeft: 4, verticalAlign: "middle" }} />
            </button>
          </div>
        )}

        {/* Upload Phase */}
        {phase === "upload" && !rateLimited && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "rgba(14,165,233,0.6)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 20,
              background: dragOver ? "rgba(14,165,233,0.04)" : "rgba(255,255,255,0.02)",
              padding: "56px 32px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <Upload size={24} color="#0ea5e9" />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
              {dragOver ? t.drop : t.drag_text}
            </p>
            <p style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
              {t.formats}
            </p>
          </div>
        )}

        {/* Analyzing Phase */}
        {phase === "analyzing" && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            {preview && (
              <img src={preview} alt="Ad" style={{
                maxWidth: 280, maxHeight: 200, borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.08)",
                marginBottom: 28, objectFit: "cover",
              }} />
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }}>
              <Loader2 size={18} color="#0ea5e9" className="animate-spin" />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{t.analyzing}</span>
            </div>
            <div style={{
              width: 200, height: 3, borderRadius: 99,
              background: "rgba(255,255,255,0.06)",
              margin: "0 auto", overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: 99, background: "#0ea5e9",
                animation: "demo-progress 2.5s ease-in-out infinite",
              }} />
            </div>
            <style>{`@keyframes demo-progress{0%{width:5%}50%{width:80%}100%{width:95%}}`}</style>
          </div>
        )}

        {/* Result Phase */}
        {phase === "result" && result && (
          <div>
            {/* Preview + Score */}
            <div style={{
              display: "flex", gap: 20, marginBottom: 24,
              flexWrap: "wrap", alignItems: "flex-start",
            }}>
              {preview && (
                <img src={preview} alt="Ad" style={{
                  width: 140, height: 140, borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.08)",
                  objectFit: "cover", flexShrink: 0,
                }} />
              )}
              <div style={{ flex: 1, minWidth: 200 }}>
                {/* Score */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 48, fontWeight: 900, color: scoreColor(result.score),
                    letterSpacing: "-0.04em", lineHeight: 1,
                  }}>
                    {result.score}
                  </span>
                  <span style={{ fontSize: 18, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>/10</span>
                </div>
                {/* Verdict */}
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", borderRadius: 8,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                    {result.verdict}
                  </span>
                </div>
              </div>
            </div>

            {/* Hook (always visible) */}
            <div style={{
              padding: "16px 20px", borderRadius: 14,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              marginBottom: 12,
            }}>
              <p style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                {t.hook}
              </p>
              <p style={{ fontFamily: M, fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
                {result.hook}
              </p>
            </div>

            {/* Locked section OR full results */}
            {!result.full ? (
              <div style={{
                padding: "28px 24px", borderRadius: 16,
                background: "linear-gradient(135deg, rgba(14,165,233,0.06), rgba(99,102,241,0.04))",
                border: "1px solid rgba(14,165,233,0.15)",
                marginBottom: 24,
              }}>
                {/* Locked items preview */}
                {[t.message_label, t.cta_label, t.actions_label].map((label) => (
                  <div key={label} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", borderRadius: 10,
                    background: "rgba(255,255,255,0.03)", marginBottom: 8,
                  }}>
                    <Lock size={13} color="rgba(255,255,255,0.2)" />
                    <span style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.25)" }}>{label}</span>
                  </div>
                ))}

                {/* Email capture */}
                <div style={{ marginTop: 20, textAlign: "center" }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{t.locked_title}</p>
                  <p style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 16, lineHeight: 1.5 }}>
                    {t.locked_sub}
                  </p>
                  <div style={{ display: "flex", gap: 8, maxWidth: 380, margin: "0 auto" }}>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && unlockFull()}
                      placeholder={t.email_placeholder}
                      style={{
                        flex: 1, fontFamily: M, fontSize: 14, padding: "11px 16px",
                        borderRadius: 10, background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)", color: "#fff",
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={unlockFull}
                      disabled={unlocking || !email.includes("@")}
                      style={{
                        fontFamily: F, fontSize: 13, fontWeight: 700,
                        padding: "11px 20px", borderRadius: 10,
                        background: "#0ea5e9", color: "#fff", border: "none",
                        cursor: email.includes("@") ? "pointer" : "not-allowed",
                        opacity: email.includes("@") ? 1 : 0.5,
                        whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5,
                      }}
                    >
                      {unlocking ? <Loader2 size={14} className="animate-spin" /> : <><Lock size={13} /> {t.unlock_cta}</>}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Message */}
                <div style={{
                  padding: "16px 20px", borderRadius: 14,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  marginBottom: 12,
                }}>
                  <p style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    {t.message_label}
                  </p>
                  <p style={{ fontFamily: M, fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
                    {result.message}
                  </p>
                </div>

                {/* CTA */}
                <div style={{
                  padding: "16px 20px", borderRadius: 14,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  marginBottom: 12,
                }}>
                  <p style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    {t.cta_label}
                  </p>
                  <p style={{ fontFamily: M, fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
                    {result.cta}
                  </p>
                </div>

                {/* Actions */}
                <div style={{
                  padding: "16px 20px", borderRadius: 14,
                  background: "rgba(14,165,233,0.04)", border: "1px solid rgba(14,165,233,0.12)",
                  marginBottom: 24,
                }}>
                  <p style={{ fontFamily: M, fontSize: 11, color: "#0ea5e9", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                    {t.actions_label}
                  </p>
                  {result.actions?.map((action, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 6,
                        background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.25)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, marginTop: 1,
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#0ea5e9" }}>{i + 1}</span>
                      </div>
                      <p style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                        {action}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* CTA to signup */}
            <div style={{
              textAlign: "center", padding: "24px 20px",
              background: "rgba(255,255,255,0.02)", borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                {t.signup_sub}
              </p>
              <button
                onClick={() => navigate("/signup")}
                style={{
                  fontFamily: F, fontSize: 15, fontWeight: 700,
                  padding: "13px 32px", borderRadius: 12, marginTop: 12,
                  background: "linear-gradient(135deg, #0ea5e9, #06b6d4)",
                  color: "#fff", border: "none", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  boxShadow: "0 0 32px rgba(14,165,233,0.2)",
                }}
              >
                {t.signup_cta} <ArrowRight size={15} />
              </button>
            </div>

            {/* Try another */}
            <button
              onClick={() => { setPhase("upload"); setResult(null); setPreview(null); setEmail(""); }}
              style={{
                display: "block", margin: "20px auto 0", fontFamily: M, fontSize: 13,
                color: "rgba(255,255,255,0.3)", background: "none", border: "none",
                cursor: "pointer", textDecoration: "underline",
              }}
            >
              {lang === "pt" ? "Analisar outro criativo" : lang === "es" ? "Analizar otro creativo" : "Analyze another creative"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
