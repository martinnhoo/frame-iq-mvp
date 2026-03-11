import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Zap, Infinity, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LanguageSwitcher from "@/components/LanguageSwitcher";

// ── Plan data ─────────────────────────────────────────────────────────────────

const TIERS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    desc: "Test the product. No credit card.",
    color: "#ffffff30",
    gradient: null,
    features: [
      "3 video analyses / month",
      "3 production boards / month",
      "5 translations / month",
      "3 pre-flight checks",
      "All templates",
      "24h cooldown between AI actions",
    ],
    missing: ["Hook Generator", "AI learning profile", "Persona intelligence"],
    cta: "Start free",
    ctaPlan: null,
  },
  {
    id: "maker",
    name: "Maker",
    price: 19,
    desc: "For solo creators and freelancers.",
    color: "#60a5fa",
    gradient: null,
    features: [
      "20 video analyses / month",
      "20 production boards / month",
      "100 translations / month",
      "20 pre-flight checks",
      "Hook Generator — unlimited",
      "All templates",
      "No cooldown",
    ],
    missing: ["AI learning profile", "Persona intelligence"],
    cta: "Start Maker",
    ctaPlan: "maker",
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    desc: "For performance teams shipping weekly.",
    color: "#a78bfa",
    gradient: null,
    badge: "Most popular",
    features: [
      "60 video analyses / month",
      "60 production boards / month",
      "Unlimited translations",
      "60 pre-flight checks",
      "Hook Generator — unlimited",
      "AI learning profile",
      "Persona intelligence",
      "All templates",
    ],
    missing: [],
    cta: "Start Pro",
    ctaPlan: "pro",
  },
];

const STUDIO = {
  id: "studio",
  name: "Studio",
  price: 149,
  desc: "For teams that produce every day.",
  features: [
    "Unlimited video analyses",
    "Unlimited production boards",
    "Unlimited translations",
    "Unlimited pre-flight checks",
    "Unlimited hooks & scripts",
    "AI learning profile",
    "Full persona intelligence",
    "Priority processing",
    "API access",
    "Priority support",
  ],
  ctaPlan: "studio",
};

const FAQ = [
  {
    q: "What counts as an 'analysis'?",
    a: "Each video you upload and run through the AI analysis counts as one. Viewing or re-reading past analyses is free and doesn't count.",
  },
  {
    q: "What's the 24h cooldown on Free?",
    a: "On the Free plan, after each AI action (analysis, board, pre-flight) there's a 24-hour wait before the next one. This is how we keep Free sustainable. Upgrade to Maker or above and it disappears entirely.",
  },
  {
    q: "Can I switch plans at any time?",
    a: "Yes. Upgrades take effect immediately. Downgrades take effect at the end of your billing cycle.",
  },
  {
    q: "What happens to my data if I downgrade?",
    a: "All your analyses, boards, and personas stay in your account. You just lose access to features above your new plan limit.",
  },
  {
    q: "Is there a trial for paid plans?",
    a: "We don't offer trials, but the Free plan is genuinely functional — run 3 analyses and 3 boards before you decide.",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

const mono = { fontFamily: "'DM Mono', monospace" } as const;
const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;

export default function Pricing() {
  const navigate = useNavigate();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleUpgrade = async (planId: string | null) => {
    if (!planId) { navigate("/signup"); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/signup"); return; }

    setUpgrading(planId);
    try {
      const { data, error } = await supabase.functions.invoke("upgrade-plan", {
        body: { user_id: session.user.id, new_plan: planId },
      });
      if (error) throw error;
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else if (data?.mock_mode) {
        toast.success(`Plan updated to ${planId}. Payment integration activating soon.`);
        navigate("/dashboard");
      } else if (data?.upgraded) {
        toast.success("Plan upgraded successfully!");
        navigate("/dashboard?upgraded=" + planId);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <div className="min-h-screen text-white" style={{ background: "#050505" }}>

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link to="/"><Logo /></Link>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <Link to="/dashboard"
            className="text-sm text-white/40 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/[0.08] hover:border-white/20">
            Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-16 pb-32">

        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-[0.25em] mb-4"
            style={{ color: "#a78bfa", ...mono }}>Pricing</p>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4" style={syne}>
            Pay for output,<br />not for access.
          </h1>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            No seat fees. No hidden costs. Every plan includes the full product —
            the difference is how much you can produce per month.
          </p>
        </div>

        {/* ── 3 regular tiers ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="relative rounded-2xl p-6 flex flex-col"
              style={{
                background: "#0a0a0d",
                border: `1px solid ${tier.id === "pro" ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}>

              {/* Badge */}
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa", ...mono }}>
                    {tier.badge}
                  </span>
                </div>
              )}

              {/* Plan name + price */}
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-widest mb-2"
                  style={{ color: tier.color, ...mono }}>{tier.name}</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-black text-white" style={syne}>
                    {tier.price === 0 ? "Free" : `$${tier.price}`}
                  </span>
                  {tier.price > 0 && (
                    <span className="text-white/30 text-sm mb-1.5" style={mono}>/mo</span>
                  )}
                </div>
                <p className="text-white/35 text-sm">{tier.desc}</p>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-6 flex-1">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/60">
                    <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: tier.color }} />
                    {f}
                  </li>
                ))}
                {tier.missing.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/20 line-through">
                    <span className="h-3.5 w-3.5 shrink-0 mt-0.5 text-center" style={{ color: "rgba(255,255,255,0.15)" }}>—</span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => handleUpgrade(tier.ctaPlan)}
                disabled={upgrading === tier.id}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all"
                style={tier.id === "pro"
                  ? { background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa" }
                  : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
                {upgrading === tier.id ? "Redirecting..." : tier.cta}
              </button>
            </motion.div>
          ))}
        </div>

        {/* ── Studio — full-width dominant card ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="relative rounded-3xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0e0814 0%, #0a0a14 50%, #0d080f 100%)",
            border: "1px solid rgba(167,139,250,0.25)",
          }}>

          {/* Glow blobs */}
          <div className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-20 pointer-events-none"
            style={{ background: "radial-gradient(circle, #a78bfa 0%, transparent 70%)", transform: "translate(-30%, -30%)" }} />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-15 pointer-events-none"
            style={{ background: "radial-gradient(circle, #f472b6 0%, transparent 70%)", transform: "translate(30%, 30%)" }} />

          <div className="relative p-8 md:p-10">
            <div className="flex flex-col md:flex-row md:items-center gap-8">

              {/* Left: name + price + desc */}
              <div className="md:w-72 shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <Infinity className="h-4 w-4" style={{ color: "#a78bfa" }} />
                  <span className="text-xs font-bold uppercase tracking-[0.2em]"
                    style={{ color: "#a78bfa", ...mono }}>Studio</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.2), rgba(244,114,182,0.2))", border: "1px solid rgba(167,139,250,0.3)", color: "#c084fc", ...mono }}>
                    UNLIMITED
                  </span>
                </div>
                <div className="flex items-end gap-1.5 mb-3">
                  <span className="text-6xl font-black text-white" style={syne}>$149</span>
                  <span className="text-white/30 mb-2" style={mono}>/mo</span>
                </div>
                <p className="text-white/40 text-sm leading-relaxed mb-6">{STUDIO.desc}</p>
                <button
                  onClick={() => handleUpgrade(STUDIO.ctaPlan)}
                  disabled={upgrading === STUDIO.id}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold text-sm text-black transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #a78bfa, #f472b6)" }}>
                  {upgrading === STUDIO.id
                    ? "Redirecting..."
                    : <><Zap className="h-4 w-4" /> Start Studio — unlimited everything</>}
                </button>
              </div>

              {/* Right: features grid */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {STUDIO.features.map(f => (
                  <div key={f} className="flex items-center gap-2.5 text-sm text-white/70">
                    <div className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.2)" }}>
                      <Check className="h-3 w-3" style={{ color: "#a78bfa" }} />
                    </div>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Comparison note */}
        <p className="text-center text-white/20 text-xs mt-6" style={mono}>
          All plans include: Hook Generator access · Templates · Persona creator · Intelligence feed · 
          Translation tool · Dashboard analytics
        </p>

        {/* ── FAQ ── */}
        <div className="mt-24 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-8 text-center" style={syne}>
            Questions
          </h2>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <div key={i}
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.06)", background: "#0a0a0d" }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left">
                  <span className="text-sm font-semibold text-white/80">{item.q}</span>
                  {openFaq === i
                    ? <ChevronUp className="h-4 w-4 text-white/30 shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-white/30 shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-white/40 leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-20 text-center">
          <p className="text-white/25 text-sm mb-2">Still not sure?</p>
          <Link to="/signup"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
            Start free — no credit card needed <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

      </div>
    </div>
  );
}
