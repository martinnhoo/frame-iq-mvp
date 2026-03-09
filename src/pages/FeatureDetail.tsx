import { Button } from "@/components/ui/button";
import { Video, FileText, Globe, Brain, Sparkles, Zap, ArrowLeft, ArrowRight, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";

const featureData: Record<string, {
  icon: any;
  title: string;
  headline: string;
  description: string;
  details: string[];
  demo: {
    filename: string;
    uploaded: string;
    status: string;
    model: { tag: string; label: string };
    hookScore: string;
    predictedCtr: string;
    ctrDelta: string;
    hook: string;
    brief: string;
    badges: string[];
  };
}> = {
  "video-analysis": {
    icon: Video,
    title: "Video Analysis",
    headline: "Upload any ad. Get a full breakdown in 60 seconds.",
    description: "FrameIQ's AI engine watches your video, extracts the hook, identifies the creative model, transcribes the audio, and generates a production-ready brief — all automatically.",
    details: [
      "Automatic hook extraction from the first 3 seconds with emotional trigger classification",
      "Creative model identification: UGC, talking head, product demo, listicle, comparison, and 12 more formats",
      "Full audio transcription with speaker detection and timestamp mapping",
      "Key frame extraction with scene-by-scene visual breakdown",
      "Predicted CTR and hook score based on analysis of 2.4M+ ads",
      "Auto-translation of any language into English for global teams",
    ],
    demo: {
      filename: "nike_running_campaign_q1.mp4",
      uploaded: "Just now",
      status: "Analysis Complete",
      model: { tag: "Studio", label: "Product Demo" },
      hookScore: "8.7",
      predictedCtr: "4.1%",
      ctrDelta: "↑ 62%",
      hook: "\"Slow-motion close-up of running shoe hitting wet pavement, VO: 'Every millisecond counts — we engineered 14 of them.'\"",
      brief: "Studio product demo for Nike running campaign. High-production close-ups with performance data overlay. Aspirational VO with technical credibility. CTA at 00:18 with urgency driver.",
      badges: ["🌐 EN", "⏱ 0:30", "📍 Global", "👟 Sports", "🏃 Athletes 18-35"],
    },
  },
  "board-generation": {
    icon: FileText,
    title: "Board Generation",
    headline: "From prompt to production board in 30 seconds.",
    description: "Describe your ad concept in plain text. FrameIQ generates a complete production board with scene breakdowns, voiceover scripts, editor notes, and visual direction.",
    details: [
      "Scene-by-scene breakdown with timing, transitions, and visual direction",
      "Full voiceover script with tone, pacing, and delivery notes",
      "Editor notes with specific technical direction for each scene",
      "Visual references pulled from top-performing ads in your niche",
      "Export to Notion, Google Docs, PDF, or share via link",
      "Powered by analysis of millions of high-performing ad structures",
    ],
    demo: {
      filename: "board_fintech_app_launch.prompt",
      uploaded: "Generated",
      status: "Board Ready",
      model: { tag: "Board", label: "6 Scenes" },
      hookScore: "9.3",
      predictedCtr: "3.8%",
      ctrDelta: "↑ 51%",
      hook: "\"Screen recording of phone — notification pops up: 'You just saved $247 this month.' Thumb taps to open app.\"",
      brief: "Fintech app launch ad. UGC-style screen recording with real notification hook. Problem-solution structure showing savings dashboard. Social proof overlay at scene 4. App store CTA with urgency.",
      badges: ["🌐 EN", "⏱ 0:25", "📍 US/EU", "💰 Fintech", "📱 App Install"],
    },
  },
  "auto-translation": {
    icon: Globe,
    title: "Auto Translation",
    headline: "Any language in. English out. Instantly.",
    description: "Upload ads in any language — Portuguese, Spanish, Japanese, Arabic — and FrameIQ automatically transcribes and translates everything to English so your global team stays aligned.",
    details: [
      "Support for 40+ languages with native speaker-level accuracy",
      "Context-aware translation that preserves marketing intent, not just words",
      "Automatic detection of slang, idioms, and cultural references",
      "Side-by-side original and translated transcripts",
      "Translation of on-screen text and overlay copy",
      "Perfect for monitoring competitor ads across international markets",
    ],
    demo: {
      filename: "betano_promo_futebol_br.mp4",
      uploaded: "3 min ago",
      status: "Translated",
      model: { tag: "UGC", label: "Sports Promo" },
      hookScore: "8.2",
      predictedCtr: "5.6%",
      ctrDelta: "↑ 38%",
      hook: "\"Commentator-style VO over match highlights: 'The odds have never been this good — and I can prove it.'\"",
      brief: "iGaming promotional UGC with sports commentary hook. High-energy match footage with odds overlay. Translated from PT-BR, preserving betting terminology and urgency. Compliance-safe CTA format.",
      badges: ["🌐 PT-BR → EN", "⏱ 0:22", "📍 BR Market", "🎮 iGaming", "⚽ Sports 21-45"],
    },
  },
  "creative-intelligence": {
    icon: Brain,
    title: "Creative Intelligence",
    headline: "Classify every ad. Decode every pattern.",
    description: "FrameIQ automatically classifies ads by creative format, extracts hooks, identifies CTAs, and maps the entire creative structure so you can replicate what works.",
    details: [
      "15+ creative model classifications (UGC, talking head, product demo, comparison, etc.)",
      "Hook pattern taxonomy: curiosity gap, pattern interrupt, direct benefit, social proof, controversy",
      "CTA mapping with timestamp and conversion pattern identification",
      "Audience signal detection from visual and verbal cues",
      "Creative fatigue prediction based on format saturation in your niche",
      "Weekly trend reports on emerging creative patterns by vertical",
    ],
    demo: {
      filename: "revolut_crypto_campaign_eu.mp4",
      uploaded: "5 min ago",
      status: "Intelligence Report",
      model: { tag: "Hybrid", label: "Explainer" },
      hookScore: "7.9",
      predictedCtr: "2.9%",
      ctrDelta: "↑ 29%",
      hook: "\"Motion graphics: phone screen morphing between currencies. VO: 'Your money shouldn't have borders. Neither should you.'\"",
      brief: "Hybrid explainer for Revolut crypto feature. Clean motion graphics with aspirational VO. Problem-solution structure targeting travelers and crypto-curious. Multi-feature showcase with single CTA.",
      badges: ["🌐 EN", "⏱ 0:35", "📍 EU Market", "🏦 Fintech", "🌍 Travelers 25-40"],
    },
  },
  "ai-video-generation": {
    icon: Sparkles,
    title: "AI Video Generation",
    headline: "From board to MP4. No editors needed.",
    description: "Turn any production board into a fully rendered video with AI voiceover, transitions, and visual effects. Test concepts before committing to full production.",
    details: [
      "Generate videos from any FrameIQ production board",
      "AI voiceover with 20+ voice styles and multilingual support",
      "Automatic scene transitions matched to platform best practices",
      "B-roll generation for product shots and lifestyle scenes",
      "Export in 9:16, 16:9, 1:1, and 4:5 aspect ratios",
      "Perfect for rapid concept testing before full production investment",
    ],
    demo: {
      filename: "gymshark_summer_collection_v3.board",
      uploaded: "Rendering",
      status: "Video Generated",
      model: { tag: "AI Gen", label: "Lifestyle" },
      hookScore: "8.5",
      predictedCtr: "3.4%",
      ctrDelta: "↑ 44%",
      hook: "\"Quick cuts: gym bag being packed, protein shake, earbuds in — VO: 'Your summer starts now. Not in January.'\"",
      brief: "AI-generated lifestyle ad for Gymshark summer collection. Quick-cut UGC energy with studio B-roll. Motivational VO targeting fitness enthusiasts. Limited-time offer CTA at 00:20.",
      badges: ["🌐 EN", "⏱ 0:24", "📍 Global", "👕 Fashion", "💪 Fitness 18-30"],
    },
  },
  "api-access": {
    icon: Zap,
    title: "API Access",
    headline: "Plug FrameIQ into your stack.",
    description: "REST API with full access to video analysis, board generation, and creative intelligence. Build FrameIQ into your internal tools, dashboards, and automation workflows.",
    details: [
      "RESTful API with comprehensive documentation and SDKs",
      "Webhook support for real-time analysis completion notifications",
      "Batch processing: analyze up to 100 videos per API call",
      "Integration templates for Notion, Slack, Google Sheets, and Zapier",
      "Rate limits scaled to your plan (up to 10K requests/day on Enterprise)",
      "99.9% uptime SLA with dedicated support for API customers",
    ],
    demo: {
      filename: "api_batch_analysis_stake_q1.json",
      uploaded: "via API",
      status: "Batch Complete",
      model: { tag: "API", label: "Batch (24 ads)" },
      hookScore: "8.1",
      predictedCtr: "4.7%",
      ctrDelta: "↑ 55%",
      hook: "\"Top hook from batch: animated casino chips falling into mobile screen — VO: 'The house doesn't always win. Today, you do.'\"",
      brief: "API batch analysis of 24 Stake.com ads across 4 markets. Identified 3 winning hook patterns, 2 emerging creative models, and 6 underperforming variants recommended for pause.",
      badges: ["🔗 REST API", "📊 Batch 24", "📍 Multi-market", "🎰 iGaming", "📈 Analytics"],
    },
  },
};

const FeatureDetail = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const feature = slug ? featureData[slug] : null;

  if (!feature) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Feature not found</h1>
          <Button variant="ghost" onClick={() => navigate("/#features")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to features
          </Button>
        </div>
      </div>
    );
  }

  const Icon = feature.icon;
  const d = feature.demo;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="text-2xl font-bold flex items-center">
            <span className="text-foreground font-medium">Frame</span>
            <span className="gradient-text font-black">IQ</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/#features" className="text-sm text-foreground transition-colors">Features</Link>
            <Link to="/#pricing" className="text-sm text-secondary hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/blog" className="text-sm text-secondary hover:text-foreground transition-colors">Blog</Link>
            <Link to="/contact" className="text-sm text-secondary hover:text-foreground transition-colors">Contact</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" className="text-secondary hover:text-foreground" onClick={() => navigate("/login")}>Sign in</Button>
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 border-0" onClick={() => navigate("/signup")}>Get started free</Button>
          </div>
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon"><Menu className="h-6 w-6" /></Button>
            </SheetTrigger>
            <SheetContent>
              <div className="flex flex-col gap-6 mt-8">
                <Link to="/" className="text-lg text-secondary hover:text-foreground">Home</Link>
                <Link to="/blog" className="text-lg text-secondary hover:text-foreground">Blog</Link>
                <Link to="/contact" className="text-lg text-secondary hover:text-foreground">Contact</Link>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white" onClick={() => navigate("/signup")}>Get started</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      <section className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Button variant="ghost" className="text-secondary mb-8 -ml-4" onClick={() => navigate("/#features")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> All features
            </Button>

            <div className="flex items-center gap-4 mb-6">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}
              >
                <Icon className="w-7 h-7 text-white" />
              </div>
              <div>
                <span className="text-sm font-semibold tracking-wider uppercase gradient-text">{feature.title}</span>
                <h1 className="text-3xl md:text-4xl font-bold">{feature.headline}</h1>
              </div>
            </div>

            <p className="text-secondary text-lg leading-relaxed mb-12 max-w-3xl">{feature.description}</p>

            {/* Details list */}
            <div className="grid md:grid-cols-2 gap-4 mb-16">
              {feature.details.map((detail, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-4 rounded-xl"
                  style={{ background: 'rgba(139, 92, 246, 0.03)', border: '1px solid rgba(139, 92, 246, 0.1)' }}
                >
                  <span className="text-purple-400 mt-0.5">✓</span>
                  <span className="text-sm text-secondary leading-relaxed">{detail}</span>
                </div>
              ))}
            </div>

            {/* Demo Card */}
            <div className="text-center mb-4">
              <span style={{ color: '#555', fontSize: '11px', letterSpacing: '3px', fontWeight: 600 }}>
                LIVE EXAMPLE
              </span>
            </div>

            <div
              className="rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 40px 100px rgba(139, 92, 246, 0.15), 0 0 0 1px rgba(139, 92, 246, 0.2)' }}
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
                  style={{ background: '#0a0a0a', borderRadius: '8px', padding: '6px 16px', fontSize: '12px', color: '#666', fontFamily: '"DM Mono", monospace', border: '1px solid #222' }}
                >
                  <span style={{ color: '#4ade80' }}>🔒</span> app.frameiq.com/analysis
                </div>
                <div className="w-16" />
              </div>

              {/* App Content */}
              <div style={{ background: 'linear-gradient(180deg, #0c0c0c 0%, #080808 100%)', padding: '28px' }}>
                {/* Top Bar */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{d.filename}</div>
                      <div style={{ color: '#555', fontSize: '12px', fontFamily: '"DM Mono", monospace' }}>{d.uploaded}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)' }}>
                    <span style={{ fontSize: '10px', color: '#4ade80' }}>●</span>
                    <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: 500 }}>{d.status}</span>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-xl" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                  <div>
                    <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>Creative Model</div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded text-xs font-medium" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' }}>{d.model.tag}</span>
                      <span style={{ color: '#fff', fontSize: '16px', fontWeight: 600 }}>{d.model.label}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>Hook Score</div>
                    <div className="flex items-baseline gap-1">
                      <span style={{ color: '#4ade80', fontSize: '28px', fontWeight: 700 }}>{d.hookScore}</span>
                      <span style={{ color: '#444', fontSize: '14px' }}>/ 10</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>Predicted CTR</div>
                    <div className="flex items-baseline gap-1">
                      <span style={{ color: '#fff', fontSize: '28px', fontWeight: 700 }}>{d.predictedCtr}</span>
                      <span style={{ color: '#4ade80', fontSize: '12px' }}>{d.ctrDelta}</span>
                    </div>
                  </div>
                </div>

                {/* Hook */}
                <div className="p-4 rounded-xl mb-4" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                  <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Hook (0–3s)</div>
                  <p style={{ color: '#e5e5e5', fontSize: '15px', lineHeight: '1.6', fontFamily: '"DM Mono", monospace' }}>{d.hook}</p>
                </div>

                {/* Brief */}
                <div className="p-4 rounded-xl mb-4" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                  <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Brief</div>
                  <p style={{ color: '#aaa', fontSize: '13px', lineHeight: '1.7', fontFamily: '"DM Mono", monospace', fontStyle: 'italic' }}>{d.brief}</p>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  {d.badges.map((badge) => (
                    <span key={badge} style={{ background: '#141414', border: '1px solid #222', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: '#888' }}>
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center mt-16">
              <Button
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 border-0 px-8 py-4 h-auto text-base rounded-xl"
                onClick={() => navigate("/signup")}
              >
                Try {feature.title} for free <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default FeatureDetail;
