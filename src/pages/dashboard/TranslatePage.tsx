import { useState, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Globe, ArrowRight, Copy, Check, Upload, Video, X, ChevronDown, Loader2, Plus, Sparkles, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";

const LANGUAGES = [
  { code: "en", flag: "🇺🇸", name: "English",    market: "US / Global" },
  { code: "pt", flag: "🇧🇷", name: "Português",  market: "Brazil" },
  { code: "es", flag: "🇪🇸", name: "Español",    market: "MX / LATAM / ES" },
  { code: "hi", flag: "🇮🇳", name: "Hindi",      market: "India" },
  { code: "fr", flag: "🇫🇷", name: "Français",   market: "France / CA" },
  { code: "de", flag: "🇩🇪", name: "Deutsch",    market: "Germany / AT" },
  { code: "it", flag: "🇮🇹", name: "Italiano",   market: "Italy" },
  { code: "ar", flag: "🇸🇦", name: "عربي",       market: "MENA" },
  { code: "zh", flag: "🇨🇳", name: "中文",        market: "China / TW" },
  { code: "ja", flag: "🇯🇵", name: "日本語",      market: "Japan" },
  { code: "ko", flag: "🇰🇷", name: "한국어",      market: "Korea" },
  { code: "tr", flag: "🇹🇷", name: "Türkçe",     market: "Turkey" },
  { code: "ru", flag: "🇷🇺", name: "Русский",    market: "Russia / CIS" },
  { code: "nl", flag: "🇳🇱", name: "Nederlands", market: "Netherlands" },
  { code: "pl", flag: "🇵🇱", name: "Polski",     market: "Poland" },
  { code: "th", flag: "🇹🇭", name: "ภาษาไทย",    market: "Thailand" },
  { code: "id", flag: "🇮🇩", name: "Bahasa",     market: "Indonesia" },
  { code: "vi", flag: "🇻🇳", name: "Tiếng Việt", market: "Vietnam" },
];

const TONES = ["Aggressive / Urgent", "Conversational", "Professional", "Playful", "Emotional"];

interface TranslationResult {
  lang: string;
  langName: string;
  flag: string;
  translated_text: string;
  cultural_adaptation: string;
  copied: boolean;
}

const syne = { fontFamily: "'Syne', sans-serif" } as const;
const mono = { fontFamily: "'DM Mono', monospace" } as const;

const LangSelector = ({
  value, onChange, exclude = [], label
}: { value: string; onChange: (c: string) => void; exclude?: string[]; label: string }) => {
  const [open, setOpen] = useState(false);
  const lang = LANGUAGES.find(l => l.code === value) || LANGUAGES[0];
  return (
    <div className="relative">
      <p className="text-[10px] uppercase tracking-widest text-white/25 mb-1.5" style={mono}>{label}</p>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] text-white text-sm transition-all">
        <span className="text-base">{lang.flag}</span>
        <span className="font-medium">{lang.name}</span>
        <span className="text-white/25 text-xs ml-1">{lang.market}</span>
        <ChevronDown className="h-3 w-3 text-white/30 ml-1" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-20 rounded-2xl border border-white/[0.08] shadow-2xl p-2 w-64 max-h-72 overflow-y-auto" style={{ background: "#0d0d0d" }}>
            {LANGUAGES.filter(l => !exclude.includes(l.code)).map(l => (
              <button key={l.code} onClick={() => { onChange(l.code); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${l.code === value ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/[0.06]"}`}>
                <span className="text-base">{l.flag}</span>
                <span className="flex-1 text-left">{l.name}</span>
                <span className="text-white/20 text-[10px]">{l.market}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const TranslatePage = () => {
  const { user } = useOutletContext<DashboardContext>();

  const [input, setInput] = useState("");
  const [sourceLang, setSourceLang] = useState("pt");
  const [targetLangs, setTargetLangs] = useState<string[]>(["en"]);
  const [tone, setTone] = useState("Aggressive / Urgent");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TranslationResult[]>([]);

  const addTarget = () => {
    const available = LANGUAGES.filter(l => l.code !== sourceLang && !targetLangs.includes(l.code));
    if (available.length) setTargetLangs(prev => [...prev, available[0].code]);
  };

  const removeTarget = (code: string) => setTargetLangs(prev => prev.filter(c => c !== code));

  const updateTarget = (old: string, next: string) => {
    setTargetLangs(prev => prev.map(c => c === old ? next : c));
  };

  const handleTranslate = async () => {
    if (!input.trim()) { toast.error("Paste a script first"); return; }
    setLoading(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("translate-text", {
        body: {
          source_text: input.trim(),
          from_language: sourceLang,
          from_language_name: LANGUAGES.find(l => l.code === sourceLang)?.name,
          to_language: targetLangs[0],
          to_language_name: LANGUAGES.find(l => l.code === targetLangs[0])?.name,
          multi_targets: targetLangs.length > 1 ? targetLangs : undefined,
          tone,
          context: context.trim() || undefined,
          user_id: user.id,
        },
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
      if (data?.error) throw new Error(data.error);
      if (data?.mock_mode) toast.info("Add ANTHROPIC_API_KEY in Supabase Secrets for real AI translation");

      const rawResults = data.multi ?? [{ lang: targetLangs[0], translated_text: data.translated_text, cultural_adaptation: data.cultural_adaptation }];
      setResults(rawResults.map((r: { lang: string; translated_text: string; cultural_adaptation: string }) => ({
        lang: r.lang,
        langName: LANGUAGES.find(l => l.code === r.lang)?.name || r.lang,
        flag: LANGUAGES.find(l => l.code === r.lang)?.flag || "🌍",
        translated_text: r.translated_text,
        cultural_adaptation: r.cultural_adaptation,
        copied: false,
      })));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Translation failed: ${msg}`);
      console.error("TranslatePage error:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyResult = async (idx: number) => {
    await navigator.clipboard.writeText(results[idx].translated_text);
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, copied: true } : r));
    toast.success("Copied!");
    setTimeout(() => setResults(prev => prev.map((r, i) => i === idx ? { ...r, copied: false } : r)), 2000);
  };

  const copyAll = async () => {
    const text = results.map(r => `=== ${r.flag} ${r.langName} ===\n${r.translated_text}`).join('\n\n');
    await navigator.clipboard.writeText(text);
    toast.success("All translations copied!");
  };

  return (
    <div className="page-enter p-5 lg:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <Globe className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white" style={syne}>Translate & Localize</h1>
          <p className="text-xs text-white/30 mt-0.5">
            AI adapts your ad scripts for any market — preserving hook strength, urgency, and cultural context
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Left: input */}
        <div className="lg:col-span-3 space-y-4">
          {/* Source lang + input */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
              <LangSelector value={sourceLang} onChange={setSourceLang} exclude={targetLangs} label="Source language" />
              <span className="text-[10px] text-white/20" style={mono}>{input.length} chars</span>
            </div>
            <Textarea
              placeholder={"Paste your ad script, VO, caption, or any text here...\n\nTip: paste the full script including hook, body, and CTA for best results."}
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={9}
              className="bg-transparent border-0 resize-none text-white/80 placeholder:text-white/20 focus-visible:ring-0 px-4 py-3 text-sm"
            />
          </div>

          {/* Context */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/25 mb-2" style={mono}>
              Context <span className="text-white/15 normal-case">(optional — product, platform, audience)</span>
            </label>
            <input value={context} onChange={e => setContext(e.target.value)}
              placeholder='e.g. "iGaming app, TikTok, 25-35 male audience"'
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] text-white/70 placeholder:text-white/20 text-sm outline-none focus:border-white/15 transition-colors" />
          </div>

          {/* Tone */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/25 mb-2" style={mono}>Tone</label>
            <div className="flex flex-wrap gap-1.5">
              {TONES.map(t => (
                <button key={t} onClick={() => setTone(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${tone === t ? "bg-white text-black border-white font-semibold" : "border-white/[0.07] text-white/35 hover:border-white/15 hover:text-white/60"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: targets + run */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] uppercase tracking-widest text-white/25" style={mono}>Translate to</label>
              {targetLangs.length < 5 && (
                <button onClick={addTarget} className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/60 transition-colors">
                  <Plus className="h-3 w-3" /> Add language
                </button>
              )}
            </div>
            <div className="space-y-2">
              {targetLangs.map((code, idx) => {
                const lang = LANGUAGES.find(l => l.code === code)!;
                return (
                  <div key={code} className="flex items-center gap-2">
                    <div className="flex-1">
                      <LangSelector value={code} onChange={next => updateTarget(code, next)}
                        exclude={[sourceLang, ...targetLangs.filter(c => c !== code)]}
                        label="" />
                    </div>
                    {targetLangs.length > 1 && (
                      <button onClick={() => removeTarget(code)}
                        className="h-8 w-8 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/25 hover:text-red-400 hover:border-red-400/25 transition-all mt-0.5">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Market summary */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-white/20 mb-2" style={mono}>Coverage</p>
            {targetLangs.map(code => {
              const l = LANGUAGES.find(ll => ll.code === code);
              return l ? (
                <div key={code} className="flex items-center gap-2">
                  <span className="text-base">{l.flag}</span>
                  <div>
                    <p className="text-xs text-white/60 font-medium">{l.name}</p>
                    <p className="text-[10px] text-white/25">{l.market}</p>
                  </div>
                </div>
              ) : null;
            })}
          </div>

          <button onClick={handleTranslate} disabled={loading || !input.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white text-black font-bold text-sm hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            style={syne}>
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Translating {targetLangs.length > 1 ? `${targetLangs.length} languages` : ""}...</>
              : <><Sparkles className="h-4 w-4" /> Translate {targetLangs.length > 1 ? `to ${targetLangs.length} languages` : `to ${LANGUAGES.find(l=>l.code===targetLangs[0])?.name}`}</>
            }
          </button>

          {/* Tip */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/15">
            <Info className="h-3.5 w-3.5 text-emerald-400/60 shrink-0 mt-0.5" />
            <p className="text-[11px] text-white/30 leading-relaxed">
              AI preserves hook strength and adapts cultural references — not a literal translation
            </p>
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white" style={syne}>
              {results.length} translation{results.length > 1 ? 's' : ''} ready
            </h2>
            {results.length > 1 && (
              <button onClick={copyAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.07] text-xs text-white/40 hover:text-white transition-all">
                <Copy className="h-3.5 w-3.5" /> Copy all
              </button>
            )}
          </div>

          <div className={`grid gap-4 ${results.length > 1 ? 'md:grid-cols-2' : ''}`}>
            {results.map((r, i) => (
              <div key={r.lang} className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{r.flag}</span>
                    <div>
                      <p className="text-sm font-semibold text-white" style={syne}>{r.langName}</p>
                      <p className="text-[10px] text-white/25">{LANGUAGES.find(l => l.code === r.lang)?.market}</p>
                    </div>
                  </div>
                  <button onClick={() => copyResult(i)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.07] text-xs text-white/40 hover:text-white transition-all">
                    {r.copied ? <><Check className="h-3.5 w-3.5 text-green-400" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                  </button>
                </div>

                {/* Translated text */}
                <Textarea
                  value={r.translated_text}
                  readOnly
                  rows={6}
                  className="bg-transparent border-0 resize-none text-white/75 focus-visible:ring-0 px-4 py-3 text-sm"
                />

                {/* Cultural notes */}
                {r.cultural_adaptation && (
                  <div className="px-4 pb-4">
                    <div className="rounded-xl bg-emerald-500/[0.05] border border-emerald-500/15 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-emerald-400/50 mb-1.5" style={mono}>Cultural adaptation notes</p>
                      <p className="text-[11px] text-white/40 leading-relaxed">{r.cultural_adaptation}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/[0.06] py-14 text-center space-y-3">
          <div className="text-4xl">🌍</div>
          <p className="text-white/30 text-sm font-medium">Paste a script and choose your target markets</p>
          <p className="text-white/15 text-xs">Supports 18 languages · Cultural adaptation included · Translate to 5 markets at once</p>
        </div>
      )}
    </div>
  );
};

export default TranslatePage;
