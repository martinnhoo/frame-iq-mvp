import { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, AlertTriangle, TrendingUp, Shield, Copy, Check, FileText, Zap, ChevronRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface DecodeResult {
  mismatch_detected?: boolean;
  mismatch_reason?: string;
  framework: string;
  hook_type: string;
  hook_formula?: string;
  hook_score: number;
  hook_strength: string;
  emotional_triggers: string[];
  persuasion_tactics: string[];
  target_audience: string;
  creative_model: string;
  cta_formula?: string;
  strengths: string[];
  weaknesses: string[];
  counter_strategy: string;
  steal_worthy: string[];
  ready_hooks?: string[];
  threat_level: string;
}

const THREAT: Record<string, { pt: string; es: string; en: string; color: string; bg: string; border: string }> = {
  critical: { pt:"Ameaça crítica",  es:"Amenaza crítica",  en:"Critical threat", color:"#f87171", bg:"rgba(248,113,113,0.08)",  border:"rgba(248,113,113,0.25)" },
  high:     { pt:"Ameaça alta",     es:"Amenaza alta",     en:"High threat",     color:"#fb923c", bg:"rgba(251,146,60,0.08)",   border:"rgba(251,146,60,0.25)" },
  medium:   { pt:"Ameaça média",    es:"Amenaza media",    en:"Medium threat",   color:"#fbbf24", bg:"rgba(251,191,36,0.08)",   border:"rgba(251,191,36,0.25)" },
  low:      { pt:"Ameaça baixa",    es:"Amenaza baja",     en:"Low threat",      color:"#34d399", bg:"rgba(52,211,153,0.08)",   border:"rgba(52,211,153,0.25)" },
};

const HOOK_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  curiosity:         { color:"#38bdf8", bg:"rgba(56,189,248,0.10)",  border:"rgba(56,189,248,0.20)" },
  pain_point:        { color:"#f87171", bg:"rgba(248,113,113,0.10)", border:"rgba(248,113,113,0.20)" },
  social_proof:      { color:"#4ade80", bg:"rgba(74,222,128,0.10)",  border:"rgba(74,222,128,0.20)" },
  pattern_interrupt: { color:"#fb923c", bg:"rgba(251,146,60,0.10)",  border:"rgba(251,146,60,0.20)" },
  direct_offer:      { color:"#60a5fa", bg:"rgba(96,165,250,0.10)",  border:"rgba(96,165,250,0.20)" },
  emotional:         { color:"#f472b6", bg:"rgba(244,114,182,0.10)", border:"rgba(244,114,182,0.20)" },
  question:          { color:"#34d399", bg:"rgba(52,211,153,0.10)",  border:"rgba(52,211,153,0.20)" },
};

const INDUSTRIES = ["iGaming / Betting","E-commerce / DTC","Finance / Fintech","Health & Wellness","SaaS / Tech","Fashion / Beauty","Food & Beverage","Real Estate","Education","Other"];
const MARKETS = ["BR","MX","US","UK","ES","AR","CO","IN","FR","DE"];

const F = { fontFamily:"'Plus Jakarta Sans', sans-serif" } as const;
const M = { fontFamily:"'Inter', sans-serif" } as const;

const T: Record<string, Record<string,string>> = {
  pt: {
    title:"Decodificador de Concorrente", sub:"Cole qualquer anúncio — a IA decodifica o framework, gatilhos e como superar",
    script_label:"Roteiro / Transcrição do anúncio",
    script_placeholder:"Cole o roteiro completo, legenda ou VO aqui...\n\nDica: use Traduzir → Vídeo → Transcrição para extrair qualquer vídeo.",
    industry_label:"Setor / Nicho", market_label:"Mercado",
    context_label:"Contexto do seu produto (opcional, mas recomendado)",
    context_placeholder:"Ex: \"Meu produto é um app de apostas para o público BR 25-35\"",
    decode_btn:"Decodificar anúncio", decoding:"Decodificando...",
    need_more:"Cole pelo menos 20 caracteres do anúncio",
    mismatch_title:"⚠️ Revisão necessária",
    framework:"Framework", hook_score:"Score do hook", threat_level:"Nível de ameaça",
    hook_formula:"Fórmula do hook", cta_formula:"Fórmula do CTA",
    target:"Público-alvo", emotional:"Gatilhos emocionais", persuasion:"Táticas de persuasão",
    strengths:"O que funciona", weaknesses:"O que é fraco",
    counter:"Estratégia de contra-ataque", steal:"Elementos para adaptar",
    ready_hooks:"Hooks prontos para usar", copy_hook:"Copiar hook",
    copy_strategy:"Copiar estratégia", copied:"Copiado!",
    go_script:"→ Roteiro",
    empty_title:"Cole qualquer anúncio e decodifique o playbook do concorrente",
    empty_sub:"Funciona com legendas do TikTok, copy de Meta Ads, roteiros do YouTube ou qualquer transcrição",
    tip:"Não tem a transcrição? Use", tip_link:"Traduzir → Vídeo → Transcrição", tip_end:"para extrair de qualquer vídeo.",
  },
  es: {
    title:"Decodificador de Competidor", sub:"Pega cualquier anuncio — la IA decodifica el framework, disparadores y cómo superarlo",
    script_label:"Guión / Transcripción del anuncio",
    script_placeholder:"Pega el guión completo, descripción o VO aquí...",
    industry_label:"Sector / Nicho", market_label:"Mercado",
    context_label:"Contexto de tu producto (opcional, recomendado)",
    context_placeholder:"Ej: \"Mi producto es una app de apuestas para público MX 25-35\"",
    decode_btn:"Decodificar anuncio", decoding:"Decodificando...",
    need_more:"Pega al menos 20 caracteres del anuncio",
    mismatch_title:"⚠️ Revisión necesaria",
    framework:"Framework", hook_score:"Score del hook", threat_level:"Nivel de amenaza",
    hook_formula:"Fórmula del hook", cta_formula:"Fórmula del CTA",
    target:"Audiencia objetivo", emotional:"Disparadores emocionales", persuasion:"Tácticas de persuasión",
    strengths:"Lo que funciona", weaknesses:"Lo que es débil",
    counter:"Estrategia de contraataque", steal:"Elementos para adaptar",
    ready_hooks:"Hooks listos para usar", copy_hook:"Copiar hook",
    copy_strategy:"Copiar estrategia", copied:"¡Copiado!",
    go_script:"→ Guión",
    empty_title:"Pega cualquier anuncio y decodifica el playbook del competidor",
    empty_sub:"Funciona con descripciones de TikTok, copy de Meta Ads, guiones de YouTube o cualquier transcripción",
    tip:"¿Sin transcripción? Usa", tip_link:"Traducir → Video → Transcripción", tip_end:"para extraer de cualquier video.",
  },
  en: {
    title:"Competitor Pattern Decoder", sub:"Paste any competitor ad — AI decodes the framework, tactics, and how to counter it",
    script_label:"Ad script / transcript",
    script_placeholder:"Paste the full transcript, caption, or VO script here...\n\nTip: use Translate → Video → Transcript to extract any video.",
    industry_label:"Industry / Niche", market_label:"Market",
    context_label:"Your product context (optional, recommended)",
    context_placeholder:'e.g. "My product is a betting app targeting BR audience 25-35"',
    decode_btn:"Decode ad", decoding:"Decoding...",
    need_more:"Paste at least 20 characters of the ad",
    mismatch_title:"⚠️ Review required",
    framework:"Framework", hook_score:"Hook score", threat_level:"Threat level",
    hook_formula:"Hook formula", cta_formula:"CTA formula",
    target:"Target audience", emotional:"Emotional triggers", persuasion:"Persuasion tactics",
    strengths:"What's working", weaknesses:"What's weak",
    counter:"Counter strategy", steal:"Elements to adapt",
    ready_hooks:"Ready-to-use hooks", copy_hook:"Copy hook",
    copy_strategy:"Copy strategy", copied:"Copied!",
    go_script:"→ Script",
    empty_title:"Paste any competitor ad and decode their playbook",
    empty_sub:"Works with TikTok captions, Meta ad copy, YouTube scripts, or any ad transcript",
    tip:"No transcript yet? Use", tip_link:"Translate → Video → Transcript", tip_end:"to extract from any video.",
  },
};

function Tag({ label, color, bg, border }: { label:string; color:string; bg:string; border:string }) {
  return (
    <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600, color, background:bg, border:`1px solid ${border}`, padding:"3px 10px", borderRadius:20, whiteSpace:"nowrap" as const }}>
      {label}
    </span>
  );
}

function Section({ label, color="#22d3ee", children }: { label:string; color?:string; children:React.ReactNode }) {
  return (
    <div style={{ padding:"16px 18px", borderRadius:14, background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.08)" }}>
      <p style={{ ...M, fontSize:10, fontWeight:700, color:`${color}80`, letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:10 }}>{label}</p>
      {children}
    </div>
  );
}

export default function CompetitorDecoder() {
  const { selectedPersona } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = T[language] || T.en;
  const lang = language as "pt"|"es"|"en";

  const [adText, setAdText] = useState("");
  const [industry, setIndustry] = useState("iGaming / Betting");
  const [market, setMarket] = useState("BR");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number|null>(null);
  const [copiedCounter, setCopiedCounter] = useState(false);

  const decode = async () => {
    if (adText.trim().length < 20) { toast.error(t.need_more); return; }
    setLoading(true);
    setResult(null);
    try {
      const personaCtx = selectedPersona
        ? `Account: ${selectedPersona.name}. Pains: ${(selectedPersona as any).pains?.join(", ")}. Best platforms: ${(selectedPersona as any).best_platforms?.join(", ")}.`
        : undefined;
      const { data, error } = await supabase.functions.invoke("decode-competitor", {
        body: { ad_text: adText.trim(), industry, market, context: context.trim() || undefined, persona_context: personaCtx },
      });
      if (error) throw error;
      setResult(data);
      if (data?.mismatch_detected) {
        toast.warning(lang==="pt" ? "Mismatch detectado — revise o contexto" : lang==="es" ? "Mismatch detectado — revisa el contexto" : "Mismatch detected — review your context");
      }
    } catch {
      toast.error(lang==="pt" ? "Decodificação falhou" : lang==="es" ? "Decodificación fallida" : "Decoding failed");
    } finally {
      setLoading(false);
    }
  };

  const copyHook = async (hook: string, idx: number) => {
    await navigator.clipboard.writeText(hook);
    setCopiedIdx(idx);
    toast.success(t.copied);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const threat = result ? (THREAT[result.threat_level] || THREAT.medium) : null;
  const hookColor = result ? (HOOK_COLORS[result.hook_type] || HOOK_COLORS.curiosity) : null;
  const threatLabel = threat ? (lang==="pt" ? threat.pt : lang==="es" ? threat.es : threat.en) : "";

  return (
    <div style={{ padding:"20px 20px 40px", maxWidth:780, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <div style={{ width:38, height:38, borderRadius:12, background:"rgba(34,211,238,0.10)", border:"1px solid rgba(34,211,238,0.20)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <Search size={18} color="#22d3ee" />
        </div>
        <div>
          <h1 style={{ ...F, fontSize:17, fontWeight:800, color:"#eef0f6", margin:0, letterSpacing:"-0.02em" }}>{t.title}</h1>
          <p style={{ ...M, fontSize:12, color:"rgba(238,240,246,0.45)", marginTop:2 }}>{t.sub}</p>
        </div>
      </div>

      {/* Tip */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:10, background:"rgba(34,211,238,0.04)", border:"1px solid rgba(34,211,238,0.12)", marginBottom:20 }}>
        <span style={{ fontSize:14, flexShrink:0 }}>💡</span>
        <p style={{ ...M, fontSize:11.5, color:"rgba(238,240,246,0.45)", margin:0 }}>
          {t.tip}{" "}
          <a href="/dashboard/translate" style={{ color:"#22d3ee", textDecoration:"underline" }}>{t.tip_link}</a>
          {" "}{t.tip_end}
        </p>
      </div>

      {/* Input card */}
      <div style={{ borderRadius:16, border:"1px solid rgba(255,255,255,0.09)", background:"#131720", overflow:"hidden", marginBottom:16 }}>
        <div style={{ padding:"16px 18px", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          <label style={{ ...M, display:"block", fontSize:10, fontWeight:700, color:"rgba(238,240,246,0.35)", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:8 }}>{t.script_label}</label>
          <textarea value={adText} onChange={e => setAdText(e.target.value)} rows={5}
            placeholder={t.script_placeholder}
            style={{ width:"100%", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:10, padding:"10px 14px", color:"#eef0f6", ...M, fontSize:13, resize:"vertical" as const, outline:"none", lineHeight:1.6, boxSizing:"border-box" as const, minHeight:110 }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(34,211,238,0.35)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
          />
        </div>

        <div style={{ padding:"14px 18px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          <div>
            <label style={{ ...M, display:"block", fontSize:10, fontWeight:700, color:"rgba(238,240,246,0.35)", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:6 }}>{t.industry_label}</label>
            <select value={industry} onChange={e => setIndustry(e.target.value)}
              style={{ width:"100%", background:"#1a2032", border:"1px solid rgba(255,255,255,0.09)", borderRadius:9, padding:"8px 12px", color:"#eef0f6", ...M, fontSize:12, outline:"none", cursor:"pointer", boxSizing:"border-box" as const }}>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label style={{ ...M, display:"block", fontSize:10, fontWeight:700, color:"rgba(238,240,246,0.35)", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:6 }}>{t.market_label}</label>
            <select value={market} onChange={e => setMarket(e.target.value)}
              style={{ width:"100%", background:"#1a2032", border:"1px solid rgba(255,255,255,0.09)", borderRadius:9, padding:"8px 12px", color:"#eef0f6", ...M, fontSize:12, outline:"none", cursor:"pointer", boxSizing:"border-box" as const }}>
              {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div style={{ padding:"14px 18px 18px" }}>
          <label style={{ ...M, display:"block", fontSize:10, fontWeight:700, color:"rgba(238,240,246,0.35)", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:6 }}>{t.context_label}</label>
          <input value={context} onChange={e => setContext(e.target.value)}
            placeholder={t.context_placeholder}
            style={{ width:"100%", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:9, padding:"9px 14px", color:"#eef0f6", ...M, fontSize:13, outline:"none", boxSizing:"border-box" as const }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(34,211,238,0.35)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
          />
        </div>
      </div>

      <button onClick={decode} disabled={loading || adText.trim().length < 20}
        style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"13px", borderRadius:12, background: loading ? "rgba(34,211,238,0.10)" : "#22d3ee", border:"none", cursor: adText.trim().length >= 20 && !loading ? "pointer" : "not-allowed", ...F, fontSize:14, fontWeight:800, color: loading ? "#22d3ee" : "#000", marginBottom:24, opacity: adText.trim().length < 20 ? 0.4 : 1, transition:"all 0.15s" }}>
        {loading ? <><Loader2 size={16} className="animate-spin" /> {t.decoding}</> : <><Zap size={16} /> {t.decode_btn}</>}
      </button>

      {/* RESULTS */}
      {result && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

          {/* MISMATCH WARNING — shown prominently if detected */}
          {result.mismatch_detected && result.mismatch_reason && (
            <div style={{ padding:"16px 18px", borderRadius:14, background:"rgba(251,191,36,0.08)", border:"2px solid rgba(251,191,36,0.35)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <AlertCircle size={18} color="#fbbf24" />
                <p style={{ ...F, fontSize:14, fontWeight:800, color:"#fbbf24", margin:0 }}>{t.mismatch_title}</p>
              </div>
              <p style={{ ...M, fontSize:13, color:"rgba(238,240,246,0.70)", lineHeight:1.6, margin:0 }}>{result.mismatch_reason}</p>
            </div>
          )}

          {/* Top metrics row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            {/* Framework */}
            <div style={{ padding:"14px 16px", borderRadius:14, background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.08)" }}>
              <p style={{ ...M, fontSize:10, fontWeight:700, color:"rgba(238,240,246,0.30)", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:8 }}>{t.framework}</p>
              <p style={{ ...F, fontSize:14, fontWeight:800, color:"#eef0f6", margin:"0 0 8px" }}>{result.framework}</p>
              <div style={{ display:"flex", flexWrap:"wrap" as const, gap:4 }}>
                {hookColor && <Tag label={result.hook_type?.replace(/_/g," ")} color={hookColor.color} bg={hookColor.bg} border={hookColor.border} />}
                <Tag label={result.creative_model} color="rgba(238,240,246,0.50)" bg="rgba(255,255,255,0.05)" border="rgba(255,255,255,0.10)" />
              </div>
            </div>

            {/* Hook score */}
            <div style={{ padding:"14px 16px", borderRadius:14, background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.08)" }}>
              <p style={{ ...M, fontSize:10, fontWeight:700, color:"rgba(238,240,246,0.30)", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:8 }}>{t.hook_score}</p>
              <p style={{ ...F, fontSize:28, fontWeight:900, color:"#eef0f6", margin:"0 0 8px", lineHeight:1 }}>
                {result.hook_score?.toFixed(1)}<span style={{ fontSize:14, color:"rgba(238,240,246,0.30)" }}>/10</span>
              </p>
              <div style={{ height:3, borderRadius:99, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:99, background:"linear-gradient(90deg,#a78bfa,#f472b6)", width:`${((result.hook_score||0)/10)*100}%` }} />
              </div>
            </div>

            {/* Threat */}
            {threat && (
              <div style={{ padding:"14px 16px", borderRadius:14, background:threat.bg, border:`1px solid ${threat.border}` }}>
                <p style={{ ...M, fontSize:10, fontWeight:700, color:"rgba(238,240,246,0.30)", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:8 }}>{t.threat_level}</p>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                  <AlertTriangle size={16} color={threat.color} />
                  <p style={{ ...F, fontSize:14, fontWeight:800, color:threat.color, margin:0 }}>{threatLabel}</p>
                </div>
                <p style={{ ...M, fontSize:11, color:"rgba(238,240,246,0.45)", lineHeight:1.5, margin:0 }}>{result.target_audience}</p>
              </div>
            )}
          </div>

          {/* Hook formula + CTA formula */}
          {(result.hook_formula || result.cta_formula) && (
            <div style={{ display:"grid", gridTemplateColumns: result.hook_formula && result.cta_formula ? "1fr 1fr" : "1fr", gap:10 }}>
              {result.hook_formula && (
                <Section label={t.hook_formula} color="#a78bfa">
                  <p style={{ ...M, fontSize:13, color:"rgba(238,240,246,0.80)", lineHeight:1.6, margin:0, fontStyle:"italic" as const }}>"{result.hook_formula}"</p>
                </Section>
              )}
              {result.cta_formula && (
                <Section label={t.cta_formula} color="#f472b6">
                  <p style={{ ...M, fontSize:13, color:"rgba(238,240,246,0.80)", lineHeight:1.6, margin:0, fontStyle:"italic" as const }}>"{result.cta_formula}"</p>
                </Section>
              )}
            </div>
          )}

          {/* Triggers + Persuasion */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Section label={t.emotional} color="#f472b6">
              <div style={{ display:"flex", flexWrap:"wrap" as const, gap:6 }}>
                {result.emotional_triggers?.map(t2 => (
                  <Tag key={t2} label={t2} color="#f9a8d4" bg="rgba(244,114,182,0.10)" border="rgba(244,114,182,0.20)" />
                ))}
              </div>
            </Section>
            <Section label={t.persuasion} color="#60a5fa">
              <div style={{ display:"flex", flexWrap:"wrap" as const, gap:6 }}>
                {result.persuasion_tactics?.map(t3 => (
                  <Tag key={t3} label={t3} color="#93c5fd" bg="rgba(96,165,250,0.10)" border="rgba(96,165,250,0.20)" />
                ))}
              </div>
            </Section>
          </div>

          {/* Strengths + Weaknesses */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div style={{ padding:"16px 18px", borderRadius:14, background:"rgba(52,211,153,0.05)", border:"1px solid rgba(52,211,153,0.18)" }}>
              <p style={{ ...M, fontSize:10, fontWeight:700, color:"rgba(52,211,153,0.55)", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:10 }}>{t.strengths}</p>
              <ul style={{ listStyle:"none", padding:0, margin:0, display:"flex", flexDirection:"column" as const, gap:8 }}>
                {result.strengths?.map((s,i) => (
                  <li key={i} style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                    <span style={{ width:18, height:18, borderRadius:"50%", background:"rgba(52,211,153,0.15)", color:"#34d399", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", ...M, fontSize:9, fontWeight:700, marginTop:1 }}>{i+1}</span>
                    <span style={{ ...M, fontSize:12, color:"rgba(238,240,246,0.60)", lineHeight:1.5 }}>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ padding:"16px 18px", borderRadius:14, background:"rgba(248,113,113,0.05)", border:"1px solid rgba(248,113,113,0.18)" }}>
              <p style={{ ...M, fontSize:10, fontWeight:700, color:"rgba(248,113,113,0.55)", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:10 }}>{t.weaknesses}</p>
              <ul style={{ listStyle:"none", padding:0, margin:0, display:"flex", flexDirection:"column" as const, gap:8 }}>
                {result.weaknesses?.map((w,i) => (
                  <li key={i} style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                    <span style={{ width:18, height:18, borderRadius:"50%", background:"rgba(248,113,113,0.15)", color:"#f87171", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", ...M, fontSize:9, fontWeight:700, marginTop:1 }}>{i+1}</span>
                    <span style={{ ...M, fontSize:12, color:"rgba(238,240,246,0.60)", lineHeight:1.5 }}>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Counter strategy */}
          <div style={{ padding:"18px", borderRadius:14, background:"rgba(14,165,233,0.06)", border:"1px solid rgba(14,165,233,0.22)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Shield size={16} color="#0ea5e9" />
                <p style={{ ...M, fontSize:10, fontWeight:700, color:"rgba(14,165,233,0.65)", letterSpacing:"0.12em", textTransform:"uppercase" as const, margin:0 }}>{t.counter}</p>
              </div>
              <button onClick={async () => { await navigator.clipboard.writeText(result.counter_strategy); setCopiedCounter(true); toast.success(t.copied); setTimeout(() => setCopiedCounter(false), 2000); }}
                style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:8, background:"rgba(14,165,233,0.10)", border:"1px solid rgba(14,165,233,0.22)", cursor:"pointer", ...M, fontSize:11, fontWeight:600, color:"#0ea5e9" }}>
                {copiedCounter ? <><Check size={12} /> {t.copied}</> : <><Copy size={12} /> {t.copy_strategy}</>}
              </button>
            </div>
            <p style={{ ...M, fontSize:13, color:"rgba(238,240,246,0.70)", lineHeight:1.7, margin:0 }}>{result.counter_strategy}</p>
          </div>

          {/* Ready-to-use hooks — star section */}
          {result.ready_hooks && result.ready_hooks.length > 0 && (
            <div style={{ padding:"18px", borderRadius:14, background:"rgba(251,191,36,0.05)", border:"1px solid rgba(251,191,36,0.22)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                <TrendingUp size={16} color="#fbbf24" />
                <p style={{ ...M, fontSize:10, fontWeight:700, color:"rgba(251,191,36,0.65)", letterSpacing:"0.12em", textTransform:"uppercase" as const, margin:0 }}>{t.ready_hooks}</p>
              </div>
              <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                {result.ready_hooks.map((hook, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px", borderRadius:10, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ ...M, fontSize:11, fontWeight:700, color:"rgba(251,191,36,0.55)", flexShrink:0, marginTop:1 }}>#{i+1}</span>
                    <p style={{ ...M, fontSize:13, color:"rgba(238,240,246,0.80)", lineHeight:1.6, flex:1, margin:0 }}>{hook}</p>
                    <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                      <button onClick={() => copyHook(hook, i)}
                        style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:7, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.10)", cursor:"pointer", ...M, fontSize:11, color:"rgba(238,240,246,0.50)" }}>
                        {copiedIdx===i ? <><Check size={11} /> {t.copied}</> : <><Copy size={11} /> {t.copy_hook}</>}
                      </button>
                      <button onClick={() => navigate(`/dashboard/script?hook=${encodeURIComponent(hook)}`)}
                        style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:7, background:"rgba(14,165,233,0.08)", border:"1px solid rgba(14,165,233,0.20)", cursor:"pointer", ...M, fontSize:11, color:"#0ea5e9" }}>
                        <ChevronRight size={11} /> {t.go_script}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steal-worthy */}
          <div style={{ padding:"16px 18px", borderRadius:14, background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ ...M, fontSize:10, fontWeight:700, color:"rgba(238,240,246,0.30)", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:10 }}>{t.steal}</p>
            <ul style={{ listStyle:"none", padding:0, margin:0, display:"flex", flexDirection:"column" as const, gap:8 }}>
              {result.steal_worthy?.map((s,i) => (
                <li key={i} style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                  <span style={{ color:"rgba(251,191,36,0.60)", flexShrink:0, marginTop:2 }}>→</span>
                  <span style={{ ...M, fontSize:12, color:"rgba(238,240,246,0.60)", lineHeight:1.5 }}>{s}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      )}

      {!loading && !result && (
        <div style={{ borderRadius:14, border:"1px dashed rgba(255,255,255,0.10)", padding:"48px 20px", textAlign:"center" as const }}>
          <div style={{ fontSize:36, marginBottom:12 }}>🔍</div>
          <p style={{ ...F, fontSize:15, fontWeight:700, color:"rgba(238,240,246,0.50)", margin:"0 0 6px" }}>{t.empty_title}</p>
          <p style={{ ...M, fontSize:12, color:"rgba(238,240,246,0.20)", margin:0 }}>{t.empty_sub}</p>
        </div>
      )}
    </div>
  );
}
