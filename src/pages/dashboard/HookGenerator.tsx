import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Zap, ChevronDown, ChevronUp, Copy, Check, Loader2, Sparkles, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";

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
  curiosity:        "text-purple-400 bg-purple-400/10 border-purple-400/20",
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

const syne = { fontFamily: "'Syne', sans-serif" } as const;

export default function HookGenerator() {
  const { user } = useOutletContext<DashboardContext>();

  const [product, setProduct] = useState("");
  const [niche, setNiche] = useState("");
  const [market, setMarket] = useState("GLOBAL");
  const [platform, setPlatform] = useState("TikTok");
  const [tone, setTone] = useState("Aggressive / Urgent");
  const [count, setCount] = useState(10);

  const [loading, setLoading] = useState(false);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [mockMode, setMockMode] = useState(false);

  const generate = async () => {
    if (!product.trim()) { toast.error("Describe your product first"); return; }
    setLoading(true);
    setHooks([]);
    setExpandedIdx(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-hooks", {
        body: { product, niche, market, platform, tone, user_id: user.id, count },
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

  const avgScore = hooks.length ? hooks.reduce((a, h) => a + h.predicted_score, 0) / hooks.length : 0;
  const viralCount = hooks.filter(h => h.hook_strength === "viral").length;
  const highCount = hooks.filter(h => h.hook_strength === "high").length;

  return (
    <div className="page-enter p-5 lg:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 flex items-center justify-center shrink-0">
          <Zap className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white" style={syne}>Hook Generator</h1>
          <p className="text-xs text-white/30 mt-0.5">AI-generated hooks with predicted performance scores — ready to test</p>
        </div>
      </div>

      {/* Input form */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs text-white/30 mb-2">Product or service <span className="text-white/15">*</span></label>
            <input
              value={product}
              onChange={e => setProduct(e.target.value)}
              onKeyDown={e => e.key === "Enter" && generate()}
              placeholder='e.g. "An online casino with fast payouts" or "A weight-loss supplement"'
              className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/20 text-sm outline-none focus:border-white/20 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-white/30 mb-2">Niche / Industry</label>
            <input
              value={niche}
              onChange={e => setNiche(e.target.value)}
              placeholder='e.g. "iGaming", "Health & Wellness"'
              className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/20 text-sm outline-none focus:border-white/20 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-white/30 mb-2">Target market</label>
            <select value={market} onChange={e => setMarket(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#111] border border-white/[0.08] text-white text-sm outline-none focus:border-white/20 transition-colors">
              {MARKETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-white/30 mb-2">Platform</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map(p => (
                <button key={p} onClick={() => setPlatform(p)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs border transition-all ${platform === p ? "bg-white text-black border-white font-semibold" : "border-white/[0.07] text-white/35 hover:border-white/15 hover:text-white/60"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/30 mb-2">Tone</label>
            <select value={tone} onChange={e => setTone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#111] border border-white/[0.08] text-white text-sm outline-none focus:border-white/20 transition-colors">
              {TONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/30 mb-2">How many hooks</label>
            <div className="flex gap-1.5">
              {[5, 10, 15].map(n => (
                <button key={n} onClick={() => setCount(n)}
                  className={`flex-1 py-3 rounded-xl text-sm border font-mono transition-all ${count === n ? "bg-white text-black border-white font-bold" : "border-white/[0.07] text-white/35 hover:border-white/15"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={generate}
          disabled={loading || !product.trim()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          style={syne}
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating {count} hooks...</> : <><Sparkles className="h-4 w-4" /> Generate {count} Hooks</>}
        </button>
      </div>

      {/* Results */}
      {hooks.length > 0 && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/[0.07] bg-[#0a0a0a]">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-white/30" />
              <span className="text-xs text-white/40">Avg predicted score</span>
              <span className={`text-sm font-bold font-mono ${avgScore >= 8 ? "text-green-400" : avgScore >= 6.5 ? "text-yellow-400" : "text-white/60"}`}>
                {avgScore.toFixed(1)}/10
              </span>
            </div>
            <div className="h-4 w-px bg-white/[0.08]" />
            <div className="text-xs text-white/40">
              <span className="text-green-400 font-semibold">{viralCount} viral</span>
              <span className="text-white/20 mx-1">·</span>
              <span className="text-blue-400 font-semibold">{highCount} high</span>
            </div>
            {mockMode && (
              <>
                <div className="h-4 w-px bg-white/[0.08]" />
                <span className="text-[10px] text-yellow-400/60 font-mono">mock mode — add ANTHROPIC_API_KEY</span>
              </>
            )}
            <button onClick={generate} disabled={loading} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/40 text-xs hover:text-white transition-all">
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
                <div key={idx} className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden hover:border-white/[0.12] transition-all">
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
                          <span key={p} className="text-[10px] text-white/25 border border-white/[0.06] px-2 py-0.5 rounded-full">{p}</span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => copy(hook, idx)}
                        className="h-8 w-8 rounded-xl bg-white/[0.05] border border-white/[0.07] flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.1] transition-all"
                      >
                        {copiedIdx === idx ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => setExpandedIdx(expanded ? null : idx)}
                        className="h-8 w-8 rounded-xl bg-white/[0.05] border border-white/[0.07] flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.1] transition-all"
                      >
                        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expanded && (
                    <div className="border-t border-white/[0.05] px-4 pb-4 pt-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
                          <p className="text-[10px] uppercase tracking-widest text-white/20 mb-1.5" style={{ fontFamily: "'DM Mono', monospace" }}>Why it works</p>
                          <p className="text-xs text-white/50 leading-relaxed">{hook.why}</p>
                        </div>
                        <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
                          <p className="text-[10px] uppercase tracking-widest text-white/20 mb-1.5" style={{ fontFamily: "'DM Mono', monospace" }}>CTA suggestion</p>
                          <p className="text-xs text-white/50 leading-relaxed">{hook.cta_suggestion}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => copy(hook, idx)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.07] text-white/40 text-xs hover:border-white/15 hover:text-white/70 transition-all"
                      >
                        {copiedIdx === idx ? <><Check className="h-3.5 w-3.5 text-green-400" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy hook</>}
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
        <div className="rounded-2xl border border-dashed border-white/[0.07] py-16 text-center space-y-3">
          <div className="text-4xl">⚡</div>
          <p className="text-white/30 text-sm font-medium">Describe your product and hit generate</p>
          <p className="text-white/15 text-xs">AI generates hooks with predicted scores, psychological breakdown, and CTA suggestions</p>
        </div>
      )}
    </div>
  );
}
