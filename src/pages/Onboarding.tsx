import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ArrowRight, Check, Loader2, ChevronRight, Zap } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useObT } from "@/i18n/onboardingTranslations";
import type { Language } from "@/i18n/translations";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "name" | "language" | "source" | "feature" | "persona" | "plan" | "pain_point";

interface OnboardingState {
  name: string;
  acceptedTerms: boolean;
  marketingEmails: boolean;
  language: string;
  source: string;
  sourceOther: string;
  feature: string;
  pain_point: string;
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

const SOURCES_STATIC = [
  { value: "twitter",    emoji: "𝕏" },
  { value: "youtube",    emoji: "▶️" },
  { value: "tiktok",     emoji: "🎵" },
  { value: "friend",     emoji: "👋" },
  { value: "linkedin",   emoji: "💼" },
  { value: "google",     emoji: "🔍" },
  { value: "newsletter", emoji: "📧" },
  { value: "other",      emoji: "✨" },
];

// Source labels that don't need translation (brand names)
const SOURCE_LABELS: Record<string, string> = {
  twitter: "Twitter / X",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  google: "Google Search",
  newsletter: "Newsletter",
};

const FEATURES_STATIC = [
  { value: "analyze",      url: "/dashboard/analyses/new", emoji: "🔍", accent: "#0ea5e9", bg: "rgba(14,165,233,0.08)", border: "rgba(14,165,233,0.2)" },
  { value: "board",        url: "/dashboard/boards/new",   emoji: "🎬", accent: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.2)" },
  { value: "templates",    url: "/dashboard/templates",    emoji: "📋", accent: "#06b6d4", bg: "rgba(6,182,212,0.08)", border: "rgba(6,182,212,0.2)" },
  { value: "translate",    url: "/dashboard/translate",    emoji: "🌍", accent: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" },
  { value: "preflight",    url: "/dashboard/preflight",    emoji: "✅", accent: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)" },
  { value: "intelligence", url: "/dashboard/intelligence", emoji: "🧠", accent: "#c084fc", bg: "rgba(192,132,252,0.08)", border: "rgba(192,132,252,0.2)" },
];

const PLAN_PRICES: Record<string, string> = {
  maker:  "price_1T9sd1Dr9So14XztT3Mqddch",
  pro:    "price_1T9sdfDr9So14XztPR3tI14Y",
  studio: "price_1T9seMDr9So14Xzt0vEJNQIX",
};

const PLANS = [
  { key: "maker",  label: "Maker",  price: "$19",  period: "/mo", features: ["50 AI messages/day", "1 ad account", "All tools unlocked", "3 personas"],                                  highlight: false, desc_key: "plan_desc_maker" },
  { key: "pro",    label: "Pro",    price: "$49",  period: "/mo", features: ["200 AI messages/day", "3 ad accounts", "All tools unlocked", "Unlimited personas", "Multi-market"],      highlight: true,  desc_key: "plan_desc_pro"   },
  { key: "studio", label: "Studio", price: "$149", period: "/mo", features: ["Unlimited messages", "Unlimited accounts", "All tools unlocked", "Agency workspace"],                    highlight: false, desc_key: "plan_desc_studio" },
];

const STEP_ORDER: Step[] = ["name", "language", "pain_point", "plan"];

// ── Component ──────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const checkoutPlan = searchParams.get("checkout");
  const { language: globalLang, setLanguage: setGlobalLanguage } = useLanguage();
  const [step, setStep] = useState<Step>("name");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<OnboardingState>({
    name: "", acceptedTerms: false, marketingEmails: false,
    language: "", source: "", sourceOther: "", feature: "", pain_point: "",
  });

  // Use the selected onboarding language or fall back to global
  const activeLang = state.language || globalLang || "en";
  const ot = useObT(activeLang);

  useEffect(() => { if (step === "name") nameRef.current?.focus(); }, [step]);

  // Auto-trigger checkout if plan param was passed from signup
  const [autoCheckoutTriggered, setAutoCheckoutTriggered] = useState(false);
  useEffect(() => {
    if (step === "plan" && checkoutPlan && PLAN_PRICES[checkoutPlan] && !autoCheckoutTriggered) {
      setAutoCheckoutTriggered(true);
      handlePlanCheckout(checkoutPlan);
    }
  }, [step, checkoutPlan, autoCheckoutTriggered]);

  const stepIdx = STEP_ORDER.indexOf(step);
  const pct = Math.round(((stepIdx + 1) / STEP_ORDER.length) * 100);
  const set = <K extends keyof OnboardingState>(k: K, v: OnboardingState[K]) =>
    setState(s => ({ ...s, [k]: v }));
  const goNext = () => { const i = STEP_ORDER.indexOf(step); if (i < STEP_ORDER.length - 1) setStep(STEP_ORDER[i + 1]); };
  const goBack = () => { const i = STEP_ORDER.indexOf(step); if (i > 0) setStep(STEP_ORDER[i - 1]); };

  const saveOnboarding = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/login"); return null; }
    await supabase.from("profiles").update({
      name: state.name || undefined,
      preferred_language: state.language || undefined,
      onboarding_completed: true,
      onboarding_data: {
        source: state.source, sourceOther: state.sourceOther,
        feature: state.feature, marketingEmails: state.marketingEmails,
        pain_point: state.pain_point,
        completedAt: new Date().toISOString(),
      },
    } as never).eq("id", session.user.id);
    return session;
  };

  const finish = async () => {
    setSaving(true);
    try {
      const session = await saveOnboarding();
      if (!session) return;

      // Send welcome email for ALL new users (email signup + Google OAuth)
      supabase.functions.invoke('send-welcome-email', {
        body: {
          user_id: session.user.id,
          first_name: (state.name || session.user.user_metadata?.full_name || '').trim().split(' ')[0],
          language: state.language || navigator.language || 'en',
          pain_point: state.pain_point || '',
        }
      }).catch(() => {}); // silent fail — don't block

      // Save pain_point to ai_profile for personalizing first chat message
      if (state.pain_point) {
        supabase.from('user_ai_profile' as any).upsert({
          user_id: session.user.id,
          pain_point: state.pain_point,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'user_id' }).then(() => {}).catch(() => {});
      }

      const feat = FEATURES_STATIC.find(f => f.value === state.feature);
      toast.success("Welcome to AdBrief 🚀");
      navigate(feat?.url || "/dashboard/loop/ai");
    } catch {
      toast.error(ot("skip_setup"));
      navigate("/dashboard/loop/ai");
    } finally { setSaving(false); }
  };

  const handlePlanCheckout = async (planKey: string) => {
    setSaving(true);
    try {
      const session = await saveOnboarding();
      if (!session) return;

      // Send welcome email (fire-and-forget)
      supabase.functions.invoke('send-welcome-email', {
        body: {
          user_id: session.user.id,
          first_name: (state.name || session.user.user_metadata?.full_name || '').trim().split(' ')[0],
          language: state.language || navigator.language || 'en',
        }
      }).catch(() => {});

      const priceId = PLAN_PRICES[planKey];
      if (!priceId) { finish(); return; }
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { price_id: priceId }
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Could not start checkout");
        navigate("/dashboard/loop/ai");
      }
    } catch {
      toast.error("Something went wrong");
      navigate("/dashboard/loop/ai");
    } finally { setSaving(false); }
  };

  const skip = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await supabase.from("profiles").update({ onboarding_completed: true } as never).eq("id", session.user.id);
    } catch {}
    navigate("/dashboard/loop/ai");
  };

  // Get translated source label
  const getSourceLabel = (value: string) => {
    if (value === "friend") return ot("src_friend");
    if (value === "other") return ot("src_other");
    return SOURCE_LABELS[value] || value;
  };

  // Get translated feature label + description
  const getFeatureLabel = (value: string) => {
    const map: Record<string, { label: string; desc: string }> = {
      analyze:      { label: ot("feat_analyze"),      desc: ot("feat_analyze_d") },
      board:        { label: ot("feat_board"),         desc: ot("feat_board_d") },
      templates:    { label: ot("feat_templates"),     desc: ot("feat_templates_d") },
      translate:    { label: ot("feat_translate"),     desc: ot("feat_translate_d") },
      preflight:    { label: ot("feat_preflight"),     desc: ot("feat_preflight_d") },
      intelligence: { label: ot("feat_intelligence"),  desc: ot("feat_intelligence_d") },
    };
    return map[value] || { label: value, desc: "" };
  };

  const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
  const mono = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" } as const;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#060606", fontFamily: "'Outfit', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-5">
        <Logo size="md" />
        <button onClick={skip} className="text-[11px] text-white/15 hover:text-white/35 transition-colors" style={mono}>
          {ot("skip_setup")}
        </button>
      </div>

      {/* Progress */}
      <div className="h-px bg-white/[0.05] mx-6 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #0ea5e9, #06b6d4)" }} />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">

          {/* ── Step 1: Name + Terms ── */}
          {step === "name" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-[11px] text-white/20 uppercase tracking-[0.15em]" style={mono}>{ot("step_of")} 1 {ot("of")} {STEP_ORDER.length}</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ ...syne, letterSpacing: "-0.03em" }}>{ot("setup_title")}</h1>
                <p className="text-sm text-white/35">{ot("setup_sub")}</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-white/30 mb-2">{ot("name_label")} <span className="text-white/15">({ot("name_opt")})</span></label>
                  <input ref={nameRef} type="text" value={state.name} onChange={e => set("name", e.target.value)}
                    onKeyDown={e => e.key === "Enter" && goNext()} placeholder={ot("name_ph")}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/20 text-sm outline-none focus:border-white/20 transition-colors" />
                </div>
                {/* Terms */}
                <label className="flex items-start gap-3 cursor-pointer group" onClick={() => set("acceptedTerms", !state.acceptedTerms)}>
                  <div className={`h-5 w-5 rounded-md border flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${state.acceptedTerms ? "bg-white border-white" : "border-white/15 bg-white/[0.04] group-hover:border-white/30"}`}>
                    {state.acceptedTerms && <Check className="h-3 w-3 text-black" />}
                  </div>
                  <span className="text-xs text-white/40 leading-relaxed">
                    {ot("terms_agree")} <a href="/terms" target="_blank" className="text-white/60 underline underline-offset-2 hover:text-white" onClick={e => e.stopPropagation()}>{ot("terms")}</a> {ot("and")} <a href="/privacy" target="_blank" className="text-white/60 underline underline-offset-2 hover:text-white" onClick={e => e.stopPropagation()}>{ot("privacy")}</a>
                  </span>
                </label>
                {/* Marketing */}
                <label className="flex items-start gap-3 cursor-pointer group" onClick={() => set("marketingEmails", !state.marketingEmails)}>
                  <div className={`h-5 w-5 rounded-md border flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${state.marketingEmails ? "bg-white border-white" : "border-white/15 bg-white/[0.04] group-hover:border-white/30"}`}>
                    {state.marketingEmails && <Check className="h-3 w-3 text-black" />}
                  </div>
                  <span className="text-xs text-white/40 leading-relaxed">
                    {ot("marketing")} <span className="text-white/20">({ot("name_opt")})</span>
                  </span>
                </label>
              </div>
              <button onClick={goNext} disabled={!state.acceptedTerms}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                style={syne}>
                {ot("continue")} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── Step 2: Language ── */}
          {step === "language" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-[11px] text-white/20 uppercase tracking-[0.15em]" style={mono}>{ot("step_of")} 2 {ot("of")} {STEP_ORDER.length}</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ ...syne, letterSpacing: "-0.03em" }}>{ot("lang_title")}</h1>
                <p className="text-sm text-white/35">{ot("lang_sub")}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGES.map(lang => {
                  const active = state.language === lang.value;
                  return (
                    <button key={lang.value} onClick={() => {
                      set("language", lang.value);
                      // Sync with global language context immediately
                      const supportedLangs = ["en", "pt", "es", "fr", "de", "zh", "ar"];
                      if (supportedLangs.includes(lang.value)) {
                        setGlobalLanguage(lang.value as Language);
                      }
                      setTimeout(goNext, 220);
                    }}
                      className="flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all duration-150"
                      style={{ borderColor: active ? "rgba(14,165,233,0.5)" : "rgba(255,255,255,0.07)", background: active ? "rgba(14,165,233,0.1)" : "rgba(255,255,255,0.02)" }}>
                      <span className="text-xl">{lang.flag}</span>
                      <span className={`text-sm font-medium flex-1 ${active ? "text-white" : "text-white/50"}`}>{lang.label}</span>
                      {active && <Check className="h-3.5 w-3.5 text-sky-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between">
                <button onClick={goBack} className="text-sm text-white/20 hover:text-white/45 transition-colors">{ot("back")}</button>
                <button onClick={goNext} className="flex items-center gap-1 text-sm text-white/25 hover:text-white/50 transition-colors">{ot("skip")} <ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {/* ── Step: Pain Point ── */}
          {step === "pain_point" && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <p className="text-[11px] text-white/20 uppercase tracking-[0.15em]" style={mono}>
                  {ot("step_of")} 2 {ot("of")} {STEP_ORDER.length}
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ ...syne, letterSpacing: "-0.03em" }}>
                  {state.language === "pt" ? "Qual é seu maior desafio com anúncios?" :
                   state.language === "es" ? "¿Cuál es tu mayor desafío con anuncios?" :
                   "What's your biggest challenge with paid ads?"}
                </h1>
                <p className="text-sm text-white/35">
                  {state.language === "pt" ? "Isso personaliza sua primeira resposta da IA." :
                   state.language === "es" ? "Esto personaliza tu primera respuesta de IA." :
                   "This personalizes your first AI response."}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 mt-6">
                {[
                  { value: "roas_drop", en: "My ROAS keeps dropping and I don't know why", pt: "Meu ROAS cai e não sei por quê", es: "Mi ROAS baja y no sé por qué", emoji: "📉" },
                  { value: "creative_fatigue", en: "My ads fatigue too fast — need fresh creative constantly", pt: "Meus anúncios fatigam rápido demais", es: "Mis anuncios se fatigan demasiado rápido", emoji: "😩" },
                  { value: "hook_writing", en: "I struggle to write hooks that stop the scroll", pt: "Tenho dificuldade para escrever hooks que param o scroll", es: "Me cuesta escribir hooks que detengan el scroll", emoji: "✍️" },
                  { value: "scaling", en: "I can't scale without killing performance", pt: "Não consigo escalar sem destruir a performance", es: "No puedo escalar sin destruir el rendimiento", emoji: "📈" },
                  { value: "briefing", en: "Briefing my creative team takes too long", pt: "Briefar minha equipe criativa demora demais", es: "Hacer briefing a mi equipo creativo toma demasiado tiempo", emoji: "📋" },
                  { value: "analysis", en: "I spend too much time analyzing data manually", pt: "Gasto muito tempo analisando dados manualmente", es: "Paso demasiado tiempo analizando datos manualmente", emoji: "🔍" },
                ].map(opt => {
                  const label = state.language === "pt" ? opt.pt : state.language === "es" ? opt.es : opt.en;
                  const active = state.pain_point === opt.value;
                  return (
                    <button key={opt.value}
                      onClick={() => set("pain_point", opt.value)}
                      className="w-full text-left transition-all duration-150"
                      style={{
                        padding: "14px 16px",
                        borderRadius: 12,
                        background: active ? "rgba(14,165,233,0.1)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? "rgba(14,165,233,0.4)" : "rgba(255,255,255,0.08)"}`,
                        display: "flex", alignItems: "center", gap: 12,
                        color: active ? "#fff" : "rgba(255,255,255,0.6)",
                        fontSize: 14, fontFamily: "'Inter', sans-serif",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{opt.emoji}</span>
                      <span style={{ lineHeight: 1.4 }}>{label}</span>
                      {active && <span style={{ marginLeft: "auto", color: "#0ea5e9", flexShrink: 0 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setStep(STEP_ORDER[STEP_ORDER.indexOf("pain_point") + 1])}
                disabled={!state.pain_point}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                style={{
                  background: state.pain_point ? "linear-gradient(135deg, #0ea5e9, #06b6d4)" : "rgba(255,255,255,0.06)",
                  color: state.pain_point ? "#000" : "rgba(255,255,255,0.25)",
                  border: "none", cursor: state.pain_point ? "pointer" : "not-allowed",
                  fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 8,
                }}
              >
                {state.language === "pt" ? "Continuar →" : state.language === "es" ? "Continuar →" : "Continue →"}
              </button>
            </div>
          )}

          {/* ── Step 3: Plans ── */}
          {step === "plan" && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <p className="text-[11px] text-white/20 uppercase tracking-[0.15em]" style={mono}>{ot("step_of")} 3 {ot("of")} {STEP_ORDER.length}</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ ...syne, letterSpacing: "-0.03em" }}>{ot("plan_title")}</h1>
                <p className="text-sm text-white/35">{ot("plan_sub")}</p>
                <p className="text-xs text-white/20 mt-1">🎉 {ot("plan_trial_note")}</p>
              </div>
              <div className="space-y-2.5">
                {PLANS.map(plan => (
                  <div key={plan.key} className="relative rounded-2xl border p-4"
                    style={{ borderColor: plan.highlight ? "rgba(14,165,233,0.35)" : "rgba(255,255,255,0.07)", background: plan.highlight ? "rgba(14,165,233,0.06)" : "rgba(255,255,255,0.02)" }}>
                    {plan.highlight && (
                      <span className="absolute top-3.5 right-3.5 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide"
                        style={{ background: "rgba(14,165,233,0.2)", color: "#0ea5e9", ...mono }}>
                        {ot("plan_most_popular")}
                      </span>
                    )}
                    <div className="flex items-center justify-between mb-1 pr-20">
                      <p className="font-bold text-white" style={syne}>{plan.label}</p>
                      <div><span className="text-lg font-bold text-white" style={syne}>{plan.price}</span><span className="text-xs text-white/30">{plan.period}</span></div>
                    </div>
                    <p className="text-[10px] text-white/25 mb-2">{ot("plan_trial_badge")}</p>
                    <ul className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                      {plan.features.map(f => (
                        <li key={f} className="text-xs text-white/40 flex items-center gap-1">
                          <span className="h-1 w-1 rounded-full bg-white/20 shrink-0" />{f}
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => handlePlanCheckout(plan.key)} disabled={saving}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                      style={{ background: plan.highlight ? "linear-gradient(135deg,#7c3aed,#ec4899)" : "rgba(255,255,255,0.08)", color: plan.highlight ? "#fff" : "rgba(255,255,255,0.55)", ...syne }}>
                      {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> {ot("plan_setting_up")}</> : <><Zap className="h-3.5 w-3.5" /> {ot("plan_get")} {plan.label}</>}
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <button onClick={goBack} className="text-sm text-white/20 hover:text-white/45 transition-colors">{ot("back")}</button>
                <button onClick={finish} disabled={saving} className="text-xs text-white/15 hover:text-white/30 transition-colors">
                  {saving ? ot("plan_setting_up") : ot("plan_free")}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
