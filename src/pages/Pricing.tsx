import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Shield, HelpCircle, X, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Stripe product/price mapping
const PLANS = {
  maker:  { product_id: "prod_U88ul5IK0HHW19", price_id: "price_1T9sd1Dr9So14XztT3Mqddch" },
  pro:    { product_id: "prod_U88v5WVcy2NZV7", price_id: "price_1T9sdfDr9So14XztPR3tI14Y" },
  studio: { product_id: "prod_U88wpX4Bphfifi", price_id: "price_1T9seMDr9So14Xzt0vEJNQIX" },
};

const Pricing = () => {
  const navigate = useNavigate();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [annual, setAnnual] = useState(false);

  const monthlyPrices = { maker: 19, pro: 49, studio: 149 };
  const prices = annual
    ? { maker: 15, pro: 39, studio: 119 }
    : monthlyPrices;

  const handleUpgrade = async (planKey: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate(`/signup?plan=${planKey}${annual ? "&billing=annual" : ""}`);
      return;
    }

    const plan = PLANS[planKey as keyof typeof PLANS];
    if (!plan) return;

    setUpgrading(planKey);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { price_id: plan.price_id, billing: annual ? "annual" : undefined }
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
      name: "Maker",
      price: `$${prices.maker}`,
      period: annual ? "/mo (billed annually)" : "/mo",
      description: "For freelancers and solo buyers.",
      features: [
        { text: "50 AI messages / day", included: true },
        { text: "1 ad account connected", included: true },
        { text: "All tools unlocked", included: true },
        { text: "Hook Generator", included: true },
        { text: "Script & Brief generator", included: true },
        { text: "3 personas", included: true },
        { text: "Multi-account", included: false },
      ],
      cta: "Start free trial",
      ctaAction: () => handleUpgrade("maker"),
      highlighted: false,
    },
    {
      name: "Pro",
      price: `$${prices.pro}`,
      period: annual ? "/mo (billed annually)" : "/mo",
      description: "For small agencies and performance teams.",
      features: [
        { text: "200 AI messages / day", included: true },
        { text: "3 ad accounts connected", included: true },
        { text: "All tools unlocked", included: true },
        { text: "Hook Generator", included: true },
        { text: "Script & Brief generator", included: true },
        { text: "Unlimited personas", included: true },
        { text: "Multi-market support", included: true },
      ],
      cta: "Start free trial",
      ctaAction: () => handleUpgrade("pro"),
      highlighted: true,
      badge: "Most Popular",
    },
    {
      name: "Studio",
      price: `$${prices.studio}`,
      period: annual ? "/mo (billed annually)" : "/mo",
      description: "For agencies managing multiple clients.",
      features: [
        { text: "Unlimited AI messages", included: true },
        { text: "Unlimited ad accounts", included: true },
        { text: "All tools unlocked", included: true },
        { text: "Hook Generator", included: true },
        { text: "Script & Brief generator", included: true },
        { text: "Unlimited personas", included: true },
        { text: "Agency workspace", included: true },
      ],
      cta: "Start free trial",
      ctaAction: () => handleUpgrade("studio"),
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
      a: "Yes. All paid plans come with a 1-day free trial. No charge until the trial ends. Cancel anytime.",
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
              1-day free trial on all plans. Card required. Cancel anytime before 24h and pay nothing.
            </p>

            {/* Annual/Monthly Toggle */}
            <div className="flex items-center justify-center gap-3 mt-6">
              <span className={`text-sm font-medium transition-colors ${!annual ? "text-white" : "text-white/40"}`}>Monthly</span>
              <button
                onClick={() => setAnnual(v => !v)}
                className="relative w-11 h-6 rounded-full transition-colors"
                style={{ background: annual ? "linear-gradient(135deg, #0ea5e9, #06b6d4)" : "rgba(255,255,255,0.15)" }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                  style={{ left: annual ? "22px" : "2px" }}
                />
              </button>
              <span className={`text-sm font-medium transition-colors ${annual ? "text-white" : "text-white/40"}`}>Annual</span>
              {annual && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-md"
                  style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
                  Save 20%
                </span>
              )}
            </div>
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
                      ? "border-sky-500/50 shadow-xl shadow-sky-500/15 md:scale-105 bg-card"
                      : "border-border bg-card hover:-translate-y-1"
                  }`}
                  style={plan.highlighted ? {
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(236, 72, 153, 0.04))',
                  } : {}}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white border-0">
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
                          ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-700 hover:to-cyan-700 border-0"
                          : "bg-card text-foreground hover:bg-muted border border-border"
                      }`}
                      onClick={plan.ctaAction}
                      disabled={upgrading !== null}
                    >
                      {upgrading === plan.name.toLowerCase() && (
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
                className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white border-0"
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
              Prices shown in USD. All paid plans include a 1-day free trial. Annual plans billed as one payment.
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

    </div>
  );
};

export default Pricing;
