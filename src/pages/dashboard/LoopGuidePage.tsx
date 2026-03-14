import { useNavigate } from "react-router-dom";
import { Upload, Brain, TrendingUp, Target, RefreshCw, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const m = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" } as const;

const STEPS = [
  {
    n: "01", icon: Upload, color: "#60a5fa",
    title: "Import your CSV",
    what: "Export your campaign data from Meta Ads Manager or TikTok Ads Manager as a CSV/XLSX file.",
    how: "Go to Import Data → upload the file → select the platform. The system auto-detects columns (impressions, clicks, CTR, spend, ROAS).",
    tip: "Your filenames must follow a naming convention so the AI can extract editor, market, platform and creative type. Set this up in Naming Rules first.",
    sim: [
      "TF-MX-AL-260213-MT-ELUCK-9v16-04.mp4 → Editor: AL, Market: MX, Platform: TF, Brand: ELUCK",
      "FB-BR-DO-260301-JN-COME-16v9-02.mp4 → Editor: DO, Market: BR, Platform: FB, Brand: COME",
    ],
  },
  {
    n: "02", icon: Brain, color: "#a78bfa",
    title: "Run Learning",
    what: "The AI parses every filename, extracts variables (editor, market, platform, hook type, format) and correlates them with your CTR and ROAS data.",
    how: "Click Run Learning on the Performance Loop page. Takes 10-30 seconds depending on data volume. Run it every time you import new data.",
    tip: "The more data, the better. Minimum 20 creatives to see meaningful patterns. 100+ creatives unlocks editor-level insights.",
    sim: [
      "Analyzed 84 creatives across 3 markets",
      "Found pattern: Curiosity hook + UGC format + MX market → avg CTR 2.41% (your avg: 1.12%)",
      "Editor AL: 23% above team avg CTR on iGaming creatives",
    ],
  },
  {
    n: "03", icon: TrendingUp, color: "#f472b6",
    title: "Read your patterns",
    what: "Winning patterns are combinations of variables that outperform your account average CTR by 20%+. Losing patterns are combinations to avoid.",
    how: "Patterns show on the Performance Loop page. Each pattern has CTR, ROAS, sample size, and confidence score. Higher confidence = more reliable.",
    tip: "Focus on patterns with 5+ samples and 70%+ confidence. Patterns with 1-2 samples are early signals — useful but not conclusive.",
    sim: [
      "✓ WIN: Editor:AL + Market:MX + Format:UGC | CTR 2.41% | ROAS 3.2x | 12 samples | 84% confidence",
      "✗ LOSE: Format:VSL + Market:BR + Hook:fear | CTR 0.43% | 8 samples | 71% confidence",
    ],
  },
  {
    n: "04", icon: Target, color: "#34d399",
    title: "Ask AdBrief AI",
    what: "The AI has access to all your patterns, analyses, persona, and campaign data. Ask it anything about your creative performance.",
    how: "Go to AdBrief AI → ask naturally. The AI responds in structured blocks: actions to take, patterns it sees, hook copy you can use immediately, warnings.",
    tip: "The more specific your question, the better the answer. 'What hook would work for cold traffic in MX?' beats 'give me hook ideas'.",
    sim: [
      "Q: Which editor should I assign to the next iGaming batch?",
      "→ Pattern: AL has 23% higher CTR on iGaming vs team avg. Assign AL.",
      "Q: Write 3 hooks for cold traffic in Brazil",
      "→ ⚡ Hook: 'Você sabia que 90% das pessoas não sabe disso...' [curiosity, BR market, cold]",
    ],
  },
  {
    n: "05", icon: RefreshCw, color: "#fbbf24",
    title: "The loop closes",
    what: "Every creative you produce using AdBrief insights gets imported back. The AI recalibrates. Your next brief is already smarter.",
    how: "Import new campaign data monthly (or after each major test). Run Learning again. The patterns evolve — winners stay, losers get replaced.",
    tip: "Connect AdBrief AI to your brief generation: after seeing a winning pattern, go to Brief Generator and reference it in 'Extra Context'.",
    sim: [
      "Month 1: 12 patterns, avg CTR 1.12%",
      "Month 2: 31 patterns, avg CTR 1.67% (+49%)",
      "Month 3: 58 patterns, avg CTR 2.04% (+82% from baseline)",
    ],
  },
];

const FAQS = [
  {
    q: "Does my filename format matter?",
    a: "Yes — it's essential. The AI can only extract editor, market, and format data if your filenames follow a consistent convention. Set it up in Naming Rules before importing.",
  },
  {
    q: "What CSV format does it accept?",
    a: "Any CSV/XLSX export from Meta Ads Manager or TikTok Ads Manager. Columns needed: ad name (filename), impressions, clicks, CTR, spend. ROAS is optional but improves pattern quality.",
  },
  {
    q: "How many creatives do I need to start?",
    a: "Minimum 20 to see any patterns. 50+ gives reliable editor-level insights. 100+ unlocks market-by-market comparison.",
  },
  {
    q: "How often should I run Learning?",
    a: "Every time you import new data. If you're importing monthly, run it monthly. The AI doesn't auto-learn — you trigger it manually.",
  },
  {
    q: "Does AdBrief AI have memory?",
    a: "Yes — it saves key insights from each conversation in your account. It doesn't repeat the same recommendations, and it builds on what it's learned about your account over time.",
  },
  {
    q: "Can I use this without importing CSV data?",
    a: "You can use all other tools (Brief, Script, Hook Generator, Analyses) without CSV data. But the Performance Loop and AdBrief AI will have limited insight quality without real performance data.",
  },
];

export default function LoopGuidePage() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "24px 24px 80px", maxWidth: 800, margin: "0 auto", ...j }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ ...m, fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.15em", textTransform: "uppercase" }}>How it works</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.025em", marginBottom: 8 }}>
          The Performance Loop — step by step
        </h1>
        <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
          A complete walkthrough of how the loop works, what to expect at each stage, and how to get the most out of it.
        </p>
      </div>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 40 }}>
        {STEPS.map((step, i) => (
          <div key={step.n} style={{ position: "relative" }}>
            {/* connector */}
            {i < STEPS.length - 1 && (
              <div style={{ position: "absolute", left: 19, top: 56, width: 2, height: "calc(100% - 8px)", background: "rgba(255,255,255,0.04)", zIndex: 0 }} />
            )}
            <div style={{ display: "flex", gap: 16, padding: "20px 0", position: "relative", zIndex: 1 }}>
              {/* Icon */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${step.color}15`, border: `1.5px solid ${step.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <step.icon size={17} style={{ color: step.color }} />
                </div>
              </div>
              {/* Content */}
              <div style={{ flex: 1, paddingTop: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ ...m, fontSize: 9, color: step.color, letterSpacing: "0.15em" }}>{step.n}</span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{step.title}</h3>
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, marginBottom: 8 }}>{step.what}</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.65, marginBottom: 10 }}>
                  <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>How: </span>{step.how}
                </p>
                {/* Tip */}
                <div style={{ display: "flex", gap: 8, padding: "8px 12px", borderRadius: 10, background: `${step.color}08`, border: `1px solid ${step.color}18`, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>💡</span>
                  <p style={{ ...m, fontSize: 11, color: `${step.color}cc`, lineHeight: 1.6 }}>{step.tip}</p>
                </div>
                {/* Simulation */}
                <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 14px" }}>
                  <p style={{ ...m, fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Example output</p>
                  {step.sim.map((line, li) => (
                    <p key={li} style={{ ...m, fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: li < step.sim.length - 1 ? 2 : 0 }}>{line}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16, letterSpacing: "-0.01em" }}>FAQ</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginBottom: 5 }}>{faq.q}</p>
              <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.65 }}>{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => navigate("/dashboard/loop")}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 12, background: "linear-gradient(135deg,#a78bfa,#f472b6)", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none" }}>
          <RefreshCw size={14} /> Go to Performance Loop
        </button>
        <button onClick={() => navigate("/dashboard/loop/import")}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer" }}>
          <Upload size={14} /> Import Data
        </button>
        <button onClick={() => navigate("/dashboard/loop/ai")}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer" }}>
          <Brain size={14} /> Ask AdBrief AI
        </button>
      </div>
    </div>
  );
}
