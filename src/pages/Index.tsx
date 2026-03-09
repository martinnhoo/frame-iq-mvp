import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, FileText, Globe, Brain, Sparkles, Menu, ArrowRight, Play, Zap, Shield, Clock, Check } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import VideoDropZone from "@/components/VideoDropZone";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const Index = () => {
  const navigate = useNavigate();
  
  const features = [
    {
      icon: Video,
      title: "Video Analysis",
      description: "Upload any video. Frames, transcript, creative model and hook extracted in under 60 seconds.",
      gradient: "from-purple-500/20 to-pink-500/20"
    },
    {
      icon: FileText,
      title: "Board Generation",
      description: "Type a prompt. Get a full production board with scenes, VO script, and editor notes.",
      gradient: "from-blue-500/20 to-cyan-500/20"
    },
    {
      icon: Globe,
      title: "Auto Translation",
      description: "Any language, any market — always delivered in English for your global team.",
      gradient: "from-green-500/20 to-emerald-500/20"
    },
    {
      icon: Brain,
      title: "Creative Intelligence",
      description: "Every video classified by format. Hook extracted from the first 3 seconds.",
      gradient: "from-orange-500/20 to-amber-500/20"
    },
    {
      icon: Sparkles,
      title: "AI Video Generation",
      description: "From concept board to MP4 with AI voiceover. No editors needed.",
      gradient: "from-pink-500/20 to-rose-500/20"
    },
    {
      icon: Zap,
      title: "API Access",
      description: "Integrate FrameIQ into your existing workflow with our REST API.",
      gradient: "from-violet-500/20 to-purple-500/20"
    }
  ];

  const stats = [
    { value: "2.4M+", label: "Videos Analyzed" },
    { value: "147", label: "Enterprise Teams" },
    { value: "12", label: "Countries" },
    { value: "94%", label: "Time Saved" },
  ];

  const logos = ["WePink", "Shein", "Shopee", "Mercado Livre", "Amazon", "Hotmart"];

  const steps = [
    { number: "01", title: "Upload or paste link", description: "Drop any ad, competitor video, or reference file" },
    { number: "02", title: "AI extracts insights", description: "Hook, creative model, transcript, key frames — all in 60s" },
    { number: "03", title: "Generate your board", description: "Get a production-ready brief your team can execute today" },
  ];

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "/mo",
      features: ["3 video analyses", "3 boards", "1 user", "Community support"],
      cta: "Get started free",
      highlighted: false
    },
    {
      name: "Studio",
      price: "$49",
      period: "/mo",
      features: ["30 analyses/mo", "30 boards/mo", "5 videos/mo", "2 team members", "Priority support", "Export to Notion"],
      cta: "Start 14-day trial",
      highlighted: true,
      badge: "Most Popular"
    },
    {
      name: "Scale",
      price: "$499",
      period: "/mo",
      features: ["500 analyses/mo", "300 boards/mo", "50 videos/mo", "10 team members", "API access", "Custom integrations", "Dedicated CSM"],
      cta: "Talk to sales",
      highlighted: false
    }
  ];

  const navLinks = ["Features", "Pricing", "Drop Video"];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="text-2xl font-bold flex items-center gap-1">
            <span className="text-foreground">Frame</span>
            <span className="gradient-text">IQ</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-sm text-secondary hover:text-foreground transition-colors"
              >
                {link}
              </a>
            ))}
            <a href="#" className="text-sm text-secondary hover:text-foreground transition-colors">
              Login
            </a>
          </div>
          
          <div className="hidden md:flex items-center gap-3">
            <Button 
              variant="ghost"
              className="text-secondary hover:text-foreground"
              onClick={() => navigate("/login")}
            >
              Sign in
            </Button>
            <Button 
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 border-0"
              onClick={() => navigate("/signup")}
            >
              Get started free
            </Button>
          </div>

          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <div className="flex flex-col gap-6 mt-8">
                {navLinks.map((link) => (
                  <a
                    key={link}
                    href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
                    className="text-lg text-secondary hover:text-foreground transition-colors"
                  >
                    {link}
                  </a>
                ))}
                <Button 
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                  onClick={() => navigate("/signup")}
                >
                  Get started
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden pt-20">
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
            <span style={{ color: '#ccc' }}>Trusted by 147+ performance marketing teams</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-[44px] md:text-[56px] lg:text-[72px] font-bold text-foreground leading-[1.05] tracking-tight"
          >
            Stop guessing.<br />
            <span className="gradient-text">Start converting.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-[18px] md:text-[20px] max-w-[600px] mx-auto mt-6 leading-relaxed"
            style={{ color: '#888' }}
          >
            FrameIQ analyzes competitor ads, extracts what converts, and generates 
            production-ready briefs — so your team ships 10x more creative, 10x faster.
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
              Start free — no card needed
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              variant="outline" 
              className="bg-transparent text-foreground hover:bg-white/5 text-base h-auto rounded-xl px-8 py-4 group"
              style={{ border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <Play className="w-4 h-4 mr-2 group-hover:text-purple-400 transition-colors" />
              Watch 2-min demo
            </Button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex items-center justify-center gap-6 mt-8 text-sm"
            style={{ color: '#666' }}
          >
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              No credit card
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Setup in 2 min
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Cancel anytime
            </span>
          </motion.div>
          
          {/* App Screenshot */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="relative mt-20 max-w-4xl mx-auto"
          >
            <div className="relative text-center mb-4">
              <span style={{ color: '#555', fontSize: '11px', letterSpacing: '3px', fontWeight: 600 }}>
                REAL ANALYSIS OUTPUT
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
                <div 
                  className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-xl"
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
                    "Virginia holds perfume close, whispering: <span style={{ color: '#a78bfa' }}>'Esse é o perfume que uso todo dia antes de gravar'</span>"
                  </p>
                </div>

                {/* Bottom Row */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {['🌐 PT-BR → EN', '⏱ 0:28', '📍 Brazil', '👥 Female 18-34'].map((badge) => (
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
                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs border-0"
                  >
                    Generate Board →
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof Logos */}
      <section className="py-16 px-6 border-y border-border/50">
        <div className="container mx-auto max-w-6xl">
          <p className="text-center text-sm mb-8" style={{ color: '#555' }}>
            Trusted by performance teams at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-12 md:gap-16">
            {logos.map((logo) => (
              <span 
                key={logo}
                className="text-xl font-semibold opacity-30 hover:opacity-60 transition-opacity cursor-default"
                style={{ color: '#fff' }}
              >
                {logo}
              </span>
            ))}
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
              How it works
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4">
              From upload to execution<br />in under 3 minutes
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
              Features
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4">
              Everything your creative team needs
            </h2>
            <p className="text-secondary text-lg mt-4 max-w-2xl mx-auto">
              Stop wasting hours reverse-engineering competitor ads. Let AI do it in seconds.
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
                    className="bg-card/50 border-border/50 hover:border-purple-500/30 transition-all duration-300 hover:-translate-y-1 h-full backdrop-blur-sm"
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
              Pricing
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4">
              Simple, transparent pricing
            </h2>
            <p className="text-secondary text-lg mt-4">
              Start free. Scale when you're ready.
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
                      onClick={() => navigate("/signup")}
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
              Ready to 10x your creative output?
            </h2>
            <p className="text-secondary text-lg mb-8 max-w-xl mx-auto">
              Join 147+ performance teams shipping more creative, faster.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 font-semibold text-base h-auto border-0 rounded-xl px-8 py-4"
                onClick={() => navigate("/signup")}
              >
                Get started free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                variant="outline" 
                className="bg-transparent text-foreground hover:bg-white/5 text-base h-auto rounded-xl px-8 py-4"
                style={{ border: '1px solid rgba(255,255,255,0.2)' }}
              >
                Book a demo
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
                <span className="text-foreground">Frame</span>
                <span className="gradient-text">IQ</span>
              </div>
              <p className="text-sm text-secondary leading-relaxed">
                AI-powered creative intelligence for performance marketing teams.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-secondary">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Integrations</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-secondary">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-secondary">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border/50 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-secondary">
              © 2024 FrameIQ. All rights reserved.
            </div>
            <div className="flex items-center gap-4 text-sm text-secondary">
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                SOC 2 Compliant
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                99.9% Uptime
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
