import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, FileText, Globe, Brain, Sparkles, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import VideoDropZone from "@/components/VideoDropZone";

const Index = () => {
  const features = [
    {
      icon: Video,
      title: "Video Analysis",
      description: "Upload any video. Frames, English transcript, creative model and hook extracted in under 60 seconds."
    },
    {
      icon: FileText,
      title: "Board Generation",
      description: "Type a prompt. Get a full production board with scenes, VO script, onscreen text and editor notes."
    },
    {
      icon: Globe,
      title: "Auto Translation",
      description: "Any language, any market — always delivered in English."
    },
    {
      icon: Brain,
      title: "Creative Intelligence",
      description: "Every video classified by format. Hook extracted from the first 3 seconds."
    },
    {
      icon: Sparkles,
      title: "Video Generation",
      description: "From concept board to MP4 with AI voiceover."
    }
  ];

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "/mo",
      features: [
        "3 video analyses",
        "3 boards",
        "0 videos",
        "1 user",
        "No credit card"
      ],
      cta: "Get started free",
      highlighted: false
    },
    {
      name: "Studio",
      price: "$49",
      period: "/mo",
      features: [
        "30 analyses",
        "30 boards",
        "5 videos/month",
        "2 users",
        "Priority support"
      ],
      cta: "Start Studio",
      highlighted: true,
      badge: "Most Popular"
    },
    {
      name: "Scale",
      price: "$499",
      period: "/mo",
      features: [
        "500 analyses",
        "300 boards",
        "10 videos/day",
        "10 users",
        "API access"
      ],
      cta: "Start Scale",
      highlighted: false
    }
  ];

  const navLinks = ["Features", "Pricing", "Drop Video"];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="text-2xl font-bold">
            <span className="text-foreground">Frame</span>
            <span className="text-primary">IQ</span>
          </div>
          
          {/* Desktop Navigation */}
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
          </div>
          
          <div className="hidden md:block">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-white/10">
              Get started
            </Button>
          </div>

          {/* Mobile Menu */}
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
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Get started
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative flex items-center justify-center px-6 overflow-hidden" style={{ paddingTop: '140px', paddingBottom: '120px' }}>
        {/* Animated background glow */}
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.03) 0%, transparent 70%)',
            animation: 'glow-pulse 8s ease-in-out infinite'
          }}
        />
        
        <div className="relative z-10 max-w-[680px] mx-auto text-center">
          <div className="inline-flex items-center rounded-full px-4 py-1.5 text-[12px] mb-8" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#888' }}>
            AI-powered creative intelligence
          </div>
          
          <h1 className="text-[40px] md:text-[52px] lg:text-[64px] font-bold text-foreground" style={{ lineHeight: '1.1', letterSpacing: '-0.5px' }}>
            Your creatives, finally working as hard as your budget.
          </h1>
          
          <p className="text-[17px] max-w-[500px] mx-auto mt-6" style={{ color: '#888888', lineHeight: '1.7' }}>
            FrameIQ analyzes what converts, generates boards your editors can execute, and creates videos with AI voiceover — so you test more, spend less, and stop depending on agencies.
          </p>

          <p className="text-[13px] mt-4" style={{ color: '#444' }}>
            Used by performance teams across 12 countries
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-10">
            <Button 
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base h-auto border-0 rounded-lg"
              style={{ padding: '14px 32px' }}
            >
              Start for free — no card needed
            </Button>
            <Button 
              variant="outline" 
              className="bg-transparent text-foreground hover:bg-card text-base h-auto rounded-lg"
              style={{ padding: '14px 32px', border: '1px solid #333' }}
            >
              Watch demo
            </Button>
          </div>
          
          {/* Dashboard Mockup */}
          <div className="relative mt-16 max-w-4xl mx-auto">
            <div 
              className="absolute inset-0 bg-white/5 blur-3xl rounded-full"
              style={{ transform: 'translateY(20%)' }}
            />
            <Card className="relative border-border shadow-2xl overflow-hidden bg-card">
              <div className="bg-card p-8 md:p-12 border border-border">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-secondary">Analysis Complete</div>
                    <Badge className="bg-foreground/10 text-foreground border-foreground/20">
                      Hook detected: 2.4s
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-background rounded-lg p-4 border border-border">
                      <div className="text-2xl font-bold text-foreground">247</div>
                      <div className="text-xs text-secondary">Videos analyzed</div>
                    </div>
                    <div className="bg-background rounded-lg p-4 border border-border">
                      <div className="text-2xl font-bold text-foreground">89%</div>
                      <div className="text-xs text-secondary">Accuracy rate</div>
                    </div>
                    <div className="bg-background rounded-lg p-4 border border-border">
                      <div className="text-2xl font-bold text-foreground">&lt; 60s</div>
                      <div className="text-xs text-secondary">Avg. analysis</div>
                    </div>
                  </div>
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <div className="text-xs text-secondary mb-2">Detected Format</div>
                    <div className="text-sm text-foreground">Problem-Agitate-Solution / Testimonial Hook</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Video Drop Zone */}
      <VideoDropZone />

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 space-y-4">
            <div className="text-sm font-semibold text-secondary tracking-wider uppercase">
              What it does
            </div>
            <h2 className="text-4xl md:text-5xl font-bold">
              Everything your creative team needs.
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card 
                  key={index}
                  className="bg-card border-border hover:border-foreground/40 transition-all duration-300 hover:-translate-y-1"
                >
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-foreground/5 flex items-center justify-center mb-4 border border-border">
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
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 bg-card">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 space-y-4">
            <div className="text-sm font-semibold text-secondary tracking-wider uppercase">
              Pricing
            </div>
            <h2 className="text-4xl md:text-5xl font-bold">
              Simple, transparent pricing.
            </h2>
            <p className="text-secondary text-lg">
              No hidden credits. No surprise charges. Cancel anytime.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={index}
                className={`relative ${
                  plan.highlighted 
                    ? 'border-foreground shadow-xl shadow-white/10 md:-translate-y-4' 
                    : 'border-border'
                } transition-all duration-300 hover:-translate-y-2 bg-background`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-foreground text-background">
                      {plan.badge}
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-8">
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
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-foreground" />
                        <span className="text-secondary">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className={`w-full ${
                      plan.highlighted 
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-white/10' 
                        : 'bg-card text-foreground hover:bg-muted border border-border'
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="container mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-xl font-bold">
              <span className="text-foreground">Frame</span>
              <span className="text-primary">IQ</span>
            </div>
            
            <div className="flex gap-8">
              {navLinks.map((link) => (
                <a
                  key={link}
                  href={`#${link.toLowerCase()}`}
                  className="text-sm text-secondary hover:text-foreground transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>
            
            <div className="text-sm text-secondary">
              © 2024 FrameIQ. All rights reserved.
            </div>
          </div>
          
          <div className="text-center mt-8 text-sm text-secondary">
            No credit card required to get started.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
