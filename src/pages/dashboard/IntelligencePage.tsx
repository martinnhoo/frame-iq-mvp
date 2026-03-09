import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Brain, TrendingUp, Eye, Zap, BarChart3, Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AnalysisResult {
  hook_score?: number;
  engagement_score?: number;
  creative_model?: string;
  market?: string;
  format?: string;
  hook_type?: string;
  platform?: string;
  duration?: number;
  narrative_arc?: string;
}

interface Analysis {
  id: string;
  title: string | null;
  created_at: string;
  hook_strength: string | null;
  result: AnalysisResult | null;
}

type DateFilter = "7d" | "30d" | "all";

const IntelligencePage = () => {
  const { user } = useOutletContext<DashboardContext>();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("30d");

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase
        .from("analyses")
        .select("id, title, created_at, hook_strength, result")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      if (data) setAnalyses(data as Analysis[]);
      setLoading(false);
    };
    run();
  }, [user.id]);

  const filtered = analyses.filter((a) => {
    if (dateFilter === "all") return true;
    const days = dateFilter === "7d" ? 7 : 30;
    return Date.now() - new Date(a.created_at).getTime() < days * 86400000;
  });

  // Compute stats from real data
  const scores = filtered.map((a) =>
    (a.result?.hook_score ?? a.result?.engagement_score) as number | undefined
  ).filter((s): s is number => s !== undefined);

  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const modelCounts: Record<string, number> = {};
  const hookCounts: Record<string, number> = {};
  const platformCounts: Record<string, number> = {};
  const marketCounts: Record<string, number> = {};

  filtered.forEach((a) => {
    const r = a.result;
    if (!r) return;
    if (r.creative_model) modelCounts[r.creative_model] = (modelCounts[r.creative_model] || 0) + 1;
    if (r.hook_type) hookCounts[r.hook_type] = (hookCounts[r.hook_type] || 0) + 1;
    if (r.platform) platformCounts[r.platform] = (platformCounts[r.platform] || 0) + 1;
    if (r.market) marketCounts[r.market] = (marketCounts[r.market] || 0) + 1;
  });

  const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topHook = Object.entries(hookCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const modelEntries = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const hookEntries = Object.entries(hookCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = filtered.length;

  const strengthDist = { STRONG: 0, SOLID: 0, WEAK: 0 };
  filtered.forEach((a) => {
    const s = a.hook_strength?.toUpperCase() || "";
    if (s === "STRONG") strengthDist.STRONG++;
    else if (s === "SOLID") strengthDist.SOLID++;
    else strengthDist.WEAK++;
  });

  const DateFilterBtn = ({ value, label }: { value: DateFilter; label: string }) => (
    <button
      onClick={() => setDateFilter(value)}
      className={`px-3 py-1 rounded-lg text-xs transition-all ${
        dateFilter === value
          ? "bg-white/10 text-white border border-white/20"
          : "text-white/30 hover:text-white/60 border border-transparent"
      }`}
    >
      {label}
    </button>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-5 w-5 animate-spin text-white/30" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain className="h-5 w-5 text-white/40" />
            Creative Intelligence
          </h1>
          <p className="text-white/30 text-sm mt-0.5">
            Patterns from your {total} analyzed creative{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] border border-white/[0.08] p-1">
          <DateFilterBtn value="7d" label="7 days" />
          <DateFilterBtn value="30d" label="30 days" />
          <DateFilterBtn value="all" label="All time" />
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] py-16 flex flex-col items-center text-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white/[0.06] flex items-center justify-center">
            <Brain className="h-6 w-6 text-white/20" />
          </div>
          <div>
            <p className="text-white/50 font-medium">No data yet</p>
            <p className="text-white/25 text-sm mt-1">Analyze videos to see patterns and creative intelligence</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Analyzed", value: String(total), icon: Eye, color: "text-white" },
              { label: "Avg Hook Score", value: avgScore ? `${avgScore.toFixed(1)}/10` : "—", icon: Zap, color: avgScore && avgScore >= 7 ? "text-green-400" : "text-yellow-400" },
              { label: "Top Format", value: topModel || "—", icon: Brain, color: "text-purple-400" },
              { label: "Top Hook", value: topHook || "—", icon: TrendingUp, color: "text-blue-400" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <s.icon className="h-4 w-4 text-white/30 mb-2" />
                <p className={`text-lg font-bold ${s.color} truncate`}>{s.value}</p>
                <p className="text-xs text-white/25 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Creative Models distribution */}
          {modelEntries.length > 0 && (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              <h2 className="text-sm font-semibold text-white/60 mb-4">Creative Format Distribution</h2>
              <div className="space-y-3">
                {modelEntries.map(([model, count]) => {
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={model} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/70 font-medium">{model}</span>
                        <span className="text-white/30 font-mono">{pct}% · {count}×</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hook patterns + platform + hook strength */}
          <div className="grid sm:grid-cols-2 gap-4">
            {hookEntries.length > 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                <h2 className="text-sm font-semibold text-white/60 mb-4">Top Hook Types</h2>
                <div className="space-y-2">
                  {hookEntries.map(([hook, count], i) => (
                    <div key={hook} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-white/20 w-4">{i + 1}</span>
                      <span className="flex-1 text-sm text-white/70">{hook}</span>
                      <span className="text-xs font-mono text-white/30">{count}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white/60">Hook Strength Breakdown</h2>
              {[
                { label: "Strong (8+)", count: strengthDist.STRONG, color: "#4ade80" },
                { label: "Solid (6-7.9)", count: strengthDist.SOLID, color: "#facc15" },
                { label: "Weak (<6)", count: strengthDist.WEAK, color: "#f87171" },
              ].map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/50">{row.label}</span>
                    <span className="font-mono text-white/30">{row.count}</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${total > 0 ? (row.count / total) * 100 : 0}%`, backgroundColor: row.color }}
                    />
                  </div>
                </div>
              ))}

              {topPlatform && (
                <div className="pt-2 border-t border-white/[0.06]">
                  <p className="text-xs text-white/30">Most analyzed platform</p>
                  <p className="text-sm font-semibold text-white mt-0.5">{topPlatform}</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent analyses timeline */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <h2 className="text-sm font-semibold text-white/60 mb-4">Recent Analyses</h2>
            <div className="space-y-2">
              {filtered.slice(0, 8).map((a) => {
                const score = (a.result?.hook_score ?? a.result?.engagement_score) as number | undefined;
                return (
                  <div key={a.id} className="flex items-center gap-3 py-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-purple-400/60 shrink-0" />
                    <span className="flex-1 text-sm text-white/60 truncate">{a.title || "Untitled"}</span>
                    {score !== undefined && (
                      <span className={`text-xs font-mono font-bold ${
                        score >= 8 ? "text-green-400" : score >= 6 ? "text-yellow-400" : "text-red-400"
                      }`}>
                        {score.toFixed(1)}
                      </span>
                    )}
                    <span className="text-xs text-white/20 flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default IntelligencePage;
