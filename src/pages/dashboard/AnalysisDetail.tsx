import { useEffect, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Clock, CheckCircle, AlertCircle, Loader2,
  ExternalLink, Copy, Check, Zap, ChevronRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

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

const mono = { fontFamily: "'DM Mono', monospace" } as const;
const jakarta = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;

const SCORE_COLOR = (s: number) =>
  s >= 8 ? "#34d399" : s >= 6 ? "#a78bfa" : s >= 4 ? "#fbbf24" : "#f87171";

const SCORE_LABEL = (s: number) =>
  s >= 8.5 ? "Viral" : s >= 7 ? "High" : s >= 5 ? "Medium" : "Low";

const MetricCard = ({
  label, value, sub, accent = "#a78bfa", size = "md"
}: {
  label: string; value: string; sub?: string; accent?: string; size?: "sm" | "md" | "lg"
}) => (
  <div className="flex flex-col justify-between rounded-2xl p-4"
    style={{ background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)" }}>
    <p className="text-[10px] uppercase tracking-[0.18em] mb-2"
      style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>{label}</p>
    <div>
      <p style={{
        ...jakarta,
        fontSize: size === "lg" ? 36 : size === "md" ? 24 : 18,
        fontWeight: 800,
        letterSpacing: "-0.03em",
        color: accent,
        lineHeight: 1.1,
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

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("analyses").select("*")
        .eq("id", id!).eq("user_id", user.id).single();
      if (data) setAnalysis(data as AnalysisData);
      setLoading(false);
    };
    fetch();
  }, [id, user.id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-7 w-7 animate-spin text-white/20" />
    </div>
  );

  if (!analysis) return (
    <div className="p-8 text-center">
      <p className="text-white/30 text-sm mb-4">Analysis not found.</p>
      <button onClick={() => navigate("/dashboard/analyses")}
        className="text-sm text-white/50 hover:text-white underline">Back</button>
    </div>
  );

  const result = analysis.result as Record<string, unknown> | null;
  const hookScore = (result?.hook_score as number) ?? null;
  const hookType = result?.hook_type as string ?? null;
  const creativeModel = result?.creative_model as string ?? null;
  const platformFit = result?.platform_fit as string[] ?? analysis.recommended_platforms ?? [];
  const audience = result?.audience as string ?? result?.target_audience as string ?? null;
  const audienceGender = result?.audience_gender as string ?? null;
  const audienceAge = result?.audience_age as string ?? null;
  const transcript = result?.transcript as Array<{ time: string; text: string; highlight?: boolean }> ?? null;
  const transcriptRaw = result?.transcript_raw as string ?? null;
  const hookText = result?.hook_text as string ?? result?.hook as string ?? null;
  const hookTags = result?.hook_tags as string[] ?? result?.hook_signals as string[] ?? [];
  const suggestions = result?.improvement_suggestions as string[] ??
    analysis.improvement_suggestions ?? [];
  const scenes = result?.scenes as Array<{
    number: number; label: string; time: string; description: string; vo?: string; type: string;
  }> ?? null;
  const summary = result?.summary as string ?? null;
  const language = result?.language as string ?? null;

  const scoreColor = hookScore !== null ? SCORE_COLOR(hookScore) : "#a78bfa";
  const scoreLabel = hookScore !== null ? SCORE_LABEL(hookScore) : null;

  const durationStr = analysis.video_duration_seconds
    ? `${Math.floor(analysis.video_duration_seconds / 60)}:${String(analysis.video_duration_seconds % 60).padStart(2, "0")}`
    : null;

  // Build audience display like "F 25-34"
  const audienceDisplay = (() => {
    if (audienceGender && audienceAge) return `${audienceGender.charAt(0).toUpperCase()} ${audienceAge}`;
    if (audience) return audience;
    return null;
  })();

  const platformDisplay = platformFit.slice(0, 2).join(" · ") || null;

  return (
    <div className="min-h-screen" style={{ background: "#080810" }}>
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
              {durationStr && <span>{durationStr}</span>}
              {language && <><span>·</span><span>{language}</span></>}
              {analysis.file_size_mb && <><span>·</span><span>{analysis.file_size_mb.toFixed(1)}MB</span></>}
              <span>·</span>
              <span>Analyzed {formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true })}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {analysis.status === "completed" && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
              style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
              <CheckCircle className="h-3 w-3" />
              Analysis complete
            </div>
          )}
          <button onClick={() => navigate("/dashboard/boards/new", { state: { fromAnalysis: id } })}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[11px] font-bold transition-all hover:opacity-90"
            style={{ ...jakarta, background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}>
            Export board <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── PENDING ── */}
      {analysis.status === "pending" && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-6">
          <Loader2 className="h-12 w-12 animate-spin text-purple-400/60" />
          <p className="font-bold text-white text-lg" style={jakarta}>Analysis in progress</p>
          <p className="text-white/30 text-sm">Usually takes 30–60 seconds</p>
        </div>
      )}

      {/* ── FAILED ── */}
      {analysis.status === "failed" && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-6">
          <AlertCircle className="h-12 w-12 text-red-400/60" />
          <p className="font-bold text-white text-lg" style={jakarta}>Analysis failed</p>
          <button onClick={() => navigate("/dashboard/analyses/new")}
            className="text-sm text-white/40 hover:text-white underline">Try again</button>
        </div>
      )}

      {/* ── NO API KEY ── */}
      {analysis.status === "completed" && !result && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-6">
          <AlertCircle className="h-12 w-12 text-amber-400/60" />
          <p className="font-bold text-white text-lg" style={jakarta}>API key not configured</p>
          <p className="text-white/30 text-sm max-w-sm">
            Add <code className="text-amber-400">ANTHROPIC_API_KEY</code> and{" "}
            <code className="text-amber-400">OPENAI_API_KEY</code> to Supabase secrets.
          </p>
        </div>
      )}

      {/* ── RESULTS ── */}
      {analysis.status === "completed" && result && (
        <div className="p-4 lg:p-5 space-y-4 max-w-6xl mx-auto">

          {/* ── ROW 1: 5 metric cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">

            {/* Hook Score — large with bar */}
            <div className="rounded-2xl p-4 flex flex-col justify-between"
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

            {/* Creative Model */}
            <MetricCard
              label="Creative Model"
              value={creativeModel ?? "—"}
              sub={result?.format as string ?? undefined}
              accent="#a78bfa"
              size="sm"
            />

            {/* Hook Type */}
            <MetricCard
              label="Hook Type"
              value={hookType ? hookType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "—"}
              sub={result?.hook_subtype as string ?? undefined}
              accent="#f472b6"
              size="sm"
            />

            {/* Platform Fit */}
            <MetricCard
              label="Platform Fit"
              value={platformFit[0] ?? "—"}
              sub={platformFit.slice(1).map(p => `${p} ✓`).join("  ") || undefined}
              accent="#60a5fa"
              size="sm"
            />

            {/* Audience */}
            <MetricCard
              label="Audience"
              value={audienceDisplay ?? "—"}
              sub={result?.market as string ?? result?.region as string ?? undefined}
              accent="#fb923c"
              size="sm"
            />
          </div>

          {/* ── ROW 2: Hook · Transcript · Suggestions ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

            {/* Hook (0-3s) */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)" }}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(167,139,250,0.12)" }}>
                <p className="text-[10px] uppercase tracking-[0.18em]"
                  style={{ ...mono, color: "rgba(167,139,250,0.6)" }}>Hook (0–3s)</p>
              </div>
              <div className="p-4">
                {hookText ? (
                  <p className="text-sm leading-relaxed text-white/80" style={{ ...mono, lineHeight: 1.7 }}>
                    {hookText}
                  </p>
                ) : (
                  <p className="text-sm text-white/30 italic">Hook not extracted</p>
                )}
                {hookTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {hookTags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {summary && (
                  <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {summary}
                  </p>
                )}
              </div>
            </div>

            {/* Transcript */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-[10px] uppercase tracking-[0.18em]"
                  style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>Transcript</p>
                <div className="flex items-center gap-2">
                  {language && (
                    <span className="text-[10px] px-2 py-0.5 rounded"
                      style={{ ...mono, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                      {language}
                    </span>
                  )}
                  {transcriptRaw && <CopyButton text={transcriptRaw} />}
                </div>
              </div>
              <div className="p-4 max-h-64 overflow-y-auto space-y-2">
                {transcript && transcript.length > 0 ? (
                  transcript.map((line, i) => (
                    <div key={i} className="flex gap-3 text-[12px]">
                      <span className="shrink-0 w-10 text-right" style={{ ...mono, color: "rgba(255,255,255,0.2)" }}>
                        {line.time}
                      </span>
                      <span style={{
                        color: line.highlight ? "#34d399" : "rgba(255,255,255,0.6)",
                        fontWeight: line.highlight ? 600 : 400,
                      }}>{line.text}</span>
                    </div>
                  ))
                ) : transcriptRaw ? (
                  <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {transcriptRaw}
                  </p>
                ) : (
                  <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                    Transcript not available
                  </p>
                )}
              </div>
            </div>

            {/* AI Suggestions */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-[10px] uppercase tracking-[0.18em]"
                  style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>AI Suggestions</p>
              </div>
              <div className="p-4 space-y-3">
                {suggestions.length > 0 ? (
                  suggestions.slice(0, 4).map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="h-2 w-2 rounded-full shrink-0 mt-1.5"
                        style={{ background: i === 0 ? "#f87171" : i === 1 ? "#f87171" : "#fbbf24" }} />
                      <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{s}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.2)" }}>No suggestions</p>
                )}
              </div>
            </div>
          </div>

          {/* ── ROW 3: Production Board Scenes ── */}
          {scenes && scenes.length > 0 && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em]"
                    style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>
                    Generated Production Board · {scenes.length} scenes
                  </p>
                </div>
                <button onClick={() => navigate("/dashboard/boards/new", { state: { fromAnalysis: id } })}
                  className="flex items-center gap-1.5 text-[11px] transition-colors"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#fff"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)"}>
                  View full board <ExternalLink className="h-3 w-3" />
                </button>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {scenes.slice(0, 4).map((scene, i) => (
                  <div key={i} className="rounded-xl p-3 flex flex-col gap-2"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold" style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>
                        SC {String(scene.number ?? i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}>
                        {scene.type ?? scene.label}
                      </span>
                    </div>
                    <p className="text-[10px]" style={{ ...mono, color: "rgba(255,255,255,0.25)" }}>{scene.time}</p>
                    <p className="text-[12px] leading-snug" style={{ color: "rgba(255,255,255,0.7)" }}>
                      {scene.description}
                    </p>
                    {scene.vo && (
                      <p className="text-[11px] italic" style={{ color: "#a78bfa", lineHeight: 1.4 }}>
                        '{scene.vo.slice(0, 40)}{scene.vo.length > 40 ? "..." : ""}'
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ROW 4: Extra data if no scenes ── */}
          {!scenes && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {platformFit.length > 0 && (
                <div className="rounded-2xl p-4"
                  style={{ background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-[10px] uppercase tracking-[0.18em] mb-3"
                    style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>Platform Fit</p>
                  <div className="flex flex-wrap gap-2">
                    {platformFit.map(p => (
                      <span key={p} className="text-[11px] px-2.5 py-1 rounded-lg font-medium"
                        style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {summary && (
                <div className="rounded-2xl p-4"
                  style={{ background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-[10px] uppercase tracking-[0.18em] mb-3"
                    style={{ ...mono, color: "rgba(255,255,255,0.3)" }}>AI Summary</p>
                  <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{summary}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Upgrade nudge for free/starter if running out ── */}
          <div className="rounded-2xl p-4 flex items-center gap-4"
            style={{ background: "linear-gradient(135deg,rgba(167,139,250,0.08),rgba(244,114,182,0.05))", border: "1px solid rgba(167,139,250,0.15)" }}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(167,139,250,0.12)" }}>
              <Zap className="h-4 w-4" style={{ color: "#a78bfa" }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white" style={jakarta}>Want deeper analysis?</p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                Studio plan unlocks scene-by-scene breakdown, A/B hook variants, and 30 analyses/month.
              </p>
            </div>
            <button onClick={() => navigate("/pricing")}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all hover:opacity-90"
              style={{ ...jakarta, background: "linear-gradient(135deg,#a78bfa,#f472b6)", color: "#000" }}>
              Upgrade <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

        </div>
      )}
    </div>
  );
};

export default AnalysisDetail;
