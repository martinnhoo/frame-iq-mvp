import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Shield, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";

const Pricing = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "/mo",
      description: "For individuals exploring FrameIQ's capabilities.",
      features: [
        "3 video analyses per month",
        "3 board generations per month",
        "1 team seat",
        "Community support",
        "Basic export (PDF)",
      ],
      cta: "Get started free",
      ctaAction: () => navigate("/signup"),
      highlighted: false,
    },
    {
      name: "Studio",
      price: "$49",
      period: "/mo",
      description: "For growing creative teams that need speed and scale.",
      features: [
        "30 video analyses per month",
        "30 board generations per month",
        "5 AI-generated videos per month",
        "Auto translation (all languages)",
        "1 team seat",
        "Priority email support",
        "Export to Notion, PDF, CSV",
        "Creative Intelligence dashboard",
      ],
      cta: "Start 14-day free trial",
      ctaAction: () => navigate("/signup"),
      highlighted: true,
      badge: "Most Popular",
    },
    {
      name: "Scale",
      price: "$399",
      period: "/mo",
      description: "For agencies and enterprise teams at scale.",
      features: [
        "500 video analyses per month",
        "300 board generations per month",
        "50 AI-generated videos per month",
        "Auto translation (all languages)",
        "Up to 10 team seats",
        "REST API access",
        "Custom integrations",
        "Dedicated Customer Success Manager",
        "SSO & advanced security",
        "SLA guarantee",
      ],
      cta: "Book a demo",
      ctaAction: () => navigate("/book-demo"),
      highlighted: false,
    },
  ];

  const faqs = [
    {
      q: "Can I cancel anytime?",
      a: "Yes. All plans are month-to-month with no long-term contracts. You can cancel or downgrade anytime from your account settings. Your access continues until the end of the billing period.",
    },
    {
      q: "What happens when I exceed my plan limits?",
      a: "You'll receive a notification when approaching your limits. You can upgrade at any time. We never cut access mid-project — you'll always finish what you started.",
    },
    {
      q: "Is there a free trial for paid plans?",
      a: "Yes. Studio comes with a 14-day free trial. No credit card required to start. Scale plans include a personalized demo and trial period.",
    },
    {
      q: "How does billing work?",
      a: "We bill monthly via credit card (Visa, Mastercard, Amex). Invoices are available in your account. For annual billing or custom invoicing, contact our sales team.",
    },
    {
      q: "Do you offer refunds?",
      a: "We offer a 30-day money-back guarantee on your first payment for Studio plans. If you're not satisfied, contact support for a full refund.",
    },
    {
      q: "Is my data secure?",
      a: "Yes. FrameIQ is SOC 2 compliant with 256-bit encryption at rest and in transit. We never share or sell your data. See our Privacy Policy for details.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="text-2xl font-bold flex items-center">
            <span className="text-foreground font-medium">Frame</span>
            <span className="gradient-text font-black">IQ</span>
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
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card
                  className={`relative h-full flex flex-col ${
                    plan.highlighted
                      ? "border-primary/50 shadow-lg shadow-primary/10"
                      : "border-border"
                  } bg-card`}
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
                          <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{feature}</span>
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
                    >
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
              SOC 2 Compliant
            </span>
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

      {/* Legal footer */}
      <footer className="border-t border-border/50 py-8 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-xs text-muted-foreground/60 leading-relaxed text-center space-y-2">
            <p>
              Prices shown in USD. All plans are billed monthly unless otherwise specified. Sales tax may apply depending on your jurisdiction. 
              Studio plan includes a 14-day free trial; you will not be charged until the trial ends. 
              You may cancel at any time before the trial expires to avoid charges.
            </p>
            <p>
              30-day money-back guarantee applies to first-time Studio subscribers only. 
              Refund requests must be submitted within 30 days of the initial charge. 
              Scale plan pricing and terms are customized per agreement.
            </p>
            <p className="pt-2">
              © 2026 FrameIQ, Inc. All rights reserved. FrameIQ is a registered trademark.
              {" · "}
              <Link to="/" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              {" · "}
              <Link to="/" className="hover:text-foreground transition-colors">Terms of Service</Link>
              {" · "}
              <Link to="/" className="hover:text-foreground transition-colors">Cookie Policy</Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
