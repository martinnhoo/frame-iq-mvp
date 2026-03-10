import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, FileText, Globe, Brain, Sparkles, Menu, ArrowRight, Play, Zap, Shield, Clock, Check, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import VideoDropZone from "@/components/VideoDropZone";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
import CookieConsent from "@/components/CookieConsent";
import LegalModal from "@/components/LegalModal";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import AuthPromptModal from "@/components/AuthPromptModal";
import { useLanguage } from "@/i18n/LanguageContext";
import { Logo } from "@/components/Logo";

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
      name: "Creator",
      price: "$9",
      period: t("pricing_mo"),
      features: ["3 analyses/mo", "1 board/mo", "10 scripts/mo", "10 translations", "Pre-flight checks"],
      cta: "Get started",
      highlighted: false
    },
    {
      name: "Studio",
      price: "$49",
      period: t("pricing_mo"),
      features: ["30 analyses/mo", "30 boards/mo", "5 videos/mo", "Brand Kit", "Competitor Tracker", "2 seats"],
      cta: "Start Studio",
      highlighted: true,
      badge: t("pricing_most_popular")
    },
    {
      name: "Scale",
      price: "$499",
      period: t("pricing_mo"),
      features: ["500 analyses/mo", "300 boards/mo", "10 videos/day", "Meta Ads Connect", "10 seats", "API + White Label"],
      cta: t("pricing_cta_demo"),
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
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl">
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

      {/* Hero Section */}
      <section className="relative flex flex-col justify-center px-6 overflow-hidden pt-28 pb-16">
        {/* Background Effects */}
        <div 
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, hsla(262, 83%, 58%, 0.12) 0%, transparent 60%)',
            filter: 'blur(60px)',
          }}
        />
        <div 
          className="absolute top-1/3 right-0 w-[400px] h-[400px] pointer-events-none"
          style={{
            background: 'radial-gradient(circle, hsla(320, 80%, 60%, 0.08) 0%, transparent 60%)',
            filter: 'blur(80px)',
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
            Creative intelligence
            <br />
            <span style={{
              background: "linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>for performance teams.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-[17px] md:text-[19px] max-w-[640px] mx-auto mt-6 leading-relaxed text-muted-foreground font-body"
          >
            Every day without it, your competitors are shipping better hooks, higher-scoring ads, and production boards your team can execute — while you're still guessing. Stop guessing.
          </motion.p>

          {/* Pricing preview right in hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="flex items-center justify-center gap-6 mt-6 font-body"
          >
            <span className="text-sm text-muted-foreground">Free to start</span>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-sm text-muted-foreground">Plans from <span className="text-foreground font-semibold">$9/mo</span></span>
            <span className="text-muted-foreground/30">·</span>
            <a href="#pricing" className="text-sm text-primary hover:underline">See pricing →</a>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8"
          >
            <Button 
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 font-semibold text-base h-auto border-0 rounded-xl px-8 py-4 shadow-lg shadow-purple-500/25 font-body"
              onClick={() => navigate("/signup")}
            >
              {t("hero_cta_primary")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              variant="outline" 
              className="bg-transparent text-foreground hover:bg-accent/10 text-base h-auto rounded-xl px-8 py-4 group border-border/30 font-body"
              onClick={() => {
                const el = document.getElementById('demo-preview');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              <Play className="w-4 h-4 mr-2 group-hover:text-purple-400 transition-colors" />
              {t("hero_cta_secondary")}
            </Button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mt-8 text-xs sm:text-sm text-muted-foreground font-body"
          >
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              {t("hero_check_1")}
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              {t("hero_check_2")}
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              {t("hero_check_3")}
            </span>
          </motion.div>
          
          {/* App Screenshot */}
          <motion.div id="demo-preview"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="relative mt-12 sm:mt-20 max-w-4xl mx-auto hidden sm:block"
          >
            <div className="relative text-center mb-4">
              <span className="text-muted-foreground/40 text-[11px] tracking-[3px] font-semibold font-display uppercase">
                {t("hero_screenshot_label")}
              </span>
            </div>

            <div 
              className="relative mx-auto text-left"
              style={{ 
                maxWidth: '780px',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 40px 100px rgba(139, 92, 246, 0.15), 0 0 0 1px rgba(139, 92, 246, 0.2)',
                animation: 'float 6s ease-in-out infinite',
                transform: 'rotate(-1.5deg)',
              }}
            >
              {/* Browser Chrome */}
              <div 
                className="flex items-center gap-2 px-4 py-3"
                style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #141414 100%)', borderBottom: '1px solid #2a2a2a' }}
              >
                <div className="flex gap-2">
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
                </div>
                <div 
                  className="flex-1 text-center mx-12 font-mono"
                  style={{ 
                    background: '#0a0a0a', 
                    borderRadius: '8px', 
                    padding: '6px 16px', 
                    fontSize: '12px', 
                    color: '#666',
                    border: '1px solid #222'
                  }}
                >
                  <span style={{ color: '#4ade80' }}>🔒</span> app.frameiq.com/analysis/vg-wepink-01
                </div>
                <div className="w-16" />
              </div>

              {/* App Content */}
              <div style={{ background: 'linear-gradient(180deg, #0c0c0c 0%, #080808 100%)', padding: '28px' }}>
                {/* Top Bar */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}
                    >
                      <Video className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-foreground text-sm font-semibold font-body">
                        virginia_wepink_perfume_ugc.mp4
                      </div>
                      <div className="text-muted-foreground text-xs font-mono">
                        Uploaded 2 min ago
                      </div>
                    </div>
                  </div>
                  <div 
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)' }}
                  >
                    <span className="text-[10px] text-green-400">●</span>
                    <span className="text-xs text-green-400 font-medium font-body">Analysis Complete</span>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 p-3 sm:p-4 rounded-xl bg-card border border-border">
                  <div>
                    <div className="text-muted-foreground text-[11px] uppercase tracking-[1.5px] mb-2 font-display">
                      Creative Model
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-400 font-body">
                        UGC
                      </span>
                      <span className="text-foreground text-base font-semibold font-body">
                        Influencer
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[11px] uppercase tracking-[1.5px] mb-2 font-display">
                      Hook Score
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-green-400 text-[28px] font-bold font-display">9.1</span>
                      <span className="text-muted-foreground text-sm font-body">/ 10</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[11px] uppercase tracking-[1.5px] mb-2 font-display">
                      Predicted CTR
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-foreground text-[28px] font-bold font-display">3.2%</span>
                      <span className="text-green-400 text-xs font-body">↑ 47%</span>
                    </div>
                  </div>
                </div>

                {/* Hook Preview */}
                <div className="p-4 rounded-xl mb-4 bg-card border border-border">
                  <div className="text-muted-foreground text-[11px] uppercase tracking-[1.5px] mb-2.5 font-display">
                    Hook (0–3s)
                  </div>
                  <p className="text-foreground/90 text-[15px] leading-[1.6] font-mono">
                    "Camera opens on close-up of perfume, Virginia whispers: <span className="text-purple-400">'You guys aren't ready for what I'm about to tell you'</span>"
                  </p>
                </div>

                {/* Brief Section */}
                <div className="p-4 rounded-xl mb-4 bg-card border border-border">
                  <div className="text-muted-foreground text-[11px] uppercase tracking-[1.5px] mb-2.5 font-display">
                    Brief
                  </div>
                  <p className="text-muted-foreground text-[13px] leading-[1.7] font-mono italic">
                    Influencer UGC for WePink perfume. Parasocial hook with product close-up + curiosity-driven opening line. Promo code CTA appears at 00:22. Vertical 9:16 format optimized for Stories/Reels.
                  </p>
                </div>

                {/* Bottom Row */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {['🌐 PT-BR → EN', '⏱ 0:28', '📍 BR Market', '💄 Beauty', '👩 Women 25-34'].map((badge) => (
                      <span 
                        key={badge}
                        className="bg-card border border-border rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground font-body"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                  <Button 
                    size="sm"
                    variant="outline"
                    className="text-xs bg-card border-border text-muted-foreground font-body"
                  >
                    ← Back to menu
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What FrameIQ does — clear SaaS value prop */}
      {/* Social proof — numbers */}
      <section className="py-10 px-6 border-b border-border/30">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {[
              { value: "2.4M+",  label: "Ads analyzed" },
              { value: "147",    label: "Performance teams" },
              { value: "12",     label: "Countries" },
              { value: "< 60s",  label: "Avg. analysis time" },
            ].map((s) => (
              <div key={s.value} className="text-center">
                <div className="text-2xl font-bold font-display" style={{background:"linear-gradient(135deg,#a78bfa,#f472b6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>{s.value}</div>
                <div className="text-xs text-muted-foreground/50 mt-0.5 font-body">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* The problem + outcome numbers */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-widest text-muted-foreground/40 mb-4 font-display">The cost of slow creative</p>
            <h2 className="text-3xl md:text-4xl font-bold font-display" style={{letterSpacing:"-0.02em"}}>
              Most teams waste 60% of their creative budget<br className="hidden md:block" />
              <span style={{background:"linear-gradient(135deg,#a78bfa,#f472b6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}> before a single ad goes live.</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto font-body text-base">
              Weak hooks. Untested angles. Briefs that editors ignore. FrameIQ fixes every one of those — before you spend a dollar on production.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { stat: "60s", label: "From upload to full creative brief", sub: "vs. 8 hours of manual analysis" },
              { stat: "10×", label: "More ad variations per sprint",       sub: "same team, same budget" },
              { stat: "−43%", label: "Average drop in wasted creative spend", sub: "by scoring hooks before production" },
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
              {t("pricing_title")}
            </h2>
            <p className="text-muted-foreground text-lg mt-4 font-body">
              {t("pricing_subtitle")}
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
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
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm font-body">
                          <Check className="w-4 h-4 text-green-500 shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button 
                      className={`w-full font-body ${
                        plan.highlighted 
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 border-0' 
                          : 'bg-card text-foreground hover:bg-muted border border-border'
                      }`}
                      onClick={() => plan.name === "Scale" ? navigate("/book-demo") : navigate("/signup")}
                    >
                      {plan.cta}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-10 space-y-2 font-body">
            <p className="text-sm text-muted-foreground">
              Also available: <span className="text-foreground font-medium">Free plan</span> — 3 analyses, 3 boards, no credit card.
            </p>
            <button
              onClick={() => navigate("/pricing")}
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            >
              See all plans and full feature comparison →
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
              How it works
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4 font-display" style={{letterSpacing:"-0.02em"}}>
              From competitor ad to<br/>production board in 3 steps
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* connector line desktop */}
            <div className="hidden md:block absolute top-8 left-1/6 right-1/6 h-px" style={{background:"linear-gradient(90deg,transparent,rgba(167,139,250,0.3),transparent)"}} />
            {[
              {
                n:"01", emoji:"⬆️",
                title:"Upload any ad",
                desc:"Drop a competitor video, paste a URL, or upload your own. Supports TikTok, Reels, YouTube Shorts, Meta.",
                result:"Result: full transcript + key frames in 60s",
                color:"#a78bfa",
              },
              {
                n:"02", emoji:"🧠",
                title:"AI decodes the creative",
                desc:"Hook score, creative model, emotional triggers, persuasion tactics, platform fit — all extracted automatically.",
                result:"Result: hook score + creative framework identified",
                color:"#f472b6",
              },
              {
                n:"03", emoji:"📋",
                title:"Generate & brief your team",
                desc:"One click produces a production board: scene-by-scene, VO script, editor notes, CTA placement. Ready to execute.",
                result:"Result: brief your editor in minutes, not days",
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
              What changes
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4 font-display" style={{letterSpacing:"-0.02em"}}>
              Stop doing this.<br/>
              <span className="text-muted-foreground/50">Start doing that.</span>
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                before: "Watching competitor ads manually, taking notes, trying to reverse-engineer what's working",
                after:  "Upload any ad → get hook score, creative model, transcript, and improvement suggestions in 60 seconds",
                tag:    "Analysis",
                accent: "#a78bfa",
              },
              {
                before: "Writing briefs in Google Docs that editors misinterpret — 3 revision cycles per video",
                after:  "AI generates a production board: scene list, VO script, on-screen text, editor notes. One doc, zero ambiguity",
                tag:    "Boards",
                accent: "#60a5fa",
              },
              {
                before: "Guessing which hook angle will convert before committing to production",
                after:  "Hook Generator produces 10 scored variations in 30 seconds. Test on paper before spending on production",
                tag:    "Hook Generator",
                accent: "#fb923c",
              },
              {
                before: "Translating scripts manually or with Google Translate — losing tone, slang, and cultural context",
                after:  "AI localizes scripts for BR, MX, IN, US and 10+ markets with cultural adaptation built in",
                tag:    "Localization",
                accent: "#34d399",
              },
              {
                before: "Running the same UGC format 4 weeks straight and watching CTR collapse",
                after:  "Intelligence feed detects creative fatigue, flags model overuse, and suggests what to rotate into",
                tag:    "Intelligence",
                accent: "#c084fc",
              },
            ].map((item, i) => (
              <motion.div key={i} initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}} transition={{delay:i*0.07}} viewport={{once:true}}
                className="grid md:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-border/40">
                {/* Before */}
                <div className="p-5 md:p-6" style={{background:"rgba(239,68,68,0.04)",borderRight:"1px solid rgba(255,255,255,0.05)"}}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-400/60 font-display">Before</span>
                    <span className="h-px flex-1 bg-red-400/10" />
                  </div>
                  <p className="text-sm text-muted-foreground/70 leading-relaxed font-body">{item.before}</p>
                </div>
                {/* After */}
                <div className="p-5 md:p-6 relative" style={{background:"rgba(167,139,250,0.04)"}}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest font-display" style={{color:item.accent,opacity:0.7}}>After · {item.tag}</span>
                    <span className="h-px flex-1" style={{background:`${item.accent}20`}} />
                  </div>
                  <p className="text-sm leading-relaxed font-body" style={{color:"rgba(255,255,255,0.7)"}}>{item.after}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section — result focused, aggressive */}
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div initial={{opacity:0,scale:0.95}} whileInView={{opacity:1,scale:1}} viewport={{once:true}}
            className="p-12 rounded-3xl relative overflow-hidden"
            style={{background:"linear-gradient(135deg,rgba(139,92,246,0.15),rgba(236,72,153,0.1))",border:"1px solid rgba(139,92,246,0.2)"}}>
            {/* glow */}
            <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(ellipse at 50% 0%,rgba(167,139,250,0.2),transparent 60%)"}} />
            <div className="relative z-10">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/40 mb-4 font-display">Your competitors aren't waiting</p>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 font-display" style={{letterSpacing:"-0.02em"}}>
                Analyze your first ad<br />
                <span style={{background:"linear-gradient(135deg,#a78bfa,#f472b6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
                  free. Right now.
                </span>
              </h2>
              <p className="text-muted-foreground text-base mb-3 max-w-lg mx-auto font-body">
                No credit card. No setup. Upload any video and get a full creative intelligence report in under 60 seconds.
              </p>
              <div className="flex items-center justify-center gap-6 mb-8 text-sm text-muted-foreground/50 font-body">
                <span>✓ Free plan included</span>
                <span>✓ No credit card</span>
                <span>✓ Cancel anytime</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 font-semibold text-base h-auto border-0 rounded-xl px-10 py-4 shadow-lg shadow-purple-500/30 font-body"
                  onClick={() => navigate("/signup")}
                >
                  Start analyzing — it's free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline"
                  className="bg-transparent text-foreground hover:bg-accent/10 text-base h-auto rounded-xl px-8 py-4 border-border/30 font-body"
                  onClick={() => navigate("/book-demo")}
                >
                  Book a 15-min demo
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Video Drop Zone */}
      <VideoDropZone />

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
                <li><Link to="/careers" className="hover:text-foreground transition-colors">Careers</Link></li>
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
    </div>
  );
};

export default Index;