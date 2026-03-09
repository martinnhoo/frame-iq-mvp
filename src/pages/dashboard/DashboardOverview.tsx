import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3, LayoutGrid, Video, Plus, ArrowRight,
  TrendingUp, Clock, Zap, Target, Globe, Plane,
  ChevronRight, Sparkles,
} from "lucide-react";

interface InsightsData {
  avgHookScore: number | null;
  bestModel: string | null;
  mostUsedMarket: string | null;
  totalAnalyzed: number;
}

interface ActivityItem {
  id: string;
  type: "analysis" | "board";
  title: string;
  created_at: string;
}

const DashboardOverview = () => {
  const { user, profile, usage, usageDetails } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();

  const [insights, setInsights] = useState<InsightsData>({ avgHookScore: null, bestModel: null, mostUsedMarket: null, totalAnalyzed: 0 });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [clearingActivity, setClearingActivity] = useState(false);
  const [dateFilter, setDateFilter] = useState<"7d" | "30d" | "all">("30d");

  const planLimits = {
    free: { analyses: 3, boards: 3, videos: 0 },
    creator: { analyses: 3, boards: 1, videos: 0 },
    starter: { analyses: 15, boards: 10, videos: 0 },
    studio: { analyses: 30, boards: 30, videos: 5 },
    scale: { analyses: 500, boards: 300, videos: 300 },
  };
  const limits = planLimits[profile?.plan as keyof typeof planLimits] || planLimits.free;

  useEffect(() => {
    const run = async () => {
      let query = supabase.from("analyses").select("result, hook_strength, created_at").eq("user_id", user.id).eq("status", "completed");
      if (dateFilter !== "all") {
        const days = dateFilter === "7d" ? 7 : 30;
        const since = new Date(Date.now() - days * 86400000).toISOString();
        query = query.gte("created_at", since);
      }
      const { data } = await query;
      if (!data?.length) { setInsights({ avgHookScore: null, bestModel: null, mostUsedMarket: null, totalAnalyzed: 0 }); return; }
      let total = 0, count = 0;
      const models: Record<string, number> = {}, markets: Record<string, number> = {};
      data.forEach((a) => {
        const r = a.result as Record<string, unknown> | null;
        if (!r) return;
        const s = (r.hook_score as number) ?? (r.engagement_score as number) ?? null;
        if (s !== null) { total += s; count++; }
        const m = r.creative_model as string; if (m) models[m] = (models[m] || 0) + 1;
        const mk = r.market as string; if (mk) markets[mk] = (markets[mk] || 0) + 1;
      });
      setInsights({
        avgHookScore: count > 0 ? total / count : null,
        bestModel: Object.entries(models).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
        mostUsedMarket: Object.entries(markets).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
        totalAnalyzed: data.length,
      });
    };
    run();
  }, [user.id, dateFilter]);

  useEffect(() => {
    const run = async () => {
      const [{ data: analyses }, { data: boards }] = await Promise.all([
        supabase.from("analyses").select("id, title, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(4),
        supabase.from("boards").select("id, title, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(4),
      ]);
      const items: ActivityItem[] = [
        ...(analyses || []).map(a => ({ id: a.id, type: "analysis" as const, title: a.title || "Untitled", created_at: a.created_at })),
        ...(boards || []).map(b => ({ id: b.id, type: "board" as const, title: b.title || "Untitled", created_at: b.created_at })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
      setRecentActivity(items);
    };
    run();
  }, [user.id]);

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const usedAnalyses = usageDetails?.analyses.used ?? usage.analyses_count;
  const usedBoards = usageDetails?.boards.used ?? usage.boards_count;
  const usedVideos = usageDetails?.videos.used ?? usage.videos_count;

  const stats = [
    { label: "Analyses", used: usedAnalyses, limit: limits.analyses, icon: BarChart3, url: "/dashboard/analyses", accent: "#a78bfa" },
    { label: "Boards", used: usedBoards, limit: limits.boards, icon: LayoutGrid, url: "/dashboard/boards", accent: "#60a5fa" },
    { label: "Videos", used: usedVideos, limit: limits.videos, icon: Video, url: "/dashboard/videos", accent: "#34d399" },
  ];

  const quickActions = [
    { title: "New Analysis",  desc: "Upload a video for AI insights",   icon: BarChart3, url: "/dashboard/analyses/new", hot: true,  accent: "text-purple-400", bg: "bg-purple-500/10" },
    { title: "Create Board",  desc: "Generate a production board",      icon: LayoutGrid, url: "/dashboard/boards/new",           accent: "text-blue-400",   bg: "bg-blue-500/10" },
    { title: "Pre-flight",    desc: "Review before posting",            icon: Plane,      url: "/dashboard/preflight",            accent: "text-yellow-400", bg: "bg-yellow-500/10" },
    { title: "Translate",     desc: "Adapt scripts to any market",      icon: Globe,      url: "/dashboard/translate",            accent: "text-green-400",  bg: "bg-green-500/10" },
    { title: "Templates",     desc: "Start from proven formats",        icon: Sparkles,   url: "/dashboard/templates",            accent: "text-pink-400",   bg: "bg-pink-500/10" },
    { title: "Persona",       desc: "Build your target audience",       icon: Target,     url: "/dashboard/persona",              accent: "text-cyan-400",   bg: "bg-cyan-500/10" },
  ];

  const firstName = profile?.name?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">

      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-white/30 uppercase tracking-widest mb-1">{greeting}</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {firstName} <span className="text-white/30">👋</span>
          </h1>
          <p className="text-sm text-white/40 mt-1">Your creative intelligence workspace</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-mono text-white/50 capitalize">
            {profile?.plan} plan
          </span>
          {profile?.plan === "free" && (
            <button
              onClick={() => navigate("/pricing")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black text-xs font-semibold hover:bg-white/90 transition-colors"
            >
              <Zap className="h-3 w-3" /> Upgrade
            </button>
          )}
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat) => {
          const pct = stat.limit > 0 ? Math.min((stat.used / stat.limit) * 100, 100) : 0;
          const critical = pct >= 90;
          return (
            <button
              key={stat.label}
              onClick={() => navigate(stat.url)}
              className="group text-left p-4 sm:p-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06] transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-3">
                <stat.icon className="h-4 w-4 text-white/30 group-hover:text-white/60 transition-colors" />
                <span className={`text-[10px] font-mono ${critical ? "text-red-400" : "text-white/20"}`}>
                  {stat.limit > 0 ? `${stat.limit - stat.used} left` : "—"}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{stat.used}</div>
              <div className="text-xs text-white/30 mb-3">{stat.label}</div>
              <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: critical ? "#f87171" : stat.accent }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest text-[11px]">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.title}
              onClick={() => navigate(action.url)}
              className="group text-left p-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06] transition-all duration-200 relative overflow-hidden"
            >
              {action.hot && (
                <span className="absolute top-3 right-3 text-[9px] font-bold font-mono uppercase tracking-wider text-white/30 border border-white/10 rounded px-1.5 py-0.5">
                  New
                </span>
              )}
              <div className={`h-8 w-8 rounded-xl ${action.bg} flex items-center justify-center mb-3 transition-colors`}>
                <action.icon className={`h-4 w-4 ${action.accent}`} />
              </div>
              <p className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">{action.title}</p>
              <p className="text-xs text-white/30 mt-0.5 hidden sm:block">{action.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom row: Insights + Activity */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Performance Insights */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-white/40" />
              <h3 className="text-sm font-semibold text-white/70">Performance Insights</h3>
            </div>
            <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06] p-0.5">
              {(["7d", "30d", "all"] as const).map(f => (
                <button key={f} onClick={() => setDateFilter(f)}
                  className={`px-2 py-1 rounded-md text-[10px] font-mono transition-all ${dateFilter === f ? "bg-white/10 text-white" : "text-white/25 hover:text-white/50"}`}>
                  {f === "all" ? "All" : f}
                </button>
              ))}
            </div>
          </div>
          {insights.totalAnalyzed === 0 ? (
            <div className="flex flex-col items-center text-center py-8 gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white/20" />
              </div>
              <p className="text-sm text-white/30">Analyze your first video to see insights</p>
              <button
                onClick={() => navigate("/dashboard/analyses/new")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 text-white/70 text-sm hover:bg-white/15 hover:text-white transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> Analyze now
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { label: "Avg. Hook Score", value: insights.avgHookScore ? `${insights.avgHookScore.toFixed(1)} / 10` : "—" },
                { label: "Top Creative Model", value: insights.bestModel || "—" },
                { label: "Most Used Market", value: insights.mostUsedMarket || "—" },
                { label: "Total Analyzed", value: String(insights.totalAnalyzed) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-white/30">{label}</span>
                  <span className="text-sm font-semibold text-white font-mono">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="h-4 w-4 text-white/40" />
            <h3 className="text-sm font-semibold text-white/70">Recent Activity</h3>
          </div>
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center text-center py-8 gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center">
                <Clock className="h-5 w-5 text-white/20" />
              </div>
              <p className="text-sm text-white/30">No activity yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.type === "analysis" ? `/dashboard/analyses/${item.id}` : `/dashboard/boards/${item.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.05] transition-colors text-left group"
                >
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                    item.type === "analysis" ? "bg-purple-500/15" : "bg-blue-500/15"
                  }`}>
                    {item.type === "analysis"
                      ? <BarChart3 className="h-3.5 w-3.5 text-purple-400" />
                      : <LayoutGrid className="h-3.5 w-3.5 text-blue-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70 group-hover:text-white truncate transition-colors">{item.title}</p>
                    <p className="text-xs text-white/25 capitalize">{item.type} • {timeAgo(item.created_at)}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 transition-colors shrink-0" />
                </button>
              ))}
              <div className="flex items-center justify-between mt-1">
                <button
                  onClick={async () => {
                    if (!confirm("Clear recent activity display?")) return;
                    setClearingActivity(true);
                    setRecentActivity([]);
                    setClearingActivity(false);
                  }}
                  className="text-xs text-white/15 hover:text-white/35 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => navigate("/dashboard/analyses")}
                  className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/50 transition-colors"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upgrade banner — free plan only */}
      {profile?.plan === "free" && (
        <div className="relative rounded-2xl border border-white/[0.1] overflow-hidden p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-transparent to-pink-900/20" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div>
              <p className="text-base font-bold text-white mb-1">Ready to scale?</p>
              <p className="text-sm text-white/40">Studio gives you 30 analyses/month, production boards, and video generation.</p>
            </div>
            <button
              onClick={() => navigate("/pricing")}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-colors"
            >
              See plans <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
