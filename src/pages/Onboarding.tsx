import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ArrowRight, Check, Loader2, ChevronRight, Zap } from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "name" | "language" | "source" | "feature" | "plan";

interface OnboardingState {
  name: string;
  acceptedTerms: boolean;
  marketingEmails: boolean;
  language: string;
  source: string;
  sourceOther: string;
  feature: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { value: "en", label: "English",   flag: "🇺🇸" },
  { value: "pt", label: "Português", flag: "🇧🇷" },
  { value: "es", label: "Español",   flag: "🇪🇸" },
  { value: "hi", label: "Hindi",     flag: "🇮🇳" },
  { value: "fr", label: "Français",  flag: "🇫🇷" },
  { value: "de", label: "Deutsch",   flag: "🇩🇪" },
];

const SOURCES = [
  { value: "twitter",    label: "Twitter / X",      emoji: "𝕏" },
  { value: "youtube",    label: "YouTube",           emoji: "▶️" },
  { value: "tiktok",     label: "TikTok",            emoji: "🎵" },
  { value: "friend",     label: "Friend / Colleague",emoji: "👋" },
  { value: "linkedin",   label: "LinkedIn",          emoji: "💼" },
  { value: "google",     label: "Google Search",     emoji: "🔍" },
  { value: "newsletter", label: "Newsletter",        emoji: "📧" },
  { value: "other",      label: "Other",             emoji: "✨" },
];

const FEATURES = [
  { value: "analyze",      url: "/dashboard/analyses/new", emoji: "🔍", label: "Analyze competitor ads",          desc: "Upload a video and get AI hook scores, transcripts, and creative insights", accent: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)" },
  { value: "board",        url: "/dashboard/boards/new",   emoji: "🎬", label: "Generate a production board",     desc: "Turn a brief into a full scene-by-scene board with VO scripts and editor notes", accent: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.2)" },
  { value: "templates",    url: "/dashboard/templates",    emoji: "📋", label: "Browse 183 ad templates",         desc: "Start from proven formats — UGC, testimonial, promo, tutorial, and 17 more", accent: "#f472b6", bg: "rgba(244,114,182,0.08)", border: "rgba(244,114,182,0.2)" },
  { value: "translate",    url: "/dashboard/translate",    emoji: "🌍", label: "Translate & localize scripts",    desc: "Adapt your ad scripts for any market with AI-powered cultural localization", accent: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" },
  { value: "preflight",    url: "/dashboard/preflight",    emoji: "✅", label: "Pre-flight check my creative",    desc: "Review your ad against platform policies before spending a single dollar", accent: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)" },
  { value: "intelligence", url: "/dashboard/intelligence", emoji: "🧠", label: "Explore creative intelligence",   desc: "See what patterns actually work — backed by your own performance data", accent: "#c084fc", bg: "rgba(192,132,252,0.08)", border: "rgba(192,132,252,0.2)" },
];

const PLANS = [
  { key: "creator", label: "Creator", price: "$9",   period: "/mo", features: ["3 analyses/mo", "1 board/mo", "10 pre-flights"],                               highlight: false },
  { key: "studio",  label: "Studio",  price: "$49",  period: "/mo", features: ["30 analyses/mo", "30 boards/mo", "Unlimited hooks & scripts", "30 pre-flights"],             highlight: true,  badge: "Most popular" },
  { key: "scale",   label: "Scale",   price: "$499", period: "/mo", features: ["500 analyses/mo", "300 boards/mo", "Unlimited everything", "Unlimited pre-flights"],  highlight: false },
];

const STEP_ORDER: Step[] = ["name", "language", "source", "feature", "plan"];

// ── Component ──────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("name");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<OnboardingState>({
    name: "", acceptedTerms: false, marketingEmails: false,
    language: "", source: "", sourceOther: "", feature: "",
  });

  useEffect(() => { if (step === "name") nameRef.current?.focus(); }, [step]);

  const stepIdx = STEP_ORDER.indexOf(step);
  const pct = Math.round(((stepIdx + 1) / STEP_ORDER.length) * 100);
  const set = <K extends keyof OnboardingState>(k: K, v: OnboardingState[K]) =>
    setState(s => ({ ...s, [k]: v }));
  const goNext = () => { const i = STEP_ORDER.indexOf(step); if (i < STEP_ORDER.length - 1) setStep(STEP_ORDER[i + 1]); };
  const goBack = () => { const i = STEP_ORDER.indexOf(step); if (i > 0) setStep(STEP_ORDER[i - 1]); };

  const finish = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      const feat = FEATURES.find(f => f.value === state.feature);
      await supabase.from("profiles").update({
        name: state.name || undefined,
        preferred_language: state.language || undefined,
        onboarding_completed: true,
        onboarding_data: {
          source: state.source, sourceOther: state.sourceOther,
          feature: state.feature, marketingEmails: state.marketingEmails,
          completedAt: new Date().toISOString(),
        },
      } as never).eq("id", session.user.id);
      toast.success("Welcome to AdBrief 🚀");
      navigate(feat?.url || "/dashboard");
    } catch {
      toast.error("Something went wrong. Continuing anyway.");
      navigate("/dashboard");
    } finally { setSaving(false); }
  };

  const skip = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await supabase.from("profiles").update({ onboarding_completed: true } as never).eq("id", session.user.id);
    } catch {}
    navigate("/dashboard");
  };

  const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
  const mono = { fontFamily: "'DM Mono', monospace" } as const;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#060606", fontFamily: "'Outfit', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-5">
        <Logo size="md" />
        <button onClick={skip} className="text-[11px] text-white/15 hover:text-white/35 transition-colors" style={mono}>
          skip setup
        </button>
      </div>

      {/* Progress */}
      <div className="h-px bg-white/[0.05] mx-6 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #a78bfa, #f472b6)" }} />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">

          {/* ── Step 1: Name + Terms ── */}
          {step === "name" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-[11px] text-white/20 uppercase tracking-[0.15em]" style={mono}>Step 1 of {STEP_ORDER.length}</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ ...syne, letterSpacing: "-0.03em" }}>Let's get you set up</h1>
                <p className="text-sm text-white/35">Takes less than 2 minutes. You can skip any step.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-white/30 mb-2">Your name <span className="text-white/15">(optional)</span></label>
                  <input ref={nameRef} type="text" value={state.name} onChange={e => set("name", e.target.value)}
                    onKeyDown={e => e.key === "Enter" && goNext()} placeholder="e.g. Alex"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/20 text-sm outline-none focus:border-white/20 transition-colors" />
                </div>
                {/* Terms */}
                <label className="flex items-start gap-3 cursor-pointer group" onClick={() => set("acceptedTerms", !state.acceptedTerms)}>
                  <div className={`h-5 w-5 rounded-md border flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${state.acceptedTerms ? "bg-white border-white" : "border-white/15 bg-white/[0.04] group-hover:border-white/30"}`}>
                    {state.acceptedTerms && <Check className="h-3 w-3 text-black" />}
                  </div>
                  <span className="text-xs text-white/40 leading-relaxed">
                    I agree to the <a href="/terms" target="_blank" className="text-white/60 underline underline-offset-2 hover:text-white" onClick={e => e.stopPropagation()}>Terms</a> and <a href="/privacy" target="_blank" className="text-white/60 underline underline-offset-2 hover:text-white" onClick={e => e.stopPropagation()}>Privacy Policy</a>
                  </span>
                </label>
                {/* Marketing */}
                <label className="flex items-start gap-3 cursor-pointer group" onClick={() => set("marketingEmails", !state.marketingEmails)}>
                  <div className={`h-5 w-5 rounded-md border flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${state.marketingEmails ? "bg-white border-white" : "border-white/15 bg-white/[0.04] group-hover:border-white/30"}`}>
                    {state.marketingEmails && <Check className="h-3 w-3 text-black" />}
                  </div>
                  <span className="text-xs text-white/40 leading-relaxed">
                    Send me product updates, tips, and creative strategy content <span className="text-white/20">(optional)</span>
                  </span>
                </label>
              </div>
              <button onClick={goNext} disabled={!state.acceptedTerms}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                style={syne}>
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── Step 2: Language ── */}
          {step === "language" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-[11px] text-white/20 uppercase tracking-[0.15em]" style={mono}>Step 2 of {STEP_ORDER.length}</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ ...syne, letterSpacing: "-0.03em" }}>Preferred language?</h1>
                <p className="text-sm text-white/35">For AI outputs — scripts, voiceovers, analysis reports</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGES.map(lang => {
                  const active = state.language === lang.value;
                  return (
                    <button key={lang.value} onClick={() => { set("language", lang.value); setTimeout(goNext, 220); }}
                      className="flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all duration-150"
                      style={{ borderColor: active ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.07)", background: active ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.02)" }}>
                      <span className="text-xl">{lang.flag}</span>
                      <span className={`text-sm font-medium flex-1 ${active ? "text-white" : "text-white/50"}`}>{lang.label}</span>
                      {active && <Check className="h-3.5 w-3.5 text-purple-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between">
                <button onClick={goBack} className="text-sm text-white/20 hover:text-white/45 transition-colors">← Back</button>
                <button onClick={goNext} className="flex items-center gap-1 text-sm text-white/25 hover:text-white/50 transition-colors">Skip <ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {/* ── Step 3: Source ── */}
          {step === "source" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-[11px] text-white/20 uppercase tracking-[0.15em]" style={mono}>Step 3 of {STEP_ORDER.length}</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ ...syne, letterSpacing: "-0.03em" }}>How did you find us?</h1>
                <p className="text-sm text-white/35">Helps us focus our energy in the right places</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SOURCES.map(src => {
                  const active = state.source === src.value;
                  return (
                    <button key={src.value} onClick={() => { set("source", src.value); if (src.value !== "other") setTimeout(goNext, 220); }}
                      className="flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all duration-150"
                      style={{ borderColor: active ? "rgba(244,114,182,0.45)" : "rgba(255,255,255,0.07)", background: active ? "rgba(244,114,182,0.08)" : "rgba(255,255,255,0.02)" }}>
                      <span className="text-base w-5 text-center">{src.emoji}</span>
                      <span className={`text-sm font-medium ${active ? "text-white" : "text-white/50"}`}>{src.label}</span>
                    </button>
                  );
                })}
              </div>
              {state.source === "other" && (
                <input autoFocus type="text" value={state.sourceOther} onChange={e => set("sourceOther", e.target.value)}
                  onKeyDown={e => e.key === "Enter" && goNext()} placeholder="Tell us more..."
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/20 text-sm outline-none focus:border-white/25 transition-colors" />
              )}
              <div className="flex items-center justify-between">
                <button onClick={goBack} className="text-sm text-white/20 hover:text-white/45 transition-colors">← Back</button>
                <button onClick={goNext} className="flex items-center gap-1 text-sm text-white/25 hover:text-white/50 transition-colors">Skip <ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {/* ── Step 4: Feature ── */}
          {step === "feature" && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <p className="text-[11px] text-white/20 uppercase tracking-[0.15em]" style={mono}>Step 4 of {STEP_ORDER.length}</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ ...syne, letterSpacing: "-0.03em" }}>Where do you want to start?</h1>
                <p className="text-sm text-white/35">We'll take you straight there after setup</p>
              </div>
              <div className="space-y-2">
                {FEATURES.map(feat => {
                  const active = state.feature === feat.value;
                  return (
                    <button key={feat.value} onClick={() => { set("feature", feat.value); setTimeout(goNext, 240); }}
                      className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl border text-left transition-all duration-150 group"
                      style={{ borderColor: active ? feat.border : "rgba(255,255,255,0.06)", background: active ? feat.bg : "rgba(255,255,255,0.02)" }}>
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0 transition-transform duration-200 group-hover:scale-110"
                        style={{ background: feat.bg, border: `1px solid ${feat.border}` }}>
                        {feat.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold leading-tight ${active ? "text-white" : "text-white/70"}`} style={syne}>{feat.label}</p>
                        <p className="text-xs text-white/30 mt-0.5 leading-relaxed line-clamp-2">{feat.desc}</p>
                      </div>
                      {active && <Check className="h-4 w-4 shrink-0" style={{ color: feat.accent }} />}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between pt-1">
                <button onClick={goBack} className="text-sm text-white/20 hover:text-white/45 transition-colors">← Back</button>
                <button onClick={goNext} className="flex items-center gap-1 text-sm text-white/25 hover:text-white/50 transition-colors">Skip <ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {/* ── Step 5: Plans ── */}
          {step === "plan" && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <p className="text-[11px] text-white/20 uppercase tracking-[0.15em]" style={mono}>Step 5 of {STEP_ORDER.length}</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ ...syne, letterSpacing: "-0.03em" }}>Pick your plan</h1>
                <p className="text-sm text-white/35">You're on Free. Upgrade whenever you're ready.</p>
              </div>
              <div className="space-y-2.5">
                {PLANS.map(plan => (
                  <div key={plan.key} className="relative rounded-2xl border p-4"
                    style={{ borderColor: plan.highlight ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.07)", background: plan.highlight ? "rgba(167,139,250,0.06)" : "rgba(255,255,255,0.02)" }}>
                    {plan.badge && (
                      <span className="absolute top-3.5 right-3.5 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide"
                        style={{ background: "rgba(167,139,250,0.2)", color: "#a78bfa", ...mono }}>
                        {plan.badge}
                      </span>
                    )}
                    <div className="flex items-center justify-between mb-2 pr-20">
                      <p className="font-bold text-white" style={syne}>{plan.label}</p>
                      <div><span className="text-lg font-bold text-white" style={syne}>{plan.price}</span><span className="text-xs text-white/30">{plan.period}</span></div>
                    </div>
                    <ul className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                      {plan.features.map(f => (
                        <li key={f} className="text-xs text-white/40 flex items-center gap-1">
                          <span className="h-1 w-1 rounded-full bg-white/20 shrink-0" />{f}
                        </li>
                      ))}
                    </ul>
                    <button onClick={finish} disabled={saving}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                      style={{ background: plan.highlight ? "linear-gradient(135deg,#7c3aed,#ec4899)" : "rgba(255,255,255,0.08)", color: plan.highlight ? "#fff" : "rgba(255,255,255,0.55)", ...syne }}>
                      {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Setting up...</> : <><Zap className="h-3.5 w-3.5" /> Get {plan.label}</>}
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <button onClick={goBack} className="text-sm text-white/20 hover:text-white/45 transition-colors">← Back</button>
                <button onClick={finish} disabled={saving} className="text-xs text-white/15 hover:text-white/30 transition-colors">
                  {saving ? "Loading..." : "Continue with Free →"}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
