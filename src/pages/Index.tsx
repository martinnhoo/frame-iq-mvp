import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, FileText, Globe, Brain, Sparkles, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
      description: "Hindi, Spanish, Portuguese — always delivered in English."
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

  const navLinks = ["Features", "Pricing", "Docs"];

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
                href={`#${link.toLowerCase()}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link}
              </a>
            ))}
          </div>
          
          <div className="hidden md:block">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">
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
                    href={`#${link.toLowerCase()}`}
                    className="text-lg text-muted-foreground hover:text-foreground transition-colors"
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
      <section className="relative min-h-screen flex items-center justify-center pt-20 px-6 overflow-hidden">
        {/* Animated background glow */}
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.03) 0%, transparent 70%)',
            animation: 'glow-pulse 8s ease-in-out infinite'
          }}
        />
        
        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8">
          <Badge variant="outline" className="border-border text-secondary px-4 py-2">
            Creative Intelligence Platform
          </Badge>
          
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight">
            Analyze. Generate. Scale.
          </h1>
          
          <p className="text-xl text-secondary max-w-2xl mx-auto">
            Your creative intelligence platform.
          </p>
          
          <p className="text-base text-secondary max-w-lg mx-auto leading-relaxed">
            Stop guessing what makes creatives convert. FrameIQ analyzes competitor videos in any language, 
            generates production-ready boards for your editors, and creates full videos with AI voiceover — in minutes.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button 
              size="lg" 
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-white/10 hover:shadow-white/20 transition-all px-8"
            >
              Start for free
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-border text-foreground hover:bg-card hover:border-foreground/20"
            >
              See how it works
            </Button>
          </div>
          
          {/* Dashboard Mockup */}
          <div className="relative mt-16 max-w-4xl mx-auto">
            <div 
              className="absolute inset-0 bg-white/5 blur-3xl rounded-full"
              style={{ transform: 'translateY(20%)' }}
            />
            <Card className="relative border-border shadow-2xl overflow-hidden bg-card">
              <div className="bg-gradient-to-br from-card to-muted p-8 md:p-12">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Analysis Complete</div>
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      Hook detected: 2.4s
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-background/50 rounded-lg p-4 border border-border">
                      <div className="text-2xl font-bold text-foreground">247</div>
                      <div className="text-xs text-muted-foreground">Videos analyzed</div>
                    </div>
                    <div className="bg-background/50 rounded-lg p-4 border border-border">
                      <div className="text-2xl font-bold text-foreground">89%</div>
                      <div className="text-xs text-muted-foreground">Accuracy rate</div>
                    </div>
                    <div className="bg-background/50 rounded-lg p-4 border border-border">
                      <div className="text-2xl font-bold text-foreground">&lt; 60s</div>
                      <div className="text-xs text-muted-foreground">Avg. analysis</div>
                    </div>
                  </div>
                  <div className="bg-background/30 rounded-lg p-4 border border-border">
                    <div className="text-xs text-muted-foreground mb-2">Detected Format</div>
                    <div className="text-sm text-foreground">Problem-Agitate-Solution / Testimonial Hook</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 space-y-4">
            <div className="text-sm font-semibold text-primary tracking-wider uppercase">
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
                  className="bg-card border-border hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10"
                >
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-muted-foreground leading-relaxed">
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
      <section id="pricing" className="py-24 px-6 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 space-y-4">
            <div className="text-sm font-semibold text-primary tracking-wider uppercase">
              Pricing
            </div>
            <h2 className="text-4xl md:text-5xl font-bold">
              Simple, transparent pricing.
            </h2>
            <p className="text-muted-foreground text-lg">
              No hidden credits. No surprise charges. Cancel anytime.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={index}
                className={`relative ${
                  plan.highlighted 
                    ? 'border-primary shadow-xl shadow-primary/20 md:-translate-y-4' 
                    : 'border-border'
                } transition-all duration-300 hover:-translate-y-2`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      {plan.badge}
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-lg text-muted-foreground font-normal mb-2">
                    {plan.name}
                  </CardTitle>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className={`w-full ${
                      plan.highlighted 
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30' 
                        : 'bg-muted text-foreground hover:bg-muted/80'
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
      <footer className="border-t border-border bg-card">
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
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>
            
            <div className="text-sm text-muted-foreground">
              © 2024 FrameIQ. All rights reserved.
            </div>
          </div>
          
          <div className="text-center mt-8 text-sm text-muted-foreground">
            No credit card required to get started.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
