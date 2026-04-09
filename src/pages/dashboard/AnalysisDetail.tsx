import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Clock, CheckCircle, AlertCircle, Loader2,
  Copy, Check, Zap, ChevronRight, RefreshCw
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { FeedbackBar } from "@/components/dashboard/FeedbackBar";

interface AnalysisData {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  video_url: string | null;
  result: Record<string, unknown> | null;
  hook_strength: string | null;
  video_duration_seconds: number | null;
  file_size_mb: number | null;
  processing_time_seconds: number | null;
  improvement_suggestions: string[] | null;
  recommended_platforms: string[] | null;
}

const mono = { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" } as const;
const jakarta = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;

const SCORE_COLOR = (s: number) =>
  s >= 8 ? "#34d399" : s >= 6 ? "#0ea5e9" : s >= 4 ? "#fbbf24" : "#f87171";

const SCORE_LABEL = (s: number) =>
  s >= 8.5 ? "Viral" : s >= 7 ? "High" : s >= 5 ? "Medium" : "Low";

const MetricCard = ({
  label, value, sub, accent = "#0ea5e9"
}: {
  label: string; value: string; sub?: string; accent?: string;
}) => (
  <div className="flex flex-col justify-between rounded-2xl p-4"
    style={{ background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)" }}>
    <p className="text-[10px] uppercase tracking-[0.18em] mb-2"
      style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>{label}</p>
    <div>
      <p style={{
        ...jakarta, fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em",
        color: accent, lineHeight: 1.1,
      }}>{value}</p>
      {sub && <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{sub}</p>}
    </div>
  </div>
);

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={doCopy}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] transition-all"
      style={{ background: "rgba(255,255,255,0.05)", color: copied ? "#34d399" : "rgba(255,255,255,0.35)" }}>
      {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
    </button>
  );
};

const AnalysisDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useOutletContext<DashboardContext>();

  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAnalysis = async () => {
    const { data, error } = await supabase
      .from("analyses").select("*")
      .eq("id", id!).eq("user_id", user.id).single();
    if (data) {
      setAnalysis(data as AnalysisData);
      if (data.status === "completed" || data.status === "failed") {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    } else if (error) {
      // ID not found or unauthorized — stop polling and show not found
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAnalysis();
    // Poll every 3s if analysis is pending/processing
    pollRef.current = setInterval(fetchAnalysis, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id, user.id]);

  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-7 w-7 animate-spin text-white/40" />
    </div>
  );

  if (!analysis) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Análise não encontrada.</p>
      <button onClick={() => navigate("/dashboard/analyses")}
        style={{ fontSize: 13, color: "#0ea5e9", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
        ← Voltar para análises
      </button>
    </div>
  );

  const result = analysis.result as Record<string, unknown> | null;

  // Map AI response fields
  const hookScore = (result?.hook_score as number) ?? null;
  const hookStrength = (result?.hook_strength as string) ?? analysis.hook_strength ?? null;
  const hookType = (result?.hook_type as string) ?? null;
  const creativeModel = (result?.creative_model as string) ?? null;
  const visualHook = (result?.visual_hook as string) ?? null;
  const audioHook = (result?.audio_hook as string) ?? null;
  const brief = (result?.brief as string) ?? null;
  const summary = (result?.summary as string) ?? null;
  const languageDetected = (result?.language_detected as string) ?? null;
  const marketGuess = (result?.market_guess as string) ?? null;
  const format = (result?.format as string) ?? null;
  const pacing = (result?.pacing as string) ?? null;
  const tone = (result?.tone as string) ?? null;
  const ctaType = (result?.cta_type as string) ?? null;
  const platforms = (result?.recommended_platforms as string[]) ?? analysis.recommended_platforms ?? [];
  const suggestions = (result?.improvement_suggestions as string[]) ?? analysis.improvement_suggestions ?? [];

  const scoreColor = hookScore !== null ? SCORE_COLOR(hookScore) : "#0ea5e9";
  const scoreLabel = hookScore !== null ? SCORE_LABEL(hookScore) : null;

  const isProcessing = analysis.status === "pending" || analysis.status === "processing";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-main)" }}>
      {/* ── TOPBAR ── */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-3"
        style={{ background: "rgba(8,8,16,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate("/dashboard/analyses")}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate" style={jakarta}>
              {analysis.title || "Untitled Analysis"}
            </p>
            <p className="text-[10px] flex items-center gap-2" style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>
              {languageDetected && <span>{languageDetected.toUpperCase()}</span>}
              {marketGuess && <><span>·</span><span>{marketGuess}</span></>}
              {analysis.processing_time_seconds && <><span>·</span><span>{analysis.processing_time_seconds}s</span></>}
              <span>·</span>
              <span>{formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true })}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {analysis.status === "completed" && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
              style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
              <CheckCircle className="h-3 w-3" />
              Complete
            </div>
          )}
        </div>
      </div>

      {/* ── PROCESSING ── */}
      {isProcessing && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-6">
          <Loader2 className="h-12 w-12 animate-spin text-sky-400/60" />
          <p className="font-bold text-white text-lg" style={jakarta}>Analysis in progress</p>
          <p className="text-white/50 text-sm">Usually takes 30–60 seconds</p>
          <div className="flex items-center gap-2 text-white/40 text-xs">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Auto-refreshing...
          </div>
        </div>
      )}

      {/* ── FAILED ── */}
      {analysis.status === "failed" && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-6">
          <AlertCircle className="h-12 w-12 text-red-400/60" />
          <p className="font-bold text-white text-lg" style={jakarta}>Analysis failed</p>
          {result?.error && (
            <p className="text-white/50 text-sm max-w-md">{String(result.error)}</p>
          )}
          <button onClick={() => navigate("/dashboard/analyses/new")}
            className="text-sm text-white/40 hover:text-white underline">Try again</button>
        </div>
      )}

      {/* ── RESULTS ── */}
      {analysis.status === "completed" && result && (
        <div className="p-4 lg:p-5 space-y-4 max-w-6xl mx-auto">

          {/* ── ROW 1: Metric cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">

            {/* Hook Score */}
            <div className="rounded-2xl p-4 flex flex-col justify-between col-span-1"
              style={{ background: "#0e0e12", border: `1px solid rgba(255,255,255,0.07)` }}>
              <p className="text-[10px] uppercase tracking-[0.18em] mb-2"
                style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>Hook Score</p>
              <div>
                <p style={{ ...jakarta, fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", color: scoreColor, lineHeight: 1 }}>
                  {hookScore?.toFixed(1) ?? "—"}
                </p>
                <div className="h-1.5 rounded-full mt-3 overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${((hookScore ?? 0) / 10) * 100}%`, background: scoreColor }} />
                </div>
                {scoreLabel && (
                  <p className="text-[10px] mt-1" style={{ ...mono, color: scoreColor + "99" }}>{scoreLabel}</p>
                )}
              </div>
            </div>

            <MetricCard label="Creative Model" value={creativeModel ?? "—"} sub={format ?? undefined} accent="#0ea5e9" />
            <MetricCard label="Hook Type" value={hookType ? hookType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "—"} accent="#06b6d4" />
            <MetricCard label="Pacing" value={pacing ? pacing.charAt(0).toUpperCase() + pacing.slice(1) : "—"} sub={tone ?? undefined} accent="#60a5fa" />
            <MetricCard label="CTA" value={ctaType ? ctaType.charAt(0).toUpperCase() + ctaType.slice(1) : "—"} accent="#fb923c" />
            <MetricCard label="Market" value={marketGuess ?? "—"} sub={languageDetected ?? undefined} accent="#34d399" />
          </div>

          {/* ── ROW 2: Hook · Brief · Suggestions ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

            {/* Hook (0-3s) */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.2)" }}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(14,165,233,0.12)" }}>
                <p className="text-[10px] uppercase tracking-[0.18em]"
                  style={{ ...mono, color: "rgba(14,165,233,0.6)" }}>Hook (0–3s)</p>
              </div>
              <div className="p-4 space-y-3">
                {visualHook && (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.25)" }}>Visual</p>
                    <p className="text-sm leading-relaxed text-white/80">{visualHook}</p>
                  </div>
                )}
                {audioHook && (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.25)" }}>Audio</p>
                    <p className="text-sm leading-relaxed text-white/80" style={mono}>"{audioHook}"</p>
                  </div>
                )}
                {!visualHook && !audioHook && (
                  <p className="text-sm text-white/50 italic">Hook not extracted</p>
                )}
              </div>
            </div>

            {/* Brief / Summary */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-[10px] uppercase tracking-[0.18em]"
                  style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>Creative Brief</p>
                {summary && <CopyButton text={`${brief ?? ""}\n\n${summary}`} />}
              </div>
              <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                {brief && (
                  <p className="text-sm leading-relaxed font-medium text-white/80">{brief}</p>
                )}
                {summary && (
                  <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{summary}</p>
                )}
                {!brief && !summary && (
                  <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.2)" }}>No brief available</p>
                )}
              </div>
            </div>

            {/* AI Suggestions */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-[10px] uppercase tracking-[0.18em]"
                  style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>Improvement Suggestions</p>
              </div>
              <div className="p-4 space-y-3">
                {suggestions.length > 0 ? (
                  suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="h-2 w-2 rounded-full shrink-0 mt-1.5"
                        style={{ background: i === 0 ? "#f87171" : i === 1 ? "#fbbf24" : "#34d399" }} />
                      <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{s}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.2)" }}>No suggestions</p>
                )}
              </div>
            </div>
          </div>

          {/* ── ROW 3: Platforms ── */}
          {platforms.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl p-4"
                style={{ background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-[10px] uppercase tracking-[0.18em] mb-3"
                  style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>Recommended Platforms</p>
                <div className="flex flex-wrap gap-2">
                  {platforms.map(p => (
                    <span key={p} className="text-[11px] px-2.5 py-1 rounded-lg font-medium"
                      style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* Extra metadata */}
              <div className="rounded-2xl p-4"
                style={{ background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-[10px] uppercase tracking-[0.18em] mb-3"
                  style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>Details</p>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  {[
                    ["Format", format],
                    ["Pacing", pacing],
                    ["Tone", tone],
                    ["CTA", ctaType],
                    ["Hook Strength", hookStrength],
                    ["Language", languageDetected],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k as string}>
                      <span style={{ color: "rgba(255,255,255,0.25)" }}>{k}: </span>
                      <span style={{ color: "rgba(255,255,255,0.6)" }}>{String(v).charAt(0).toUpperCase() + String(v).slice(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Action Buttons ── */}
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: "#0a0a0d", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[10px] uppercase tracking-[0.2em]"
              style={{ ...mono, color: "rgba(255,255,255,0.25)" }}>Next actions</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

              {/* Rewrite hook */}
              <button
                onClick={() => {
                  const params = new URLSearchParams();
                  if (audioHook) params.set("hook", audioHook);
                  if (brief) params.set("product", brief.slice(0, 120));
                  if (marketGuess) params.set("market", marketGuess);
                  if (format) params.set("format", format);
                  navigate("/dashboard/hooks?" + params.toString());
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all group"
                style={{ background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.15)", color: "#0ea5e9" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,233,0.35)"; (e.currentTarget as HTMLElement).style.background = "rgba(14,165,233,0.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,233,0.15)"; (e.currentTarget as HTMLElement).style.background = "rgba(14,165,233,0.07)"; }}>
                <Zap className="h-4 w-4 shrink-0" />
                <div>
                  <p className="text-xs font-bold" style={jakarta}>Rewrite hook</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {hookScore !== null ? `Score ${hookScore.toFixed(1)} → improve` : "Generate better variants"}
                  </p>
                </div>
              </button>

              {/* Generate script variations */}
              <button
                onClick={() => {
                  const params = new URLSearchParams();
                  if (brief) params.set("product", brief.slice(0, 120));
                  if (summary) params.set("context", summary.slice(0, 200));
                  if (marketGuess) params.set("market", marketGuess);
                  if (format) params.set("format", format);
                  if (platforms[0]) params.set("platform", platforms[0].toLowerCase());
                  navigate("/dashboard/script?" + params.toString());
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.15)", color: "#34d399" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(52,211,153,0.35)"; (e.currentTarget as HTMLElement).style.background = "rgba(52,211,153,0.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(52,211,153,0.15)"; (e.currentTarget as HTMLElement).style.background = "rgba(52,211,153,0.07)"; }}>
                <RefreshCw className="h-4 w-4 shrink-0" />
                <div>
                  <p className="text-xs font-bold" style={jakarta}>Write script variation</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {format ? format.charAt(0).toUpperCase() + format.slice(1) + " format" : "New angle, same product"}
                  </p>
                </div>
              </button>

              {/* Create brief */}
              <button
                onClick={() => {
                  const params = new URLSearchParams();
                  if (brief) params.set("product", brief.slice(0, 120));
                  if (summary) params.set("context", summary.slice(0, 200));
                  if (marketGuess) params.set("market", marketGuess);
                  navigate("/dashboard/brief?" + params.toString());
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.15)", color: "#fbbf24" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(251,191,36,0.35)"; (e.currentTarget as HTMLElement).style.background = "rgba(251,191,36,0.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(251,191,36,0.15)"; (e.currentTarget as HTMLElement).style.background = "rgba(251,191,36,0.07)"; }}>
                <ChevronRight className="h-4 w-4 shrink-0" />
                <div>
                  <p className="text-xs font-bold" style={jakarta}>Create production brief</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {marketGuess ? "For " + marketGuess + " market" : "Full creative brief"}
                  </p>
                </div>
              </button>

            </div>
          </div>

          {/* ── Feedback ── */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] text-white/40" style={mono}>Was this analysis useful?</span>
            <FeedbackBar
              userId={user.id}
              sourceType="analysis"
              sourceId={analysis.id}
              outputText={summary || brief || undefined}
              context={{ hookScore, hookStrength, hookType, creativeModel, format, platforms }}
              compact
            />
          </div>

          {/* ── Upgrade nudge ── */}
          <div className="rounded-2xl p-4 flex items-center gap-4"
            style={{ background: "linear-gradient(135deg,rgba(14,165,233,0.08),rgba(6,182,212,0.05))", border: "1px solid rgba(14,165,233,0.15)" }}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(14,165,233,0.12)" }}>
              <Zap className="h-4 w-4" style={{ color: "#0ea5e9" }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white" style={jakarta}>Want deeper analysis?</p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                Studio plan unlocks scene-by-scene breakdown, A/B hook variants, and 30 analyses/month.
              </p>
            </div>
            <button onClick={() => navigate("/pricing")}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all hover:opacity-90"
              style={{ ...jakarta, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", color: "#000" }}>
              Upgrade <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

        </div>
      )}

      {/* Completed but no result data */}
      {analysis.status === "completed" && !result && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-6">
          <AlertCircle className="h-12 w-12 text-amber-400/60" />
          <p className="font-bold text-white text-lg" style={jakarta}>No results available</p>
          <p className="text-white/50 text-sm">The analysis completed but returned no data.</p>
          <button onClick={() => navigate("/dashboard/analyses/new")}
            className="text-sm text-white/40 hover:text-white underline">Try again</button>
        </div>
      )}
    </div>
  );
};

export default AnalysisDetail;
