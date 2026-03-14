import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, ChevronRight, BarChart3, FileText,
  Target, Sparkles, Brain, Cpu, Languages, Zap,
  TrendingUp, Lightbulb, Layers, Plane, Clock,
  CheckCircle2, Star, Rocket,
} from "lucide-react";
import type { Profile } from "./DashboardLayout";
import { supabase } from "@/integrations/supabase/client";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;
const m = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;

interface LiteModeProps {
  profile: Profile | null;
  onSwitchToPro: () => void;
}

const GOALS = [
  { id: "analyze",   emoji: "📊", label: "Score my hook",            desc: "Get a 0–10 hook score + actionable fixes in 30 seconds",  route: "/dashboard/analyses/new", color: "#a78bfa" },
  { id: "script",    emoji: "✍️", label: "Write a video script",      desc: "Full ad script with VO, visuals & on-screen text",        route: "/dashboard/script",       color: "#60a5fa" },
  { id: "brief",     emoji: "🎬", label: "Create a campaign brief",   desc: "Strategy doc ready for your team or editor",              route: "/dashboard/brief",        color: "#f472b6" },
  { id: "preflight", emoji: "✅", label: "Pre-flight check",          desc: "Catch mistakes before you spend a single dollar",         route: "/dashboard/preflight",    color: "#fbbf24" },
  { id: "hooks",     emoji: "⚡", label: "Generate hook variations",  desc: "10+ hooks for the same concept, ranked by strength",      route: "/dashboard/hooks",        color: "#fb923c" },
  { id: "persona",   emoji: "🧠", label: "Build audience persona",    desc: "Deep profile of who you're targeting — AI-generated",     route: "/dashboard/persona",      color: "#c084fc" },
];

interface QuickStat {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

export default function LiteMode({ profile, onSwitchToPro }: LiteModeProps) {
  const navigate = useNavigate();
  const name = profile?.name?.split(" ")[0] || "there";
  const [stats, setStats] = useState<QuickStat[]>([]);
  const [recentTitles, setRecentTitles] = useState<{ title: string; type: string; time: string }[]>([]);

  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      const [{ count: analysisCount }, { count: boardCount }, { data: recentAnalyses }] = await Promise.all([
        supabase.from("analyses").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
        supabase.from("boards").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
        supabase.from("analyses").select("title, created_at, result").eq("user_id", profile.id).eq("status", "completed").order("created_at", { ascending: false }).limit(5),
      ]);

      const scores = (recentAnalyses || []).map(a => (a.result as any)?.hook_score as number).filter(Boolean);
      const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";

      setStats([
        { label: "Analyses", value: String(analysisCount || 0), icon: <BarChart3 size={14} />, color: "#a78bfa" },
        { label: "Boards", value: String(boardCount || 0), icon: <Layers size={14} />, color: "#60a5fa" },
        { label: "Avg Hook", value: avgScore, icon: <Zap size={14} />, color: "#fbbf24" },
        { label: "Plan", value: (profile.plan || "free").toUpperCase(), icon: <Star size={14} />, color: "#f472b6" },
      ]);

      const timeAgo = (d: string) => {
        const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
        if (mins < 60) return `${mins}m`;
        const h = Math.floor(mins / 60);
        if (h < 24) return `${h}h`;
        return `${Math.floor(h / 24)}d`;
      };

      setRecentTitles(
        (recentAnalyses || []).slice(0, 3).map(a => ({
          title: a.title || "Untitled analysis",
          type: "analysis",
          time: timeAgo(a.created_at),
        }))
      );
    };
    load();
  }, [profile?.id]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ minHeight: "100vh", background: "#07070f", color: "#fff", ...j, position: "relative", overflow: "hidden" }}>

      {/* Ambient glows */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-10%", left: "20%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.06), transparent 70%)", filter: "blur(60px)" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(244,114,182,0.04), transparent 70%)", filter: "blur(60px)" }} />
      </div>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", position: "sticky", top: 0, background: "rgba(7,7,15,0.9)", backdropFilter: "blur(16px)", zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#a78bfa,#f472b6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={13} color="#000" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>AdBrief</span>
        </div>

        {/* Binance-style segmented toggle — LITE active */}
        <div style={{ display: "flex", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: 2, gap: 0 }}>
          <button
            style={{ ...j, fontSize: 11, fontWeight: 700, padding: "5px 14px", borderRadius: 999, cursor: "default", background: "linear-gradient(135deg, #a78bfa, #f472b6)", color: "#000", border: "none", letterSpacing: "0.04em", boxShadow: "0 2px 8px rgba(167,139,250,0.3)" }}
          >LITE</button>
          <button
            onClick={onSwitchToPro}
            style={{ ...j, fontSize: 11, fontWeight: 700, padding: "5px 14px", borderRadius: 999, cursor: "pointer", background: "transparent", color: "rgba(255,255,255,0.35)", border: "none", transition: "all 0.2s", letterSpacing: "0.04em" }}
          >PRO</button>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px 100px", position: "relative" }}>

        {/* Greeting */}
        <p style={{ ...m, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 6 }}>{greeting}</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.15, marginBottom: 6 }}>
          {name}, <span style={{ background: "linear-gradient(135deg,#a78bfa,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>what are we building?</span>
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 28, lineHeight: 1.5 }}>
          Pick an action below and the AI handles the rest. Every output uses your active persona for context.
        </p>

        {/* Quick stats row */}
        {stats.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 28 }}>
            {stats.map(s => (
              <div key={s.label} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 12px", textAlign: "center" }}>
                <div style={{ color: s.color, display: "flex", justifyContent: "center", marginBottom: 6 }}>{s.icon}</div>
                <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>{s.value}</p>
                <p style={{ ...m, fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Actions — main goal cards */}
        <p style={{ ...m, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 12 }}>Quick actions</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 32 }}>
          {GOALS.map(g => (
            <button
              key={g.id}
              onClick={() => navigate(g.route)}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", width: "100%", textAlign: "left",
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16,
                cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.06)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${g.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                {g.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 2 }}>{g.label}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.4 }}>{g.desc}</p>
              </div>
              <ArrowRight size={14} color="rgba(255,255,255,0.12)" style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>

        {/* Recent activity */}
        {recentTitles.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <p style={{ ...m, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 12 }}>Recent</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {recentTitles.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <BarChart3 size={12} color="rgba(255,255,255,0.2)" />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                  <span style={{ ...m, fontSize: 10, color: "rgba(255,255,255,0.15)" }}>{r.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pro upgrade nudge */}
        {(!profile?.plan || profile.plan === "free") && (
          <button
            onClick={onSwitchToPro}
            style={{
              width: "100%", padding: "16px 20px", borderRadius: 16, cursor: "pointer",
              background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)",
              display: "flex", alignItems: "center", gap: 14, textAlign: "left",
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#a78bfa,#f472b6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Rocket size={18} color="#000" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa", marginBottom: 2 }}>Switch to PRO view</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.4 }}>Full dashboard with analytics, trends, intel feed & all creative tools.</p>
            </div>
            <ChevronRight size={14} color="rgba(167,139,250,0.4)" />
          </button>
        )}

        {/* Quick links */}
        <div style={{ marginTop: 28 }}>
          <p style={{ ...m, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.15)", marginBottom: 10 }}>Quick jump</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { label: "My analyses", route: "/dashboard/analyses", icon: <BarChart3 size={11} /> },
              { label: "My boards",   route: "/dashboard/boards",   icon: <FileText size={11} /> },
              { label: "Personas",    route: "/dashboard/persona",  icon: <Target size={11} /> },
              { label: "Templates",   route: "/dashboard/templates", icon: <Layers size={11} /> },
              { label: "Translate",   route: "/dashboard/translate", icon: <Languages size={11} /> },
            ].map(item => (
              <button key={item.route} onClick={() => navigate(item.route)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 999, fontSize: 11, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "all 0.15s" }}>
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
