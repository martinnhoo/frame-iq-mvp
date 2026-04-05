import { Button } from "@/components/ui/button";
import { Menu, ArrowRight, Clock } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";
import { Logo } from "@/components/Logo";

const Blog = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const posts = [
    { category: "AI & Automation", title: "Can You Connect ChatGPT to Meta Ads? The Honest Answer", description: "Everyone's asking if ChatGPT can read their Meta Ads data. The short answer: no. Here's why — and what actually can.", readTime: "6 min", date: "Mar 2026", slug: "chatgpt-meta-ads" },
    { category: "AI & Automation", title: "ChatGPT for Facebook Ads: What Works, What Doesn't, and What Actually Does", description: "ChatGPT is great at copy. It's useless at telling you which ad to pause. Here's the honest breakdown for media buyers.", readTime: "7 min", date: "Mar 2026", slug: "chatgpt-for-facebook-ads" },
    { category: "AI & Automation", title: "The AI That Actually Reads Your Ad Account (Not Just Gives Generic Advice)", description: "Generic AI gives generic advice. Real ad account intelligence requires real data access. Here's the difference.", readTime: "6 min", date: "Mar 2026", slug: "ai-that-reads-your-ad-account" },
    { category: "AI & Automation", title: "Using ChatGPT to Analyze Google Ads: The Real Limitations", description: "You can paste your Google Ads reports into ChatGPT. But you're missing the most important part. Here's what changes when AI has direct access.", readTime: "7 min", date: "Mar 2026", slug: "chatgpt-google-ads-analysis" },
    { category: "AI & Automation", title: "What an AI Media Buyer Actually Looks Like in 2026", description: "Not a prompt. Not a chatbot. An AI that knows your account history, spots fatigue before it tanks ROAS, and tells you exactly what to do next.", readTime: "8 min", date: "Mar 2026", slug: "ai-media-buyer-2026" },
    { category: "AI & Automation", title: "Can ChatGPT Analyze Your ROAS? We Tested It", description: "We gave ChatGPT our real ad account data and asked it to diagnose our ROAS. Here's exactly what happened — and where it fell apart.", readTime: "7 min", date: "Mar 2026", slug: "chatgpt-roas-analysis" },
    { category: "AI & Automation", title: "Como conectar o ChatGPT no Meta Ads (e por que não é possível)", description: "Muita gente tenta integrar o ChatGPT ao Meta Ads. Não funciona — mas existe uma IA que faz exatamente isso. Entenda a diferença.", readTime: "6 min", date: "Mar 2026", slug: "chatgpt-meta-ads-como-conectar" },
    { category: "AI & Automation", title: "IA para analisar anúncios: o que o ChatGPT não consegue fazer", description: "O ChatGPT é ótimo para copy. Mas ele não sabe qual criativo está queimando verba na sua conta. Veja o que muda quando a IA tem acesso real aos dados.", readTime: "7 min", date: "Mar 2026", slug: "ia-para-analisar-anuncios" },
    { category: "AI & Automation", title: "Como gestores de tráfego estão usando IA em 2026 (além do ChatGPT)", description: "O ChatGPT é só o começo. Veja como os melhores gestores de tráfego estão usando IA conectada à conta de anúncios para tomar decisões mais rápidas.", readTime: "8 min", date: "Mar 2026", slug: "gestor-de-trafego-com-ia" },
    { category: "AI & Automation", title: "¿Puedes conectar ChatGPT con Meta Ads? La respuesta real", description: "Todo el mundo pregunta si ChatGPT puede leer sus datos de Meta Ads. La respuesta corta: no. Aquí está el por qué — y qué sí puede hacerlo.", readTime: "6 min", date: "Mar 2026", slug: "chatgpt-meta-ads-conectar" },
    { category: "AI & Automation", title: "IA para analizar anuncios: lo que ChatGPT no puede hacer", description: "ChatGPT es genial para copy. Es inútil para decirte qué anuncio pausar. Aquí está el desglose honesto para media buyers.", readTime: "7 min", date: "Mar 2026", slug: "ia-para-anuncios" },
    { category: "AI & Automation", title: "Cómo los gestores de tráfico usan IA en 2026 (más allá de ChatGPT)", description: "Los mejores media buyers ya no usan ChatGPT para analizar cuentas. Usan IA con acceso real a sus datos. Aquí está la diferencia.", readTime: "7 min", date: "Mar 2026", slug: "gestor-trafico-ia-2026" },
    { category: "Creative Strategy", title: "How to Analyze Competitor Ads Without Wasting Hours", description: "Learn the methodology Creative Strategists use to extract actionable insights from video ads in minutes, not days.", readTime: "5 min", date: "Mar 2026", slug: "analyze-competitor-ads" },
    { category: "Performance", title: "The Hook Framework That Increases CTR by 47%", description: "Discover the opening patterns that convert best, based on AI analysis of 10,000+ video ads across 12 markets.", readTime: "7 min", date: "Mar 2026", slug: "hook-framework-ctr" },
    { category: "AI & Automation", title: "AI in Creative Production: The Complete 2026 Guide", description: "How performance teams are saving budget and testing faster without depending on agencies or freelancers.", readTime: "10 min", date: "Mar 2026", slug: "ai-creative-production-guide" },
    { category: "Case Study", title: "How a DTC Brand Cut Creative Costs by 60% with AdBrief", description: "A step-by-step breakdown of how a beauty brand scaled from 5 to 50 ad variations per week using AI analysis.", readTime: "8 min", date: "Feb 2026", slug: "dtc-brand-case-study" },
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
    { category: "Creative Strategy", title: "Try This Before Hiring a Creative Strategist", description: "AI tools can now do 80% of what a junior Creative Strategist does. Test these workflows before committing to a $90K hire.", readTime: "8 min", date: "Mar 2026", slug: "try-before-hiring-creative-strategist" },
    { category: "AI & Automation", title: "Can AI Replace a Full Creative Team? We Tested It", description: "We ran a real campaign using only AI tools — no editors, no designers, no strategists. Here's what happened.", readTime: "10 min", date: "Mar 2026", slug: "ai-replace-full-creative-team" },
    { category: "Case Study", title: "One Marketer, Zero Agency: How AI Replaced a 5-Person Team", description: "A solo performance marketer used AI to produce 200+ ad variations per month — more than his previous agency delivered.", readTime: "7 min", date: "Mar 2026", slug: "solo-marketer-replaces-agency" },
    { category: "Performance", title: "The Real Cost of a Creative Strategist vs. AI Tools", description: "Salary, tools, management overhead — we break down the true cost and show where AI delivers better ROI.", readTime: "6 min", date: "Mar 2026", slug: "cost-creative-strategist-vs-ai" },
    { category: "Performance", title: "Why Your Meta Ads ROAS Drops Suddenly — And How to Fix It Fast", description: "A complete diagnostic guide for media buyers when Meta Ads ROAS drops without warning. Identify the exact cause and fix it fast.", readTime: "9 min", date: "Mar 2026", slug: "why-meta-ads-roas-drops-suddenly" },
    { category: "Performance", title: "The Media Buyer's Creative Fatigue Checklist for Meta Ads (2026)", description: "How to detect, confirm, and fix creative fatigue in Meta Ads before it destroys your ROAS.", readTime: "7 min", date: "Mar 2026", slug: "meta-ads-creative-fatigue-checklist" },
    { category: "Creative Strategy", title: "How to Brief UGC Creators for Meta Ads That Actually Convert", description: "The exact briefing framework media buyers use to get high-converting UGC — with data from your own Meta account.", readTime: "8 min", date: "Mar 2026", slug: "how-to-brief-ugc-creators-meta-ads" },
    { category: "Performance", title: "Meta Ads Frequency Too High? Here's Exactly What to Do", description: "When Meta Ads frequency rises above 3, performance breaks down. Exact thresholds, causes, and fixes.", readTime: "6 min", date: "Mar 2026", slug: "meta-ads-frequency-too-high" },
    { category: "Performance", title: "Meta Ads Hook Rate: What It Is, What's Good, and How to Improve It", description: "Hook rate is the most underused metric in Meta Ads. Benchmarks, hook types ranked by performance, and how to improve.", readTime: "7 min", date: "Mar 2026", slug: "meta-ads-hook-rate-explained" },
    { category: "AI & Automation", title: "AI for Meta Ads: What Actually Works for Media Buyers in 2026", description: "An honest look at AI tools for Meta Ads — what delivers real gains, what's hype, and what to add to your stack.", readTime: "9 min", date: "Mar 2026", slug: "ai-for-meta-ads-media-buyers" },
    { category: "Performance", title: "Meta Ads CPA Too High? A Media Buyer's Diagnostic Guide", description: "Diagnose and fix rising cost per acquisition on Meta Ads with a systematic funnel approach.", readTime: "8 min", date: "Mar 2026", slug: "meta-ads-cpa-too-high" },
    { category: "Performance", title: "How to Scale Meta Ads Without Killing Your ROAS", description: "The scaling strategies that work in 2026 and the mistakes that collapse ROAS when you increase budget.", readTime: "10 min", date: "Mar 2026", slug: "how-to-scale-meta-ads-without-killing-roas" },
    { category: "Agencies", title: "Managing Meta Ads for Multiple Clients: The Agency Playbook", description: "How performance agencies manage Meta Ads across 10+ client accounts without burning out their team.", readTime: "9 min", date: "Mar 2026", slug: "meta-ads-for-agencies-managing-multiple-clients" },
    { category: "Performance", title: "What to Do When Meta Ads Stop Working (A Complete Recovery Plan)", description: "A sequenced action plan to diagnose and fix declining Meta Ads performance — creative, audience, and structural recovery.", readTime: "10 min", date: "Mar 2026", slug: "what-to-do-when-meta-ads-stop-working" },
    { category: "Creative Strategy", title: "5 Signs You Don't Need a Creative Strategist (Yet)", description: "Not every team needs a full-time strategist. Here's how to know if AI tools can cover your needs — and when to finally hire.", readTime: "5 min", date: "Mar 2026", slug: "signs-you-dont-need-creative-strategist" },
    { category: "Performance", title: "Your Meta Ads ROAS Dropped. Here's the Exact Diagnostic Process.", description: "When Meta Ads ROAS drops, most media buyers waste hours guessing. This is the systematic diagnostic process that finds the real cause in under 20 minutes.", readTime: "8 min", date: "Mar 2026", slug: "meta-ads-roas-dropped" },
    { category: "Performance", title: "How to Detect Creative Fatigue in Meta Ads Before It Kills Your ROAS", description: "Creative fatigue is the #1 silent killer of Meta Ads performance. Learn the exact signals and the process for detecting fatigue early.", readTime: "7 min", date: "Mar 2026", slug: "creative-fatigue-meta-ads" },
    { category: "Performance", title: "The Media Buyer's Weekly Meta Ads Checklist (Used by 6-Figure Ad Accounts)", description: "The exact weekly review process that experienced media buyers use to catch performance issues early and brief new creative.", readTime: "9 min", date: "Mar 2026", slug: "meta-ads-media-buyer-checklist" },
    { category: "Creative Strategy", title: "How to Write Meta Ads Hooks That Stop the Scroll in 2026", description: "The complete guide to writing hooks that stop the scroll — built from analysis of thousands of top-performing Meta ads.", readTime: "8 min", date: "Mar 2026", slug: "how-to-write-meta-ads-hooks" },
    { category: "Creative Strategy", title: "How to Write a Meta Ads Creative Brief That Your Editor Actually Uses", description: "Most creative briefs are ignored because they're full of opinions and empty of data. Here's the framework built from performance data.", readTime: "7 min", date: "Mar 2026", slug: "meta-ads-creative-brief-guide" },
    { category: "Tools", title: "The Best AI Tools for Media Buyers in 2026 (Ranked by Actual Usefulness)", description: "A no-hype ranking of AI tools that actually help media buyers manage Meta Ads more effectively.", readTime: "9 min", date: "Mar 2026", slug: "ai-tools-for-media-buyers-2026" },
    { category: "Performance", title: "How to Scale Meta Ads Without Killing Performance", description: "The step-by-step process for scaling budgets, audiences, and creative without triggering the learning phase or destroying ROAS.", readTime: "8 min", date: "Mar 2026", slug: "meta-ads-scaling-guide" },
    { category: "Performance", title: "What Is Hook Rate in Meta Ads and Why It Predicts ROAS Weeks in Advance", description: "Hook rate predicts creative fatigue and ROAS trends 10-14 days before they appear in your results. Here's how to track and use it.", readTime: "6 min", date: "Mar 2026", slug: "what-is-hook-rate-meta-ads" },
    { category: "Strategy", title: "Agency vs. In-House Performance Marketing in 2026: What the Data Actually Shows", description: "The honest breakdown of agency vs. in-house for Meta Ads — including the spend thresholds and where AI changes the calculation.", readTime: "8 min", date: "Mar 2026", slug: "performance-marketing-agency-vs-in-house" },
    { category: "Performance", title: "Your Meta Ads CPM Is Too High. Here Are the 7 Real Reasons Why.", description: "High CPM on Meta Ads has specific, diagnosable causes. This is the breakdown of every reason CPM rises, with the exact fix for each one.", readTime: "7 min", date: "Mar 2026", slug: "meta-ads-cpm-too-high" },
  ];

  const langMap: Record<string, string> = { en: "en", es: "es", fr: "fr", de: "de", ar: "ar", zh: "zh" };
  const hrefLangCode = langMap[language] || "en";
  const baseUrl = (import.meta.env.VITE_BASE_URL as string) || "https://www.adbrief.pro";

  // JSON-LD structured data for blog listing
  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "AdBrief Blog",
    description: "Expert insights on creative strategy, AI-powered ad production, and performance marketing.",
    url: `${baseUrl}/blog`,
    inLanguage: hrefLangCode,
    publisher: {
      "@type": "Organization",
      name: "AdBrief",
      url: baseUrl,
    },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description,
      url: `${baseUrl}/blog/${p.slug}`,
      datePublished: p.date,
      author: { "@type": "Organization", name: "AdBrief" },
    })),
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>AdBrief Blog — Creative Strategy, AI & Performance Marketing Insights</title>
        <meta name="description" content="Expert insights on creative strategy, AI-powered ad production, performance marketing, and scaling ad creative for growth teams and Creative Strategists." />
        <meta name="keywords" content="creative strategy blog, AI ad production, performance marketing, ad creative, video ad analysis, creative strategist, DTC ads, TikTok ads, Meta ads" />
        <meta property="og:title" content="AdBrief Blog — Creative Strategy, AI & Performance Marketing" />
        <meta property="og:description" content="Expert insights on creative strategy, AI-powered ad production and performance marketing." />
        <meta property="og:image" content={`${baseUrl}/og-image.png`} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href={`${baseUrl}/blog`} />
        {/* Hreflang tags */}
        <link rel="alternate" hrefLang="en" href={`${baseUrl}/blog`} />
        <link rel="alternate" hrefLang="es" href={`${baseUrl}/blog?lang=es`} />
        <link rel="alternate" hrefLang="fr" href={`${baseUrl}/blog?lang=fr`} />
        <link rel="alternate" hrefLang="de" href={`${baseUrl}/blog?lang=de`} />
        <link rel="alternate" hrefLang="ar" href={`${baseUrl}/blog?lang=ar`} />
        <link rel="alternate" hrefLang="zh" href={`${baseUrl}/blog?lang=zh`} />
        <link rel="alternate" hrefLang="x-default" href={`${baseUrl}/blog`} />
        <html lang={hrefLangCode} />
        <script type="application/ld+json">{JSON.stringify(blogJsonLd)}</script>
      </Helmet>

      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-4 sm:px-6 py-4">
          <Link to="/">
            <Logo size="lg" />
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/#features" className="text-sm text-secondary hover:text-foreground transition-colors">Features</Link>
            <Link to="/#pricing" className="text-sm text-secondary hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/blog" className="text-sm text-foreground transition-colors">Blog</Link>
            <Link to="/faq" className="text-sm text-secondary hover:text-foreground transition-colors">FAQ</Link>
            <Link to="/contact" className="text-sm text-secondary hover:text-foreground transition-colors">Contact</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" className="text-secondary hover:text-foreground" onClick={() => navigate("/login")}>Sign in</Button>
            <Button className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-700 hover:to-cyan-700 border-0" onClick={() => navigate("/signup")}>Try free for 3 days</Button>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitcher />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon"><Menu className="h-6 w-6" /></Button>
              </SheetTrigger>
              <SheetContent>
                <div className="flex flex-col gap-6 mt-8">
                  <Link to="/" className="text-lg text-secondary hover:text-foreground">Home</Link>
                  <Link to="/blog" className="text-lg text-foreground">Blog</Link>
                  <Link to="/faq" className="text-lg text-secondary hover:text-foreground">FAQ</Link>
                  <Link to="/contact" className="text-lg text-secondary hover:text-foreground">Contact</Link>
                  <Button className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white" onClick={() => navigate("/signup")}>Get started</Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      <section className="pt-28 sm:pt-32 pb-16 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-sm font-semibold tracking-wider uppercase gradient-text">Blog</span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4">Insights for Creative Teams</h1>
            <p className="text-secondary text-base sm:text-lg mt-4 max-w-2xl mx-auto">
              Strategy, performance marketing, and AI — everything your growth team needs to ship better creative, faster.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {posts.map((post, index) => (
              <article
                key={index}
                className="group cursor-pointer"
                onClick={() => navigate(`/blog/${post.slug}`)}
                itemScope
                itemType="https://schema.org/BlogPosting"
              >
                <div
                  className="rounded-2xl p-5 sm:p-6 h-full transition-all duration-300 group-hover:border-sky-500/30"
                  style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(236, 72, 153, 0.02))', border: '1px solid rgba(139, 92, 246, 0.15)' }}
                >
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <span className="px-2 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#0ea5e9' }}>
                      {post.category}
                    </span>
                    <span className="text-[11px] sm:text-xs text-muted-foreground">{post.date}</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 group-hover:text-sky-400 transition-colors" itemProp="headline">{post.title}</h2>
                  <p className="text-secondary text-sm leading-relaxed mb-3 sm:mb-4" itemProp="description">{post.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 mr-1" />
                      {post.readTime} read
                    </div>
                    <span className="text-xs text-sky-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Read more <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Blog;
