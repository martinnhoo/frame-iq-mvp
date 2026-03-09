import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Step definitions
const STEPS = [
  {
    id: "role",
    question: "What best describes you?",
    subtitle: "Helps us personalize your experience",
    type: "single",
    options: [
      { value: "creative_strategist", label: "Creative Strategist", emoji: "🎯" },
      { value: "media_buyer", label: "Media Buyer", emoji: "📊" },
      { value: "video_editor", label: "Video Editor / Producer", emoji: "🎬" },
      { value: "founder", label: "Founder / Brand Owner", emoji: "🚀" },
      { value: "agency", label: "Agency / Freelancer", emoji: "🏢" },
      { value: "other", label: "Other", emoji: "✨" },
    ],
  },
  {
    id: "industry",
    question: "What industry are you in?",
    subtitle: "We'll tailor templates and insights for your vertical",
    type: "single",
    options: [
      { value: "ecommerce", label: "E-commerce / DTC", emoji: "🛍️" },
      { value: "igaming", label: "iGaming / Betting", emoji: "🎰" },
      { value: "finance", label: "Finance / Fintech", emoji: "💰" },
      { value: "health", label: "Health & Wellness", emoji: "💊" },
      { value: "saas", label: "SaaS / Tech", emoji: "💻" },
      { value: "fashion", label: "Fashion / Beauty", emoji: "👗" },
      { value: "food", label: "Food & Beverage", emoji: "🍔" },
      { value: "other", label: "Other", emoji: "✨" },
    ],
  },
  {
    id: "markets",
    question: "Which markets do you run ads in?",
    subtitle: "Select all that apply",
    type: "multi",
    options: [
      { value: "BR", label: "Brazil", emoji: "🇧🇷" },
      { value: "MX", label: "Mexico", emoji: "🇲🇽" },
      { value: "US", label: "United States", emoji: "🇺🇸" },
      { value: "IN", label: "India", emoji: "🇮🇳" },
      { value: "GB", label: "United Kingdom", emoji: "🇬🇧" },
      { value: "ES", label: "Spain", emoji: "🇪🇸" },
      { value: "DE", label: "Germany", emoji: "🇩🇪" },
      { value: "GLOBAL", label: "Global / Multiple", emoji: "🌍" },
    ],
  },
  {
    id: "platforms",
    question: "Where do you run your ads?",
    subtitle: "Select all that apply",
    type: "multi",
    options: [
      { value: "meta", label: "Meta (FB/IG)", emoji: "📘" },
      { value: "tiktok", label: "TikTok", emoji: "🎵" },
      { value: "youtube", label: "YouTube", emoji: "▶️" },
      { value: "google", label: "Google", emoji: "🔍" },
      { value: "snapchat", label: "Snapchat", emoji: "👻" },
      { value: "programmatic", label: "Programmatic", emoji: "📡" },
    ],
  },
  {
    id: "volume",
    question: "How many ad creatives do you produce per month?",
    subtitle: "Approximate number across all campaigns",
    type: "single",
    options: [
      { value: "1_10", label: "1 – 10", emoji: "🌱" },
      { value: "10_50", label: "10 – 50", emoji: "📈" },
      { value: "50_200", label: "50 – 200", emoji: "⚡" },
      { value: "200_plus", label: "200+", emoji: "🔥" },
    ],
  },
  {
    id: "goal",
    question: "What's your main goal with FrameIQ?",
    subtitle: "We'll prioritize the right features for you",
    type: "single",
    options: [
      { value: "analyze_competitors", label: "Analyze competitor creatives", emoji: "🔍" },
      { value: "generate_boards", label: "Generate production boards faster", emoji: "⚡" },
      { value: "improve_hooks", label: "Improve hook scores & performance", emoji: "📊" },
      { value: "scale_production", label: "Scale creative production", emoji: "🚀" },
      { value: "translate_adapt", label: "Translate & adapt for markets", emoji: "🌍" },
      { value: "everything", label: "All of the above", emoji: "🎯" },
    ],
  },
];

type Answers = Record<string, string | string[]>;

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  const current = STEPS[step];
  const isMulti = current.type === "multi";
  const currentAnswer = answers[current.id];
  const selected = isMulti
    ? (currentAnswer as string[] || [])
    : (currentAnswer as string || "");

  const canAdvance = isMulti
    ? (selected as string[]).length > 0
    : !!selected;

  const toggleMulti = (value: string) => {
    const prev = (answers[current.id] as string[]) || [];
    const next = prev.includes(value)
      ? prev.filter(v => v !== value)
      : [...prev, value];
    setAnswers(a => ({ ...a, [current.id]: next }));
  };

  const selectSingle = (value: string) => {
    setAnswers(a => ({ ...a, [current.id]: value }));
    // Auto-advance on single select after brief delay
    setTimeout(() => {
      if (step < STEPS.length - 1) {
        setDirection("forward");
        setStep(s => s + 1);
      }
    }, 280);
  };

  const handleNext = () => {
    if (!canAdvance) return;
    if (step < STEPS.length - 1) {
      setDirection("forward");
      setStep(s => s + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step === 0) return;
    setDirection("back");
    setStep(s => s - 1);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }

      await supabase.from("profiles").update({
        onboarding_data: answers,
        onboarding_completed: true,
      } as never).eq("id", session.user.id);

      toast.success("All set! Welcome to FrameIQ 🎉");
      navigate("/dashboard");
    } catch {
      toast.error("Something went wrong, but you can continue.");
      navigate("/dashboard");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from("profiles")
        .update({ onboarding_completed: true } as never)
        .eq("id", session.user.id);
    }
    navigate("/dashboard");
  };

  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  const isLast = step === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-5">
        <Logo size="md" />
        <button
          onClick={handleSkip}
          className="text-xs text-white/25 hover:text-white/50 transition-colors"
        >
          Skip setup
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-white/[0.05]">
        <div
          className="h-full bg-white/30 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Step counter */}
          <p className="text-xs font-mono text-white/25 mb-6 text-center">
            {step + 1} / {STEPS.length}
          </p>

          {/* Question */}
          <h1 className="text-2xl sm:text-3xl font-bold text-white text-center mb-2">
            {current.question}
          </h1>
          <p className="text-white/35 text-sm text-center mb-8">
            {current.subtitle}
          </p>

          {/* Options */}
          <div className={`grid gap-2.5 ${
            current.options.length <= 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
          }`}>
            {current.options.map((opt) => {
              const isSelected = isMulti
                ? (selected as string[]).includes(opt.value)
                : selected === opt.value;

              return (
                <button
                  key={opt.value}
                  onClick={() => isMulti ? toggleMulti(opt.value) : selectSingle(opt.value)}
                  className={`relative flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all duration-150 ${
                    isSelected
                      ? "border-white/40 bg-white/10 text-white"
                      : "border-white/[0.08] bg-white/[0.02] text-white/50 hover:border-white/20 hover:bg-white/[0.05] hover:text-white/80"
                  }`}
                >
                  <span className="text-lg shrink-0">{opt.emoji}</span>
                  <span className="text-sm font-medium">{opt.label}</span>
                  {isSelected && (
                    <span className="ml-auto shrink-0">
                      <Check className="h-3.5 w-3.5 text-white/60" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Multi-select CTA */}
          {isMulti && (
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={handleBack}
                className="text-sm text-white/25 hover:text-white/50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                disabled={!canAdvance}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {isLast ? (
                  saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Finish setup"
                ) : (
                  <>Continue <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          )}

          {/* Single select back button */}
          {!isMulti && step > 0 && (
            <div className="mt-5 text-center">
              <button
                onClick={handleBack}
                className="text-sm text-white/20 hover:text-white/40 transition-colors"
              >
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
