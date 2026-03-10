import { useState, useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Clock, ArrowRight, Layers } from "lucide-react";

type Category = "all" | "ugc" | "testimonial" | "promo" | "tutorial" | "react" | "product" | "story" | "hook" | "seasonal" | "b2b" | "app";
type Duration = "all" | "15" | "30" | "60";

interface Template {
  id: string;
  name: string;
  description: string;
  category: Exclude<Category, "all">;
  duration: 15 | 30 | 60;
  prompt: string;
}

const T = (id: string, name: string, description: string, category: Exclude<Category, "all">, duration: 15 | 30 | 60, prompt: string): Template =>
  ({ id, name, description, category, duration, prompt });

const TEMPLATES: Template[] = [
  // UGC
  T("ugc-direct-hook", "UGC Direct Hook", "Creator speaks to camera with attention-grabbing opening.", "ugc", 30,
    `UGC-style ad. Creator speaks directly to camera.\nScene 1 (0-3s): Bold hook — provocative question or surprising statement\nScene 2 (4-10s): Relatable pain point\nScene 3 (11-20s): Product introduction + solution\nScene 4 (21-27s): Quick demo or key benefit\nScene 5 (28-30s): CTA with urgency\nTone: Authentic, conversational. Hook: pattern interrupt in first 2s.`),
  T("ugc-day-in-life", "Day in the Life", "Creator integrates product naturally into their daily routine.", "ugc", 60,
    `Day-in-the-life vlog format.\nScene 1 (0-8s): Morning hook "Come spend the day with me"\nScene 2 (9-20s): Morning routine with natural product integration\nScene 3 (21-35s): Midday — product solving a real problem\nScene 4 (36-48s): Results and benefits in context\nScene 5 (49-55s): Reflection on why they love it\nScene 6 (56-60s): CTA\nTone: Warm, aspirational but relatable.`),
  T("ugc-unboxing", "Unboxing Reaction", "First impression unboxing with authentic excitement.", "ugc", 30,
    `Unboxing-style ad with genuine first impression.\nScene 1 (0-4s): Anticipation hook — package arrives\nScene 2 (5-12s): Opening reveal with real reactions\nScene 3 (13-20s): First impressions — detail callouts\nScene 4 (21-27s): First use/test\nScene 5 (28-30s): Verdict + CTA\nTone: Excited but authentic, not over-the-top.`),
  T("ugc-talking-head", "Talking Head Tips", "Creator shares tips naturally integrated with product.", "ugc", 60,
    `Talking head with tip structure.\nScene 1 (0-5s): Hook — "3 things I wish I knew about X"\nScene 2 (6-18s): Tip 1 with product integration\nScene 3 (19-32s): Tip 2 with visual demo\nScene 4 (33-46s): Tip 3 — the game changer\nScene 5 (47-55s): Recap + why this product matters\nScene 6 (56-60s): CTA\nTone: Helpful expert friend.`),
  T("ugc-confession", "Confession Hook", "Creator confesses they were skeptical before trying product.", "ugc", 30,
    `Confession-style narrative.\nScene 1 (0-4s): "I'm embarrassed it took me this long to try X"\nScene 2 (5-12s): Why they were skeptical\nScene 3 (13-22s): What changed their mind\nScene 4 (23-27s): Result after trying\nScene 5 (28-30s): Recommendation + CTA\nTone: Humble, relatable, genuine.`),
  T("ugc-duet", "Duet/Response", "Creator responds to a common question or comment about the product.", "ugc", 15,
    `Duet/response format.\nScene 1 (0-3s): Reading the question/comment on screen\nScene 2 (4-9s): Direct answer with product demo\nScene 3 (10-12s): Result shown\nScene 4 (13-15s): Follow for more + CTA\nTone: Quick, direct, conversational.`),
  T("ugc-myth-busting", "Myth Busting", "Creator debunks common myths about product category.", "ugc", 60,
    `Myth-busting educational format.\nScene 1 (0-6s): "Stop believing these myths about X"\nScene 2 (7-20s): Myth 1 — debunked with evidence\nScene 3 (21-35s): Myth 2 — the truth revealed\nScene 4 (36-50s): Myth 3 — what actually works\nScene 5 (51-55s): The real solution\nScene 6 (56-60s): CTA\nTone: Authoritative but accessible.`),
  T("ugc-compare", "Comparison Test", "Creator compares product vs competitor or old solution.", "ugc", 30,
    `Side-by-side comparison format.\nScene 1 (0-4s): "I tested X vs Y so you don't have to"\nScene 2 (5-14s): Old solution test — results\nScene 3 (15-24s): New product test — better results\nScene 4 (25-27s): Clear winner announcement\nScene 5 (28-30s): Where to get it + CTA\nVisuals: Split screen, real tests.`),
  T("ugc-gift", "Gift Recommendation", "Creator recommends product as a perfect gift.", "ugc", 15,
    `Gift recommendation format.\nScene 1 (0-3s): "The only gift that actually works for X"\nScene 2 (4-9s): Why it's the perfect gift\nScene 3 (10-12s): Recipient reaction\nScene 4 (13-15s): Where to buy + CTA\nTone: Warm, enthusiastic, personal.`),
  T("ugc-routine", "Routine Integration", "Product becomes part of a morning, skincare, or workout routine.", "ugc", 60,
    `Routine integration format.\nScene 1 (0-6s): "My non-negotiable routine" hook\nScene 2 (7-20s): Step 1 of routine with product\nScene 3 (21-35s): Step 2 — product in action\nScene 4 (36-50s): Results over time\nScene 5 (51-57s): Why I'll never skip it\nScene 6 (58-60s): CTA\nTone: Lifestyle aspirational.`),

  // TESTIMONIAL
  T("test-before-after", "Before / After", "Real customer showing clear transformation.", "testimonial", 60,
    `Before/after transformation testimonial.\nScene 1 (0-5s): End result teaser — "I can't believe the difference"\nScene 2 (6-15s): BEFORE state — specific struggle\nScene 3 (16-25s): Discovery of product\nScene 4 (26-40s): AFTER state — specific results with numbers\nScene 5 (41-50s): Emotional payoff\nScene 6 (51-60s): Recommendation + CTA\nInclude: Real metrics, timeframes.`),
  T("test-social-proof", "Social Proof Stack", "Multiple testimonials stacked for credibility.", "testimonial", 30,
    `Social proof compilation.\nScene 1 (0-4s): Big number hook — "50,000+ customers"\nScene 2 (5-10s): Testimonial 1 — quick quote\nScene 3 (11-16s): Testimonial 2 — different demographic\nScene 4 (17-22s): Testimonial 3 — specific result\nScene 5 (23-27s): Star rating visual\nScene 6 (28-30s): CTA\nInclude: Star ratings, diverse faces.`),
  T("test-celebrity", "Celebrity/Influencer Endorsement", "Known face endorsing with authentic use case.", "testimonial", 15,
    `Celebrity/influencer endorsement.\nScene 1 (0-3s): Name/face reveal — instant credibility\nScene 2 (4-9s): Personal use case — authentic story\nScene 3 (10-12s): Key result or benefit\nScene 4 (13-15s): CTA + code\nTone: Authentic, not overly polished.`),
  T("test-expert", "Expert Endorsement", "Industry expert or professional validating product.", "testimonial", 30,
    `Expert validation format.\nScene 1 (0-5s): Expert introduction + credentials\nScene 2 (6-14s): Professional context for recommendation\nScene 3 (15-23s): Technical explanation of why it works\nScene 4 (24-27s): Clinical/professional results\nScene 5 (28-30s): CTA\nTone: Authoritative, trustworthy.`),
  T("test-interview", "Customer Interview", "Casual interview-style with real customer.", "testimonial", 60,
    `Interview-style customer testimonial.\nScene 1 (0-6s): Question: "What was your life like before?"\nScene 2 (7-20s): Customer honest answer\nScene 3 (21-30s): Question: "How did you find [product]?"\nScene 4 (31-42s): Discovery story\nScene 5 (43-55s): Question: "What changed?"\nScene 6 (56-60s): Final recommendation + CTA\nTone: Conversational, unscripted feel.`),
  T("test-couple", "Couple/Family Story", "Product transforms relationship or family life.", "testimonial", 60,
    `Couple or family testimonial format.\nScene 1 (0-6s): "This product changed our relationship"\nScene 2 (7-18s): The problem they faced together\nScene 3 (19-32s): How they discovered the solution\nScene 4 (33-48s): The transformation as a couple/family\nScene 5 (49-56s): Where they are now\nScene 6 (57-60s): Recommendation + CTA\nTone: Warm, emotional, relatable.`),
  T("test-skeptic", "Skeptic Converted", "Self-described skeptic who became a believer.", "testimonial", 30,
    `Skeptic-to-believer arc.\nScene 1 (0-4s): "I thought this was a scam"\nScene 2 (5-12s): Why they were skeptical\nScene 3 (13-20s): What made them try it\nScene 4 (21-26s): What actually happened\nScene 5 (27-30s): Now recommending to everyone + CTA\nTone: Honest, no-nonsense.`),
  T("test-results-specific", "Specific Results", "Customer leads with hard numbers and specific outcomes.", "testimonial", 15,
    `Results-first testimonial.\nScene 1 (0-3s): "[X]% better / [Y] lbs / $[Z] saved" hook\nScene 2 (4-9s): Context for the result\nScene 3 (10-13s): What made the difference\nScene 4 (14-15s): CTA\nTone: Direct, numbers-first.`),

  // PROMO
  T("promo-urgency", "Urgency Promo Code", "Limited-time offer with discount code.", "promo", 15,
    `High-urgency promo with discount.\nScene 1 (0-3s): "STOP! Only 24 hours left"\nScene 2 (4-8s): Product value prop in one line\nScene 3 (9-12s): Offer reveal — % off + code on screen\nScene 4 (13-15s): Countdown + CTA\nVisuals: Bold text, promo code prominent.`),
  T("promo-sale", "Flash Sale", "Limited-time sale with strong price anchor.", "promo", 15,
    `Flash sale format.\nScene 1 (0-3s): "Flash sale — [X]% off ends tonight"\nScene 2 (4-8s): Original price vs sale price visual\nScene 3 (9-12s): What they get\nScene 4 (13-15s): Shop now + link\nVisuals: Strikethrough pricing, countdown.`),
  T("promo-bundle", "Bundle Deal", "Multiple products bundled for better value.", "promo", 30,
    `Bundle value proposition.\nScene 1 (0-5s): "Get everything you need in one bundle"\nScene 2 (6-14s): Product 1 — value + benefit\nScene 3 (15-22s): Product 2 — value + benefit\nScene 4 (23-25s): Bundle savings calculation\nScene 5 (26-30s): Limited availability + CTA\nVisuals: Bundle layout, savings callout.`),
  T("promo-free-trial", "Free Trial Offer", "Risk-free trial to remove purchase barrier.", "promo", 30,
    `Free trial conversion ad.\nScene 1 (0-4s): "Try [product] free for 30 days"\nScene 2 (5-12s): What they get during trial\nScene 3 (13-20s): Result others got in 30 days\nScene 4 (21-26s): No risk reassurance\nScene 5 (27-30s): Start free trial CTA\nTone: Low pressure, high value.`),
  T("promo-launch", "New Launch Announcement", "Product launch with exclusivity and excitement.", "promo", 30,
    `New product launch format.\nScene 1 (0-4s): "It's finally here" reveal\nScene 2 (5-12s): What makes it different\nScene 3 (13-20s): Key features showcase\nScene 4 (21-26s): Launch offer for early buyers\nScene 5 (27-30s): Get it now + urgency\nTone: Excited, exclusive.`),
  T("promo-referral", "Referral Program", "Encouraging customers to refer friends.", "promo", 15,
    `Referral program ad.\nScene 1 (0-3s): "Share and you both save"\nScene 2 (4-9s): How the referral works simply\nScene 3 (10-12s): What both get\nScene 4 (13-15s): Share link + CTA\nTone: Friendly, win-win framing.`),
  T("promo-seasonal", "Seasonal Offer", "Holiday or seasonal sale with themed creative.", "seasonal", 30,
    `Seasonal promotion format.\nScene 1 (0-4s): Seasonal hook — holiday theme\nScene 2 (5-12s): Gift/seasonal use case\nScene 3 (13-20s): Special seasonal pricing\nScene 4 (21-26s): Deadline for delivery/offer\nScene 5 (27-30s): Shop now + season greeting\nTone: Festive, warm.`),
  T("promo-problem-solution", "Problem → Solution", "Pain point agitation then product as answer.", "promo", 30,
    `Problem-solution ad.\nScene 1 (0-3s): Problem hook — "Tired of X?"\nScene 2 (4-10s): Agitate — consequences of problem\nScene 3 (11-20s): Solution reveal\nScene 4 (21-27s): Three key benefits rapid-fire\nScene 5 (28-30s): Offer + CTA\nVisuals: Split screen, comparisons.`),
  T("promo-guarantee", "Money-Back Guarantee", "Risk reversal focus with bold guarantee.", "promo", 30,
    `Risk-reversal guarantee ad.\nScene 1 (0-4s): "We're so confident, we offer X-day guarantee"\nScene 2 (5-12s): Product and core benefit\nScene 3 (13-20s): What others achieved\nScene 4 (21-26s): Guarantee details — no questions asked\nScene 5 (27-30s): Try risk-free + CTA\nTone: Confident, reassuring.`),
  T("promo-countdown", "Countdown Timer", "Explicit countdown to create urgency.", "promo", 15,
    `Countdown urgency format.\nScene 1 (0-3s): Visible countdown timer on screen\nScene 2 (4-8s): What's at stake — offer ending\nScene 3 (9-12s): Product + discount code\nScene 4 (13-15s): Don't miss out + CTA\nVisuals: Prominent timer, bold offer.`),

  // TUTORIAL
  T("tut-step-by-step", "Step-by-Step Tutorial", "Teaches how to use product in numbered steps.", "tutorial", 60,
    `Tutorial walkthrough format.\nScene 1 (0-5s): Hook — "Let me show you how to X in 60 seconds"\nScene 2 (6-15s): Why this matters — quick context\nScene 3 (16-25s): STEP 1 with clear visual\nScene 4 (26-35s): STEP 2 building on first\nScene 5 (36-45s): STEP 3 — final step\nScene 6 (46-55s): Result showcase\nScene 7 (56-60s): CTA\nTone: Helpful teacher.`),
  T("tut-beginner", "Beginner's Guide", "Made-for-beginners walkthrough removing intimidation.", "tutorial", 60,
    `Beginner-friendly tutorial.\nScene 1 (0-6s): "Even if you've never done X, follow along"\nScene 2 (7-18s): The basics explained simply\nScene 3 (19-32s): First action — guided step\nScene 4 (33-46s): Second action — building confidence\nScene 5 (47-54s): The result a beginner can achieve\nScene 6 (55-60s): Start here + CTA\nTone: Patient, encouraging.`),
  T("tut-hack", "Life Hack Format", "Unexpected clever use of product.", "tutorial", 15,
    `Life hack short tutorial.\nScene 1 (0-3s): "The [product] hack nobody talks about"\nScene 2 (4-9s): Hack demonstrated quickly\nScene 3 (10-12s): The result\nScene 4 (13-15s): Get yours + CTA\nTone: Clever, shareable.`),
  T("tut-recipe", "Recipe / How-to", "Step-by-step instructions using product.", "tutorial", 60,
    `Recipe or how-to format.\nScene 1 (0-5s): End result shown first — appetizer hook\nScene 2 (6-15s): Ingredients/materials list with product\nScene 3 (16-30s): Steps 1-3 with close-up visuals\nScene 4 (31-45s): Steps 4-6 — building to result\nScene 5 (46-55s): Final reveal\nScene 6 (56-60s): Get the ingredients + CTA\nVisuals: Clean close-ups.`),
  T("tut-pro-tips", "Pro Tips", "Expert reveals professional tips using the product.", "tutorial", 30,
    `Pro tips format.\nScene 1 (0-4s): "Pro tips most people don't know"\nScene 2 (5-12s): Tip 1 — surprising insight\nScene 3 (13-20s): Tip 2 — visual demonstration\nScene 4 (21-25s): Tip 3 — the big reveal\nScene 5 (26-30s): Learn more + CTA\nTone: Insider knowledge.`),
  T("tut-transformation", "Quick Transformation", "Fast tutorial showing before-to-after in real time.", "tutorial", 30,
    `Real-time transformation tutorial.\nScene 1 (0-4s): Messy/unresolved BEFORE state shown\nScene 2 (5-14s): Step 1 of transformation with product\nScene 3 (15-23s): Steps 2-3 rapid succession\nScene 4 (24-28s): AFTER reveal\nScene 5 (29-30s): CTA\nVisuals: Fast cuts, satisfying reveals.`),
  T("tut-common-mistakes", "Common Mistakes", "Shows what not to do, then the right way.", "tutorial", 60,
    `Mistake-correction tutorial.\nScene 1 (0-6s): "You're probably doing X wrong"\nScene 2 (7-20s): Mistake 1 + why it fails\nScene 3 (21-35s): Mistake 2 + correct approach\nScene 4 (36-50s): Mistake 3 + best practice\nScene 5 (51-57s): Summary of right approach\nScene 6 (58-60s): CTA\nTone: Educational, not condescending.`),

  // REACT
  T("react-genuine", "Genuine Reaction", "Authentic first-use surprise and excitement.", "react", 15,
    `Genuine reaction format.\nScene 1 (0-3s): Setup — about to try something\nScene 2 (4-8s): REACTION — real surprise\nScene 3 (9-12s): Quick benefit callout\nScene 4 (13-15s): Endorsement + CTA\nTone: Authentic, not rehearsed.`),
  T("react-challenge", "7-Day Challenge", "Creator commits to using product for a week.", "react", 60,
    `Challenge format over time.\nScene 1 (0-6s): "I'm trying X every day for 7 days"\nScene 2 (7-20s): Day 1-3 — skepticism, early observations\nScene 3 (21-40s): Day 4-7 — momentum, visible changes\nScene 4 (41-52s): Final result with comparison\nScene 5 (53-57s): Verdict\nScene 6 (58-60s): Challenge viewers + CTA\nTone: Skeptic to believer.`),
  T("react-vs", "Us vs Them Test", "Side-by-side comparison test with competitor.", "react", 30,
    `Head-to-head comparison.\nScene 1 (0-4s): "I tested [ours] vs [theirs] — here's what happened"\nScene 2 (5-14s): Competitor test result\nScene 3 (15-24s): Our product test — better result\nScene 4 (25-27s): Clear winner\nScene 5 (28-30s): Switch now + CTA\nVisuals: Real side-by-side tests.`),
  T("react-crowd", "Crowd Reaction", "Public or group reacting positively to product.", "react", 30,
    `Crowd/group reaction format.\nScene 1 (0-4s): Social setting — introducing product to group\nScene 2 (5-14s): First reactions — mixed to positive\nScene 3 (15-22s): Most enthusiastic reaction featured\nScene 4 (23-27s): Group verdict\nScene 5 (28-30s): Join them + CTA\nTone: Social proof through real reactions.`),
  T("react-influencer-taste", "Influencer Blind Test", "Influencer doesn't know brand, reacts genuinely.", "react", 30,
    `Blind test reaction format.\nScene 1 (0-4s): "I'm testing this without knowing the brand"\nScene 2 (5-14s): Blind test in progress\nScene 3 (15-22s): Genuine reaction and rating\nScene 4 (23-26s): Brand reveal\nScene 5 (27-30s): "And I'd buy it" + CTA\nTone: Ultra authentic.`),

  // PRODUCT SHOWCASE
  T("prod-aesthetic", "Aesthetic Product Shot", "Cinematic product-only visuals.", "product", 15,
    `Product-only aesthetic.\nScene 1 (0-4s): Hero shot — dramatic lighting\nScene 2 (5-9s): Detail shots — textures, features\nScene 3 (10-12s): Product in context\nScene 4 (13-15s): Logo + tagline + CTA\nVisuals: Slow motion, macro, perfect light.`),
  T("prod-feature-reveal", "Feature Reveal", "Each scene reveals a new product feature.", "product", 30,
    `Feature-by-feature reveal.\nScene 1 (0-4s): "You're not going to believe all of this"\nScene 2 (5-10s): Feature 1 — revealed with wow\nScene 3 (11-16s): Feature 2 — different angle\nScene 4 (17-22s): Feature 3 — the standout\nScene 5 (23-26s): Full product shot\nScene 6 (27-30s): Get yours + CTA\nVisuals: Clean, close-ups.`),
  T("prod-360", "360 Product View", "Complete product showcase from all angles.", "product", 15,
    `360-degree product showcase.\nScene 1 (0-4s): Front — hero angle\nScene 2 (5-8s): Side profiles — elegant shots\nScene 3 (9-11s): Detail close-ups\nScene 4 (12-13s): Signature feature\nScene 5 (14-15s): Brand + CTA\nVisuals: Smooth rotation, premium lighting.`),
  T("prod-packaging", "Premium Unboxing", "Focused on beautiful packaging experience.", "product", 30,
    `Packaging-first unboxing.\nScene 1 (0-5s): Package arrival — premium feel\nScene 2 (6-12s): Outer packaging details\nScene 3 (13-20s): Opening moment — reveal\nScene 4 (21-26s): Contents showcased\nScene 5 (27-30s): First use impression + CTA\nTone: Luxury, tactile, ASMR-adjacent.`),
  T("prod-in-use", "Product In Use", "Showing product being used in real context.", "product", 15,
    `Product in real use.\nScene 1 (0-3s): Natural use scenario\nScene 2 (4-9s): Product solving the need clearly\nScene 3 (10-12s): Satisfaction moment\nScene 4 (13-15s): Get yours + CTA\nTone: Natural, lifestyle.`),

  // STORY
  T("story-founder", "Founder Story", "Founder shares why they built the product.", "story", 60,
    `Founder narrative.\nScene 1 (0-8s): Personal hook — "5 years ago I hit rock bottom"\nScene 2 (9-20s): Origin — the problem that sparked the idea\nScene 3 (21-32s): Building journey — struggles and breakthroughs\nScene 4 (33-45s): Mission statement\nScene 5 (46-55s): Customer impact\nScene 6 (56-60s): Invitation to join + CTA\nTone: Vulnerable, mission-driven.`),
  T("story-brand", "Brand Origin", "How the brand was born from a real problem.", "story", 60,
    `Brand origin story.\nScene 1 (0-7s): "Nobody was solving this problem, so we did"\nScene 2 (8-20s): The gap in the market\nScene 3 (21-33s): How the solution was built\nScene 4 (34-46s): First customers and validation\nScene 5 (47-55s): The impact today\nScene 6 (56-60s): Be part of it + CTA\nTone: Mission-driven, authentic.`),
  T("story-customer-journey", "Customer Hero Journey", "Customer's complete transformation story.", "story", 60,
    `Hero's journey customer story.\nScene 1 (0-6s): Normal world — before product\nScene 2 (7-18s): The challenge — problem at its worst\nScene 3 (19-30s): Discovery — finding the product\nScene 4 (31-44s): Transformation in progress\nScene 5 (45-55s): New world — life after\nScene 6 (56-60s): Their message to others + CTA\nTone: Cinematic, emotional.`),
  T("story-mission", "Mission-Driven", "Product tied to a larger social/environmental mission.", "story", 30,
    `Mission-driven narrative.\nScene 1 (0-5s): The world problem we're fighting\nScene 2 (6-14s): How each purchase creates impact\nScene 3 (15-22s): The product and its quality\nScene 4 (23-27s): Join the mission\nScene 5 (28-30s): Buy with purpose + CTA\nTone: Inspiring, values-led.`),
  T("story-comeback", "Comeback Story", "Brand or customer overcame adversity.", "story", 60,
    `Comeback arc narrative.\nScene 1 (0-7s): The fall — what went wrong\nScene 2 (8-20s): The struggle — darkest moment\nScene 3 (21-34s): The pivot — what changed\nScene 4 (35-50s): The rise — progress and wins\nScene 5 (51-57s): Where they are now\nScene 6 (58-60s): Your turn + CTA\nTone: Resilient, motivational.`),

  // HOOK FORMATS
  T("hook-statistic", "Shocking Statistic", "Opens with a surprising number or fact.", "hook", 15,
    `Statistic-led hook format.\nScene 1 (0-3s): Bold statistic on screen — "[X]% of people don't know this"\nScene 2 (4-9s): Why this matters to the viewer\nScene 3 (10-12s): Product as the solution\nScene 4 (13-15s): CTA\nVisuals: Big number typography.`),
  T("hook-question", "Provocative Question", "Opens with a question that makes viewer stop.", "hook", 15,
    `Question-first hook.\nScene 1 (0-3s): "Have you ever [relatable scenario]?"\nScene 2 (4-9s): Expand on the feeling\nScene 3 (10-12s): The solution\nScene 4 (13-15s): CTA\nTone: Direct, makes viewer nod.`),
  T("hook-forbidden", "Forbidden Knowledge", "Reveals something people didn't know.", "hook", 30,
    `Forbidden knowledge hook.\nScene 1 (0-4s): "The [industry] doesn't want you to know this"\nScene 2 (5-12s): The insider insight\nScene 3 (13-22s): How product leverages this\nScene 4 (23-27s): Why you need it now\nScene 5 (28-30s): CTA\nTone: Conspiratorial, revealing.`),
  T("hook-visual-pattern", "Visual Pattern Interrupt", "Unexpected visual immediately grabs attention.", "hook", 15,
    `Visual pattern interrupt.\nScene 1 (0-2s): Jarring or unexpected visual — no context\nScene 2 (3-7s): Context revealed — the product\nScene 3 (8-12s): Key benefit\nScene 4 (13-15s): CTA\nVisuals: The unexpected shot is the ad's DNA.`),
  T("hook-pov", "POV Format", "First-person point of view creates immersion.", "hook", 15,
    `POV immersive format.\nScene 1 (0-3s): "POV: You just discovered [product]"\nScene 2 (4-9s): First-person experience of using it\nScene 3 (10-12s): The feeling/result\nScene 4 (13-15s): Your turn + CTA\nVisuals: Handheld, first-person camera.`),
  T("hook-stop-scroll", "Stop Scrolling", "Direct address to stop the viewer.", "hook", 15,
    `Stop-scroll direct address.\nScene 1 (0-2s): "Wait — before you scroll past this"\nScene 2 (3-8s): The one thing they need to see\nScene 3 (9-12s): The product reveal\nScene 4 (13-15s): Don't miss it + CTA\nTone: Urgent, direct.`),
  T("hook-transformation-fast", "Fast Transformation", "Before and after in under 5 seconds.", "hook", 15,
    `Lightning transformation hook.\nScene 1 (0-2s): BEFORE — the problem, raw state\nScene 2 (3-5s): AFTER — result shown\nScene 3 (6-11s): How it happened\nScene 4 (12-15s): Get yours + CTA\nVisuals: Side-by-side or cut.`),

  // SEASONAL
  T("seas-black-friday", "Black Friday", "High-impact Black Friday sale creative.", "seasonal", 15,
    `Black Friday ad.\nScene 1 (0-3s): Black Friday title card — bold\nScene 2 (4-8s): The deal — biggest discount of year\nScene 3 (9-12s): Limited stock warning\nScene 4 (13-15s): Shop now + code\nVisuals: Black, gold, urgency.`),
  T("seas-new-year", "New Year New You", "Resolution-based product promise for New Year.", "seasonal", 30,
    `New Year motivation ad.\nScene 1 (0-5s): New Year hook — "This year is different"\nScene 2 (6-14s): The resolution + common failure\nScene 3 (15-22s): Product as the missing piece\nScene 4 (23-27s): New year offer\nScene 5 (28-30s): Start now + CTA\nTone: Motivational, hopeful.`),
  T("seas-valentine", "Valentine's Day Gift", "Gift positioning for Valentine's Day.", "seasonal", 15,
    `Valentine's Day gift ad.\nScene 1 (0-3s): "The gift they actually want"\nScene 2 (4-9s): Gifting context — thoughtful presentation\nScene 3 (10-12s): Product detail\nScene 4 (13-15s): Order today, arrive by [date] + CTA\nTone: Romantic, thoughtful.`),
  T("seas-summer", "Summer Campaign", "Summer lifestyle integration.", "seasonal", 30,
    `Summer lifestyle ad.\nScene 1 (0-5s): Summer hook — sun, fun, energy\nScene 2 (6-14s): Product in summer context\nScene 3 (15-22s): Summer benefit highlight\nScene 4 (23-27s): Summer deal\nScene 5 (28-30s): Make it your best summer + CTA\nTone: Energetic, bright.`),
  T("seas-back-school", "Back to School", "Product for students or parents heading into school year.", "seasonal", 30,
    `Back to school ad.\nScene 1 (0-5s): School season hook — preparation mode\nScene 2 (6-14s): Student or parent use case\nScene 3 (15-22s): How product helps this year\nScene 4 (23-27s): Back to school deal\nScene 5 (28-30s): Be ready + CTA\nTone: Practical, encouraging.`),

  // B2B
  T("b2b-roi", "ROI Focus", "Business ROI and efficiency gains.", "b2b", 60,
    `B2B ROI-focused ad.\nScene 1 (0-7s): Business pain hook — "How much is [problem] costing you?"\nScene 2 (8-20s): The hidden cost calculation\nScene 3 (21-35s): How product solves it\nScene 4 (36-50s): ROI case study — real numbers\nScene 5 (51-57s): Implementation simplicity\nScene 6 (58-60s): Book a demo + CTA\nTone: Professional, data-driven.`),
  T("b2b-case-study", "Case Study", "Customer success story with business metrics.", "b2b", 60,
    `B2B case study format.\nScene 1 (0-6s): Company + problem intro\nScene 2 (7-18s): The challenge they faced\nScene 3 (19-32s): Implementation of solution\nScene 4 (33-48s): Results — specific metrics\nScene 5 (49-56s): Quote from decision maker\nScene 6 (57-60s): See how we can help you + CTA\nTone: Credible, specific.`),
  T("b2b-demo", "Product Demo Teaser", "Teases product capabilities to drive demo bookings.", "b2b", 30,
    `Demo teaser format.\nScene 1 (0-5s): "In 30 seconds, see what [product] can do"\nScene 2 (6-14s): Key capability 1 — quick demo\nScene 3 (15-22s): Key capability 2 — different use case\nScene 4 (23-27s): Integration and setup ease\nScene 5 (28-30s): Book a demo + CTA\nTone: Efficient, capability-focused.`),
  T("b2b-team", "Team Efficiency", "How product makes teams more productive.", "b2b", 30,
    `Team productivity ad.\nScene 1 (0-5s): "Your team is losing X hours/week to [problem]"\nScene 2 (6-14s): The workflow before product\nScene 3 (15-22s): The workflow with product\nScene 4 (23-27s): Time and cost saved\nScene 5 (28-30s): Try free for your team + CTA\nTone: Practical, business-focused.`),

  // APP / DIGITAL
  T("app-download", "App Download Push", "Drive app installs with clear value proposition.", "app", 15,
    `App install ad.\nScene 1 (0-3s): App icon reveal + one-line value prop\nScene 2 (4-9s): Key screen or feature in 5 seconds\nScene 3 (10-12s): "Download free" message\nScene 4 (13-15s): App store badge + CTA\nVisuals: Device mockup, clean UI.`),
  T("app-feature", "Feature Spotlight", "Highlights one killer app feature.", "app", 30,
    `Feature spotlight for app.\nScene 1 (0-5s): "The feature everyone is talking about"\nScene 2 (6-15s): Feature demonstrated on device\nScene 3 (16-24s): Real use case in action\nScene 4 (25-27s): User reaction or benefit\nScene 5 (28-30s): Download now + CTA\nVisuals: Clean screen recordings.`),
  T("app-onboarding", "Onboarding Journey", "Shows how easy it is to get started.", "app", 30,
    `Onboarding ease ad.\nScene 1 (0-4s): "You're 60 seconds from [result]"\nScene 2 (5-12s): Download + open — instant\nScene 3 (13-20s): Setup — simpler than expected\nScene 4 (21-26s): First win moment\nScene 5 (27-30s): Download free + CTA\nTone: Low friction, encouraging.`),
  T("app-social", "Social Features", "Showcases community or sharing features.", "app", 15,
    `Social features app ad.\nScene 1 (0-3s): "Everyone's using [app] for X"\nScene 2 (4-9s): Social feature in action\nScene 3 (10-12s): The connection moment\nScene 4 (13-15s): Join them + CTA\nTone: FOMO-driven, community.`),

  // MORE UGC VARIANTS
  T("ugc-vlog-style", "Vlog Style", "Raw, personal vlog format integrated with product.", "ugc", 60,
    `Vlog-style personal format.\nScene 1 (0-6s): "Hey guys, I need to tell you about something"\nScene 2 (7-20s): Personal context for product discovery\nScene 3 (21-35s): Using it in real life — raw footage\nScene 4 (36-50s): Honest opinion — good and bad\nScene 5 (51-57s): Final verdict\nScene 6 (58-60s): Link in bio + CTA\nTone: Zero polish, maximum trust.`),
  T("ugc-get-ready", "Get Ready With Me", "Creator uses product as part of GRWM routine.", "ugc", 60,
    `GRWM (Get Ready With Me) format.\nScene 1 (0-5s): "Get ready with me and I'll tell you about X"\nScene 2 (6-18s): Routine step 1 — product used\nScene 3 (19-32s): Routine step 2 — results forming\nScene 4 (33-48s): Final look/result\nScene 5 (49-56s): Product recommendation\nScene 6 (57-60s): Linked in bio + CTA\nTone: Casual, intimate.`),
  T("ugc-stitch-ready", "Stitch/Collab Ready", "Designed to invite stitches or duets from other creators.", "ugc", 15,
    `Stitch-bait format.\nScene 1 (0-4s): "I need someone to try this and report back"\nScene 2 (5-10s): Show the product briefly\nScene 3 (11-13s): The question/challenge\nScene 4 (14-15s): "Stitch me" + CTA\nTone: Community-inviting.`),
  T("ugc-late-night", "Late Night Scroll", "Targets late-night impulse buyer persona.", "ugc", 15,
    `Late-night scroll persona.\nScene 1 (0-3s): "It's 2am and I'm showing you this anyway"\nScene 2 (4-9s): The product that's worth staying up for\nScene 3 (10-12s): Offer with urgency\nScene 4 (13-15s): Add to cart before you sleep + CTA\nTone: Relatable, casual, amusing.`),
  T("ugc-relatable-fail", "Relatable Fail", "Shows a fail then product as the fix.", "ugc", 15,
    `Fail-to-fix format.\nScene 1 (0-3s): Relatable fail moment — funny/cringe\nScene 2 (4-8s): "This is why I now use X"\nScene 3 (9-12s): Product as the solution\nScene 4 (13-15s): Saved me + CTA\nTone: Self-deprecating, humor.`),
  T("ugc-aesthetic-lifestyle", "Aesthetic Lifestyle", "Aspirational lifestyle content with soft product integration.", "ugc", 30,
    `Aesthetic lifestyle format.\nScene 1 (0-6s): Aspirational scene — beautiful visuals\nScene 2 (7-16s): Day in the life — curated moments\nScene 3 (17-24s): Product as natural part of aesthetic\nScene 4 (25-27s): How to get this life\nScene 5 (28-30s): Product + CTA\nVisuals: Golden hour, warm tones, editorial.`),

  // MORE TESTIMONIAL
  T("test-long-user", "Long-time User", "Loyal customer shares multi-year experience.", "testimonial", 60,
    `Long-time loyalty testimonial.\nScene 1 (0-6s): "I've been using this for [X] years"\nScene 2 (7-20s): Why they started\nScene 3 (21-35s): How it evolved with them\nScene 4 (36-50s): What they'd miss if it disappeared\nScene 5 (51-57s): Why they recommend it\nScene 6 (58-60s): Join me + CTA\nTone: Deeply loyal, warm.`),
  T("test-parent-child", "Parent Recommendation", "Parent recommending product for family use.", "testimonial", 30,
    `Parent endorsement.\nScene 1 (0-5s): Parent context — the family challenge\nScene 2 (6-14s): How product helped their family\nScene 3 (15-22s): Child/family reaction\nScene 4 (23-27s): Peace of mind message\nScene 5 (28-30s): Every parent needs this + CTA\nTone: Warm, protective, trustworthy.`),
  T("test-professional", "Professional Use Case", "Professional uses product in their work.", "testimonial", 30,
    `Professional endorsement.\nScene 1 (0-5s): Professional context — their field\nScene 2 (6-14s): Problem they had at work\nScene 3 (15-22s): How product integrates into workflow\nScene 4 (23-27s): Professional outcome\nScene 5 (28-30s): I recommend to all colleagues + CTA\nTone: Credible, work-validated.`),

  // MORE PROMO
  T("promo-waitlist", "Waitlist/Pre-order", "Building anticipation for upcoming launch.", "promo", 15,
    `Waitlist building ad.\nScene 1 (0-3s): "Something big is coming"\nScene 2 (4-9s): Teaser of what it does\nScene 3 (10-12s): Early access benefit\nScene 4 (13-15s): Join waitlist + CTA\nTone: Mysterious, exclusive.`),
  T("promo-upsell", "Upsell Upgrade", "Existing customers shown premium version.", "promo", 30,
    `Upsell/upgrade ad.\nScene 1 (0-5s): "If you love [product], wait until you see [premium]"\nScene 2 (6-14s): What's different at premium level\nScene 3 (15-22s): The difference in results\nScene 4 (23-27s): Upgrade offer\nScene 5 (28-30s): Upgrade today + CTA\nTone: Exclusive, rewarding loyalty.`),
  T("promo-subscription", "Subscription Value", "Subscription model value vs one-time cost.", "promo", 30,
    `Subscription value proposition.\nScene 1 (0-5s): "Less than $X/day for [amazing thing]"\nScene 2 (6-14s): Daily value breakdown\nScene 3 (15-22s): What subscribers get\nScene 4 (23-27s): Cancel anytime reassurance\nScene 5 (28-30s): Start your subscription + CTA\nTone: Value-math, low friction.`),

  // MORE HOOKS
  T("hook-number-list", "Number List Hook", "Numbered list creates curiosity and structure.", "hook", 30,
    `Numbered list format.\nScene 1 (0-4s): "[X] reasons you need this"\nScene 2 (5-11s): Reason 1 — quick, visual\nScene 3 (12-18s): Reason 2 — different angle\nScene 4 (19-24s): Reason 3 — the clincher\nScene 5 (25-27s): All in one product\nScene 6 (28-30s): Get all [X] benefits + CTA\nVisuals: Number cards, punchy.`),
  T("hook-asmr", "ASMR / Satisfying", "Tactile, sound-first hook for sensory appeal.", "hook", 15,
    `ASMR sensory format.\nScene 1 (0-4s): Satisfying sound/visual — no dialogue\nScene 2 (5-9s): Product being used — sensory focus\nScene 3 (10-12s): Result/payoff\nScene 4 (13-15s): Get yours + CTA\nAudio: Product sounds prominent.`),
  T("hook-trending-audio", "Trending Audio Sync", "Synced to a trending sound or beat.", "hook", 15,
    `Trending audio format.\nScene 1 (0-2s): Audio hook — recognizable sound in\nScene 2 (3-8s): Product reveal synced to beat\nScene 3 (9-12s): Key benefit timed to audio\nScene 4 (13-15s): CTA at drop\nVisuals: Synced to beats/trends.`),
  T("hook-title-card", "Bold Title Card", "Opens with a bold text statement.", "hook", 30,
    `Bold title card opener.\nScene 1 (0-3s): Full-screen text — one provocative line\nScene 2 (4-12s): Visual proof of the statement\nScene 3 (13-22s): Product as the reason\nScene 4 (23-27s): Back up the claim\nScene 5 (28-30s): CTA\nVisuals: High contrast text, cinematic.`),

  // MORE APP
  T("app-testimonial", "App User Testimonial", "Real user sharing app results.", "app", 30,
    `App user testimonial.\nScene 1 (0-5s): User context + problem\nScene 2 (6-14s): Discovered the app\nScene 3 (15-22s): Screen recording of use\nScene 4 (23-27s): The result they got\nScene 5 (28-30s): Download free + CTA\nVisuals: Mix of face cam and screen.`),
  T("app-comparison", "App vs Manual Process", "Before: manual/painful. After: app.", "app", 30,
    `App vs manual comparison.\nScene 1 (0-5s): Manual process — painful, slow\nScene 2 (6-14s): Same task with app — instant\nScene 3 (15-22s): Time/effort saved\nScene 4 (23-27s): "Why would you do it the hard way?"\nScene 5 (28-30s): Download + CTA\nVisuals: Side-by-side or sequential.`),

  // MORE B2B
  T("b2b-problem-statement", "Pain Point First", "Opens with a business problem statement.", "b2b", 30,
    `B2B pain-first ad.\nScene 1 (0-5s): "If you're still doing [X] manually, read this"\nScene 2 (6-14s): The cost of the current approach\nScene 3 (15-22s): The better way\nScene 4 (23-27s): How quickly you can switch\nScene 5 (28-30s): Book a call + CTA\nTone: Direct, no-fluff.`),
  T("b2b-integration", "Integrations Showcase", "Highlights how product fits into existing stack.", "b2b", 30,
    `Integration-focused B2B ad.\nScene 1 (0-5s): "Works with everything you already use"\nScene 2 (6-14s): Integration icons/demo — Slack, Salesforce, etc.\nScene 3 (15-22s): Workflow in action with integrations\nScene 4 (23-27s): Setup time — "5 minutes"\nScene 5 (28-30s): Start free + CTA\nVisuals: Clean product UI, integration logos.`),

  // MORE STORY
  T("story-pivot", "The Pivot", "Company or product pivoted to solve real need.", "story", 60,
    `Pivot story format.\nScene 1 (0-7s): "We built something else — then customers showed us the real need"\nScene 2 (8-20s): Original plan\nScene 3 (21-34s): Customer feedback that changed everything\nScene 4 (35-48s): The pivot and rebuild\nScene 5 (49-56s): What customers say now\nScene 6 (57-60s): Built for you + CTA\nTone: Honest, responsive.`),
  T("story-community", "Community Story", "How a community formed around the product.", "story", 60,
    `Community narrative.\nScene 1 (0-7s): "We didn't expect this — but a community formed"\nScene 2 (8-20s): First few customers + their stories\nScene 3 (21-35s): How they connected with each other\nScene 4 (36-50s): What the community built together\nScene 5 (51-57s): "You belong here too"\nScene 6 (58-60s): Join us + CTA\nTone: Warm, belonging, inclusive.`),
];

const CATEGORIES: { value: Category; label: string; count?: number }[] = [
  { value: "all", label: "All" },
  { value: "ugc", label: "UGC" },
  { value: "testimonial", label: "Testimonial" },
  { value: "promo", label: "Promo" },
  { value: "tutorial", label: "Tutorial" },
  { value: "react", label: "React" },
  { value: "product", label: "Product" },
  { value: "story", label: "Story" },
  { value: "hook", label: "Hook" },
  { value: "seasonal", label: "Seasonal" },
  { value: "b2b", label: "B2B" },
  { value: "app", label: "App" },
];

const CAT_COLORS: Record<string, string> = {
  ugc: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  testimonial: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  promo: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  tutorial: "text-green-400 bg-green-400/10 border-green-400/30",
  react: "text-pink-400 bg-pink-400/10 border-pink-400/30",
  product: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
  story: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  hook: "text-red-400 bg-red-400/10 border-red-400/30",
  seasonal: "text-teal-400 bg-teal-400/10 border-teal-400/30",
  b2b: "text-indigo-400 bg-indigo-400/10 border-indigo-400/30",
  app: "text-lime-400 bg-lime-400/10 border-lime-400/30",
};

const TemplatesPage = () => {
  const { user, profile } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [activeDuration, setActiveDuration] = useState<Duration>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return TEMPLATES.filter((t) => {
      if (activeCategory !== "all" && t.category !== activeCategory) return false;
      if (activeDuration !== "all" && String(t.duration) !== activeDuration) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [activeCategory, activeDuration, search]);

  const handleUse = async (template: Template) => {
    setLoading(template.id);
    try {
      await supabase.from("template_usage" as never).insert({
        user_id: user.id,
        template_id: template.id,
        template_name: template.name,
      }).then(() => {});
    } catch {}
    navigate("/dashboard/boards/new", {
      state: {
        templatePrompt: template.prompt,
        templateName: template.name,
        templateDuration: template.duration,
      },
    });
    setLoading(null);
  };

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: TEMPLATES.length };
    TEMPLATES.forEach((t) => { counts[t.category] = (counts[t.category] || 0) + 1; });
    return counts;
  }, []);

  return (
    <div className="relative flex flex-col min-h-screen">
    <div className="p-6 max-w-7xl mx-auto space-y-6 flex-1">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="h-5 w-5 text-white/60" /> Templates
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {TEMPLATES.length} ready-to-use formats — click to pre-fill your board.
          </p>
        </div>
        <div className="text-xs text-muted-foreground font-mono mt-1">
          {filtered.length} shown
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-[#0a0a0a] border-[#222] text-white placeholder:text-muted-foreground"
        />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                activeCategory === cat.value
                  ? "bg-white text-black border-white"
                  : "border-[#333] text-muted-foreground hover:border-[#555] hover:text-white"
              }`}
            >
              {cat.label}
              <span className="ml-1.5 opacity-50">{catCounts[cat.value] || 0}</span>
            </button>
          ))}
        </div>

        {/* Duration filter */}
        <div className="flex gap-2">
          {[
            { value: "all" as Duration, label: "Any duration" },
            { value: "15" as Duration, label: "15s" },
            { value: "30" as Duration, label: "30s" },
            { value: "60" as Duration, label: "60s" },
          ].map((d) => (
            <button
              key={d.value}
              onClick={() => setActiveDuration(d.value)}
              className={`px-3 py-1 rounded border text-xs transition-all ${
                activeDuration === d.value
                  ? "border-white/40 text-white bg-white/10"
                  : "border-[#222] text-muted-foreground hover:border-[#444]"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No templates found. Try a different search or filter.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => (
            <Card
              key={template.id}
              className="group border-[#222] bg-[#0a0a0a] hover:border-[#444] transition-all duration-200 flex flex-col"
            >
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono font-semibold ${CAT_COLORS[template.category]}`}>
                    {template.category.toUpperCase()}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                    <Clock className="h-3 w-3" />{template.duration}s
                  </span>
                </div>
                <h3 className="font-semibold text-white mb-1.5 text-sm group-hover:text-white/80 transition-colors">
                  {template.name}
                </h3>
                <p className="text-xs text-muted-foreground mb-4 flex-1 leading-relaxed">
                  {template.description}
                </p>
                <Button
                  onClick={() => handleUse(template)}
                  disabled={loading === template.id}
                  className="w-full bg-white text-black hover:bg-white/90 text-xs h-9"
                >
                  {loading === template.id ? "Loading..." : (
                    <span className="flex items-center gap-1.5">Use template <ArrowRight className="h-3.5 w-3.5" /></span>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>

      {/* Sticky upgrade CTA */}
      {profile?.plan === "free" && (
        <div className="sticky bottom-0 z-20 px-6 pb-4 pt-2 pointer-events-none">
          <div className="pointer-events-auto relative rounded-2xl border border-white/[0.12] overflow-hidden backdrop-blur-xl bg-[#0a0a0a]/80 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-900/25 to-pink-900/20 pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3.5 justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">Unlock all 1000+ templates ⚡</p>
                <p className="text-xs text-white/35">Studio plan · 30 analyses · 30 boards · 5 videos/mo</p>
              </div>
              <button
                onClick={() => navigate("/pricing")}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-white/90 active:scale-95 transition-all"
              >
                Upgrade <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesPage;
