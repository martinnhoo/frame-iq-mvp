import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const j = { fontFamily: "'Inter', system-ui, sans-serif" } as const;
const m = { fontFamily: "'Inter', 'Inter', system-ui, sans-serif" } as const;

const LEVELS = [
  {
    n: 1, icon: "👁️", name: "Observer", min: 0, color: "#94a3b8",
    desc: "You just arrived. The tools are open. Start exploring.",
    tasks: [
      "Run your first hook analysis",
      "Generate your first production board",
      "Run a pre-flight check on any ad",
    ],
  },
  {
    n: 2, icon: "🔍", name: "Analyst", min: 5, color: "#60a5fa",
    desc: "You've started scoring your work. You're building signal.",
    tasks: [
      "Complete 5 analyses or boards",
      "Use Hook Generator at least once",
      "Run Learning on the Performance Loop",
    ],
  },
  {
    n: 3, icon: "🎯", name: "Strategist", min: 20, color: "#0ea5e9",
    desc: "You think in systems. Your data starts shaping your briefs.",
    tasks: [
      "Reach 20 total actions across all tools",
      "Import a CSV with campaign data",
      "Ask AdBrief AI a question about your account",
      "Create a persona",
    ],
  },
  {
    n: 4, icon: "🎬", name: "Producer", min: 50, color: "#06b6d4",
    desc: "You're running at volume. The loop is feeding itself.",
    tasks: [
      "Reach 50 total actions",
      "Have at least 3 winning patterns in your Loop",
      "Use Brief Generator to brief an editor",
      "Generate a script using your persona",
    ],
  },
  {
    n: 5, icon: "👑", name: "Director", min: 100, color: "#fbbf24",
    desc: "You run creative like a system, not a gut feeling. The AI knows your account.",
    tasks: [
      "Reach 100 total actions",
      "Have patterns across at least 2 markets",
      "Your avg hook score exceeds 7.0",
      "AdBrief AI references your patterns automatically",
    ],
  },
];

export default function Levels() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#07070f", color: "#fff", ...j }}>
      {/* Ambient */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-10%", left: "30%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(14,165,233,0.05),transparent 70%)", filter: "blur(60px)" }} />
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "60px 24px 80px", position: "relative" }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <button onClick={() => navigate(-1)} style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.25)", background: "none", border: "none", cursor: "pointer", marginBottom: 32, letterSpacing: "0.06em" }}>
            ← back
          </button>
          <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.25)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}>AdBrief Mastery</p>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10, lineHeight: 1.15 }}>
            Five levels.<br />
            <span style={{ background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              One direction.
            </span>
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.65, maxWidth: 480 }}>
            Every action you take — analysis, brief, hook, import — counts toward your level. The higher you go, the more the AI knows about your account.
          </p>
        </div>

        {/* Path */}
        <div style={{ position: "relative" }}>
          {/* vertical line */}
          <div style={{ position: "absolute", left: 19, top: 20, bottom: 20, width: 2, background: "linear-gradient(180deg,rgba(14,165,233,0.3),rgba(6,182,212,0.1))", borderRadius: 999 }} />

          {LEVELS.map((level, i) => (
            <div key={level.n} style={{ display: "flex", gap: 20, marginBottom: i < LEVELS.length - 1 ? 40 : 0, position: "relative" }}>

              {/* Icon node */}
              <div style={{ flexShrink: 0, zIndex: 1 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${level.color}15`, border: `1.5px solid ${level.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                  {level.icon}
                </div>
              </div>

              {/* Content */}
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: level.color }}>{level.name}</h2>
                  <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>
                    {level.min === 0 ? "Start" : `${level.min}+ actions`}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 14 }}>{level.desc}</p>

                {/* Tasks */}
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {level.tasks.map((task, ti) => (
                    <div key={ti} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <CheckCircle2 size={13} style={{ color: `${level.color}60`, flexShrink: 0, marginTop: 2 }} />
                      <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.55 }}>{task}</span>
                    </div>
                  ))}
                </div>

                {/* Connector to next */}
                {i < LEVELS.length - 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 18 }}>
                    <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg,${level.color}20,${LEVELS[i+1].color}20)` }} />
                    <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>next level</span>
                    <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg,${LEVELS[i+1].color}20,transparent)` }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 56, padding: "28px 24px", borderRadius: 20, background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.15)", textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Every action counts.</p>
          <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 20 }}>Analyses, briefs, hooks, imports — all of it moves you forward.</p>
          <button onClick={() => navigate("/dashboard")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 22px", borderRadius: 12, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none" }}>
            Open dashboard <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
