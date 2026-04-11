import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Upload, Loader2, Lock, ArrowRight, CheckCircle2, AlertTriangle, Zap, Plug, Share2, Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/posthog";
import { motion, AnimatePresence } from "motion/react";

const DEMO_STORAGE_KEY = "adbrief_demo_result";

/* ── Tokens ────────────────────────────────────────────────────────── */
const F = "'Plus Jakarta Sans', system-ui, sans-serif";
const C = {
  bg: "#030306",
  text: "#fff",
  textSoft: "rgba(255,255,255,0.55)",
  textMuted: "rgba(255,255,255,0.28)",
  accent: "#818cf8",
  accentBright: "#a78bfa",
  green: "#34d399",
  amber: "#fbbf24",
  red: "#f87171",
  border: "rgba(255,255,255,0.06)",
};

type Lang = "pt" | "es" | "en";

const T: Record<Lang, {
  hero1: string; hero2: string; hero3: string;
  sub: string; analyzing: string; drop: string;
  drag_text: string; drag_sub: string;
  positive_title: string; improve_title: string;
  signup_cta: string; signup_sub: string;
  rate_limit: string; error: string;
  unlock_card: string; unlock_details: string; unlock_items: string[];
  connect_title: string; connect_sub: string; connect_btn: string;
  connect_benefits: string[]; go_dashboard: string;
  share_result: string; link_copied: string;
}> = {
  pt: {
    hero1: "Nota do seu anúncio",
    hero2: "em 10",
    hero3: "segundos",
    sub: "IA analisa hook, copy e CTA — e diz exatamente o que mudar.",
    analyzing: "Analisando", drop: "Solte aqui",
    drag_text: "Arraste seu anúncio aqui",
    drag_sub: "ou clique para escolher · PNG, JPG, WEBP",
    positive_title: "O que funciona", improve_title: "O que melhorar",
    signup_cta: "Ver análise completa", signup_sub: "Grátis — sem cartão",
    rate_limit: "Limite atingido. Crie uma conta para continuar.",
    error: "Erro. Tente novamente.",
    unlock_card: "Crie sua conta para desbloquear",
    unlock_details: "Com uma conta gratuita você desbloqueia:",
    unlock_items: ["Análise completa com ações práticas", "Sugestões de CTA e melhorias de copy", "IA conectada às suas campanhas reais"],
    connect_title: "Conecte Meta Ads para resultados reais",
    connect_sub: "A IA analisa suas campanhas ao vivo — ROAS, CTR, criativos fadigados — e diz o que pausar, escalar e testar.",
    connect_btn: "Conectar Meta Ads",
    connect_benefits: ["Alertas de ROAS em tempo real", "Diagnóstico de criativos", "Recomendações personalizadas"],
    go_dashboard: "Ir para o dashboard",
    share_result: "Compartilhar", link_copied: "Link copiado!",
  },
  es: {
    hero1: "Nota de tu anuncio",
    hero2: "en 10",
    hero3: "segundos",
    sub: "IA analiza hook, copy y CTA — y te dice exactamente qué cambiar.",
    analyzing: "Analizando", drop: "Suelta aquí",
    drag_text: "Arrastra tu anuncio aquí",
    drag_sub: "o haz clic para elegir · PNG, JPG, WEBP",
    positive_title: "Lo que funciona", improve_title: "Qué mejorar",
    signup_cta: "Ver análisis completo", signup_sub: "Gratis — sin tarjeta",
    rate_limit: "Límite alcanzado. Crea una cuenta para continuar.",
    error: "Error. Intenta de nuevo.",
    unlock_card: "Crea tu cuenta para desbloquear",
    unlock_details: "Con una cuenta gratuita desbloqueas:",
    unlock_items: ["Análisis completo con acciones prácticas", "Sugerencias de CTA y mejoras de copy", "IA conectada a tus campañas reales"],
    connect_title: "Conecta Meta Ads para resultados reales",
    connect_sub: "La IA analiza tus campañas en vivo — ROAS, CTR, creativos fatigados — y te dice qué pausar, escalar y testear.",
    connect_btn: "Conectar Meta Ads",
    connect_benefits: ["Alertas de ROAS en tiempo real", "Diagnóstico de creativos", "Recomendaciones personalizadas"],
    go_dashboard: "Ir al dashboard",
    share_result: "Compartir", link_copied: "¡Link copiado!",
  },
  en: {
    hero1: "Rate your ad",
    hero2: "in 10",
    hero3: "seconds",
    sub: "AI analyzes hook, copy and CTA — and tells you exactly what to change.",
    analyzing: "Analyzing", drop: "Drop here",
    drag_text: "Drag your ad here",
    drag_sub: "or click to browse · PNG, JPG, WEBP",
    positive_title: "What works", improve_title: "What to improve",
    signup_cta: "See full analysis", signup_sub: "Free — no card required",
    rate_limit: "Limit reached. Sign up to continue.",
    error: "Error. Try again.",
    unlock_card: "Create your account to unlock",
    unlock_details: "With a free account you unlock:",
    unlock_items: ["Full analysis with actionable steps", "CTA suggestions and copy improvements", "AI connected to your real campaigns"],
    connect_title: "Connect Meta Ads for real results",
    connect_sub: "AI analyzes your live campaigns — ROAS, CTR, fatigued creatives — and tells you what to pause, scale and test.",
    connect_btn: "Connect Meta Ads",
    connect_benefits: ["Real-time ROAS alerts", "Creative diagnostics", "Personalized recommendations"],
    go_dashboard: "Go to dashboard",
    share_result: "Share", link_copied: "Link copied!",
  },
};

type Phase = "upload" | "analyzing" | "result";
interface AnalysisResult {
  full: boolean; score: number; verdict: string; hook: string;
  message?: string; cta?: string; actions?: string[];
}

/* ── CSS ──────────────────────────────────────────────────────────── */
const CSS = `
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes scanLine{0%{top:8%;opacity:0}15%{opacity:1}85%{opacity:1}100%{top:88%;opacity:0}}
@keyframes lockPulse{0%,100%{box-shadow:0 0 0 0 rgba(129,140,248,0.22)}50%{box-shadow:0 0 0 12px rgba(129,140,248,0)}}
@keyframes aurora{
  0%{background-position:0% 50%,100% 50%,50% 0%}
  25%{background-position:50% 100%,0% 0%,100% 50%}
  50%{background-position:100% 50%,50% 100%,0% 50%}
  75%{background-position:50% 0%,100% 50%,50% 100%}
  100%{background-position:0% 50%,100% 50%,50% 0%}
}
@keyframes gridPulse{0%,100%{opacity:0.03}50%{opacity:0.06}}
@keyframes pulseRing{0%{transform:scale(0.85);opacity:0}40%{opacity:0.12}100%{transform:scale(2.8);opacity:0}}
@keyframes scannerIdle{0%,100%{opacity:0.4}50%{opacity:0.8}}
@property --beam-angle{syntax:"<angle>";initial-value:0deg;inherits:false}
@keyframes beamSpin{to{--beam-angle:360deg}}
@media(max-width:700px){
  .demo-result-grid{flex-direction:column!important}
  .demo-result-grid>div{width:100%!important}
}
`;

/* ── Score Ring ───────────────────────────────────────────────────── */
function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const color = score >= 8 ? C.green : score >= 5 ? C.amber : C.red;
  const circ = 2 * Math.PI * 38;
  const offset = circ - (score / 10) * circ;
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: `2px solid ${color}`, animation: "pulseRing 2.5s ease-out infinite", opacity: 0.12 }} />
      <svg width={size} height={size} viewBox="0 0 88 88" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4.5" />
        <motion.circle
          cx="44" cy="44" r="38" fill="none"
          stroke={color} strokeWidth="4.5" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.4 }}
          style={{ filter: `drop-shadow(0 0 8px ${color}80)` }}
        />
      </svg>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.7, type: "spring", stiffness: 300, damping: 20 }}
        style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
      >
        <span style={{ fontFamily: F, fontSize: 30, fontWeight: 900, color, letterSpacing: "-0.04em", lineHeight: 1 }}>{score}</span>
        <span style={{ fontFamily: F, fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>/10</span>
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   DEMO PAGE — v3
══════════════════════════════════════════════════════════════════════ */
export default function Demo() {
  const navigate = useNavigate();
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
  const [sharing, setSharing] = useState(false);
  const [shareButtonState, setShareButtonState] = useState<"idle" | "copied">("idle");
  const [analyzeProgress, setAnalyzeProgress] = useState(0);

  /* ── Logic (unchanged) ──────────────────────────────────────────── */
  const compressImage = (file: File, maxW = 1200, quality = 0.7): Promise<{ base64: string; mediaType: string }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, maxW / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        resolve({ base64: cv.toDataURL("image/jpeg", quality).split(",")[1], mediaType: "image/jpeg" });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img")); };
      img.src = url;
    });

  const handleDemoResponse = (payload: unknown) => {
    const r = payload as any;
    if (!r) throw new Error("empty");
    if (r.error === "rate_limited") { setRateLimited(true); setPhase("upload"); return null; }
    if (r.ok === false || r.error) throw new Error(r.error || "fail");
    return r as AnalysisResult;
  };

  const analyze = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Image only"); return; }
    const reader = new FileReader();
    reader.onload = () => { const u = reader.result as string; setPreview(u); previewRef.current = u; };
    reader.readAsDataURL(file);
    setPhase("analyzing"); setRateLimited(false); setAnalyzeProgress(0);
    trackEvent("demo_analysis_started");
    const pi = setInterval(() => setAnalyzeProgress(p => p >= 90 ? (clearInterval(pi), 90) : p + Math.random() * 12 + 3), 400);
    try {
      const { base64, mediaType } = await compressImage(file);
      const { data, error } = await supabase.functions.invoke("analyze-demo", { body: { image_base64: base64, media_type: mediaType, lang } });
      clearInterval(pi); setAnalyzeProgress(100);
      if (error) throw error;
      const parsed = handleDemoResponse(data);
      if (!parsed) return;
      if (!parsed.hook && !parsed.verdict) { parsed.hook = "—"; parsed.verdict = "Result"; if (!parsed.score) parsed.score = 5; }
      if (parsed.verdict) parsed.verdict = parsed.verdict.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]/gu, "").trim();
      await new Promise(r => setTimeout(r, 300));
      setResult(parsed); setPhase("result");
      trackEvent("demo_analysis_completed", { score: parsed.score });
      try { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ result: parsed, preview: previewRef.current })); } catch {}
    } catch (e) { clearInterval(pi); console.error(e); toast.error(t.error); setPhase("upload"); }
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) analyze(f); };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) analyze(f); };
  const scoreColor = (s: number) => s >= 8 ? C.green : s >= 5 ? C.amber : C.red;

  const handleShare = async () => {
    if (!result) return;
    setSharing(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-share`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis_score: result.score, analysis_result: result, lang }),
      });
      if (!resp.ok) { toast.error(t.error); return; }
      const data = await resp.json();
      if (!data.share_id) { toast.error(t.error); return; }
      const url = `${window.location.origin}/s/${data.share_id}`;
      try { await navigator.clipboard.writeText(url); setShareButtonState("copied"); toast.success(t.link_copied); setTimeout(() => setShareButtonState("idle"), 2000); } catch { toast.success(url); }
    } catch { toast.error(t.error); } finally { setSharing(false); }
  };

  /* ══════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F, position: "relative", overflow: "hidden" }}>
      <style>{CSS}</style>

      {/* ── Aurora background ── */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: [
          "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(129,140,248,0.09), transparent 50%)",
          "radial-gradient(ellipse 60% 80% at 80% 90%, rgba(167,139,250,0.07), transparent 50%)",
          "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(99,102,241,0.05), transparent 60%)",
        ].join(","),
        backgroundSize: "200% 200%, 200% 200%, 150% 150%",
        animation: "aurora 25s ease-in-out infinite",
      }} />

      {/* ── Grid pattern ── */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "80px 80px",
        animation: "gridPulse 8s ease-in-out infinite",
        maskImage: "radial-gradient(ellipse 60% 50% at 50% 40%, black, transparent)",
        WebkitMaskImage: "radial-gradient(ellipse 60% 50% at 50% 40%, black, transparent)",
      }} />

      {/* ── Noise texture ── */}
      <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none", opacity: 0.35 }}>
        <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#noise)" opacity="0.04" />
      </svg>

      {/* ── Nav ── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        style={{
          position: "sticky", top: 0, zIndex: 50,
          borderBottom: `1px solid ${C.border}`,
          background: "rgba(3,3,6,0.6)", backdropFilter: "blur(20px) saturate(1.3)",
          padding: "14px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <Link to="/"><Logo size="lg" /></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <LanguageSwitcher />
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/signup?redirect=" + encodeURIComponent("/dashboard/ai?from_demo=1"))}
            style={{
              fontFamily: F, fontSize: 13, fontWeight: 700,
              padding: "8px 20px", borderRadius: 10,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.8)", cursor: "pointer",
              backdropFilter: "blur(8px)",
            }}
          >
            {t.signup_cta}
          </motion.button>
        </div>
      </motion.nav>

      {/* ── Content ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto", padding: "0 20px 80px" }}>

        <AnimatePresence mode="wait">
          {/* ═══════════════════════════════════════════════════════════
              UPLOAD
          ═══════════════════════════════════════════════════════════ */}
          {phase === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -30, filter: "blur(6px)" }}
              transition={{ duration: 0.4 }}
              style={{ paddingTop: "min(12vh, 80px)" }}
            >
              {/* ── Hero ── */}
              <div style={{ textAlign: "center", marginBottom: 48 }}>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    fontFamily: F, fontWeight: 900,
                    fontSize: "clamp(30px, 7vw, 52px)",
                    letterSpacing: "-0.045em", lineHeight: 1.05,
                    color: C.text, marginBottom: 18,
                  }}
                >
                  {t.hero1}<br />
                  <span style={{ color: C.textSoft }}>{t.hero2} </span>
                  <span style={{
                    background: "linear-gradient(135deg, #818cf8, #c084fc)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}>
                    {t.hero3}
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.6 }}
                  style={{
                    fontFamily: F, fontSize: 17, fontWeight: 400,
                    color: C.textSoft, lineHeight: 1.5,
                    maxWidth: 420, margin: "0 auto",
                  }}
                >
                  {t.sub}
                </motion.p>
              </div>

              {/* Rate Limited */}
              {rateLimited && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    textAlign: "center", padding: "24px", borderRadius: 16,
                    border: `1px solid rgba(248,113,113,0.2)`,
                    background: "rgba(248,113,113,0.05)",
                    marginBottom: 24,
                  }}
                >
                  <p style={{ fontFamily: F, fontSize: 14, fontWeight: 500, color: C.red, marginBottom: 14 }}>{t.rate_limit}</p>
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => navigate("/signup?redirect=" + encodeURIComponent("/dashboard/ai?from_demo=1"))}
                    style={{
                      fontFamily: F, fontSize: 14, fontWeight: 700,
                      padding: "11px 28px", borderRadius: 10,
                      background: C.text, color: C.bg,
                      border: "none", cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}
                  >
                    {t.signup_cta} <ArrowRight size={14} />
                  </motion.button>
                </motion.div>
              )}

              {/* ── Upload Scanner ── */}
              {!rateLimited && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    position: "relative", borderRadius: 20, cursor: "pointer",
                    background: dragOver ? "rgba(129,140,248,0.04)" : "rgba(255,255,255,0.015)",
                    border: `1px solid ${dragOver ? "rgba(129,140,248,0.35)" : "rgba(255,255,255,0.06)"}`,
                    padding: "56px 32px 48px",
                    textAlign: "center",
                    transition: "border-color 0.3s, background 0.3s",
                    overflow: "hidden",
                  }}
                >
                  {/* Beam border */}
                  <div style={{
                    position: "absolute", inset: -1, borderRadius: 21, padding: 1,
                    background: `conic-gradient(from var(--beam-angle), transparent 0%, transparent 65%, rgba(129,140,248,0.25) 78%, rgba(167,139,250,0.18) 88%, transparent 98%)`,
                    animation: "beamSpin 5s linear infinite",
                    WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "xor", maskComposite: "exclude" as any,
                    pointerEvents: "none", opacity: dragOver ? 0 : 1,
                    transition: "opacity 0.3s",
                  }} />

                  {/* Scanner crosshair lines */}
                  <div style={{ position: "absolute", top: "50%", left: 24, right: 24, height: 1, background: "linear-gradient(90deg, transparent, rgba(129,140,248,0.06), transparent)", pointerEvents: "none", animation: "scannerIdle 4s ease-in-out infinite" }} />
                  <div style={{ position: "absolute", left: "50%", top: 24, bottom: 24, width: 1, background: "linear-gradient(180deg, transparent, rgba(129,140,248,0.06), transparent)", pointerEvents: "none", animation: "scannerIdle 4s ease-in-out infinite 1s" }} />

                  {/* Corner brackets */}
                  {[
                    { top: 12, left: 12, borderTop: "2px solid rgba(129,140,248,0.2)", borderLeft: "2px solid rgba(129,140,248,0.2)" },
                    { top: 12, right: 12, borderTop: "2px solid rgba(129,140,248,0.2)", borderRight: "2px solid rgba(129,140,248,0.2)" },
                    { bottom: 12, left: 12, borderBottom: "2px solid rgba(129,140,248,0.2)", borderLeft: "2px solid rgba(129,140,248,0.2)" },
                    { bottom: 12, right: 12, borderBottom: "2px solid rgba(129,140,248,0.2)", borderRight: "2px solid rgba(129,140,248,0.2)" },
                  ].map((s, i) => (
                    <div key={i} style={{ position: "absolute", width: 20, height: 20, borderRadius: 2, pointerEvents: "none", transition: "border-color 0.3s", ...s } as any} />
                  ))}

                  <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />

                  <motion.div
                    animate={dragOver ? { scale: 1.12, y: -6 } : {}}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    style={{
                      width: 56, height: 56, borderRadius: 16,
                      background: "rgba(129,140,248,0.06)",
                      border: "1px solid rgba(129,140,248,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 22px",
                    }}
                  >
                    <Upload size={24} color={dragOver ? C.accentBright : "rgba(255,255,255,0.3)"} strokeWidth={1.6} />
                  </motion.div>

                  <p style={{
                    fontFamily: F, fontSize: 16, fontWeight: 700,
                    color: dragOver ? C.text : "rgba(255,255,255,0.65)",
                    marginBottom: 6, letterSpacing: "-0.02em",
                    position: "relative",
                  }}>
                    {dragOver ? t.drop : t.drag_text}
                  </p>
                  <p style={{ fontFamily: F, fontSize: 13, fontWeight: 400, color: C.textMuted, position: "relative" }}>
                    {t.drag_sub}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              ANALYZING
          ═══════════════════════════════════════════════════════════ */}
          {phase === "analyzing" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(6px)" }}
              transition={{ duration: 0.4 }}
              style={{ textAlign: "center", paddingTop: "min(12vh, 80px)" }}
            >
              {preview && (
                <motion.div
                  initial={{ scale: 0.85, opacity: 0, rotateX: 8 }}
                  animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                  transition={{ type: "spring", stiffness: 180, damping: 20 }}
                  style={{
                    position: "relative", display: "inline-block", marginBottom: 40,
                    borderRadius: 16, overflow: "hidden",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
                  }}
                >
                  <img src={preview} alt="" style={{
                    maxWidth: 220, maxHeight: 180, borderRadius: 16,
                    objectFit: "cover", display: "block",
                    filter: "brightness(0.7) saturate(0.8)",
                  }} />
                  {/* Scan line */}
                  <div style={{
                    position: "absolute", left: 0, right: 0, height: 2,
                    background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
                    animation: "scanLine 2s ease-in-out infinite",
                    boxShadow: `0 0 16px ${C.accent}50`,
                  }} />
                  {/* Corners */}
                  {[
                    { top: 6, left: 6, borderTop: `2px solid ${C.accent}`, borderLeft: `2px solid ${C.accent}` },
                    { top: 6, right: 6, borderTop: `2px solid ${C.accent}`, borderRight: `2px solid ${C.accent}` },
                    { bottom: 6, left: 6, borderBottom: `2px solid ${C.accent}`, borderLeft: `2px solid ${C.accent}` },
                    { bottom: 6, right: 6, borderBottom: `2px solid ${C.accent}`, borderRight: `2px solid ${C.accent}` },
                  ].map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                      style={{ position: "absolute", width: 14, height: 14, borderRadius: 1, ...s } as any}
                    />
                  ))}
                </motion.div>
              )}

              {/* Progress */}
              <div style={{ maxWidth: 260, margin: "0 auto 18px", height: 3, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                <motion.div
                  animate={{ width: `${Math.min(analyzeProgress, 100)}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${C.accent}, ${C.accentBright})`, boxShadow: `0 0 12px ${C.accent}30` }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid rgba(255,255,255,0.06)`, borderTopColor: C.accent, animation: "spin 0.7s linear infinite" }} />
                <span style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: C.textSoft }}>{t.analyzing}...</span>
                <span style={{ fontFamily: "'SF Mono', monospace", fontSize: 12, fontWeight: 600, color: C.accent }}>{Math.round(Math.min(analyzeProgress, 100))}%</span>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              RESULT
          ═══════════════════════════════════════════════════════════ */}
          {phase === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{ paddingTop: "min(6vh, 48px)" }}
            >
              {/* Score header */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                style={{
                  display: "flex", gap: 22, alignItems: "center",
                  marginBottom: 18, padding: "26px 28px",
                  borderRadius: 20,
                  background: "rgba(255,255,255,0.02)",
                  backdropFilter: "blur(16px)",
                  border: `1px solid ${C.border}`,
                  boxShadow: "0 8px 48px rgba(0,0,0,0.25)",
                }}
              >
                <ScoreRing score={result.score} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    style={{ fontFamily: F, fontSize: 18, fontWeight: 800, color: scoreColor(result.score), letterSpacing: "-0.02em", marginBottom: 6 }}
                  >
                    {result.verdict}
                  </motion.p>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {preview && <img src={preview} alt="" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, objectFit: "cover" }} />}
                    <motion.button
                      whileHover={{ scale: 1.05, borderColor: C.accent }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleShare} disabled={sharing}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "5px 12px", borderRadius: 8,
                        background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`,
                        color: C.textMuted, fontSize: 11.5, fontWeight: 600, fontFamily: F,
                        cursor: sharing ? "not-allowed" : "pointer", opacity: sharing ? 0.5 : 1,
                      }}
                    >
                      {shareButtonState === "copied" ? <><Check size={11} /> {t.link_copied}</> :
                        sharing ? <Loader2 size={11} style={{ animation: "spin 0.8s linear infinite" }} /> :
                        <><Share2 size={11} /> {t.share_result}</>}
                    </motion.button>
                  </motion.div>
                </div>
              </motion.div>

              {/* Cards */}
              <div className="demo-result-grid" style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
                {/* What works */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  style={{
                    flex: 1, minWidth: 0, borderRadius: 18, padding: "20px",
                    background: "rgba(255,255,255,0.02)", border: `1px solid rgba(52,211,153,0.1)`,
                    borderTop: `2px solid ${C.green}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <CheckCircle2 size={14} color={C.green} strokeWidth={2.5} />
                    <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: "0.05em", textTransform: "uppercase" }}>{t.positive_title}</span>
                  </div>
                  <p style={{ fontFamily: F, fontSize: 13.5, fontWeight: 400, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>{result.hook}</p>
                </motion.div>

                {/* What to improve */}
                {!result.full ? (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    onClick={() => navigate("/signup?redirect=" + encodeURIComponent("/dashboard/ai?from_demo=1"))}
                    whileHover={{ borderColor: "rgba(129,140,248,0.2)" }}
                    style={{
                      flex: 1, minWidth: 0, position: "relative", borderRadius: 18,
                      padding: "20px", background: "rgba(255,255,255,0.02)",
                      border: `1px solid rgba(129,140,248,0.08)`, borderTop: `2px solid ${C.accent}`,
                      cursor: "pointer", overflow: "hidden", minHeight: 130,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <AlertTriangle size={14} color={C.accent} strokeWidth={2.5} />
                      <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: "0.05em", textTransform: "uppercase" }}>{t.improve_title}</span>
                    </div>
                    <div style={{ filter: "blur(5px)", userSelect: "none", pointerEvents: "none" }}>
                      <div style={{ height: 10, width: "88%", borderRadius: 4, background: "rgba(255,255,255,0.06)", marginBottom: 9 }} />
                      <div style={{ height: 10, width: "68%", borderRadius: 4, background: "rgba(255,255,255,0.04)", marginBottom: 9 }} />
                      <div style={{ height: 10, width: "78%", borderRadius: 4, background: "rgba(255,255,255,0.05)" }} />
                    </div>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(3,3,6,0.5)", backdropFilter: "blur(4px)" }}>
                      <motion.div
                        animate={{ scale: [1, 1.06, 1] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        style={{ width: 42, height: 42, borderRadius: 12, border: "1px solid rgba(129,140,248,0.25)", background: "rgba(129,140,248,0.05)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8, boxShadow: "0 0 20px rgba(129,140,248,0.1)" }}
                      >
                        <Lock size={17} color={C.accent} strokeWidth={1.8} />
                      </motion.div>
                      <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: C.text }}>{t.unlock_card}</span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    style={{
                      flex: 1, minWidth: 0, borderRadius: 18, padding: "20px",
                      background: "rgba(255,255,255,0.02)", border: `1px solid rgba(129,140,248,0.1)`,
                      borderTop: `2px solid ${C.accent}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <AlertTriangle size={14} color={C.accent} strokeWidth={2.5} />
                      <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: "0.05em", textTransform: "uppercase" }}>{t.improve_title}</span>
                    </div>
                    <p style={{ fontFamily: F, fontSize: 13.5, fontWeight: 400, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, marginBottom: 12 }}>{result.message}</p>
                    {result.cta && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>CTA</p>
                        <p style={{ fontFamily: F, fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{result.cta}</p>
                      </div>
                    )}
                    {result.actions?.map((a, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.1 }} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                        <span style={{ fontFamily: F, fontSize: 10, fontWeight: 800, color: C.accent, marginTop: 3, width: 18, height: 18, borderRadius: 6, background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                        <p style={{ fontFamily: F, fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{a}</p>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* CTA */}
              {!result.full && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  style={{
                    marginTop: 18, padding: "28px 24px", borderRadius: 20,
                    background: "rgba(129,140,248,0.03)",
                    border: `1px solid rgba(129,140,248,0.08)`,
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontFamily: F, fontSize: 13, fontWeight: 500, color: C.textSoft, marginBottom: 16 }}>{t.unlock_details}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 20 }}>
                    {t.unlock_items.map((item, i) => (
                      <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.8 + i * 0.08 }}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}` }}>
                        <CheckCircle2 size={11} color={C.green} strokeWidth={2.5} />
                        <span style={{ fontFamily: F, fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.65)" }}>{item}</span>
                      </motion.div>
                    ))}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
                    onClick={() => navigate("/signup?redirect=" + encodeURIComponent("/dashboard/ai?from_demo=1"))}
                    style={{
                      fontFamily: F, fontSize: 15, fontWeight: 800,
                      padding: "14px 44px", borderRadius: 14,
                      background: C.text, color: C.bg,
                      border: "none", cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 8,
                      boxShadow: "0 4px 32px rgba(255,255,255,0.08)",
                    }}
                  >
                    {t.signup_cta} <ArrowRight size={15} />
                  </motion.button>
                  <p style={{ fontFamily: F, fontSize: 11, fontWeight: 400, color: C.textMuted, marginTop: 10 }}>{t.signup_sub}</p>
                </motion.div>
              )}

              {/* Connect Meta */}
              {result.full && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}
                  style={{ marginTop: 18, padding: "26px 24px", borderRadius: 20, background: "rgba(129,140,248,0.03)", border: `1px solid rgba(129,140,248,0.1)` }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Plug size={17} color={C.accent} />
                    </div>
                    <h3 style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: C.text, margin: 0, letterSpacing: "-0.02em" }}>{t.connect_title}</h3>
                  </div>
                  <p style={{ fontFamily: F, fontSize: 13, fontWeight: 400, color: C.textSoft, lineHeight: 1.65, marginBottom: 14 }}>{t.connect_sub}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                    {t.connect_benefits.map((b, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}` }}>
                        <Zap size={10} color={C.accent} strokeWidth={2.5} />
                        <span style={{ fontFamily: F, fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.6)" }}>{b}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => navigate("/dashboard/ai")}
                      style={{ fontFamily: F, fontSize: 14, fontWeight: 700, padding: "12px 26px", borderRadius: 12, background: C.text, color: C.bg, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}>
                      {t.connect_btn} <ArrowRight size={14} />
                    </motion.button>
                    <motion.button whileHover={{ borderColor: "rgba(255,255,255,0.15)" }} onClick={() => navigate("/dashboard/ai")}
                      style={{ fontFamily: F, fontSize: 13, fontWeight: 600, padding: "12px 18px", borderRadius: 12, background: "transparent", color: "rgba(255,255,255,0.4)", border: `1px solid ${C.border}`, cursor: "pointer" }}>
                      {t.go_dashboard}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
