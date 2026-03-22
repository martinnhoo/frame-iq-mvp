import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { useState, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { extractAudioFromFile, needsExtraction, MAX_WHISPER_SIZE } from "@/lib/audioExtractor";
import { toast } from "sonner";
import { PersonaWarningModal } from "@/components/dashboard/PersonaWarningModal";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashT } from "@/i18n/dashboardTranslations";
import {
  Plane, Loader2, CheckCircle, AlertTriangle, XCircle,
  ChevronDown, Clock, BarChart2, Zap, Shield, MessageSquare,
  RefreshCw, Copy, Check, ArrowRight, TrendingUp, AlertCircle,
  Sparkles, Upload, FileVideo, FileText, X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusType = "STRONG" | "SOLID" | "OPTIMAL" | "GOOD" | "CLEAR" | "NEEDS_WORK" | "SUGGESTION" | "FLAG" | "REVIEW" | "WEAK" | "ERROR" | "CRITICAL" | "BLOCKED" | "POOR";
type Verdict = "READY" | "REVIEW" | "BLOCKED";

interface HookAnalysis {
  text: string; type: string; score: number;
  status: StatusType; detail: string; rewrite: string | null;
}
interface StructureRow { segment: string; status: StatusType; detail: string; }
interface ComplianceRow { rule: string; status: "CLEAR" | "SUGGESTION" | "FLAG" | "REVIEW" | "BLOCKED"; detail: string; }
interface PlatformFitRow { platform: string; status: StatusType; detail: string; }
interface LanguageIssue { found: string; issue: string; fix: string; }
interface CTACheck { text: string; status: StatusType; platform_compliant: boolean; detail: string; suggestion: string | null; }

interface PreflightResult {
  score: number;
  verdict: Verdict;
  verdict_reason: string;
  hook_analysis: HookAnalysis;
  structure: StructureRow[];
  compliance: ComplianceRow[];
  platform_fit: { primary: PlatformFitRow; crosspost: PlatformFitRow[] };
  language_check: { status: StatusType; issues: LanguageIssue[] };
  cta_check: CTACheck;
  top_fixes: string[];
  strengths: string[];
  estimated_hook_score: number;
  word_count: number;
  reading_time_seconds: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { value: "tiktok",         label: "TikTok",          emoji: "🎵" },
  { value: "reels",          label: "Instagram Reels", emoji: "📸" },
  { value: "facebook",       label: "Facebook",        emoji: "📘" },
  { value: "youtube_shorts", label: "YouTube Shorts",  emoji: "▶️" },
  { value: "google_uac",     label: "Google UAC",      emoji: "🔍" },
];

const MARKETS = [
  { value: "BR", flag: "🇧🇷", label: "Brazil" },
  { value: "MX", flag: "🇲🇽", label: "Mexico" },
  { value: "IN", flag: "🇮🇳", label: "India" },
  { value: "US", flag: "🇺🇸", label: "United States" },
  { value: "GB", flag: "🇬🇧", label: "United Kingdom" },
  { value: "AR", flag: "🇦🇷", label: "Argentina" },
  { value: "CO", flag: "🇨🇴", label: "Colombia" },
  { value: "GLOBAL", flag: "🌐", label: "Global" },
];

const FORMATS = [
  "UGC", "Testimonial", "Tutorial", "Problem-Solution",
  "Before-After", "Direct Response", "Faceless", "Founder",
];

const DURATIONS = ["15", "30", "60", "90"];

const STATUS_CFG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  STRONG:     { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.3)",  icon: <CheckCircle className="h-3 w-3" /> },
  SOLID:      { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.3)",  icon: <CheckCircle className="h-3 w-3" /> },
  OPTIMAL:    { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.3)",  icon: <CheckCircle className="h-3 w-3" /> },
  GOOD:       { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.3)",  icon: <CheckCircle className="h-3 w-3" /> },
  CLEAR:      { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.3)",  icon: <CheckCircle className="h-3 w-3" /> },
  NEEDS_WORK: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)",  icon: <AlertTriangle className="h-3 w-3" /> },
  SUGGESTION: { color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.3)",  icon: <AlertTriangle className="h-3 w-3" /> },
  FLAG:       { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)",  icon: <AlertTriangle className="h-3 w-3" /> },
  // Legacy fallbacks (API may still return these occasionally)
  REVIEW:     { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)",  icon: <AlertTriangle className="h-3 w-3" /> },
  WEAK:       { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)",  icon: <AlertTriangle className="h-3 w-3" /> },
  ERROR:      { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)",  icon: <AlertTriangle className="h-3 w-3" /> },
  CRITICAL:   { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)",  icon: <AlertTriangle className="h-3 w-3" /> },
  BLOCKED:    { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)", icon: <XCircle className="h-3 w-3" /> },
  POOR:       { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)",  icon: <AlertTriangle className="h-3 w-3" /> },
};

const VERDICT_CFG = {
  READY:   { color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)",  label: "READY TO PRODUCE" },
  REVIEW:  { color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",  label: "REVIEW SUGGESTIONS" },
  BLOCKED: { color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)", label: "NEEDS FIXING" },
};

const mono = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" } as const;
const jakarta = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 } as const;

// ── Sub-components ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  STRONG: "Strong", SOLID: "Solid", OPTIMAL: "Optimal", GOOD: "Good", CLEAR: "Clear",
  NEEDS_WORK: "Suggestion", SUGGESTION: "Tip", FLAG: "Note",
  // Legacy
  REVIEW: "Suggestion", WEAK: "Suggestion", ERROR: "Note",
  CRITICAL: "Suggestion", POOR: "Suggestion", BLOCKED: "Issue",
};

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG.NEEDS_WORK;
  const label = STATUS_LABELS[status] || status;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border, ...mono }}>
      {cfg.icon}{label}
    </span>
  );
};

const ScoreRing = ({ score, color }: { score: number; color: string }) => (
  <div className="relative h-16 w-16 shrink-0">
    <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
      <circle cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${(score / 100) * 163} 163`}
        strokeLinecap="round" style={{ transition: "stroke-dasharray 0.8s ease" }} />
    </svg>
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-lg font-bold" style={{ color, ...mono }}>{score}</span>
    </div>
  </div>
);

const CopyBtn = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-all"
      style={{ background: "rgba(255,255,255,0.05)", color: copied ? "#34d399" : "rgba(255,255,255,0.35)" }}>
      {copied ? <><Check className="h-3 w-3" />Copied</> : <><Copy className="h-3 w-3" />Copy</>}
    </button>
  );
};

const SectionHeader = ({ label, icon }: { label: string; icon: React.ReactNode }) => (
  <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
    <span style={{ color: "rgba(255,255,255,0.3)" }}>{icon}</span>
    <span className="text-[10px] uppercase tracking-[0.2em]" style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>{label}</span>
  </div>
);

// ── Select ────────────────────────────────────────────────────────────────────

const Select = ({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; emoji?: string; flag?: string }[];
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm transition-all"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}>
        <span className="flex items-center gap-2">
          {(selected?.emoji || selected?.flag) && <span>{selected.emoji || selected.flag}</span>}
          <span style={mono}>{selected?.label}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-white/50" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-30 w-full rounded-xl border overflow-hidden shadow-2xl"
          style={{ background: "#0d0d0d", borderColor: "rgba(255,255,255,0.1)" }}>
          {options.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
              style={{ color: o.value === value ? "#fff" : "rgba(255,255,255,0.45)", background: o.value === value ? "rgba(255,255,255,0.07)" : "transparent" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = o.value === value ? "rgba(255,255,255,0.07)" : "transparent"; }}>
              {(o.emoji || o.flag) && <span>{o.emoji || o.flag}</span>}
              <span style={mono}>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function PreflightCheck() {
  const { user, selectedPersona } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const t = useDashT(language);

  const [script, setScript] = useState("");
  const [hook, setHook] = useState("");
  const [cta, setCta] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [market, setMarket] = useState("BR");
  const [duration, setDuration] = useState("30");
  const [format, setFormat] = useState("UGC");
  const [product, setProduct] = useState("");
  const [complianceNotes, setComplianceNotes] = useState("");
  const [funnelStage, setFunnelStage] = useState("tofu");
  const [showPersonaWarning, setShowPersonaWarning] = useState(false);
  const [pendingRun, setPendingRun] = useState(false);

  // Input mode — "script" or "video"
  const [inputMode, setInputMode] = useState<"script" | "video">("script");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const estimatedSeconds = Math.round(wordCount / 2.5);

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("video/")) { setVideoFile(f); }
    else toast.error("Please drop a video file (MP4, MOV, AVI, WebM)");
  };

  const run = async () => {
    if (inputMode === "script" && !script.trim()) { toast.error(t("pf_toast_no_script")); return; }
    if (inputMode === "video" && !videoFile) { toast.error(t("pf_toast_no_video")); return; }

    // Warn if no persona selected
    if (!selectedPersona && !pendingRun) {
      setShowPersonaWarning(true);
      return;
    }
    setPendingRun(false);

    setLoading(true);
    setResult(null);
    try {
      let data: PreflightResult & { transcribed_from_video?: boolean; video_filename?: string; transcription_note?: string | null };

      if (inputMode === "video" && videoFile) {
        // Extract audio client-side first (converts MOV/AVI/etc → WAV)
        let fileToSend: File = videoFile;
        if (needsExtraction(videoFile)) {
          try {
            fileToSend = await extractAudioFromFile(videoFile);
            if (fileToSend.size > MAX_WHISPER_SIZE) {
              toast.error(`Audio too large (${(fileToSend.size / 1024 / 1024).toFixed(1)}MB). Try a shorter video.`);
              setLoading(false);
              return;
            }
          } catch (err: any) {
            toast.error(err.message || "Could not extract audio");
            setLoading(false);
            return;
          }
        }

        // FormData mode for video upload
        const formData = new FormData();
        formData.append("video_file", fileToSend);
        formData.append("platform", platform);
        formData.append("market", market);
        formData.append("duration", duration);
        formData.append("format", format);
        formData.append("product", product);
        formData.append("compliance_notes", complianceNotes);
        formData.append("hook", hook);
        formData.append("cta", cta);
        formData.append("funnel_stage", funnelStage);
        if (selectedPersona) formData.append("persona_context", JSON.stringify(selectedPersona));
        if (user?.id) formData.append("user_id", user.id);

        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-preflight`,
          { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || "Request failed");
        }
        data = await res.json();
      } else {
        // JSON mode for script text
        const { data: d, error } = await supabase.functions.invoke("run-preflight", {
          body: { user_id: user?.id, script, hook, cta, platform, market, duration, format, product, compliance_notes: complianceNotes, funnel_stage: funnelStage, persona_context: selectedPersona || undefined },
        });
        if (error) throw error;
        if (d?.error) throw new Error(d.error);
        data = d;
      }

      setResult(data);
      // If video was transcribed, populate the script field
      if (data.transcribed_from_video && (data as { transcript?: string }).transcript) {
        setScript((data as { transcript?: string }).transcript || "");
      }
      toast.success(t("pf_toast_done"));
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not configured") || msg.includes("API_KEY")) {
        toast.error("Add ANTHROPIC_API_KEY (and OPENAI_API_KEY for video) to Supabase secrets.");
      } else {
        toast.error("Pre-flight failed — " + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const verdictCfg = result ? VERDICT_CFG[result.verdict] : null;

  return (
    <div className="min-h-screen" style={{ background: "#050508" }}>
      <PersonaWarningModal
        open={showPersonaWarning}
        onClose={() => setShowPersonaWarning(false)}
        toolName="Pre-flight Check"
        onContinue={() => { setShowPersonaWarning(false); setPendingRun(true); setTimeout(run, 50); }}
      />
      <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2" style={syne}>
              <div className="h-8 w-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)" }}>
                <Plane className="h-4 w-4" style={{ color: "#fbbf24" }} />
              </div>
              {t("pf_title")}
            </h1>
            <p className="text-white/50 text-xs mt-1" style={mono}>
              {t("pf_subtitle")}
            </p>
          </div>
          {result && verdictCfg && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0"
              style={{ background: verdictCfg.bg, borderColor: verdictCfg.border, color: verdictCfg.color }}>
              {result.verdict === "READY" ? <CheckCircle className="h-4 w-4" /> :
               result.verdict === "BLOCKED" ? <XCircle className="h-4 w-4" /> :
               <AlertTriangle className="h-4 w-4" />}
              <span className="text-xs font-bold" style={mono}>{verdictCfg.label}</span>
            </div>
          )}
        </div>

        {/* ── Input panel ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#0a0a0d", border: "1px solid rgba(255,255,255,0.07)" }}>

          {/* Mode toggle */}
          <div className="flex items-center gap-1 p-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            {[
              { mode: "script" as const, label: t("pf_script"), icon: <FileText className="h-3.5 w-3.5" /> },
              { mode: "video" as const,  label: t("pf_video"),  icon: <FileVideo className="h-3.5 w-3.5" /> },
            ].map(({ mode, label, icon }) => (
              <button key={mode} onClick={() => setInputMode(mode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={inputMode === mode
                  ? { background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }
                  : { background: "transparent", color: "rgba(255,255,255,0.3)", border: "1px solid transparent" }}>
                {icon}{label}
              </button>
            ))}
            <span className="ml-2 text-[10px] text-white/40" style={mono}>
              {inputMode === "video" ? "Whisper → Claude" : t("pf_script") + " → Claude"}
            </span>
          </div>

          {inputMode === "script" ? (
            /* Script mode */
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-[0.18em] text-white/50" style={mono}>{t("pf_script_label")} *</label>
                <span className="text-[10px]" style={{ ...mono, color: "rgba(255,255,255,0.2)" }}>
                  {wordCount}w · ~{estimatedSeconds}s
                </span>
              </div>
              <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder={{t("pf_script_ph")}}
                rows={7}
                className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none transition-colors leading-relaxed"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#fff", ...mono }}
                onFocus={e => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = "rgba(251,191,36,0.3)"; }}
                onBlur={e => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
              />
            </div>
          ) : (
            /* Video mode */
            <div className="p-4">
              {videoFile ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <FileVideo className="h-5 w-5 shrink-0" style={{ color: "#34d399" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate" style={mono}>{videoFile.name}</p>
                    <p className="text-[10px] text-white/50" style={mono}>{(videoFile.size / 1024 / 1024).toFixed(1)} MB · Whisper</p>
                  </div>
                  <button onClick={() => setVideoFile(null)} className="h-6 w-6 rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleVideoDrop}
                  onClick={() => document.getElementById("pf-video-input")?.click()}
                  className="flex flex-col items-center justify-center py-10 rounded-xl cursor-pointer transition-all"
                  style={{
                    border: `2px dashed ${dragOver ? "rgba(251,191,36,0.5)" : "rgba(255,255,255,0.1)"}`,
                    background: dragOver ? "rgba(251,191,36,0.04)" : "rgba(255,255,255,0.02)",
                  }}>
                  <input id="pf-video-input" type="file" accept="video/*" className="hidden"
                    onChange={e => e.target.files?.[0] && setVideoFile(e.target.files[0])} />
                  <Upload className="h-7 w-7 mb-3" style={{ color: "rgba(255,255,255,0.2)" }} />
                  <p className="text-sm font-medium text-white/60">{t("pf_drop_video")}</p>
                  <p className="text-[11px] text-white/45 mt-1" style={mono}>{t("pf_drop_sub")}</p>
                  <div className="flex items-center gap-2 mt-3 text-[10px]" style={{ ...mono, color: "rgba(255,255,255,0.2)" }}>
                    <span className="px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)" }}>Whisper AI</span>
                    <span>→</span>
                    <span className="px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)" }}>Claude Analysis</span>
                  </div>
                </div>
              )}
              <p className="text-[10px] text-white/40 mt-2 text-center" style={mono}>
                Requires OPENAI_API_KEY for Whisper transcription
              </p>
            </div>
          )}

          {/* Hook + CTA row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-4 pb-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-white/50" style={mono}>{t("pf_hook_label")} <span className="text-white/15">{t("pf_optional")}</span></label>
              <input value={hook} onChange={e => setHook(e.target.value)}
                placeholder={t("pf_hook_ph")}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#fff", ...mono }}
                onFocus={e => { (e.currentTarget as HTMLInputElement).style.borderColor = "rgba(14,165,233,0.35)"; }}
                onBlur={e => { (e.currentTarget as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-white/50" style={mono}>{t("pf_cta_label")} <span className="text-white/15">{t("pf_optional")}</span></label>
              <input value={cta} onChange={e => setCta(e.target.value)}
                placeholder={t("pf_cta_ph")}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#fff", ...mono }}
                onFocus={e => { (e.currentTarget as HTMLInputElement).style.borderColor = "rgba(6,182,212,0.35)"; }}
                onBlur={e => { (e.currentTarget as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
              />
            </div>
          </div>

          {/* Config grid */}
          <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-white/50" style={mono}>{t("pf_platform")}</label>
              <Select value={platform} onChange={setPlatform} options={PLATFORMS} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-white/50" style={mono}>{t("pf_market")}</label>
              <Select value={market} onChange={setMarket} options={MARKETS} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-white/50" style={mono}>{t("pf_duration")}</label>
              <Select value={duration} onChange={setDuration}
                options={DURATIONS.map(d => ({ value: d, label: `${d}s` }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-white/50" style={mono}>{t("pf_format")}</label>
              <Select value={format} onChange={setFormat}
                options={FORMATS.map(f => ({ value: f, label: f }))} />
            </div>
          </div>

          {/* Product + compliance */}
          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-white/50" style={mono}>{t("pf_product")} <span className="text-white/15">{t("pf_optional")}</span></label>
              <input value={product} onChange={e => setProduct(e.target.value)}
                placeholder={t("pf_product_ph")}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#fff", ...mono }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-white/50" style={mono}>{t("pf_compliance_label")} <span className="text-white/15">{t("pf_optional")}</span></label>
              <input value={complianceNotes} onChange={e => setComplianceNotes(e.target.value)}
                placeholder={t("pf_compliance_ph")}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#fff", ...mono }}
              />
            </div>
          </div>

          {/* Funnel Stage */}
          <div className="px-4 pb-2">
            <p className="text-[10px] uppercase tracking-widest text-white/45 mb-2">{t("pf_funnel")}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "tofu", label: "ToFu", desc: t("pf_tofu").split(" · ")[1] || "Awareness", color: "#60a5fa" },
                { id: "mofu", label: "MoFu", desc: t("pf_mofu").split(" · ")[1] || "Consideration", color: "#0ea5e9" },
                { id: "bofu", label: "BoFu", desc: t("pf_bofu").split(" · ")[1] || "Conversion", color: "#34d399" },
              ].map(f => (
                <button key={f.id} onClick={() => setFunnelStage(f.id)}
                  className="py-2 rounded-lg text-xs font-medium border transition-all"
                  style={funnelStage === f.id
                    ? { background: `${f.color}18`, borderColor: `${f.color}40`, color: f.color }
                    : { background: "transparent", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)" }}>
                  <span className="font-bold">{f.label}</span>
                  <span className="opacity-60 ml-1 text-[10px]">{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Run button */}
          <div className="px-4 pb-4">
            <button onClick={run} disabled={loading || (inputMode === "script" ? !script.trim() : !videoFile)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
              style={{ ...syne, background: "linear-gradient(135deg, #fbbf24, #f59e0b)", color: "#000" }}>
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> {inputMode === "video" ? t("pf_transcribing") : t("pf_running")}</>
                : <><Plane className="h-4 w-4" /> {t("pf_run")}</>}
            </button>
          </div>
        </div>

        {loading && <ThinkingIndicator lang="pt" variant="tool" label="Analisando criativo" />}

        {/* ── Results ── */}
        {result && (
          <div ref={resultRef} className="space-y-3">

            {/* Score + Verdict */}
            <div className="rounded-2xl p-4 flex items-center gap-4"
              style={{ background: "#0a0a0d", border: `1px solid ${verdictCfg!.border}` }}>
              <ScoreRing score={result.score} color={verdictCfg!.color} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-white" style={syne}>
                    {result.verdict === "READY" ? t("pf_verdict_ready") :
                     result.verdict === "BLOCKED" ? t("pf_verdict_blocked") :
                     t("pf_verdict_review")}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold border"
                    style={{ color: verdictCfg!.color, background: verdictCfg!.bg, borderColor: verdictCfg!.border, ...mono }}>
                    {result.verdict}
                  </span>
                </div>
                <p className="text-xs text-white/40" style={mono}>{result.verdict_reason}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-[10px] flex items-center gap-1" style={{ ...mono, color: "rgba(255,255,255,0.25)" }}>
                    <Clock className="h-3 w-3" />{result.reading_time_seconds}{t("pf_read")} · {result.word_count}{t("pf_words")}
                  </span>
                  <span className="text-[10px] flex items-center gap-1" style={{ ...mono, color: "rgba(255,255,255,0.25)" }}>
                    <BarChart2 className="h-3 w-3" />{t("pf_hook_score")} {result.estimated_hook_score}/10
                  </span>
                </div>
              </div>
              <button onClick={run} disabled={loading}
                className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

          {/* Transcription note if from video */}
            {(result as PreflightResult & { transcription_note?: string | null }).transcription_note && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)" }}>
                <FileVideo className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#fbbf24" }} />
                <p className="text-xs" style={{ ...mono, color: "rgba(251,191,36,0.8)" }}>
                  {(result as PreflightResult & { transcription_note?: string | null }).transcription_note}
                </p>
              </div>
            )}

            {/* Strengths + Top Fixes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Strengths */}
              {result.strengths?.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ background: "#0a0a0d", border: "1px solid rgba(52,211,153,0.15)" }}>
                  <SectionHeader label={t("pf_strengths")} icon={<TrendingUp className="h-3.5 w-3.5" />} />
                  <div className="p-4 space-y-2">
                    {result.strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "#34d399" }} />
                        <p className="text-[12px] text-white/60 leading-relaxed">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Fixes */}
              {result.top_fixes?.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ background: "#0a0a0d", border: "1px solid rgba(251,191,36,0.15)" }}>
                  <SectionHeader label={t("pf_suggestions")} icon={<Zap className="h-3.5 w-3.5" />} />
                  <div className="p-4 space-y-2">
                    {result.top_fixes.map((fix, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="text-[10px] font-bold shrink-0 mt-0.5 h-4 w-4 rounded flex items-center justify-center"
                          style={{ ...mono, background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>{i + 1}</span>
                        <p className="text-[12px] text-white/60 leading-relaxed">{fix}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Hook Analysis */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#0a0a0d", border: "1px solid rgba(14,165,233,0.15)" }}>
              <SectionHeader label={t("pf_hook_analysis")} icon={<Sparkles className="h-3.5 w-3.5" />} />
              <div className="p-4 space-y-4">
                <div className="flex items-start gap-4">
                  {/* Score circle */}
                  <div className="shrink-0 h-14 w-14 rounded-2xl flex flex-col items-center justify-center"
                    style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)" }}>
                    <span className="text-xl font-bold" style={{ color: "#0ea5e9", ...mono }}>
                      {result.hook_analysis.score}
                    </span>
                    <span className="text-[9px]" style={{ ...mono, color: "rgba(14,165,233,0.6)" }}>/10</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <StatusBadge status={result.hook_analysis.status} />
                      <span className="text-[10px] px-2 py-0.5 rounded-lg"
                        style={{ ...mono, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                        {result.hook_analysis.type}
                      </span>
                    </div>
                    {result.hook_analysis.text && (
                      <div className="rounded-lg px-3 py-2 mb-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-xs text-white/70 italic" style={mono}>"{result.hook_analysis.text}"</p>
                      </div>
                    )}
                    <p className="text-xs text-white/50" style={mono}>{result.hook_analysis.detail}</p>
                  </div>
                </div>
                {result.hook_analysis.rewrite && (
                  <div className="rounded-xl p-3" style={{ background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.2)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-[0.15em]" style={{ ...mono, color: "#0ea5e9" }}>
                        <ArrowRight className="h-3 w-3 inline mr-1" />{t("pf_suggested_rewrite")}
                      </p>
                      <CopyBtn text={result.hook_analysis.rewrite} />
                    </div>
                    <p className="text-sm text-white/80" style={mono}>"{result.hook_analysis.rewrite}"</p>
                  </div>
                )}
              </div>
            </div>

            {/* Structure */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#0a0a0d", border: "1px solid rgba(255,255,255,0.07)" }}>
              <SectionHeader label={t("pf_structure")} icon={<BarChart2 className="h-3.5 w-3.5" />} />
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                {result.structure.map((row, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <span className="text-[10px] w-28 shrink-0 pt-0.5" style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>{row.segment}</span>
                    <StatusBadge status={row.status} />
                    <p className="text-xs text-white/50 flex-1 leading-relaxed" style={mono}>{row.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Check */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#0a0a0d", border: "1px solid rgba(255,255,255,0.07)" }}>
              <SectionHeader label={t("pf_cta_check")} icon={<MessageSquare className="h-3.5 w-3.5" />} />
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <StatusBadge status={result.cta_check.status} />
                      {result.cta_check.platform_compliant
                        ? <span className="text-[10px] px-2 py-0.5 rounded-lg" style={{ ...mono, background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>Platform OK</span>
                        : <span className="text-[10px] px-2 py-0.5 rounded-lg" style={{ ...mono, background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>Platform issue</span>
                      }
                    </div>
                    {result.cta_check.text && (
                      <p className="text-xs mb-1" style={{ ...mono, color: "rgba(255,255,255,0.5)" }}>"{result.cta_check.text}"</p>
                    )}
                    <p className="text-xs text-white/40" style={mono}>{result.cta_check.detail}</p>
                  </div>
                </div>
                {result.cta_check.suggestion && (
                  <div className="rounded-xl p-3" style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.2)" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] uppercase tracking-[0.15em]" style={{ ...mono, color: "#06b6d4" }}>{t("pf_suggested_cta")}</p>
                      <CopyBtn text={result.cta_check.suggestion} />
                    </div>
                    <p className="text-sm text-white/80" style={mono}>"{result.cta_check.suggestion}"</p>
                  </div>
                )}
              </div>
            </div>

            {/* Compliance */}
            {result.compliance?.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#0a0a0d", border: "1px solid rgba(255,255,255,0.07)" }}>
                <SectionHeader label={`${t("pf_compliance")} · ${market}`} icon={<Shield className="h-3.5 w-3.5" />} />
                <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  {result.compliance.map((row, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3">
                      <span className="text-[10px] w-32 shrink-0 pt-0.5" style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>{row.rule}</span>
                      <StatusBadge status={row.status} />
                      <p className="text-xs text-white/50 flex-1 leading-relaxed" style={mono}>{row.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Platform Fit */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#0a0a0d", border: "1px solid rgba(255,255,255,0.07)" }}>
              <SectionHeader label={t("pf_platform_fit")} icon={<TrendingUp className="h-3.5 w-3.5" />} />
              <div className="p-4 space-y-3">
                {/* Primary */}
                <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="h-5 w-5 rounded flex items-center justify-center shrink-0"
                    style={{ background: "rgba(251,191,36,0.15)" }}>
                    <span className="text-[10px]">🎯</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-white" style={mono}>{result.platform_fit.primary.platform}</span>
                      <StatusBadge status={result.platform_fit.primary.status} />
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ ...mono, background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}>{t("pf_primary")}</span>
                    </div>
                    <p className="text-xs text-white/40" style={mono}>{result.platform_fit.primary.detail}</p>
                  </div>
                </div>
                {/* Crosspost */}
                {result.platform_fit.crosspost?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.15em] px-1" style={{ ...mono, color: "rgba(255,255,255,0.2)" }}>{t("pf_crosspost")}</p>
                    {result.platform_fit.crosspost.map((p, i) => (
                      <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}>
                        <span className="text-xs font-medium w-28 shrink-0" style={{ ...mono, color: "rgba(255,255,255,0.4)" }}>{p.platform}</span>
                        <StatusBadge status={p.status} />
                        <p className="text-xs text-white/55 flex-1" style={mono}>{p.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Language Check */}
            {result.language_check && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#0a0a0d", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-white/50" />
                    <span className="text-[10px] uppercase tracking-[0.2em]" style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>{t("pf_language_review")}</span>
                  </div>
                  <StatusBadge status={result.language_check.status} />
                </div>
                {result.language_check.issues?.length > 0 ? (
                  <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                    {result.language_check.issues.map((issue, i) => (
                      <div key={i} className="px-4 py-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold" style={{ ...mono, color: "#f87171" }}>"{issue.found}"</span>
                          <ArrowRight className="h-3 w-3 text-white/40" />
                          <span className="text-xs font-bold" style={{ ...mono, color: "#34d399" }}>"{issue.fix}"</span>
                          <CopyBtn text={issue.fix} />
                        </div>
                        <p className="text-[11px] text-white/55" style={mono}>{issue.issue}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3">
                    <p className="text-xs text-white/50" style={mono}>{t("pf_no_issues")}</p>
                  </div>
                )}
              </div>
            )}

            {/* Run again */}
            <button onClick={run} disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", ...syne }}>
              <RefreshCw className="h-3.5 w-3.5" /> {t("pf_run_again")}
            </button>

          </div>
        )}
      </div>
    </div>
  );
}
