// v2
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, MessageSquare, Plug, Users, ChevronDown } from "lucide-react";
import { useState } from "react";
import CookieConsent from "@/components/CookieConsent";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";

const BRAND = "linear-gradient(135deg, #0ea5e9, #06b6d4)";
const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;
const BG = "#060812";

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] as any },
});

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as any },
});

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ onCTA }: { onCTA: () => void }) {
  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(6,8,18,0.9)", backdropFilter: "blur(20px)", padding: "0 32px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 62 }}>
        <Logo size="lg" />
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {[["How it works", "#how"], ["Who it's for", "#for"], ["Pricing", "#pricing"]].map(([label, href]) => (
            <a key={href} href={href} style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>{label}</a>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => window.location.href = "/login"}
            style={{ ...j, fontSize: 13, padding: "8px 16px", borderRadius: 9, background: "transparent", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
            Sign in
          </button>
          <button onClick={onCTA}
            style={{ ...j, fontSize: 13, fontWeight: 700, padding: "8px 20px", borderRadius: 9, background: BRAND, color: "#000", border: "none", cursor: "pointer" }}>
            Try free for 1 day →
          </button>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ onCTA }: { onCTA: () => void }) {
  return (
    <section style={{ padding: "90px 32px 72px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 900, height: 600, background: "radial-gradient(ellipse, rgba(14,165,233,0.09) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ maxWidth: 760, margin: "0 auto", position: "relative" }}>
        <motion.div {...fade(0)} style={{ marginBottom: 28 }}>
          <span style={{ ...j, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(14,165,233,0.8)", fontWeight: 600 }}>AI FOR PERFORMANCE MARKETING</span>
        </motion.div>
        <motion.h1 {...fade(0.08)} style={{ ...j, fontSize: "clamp(42px,6.5vw,76px)", fontWeight: 900, letterSpacing: "-0.045em", lineHeight: 1.02, margin: "0 0 24px" }}>
          The AI that knows<br />
          <span style={{ background: BRAND, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>your ad account.</span>
        </motion.h1>
        <motion.p {...fade(0.16)} style={{ ...j, fontSize: 18, color: "rgba(255,255,255,0.42)", lineHeight: 1.7, maxWidth: 520, margin: "0 auto 40px" }}>
          Connect Meta, TikTok or Google Ads. Ask anything about your campaigns.
          AdBrief reads your data in real time and thinks like a senior strategist.
        </motion.p>
        <motion.div {...fade(0.24)} style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
          <button onClick={onCTA}
            style={{ ...j, fontSize: 15, fontWeight: 800, padding: "15px 32px", borderRadius: 13, background: BRAND, color: "#000", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 0 40px rgba(14,165,233,0.25)" }}>
            Try free for 1 day <ArrowRight size={16} />
          </button>
          <a href="#how"
            style={{ ...j, fontSize: 15, fontWeight: 500, padding: "15px 28px", borderRadius: 13, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
            See how it works
          </a>
        </motion.div>
        <motion.p {...fade(0.3)} style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.22)" }}>
          1-day free trial on any plan · Cancel anytime · No setup required
        </motion.p>
        <motion.div {...fade(0.38)} style={{ marginTop: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ height: 1, width: 40, background: "rgba(255,255,255,0.08)" }} />
          <span style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>BUILT ON</span>
          <span style={{ ...j, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>Anthropic Claude</span>
          <span style={{ color: "rgba(255,255,255,0.1)" }}>·</span>
          <span style={{ ...j, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>OpenAI</span>
          <div style={{ height: 1, width: 40, background: "rgba(255,255,255,0.08)" }} />
        </motion.div>
      </div>
    </section>
  );
}

// ─── Chat Mockup ─────────────────────────────────────────────────────────────
function ChatMockup() {
  const msgs = [
    { role: "user", text: "What's killing my ROAS this week?" },
    { role: "ai", text: "Your top 3 ads are in creative fatigue — same visuals running for 19 days. CPM is up 34% while CTR dropped from 2.8% to 1.1%. This isn't a bid problem, it's a creative problem. Your winning pattern from February (direct question hook + social proof CTA) hasn't been tested in 3 weeks." },
    { role: "user", text: "Write me 3 hooks using that winning pattern" },
    { role: "ai", text: "Based on your account's top converters, 3 hooks ready to test:\n\n1. \"Still guessing which ad is wasting your budget?\"\n2. \"Every day you don't fix your hook, you're paying for clicks that don't convert.\"\n3. \"1,000 brands tested this creative format. 94% saw CPM drop in week 1.\"" },
  ];
  return (
    <section style={{ padding: "0 32px 80px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <motion.div {...fadeIn(0)} style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(14,165,233,0.15)", boxShadow: "0 0 100px rgba(14,165,233,0.06), 0 40px 80px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 16px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["rgba(255,90,90,0.35)", "rgba(255,190,0,0.35)", "rgba(40,200,80,0.35)"].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
            </div>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6, maxWidth: 260, margin: "0 auto" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399" }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.28)" }}>adbrief.pro/dashboard/loop</span>
            </div>
          </div>
          <div style={{ background: "#09091a", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px 5px 8px", borderRadius: 999, background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.18)" }}>
                <span style={{ fontSize: 14 }}>🎯</span>
                <span style={{ ...j, fontSize: 11, fontWeight: 600, color: "#0ea5e9" }}>Sarah · FitCore Brand</span>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
              </div>
              <span style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>18 analyses · Meta connected</span>
            </div>
            {msgs.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 10 }}>
                {msg.role === "ai" && <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(14,165,233,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2, fontSize: 13 }}>✦</div>}
                <div style={{ maxWidth: "75%", padding: "11px 15px", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: msg.role === "user" ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${msg.role === "user" ? "rgba(14,165,233,0.25)" : "rgba(255,255,255,0.07)"}` }}>
                  <p style={{ ...j, fontSize: 13, color: msg.role === "user" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.65)", lineHeight: 1.6, whiteSpace: "pre-line" }}>{msg.text}</p>
                </div>
              </motion.div>
            ))}
            <div style={{ display: "flex", gap: 10, padding: "10px 14px", borderRadius: 13, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.18)", flex: 1 }}>Ask anything about your campaigns...</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: BRAND, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ArrowRight size={13} color="#000" /></div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { n: "01", icon: <Plug size={18} color="#0ea5e9" />, color: "#0ea5e9", title: "Connect your ad accounts", desc: "Link Meta, TikTok, or Google Ads in one click. AdBrief reads your real campaign data — spend, CTR, CPM, creative performance — in real time." },
    { n: "02", icon: <Users size={18} color="#06b6d4" />, color: "#06b6d4", title: "Set up your persona or brand", desc: "Tell AdBrief who you're advertising to. Create audience personas or brand profiles — the AI uses this to give you market-specific answers." },
    { n: "03", icon: <MessageSquare size={18} color="#34d399" />, color: "#34d399", title: "Ask anything. Get real answers.", desc: "Chat like ChatGPT — but AdBrief knows your actual account. Ask what's working, what to kill, what to produce next. It answers with your numbers." },
  ];
  return (
    <section id="how" style={{ padding: "80px 32px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <span style={{ ...j, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(14,165,233,0.7)", fontWeight: 600 }}>HOW IT WORKS</span>
          <h2 style={{ ...j, fontSize: "clamp(28px,4vw,46px)", fontWeight: 800, letterSpacing: "-0.035em", margin: "14px 0 12px" }}>Three steps to your AI strategy partner.</h2>
          <p style={{ ...j, fontSize: 15, color: "rgba(255,255,255,0.38)", maxWidth: 420, margin: "0 auto" }}>Connect once. Ask forever. No CSV uploads. No manual data entry.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {steps.map((step, i) => (
            <motion.div key={i} {...fadeIn(i * 0.1)} style={{ padding: "28px 24px", borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -30, right: -10, fontSize: 72, fontWeight: 900, color: "rgba(255,255,255,0.025)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1, pointerEvents: "none" }}>{step.n}</div>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${step.color}14`, border: `1px solid ${step.color}22`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>{step.icon}</div>
              <h3 style={{ ...j, fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 10, lineHeight: 1.3 }}>{step.title}</h3>
              <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.42)", lineHeight: 1.7 }}>{step.desc}</p>
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
    { emoji: "🏢", label: "Agencies", color: "#0ea5e9", headline: "Manage 10 clients like you have a full data team.", desc: "Your team produces 20+ creatives a week across multiple brands. AdBrief connects to each client's ad account and gives your strategists real answers — which creatives to scale, which to kill, what to brief next.", points: ["Per-client personas with their own data context", "Real-time campaign performance in the chat", "Brief generation tuned to each brand's winners", "AI memory that learns each client's best hooks"] },
    { emoji: "📈", label: "Media Buyers", color: "#34d399", headline: "Stop flying blind on creative decisions.", desc: "You're accountable for ROAS but don't always control the creative. AdBrief gives you data-backed answers — which format is underperforming, what the winning hook pattern is, what to brief next.", points: ["Real spend and CTR data in every answer", "Pattern detection across top and bottom performers", "Competitor analysis and hook benchmarking", "Account memory that improves with every query"] },
    { emoji: "⚡", label: "In-house Teams", color: "#a78bfa", headline: "Your campaigns, finally speaking to each other.", desc: "Connect your company's ad accounts and give your whole team access to a shared AI that knows your performance history. One place to ask, one place to know.", points: ["Connected to your real Meta/TikTok/Google data", "Personas for each product line or audience segment", "Company profiles with brand context baked in", "Team-wide access to shared campaign intelligence"] },
  ];
  const p = profiles[active];
  return (
    <section id="for" style={{ padding: "80px 32px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span style={{ ...j, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(14,165,233,0.7)", fontWeight: 600 }}>WHO IT'S FOR</span>
          <h2 style={{ ...j, fontSize: "clamp(28px,4vw,46px)", fontWeight: 800, letterSpacing: "-0.035em", margin: "14px 0 0" }}>Built for performance teams.</h2>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 36 }}>
          {profiles.map((pr, i) => (
            <button key={i} onClick={() => setActive(i)} style={{ ...j, fontSize: 13, fontWeight: 600, padding: "9px 20px", borderRadius: 999, cursor: "pointer", transition: "all 0.15s", background: active === i ? `${pr.color}15` : "rgba(255,255,255,0.03)", color: active === i ? pr.color : "rgba(255,255,255,0.38)", border: `1px solid ${active === i ? pr.color + "35" : "rgba(255,255,255,0.07)"}` }}>
              {pr.emoji} {pr.label}
            </button>
          ))}
        </div>
        <motion.div key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
          <div style={{ padding: "32px 28px", borderRadius: 20, background: `${p.color}07`, border: `1px solid ${p.color}18` }}>
            <span style={{ fontSize: 36, display: "block", marginBottom: 16 }}>{p.emoji}</span>
            <h3 style={{ ...j, fontSize: 20, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.25, marginBottom: 14, color: "#fff" }}>{p.headline}</h3>
            <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.75, marginBottom: 24 }}>{p.desc}</p>
            <button onClick={onCTA} style={{ ...j, fontSize: 13, fontWeight: 700, padding: "11px 22px", borderRadius: 10, background: p.color, color: "#000", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              Try free for 1 day <ArrowRight size={13} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {p.points.map((point, i) => (
              <motion.div key={point} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${p.color}15`, border: `1px solid ${p.color}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <Check size={10} color={p.color} />
                </div>
                <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{point}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────────────────────────
function Pricing({ onCTA }: { onCTA: () => void }) {
  const navigate = useNavigate();
  const plans = [
    {
      name: "Maker", price: "$19", desc: "/mo · Solo or freelancer", badge: null, highlight: false,
      action: () => navigate("/signup?plan=maker"),
      tag: "For freelancers and solo buyers",
      features: ["50 AI messages / day", "1 ad account connected", "All tools unlocked", "Up to 3 personas or brands", "AI memory up to 20 analyses"],
      limit: "50 msgs/day",
    },
    {
      name: "Pro", price: "$49", desc: "/mo · Growing teams", badge: "Most popular", highlight: true,
      action: () => navigate("/signup?plan=pro"),
      tag: "For small agencies and growing teams",
      features: ["200 AI messages / day", "3 ad accounts connected", "All tools unlocked", "Unlimited personas + brands", "Multi-market (BR, MX, IN, EN)", "Competitor analysis", "AI memory up to 60 analyses"],
      limit: "200 msgs/day",
    },
    {
      name: "Studio", price: "$149", desc: "/mo · Agencies & teams", badge: null, highlight: false,
      action: () => navigate("/signup?plan=studio"),
      tag: "For agencies managing multiple clients",
      features: ["Unlimited AI messages", "Unlimited ad accounts", "All tools unlocked", "Unlimited personas + brands", "Full account memory", "Agency client workspace", "Dedicated support"],
      limit: "Unlimited",
    },
  ];
  return (
    <section id="pricing" style={{ padding: "80px 32px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{ ...j, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(14,165,233,0.7)", fontWeight: 600 }}>PRICING</span>
          <h2 style={{ ...j, fontSize: "clamp(28px,4vw,46px)", fontWeight: 800, letterSpacing: "-0.035em", margin: "14px 0 12px" }}>
            Start with a free day. Stay because it works.
          </h2>
          <p style={{ ...j, fontSize: 15, color: "rgba(255,255,255,0.38)", maxWidth: 460, margin: "0 auto 12px" }}>
            Every plan includes a 1-day free trial. No charge until it's over.
          </p>
          <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.25)", maxWidth: 460, margin: "0 auto 24px" }}>
            Free accounts get 3 AI messages to try the product. Upgrade anytime.
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.16)" }}>
            <span style={{ fontSize: 15 }}>💳</span>
            <span style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Card required · <strong style={{ color: "#fff" }}>No charge for 24 hours</strong> · Cancel anytime</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {plans.map((plan, i) => (
            <div key={i} style={{ padding: "28px 24px", borderRadius: 20, background: plan.highlight ? "rgba(14,165,233,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${plan.highlight ? "rgba(14,165,233,0.3)" : "rgba(255,255,255,0.07)"}`, display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
              {plan.badge && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: BRAND, borderRadius: 999, padding: "3px 14px" }}><span style={{ ...j, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#000", fontWeight: 700 }}>{plan.badge}</span></div>}
              <div>
                <p style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 8, fontWeight: 700, letterSpacing: "0.06em" }}>{plan.name.toUpperCase()}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ ...j, fontSize: 40, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>{plan.price}</span>
                  <span style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{plan.desc}</span>
                </div>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Check size={12} color="#0ea5e9" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ ...j, fontSize: 12.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.45 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={plan.action} style={{ ...j, width: "100%", padding: "13px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: plan.highlight ? BRAND : "rgba(255,255,255,0.06)", color: plan.highlight ? "#000" : "rgba(255,255,255,0.65)", border: `1px solid ${plan.highlight ? "transparent" : "rgba(255,255,255,0.09)"}`, cursor: "pointer" }}>
                Start free trial
              </button>
              <p style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>1-day trial · Cancel anytime</p>
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
    { q: "How does the 1-day free trial work?", a: "When you sign up for any plan, you get full access for 24 hours at no charge. If you cancel within that period, you won't be billed. If you don't cancel, your subscription starts automatically after 24 hours." },
    { q: "Why do I need a card to start?", a: "Requiring a card filters for serious users and lets us give you genuine full access — not a watered-down demo. We don't charge anything for 24 hours and you can cancel instantly from your account settings." },
    { q: "What does AdBrief connect to?", a: "Meta Ads (Facebook & Instagram), TikTok Ads, and Google Ads. Once connected, AdBrief reads your campaign data — creatives, spend, CTR, CPM — in real time and uses it to answer your questions in the AI chat." },
    { q: "Is my ad account data secure?", a: "Yes. We use OAuth — the same standard used by every major ad tool. We never store your login credentials. Access tokens are encrypted at rest. You can disconnect any account at any time from within AdBrief." },
    { q: "Can I use AdBrief for multiple clients?", a: "Yes. Pro supports 3 ad accounts and unlimited personas/brands. Studio supports unlimited connections and includes a dedicated agency client workspace." },
    { q: "What's a persona in AdBrief?", a: "A persona is an audience profile that gives the AI context — who you're targeting, what market, what platform, what their objections are. The AI uses this to tailor every answer to that specific audience instead of giving generic advice." },
  ];
  return (
    <section style={{ padding: "60px 32px 80px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ maxWidth: 660, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span style={{ ...j, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(14,165,233,0.7)", fontWeight: 600 }}>FAQ</span>
          <h2 style={{ ...j, fontSize: "clamp(24px,3.5vw,38px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "14px 0 0" }}>Common questions</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((item, i) => (
            <div key={i} style={{ borderRadius: 14, background: open === i ? "rgba(14,165,233,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${open === i ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.06)"}`, overflow: "hidden", transition: "all 0.15s" }}>
              <button onClick={() => setOpen(open === i ? null : i)} style={{ width: "100%", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", gap: 12, textAlign: "left" }}>
                <span style={{ ...j, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.82)", lineHeight: 1.4 }}>{item.q}</span>
                <ChevronDown size={14} color={open === i ? "#0ea5e9" : "rgba(255,255,255,0.25)"} style={{ flexShrink: 0, transform: open === i ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
              </button>
              {open === i && <div style={{ padding: "0 20px 16px" }}><p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.75 }}>{item.a}</p></div>}
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
    <section style={{ padding: "60px 32px 100px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
        <motion.div {...fadeIn(0)} style={{ padding: "56px 48px", borderRadius: 28, background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.15)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 500, height: 300, background: "radial-gradient(ellipse, rgba(14,165,233,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <p style={{ ...j, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(14,165,233,0.7)", marginBottom: 16, fontWeight: 600 }}>START TODAY</p>
            <h2 style={{ ...j, fontSize: "clamp(26px,4vw,40px)", fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1.1, marginBottom: 14 }}>
              Your ad account is full of insights. Start asking.
            </h2>
            <p style={{ ...j, fontSize: 15, color: "rgba(255,255,255,0.38)", marginBottom: 32 }}>
              Connect in 2 minutes. Cancel anytime within the first day.
            </p>
            <button onClick={onCTA} style={{ ...j, fontSize: 15, fontWeight: 800, padding: "15px 36px", borderRadius: 13, background: BRAND, color: "#000", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 0 40px rgba(14,165,233,0.2)" }}>
              Try free for 1 day <ArrowRight size={16} />
            </button>
            <p style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 14 }}>Any plan · 1-day free trial · Cancel before 24h, pay nothing</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "32px 32px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <Logo size="lg" />
        <div style={{ display: "flex", gap: 24 }}>
          {[["Pricing", "#pricing"], ["FAQ", "#faq"], ["Privacy", "/privacy"], ["Terms", "/terms"]].map(([label, href]) => (
            <a key={href} href={href} style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.28)", textDecoration: "none" }}>{label}</a>
          ))}
        </div>
        <p style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.18)" }}>© 2026 AdBrief</p>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function IndexNew() {
  const navigate = useNavigate();
  const handleCTA = () => navigate("/signup");
  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", ...j }}>
      <Helmet>
        <title>AdBrief — The AI that knows your ad account</title>
        <meta name="description" content="Connect Meta, TikTok or Google Ads. Ask anything about your campaigns. AdBrief reads your data in real time and thinks like a senior strategist." />
      </Helmet>
      <Nav onCTA={handleCTA} />
      <Hero onCTA={handleCTA} />
      <ChatMockup />
      <HowItWorks />
      <ForWho onCTA={handleCTA} />
      <Pricing onCTA={handleCTA} />
      <FAQ />
      <FinalCTA onCTA={handleCTA} />
      <Footer />
      <CookieConsent />
    </div>
  );
}
