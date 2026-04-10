import { useState, useRef, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Upload, Loader2, Lock, ArrowRight, CheckCircle2, AlertTriangle, Sparkles, Shield, Zap, Plug } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEMO_STORAGE_KEY = "adbrief_demo_result";

/* ── Design tokens — matched to IndexNew.tsx ─────────────────────────── */
const F = "'Plus Jakarta Sans', system-ui, sans-serif";
const BRAND = "#6366f1";
const BG = "#050508";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.07)";
const TEXT_MUTED = "rgba(255,255,255,0.55)";

const C = {
  bg: BG,
  surface: CARD_BG,
  border: CARD_BORDER,
  borderHov: "rgba(255,255,255,0.14)",
  text: "#fff",
  textSoft: "rgba(255,255,255,0.6)",
  textMuted: "rgba(255,255,255,0.32)",
  accent: BRAND,
  green: "#22c55e",
  amber: "#f97316",
  red: "#ef4444",
};

type Lang = "pt" | "es" | "en";

const T: Record<Lang, {
  hero: string; sub: string;
  analyzing: string; drop: string;
  drag_text: string; formats: string;
  positive_title: string; improve_title: string;
  signup_cta: string; signup_sub: string;
  rate_limit: string; error: string;
  unlock_card: string; unlock_details: string; unlock_items: string[];
  social_proof: string; social_proof_count: string; social_proof_note: string;
  connect_title: string; connect_sub: string; connect_btn: string;
  connect_benefits: string[]; go_dashboard: string;
}> = {
  pt: {
    hero: "Nota do seu anúncio\nem 10 segundos",
    sub: "IA analisa hook, copy e CTA. Nota de 1 a 10.",
    analyzing: "Analisando",
    drop: "Solte aqui",
    drag_text: "Arraste ou clique para enviar",
    formats: "PNG, JPG, WEBP — até 10 MB",
    positive_title: "O que funciona",
    improve_title: "O que melhorar",
    signup_cta: "Ver análise completa",
    signup_sub: "Grátis — sem cartão",
    rate_limit: "Limite atingido. Crie uma conta para continuar.",
    error: "Erro. Tente novamente.",
    unlock_card: "Crie sua conta para ver tudo",
    unlock_details: "Com uma conta gratuita você desbloqueia:",
    unlock_items: [
      "Análise completa com ações práticas",
      "Sugestões de CTA e melhorias de copy",
      "IA conectada às suas campanhas reais",
    ],
    social_proof: "14.200+ anúncios analisados", social_proof_count: "14.200+", social_proof_note: "anúncios analisados esta semana",
    connect_title: "Conecte Meta Ads para resultados reais",
    connect_sub: "A IA analisa suas campanhas ao vivo — ROAS, CTR, criativos fadigados — e diz o que pausar, escalar e testar.",
    connect_btn: "Conectar Meta Ads",
    connect_benefits: ["Alertas de ROAS em tempo real", "Diagnóstico de criativos", "Recomendações personalizadas"],
    go_dashboard: "Ir para o dashboard",
  },
  es: {
    hero: "Nota de tu anuncio\nen 10 segundos",
    sub: "IA analiza hook, copy y CTA. Nota de 1 a 10.",
    analyzing: "Analizando",
    drop: "Suelta aquí",
    drag_text: "Arrastra o haz clic para subir",
    formats: "PNG, JPG, WEBP — hasta 10 MB",
    positive_title: "Lo que funciona",
    improve_title: "Qué mejorar",
    signup_cta: "Ver análisis completo",
    signup_sub: "Gratis — sin tarjeta",
    rate_limit: "Límite alcanzado. Crea una cuenta para continuar.",
    error: "Error. Intenta de nuevo.",
    unlock_card: "Crea tu cuenta para ver todo",
    unlock_details: "Con una cuenta gratuita desbloqueas:",
    unlock_items: [
      "Análisis completo con acciones prácticas",
      "Sugerencias de CTA y mejoras de copy",
      "IA conectada a tus campañas reales",
    ],
    social_proof: "14.200+ anuncios analizados", social_proof_count: "14.200+", social_proof_note: "anuncios analizados esta semana",
    connect_title: "Conecta Meta Ads para resultados reales",
    connect_sub: "La IA analiza tus campañas en vivo — ROAS, CTR, creativos fatigados — y te dice qué pausar, escalar y testear.",
    connect_btn: "Conectar Meta Ads",
    connect_benefits: ["Alertas de ROAS en tiempo real", "Diagnóstico de creativos", "Recomendaciones personalizadas"],
    go_dashboard: "Ir al dashboard",
  },
  en: {
    hero: "Rate your ad\nin 10 seconds",
    sub: "AI analyzes hook, copy and CTA. Score from 1 to 10.",
    analyzing: "Analyzing",
    drop: "Drop here",
    drag_text: "Drag or click to upload",
    formats: "PNG, JPG, WEBP — up to 10 MB",
    positive_title: "What works",
    improve_title: "What to improve",
    signup_cta: "See full analysis",
    signup_sub: "Free — no card required",
    rate_limit: "Limit reached. Sign up to continue.",
    error: "Error. Try again.",
    unlock_card: "Create your account to see everything",
    unlock_details: "With a free account you unlock:",
    unlock_items: [
      "Full analysis with actionable steps",
      "CTA suggestions and copy improvements",
      "AI connected to your real campaigns",
    ],
    social_proof: "14,200+ ads analyzed", social_proof_count: "14,200+", social_proof_note: "ads analyzed this week",
    connect_title: "Connect Meta Ads for real results",
    connect_sub: "AI analyzes your live campaigns — ROAS, CTR, fatigued creatives — and tells you what to pause, scale and test.",
    connect_btn: "Connect Meta Ads",
    connect_benefits: ["Real-time ROAS alerts", "Creative diagnostics", "Personalized recommendations"],
    go_dashboard: "Go to dashboard",
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
const KF = `
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeUp2{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes scanLine{0%{top:10%;opacity:0}20%{opacity:1}80%{opacity:1}100%{top:85%;opacity:0}}
@keyframes lockPulse{0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0.18)}50%{box-shadow:0 0 0 10px rgba(99,102,241,0)}}
@property --beam-angle{syntax:"<angle>";initial-value:0deg;inherits:false}
@keyframes beamSpin{to{--beam-angle:360deg}}
@media(max-width:700px){
  .demo-result-grid{flex-direction:column!important}
  .demo-result-grid>div{width:100%!important}
}
`;

/* ══════════════════════════════════════════════════════════════════════════
   DEMO PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function Demo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromSignup = searchParams.get("unlocked") === "1";
  const { language } = useLanguage();
  const lang: Lang = ["pt", "es"].includes(language) ? (language as Lang) : "en";
  const t = T[lang];
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  /* ── Restore demo result after signup ─────────────────────────────── */
  useEffect(() => {
    if (!fromSignup) return;
    try {
      const saved = localStorage.getItem(DEMO_STORAGE_KEY);
      if (!saved) return;
      const { result: savedResult, preview: savedPreview } = JSON.parse(saved);
      if (savedResult && savedResult.score) {
        // Mark as full (unlocked) since user signed up
        setResult({ ...savedResult, full: true });
        setPreview(savedPreview || null);
        setPhase("result");
        // Clean up
        localStorage.removeItem(DEMO_STORAGE_KEY);
      }
    } catch {}
  }, [fromSignup]);

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
    reader.onload = () => { const url = reader.result as string; setPreview(url); previewRef.current = url; };
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
        parsed.hook = lang === "pt" ? "Análise processada." : lang === "es" ? "Análisis procesado." : "Analysis processed.";
        parsed.verdict = lang === "pt" ? "Resultado" : lang === "es" ? "Resultado" : "Result";
        if (!parsed.score) parsed.score = 5;
      }
      // Strip emojis from verdict (belt + suspenders with backend)
      if (parsed.verdict) parsed.verdict = parsed.verdict.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]/gu, "").trim();

      setResult(parsed);
      setPhase("result");

      // Save to localStorage so we can restore after signup
      // preview is set from FileReader.onload before compressImage resolves, so it's available
      try {
        localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({
          result: parsed,
          preview: previewRef.current,
        }));
      } catch {}
    } catch (e) {
      console.error("[Demo] Analysis error:", e);
      toast.error(t.error);
      setPhase("upload");
    }
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) analyze(f); };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) analyze(f); };

  const scoreColor = (s: number) => s >= 8 ? C.green : s >= 5 ? C.amber : C.red;

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F, position: "relative", overflow: "hidden" }}>
      <style>{KF}</style>

      {/* ── Background glow — matches IndexNew ── */}
      <div style={{
        position: "fixed", top: "-20%", left: "50%", transform: "translateX(-50%)",
        width: 900, height: 600, borderRadius: "50%",
        background: `radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)`,
        filter: "blur(80px)", pointerEvents: "none", zIndex: 0,
      }} />

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
            onClick={() => navigate("/signup?redirect=" + encodeURIComponent("/demo?unlocked=1"))}
            style={{
              fontFamily: F, fontSize: 13, fontWeight: 700,
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

      {/* ── Main container ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto", padding: "48px 20px 80px" }}>

        {/* ── Hero ── */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{
            fontFamily: F, fontWeight: 800,
            fontSize: "clamp(26px, 6vw, 40px)",
            letterSpacing: "-0.035em", lineHeight: 1.08,
            color: C.text, marginBottom: 14, whiteSpace: "pre-line",
          }}>
            {t.hero}
          </h1>
          <p style={{
            fontFamily: F, fontSize: 15, fontWeight: 400,
            color: TEXT_MUTED, lineHeight: 1.5,
            maxWidth: 340, margin: "0 auto",
          }}>
            {t.sub}
          </p>
        </div>

        {/* Social proof removed from upload — moved to below result/upload area */}

        {/* ── Rate Limited ── */}
        {rateLimited && (
          <div style={{
            textAlign: "center", padding: "28px 24px", borderRadius: 16,
            border: `1px solid rgba(239,68,68,0.2)`,
            background: "rgba(239,68,68,0.06)",
            marginBottom: 28, animation: "fadeUp 0.4s ease-out",
          }}>
            <p style={{ fontFamily: F, fontSize: 14, fontWeight: 500, color: C.red, marginBottom: 16 }}>
              {t.rate_limit}
            </p>
            <button
              onClick={() => navigate("/signup?redirect=" + encodeURIComponent("/demo?unlocked=1"))}
              style={{
                fontFamily: F, fontSize: 14, fontWeight: 700,
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
              if (!dragOver) { e.currentTarget.style.borderColor = C.borderHov; e.currentTarget.style.background = "rgba(255,255,255,0.055)"; }
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

            <Upload
              size={32}
              color={dragOver ? C.accent : C.textMuted}
              strokeWidth={1.4}
              style={{ margin: "0 auto 20px", transition: "color 0.2s" }}
            />

            <p style={{
              fontFamily: F, fontSize: 15, fontWeight: 600,
              color: dragOver ? C.text : "rgba(255,255,255,0.75)",
              marginBottom: 6, letterSpacing: "-0.02em",
              transition: "color 0.2s",
            }}>
              {dragOver ? t.drop : t.drag_text}
            </p>
            <p style={{ fontFamily: F, fontSize: 12, fontWeight: 400, color: C.textMuted }}>
              {t.formats}
            </p>
          </div>
        )}

        {/* ── Social proof below upload ── */}
        {phase === "upload" && !rateLimited && (
          <div style={{
            marginTop: 16, padding: "12px 20px", borderRadius: 12,
            background: C.surface, border: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            <Sparkles size={14} color={C.accent} strokeWidth={2} />
            <span style={{ fontFamily: F, fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.5)" }}>
              <span style={{ fontWeight: 700, color: C.text }}>{t.social_proof_count}</span>{" "}
              {t.social_proof_note}
            </span>
          </div>
        )}

        {/* ── Analyzing ── */}
        {phase === "analyzing" && (
          <div style={{ textAlign: "center", padding: "56px 24px", animation: "fadeUp 0.35s ease-out" }}>
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
              <span style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: C.textSoft }}>
                {t.analyzing}
              </span>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            RESULT — two-column layout
        ════════════════════════════════════════════════════════════════════ */}
        {phase === "result" && result && (
          <div style={{ animation: "fadeUp 0.4s ease-out" }}>

            {/* ── Score header ── */}
            <div style={{
              display: "flex", gap: 16, alignItems: "center",
              marginBottom: 20, padding: "18px 22px",
              borderRadius: 16, background: C.surface,
              border: `1px solid ${C.border}`,
            }}>
              {preview && (
                <img src={preview} alt="Ad" style={{
                  width: 64, height: 64, borderRadius: 10,
                  border: `1px solid ${C.border}`, objectFit: "cover", flexShrink: 0,
                }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 3 }}>
                  <span style={{
                    fontFamily: F, fontSize: 30, fontWeight: 800,
                    color: scoreColor(result.score), letterSpacing: "-0.04em", lineHeight: 1,
                  }}>
                    {result.score}
                  </span>
                  <span style={{ fontFamily: F, fontSize: 14, fontWeight: 500, color: C.textMuted }}>/10</span>
                </div>
                <p style={{
                  fontFamily: F, fontSize: 13, fontWeight: 600,
                  color: scoreColor(result.score),
                }}>
                  {result.verdict}
                </p>
              </div>
              {/* social proof moved to bottom */}
            </div>

            {/* ── Two-column cards ── */}
            <div className="demo-result-grid" style={{
              display: "flex", gap: 12, alignItems: "stretch",
              animation: "fadeUp2 0.5s ease-out",
            }}>

              {/* LEFT — What works (visible) */}
              <div style={{
                flex: 1, minWidth: 0,
                borderRadius: 16, padding: "20px 20px",
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderTop: `3px solid ${C.green}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <CheckCircle2 size={16} color={C.green} strokeWidth={2.2} />
                  <span style={{
                    fontFamily: F, fontSize: 12, fontWeight: 700,
                    color: C.green, letterSpacing: "0.04em", textTransform: "uppercase",
                  }}>
                    {t.positive_title}
                  </span>
                </div>
                <p style={{
                  fontFamily: F, fontSize: 13, fontWeight: 400,
                  color: "rgba(255,255,255,0.7)", lineHeight: 1.7,
                }}>
                  {result.hook}
                </p>
              </div>

              {/* RIGHT — What to improve (locked or open) */}
              {!result.full ? (
                <div
                  onClick={() => navigate("/signup?redirect=" + encodeURIComponent("/demo?unlocked=1"))}
                  style={{
                    flex: 1, minWidth: 0,
                    position: "relative", borderRadius: 16,
                    padding: "20px 20px",
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderTop: `3px solid ${C.accent}`,
                    cursor: "pointer",
                    transition: "border-color 0.2s",
                    overflow: "hidden",
                    minHeight: 140,
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                >
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <AlertTriangle size={16} color={C.accent} strokeWidth={2.2} />
                    <span style={{
                      fontFamily: F, fontSize: 12, fontWeight: 700,
                      color: C.accent, letterSpacing: "0.04em", textTransform: "uppercase",
                    }}>
                      {t.improve_title}
                    </span>
                  </div>

                  {/* Blurred placeholder */}
                  <div style={{ filter: "blur(5px)", userSelect: "none", pointerEvents: "none" }}>
                    <div style={{ height: 10, width: "90%", borderRadius: 3, background: "rgba(255,255,255,0.07)", marginBottom: 9 }} />
                    <div style={{ height: 10, width: "72%", borderRadius: 3, background: "rgba(255,255,255,0.05)", marginBottom: 9 }} />
                    <div style={{ height: 10, width: "80%", borderRadius: 3, background: "rgba(255,255,255,0.06)" }} />
                  </div>

                  {/* Lock overlay */}
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    background: "rgba(5,5,8,0.55)",
                    backdropFilter: "blur(3px)",
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 11,
                      border: `1px solid rgba(99,102,241,0.25)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginBottom: 8,
                      animation: "lockPulse 2.5s ease-in-out infinite",
                    }}>
                      <Lock size={17} color={C.accent} strokeWidth={1.8} />
                    </div>
                    <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: C.text }}>
                      {t.unlock_card}
                    </span>
                  </div>
                </div>
              ) : (
                /* Unlocked improvements card */
                <div style={{
                  flex: 1, minWidth: 0,
                  borderRadius: 16, padding: "20px 20px",
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderTop: `3px solid ${C.accent}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <AlertTriangle size={16} color={C.accent} strokeWidth={2.2} />
                    <span style={{
                      fontFamily: F, fontSize: 12, fontWeight: 700,
                      color: C.accent, letterSpacing: "0.04em", textTransform: "uppercase",
                    }}>
                      {t.improve_title}
                    </span>
                  </div>
                  <p style={{ fontFamily: F, fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, marginBottom: 14 }}>
                    {result.message}
                  </p>
                  {result.cta && (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>CTA</p>
                      <p style={{ fontFamily: F, fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{result.cta}</p>
                    </div>
                  )}
                  {result.actions && result.actions.length > 0 && (
                    <div>
                      {result.actions.map((action, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                          <span style={{
                            fontFamily: F, fontSize: 10, fontWeight: 800,
                            color: C.accent, marginTop: 3, flexShrink: 0,
                            width: 16, height: 16, borderRadius: 4,
                            border: `1px solid rgba(99,102,241,0.2)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>{i + 1}</span>
                          <p style={{ fontFamily: F, fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{action}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── CTA section below cards ── */}
            {!result.full && (
              <div style={{
                marginTop: 20, padding: "24px", borderRadius: 16,
                background: "rgba(99,102,241,0.04)",
                border: `1px solid rgba(99,102,241,0.12)`,
                textAlign: "center",
                animation: "fadeUp2 0.6s ease-out",
              }}>
                {/* Value items */}
                <p style={{ fontFamily: F, fontSize: 13, fontWeight: 500, color: C.textSoft, marginBottom: 16 }}>
                  {t.unlock_details}
                </p>
                <div style={{
                  display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center",
                  marginBottom: 20,
                }}>
                  {t.unlock_items.map((item, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 12px", borderRadius: 20,
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${C.border}`,
                    }}>
                      <CheckCircle2 size={12} color={C.green} strokeWidth={2.5} />
                      <span style={{ fontFamily: F, fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.75)" }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => navigate("/signup?redirect=" + encodeURIComponent("/demo?unlocked=1"))}
                  style={{
                    fontFamily: F, fontSize: 15, fontWeight: 700,
                    padding: "14px 40px", borderRadius: 12,
                    background: "#fff", color: "#000",
                    border: "none", cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 8,
                    transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
                    boxShadow: "0 0 32px rgba(255,255,255,0.08)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 0 40px rgba(255,255,255,0.15)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 0 32px rgba(255,255,255,0.08)"; }}
                >
                  {t.signup_cta} <ArrowRight size={15} />
                </button>
                <p style={{ fontFamily: F, fontSize: 11, fontWeight: 400, color: C.textMuted, marginTop: 10 }}>
                  {t.signup_sub}
                </p>
              </div>
            )}

            {/* ── Connect Meta Ads CTA — visible after signup (full result) ── */}
            {result.full && (
              <div style={{
                marginTop: 20, padding: "28px 24px", borderRadius: 16,
                background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.04))",
                border: `1px solid rgba(99,102,241,0.15)`,
                animation: "fadeUp2 0.6s ease-out",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "rgba(99,102,241,0.1)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Plug size={18} color={C.accent} strokeWidth={1.8} />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: C.text, margin: 0, letterSpacing: "-0.02em" }}>
                      {t.connect_title}
                    </h3>
                  </div>
                </div>
                <p style={{ fontFamily: F, fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, marginBottom: 16 }}>
                  {t.connect_sub}
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                  {t.connect_benefits.map((b: string, i: number) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 12px", borderRadius: 20,
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${C.border}`,
                    }}>
                      <Zap size={11} color={C.accent} strokeWidth={2.5} />
                      <span style={{ fontFamily: F, fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>{b}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => navigate("/dashboard/ai")}
                    style={{
                      fontFamily: F, fontSize: 14, fontWeight: 700,
                      padding: "13px 28px", borderRadius: 12,
                      background: "#fff", color: "#000",
                      border: "none", cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 8,
                      transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
                      boxShadow: "0 0 24px rgba(255,255,255,0.06)",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 0 32px rgba(255,255,255,0.12)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 0 24px rgba(255,255,255,0.06)"; }}
                  >
                    {t.connect_btn} <ArrowRight size={14} />
                  </button>
                  <button
                    onClick={() => navigate("/dashboard/ai")}
                    style={{
                      fontFamily: F, fontSize: 13, fontWeight: 600,
                      padding: "13px 20px", borderRadius: 12,
                      background: "transparent", color: "rgba(255,255,255,0.5)",
                      border: `1px solid ${C.border}`, cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.8)"; e.currentTarget.style.borderColor = C.borderHov; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.borderColor = C.border; }}
                  >
                    {t.go_dashboard}
                  </button>
                </div>
              </div>
            )}

            {/* ── Social proof — specific metric ── */}
            <div style={{
              marginTop: 20, padding: "14px 20px", borderRadius: 12,
              background: C.surface, border: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}>
              <Sparkles size={14} color={C.accent} strokeWidth={2} />
              <span style={{ fontFamily: F, fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.5)" }}>
                <span style={{ fontWeight: 700, color: C.text }}>{t.social_proof_count}</span>{" "}
                {t.social_proof_note}
              </span>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
