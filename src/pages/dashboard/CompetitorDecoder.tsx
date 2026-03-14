import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, AlertTriangle, TrendingUp, Shield, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface DecodeResult {
  framework: string;
  hook_type: string;
  hook_score: number;
  hook_strength: string;
  emotional_triggers: string[];
  persuasion_tactics: string[];
  target_audience: string;
  creative_model: string;
  strengths: string[];
  weaknesses: string[];
  counter_strategy: string;
  steal_worthy: string[];
  threat_level: string;
  mock_mode?: boolean;
}

const THREAT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: "Critical threat",   color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/25" },
  high:     { label: "High threat",       color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/25" },
  medium:   { label: "Medium threat",     color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/25" },
  low:      { label: "Low threat",        color: "text-green-400",  bg: "bg-green-400/10",  border: "border-green-400/25" },
};

const HOOK_TYPE_COLORS: Record<string, string> = {
  curiosity:        "text-purple-400 bg-purple-400/10 border-purple-400/20",
  pain_point:       "text-red-400 bg-red-400/10 border-red-400/20",
  social_proof:     "text-green-400 bg-green-400/10 border-green-400/20",
  pattern_interrupt:"text-orange-400 bg-orange-400/10 border-orange-400/20",
  direct_offer:     "text-blue-400 bg-blue-400/10 border-blue-400/20",
  emotional:        "text-pink-400 bg-pink-400/10 border-pink-400/20",
  question:         "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
};

const INDUSTRIES = ["iGaming / Betting", "E-commerce / DTC", "Finance / Fintech", "Health & Wellness", "SaaS / Tech", "Fashion / Beauty", "Food & Beverage", "Real Estate", "Education", "Other"];

const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const mono = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" } as const;

export default function CompetitorDecoder() {
  const { selectedPersona } = useOutletContext<DashboardContext>();
  const [adText, setAdText] = useState("");
  const [industry, setIndustry] = useState("iGaming / Betting");
  const [market, setMarket] = useState("BR");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [copiedCounter, setCopiedCounter] = useState(false);
  const [showCounter, setShowCounter] = useState(false);

  const decode = async () => {
    if (adText.trim().length < 20) { toast.error("Paste at least 20 characters of the ad"); return; }
    setLoading(true);
    setResult(null);
    try {
      const personaCtx = selectedPersona
        ? `Name: ${selectedPersona.name}. ${selectedPersona.headline}. Pains: ${selectedPersona.pains?.join(", ")}. Desires: ${selectedPersona.desires?.join(", ")}. Best platforms: ${selectedPersona.best_platforms?.join(", ")}. Hook angles: ${selectedPersona.hook_angles?.join(", ")}. Language: ${selectedPersona.language_style}`
        : undefined;
      const { data, error } = await supabase.functions.invoke("decode-competitor", {
        body: { ad_text: adText.trim(), industry, market, context: context.trim() || undefined, persona_context: personaCtx },
      });
      if (error) throw error;
      setResult(data);
      if (data.mock_mode) toast.info("AI is running in demo mode");
    } catch {
      toast.error("Decoding failed");
    } finally {
      setLoading(false);
    }
  };

  const EXAMPLES = [
    `Stop scrolling — this app paid me $847 last week just for answering surveys on my phone. I've been using it for 3 months and it's the most consistent side income I've ever had. Download free, no subscription, no hidden fees. Link in bio.`,
    `POV: You're still paying full price for flights ✈️ Meanwhile I haven't paid full price in 2 years using this one trick. Watch till the end because most people miss step 3. Comment 'TRAVEL' and I'll send you the exact process.`,
    `I lost 23lbs in 90 days without stepping foot in a gym. I know that sounds crazy but here's exactly what I changed: I stopped eating at night, added this one supplement, and walked 20 minutes a day. That's literally it. I'm not selling anything — just sharing what worked.`,
  ];

  return (
    <div className="page-enter p-5 lg:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
          <Search className="h-5 w-5 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white" style={syne}>Competitor Pattern Decoder</h1>
          <p className="text-xs text-white/50 mt-0.5">Paste any competitor ad — AI decodes the framework, tactics, and how to counter it</p>
        </div>
      </div>

      {/* Tip banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl" style={{ background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.14)" }}>
        <span className="text-lg shrink-0">💡</span>
        <div>
          <p className="text-xs font-semibold text-white mb-0.5">How to get the ad script</p>
          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
            Don't have the transcript yet?{" "}
            <a href="/dashboard/translate" className="underline" style={{ color: "#22d3ee" }}>
              Go to Translate → Video → Transcript
            </a>
            {" "}to extract the script from any video, then paste it here.
            Or share the TikTok / Instagram URL below and we'll fetch the caption.
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="rounded-2xl border border-white/[0.13] bg-[#0a0a0a] p-5 space-y-4">
        {/* URL field */}
        <div>
          <label className="block text-[10px] uppercase tracking-[0.15em] text-white/50 mb-2" style={mono}>Video URL <span className="text-white/15 normal-case font-sans">(TikTok, Instagram, YouTube — optional)</span></label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://www.tiktok.com/@brand/video/..."
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
            />
            <button className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)" }}>
              Fetch
            </button>
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.18)" }}>Caption and visible text will be extracted automatically</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>or paste the script directly</span>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.15em] text-white/50 mb-2" style={mono}>Ad script / transcript</label>
          <textarea
            value={adText}
            onChange={e => setAdText(e.target.value)}
            placeholder={"Paste the full transcript, caption, or VO script here...\n\nTip: use Translate → Video → Transcript to extract any video first."}
            rows={6}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors resize-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px]" style={{ ...mono, color: "rgba(255,255,255,0.2)" }}>{adText.length} chars · min 20</span>
            <button onClick={() => setAdText(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])}
              className="text-[10px] transition-colors" style={{ color: "rgba(255,255,255,0.2)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.2)"}>
              Load example →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/50 mb-2">Industry</label>
            <select value={industry} onChange={e => setIndustry(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#111] border border-white/[0.15] text-white text-sm outline-none focus:border-white/20 transition-colors">
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-2">Market context</label>
            <select value={market} onChange={e => setMarket(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#111] border border-white/[0.15] text-white text-sm outline-none focus:border-white/20 transition-colors">
              {[["BR","🇧🇷 Brazil"],["MX","🇲🇽 Mexico"],["US","🇺🇸 United States"],["IN","🇮🇳 India"],["GLOBAL","🌍 Global"]].map(([v,l]) =>
                <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Context (optional) */}
        <div>
          <label className="block text-xs text-white/50 mb-2">Context <span className="text-white/15">(optional — helps AI give better counter-strategies)</span></label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="E.g.: We sell a competing betting app in Brazil. Our USP is instant withdrawals. We want to understand how to beat their hook..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors resize-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
          />
        </div>

        {/* Active persona indicator */}
        {selectedPersona && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)" }}>
            <span className="text-base">{selectedPersona.avatar_emoji || "🎯"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-violet-400/70 font-semibold truncate">Persona: {selectedPersona.name}</p>
              <p className="text-[10px] text-white/45 truncate">{selectedPersona.headline}</p>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-bold" style={mono}>ACTIVE</span>
          </div>
        )}

        <button onClick={decode} disabled={loading || adText.trim().length < 20}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          style={syne}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Decoding ad...</> : <><Search className="h-4 w-4" /> Decode Competitor Ad</>}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {result.mock_mode && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-yellow-400/20 bg-yellow-400/[0.06]">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
              <span className="text-xs text-yellow-400/80">Mock mode — add ANTHROPIC_API_KEY for real analysis</span>
            </div>
          )}

          {/* Top row: Framework + Threat + Score */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Framework */}
            <div className="sm:col-span-1 rounded-2xl border border-white/[0.13] bg-[#0a0a0a] p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2" style={mono}>Framework</p>
              <p className="text-base font-bold text-white" style={syne}>{result.framework}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${HOOK_TYPE_COLORS[result.hook_type] || "text-white/40 bg-white/5 border-white/10"}`}>
                  {result.hook_type?.replace(/_/g, " ")}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/[0.15] text-white/55">
                  {result.creative_model}
                </span>
              </div>
            </div>

            {/* Hook score */}
            <div className="rounded-2xl border border-white/[0.13] bg-[#0a0a0a] p-4 flex flex-col justify-between">
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2" style={mono}>Hook score</p>
              <div>
                <div className="text-3xl font-bold text-white" style={syne}>{result.hook_score.toFixed(1)}<span className="text-base text-white/40">/10</span></div>
                <div className="h-1.5 rounded-full bg-white/[0.06] mt-3 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${(result.hook_score / 10) * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Threat level */}
            {(() => {
              const t = THREAT_CONFIG[result.threat_level] || THREAT_CONFIG.medium;
              return (
                <div className={`rounded-2xl border ${t.border} ${t.bg} p-4`}>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2" style={mono}>Threat level</p>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-5 w-5 shrink-0 ${t.color}`} />
                    <span className={`text-base font-bold ${t.color}`} style={syne}>{t.label}</span>
                  </div>
                  <p className="text-xs text-white/50 mt-2 leading-relaxed">
                    Target: {result.target_audience}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Emotional triggers + Persuasion */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/[0.13] bg-[#0a0a0a] p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3" style={mono}>Emotional triggers</p>
              <div className="flex flex-wrap gap-1.5">
                {result.emotional_triggers?.map(t => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300">{t}</span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.13] bg-[#0a0a0a] p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3" style={mono}>Persuasion tactics</p>
              <div className="flex flex-wrap gap-1.5">
                {result.persuasion_tactics?.map(t => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Strengths + Weaknesses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-green-500/15 bg-green-500/[0.04] p-4">
              <p className="text-[10px] uppercase tracking-widest text-green-400/50 mb-3" style={mono}>What's working</p>
              <ul className="space-y-2">
                {result.strengths?.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/50">
                    <span className="h-4 w-4 rounded-full bg-green-500/15 flex items-center justify-center shrink-0 mt-0.5 text-green-400 text-[9px] font-bold">{i+1}</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.04] p-4">
              <p className="text-[10px] uppercase tracking-widest text-red-400/50 mb-3" style={mono}>What's weak</p>
              <ul className="space-y-2">
                {result.weaknesses?.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/50">
                    <span className="h-4 w-4 rounded-full bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5 text-red-400 text-[9px] font-bold">{i+1}</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Counter strategy */}
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.05] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-purple-400" />
              <p className="text-[10px] uppercase tracking-widest text-purple-400/60" style={mono}>Counter strategy</p>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">{result.counter_strategy}</p>
            <button onClick={() => setShowCounter(!showCounter)}
              className="flex items-center gap-1.5 mt-3 text-xs text-purple-400/50 hover:text-purple-400 transition-colors">
              {showCounter ? <><ChevronUp className="h-3.5 w-3.5" /> Hide</> : <><ChevronDown className="h-3.5 w-3.5" /> Copy strategy</>}
            </button>
            {showCounter && (
              <button onClick={async () => {
                await navigator.clipboard.writeText(result.counter_strategy);
                setCopiedCounter(true); toast.success("Copied!");
                setTimeout(() => setCopiedCounter(false), 2000);
              }} className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.15] text-xs text-white/40 hover:text-white transition-all">
                {copiedCounter ? <><Check className="h-3.5 w-3.5 text-green-400" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy to clipboard</>}
              </button>
            )}
          </div>

          {/* Steal-worthy */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              <p className="text-[10px] uppercase tracking-widest text-amber-400/60" style={mono}>Steal-worthy elements</p>
            </div>
            <ul className="space-y-2">
              {result.steal_worthy?.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/50">
                  <span className="text-amber-400/60 shrink-0">→</span> {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && (
        <div className="rounded-2xl border border-dashed border-white/[0.13] py-16 text-center space-y-3">
          <div className="text-4xl">🔍</div>
          <p className="text-white/50 text-sm font-medium">Paste any competitor ad and decode their playbook</p>
          <p className="text-white/15 text-xs">Works with TikTok captions, Meta ad copy, YouTube scripts, or any ad transcript</p>
        </div>
      )}
    </div>
  );
}
