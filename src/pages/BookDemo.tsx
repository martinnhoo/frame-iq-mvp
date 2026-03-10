import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { toast } from "@/hooks/use-toast";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const questions = [
  {
    id: "name",
    title: "Let's start with your details",
    subtitle: "So we can personalize your demo experience",
    type: "contact" as const,
  },
  {
    id: "company_size",
    title: "How large is your team?",
    subtitle: "This helps us recommend the right plan",
    type: "radio" as const,
    options: [
      { value: "1-5", label: "1–5 people", description: "Startup / solo brand" },
      { value: "6-20", label: "6–20 people", description: "Growing team" },
      { value: "21-50", label: "21–50 people", description: "Mid-market" },
      { value: "50+", label: "50+ people", description: "Enterprise" },
    ],
  },
  {
    id: "monthly_ad_spend",
    title: "What's your monthly ad spend?",
    subtitle: "Helps us estimate your potential ROI with FrameIQ",
    type: "radio" as const,
    options: [
      { value: "under-5k", label: "Under $5K", description: "Just getting started" },
      { value: "5k-25k", label: "$5K – $25K", description: "Scaling phase" },
      { value: "25k-100k", label: "$25K – $100K", description: "Growth stage" },
      { value: "100k+", label: "$100K+", description: "Enterprise scale" },
    ],
  },
  {
    id: "creative_volume",
    title: "How many ad creatives do you produce per month?",
    subtitle: "We'll show you how FrameIQ can multiply your output",
    type: "radio" as const,
    options: [
      { value: "1-10", label: "1–10 creatives", description: "Low volume" },
      { value: "11-50", label: "11–50 creatives", description: "Medium volume" },
      { value: "51-200", label: "51–200 creatives", description: "High volume" },
      { value: "200+", label: "200+ creatives", description: "Very high volume" },
    ],
  },
  {
    id: "main_challenge",
    title: "What's your biggest creative challenge?",
    subtitle: "We'll tailor the demo to solve your specific pain points",
    type: "radio" as const,
    options: [
      { value: "speed", label: "Speed to market", description: "Need creatives faster" },
      { value: "cost", label: "Reducing costs", description: "Spending too much on agencies/freelancers" },
      { value: "testing", label: "Testing at scale", description: "Can't test enough variations" },
      { value: "insights", label: "Competitor insights", description: "Don't know what's working in the market" },
    ],
  },
];

const BookDemo = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [contactInfo, setContactInfo] = useState({ name: "", email: "", company: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState("");

  const currentQuestion = questions[step];
  const totalSteps = questions.length;
  const progress = ((step + 1) / totalSteps) * 100;

  const canProceed = () => {
    if (currentQuestion.type === "contact") {
      const validEmail = EMAIL_REGEX.test(contactInfo.email);
      return contactInfo.name.trim() && validEmail && contactInfo.company.trim();
    }
    return !!answers[currentQuestion.id];
  };

  const handleEmailChange = (value: string) => {
    setContactInfo({ ...contactInfo, email: value });
    if (value && !EMAIL_REGEX.test(value)) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError("");
    }
  };

  const handleNext = async () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      setSubmitting(true);
      try {
        const { error } = await supabase.from("demo_requests").insert({
          name: contactInfo.name.trim(),
          email: contactInfo.email.trim(),
          company: contactInfo.company.trim(),
          company_size: answers.company_size || null,
          monthly_ad_spend: answers.monthly_ad_spend || null,
          creative_volume: answers.creative_volume || null,
          main_challenge: answers.main_challenge || null,
        });
        if (error) throw error;
        setSubmitted(true);
      } catch {
        toast({
          title: "Something went wrong",
          description: "Please try again or contact us directly.",
          variant: "destructive",
        });
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-lg"
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}
          >
            <Check className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-4">You're all set!</h1>
          <p className="text-secondary text-lg mb-2">
            Thanks, {contactInfo.name}. We'll reach out within 24 hours to schedule your personalized demo.
          </p>
          <p className="text-muted-foreground text-sm mb-8">
            Check your inbox at {contactInfo.email}
          </p>
          <Button
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0"
            onClick={() => navigate("/")}
          >
            Back to home
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/">
            <Logo size="lg" />
          </Link>
          <span className="text-sm text-muted-foreground">Step {step + 1} of {totalSteps}</span>
        </div>
      </nav>

      <div className="fixed top-[65px] left-0 right-0 z-50 h-1 bg-border/30">
        <motion.div
          className="h-full"
          style={{ background: 'linear-gradient(90deg, #8b5cf6, #ec4899)' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <section className="pt-32 pb-16 px-6 flex items-center justify-center min-h-screen">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-3">{currentQuestion.title}</h1>
                <p className="text-secondary">{currentQuestion.subtitle}</p>
              </div>

              {currentQuestion.type === "contact" ? (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <Label htmlFor="name">Full name</Label>
                      <Input
                        id="name"
                        placeholder="John Smith"
                        value={contactInfo.name}
                        onChange={(e) => setContactInfo({ ...contactInfo, name: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Work email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@company.com"
                        value={contactInfo.email}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        className={`mt-1.5 ${emailError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      />
                      {emailError && (
                        <p className="text-sm text-destructive mt-1">{emailError}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="company">Company name</Label>
                      <Input
                        id="company"
                        placeholder="Acme Inc."
                        value={contactInfo.company}
                        onChange={(e) => setContactInfo({ ...contactInfo, company: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <RadioGroup
                  value={answers[currentQuestion.id] || ""}
                  onValueChange={(val) => setAnswers({ ...answers, [currentQuestion.id]: val })}
                  className="space-y-3"
                >
                  {currentQuestion.options?.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                        answers[currentQuestion.id] === option.value
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border/50 bg-card/50 hover:border-primary/20'
                      }`}
                    >
                      <RadioGroupItem value={option.value} />
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-muted-foreground">{option.description}</div>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              )}

              <div className="flex items-center justify-between mt-8">
                <Button
                  variant="ghost"
                  onClick={() => step > 0 ? setStep(step - 1) : navigate("/")}
                  className="text-secondary"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {step === 0 ? "Home" : "Back"}
                </Button>
                <Button
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 px-8"
                  disabled={!canProceed() || submitting}
                  onClick={handleNext}
                >
                  {submitting ? "Submitting..." : step === totalSteps - 1 ? "Submit" : "Continue"}
                  {!submitting && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
};

export default BookDemo;
