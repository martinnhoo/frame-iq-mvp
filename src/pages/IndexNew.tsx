import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, Zap, Brain, FileText, BarChart3, Target, TrendingUp, ChevronRight } from "lucide-react";
import { useState } from "react";
import CookieConsent from "@/components/CookieConsent";
import TopBanner from "@/components/TopBanner";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";

const BRAND = "linear-gradient(135deg, #0ea5e9, #06b6d4)";
const BRAND_GLOW = "rgba(14,165,233,0.15)";
const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;
const m = { fontFamily: "'DM Mono', monospace" } as React.CSSProperties;

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.45, delay },
});

// ─── Tiny UI helpers ──────────────────────────────────────────────────────────

function Pill({ children, color = "#0ea5e9" }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ ...m, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color, background: `${color}14`, border: `1px solid ${color}28`, padding: "5px 12px", borderRadius: 999, display: "inline-block" }}>
      {children}
    </span>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0" }} />;
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav({ onCTA }: { onCTA: () => void }) {
  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(6,7,18,0.85)", backdropFilter: "blur(16px)", padding: "0 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
        <Logo size="lg" />
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <a href="#how" style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>How it works</a>
          <a href="#for-who" style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>Who it's for</a>
          <a href="#pricing" style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>Pricing</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => window.location.href = "/login"}
            style={{ ...j, fontSize: 13, padding: "8px 16px", borderRadius: 10, background: "transparent", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
            Sign in
          </button>
          <button onClick={onCTA}
            style={{ ...j, fontSize: 13, fontWeight: 700, padding: "8px 20px", borderRadius: 10, background: BRAND, color: "#000", border: "none", cursor: "pointer" }}>
            Start free →
          </button>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ onCTA }: { onCTA: () => void }) {
  return (
    <section style={{ padding: "80px 24px 64px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      {/* Ambient */}
      <div style={{ position: "absolute", top: -120, left: "50%", transform: "translateX(-50%)", width: 700, height: 400, background: "radial-gradient(ellipse, rgba(14,165,233,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 780, margin: "0 auto", position: "relative" }}>

        <motion.div {...fade(0)}>
          <Pill>Creative intelligence for performance teams</Pill>
        </motion.div>

        <motion.h1 {...fade(0.1)} style={{ ...j, fontSize: "clamp(40px,6vw,72px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.05, margin: "24px 0 20px" }}>
          Your AI creative team.{" "}
          <span style={{ background: BRAND, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Learns what works. Never forgets.
          </span>
        </motion.h1>

        <motion.p {...fade(0.2)} style={{ ...j, fontSize: 18, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, maxWidth: 560, margin: "0 auto 36px" }}>
          Connect your Meta, TikTok, or Google Ads account. AdBrief reads your campaigns in real time and tells you exactly what's working, what's wasting budget, and what to produce next.
        </motion.p>

        <motion.div {...fade(0.3)} style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onCTA}
            style={{ ...j, fontSize: 15, fontWeight: 800, padding: "15px 32px", borderRadius: 14, background: BRAND, color: "#000", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            Start free — no credit card <ArrowRight size={16} />
          </button>
          <a href="#how"
            style={{ ...j, fontSize: 15, fontWeight: 600, padding: "15px 28px", borderRadius: 14, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center" }}>
            See how it works
          </a>
        </motion.div>

        <motion.div {...fade(0.45)} style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
          {["No credit card", "Results in 60 seconds", "Free plan forever"].map(t => (
            <span key={t} style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: 5 }}>
              <Check size={12} color="#0ea5e9" /> {t}
            </span>
          ))}
        </motion.div>

        {/* Powered by — integrated in hero, not a banner */}
        <motion.div {...fade(0.5)} style={{ marginTop: 36, display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
          <span style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.22)", letterSpacing: "0.06em" }}>POWERED BY</span>
          <div style={{ height: 1, width: 32, background: "rgba(255,255,255,0.1)" }} />
          {/* Claude */}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 48 48" fill="none">
              <path d="M27.8 8L40 40H32.4L30 33.6H18L15.6 40H8L20.2 8H27.8ZM24 16.8L20.4 27.2H27.6L24 16.8Z" fill="rgba(204,168,103,0.9)"/>
            </svg>
            <span style={{ ...j, fontSize: 12, fontWeight: 600, color: "rgba(204,168,103,0.7)", letterSpacing: "0.02em" }}>Anthropic Claude</span>
          </div>
          <span style={{ color: "rgba(255,255,255,0.1)", fontSize: 16 }}>·</span>
          {/* OpenAI */}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,255,255,0.55)">
              <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.677l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.843-3.386 2.02-1.168a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.402-.664zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
            </svg>
            <span style={{ ...j, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.55)", letterSpacing: "0.02em" }}>OpenAI</span>
          </div>
          <div style={{ height: 1, width: 32, background: "rgba(255,255,255,0.1)" }} />
        </motion.div>

        {/* Live stat bar */}
        <motion.div {...fade(0.55)} style={{ marginTop: 36, display: "flex", gap: 0, justifyContent: "center" }}>
          <div style={{ display: "flex", gap: 1 }}>
            {[
              { label: "Ads analyzed", value: "2,847" },
              { label: "Avg hook score", value: "6.9/10" },
              { label: "Teams using AdBrief", value: "147+" },
            ].map((stat, i) => (
              <div key={i} style={{ padding: "16px 28px", background: i === 1 ? "rgba(14,165,233,0.07)" : "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: i === 0 ? "14px 0 0 14px" : i === 2 ? "0 14px 14px 0" : "0", textAlign: "center" }}>
                <p style={{ ...j, fontSize: 22, fontWeight: 800, color: i === 1 ? "#0ea5e9" : "#fff", marginBottom: 2 }}>{stat.value}</p>
                <p style={{ ...m, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Product Visual ───────────────────────────────────────────────────────────

function ProductVisual() {
  return (
    <section style={{ padding: "0 24px 64px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Browser chrome */}
        <motion.div {...fadeIn(0)}
          style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(14,165,233,0.2)", boxShadow: "0 0 80px rgba(14,165,233,0.08), 0 40px 80px rgba(0,0,0,0.6)" }}>
          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(14,165,233,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,90,90,0.4)" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,190,0,0.4)" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(40,200,80,0.4)" }} />
            </div>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399" }} />
              <span style={{ ...m, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>adbrief.pro/dashboard</span>
            </div>
          </div>

          {/* Dashboard content */}
          <div style={{ background: "#08090f", padding: "20px 20px 24px" }}>
            {/* Top row — stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Hook Score", value: "7.8", sub: "+1.4 from last", color: "#0ea5e9" },
                { label: "Analyses this month", value: "14", sub: "6 remaining", color: "#06b6d4" },
                { label: "Avg CTR prediction", value: "2.1%", sub: "Above benchmark", color: "#34d399" },
              ].map((stat, i) => (
                <div key={i} style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p style={{ ...m, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>{stat.label}</p>
                  <p style={{ ...j, fontSize: 24, fontWeight: 800, color: stat.color, marginBottom: 2 }}>{stat.value}</p>
                  <p style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* AI Analysis result */}
            <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.15)", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(14,165,233,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 14 }}>🧠</span>
                </div>
                <div>
                  <span style={{ ...j, fontSize: 12, fontWeight: 700, color: "#0ea5e9" }}>AdBrief AI · Analysis complete</span>
                  <p style={{ ...m, fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>TF-AM-250314-BR-001 · TikTok · BR Market</p>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <span style={{ ...j, fontSize: 20, fontWeight: 900, color: "#34d399" }}>7.8</span>
                  <span style={{ ...m, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>/10</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Improvement 1", text: "Move product reveal to second 8 — current reveal at second 3 resolves tension too early", color: "#0ea5e9" },
                  { label: "Improvement 2", text: "Add a specific number in the first 5 words to increase hook specificity score", color: "#06b6d4" },
                  { label: "Improvement 3", text: "Safe zone violation at bottom 12% — move text overlay up 40px for TikTok compliance", color: "#f59e0b" },
                ].map((imp, i) => (
                  <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${imp.color}20` }}>
                    <p style={{ ...m, fontSize: 9, color: imp.color, letterSpacing: "0.08em", marginBottom: 5 }}>{imp.label}</p>
                    <p style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>{imp.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Brief preview */}
            <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ ...m, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>Generated Production Brief</span>
                <span style={{ ...j, fontSize: 10, color: "#0ea5e9", cursor: "pointer" }}>View full brief →</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { sc: "SC01 (0–3s)", note: "Hook — VO: 'Most brands são doing this wrong...' | ON-SCREEN: bold white text center" },
                  { sc: "SC02 (3–8s)", note: "Problem agitation — B-roll product fail scenario | No VO | Cut hard" },
                ].map((sc, i) => (
                  <div key={i} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(14,165,233,0.04)", border: "1px solid rgba(14,165,233,0.1)" }}>
                    <p style={{ ...m, fontSize: 9, color: "#0ea5e9", marginBottom: 4 }}>{sc.sc}</p>
                    <p style={{ ...j, fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{sc.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Platform ticker ──────────────────────────────────────────────────────────

function PlatformTicker() {
  const items = ["TikTok", "Meta", "Instagram Reels", "YouTube Shorts", "Facebook Feed", "Google UAC", "Kwai", "Hotmart"];
  const all = [...items, ...items];
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "14px 0", overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 80, background: "linear-gradient(90deg, #060712, transparent)", zIndex: 1, pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 80, background: "linear-gradient(-90deg, #060712, transparent)", zIndex: 1, pointerEvents: "none" }} />
      <div style={{ display: "flex", animation: "ticker 25s linear infinite", width: "max-content" }}>
        {all.map((item, i) => (
          <span key={i} style={{ ...m, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginRight: 48, whiteSpace: "nowrap" }}>
            {item}
          </span>
        ))}
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      n: "01",
      icon: <BarChart3 size={20} color="#0ea5e9" />,
      title: "Connect your ad account or upload a video",
      desc: "Connect Meta, TikTok, or Google Ads for real-time campaign data — or just upload a video ad to analyze it instantly.",
      output: "\"Analyzing hook type, narrative structure, and platform fit...\"",
    },
    {
      n: "02",
      icon: <Zap size={20} color="#06b6d4" />,
      title: "Get a hook score + full breakdown",
      desc: "Your ad gets a score from 0 to 10. You see exactly what's weak — the hook timing, the CTA, the format — and how to fix it.",
      output: "\"Hook score: 6.2 · Curiosity gap detected but resolved too early · Move resolution to final 3 seconds\"",
    },
    {
      n: "03",
      icon: <FileText size={20} color="#34d399" />,
      title: "Generate a brief ready to send",
      desc: "One click turns the analysis into a scene-by-scene production brief with VO copy and visual notes. Send to your editor. Done.",
      output: "\"SC01 (0–3s): Hook — VO: 'Most brands are doing this wrong...' | ON-SCREEN: bold white text center | CUT hard at 3s\"",
    },
    {
      n: "04",
      icon: <Brain size={20} color="#a78bfa" />,
      title: "AI that gets smarter with every ad",
      desc: "Every analysis builds context. After a few ads, AdBrief knows your winning hooks, formats, and markets — and uses that to make every next brief sharper.",
      output: "\"Based on your last 12 analyses: UGC + curiosity hooks convert 2.3x better for your BR audience. Applying to this brief.\"",
    },
  ];

  return (
    <section id="how" style={{ padding: "80px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <Pill>How it works</Pill>
          <h2 style={{ ...j, fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "16px 0 12px" }}>
            From upload to brief in 60 seconds.
          </h2>
          <p style={{ ...j, fontSize: 16, color: "rgba(255,255,255,0.4)", maxWidth: 480, margin: "0 auto" }}>
            No setup. No CSV imports. No connecting ad accounts.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {steps.map((step, i) => (
            <motion.div key={i} {...fadeIn(i * 0.08)}
              style={{ display: "flex", gap: 24, padding: "28px 28px", borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {step.icon}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ ...m, fontSize: 10, letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)" }}>{step.n}</span>
                  <h3 style={{ ...j, fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{step.title}</h3>
                </div>
                <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.65, marginBottom: 12 }}>{step.desc}</p>
                <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.12)" }}>
                  <p style={{ ...m, fontSize: 11, color: "rgba(14,165,233,0.7)", lineHeight: 1.6 }}>{step.output}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── For Who ─────────────────────────────────────────────────────────────────

function ForWho({ onCTA }: { onCTA: () => void }) {
  const [active, setActive] = useState(0);

  const profiles = [
    {
      emoji: "🏢",
      label: "Agencies",
      headline: "Brief 10 clients. In the time it used to take to brief 1.",
      pain: "You're producing 20+ creatives a week across multiple brands. Writing briefs manually takes hours. Editors ask for revisions because the briefs are vague. AdBrief generates scene-by-scene briefs with VO copy and visual notes in 60 seconds — consistent quality across every client, every time.",
      wins: [
        "Brief generator with VO copy + visual notes per scene",
        "Hook score on every delivery before the client sees it",
        "Pre-flight check to catch safe zone issues before launch",
        "AI that learns each brand's best-performing formats",
      ],
      color: "#0ea5e9",
    },
    {
      emoji: "⭐",
      label: "Influencers",
      headline: "Your content instinct. Now with a creative strategist built in.",
      pain: "You know what your audience responds to — but translating that into paid ads that actually convert is different from organic content. AdBrief bridges the gap: generate scripts tuned for conversion, score your hooks before you film, and learn which formats perform best with your audience.",
      wins: [
        "Script generator tuned for paid performance, not just engagement",
        "Hook score so you know before you film, not after",
        "UGC brief format your editor can follow without WhatsApp threads",
        "AI that remembers which hooks and formats work for your niche",
      ],
      color: "#06b6d4",
    },
    {
      emoji: "📈",
      label: "Media Buyers",
      headline: "Stop launching ads you can't defend. Know before you spend.",
      pain: "You're accountable for ROAS but you don't control the creative. AdBrief gives you a score before the creative hits your account — so you can push back with data, not gut feeling. And when you find a winner, AdBrief tells you exactly why it worked so you can brief the next one.",
      wins: [
        "Hook score 0–10 on any video before launch",
        "Platform fit check for TikTok, Meta, Reels, YouTube",
        "Competitor ad decoder to reverse-engineer winning hooks",
        "AI memory of what has converted in your account",
      ],
      color: "#34d399",
    },
  ];

  const p = profiles[active];

  return (
    <section id="for-who" style={{ padding: "80px 24px", background: "rgba(255,255,255,0.01)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <Pill>Who it's built for</Pill>
          <h2 style={{ ...j, fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "16px 0 0" }}>
            Built for the people who live inside ad creative.
          </h2>
        </div>

        {/* Tab selector */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 32 }}>
          {profiles.map((pr, i) => (
            <button key={i} onClick={() => setActive(i)}
              style={{ ...j, fontSize: 14, fontWeight: 600, padding: "10px 22px", borderRadius: 999, cursor: "pointer", transition: "all 0.15s", background: active === i ? `${pr.color}18` : "rgba(255,255,255,0.03)", color: active === i ? pr.color : "rgba(255,255,255,0.4)", border: `1px solid ${active === i ? pr.color + "40" : "rgba(255,255,255,0.07)"}` }}>
              {pr.emoji} {pr.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* Left */}
          <div style={{ padding: "32px 28px", borderRadius: 20, background: `${p.color}06`, border: `1px solid ${p.color}18` }}>
            <span style={{ fontSize: 36, display: "block", marginBottom: 16 }}>{p.emoji}</span>
            <h3 style={{ ...j, fontSize: 20, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.25, marginBottom: 14, color: "#fff" }}>
              {p.headline}
            </h3>
            <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.75 }}>{p.pain}</p>
            <button onClick={onCTA}
              style={{ ...j, marginTop: 24, fontSize: 13, fontWeight: 700, padding: "11px 22px", borderRadius: 10, background: p.color, color: "#000", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              Start free <ArrowRight size={13} />
            </button>
          </div>
          {/* Right */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {p.wins.map((win, i) => (
              <motion.div key={win} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${p.color}18`, border: `1px solid ${p.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <Check size={11} color={p.color} />
                </div>
                <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{win}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Memory section ───────────────────────────────────────────────────────────

function MemorySection() {
  return (
    <section style={{ padding: "80px 24px" }}>
      <div className="max-w-[900px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <motion.div {...fadeIn(0)}>
          <Pill color="#a78bfa">The memory layer</Pill>
          <h2 style={{ ...j, fontSize: "clamp(26px,3.5vw,40px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.15, margin: "16px 0 14px" }}>
            The more you use it, the smarter it gets about{" "}
            <span style={{ background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              your account.
            </span>
          </h2>
          <p style={{ ...j, fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.75, marginBottom: 24 }}>
            Every analysis adds to AdBrief's understanding of what works for your brand, your market, and your audience. After a few ads, it's not giving you generic advice — it's giving you advice based on your actual performance history.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              "Learns your best-performing hook types per market",
              "Remembers which formats your audience responds to",
              "Calibrates brief generation based on your winners",
              "Flags patterns you'd never catch manually across 50+ ads",
            ].map(item => (
              <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "#0ea5e9", flexShrink: 0, marginTop: 2 }}>→</span>
                <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{item}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Mock AI memory feed */}
        <motion.div {...fadeIn(0.1)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { tag: "Pattern detected", color: "#0ea5e9", text: "Curiosity hooks outperform your avg by 2.3×. Last 3 wasted creatives all used VSL format in BR — avoid this combo.", icon: "🧠" },
            { tag: "Brief calibrated", color: "#06b6d4", text: "Applied your winning formula: UGC style + social proof hook + problem-first opening. Predicted CTR: 1.8–2.4%.", icon: "✍️" },
            { tag: "Hook scored", color: "#34d399", text: "Score: 7.8 / 10 — strong curiosity gap, native TikTok pacing, CTA well-timed. Ready to launch.", icon: "📊" },
            { tag: "Memory updated", color: "#a78bfa", text: "New winner added to your account profile. Hook type: transformation. Market: MX. CTR: 2.1%.", icon: "💾" },
          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 12 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
              <div>
                <span style={{ ...m, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: item.color, display: "block", marginBottom: 5 }}>{item.tag}</span>
                <p style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{item.text}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function Testimonials() {
  const items = [
    { quote: "I uploaded 3 ads I was about to launch. AdBrief caught a safe zone violation on two of them and gave my hook a 4.8. Rewrote it, rescored a 7.6. That version became our best performer that month.", name: "Lucas M.", role: "Media Buyer · DTC Brand", stat: "Hook 4.8 → 7.6", color: "#0ea5e9" },
    { quote: "Before AdBrief I was spending 2 days writing briefs for clients. Now it takes 10 minutes. My editors stopped asking for revisions because the briefs are finally complete and specific.", name: "Priya S.", role: "Creative Strategist · Performance Agency", stat: "Briefs: 2 days → 10 min", color: "#06b6d4" },
    { quote: "We were launching the same weak hooks over and over without knowing. AdBrief showed us we were averaging 4.2. After 3 weeks we hit 6.9 and CTR went up 40%.", name: "Rafael T.", role: "Head of Growth · iGaming Brand", stat: "CTR +40% in 3 weeks", color: "#34d399" },
  ];

  return (
    <section style={{ padding: "80px 24px", background: "rgba(14,165,233,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <Pill>Results</Pill>
          <h2 style={{ ...j, fontSize: "clamp(26px,3.5vw,40px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "16px 0 0" }}>
            From the first analysis.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ minHeight: 200 }}>
          {items.map((t, i) => (
            <motion.div key={i} {...fadeIn(i * 0.1)}
              style={{ padding: "24px", borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 14 }}>
              <span style={{ ...m, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: t.color, background: `${t.color}14`, border: `1px solid ${t.color}25`, padding: "5px 12px", borderRadius: 999, alignSelf: "flex-start" }}>{t.stat}</span>
              <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.75, flex: 1 }}>"{t.quote}"</p>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                <p style={{ ...j, fontSize: 13, fontWeight: 700, color: "#fff" }}>{t.name}</p>
                <p style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

function Pricing({ onCTA }: { onCTA: () => void }) {
  const navigate = useNavigate();
  const plans = [
    {
      name: "Free",
      price: "$0",
      desc: "Try it. No card.",
      analyses: "3 analyses",
      features: ["Hook score + breakdown", "3 improvements per analysis", "Platform fit check", "1 brief generation"],
      cta: "Start free",
      action: () => navigate("/signup"),
      highlight: false,
    },
    {
      name: "Maker",
      price: "$19",
      desc: "/mo · Solo or freelancer",
      analyses: "20 analyses/mo",
      features: ["Everything in Free", "20 brief generations", "Script generator", "Pre-flight checks", "AI memory (up to 20 ads)"],
      cta: "Get Maker",
      action: () => navigate("/signup?plan=maker"),
      highlight: false,
    },
    {
      name: "Pro",
      price: "$49",
      desc: "/mo · Growing teams",
      analyses: "60 analyses/mo",
      features: ["Everything in Maker", "60 brief generations", "Competitor ad decoder", "UGC script generator", "AI memory (up to 60 ads)", "Multi-market (BR, MX, IN, EN)"],
      cta: "Get Pro",
      action: () => navigate("/signup?plan=pro"),
      highlight: true,
    },
    {
      name: "Studio",
      price: "$149",
      desc: "/mo · Agencies & teams",
      analyses: "Unlimited",
      features: ["Everything in Pro", "Unlimited analyses + briefs", "Priority AI processing", "Full account memory", "Bulk brief generation", "Agency client modes"],
      cta: "Get Studio",
      action: () => navigate("/signup?plan=studio"),
      highlight: false,
    },
  ];

  return (
    <section id="pricing" style={{ padding: "80px 24px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Pill>Pricing</Pill>
          <h2 style={{ ...j, fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "16px 0 10px" }}>
            Start free. Upgrade when it saves you money.
          </h2>
          <p style={{ ...j, fontSize: 14, color: "rgba(255,255,255,0.35)", maxWidth: 460, margin: "0 auto 32px" }}>
            One analysis = hook score (0–10) + 3 specific improvements + platform fit check + production brief. Under 60 seconds.
          </p>
          {/* ROI nudge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 20px", borderRadius: 14, background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.18)", marginBottom: 48 }}>
            <span style={{ fontSize: 18 }}>💡</span>
            <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              The average weak ad wastes <strong style={{ color: "#fff" }}>$47–$500</strong> before you catch it.
              At $19/mo, AdBrief pays for itself the first time it stops a bad launch.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan, i) => (
            <div key={i}
              style={{ padding: "24px 20px", borderRadius: 20, background: plan.highlight ? "rgba(14,165,233,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${plan.highlight ? "rgba(14,165,233,0.35)" : "rgba(255,255,255,0.07)"}`, display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>
              {plan.highlight && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: BRAND, borderRadius: 999, padding: "3px 14px" }}>
                  <span style={{ ...m, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#000", fontWeight: 700 }}>Most popular</span>
                </div>
              )}
              <div>
                <p style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>{plan.name}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ ...j, fontSize: 36, fontWeight: 900, color: "#fff" }}>{plan.price}</span>
                  <span style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{plan.desc}</span>
                </div>
                <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(14,165,233,0.08)", display: "inline-block" }}>
                  <span style={{ ...m, fontSize: 10, color: "#0ea5e9", letterSpacing: "0.08em" }}>{plan.analyses}</span>
                </div>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ flexShrink: 0, marginTop: 2, display: "flex" }}><Check size={12} color="#0ea5e9" /></span>
                    <span style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={plan.action}
                style={{ ...j, width: "100%", padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: plan.highlight ? BRAND : "rgba(255,255,255,0.06)", color: plan.highlight ? "#000" : "rgba(255,255,255,0.7)", border: `1px solid ${plan.highlight ? "transparent" : "rgba(255,255,255,0.1)"}`, cursor: "pointer" }}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  const items = [
    {
      q: "What exactly is a 'hook score'?",
      a: "A hook score (0–10) rates how likely your ad's opening seconds are to stop someone from scrolling. It's based on emotional trigger type, specificity of the claim, curiosity gap strength, platform fit, and pacing. A score above 7.0 is strong. Most ads score between 4 and 6 — meaning there's almost always room to improve before launch.",
    },
    {
      q: "Do I need to connect my ad account?",
      a: "No. AdBrief works without any ad account connection. Just upload a video or paste a script — no Meta, TikTok, or Google credentials needed. You keep full control of your data.",
    },
    {
      q: "What does 'AI memory' mean in practice?",
      a: "After you analyze multiple ads, AdBrief starts recognizing patterns in your account — which hook types convert best, which formats underperform, which markets respond differently. It uses this context to calibrate every new analysis and brief it generates for you. The more you use it, the more accurate and specific the output becomes.",
    },
    {
      q: "Can I use AdBrief for multiple clients or brands?",
      a: "Yes. The Pro and Studio plans are built for teams and agencies managing multiple brands. Each persona/brand profile keeps its own memory and context separate from others.",
    },
    {
      q: "What's included in the free plan?",
      a: "The free plan includes 3 full analyses — each gives you a hook score (0–10), 3 specific improvements, platform fit check, and a generated production brief. No credit card required. No time limit.",
    },
    {
      q: "What video formats do you support?",
      a: "AdBrief accepts MP4, MOV, and WebM video files up to 500MB. You can also paste a script directly (no video needed) to generate a brief or score a written hook.",
    },
  ];

  return (
    <section style={{ padding: "60px 24px 80px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Pill>FAQ</Pill>
          <h2 style={{ ...j, fontSize: "clamp(24px,3.5vw,36px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "14px 0 0" }}>
            Common questions
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((item, i) => (
            <div key={i}
              style={{ borderRadius: 14, background: open === i ? "rgba(14,165,233,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${open === i ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.06)"}`, overflow: "hidden", transition: "all 0.15s" }}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{ width: "100%", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", gap: 12, textAlign: "left" }}>
                <span style={{ ...j, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>{item.q}</span>
                <span style={{ color: open === i ? "#0ea5e9" : "rgba(255,255,255,0.3)", fontSize: 18, flexShrink: 0, transition: "transform 0.15s", transform: open === i ? "rotate(45deg)" : "none" }}>+</span>
              </button>
              {open === i && (
                <div style={{ padding: "0 20px 16px" }}>
                  <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.75 }}>{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA({ onCTA }: { onCTA: () => void }) {
  return (
    <section style={{ padding: "80px 24px 100px" }}>
      <div style={{ maxWidth: 660, margin: "0 auto", textAlign: "center" }}>
        <motion.div {...fadeIn(0)} style={{ padding: "56px 48px", borderRadius: 28, background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.18)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 500, height: 300, background: "radial-gradient(ellipse, rgba(14,165,233,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <p style={{ ...m, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#0ea5e9", marginBottom: 16 }}>Ready when you are</p>
            <h2 style={{ ...j, fontSize: "clamp(28px,4vw,42px)", fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1.1, marginBottom: 14 }}>
              Your next ad is either going to make money or waste it.
            </h2>
            <p style={{ ...j, fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>
              Score it in 60 seconds before you find out the expensive way.
            </p>
            <button onClick={onCTA}
              style={{ ...j, fontSize: 15, fontWeight: 800, padding: "15px 36px", borderRadius: 14, background: BRAND, color: "#000", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
              Start free — no credit card <ArrowRight size={16} />
            </button>
            <p style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 14 }}>No credit card · 3 free analyses · Takes 60 seconds</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <Logo size="lg" />
        <div style={{ display: "flex", gap: 24 }}>
          {[["Blog", "/blog"], ["Pricing", "/pricing"], ["FAQ", "/faq"], ["Privacy", "/privacy"], ["Terms", "/terms"]].map(([label, href]) => (
            <a key={href} href={href} style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>{label}</a>
          ))}
        </div>
        <p style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.2)" }}>© 2026 AdBrief. All rights reserved.</p>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IndexNew() {
  const navigate = useNavigate();
  const handleCTA = () => navigate("/signup");

  return (
    <div style={{ minHeight: "100vh", background: "#060712", color: "#fff", ...j }}>
      <Helmet>
        <title>AdBrief — AI Creative Intelligence for Performance Teams</title>
        <meta name="description" content="AdBrief analyzes your ads, generates scripts and briefs, and builds a memory of what converts in your account. Score any ad in 60 seconds. Free to start." />
      </Helmet>
      <TopBanner />
      <Nav onCTA={handleCTA} />
      <Hero onCTA={handleCTA} />
      <ProductVisual />
      <PlatformTicker />
      <HowItWorks />
      <Divider />
      <ForWho onCTA={handleCTA} />
      <Divider />
      <MemorySection />
      <Testimonials />
      <Pricing onCTA={handleCTA} />
      <FAQ />
      <FinalCTA onCTA={handleCTA} />
      <Footer />
      <CookieConsent />
    </div>
  );
}
