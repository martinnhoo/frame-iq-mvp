import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Clock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

type TemplateCategory = "all" | "ugc" | "testimonial" | "promo" | "tutorial" | "react" | "product-only";

interface Template {
  id: string;
  name: string;
  description: string;
  category: Exclude<TemplateCategory, "all">;
  duration: 15 | 30 | 60;
  markets: string[];
  prompt: string;
}

const TEMPLATES: Template[] = [
  {
    id: "ugc-direct-hook",
    name: "UGC Direct Hook",
    description: "Creator speaks directly to camera with attention-grabbing opening line.",
    category: "ugc",
    duration: 30,
    markets: ["GLOBAL"],
    prompt: `Create a UGC-style ad where a creator speaks directly to camera.

STRUCTURE:
- Scene 1 (0-3s): Bold hook - creator asks a provocative question or makes a surprising statement
- Scene 2 (4-10s): Problem setup - relatable pain point the viewer experiences
- Scene 3 (11-20s): Product introduction + how it solves the problem
- Scene 4 (21-27s): Quick demo or key benefit highlight  
- Scene 5 (28-30s): Clear CTA with urgency

TONE: Authentic, conversational, like talking to a friend
HOOK STYLE: Pattern interrupt - something unexpected in first 2 seconds`,
  },
  {
    id: "testimonial-before-after",
    name: "Testimonial Before/After",
    description: "Real customer story showing transformation with clear before and after.",
    category: "testimonial",
    duration: 60,
    markets: ["GLOBAL"],
    prompt: `Create a testimonial ad showing a customer's transformation journey.

STRUCTURE:
- Scene 1 (0-5s): Hook with end result teaser - "I can't believe the difference"
- Scene 2 (6-15s): BEFORE state - customer describes their struggle/pain point
- Scene 3 (16-25s): Discovery moment - how they found the product
- Scene 4 (26-40s): AFTER state - specific results with numbers/timeframes
- Scene 5 (41-50s): Emotional payoff - how life changed
- Scene 6 (51-60s): Recommendation + CTA

TONE: Genuine, emotional, specific details matter
INCLUDE: Real metrics, timeframes, specific before/after comparison`,
  },
  {
    id: "problem-solution-promo",
    name: "Problem-Solution Promo",
    description: "Fast-paced ad highlighting pain points and product as the solution.",
    category: "promo",
    duration: 30,
    markets: ["GLOBAL"],
    prompt: `Create a problem-solution promo ad with fast pacing.

STRUCTURE:
- Scene 1 (0-3s): PROBLEM hook - "Tired of X?" or show frustrating scenario
- Scene 2 (4-10s): Agitate - make the problem worse, show consequences
- Scene 3 (11-20s): SOLUTION intro - product reveal with key differentiator
- Scene 4 (21-27s): Benefits rapid-fire - 3 key benefits with visuals
- Scene 5 (28-30s): Offer + CTA

TONE: Energetic, punchy, fast cuts
VISUALS: Split screen, side-by-side comparisons`,
  },
  {
    id: "tutorial-step-by-step",
    name: "Tutorial Step-by-step",
    description: "Educational walkthrough teaching viewers how to use the product.",
    category: "tutorial",
    duration: 60,
    markets: ["GLOBAL"],
    prompt: `Create a tutorial-style ad that teaches while selling.

STRUCTURE:
- Scene 1 (0-5s): Hook with outcome - "Let me show you how to X in under 60 seconds"
- Scene 2 (6-15s): Why this matters - quick context on the problem
- Scene 3 (16-25s): STEP 1 - First action with clear visual
- Scene 4 (26-35s): STEP 2 - Second action building on first
- Scene 5 (36-45s): STEP 3 - Final step leading to result
- Scene 6 (46-55s): Result showcase - what they achieved
- Scene 7 (56-60s): CTA to get started

TONE: Helpful teacher, enthusiastic but not salesy
INCLUDE: Screen recordings, close-ups, numbered steps`,
  },
  {
    id: "react-product-reveal",
    name: "React + Product Reveal",
    description: "Creator reacts to product with genuine surprise and excitement.",
    category: "react",
    duration: 15,
    markets: ["GLOBAL"],
    prompt: `Create a reaction-style ad with authentic product discovery.

STRUCTURE:
- Scene 1 (0-3s): Setup - creator about to try/unbox something
- Scene 2 (4-8s): REACTION moment - genuine surprise, excitement
- Scene 3 (9-12s): Quick benefit callout - "This is because..."
- Scene 4 (13-15s): Endorsement + CTA

TONE: Energetic, genuine surprise, unscripted feel
KEY: The reaction must feel authentic, not over-the-top`,
  },
  {
    id: "influencer-day-in-life",
    name: "Influencer Day-in-life",
    description: "Day-in-the-life format integrating product naturally into routine.",
    category: "ugc",
    duration: 60,
    markets: ["BR", "MX"],
    prompt: `Create a day-in-the-life vlog style ad for Brazilian/Mexican audience.

STRUCTURE:
- Scene 1 (0-8s): Morning routine hook - "Come spend the day with me"
- Scene 2 (9-20s): Morning activities with natural product integration
- Scene 3 (21-35s): Midday - product solving a real problem moment
- Scene 4 (36-48s): Afternoon/Evening - showing results/benefits
- Scene 5 (49-55s): Reflection - why they love it
- Scene 6 (56-60s): CTA in native language

TONE: Aspirational but relatable, warm, authentic Latin vibe
LANGUAGE: Portuguese for BR, Spanish for MX
INCLUDE: Lifestyle shots, aesthetic moments, genuine integration`,
  },
  {
    id: "urgency-promo-code",
    name: "Urgency Promo Code",
    description: "Fast-paced promo with limited-time offer and discount code.",
    category: "promo",
    duration: 15,
    markets: ["GLOBAL"],
    prompt: `Create a high-urgency promotional ad with discount code.

STRUCTURE:
- Scene 1 (0-3s): URGENCY hook - "STOP! Only 24 hours left"
- Scene 2 (4-8s): Quick product value prop - one key benefit
- Scene 3 (9-12s): OFFER reveal - percentage off, code on screen
- Scene 4 (13-15s): Countdown urgency + CTA

TONE: High energy, urgency without being annoying
VISUALS: Bold text overlays, countdown timer, promo code prominent
INCLUDE: Clear discount %, promo code, deadline`,
  },
  {
    id: "social-proof-stack",
    name: "Social Proof Stack",
    description: "Multiple testimonials and reviews stacked for credibility.",
    category: "testimonial",
    duration: 30,
    markets: ["GLOBAL"],
    prompt: `Create a social proof compilation ad with multiple testimonials.

STRUCTURE:
- Scene 1 (0-4s): Hook with big number - "Join 50,000+ happy customers"
- Scene 2 (5-10s): Testimonial 1 - quick quote + face
- Scene 3 (11-16s): Testimonial 2 - different demographic
- Scene 4 (17-22s): Testimonial 3 - specific result/number
- Scene 5 (23-27s): Rating/review aggregation visual
- Scene 6 (28-30s): CTA with social proof reminder

TONE: Trustworthy, diverse voices, rapid but readable
INCLUDE: Star ratings, review counts, diverse faces`,
  },
  {
    id: "product-only-aesthetic",
    name: "Product-only Aesthetic",
    description: "Cinematic product shots with no people, pure visual appeal.",
    category: "product-only",
    duration: 15,
    markets: ["GLOBAL"],
    prompt: `Create a product-only aesthetic ad with cinematic visuals.

STRUCTURE:
- Scene 1 (0-4s): Hero shot - product in dramatic lighting
- Scene 2 (5-9s): Detail shots - textures, features, craftsmanship
- Scene 3 (10-12s): Product in context/use
- Scene 4 (13-15s): Logo + tagline + CTA

TONE: Premium, aspirational, minimal text
VISUALS: Slow motion, macro shots, perfect lighting
NO PEOPLE: Focus entirely on product beauty`,
  },
  {
    id: "challenge-hook",
    name: "Challenge Hook",
    description: "Creator attempts a challenge related to product benefits.",
    category: "react",
    duration: 30,
    markets: ["IN", "US"],
    prompt: `Create a challenge-style ad where creator tests the product.

STRUCTURE:
- Scene 1 (0-4s): Challenge setup - "I'm going to try X for 7 days"
- Scene 2 (5-12s): Day 1-3 montage - skepticism, early results
- Scene 3 (13-22s): Day 4-7 - transformation, growing excitement
- Scene 4 (23-27s): Final results - measurable outcome
- Scene 5 (28-30s): Challenge viewers + CTA

TONE: Entertaining, genuine skeptic to believer arc
FOR US: More direct, fast-paced
FOR INDIA: Include local context, family/community angle`,
  },
  {
    id: "fear-solution",
    name: "Fear + Solution",
    description: "Addresses common fears or problems with empathy before solution.",
    category: "promo",
    duration: 30,
    markets: ["GLOBAL"],
    prompt: `Create a fear-to-solution ad that empathizes first.

STRUCTURE:
- Scene 1 (0-5s): FEAR hook - "What if X happens?" or scary statistic
- Scene 2 (6-12s): Empathy - "You're not alone, I was there too"
- Scene 3 (13-20s): Light at end of tunnel - introduce solution
- Scene 4 (21-27s): How it protects/prevents the fear
- Scene 5 (28-30s): Reassurance + CTA

TONE: Empathetic first, then empowering
KEY: Don't exploit fear, resolve it genuinely`,
  },
  {
    id: "founder-story",
    name: "Founder Story",
    description: "Founder shares why they built the product with authentic storytelling.",
    category: "testimonial",
    duration: 60,
    markets: ["US", "EU"],
    prompt: `Create a founder story ad with authentic brand origin.

STRUCTURE:
- Scene 1 (0-8s): Personal hook - "5 years ago, I hit rock bottom"
- Scene 2 (9-20s): Origin story - the problem that sparked the idea
- Scene 3 (21-32s): Building journey - struggles, pivots, breakthroughs
- Scene 4 (33-45s): Mission statement - why this matters
- Scene 5 (46-55s): Customer impact - what they've achieved
- Scene 6 (56-60s): Invitation to join the mission + CTA

TONE: Vulnerable, passionate, mission-driven
FOR US: Emphasize disruption, underdog story
FOR EU: Emphasize craft, sustainability, values`,
  },
];

const CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ugc", label: "UGC" },
  { value: "testimonial", label: "Testimonial" },
  { value: "promo", label: "Promo" },
  { value: "tutorial", label: "Tutorial" },
  { value: "react", label: "React" },
  { value: "product-only", label: "Product-only" },
];

const CATEGORY_COLORS: Record<string, string> = {
  ugc: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  testimonial: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  promo: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  tutorial: "bg-green-500/10 text-green-400 border-green-500/30",
  react: "bg-pink-500/10 text-pink-400 border-pink-500/30",
  "product-only": "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
};

const TemplatesPage = () => {
  const { user } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>("all");
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);

  const filteredTemplates =
    activeCategory === "all"
      ? TEMPLATES
      : TEMPLATES.filter((t) => t.category === activeCategory);

  const handleUseTemplate = async (template: Template) => {
    setLoadingTemplate(template.id);

    try {
      // Save usage to Supabase for analytics
      const { error } = await supabase.from("template_usage").insert({
        user_id: user.id,
        template_id: template.id,
        template_name: template.name,
      });

      if (error) {
        console.error("Failed to log template usage:", error);
      }

      // Navigate to NewBoard with pre-filled prompt
      navigate("/dashboard/boards/new", {
        state: {
          templatePrompt: template.prompt,
          templateName: template.name,
          templateDuration: template.duration,
        },
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to use template");
    } finally {
      setLoadingTemplate(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          Templates
        </h1>
        <p className="text-muted-foreground mt-2">
          Start from a proven format instead of blank.
        </p>
      </motion.div>

      {/* Filter bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-wrap gap-2"
      >
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.value}
            variant={activeCategory === cat.value ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(cat.value)}
            className={
              activeCategory === cat.value
                ? "bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }
          >
            {cat.label}
          </Button>
        ))}
      </motion.div>

      {/* Templates Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {filteredTemplates.map((template, index) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Card className="group border-border bg-card hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 h-full flex flex-col">
              <CardContent className="p-5 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <Badge
                    variant="outline"
                    className={`text-xs font-medium ${CATEGORY_COLORS[template.category]}`}
                  >
                    {template.category.toUpperCase()}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs border-border text-muted-foreground flex items-center gap-1"
                  >
                    <Clock className="h-3 w-3" />
                    {template.duration}s
                  </Badge>
                </div>

                {/* Content */}
                <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {template.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 flex-1">
                  {template.description}
                </p>

                {/* Markets */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {template.markets.map((market) => (
                    <Badge
                      key={market}
                      variant="secondary"
                      className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5"
                    >
                      {market}
                    </Badge>
                  ))}
                </div>

                {/* Button */}
                <Button
                  onClick={() => handleUseTemplate(template)}
                  disabled={loadingTemplate === template.id}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 group-hover:opacity-100 opacity-90 transition-opacity"
                >
                  {loadingTemplate === template.id ? (
                    "Loading..."
                  ) : (
                    <>
                      Use template
                      <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Empty state */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No templates found for this category.</p>
        </div>
      )}
    </div>
  );
};

export default TemplatesPage;
