import { Button } from "@/components/ui/button";
import { Menu, ArrowRight, Clock, ArrowLeft } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";

const Blog = () => {
  const navigate = useNavigate();

  const posts = [
    {
      category: "Creative Strategy",
      title: "How to Analyze Competitor Ads Without Wasting Hours",
      description: "Learn the methodology Creative Strategists use to extract actionable insights from video ads in minutes, not days.",
      readTime: "5 min",
      date: "Mar 2026",
      slug: "analyze-competitor-ads"
    },
    {
      category: "Performance",
      title: "The Hook Framework That Increases CTR by 47%",
      description: "Discover the opening patterns that convert best, based on AI analysis of 10,000+ video ads across 12 markets.",
      readTime: "7 min",
      date: "Mar 2026",
      slug: "hook-framework-ctr"
    },
    {
      category: "AI & Automation",
      title: "AI in Creative Production: The Complete 2026 Guide",
      description: "How performance teams are saving budget and testing faster without depending on agencies or freelancers.",
      readTime: "10 min",
      date: "Mar 2026",
      slug: "ai-creative-production-guide"
    },
    {
      category: "Case Study",
      title: "How a DTC Brand Cut Creative Costs by 60% with FrameIQ",
      description: "A step-by-step breakdown of how a beauty brand scaled from 5 to 50 ad variations per week using AI analysis.",
      readTime: "8 min",
      date: "Feb 2026",
      slug: "dtc-brand-case-study"
    },
    {
      category: "Creative Strategy",
      title: "UGC vs. Studio Ads: What Actually Converts in 2026",
      description: "We analyzed 50,000 ads across Meta, TikTok, and YouTube. Here's what the data says about creative formats.",
      readTime: "6 min",
      date: "Feb 2026",
      slug: "ugc-vs-studio-ads"
    },
    {
      category: "Product Updates",
      title: "Introducing Board Generation: From Brief to Production in 30s",
      description: "Our new AI board generator creates full production boards with scenes, VO scripts, and editor notes from a single prompt.",
      readTime: "4 min",
      date: "Jan 2026",
      slug: "board-generation-launch"
    }
  ];

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
            <Link to="/#features" className="text-sm text-secondary hover:text-foreground transition-colors">Features</Link>
            <Link to="/#pricing" className="text-sm text-secondary hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/blog" className="text-sm text-foreground transition-colors">Blog</Link>
            <Link to="/contact" className="text-sm text-secondary hover:text-foreground transition-colors">Contact</Link>
          </div>
          
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" className="text-secondary hover:text-foreground" onClick={() => navigate("/login")}>
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
              <Button variant="ghost" size="icon"><Menu className="h-6 w-6" /></Button>
            </SheetTrigger>
            <SheetContent>
              <div className="flex flex-col gap-6 mt-8">
                <Link to="/" className="text-lg text-secondary hover:text-foreground">Home</Link>
                <Link to="/blog" className="text-lg text-foreground">Blog</Link>
                <Link to="/contact" className="text-lg text-secondary hover:text-foreground">Contact</Link>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white" onClick={() => navigate("/signup")}>
                  Get started
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
            <span className="text-sm font-semibold tracking-wider uppercase gradient-text">Blog</span>
            <h1 className="text-4xl md:text-5xl font-bold mt-4">
              Insights for Creative Teams
            </h1>
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
                transition={{ delay: index * 0.08 }}
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
                  <h2 className="text-xl font-semibold mb-3 group-hover:text-purple-400 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-secondary text-sm leading-relaxed mb-4">
                    {post.description}
                  </p>
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
