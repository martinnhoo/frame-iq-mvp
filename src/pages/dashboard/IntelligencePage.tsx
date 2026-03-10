import { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Brain, TrendingUp, Target, Zap, BarChart3, RefreshCw, Loader2, Info } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalysisRow {
  id: string;
  created_at: string;
  result: Record<string, unknown> | null;
  hook_strength: string | null;
  hook_score?: number | null;
  status: string;
}

interface ModelStat {
  model: string;
  count: number;
  avgScore: number;
  avgHookScore: number;
  hookDistribution: Record<string, number>;
  topPlatforms: string[];
  trend: "up" | "down" | "flat";
}

interface TypeStat {
  type: string;
  count: number;
  avgScore: number;
  description: string;
}

const MODEL_LABELS: Record<string, { emoji: string; desc: string; color: string }> = {
  "UGC":           { emoji: "📱", desc: "User Generated Content — creator speaks to camera", color: "text-violet-400" },
  "Testimonial":   { emoji: "⭐", desc: "Real customer sharing their experience",            color: "text-green-400" },
  "Tutorial":      { emoji: "🎓", desc: "Step-by-step educational content",                  color: "text-blue-400" },
  "Problem-Solution":{ emoji: "🔧", desc: "Pain point identified then resolved",             color: "text-orange-400" },
  "Before-After":  { emoji: "✨", desc: "Transformation reveal format",                      color: "text-pink-400" },
  "Promo":         { emoji: "🔥", desc: "Promotional with urgency and offer",                color: "text-red-400" },
  "React":         { emoji: "😂", desc: "Reaction-driven engagement format",                 color: "text-yellow-400" },
  "Slideshow":     { emoji: "🎞️", desc: "Image-based slideshow format",                     color: "text-cyan-400" },
  "Demo":          { emoji: "📦", desc: "Product demonstration",                             color: "text-sky-400" },
  "Talking-Head":  { emoji: "🎙️", desc: "Speaker direct-to-camera format",                  color: "text-amber-400" },
  "General":       { emoji: "🎯", desc: "Mixed or unclassified format",                      color: "text-white/50" },
};

const HOOK_COLORS: Record<string, string> = {
  viral:  "text-green-400 bg-green-500/10 border-green-500/20",
  high:   "text-blue-400 bg-blue-500/10 border-blue-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low:    "text-red-400 bg-red-500/10 border-red-500/20",
};

// ── Helper ─────────────────────────────────────────────────────────────────────

function getModelFromResult(row: AnalysisRow): string {
  if (!row.result) return "General";
  const cm = (row.result.creative_model || row.result.format || "General") as string;
  const normalized = cm.charAt(0).toUpperCase() + cm.slice(1).toLowerCase();
  // Try to match known models
  for (const key of Object.keys(MODEL_LABELS)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) return key;
  }
  return "General";
}

function getScore(row: AnalysisRow): number | null {
  if (row.hook_score) return Number(row.hook_score);
  if (row.result?.hook_score) return Number(row.result.hook_score);
  if (row.result?.engagement_score) return Number(row.result.engagement_score);
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const { user } = useOutletContext<DashboardContext>();
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiProfile, setAiProfile] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    loadData();
  }, [user.id]);

  const [rebuilding, setRebuilding] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [{ data: analysesData }, { data: profileData }] = await Promise.all([
      supabase
        .from("analyses")
        .select("id, created_at, result, hook_strength, status")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("user_ai_profile")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    if (analysesData) setAnalyses(analysesData as AnalysisRow[]);
    if (profileData) setAiProfile(profileData as Record<string, unknown>);
    setLoading(false);
  };

  const rebuildProfile = async () => {
    setRebuilding(true);
    try {
      await supabase.functions.invoke("update-ai-profile", {
        body: { user_id: user.id, trigger: "manual_rebuild" },
      });
      await loadData();
    } catch {}
    setRebuilding(false);
  };

  // ── Computed stats ──────────────────────────────────────────────────────────

  const modelStats = useMemo((): ModelStat[] => {
    const map = new Map<string, { scores: number[]; hookScores: number[]; hooks: Record<string, number>; platforms: string[] }>();

    analyses.forEach((row) => {
      const model = getModelFromResult(row);
      if (!map.has(model)) map.set(model, { scores: [], hookScores: [], hooks: {}, platforms: [] });
      const entry = map.get(model)!;

      const score = getScore(row);
      if (score !== null) entry.scores.push(score);
      if (row.hook_strength) entry.hooks[row.hook_strength] = (entry.hooks[row.hook_strength] || 0) + 1;
      if (row.result?.recommended_platforms) {
        (row.result.recommended_platforms as string[]).forEach(p => entry.platforms.push(p));
      }
    });

    return Array.from(map.entries())
      .map(([model, d]) => {
        const avg = d.scores.length ? d.scores.reduce((a, b) => a + b, 0) / d.scores.length : 0;
        // Platform frequency
        const pfMap: Record<string, number> = {};
        d.platforms.forEach(p => { pfMap[p] = (pfMap[p] || 0) + 1; });
        const topPlatforms = Object.entries(pfMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p);
        return {
          model,
          count: analyses.filter(r => getModelFromResult(r) === model).length,
          avgScore: Math.round(avg * 10) / 10,
          avgHookScore: avg,
          hookDistribution: d.hooks,
          topPlatforms,
          trend: "flat" as const,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [analyses]);

  const typeStats = useMemo((): TypeStat[] => {
    const hookMap: Record<string, number[]> = {};
    analyses.forEach(row => {
      const ht = (row.result?.hook_type as string) || "other";
      if (!hookMap[ht]) hookMap[ht] = [];
      const score = getScore(row);
      if (score !== null) hookMap[ht].push(score);
    });
    return Object.entries(hookMap)
      .map(([type, scores]) => ({
        type,
        count: scores.length,
        avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
        description: {
          curiosity: "Creates a gap the viewer needs to fill",
          social_proof: "Leverages others' experiences",
          pattern_interrupt: "Breaks expected visual/audio flow",
          direct_offer: "Lead with the value proposition",
          emotional: "Triggers strong emotion first",
          question: "Direct question to viewer",
          statement: "Bold declarative opening",
          other: "Unclassified hook type",
        }[type] || type,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [analyses]);

  const overallStats = useMemo(() => {
    const completed = analyses.filter(a => a.status === "completed");
    const scores = completed.map(a => getScore(a)).filter(Boolean) as number[];
    const hookCounts: Record<string, number> = {};
    completed.forEach(a => { if (a.hook_strength) hookCounts[a.hook_strength] = (hookCounts[a.hook_strength] || 0) + 1; });
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const bestModel = modelStats[0]?.model || "—";
    return { total: completed.length, avgScore: Math.round(avgScore * 10) / 10, hookCounts, bestModel };
  }, [analyses, modelStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-white/20" />
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Brain className="h-5 w-5 text-violet-400" />
          <h1 className="text-xl font-bold text-white">Intelligence</h1>
        </div>
        <div className="rounded-2xl border border-dashed border-white/[0.08] py-20 text-center">
          <p className="text-4xl mb-4">🧠</p>
          <p className="text-white/40 text-sm font-medium mb-2">No data yet</p>
          <p className="text-white/20 text-xs">Run your first analysis to start building creative intelligence</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-violet-400" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Intelligence</h1>
              {aiProfile?.creative_style && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-violet-500/25 bg-violet-500/10 text-violet-400 font-medium hidden sm:inline">
                  {String(aiProfile.creative_style)}
                </span>
              )}
            </div>
            <p className="text-xs text-white/25 mt-0.5">Patterns from your {overallStats.total} completed analyses</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={rebuildProfile}
            disabled={rebuilding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs hover:bg-violet-500/20 disabled:opacity-40 transition-all"
          >
            <RefreshCw className={`h-3 w-3 ${rebuilding ? "animate-spin" : ""}`} />
            {rebuilding ? "Rebuilding..." : "Rebuild AI profile"}
          </button>
          <button
            onClick={loadData}
            className="h-8 w-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Analyses", value: overallStats.total, icon: BarChart3, color: "text-purple-400" },
          { label: "Avg Hook Score", value: overallStats.avgScore > 0 ? `${overallStats.avgScore}/10` : "—", icon: Target, color: "text-blue-400" },
          { label: "Top Model", value: overallStats.bestModel, icon: Brain, color: "text-violet-400" },
          { label: "Viral Hooks", value: overallStats.hookCounts["viral"] || 0, icon: Zap, color: "text-yellow-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
              <p className="text-[10px] uppercase tracking-widest text-white/20">{kpi.label}</p>
            </div>
            <p className="text-xl font-bold text-white truncate">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Creative Model Breakdown */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-white/20 mb-3">Creative Model Performance</p>
        <div className="space-y-2">
          {modelStats.map((stat) => {
            const meta = MODEL_LABELS[stat.model] || MODEL_LABELS["General"];
            const maxCount = modelStats[0]?.count || 1;
            const barWidth = Math.max(4, (stat.count / maxCount) * 100);
            const viralCount = stat.hookDistribution["viral"] || 0;
            const highCount = stat.hookDistribution["high"] || 0;

            return (
              <div key={stat.model} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 hover:border-white/[0.12] transition-all">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0 mt-0.5">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-bold ${meta.color}`}>{stat.model}</p>
                        <span className="text-[10px] text-white/20 font-mono">{stat.count}x used</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {stat.avgScore > 0 && (
                          <span className={`text-xs font-bold ${stat.avgScore >= 8 ? "text-green-400" : stat.avgScore >= 6 ? "text-yellow-400" : "text-white/40"}`}>
                            {stat.avgScore}/10 avg
                          </span>
                        )}
                        {(viralCount + highCount) > 0 && (
                          <span className="text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                            {viralCount + highCount} viral/high
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-white/25 mb-2">{meta.desc}</p>
                    {/* Bar */}
                    <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500/60 to-purple-500/60 transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    {/* Hook distribution */}
                    {Object.keys(stat.hookDistribution).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {Object.entries(stat.hookDistribution).map(([k, v]) => (
                          <span key={k} className={`text-[10px] px-2 py-0.5 rounded-full border ${HOOK_COLORS[k] || "text-white/30 border-white/10 bg-white/5"}`}>
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Top platforms */}
                    {stat.topPlatforms.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {stat.topPlatforms.map(p => (
                          <span key={p} className="text-[10px] text-white/20 capitalize">{p}</span>
                        )).reduce((acc, el, i) => i === 0 ? [el] : [...acc, <span key={`sep${i}`} className="text-white/10">·</span>, el], [] as React.ReactNode[])}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hook Type Performance */}
      {typeStats.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/20 mb-3">Hook Type Performance</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {typeStats.map((stat, i) => (
              <div key={stat.type} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="h-8 w-8 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white/40">#{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-white capitalize">{stat.type.replace(/_/g, " ")}</p>
                    <p className={`text-xs font-bold ${stat.avgScore >= 7 ? "text-green-400" : stat.avgScore >= 5 ? "text-yellow-400" : "text-white/30"}`}>
                      {stat.avgScore > 0 ? `${stat.avgScore}/10` : "—"}
                    </p>
                  </div>
                  <p className="text-[10px] text-white/25 truncate">{stat.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Profile — what the AI knows */}
      <div className="rounded-2xl border border-violet-500/15 bg-violet-500/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-violet-400" />
          <p className="text-sm font-semibold text-white">What the AI knows about your creatives</p>
        </div>
        {aiProfile ? (
          <div className="space-y-2">
            {aiProfile.ai_summary && (
              <p className="text-xs text-white/50 leading-relaxed">{String(aiProfile.ai_summary)}</p>
            )}
            {aiProfile.ai_recommendations && (
              <div className="pt-2">
                <p className="text-[10px] uppercase tracking-widest text-white/20 mb-2">Recommendations</p>
                <ul className="space-y-1">
                  {(aiProfile.ai_recommendations as string[]).map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-white/40">
                      <span className="text-violet-400 shrink-0">·</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-white/30 leading-relaxed">
            The AI builds your profile as you run analyses. After 5+ analyses, you'll see personalized insights here — what formats work for your brand, which hooks resonate with your audience, and which markets respond best.
          </p>
        )}
        <div className="mt-3 pt-3 border-t border-violet-500/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="h-3 w-3 text-white/15 shrink-0" />
            <p className="text-[10px] text-white/20">Updated automatically after each completed analysis</p>
          </div>
          {aiProfile?.last_updated && (
            <p className="text-[10px] text-white/15 font-mono shrink-0">
              {new Date(String(aiProfile.last_updated)).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
