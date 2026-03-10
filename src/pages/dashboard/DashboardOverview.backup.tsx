import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3, LayoutGrid, Video, Plus, ArrowRight,
  TrendingUp, Clock, Zap, Target, Brain, Cpu, Languages,
  ChevronRight, Sparkles, Plane, Wand2,
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
interface IntelItem {
  id: string; icon: string; color: string; borderColor: string;
  title: string; body: string; url?: string; tag: string;
}

const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const mono = { fontFamily: "'DM Mono', monospace" } as const;

const GradText = ({ children, from = "#a78bfa", to = "#f472b6" }: { children: React.ReactNode; from?: string; to?: string }) => (
  <span style={{ background: `linear-gradient(135deg, ${from}, ${to})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
    {children}
  </span>
);

const DashboardOverview = () => {
  const { user, profile, usage, usageDetails } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();

  const [insights, setInsights] = useState<InsightsData>({ avgHookScore: null, bestModel: null, mostUsedMarket: null, totalAnalyzed: 0 });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [dateFilter, setDateFilter] = useState<"7d" | "30d" | "all">("30d");
  const [intelFeed, setIntelFeed] = useState<IntelItem[]>([]);
  const [trendData, setTrendData] = useState<{ date: string; score: number }[]>([]);

  const planLimits = {
    free:    { analyses: 3,   boards: 3,   videos: 0 },
    creator: { analyses: 3,   boards: 1,   videos: 0 },
    starter: { analyses: 15,  boards: 10,  videos: 0 },
    studio:  { analyses: 30,  boards: 30,  videos: 5 },
    scale:   { analyses: 500, boards: 300, videos: 300 },
  };
  const limits = planLimits[profile?.plan as keyof typeof planLimits] || planLimits.free;
  const usedAnalyses = usageDetails?.analyses.used ?? usage.analyses_count;
  const usedBoards   = usageDetails?.boards.used   ?? usage.boards_count;
  const usedVideos   = usageDetails?.videos.used   ?? usage.videos_count;

  useEffect(() => {
    const run = async () => {
      let q = supabase.from("analyses").select("result, created_at").eq("user_id", user.id).eq("status", "completed");
      if (dateFilter !== "all") {
        const since = new Date(Date.now() - (dateFilter === "7d" ? 7 : 30) * 86400000).toISOString();
        q = q.gte("created_at", since);
      }
      const { data } = await q;
      if (!data?.length) { setInsights({ avgHookScore: null, bestModel: null, mostUsedMarket: null, totalAnalyzed: 0 }); return; }
      let total = 0, count = 0;
      const models: Record<string, number> = {}, markets: Record<string, number> = {};
      data.forEach(a => {
        const r = a.result as Record<string, unknown> | null; if (!r) return;
        const s = r.hook_score as number ?? null; if (s !== null) { total += s; count++; }
        const m = r.creative_model as string; if (m) models[m] = (models[m] || 0) + 1;
        const mk = r.market as string; if (mk) markets[mk] = (markets[mk] || 0) + 1;
      });
      setInsights({ avgHookScore: count > 0 ? total / count : null, bestModel: Object.entries(models).sort((a, b) => b[1] - a[1])[0]?.[0] || null, mostUsedMarket: Object.entries(markets).sort((a, b) => b[1] - a[1])[0]?.[0] || null, totalAnalyzed: data.length });
    };
    run();
  }, [user.id, dateFilter]);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.from("analyses").select("result, created_at, title").eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(30);
      if (!data?.length) return;
      const feed: IntelItem[] = [];
      const recent = data.slice(0, 5);
      const recentScores = recent.map(a => (a.result as Record<string, unknown>)?.hook_score as number || 0).filter(Boolean);
      const avgRecent = recentScores.length ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0;
      const allScores = data.map(a => (a.result as Record<string, unknown>)?.hook_score as number || 0).filter(Boolean);
      const avgAll = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
      if (avgRecent > 0 && avgAll > 0) {
        const delta = avgRecent - avgAll;
        if (delta > 0.5) feed.push({ id: "trend_up", icon: "📈", color: "#34d399", borderColor: "rgba(52,211,153,0.2)", title: "Hook score improving", body: `Last 5 analyses averaged ${avgRecent.toFixed(1)}/10 — ${delta.toFixed(1)} above your baseline.`, url: "/dashboard/intelligence", tag: "Trend" });
        else if (delta < -0.5) feed.push({ id: "trend_down", icon: "⚠️", color: "#fbbf24", borderColor: "rgba(251,191,36,0.2)", title: "Hook score declining", body: `Recent avg ${avgRecent.toFixed(1)}/10 vs ${avgAll.toFixed(1)} baseline. Time to refresh formats.`, url: "/dashboard/hooks", tag: "Alert" });
      }
      const models = recent.map(a => (a.result as Record<string, unknown>)?.creative_model as string).filter(Boolean);
      const modelCount = models.reduce<Record<string, number>>((acc, m) => { acc[m] = (acc[m] || 0) + 1; return acc; }, {});
      const topModel = Object.entries(modelCount).sort((a, b) => b[1] - a[1])[0];
      if (topModel && topModel[1] >= 3) feed.push({ id: "fatigue", icon: "🔄", color: "#fb923c", borderColor: "rgba(251,146,60,0.2)", title: `${topModel[0]} overuse detected`, body: `Used ${topModel[1]}× in recent work. Creative fatigue may be reducing CTR.`, url: "/dashboard/hooks", tag: "Fatigue" });
      const bestEntry = data.reduce<{ r: Record<string, unknown>; t: string } | null>((best, a) => {
        const s = (a.result as Record<string, unknown>)?.hook_score as number || 0;
        return s > (best?.r?.hook_score as number || 0) ? { r: a.result as Record<string, unknown>, t: a.title || "Untitled" } : best;
      }, null);
      if (bestEntry?.r.creative_model) feed.push({ id: "best", icon: "⚡", color: "#a78bfa", borderColor: "rgba(167,139,250,0.2)", title: `Best: ${String(bestEntry.t).slice(0, 28)}`, body: `Model "${bestEntry.r.creative_model}" — score ${bestEntry.r.hook_score}/10. Replicate this format.`, url: "/dashboard/boards/new", tag: "Insight" });
      if (data.length < 3) feed.push({ id: "nudge", icon: "💡", color: "#60a5fa", borderColor: "rgba(96,165,250,0.2)", title: "Score hooks before spending", body: "Hook Generator predicts performance in 30s — before you commit to production.", url: "/dashboard/hooks", tag: "Tip" });
      setIntelFeed(feed.slice(0, 4));
      const points: Record<string, { sum: number; count: number }> = {};
      data.forEach(a => {
        const score = (a.result as Record<string, unknown>)?.hook_score as number; if (!score) return;
        const day = new Date(a.created_at).toLocaleDateString("en", { month: "short", day: "numeric" });
        if (!points[day]) points[day] = { sum: 0, count: 0 };
        points[day].sum += score; points[day].count++;
      });
      setTrendData(Object.entries(points).slice(-12).map(([date, { sum, count }]) => ({ date, score: Math.round((sum / count) * 10) / 10 })).reverse());
    };
    run();
  }, [user.id]);

  useEffect(() => {
    const run = async () => {
      const [{ data: analyses }, { data: boards }] = await Promise.all([
        supabase.from("analyses").select("id, title, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(4),
        supabase.from("boards").select("id, title, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(4),
      ]);
      setRecentActivity([
        ...(analyses || []).map(a => ({ id: a.id, type: "analysis" as const, title: a.title || "Untitled", created_at: a.created_at })),
        ...(boards || []).map(b => ({ id: b.id, type: "board" as const, title: b.title || "Untitled", created_at: b.created_at })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6));
    };
    run();
  }, [user.id]);

  const timeAgo = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const firstName = profile?.name?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const hasData = insights.totalAnalyzed > 0;
  const isFree = !profile?.plan || profile.plan === "free";

  const quickActions = [
    { title: "Analyze video",     desc: "Hook score in 60s",        icon: BarChart3,  url: "/dashboard/analyses/new", accent: "#a78bfa", badge: "AI" },
    { title: "Create board",      desc: "Production brief",         icon: LayoutGrid, url: "/dashboard/boards/new",   accent: "#60a5fa" },
    { title: "Hook Generator",    desc: "10 angles in 30s",         icon: Cpu,        url: "/dashboard/hooks",        accent: "#fb923c", badge: "AI" },
    { title: "Translate",         desc: "18 markets",               icon: Languages,  url: "/dashboard/translate",    accent: "#34d399" },
    { title: "Templates",         desc: "183 proven formats",       icon: Sparkles,   url: "/dashboard/templates",    accent: "#f472b6" },
    { title: "Pre-flight",        desc: "Check before going live",  icon: Plane,      url: "/dashboard/preflight",    accent: "#fbbf24" },
    { title: "Competitor decode", desc: "Reverse-engineer ads",     icon: Brain,      url: "/dashboard/competitor",   accent: "#22d3ee", badge: "AI" },
    { title: "Persona",           desc: "Define your audience",     icon: Target,     url: "/dashboard/persona",      accent: "#c084fc" },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 page-enter">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] text-white/25 uppercase tracking-[0.2em] mb-1.5" style={mono}>{greeting}</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight" style={{ ...syne, letterSpacing: "-0.03em" }}>
            {firstName}, <GradText>let's ship.</GradText>
          </h1>
          <p className="text-sm text-white/35 mt-1">Your creative intelligence workspace</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:flex items-center px-3 py-1.5 rounded-full text-[10px] capitalize"
            style={{ ...mono, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.4)" }}>
            {profile?.plan || "free"} plan
          </span>
          {isFree && (
            <button onClick={() => navigate("/pricing")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all hover:scale-105 active:scale-95"
              style={{ ...syne, background: "linear-gradient(135deg,#a78bfa,#f472b6)", color: "#000" }}>
              <Zap className="h-3 w-3" /> Upgrade
            </button>
          )}
        </div>
      </div>

      {/* ── USAGE + QUICK ACTIONS — top row ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Usage meters — left */}
        <div className="lg:col-span-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/25 mb-3" style={mono}>This month</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.07)" }}>
            {[
              { label: "Analyses", used: usedAnalyses, limit: limits.analyses, url: "/dashboard/analyses/new", accent: "#a78bfa", icon: BarChart3 },
              { label: "Boards",   used: usedBoards,   limit: limits.boards,   url: "/dashboard/boards/new",   accent: "#60a5fa", icon: LayoutGrid },
              { label: "Videos",   used: usedVideos,   limit: limits.videos,   url: "/dashboard/videos",       accent: "#34d399", icon: Video },
            ].map((s, i, arr) => {
              const pct = s.limit > 0 ? Math.min((s.used / s.limit) * 100, 100) : 0;
              const critical = pct >= 85;
              const isLast = i === arr.length - 1;
              return (
                <button key={s.label} onClick={() => navigate(s.url)}
                  className="w-full flex items-center gap-4 px-5 py-4 transition-all hover:bg-white/[0.03] text-left group"
                  style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${s.accent}15` }}>
                    <s.icon style={{ color: s.accent, width: 17, height: 17 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-white/60">{s.label}</span>
                      <span className="text-xs font-bold" style={{ color: critical ? "#f87171" : s.accent, ...mono }}>
                        {s.used}<span className="text-white/25 font-normal">/{s.limit > 0 ? s.limit : "∞"}</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: pct >= 100 ? "#f87171" : critical ? "#fbbf24" : `linear-gradient(90deg, ${s.accent}80, ${s.accent})` }} />
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-white/15 group-hover:text-white/40 shrink-0 transition-colors" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick actions — right 2/3 */}
        <div className="lg:col-span-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/25 mb-3" style={mono}>Quick actions</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {quickActions.map(a => (
              <button key={a.title} onClick={() => navigate(a.url)}
                className="group relative flex flex-col gap-2.5 p-4 rounded-2xl text-left transition-all duration-200 hover:scale-[1.02]"
                style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.07)" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${a.accent}45`;
                  (e.currentTarget as HTMLElement).style.background = `${a.accent}08`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                  (e.currentTarget as HTMLElement).style.background = "#0f0f0f";
                }}>
                {/* top accent line */}
                <div className="absolute top-0 left-4 right-4 h-px opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(90deg, transparent, ${a.accent}60, transparent)` }} />
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                    style={{ background: `${a.accent}15`, border: `1px solid ${a.accent}20` }}>
                    <a.icon style={{ color: a.accent, width: 16, height: 16 }} />
                  </div>
                  {a.badge && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ ...mono, background: `${a.accent}18`, color: a.accent, border: `1px solid ${a.accent}30` }}>{a.badge}</span>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-white leading-tight" style={syne}>{a.title}</p>
                  <p className="text-[10px] text-white/30 mt-0.5 leading-snug">{a.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ROW ────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-5">

        {/* Intelligence feed — 3/5 */}
        <div className="lg:col-span-3 rounded-2xl overflow-hidden flex flex-col"
          style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(167,139,250,0.12)" }}>
                <Brain className="h-4 w-4" style={{ color: "#a78bfa" }} />
              </div>
              <div>
                <p className="text-sm font-bold text-white" style={syne}>Intelligence feed</p>
                <p className="text-[10px] text-white/25">AI-powered creative insights</p>
              </div>
            </div>
            <button onClick={() => navigate("/dashboard/intelligence")}
              className="text-xs text-white/25 hover:text-white/60 transition-colors flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="p-4 flex-1 space-y-2">
            {intelFeed.length === 0 ? (
              <div className="flex flex-col items-center text-center py-10 gap-4">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)" }}>🧠</div>
                <div>
                  <p className="text-sm font-bold text-white mb-1" style={syne}>No insights yet</p>
                  <p className="text-xs text-white/30 leading-relaxed">Analyze a few videos to unlock<br />AI-powered creative insights</p>
                </div>
                <button onClick={() => navigate("/dashboard/analyses/new")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105"
                  style={{ ...syne, background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
                  <Plus className="h-3.5 w-3.5" /> Start analyzing
                </button>
              </div>
            ) : (
              intelFeed.map(item => (
                <button key={item.id} onClick={() => item.url && navigate(item.url)}
                  className="w-full text-left flex items-start gap-3 p-4 rounded-2xl transition-all group hover:scale-[1.01]"
                  style={{ border: `1px solid ${item.borderColor}`, background: `${item.color}06` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${item.color}10`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${item.color}06`; }}>
                  <span className="text-2xl shrink-0 leading-none mt-0.5">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-white truncate" style={syne}>{item.title}</p>
                      <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase"
                        style={{ ...mono, color: item.color, background: `${item.color}18`, border: `1px solid ${item.color}30` }}>
                        {item.tag}
                      </span>
                    </div>
                    <p className="text-xs text-white/40 leading-relaxed line-clamp-2">{item.body}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/15 group-hover:text-white/50 shrink-0 mt-1 transition-colors" />
                </button>
              ))
            )}
          </div>

          {/* Sparkline */}
          {trendData.length >= 4 && (
            <div className="px-5 pb-5 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-white/25 uppercase tracking-widest" style={mono}>Hook score trend</span>
                <span className="text-[10px] text-white/40" style={mono}>
                  latest: <span style={{ color: "#a78bfa" }}>{trendData[trendData.length - 1]?.score.toFixed(1)}/10</span>
                </span>
              </div>
              <div className="flex items-end gap-1 h-12">
                {trendData.map((p, i) => {
                  const h = Math.round((p.score / 10) * 100);
                  const isLast = i === trendData.length - 1;
                  const color = p.score >= 7 ? "#34d399" : p.score >= 5 ? "#a78bfa" : "#f87171";
                  return (
                    <div key={i} title={`${p.score} · ${p.date}`}
                      className="flex-1 rounded-sm transition-all"
                      style={{ height: `${h}%`, minHeight: 3, background: isLast ? "#fff" : color, opacity: isLast ? 1 : 0.45 }} />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right column — 2/5 */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Performance snapshot */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(52,211,153,0.12)" }}>
                  <TrendingUp className="h-4 w-4" style={{ color: "#34d399" }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white" style={syne}>Performance</p>
                  <p className="text-[10px] text-white/25">Creative metrics</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                {(["7d", "30d", "all"] as const).map(f => (
                  <button key={f} onClick={() => setDateFilter(f)}
                    className="px-2 py-1 rounded-md text-[10px] transition-all"
                    style={{ ...mono, background: dateFilter === f ? "rgba(255,255,255,0.1)" : "transparent", color: dateFilter === f ? "#fff" : "rgba(255,255,255,0.3)" }}>
                    {f === "all" ? "All" : f}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-5">
              {!hasData ? (
                <div className="text-center py-6">
                  <p className="text-3xl mb-3">📊</p>
                  <p className="text-xs text-white/25 leading-relaxed">Analyze videos to see<br />performance metrics here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {[
                    { label: "Avg hook score", value: insights.avgHookScore ? `${insights.avgHookScore.toFixed(1)} / 10` : "—", accent: "#a78bfa" },
                    { label: "Top model",       value: insights.bestModel || "—",         accent: "#f472b6" },
                    { label: "Top market",      value: insights.mostUsedMarket || "—",    accent: "#34d399" },
                    { label: "Total analyzed",  value: String(insights.totalAnalyzed),    accent: "#60a5fa" },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between">
                      <span className="text-xs text-white/35">{s.label}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ color: s.accent, background: `${s.accent}12`, ...mono }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div className="rounded-2xl overflow-hidden flex-1" style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <Clock className="h-4 w-4 text-white/40" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white" style={syne}>Recent work</p>
                  <p className="text-[10px] text-white/25">Latest activity</p>
                </div>
              </div>
              <button onClick={() => navigate("/dashboard/analyses")}
                className="text-xs text-white/25 hover:text-white/60 transition-colors flex items-center gap-1">
                All <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="p-2">
              {recentActivity.length === 0 ? (
                <div className="flex flex-col items-center text-center py-8 gap-3">
                  <span className="text-3xl">📂</span>
                  <p className="text-sm text-white/30 leading-relaxed">Nothing yet —<br />start by analyzing a video</p>
                  <button onClick={() => navigate("/dashboard/analyses/new")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                    style={{ ...syne, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                    <Plus className="h-3 w-3" /> Get started
                  </button>
                </div>
              ) : (
                recentActivity.map(item => (
                  <button key={item.id}
                    onClick={() => navigate(item.type === "analysis" ? `/dashboard/analyses/${item.id}` : `/dashboard/boards/${item.id}`)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group hover:bg-white/[0.04]">
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: item.type === "analysis" ? "rgba(167,139,250,0.12)" : "rgba(96,165,250,0.12)" }}>
                      {item.type === "analysis"
                        ? <BarChart3 className="h-4 w-4" style={{ color: "#a78bfa" }} />
                        : <LayoutGrid className="h-4 w-4" style={{ color: "#60a5fa" }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/70 group-hover:text-white truncate transition-colors">{item.title}</p>
                      <p className="text-[10px] text-white/25 capitalize" style={mono}>{item.type} · {timeAgo(item.created_at)}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-white/15 group-hover:text-white/40 shrink-0 transition-colors" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Upgrade card */}
          {isFree && (
            <div className="rounded-2xl p-5 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.12), rgba(244,114,182,0.07))", border: "1px solid rgba(167,139,250,0.2)" }}>
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(167,139,250,0.25), transparent 70%)" }} />
              <div className="relative">
                <p className="text-sm font-extrabold text-white mb-1" style={syne}>Unlock full access ⚡</p>
                <p className="text-xs text-white/40 mb-4 leading-relaxed">More analyses, boards, and AI tools — from $9/mo.</p>
                <button onClick={() => navigate("/pricing")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                  style={{ ...syne, background: "linear-gradient(135deg,#a78bfa,#f472b6)", color: "#000" }}>
                  See plans <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
