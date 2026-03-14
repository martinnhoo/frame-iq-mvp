import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Menu, ArrowRight, Check, Shield, Clock } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import CookieConsent from "@/components/CookieConsent";
import LegalModal from "@/components/LegalModal";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import AuthPromptModal from "@/components/AuthPromptModal";
import { useLanguage } from "@/i18n/LanguageContext";
import { Logo } from "@/components/Logo";
import TopBanner from "@/components/TopBanner";
import LogoTicker from "@/components/LogoTicker";

function ScenarioBlock({ t }: { t: (k: string) => string }) {
  const [active, setActive] = useState<"without" | "with">("without");
  const without: { text: string; icon: string; highlight?: boolean }[] = [
    { text: t("scenario_w1"), icon: "✗" },
    { text: t("scenario_w2"), icon: "✗" },
    { text: t("scenario_w3"), icon: "✗" },
    { text: t("scenario_w4"), icon: "✗" },
  ];
  const withAB: { text: string; icon: string; highlight?: boolean }[] = [
    { text: t("scenario_a1"), icon: "→" },
    { text: t("scenario_a2"), icon: "→" },
    { text: t("scenario_a3"), icon: "→", highlight: true },
    { text: t("scenario_a4"), icon: "→" },
  ];
  const isWithout = active === "without";
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      {/* Label */}
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/35 mb-5 font-display text-center">
        {t("scenario_label")}
      </p>
      {/* Toggle */}
      <div className="flex justify-center mb-8">
        <div className="flex p-1 rounded-full gap-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {(["without", "with"] as const).map(side => {
            const isActive = active === side;
            const label = side === "without" ? t("scenario_without") : t("scenario_with");
            const activeColor = side === "without" ? "rgba(239,68,68,0.15)" : "rgba(52,211,153,0.15)";
            const activeBorder = side === "without" ? "rgba(239,68,68,0.35)" : "rgba(52,211,153,0.35)";
            const activeText = side === "without" ? "#f87171" : "#34d399";
            return (
              <button key={side} onClick={() => setActive(side)}
                className="px-4 py-2 rounded-full text-xs font-bold font-display transition-all duration-200"
                style={{
                  background: isActive ? activeColor : "transparent",
                  border: isActive ? `1px solid ${activeBorder}` : "1px solid transparent",
                  color: isActive ? activeText : "rgba(255,255,255,0.3)",
                }}>
                {side === "without" ? "✗ " : "✓ "}{label}
              </button>
            );
          })}
        </div>
      </div>
      {/* Content */}
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${isWithout ? "rgba(239,68,68,0.12)" : "rgba(52,211,153,0.12)"}`, background: isWithout ? "rgba(239,68,68,0.03)" : "rgba(52,211,153,0.03)", transition: "all 0.3s" }}>
        {/* Header bar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b" style={{ borderColor: isWithout ? "rgba(239,68,68,0.1)" : "rgba(52,211,153,0.1)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: isWithout ? "#f87171" : "#34d399" }} />
          <span className="text-xs font-bold font-display" style={{ color: isWithout ? "#f87171" : "#34d399" }}>
            {isWithout ? t("scenario_without") : t("scenario_with")}
          </span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={active}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="p-6 md:p-8 space-y-3">
            {(isWithout ? without : withAB).map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                className="flex items-start gap-3 font-body text-sm"
                style={{ color: isWithout ? "rgba(255,255,255,0.45)" : item.highlight ? "#34d399" : "rgba(255,255,255,0.7)" }}>
                <span className="shrink-0 font-bold mt-0.5" style={{ color: isWithout ? "rgba(248,113,113,0.5)" : "#34d399" }}>{item.icon}</span>
                <span className={item.highlight ? "font-semibold" : ""}>{item.text}</span>
              </motion.div>
            ))}
            {/* Bottom line */}
            <div className="pt-4 border-t mt-4" style={{ borderColor: isWithout ? "rgba(239,68,68,0.1)" : "rgba(52,211,153,0.1)" }}>
              <p className="text-xs font-semibold font-display" style={{ color: isWithout ? "#f87171" : "#34d399" }}>
                {isWithout ? `⚠ ${t("scenario_w_cost")}` : `✓ ${t("scenario_a_result")}`}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

const Index = () => {
  const navigate = useNavigate();
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);
  const { t } = useLanguage();

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: t("pricing_mo"),
      desc: t("plan_free_desc"),
      features: t("lp_plan_free_features").split("|"),
      cta: t("pricing_cta_free") || "Get started free",
      highlighted: false
    },
    {
      name: "Maker",
      price: "$19",
      period: t("pricing_mo"),
      desc: t("plan_maker_desc"),
      features: t("lp_plan_maker_features").split("|"),
      cta: t("lp_start_maker"),
      highlighted: false
    },
    {
      name: "Pro",
      price: "$49",
      period: t("pricing_mo"),
      desc: t("plan_pro_desc"),
      features: t("lp_plan_pro_features").split("|"),
      cta: t("lp_start_pro"),
      highlighted: true,
      badge: t("pricing_most_popular")
    },
    {
      name: "Studio",
      price: "$149",
      period: t("pricing_mo"),
      desc: t("plan_studio_desc"),
      features: t("lp_plan_studio_features").split("|"),
      cta: t("lp_start_studio"),
      highlighted: false
    }
  ];

  const navLinks = [
    { label: t("nav_features"), href: "#how-it-works" },
    { label: t("nav_pricing"), href: "#pricing" },
    { label: t("nav_blog"), href: "/blog", isRoute: true },
    { label: t("nav_faq"), href: "/faq", isRoute: true },
    { label: t("nav_contact"), href: "/contact", isRoute: true },
  ];

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden" style={{ background: "#060608" }}>
      <TopBanner />

      {/* Navbar */}
      <nav className="sticky top-0 left-0 right-0 z-50 border-b border-white/[0.05]" style={{ background: "rgba(6,6,8,0.85)", backdropFilter: "blur(20px)" }}>
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/"><Logo size="lg" /></Link>
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) =>
              link.isRoute ? (
                <Link key={link.label} to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">{link.label}</Link>
              ) : (
                <a key={link.label} href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">{link.label}</a>
              )
            )}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground font-body whitespace-nowrap" onClick={() => navigate("/login")}>{t("nav_signin")}</Button>
            <Button className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-600 hover:to-cyan-600 border-0 font-body whitespace-nowrap" onClick={() => navigate("/signup")}>{t("nav_get_started")}</Button>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitcher />
            <Sheet>
              <SheetTrigger asChild><Button variant="ghost" size="icon"><Menu className="h-6 w-6" /></Button></SheetTrigger>
              <SheetContent>
                <div className="flex flex-col gap-6 mt-8">
                  {navLinks.map((link) =>
                    link.isRoute ? (
                      <Link key={link.label} to={link.href} className="text-lg text-muted-foreground hover:text-foreground transition-colors font-body">{link.label}</Link>
                    ) : (
                      <a key={link.label} href={link.href} className="text-lg text-muted-foreground hover:text-foreground transition-colors font-body">{link.label}</a>
                    )
                  )}
                  <Button className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-body whitespace-nowrap" onClick={() => navigate("/signup")}>{t("nav_get_started")}</Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HERO                                                        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden pt-6 pb-8 md:pt-10 md:pb-12 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, hsla(199, 83%, 58%, 0.1) 0%, transparent 65%)', filter: 'blur(80px)' }} />

        <div className="relative z-10 max-w-[1100px] mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center gap-12 lg:gap-16">

            {/* LEFT — copy */}
            <div className="flex-1 min-w-0">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold mb-8 font-body"
                style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.25)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>147+ performance teams — BR, MX, IN, US</span>
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
                className="font-display font-bold leading-[1.06] tracking-tight mb-6"
                style={{ fontSize: 'clamp(36px, 5vw, 58px)' }}>
                The AI that makes{" "}
                <span style={{ background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  every ad dollar work harder.
                </span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
                className="text-[17px] leading-relaxed font-body mb-8"
                style={{ color: 'rgba(255,255,255,0.45)', maxWidth: 480 }}>
                AdBrief learns from your performance data and tells you exactly what to produce next — the right hook, format, and angle. More winners. Less waste. Every cycle.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-3 mb-6">
                <button onClick={() => navigate("/signup")}
                  className="font-body font-bold text-[15px] whitespace-nowrap flex items-center gap-2 justify-center"
                  style={{ padding: "14px 28px", borderRadius: 14, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", color: "#000", border: "none", cursor: "pointer" }}>
                  {t("hero_cta_primary")} <ArrowRight size={16} />
                </button>
                <button onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                  className="font-body font-semibold text-[15px] whitespace-nowrap"
                  style={{ padding: "14px 24px", borderRadius: 14, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
                  {t("hero_cta_secondary")}
                </button>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="flex flex-wrap items-center gap-x-5 gap-y-2 font-body text-[12px]"
                style={{ color: "rgba(255,255,255,0.3)" }}>
                <span>✓ {t("hero_check_1")}</span>
                <span>✓ {t("hero_check_2")}</span>
                <span>✓ {t("hero_check_3")}</span>
              </motion.div>
            </div>

            {/* RIGHT — product mock */}
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, delay: 0.35 }}
              className="flex-1 min-w-0 w-full lg:max-w-[520px]"
              style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(14,165,233,0.18)", boxShadow: "0 0 80px rgba(14,165,233,0.07), 0 32px 64px rgba(0,0,0,0.6)" }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ background: "rgba(14,165,233,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,90,90,0.35)" }} />
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,190,50,0.35)" }} />
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(50,215,75,0.35)" }} />
                </div>
                <div className="flex-1 mx-3 h-5 rounded-md flex items-center px-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "'Inter',sans-serif" }}>adbrief.pro/dashboard/loop/ai</span>
                </div>
              </div>
              <div className="p-5" style={{ background: "#07070f" }}>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {([
                    { label: t("hero_mock_stat1"), value: "38%", color: "#34d399" },
                    { label: t("hero_mock_stat2"), value: "7.4", color: "#0ea5e9" },
                    { label: t("hero_mock_stat3"), value: "12", color: "#06b6d4" },
                  ] as {label:string;value:string;color:string}[]).map(s => (
                    <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="font-bold text-xl" style={{ color: s.color, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{s.value}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Inter',sans-serif" }}>{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-sm" style={{ background: "linear-gradient(135deg, #0ea5e9, #06b6d4)" }}>🧠</div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold mb-1" style={{ color: "#0ea5e9", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>AdBrief AI · Pattern detected</p>
                    <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Inter',sans-serif" }}>
                      Curiosity hooks outperform your avg by <span style={{ color: "#34d399", fontWeight: 600 }}>2.3×</span>. Last 3 wasted creatives all used VSL format in BR — avoid this combo.
                    </p>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(6,182,212,0.2)", background: "rgba(6,182,212,0.05)" }}>
                  <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid rgba(6,182,212,0.1)" }}>
                    <span className="text-sm">⚡</span>
                    <span className="text-[11px] font-bold" style={{ color: "#06b6d4", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{t("hero_mock_label")}</span>
                  </div>
                  <div className="px-3 py-2.5 space-y-1.5">
                    {[t("hero_hook1"), t("hero_hook2"), t("hero_hook3")].map((h, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <span className="text-[10px] mt-0.5 shrink-0" style={{ color: "rgba(6,182,212,0.5)" }}>→</span>
                        <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Inter',sans-serif" }}>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      <LogoTicker />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* REAL SCENARIO — interactive Before / After                 */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="py-16 px-6 border-y border-white/[0.06]">
        <div className="container mx-auto max-w-4xl">
          <ScenarioBlock t={t} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* AI EVOLUTION TIMELINE                                      */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <span className="text-xs font-semibold tracking-widest uppercase font-display" style={{ background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              YOUR AI GROWS WITH YOU
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mt-4 font-display" style={{ letterSpacing: "-0.02em" }}>
              The more you use it, the smarter it gets.
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto font-body text-base">
              Your media buyer forgets. AdBrief never does. Every ad, every result, every pattern — permanently stored and used.
            </p>
          </div>

          <div className="relative">
            {/* Vertical connector */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px md:-translate-x-px" style={{ background: "linear-gradient(180deg, #0ea5e9, #06b6d4, #34d399)" }} />

            {[
              {
                day: "Day 1",
                title: "AI starts learning",
                desc: "You upload your first ads and import performance data from Meta or TikTok. The AI starts recording everything.",
                example: "\"5 ads uploaded. Analyzing hooks, formats, and market signals...\"",
                color: "#0ea5e9",
                score: "Intelligence: 5%",
              },
              {
                day: "Day 7",
                title: "First patterns appear",
                desc: "With 10-15 ads, the AI starts seeing patterns. Which hook types get clicks? Which markets respond better?",
                example: "\"Pattern found: UGC + Curiosity hooks → 1.8x higher CTR in your BR campaigns\"",
                color: "#60a5fa",
                score: "Intelligence: 25%",
              },
              {
                day: "Day 30",
                title: "Predictive scoring active",
                desc: "50+ ads analyzed. The AI now predicts which concepts will work BEFORE you produce them. Scores from 0 to 100.",
                example: "\"This script concept scores 84/100 — matches your top 3 winning patterns\"",
                color: "#06b6d4",
                score: "Intelligence: 70%",
              },
              {
                day: "Day 90",
                title: "AI masters your account",
                desc: "Hundreds of data points. The AI knows your winning formula better than any person could. It suggests what to produce before you even ask.",
                example: "\"Recommended: Produce 3 UGC variations with social proof hooks for TikTok BR — predicted ROAS 4.2x\"",
                color: "#34d399",
                score: "Intelligence: 95%",
              },
            ].map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                className={`relative flex gap-6 md:gap-12 mb-10 last:mb-0 ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}>
                {/* Dot on timeline */}
                <div className="absolute left-6 md:left-1/2 top-2 w-3 h-3 rounded-full -translate-x-1.5 z-10 ring-4 ring-background" style={{ background: step.color }} />
                
                {/* Spacer for the other side */}
                <div className="hidden md:block md:w-1/2" />

                {/* Content card */}
                <div className="ml-14 md:ml-0 md:w-1/2 p-6 rounded-2xl" style={{ background: `${step.color}06`, border: `1px solid ${step.color}18` }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest font-display" style={{ color: step.color }}>{step.day}</span>
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full font-body" style={{ background: `${step.color}15`, color: step.color }}>{step.score}</span>
                  </div>
                  <h3 className="text-lg font-bold font-display text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed font-body mb-3">{step.desc}</p>
                  {/* Fake AI output */}
                  <div className="px-4 py-3 rounded-xl text-xs font-mono leading-relaxed" style={{ background: `${step.color}08`, border: `1px solid ${step.color}12`, color: `${step.color}cc` }}>
                    {step.example}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS — 3 dead-simple steps                        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-20 px-6 border-y border-white/[0.06]">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <span className="text-xs font-semibold tracking-widest uppercase font-display" style={{ background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              {t("how_label2")}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mt-4 font-display" style={{ letterSpacing: "-0.02em" }}>
              {t("how_title2")}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {([
              { n: "1", icon: "📥", title: t("how_s1_title"), desc: t("how_s1_desc"), result: t("how_s1_result"), color: "#0ea5e9" },
              { n: "2", icon: "🧠", title: t("how_s2_title"), desc: t("how_s2_desc"), result: t("how_s2_result"), color: "#06b6d4" },
              { n: "3", icon: "⚡", title: t("how_s3_title"), desc: t("how_s3_desc"), result: t("how_s3_result"), color: "#34d399" },
            ] as {n:string;icon:string;title:string;desc:string;result:string;color:string}[]).map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }} viewport={{ once: true }}
                className="p-7 rounded-2xl relative" style={{ background: `${step.color}05`, border: `1px solid ${step.color}15` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-4" style={{ background: `${step.color}12` }}>{step.icon}</div>
                <span className="text-[11px] font-bold uppercase tracking-widest font-display" style={{ color: `${step.color}80` }}>Step {step.n}</span>
                <h3 className="text-lg font-bold font-display text-foreground mt-1 mb-3">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-body mb-4">{step.desc}</p>
                <div className="pt-3 border-t" style={{ borderColor: `${step.color}15` }}>
                  <p className="text-xs font-semibold font-display" style={{ color: step.color }}>→ {step.result}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* WHAT THE AI ACTUALLY DOES — concrete examples              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold font-display" style={{ letterSpacing: "-0.02em" }}>
              {t("ai_section_title")}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto font-body text-base">
              {t("ai_section_sub")}
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                label: "Pattern Detection",
                output: "\"Your UGC ads with curiosity hooks outperform talking-head by 2.3x in BR market. Top CTR: 2.1% vs 0.9%.\"",
                icon: "🔍",
                color: "#0ea5e9",
              },
              {
                label: "Predictive Score",
                output: "\"New concept: UGC + Social Proof + TikTok BR → Score: 87/100 — High confidence. Matches 4 of your top 5 winners.\"",
                icon: "🎯",
                color: "#06b6d4",
              },
              {
                label: "Script Generation",
                output: "\"Based on your data: curiosity hooks convert 2x better. Generated 3 scripts using your proven hook → pain → solution structure.\"",
                icon: "📝",
                color: "#60a5fa",
              },
              {
                label: "Creative Brief",
                output: "\"Recommended: 9:16 UGC with talent MT for ACME client. Hook angle: before/after. Predicted ROAS: 3.8x based on 12 similar winners.\"",
                icon: "📋",
                color: "#34d399",
              },
              {
                label: "Account Intelligence",
                output: "\"Your worst performing combo: VSL + cold audience + US market (avg CTR 0.4%). Avoid this combination or test with different hooks.\"",
                icon: "⚠️",
                color: "#fbbf24",
              },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} viewport={{ once: true }}
                className="flex gap-4 p-5 rounded-2xl items-start" style={{ background: `${item.color}04`, border: `1px solid ${item.color}12` }}>
                <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-lg" style={{ background: `${item.color}12` }}>{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest font-display" style={{ color: `${item.color}` }}>{item.label}</span>
                  <p className="text-sm font-mono mt-1 leading-relaxed" style={{ color: `${item.color}bb` }}>{item.output}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PROVOCATIVE SECTION                                        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="py-16 px-6 border-y border-white/[0.06]">
        <div className="container mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl md:text-3xl font-bold font-display mb-6" style={{ letterSpacing: "-0.01em" }}>
              {t("prov_title1")}
              <br />
              <span style={{ background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                {t("prov_title2")}
              </span>
            </h2>
            <div className="grid md:grid-cols-3 gap-4 mt-8">
              {([
                { human: t("prov_h1"), ai: t("prov_ai1"), icon: "🧠" },
                { human: t("prov_h2"), ai: t("prov_ai2"), icon: "🎯" },
                { human: t("prov_h3"), ai: t("prov_ai3"), icon: "🔄" },
              ] as {human:string;ai:string;icon:string}[]).map((item, i) => (
                <div key={i} className="p-5 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="text-xl mb-3 block">{item.icon}</span>
                  <p className="text-xs text-red-400/60 line-through font-body mb-1">{item.human}</p>
                  <p className="text-sm text-green-400/80 font-semibold font-body">{item.ai}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CREATIVE PERFORMANCE LOOP                                   */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{background:"radial-gradient(ellipse at 60% 50%,rgba(14,165,233,0.06),transparent 60%)"}} />
        <div className="container mx-auto max-w-5xl relative">
          <div className="text-center mb-14">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] font-display"
              style={{background:"linear-gradient(135deg, #0ea5e9, #06b6d4)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
              {t("lp_loop_label")}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 font-display" style={{letterSpacing:"-0.02em"}}>
              {t("lp_loop_title")}
            </h2>
            <p className="text-muted-foreground mt-3 text-sm font-body max-w-xl mx-auto">{t("lp_loop_sub")}</p>
          </div>

          <div className="grid md:grid-cols-4 gap-4 mb-8">
            {([
              { n:"01", emoji:"📋", title:t("lp_loop_step1"), desc:t("lp_loop_step1_desc"), color:"#0ea5e9" },
              { n:"02", emoji:"🎬", title:t("lp_loop_step2"), desc:t("lp_loop_step2_desc"), color:"#60a5fa" },
              { n:"03", emoji:"📊", title:t("lp_loop_step3"), desc:t("lp_loop_step3_desc"), color:"#06b6d4" },
              { n:"04", emoji:"🧠", title:t("lp_loop_step4"), desc:t("lp_loop_step4_desc"), color:"#34d399" },
            ] as {n:string;emoji:string;title:string;desc:string;color:string}[]).map((step, i) => (
              <motion.div key={i} initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}} transition={{delay:i*0.1}} viewport={{once:true}}
                className="relative p-5 rounded-2xl flex flex-col gap-3"
                style={{background:"rgba(255,255,255,0.025)",border:`1px solid ${step.color}25`}}>
                {i < 3 && (
                  <div className="hidden md:flex absolute -right-3 top-8 z-10 w-6 h-6 items-center justify-center rounded-full text-white/20 text-xs"
                    style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>→</div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold font-display" style={{color:step.color,opacity:0.3}}>{step.n}</span>
                  <span className="text-xl">{step.emoji}</span>
                </div>
                <p className="text-sm font-bold text-white/85 font-display">{step.title}</p>
                <p className="text-xs text-white/40 font-body leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Coming soon banner */}
          <motion.div initial={{opacity:0,y:10}} whileInView={{opacity:1,y:0}} viewport={{once:true}}
            className="flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl mx-auto w-fit"
            style={{background:"linear-gradient(135deg,rgba(251,191,36,0.1),rgba(251,191,36,0.05))",border:"1px solid rgba(251,191,36,0.3)"}}>
            <span className="text-base">⚡</span>
            <span className="text-sm font-semibold text-amber-300/80 font-body">{t("lp_loop_banner")}</span>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PRICING                                                    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-24 px-6 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent, rgba(139, 92, 246, 0.03), transparent)' }} />
        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold tracking-wider uppercase gradient-text font-display">{t("pricing_label")}</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4 font-display">Simple, transparent pricing</h2>
            <div className="mt-5 inline-flex items-center gap-3 px-5 py-3 rounded-2xl font-body"
              style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)" }}>
              <span className="text-2xl">💡</span>
              <p className="text-sm text-white/70">
                One production that fails = <span className="text-white font-semibold">$500+ wasted.</span>{" "}
                AdBrief pays for itself <span className="text-purple-300 font-semibold">in the first bad ad it catches.</span>
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} viewport={{ once: true }}>
                <Card className={`relative h-full ${plan.highlighted ? 'border-sky-500/50 shadow-xl shadow-sky-500/10 md:-translate-y-4' : 'border-border/50'} transition-all duration-300 hover:-translate-y-2 bg-card/80 backdrop-blur-sm`}>
                  {plan.badge && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white border-0 px-4 font-body">{plan.badge}</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-6">
                    <CardTitle className="text-lg text-muted-foreground font-normal mb-2 font-body">{plan.name}</CardTitle>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold font-display">{plan.price}</span>
                      <span className="text-muted-foreground font-body">{plan.period}</span>
                    </div>
                    {plan.desc && <p className="text-xs text-muted-foreground/70 mt-2 font-body">{plan.desc}</p>}
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => {
                        const denied = feature.startsWith("✗ ");
                        const label = denied ? feature.slice(2) : feature;
                        return (
                          <li key={i} className={`flex items-center gap-3 text-sm font-body ${denied ? "opacity-40" : ""}`}>
                            {denied ? <span className="w-4 h-4 text-muted-foreground/50 shrink-0 flex items-center justify-center text-xs">✕</span>
                              : <Check className="w-4 h-4 text-green-500 shrink-0" />}
                            <span className={denied ? "line-through text-muted-foreground/50" : "text-muted-foreground"}>{label}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <Button className={`w-full font-body ${plan.highlighted ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-600 hover:to-cyan-600 border-0' : 'bg-card text-foreground hover:bg-muted border border-border'}`}
                      onClick={() => navigate(plan.name === "Free" ? "/signup" : `/signup?plan=${plan.name.toLowerCase()}`)}>
                      {plan.cta}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-10 space-y-2 font-body">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-3"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] text-amber-400/80 font-semibold font-body">{t("pricing_urgency")}</span>
            </div>
            <p className="text-sm text-muted-foreground">{t("pricing_free_note")}</p>
            <button onClick={() => navigate("/pricing")} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors">{t("pricing_see_all")}</button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* FINAL CTA                                                  */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            className="p-12 rounded-3xl relative overflow-hidden"
            style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.12),rgba(236,72,153,0.08))", border: "1px solid rgba(139,92,246,0.18)" }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% -20%,rgba(14,165,233,0.18),transparent 60%)" }} />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 font-display" style={{ letterSpacing: "-0.02em" }}>
                Your ads should perform.
                <br />
                <span style={{ background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  AdBrief makes sure they do.
                </span>
              </h2>
              <p className="text-white/50 text-base mb-8 max-w-lg mx-auto font-body leading-relaxed">
                Join 147+ performance teams using AdBrief to produce smarter creatives, reduce wasted spend, and scale what actually works.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-8 font-body">
                <span className="flex items-center gap-1.5 text-xs text-white/40"><Check className="w-3.5 h-3.5 text-green-400" /> Free forever plan</span>
                <span className="flex items-center gap-1.5 text-xs text-white/40"><Check className="w-3.5 h-3.5 text-green-400" /> No credit card needed</span>
                <span className="flex items-center gap-1.5 text-xs text-white/40"><Check className="w-3.5 h-3.5 text-green-400" /> 2 min setup</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="relative overflow-hidden bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-400 hover:to-cyan-400 font-bold text-base h-auto border-0 rounded-xl px-10 py-4 shadow-lg shadow-sky-500/30 font-body group"
                  onClick={() => navigate("/signup")}>
                  <span className="relative z-10 flex items-center gap-2">
                    Start your loop — free
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Button>
                <Button variant="outline" className="bg-transparent text-foreground hover:bg-white/5 text-base h-auto rounded-xl px-8 py-4 border-white/10 font-body"
                  onClick={() => navigate("/book-demo")}>
                  Book a demo
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50">
        <div className="container mx-auto px-6 py-16">
          <div className="grid md:grid-cols-4 gap-12">
            <div className="md:col-span-1">
              <div className="mb-4"><Logo size="lg" /></div>
              <p className="text-sm text-muted-foreground leading-relaxed font-body">{t("footer_desc")}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 font-display">{t("footer_product")}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground font-body">
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors">{t("nav_features")}</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">{t("nav_pricing")}</a></li>
                <li><Link to="/book-demo" className="hover:text-foreground transition-colors">{t("footer_book_demo")}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 font-display">{t("footer_company")}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground font-body">
                <li><Link to="/blog" className="hover:text-foreground transition-colors">{t("nav_blog")}</Link></li>
                <li><Link to="/faq" className="hover:text-foreground transition-colors">{t("nav_faq")}</Link></li>
                <li><Link to="/contact" className="hover:text-foreground transition-colors">{t("nav_contact")}</Link></li>
                <li><Link to="/careers" className="hover:text-foreground transition-colors">{t("footer_careers")}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 font-display">{t("footer_legal")}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground font-body">
                <li><button onClick={() => setLegalModal("privacy")} className="hover:text-foreground transition-colors">{t("footer_privacy")}</button></li>
                <li><button onClick={() => setLegalModal("terms")} className="hover:text-foreground transition-colors">{t("footer_terms")}</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border/50 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground font-body">{t("footer_rights")}</div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground font-body">
              <span className="flex items-center gap-2"><Shield className="w-4 h-4" />{t("footer_soc2")}</span>
              <span className="flex items-center gap-2"><Clock className="w-4 h-4" />{t("footer_uptime")}</span>
            </div>
          </div>
        </div>
      </footer>

      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
      <CookieConsent />
      <AuthPromptModal />

      {/* Sticky mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 md:hidden"
        style={{ background: "linear-gradient(to top, rgba(6,6,8,0.98) 70%, transparent)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <button className="w-full font-bold text-sm rounded-xl py-3.5 text-black font-body whitespace-nowrap"
          style={{ background: "linear-gradient(135deg, #0ea5e9, #06b6d4)" }}
          onClick={() => navigate("/signup")}>
          {t("hero_cta_primary")} →
        </button>
        <p className="text-center text-[10px] text-white/20 mt-1.5 font-body">{t("lp_mobile_sub")}</p>
      </div>
    </div>
  );
};

export default Index;
