import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, ChevronRight, BarChart3, FileText,
  Target, Sparkles, Globe, ShoppingBag, Gamepad2,
  TrendingUp, Heart, Laugh, AlertTriangle, Eye, Star, Users, Monitor, Film, Tv2, Smartphone,
} from "lucide-react";
import type { Profile } from "./DashboardLayout";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;
const m = { fontFamily: "'DM Mono', monospace" } as React.CSSProperties;

interface LiteModeProps {
  profile: Profile | null;
  onSwitchToPro: () => void;
}

const GOALS = [
  { id: "analyze",   emoji: "📊", label: "Score my hook",            desc: "0–10 hook score + exact fixes",              route: "/dashboard/analyses/new" },
  { id: "script",    emoji: "✍️", label: "Write a video script",      desc: "Full script from a single prompt",           route: "/dashboard/script" },
  { id: "brief",     emoji: "🎬", label: "Create a production brief", desc: "Scene-by-scene brief ready for your editor", route: "/dashboard/boards/new" },
  { id: "preflight", emoji: "✅", label: "Pre-flight check",          desc: "Catch mistakes before you spend a dollar",   route: "/dashboard/preflight" },
  { id: "hooks",     emoji: "⚡", label: "Generate hook variations",  desc: "10+ hooks for the same concept",             route: "/dashboard/hooks" },
  { id: "persona",   emoji: "🧠", label: "Build an audience persona", desc: "Deep profile of who you're targeting",       route: "/dashboard/persona" },
];

const PLATFORMS = [
  { id: "tiktok",    emoji: "🎵", label: "TikTok" },
  { id: "facebook",  emoji: "👤", label: "Facebook" },
  { id: "instagram", emoji: "📸", label: "Reels" },
  { id: "youtube",   emoji: "▶️", label: "YouTube" },
];

const INDUSTRIES = [
  { id: "ecommerce", emoji: "🛍️", label: "E-commerce" },
  { id: "igaming",   emoji: "🎮", label: "iGaming" },
  { id: "saas",      emoji: "💻", label: "SaaS / App" },
  { id: "finance",   emoji: "💰", label: "Finance" },
  { id: "health",    emoji: "❤️", label: "Health" },
  { id: "other",     emoji: "🌐", label: "Other" },
];

const AUDIENCES = [
  { id: "cold",      emoji: "🧊", label: "Cold traffic",    desc: "Never heard of you" },
  { id: "warm",      emoji: "🔥", label: "Warm / retarget", desc: "Visited or engaged before" },
  { id: "lookalike", emoji: "👥", label: "Lookalike",       desc: "Similar to existing customers" },
  { id: "broad",     emoji: "🌍", label: "Broad",           desc: "No specific targeting" },
];

const EMOTIONS = [
  { id: "curiosity",  emoji: "🔍", label: "Curiosity" },
  { id: "social",     emoji: "⭐", label: "Social proof" },
  { id: "fear",       emoji: "⚠️", label: "Fear / urgency" },
  { id: "humor",      emoji: "😄", label: "Humor" },
  { id: "aspiration", emoji: "🚀", label: "Aspiration" },
  { id: "community",  emoji: "🤝", label: "Community" },
];

const STEPS = [
  { num: 1, label: "Goal" },
  { num: 2, label: "Platform" },
  { num: 3, label: "Context" },
  { num: 4, label: "Angle" },
];

const card = (selected: boolean): React.CSSProperties => ({
  background: selected ? "rgba(167,139,250,0.10)" : "rgba(255,255,255,0.025)",
  border: `1px solid ${selected ? "rgba(167,139,250,0.45)" : "rgba(255,255,255,0.07)"}`,
  borderRadius: 16, cursor: "pointer", transition: "all 0.15s",
});

const pillStyle = (selected: boolean): React.CSSProperties => ({
  background: selected ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.03)",
  border: `1px solid ${selected ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.07)"}`,
  borderRadius: 999, cursor: "pointer", transition: "all 0.15s",
  padding: "9px 16px",
});

export default function LiteMode({ profile, onSwitchToPro }: LiteModeProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [industry, setIndustry] = useState<string | null>(null);
  const [audience, setAudience] = useState<string | null>(null);
  const [emotion, setEmotion] = useState<string | null>(null);

  const name = profile?.name?.split(" ")[0] || "there";

  function goBack() { setStep(s => Math.max(1, s - 1)); }

  function handleGoal(g: typeof GOALS[0]) {
    setGoal(g.id);
    if (["brief", "script", "persona", "hooks"].includes(g.id)) {
      navigate(g.route);
      return;
    }
    setStep(2);
  }

  function handlePlatform(p: string) { setPlatform(p); setStep(3); }
  function handleAudience(a: string) { setAudience(a); setStep(4); }

  function handleLaunch() {
    const g = GOALS.find(x => x.id === goal);
    if (!g) return;
    const params = new URLSearchParams();
    if (platform) params.set("platform", platform);
    if (industry) params.set("industry", industry);
    if (audience) params.set("audience", audience);
    if (emotion)  params.set("angle", emotion);
    navigate(`${g.route}?${params.toString()}`);
  }

  const chips = [
    goal     && GOALS.find(x => x.id === goal)?.label,
    platform && PLATFORMS.find(x => x.id === platform)?.label,
    industry && INDUSTRIES.find(x => x.id === industry)?.label,
    audience && AUDIENCES.find(x => x.id === audience)?.label,
  ].filter(Boolean) as string[];

  return (
    <div style={{ minHeight: "100vh", background: "#07070f", color: "#fff", ...j, position: "relative", overflow: "hidden" }}>

      {/* Ambient */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-10%", left: "20%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.07), transparent 70%)", filter: "blur(60px)" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(244,114,182,0.05), transparent 70%)", filter: "blur(60px)" }} />
      </div>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", position: "sticky", top: 0, background: "rgba(7,7,15,0.85)", backdropFilter: "blur(12px)", zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#a78bfa,#f472b6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={13} color="#000" />
          </div>
          <div>
            <p style={{ ...m, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", lineHeight: 1 }}>AdBrief</p>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", lineHeight: 1.2 }}>Lite Mode</p>
          </div>
        </div>

        {/* Toggle — knob LEFT = Lite active */}
        <button onClick={onSwitchToPro} title="Switch back to Pro" style={{ ...j, display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, padding: "4px 10px 4px 5px", gap: 6, cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", width: 36, height: 20, borderRadius: 999, background: "rgba(167,139,250,0.2)", border: "1px solid rgba(167,139,250,0.3)", padding: "2px 3px" }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "linear-gradient(135deg,#a78bfa,#f472b6)", boxShadow: "0 0 6px rgba(167,139,250,0.6)" }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.04em" }}>LITE</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em" }}>PRO</span>
        </button>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 20px 100px", position: "relative" }}>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 40 }}>
          {STEPS.map((s, i) => (
            <div key={s.num} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, background: step > s.num ? "linear-gradient(135deg,#a78bfa,#f472b6)" : step === s.num ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)", border: step === s.num ? "1.5px solid #a78bfa" : "1.5px solid transparent", color: step > s.num ? "#000" : step === s.num ? "#a78bfa" : "rgba(255,255,255,0.2)", transition: "all 0.3s", boxShadow: step === s.num ? "0 0 12px rgba(167,139,250,0.3)" : "none" }}>
                  {step > s.num ? "✓" : s.num}
                </div>
                <span style={{ ...m, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: step >= s.num ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)" }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, margin: "0 6px", marginBottom: 18, background: step > s.num ? "linear-gradient(90deg,#a78bfa,#f472b6)" : "rgba(255,255,255,0.06)", transition: "all 0.4s" }} />}
            </div>
          ))}
        </div>

        {/* Summary chips */}
        {chips.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
            {chips.map(c => <span key={c} style={{ ...m, fontSize: 10, padding: "4px 10px", borderRadius: 999, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa", letterSpacing: "0.06em" }}>{c}</span>)}
          </div>
        )}

        {/* STEP 1 — Goal */}
        {step === 1 && (
          <div>
            <p style={{ ...m, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>What do you want to do?</p>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.1, marginBottom: 28 }}>
              Hey {name},<br />
              <span style={{ background: "linear-gradient(135deg,#a78bfa,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>pick your starting point.</span>
            </h1>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {GOALS.map(g => (
                <button key={g.id} onClick={() => handleGoal(g)} style={{ ...card(goal === g.id), display: "flex", alignItems: "center", gap: 16, padding: "16px 18px", width: "100%", textAlign: "left" }}>
                  <span style={{ fontSize: 24, flexShrink: 0, width: 36, textAlign: "center" }}>{g.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 2 }}>{g.label}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{g.desc}</p>
                  </div>
                  <ChevronRight size={14} color="rgba(255,255,255,0.15)" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2 — Platform */}
        {step === 2 && (
          <div>
            <button onClick={goBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer", marginBottom: 20, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>← Back</button>
            <p style={{ ...m, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>Platform</p>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>Where will this run?</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 28 }}>We'll calibrate benchmarks and format recommendations per platform.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => handlePlatform(p.id)} style={{ ...card(platform === p.id), padding: "22px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 30, marginBottom: 10 }}>{p.emoji}</div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: platform === p.id ? "#a78bfa" : "rgba(255,255,255,0.75)" }}>{p.label}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(3)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", fontSize: 12, cursor: "pointer", textDecoration: "underline", marginTop: 18, padding: 0, display: "block" }}>Skip — decide later</button>
          </div>
        )}

        {/* STEP 3 — Industry + Audience */}
        {step === 3 && (
          <div>
            <button onClick={goBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer", marginBottom: 20, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>← Back</button>
            <p style={{ ...m, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>Context</p>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 28 }}>Tell us about your campaign.</h1>

            <p style={{ ...m, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Industry</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 28 }}>
              {INDUSTRIES.map(ind => (
                <button key={ind.id} onClick={() => setIndustry(ind.id)} style={{ ...card(industry === ind.id), padding: "14px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{ind.emoji}</div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: industry === ind.id ? "#a78bfa" : "rgba(255,255,255,0.6)" }}>{ind.label}</p>
                </button>
              ))}
            </div>

            <p style={{ ...m, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Audience</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
              {AUDIENCES.map(a => (
                <button key={a.id} onClick={() => setAudience(a.id)} style={{ ...pillStyle(audience === a.id), display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%" }}>
                  <span style={{ fontSize: 18 }}>{a.emoji}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: audience === a.id ? "#a78bfa" : "rgba(255,255,255,0.8)" }}>{a.label}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{a.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <button onClick={() => handleAudience(audience || "broad")} style={{ width: "100%", padding: "14px", borderRadius: 999, fontSize: 14, fontWeight: 800, background: (audience || industry) ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)", color: (audience || industry) ? "#a78bfa" : "rgba(255,255,255,0.2)", border: `1px solid ${(audience || industry) ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              Continue <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* STEP 4 — Angle */}
        {step === 4 && (
          <div>
            <button onClick={goBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer", marginBottom: 20, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>← Back</button>
            <p style={{ ...m, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>Creative angle</p>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>What emotion drives this ad?</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 28 }}>This shapes hook style, tone, and script direction.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
              {EMOTIONS.map(e => (
                <button key={e.id} onClick={() => setEmotion(e.id)} style={{ ...card(emotion === e.id), padding: "18px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>{e.emoji}</div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: emotion === e.id ? "#a78bfa" : "rgba(255,255,255,0.75)" }}>{e.label}</p>
                </button>
              ))}
            </div>

            {/* Brief summary */}
            <div style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: 16, padding: "14px 16px", marginBottom: 20 }}>
              <p style={{ ...m, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>Your brief</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {chips.map(c => <span key={c} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.08)" }}>{c}</span>)}
                {emotion && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>{EMOTIONS.find(e => e.id === emotion)?.label}</span>}
              </div>
            </div>

            <button onClick={handleLaunch} style={{ width: "100%", padding: "16px", borderRadius: 999, fontSize: 15, fontWeight: 800, background: "linear-gradient(135deg,#a78bfa,#f472b6)", color: "#000", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 24px rgba(167,139,250,0.35)" }}>
              Generate now <ArrowRight size={16} />
            </button>
            <button onClick={() => { setEmotion(null); handleLaunch(); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", fontSize: 12, cursor: "pointer", textDecoration: "underline", marginTop: 14, padding: 0, display: "block", width: "100%", textAlign: "center" }}>
              Skip angle — just go
            </button>
          </div>
        )}

        {/* Quick access step 1 */}
        {step === 1 && (
          <div style={{ marginTop: 36 }}>
            <p style={{ ...m, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)", marginBottom: 12 }}>Quick jump</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "My analyses", route: "/dashboard/analyses", icon: <BarChart3 size={11} /> },
                { label: "My boards",   route: "/dashboard/boards",   icon: <FileText size={11} /> },
                { label: "Personas",    route: "/dashboard/persona",  icon: <Target size={11} /> },
                { label: "Hooks",       route: "/dashboard/hooks",    icon: <Sparkles size={11} /> },
              ].map(item => (
                <button key={item.route} onClick={() => navigate(item.route)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 999, fontSize: 11, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
