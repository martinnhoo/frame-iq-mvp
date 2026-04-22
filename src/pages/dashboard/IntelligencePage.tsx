import { useState, useEffect, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Brain, TrendingUp, Star, Trash2, RefreshCw, ChevronRight, ChevronDown } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { DESIGN_TOKENS as T } from "@/hooks/useDesignTokens";

const F = T.font; // 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif
const M = T.mono; // 'Space Grotesk', 'DM Mono', monospace

// ── Types ─────────────────────────────────────────────────────────────────────
interface Memory  { id:string; memory_text:string; memory_type:string; importance:number; created_at:string; }
interface Example { id:string; user_message:string; quality_score:number; created_at:string; }
interface Pattern {
  id:string;
  pattern_key:string;
  insight_text:string;
  avg_ctr:number|null;
  avg_roas:number|null;
  sample_size:number|null;
  confidence:number;
  is_winner:boolean;
}

// ── Pattern-key parser: turns "perf_urgency_meta" → { label:"Urgency", platform:"meta" }
const PLATFORMS = new Set(["meta","facebook","instagram","google","tiktok","youtube","linkedin"]);
const PLATFORM_COLOR: Record<string,string> = {
  meta: "#0866ff",
  facebook: "#0866ff",
  instagram: "#e1306c",
  google: "#fbbc05",
  tiktok: "#25f4ee",
  youtube: "#ff0000",
  linkedin: "#0a66c2",
};
function parsePatternKey(key: string): { label: string; platform: string } {
  if (!key) return { label: "—", platform: "" };
  // Strip known prefixes so we surface the meaningful slug
  const stripped = key
    .replace(/^perf_/i, "")
    .replace(/^market_/i, "")
    .replace(/^competitor_/i, "")
    .replace(/^trend_hook_/i, "");
  const parts = stripped.split("_").filter(Boolean);
  let platform = "";
  let labelParts = parts;
  if (parts.length > 1 && PLATFORMS.has(parts[parts.length - 1].toLowerCase())) {
    platform = parts[parts.length - 1].toLowerCase();
    labelParts = parts.slice(0, -1);
  }
  const label = labelParts
    .join(" ")
    .replace(/\b\w/g, c => c.toUpperCase());
  return { label: label || key, platform };
}

// ── Compact memory row ────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string,string> = {
  preference: "#38bdf8", // Sky blue (visual)
  decision: "#a78bfa", // Purple (strategic)
  rule: T.green, // #22A3A3 (positive)
  context: T.amber, // #eab308 (informational)
};
const TYPE_LABEL: Record<string,Record<string,string>> = {
  preference:{ pt:"Preferência",  es:"Preferencia",  en:"Preference"  },
  decision:  { pt:"Decisão",      es:"Decisión",      en:"Decision"    },
  rule:      { pt:"Regra",        es:"Regla",         en:"Rule"        },
  context:   { pt:"Contexto",     es:"Contexto",      en:"Context"     },
};

function MemoryRow({ m, lang, deleting, onDelete }: {
  m: Memory; lang: string; deleting: boolean; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = m.memory_text.length > 90;
  const color = TYPE_COLOR[m.memory_type] || "#888";
  const label = TYPE_LABEL[m.memory_type]?.[lang] || m.memory_type;

  return (
    <div style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"10px 12px", borderRadius:10,
      background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
      transition:"background 0.15s" }}>
      <div style={{ width:4, borderRadius:2, background:color, flexShrink:0, alignSelf:"stretch", minHeight:16 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
          <span style={{ fontFamily:F, fontSize:10, fontWeight:700, color, letterSpacing:"0.07em", textTransform:"uppercase" as const }}>
            {label}
          </span>
          <span style={{ fontFamily:M, fontSize:10, color:"rgba(255,255,255,0.2)" }}>
            {"".repeat(Math.min(m.importance, 5))}
          </span>
        </div>
        <p style={{ fontFamily:F, fontSize:13, color:"rgba(255,255,255,0.75)", lineHeight:1.55, margin:0,
          ...(isLong && !expanded ? { overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" as const } : {}) }}>
          {m.memory_text}
        </p>
        {isLong && (
          <button onClick={() => setExpanded(e => !e)}
            style={{ marginTop:4, background:"none", border:"none", cursor:"pointer", padding:0,
              fontFamily:F, fontSize:11, color:"rgba(255,255,255,0.3)", display:"flex", alignItems:"center", gap:2 }}>
            {expanded
              ? <><ChevronDown size={10}/>{lang==="pt"?"Ver menos":lang==="es"?"Ver menos":"Show less"}</>
              : <><ChevronRight size={10}/>{lang==="pt"?"Ver tudo":lang==="es"?"Ver todo":"Show all"}</>}
          </button>
        )}
      </div>
      <button onClick={onDelete} disabled={deleting}
        style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 4px",
          color:"rgba(255,255,255,0.18)", display:"flex", alignItems:"center", flexShrink:0,
          transition:"color 0.15s" }}
        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color="#f87171"}}
        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.18)"}}>
        {deleting ? <span style={{fontSize:11}}>…</span> : <Trash2 size={12}/>}
      </button>
    </div>
  );
}

// ── Pattern row — structured, not raw text ───────────────────────────────────
function PatternRow({ p, lang }: { p: Pattern; lang:string }) {
  const { label, platform } = parsePatternKey(p.pattern_key);
  const ctrPct = p.avg_ctr && p.avg_ctr > 0
    ? (p.avg_ctr > 1 ? p.avg_ctr : p.avg_ctr * 100)
    : null;
  const roasX = p.avg_roas && p.avg_roas > 0 ? p.avg_roas : null;
  const confPct = Math.round((p.confidence || 0) * 100);
  const platColor = platform ? (PLATFORM_COLOR[platform] || "#94a3b8") : "";
  const samplesLabel = lang === "pt" ? "amostras" : lang === "es" ? "muestras" : "samples";
  const confLabel    = lang === "pt" ? "confiança" : lang === "es" ? "confianza" : "confidence";
  const winnerLabel  = lang === "pt" ? "VENCEDOR" : lang === "es" ? "GANADOR" : "WINNER";

  return (
    <div style={{
      display:"flex", alignItems:"center", gap:12,
      padding:"11px 14px", borderRadius:10,
      background: p.is_winner ? "rgba(52,211,153,0.04)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${p.is_winner ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.06)"}`,
    }}>
      {/* Left cluster — label + meta badges */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:4, flexWrap:"wrap" as const }}>
          <span style={{
            fontFamily:F, fontSize:13.5, fontWeight:700, color:"#f5f7fb",
            letterSpacing:"-0.01em",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const,
            maxWidth:"100%",
          }}>{label}</span>
          {platform && (
            <span style={{
              fontFamily:F, fontSize:10, fontWeight:700,
              color: platColor,
              background: `${platColor}18`,
              border:`1px solid ${platColor}35`,
              padding:"1px 7px", borderRadius:99,
              textTransform:"capitalize" as const,
              letterSpacing:"0.04em",
              lineHeight:1.5,
            }}>{platform}</span>
          )}
          {p.is_winner && (
            <span style={{
              fontFamily:F, fontSize:9.5, fontWeight:700, color:"#34d399",
              background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.3)",
              padding:"1px 7px", borderRadius:99,
              letterSpacing:"0.08em",
              lineHeight:1.5,
            }}>{winnerLabel}</span>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:11, color:"rgba(255,255,255,0.35)", fontFamily:F }}>
          {p.sample_size ? <span>{p.sample_size} {samplesLabel}</span> : null}
          {confPct > 0 && (
            <>
              {p.sample_size ? <span style={{opacity:0.4}}>·</span> : null}
              <span>{confLabel} {confPct}%</span>
            </>
          )}
        </div>
      </div>
      {/* Right cluster — metrics */}
      <div style={{ display:"flex", gap:14, flexShrink:0, alignItems:"center" }}>
        {ctrPct !== null && (
          <div style={{ textAlign:"right" as const }}>
            <div style={{ fontFamily:M, fontSize:13, fontWeight:700, color:"#34d399", lineHeight:1 }}>
              {ctrPct.toFixed(2)}<span style={{fontSize:10,opacity:0.7,marginLeft:1}}>%</span>
            </div>
            <div style={{ fontFamily:F, fontSize:9.5, color:"rgba(255,255,255,0.3)", marginTop:3, letterSpacing:"0.06em", textTransform:"uppercase" as const }}>CTR</div>
          </div>
        )}
        {roasX !== null && (
          <div style={{ textAlign:"right" as const }}>
            <div style={{ fontFamily:M, fontSize:13, fontWeight:700, color:"#60a5fa", lineHeight:1 }}>
              {roasX.toFixed(2)}<span style={{fontSize:10,opacity:0.7,marginLeft:1}}>x</span>
            </div>
            <div style={{ fontFamily:F, fontSize:9.5, color:"rgba(255,255,255,0.3)", marginTop:3, letterSpacing:"0.06em", textTransform:"uppercase" as const }}>ROAS</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Example row ───────────────────────────────────────────────────────────────
function ExampleRow({ e, lang, deleting, onDelete, showLess, showMore }: {
  e: Example; lang:string; deleting:boolean; onDelete:()=>void; showLess:string; showMore:string;
}) {
  const [exp, setExp] = useState(false);
  const isLong = e.user_message.length > 80;
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"9px 12px", borderRadius:10,
      background:"rgba(167,139,250,0.04)", border:"1px solid rgba(167,139,250,0.12)" }}>
      <Star size={12} color="#a78bfa" style={{ flexShrink:0, marginTop:2 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontFamily:F, fontSize:13, color:"rgba(255,255,255,0.75)", lineHeight:1.5, margin:0,
          ...(isLong && !exp ? { overflow:"hidden", display:"-webkit-box", WebkitLineClamp:1, WebkitBoxOrient:"vertical" as const } : {}) }}>
          {e.user_message}
        </p>
        {isLong && (
          <button onClick={() => setExp(v => !v)}
            style={{ background:"none", border:"none", cursor:"pointer", padding:0, marginTop:2,
              fontFamily:F, fontSize:11, color:"rgba(255,255,255,0.3)", display:"flex", alignItems:"center", gap:2 }}>
            {exp ? <><ChevronDown size={10}/>{showLess}</> : <><ChevronRight size={10}/>{showMore}</>}
          </button>
        )}
      </div>
      <span style={{ fontFamily:M, fontSize:11, color:"rgba(255,255,255,0.2)", flexShrink:0, marginRight:4 }}>
        {new Date(e.created_at).toLocaleDateString(lang==="pt"?"pt-BR":"en-US", { day:"2-digit", month:"short" })}
      </span>
      <button onClick={onDelete} disabled={deleting}
        style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 4px",
          color:"rgba(255,255,255,0.18)", display:"flex", alignItems:"center", flexShrink:0, transition:"color 0.15s" }}
        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color="#f87171"}}
        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.18)"}}>
        {deleting ? <span style={{fontSize:11}}>…</span> : <Trash2 size={12}/>}
      </button>
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────
function Section({ icon, color, title, subtitle, count, children }: {
  icon: React.ReactNode; color:string; title:string; subtitle:string;
  count:number; children:React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom:20 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"12px 14px",
          borderRadius:12, background:`${color}08`, border:`1px solid ${color}20`,
          cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}
        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=`${color}12`}}
        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=`${color}08`}}>
        <div style={{ width:28, height:28, borderRadius:8, background:`${color}18`,
          border:`1px solid ${color}28`, display:"flex", alignItems:"center", justifyContent:"center",
          flexShrink:0, color }}>
          {icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontFamily:F, fontSize:14, fontWeight:600, color:"#f0f2f8" }}>{title}</span>
            <span style={{ fontFamily:M, fontSize:12, color, background:`${color}15`,
              borderRadius:99, padding:"1px 8px" }}>{count}</span>
          </div>
          <p style={{ fontFamily:F, fontSize:12, color:"rgba(255,255,255,0.35)", margin:0, marginTop:1 }}>{subtitle}</p>
        </div>
        <ChevronDown size={14} color="rgba(255,255,255,0.3)"
          style={{ flexShrink:0, transform:open?"none":"rotate(-90deg)", transition:"transform 0.2s" }}/>
      </button>

      {open && (
        <div style={{ marginTop:8, paddingLeft:0 }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function IntelligencePage() {
  const { user, selectedPersona } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const lang = language || "pt";
  const isPT = lang === "pt", isES = lang === "es";

  const [memories, setMemories]     = useState<Memory[]>([]);
  const [examples, setExamples]     = useState<Example[]>([]);
  const [patterns, setPatterns]     = useState<Pattern[]>([]);
  const [loading, setLoading]       = useState(true);
  const [deleting, setDeleting]     = useState<string | null>(null);

  // i18n
  const t = {
    title:       isPT ? "Inteligência da IA" : isES ? "Inteligencia de la IA" : "AI Intelligence",
    subtitle:    isPT ? "Tudo que aprendi em conversas — usado automaticamente em cada resposta"
                     : isES ? "Todo lo que aprendí en conversaciones — usado automáticamente en cada respuesta"
                     : "Everything I've learned — used automatically in every response",
    refresh:     isPT ? "Atualizar" : isES ? "Actualizar" : "Refresh",
    account:     isPT ? "Conta" : isES ? "Cuenta" : "Account",
    global:      isPT ? "Global" : isES ? "Global" : "Global",
    memories:    isPT ? "Memórias" : isES ? "Memorias" : "Memories",
    mem_sub:     isPT ? "Fatos sobre você e a conta, extraídos das conversas"
                     : isES ? "Hechos sobre ti y la cuenta, extraídos de conversaciones"
                     : "Facts about you and account, extracted from conversations",
    patterns:    isPT ? "Padrões de ads" : isES ? "Patrones de anuncios" : "Ad patterns",
    pat_sub:     isPT ? "Do que funcionou nas campanhas conectadas"
                     : isES ? "De lo que funcionó en las campañas conectadas"
                     : "From what worked in connected campaigns",
    examples:    isPT ? "Respostas aprovadas" : isES ? "Respuestas aprobadas" : "Approved responses",
    ex_sub:      isPT ? "Quando você curte  uma resposta, salvo o estilo"
                     : isES ? "Cuando das  a una respuesta, guardo el estilo"
                     : "When you  a response, I save the style",
    empty:       isPT ? "Ainda sem inteligência acumulada"
                     : isES ? "Aún sin inteligencia acumulada"
                     : "No intelligence accumulated yet",
    empty_sub:   isPT ? "Converse com a IA sobre esta conta e curta () as respostas que gostar."
                     : isES ? "Conversa con la IA sobre esta cuenta y dale  a las respuestas que te gusten."
                     : "Chat with the AI about this account and  responses you like.",
    open_chat:   isPT ? "Abrir IA Chat" : isES ? "Abrir IA Chat" : "Open AI Chat",
    no_patterns: isPT ? "Nenhum padrão ainda — conecte Meta Ads"
                     : isES ? "Sin patrones aún — conecta Meta Ads"
                     : "No patterns yet — connect Meta Ads",
    no_examples: isPT ? "Nenhum exemplo — curta  respostas no chat"
                     : isES ? "Sin ejemplos — da  a respuestas en el chat"
                     : "No examples —  responses in chat",
    show_less:   isPT ? "Ver menos" : isES ? "Ver menos" : "Show less",
    show_more:   isPT ? "Ver tudo" : isES ? "Ver todo" : "Show all",
    scope_account: isPT ? "desta conta" : isES ? "de esta cuenta" : "for this account",
    scope_global:  isPT ? "globais" : isES ? "globales" : "global",
  };

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      // Memories: scoped by persona if selected, else null persona (global)
      const memQ = (supabase as any).from("chat_memory")
        .select("id,memory_text,memory_type,importance,created_at")
        .eq("user_id", user.id)
        .order("importance", { ascending:false }).limit(30);
      if (selectedPersona?.id) memQ.eq("persona_id", selectedPersona.id);
      else memQ.is("persona_id", null);

      // Patterns: scoped by persona — only the performance-grounded ones,
      // filter out the noisy meta/system keys (business_profile, chat_hooks, etc.).
      // Mirror the memories scoping: when no persona is selected we show only
      // global patterns (persona_id IS NULL), not a cross-persona mix — the
      // scope badge says "Global" and should mean just that.
      const patQ = (supabase as any).from("learned_patterns")
        .select("id,pattern_key,insight_text,avg_ctr,avg_roas,sample_size,confidence,is_winner")
        .eq("user_id", user.id)
        .order("is_winner", { ascending:false })
        .order("confidence", { ascending:false })
        .limit(20);
      if (selectedPersona?.id) patQ.eq("persona_id", selectedPersona.id);
      else patQ.is("persona_id", null);

      // Examples: global per user (style preference, not account-specific)
      const exQ = (supabase as any).from("chat_examples")
        .select("id,user_message,quality_score,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending:false }).limit(10);

      const [mR, pR, eR] = await Promise.all([memQ, patQ, exQ]);
      // Filter patterns: keep perf_*, market_*, trend_*; drop internal keys
      const rawPatterns: Pattern[] = pR.data || [];
      const cleanPatterns = rawPatterns.filter((p: Pattern) => {
        const k = (p.pattern_key || "").toLowerCase();
        if (!k) return false;
        if (k.startsWith("business_profile")) return false;
        if (k.startsWith("chat_hooks_")) return false;
        if (k.startsWith("action_")) return false;
        if (k.startsWith("preflight_")) return false;
        return true;
      });
      setMemories(mR.data || []);
      setPatterns(cleanPatterns);
      setExamples(eR.data || []);
    } finally { setLoading(false); }
  }, [user?.id, selectedPersona?.id]);

  useEffect(() => { load(); }, [load]);

  const deleteMemory = async (id: string) => {
    setDeleting(id);
    try {
      await (supabase as any).from("chat_memory").delete().eq("id", id);
      setMemories(p => p.filter(m => m.id !== id));
      toast.success(isPT ? "Memória removida" : "Memory removed");
    } catch { toast.error("Error"); }
    finally { setDeleting(null); }
  };

  const deleteExample = async (id: string) => {
    setDeleting(id);
    try {
      await (supabase as any).from("chat_examples").delete().eq("id", id);
      setExamples(p => p.filter(e => e.id !== id));
    } catch { toast.error("Error"); }
    finally { setDeleting(null); }
  };

  if (!user) return null;

  const accountLabel = selectedPersona?.name || t.global;
  const hasAny = memories.length > 0 || examples.length > 0 || patterns.length > 0;

  return (
    <div className="tool-page-wrap" style={{ maxWidth:720, margin:"0 auto", fontFamily:F }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28, gap:12, flexWrap:"wrap" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
            <Brain size={20} color="#0ea5e9"/>
            <h1 style={{ margin:0, fontSize:"clamp(18px,3vw,22px)", fontWeight:800, color:"#f0f2f8", letterSpacing:"-0.03em" }}>
              {t.title}
            </h1>
          </div>
          <p style={{ margin:0, fontSize:13, color:"rgba(255,255,255,0.4)" }}>{t.subtitle}</p>
          {/* Scope badge */}
          <div style={{ marginTop:8, display:"inline-flex", alignItems:"center", gap:5,
            padding:"3px 10px", borderRadius:99,
            background: selectedPersona ? "rgba(14,165,233,0.10)" : "rgba(255,255,255,0.06)",
            border: selectedPersona ? "1px solid rgba(14,165,233,0.25)" : "1px solid rgba(255,255,255,0.10)" }}>
            <div style={{ width:6, height:6, borderRadius:"50%",
              background: selectedPersona ? "#0ea5e9" : "rgba(255,255,255,0.3)" }}/>
            <span style={{ fontFamily:F, fontSize:12, fontWeight:600,
              color: selectedPersona ? "#38bdf8" : "rgba(255,255,255,0.5)" }}>
              {accountLabel}
            </span>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px",
            background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)",
            borderRadius:9, color:"rgba(255,255,255,0.5)", fontFamily:F, fontSize:12,
            cursor:"pointer", transition:"all 0.15s" }}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.09)"}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.05)"}}>
          <RefreshCw size={12} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
          {t.refresh}
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8, marginBottom:28 }}>
        {[
          { n:memories.length,  label:t.memories, color:"#0ea5e9" },
          { n:patterns.length,  label:t.patterns, color:"#34d399" },
          { n:examples.length,  label:t.examples, color:"#a78bfa" },
        ].map(s => (
          <div key={s.label} style={{ padding:"12px 14px", borderRadius:12,
            background:"linear-gradient(160deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%)",
            border:"1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontFamily:M, fontSize:24, fontWeight:700, color:s.color, lineHeight:1 }}>{s.n}</div>
            <div style={{ fontFamily:F, fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.5)", marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {!loading && !hasAny && (
        <div style={{ textAlign:"center", padding:"48px 24px", borderRadius:16,
          background:"rgba(14,165,233,0.04)", border:"1px solid rgba(14,165,233,0.12)" }}>
          <Brain size={40} color="rgba(14,165,233,0.35)" style={{ marginBottom:14 }}/>
          <p style={{ margin:"0 0 6px", fontSize:16, fontWeight:700, color:"#f0f2f8" }}>{t.empty}</p>
          <p style={{ margin:"0 0 20px", fontSize:13, color:"rgba(255,255,255,0.4)", lineHeight:1.6 }}>{t.empty_sub}</p>
          <button onClick={() => navigate("/dashboard/ai")}
            style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"9px 20px",
              background:"#0ea5e9", border:"none", borderRadius:10,
              color:"#fff", fontFamily:F, fontSize:13, fontWeight:700, cursor:"pointer",
              boxShadow:"0 4px 16px rgba(14,165,233,0.35)" }}>
            {t.open_chat}<ChevronRight size={14}/>
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display:"flex", justifyContent:"center", padding:"60px 0" }}>
          <div style={{ width:24, height:24, border:"2px solid rgba(255,255,255,0.1)", borderTopColor:"#0ea5e9", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
        </div>
      )}

      {!loading && hasAny && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>

          {/* Memories */}
          <Section icon={<Brain size={14}/>} color="#0ea5e9"
            title={t.memories} subtitle={t.mem_sub} count={memories.length}>
            {memories.length === 0 ? (
              <div style={{ padding:"14px 14px", borderRadius:10, background:"rgba(255,255,255,0.02)",
                border:"1px dashed rgba(255,255,255,0.08)", textAlign:"center" }}>
                <p style={{ fontFamily:F, fontSize:13, color:"rgba(255,255,255,0.3)", margin:0 }}>
                  {t.empty_sub}
                </p>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                {memories.map(m => (
                  <MemoryRow key={m.id} m={m} lang={lang}
                    deleting={deleting === m.id}
                    onDelete={() => deleteMemory(m.id)}/>
                ))}
              </div>
            )}
          </Section>

          {/* Patterns */}
          <Section icon={<TrendingUp size={14}/>} color="#34d399"
            title={t.patterns} subtitle={t.pat_sub} count={patterns.length}>
            {patterns.length === 0 ? (
              <div style={{ padding:"14px", borderRadius:10, background:"rgba(255,255,255,0.02)",
                border:"1px dashed rgba(255,255,255,0.08)" }}>
                <p style={{ fontFamily:F, fontSize:13, color:"rgba(255,255,255,0.3)", margin:0 }}>{t.no_patterns}</p>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {patterns.map(p => (
                  <PatternRow key={p.id} p={p} lang={lang}/>
                ))}
              </div>
            )}
          </Section>

          {/* Examples */}
          <Section icon={<Star size={14}/>} color="#a78bfa"
            title={t.examples} subtitle={t.ex_sub} count={examples.length}>
            {examples.length === 0 ? (
              <div style={{ padding:"14px", borderRadius:10, background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.08)" }}>
                <p style={{ fontFamily:F, fontSize:13, color:"rgba(255,255,255,0.3)", margin:0 }}>{t.no_examples}</p>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                {examples.map(e => (
                  <ExampleRow key={e.id} e={e} lang={lang}
                    deleting={deleting===e.id} onDelete={() => deleteExample(e.id)}
                    showLess={t.show_less} showMore={t.show_more}/>
                ))}
              </div>
            )}
          </Section>

        </div>
      )}
    </div>
  );
}
