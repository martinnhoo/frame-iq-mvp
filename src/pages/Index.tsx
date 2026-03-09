import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, FileText, Globe, Brain, Sparkles, Menu, ArrowRight, Play, Zap, Shield, Clock, Check, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import VideoDropZone from "@/components/VideoDropZone";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import CookieConsent from "@/components/CookieConsent";
import LegalModal from "@/components/LegalModal";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import AuthPromptModal from "@/components/AuthPromptModal";
import { useLanguage } from "@/i18n/LanguageContext";

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
      name: t("pricing_free"),
      price: "$0",
      period: t("pricing_mo"),
      features: ["3 video analyses", "3 boards", "1 seat", "Community support"],
      cta: t("pricing_cta_free"),
      highlighted: false
    },
    {
      name: t("pricing_studio"),
      price: "$49",
      period: t("pricing_mo"),
      features: ["30 analyses/mo", "30 boards/mo", "5 videos/mo", "1 seat", "Priority support", "Export to Notion"],
      cta: t("pricing_cta_trial"),
      highlighted: true,
      badge: t("pricing_most_popular")
    },
    {
      name: t("pricing_scale"),
      price: "$399",
      period: t("pricing_mo"),
      features: ["500 analyses/mo", "300 boards/mo", "50 videos/mo", "10 seats", "API access", "Custom integrations", "Dedicated CSM"],
      cta: t("pricing_cta_demo"),
      highlighted: false
    }
  ];

  const navLinks = [
    { label: t("nav_features"), href: "#features" },
    { label: t("nav_pricing"), href: "/pricing", isRoute: true },
    { label: t("nav_blog"), href: "/blog", isRoute: true },
    { label: t("nav_faq"), href: "/faq", isRoute: true },
    { label: t("nav_contact"), href: "/contact", isRoute: true },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="text-2xl font-bold flex items-center">
            <span className="text-foreground font-medium">Frame</span>
            <span className="gradient-text font-black">IQ</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              link.isRoute ? (
                <Link key={link.label} to={link.href} className="text-sm text-secondary hover:text-foreground transition-colors">
                  {link.label}
                </Link>
              ) : (
                <a key={link.label} href={link.href} className="text-sm text-secondary hover:text-foreground transition-colors">
                  {link.label}
                </a>
              )
            ))}
          </div>
          
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" className="text-secondary hover:text-foreground" onClick={() => navigate("/login")}>
              {t("nav_signin")}
            </Button>
            <Button 
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 border-0"
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
                      <Link key={link.label} to={link.href} className="text-lg text-secondary hover:text-foreground transition-colors">
                        {link.label}
                      </Link>
                    ) : (
                      <a key={link.label} href={link.href} className="text-lg text-secondary hover:text-foreground transition-colors">
                        {link.label}
                      </a>
                    )
                  ))}
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white" onClick={() => navigate("/signup")}>
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
            animation: 'glow-pulse 6s ease-in-out infinite'
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
            className="inline-flex items-center rounded-full px-4 py-1.5 text-[12px] mb-8 gap-2 shimmer-border"
            style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))', border: '1px solid rgba(139, 92, 246, 0.3)' }}
          >
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span style={{ color: '#ccc' }}>{t("hero_badge")}</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-[44px] md:text-[56px] lg:text-[72px] font-bold text-foreground leading-[1.05] tracking-tight"
          >
            {t("hero_title_1")}<br />
            <span className="gradient-text">{t("hero_title_2")}</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-[18px] md:text-[20px] max-w-[600px] mx-auto mt-6 leading-relaxed"
            style={{ color: '#888' }}
          >
            {t("hero_subtitle")}
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-10"
          >
            <Button 
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 font-semibold text-base h-auto border-0 rounded-xl px-8 py-4 shadow-lg shadow-purple-500/25"
              onClick={() => navigate("/signup")}
            >
              {t("hero_cta_primary")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              variant="outline" 
              className="bg-transparent text-foreground hover:bg-white/5 text-base h-auto rounded-xl px-8 py-4 group"
              style={{ border: '1px solid rgba(255,255,255,0.15)' }}
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
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mt-8 text-xs sm:text-sm"
            style={{ color: '#666' }}
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
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="relative mt-12 sm:mt-20 max-w-4xl mx-auto hidden sm:block"
          >
            <div className="relative text-center mb-4">
              <span style={{ color: '#555', fontSize: '11px', letterSpacing: '3px', fontWeight: 600 }}>
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
                  className="flex-1 text-center mx-12"
                  style={{ 
                    background: '#0a0a0a', 
                    borderRadius: '8px', 
                    padding: '6px 16px', 
                    fontSize: '12px', 
                    color: '#666',
                    fontFamily: '"DM Mono", monospace',
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
                      <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>
                        virginia_wepink_perfume_ugc.mp4
                      </div>
                      <div style={{ color: '#555', fontSize: '12px', fontFamily: '"DM Mono", monospace' }}>
                        Uploaded 2 min ago
                      </div>
                    </div>
                  </div>
                  <div 
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)' }}
                  >
                    <span style={{ fontSize: '10px', color: '#4ade80' }}>●</span>
                    <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: 500 }}>Analysis Complete</span>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 p-3 sm:p-4 rounded-xl"
                  style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}
                >
                  <div>
                    <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
                      Creative Model
                    </div>
                    <div className="flex items-center gap-2">
                      <span 
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' }}
                      >
                        UGC
                      </span>
                      <span style={{ color: '#fff', fontSize: '16px', fontWeight: 600 }}>
                        Influencer
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
                      Hook Score
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span style={{ color: '#4ade80', fontSize: '28px', fontWeight: 700 }}>9.1</span>
                      <span style={{ color: '#444', fontSize: '14px' }}>/ 10</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
                      Predicted CTR
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span style={{ color: '#fff', fontSize: '28px', fontWeight: 700 }}>3.2%</span>
                      <span style={{ color: '#4ade80', fontSize: '12px' }}>↑ 47%</span>
                    </div>
                  </div>
                </div>

                {/* Hook Preview */}
                <div 
                  className="p-4 rounded-xl mb-4"
                  style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}
                >
                  <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>
                    Hook (0–3s)
                  </div>
                  <p style={{ color: '#e5e5e5', fontSize: '15px', lineHeight: '1.6', fontFamily: '"DM Mono", monospace' }}>
                    "Camera opens on close-up of perfume, Virginia whispers: <span style={{ color: '#a78bfa' }}>'You guys aren't ready for what I'm about to tell you'</span>"
                  </p>
                </div>

                {/* Brief Section */}
                <div 
                  className="p-4 rounded-xl mb-4"
                  style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}
                >
                  <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>
                    Brief
                  </div>
                  <p style={{ color: '#aaa', fontSize: '13px', lineHeight: '1.7', fontFamily: '"DM Mono", monospace', fontStyle: 'italic' }}>
                    Influencer UGC for WePink perfume. Parasocial hook with product close-up + curiosity-driven opening line. Promo code CTA appears at 00:22. Vertical 9:16 format optimized for Stories/Reels.
                  </p>
                </div>

                {/* Bottom Row */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {['🌐 PT-BR → EN', '⏱ 0:28', '📍 BR Market', '💄 Beauty', '👩 Women 25-34'].map((badge) => (
                      <span 
                        key={badge}
                        style={{ 
                          background: '#141414', 
                          border: '1px solid #222', 
                          borderRadius: '6px',
                          padding: '6px 10px',
                          fontSize: '11px',
                          color: '#888'
                        }}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                  <Button 
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    style={{ background: '#141414', border: '1px solid #333', color: '#888' }}
                  >
                    ← Back to menu
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Powered By AI */}
      <section className="py-10 px-6 border-b border-border/50">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-col items-center gap-6">
            <p className="text-xs tracking-widest uppercase" style={{ color: '#555' }}>
              {t("powered_by")}
            </p>
            <div className="flex items-center gap-10 md:gap-16">
              <div className="flex items-center gap-2.5 opacity-50 hover:opacity-80 transition-opacity">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" fill="currentColor"/>
                </svg>
                <span className="text-lg font-semibold" style={{ color: '#fff' }}>OpenAI</span>
              </div>
              <div className="flex items-center gap-2.5 opacity-50 hover:opacity-80 transition-opacity">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.304 3.541h-3.483l6.196 16.918h3.483L17.304 3.541zm-10.608 0L.5 20.459h3.59l1.278-3.554h6.281l1.278 3.554h3.59L10.321 3.541H6.696zm.894 10.563l2.058-5.715 2.058 5.715H7.59z" fill="currentColor"/>
                </svg>
                <span className="text-lg font-semibold" style={{ color: '#fff' }}>Anthropic</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-secondary">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 relative">
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, hsla(262, 83%, 58%, 0.05) 0%, transparent 50%)' }}
        />
        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold tracking-wider uppercase gradient-text">
              {t("how_label")}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4 whitespace-pre-line">
              {t("how_title")}
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15 }}
                viewport={{ once: true }}
                className="relative p-6 rounded-2xl"
                style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(236, 72, 153, 0.02))', border: '1px solid rgba(139, 92, 246, 0.15)' }}
              >
                <span className="text-5xl font-bold gradient-text opacity-30">{step.number}</span>
                <h3 className="text-xl font-semibold mt-4 mb-2">{step.title}</h3>
                <p className="text-secondary text-sm leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold tracking-wider uppercase gradient-text">
              {t("features_label")}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4">
              {t("features_title")}
            </h2>
            <p className="text-secondary text-lg mt-4 max-w-2xl mx-auto">
              {t("features_subtitle")}
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card 
                    className="bg-card/50 border-border/50 hover:border-purple-500/30 transition-all duration-300 hover:-translate-y-1 h-full backdrop-blur-sm cursor-pointer"
                    onClick={() => navigate(`/features/${feature.slug}`)}
                  >
                    <CardHeader>
                      <div 
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4`}
                        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        <Icon className="w-6 h-6 text-foreground" />
                      </div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-secondary leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 relative">
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent, rgba(139, 92, 246, 0.03), transparent)' }}
        />
        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold tracking-wider uppercase gradient-text">
              {t("pricing_label")}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4">
              {t("pricing_title")}
            </h2>
            <p className="text-secondary text-lg mt-4">
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
                      <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 px-4">
                        {plan.badge}
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-6">
                    <CardTitle className="text-lg text-secondary font-normal mb-2">
                      {plan.name}
                    </CardTitle>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold">{plan.price}</span>
                      <span className="text-secondary">{plan.period}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm">
                          <Check className="w-4 h-4 text-green-500 shrink-0" />
                          <span className="text-secondary">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button 
                      className={`w-full ${
                        plan.highlighted 
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 border-0' 
                          : 'bg-card text-foreground hover:bg-muted border border-border'
                      }`}
                      onClick={() => plan.name === t("pricing_scale") ? navigate("/book-demo") : navigate("/signup")}
                    >
                      {plan.cta}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="p-12 rounded-3xl relative overflow-hidden"
            style={{ 
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(236, 72, 153, 0.1))',
              border: '1px solid rgba(139, 92, 246, 0.2)'
            }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t("cta_title")}
            </h2>
            <p className="text-secondary text-lg mb-8 max-w-xl mx-auto">
              {t("cta_subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 font-semibold text-base h-auto border-0 rounded-xl px-8 py-4"
                onClick={() => navigate("/signup")}
              >
                {t("cta_primary")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                variant="outline" 
                className="bg-transparent text-foreground hover:bg-white/5 text-base h-auto rounded-xl px-8 py-4"
                style={{ border: '1px solid rgba(255,255,255,0.2)' }}
                onClick={() => navigate("/book-demo")}
              >
                {t("cta_secondary")}
              </Button>
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
              <div className="text-2xl font-bold mb-4">
                <span className="text-foreground font-medium">Frame</span>
                <span className="gradient-text font-black">IQ</span>
              </div>
              <p className="text-sm text-secondary leading-relaxed">
                {t("footer_desc")}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">{t("footer_product")}</h4>
              <ul className="space-y-2 text-sm text-secondary">
                <li><a href="#features" className="hover:text-foreground transition-colors">{t("nav_features")}</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">{t("nav_pricing")}</a></li>
                <li><Link to="/book-demo" className="hover:text-foreground transition-colors">{t("footer_book_demo")}</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">{t("footer_company")}</h4>
              <ul className="space-y-2 text-sm text-secondary">
                <li><Link to="/blog" className="hover:text-foreground transition-colors">{t("nav_blog")}</Link></li>
                <li><Link to="/faq" className="hover:text-foreground transition-colors">{t("nav_faq")}</Link></li>
                <li><Link to="/contact" className="hover:text-foreground transition-colors">{t("nav_contact")}</Link></li>
                <li><Link to="/careers" className="hover:text-foreground transition-colors">Careers</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">{t("footer_legal")}</h4>
              <ul className="space-y-2 text-sm text-secondary">
                <li><button onClick={() => setLegalModal("privacy")} className="hover:text-foreground transition-colors">{t("footer_privacy")}</button></li>
                <li><button onClick={() => setLegalModal("terms")} className="hover:text-foreground transition-colors">{t("footer_terms")}</button></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border/50 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-secondary">
              {t("footer_rights")}
            </div>
            <div className="flex items-center gap-4 text-sm text-secondary">
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
