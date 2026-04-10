import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Upload, Loader2, Lock, ArrowRight, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ── Typography ───────────────────────────────────────────────────────── */
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

/* ── Vivid color palette — no soft/muted tones ────────────────────────── */
const C = {
  bg:          "#050508",
  surface:     "rgba(255,255,255,0.03)",
  surfaceHov:  "rgba(255,255,255,0.055)",
  border:      "rgba(255,255,255,0.07)",
  borderHov:   "rgba(255,255,255,0.14)",
  text:        "#fff",
  textSoft:    "rgba(255,255,255,0.6)",
  textMuted:   "rgba(255,255,255,0.32)",
  accent:      "#6366f1",   /* vivid indigo */
  green:       "#22c55e",   /* vivid green */
  amber:       "#f97316",   /* vivid orange */
  red:         "#ef4444",   /* vivid red */
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
  positive_title: string; improve_title: string; unlock_card: string;
  unlock_details: string; unlock_items: string[];
  social_proof: string;
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
    signup_cta: "Ver análise completa",
    signup_sub: "Grátis — sem cartão",
    rate_limit: "Limite atingido. Crie uma conta para continuar.",
    error: "Erro. Tente novamente.",
    drag_text: "Arraste ou clique para enviar",
    or_text: "ou",
    formats: "PNG, JPG, WEBP — até 10 MB",
    positive_title: "O que funciona",
    improve_title: "O que melhorar",
    unlock_card: "Crie sua conta para ver tudo",
    unlock_details: "Com uma conta gratuita você desbloqueia:",
    unlock_items: ["Análise completa: pontos fortes + melhorias", "Sugestões de CTA e ações práticas", "IA conectada às suas campanhas reais"],
    social_proof: "Usado por 2.000+ media buyers",
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
    signup_cta: "Ver análisis completo",
    signup_sub: "Gratis — sin tarjeta",
    rate_limit: "Límite alcanzado. Crea una cuenta para continuar.",
    error: "Error. Intenta de nuevo.",
    drag_text: "Arrastra o haz clic para subir",
    or_text: "o",
    formats: "PNG, JPG, WEBP — hasta 10 MB",
    positive_title: "Lo que funciona",
    improve_title: "Qué mejorar",
    unlock_card: "Crea tu cuenta para ver todo",
    unlock_details: "Con una cuenta gratuita desbloqueas:",
    unlock_items: ["Análisis completo: fortalezas + mejoras", "Sugerencias de CTA y acciones prácticas", "IA conectada a tus campañas reales"],
    social_proof: "Usado por 2.000+ media buyers",
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
    signup_cta: "See full analysis",
    signup_sub: "Free — no card required",
    rate_limit: "Limit reached. Sign up to continue.",
    error: "Error. Try again.",
    drag_text: "Drag or click to upload",
    or_text: "or",
    formats: "PNG, JPG, WEBP — up to 10 MB",
    positive_title: "What works",
    improve_title: "What to improve",
    unlock_card: "Create your account to see everything",
    unlock_details: "With a free account you unlock:",
    unlock_items: ["Full analysis: strengths + improvements", "CTA suggestions and actionable next steps", "AI connected to your real campaigns"],
    social_proof: "Used by 2,000+ media buyers",
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

/* ── Keyframes ────────────────────────────────────────────────────────── */
const KEYFRAMES = `
@keyframes demoFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes demoFadeUp2{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes scanLine{0%{top:10%;opacity:0}20%{opacity:1}80%{opacity:1}100%{top:85%;opacity:0}}
@keyframes lockPulse{0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0.18)}50%{box-shadow:0 0 0 10px rgba(99,102,241,0)}}
@property --beam-angle{syntax:"<angle>";initial-value:0deg;inherits:false}
@keyframes beamSpin{to{--beam-angle:360deg}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@media(max-width:480px){
  .demo-upload{padding:40px 20px!important}
  .demo-score-img{width:64px!important;height:64px!important;borderRadius:10px!important}
}
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
  const [rateLimited, setRateLimited] = useState(false);

  /* ── Compress image ──────────────────────────────────────────────────── */
  const compressImage = (file: File, maxW = 1200, quality = 0.7): Promise<{ base64: string; mediaType: string }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxW / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        URL.revokeObjectURL(objectUrl);
        resolve({ base64: dataUrl.split(",")[1], mediaType: "image/jpeg" });
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Failed to load image")); };
      img.src = objectUrl;
    });

  const handleDemoResponse = (payload: unknown) => {
    const response = payload as {
      ok?: boolean; error?: string; full?: boolean; score?: number;
      verdict?: string; hook?: string; message?: string; cta?: string; actions?: string[];
    } | null;
    if (!response) throw new Error("empty_response");
    if (response.error === "rate_limited") { setRateLimited(true); setPhase("upload"); return null; }
    if (response.ok === false || response.error) throw new Error(response.error || "analysis_failed");
    return response as AnalysisResult;
  };

  const analyze = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("File too large. Max 10MB."); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file."); return; }

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    setPhase("analyzing");
    setRateLimited(false);

    try {
      const { base64, mediaType } = await compressImage(file);
      const { data, error } = await supabase.functions.invoke("analyze-demo", {
        body: { image_base64: base64, media_type: mediaType, lang },
      });
      console.log("[Demo] Raw response:", JSON.stringify(data));
      if (error) { console.error("[Demo] Invoke error:", error); throw error; }

      const parsed = handleDemoResponse(data);
      if (!parsed) return;

      if (!parsed.hook && !parsed.verdict) {
        console.warn("[Demo] Empty analysis received, showing fallback");
        parsed.hook = lang === "pt" ? "Análise processada." : lang === "es" ? "Análisis procesado." : "Analysis processed.";
        parsed.verdict = lang === "pt" ? "Resultado" : lang === "es" ? "Resultado" : "Result";
        if (!parsed.score) parsed.score = 5;
      }
      setResult(parsed);
      setPhase("result");
    } catch (e) {
      console.error("[Demo] Analysis error:", e);
      toast.error(t.error);
      setPhase("upload");
    }
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) analyze(f); };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) analyze(f); };

  const scoreColor = (s: number) => s >= 8 ? C.green : s >= 5 ? C.amber : C.red;
  const scoreLabel = (s: number) =>
    s >= 8 ? (lang === "pt" ? "Excelente" : lang === "es" ? "Excelente" : "Excellent") :
    s >= 5 ? (lang === "pt" ? "Testar" : lang === "es" ? "Probar" : "Test") :
    (lang === "pt" ? "Repensar" : lang === "es" ? "Repensar" : "Rethink");

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: BODY, position: "relative", overflow: "hidden" }}>
      <style>{KEYFRAMES}</style>

      {/* ── Nav ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        borderBottom: `1px solid ${C.border}`,
        background: "rgba(5,5,8,0.85)", backdropFilter: "blur(24px) saturate(1.4)",
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

      {/* ── Main ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 560, margin: "0 auto", padding: "56px 20px 100px" }}>

        {/* ── Hero ── */}
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h1 style={{
            fontFamily: BODY, fontWeight: 800,
            fontSize: "clamp(26px, 6vw, 38px)",
            letterSpacing: "-0.035em", lineHeight: 1.1,
            color: C.text, marginBottom: 14, whiteSpace: "pre-line",
          }}>
            {t.hero}
          </h1>
          <p style={{
            fontFamily: BODY, fontSize: 14, fontWeight: 400,
            color: C.textMuted, lineHeight: 1.5,
            maxWidth: 320, margin: "0 auto",
          }}>
            {t.sub}
          </p>
        </div>

        {/* ── Rate Limited ── */}
        {rateLimited && (
          <div style={{
            textAlign: "center", padding: "32px 28px", borderRadius: 16,
            border: `1px solid rgba(239,68,68,0.2)`,
            background: "rgba(239,68,68,0.06)",
            marginBottom: 28, animation: "demoFadeUp 0.4s ease-out",
          }}>
            <p style={{ fontFamily: BODY, fontSize: 14, fontWeight: 500, color: C.red, marginBottom: 18 }}>
              {t.rate_limit}
            </p>
            <button
              onClick={() => navigate("/signup")}
              style={{
                fontFamily: BODY, fontSize: 14, fontWeight: 700,
                padding: "12px 28px", borderRadius: 10,
                background: C.text, color: C.bg,
                border: "none", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {t.signup_cta} <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* ── Upload ── */}
        {phase === "upload" && !rateLimited && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="demo-upload"
            style={{
              position: "relative", borderRadius: 20,
              background: dragOver ? "rgba(99,102,241,0.04)" : C.surface,
              border: `1px solid ${dragOver ? "rgba(99,102,241,0.35)" : C.border}`,
              padding: "clamp(40px, 8vw, 56px) clamp(20px, 5vw, 32px)",
              textAlign: "center", cursor: "pointer",
              transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
              overflow: "hidden",
            }}
            onMouseEnter={e => {
              if (!dragOver) { e.currentTarget.style.borderColor = C.borderHov; e.currentTarget.style.background = C.surfaceHov; }
            }}
            onMouseLeave={e => {
              if (!dragOver) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }
            }}
          >
            {/* Border beam */}
            <div style={{
              position: "absolute", inset: -1, borderRadius: 21, padding: 1,
              background: dragOver
                ? "rgba(99,102,241,0.35)"
                : `conic-gradient(from var(--beam-angle), transparent 0%, transparent 75%, rgba(99,102,241,0.25) 85%, transparent 95%)`,
              animation: dragOver ? "none" : "beamSpin 4s linear infinite",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude" as any,
              pointerEvents: "none",
            }} />

            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />

            {/* Upload icon — clean, no background box */}
            <Upload
              size={32}
              color={dragOver ? C.accent : C.textMuted}
              strokeWidth={1.4}
              style={{ margin: "0 auto 20px", transition: "color 0.2s" }}
            />

            <p style={{
              fontFamily: BODY, fontSize: 15, fontWeight: 600,
              color: dragOver ? C.text : "rgba(255,255,255,0.75)",
              marginBottom: 6, letterSpacing: "-0.02em",
              transition: "color 0.2s",
            }}>
              {dragOver ? t.drop : t.drag_text}
            </p>
            <p style={{
              fontFamily: BODY, fontSize: 12, fontWeight: 400,
              color: C.textMuted,
            }}>
              {t.formats}
            </p>
          </div>
        )}

        {/* ── Analyzing ── */}
        {phase === "analyzing" && (
          <div style={{ textAlign: "center", padding: "56px 24px", animation: "demoFadeUp 0.35s ease-out" }}>
            {preview && (
              <div style={{ position: "relative", display: "inline-block", marginBottom: 36 }}>
                <img src={preview} alt="Ad" style={{
                  maxWidth: 200, maxHeight: 160, borderRadius: 14,
                  border: `1px solid ${C.border}`, objectFit: "cover", opacity: 0.7,
                }} />
                <div style={{
                  position: "absolute", left: 0, right: 0, height: 2,
                  background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
                  animation: "scanLine 2s ease-in-out infinite", borderRadius: 1,
                }} />
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <div style={{
                width: 16, height: 16, borderRadius: "50%",
                border: `2px solid ${C.border}`, borderTopColor: C.accent,
                animation: "spin 0.8s linear infinite",
              }} />
              <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.textSoft }}>
                {t.analyzing}
              </span>
            </div>
          </div>
        )}

        {/* ── Result ── */}
        {phase === "result" && result && (
          <div style={{ animation: "demoFadeUp 0.4s ease-out" }}>

            {/* ── Score row ── */}
            <div style={{
              display: "flex", gap: 18, alignItems: "center",
              marginBottom: 20, padding: "20px 22px",
              borderRadius: 16, background: C.surface,
              border: `1px solid ${C.border}`,
            }}>
              {preview && (
                <img src={preview} alt="Ad" style={{
                  width: 72, height: 72, borderRadius: 12,
                  border: `1px solid ${C.border}`, objectFit: "cover", flexShrink: 0,
                }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 4 }}>
                  <span style={{
                    fontFamily: BODY, fontSize: 32, fontWeight: 800,
                    color: scoreColor(result.score), letterSpacing: "-0.04em", lineHeight: 1,
                  }}>
                    {result.score}
                  </span>
                  <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 500, color: C.textMuted }}>/10</span>
                </div>
                <p style={{
                  fontFamily: BODY, fontSize: 13, fontWeight: 600,
                  color: scoreColor(result.score),
                }}>
                  {result.verdict || scoreLabel(result.score)}
                </p>
              </div>
            </div>

            {/* ── Gated analysis — blurred cards + signup CTA ── */}
            {!result.full ? (
              <div style={{ position: "relative", animation: "demoFadeUp2 0.5s ease-out" }}>

                {/* Blurred preview of both cards — decorative only */}
                <div style={{ filter: "blur(6px)", userSelect: "none", pointerEvents: "none", opacity: 0.5 }}>
                  {/* Fake "What works" card */}
                  <div style={{
                    borderRadius: 16, padding: "20px 22px", marginBottom: 12,
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${C.green}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <CheckCircle2 size={16} color={C.green} strokeWidth={2.2} />
                      <span style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, color: C.green, letterSpacing: "0.04em", textTransform: "uppercase" }}>{t.positive_title}</span>
                    </div>
                    <div style={{ height: 12, width: "85%", borderRadius: 3, background: "rgba(255,255,255,0.06)", marginBottom: 10 }} />
                    <div style={{ height: 12, width: "65%", borderRadius: 3, background: "rgba(255,255,255,0.04)" }} />
                  </div>
                  {/* Fake "What to improve" card */}
                  <div style={{
                    borderRadius: 16, padding: "20px 22px",
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${C.accent}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <AlertTriangle size={16} color={C.accent} strokeWidth={2.2} />
                      <span style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, color: C.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>{t.improve_title}</span>
                    </div>
                    <div style={{ height: 12, width: "90%", borderRadius: 3, background: "rgba(255,255,255,0.06)", marginBottom: 10 }} />
                    <div style={{ height: 12, width: "72%", borderRadius: 3, background: "rgba(255,255,255,0.04)", marginBottom: 10 }} />
                    <div style={{ height: 12, width: "60%", borderRadius: 3, background: "rgba(255,255,255,0.05)" }} />
                  </div>
                </div>

                {/* Overlay CTA */}
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  background: "rgba(5,5,8,0.6)",
                  backdropFilter: "blur(4px)",
                  borderRadius: 16,
                  padding: "24px 28px",
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    border: `1px solid rgba(99,102,241,0.25)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 16,
                    animation: "lockPulse 2.5s ease-in-out infinite",
                  }}>
                    <Lock size={20} color={C.accent} strokeWidth={1.8} />
                  </div>

                  <span style={{
                    fontFamily: BODY, fontSize: 15, fontWeight: 700,
                    color: C.text, marginBottom: 6, textAlign: "center",
                  }}>
                    {t.unlock_card}
                  </span>

                  <span style={{
                    fontFamily: BODY, fontSize: 12, fontWeight: 400,
                    color: C.textMuted, marginBottom: 16, textAlign: "center",
                  }}>
                    {t.unlock_details}
                  </span>

                  {/* Value items */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20, width: "100%", maxWidth: 280 }}>
                    {t.unlock_items.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <CheckCircle2 size={14} color={C.green} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                        <span style={{ fontFamily: BODY, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => navigate("/signup")}
                    style={{
                      fontFamily: BODY, fontSize: 14, fontWeight: 700,
                      padding: "13px 32px", borderRadius: 10,
                      background: C.text, color: C.bg,
                      border: "none", cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 8,
                      transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
                      marginBottom: 8,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(255,255,255,0.08)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    {t.signup_cta} <ArrowRight size={14} />
                  </button>
                  <span style={{ fontFamily: BODY, fontSize: 11, color: C.textMuted }}>
                    {t.signup_sub}
                  </span>
                </div>
              </div>
            ) : (
              /* ── Full result cards (logged-in / full response) ── */
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* Card 1: Positives */}
                <div style={{
                  borderRadius: 16, padding: "20px 22px",
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${C.green}`,
                  animation: "demoFadeUp2 0.5s ease-out",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <CheckCircle2 size={16} color={C.green} strokeWidth={2.2} />
                    <span style={{
                      fontFamily: BODY, fontSize: 12, fontWeight: 700,
                      color: C.green, letterSpacing: "0.04em", textTransform: "uppercase",
                    }}>
                      {t.positive_title}
                    </span>
                  </div>
                  <p style={{
                    fontFamily: BODY, fontSize: 14, fontWeight: 400,
                    color: C.textSoft, lineHeight: 1.7,
                  }}>
                    {result.hook}
                  </p>
                </div>

                {/* Card 2: Improvements */}
                <div style={{
                  borderRadius: 16, padding: "20px 22px",
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${C.accent}`,
                  animation: "demoFadeUp2 0.6s ease-out",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <AlertTriangle size={16} color={C.accent} strokeWidth={2.2} />
                    <span style={{
                      fontFamily: BODY, fontSize: 12, fontWeight: 700,
                      color: C.accent, letterSpacing: "0.04em", textTransform: "uppercase",
                    }}>
                      {t.improve_title}
                    </span>
                  </div>

                  <p style={{ fontFamily: BODY, fontSize: 14, fontWeight: 400, color: C.textSoft, lineHeight: 1.7, marginBottom: 16 }}>
                    {result.message}
                  </p>

                  {result.cta && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontFamily: BODY, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                        CTA
                      </p>
                      <p style={{ fontFamily: BODY, fontSize: 14, fontWeight: 400, color: C.textSoft, lineHeight: 1.6 }}>
                        {result.cta}
                      </p>
                    </div>
                  )}

                  {result.actions && result.actions.length > 0 && (
                    <div>
                      <p style={{ fontFamily: BODY, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                        {t.actions_label}
                      </p>
                      {result.actions.map((action, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                          <span style={{
                            fontFamily: BODY, fontSize: 11, fontWeight: 800,
                            color: C.accent, marginTop: 3, flexShrink: 0,
                            width: 18, height: 18, borderRadius: 5,
                            border: `1px solid rgba(99,102,241,0.2)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {i + 1}
                          </span>
                          <p style={{ fontFamily: BODY, fontSize: 14, fontWeight: 400, color: C.textSoft, lineHeight: 1.6 }}>
                            {action}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Social proof pill */}
            <div style={{
              textAlign: "center", marginTop: 20,
              animation: "demoFadeUp2 0.7s ease-out",
            }}>
              <span style={{
                fontFamily: BODY, fontSize: 11, fontWeight: 500,
                color: C.textMuted,
                padding: "6px 14px", borderRadius: 20,
                border: `1px solid ${C.border}`,
                background: C.surface,
              }}>
                {t.social_proof}
              </span>
            </div>

            {/* Try another */}
            <button
              onClick={() => { setPhase("upload"); setResult(null); setPreview(null); }}
              style={{
                display: "block", margin: "16px auto 0",
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
