import { Button } from "@/components/ui/button";
import { Menu, ArrowLeft, Clock, Calendar, User, ArrowRight } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";

const blogPosts: Record<string, {
  title: string;
  description: string;
  category: string;
  readTime: string;
  date: string;
  author: string;
  authorRole: string;
  content: string[];
  keywords: string[];
}> = {
  "analyze-competitor-ads": {
    title: "How to Analyze Competitor Ads Without Wasting Hours",
    description: "Learn the methodology Creative Strategists use to extract actionable insights from video ads in minutes, not days. Discover frameworks for ad analysis that save time and boost performance.",
    category: "Creative Strategy",
    readTime: "5 min",
    date: "March 2026",
    author: "FrameIQ Team",
    authorRole: "Creative Intelligence",
    keywords: ["competitor ad analysis", "creative strategy", "ad spy tool", "performance marketing", "video ad analysis"],
    content: [
      "## Why Most Teams Waste Hours Analyzing Competitor Ads",
      "Every performance marketing team knows the drill: scroll through the Meta Ads Library, screenshot interesting ads, paste them into a Notion doc, and try to reverse-engineer what makes them work. The problem? It takes hours, the insights are surface-level, and by the time you brief your editor, the trend has moved on.",
      "Creative Strategists at top DTC brands and agencies are shifting to AI-powered analysis tools to cut this process from days to minutes. Here's the exact framework they use.",
      "## The 3-Layer Competitor Ad Analysis Framework",
      "### Layer 1: Hook Extraction (First 3 Seconds)",
      "The hook is everything in paid social. Research shows that 65% of viewers who watch the first 3 seconds will watch at least 10 more. Yet most teams analyze hooks manually — watching each ad, taking notes, trying to categorize patterns.",
      "With AI-powered tools like FrameIQ, you can upload or paste a competitor ad URL and instantly extract the hook text, visual pattern, and emotional trigger. The AI classifies hooks into categories: curiosity gap, social proof, pattern interrupt, direct benefit, and controversy.",
      "### Layer 2: Creative Model Identification",
      "Every high-performing ad follows a creative model — a structural pattern that determines how the message is delivered. The most common models include UGC testimonial, product demonstration, problem-agitation-solution, listicle, and comparison.",
      "AI analysis identifies these models automatically, so instead of watching 50 ads to spot patterns, you get a structured breakdown of what formats your competitors are betting on.",
      "### Layer 3: Performance Signal Detection",
      "Not all competitor ads are winners. AI tools can estimate performance by analyzing engagement patterns, ad longevity (how long an ad has been running), and creative iteration patterns (multiple versions of the same concept = likely winner).",
      "## How to Build a Competitive Intelligence Workflow",
      "Step 1: Set up a weekly competitor scan. Pick 5-10 competitors and their top-performing ads from Meta Ads Library and TikTok Creative Center.",
      "Step 2: Run each ad through AI analysis. Extract hooks, creative models, and transcripts automatically.",
      "Step 3: Identify patterns. Which hook types appear most? What creative models dominate your niche?",
      "Step 4: Generate production briefs. Use the AI-extracted insights to create briefs your team can execute same-day.",
      "## The ROI of AI-Powered Ad Analysis",
      "Teams using AI ad analysis tools report saving an average of 15 hours per week on competitive research. That's time redirected to producing and testing more creative — which is what actually moves ROAS.",
      "More importantly, the insights are objective and data-driven rather than based on one person's opinion about what 'looks good.'",
      "## Getting Started",
      "Whether you're a solo Creative Strategist or leading a 20-person performance marketing team, the shift to AI-powered competitor analysis is inevitable. The teams that adopt it first gain a compounding advantage: faster insights, more tests, better creative, higher ROAS.",
      "Start analyzing competitor ads in seconds with FrameIQ's free plan — no credit card required.",
    ],
  },
  "hook-framework-ctr": {
    title: "The Hook Framework That Increases CTR by 47%",
    description: "Discover the opening patterns that convert best across Meta, TikTok, and YouTube. Based on AI analysis of 10,000+ video ads across 12 markets.",
    category: "Performance",
    readTime: "7 min",
    date: "March 2026",
    author: "FrameIQ Team",
    authorRole: "Creative Intelligence",
    keywords: ["video ad hooks", "CTR optimization", "creative performance", "ad creative framework", "TikTok ads", "Meta ads"],
    content: [
      "## The First 3 Seconds Decide Everything",
      "We analyzed over 10,000 video ads across Meta, TikTok, and YouTube using AI-powered frame and transcript analysis. The finding was clear: ads with structured hooks following specific patterns had a 47% higher click-through rate than ads with unstructured openings.",
      "Here's the framework, broken down by hook type and platform performance.",
      "## The 5 Hook Archetypes That Convert",
      "### 1. The Curiosity Gap",
      "Formula: Open with a statement that creates an information gap the viewer needs to fill. Example: 'Nobody talks about this, but it changed how I run ads.' Performance: 52% higher completion rate on TikTok. Best for: Education, SaaS, info products.",
      "### 2. The Pattern Interrupt",
      "Formula: Start with something visually or audibly unexpected. Example: A zoom-in on an unusual detail, an unexpected sound, or a contrarian statement. Performance: 38% higher CTR on Meta. Best for: Competitive markets, scroll-heavy placements.",
      "### 3. The Direct Benefit",
      "Formula: Lead with the outcome, not the process. Example: 'This tool saves my team 15 hours a week.' Performance: Highest conversion rate across all platforms (but lower completion rate). Best for: B2B, high-intent audiences.",
      "### 4. The Social Proof Stack",
      "Formula: Open with evidence — numbers, logos, testimonials. Example: 'Used by 500+ DTC brands' with logo animation. Performance: 41% higher CTR for B2B. Best for: Enterprise sales, trust-dependent products.",
      "### 5. The 'I Tested' Framework",
      "Formula: Personal experiment format. Example: 'I tested 100 ad hooks. Here's what actually works.' Performance: Highest engagement rate on YouTube. Best for: Long-form content, YouTube ads.",
      "## Platform-Specific Optimization",
      "### TikTok",
      "Curiosity gaps and pattern interrupts dominate. Native-feeling content (UGC style, phone-recorded) outperforms polished studio content by 3.2x. Audio hooks matter more than visual hooks — 67% of top-performing TikTok ads hook through voiceover in the first second.",
      "### Meta (Facebook & Instagram)",
      "Text overlay hooks perform 28% better than voice-only hooks on Meta. The first frame must be readable without sound. Reels follow TikTok patterns, but Feed ads favor direct benefit hooks with clear CTAs.",
      "### YouTube",
      "The 'I Tested' framework dominates YouTube ads. Viewers expect longer content and tolerate 5-10 second hooks if the payoff is clear. Pre-roll ads need to hook in 3 seconds before the skip button appears.",
      "## How to Apply This Framework",
      "1. Audit your current ads: Classify each hook into one of the 5 archetypes. 2. Identify gaps: Which hook types haven't you tested? 3. Generate variations: Use AI tools to create 3-5 hook variations per concept. 4. Test systematically: Run each hook type against the same body creative to isolate the hook's impact.",
      "## The Bottom Line",
      "The best creative teams aren't guessing about hooks — they're using structured frameworks backed by data. Whether you're spending $5K or $500K per month on ads, your hook strategy is the single biggest lever for improving creative performance.",
    ],
  },
  "ai-creative-production-guide": {
    title: "AI in Creative Production: The Complete 2026 Guide",
    description: "How performance teams are using AI to save budget, test faster, and ship more ad creative without depending on agencies or freelancers.",
    category: "AI & Automation",
    readTime: "10 min",
    date: "March 2026",
    author: "FrameIQ Team",
    authorRole: "Creative Intelligence",
    keywords: ["AI creative production", "AI ad generation", "creative automation", "performance creative", "AI marketing tools 2026"],
    content: [
      "## The State of AI in Creative Production (2026)",
      "AI has fundamentally changed how performance marketing teams produce ad creative. What used to require a creative strategist, copywriter, editor, and designer can now be partially automated — not replacing humans, but making small teams operate like large ones.",
      "This guide covers every AI-powered workflow that leading performance teams are using in 2026.",
      "## 1. AI Video Analysis & Competitive Intelligence",
      "The first and most impactful use case: using AI to analyze video ads at scale. Instead of manually watching competitor ads and taking notes, AI tools can extract hooks, identify creative models, transcribe audio, and classify ad formats in under 60 seconds.",
      "This transforms competitive research from a weekly 10-hour task to a daily 30-minute routine. Teams can monitor more competitors, spot trends faster, and brief their editors with data-backed insights.",
      "## 2. AI-Generated Production Briefs",
      "Once you've analyzed what works, the next step is turning insights into production-ready briefs. AI brief generators take your analysis data and produce scene-by-scene breakdowns with voiceover scripts, visual references, and editor notes.",
      "This eliminates the back-and-forth between strategists and editors. The brief is specific enough that an editor can start cutting immediately, without a 30-minute kickoff call.",
      "## 3. AI Voiceover & Audio",
      "AI-generated voiceovers have reached a quality level that's indistinguishable from human voices in most ad formats. This is particularly valuable for UGC-style ads where you need multiple voice variations for A/B testing, localization into multiple languages, and quick iterations without booking talent.",
      "## 4. AI Video Generation",
      "The newest frontier: generating full video ads from production briefs. While AI-generated video isn't yet at the level of professional production for all formats, it's highly effective for product demonstrations and explainers, B-roll and transition sequences, social proof compilations, and concept testing before full production.",
      "## 5. Building Your AI Creative Stack",
      "The most effective teams use AI at every stage of the creative pipeline: Research (AI analysis) → Strategy (AI briefs) → Production (AI video/audio) → Testing (AI variations).",
      "The key is not to automate everything, but to automate the repetitive parts so your team can focus on high-level creative decisions.",
      "## What AI Can't Replace (Yet)",
      "Creative direction and brand voice. AI can generate content, but it can't tell you whether it's right for your brand. The strategic 'why' behind creative decisions still requires human judgment. Novel concepts that break conventions — AI is great at remixing existing patterns, but breakthrough creative still comes from human insight.",
      "## The ROI of AI Creative Production",
      "Teams fully leveraging AI creative tools report: 60-80% reduction in time from concept to live ad, 3-5x increase in creative volume, 40% reduction in creative production costs, and 25% improvement in average ad performance (due to more testing).",
      "## Getting Started",
      "You don't need to overhaul your entire workflow at once. Start with AI analysis (the lowest effort, highest impact step), then gradually layer in AI briefs, voiceover, and video generation as your team gets comfortable.",
      "FrameIQ offers all five AI capabilities in a single platform — from analysis to video generation. Start with a free account and see the difference in your first week.",
    ],
  },
  "dtc-brand-case-study": {
    title: "How a DTC Brand Cut Creative Costs by 60% with FrameIQ",
    description: "A step-by-step breakdown of how a beauty brand scaled from 5 to 50 ad variations per week using AI-powered creative analysis and production.",
    category: "Case Study",
    readTime: "8 min",
    date: "February 2026",
    author: "FrameIQ Team",
    authorRole: "Creative Intelligence",
    keywords: ["DTC creative strategy", "ad creative cost reduction", "AI case study", "beauty brand ads", "creative scaling"],
    content: [
      "## The Challenge",
      "A fast-growing DTC beauty brand was spending $25K/month on creative production — split between a creative agency ($15K) and freelance editors ($10K). Despite the investment, they were only producing 5-8 ad variations per week, far below the volume needed to maintain Meta and TikTok ad performance.",
      "Their creative strategist was spending 60% of their time on competitive research and briefing, leaving little time for actual strategy.",
      "## The Solution",
      "The brand adopted FrameIQ to automate three key parts of their creative workflow: competitive analysis, production briefing, and creative variation generation.",
      "### Phase 1: AI-Powered Competitive Research (Week 1-2)",
      "The team set up a weekly routine: every Monday, they uploaded the top 20 competitor ads from Meta Ads Library and TikTok Creative Center into FrameIQ. The AI extracted hooks, creative models, and transcripts — a process that previously took 8 hours now took 45 minutes.",
      "### Phase 2: Automated Production Briefs (Week 3-4)",
      "Using the competitive insights, the team started generating AI production briefs. Each brief included a scene-by-scene breakdown with timing, voiceover scripts with tone notes, visual references pulled from top-performing ads, and editor notes with specific direction.",
      "The briefs were specific enough that their freelance editors could start working immediately, cutting the typical briefing + revision cycle from 3 days to 4 hours.",
      "### Phase 3: Scaled Variation Production (Month 2+)",
      "With faster briefing and clearer direction, the team scaled from 5 to 50 ad variations per week. They used FrameIQ's AI to generate hook variations (5 hooks per concept), create voiceover variations (3 voice styles per script), and produce concept tests before committing to full production.",
      "## The Results",
      "After 3 months with FrameIQ: creative production costs dropped from $25K to $10K/month (60% reduction). Ad variations increased from 5 to 50 per week (10x). Average ROAS improved by 34% due to more testing. Creative strategist reclaimed 20 hours/week for actual strategy.",
      "## Key Takeaways for DTC Brands",
      "1. Start with analysis, not generation. The biggest ROI comes from better competitive intelligence. 2. Use AI briefs to eliminate the briefing bottleneck. Your editors are only as good as the briefs they receive. 3. Volume is a strategy. More variations = more data = better creative decisions. 4. Don't replace your team — accelerate them. AI handles the repetitive work so humans can do what they're best at.",
    ],
  },
  "ugc-vs-studio-ads": {
    title: "UGC vs. Studio Ads: What Actually Converts in 2026",
    description: "We analyzed 50,000 ads across Meta, TikTok, and YouTube. Here's what the data says about UGC vs studio creative formats and when to use each.",
    category: "Creative Strategy",
    readTime: "6 min",
    date: "February 2026",
    author: "FrameIQ Team",
    authorRole: "Creative Intelligence",
    keywords: ["UGC ads", "studio ads", "ad creative format", "UGC vs professional ads", "TikTok UGC", "Meta ads format"],
    content: [
      "## The UGC vs. Studio Debate",
      "Ask any performance marketer whether UGC or studio content converts better, and you'll get a strong opinion. But opinions aren't data. We used FrameIQ's AI analysis engine to study 50,000 ads across Meta, TikTok, and YouTube to answer this question definitively.",
      "Spoiler: the answer is 'it depends' — but the data tells us exactly what it depends on.",
      "## The Data: Overall Performance",
      "Across all platforms and verticals: UGC ads have 23% higher CTR on average. Studio ads have 18% higher conversion rate on average. Hybrid formats (UGC-style with studio production quality) outperform both by 31%.",
      "## Platform Breakdown",
      "### TikTok",
      "UGC dominates TikTok. Native-feeling content outperforms studio content by 3.2x in engagement. The platform's algorithm rewards authenticity and UGC aligns with user expectations. Key finding: the most successful TikTok ads are UGC in format but strategically structured — they feel natural but follow proven hook-body-CTA patterns.",
      "### Meta (Instagram & Facebook)",
      "Meta shows a more nuanced picture. Reels: UGC outperforms by 2.1x (similar to TikTok). Feed: Studio and UGC perform similarly, but hybrid formats win. Stories: UGC outperforms by 1.7x. The takeaway: match your format to the placement.",
      "### YouTube",
      "YouTube is where studio content shines. For pre-roll ads, polished production signals credibility and viewers expect higher production quality. However, 'I tested' style UGC content in YouTube Shorts matches TikTok patterns.",
      "## Vertical-Specific Insights",
      "Beauty & Fashion: UGC outperforms by 2.8x. Social proof and authenticity are critical purchase drivers. SaaS & B2B: Studio/hybrid outperforms by 1.5x. Credibility and professionalism matter for business buyers. Food & Beverage: Hybrid wins. High-quality food visuals + UGC narration. Finance & Insurance: Studio outperforms by 2.1x. Trust and authority drive conversion.",
      "## The Hybrid Format",
      "The best-performing ads in our dataset combine: UGC-style presentation (talking to camera, casual tone) with studio-quality visuals (good lighting, clean audio, professional editing) and strategic structure (data-backed hooks, clear CTAs).",
      "## How to Test",
      "1. Take your best-performing studio ad and create a UGC version with the same script. 2. Take your best UGC and add studio post-production (color grading, better audio, b-roll). 3. Test each against the original. 4. Use AI analysis tools to identify which elements drive performance.",
    ],
  },
  "board-generation-launch": {
    title: "Introducing Board Generation: From Brief to Production in 30 Seconds",
    description: "FrameIQ's new AI board generator creates full production boards with scenes, VO scripts, and editor notes from a single prompt.",
    category: "Product Updates",
    readTime: "4 min",
    date: "January 2026",
    author: "FrameIQ Team",
    authorRole: "Product",
    keywords: ["AI production board", "creative brief generator", "ad production workflow", "FrameIQ board generation", "AI creative tool"],
    content: [
      "## The Briefing Bottleneck",
      "We talked to 200+ creative strategists and performance marketers. The #1 bottleneck in their creative pipeline wasn't ideation, editing, or distribution — it was briefing.",
      "Writing a production brief that's specific enough for an editor to execute without endless revisions takes 30-60 minutes per concept. When you're testing 20+ concepts per week, that's 10+ hours just on briefs.",
      "## Introducing AI Board Generation",
      "Today, we're launching Board Generation — a new FrameIQ feature that creates complete production boards from a single text prompt in under 30 seconds.",
      "### What's in a Board?",
      "Each generated board includes: scene-by-scene breakdown with timing and transitions, voiceover script with tone and delivery notes, visual direction for each scene (camera angles, compositions, references), editor notes with specific technical direction, and export options for Notion, Google Docs, and PDF.",
      "### How It Works",
      "1. Enter a prompt describing your ad concept. Example: '30-second UGC-style TikTok ad for a skincare brand targeting women 25-34, featuring a before/after transformation.' 2. FrameIQ generates a complete board with 6-10 scenes, full VO script, and editor notes. 3. Review and edit — adjust scenes, swap references, modify the script. 4. Export and send to your editor. They can start immediately.",
      "## Built on Real Creative Intelligence",
      "Board Generation isn't just GPT with a template. It's powered by FrameIQ's analysis of millions of video ads, which means: scene structures follow patterns proven to convert, hooks are based on our CTR research, pacing matches platform best practices, and CTAs use patterns with highest conversion rates.",
      "## Early Results",
      "Beta testers reported: 85% reduction in briefing time, 3x increase in concepts tested per week, 40% fewer revision rounds with editors, and editors preferred AI-generated briefs over manual ones (clearer, more specific).",
      "## Pricing",
      "Board Generation is included in all paid plans: Studio (30 boards/month), Scale (300 boards/month), and Enterprise (unlimited). Free plan users get 3 boards/month to try it out.",
      "## Try It Today",
      "Board Generation is live for all FrameIQ users. Log in to your dashboard or start a free account to generate your first board in 30 seconds.",
    ],
  },
};

const BlogPost = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const post = slug ? blogPosts[slug] : null;

  if (!post) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Post not found</h1>
          <Button variant="ghost" onClick={() => navigate("/blog")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to blog
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{post.title} | FrameIQ Blog</title>
        <meta name="description" content={post.description} />
        <meta name="keywords" content={post.keywords.join(", ")} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.description} />
        <meta property="og:type" content="article" />
        <link rel="canonical" href={`https://frameiq.com/blog/${slug}`} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": post.title,
            "description": post.description,
            "author": { "@type": "Organization", "name": "FrameIQ" },
            "publisher": { "@type": "Organization", "name": "FrameIQ" },
            "datePublished": post.date,
            "keywords": post.keywords.join(", "),
          })}
        </script>
      </Helmet>

      {/* Navbar */}
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
                <Link to="/contact" className="text-lg text-secondary hover:text-foreground">Contact</Link>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white" onClick={() => navigate("/signup")}>Get started</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      <article className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Back */}
            <Button variant="ghost" className="text-secondary mb-8 -ml-4" onClick={() => navigate("/blog")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to blog
            </Button>

            {/* Meta */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' }}>
                {post.category}
              </span>
              <span className="flex items-center text-xs text-muted-foreground gap-1">
                <Calendar className="w-3 h-3" /> {post.date}
              </span>
              <span className="flex items-center text-xs text-muted-foreground gap-1">
                <Clock className="w-3 h-3" /> {post.readTime} read
              </span>
              <span className="flex items-center text-xs text-muted-foreground gap-1">
                <User className="w-3 h-3" /> {post.author}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-6">
              {post.title}
            </h1>
            <p className="text-secondary text-lg leading-relaxed mb-12 border-l-2 border-purple-500/50 pl-4">
              {post.description}
            </p>

            {/* Content */}
            <div className="prose-custom space-y-6">
              {post.content.map((block, i) => {
                if (block.startsWith("### ")) {
                  return <h3 key={i} className="text-xl font-semibold mt-10 mb-3">{block.replace("### ", "")}</h3>;
                }
                if (block.startsWith("## ")) {
                  return <h2 key={i} className="text-2xl font-bold mt-12 mb-4 gradient-text">{block.replace("## ", "")}</h2>;
                }
                return <p key={i} className="text-secondary leading-[1.8] text-[15px]">{block}</p>;
              })}
            </div>

            {/* CTA */}
            <div
              className="mt-16 p-8 rounded-2xl text-center"
              style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.05))', border: '1px solid rgba(139, 92, 246, 0.2)' }}
            >
              <h3 className="text-2xl font-bold mb-3">Ready to transform your creative workflow?</h3>
              <p className="text-secondary mb-6">Join 147+ performance teams shipping more creative, faster.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0"
                  onClick={() => navigate("/signup")}
                >
                  Start free — no card needed <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  className="bg-transparent hover:bg-white/5"
                  style={{ border: '1px solid rgba(255,255,255,0.15)' }}
                  onClick={() => navigate("/book-demo")}
                >
                  Book a demo
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </article>
    </div>
  );
};

export default BlogPost;
