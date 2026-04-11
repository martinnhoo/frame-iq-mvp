import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Upload, Loader2, Lock, ArrowRight, CheckCircle2, AlertTriangle, Zap, Plug, Share2, Check, Sparkles, TrendingUp, Eye, MessageSquare } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/posthog";
import { motion, AnimatePresence } from "motion/react";

const DEMO_STORAGE_KEY = "adbrief_demo_result";

/* ── Design tokens ─────────────────────────────────────────────────── */
const F = "'Plus Jakarta Sans', system-ui, sans-serif";
const BRAND = "#6366f1";
const BG = "#050508";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.07)";
const TEXT_MUTED = "rgba(255,255,255,0.55)";

const C = {
  bg: BG, surface: CARD_BG, border: CARD_BORDER,
  borderHov: "rgba(255,255,255,0.14)", text: "#fff",
  textSoft: "rgba(255,255,255,0.6)", textMuted: "rgba(255,255,255,0.32)",
  accent: BRAND, green: "#22c55e", amber: "#f97316", red: "#ef4444",
};

type Lang = "pt" | "es" | "en";

const T: Record<Lang, {
  hero: string; sub: string; analyzing: string; drop: string;
  drag_text: string; formats: string; positive_title: string; improve_title: string;
  signup_cta: string; signup_sub: string; rate_limit: string; error: string;
  unlock_card: string; unlock_details: string; unlock_items: string[];
  sp_count: number; sp_label: string; sp_live: string; sp_live_count: number;
  connect_title: string; connect_sub: string; connect_btn: string;
  connect_benefits: string[]; go_dashboard: string;
  share_result: string; link_copied: string;
  feat1: string; feat2: string; feat3: string; feat4: string;
  trusted: string;
}> = {
  pt: {
    hero: "Nota do seu anúncio\nem 10 segundos",
    sub: "IA analisa hook, copy e CTA. Nota de 1 a 10 com sugestões de melhoria.",
    analyzing: "Analisando seu criativo", drop: "Solte aqui",
    drag_text: "Arraste seu anúncio ou clique para enviar",
    formats: "PNG, JPG, WEBP — até 10 MB",
    positive_title: "O que funciona", improve_title: "O que melhorar",
    signup_cta: "Ver análise completa", signup_sub: "Grátis — sem cartão",
    rate_limit: "Limite atingido. Crie uma conta para continuar.",
    error: "Erro. Tente novamente.",
    unlock_card: "Crie sua conta para ver tudo",
    unlock_details: "Com uma conta gratuita você desbloqueia:",
    unlock_items: [
      "Análise completa com ações práticas",
      "Sugestões de CTA e melhorias de copy",
      "IA conectada às suas campanhas reais",
    ],
    sp_count: 1247, sp_label: "anúncios analisados", sp_live: "analisando agora", sp_live_count: 4,
    connect_title: "Conecte Meta Ads para resultados reais",
    connect_sub: "A IA analisa suas campanhas ao vivo — ROAS, CTR, criativos fadigados — e diz o que pausar, escalar e testar.",
    connect_btn: "Conectar Meta Ads",
    connect_benefits: ["Alertas de ROAS em tempo real", "Diagnóstico de criativos", "Recomendações personalizadas"],
    go_dashboard: "Ir para o dashboard",
    share_result: "Compartilhar", link_copied: "Link copiado!",
    feat1: "Análise de Hook", feat2: "Score de 1–10", feat3: "Sugestões de CTA", feat4: "Melhorias de Copy",
    trusted: "Usado por +1.200 anunciantes",
  },
  es: {
    hero: "Nota de tu anuncio\nen 10 segundos",
    sub: "IA analiza hook, copy y CTA. Nota de 1 a 10 con sugerencias de mejora.",
    analyzing: "Analizando tu creativo", drop: "Suelta aquí",
    drag_text: "Arrastra tu anuncio o haz clic para subir",
    formats: "PNG, JPG, WEBP — hasta 10 MB",
    positive_title: "Lo que funciona", improve_title: "Qué mejorar",
    signup_cta: "Ver análisis completo", signup_sub: "Gratis — sin tarjeta",
    rate_limit: "Límite alcanzado. Crea una cuenta para continuar.",
    error: "Error. Intenta de nuevo.",
    unlock_card: "Crea tu cuenta para ver todo",
    unlock_details: "Con una cuenta gratuita desbloqueas:",
    unlock_items: [
      "Análisis completo con acciones prácticas",
      "Sugerencias de CTA y mejoras de copy",
      "IA conectada a tus campañas reales",
    ],
    sp_count: 1247, sp_label: "anuncios analizados", sp_live: "analizando ahora", sp_live_count: 4,
    connect_title: "Conecta Meta Ads para resultados reales",
    connect_sub: "La IA analiza tus campañas en vivo — ROAS, CTR, creativos fatigados — y te dice qué pausar, escalar y testear.",
    connect_btn: "Conectar Meta Ads",
    connect_benefits: ["Alertas de ROAS en tiempo real", "Diagnóstico de creativos", "Recomendaciones personalizadas"],
    go_dashboard: "Ir al dashboard",
    share_result: "Compartir", link_copied: "¡Link copiado!",
    feat1: "Análisis de Hook", feat2: "Score de 1–10", feat3: "Sugerencias de CTA", feat4: "Mejoras de Copy",
    trusted: "Usado por +1.200 anunciantes",
  },
  en: {
    hero: "Rate your ad\nin 10 seconds",
    sub: "AI analyzes hook, copy and CTA. Score from 1 to 10 with improvement suggestions.",
    analyzing: "Analyzing your creative", drop: "Drop here",
    drag_text: "Drag your ad or click to upload",
    formats: "PNG, JPG, WEBP — up to 10 MB",
    positive_title: "What works", improve_title: "What to improve",
    signup_cta: "See full analysis", signup_sub: "Free — no card required",
    rate_limit: "Limit reached. Sign up to continue.",
    error: "Error. Try again.",
    unlock_card: "Create your account to see everything",
    unlock_details: "With a free account you unlock:",
    unlock_items: [
      "Full analysis with actionable steps",
      "CTA suggestions and copy improvements",
      "AI connected to your real campaigns",
    ],
    sp_count: 1247, sp_label: "ads analyzed", sp_live: "analyzing now", sp_live_count: 4,
    connect_title: "Connect Meta Ads for real results",
    connect_sub: "AI analyzes your live campaigns — ROAS, CTR, fatigued creatives — and tells you what to pause, scale and test.",
    connect_btn: "Connect Meta Ads",
    connect_benefits: ["Real-time ROAS alerts", "Creative diagnostics", "Personalized recommendations"],
    go_dashboard: "Go to dashboard",
    share_result: "Share", link_copied: "Link copied!",
    feat1: "Hook Analysis", feat2: "Score 1–10", feat3: "CTA Suggestions", feat4: "Copy Improvements",
    trusted: "Used by 1,200+ advertisers",
  },
};

type Phase = "upload" | "analyzing" | "result";
interface AnalysisResult {
  full: boolean; score: number; verdict: string; hook: string;
  message?: string; cta?: string; actions?: string[];
}

/* ── Keyframes ────────────────────────────────────────────────────── */
const KF = `
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes scanLine{0%{top:8%;opacity:0}15%{opacity:1}85%{opacity:1}100%{top:88%;opacity:0}}
@keyframes lockPulse{0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0.22)}50%{box-shadow:0 0 0 12px rgba(99,102,241,0)}}
@keyframes livePulse{0%,100%{opacity:1}50%{opacity:0.35}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes orbFloat1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(30px,-20px) scale(1.1)}66%{transform:translate(-20px,15px) scale(0.95)}}
@keyframes orbFloat2{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-25px,20px) scale(0.9)}66%{transform:translate(15px,-25px) scale(1.05)}}
@keyframes pulseRing{0%{transform:scale(0.9);opacity:0}40%{opacity:0.15}100%{transform:scale(2.5);opacity:0}}
@keyframes beamSweep{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
@keyframes scoreReveal{0%{transform:scale(0);opacity:0}50%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
@keyframes progressFill{from{width:0%}to{width:var(--fill-width)}}
@property --beam-angle{syntax:"<angle>";initial-value:0deg;inherits:false}
@keyframes beamSpin{to{--beam-angle:360deg}}
@media(max-width:700px){
  .demo-result-grid{flex-direction:column!important}
  .demo-result-grid>div{width:100%!important}
  .demo-feat-grid{grid-template-columns:1fr 1fr!important}
}
`;

/* ── Floating Particle Background ──────────────────────────────────── */
function ParticleField() {
  const particles = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * -20,
      opacity: Math.random() * 0.3 + 0.05,
    })), []
  );

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {particles.map(p => (
        <motion.div
          key={p.id}
          animate={{
            y: [0, -120, 0],
            x: [0, Math.random() * 40 - 20, 0],
            opacity: [p.opacity, p.opacity * 2, p.opacity],
          }}
          transition={{
            duration: p.duration, repeat: Infinity,
            ease: "easeInOut", delay: p.delay,
          }}
          style={{
            position: "absolute",
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size,
            borderRadius: "50%",
            background: `rgba(99,102,241,${p.opacity + 0.15})`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Live social proof bar ──────────────────────────────────────────── */
function LiveProof({ base, label, liveLabel, liveBase }: { base: number; label: string; liveLabel: string; liveBase: number }) {
  const [count, setCount] = useState(base);
  const [live, setLive] = useState(liveBase);
  useEffect(() => { const id = setInterval(() => setCount(p => p + 1), 4200 + Math.random() * 3000); return () => clearInterval(id); }, []);
  useEffect(() => { const id = setInterval(() => setLive(liveBase + Math.floor(Math.random() * 6) - 2), 6000 + Math.random() * 4000); return () => clearInterval(id); }, [liveBase]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, padding: "12px 0" }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontFamily: "'SF Mono', 'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
          {count.toLocaleString()}
        </span>
        <span style={{ fontFamily: F, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.35)" }}>{label}</span>
      </div>
      <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "livePulse 2s ease-in-out infinite", boxShadow: "0 0 8px rgba(34,197,94,0.5)" }} />
        <span style={{ fontFamily: F, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.35)" }}>
          <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{live}</span>{" "}{liveLabel}
        </span>
      </div>
    </motion.div>
  );
}

/* ── Score Ring — Animated circular score indicator ────────────────── */
function ScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const color = score >= 8 ? C.green : score >= 5 ? C.amber : C.red;
  const circumference = 2 * Math.PI * 38;
  const dashoffset = circumference - (score / 10) * circumference;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      {/* Pulse rings */}
      <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: `2px solid ${color}`, animation: "pulseRing 2.5s ease-out infinite", opacity: 0.15 }} />
      <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: `2px solid ${color}`, animation: "pulseRing 2.5s ease-out infinite 0.8s", opacity: 0.1 }} />
      <svg width={size} height={size} viewBox="0 0 88 88" style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        {/* Progress */}
        <motion.circle
          cx="44" cy="44" r="38" fill="none"
          stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashoffset }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.4 }}
          style={{ filter: `drop-shadow(0 0 8px ${color}80)` }}
        />
      </svg>
      {/* Number */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.7, type: "spring", stiffness: 300, damping: 20 }}
        style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}
      >
        <span style={{ fontFamily: F, fontSize: 32, fontWeight: 900, color, letterSpacing: "-0.04em", lineHeight: 1 }}>{score}</span>
        <span style={{ fontFamily: F, fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>/10</span>
      </motion.div>
    </motion.div>
  );
}

/* ── Feature Pill ──────────────────────────────────────────────────── */
function FeaturePill({ icon, label, delay }: { icon: React.ReactNode; label: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 16px", borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(8px)",
      }}
    >
      <span style={{ color: C.accent, display: "flex", alignItems: "center" }}>{icon}</span>
      <span style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "-0.01em" }}>{label}</span>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   DEMO PAGE — Premium v2
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

  /* ── Compress image ──────────────────────────────────────────────── */
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
    setAnalyzeProgress(0);
    trackEvent("demo_analysis_started");

    // Fake progress for UX
    const progressInterval = setInterval(() => {
      setAnalyzeProgress(p => {
        if (p >= 90) { clearInterval(progressInterval); return 90; }
        return p + Math.random() * 12 + 3;
      });
    }, 400);

    try {
      const { base64, mediaType } = await compressImage(file);
      const { data, error } = await supabase.functions.invoke("analyze-demo", {
        body: { image_base64: base64, media_type: mediaType, lang },
      });
      clearInterval(progressInterval);
      setAnalyzeProgress(100);
      console.log("[Demo] Raw response:", JSON.stringify(data));
      if (error) { console.error("[Demo] Invoke error:", error); throw error; }

      const parsed = handleDemoResponse(data);
      if (!parsed) return;

      if (!parsed.hook && !parsed.verdict) {
        parsed.hook = lang === "pt" ? "Análise processada." : lang === "es" ? "Análisis procesado." : "Analysis processed.";
        parsed.verdict = lang === "pt" ? "Resultado" : lang === "es" ? "Resultado" : "Result";
        if (!parsed.score) parsed.score = 5;
      }
      if (parsed.verdict) parsed.verdict = parsed.verdict.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]/gu, "").trim();

      // Small delay so the user sees 100%
      await new Promise(r => setTimeout(r, 300));

      setResult(parsed);
      setPhase("result");
      trackEvent("demo_analysis_completed", { score: parsed.score });

      try { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ result: parsed, preview: previewRef.current })); } catch {}
    } catch (e) {
      clearInterval(progressInterval);
      console.error("[Demo] Analysis error:", e);
      toast.error(t.error);
      setPhase("upload");
    }
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) analyze(f); };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) analyze(f); };
  const scoreColor = (s: number) => s >= 8 ? C.green : s >= 5 ? C.amber : C.red;

  /* ── Share result ────────────────────────────────────────────────── */
  const handleShare = async () => {
    if (!result) return;
    setSharing(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/demo-share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis_score: result.score, analysis_result: result, lang }),
      });
      if (!response.ok) { toast.error(t.error); setSharing(false); return; }
      const data = await response.json();
      if (!data.share_id) { toast.error(t.error); setSharing(false); return; }
      const shareUrl = `${window.location.origin}/s/${data.share_id}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareButtonState("copied");
        toast.success(t.link_copied);
        setTimeout(() => setShareButtonState("idle"), 2000);
      } catch { toast.success(`Share URL: ${shareUrl}`); }
    } catch { toast.error(t.error); } finally { setSharing(false); }
  };

  /* ══════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: F, position: "relative", overflow: "hidden" }}>
      <style>{KF}</style>

      {/* ── Animated background ── */}
      <ParticleField />

      {/* ── Ambient orbs ── */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.06, 0.1, 0.06] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "fixed", top: "-15%", left: "50%", transform: "translateX(-50%)",
          width: 900, height: 600, borderRadius: "50%",
          background: `radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)`,
          filter: "blur(80px)", pointerEvents: "none", zIndex: 0,
        }}
      />
      <motion.div
        style={{
          position: "fixed", bottom: "-20%", left: "-10%",
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.06), transparent 70%)",
          filter: "blur(60px)", pointerEvents: "none", zIndex: 0,
          animation: "orbFloat1 20s ease-in-out infinite",
        }}
      />
      <motion.div
        style={{
          position: "fixed", top: "30%", right: "-10%",
          width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(14,165,233,0.05), transparent 70%)",
          filter: "blur(60px)", pointerEvents: "none", zIndex: 0,
          animation: "orbFloat2 18s ease-in-out infinite",
        }}
      />

      {/* ── Nav ── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          position: "sticky", top: 0, zIndex: 50,
          borderBottom: `1px solid rgba(255,255,255,0.05)`,
          background: "rgba(5,5,8,0.7)", backdropFilter: "blur(24px) saturate(1.5)",
          padding: "14px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <Link to="/"><Logo size="lg" /></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LanguageSwitcher />
          <motion.button
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/signup?redirect=" + encodeURIComponent("/dashboard/ai?from_demo=1"))}
            style={{
              fontFamily: F, fontSize: 13, fontWeight: 700,
              padding: "9px 22px", borderRadius: 10,
              background: "linear-gradient(135deg, #fff, #e2e8f0)",
              color: "#0a0a0a", border: "none", cursor: "pointer",
              boxShadow: "0 2px 12px rgba(255,255,255,0.1)",
            }}
          >
            {t.signup_cta}
          </motion.button>
        </div>
      </motion.nav>

      {/* ── Main container ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", padding: "48px 20px 80px" }}>

        <AnimatePresence mode="wait">
          {/* ════════════════════════════════════════════════════════════════
              PHASE: UPLOAD
          ════════════════════════════════════════════════════════════════ */}
          {phase === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {/* Hero */}
              <div style={{ textAlign: "center", marginBottom: 44 }}>
                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", borderRadius: 20,
                    background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.15)",
                    marginBottom: 24,
                  }}
                >
                  <Sparkles size={13} color={C.accent} />
                  <span style={{ fontFamily: F, fontSize: 11.5, fontWeight: 600, color: C.accent, letterSpacing: "-0.01em" }}>
                    AI-Powered Ad Analysis
                  </span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  style={{
                    fontFamily: F, fontWeight: 900,
                    fontSize: "clamp(28px, 6.5vw, 46px)",
                    letterSpacing: "-0.04em", lineHeight: 1.06,
                    marginBottom: 16, whiteSpace: "pre-line",
                    background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 50%, #fff 100%)",
                    backgroundSize: "200% auto",
                    animation: "gradientShift 5s ease infinite",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {t.hero}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.4 }}
                  style={{
                    fontFamily: F, fontSize: 16, fontWeight: 400,
                    color: TEXT_MUTED, lineHeight: 1.55,
                    maxWidth: 380, margin: "0 auto",
                  }}
                >
                  {t.sub}
                </motion.p>
              </div>

              {/* Feature pills */}
              <div className="demo-feat-grid" style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 8, marginBottom: 32,
              }}>
                <FeaturePill icon={<Eye size={14} />} label={t.feat1} delay={0.4} />
                <FeaturePill icon={<TrendingUp size={14} />} label={t.feat2} delay={0.5} />
                <FeaturePill icon={<MessageSquare size={14} />} label={t.feat3} delay={0.6} />
                <FeaturePill icon={<Sparkles size={14} />} label={t.feat4} delay={0.7} />
              </div>

              {/* Rate Limited */}
              {rateLimited && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    textAlign: "center", padding: "28px 24px", borderRadius: 20,
                    border: `1px solid rgba(239,68,68,0.2)`,
                    background: "rgba(239,68,68,0.06)",
                    backdropFilter: "blur(12px)",
                    marginBottom: 28,
                  }}
                >
                  <p style={{ fontFamily: F, fontSize: 14, fontWeight: 500, color: C.red, marginBottom: 16 }}>{t.rate_limit}</p>
                  <motion.button
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate("/signup?redirect=" + encodeURIComponent("/dashboard/ai?from_demo=1"))}
                    style={{
                      fontFamily: F, fontSize: 14, fontWeight: 700,
                      padding: "12px 28px", borderRadius: 12,
                      background: C.text, color: C.bg,
                      border: "none", cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}
                  >
                    {t.signup_cta} <ArrowRight size={14} />
                  </motion.button>
                </motion.div>
              )}

              {/* Upload Zone */}
              {!rateLimited && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  whileHover={{ borderColor: "rgba(99,102,241,0.3)", background: "rgba(255,255,255,0.045)" }}
                  style={{
                    position: "relative", borderRadius: 24,
                    background: dragOver ? "rgba(99,102,241,0.06)" : "rgba(255,255,255,0.025)",
                    border: `1.5px dashed ${dragOver ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)"}`,
                    padding: "clamp(48px, 8vw, 64px) clamp(20px, 5vw, 32px)",
                    textAlign: "center", cursor: "pointer",
                    transition: "border-color 0.3s, background 0.3s",
                    overflow: "hidden",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  {/* Beam border */}
                  <div style={{
                    position: "absolute", inset: -2, borderRadius: 26, padding: 2,
                    background: dragOver
                      ? "rgba(99,102,241,0.4)"
                      : `conic-gradient(from var(--beam-angle), transparent 0%, transparent 70%, rgba(99,102,241,0.3) 80%, rgba(139,92,246,0.2) 90%, transparent 100%)`,
                    animation: dragOver ? "none" : "beamSpin 4s linear infinite",
                    WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "xor",
                    maskComposite: "exclude" as any,
                    pointerEvents: "none",
                  }} />

                  {/* Inner glow */}
                  <div style={{
                    position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                    width: 200, height: 200, borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(99,102,241,0.06), transparent 70%)",
                    pointerEvents: "none",
                  }} />

                  <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />

                  <motion.div
                    animate={dragOver ? { scale: 1.15, y: -4 } : { scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    style={{
                      width: 64, height: 64, borderRadius: 18,
                      background: dragOver ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${dragOver ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.08)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 20px",
                      transition: "background 0.3s, border-color 0.3s",
                    }}
                  >
                    <Upload size={26} color={dragOver ? C.accent : "rgba(255,255,255,0.35)"} strokeWidth={1.5} />
                  </motion.div>

                  <p style={{
                    fontFamily: F, fontSize: 16, fontWeight: 700,
                    color: dragOver ? C.text : "rgba(255,255,255,0.75)",
                    marginBottom: 6, letterSpacing: "-0.02em",
                    transition: "color 0.2s", position: "relative",
                  }}>
                    {dragOver ? t.drop : t.drag_text}
                  </p>
                  <p style={{ fontFamily: F, fontSize: 12.5, fontWeight: 400, color: C.textMuted, position: "relative" }}>
                    {t.formats}
                  </p>
                </motion.div>
              )}

              {/* Social proof */}
              {!rateLimited && (
                <LiveProof base={t.sp_count} label={t.sp_label} liveLabel={t.sp_live} liveBase={t.sp_live_count} />
              )}

              {/* Trusted badge */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                style={{ textAlign: "center", marginTop: 4 }}
              >
                <span style={{ fontFamily: F, fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.2)" }}>
                  {t.trusted}
                </span>
              </motion.div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              PHASE: ANALYZING
          ════════════════════════════════════════════════════════════════ */}
          {phase === "analyzing" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
              transition={{ duration: 0.4 }}
              style={{ textAlign: "center", padding: "40px 24px" }}
            >
              {preview && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  style={{
                    position: "relative", display: "inline-block", marginBottom: 40,
                    borderRadius: 20, overflow: "hidden",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.1)",
                  }}
                >
                  <img src={preview} alt="Ad" style={{
                    maxWidth: 240, maxHeight: 200, borderRadius: 20,
                    border: `1px solid rgba(255,255,255,0.1)`, objectFit: "cover", display: "block",
                  }} />
                  {/* Scanning overlay */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(180deg, rgba(99,102,241,0.08), transparent, rgba(99,102,241,0.08))",
                  }} />
                  {/* Scan line */}
                  <div style={{
                    position: "absolute", left: 8, right: 8, height: 2,
                    background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
                    animation: "scanLine 2.2s ease-in-out infinite", borderRadius: 1,
                    boxShadow: `0 0 12px ${C.accent}60`,
                  }} />
                  {/* Corner markers */}
                  {[
                    { top: 8, left: 8, borderTop: `2px solid ${C.accent}`, borderLeft: `2px solid ${C.accent}` },
                    { top: 8, right: 8, borderTop: `2px solid ${C.accent}`, borderRight: `2px solid ${C.accent}` },
                    { bottom: 8, left: 8, borderBottom: `2px solid ${C.accent}`, borderLeft: `2px solid ${C.accent}` },
                    { bottom: 8, right: 8, borderBottom: `2px solid ${C.accent}`, borderRight: `2px solid ${C.accent}` },
                  ].map((s, i) => (
                    <div key={i} style={{ position: "absolute", width: 16, height: 16, ...s, borderRadius: 2 } as any} />
                  ))}
                </motion.div>
              )}

              {/* Progress bar */}
              <div style={{
                maxWidth: 280, margin: "0 auto 20px",
                height: 4, borderRadius: 4,
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}>
                <motion.div
                  animate={{ width: `${Math.min(analyzeProgress, 100)}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  style={{
                    height: "100%", borderRadius: 4,
                    background: `linear-gradient(90deg, ${C.accent}, #8b5cf6)`,
                    boxShadow: `0 0 12px ${C.accent}40`,
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%",
                  border: `2px solid rgba(255,255,255,0.08)`, borderTopColor: C.accent,
                  animation: "spin 0.7s linear infinite",
                }} />
                <span style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: C.textSoft }}>
                  {t.analyzing}...
                </span>
                <span style={{
                  fontFamily: "'SF Mono', monospace", fontSize: 12, fontWeight: 600,
                  color: C.accent, fontVariantNumeric: "tabular-nums",
                }}>
                  {Math.round(Math.min(analyzeProgress, 100))}%
                </span>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              PHASE: RESULT
          ════════════════════════════════════════════════════════════════ */}
          {phase === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {/* Score header — Glass card */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                style={{
                  display: "flex", gap: 20, alignItems: "center",
                  marginBottom: 20, padding: "24px 28px",
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.03)",
                  backdropFilter: "blur(20px) saturate(1.4)",
                  border: `1px solid rgba(255,255,255,0.07)`,
                  boxShadow: "0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                {/* Score Ring */}
                <ScoreRing score={result.score} size={88} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    style={{
                      fontFamily: F, fontSize: 18, fontWeight: 800,
                      color: scoreColor(result.score), letterSpacing: "-0.02em",
                      marginBottom: 4,
                    }}
                  >
                    {result.verdict}
                  </motion.p>
                  {preview && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                      style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}
                    >
                      <img src={preview} alt="Ad" style={{
                        width: 36, height: 36, borderRadius: 8,
                        border: `1px solid ${C.border}`, objectFit: "cover",
                      }} />
                      {/* Share button */}
                      <motion.button
                        whileHover={{ scale: 1.05, borderColor: C.accent }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleShare}
                        disabled={sharing}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "6px 14px", borderRadius: 10,
                          background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
                          color: C.textMuted, fontSize: 12, fontWeight: 600, fontFamily: F,
                          cursor: sharing ? "not-allowed" : "pointer",
                          transition: "all 0.2s", opacity: sharing ? 0.5 : 1,
                        }}
                      >
                        {shareButtonState === "copied" ? <><Check size={11} /> {t.link_copied}</> :
                          sharing ? <><Loader2 size={11} style={{ animation: "spin 0.8s linear infinite" }} /></> :
                          <><Share2 size={11} /> {t.share_result}</>}
                      </motion.button>
                    </motion.div>
                  )}
                </div>
              </motion.div>

              {/* Two-column cards */}
              <div className="demo-result-grid" style={{ display: "flex", gap: 14, alignItems: "stretch" }}>

                {/* LEFT — What works */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  style={{
                    flex: 1, minWidth: 0, borderRadius: 20, padding: "22px 22px",
                    background: "rgba(255,255,255,0.03)",
                    backdropFilter: "blur(16px)",
                    border: `1px solid rgba(34,197,94,0.12)`,
                    borderTop: `3px solid ${C.green}`,
                    boxShadow: "0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <CheckCircle2 size={14} color={C.green} strokeWidth={2.5} />
                    </div>
                    <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: C.green, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                      {t.positive_title}
                    </span>
                  </div>
                  <p style={{ fontFamily: F, fontSize: 13.5, fontWeight: 400, color: "rgba(255,255,255,0.72)", lineHeight: 1.75 }}>
                    {result.hook}
                  </p>
                </motion.div>

                {/* RIGHT — What to improve (locked or open) */}
                {!result.full ? (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    onClick={() => navigate("/signup?redirect=" + encodeURIComponent("/dashboard/ai?from_demo=1"))}
                    whileHover={{ borderColor: "rgba(99,102,241,0.25)" }}
                    style={{
                      flex: 1, minWidth: 0, position: "relative", borderRadius: 20,
                      padding: "22px 22px",
                      background: "rgba(255,255,255,0.03)",
                      backdropFilter: "blur(16px)",
                      border: `1px solid rgba(99,102,241,0.1)`,
                      borderTop: `3px solid ${C.accent}`,
                      cursor: "pointer", overflow: "hidden", minHeight: 140,
                      boxShadow: "0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.03)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <AlertTriangle size={14} color={C.accent} strokeWidth={2.5} />
                      </div>
                      <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: C.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        {t.improve_title}
                      </span>
                    </div>
                    {/* Blurred placeholder */}
                    <div style={{ filter: "blur(5px)", userSelect: "none", pointerEvents: "none" }}>
                      <div style={{ height: 10, width: "90%", borderRadius: 4, background: "rgba(255,255,255,0.07)", marginBottom: 10 }} />
                      <div style={{ height: 10, width: "72%", borderRadius: 4, background: "rgba(255,255,255,0.05)", marginBottom: 10 }} />
                      <div style={{ height: 10, width: "80%", borderRadius: 4, background: "rgba(255,255,255,0.06)" }} />
                    </div>
                    {/* Lock overlay */}
                    <div style={{
                      position: "absolute", inset: 0,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      background: "rgba(5,5,8,0.5)", backdropFilter: "blur(4px)",
                    }}>
                      <motion.div
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        style={{
                          width: 44, height: 44, borderRadius: 13,
                          border: `1px solid rgba(99,102,241,0.3)`,
                          background: "rgba(99,102,241,0.06)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          marginBottom: 10,
                          boxShadow: "0 0 20px rgba(99,102,241,0.15)",
                        }}
                      >
                        <Lock size={18} color={C.accent} strokeWidth={1.8} />
                      </motion.div>
                      <span style={{ fontFamily: F, fontSize: 12.5, fontWeight: 700, color: C.text }}>{t.unlock_card}</span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    style={{
                      flex: 1, minWidth: 0, borderRadius: 20, padding: "22px 22px",
                      background: "rgba(255,255,255,0.03)",
                      backdropFilter: "blur(16px)",
                      border: `1px solid rgba(99,102,241,0.12)`,
                      borderTop: `3px solid ${C.accent}`,
                      boxShadow: "0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.03)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <AlertTriangle size={14} color={C.accent} strokeWidth={2.5} />
                      </div>
                      <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: C.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        {t.improve_title}
                      </span>
                    </div>
                    <p style={{ fontFamily: F, fontSize: 13.5, fontWeight: 400, color: "rgba(255,255,255,0.72)", lineHeight: 1.75, marginBottom: 14 }}>
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
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.6 + i * 0.1 }}
                            style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}
                          >
                            <span style={{
                              fontFamily: F, fontSize: 10, fontWeight: 800,
                              color: C.accent, marginTop: 3, flexShrink: 0,
                              width: 18, height: 18, borderRadius: 6,
                              background: "rgba(99,102,241,0.1)",
                              border: `1px solid rgba(99,102,241,0.2)`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>{i + 1}</span>
                            <p style={{ fontFamily: F, fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{action}</p>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              {/* CTA section */}
              {!result.full && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  style={{
                    marginTop: 20, padding: "28px 24px", borderRadius: 24,
                    background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.03))",
                    border: `1px solid rgba(99,102,241,0.1)`,
                    backdropFilter: "blur(16px)",
                    textAlign: "center",
                    boxShadow: "0 8px 40px rgba(99,102,241,0.06)",
                  }}
                >
                  <p style={{ fontFamily: F, fontSize: 13.5, fontWeight: 500, color: C.textSoft, marginBottom: 18 }}>
                    {t.unlock_details}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 22 }}>
                    {t.unlock_items.map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.8 + i * 0.1 }}
                        style={{
                          display: "flex", alignItems: "center", gap: 7,
                          padding: "7px 14px", borderRadius: 24,
                          background: "rgba(255,255,255,0.04)",
                          border: `1px solid rgba(255,255,255,0.06)`,
                          backdropFilter: "blur(8px)",
                        }}
                      >
                        <CheckCircle2 size={12} color={C.green} strokeWidth={2.5} />
                        <span style={{ fontFamily: F, fontSize: 11.5, fontWeight: 500, color: "rgba(255,255,255,0.75)" }}>{item}</span>
                      </motion.div>
                    ))}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.03, y: -2, boxShadow: "0 4px 40px rgba(255,255,255,0.18)" }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate("/signup?redirect=" + encodeURIComponent("/dashboard/ai?from_demo=1"))}
                    style={{
                      fontFamily: F, fontSize: 15, fontWeight: 800,
                      padding: "15px 44px", borderRadius: 14,
                      background: "linear-gradient(135deg, #fff, #e2e8f0)",
                      color: "#0a0a0a", border: "none", cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 8,
                      boxShadow: "0 2px 32px rgba(255,255,255,0.1)",
                      position: "relative", overflow: "hidden",
                    }}
                  >
                    {/* Shine sweep */}
                    <motion.div
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
                      style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.15), transparent)",
                      }}
                    />
                    <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {t.signup_cta} <ArrowRight size={15} />
                    </span>
                  </motion.button>
                  <p style={{ fontFamily: F, fontSize: 11, fontWeight: 400, color: C.textMuted, marginTop: 10 }}>
                    {t.signup_sub}
                  </p>
                </motion.div>
              )}

              {/* Connect Meta Ads CTA */}
              {result.full && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  style={{
                    marginTop: 20, padding: "28px 24px", borderRadius: 24,
                    background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.04))",
                    border: `1px solid rgba(99,102,241,0.12)`,
                    backdropFilter: "blur(16px)",
                    boxShadow: "0 8px 40px rgba(99,102,241,0.06)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Plug size={18} color={C.accent} strokeWidth={1.8} />
                    </div>
                    <h3 style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: C.text, margin: 0, letterSpacing: "-0.025em" }}>
                      {t.connect_title}
                    </h3>
                  </div>
                  <p style={{ fontFamily: F, fontSize: 13.5, fontWeight: 400, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, marginBottom: 16 }}>
                    {t.connect_sub}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                    {t.connect_benefits.map((b, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 14px", borderRadius: 24,
                        background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.06)`,
                      }}>
                        <Zap size={11} color={C.accent} strokeWidth={2.5} />
                        <span style={{ fontFamily: F, fontSize: 11.5, fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>{b}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <motion.button
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => navigate("/dashboard/ai")}
                      style={{
                        fontFamily: F, fontSize: 14, fontWeight: 700,
                        padding: "13px 28px", borderRadius: 12,
                        background: "linear-gradient(135deg, #fff, #e2e8f0)", color: "#0a0a0a",
                        border: "none", cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: 8,
                        boxShadow: "0 2px 20px rgba(255,255,255,0.08)",
                      }}
                    >
                      {t.connect_btn} <ArrowRight size={14} />
                    </motion.button>
                    <motion.button
                      whileHover={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.8)" }}
                      onClick={() => navigate("/dashboard/ai")}
                      style={{
                        fontFamily: F, fontSize: 13, fontWeight: 600,
                        padding: "13px 20px", borderRadius: 12,
                        background: "transparent", color: "rgba(255,255,255,0.5)",
                        border: `1px solid ${C.border}`, cursor: "pointer",
                      }}
                    >
                      {t.go_dashboard}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Live social proof */}
              <div style={{ marginTop: 16 }}>
                <LiveProof base={t.sp_count} label={t.sp_label} liveLabel={t.sp_live} liveBase={t.sp_live_count} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
