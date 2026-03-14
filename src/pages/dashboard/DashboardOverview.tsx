import { useEffect, useState, useMemo } from "react";
import { useOutletContext, useNavigate, useSearchParams } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3, LayoutGrid, Plus, ArrowRight,
  TrendingUp, Clock, Zap, Target, Brain, Cpu, Languages,
  ChevronRight, Sparkles, Plane, Wand2, Layers, X,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashT } from "@/i18n/dashboardTranslations";
import GamificationWidgets from "@/components/dashboard/GamificationWidgets";
import LiteMode from "@/components/dashboard/LiteMode";

interface InsightsData {
  avgHookScore: number | null;
  bestModel: string | null;
  mostUsedMarket: string | null;
  totalAnalyzed: number;
}
interface ActivityItem {
  id: string; type: "analysis" | "board"; title: string; created_at: string;
}
interface IntelItem {
  id: string; icon: string; color: string; borderColor: string;
  title: string; body: string; url?: string; tag: string;
}

const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const mono = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" } as const;

const Glow = ({ color, size = 300, opacity = 0.12, top = "0%", left = "50%" }: { color: string; size?: number; opacity?: number; top?: string; left?: string }) => (
  <div className="absolute pointer-events-none rounded-full"
    style={{ width: size, height: size, top, left, transform: "translate(-50%, -50%)", background: `radial-gradient(circle, ${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")}, transparent 70%)`, filter: "blur(40px)" }} />
);

const StatBar = ({ used, limit, accent }: { used: number; limit: number; accent: string }) => {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const critical = pct >= 85;
  return (
    <div className="h-1 rounded-full overflow-hidden w-full" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: pct >= 100 ? "#f87171" : critical ? "#fbbf24" : `linear-gradient(90deg, ${accent}80, ${accent})` }} />
    </div>
  );
};

const PLAN_PRICES: Record<string, string> = {
  maker:  "price_1T9sd1Dr9So14XztT3Mqddch",
  pro:    "price_1T9sdfDr9So14XztPR3tI14Y",
  studio: "price_1T9seMDr9So14Xzt0vEJNQIX",
};

export default function DashboardOverview() {
  const { user, profile, usage, usageDetails, selectedPersona } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useLanguage();
  const dt = useDashT(language);
  const [dismissedBanner, setDismissedBanner] = useState(() => localStorage.getItem("frameiq_dismiss_profile_banner") === "1");
  const [isLiteMode, setIsLiteMode] = useState(() => localStorage.getItem("adbrief_mode") === "lite");
  function switchToLite() { localStorage.setItem("adbrief_mode", "lite"); setIsLiteMode(true); }
  function switchToPro()  { localStorage.setItem("adbrief_mode", "pro");  setIsLiteMode(false); }

  const [insights, setInsights] = useState<InsightsData>({ avgHookScore: null, bestModel: null, mostUsedMarket: null, totalAnalyzed: 0 });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [dateFilter, setDateFilter] = useState<"7d" | "30d" | "all">("30d");
  const [intelFeed, setIntelFeed] = useState<IntelItem[]>([]);
  const [trendData, setTrendData] = useState<{ date: string; score: number }[]>([]);

  // Auto-trigger Stripe checkout if ?checkout=plan param is present
  useEffect(() => {
    const checkoutPlan = searchParams.get("checkout");
    if (!checkoutPlan || checkoutPlan === "success") return;
    const priceId = PLAN_PRICES[checkoutPlan];
    if (!priceId) return;
    // Clear param immediately to prevent re-trigger
    searchParams.delete("checkout");
    setSearchParams(searchParams, { replace: true });
    // Invoke checkout
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("create-checkout", {
          body: { price_id: priceId },
        });
        if (error) throw error;
        if (data?.url) window.location.href = data.url;
      } catch (err) {
        console.error("Auto-checkout failed:", err);
      }
    })();
  }, []);

  const planLimits = {
    free:   { analyses: 3,   boards: 3,   preflights: 3 },
    maker:  { analyses: 20,  boards: 20,  preflights: 20 },
    pro:    { analyses: 60,  boards: 60,  preflights: 60 },
    studio: { analyses: 9999, boards: 9999, preflights: 9999 },
  };
  const limits = planLimits[profile?.plan as keyof typeof planLimits] || planLimits.free;

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
        const r = a.result as Record<string, unknown> | null;
        if (!r) return;
        const s = (r.hook_score as number) ?? null;
        if (s !== null) { total += s; count++; }
        const m = r.creative_model as string; if (m) models[m] = (models[m] || 0) + 1;
        const mk = r.market as string; if (mk) markets[mk] = (markets[mk] || 0) + 1;
      });
      setInsights({ avgHookScore: count > 0 ? total / count : null, bestModel: Object.entries(models).sort((a, b) => b[1] - a[1])[0]?.[0] || null, mostUsedMarket: Object.entries(markets).sort((a, b) => b[1] - a[1])[0]?.[0] || null, totalAnalyzed: data.length });
    };
    run();
  }, [user.id, dateFilter]);

  useEffect(() => {
    const run = async () => {
      const [{ data }, { data: memData }] = await Promise.all([
        supabase.from("analyses").select("result, created_at, title")
          .eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(30),
        supabase.from("creative_memory" as never).select("hook_type, hook_score, platform, notes, created_at" as never)
          .eq("user_id" as never, user.id).order("created_at" as never, { ascending: false }).limit(50),
      ]);
      const feed: IntelItem[] = [];

      // Signals from creative_memory (hook feedback)
      const mem = (memData || []) as Array<{ hook_type: string; hook_score: number; platform: string; notes: string; created_at: string }>;
      if (mem.length > 0) {
        const likedHooks = mem.filter(m => m.notes?.includes("liked"));
        const dislikedHooks = mem.filter(m => m.notes?.includes("disliked"));
        if (likedHooks.length > 0) {
          const topType = likedHooks.reduce<Record<string, number>>((acc, m) => { acc[m.hook_type] = (acc[m.hook_type] || 0) + 1; return acc; }, {});
          const best = Object.entries(topType).sort((a, b) => b[1] - a[1])[0];
          if (best) feed.push({ id: "mem_liked", icon: "👍", color: "#34d399", borderColor: "rgba(52,211,153,0.2)", title: `You prefer ${best[0]} hooks`, body: `Liked ${best[1]} of this type. AI will generate more for your campaigns.`, url: "/dashboard/hooks", tag: "Learned" });
        }
        if (dislikedHooks.length >= 2) {
          const topBad = dislikedHooks.reduce<Record<string, number>>((acc, m) => { acc[m.hook_type] = (acc[m.hook_type] || 0) + 1; return acc; }, {});
          const worst = Object.entries(topBad).sort((a, b) => b[1] - a[1])[0];
          if (worst) feed.push({ id: "mem_disliked", icon: "📉", color: "#fb923c", borderColor: "rgba(251,146,60,0.2)", title: `Avoid ${worst[0]} hooks`, body: `Flagged ${worst[1]}× as low quality. AI is deprioritizing this angle.`, url: "/dashboard/hooks", tag: "Learned" });
        }
        const avgMemScore = mem.filter(m => m.hook_score).reduce((a, m) => a + m.hook_score, 0) / mem.filter(m => m.hook_score).length;
        if (avgMemScore > 0) feed.push({ id: "mem_avg", icon: "🎯", color: "#0ea5e9", borderColor: "rgba(14,165,233,0.2)", title: `Hook quality: ${avgMemScore.toFixed(1)}/10 avg`, body: `Based on ${mem.length} signals in your creative memory. Keep rating to improve AI accuracy.`, url: "/dashboard/intelligence", tag: "Signal" });
      }

      if (!data?.length) {
        if (feed.length === 0) feed.push({ id: "nudge", icon: "💡", color: "#60a5fa", borderColor: "rgba(96,165,250,0.2)", title: "Score hooks before spending", body: "Hook Generator predicts performance in 30s — before committing to production.", url: "/dashboard/hooks", tag: "Tip" });
        setIntelFeed(feed.slice(0, 4));
        return;
      }
      const recent = data.slice(0, 5);
      const recentScores = recent.map(a => (a.result as Record<string, unknown>)?.hook_score as number || 0).filter(Boolean);
      const avgRecent = recentScores.length ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0;
      const allScores = data.map(a => (a.result as Record<string, unknown>)?.hook_score as number || 0).filter(Boolean);
      const avgAll = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
      if (avgRecent > 0 && avgAll > 0) {
        const delta = avgRecent - avgAll;
        if (delta > 0.5) feed.push({ id: "trend_up", icon: "📈", color: "#34d399", borderColor: "rgba(52,211,153,0.2)", title: "Hook score improving", body: `Last 5 averaged ${avgRecent.toFixed(1)}/10 — ${delta.toFixed(1)} above your baseline.`, url: "/dashboard/intelligence", tag: "Trend" });
        else if (delta < -0.5) feed.push({ id: "trend_down", icon: "⚠️", color: "#fbbf24", borderColor: "rgba(251,191,36,0.2)", title: "Hook score declining", body: `Recent avg ${avgRecent.toFixed(1)}/10 vs ${avgAll.toFixed(1)} baseline. Refresh formats.`, url: "/dashboard/hooks", tag: "Alert" });
      }
      const models = recent.map(a => (a.result as Record<string, unknown>)?.creative_model as string).filter(Boolean);
      const modelCount = models.reduce<Record<string, number>>((acc, m) => { acc[m] = (acc[m] || 0) + 1; return acc; }, {});
      const topModel = Object.entries(modelCount).sort((a, b) => b[1] - a[1])[0];
      if (topModel && topModel[1] >= 3) feed.push({ id: "fatigue", icon: "🔄", color: "#fb923c", borderColor: "rgba(251,146,60,0.2)", title: `${topModel[0]} overuse detected`, body: `Used ${topModel[1]}× recently. Creative fatigue may be hurting CTR.`, url: "/dashboard/hooks", tag: "Fatigue" });
      const bestEntry = data.reduce<{ r: Record<string, unknown>; t: string } | null>((best, a) => {
        const s = (a.result as Record<string, unknown>)?.hook_score as number || 0;
        return s > (best?.r?.hook_score as number || 0) ? { r: a.result as Record<string, unknown>, t: a.title || "Untitled" } : best;
      }, null);
      if (bestEntry?.r.creative_model) feed.push({ id: "best", icon: "⚡", color: "#0ea5e9", borderColor: "rgba(14,165,233,0.2)", title: `Best: ${String(bestEntry.t).slice(0, 28)}`, body: `Model "${bestEntry.r.creative_model}" scored ${bestEntry.r.hook_score}/10. Replicate this.`, url: "/dashboard/boards/new", tag: "Insight" });
      if (data.length < 3) feed.push({ id: "nudge", icon: "💡", color: "#60a5fa", borderColor: "rgba(96,165,250,0.2)", title: "Score hooks before spending", body: "Hook Generator predicts performance in 30s — before committing to production.", url: "/dashboard/hooks", tag: "Tip" });
      setIntelFeed(feed.slice(0, 4));
      const points: Record<string, { sum: number; count: number }> = {};
      data.forEach(a => {
        const score = (a.result as Record<string, unknown>)?.hook_score as number;
        if (!score) return;
        const day = new Date(a.created_at).toLocaleDateString("en", { month: "short", day: "numeric" });
        if (!points[day]) points[day] = { sum: 0, count: 0 };
        points[day].sum += score; points[day].count++;
      });
      setTrendData(Object.entries(points).slice(-14).map(([date, { sum, count }]) => ({ date, score: Math.round((sum / count) * 10) / 10 })).reverse());
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

  const usedAnalyses = usageDetails?.analyses.used ?? usage.analyses_count;
  const usedBoards = usageDetails?.boards.used ?? usage.boards_count;
  const usedPreflights = (usageDetails as any)?.preflights?.used ?? 0;

  const firstName = profile?.name?.split(" ")[0] || "there";

  // Session greeting — once per login per language, stable via useMemo
  const greeting = useMemo(() => {
    const key = `adbrief_session_greeting_v2_${language}`;
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const pool = dt("session_greetings").split("|").filter(Boolean);
    const picked = pool[Math.floor(Math.random() * pool.length)] || pool[0];
    sessionStorage.setItem(key, picked);
    return picked;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const hasData = insights.totalAnalyzed > 0;

  // Gamification: total actions
  const totalActions = (usageDetails?.analyses?.used ?? usage.analyses_count) + (usageDetails?.boards?.used ?? usage.boards_count) + ((usageDetails as any)?.hooks?.used ?? 0);

  const tools = [
    { title: dt("ov_analyze"),   desc: dt("ov_analyze_desc"),   icon: BarChart3, url: "/dashboard/analyses/new", accent: "#0ea5e9" },
    { title: dt("ov_board"),     desc: dt("ov_board_desc"),     icon: LayoutGrid,url: "/dashboard/boards/new",   accent: "#60a5fa" },
    { title: dt("ov_hooks"),     desc: dt("ov_hooks_desc"),     icon: Cpu,       url: "/dashboard/hooks",        accent: "#fb923c" },
    { title: "Script",           desc: "Full ad script",        icon: Zap,       url: "/dashboard/script",       accent: "#0ea5e9" },
    { title: "Brief",            desc: "Production brief",      icon: Sparkles,  url: "/dashboard/brief",        accent: "#60a5fa" },
    { title: dt("nav_translate"),desc: dt("ov_translate_desc"), icon: Languages, url: "/dashboard/translate",    accent: "#34d399" },
    { title: dt("ov_templates"), desc: dt("ov_templates_desc"), icon: Layers,    url: "/dashboard/templates",    accent: "#06b6d4" },
    { title: dt("nav_preflight"),desc: dt("ov_preflight_desc"), icon: Plane,     url: "/dashboard/preflight",    accent: "#fbbf24" },
    { title: dt("nav_persona"),  desc: dt("ov_persona_desc"),   icon: Target,    url: "/dashboard/persona",      accent: "#c084fc" },
    { title: "Competitor",       desc: "Decode competitor ads", icon: Brain,     url: "/dashboard/competitor",   accent: "#34d399" },
  ];

  const usageBlocks = [
    { label: dt("ov_analyses"), used: usedAnalyses, limit: limits.analyses, url: "/dashboard/analyses/new", accent: "#0ea5e9", icon: BarChart3 },
    { label: dt("ov_boards"),   used: usedBoards,   limit: limits.boards,   url: "/dashboard/boards/new",   accent: "#60a5fa", icon: LayoutGrid },
    { label: dt("ov_preflights"), used: usedPreflights, limit: limits.preflights, url: "/dashboard/preflight", accent: "#fbbf24", icon: Plane },
  ];

  if (isLiteMode) return <LiteMode profile={profile} onSwitchToPro={switchToPro} />;
  if (isLiteMode) return <LiteMode profile={profile} onSwitchToPro={switchToPro} />;

  // Compute fatigue signal — cross-reference intel feed signals
  const avgScore = insights.avgHookScore ?? 0;
  const hasTrendDown = intelFeed.some(f => f.id === "trend_down");
  const hasFatigueSignal = intelFeed.some(f => f.id === "fatigue");
  const fatigue = hasData && (avgScore < 5 || hasTrendDown || hasFatigueSignal);
  const winning = hasData && avgScore >= 7.5 && !fatigue;

  return (
    <div className="min-h-full" style={{ background: "#07070f" }}>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">

        {/* ── TOP: Name + greeting + toggle ─────────────────── */}
        <div className="flex items-start justify-between gap-4 pt-1">
          <div>
            <GamificationWidgets userId={user.id} dt={dt} totalActions={totalActions} />
            <h1 className="text-2xl font-extrabold mt-3 text-white" style={{ letterSpacing: "-0.03em", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
              {firstName}, <span style={{ background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{dt("ov_lets_ship")}</span>
            </h1>
            <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{greeting}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <div style={{ display: "flex", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: 2, gap: 0 }}>
              <button onClick={switchToLite} style={{ ...syne, fontSize: 11, fontWeight: 700, padding: "5px 14px", borderRadius: 999, cursor: "pointer", background: "transparent", color: "rgba(255,255,255,0.35)", border: "none", transition: "all 0.2s", letterSpacing: "0.04em" }}>LITE</button>
              <button style={{ ...syne, fontSize: 11, fontWeight: 700, padding: "5px 14px", borderRadius: 999, cursor: "default", background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", color: "#000", border: "none", letterSpacing: "0.04em" }}>PRO</button>
            </div>
            {(!profile?.plan || profile.plan === "free") && (
              <button onClick={() => navigate("/pricing")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ ...syne, background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", color: "#000" }}>
                Upgrade
              </button>
            )}
          </div>
        </div>

        {/* ── ONBOARDING — new users ─────────────────────────── */}
        {totalActions === 0 && (
          <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg,rgba(14,165,233,0.1),rgba(6,182,212,0.06))", border: "1px solid rgba(14,165,233,0.25)" }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="text-4xl">🎬</div>
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-widest text-sky-400/60 mb-1">Start here</p>
                <h2 className="text-base font-extrabold text-white mb-1">Upload your first ad. Get a Hook Score in 60s.</h2>
                <p className="text-sm text-white/40">Drop any video — TikTok, Reel, YouTube Short, Meta. AdBrief tells you exactly what's working and what to fix.</p>
              </div>
              <button onClick={() => navigate("/dashboard/analyses/new")} className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-black" style={{ background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                Analyze my first ad →
              </button>
            </div>
          </div>
        )}

        {/* ── ALERT BANNER — fatigue or winning ─────────────── */}
        {fatigue && (
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}>
            <span className="text-lg shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="text-xs font-bold text-amber-300">Creative fatigue detected</p>
              <p className="text-[11px] text-amber-300/60 mt-0.5">Avg hook score {avgScore.toFixed(1)}/10 — below threshold. Your CPMr may be rising. Time to refresh creative angles.</p>
            </div>
            <button onClick={() => navigate("/dashboard/hooks")} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-black" style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)" }}>Generate hooks →</button>
          </div>
        )}
        {winning && !fatigue && (
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}>
            <span className="text-lg shrink-0">🚀</span>
            <div className="flex-1">
              <p className="text-xs font-bold text-emerald-400">Strong creative account</p>
              <p className="text-[11px] text-emerald-400/60 mt-0.5">Avg hook score {avgScore.toFixed(1)}/10 — above 7.5. Andromeda is learning your winning patterns. Scale what's working.</p>
            </div>
            <button onClick={() => navigate("/dashboard/loop/ai")} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-black" style={{ background: "linear-gradient(135deg,#34d399,#10b981)" }}>Ask AI what to scale →</button>
          </div>
        )}

        {/* ── INTELLIGENCE FEED + QUICK ACTIONS ─────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Intelligence feed — 2 cols */}
          <div className="md:col-span-2 rounded-2xl overflow-hidden" style={{ background: "#0d0d15", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2">
                <Brain size={14} style={{ color: "#0ea5e9" }} />
                <span className="text-xs font-bold text-white/70">Intelligence Feed</span>
              </div>
              <button onClick={() => navigate("/dashboard/loop/ai")} className="text-[11px] text-sky-400/60 hover:text-sky-400 transition-colors flex items-center gap-1">
                Ask AI <ArrowRight size={11} />
              </button>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {intelFeed.length === 0 ? (
                <div className="px-4 py-5 space-y-2">
                  {[
                    { icon: "🎬", title: "Analyze your first ad", body: "Upload any video — AdBrief scores the hook, flags weak points, and tells you exactly what to fix.", url: "/dashboard/analyses/new", tag: "Start here" },
                    { icon: "⚡", title: "Generate hooks before producing", body: "Test 10 hook angles in 30s before committing budget to production.", url: "/dashboard/hooks", tag: "Save budget" },
                    { icon: "📋", title: "Brief your editor with AI", body: "Turn any insight into a production-ready brief. No back-and-forth, no guesswork.", url: "/dashboard/brief", tag: "Efficiency" },
                  ].map((tip, i) => (
                    <button key={i} onClick={() => navigate(tip.url)}
                      className="w-full flex items-start gap-3 p-3 rounded-xl text-left hover:bg-white/[0.03] transition-colors"
                      style={{ border: "1px solid rgba(255,255,255,0.05)" }}>
                      <span className="text-xl shrink-0">{tip.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-xs font-semibold text-white/70">{tip.title}</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(14,165,233,0.12)", color: "#0ea5e9" }}>{tip.tag}</span>
                        </div>
                        <p className="text-[11px] text-white/30 leading-relaxed">{tip.body}</p>
                      </div>
                      <ChevronRight size={13} className="text-white/15 shrink-0 mt-1" />
                    </button>
                  ))}
                </div>
              ) : intelFeed.map(item => (
                <button key={item.id} onClick={() => item.url && navigate(item.url)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm mt-0.5"
                    style={{ background: `${item.color}12`, border: `1px solid ${item.color}25` }}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-semibold text-white/80 truncate">{item.title}</p>
                      <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${item.color}18`, color: item.color }}>{item.tag}</span>
                    </div>
                    <p className="text-[11px] text-white/35 leading-relaxed line-clamp-2">{item.body}</p>
                  </div>
                  {item.url && <ChevronRight size={13} className="text-white/15 shrink-0 mt-1" />}
                </button>
              ))}
            </div>
          </div>

          {/* Quick actions + stats — 1 col */}
          <div className="flex flex-col gap-3">

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Hook Score", value: hasData && insights.avgHookScore ? `${insights.avgHookScore.toFixed(1)}/10` : "—", color: "#34d399", sub: `${insights.totalAnalyzed} analyzed` },
                { label: "Analyses", value: String(usedAnalyses), color: "#0ea5e9", sub: `/ ${limits.analyses > 9990 ? "∞" : limits.analyses}` },
                { label: "Boards", value: String(usedBoards), color: "#60a5fa", sub: `/ ${limits.boards > 9990 ? "∞" : limits.boards}` },
                { label: "Est. saved", value: usedAnalyses > 0 ? `$${(usedAnalyses * 47).toLocaleString()}` : "—", color: "#fbbf24", sub: "~$47 per caught ad" },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3" style={{ background: "#0d0d15", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xl font-extrabold" style={{ color: s.color, fontFamily: "'Plus Jakarta Sans',sans-serif", letterSpacing: "-0.04em" }}>{s.value}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">{s.label}</p>
                  <p className="text-[10px] text-white/20">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Primary CTA */}
            <button onClick={() => navigate("/dashboard/analyses/new")}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-bold text-sm text-black"
              style={{ background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
              <span className="flex items-center gap-2"><BarChart3 size={16} /> Analyze new ad</span>
              <ArrowRight size={15} />
            </button>

            {/* Secondary CTAs */}
            {[
              { label: "Generate hooks", icon: Zap, url: "/dashboard/hooks", color: "#fb923c" },
              { label: "Create brief", icon: Wand2, url: "/dashboard/brief", color: "#60a5fa" },
              { label: "Ask AdBrief AI", icon: Brain, url: "/dashboard/loop/ai", color: "#0ea5e9" },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.url)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-all hover:bg-white/[0.04]"
                style={{ background: "#0d0d15", border: "1px solid rgba(255,255,255,0.07)", fontFamily: "'Plus Jakarta Sans',sans-serif", color: "rgba(255,255,255,0.65)" }}>
                <span className="flex items-center gap-2"><a.icon size={14} style={{ color: a.color }} />{a.label}</span>
                <ChevronRight size={13} className="text-white/20" />
              </button>
            ))}
          </div>
        </div>

        {/* ── RECENT WORK ────────────────────────────────────── */}
        {recentActivity.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: "#0d0d15", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-white/30" />
                <span className="text-xs font-bold text-white/50">Recent work</span>
              </div>
              <button onClick={() => navigate("/dashboard/analyses")} className="text-[11px] text-white/25 hover:text-white/50 transition-colors">View all →</button>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {recentActivity.map(item => (
                <button key={item.id} onClick={() => navigate(`/dashboard/${item.type === "analysis" ? "analyses" : "boards"}/${item.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: item.type === "analysis" ? "rgba(14,165,233,0.12)" : "rgba(96,165,250,0.12)" }}>
                    {item.type === "analysis" ? <BarChart3 size={11} style={{ color: "#0ea5e9" }} /> : <LayoutGrid size={11} style={{ color: "#60a5fa" }} />}
                  </div>
                  <span className="flex-1 text-xs text-white/60 truncate">{item.title}</span>
                  <span className="text-[10px] text-white/20 shrink-0">{timeAgo(item.created_at)}</span>
                  <ChevronRight size={12} className="text-white/15 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── ALL TOOLS ──────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25 mb-3">All tools</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {tools.map(tool => (
              <button key={tool.title} onClick={() => navigate(tool.url)}
                className="flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:bg-white/[0.04]"
                style={{ background: "#0d0d15", border: "1px solid rgba(255,255,255,0.06)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${tool.accent}35`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${tool.accent}12`, border: `1px solid ${tool.accent}20` }}>
                  <tool.icon size={15} style={{ color: tool.accent }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white/75 truncate">{tool.title}</p>
                  <p className="text-[10px] text-white/30 truncate">{tool.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
