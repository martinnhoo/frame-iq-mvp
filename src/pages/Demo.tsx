import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Upload, Loader2, Lock, ArrowRight, Zap, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ── Typography tokens ─────────────────────────────────────────────────── */
const DISPLAY = "'Syne', 'Plus Jakarta Sans', system-ui, sans-serif";
const BODY    = "'Plus Jakarta Sans', system-ui, sans-serif";
const MONO    = "'DM Mono', 'SF Mono', monospace";

/* ── Color tokens ──────────────────────────────────────────────────────── */
const C = {
  bg:          "#050508",
  surface:     "rgba(255,255,255,0.025)",
  surfaceHov:  "rgba(255,255,255,0.05)",
  border:      "rgba(255,255,255,0.06)",
  borderHov:   "rgba(255,255,255,0.12)",
  text:        "#fff",
  textSoft:    "rgba(255,255,255,0.55)",
  textMuted:   "rgba(255,255,255,0.3)",
  accent:      "#0ea5e9",
  accentSoft:  "rgba(14,165,233,0.12)",
  accentGlow:  "rgba(14,165,233,0.25)",
  green:       "#34d399",
  greenSoft:   "rgba(52,211,153,0.12)",
  amber:       "#f59e0b",
  amberSoft:   "rgba(245,158,11,0.12)",
  red:         "#ef4444",
  redSoft:     "rgba(239,68,68,0.08)",
};

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
    hero: "Analise seu anúncio\nem 10 segundos.",
    sub: "Upload do criativo — a IA avalia hook, mensagem, CTA e dá nota de 1 a 10.",
    upload_cta: "Upload do criativo",
    uploading: "Enviando...",
    analyzing: "Analisando criativo",
    drop: "Solte aqui",
    score: "Score",
    verdict: "Veredicto",
    hook: "Hook Visual",
    message_label: "Mensagem",
    cta_label: "Call-to-Action",
    actions_label: "Top 3 Ações",
    locked_title: "Quer a análise completa?",
    locked_sub: "Deixe seu email para desbloquear mensagem, CTA e as 3 ações.",
    email_placeholder: "seu@email.com",
    unlock_cta: "Desbloquear",
    signup_cta: "Criar conta grátis",
    signup_sub: "3 dias grátis · Todas as ferramentas · Sem cartão",
    rate_limit: "Limite atingido. Crie uma conta grátis para continuar.",
    error: "Erro ao analisar. Tente novamente.",
    drag_text: "Arraste ou clique para upload",
    or_text: "ou",
    formats: "PNG, JPG, WEBP — até 10MB",
  },
  es: {
    hero: "Analiza tu anuncio\nen 10 segundos.",
    sub: "Sube un creativo — la IA evalúa hook, mensaje, CTA y da nota de 1 a 10.",
    upload_cta: "Subir creativo",
    uploading: "Subiendo...",
    analyzing: "Analizando creativo",
    drop: "Suelta aquí",
    score: "Score",
    verdict: "Veredicto",
    hook: "Hook Visual",
    message_label: "Mensaje",
    cta_label: "Call-to-Action",
    actions_label: "Top 3 Acciones",
    locked_title: "¿Quieres el análisis completo?",
    locked_sub: "Deja tu email para desbloquear mensaje, CTA y las 3 acciones.",
    email_placeholder: "tu@email.com",
    unlock_cta: "Desbloquear",
    signup_cta: "Crear cuenta gratis",
    signup_sub: "3 días gratis · Todas las herramientas · Sin tarjeta",
    rate_limit: "Límite alcanzado. Crea una cuenta gratis para continuar.",
    error: "Error al analizar. Intenta de nuevo.",
    drag_text: "Arrastra o haz clic para subir",
    or_text: "o",
    formats: "PNG, JPG, WEBP — hasta 10MB",
  },
  en: {
    hero: "Analyze your ad\nin 10 seconds.",
    sub: "Upload a creative — the AI evaluates hook, message, CTA and rates 1 to 10.",
    upload_cta: "Upload creative",
    uploading: "Uploading...",
    analyzing: "Analyzing creative",
    drop: "Drop here",
    score: "Score",
    verdict: "Verdict",
    hook: "Visual Hook",
    message_label: "Message",
    cta_label: "Call-to-Action",
    actions_label: "Top 3 Actions",
    locked_title: "Want the full analysis?",
    locked_sub: "Enter your email to unlock message, CTA and 3 actions.",
    email_placeholder: "your@email.com",
    unlock_cta: "Unlock",
    signup_cta: "Create free account",
    signup_sub: "3 days free · All tools · No card",
    rate_limit: "Daily limit reached. Sign up free to keep going.",
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

/* ── Inline keyframes ──────────────────────────────────────────────────── */
const KEYFRAMES = `
@keyframes demoSpin{0%{--demo-angle:0deg}100%{--demo-angle:360deg}}
@property --demo-angle{syntax:"<angle>";initial-value:0deg;inherits:false}
@keyframes demoPulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
@keyframes demoProgress{0%{width:5%}50%{width:75%}100%{width:92%}}
@keyframes demoFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes demoShimmer{0%{background-position:-200% center}100%{background-position:200% center}}
@keyframes orbFloat{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.15)}}
`;

/* ══════════════════════════════════════════════════════════════════════════
   DEMO PAGE
══════════════════════════════════════════════════════════════════════════ */
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

  /* ── Business logic (unchanged) ──────────────────────────────────────── */
  const analyze = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("File too large. Max 10MB."); return; }
    if (!file.type.startsWith("image/"))  { toast.error("Please upload an image file."); return; }

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
      if (data?.error === "rate_limited") { setRateLimited(true); setPhase("upload"); return; }
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
      const blob = await (await fetch(preview!)).blob();
      fd.append("image", blob, "ad.jpg");
      fd.append("email", email);
      fd.append("lang", lang);
      const { data, error } = await supabase.functions.invoke("analyze-demo", { body: fd });
      if (error) throw error;
      setResult(data as AnalysisResult);
    } catch { toast.error(t.error); }
    finally { setUnlocking(false); }
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) analyze(f); };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) analyze(f); };
  const scoreColor = (s: number) => s >= 8 ? C.green : s >= 5 ? C.amber : C.red;
  const scoreBg    = (s: number) => s >= 8 ? C.greenSoft : s >= 5 ? C.amberSoft : C.redSoft;

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: BODY, position: "relative", overflow: "hidden" }}>
      <style>{KEYFRAMES}</style>

      {/* ── Ambient glow orbs ── */}
      <div style={{
        position: "fixed", top: "15%", left: "50%", width: 600, height: 600,
        background: "radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 70%)",
        transform: "translate(-50%, -50%)", pointerEvents: "none",
        animation: "orbFloat 8s ease-in-out infinite",
      }} />
      <div style={{
        position: "fixed", top: "60%", left: "30%", width: 400, height: 400,
        background: "radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)",
        transform: "translate(-50%, -50%)", pointerEvents: "none",
        animation: "orbFloat 10s ease-in-out infinite 2s",
      }} />

      {/* ── Nav ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        borderBottom: `1px solid ${C.border}`,
        background: "rgba(5,5,8,0.8)", backdropFilter: "blur(24px) saturate(1.4)",
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link to="/"><Logo size="lg" /></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LanguageSwitcher />
          <button
            onClick={() => navigate("/signup")}
            style={{
              fontFamily: BODY, fontSize: 13, fontWeight: 700,
              padding: "9px 20px", borderRadius: 10,
              background: C.text, color: C.bg,
              border: "none", cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}
          >
            {t.signup_cta}
          </button>
        </div>
      </nav>

      {/* ── Main content ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 580, margin: "0 auto", padding: "56px 20px 100px" }}>

        {/* ── Hero ── */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          {/* Eyebrow badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 100,
            background: C.accentSoft,
            border: `1px solid rgba(14,165,233,0.18)`,
            marginBottom: 28,
          }}>
            <Zap size={11} color={C.accent} strokeWidth={2.5} />
            <span style={{
              fontFamily: MONO, fontSize: 11, fontWeight: 500,
              color: C.accent, letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              {lang === "pt" ? "Grátis · sem login" : lang === "es" ? "Gratis · sin login" : "Free · no login"}
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: DISPLAY, fontWeight: 800,
            fontSize: "clamp(32px, 7vw, 48px)",
            letterSpacing: "-0.035em", lineHeight: 1.05,
            color: C.text, marginBottom: 18,
            whiteSpace: "pre-line",
          }}>
            {t.hero}
          </h1>

          {/* Sub */}
          <p style={{
            fontFamily: BODY, fontSize: "clamp(14px, 1.1vw, 16px)",
            fontWeight: 400, color: C.textSoft,
            lineHeight: 1.6, maxWidth: 400, margin: "0 auto",
            letterSpacing: "-0.01em",
          }}>
            {t.sub}
          </p>
        </div>

        {/* ── Rate Limited ── */}
        {rateLimited && (
          <div style={{
            textAlign: "center", padding: "32px 28px", borderRadius: 20,
            background: C.redSoft, border: `1px solid rgba(239,68,68,0.15)`,
            marginBottom: 28, animation: "demoFadeUp 0.4s ease-out",
          }}>
            <p style={{ fontFamily: BODY, fontSize: 14, fontWeight: 500, color: "rgba(239,68,68,0.8)", marginBottom: 18 }}>
              {t.rate_limit}
            </p>
            <button
              onClick={() => navigate("/signup")}
              style={{
                fontFamily: BODY, fontSize: 14, fontWeight: 700,
                padding: "12px 28px", borderRadius: 12,
                background: C.text, color: C.bg,
                border: "none", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {t.signup_cta} <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* ── Upload Phase ── */}
        {phase === "upload" && !rateLimited && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              position: "relative",
              borderRadius: 24,
              background: dragOver ? "rgba(14,165,233,0.04)" : C.surface,
              border: `1px solid ${dragOver ? "rgba(14,165,233,0.3)" : C.border}`,
              padding: "64px 32px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
              overflow: "hidden",
            }}
            onMouseEnter={e => {
              if (!dragOver) {
                e.currentTarget.style.borderColor = C.borderHov;
                e.currentTarget.style.background = C.surfaceHov;
              }
            }}
            onMouseLeave={e => {
              if (!dragOver) {
                e.currentTarget.style.borderColor = C.border;
                e.currentTarget.style.background = C.surface;
              }
            }}
          >
            {/* Inner glow on drag */}
            {dragOver && (
              <div style={{
                position: "absolute", inset: 0, borderRadius: 24,
                background: "radial-gradient(circle at center, rgba(14,165,233,0.08) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />
            )}

            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />

            {/* Upload icon */}
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: dragOver ? C.accentSoft : "rgba(255,255,255,0.04)",
              border: `1px solid ${dragOver ? "rgba(14,165,233,0.25)" : C.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 24px",
              transition: "all 0.25s",
            }}>
              <Upload size={24} color={dragOver ? C.accent : C.textMuted} strokeWidth={1.5} />
            </div>

            {/* Text */}
            <p style={{
              fontFamily: BODY, fontSize: 16, fontWeight: 700,
              color: dragOver ? C.text : "rgba(255,255,255,0.8)",
              marginBottom: 8, letterSpacing: "-0.02em",
              transition: "color 0.2s",
            }}>
              {dragOver ? t.drop : t.drag_text}
            </p>
            <p style={{
              fontFamily: MONO, fontSize: 12, fontWeight: 400,
              color: C.textMuted, letterSpacing: "0.02em",
            }}>
              {t.formats}
            </p>
          </div>
        )}

        {/* ── Analyzing Phase ── */}
        {phase === "analyzing" && (
          <div style={{
            textAlign: "center", padding: "48px 24px",
            animation: "demoFadeUp 0.35s ease-out",
          }}>
            {preview && (
              <div style={{
                position: "relative", display: "inline-block", marginBottom: 32,
              }}>
                <img src={preview} alt="Ad" style={{
                  maxWidth: 240, maxHeight: 180, borderRadius: 16,
                  border: `1px solid ${C.border}`,
                  objectFit: "cover",
                }} />
                {/* Scanning overlay */}
                <div style={{
                  position: "absolute", inset: 0, borderRadius: 16,
                  background: "linear-gradient(180deg, transparent 0%, rgba(14,165,233,0.08) 50%, transparent 100%)",
                  backgroundSize: "100% 200%",
                  animation: "demoShimmer 2s ease-in-out infinite",
                }} />
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
              <Sparkles size={16} color={C.accent} style={{ animation: "demoPulse 1.5s ease-in-out infinite" }} />
              <span style={{
                fontFamily: BODY, fontSize: 15, fontWeight: 700,
                color: C.text, letterSpacing: "-0.02em",
              }}>
                {t.analyzing}
              </span>
            </div>

            {/* Progress bar */}
            <div style={{
              width: 180, height: 2, borderRadius: 99,
              background: "rgba(255,255,255,0.06)",
              margin: "0 auto", overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: 99,
                background: `linear-gradient(90deg, ${C.accent}, #38bdf8)`,
                animation: "demoProgress 3s ease-in-out infinite",
              }} />
            </div>
          </div>
        )}

        {/* ── Result Phase ── */}
        {phase === "result" && result && (
          <div style={{ animation: "demoFadeUp 0.4s ease-out" }}>

            {/* ── Score Card ── */}
            <div style={{
              display: "flex", gap: 20, padding: 24, borderRadius: 20,
              background: C.surface, border: `1px solid ${C.border}`,
              marginBottom: 16, alignItems: "center",
              flexWrap: "wrap",
            }}>
              {preview && (
                <img src={preview} alt="Ad" style={{
                  width: 120, height: 120, borderRadius: 14,
                  border: `1px solid ${C.border}`,
                  objectFit: "cover", flexShrink: 0,
                }} />
              )}
              <div style={{ flex: 1, minWidth: 180 }}>
                {/* Score number */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
                  <span style={{
                    fontFamily: DISPLAY, fontSize: 52, fontWeight: 800,
                    color: scoreColor(result.score),
                    letterSpacing: "-0.04em", lineHeight: 1,
                  }}>
                    {result.score}
                  </span>
                  <span style={{
                    fontFamily: MONO, fontSize: 16, fontWeight: 400,
                    color: C.textMuted,
                  }}>/10</span>
                </div>
                {/* Verdict pill */}
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 14px", borderRadius: 8,
                  background: scoreBg(result.score),
                  border: `1px solid ${scoreColor(result.score)}22`,
                }}>
                  <span style={{
                    fontFamily: BODY, fontSize: 13, fontWeight: 700,
                    color: scoreColor(result.score),
                  }}>
                    {result.verdict}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Hook (always visible) ── */}
            <ResultCard label={t.hook} content={result.hook} />

            {/* ── Locked section OR full results ── */}
            {!result.full ? (
              <div style={{
                padding: "28px 24px", borderRadius: 20,
                background: C.surface, border: `1px solid ${C.border}`,
                marginBottom: 16,
              }}>
                {/* Locked previews */}
                {[t.message_label, t.cta_label, t.actions_label].map((label) => (
                  <div key={label} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 16px", borderRadius: 12,
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${C.border}`,
                    marginBottom: 8,
                  }}>
                    <Lock size={12} color={C.textMuted} />
                    <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 500, color: C.textMuted }}>{label}</span>
                  </div>
                ))}

                {/* Email gate */}
                <div style={{ marginTop: 24, textAlign: "center" }}>
                  <p style={{
                    fontFamily: DISPLAY, fontSize: 17, fontWeight: 700,
                    color: C.text, marginBottom: 6, letterSpacing: "-0.02em",
                  }}>
                    {t.locked_title}
                  </p>
                  <p style={{
                    fontFamily: BODY, fontSize: 13, fontWeight: 400,
                    color: C.textSoft, marginBottom: 18, lineHeight: 1.5,
                  }}>
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
                        flex: 1, fontFamily: BODY, fontSize: 14, fontWeight: 400,
                        padding: "12px 16px", borderRadius: 12,
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${C.border}`, color: C.text,
                        outline: "none", transition: "border-color 0.15s",
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = "rgba(14,165,233,0.4)"}
                      onBlur={e => e.currentTarget.style.borderColor = C.border}
                    />
                    <button
                      onClick={unlockFull}
                      disabled={unlocking || !email.includes("@")}
                      style={{
                        fontFamily: BODY, fontSize: 13, fontWeight: 700,
                        padding: "12px 22px", borderRadius: 12,
                        background: C.text, color: C.bg, border: "none",
                        cursor: email.includes("@") ? "pointer" : "not-allowed",
                        opacity: email.includes("@") ? 1 : 0.5,
                        whiteSpace: "nowrap",
                        display: "flex", alignItems: "center", gap: 6,
                        transition: "opacity 0.15s",
                      }}
                    >
                      {unlocking ? <Loader2 size={14} className="animate-spin" /> : t.unlock_cta}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <ResultCard label={t.message_label} content={result.message || ""} />
                <ResultCard label={t.cta_label} content={result.cta || ""} />

                {/* Actions */}
                <div style={{
                  padding: "20px 24px", borderRadius: 18,
                  background: C.accentSoft,
                  border: "1px solid rgba(14,165,233,0.12)",
                  marginBottom: 16,
                }}>
                  <p style={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 500,
                    color: C.accent, textTransform: "uppercase",
                    letterSpacing: "0.1em", marginBottom: 14,
                  }}>
                    {t.actions_label}
                  </p>
                  {result.actions?.map((action, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 12, marginBottom: i < (result.actions?.length || 0) - 1 ? 12 : 0,
                      alignItems: "flex-start",
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 7,
                        background: "rgba(14,165,233,0.15)",
                        border: "1px solid rgba(14,165,233,0.25)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, marginTop: 1,
                      }}>
                        <span style={{
                          fontFamily: MONO, fontSize: 11, fontWeight: 500, color: C.accent,
                        }}>{i + 1}</span>
                      </div>
                      <p style={{
                        fontFamily: BODY, fontSize: 14, fontWeight: 400,
                        color: C.textSoft, lineHeight: 1.55,
                      }}>
                        {action}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── CTA to signup ── */}
            <div style={{
              textAlign: "center", padding: "28px 24px", marginTop: 8,
              borderRadius: 20,
              background: C.surface, border: `1px solid ${C.border}`,
            }}>
              <p style={{
                fontFamily: MONO, fontSize: 12, fontWeight: 400,
                color: C.textMuted, marginBottom: 16,
                letterSpacing: "0.02em",
              }}>
                {t.signup_sub}
              </p>
              <button
                onClick={() => navigate("/signup")}
                style={{
                  fontFamily: BODY, fontSize: 15, fontWeight: 700,
                  padding: "14px 36px", borderRadius: 14,
                  background: C.text, color: C.bg,
                  border: "none", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 8,
                  transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(255,255,255,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
              >
                {t.signup_cta} <ArrowRight size={15} />
              </button>
            </div>

            {/* Try another */}
            <button
              onClick={() => { setPhase("upload"); setResult(null); setPreview(null); setEmail(""); }}
              style={{
                display: "block", margin: "24px auto 0",
                fontFamily: BODY, fontSize: 13, fontWeight: 500,
                color: C.textMuted, background: "none", border: "none",
                cursor: "pointer", padding: "8px 16px", borderRadius: 8,
                transition: "color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.color = C.textSoft}
              onMouseLeave={e => e.currentTarget.style.color = C.textMuted}
            >
              {lang === "pt" ? "Analisar outro criativo" : lang === "es" ? "Analizar otro creativo" : "Analyze another creative"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Result Card Component ─────────────────────────────────────────────── */
function ResultCard({ label, content }: { label: string; content: string }) {
  return (
    <div style={{
      padding: "18px 22px", borderRadius: 18,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.06)",
      marginBottom: 12,
    }}>
      <p style={{
        fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 500,
        color: "rgba(255,255,255,0.3)", textTransform: "uppercase",
        letterSpacing: "0.1em", marginBottom: 8,
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        fontSize: 14, fontWeight: 400,
        color: "rgba(255,255,255,0.6)", lineHeight: 1.6,
      }}>
        {content}
      </p>
    </div>
  );
}
