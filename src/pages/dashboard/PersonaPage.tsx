import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Users, ArrowRight, ArrowLeft, Check, Download, Copy, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────
interface PersonaResult {
  name: string;
  age: string;
  gender: string;
  headline: string;
  bio: string;
  pains: string[];
  desires: string[];
  objections: string[];
  triggers: string[];
  media_habits: string[];
  best_platforms: string[];
  best_formats: string[];
  hook_angles: string[];
  language_style: string;
  cta_style: string;
  avatar_emoji: string;
}

// ─── Steps ───────────────────────────────────────────────────────────────────
const STEPS = [
  {
    id: "product",
    q: "What are you advertising?",
    sub: "Be specific — the more context, the better the persona",
    type: "text",
    placeholder: "e.g. Online sports betting app targeting casual football fans",
  },
  {
    id: "gender",
    q: "Primary gender target?",
    sub: "",
    type: "single",
    options: [
      { value: "male", label: "Mostly Male", emoji: "👨" },
      { value: "female", label: "Mostly Female", emoji: "👩" },
      { value: "both", label: "Both / Mixed", emoji: "👥" },
    ],
  },
  {
    id: "age",
    q: "Age range?",
    sub: "Drag both handles to set your target range",
    type: "range",
  },
  {
    id: "income",
    q: "Income level?",
    sub: "This shapes their pain points and purchase triggers",
    type: "single",
    options: [
      { value: "low",    label: "Budget conscious",    emoji: "💵" },
      { value: "mid",    label: "Middle income",       emoji: "💰" },
      { value: "high",   label: "High income",         emoji: "💎" },
      { value: "mixed",  label: "Mixed / Unknown",     emoji: "🔀" },
    ],
  },
  {
    id: "market",
    q: "Which market / country?",
    sub: "",
    type: "single",
    options: [
      { value: "BR", label: "Brazil",         emoji: "🇧🇷" },
      { value: "MX", label: "Mexico",         emoji: "🇲🇽" },
      { value: "US", label: "United States",  emoji: "🇺🇸" },
      { value: "IN", label: "India",          emoji: "🇮🇳" },
      { value: "GB", label: "United Kingdom", emoji: "🇬🇧" },
      { value: "ES", label: "Spain",          emoji: "🇪🇸" },
      { value: "GLOBAL", label: "Global",     emoji: "🌍" },
    ],
  },
  {
    id: "platform",
    q: "Main platform you're running ads on?",
    sub: "Shapes media habits and format recommendations",
    type: "single",
    options: [
      { value: "meta",    label: "Meta (FB/IG)", emoji: "📘" },
      { value: "tiktok",  label: "TikTok",       emoji: "🎵" },
      { value: "youtube", label: "YouTube",      emoji: "▶️" },
      { value: "google",  label: "Google",       emoji: "🔍" },
      { value: "multi",   label: "Multiple",     emoji: "📡" },
    ],
  },
  {
    id: "pain",
    q: "What's the biggest pain this product solves?",
    sub: "One sentence — the core problem your audience faces",
    type: "text",
    placeholder: "e.g. They love football but feel left out when friends bet and win big",
  },
];

export default function PersonaPage() {
  const { user } = useOutletContext<DashboardContext>();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PersonaResult | null>(null);
  const [copied, setCopied] = useState(false);
  // Dual range slider state
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(35);

  const current = STEPS[step];
  const answer = answers[current.id] || "";
  const canNext = current.type === "range"
    ? true
    : answer.trim().length > 0;

  const selectSingle = (value: string) => {
    setAnswers(a => ({ ...a, [current.id]: value }));
    setTimeout(() => {
      if (step < STEPS.length - 1) setStep(s => s + 1);
      else generatePersona({ ...answers, [current.id]: value });
    }, 260);
  };

  const handleRangeNext = () => {
    const label = ageMax >= 55 ? `${ageMin}-55+` : `${ageMin}-${ageMax}`;
    const updated = { ...answers, age: label };
    setAnswers(updated);
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else generatePersona(updated);
  };

  const handleTextNext = () => {
    if (!canNext) return;
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else generatePersona(answers);
  };

  const generatePersona = async (finalAnswers: Record<string, string>) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-persona", {
        body: { answers: finalAnswers },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const parsed: PersonaResult = data.persona;
      setResult(parsed);

      // Save to Supabase
      try {
        await supabase.from("personas" as never).insert({
          user_id: user.id,
          answers: finalAnswers,
          result: parsed,
        } as never);
      } catch { /* table may not exist yet */ }

    } catch (err: any) {
      toast.error(err?.message || "Persona generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text = `PERSONA: ${result.name}, ${result.age} — ${result.headline}

BIO: ${result.bio}

PAINS:
${result.pains.map(p => `• ${p}`).join("\n")}

DESIRES:
${result.desires.map(d => `• ${d}`).join("\n")}

HOOK ANGLES:
${result.hook_angles.map(h => `• ${h}`).join("\n")}

BEST FORMATS: ${result.best_formats.join(", ")}
LANGUAGE: ${result.language_style}
CTA: ${result.cta_style}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => { setStep(0); setAnswers({}); setResult(null); };

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-2 border-purple-500/20 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-purple-500/40 animate-pulse" />
        <div className="absolute inset-4 rounded-full bg-purple-500/20 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-purple-400" />
        </div>
      </div>
      <p className="text-white/40 text-sm">Building your persona...</p>
    </div>
  );

  // ── Result ─────────────────────────────────────────────────────────────────
  if (result) return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Users className="h-5 w-5 text-white/40" />
          Your Persona
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/50 hover:text-white text-xs transition-all">
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            Copy
          </button>
          <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/50 hover:text-white text-xs transition-all">
            <RefreshCw className="h-3.5 w-3.5" /> New persona
          </button>
        </div>
      </div>

      {/* Identity card */}
      <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/10 p-6">
        <div className="flex items-start gap-5">
          <div className="text-5xl shrink-0">{result.avatar_emoji}</div>
          <div>
            <h2 className="text-2xl font-bold text-white">{result.name}</h2>
            <p className="text-white/40 text-sm">{result.age} · {result.gender}</p>
            <p className="text-purple-300 font-semibold mt-1">{result.headline}</p>
            <p className="text-white/50 text-sm mt-3 leading-relaxed">{result.bio}</p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          { title: "😤 Pain Points", items: result.pains, color: "text-red-400" },
          { title: "✨ Desires", items: result.desires, color: "text-yellow-400" },
          { title: "🚧 Objections", items: result.objections, color: "text-orange-400" },
          { title: "⚡ Purchase Triggers", items: result.triggers, color: "text-green-400" },
        ].map(({ title, items, color }) => (
          <div key={title} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${color}`}>{title}</h3>
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                  <span className="text-white/20 shrink-0 font-mono text-xs mt-0.5">{i + 1}.</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Ad strategy */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-5">
        <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Ad Strategy for {result.name}</h3>

        <div>
          <p className="text-xs text-white/25 mb-2 uppercase tracking-wider">Hook Angles</p>
          <div className="space-y-2">
            {result.hook_angles.map((h, i) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.04]">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold flex items-center justify-center shrink-0">{i+1}</span>
                <p className="text-sm text-white/70">{h}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-white/25 mb-2 uppercase tracking-wider">Best Formats</p>
            <div className="flex flex-wrap gap-2">
              {result.best_formats.map(f => (
                <span key={f} className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-xs border border-blue-500/20">{f}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-white/25 mb-2 uppercase tracking-wider">Best Platforms</p>
            <div className="flex flex-wrap gap-2">
              {result.best_platforms.map(p => (
                <span key={p} className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 text-xs border border-purple-500/20">{p}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-white/[0.06]">
          <div>
            <p className="text-xs text-white/25 mb-1 uppercase tracking-wider">Language Style</p>
            <p className="text-sm text-white/60">{result.language_style}</p>
          </div>
          <div>
            <p className="text-xs text-white/25 mb-1 uppercase tracking-wider">CTA Style</p>
            <p className="text-sm text-white/60">{result.cta_style}</p>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Builder steps ──────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-8">
        <Users className="h-5 w-5 text-white/40" />
        <h1 className="text-lg font-bold text-white">Persona Builder</h1>
        <span className="ml-auto text-xs font-mono text-white/20">{step + 1}/{STEPS.length}</span>
      </div>

      {/* Progress */}
      <div className="h-1 bg-white/[0.05] rounded-full mb-8 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {/* Question */}
      <h2 className="text-2xl font-bold text-white mb-2">{current.q}</h2>
      {current.sub && <p className="text-white/35 text-sm mb-6">{current.sub}</p>}

      {/* Text input */}
      {current.type === "text" && (
        <div className="space-y-4">
          <textarea
            value={answer}
            onChange={e => setAnswers(a => ({ ...a, [current.id]: e.target.value }))}
            placeholder={(current as { placeholder?: string }).placeholder}
            rows={3}
            autoFocus
            className="w-full px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/20 text-sm resize-none outline-none focus:border-white/25 transition-colors"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTextNext(); } }}
          />
          <div className="flex items-center justify-between">
            {step > 0 ? (
              <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1 text-sm text-white/25 hover:text-white/50 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : <span />}
            <button
              onClick={handleTextNext}
              disabled={!canNext}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-30 transition-all"
            >
              {step === STEPS.length - 1 ? "Generate persona" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Single select */}
      {current.type === "single" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            {(current as { options: { value: string; label: string; emoji: string }[] }).options.map(opt => (
              <button
                key={opt.value}
                onClick={() => selectSingle(opt.value)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all ${
                  answer === opt.value
                    ? "border-white/40 bg-white/10 text-white"
                    : "border-white/[0.08] bg-white/[0.02] text-white/50 hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <span className="text-xl">{opt.emoji}</span>
                <span className="text-sm font-medium">{opt.label}</span>
                {answer === opt.value && <Check className="ml-auto h-3.5 w-3.5 text-white/50" />}
              </button>
            ))}
          </div>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1 text-sm text-white/20 hover:text-white/40 transition-colors mt-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )}
        </div>
      )}

      {/* Dual range slider */}
      {current.type === "range" && (
        <div className="space-y-6">
          {/* Display */}
          <div className="flex items-center justify-center gap-3">
            <div className="px-5 py-3 rounded-2xl bg-white/[0.07] border border-white/[0.12] text-center min-w-[80px]">
              <p className="text-xs text-white/30 mb-0.5">From</p>
              <p className="text-2xl font-bold text-white">{ageMin}</p>
            </div>
            <div className="h-px w-8 bg-white/20" />
            <div className="px-5 py-3 rounded-2xl bg-white/[0.07] border border-white/[0.12] text-center min-w-[80px]">
              <p className="text-xs text-white/30 mb-0.5">To</p>
              <p className="text-2xl font-bold text-white">{ageMax >= 55 ? "55+" : ageMax}</p>
            </div>
          </div>

          {/* Slider track */}
          <div className="relative px-2">
            <div className="relative h-2 mx-2">
              {/* Track bg */}
              <div className="absolute inset-0 rounded-full bg-white/[0.08]" />
              {/* Active track */}
              <div
                className="absolute h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                style={{
                  left: `${((ageMin - 18) / (55 - 18)) * 100}%`,
                  right: `${100 - ((Math.min(ageMax, 55) - 18) / (55 - 18)) * 100}%`,
                }}
              />
              {/* Min handle */}
              <input
                type="range" min={18} max={54} value={ageMin}
                onChange={e => {
                  const v = Number(e.target.value);
                  if (v < ageMax) setAgeMin(v);
                }}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                style={{ zIndex: ageMin > 50 ? 5 : 3 }}
              />
              {/* Max handle */}
              <input
                type="range" min={19} max={55} value={ageMax}
                onChange={e => {
                  const v = Number(e.target.value);
                  if (v > ageMin) setAgeMax(v);
                }}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                style={{ zIndex: 4 }}
              />
              {/* Visual handles */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white shadow-lg border-2 border-purple-500 pointer-events-none transition-all"
                style={{ left: `calc(${((ageMin - 18) / (55 - 18)) * 100}% - 10px)` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white shadow-lg border-2 border-pink-500 pointer-events-none transition-all"
                style={{ left: `calc(${((Math.min(ageMax, 55) - 18) / (55 - 18)) * 100}% - 10px)` }}
              />
            </div>
            {/* Labels */}
            <div className="flex justify-between mt-4 px-2 text-[10px] text-white/20">
              <span>18</span><span>25</span><span>35</span><span>45</span><span>55+</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            {step > 0 ? (
              <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1 text-sm text-white/25 hover:text-white/50 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : <span />}
            <button
              onClick={handleRangeNext}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all"
            >
              {step === STEPS.length - 1 ? "Generate persona" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
