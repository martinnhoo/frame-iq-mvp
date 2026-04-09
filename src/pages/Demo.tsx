import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Upload, Loader2, Lock, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ── Typography tokens ─────────────────────────────────────────────────── */
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
    hero: "Nota do seu anúncio\nem 10 segundos",
    sub: "IA analisa hook, copy e CTA. Nota de 1 a 10.",
    upload_cta: "Upload do criativo",
    uploading: "Enviando...",
    analyzing: "Analisando",
    drop: "Solte aqui",
    score: "Score",
    verdict: "Veredicto",
    hook: "Hook",
    message_label: "Mensagem",
    cta_label: "CTA",
    actions_label: "Ações",
    locked_title: "Análise completa",
    locked_sub: "Email para desbloquear mensagem, CTA e ações.",
    email_placeholder: "seu@email.com",
    unlock_cta: "Desbloquear",
    signup_cta: "Começar grátis",
    signup_sub: "3 dias grátis · sem cartão",
    rate_limit: "Limite atingido. Crie uma conta para continuar.",
    error: "Erro. Tente novamente.",
    drag_text: "Arraste ou clique",
    or_text: "ou",
    formats: "PNG, JPG, WEBP — até 10MB",
  },
  es: {
    hero: "Nota de tu anuncio\nen 10 segundos",
    sub: "IA analiza hook, copy y CTA. Nota de 1 a 10.",
    upload_cta: "Subir creativo",
    uploading: "Subiendo...",
    analyzing: "Analizando",
    drop: "Suelta aquí",
    score: "Score",
    verdict: "Veredicto",
    hook: "Hook",
    message_label: "Mensaje",
    cta_label: "CTA",
    actions_label: "Acciones",
    locked_title: "Análisis completo",
    locked_sub: "Email para desbloquear mensaje, CTA y acciones.",
    email_placeholder: "tu@email.com",
    unlock_cta: "Desbloquear",
    signup_cta: "Comenzar gratis",
    signup_sub: "3 días gratis · sin tarjeta",
    rate_limit: "Límite alcanzado. Crea una cuenta para continuar.",
    error: "Error. Intenta de nuevo.",
    drag_text: "Arrastra o haz clic",
    or_text: "o",
    formats: "PNG, JPG, WEBP — hasta 10MB",
  },
  en: {
    hero: "Rate your ad\nin 10 seconds",
    sub: "AI analyzes hook, copy and CTA. Score from 1 to 10.",
    upload_cta: "Upload creative",
    uploading: "Uploading...",
    analyzing: "Analyzing",
    drop: "Drop here",
    score: "Score",
    verdict: "Verdict",
    hook: "Hook",
    message_label: "Message",
    cta_label: "CTA",
    actions_label: "Actions",
    locked_title: "Full analysis",
    locked_sub: "Email to unlock message, CTA and actions.",
    email_placeholder: "your@email.com",
    unlock_cta: "Unlock",
    signup_cta: "Start free",
    signup_sub: "3 days free · no card",
    rate_limit: "Limit reached. Sign up to continue.",
    error: "Error. Try again.",
    drag_text: "Drag or click",
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
@keyframes demoFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes scanLine{0%{top:10%;opacity:0}20%{opacity:1}80%{opacity:1}100%{top:85%;opacity:0}}
@keyframes orbFloat{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.12)}}
@property --beam-angle{syntax:"<angle>";initial-value:0deg;inherits:false}
@keyframes beamSpin{to{--beam-angle:360deg}}
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
            background: C.greenSoft,
            border: "1px solid rgba(52,211,153,0.15)",
            marginBottom: 28,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, flexShrink: 0, boxShadow: "0 0 8px rgba(52,211,153,0.5)" }} />
            <span style={{
              fontFamily: BODY, fontSize: 11, fontWeight: 600,
              color: "rgba(52,211,153,0.85)", letterSpacing: "0.04em",
            }}>
              {lang === "pt" ? "100% grátis · sem login" : lang === "es" ? "100% gratis · sin login" : "100% free · no login"}
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: BODY, fontWeight: 800,
            fontSize: "clamp(28px, 6vw, 40px)",
            letterSpacing: "-0.035em", lineHeight: 1.1,
            color: C.text, marginBottom: 14,
            whiteSpace: "pre-line",
          }}>
            {t.hero}
          </h1>

          {/* Sub */}
          <p style={{
            fontFamily: BODY, fontSize: 14,
            fontWeight: 400, color: C.textMuted,
            lineHeight: 1.5, maxWidth: 340, margin: "0 auto",
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
            {/* Border beam — rotating highlight on idle, glow on drag */}
            <div style={{
              position: "absolute", inset: -1, borderRadius: 25, padding: 1,
              background: dragOver
                ? "rgba(14,165,233,0.3)"
                : `conic-gradient(from var(--beam-angle), transparent 0%, transparent 75%, rgba(14,165,233,0.2) 85%, transparent 95%)`,
              animation: dragOver ? "none" : "beamSpin 4s linear infinite",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude" as any,
              pointerEvents: "none",
            }} />

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
            textAlign: "center", padding: "56px 24px",
            animation: "demoFadeUp 0.35s ease-out",
          }}>
            {preview && (
              <div style={{
                position: "relative", display: "inline-block", marginBottom: 36,
              }}>
                <img src={preview} alt="Ad" style={{
                  maxWidth: 200, maxHeight: 160, borderRadius: 14,
                  border: `1px solid ${C.border}`,
                  objectFit: "cover", opacity: 0.7,
                }} />
                {/* Scanning line */}
                <div style={{
                  position: "absolute", left: 0, right: 0, height: 2,
                  background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
                  animation: "scanLine 2s ease-in-out infinite",
                  borderRadius: 1,
                }} />
              </div>
            )}

            {/* Minimal spinner + text */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <div style={{
                width: 16, height: 16, borderRadius: "50%",
                border: `2px solid ${C.border}`, borderTopColor: C.accent,
                animation: "spin 0.8s linear infinite",
              }} />
              <span style={{
                fontFamily: BODY, fontSize: 14, fontWeight: 600,
                color: C.textSoft, letterSpacing: "-0.01em",
              }}>
                {t.analyzing}
              </span>
            </div>
          </div>
        )}

        {/* ── Result Phase ── */}
        {phase === "result" && result && (
          <div style={{ animation: "demoFadeUp 0.4s ease-out" }}>

            {/* ── Score + Image row ── */}
            <div style={{ display: "flex", gap: 20, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
              {preview && (
                <img src={preview} alt="Ad" style={{
                  width: 100, height: 100, borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  objectFit: "cover", flexShrink: 0,
                }} />
              )}
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 6 }}>
                  <span style={{
                    fontFamily: BODY, fontSize: 40, fontWeight: 800,
                    color: scoreColor(result.score),
                    letterSpacing: "-0.04em", lineHeight: 1,
                  }}>
                    {result.score}
                  </span>
                  <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 500, color: C.textMuted }}>/10</span>
                </div>
                <span style={{
                  fontFamily: BODY, fontSize: 13, fontWeight: 600,
                  color: scoreColor(result.score), opacity: 0.8,
                }}>
                  {result.verdict}
                </span>
              </div>
            </div>

            {/* ── Hook (visible teaser) ── */}
            <div style={{ marginBottom: 20 }}>
              <p style={{
                fontFamily: BODY, fontSize: 11, fontWeight: 600,
                color: C.textMuted, textTransform: "uppercase",
                letterSpacing: "0.08em", marginBottom: 8,
              }}>
                {t.hook}
              </p>
              <p style={{
                fontFamily: BODY, fontSize: 14, fontWeight: 400,
                color: C.textSoft, lineHeight: 1.6,
              }}>
                {result.hook}
              </p>
            </div>

            {/* ── Divider ── */}
            <div style={{ height: 1, background: C.border, marginBottom: 20 }} />

            {/* ── Locked → Signup funnel OR full results ── */}
            {!result.full ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                {/* Blurred locked items */}
                <div style={{ position: "relative", marginBottom: 28 }}>
                  {[t.message_label, t.cta_label, t.actions_label].map((label) => (
                    <div key={label} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "10px 0", borderBottom: `1px solid ${C.border}`,
                      filter: "blur(4px)", userSelect: "none",
                    }}>
                      <span style={{ fontFamily: BODY, fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", width: 70 }}>{label}</span>
                      <span style={{ fontFamily: BODY, fontSize: 13, color: C.textMuted }}>Lorem ipsum dolor sit amet consectetur...</span>
                    </div>
                  ))}
                  {/* Overlay */}
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Lock size={16} color={C.textMuted} style={{ opacity: 0.5 }} />
                  </div>
                </div>

                {/* Soft CTA — signup, not payment */}
                <p style={{
                  fontFamily: BODY, fontSize: 15, fontWeight: 700,
                  color: C.text, marginBottom: 8, letterSpacing: "-0.02em",
                }}>
                  {t.locked_title}
                </p>
                <p style={{
                  fontFamily: BODY, fontSize: 13, fontWeight: 400,
                  color: C.textMuted, marginBottom: 24, lineHeight: 1.5,
                }}>
                  {t.signup_sub}
                </p>
                <button
                  onClick={() => navigate("/signup")}
                  style={{
                    fontFamily: BODY, fontSize: 14, fontWeight: 700,
                    padding: "13px 32px", borderRadius: 12,
                    background: C.text, color: C.bg,
                    border: "none", cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 8,
                    transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(255,255,255,0.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  {t.signup_cta} <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <>
                {/* Message */}
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontFamily: BODY, fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    {t.message_label}
                  </p>
                  <p style={{ fontFamily: BODY, fontSize: 14, fontWeight: 400, color: C.textSoft, lineHeight: 1.6 }}>
                    {result.message}
                  </p>
                </div>

                {/* CTA */}
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontFamily: BODY, fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    {t.cta_label}
                  </p>
                  <p style={{ fontFamily: BODY, fontSize: 14, fontWeight: 400, color: C.textSoft, lineHeight: 1.6 }}>
                    {result.cta}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontFamily: BODY, fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                    {t.actions_label}
                  </p>
                  {result.actions?.map((action, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start",
                    }}>
                      <span style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, color: C.textMuted, marginTop: 2, flexShrink: 0 }}>{i + 1}.</span>
                      <p style={{ fontFamily: BODY, fontSize: 14, fontWeight: 400, color: C.textSoft, lineHeight: 1.55 }}>
                        {action}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Signup CTA */}
                <div style={{ textAlign: "center", paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                  <p style={{ fontFamily: BODY, fontSize: 13, fontWeight: 400, color: C.textMuted, marginBottom: 16 }}>
                    {t.signup_sub}
                  </p>
                  <button
                    onClick={() => navigate("/signup")}
                    style={{
                      fontFamily: BODY, fontSize: 14, fontWeight: 700,
                      padding: "13px 32px", borderRadius: 12,
                      background: C.text, color: C.bg,
                      border: "none", cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 8,
                      transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(255,255,255,0.08)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    {t.signup_cta} <ArrowRight size={14} />
                  </button>
                </div>
              </>
            )}

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
              {lang === "pt" ? "Analisar outro" : lang === "es" ? "Analizar otro" : "Analyze another"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}