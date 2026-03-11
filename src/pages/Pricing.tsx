import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Shield, HelpCircle, X, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Stripe product/price mapping
const PLANS = {
  creator: { product_id: "prod_U88gF48nQTStB2", price_id: "price_1T9sPXDr9So14XztRB4YmLHl" },
  studio:  { product_id: "prod_U88hsSpnApR9Gt", price_id: "price_1T9sQ3Dr9So14XztEgFfLh6x" },
  scale:   { product_id: "prod_U88hnL1CuEMnfo", price_id: "price_1T9sQTDr9So14Xzta4ARSzhl" },
};

const Pricing = () => {
  const navigate = useNavigate();
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const handleUpgrade = async (planKey: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/signup");
      return;
    }

    if (planKey === "scale") {
      navigate("/book-demo");
      return;
    }

    const plan = PLANS[planKey as keyof typeof PLANS];
    if (!plan) return;

    setUpgrading(planKey);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { price_id: plan.price_id }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Could not create checkout session");
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
      console.error("Checkout error:", err);
    } finally {
      setUpgrading(null);
    }
  };

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "/mo",
      description: "Try before you commit. No credit card.",
      features: [
        { text: "3 video analyses", included: true },
        { text: "3 board generations", included: true },
        { text: "3 translations", included: true },
        { text: "2 pre-flight checks", included: true },
        { text: "Templates access", included: true },
        { text: "Hook Generator", included: false },
        { text: "Brand Kit", included: false },
        { text: "AI Intelligence", included: false },
      ],
      cta: "Get started free",
      ctaAction: () => navigate("/signup"),
      highlighted: false,
    },
    {
      name: "Creator",
      price: "$9",
      period: "/mo",
      description: "For creators and influencers growing their content.",
      features: [
        { text: "3 video analyses", included: true },
        { text: "1 board per month", included: true },
        { text: "10 scripts per month", included: true },
        { text: "10 translations per month", included: true },
        { text: "5 pre-flight checks", included: true },
        { text: "Templates access", included: true },
        { text: "Hook Benchmark", included: true },
        { text: "AI Intelligence", included: false },
      ],
      cta: "Start Creator",
      ctaAction: () => handleUpgrade("creator"),
      highlighted: false,
    },
    {
      name: "Studio",
      price: "$49",
      period: "/mo",
      description: "For performance teams running ads at scale.",
      features: [
        { text: "30 video analyses", included: true },
        { text: "30 board generations", included: true },
        { text: "100 translations", included: true },
        { text: "30 pre-flight checks", included: true },
        { text: "Unlimited hooks & translations", included: true },
        { text: "Brand Kit", included: true },
        { text: "AI Intelligence + learning", included: true },
        { text: "2 team seats", included: true },
      ],
      cta: "Start Studio",
      ctaAction: () => handleUpgrade("studio"),
      highlighted: true,
      badge: "Most Popular",
    },
    {
      name: "Scale",
      price: "$499",
      period: "/mo",
      description: "For agencies and enterprise teams.",
      features: [
        { text: "500 video analyses", included: true },
        { text: "300 board generations", included: true },
        { text: "Unlimited translations", included: true },
        { text: "Unlimited pre-flight checks", included: true },
        { text: "Unlimited pre-flights & scripts", included: true },
        { text: "Meta Ads Connect", included: true },
        { text: "10 team seats", included: true },
        { text: "API access + White Label", included: true },
      ],
      cta: "Book a demo",
      ctaAction: () => handleUpgrade("scale"),
      highlighted: false,
    },
  ];

  const faqs = [
    {
      q: "Can I cancel anytime?",
      a: "Yes. All plans are month-to-month with no long-term contracts. You can cancel or downgrade anytime from your account settings.",
    },
    {
      q: "What happens when I exceed my plan limits?",
      a: "You'll receive a notification when approaching your limits. You can upgrade at any time. We never cut access mid-project.",
    },
    {
      q: "Is there a free trial for paid plans?",
      a: "Yes. Studio comes with a 14-day free trial. No credit card required. Scale plans include a personalized demo and trial period.",
    },
    {
      q: "How does billing work?",
      a: "We bill monthly via credit card (Visa, Mastercard, Amex). For annual billing or custom invoicing, contact our sales team.",
    },
    {
      q: "Do you offer refunds?",
      a: "We offer a 30-day money-back guarantee on your first payment for Studio plans.",
    },
    {
      q: "Is my data secure?",
      a: "Yes. AdBrief uses 256-bit encryption at rest and in transit. We never share or sell your data.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/">
            <Logo size="lg" />
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" className="text-muted-foreground" onClick={() => navigate("/login")}>
              Sign in
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-5xl text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Start free. Scale when you're ready. No hidden fees, no surprises.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-20 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card
                  className={`relative h-full flex flex-col transition-all duration-300 ${
                    plan.highlighted
                      ? "border-purple-500/50 shadow-xl shadow-purple-500/15 md:scale-105 bg-card"
                      : "border-border bg-card hover:-translate-y-1"
                  }`}
                  style={plan.highlighted ? {
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(236, 72, 153, 0.04))',
                  } : {}}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
                        {plan.badge}
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-4 pt-8">
                    <CardTitle className="text-lg text-muted-foreground font-normal mb-2">
                      {plan.name}
                    </CardTitle>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold text-foreground">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-3 flex-1">
                      {plan.features.map((feature, j) => (
                        <li key={j} className="flex items-start gap-3 text-sm">
                          {feature.included ? (
                            <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          ) : (
                            <X className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                          )}
                          <span className={feature.included ? "text-muted-foreground" : "text-muted-foreground/40"}>
                            {feature.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full mt-6 ${
                        plan.highlighted
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 border-0"
                          : "bg-card text-foreground hover:bg-muted border border-border"
                      }`}
                      onClick={plan.ctaAction}
                      disabled={upgrading}
                    >
                      {upgrading && plan.name === "Studio" && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {plan.cta}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="py-12 px-6 border-t border-border/30">
        <div className="container mx-auto max-w-3xl">
          <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-500" />
              256-bit Encryption
            </span>
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-500" />
              GDPR Ready
            </span>
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-500" />
              99.9% Uptime SLA
            </span>
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-500" />
              30-day money-back
            </span>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-6 border-t border-border/30">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <div key={i} className="border-b border-border/30 pb-6 last:border-0">
                <h3 className="font-semibold text-foreground flex items-start gap-2 mb-2">
                  <HelpCircle className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  {faq.q}
                </h3>
                <p className="text-sm text-muted-foreground pl-6 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6">
        <div className="container mx-auto max-w-3xl text-center">
          <div
            className="p-10 rounded-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(236, 72, 153, 0.1))",
              border: "1px solid rgba(139, 92, 246, 0.2)",
            }}
          >
            <h2 className="text-2xl font-bold mb-3">Still have questions?</h2>
            <p className="text-muted-foreground mb-6">
              Talk to our team. We'll help you find the right plan for your needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0"
                onClick={() => navigate("/book-demo")}
              >
                Book a demo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                variant="outline"
                className="border-border"
                onClick={() => navigate("/contact")}
              >
                Contact sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-xs text-muted-foreground/60 leading-relaxed text-center space-y-2">
            <p>
              Prices shown in USD. All plans are billed monthly. Studio plan includes a 14-day free trial.
              You may cancel at any time before the trial expires.
            </p>
            <p className="pt-2">
              © 2026 AdBrief. All rights reserved.
              {" · "}
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              {" · "}
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
              {" · "}
              <Link to="/refund" className="hover:text-foreground transition-colors">Refund Policy</Link>
            </p>
          </div>
        </div>
      </footer>

      {/* Upgrade Modal */}
      <Dialog open={upgradeModal !== null} onOpenChange={() => setUpgradeModal(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Payment coming soon</DialogTitle>
            <DialogDescription className="text-muted-foreground pt-2 leading-relaxed">
              The Studio plan is currently in preview. You'll be notified when full payment processing launches.
              In the meantime, your plan has been updated to Studio with all features unlocked.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0"
              onClick={() => {
                setUpgradeModal(null);
                navigate("/dashboard");
              }}
            >
              Go to Dashboard
            </Button>
            <Button
              variant="outline"
              className="border-border"
              onClick={() => setUpgradeModal(null)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pricing;
