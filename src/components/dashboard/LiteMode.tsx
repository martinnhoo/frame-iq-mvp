import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, ChevronRight, Zap, FileText, Target, BarChart3 } from "lucide-react";
import type { Profile } from "./DashboardLayout";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;
const m = { fontFamily: "'DM Mono', monospace" } as React.CSSProperties;

interface LiteModeProps {
  profile: Profile | null;
  onSwitchToPro: () => void;
}

const PLATFORMS = [
  { id: "tiktok",     label: "TikTok",     emoji: "🎵" },
  { id: "facebook",   label: "Facebook",   emoji: "👤" },
  { id: "instagram",  label: "Reels",      emoji: "📸" },
  { id: "youtube",    label: "YouTube",    emoji: "▶️" },
];

const GOALS = [
  { id: "analyze",   label: "Score my ad hook",          emoji: "📊", desc: "Get a 0–10 hook score + improvements",       route: "/dashboard/analyses/new" },
  { id: "script",    label: "Write a script",             emoji: "✍️", desc: "Generate a video ad script from scratch",    route: "/dashboard/script" },
  { id: "brief",     label: "Create a production brief",  emoji: "🎬", desc: "Scene-by-scene brief for your editor",       route: "/dashboard/boards/new" },
  { id: "preflight", label: "Check before launching",     emoji: "✅", desc: "Pre-flight review of any ad",               route: "/dashboard/preflight" },
];

export default function LiteMode({ profile, onSwitchToPro }: LiteModeProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const name = profile?.name?.split(" ")[0] || "there";

  function handleGoalSelect(goal: typeof GOALS[0]) {
    setSelectedGoal(goal.id);
    if (goal.id === "brief" || goal.id === "script") {
      navigate(goal.route);
      return;
    }
    setStep(2);
  }

  function handleLaunch() {
    const goal = GOALS.find(g => g.id === selectedGoal);
    if (!goal) return;
    const params = selectedPlatform ? `?platform=${selectedPlatform}` : "";
    navigate(goal.route + params);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080810", color: "#fff", ...j }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, background: "#080810", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#a78bfa" }} />
          <span style={{ ...m, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Lite Mode</span>
        </div>
        <button
          onClick={onSwitchToPro}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)", cursor: "pointer" }}
        >
          <Zap size={12} /> Switch to Pro
        </button>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 20px 80px" }}>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 36 }}>
          {[1, 2].map(s => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                background: step >= s ? "#a78bfa" : "rgba(255,255,255,0.06)",
                color: step >= s ? "#000" : "rgba(255,255,255,0.25)",
                transition: "all 0.2s",
              }}>{s}</div>
              {s < 2 && <div style={{ width: 32, height: 1, background: step > s ? "#a78bfa" : "rgba(255,255,255,0.08)" }} />}
            </div>
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 6 }}>
              Hey {name}, what do you want to do?
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", marginBottom: 32 }}>
              Pick one — we'll guide you through the rest.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {GOALS.map(goal => (
                <button
                  key={goal.id}
                  onClick={() => handleGoalSelect(goal)}
                  style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "18px 20px", borderRadius: 16, textAlign: "left",
                    background: selectedGoal === goal.id ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${selectedGoal === goal.id ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.07)"}`,
                    cursor: "pointer", transition: "all 0.15s", width: "100%",
                  }}
                >
                  <span style={{ fontSize: 26, flexShrink: 0 }}>{goal.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 2 }}>{goal.label}</p>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{goal.desc}</p>
                  </div>
                  <ChevronRight size={16} color="rgba(255,255,255,0.2)" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            <button onClick={() => { setStep(1); setSelectedPlatform(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer", marginBottom: 24, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
              ← Back
            </button>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 6 }}>
              Which platform?
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", marginBottom: 32 }}>
              We'll optimize the analysis for that platform's benchmarks.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatform(p.id)}
                  style={{
                    padding: "20px 16px", borderRadius: 16, textAlign: "center",
                    background: selectedPlatform === p.id ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${selectedPlatform === p.id ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.07)"}`,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{p.emoji}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: selectedPlatform === p.id ? "#a78bfa" : "rgba(255,255,255,0.7)" }}>{p.label}</div>
                </button>
              ))}
            </div>
            <button onClick={() => { setSelectedPlatform(null); handleLaunch(); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 13, cursor: "pointer", textDecoration: "underline", marginBottom: 20, padding: 0 }}>
              Skip — I'll set it later
            </button>
            <button
              onClick={handleLaunch}
              disabled={!selectedPlatform}
              style={{
                width: "100%", padding: "16px", borderRadius: 999, fontSize: 15, fontWeight: 800,
                background: selectedPlatform ? "linear-gradient(135deg, #a78bfa, #f472b6)" : "rgba(255,255,255,0.06)",
                color: selectedPlatform ? "#000" : "rgba(255,255,255,0.2)",
                border: "none", cursor: selectedPlatform ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.2s",
              }}
            >
              Let's go <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Quick access — step 1 only */}
        {step === 1 && (
          <div style={{ marginTop: 40 }}>
            <p style={{ ...m, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 14 }}>Or jump to</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "My analyses", route: "/dashboard/analyses", icon: <BarChart3 size={12} /> },
                { label: "My boards",   route: "/dashboard/boards",   icon: <FileText size={12} /> },
                { label: "Personas",    route: "/dashboard/persona",  icon: <Target size={12} /> },
                { label: "Hook generator", route: "/dashboard/hooks", icon: <Sparkles size={12} /> },
              ].map(item => (
                <button
                  key={item.route}
                  onClick={() => navigate(item.route)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, fontSize: 12, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer" }}
                >
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
