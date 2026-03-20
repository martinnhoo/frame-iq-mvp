import { useState, useEffect } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Zap, ChevronDown, ChevronUp, Copy, Check, Loader2, Sparkles, RefreshCw, TrendingUp, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { PersonaWarningModal } from "@/components/dashboard/PersonaWarningModal";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashT } from "@/i18n/dashboardTranslations";

const FUNNEL_STAGES = [
  { value: "tofu", label: "ToFu", full: "Top of Funnel", desc: "Awareness — cold audience, no brand knowledge", color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.2)" },
  { value: "mofu", label: "MoFu", full: "Mid of Funnel", desc: "Consideration — warm, evaluating options", color: "#0ea5e9", bg: "rgba(14,165,233,0.08)", border: "rgba(14,165,233,0.2)" },
  { value: "bofu", label: "BoFu", full: "Bottom of Funnel", desc: "Conversion — hot, ready to decide", color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" },
];

interface Hook {
  hook: string;
  hook_type: string;
  predicted_score: number;
  hook_strength: string;
  platform_fit: string[];
  why: string;
  cta_suggestion: string;
}

const PLATFORMS = ["TikTok", "Reels", "YouTube Shorts", "Meta Feed", "YouTube", "Snapchat"];
const TONES = ["Aggressive / Urgent", "Conversational / Friendly", "Educational / Expert", "Controversial / Bold", "Emotional / Inspiring", "Humorous / Playful"];
const MARKETS = [
  { value: "BR", label: "🇧🇷 Brazil" },
  { value: "MX", label: "🇲🇽 Mexico" },
  { value: "US", label: "🇺🇸 United States" },
  { value: "IN", label: "🇮🇳 India" },
  { value: "GLOBAL", label: "🌍 Global" },
];

const HOOK_TYPE_COLORS: Record<string, string> = {
  curiosity:        "text-sky-400 bg-sky-400/10 border-sky-400/20",
  social_proof:     "text-green-400 bg-green-400/10 border-green-400/20",
  pattern_interrupt:"text-orange-400 bg-orange-400/10 border-orange-400/20",
  direct_offer:     "text-blue-400 bg-blue-400/10 border-blue-400/20",
  emotional:        "text-pink-400 bg-pink-400/10 border-pink-400/20",
  question:         "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  statement:        "text-white/50 bg-white/5 border-white/10",
  controversy:      "text-red-400 bg-red-400/10 border-red-400/20",
  fear:             "text-red-300 bg-red-300/10 border-red-300/20",
  transformation:   "text-amber-400 bg-amber-400/10 border-amber-400/20",
};

const STRENGTH_CONFIG: Record<string, { color: string; label: string; bar: string }> = {
  viral:  { color: "text-green-400",  label: "Viral",   bar: "bg-green-400" },
  high:   { color: "text-blue-400",   label: "High",    bar: "bg-blue-400" },
  medium: { color: "text-yellow-400", label: "Medium",  bar: "bg-yellow-400" },
  low:    { color: "text-red-400",    label: "Low",     bar: "bg-red-400" },
};

const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;

const HOOK_CAPS: Record<string, number> = {
  free: 3, maker: 5, pro: 8, studio: 10, creator: 5, starter: 8, scale: 10,
};

export default function HookGenerator() {
  const { user, profile, selectedPersona } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const plan = (profile as any)?.plan || "free";
  const hookCount = HOOK_CAPS[plan] ?? 3;
  const dt = useDashT(language);

  const [product, setProduct] = useState("");
  const [niche, setNiche] = useState("");
  const [market, setMarket] = useState("GLOBAL");
  const [platform, setPlatform] = useState("TikTok");
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const p = searchParams.get("product"); if (p) setProduct(p);
    const n = searchParams.get("niche"); if (n) setNiche(n);
    const m = searchParams.get("market"); if (m) setMarket(m);
    const pl = searchParams.get("platform"); if (pl) setPlatform(pl);
  }, []);
  const [tone, setTone] = useState("Aggressive / Urgent");
  const [funnelStage, setFunnelStage] = useState("tofu");
  const [showPersonaWarning, setShowPersonaWarning] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState(false);

  const [loading, setLoading] = useState(false);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [mockMode, setMockMode] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, "up" | "down">>({});

  const generate = async () => {
    if (!product.trim()) { toast.error("Describe your product first"); return; }
    // Warn if no persona selected
    if (!selectedPersona && !pendingGenerate) {
      setShowPersonaWarning(true);
      return;
    }
    setPendingGenerate(false);
    setLoading(true);
    setHooks([]);
    setExpandedIdx(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-hooks", {
        body: { product, niche, market, platform, tone, user_id: user.id, count: hookCount,
          funnel_stage: funnelStage,
          persona_context: selectedPersona ? {
            name: selectedPersona.name, age: selectedPersona.age, gender: selectedPersona.gender,
            pains: selectedPersona.pains, desires: selectedPersona.desires, triggers: selectedPersona.triggers,
            hook_angles: selectedPersona.hook_angles, language_style: selectedPersona.language_style,
            cta_style: selectedPersona.cta_style, best_platforms: selectedPersona.best_platforms,
          } : null,
        },
      });
      if (error) throw error;
      setHooks(data.hooks || []);
      setMockMode(data.mock_mode);
      if (data.mock_mode) toast.info("Add ANTHROPIC_API_KEY to get real AI hooks");
    } catch {
      toast.error("Hook generation failed");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (hook: Hook, idx: number) => {
    await navigator.clipboard.writeText(hook.hook);
    setCopiedIdx(idx);
    toast.success("Hook copied!");
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const sendFeedback = async (hook: Hook, idx: number, vote: "up" | "down") => {
    if (feedback[idx]) return; // already voted
    setFeedback(prev => ({ ...prev, [idx]: vote }));
    toast.success(vote === "up" ? "Got it — more like this 👍" : "Noted — fewer of this type 👎");
    // Save to creative_memory so update-ai-profile can learn from it
    if (user?.id) {
      await supabase.from("creative_memory").insert({
        user_id: user.id,
        hook_type: hook.hook_type,
        platform: platform.toLowerCase().replace(" ", "_"),
        hook_score: vote === "up" ? hook.predicted_score : Math.max(1, hook.predicted_score - 3),
        notes: `User ${vote === "up" ? "liked" : "disliked"}: "${hook.hook.substring(0, 100)}"`,
      } as any);
      // Trigger AI profile update non-blocking
      supabase.functions.invoke("update-ai-profile", {
        body: { user_id: user.id, trigger: "hook_feedback", vote, hook_type: hook.hook_type, platform, predicted_score: hook.predicted_score }
      }).catch(() => {});
    }
  };

  const avgScore = hooks.length ? hooks.reduce((a, h) => a + h.predicted_score, 0) / hooks.length : 0;
  const viralCount = hooks.filter(h => h.hook_strength === "viral").length;
  const highCount = hooks.filter(h => h.hook_strength === "high").length;

  return (
    <div className="page-enter p-5 lg:p-6 max-w-5xl mx-auto space-y-6">
      <PersonaWarningModal
        open={showPersonaWarning}
        onClose={() => setShowPersonaWarning(false)}
        toolName="Hook Generator"
        onContinue={() => { setShowPersonaWarning(false); setPendingGenerate(true); setTimeout(generate, 50); }}
      />
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-sky-500/20 flex items-center justify-center shrink-0">
          <Zap className="h-5 w-5 text-sky-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white" style={syne}>{dt("hg_title")}</h1>
          <p className="text-xs text-white/50 mt-0.5">AI-generated hooks with predicted performance scores — ready to test</p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 5, padding: "3px 10px", borderRadius: 99, background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.15)" }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, color: "#0ea5e9" }}>{hookCount} hooks</span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.28)", textTransform: "capitalize" }}>· {plan}</span>
          </div>
        </div>
      </div>

      {/* Input form */}
      <div className="rounded-2xl border border-white/[0.13] bg-[#0a0a0a] p-5 space-y-4">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-2">{dt("hg_product")} <span className="text-white/15">*</span></label>
            <input
              value={product}
              onChange={e => setProduct(e.target.value)}
              onKeyDown={e => e.key === "Enter" && generate()}
              placeholder='e.g. "FitCore — fitness supplements for men 25-35" or "A B2B SaaS for HR teams"'
              className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.15] text-white placeholder:text-white/40 text-sm outline-none focus:border-white/20 transition-colors"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-white/50 mb-2">Niche / Industry</label>
            <input
              value={niche}
              onChange={e => setNiche(e.target.value)}
              placeholder='e.g. "Fitness", "SaaS", "E-commerce"'
              className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.15] text-white placeholder:text-white/40 text-sm outline-none focus:border-white/20 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-2">{dt("hg_market")}</label>
            <select value={market} onChange={e => setMarket(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#111] border border-white/[0.15] text-white text-sm outline-none focus:border-white/20 transition-colors">
              {MARKETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-white/50 mb-2">{dt("hg_platform")}</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map(p => (
                <button key={p} onClick={() => setPlatform(p)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs border transition-all ${platform === p ? "bg-white text-black border-white font-semibold" : "border-white/[0.13] text-white/55 hover:border-white/15 hover:text-white/60"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-2">{dt("hg_style")}</label>
            <select value={tone} onChange={e => setTone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#111] border border-white/[0.15] text-white text-sm outline-none focus:border-white/20 transition-colors">
              {TONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

        </div>

        {/* Funnel stage */}
        <div>
          <label className="block text-xs text-white/50 mb-2">{dt("bo_funnel")}</label>
          <div className="grid grid-cols-3 gap-2">
            {FUNNEL_STAGES.map(f => (
              <button key={f.value} onClick={() => setFunnelStage(f.value)}
                className="flex flex-col items-center p-3 rounded-xl border text-center transition-all"
                style={funnelStage === f.value
                  ? { background: f.bg, borderColor: f.border, color: f.color }
                  : { background: "transparent", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }}>
                <span className="text-xs font-bold font-mono">{f.label}</span>
                <span className="text-[10px] mt-0.5 opacity-70">{f.full}</span>
                <span className="text-[9px] mt-1 opacity-40 leading-tight hidden sm:block">{f.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={generate}
          disabled={loading || !product.trim()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          style={syne}
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating {hookCount} hooks...</> : <><Sparkles className="h-4 w-4" /> Generate {hookCount} Hooks</>}
        </button>
      </div>
      </div>

      {/* Results */}
      {hooks.length > 0 && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/[0.13] bg-[#0a0a0a]">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-white/50" />
              <span className="text-xs text-white/40">Avg predicted score</span>
              <span className={`text-sm font-bold font-mono ${avgScore >= 8 ? "text-green-400" : avgScore >= 6.5 ? "text-yellow-400" : "text-white/60"}`}>
                {avgScore.toFixed(1)}/10
              </span>
            </div>
            <div className="h-4 w-px bg-white/[0.08]" />
            <div className="text-xs text-white/40">
              <span className="text-green-400 font-semibold">{viralCount} viral</span>
              <span className="text-white/40 mx-1">·</span>
              <span className="text-blue-400 font-semibold">{highCount} high</span>
            </div>
            {mockMode && (
              <>
                <div className="h-4 w-px bg-white/[0.08]" />
                <span className="text-[10px] text-yellow-400/60 font-mono">mock mode — add ANTHROPIC_API_KEY</span>
              </>
            )}
            <button onClick={generate} disabled={loading} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.15] text-white/40 text-xs hover:text-white transition-all">
              <RefreshCw className="h-3 w-3" /> Regenerate
            </button>
          </div>

          {/* Hook cards */}
          <div className="space-y-2">
            {hooks.map((hook, idx) => {
              const strength = STRENGTH_CONFIG[hook.hook_strength] || STRENGTH_CONFIG.medium;
              const typeColor = HOOK_TYPE_COLORS[hook.hook_type] || HOOK_TYPE_COLORS.statement;
              const expanded = expandedIdx === idx;
              const scorePct = (hook.predicted_score / 10) * 100;

              return (
                <div key={idx} className="rounded-2xl border border-white/[0.13] bg-[#0a0a0a] overflow-hidden hover:border-white/[0.12] transition-all">
                  {/* Main row */}
                  <div className="flex items-start gap-4 p-4">
                    {/* Score ring */}
                    <div className="shrink-0 text-center w-12">
                      <div className={`text-lg font-bold font-mono ${strength.color}`} style={syne}>
                        {hook.predicted_score.toFixed(1)}
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.06] mt-1 overflow-hidden">
                        <div className={`h-full rounded-full ${strength.bar}`} style={{ width: `${scorePct}%` }} />
                      </div>
                      <div className={`text-[9px] mt-1 font-semibold uppercase tracking-wide ${strength.color}`}>{strength.label}</div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white leading-relaxed font-medium">{hook.hook}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${typeColor}`}>
                          {hook.hook_type.replace(/_/g, " ")}
                        </span>
                        {hook.platform_fit?.map(p => (
                          <span key={p} className="text-[10px] text-white/45 border border-white/[0.12] px-2 py-0.5 rounded-full">{p}</span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Feedback */}
                      <button
                        onClick={() => sendFeedback(hook, idx, "up")}
                        disabled={!!feedback[idx]}
                        title="More like this"
                        className={`h-8 w-8 rounded-xl border flex items-center justify-center transition-all ${
                          feedback[idx] === "up"
                            ? "bg-green-500/20 border-green-500/40 text-green-400"
                            : "bg-white/[0.05] border-white/[0.13] text-white/40 hover:text-green-400 hover:border-green-400/30"
                        }`}
                      >
                        <ThumbsUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => sendFeedback(hook, idx, "down")}
                        disabled={!!feedback[idx]}
                        title="Fewer of this type"
                        className={`h-8 w-8 rounded-xl border flex items-center justify-center transition-all ${
                          feedback[idx] === "down"
                            ? "bg-red-500/20 border-red-500/40 text-red-400"
                            : "bg-white/[0.05] border-white/[0.13] text-white/40 hover:text-red-400 hover:border-red-400/30"
                        }`}
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => copy(hook, idx)}
                        className="h-8 w-8 rounded-xl bg-white/[0.05] border border-white/[0.13] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.1] transition-all"
                      >
                        {copiedIdx === idx ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => setExpandedIdx(expanded ? null : idx)}
                        className="h-8 w-8 rounded-xl bg-white/[0.05] border border-white/[0.13] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.1] transition-all"
                      >
                        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expanded && (
                    <div className="border-t border-white/[0.05] px-4 pb-4 pt-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl bg-white/[0.07] border border-white/[0.05] p-3">
                          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5" style={{ fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" }}>Why it works</p>
                          <p className="text-xs text-white/50 leading-relaxed">{hook.why}</p>
                        </div>
                        <div className="rounded-xl bg-white/[0.07] border border-white/[0.05] p-3">
                          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5" style={{ fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" }}>CTA suggestion</p>
                          <p className="text-xs text-white/50 leading-relaxed">{hook.cta_suggestion}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => copy(hook, idx)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.13] text-white/40 text-xs hover:border-white/15 hover:text-white/70 transition-all"
                      >
                        {copiedIdx === idx ? <><Check className="h-3.5 w-3.5 text-green-400" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> {dt("hg_copy")}</>}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && hooks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/[0.13] py-16 text-center space-y-3">
          <div className="text-4xl">⚡</div>
          <p className="text-white/50 text-sm font-medium">Describe your product and hit generate</p>
          <p className="text-white/15 text-xs">AI generates hooks with predicted scores, psychological breakdown, and CTA suggestions</p>
        </div>
      )}
    </div>
  );
}
