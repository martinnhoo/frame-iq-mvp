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
    { value: "40K+", label: t("stats_videos") },
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
      features: ["3 analyses/mo", "1 board/mo", "10 scripts/mo", "10 translations", "Pre-flight & AI check"],
      cta: "Get started",
      highlighted: false
    },
    {
      name: "Studio",
      price: "$49",
      period: t("pricing_mo"),
      features: ["30 analyses/mo", "30 boards/mo", "Unlimited hooks & scripts", "Brand Kit", "AI Intelligence", "2 seats"],
      cta: "Start Studio",
      highlighted: true,
      badge: t("pricing_most_popular")
    },
    {
      name: "Scale",
      price: "$499",
      period: t("pricing_mo"),
      features: ["500 analyses/mo", "300 boards/mo", "Unlimited hooks & scripts", "Meta Ads Connect", "10 seats", "API + White Label"],
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
            {t("hero_title_1")}
            <br />
            <span style={{
              background: "linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>{t("hero_title_2")}</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-[17px] md:text-[19px] max-w-[640px] mx-auto mt-6 leading-relaxed text-muted-foreground font-body"
          >
            {t("hero_subtitle")}
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
          {/* Rich Dashboard Mock */}
          <motion.div id="demo-preview"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="relative mt-16 sm:mt-24 max-w-5xl mx-auto hidden sm:block"
          >
            <p className="text-center text-[11px] tracking-[3px] uppercase text-muted-foreground/30 mb-5 font-display">Live analysis output</p>

            {/* Outer glow */}
            <div className="absolute -inset-1 rounded-2xl pointer-events-none" style={{background:"linear-gradient(135deg,rgba(167,139,250,0.15),rgba(244,114,182,0.1))",filter:"blur(20px)"}} />

            <div className="relative rounded-2xl overflow-hidden" style={{boxShadow:"0 50px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(167,139,250,0.2)",background:"#080808"}}>
              {/* Browser bar */}
              <div className="flex items-center gap-3 px-4 py-3 border-b" style={{background:"#0e0e0e",borderColor:"rgba(255,255,255,0.06)"}}>
                <div className="flex gap-1.5">
                  {["#ff5f57","#febc2e","#28c840"].map(c=><div key={c} style={{width:10,height:10,borderRadius:"50%",background:c}} />)}
                </div>
                <div className="flex-1 mx-8 py-1.5 px-4 rounded-lg text-center text-[11px] text-white/25" style={{background:"#111",border:"1px solid rgba(255,255,255,0.05)",fontFamily:"'DM Mono',monospace"}}>
                  <span style={{color:"#4ade80"}}>🔒</span> app.frameiq.com/dashboard/analyses/ugc-br-0312
                </div>
                <div className="w-16" />
              </div>

              {/* Dashboard layout */}
              <div className="flex" style={{minHeight:520}}>
                {/* Sidebar mini */}
                <div className="w-12 border-r flex flex-col items-center py-4 gap-4" style={{background:"#060606",borderColor:"rgba(255,255,255,0.05)"}}>
                  {[["#a78bfa","▦"],["#60a5fa","▤"],["#f472b6","◈"],["#34d399","⊞"],["#fb923c","⚡"],["#c084fc","◉"]].map(([c,s],i)=>(
                    <div key={i} className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px]"
                      style={{background:i===0?`${c}22`:"transparent",color:i===0?c:"rgba(255,255,255,0.2)",border:i===0?`1px solid ${c}30`:"none"}}>
                      {s}
                    </div>
                  ))}
                </div>

                {/* Main content */}
                <div className="flex-1 p-5 space-y-4 overflow-hidden">

                  {/* Top: file + status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{background:"linear-gradient(135deg,#8b5cf6,#ec4899)"}}>🎬</div>
                      <div>
                        <p className="text-white text-sm font-semibold" style={{fontFamily:"'Syne',sans-serif"}}>virginia_wepink_br_ugc.mp4</p>
                        <p className="text-white/25 text-[11px]" style={{fontFamily:"'DM Mono',monospace"}}>0:28 · 9:16 · PT-BR · 14.2MB · Analyzed 2m ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-green-400" style={{background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.2)"}}>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Analysis complete
                      </div>
                      <div className="px-3 py-1.5 rounded-full text-[11px] text-white/40 border border-white/[0.08]">
                        Export board →
                      </div>
                    </div>
                  </div>

                  {/* Score row */}
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      {label:"Hook Score", val:"9.1", sub:"viral", color:"#4ade80", bar:91},
                      {label:"Creative Model", val:"UGC", sub:"Influencer", color:"#a78bfa", bar:null},
                      {label:"Hook Type", val:"Curiosity", sub:"parasocial", color:"#f472b6", bar:null},
                      {label:"Platform Fit", val:"TikTok", sub:"Reels ✓ YT ✓", color:"#60a5fa", bar:null},
                      {label:"Audience", val:"F 25–34", sub:"BR · Beauty", color:"#fb923c", bar:null},
                    ].map((m,i)=>(
                      <div key={i} className="rounded-xl p-3" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                        <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1.5" style={{fontFamily:"'DM Mono',monospace"}}>{m.label}</p>
                        <p className="text-base font-bold" style={{color:m.color,fontFamily:"'Syne',sans-serif"}}>{m.val}</p>
                        {m.bar ? (
                          <div className="mt-1.5 h-1 rounded-full" style={{background:"rgba(255,255,255,0.06)"}}>
                            <div className="h-full rounded-full" style={{width:`${m.bar}%`,background:m.color}} />
                          </div>
                        ) : (
                          <p className="text-[10px] text-white/25 mt-0.5">{m.sub}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Middle row: hook + transcript + suggestions */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Hook breakdown */}
                    <div className="rounded-xl p-4 space-y-3" style={{background:"rgba(167,139,250,0.06)",border:"1px solid rgba(167,139,250,0.15)"}}>
                      <p className="text-[9px] uppercase tracking-widest text-purple-400/50" style={{fontFamily:"'DM Mono',monospace"}}>Hook (0–3s)</p>
                      <p className="text-white/70 text-[12px] leading-relaxed" style={{fontFamily:"'DM Mono',monospace"}}>
                        Camera: product close-up. <span className="text-purple-300">"Vocês não estão prontos pro que eu vou contar"</span>
                      </p>
                      <div className="flex gap-1.5">
                        {["Curiosity gap","Parasocial","Whisper tone"].map(t=>(
                          <span key={t} className="text-[9px] px-2 py-0.5 rounded-full text-purple-300/70" style={{background:"rgba(167,139,250,0.12)",border:"1px solid rgba(167,139,250,0.2)"}}>{t}</span>
                        ))}
                      </div>
                    </div>

                    {/* Transcript snippet */}
                    <div className="rounded-xl p-4" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)"}}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[9px] uppercase tracking-widest text-white/25" style={{fontFamily:"'DM Mono',monospace"}}>Transcript</p>
                        <span className="text-[9px] text-white/20" style={{fontFamily:"'DM Mono',monospace"}}>PT-BR</span>
                      </div>
                      <div className="space-y-1.5">
                        {[["00:00","Vocês não estão prontos...","#a78bfa"],["00:04","Esse perfume ficou 3 meses...","#fff4"],["00:12","A fixação é absurda, juro.","#fff4"],["00:19","Usa VIRGINIA10 e ganha 20%","#f472b6"],["00:24","[product close-up + smile]","#fff2"]].map(([t,line,c])=>(
                          <div key={t} className="flex items-start gap-2">
                            <span className="text-[9px] shrink-0 mt-0.5" style={{color:"rgba(255,255,255,0.2)",fontFamily:"'DM Mono',monospace"}}>{t}</span>
                            <span className="text-[11px] leading-relaxed" style={{color:c}}>{line}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Improvement suggestions */}
                    <div className="rounded-xl p-4" style={{background:"rgba(251,191,36,0.04)",border:"1px solid rgba(251,191,36,0.12)"}}>
                      <p className="text-[9px] uppercase tracking-widest text-amber-400/50 mb-3" style={{fontFamily:"'DM Mono',monospace"}}>AI Suggestions</p>
                      <div className="space-y-2.5">
                        {[
                          {t:"Add on-screen text at 0:00–0:03 to reinforce the hook visually",s:"high"},
                          {t:"CTA placement at 0:19 is late — move to 0:15 for +CTR",s:"high"},
                          {t:"Test a second version with a direct benefit hook (A/B)",s:"medium"},
                        ].map((s,i)=>(
                          <div key={i} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{background:s.s==="high"?"#f472b6":"#fbbf24"}} />
                            <p className="text-[11px] text-white/45 leading-relaxed">{s.t}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bottom: production board preview strip */}
                  <div className="rounded-xl p-4" style={{background:"rgba(96,165,250,0.04)",border:"1px solid rgba(96,165,250,0.12)"}}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[9px] uppercase tracking-widest text-blue-400/50" style={{fontFamily:"'DM Mono',monospace"}}>Generated production board · 4 scenes</p>
                      <span className="text-[10px] text-blue-400/50 border border-blue-400/20 px-2 py-0.5 rounded-full">View full board →</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        {sc:"01",dur:"0:00–0:03",desc:"Product close-up. Whisper VO. No on-screen text.",vo:"'Vocês não estão prontos...'",type:"Hook"},
                        {sc:"02",dur:"0:03–0:12",desc:"Face cam. Natural light. Casual movement.",vo:"'Ficou 3 meses esgotado...'",type:"Story"},
                        {sc:"03",dur:"0:12–0:19",desc:"Spray on wrist. Close-up skin.",vo:"'A fixação é absurda...'",type:"Demo"},
                        {sc:"04",dur:"0:19–0:28",desc:"Full face + product. Smile to camera.",vo:"'VIRGINIA10 → 20% off'",type:"CTA"},
                      ].map((scene)=>(
                        <div key={scene.sc} className="rounded-lg p-3 space-y-1.5" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)"}}>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-white/50" style={{fontFamily:"'DM Mono',monospace"}}>SC {scene.sc}</span>
                            <span className="text-[8px] px-1.5 py-0.5 rounded text-blue-300/60" style={{background:"rgba(96,165,250,0.1)"}}>{scene.type}</span>
                          </div>
                          <p className="text-[9px] text-white/25" style={{fontFamily:"'DM Mono',monospace"}}>{scene.dur}</p>
                          <p className="text-[10px] text-white/50 leading-relaxed">{scene.desc}</p>
                          <p className="text-[10px] text-blue-300/60 leading-relaxed italic">{scene.vo}</p>
                        </div>
                      ))}
                    </div>
                  </div>

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
              {t("features_label")}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4 font-display" style={{letterSpacing:"-0.02em"}}>
              {t("features_title1")}<br/>
              <span className="text-muted-foreground/50">{t("features_title2")}</span>
            </h2>
          </div>

          <div className="space-y-4">
            {[
              { before: t("feat1_before"), after: t("feat1_after"), tag: t("feat1_tag"), accent: "#a78bfa" },
              { before: t("feat2_before"), after: t("feat2_after"), tag: t("feat2_tag"), accent: "#60a5fa" },
              { before: t("feat3_before"), after: t("feat3_after"), tag: t("feat3_tag"), accent: "#fb923c" },
              { before: t("feat4_before"), after: t("feat4_after"), tag: t("feat4_tag"), accent: "#34d399" },
              { before: t("feat5_before"), after: t("feat5_after"), tag: t("feat5_tag"), accent: "#c084fc" },
            ].map((item, i) => (
              <motion.div key={i} initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}} transition={{delay:i*0.07}} viewport={{once:true}}
                className="grid md:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-border/40">
                {/* Before */}
                <div className="p-5 md:p-6" style={{background:"rgba(239,68,68,0.04)",borderRight:"1px solid rgba(255,255,255,0.05)"}}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-400/60 font-display">{t("before_label")}</span>
                    <span className="h-px flex-1 bg-red-400/10" />
                  </div>
                  <p className="text-sm text-muted-foreground/70 leading-relaxed font-body">{item.before}</p>
                </div>
                {/* After */}
                <div className="p-5 md:p-6 relative" style={{background:"rgba(167,139,250,0.04)"}}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest font-display" style={{color:item.accent,opacity:0.7}}>{t("after_label")} · {item.tag}</span>
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
              <p className="text-xs uppercase tracking-widest text-muted-foreground/40 mb-4 font-display">{t("cta_urgency")}</p>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 font-display" style={{letterSpacing:"-0.02em"}}>
                {t("cta_title1")}<br />
                <span style={{background:"linear-gradient(135deg,#a78bfa,#f472b6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
                  {t("cta_title2")}
                </span>
              </h2>
              <p className="text-muted-foreground text-base mb-3 max-w-lg mx-auto font-body">
                {t("cta_desc")}
              </p>
              <div className="flex items-center justify-center gap-6 mb-8 text-sm text-muted-foreground/50 font-body">
                <span>{t("cta_check1")}</span>
                <span>{t("cta_check2")}</span>
                <span>{t("cta_check3")}</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 font-semibold text-base h-auto border-0 rounded-xl px-10 py-4 shadow-lg shadow-purple-500/30 font-body"
                  onClick={() => navigate("/signup")}
                >
                  {t("cta_primary_btn")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline"
                  className="bg-transparent text-foreground hover:bg-accent/10 text-base h-auto rounded-xl px-8 py-4 border-border/30 font-body"
                  onClick={() => navigate("/book-demo")}
                >
                  {t("cta_secondary_btn")}
                </Button>
              </div>
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