import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, FileText, Globe, Brain, Sparkles, Menu, ArrowRight, Play, Zap, Shield, Clock, Check, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
import CookieConsent from "@/components/CookieConsent";
import LegalModal from "@/components/LegalModal";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import AuthPromptModal from "@/components/AuthPromptModal";
import { useLanguage } from "@/i18n/LanguageContext";
import { Logo } from "@/components/Logo";
import TopBanner from "@/components/TopBanner";
import LogoTicker from "@/components/LogoTicker";

const Index = () => {
  const navigate = useNavigate();
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);
  const { t } = useLanguage();

  const features = [
    { icon: Video, title: t("feature_video_title"), description: t("feature_video_desc"), gradient: "from-purple-500/20 to-pink-500/20", slug: "video-analysis" },
    { icon: FileText, title: t("feature_board_title"), description: t("feature_board_desc"), gradient: "from-blue-500/20 to-cyan-500/20", slug: "board-generation" },
    { icon: Globe, title: t("feature_translation_title"), description: t("feature_translation_desc"), gradient: "from-green-500/20 to-emerald-500/20", slug: "auto-translation" },
    { icon: Brain, title: t("feature_intelligence_title"), description: t("feature_intelligence_desc"), gradient: "from-orange-500/20 to-amber-500/20", slug: "creative-intelligence" },
    { icon: Sparkles, title: t("feature_ai_video_title"), description: t("feature_ai_video_desc"), gradient: "from-pink-500/20 to-rose-500/20", slug: "ai-video-generation" },
    { icon: Zap, title: t("feature_api_title"), description: t("feature_api_desc"), gradient: "from-violet-500/20 to-purple-500/20", slug: "api-access" },
  ];

  const stats = [
    { value: "2.4M+", label: t("stats_videos") },
    { value: "147", label: t("stats_teams") },
    { value: "12", label: t("stats_countries") },
    { value: "< 60s", label: t("stats_time") },
  ];

  const steps = [
    { number: "01", title: t("how_step1_title"), description: t("how_step1_desc") },
    { number: "02", title: t("how_step2_title"), description: t("how_step2_desc") },
    { number: "03", title: t("how_step3_title"), description: t("how_step3_desc") },
  ];

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: t("pricing_mo"),
      desc: "Try before you commit. No credit card.",
      features: t("lp_plan_free_features").split("|"),
      cta: t("pricing_cta_free") || "Get started free",
      highlighted: false
    },
    {
      name: "Maker",
      price: "$19",
      period: t("pricing_mo"),
      desc: "For solo creators and freelancers.",
      features: t("lp_plan_maker_features").split("|"),
      cta: t("lp_start_maker"),
      highlighted: false
    },
    {
      name: "Pro",
      price: "$49",
      period: t("pricing_mo"),
      desc: "For performance teams running ads at scale.",
      features: t("lp_plan_pro_features").split("|"),
      cta: t("lp_start_pro"),
      highlighted: true,
      badge: t("pricing_most_popular")
    },
    {
      name: "Studio",
      price: "$149",
      period: t("pricing_mo"),
      desc: "For teams that produce every day.",
      features: t("lp_plan_studio_features").split("|"),
      cta: t("lp_start_studio"),
      highlighted: false
    }
  ];

  const navLinks = [
    { label: t("nav_features"), href: "#features" },
    { label: t("nav_pricing"), href: "#pricing" },
    { label: t("nav_blog"), href: "/blog", isRoute: true },
    { label: t("nav_faq"), href: "/faq", isRoute: true },
    { label: t("nav_contact"), href: "/contact", isRoute: true },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Top banner — high demand / live activity — static, pushes nav down */}
      <TopBanner />

      {/* Navbar */}
      <nav className="sticky top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/">
            <Logo size="lg" />
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              link.isRoute ? (
                <Link key={link.label} to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">
                  {link.label}
                </Link>
              ) : (
                <a key={link.label} href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">
                  {link.label}
                </a>
              )
            ))}
          </div>
          
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground font-body" onClick={() => navigate("/login")}>
              {t("nav_signin")}
            </Button>
            <Button 
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 border-0 font-body"
              onClick={() => navigate("/signup")}
            >
              {t("nav_get_started")}
            </Button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitcher />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <div className="flex flex-col gap-6 mt-8">
                  {navLinks.map((link) => (
                    link.isRoute ? (
                      <Link key={link.label} to={link.href} className="text-lg text-muted-foreground hover:text-foreground transition-colors font-body">
                        {link.label}
                      </Link>
                    ) : (
                      <a key={link.label} href={link.href} className="text-lg text-muted-foreground hover:text-foreground transition-colors font-body">
                        {link.label}
                      </a>
                    )
                  ))}
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-body" onClick={() => navigate("/signup")}>
                    {t("nav_get_started")}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* Hero Section — Creative Performance Loop */}
      <section className="relative flex flex-col justify-center px-6 overflow-hidden pt-16 pb-16">
        {/* Background Effects */}
        <div 
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, hsla(262, 83%, 58%, 0.12) 0%, transparent 60%)',
            filter: 'blur(60px)',
          }}
        />
        
        <div className="relative z-10 max-w-[900px] mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center rounded-full px-4 py-1.5 text-[12px] mb-8 gap-2 font-body"
            style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))', border: '1px solid rgba(139, 92, 246, 0.3)' }}
          >
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-muted-foreground">{t("hero_badge")}</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-[40px] md:text-[52px] lg:text-[64px] font-bold text-foreground leading-[1.08] tracking-tight font-display"
          >
            AI that decodes
            <br />
            <span style={{
              background: "linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>your winning formula.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-[17px] md:text-[19px] max-w-[640px] mx-auto mt-6 leading-relaxed text-muted-foreground font-body"
          >
            Upload your ads, feed your performance data. AdBrief's AI learns what works for YOUR account — hooks, formats, markets, audiences — and every tool gets smarter with every ad you run.
          </motion.p>

          {/* Loop cycle mini-visual */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="flex items-center justify-center gap-2 mt-10 flex-wrap font-body"
          >
            {[
              { label: "Upload Ads", icon: "📥", color: "#60a5fa" },
              { label: "AI Decodes", icon: "🧠", color: "#a78bfa" },
              { label: "Patterns Found", icon: "🎯", color: "#f472b6" },
              { label: "Tools Adapt", icon: "⚡", color: "#34d399" },
              { label: "Loop Grows", icon: "📈", color: "#fbbf24" },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                  style={{ background: `${step.color}10`, border: `1px solid ${step.color}25` }}>
                  <span className="text-lg">{step.icon}</span>
                  <span className="text-sm font-semibold" style={{ color: step.color }}>{step.label}</span>
                </div>
                {i < 4 && <span className="text-white/15 text-lg">→</span>}
              </div>
            ))}
          </motion.div>

          {/* Pricing preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex items-center justify-center gap-6 mt-6 font-body"
          >
            <span className="text-sm text-muted-foreground">{t("lp_free_to_start")}</span>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-sm text-muted-foreground">{t("hero_check_2")}</span>
            <span className="text-muted-foreground/30">·</span>
            <a href="#pricing" className="text-sm text-primary hover:underline">{t("lp_see_plans")}</a>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8"
          >
            <Button 
              className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 font-bold text-base h-auto border-0 rounded-xl px-8 py-4 shadow-lg shadow-purple-500/30 font-body group"
              onClick={() => navigate("/signup")}
            >
              <span className="relative z-10 flex items-center gap-2">
                Start your loop — free
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </Button>
            <Button 
              variant="outline" 
              className="bg-transparent text-foreground hover:bg-white/5 text-base h-auto rounded-xl px-8 py-4 group border-white/10 font-body"
              onClick={() => {
                const el = document.getElementById('loop-section');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <Play className="w-4 h-4 mr-2 group-hover:text-purple-400 transition-colors fill-current opacity-60" />
              See how it works
            </Button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mt-8 font-body"
          >
            <span className="flex items-center gap-2 text-xs text-muted-foreground/70">
              <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
             {t("hero_check_1")}
            </span>
            <span className="hidden sm:block w-px h-4 bg-white/10" />
            <span className="flex items-center gap-2 text-xs text-muted-foreground/70">
              <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
              Learns from YOUR data
            </span>
            <span className="hidden sm:block w-px h-4 bg-white/10" />
            <span className="flex items-center gap-2 text-xs font-medium" style={{color:"rgba(167,139,250,0.8)"}}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
              {t("lp_live_teams")}
            </span>
          </motion.div>
        </div>
      </section>

      {/* Creative Performance Loop — dedicated section */}
      <section id="loop-section" className="py-20 px-6 relative">
        <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(ellipse at 50% 30%,rgba(167,139,250,0.06),transparent 60%)"}} />
        <div className="container mx-auto max-w-5xl relative">
          <div className="text-center mb-14">
            <span className="text-xs font-semibold tracking-widest uppercase font-display" style={{background:"linear-gradient(135deg,#a78bfa,#f472b6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
              THE CORE ENGINE
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mt-4 font-display" style={{letterSpacing:"-0.02em"}}>
              Creative Performance Loop
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto font-body text-base leading-relaxed">
              Upload your ad videos. Import your performance data. The AI decodes what works for YOUR account — and every tool on the platform adapts. It grows with you.
            </p>
          </div>

          {/* Loop steps — 5 cards */}
          <div className="grid md:grid-cols-5 gap-3 mb-12">
            {[
              { n: "01", title: "Upload Ads", desc: "Upload your actual ad videos running on Meta, TikTok, etc. AI analyzes each one.", icon: "📥", color: "#60a5fa" },
              { n: "02", title: "AI Decodes", desc: "Hook type, creative model, audience fit, platform match — everything gets stored.", icon: "🧠", color: "#a78bfa" },
              { n: "03", title: "Patterns Emerge", desc: "After 10+ ads, AI identifies YOUR winning formula: what combos drive results.", icon: "🎯", color: "#f472b6" },
              { n: "04", title: "Tools Adapt", desc: "Hooks, scripts, briefs — everything generated is now calibrated to your data.", icon: "⚡", color: "#34d399" },
              { n: "05", title: "Loop Grows", desc: "More ads = more context = smarter tools. The AI literally grows with your business.", icon: "📈", color: "#fbbf24" },
            ].map((step, i) => (
              <motion.div key={i} initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} transition={{delay:i*0.08}} viewport={{once:true}}
                className="p-5 rounded-2xl text-center relative"
                style={{background:`${step.color}06`,border:`1px solid ${step.color}18`}}>
                <div className="text-3xl mb-3">{step.icon}</div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2 font-display" style={{color:`${step.color}80`}}>{step.n}</p>
                <h3 className="text-sm font-bold mb-2 font-display text-foreground">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-body">{step.desc}</p>
                {i < 4 && (
                  <div className="hidden md:block absolute top-1/2 -right-2.5 text-white/10 text-lg font-bold">→</div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Key differentiators */}
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { title: "Not generic — learns from YOUR data", desc: "Every pattern comes from your actual ad performance, not industry averages.", icon: "🎯", color: "#a78bfa" },
              { title: "Closes the manual loop", desc: "No more staring at Ads Manager → extracting insights → briefing the team. It's automatic.", icon: "⚡", color: "#f472b6" },
              { title: "Measurable ROI", desc: "Track how your avg CTR improves over time. \"Since using AdBrief, my CTR went up 34%.\"", icon: "📈", color: "#34d399" },
            ].map((item, i) => (
              <motion.div key={i} initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}} transition={{delay:i*0.1}} viewport={{once:true}}
                className="p-6 rounded-2xl"
                style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)"}}>
                <span className="text-2xl">{item.icon}</span>
                <h3 className="text-base font-bold mt-3 mb-2 font-display" style={{color:item.color}}>{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-body">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}} viewport={{once:true}}
            className="mt-12 text-center">
            <Button
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 font-bold h-auto border-0 rounded-xl px-10 py-4 shadow-lg shadow-purple-500/20 font-body text-base group"
              onClick={() => navigate("/signup")}
            >
              Start your loop — free
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
            <p className="text-xs text-muted-foreground/40 mt-3 font-body">Import your first CSV in under 2 minutes. No credit card.</p>
          </motion.div>
        </div>
      </section>
      {/* Logo ticker — brands running ads */}
      <LogoTicker />

      {/* Social proof — numbers + testimonial */}
      <section className="py-12 px-6 border-y border-white/[0.06]">
        <div className="container mx-auto max-w-5xl">
          {/* Numbers row */}
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 mb-10">
            {[
              { value: "2.4M+",  label: t("social_ads") },
              { value: "147",    label: t("social_teams") },
              { value: "12",     label: t("social_countries") },
              { value: "< 60s",  label: t("social_time") },
            ].map((s) => (
              <div key={s.value} className="text-center">
                <div className="text-2xl font-bold font-display" style={{background:"linear-gradient(135deg,#a78bfa,#f472b6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>{s.value}</div>
                <div className="text-xs text-muted-foreground/50 mt-0.5 font-body">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Testimonials — 3 cards */}
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                quote: t("lp_testimonial1_quote"),
                name: t("lp_testimonial1_name"),
                role: t("lp_testimonial1_role"),
                metric: t("lp_testimonial1_metric"),
                avatar: "MD", color: "#a78bfa",
              },
              {
                quote: t("lp_testimonial2_quote"),
                name: t("lp_testimonial2_name"),
                role: t("lp_testimonial2_role"),
                metric: t("lp_testimonial2_metric"),
                avatar: "CS", color: "#f472b6",
              },
              {
                quote: t("lp_testimonial3_quote"),
                name: t("lp_testimonial3_name"),
                role: t("lp_testimonial3_role"),
                metric: t("lp_testimonial3_metric"),
                avatar: "RM", color: "#34d399",
              },
            ].map((t, i) => (
              <motion.div key={i} initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}} transition={{delay:i*0.1}} viewport={{once:true}}
                className="relative p-5 rounded-2xl flex flex-col gap-4"
                style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)"}}>
                {/* Stars */}
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_,j) => (
                    <svg key={j} width="12" height="12" viewBox="0 0 12 12" fill="#fbbf24"><path d="M6 1l1.3 3.9H11L8 7.1l1 3.9L6 8.8 3 11l1-3.9L1 4.9h3.7z"/></svg>
                  ))}
                </div>
                {/* Quote */}
                <p className="text-sm text-white/60 leading-relaxed font-body flex-1">"{t.quote}"</p>
                {/* Metric pill — sem seta exagerada */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold w-fit"
                  style={{background:`${t.color}10`,border:`1px solid ${t.color}25`,color:t.color}}>
                  {t.metric}
                </div>
                {/* Author */}
                <div className="flex items-center gap-3 pt-1 border-t border-white/[0.06]">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{background:`${t.color}20`,color:t.color}}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-white/80 font-display">{t.name}</p>
                    <p className="text-[11px] text-white/30 font-body">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>



      {/* The problem + outcome numbers */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-widest text-muted-foreground/40 mb-4 font-display">{t("problem_label")}</p>
            <h2 className="text-3xl md:text-4xl font-bold font-display" style={{letterSpacing:"-0.02em"}}>
              <span style={{background:"linear-gradient(135deg,#a78bfa,#f472b6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>{t("problem_title")}</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto font-body text-base">
              {t("problem_subtitle")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { stat: "60s",  label: t("stat1_label"), sub: t("stat1_sub") },
              { stat: "10×",  label: t("stat2_label"), sub: t("stat2_sub") },
              { stat: "−43%", label: t("stat3_label"), sub: t("stat3_sub") },
            ].map((item, i) => (
              <motion.div key={i} initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} transition={{delay:i*0.1}} viewport={{once:true}}
                className="rounded-2xl border border-border/40 p-6 text-center" style={{background:"rgba(139,92,246,0.04)"}}>
                <div className="text-5xl font-bold font-display mb-2" style={{background:"linear-gradient(135deg,#a78bfa,#f472b6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
                  {item.stat}
                </div>
                <p className="text-sm font-semibold text-foreground mb-1 font-display">{item.label}</p>
                <p className="text-xs text-muted-foreground/60 font-body">{item.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Objection handler — quick answers before pricing */}
      <section className="py-12 px-6">
        <div className="container mx-auto max-w-3xl">
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { q: t("lp_objection_q1"), a: t("lp_objection_a1"), icon: "✅" },
              { q: t("lp_objection_q2"), a: t("lp_objection_a2"), icon: "🎬" },
              { q: t("lp_objection_q3"), a: t("lp_objection_a3"), icon: "⚡" },
            ].map((item, i) => (
              <motion.div key={i} initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} transition={{delay:i*0.08}} viewport={{once:true}}
                className="p-4 rounded-2xl"
                style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)"}}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{item.icon}</span>
                  <p className="text-sm font-bold text-white/80 font-display">{item.q}</p>
                </div>
                <p className="text-xs text-muted-foreground/70 leading-relaxed font-body">{item.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section — moved up before features */}
      <section id="pricing" className="py-24 px-6 relative">
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent, rgba(139, 92, 246, 0.03), transparent)' }}
        />
        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold tracking-wider uppercase gradient-text font-display">
               {t("pricing_label")}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4 font-display">
              Simple, transparent pricing
            </h2>
            {/* ROI anchor — the money line */}
            <div className="mt-5 inline-flex items-center gap-3 px-5 py-3 rounded-2xl font-body"
              style={{background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.2)"}}>
              <span className="text-2xl">💡</span>
              <p className="text-sm text-white/70">
                One production that fails = <span className="text-white font-semibold">$500+ wasted.</span>{" "}
                AdBrief Maker pays for itself <span className="text-purple-300 font-semibold">in the first ad it catches.</span>
              </p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card 
                  className={`relative h-full ${
                    plan.highlighted 
                      ? 'border-purple-500/50 shadow-xl shadow-purple-500/10 md:-translate-y-4' 
                      : 'border-border/50'
                  } transition-all duration-300 hover:-translate-y-2 bg-card/80 backdrop-blur-sm`}
                >
                  {plan.badge && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 px-4 font-body">
                        {plan.badge}
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-6">
                    <CardTitle className="text-lg text-muted-foreground font-normal mb-2 font-body">
                      {plan.name}
                    </CardTitle>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold font-display">{plan.price}</span>
                      <span className="text-muted-foreground font-body">{plan.period}</span>
                    </div>
                    {plan.desc && (
                      <p className="text-xs text-muted-foreground/70 mt-2 font-body">{plan.desc}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => {
                        const denied = feature.startsWith("✗ ");
                        const label = denied ? feature.slice(2) : feature;
                        return (
                          <li key={i} className={`flex items-center gap-3 text-sm font-body ${denied ? "opacity-40" : ""}`}>
                            {denied
                              ? <span className="w-4 h-4 text-muted-foreground/50 shrink-0 flex items-center justify-center text-xs">✕</span>
                              : <Check className="w-4 h-4 text-green-500 shrink-0" />
                            }
                            <span className={denied ? "line-through text-muted-foreground/50" : "text-muted-foreground"}>{label}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <Button 
                      className={`w-full font-body ${
                        plan.highlighted 
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 border-0' 
                          : 'bg-card text-foreground hover:bg-muted border border-border'
                      }`}
                      onClick={() => navigate(plan.name === "Free" ? "/signup" : `/signup?plan=${plan.name.toLowerCase()}`)}
                    >
                      {plan.cta}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-10 space-y-2 font-body">
            {/* Urgency signal */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-3"
              style={{background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.2)"}}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] text-amber-400/80 font-semibold font-body">Introductory pricing — rates increase as we grow</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("pricing_free_note")}
            </p>
            <button
              onClick={() => navigate("/pricing")}
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            >
              {t("pricing_see_all")}
            </button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      {/* How it works — 3 steps with result */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(ellipse at center,hsla(262,83%,58%,0.05) 0%,transparent 50%)"}} />
        <div className="container mx-auto max-w-5xl relative">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold tracking-widest uppercase font-display" style={{background:"linear-gradient(135deg,#a78bfa,#f472b6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
              {t("how_label")}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4 font-display" style={{letterSpacing:"-0.02em"}}>
              {t("how_title")}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* connector line desktop */}
            <div className="hidden md:block absolute top-8 left-1/6 right-1/6 h-px" style={{background:"linear-gradient(90deg,transparent,rgba(167,139,250,0.3),transparent)"}} />
            {[
              {
                n:"01", emoji:"⬆️",
                title:t("how_step1_title"),
                desc:t("how_step1_desc"),
                result:t("how_step1_result"),
                color:"#a78bfa",
              },
              {
                n:"02", emoji:"🧠",
                title:t("how_step2_title"),
                desc:t("how_step2_desc"),
                result:t("how_step2_result"),
                color:"#f472b6",
              },
              {
                n:"03", emoji:"📋",
                title:t("how_step3_title"),
                desc:t("how_step3_desc"),
                result:t("how_step3_result"),
                color:"#34d399",
              },
            ].map((step,i) => (
              <motion.div key={i} initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} transition={{delay:i*0.15}} viewport={{once:true}}
                className="relative p-6 rounded-2xl" style={{background:"linear-gradient(135deg,rgba(139,92,246,0.05),rgba(236,72,153,0.02))",border:"1px solid rgba(139,92,246,0.12)"}}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl font-bold font-display" style={{color:step.color,opacity:0.25}}>{step.n}</span>
                  <span className="text-2xl">{step.emoji}</span>
                </div>
                <h3 className="text-lg font-bold mb-2 font-display">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed font-body mb-4">{step.desc}</p>
                <div className="pt-3 border-t border-border/30">
                  <p className="text-xs font-semibold font-display" style={{color:step.color}}>→ {step.result}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — before/after by use case */}
      <section id="features" className="py-24 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold tracking-widest uppercase font-display" style={{background:"linear-gradient(135deg,#a78bfa,#f472b6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
              {t("lp_stop_guessing")}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4 font-display" style={{letterSpacing:"-0.02em"}}>
              {t("lp_every_day1")}<br/>
              <span className="text-muted-foreground/50">{t("lp_every_day2")}</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto font-body text-base">
              {t("lp_real_problems")}
            </p>
          </div>

          <div className="space-y-3">
            {[
              { before: t("feat1_before"), after: t("feat1_after"), tag: t("feat1_tag"), accent: "#a78bfa", icon: "🎯" },
              { before: t("feat2_before"), after: t("feat2_after"), tag: t("feat2_tag"), accent: "#60a5fa", icon: "📋" },
              { before: t("feat3_before"), after: t("feat3_after"), tag: t("feat3_tag"), accent: "#fb923c", icon: "⚡" },
              { before: t("feat4_before"), after: t("feat4_after"), tag: t("feat4_tag"), accent: "#34d399", icon: "🌎" },
              { before: t("feat5_before"), after: t("feat5_after"), tag: t("feat5_tag"), accent: "#c084fc", icon: "📊" },
            ].map((item, i) => (
              <motion.div key={i} initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}} transition={{delay:i*0.07}} viewport={{once:true}}
                className="grid md:grid-cols-2 gap-0 rounded-2xl overflow-hidden"
                style={{border:"1px solid rgba(255,255,255,0.07)"}}>
                {/* Before */}
                <div className="p-5 md:p-6 flex gap-4" style={{background:"rgba(239,68,68,0.03)"}}>
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-red-400/50 font-display">{t("before_label")}</span>
                      <span className="h-px flex-1 bg-red-400/10" />
                    </div>
                    <p className="text-sm text-muted-foreground/60 leading-relaxed font-body">{item.before}</p>
                  </div>
                </div>
                {/* After */}
                <div className="p-5 md:p-6 relative flex gap-4" style={{background:"rgba(255,255,255,0.02)",borderLeft:"1px solid rgba(255,255,255,0.06)"}}>
                  <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-base"
                    style={{background:`${item.accent}15`,border:`1px solid ${item.accent}25`}}>
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest font-display" style={{color:item.accent,opacity:0.8}}>{t("after_label")} · {item.tag}</span>
                      <span className="h-px flex-1" style={{background:`${item.accent}20`}} />
                    </div>
                    <p className="text-sm leading-relaxed font-body text-white/70">{item.after}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Inline CTA inside Before/After section */}
          <motion.div initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}} viewport={{once:true}}
            className="mt-10 text-center">
            <p className="text-sm text-muted-foreground/50 mb-4 font-body">{t("lp_ready_stop")}</p>
            <Button
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 font-bold h-auto border-0 rounded-xl px-8 py-3.5 shadow-lg shadow-purple-500/20 font-body"
              onClick={() => navigate("/signup")}
            >
              {t("lp_score_cta")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* CTA Section — result focused, aggressive */}
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-3xl text-center">
          <motion.div initial={{opacity:0,scale:0.97}} whileInView={{opacity:1,scale:1}} viewport={{once:true}}
            className="p-12 rounded-3xl relative overflow-hidden"
            style={{background:"linear-gradient(135deg,rgba(139,92,246,0.12),rgba(236,72,153,0.08))",border:"1px solid rgba(139,92,246,0.18)"}}>
            <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(ellipse at 50% -20%,rgba(167,139,250,0.18),transparent 60%)"}} />
            <div className="relative z-10">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/40 mb-5 font-display">
               {t("lp_launch_special")}
              </p>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 font-display" style={{letterSpacing:"-0.02em"}}>
                {t("cta_title1")}<br />
                <span style={{background:"linear-gradient(135deg,#a78bfa,#f472b6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
                  {t("cta_title2")}
                </span>
              </h2>
              <p className="text-white/50 text-base mb-8 max-w-lg mx-auto font-body leading-relaxed">
                {t("cta_desc")}
              </p>

              {/* Trust signals row */}
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-8 font-body">
                <span className="flex items-center gap-1.5 text-xs text-white/40">
                  <Check className="w-3.5 h-3.5 text-green-400" /> {t("cta_check1")}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-white/40">
                  <Check className="w-3.5 h-3.5 text-green-400" /> {t("cta_check2")}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-white/40">
                  <Check className="w-3.5 h-3.5 text-green-400" /> {t("cta_check3")}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 font-bold text-base h-auto border-0 rounded-xl px-10 py-4 shadow-lg shadow-purple-500/30 font-body group"
                  onClick={() => navigate("/signup")}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {t("cta_primary_btn")}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                </Button>
                <Button variant="outline"
                  className="bg-transparent text-foreground hover:bg-white/5 text-base h-auto rounded-xl px-8 py-4 border-white/10 font-body"
                  onClick={() => navigate("/book-demo")}
                >
                  {t("cta_secondary_btn")}
                </Button>
              </div>

              {/* Live social proof under CTA */}
              <p className="mt-6 text-[11px] text-white/25 font-body">
                {t("lp_joined_by")}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Video Drop Zone */}
      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50">
        <div className="container mx-auto px-6 py-16">
          <div className="grid md:grid-cols-4 gap-12">
            <div className="md:col-span-1">
              <div className="mb-4">
                <Logo size="lg" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed font-body">
                {t("footer_desc")}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 font-display">{t("footer_product")}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground font-body">
                <li><a href="#features" className="hover:text-foreground transition-colors">{t("nav_features")}</a></li>
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
            <div className="text-sm text-muted-foreground font-body">
              {t("footer_rights")}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground font-body">
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                {t("footer_soc2")}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t("footer_uptime")}
              </span>
            </div>
          </div>
        </div>
      </footer>

      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
      <CookieConsent />
      <AuthPromptModal />

      {/* Sticky mobile CTA — only on small screens */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 md:hidden"
        style={{background:"linear-gradient(to top, rgba(8,8,8,0.98) 60%, transparent)",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
        <Button
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-base h-auto rounded-xl py-4 shadow-lg shadow-purple-500/30 font-body"
          onClick={() => navigate("/signup")}
        >
          {t("lp_score_cta")} →
        </Button>
        <p className="text-center text-[10px] text-white/25 mt-2 font-body">{t("lp_mobile_sub")}</p>
      </div>
    </div>
  );
};

export default Index;