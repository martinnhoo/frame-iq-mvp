import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, AlertTriangle, TrendingUp, Shield, Copy, Check, Link, FileText, Zap } from "lucide-react";
import { toast } from "sonner";

interface DecodeResult {
  framework: string; hook_type: string; hook_score: number; hook_strength: string;
  emotional_triggers: string[]; persuasion_tactics: string[]; target_audience: string;
  creative_model: string; strengths: string[]; weaknesses: string[];
  counter_strategy: string; steal_worthy: string[]; threat_level: string; mock_mode?: boolean;
}

const THREAT_CONFIG: Record<string, { label_pt: string; label_en: string; label_es: string; color: string; bg: string; border: string }> = {
  critical: { label_pt: "Ameaça crítica",  label_en: "Critical threat", label_es: "Amenaza crítica",  color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/25" },
  high:     { label_pt: "Ameaça alta",     label_en: "High threat",     label_es: "Amenaza alta",     color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/25" },
  medium:   { label_pt: "Ameaça média",    label_en: "Medium threat",   label_es: "Amenaza media",    color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/25" },
  low:      { label_pt: "Ameaça baixa",    label_en: "Low threat",      label_es: "Amenaza baja",     color: "text-green-400",  bg: "bg-green-400/10",  border: "border-green-400/25" },
};

const HOOK_TYPE_COLORS: Record<string, string> = {
  curiosity:         "text-sky-400 bg-sky-400/10 border-sky-400/20",
  pain_point:        "text-red-400 bg-red-400/10 border-red-400/20",
  social_proof:      "text-green-400 bg-green-400/10 border-green-400/20",
  pattern_interrupt: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  direct_offer:      "text-blue-400 bg-blue-400/10 border-blue-400/20",
  emotional:         "text-pink-400 bg-pink-400/10 border-pink-400/20",
  question:          "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
};

const INDUSTRIES = ["iGaming / Betting", "E-commerce / DTC", "Finance / Fintech", "Health & Wellness", "SaaS / Tech", "Fashion / Beauty", "Food & Beverage", "Real Estate", "Education", "Other"];
const MARKETS = ["BR", "MX", "US", "UK", "ES", "AR", "CO", "IN", "FR", "DE"];

const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const mono = { fontFamily: "'Inter', sans-serif" } as const;

const UI: Record<string, Record<string, string>> = {
  pt: {
    title: "Decodificador de Concorrente", sub: "Cole qualquer anúncio — a IA decodifica o framework, gatilhos e como superar",
    url_label: "URL do vídeo", url_placeholder: "https://www.tiktok.com/@marca/video/...",
    url_note: "Cole a URL e clique em buscar — extrairemos a legenda automaticamente",
    fetch: "Buscar", fetching: "Buscando...", or: "ou cole o roteiro diretamente",
    script_label: "Roteiro / Transcrição do anúncio",
    script_placeholder: "Cole o roteiro completo, legenda ou VO aqui...\n\nDica: use Traduzir → Vídeo → Transcrição para extrair qualquer vídeo.",
    industry_label: "Setor / Nicho", market_label: "Mercado",
    context_label: "Contexto adicional (opcional)",
    context_placeholder: "Ex: \"Meu produto é um app de apostas para o público BR 25-35\"",
    decode_btn: "Decodificar anúncio", decoding: "Decodificando...",
    need_more: "Cole pelo menos 20 caracteres do anúncio",
    framework: "Framework", hook_score: "Score do hook", threat_level: "Nível de ameaça",
    target: "Público-alvo", emotional: "Gatilhos emocionais", persuasion: "Táticas de persuasão",
    strengths: "O que funciona", weaknesses: "O que é fraco", counter: "Estratégia de contra-ataque",
    steal: "Elementos para copiar", copy_strategy: "Copiar estratégia", copied: "Copiado!",
    copy_clip: "Copiar para clipboard",
    empty_title: "Cole qualquer anúncio e decodifique o playbook do concorrente",
    empty_sub: "Funciona com legendas do TikTok, copy de Meta Ads, roteiros do YouTube ou qualquer transcrição",
    tip_title: "Como obter o roteiro", tip_body: "Não tem a transcrição? Use",
    tip_link: "Traduzir → Vídeo → Transcrição", tip_end: "para extrair de qualquer vídeo e cole aqui.",
  },
  es: {
    title: "Decodificador de Competidor", sub: "Pega cualquier anuncio — la IA decodifica el framework, disparadores y cómo superarlo",
    url_label: "URL del video", url_placeholder: "https://www.tiktok.com/@marca/video/...",
    url_note: "Pega la URL y haz clic en buscar — extraeremos la descripción automáticamente",
    fetch: "Buscar", fetching: "Buscando...", or: "o pega el guión directamente",
    script_label: "Guión / Transcripción del anuncio",
    script_placeholder: "Pega el guión completo, descripción o VO aquí...",
    industry_label: "Sector / Nicho", market_label: "Mercado",
    context_label: "Contexto adicional (opcional)",
    context_placeholder: "Ej: \"Mi producto es una app de apuestas para público MX 25-35\"",
    decode_btn: "Decodificar anuncio", decoding: "Decodificando...",
    need_more: "Pega al menos 20 caracteres del anuncio",
    framework: "Framework", hook_score: "Score del hook", threat_level: "Nivel de amenaza",
    target: "Audiencia objetivo", emotional: "Disparadores emocionales", persuasion: "Tácticas de persuasión",
    strengths: "Lo que funciona", weaknesses: "Lo que es débil", counter: "Estrategia de contraataque",
    steal: "Elementos para copiar", copy_strategy: "Copiar estrategia", copied: "¡Copiado!",
    copy_clip: "Copiar al portapapeles",
    empty_title: "Pega cualquier anuncio y decodifica el playbook del competidor",
    empty_sub: "Funciona con descripciones de TikTok, copy de Meta Ads, guiones de YouTube o cualquier transcripción",
    tip_title: "Cómo obtener el guión", tip_body: "¿No tienes la transcripción? Usa",
    tip_link: "Traducir → Video → Transcripción", tip_end: "para extraer de cualquier video y pega aquí.",
  },
  en: {
    title: "Competitor Pattern Decoder", sub: "Paste any competitor ad — AI decodes the framework, tactics, and how to counter it",
    url_label: "Video URL", url_placeholder: "https://www.tiktok.com/@brand/video/...",
    url_note: "Paste the URL and click fetch — we'll extract the caption automatically",
    fetch: "Fetch", fetching: "Fetching...", or: "or paste the script directly",
    script_label: "Ad script / transcript",
    script_placeholder: "Paste the full transcript, caption, or VO script here...\n\nTip: use Translate → Video → Transcript to extract any video first.",
    industry_label: "Industry / Niche", market_label: "Market",
    context_label: "Additional context (optional)",
    context_placeholder: 'e.g. "My product is a betting app targeting BR audience 25-35"',
    decode_btn: "Decode ad", decoding: "Decoding...",
    need_more: "Paste at least 20 characters of the ad",
    framework: "Framework", hook_score: "Hook score", threat_level: "Threat level",
    target: "Target audience", emotional: "Emotional triggers", persuasion: "Persuasion tactics",
    strengths: "What's working", weaknesses: "What's weak", counter: "Counter strategy",
    steal: "Steal-worthy elements", copy_strategy: "Copy strategy", copied: "Copied!",
    copy_clip: "Copy to clipboard",
    empty_title: "Paste any competitor ad and decode their playbook",
    empty_sub: "Works with TikTok captions, Meta ad copy, YouTube scripts, or any ad transcript",
    tip_title: "How to get the ad script", tip_body: "Don't have the transcript yet? Use",
    tip_link: "Translate → Video → Transcript", tip_end: "to extract the script from any video, then paste it here.",
  },
};

export default function CompetitorDecoder() {
  const { selectedPersona } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const t = UI[language] || UI.en;

  const [mode, setMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [adText, setAdText] = useState("");
  const [industry, setIndustry] = useState("iGaming / Betting");
  const [market, setMarket] = useState("BR");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchUrl = async () => {
    if (!url.trim()) return;
    setFetching(true);
    try {
      // Extract caption from URL by passing it as the ad text for analysis
      setAdText(url.trim());
      setMode("text");
      toast.success(language === "pt" ? "URL capturada — clique em Decodificar" : language === "es" ? "URL capturada — haz clic en Decodificar" : "URL captured — click Decode to analyze");
    } finally {
      setFetching(false);
    }
  };

  const decode = async () => {
    const textToAnalyze = mode === "url" ? url.trim() : adText.trim();
    if (textToAnalyze.length < 10) { toast.error(t.need_more); return; }
    setLoading(true);
    setResult(null);
    try {
      const personaCtx = selectedPersona
        ? `Account: ${selectedPersona.name}. Pains: ${selectedPersona.pains?.join(", ")}. Best platforms: ${selectedPersona.best_platforms?.join(", ")}.`
        : undefined;
      const { data, error } = await supabase.functions.invoke("decode-competitor", {
        body: { ad_text: textToAnalyze, industry, market, context: context.trim() || undefined, persona_context: personaCtx },
      });
      if (error) throw error;
      setResult(data);
    } catch {
      toast.error(language === "pt" ? "Decodificação falhou" : language === "es" ? "Decodificación fallida" : "Decoding failed");
    } finally {
      setLoading(false);
    }
  };

  const threatLabel = (key: string) => {
    const c = THREAT_CONFIG[key] || THREAT_CONFIG.medium;
    return language === "pt" ? c.label_pt : language === "es" ? c.label_es : c.label_en;
  };

  return (
    <div className="page-enter p-5 lg:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.2)" }}>
          <Search className="h-5 w-5" style={{ color: "#22d3ee" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white" style={syne}>{t.title}</h1>
          <p className="text-xs text-white/50 mt-0.5">{t.sub}</p>
        </div>
      </div>

      {/* Tip banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl" style={{ background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.14)" }}>
        <span className="text-base shrink-0 mt-0.5">💡</span>
        <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
          <span className="text-white font-semibold">{t.tip_title}:</span> {t.tip_body}{" "}
          <a href="/dashboard/translate" className="underline" style={{ color: "#22d3ee" }}>{t.tip_link}</a>
          {" "}{t.tip_end}
        </p>
      </div>

      {/* Input */}
      <div className="rounded-2xl border border-white/[0.1] bg-[#0a0a0a] overflow-hidden">
        {/* Mode tabs */}
        <div className="flex border-b border-white/[0.07]">
          <button onClick={() => setMode("url")}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all"
            style={mode === "url" ? { background: "rgba(34,211,238,0.08)", color: "#22d3ee", borderBottom: "2px solid #22d3ee" } : { color: "rgba(255,255,255,0.35)" }}>
            <Link className="h-3.5 w-3.5" /> URL
          </button>
          <button onClick={() => setMode("text")}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all"
            style={mode === "text" ? { background: "rgba(34,211,238,0.08)", color: "#22d3ee", borderBottom: "2px solid #22d3ee" } : { color: "rgba(255,255,255,0.35)" }}>
            <FileText className="h-3.5 w-3.5" /> {language === "pt" ? "Roteiro" : language === "es" ? "Guión" : "Script"}
          </button>
        </div>

        <div className="p-5 space-y-4">
          {mode === "url" ? (
            <div>
              <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2" style={mono}>{t.url_label}</label>
              <div className="flex gap-2">
                <input type="url" value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && fetchUrl()}
                  placeholder={t.url_placeholder}
                  className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }} />
                <button onClick={fetchUrl} disabled={fetching || !url.trim()}
                  className="px-5 py-3 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
                  style={{ background: "rgba(34,211,238,0.12)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.22)" }}>
                  {fetching ? <><Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" />{t.fetching}</> : t.fetch}
                </button>
              </div>
              <p className="text-[10px] mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>{t.url_note}</p>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2" style={mono}>{t.script_label}</label>
              <textarea value={adText} onChange={e => setAdText(e.target.value)} rows={5}
                placeholder={t.script_placeholder}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors resize-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", lineHeight: 1.6 }} />
            </div>
          )}

          {/* Industry + Market */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2" style={mono}>{t.industry_label}</label>
              <select value={industry} onChange={e => setIndustry(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2" style={mono}>{t.market_label}</label>
              <select value={market} onChange={e => setMarket(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>
                {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Context */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2" style={mono}>{t.context_label}</label>
            <input value={context} onChange={e => setContext(e.target.value)}
              placeholder={t.context_placeholder}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
          </div>

          <button onClick={decode} disabled={loading || (mode === "url" ? !url.trim() : !adText.trim())}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-30"
            style={{ background: loading ? "rgba(34,211,238,0.1)" : "#22d3ee", color: "#000" }}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {t.decoding}</> : <><Zap className="h-4 w-4" /> {t.decode_btn}</>}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Top row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/[0.1] bg-[#0a0a0a] p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/35 mb-2" style={mono}>{t.framework}</p>
              <p className="text-base font-bold text-white" style={syne}>{result.framework}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${HOOK_TYPE_COLORS[result.hook_type] || "text-white/40 bg-white/5 border-white/10"}`}>
                  {result.hook_type?.replace(/_/g, " ")}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/[0.15] text-white/45">{result.creative_model}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.1] bg-[#0a0a0a] p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/35 mb-2" style={mono}>{t.hook_score}</p>
              <div className="text-3xl font-bold text-white" style={syne}>{result.hook_score?.toFixed(1)}<span className="text-base text-white/35">/10</span></div>
              <div className="h-1.5 rounded-full bg-white/[0.06] mt-3 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${((result.hook_score || 0) / 10) * 100}%` }} />
              </div>
            </div>

            {(() => {
              const tc = THREAT_CONFIG[result.threat_level] || THREAT_CONFIG.medium;
              return (
                <div className={`rounded-2xl border ${tc.border} ${tc.bg} p-4`}>
                  <p className="text-[10px] uppercase tracking-widest text-white/35 mb-2" style={mono}>{t.threat_level}</p>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-5 w-5 shrink-0 ${tc.color}`} />
                    <span className={`text-base font-bold ${tc.color}`} style={syne}>{threatLabel(result.threat_level)}</span>
                  </div>
                  <p className="text-xs text-white/45 mt-2 leading-relaxed">{t.target}: {result.target_audience}</p>
                </div>
              );
            })()}
          </div>

          {/* Triggers + Persuasion */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/[0.1] bg-[#0a0a0a] p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/35 mb-3" style={mono}>{t.emotional}</p>
              <div className="flex flex-wrap gap-1.5">
                {result.emotional_triggers?.map(trigger => (
                  <span key={trigger} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.2)", color: "#f9a8d4" }}>{trigger}</span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.1] bg-[#0a0a0a] p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/35 mb-3" style={mono}>{t.persuasion}</p>
              <div className="flex flex-wrap gap-1.5">
                {result.persuasion_tactics?.map(tactic => (
                  <span key={tactic} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", color: "#93c5fd" }}>{tactic}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Strengths + Weaknesses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl p-4" style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)" }}>
              <p className="text-[10px] uppercase tracking-widest mb-3" style={{ ...mono, color: "rgba(134,239,172,0.5)" }}>{t.strengths}</p>
              <ul className="space-y-2">
                {result.strengths?.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/50">
                    <span className="h-4 w-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold" style={{ background: "rgba(34,197,94,0.15)", color: "#86efac" }}>{i+1}</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)" }}>
              <p className="text-[10px] uppercase tracking-widest mb-3" style={{ ...mono, color: "rgba(252,165,165,0.5)" }}>{t.weaknesses}</p>
              <ul className="space-y-2">
                {result.weaknesses?.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/50">
                    <span className="h-4 w-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold" style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5" }}>{i+1}</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Counter strategy */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.2)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" style={{ color: "#0ea5e9" }} />
                <p className="text-[10px] uppercase tracking-widest" style={{ ...mono, color: "rgba(14,165,233,0.6)" }}>{t.counter}</p>
              </div>
              <button onClick={async () => {
                await navigator.clipboard.writeText(result.counter_strategy);
                setCopied(true); toast.success(t.copied);
                setTimeout(() => setCopied(false), 2000);
              }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all" style={{ background: "rgba(14,165,233,0.1)", color: "#0ea5e9", border: "1px solid rgba(14,165,233,0.2)" }}>
                {copied ? <><Check className="h-3.5 w-3.5" /> {t.copied}</> : <><Copy className="h-3.5 w-3.5" /> {t.copy_strategy}</>}
              </button>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">{result.counter_strategy}</p>
          </div>

          {/* Steal-worthy */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4" style={{ color: "#fbbf24" }} />
              <p className="text-[10px] uppercase tracking-widest" style={{ ...mono, color: "rgba(251,191,36,0.6)" }}>{t.steal}</p>
            </div>
            <ul className="space-y-2">
              {result.steal_worthy?.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/55">
                  <span style={{ color: "rgba(251,191,36,0.6)", flexShrink: 0 }}>→</span> {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!loading && !result && (
        <div className="rounded-2xl border border-dashed border-white/[0.1] py-16 text-center space-y-3">
          <div className="text-4xl">🔍</div>
          <p className="text-white/50 text-sm font-medium">{t.empty_title}</p>
          <p className="text-white/15 text-xs">{t.empty_sub}</p>
        </div>
      )}
    </div>
  );
}
