import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { ArrowRight, Check } from "lucide-react";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" };

const FEATURES = [
  {
    icon: "🎬", accent: "#0ea5e9",
    tag: "Core",
    title: "Ad Analysis",
    headline: "Know exactly why your ad is burning budget — in 60 seconds.",
    desc: "Upload any video. AdBrief scores the hook, flags the weak point, and tells you what to fix before you spend another dollar. Average team saves $340/week catching bad hooks early.",
    bullets: ["Hook score 0–10 with breakdown", "Identifies weak CTA, wrong pacing, format mismatch", "Improvement suggestions ready to act on", "Works with TikTok, Meta, YouTube, Reels"],
    url: "/dashboard/analyses/new",
    cta: "Analyze your first ad free",
  },
  {
    icon: "⚡", accent: "#fb923c",
    tag: "AI",
    title: "Hook Generator",
    headline: "Test 10 hook angles before committing a dollar to production.",
    desc: "Stop producing ads with weak hooks. Generate 10 hook variations in 30 seconds, each with a predicted CTR score based on your account data.",
    bullets: ["10 hooks per generation with predicted CTR", "Calibrated to your market and platform", "Curiosity, social proof, pain, transformation angles", "Rate hooks to train your AI"],
    url: "/dashboard/hooks",
    cta: "Generate hooks free",
  },
  {
    icon: "📋", accent: "#60a5fa",
    tag: "Production",
    title: "Brief Generator",
    headline: "Brief your editor in 30 seconds. Zero revision rounds.",
    desc: "Turn any insight into a production-ready brief. Scene-by-scene breakdown, voiceover script, visual direction, editor notes. One doc, zero ambiguity.",
    bullets: ["Scene-by-scene breakdown with timing", "Full voiceover script with tone notes", "Visual direction per scene", "Export to Notion, Google Docs, PDF"],
    url: "/dashboard/brief",
    cta: "Create a brief",
  },
  {
    icon: "🧠", accent: "#34d399",
    tag: "Intelligence",
    title: "AdBrief AI",
    headline: "Ask your AI what's wasting budget and what to produce next.",
    desc: "AdBrief AI knows your account — your patterns, your winners, your fatigue signals. Ask it anything. It responds with data-backed actions, not generic tips.",
    bullets: ["Full account context in every response", "Detects creative fatigue before CTR drops", "Links directly to tools with pre-filled context", "Knows Meta Andromeda 2026 rules"],
    url: "/dashboard/loop/ai",
    cta: "Ask AdBrief AI",
  },
  {
    icon: "🔍", accent: "#a78bfa",
    tag: "Intelligence",
    title: "Creative Performance Loop",
    headline: "Import your Meta data. Let the AI find your winning patterns.",
    desc: "Upload your Meta or TikTok CSV. AdBrief identifies which hook types, formats, and markets are winning in YOUR account — then calibrates every output to match.",
    bullets: ["Import Meta Ads Manager CSV", "Identifies winning hook × format × market combos", "Tracks performance by editor", "Feeds every tool with your real data"],
    url: "/dashboard/loop/ai",
    cta: "Start the loop",
  },
  {
    icon: "✈️", accent: "#fbbf24",
    tag: "Quality",
    title: "Pre-flight Check",
    headline: "Score any ad before it goes live. Catch problems before you spend.",
    desc: "Run any creative through AdBrief before launching. Get a go/no-go score with specific issues flagged. Never launch a weak ad again.",
    bullets: ["Hook strength score", "Platform fit check (9:16, length, format)", "CTA effectiveness rating", "Instant go/no-go recommendation"],
    url: "/dashboard/preflight",
    cta: "Run a pre-flight",
  },
  {
    icon: "📝", accent: "#0ea5e9",
    tag: "Production",
    title: "Script Generator",
    headline: "Full ad scripts calibrated to what's working in your account.",
    desc: "Generate complete 30–60s ad scripts using your proven hook types, pacing, and structure. Not generic templates — scripts shaped by your real performance data.",
    bullets: ["UGC, VSL, tutorial, problem-solution formats", "Calibrated to your winning hook type", "VO notes with tone and delivery guidance", "Market and platform specific"],
    url: "/dashboard/script",
    cta: "Generate a script",
  },
  {
    icon: "🌎", accent: "#34d399",
    tag: "Scale",
    title: "Translation & Localization",
    headline: "Take your winning creative to a new market. Not just translated — localized.",
    desc: "AI adapts your scripts for cultural context, slang, and tone — not just language. The same performance, new market.",
    bullets: ["7 languages + market adaptation", "Preserves tone and hook structure", "Cultural slang and phrasing built in", "Instant turnaround"],
    url: "/dashboard/translate",
    cta: "Translate a script",
  },
];

export default function Features() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#060608", color: "#fff", ...j }}>
      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(6,6,8,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer" }}><Logo size="md" /></button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LanguageSwitcher />
            <button onClick={() => navigate("/signup")} style={{ padding: "8px 18px", borderRadius: 20, fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", color: "#000", border: "none", cursor: "pointer" }}>
              Start free
            </button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 24px 80px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(14,165,233,0.7)", marginBottom: 16 }}>Everything you need</p>
          <h1 style={{ fontSize: "clamp(32px,5vw,52px)", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.1, marginBottom: 16 }}>
            The AI that saves your<br />
            <span style={{ background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              ad budget.
            </span>
          </h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.4)", maxWidth: 520, margin: "0 auto 28px", lineHeight: 1.65 }}>
            Every tool AdBrief ships is designed to catch money being wasted before you spend it — or to maximize the return on what you do spend.
          </p>
          <button onClick={() => navigate("/signup")}
            style={{ padding: "13px 28px", borderRadius: 14, fontSize: 15, fontWeight: 700, background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", color: "#000", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            Start saving budget — free <ArrowRight size={16} />
          </button>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 10 }}>1-day free trial · Cancel anytime · 60s to first insight</p>
        </div>

        {/* Features grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))", gap: 20 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ borderRadius: 20, overflow: "hidden", background: "#0d0d15", border: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column" }}>
              {/* Header */}
              <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${f.accent}12`, border: `1px solid ${f.accent}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                    {f.icon}
                  </div>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: f.accent, padding: "2px 8px", borderRadius: 20, background: `${f.accent}12`, border: `1px solid ${f.accent}20` }}>{f.tag}</span>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginTop: 4 }}>{f.title}</p>
                  </div>
                </div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.85)", lineHeight: 1.45, marginBottom: 8 }}>{f.headline}</h2>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.65 }}>{f.desc}</p>
              </div>
              {/* Bullets */}
              <div style={{ padding: "16px 24px", flex: 1 }}>
                {f.bullets.map((b, bi) => (
                  <div key={bi} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <Check size={13} style={{ color: f.accent, flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{b}</span>
                  </div>
                ))}
              </div>
              {/* CTA */}
              <div style={{ padding: "0 24px 20px" }}>
                <button onClick={() => navigate(f.url)}
                  style={{ width: "100%", padding: "10px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: `${f.accent}15`, color: f.accent, border: `1px solid ${f.accent}30`, cursor: "pointer", textAlign: "center" as const }}>
                  {f.cta} →
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div style={{ marginTop: 72, textAlign: "center", padding: "48px 32px", borderRadius: 24, background: "linear-gradient(135deg,rgba(14,165,233,0.1),rgba(6,182,212,0.06))", border: "1px solid rgba(14,165,233,0.2)" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10 }}>
            1 caught weak ad = plan pays for itself.
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>Most users recover 10× the plan cost in the first week.</p>
          <button onClick={() => navigate("/signup")}
            style={{ padding: "13px 28px", borderRadius: 14, fontSize: 15, fontWeight: 700, background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", color: "#000", border: "none", cursor: "pointer" }}>
            Try free for 1 day →
          </button>
        </div>
      </div>
    </div>
  );
}
