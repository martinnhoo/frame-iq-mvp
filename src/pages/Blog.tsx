import { Button } from "@/components/ui/button";
import { Menu, ArrowRight, Clock } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";

const Blog = () => {
  const navigate = useNavigate();

  const posts = [
    { category: "Creative Strategy", title: "How to Analyze Competitor Ads Without Wasting Hours", description: "Learn the methodology Creative Strategists use to extract actionable insights from video ads in minutes, not days.", readTime: "5 min", date: "Mar 2026", slug: "analyze-competitor-ads" },
    { category: "Performance", title: "The Hook Framework That Increases CTR by 47%", description: "Discover the opening patterns that convert best, based on AI analysis of 10,000+ video ads across 12 markets.", readTime: "7 min", date: "Mar 2026", slug: "hook-framework-ctr" },
    { category: "AI & Automation", title: "AI in Creative Production: The Complete 2026 Guide", description: "How performance teams are saving budget and testing faster without depending on agencies or freelancers.", readTime: "10 min", date: "Mar 2026", slug: "ai-creative-production-guide" },
    { category: "Case Study", title: "How a DTC Brand Cut Creative Costs by 60% with FrameIQ", description: "A step-by-step breakdown of how a beauty brand scaled from 5 to 50 ad variations per week using AI analysis.", readTime: "8 min", date: "Feb 2026", slug: "dtc-brand-case-study" },
    { category: "Creative Strategy", title: "UGC vs. Studio Ads: What Actually Converts in 2026", description: "We analyzed 50,000 ads across Meta, TikTok, and YouTube. Here's what the data says about creative formats.", readTime: "6 min", date: "Feb 2026", slug: "ugc-vs-studio-ads" },
    { category: "Product Updates", title: "Introducing Board Generation: From Brief to Production in 30s", description: "Our new AI board generator creates full production boards with scenes, VO scripts, and editor notes from a single prompt.", readTime: "4 min", date: "Jan 2026", slug: "board-generation-launch" },
    { category: "Performance", title: "How to Structure A/B Tests for Ad Creative in 2026", description: "The complete framework for testing hooks, formats, CTAs, and audiences systematically — with real data from 500+ tests.", readTime: "8 min", date: "Mar 2026", slug: "ab-testing-ad-creative" },
    { category: "Creative Strategy", title: "The Creative Strategist's Tech Stack: 12 Essential Tools", description: "From ad spy tools to AI analysis — every tool a modern Creative Strategist needs to ship winning ads consistently.", readTime: "6 min", date: "Mar 2026", slug: "creative-strategist-tech-stack" },
    { category: "iGaming", title: "Creative Trends in iGaming Ads: What's Working in 2026", description: "Hook patterns, compliance frameworks, and creative models driving performance in regulated iGaming markets.", readTime: "9 min", date: "Mar 2026", slug: "igaming-creative-trends" },
    { category: "Fintech", title: "How Fintech Brands Are Using AI to Scale Ad Creative", description: "Case studies from Revolut, Wise, and Nubank on using AI-powered creative tools to test faster in regulated markets.", readTime: "7 min", date: "Feb 2026", slug: "fintech-ai-creative" },
    { category: "AI & Automation", title: "AI Voiceover for Ads: Quality, Speed, and Cost Compared", description: "We tested 8 AI voice tools for ad production. Here's which ones actually sound human and convert.", readTime: "6 min", date: "Feb 2026", slug: "ai-voiceover-comparison" },
    { category: "Performance", title: "Meta Ads Creative Best Practices for 2026", description: "Updated guidelines for Facebook and Instagram ad creative — formats, hooks, and CTAs that drive ROAS.", readTime: "8 min", date: "Feb 2026", slug: "meta-ads-best-practices" },
    { category: "Creative Strategy", title: "How to Brief Editors for Maximum Output (Template Included)", description: "The briefing framework that cuts revision rounds by 60% and gets your editor producing same-day.", readTime: "5 min", date: "Jan 2026", slug: "editor-briefing-framework" },
    { category: "TikTok", title: "TikTok Ad Creative That Converts: 2026 Playbook", description: "Native vs. polished, hooks that stop the scroll, and the formats driving lowest CPA on TikTok Ads.", readTime: "7 min", date: "Jan 2026", slug: "tiktok-ad-creative-playbook" },
    { category: "E-commerce", title: "Scaling DTC Ad Creative: From 5 to 100 Variations Per Week", description: "The production workflow that lets lean DTC teams produce high-volume creative without hiring an agency.", readTime: "9 min", date: "Jan 2026", slug: "scaling-dtc-creative" },
    { category: "AI & Automation", title: "The Future of Creative Strategy: AI-Augmented Teams", description: "How AI is changing the role of Creative Strategists — and why the best teams are leaning in, not resisting.", readTime: "6 min", date: "Jan 2026", slug: "future-creative-strategy-ai" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>FrameIQ Blog — Creative Strategy, AI & Performance Marketing Insights</title>
        <meta name="description" content="Expert insights on creative strategy, AI-powered ad production, performance marketing, and scaling ad creative for growth teams and Creative Strategists." />
        <meta name="keywords" content="creative strategy blog, AI ad production, performance marketing, ad creative, video ad analysis, creative strategist, DTC ads, TikTok ads, Meta ads" />
        <link rel="canonical" href="https://frameiq.com/blog" />
      </Helmet>

      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="text-2xl font-bold flex items-center">
            <span className="text-foreground font-medium">Frame</span>
            <span className="gradient-text font-black">IQ</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/#features" className="text-sm text-secondary hover:text-foreground transition-colors">Features</Link>
            <Link to="/#pricing" className="text-sm text-secondary hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/blog" className="text-sm text-foreground transition-colors">Blog</Link>
            <Link to="/faq" className="text-sm text-secondary hover:text-foreground transition-colors">FAQ</Link>
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
                <Link to="/blog" className="text-lg text-foreground">Blog</Link>
                <Link to="/faq" className="text-lg text-secondary hover:text-foreground">FAQ</Link>
                <Link to="/contact" className="text-lg text-secondary hover:text-foreground">Contact</Link>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white" onClick={() => navigate("/signup")}>Get started</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      <section className="pt-32 pb-16 px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
            <span className="text-sm font-semibold tracking-wider uppercase gradient-text">Blog</span>
            <h1 className="text-4xl md:text-5xl font-bold mt-4">Insights for Creative Teams</h1>
            <p className="text-secondary text-lg mt-4 max-w-2xl mx-auto">
              Strategy, performance marketing, and AI — everything your growth team needs to ship better creative, faster.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {posts.map((post, index) => (
              <motion.article
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group cursor-pointer"
                onClick={() => navigate(`/blog/${post.slug}`)}
              >
                <div
                  className="rounded-2xl p-6 h-full transition-all duration-300 group-hover:border-purple-500/30"
                  style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(236, 72, 153, 0.02))', border: '1px solid rgba(139, 92, 246, 0.15)' }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' }}>
                      {post.category}
                    </span>
                    <span className="text-xs text-muted-foreground">{post.date}</span>
                  </div>
                  <h2 className="text-xl font-semibold mb-3 group-hover:text-purple-400 transition-colors">{post.title}</h2>
                  <p className="text-secondary text-sm leading-relaxed mb-4">{post.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 mr-1" />
                      {post.readTime} read
                    </div>
                    <span className="text-xs text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      Read more <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Blog;
