import { useState, useEffect, useRef } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Send, Loader2, ChevronDown, ChevronUp, Sparkles, RotateCcw, Brain, ArrowRight, Zap, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const m = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" } as const;

// ── i18n strings ─────────────────────────────────────────────────────────────
const UI: Record<string, Record<string, string>> = {
  en: {
    ready: "● READY — account context loaded",
    loading_ctx: "○ Loading your data...",
    clear: "Clear",
    connect_title: "Connect Meta Ads",
    connect_sub: "The AI needs your ad account to answer with real data.",
    connect_btn: "Connect Meta Ads →",
    connecting: "Redirecting...",
    connected: "Meta Ads connected — AI using your real data",
    empty_title: "Ask me anything about your ads.",
    empty_sub: "I have your account context. I'll diagnose, generate and strategize based on real data.",
    placeholder: "Ask about your campaigns, hooks, performance...",
    disclaimer: "Strictly ad performance & creative intelligence only",
    running: "Running",
    open_tool: "Open tool →",
    q1: "My ROAS dropped this week — what's happening?",
    q2: "Which hook type is winning right now?",
    q3: "Write 3 hooks for my best market",
    q4: "Which ads should I pause today?",
    q5: "My CPM spiked. What should I produce?",
    q6: "Diagnose my CTR drop",
  },
  pt: {
    ready: "● PRONTO — contexto da conta carregado",
    loading_ctx: "○ Carregando seus dados...",
    clear: "Limpar",
    connect_title: "Conectar Meta Ads",
    connect_sub: "A IA precisa da sua conta de anúncios para responder com dados reais.",
    connect_btn: "Conectar Meta Ads →",
    connecting: "Redirecionando...",
    connected: "Meta Ads conectado — IA usando seus dados reais",
    empty_title: "Pergunte qualquer coisa sobre seus anúncios.",
    empty_sub: "Tenho o contexto da sua conta. Vou diagnosticar, gerar e estrategizar com dados reais.",
    placeholder: "Pergunte sobre campanhas, hooks, performance...",
    disclaimer: "Apenas inteligência de performance e criativos",
    running: "Executando",
    open_tool: "Abrir ferramenta →",
    q1: "Meu ROAS caiu essa semana — o que está acontecendo?",
    q2: "Qual tipo de hook está ganhando agora?",
    q3: "Escreve 3 hooks para meu melhor mercado",
    q4: "Quais anúncios devo pausar hoje?",
    q5: "Meu CPM subiu. O que devo produzir?",
    q6: "Diagnostica a queda do meu CTR",
  },
  es: {
    ready: "● LISTO — contexto de cuenta cargado",
    loading_ctx: "○ Cargando tus datos...",
    clear: "Limpiar",
    connect_title: "Conectar Meta Ads",
    connect_sub: "La IA necesita tu cuenta de anuncios para responder con datos reales.",
    connect_btn: "Conectar Meta Ads →",
    connecting: "Redirigiendo...",
    connected: "Meta Ads conectado — IA usando tus datos reales",
    empty_title: "Pregunta lo que quieras sobre tus anuncios.",
    empty_sub: "Tengo el contexto de tu cuenta. Diagnosticaré, generaré y estrategizaré con datos reales.",
    placeholder: "Pregunta sobre campañas, hooks, performance...",
    disclaimer: "Solo inteligencia de performance y creativos",
    running: "Ejecutando",
    open_tool: "Abrir herramienta →",
    q1: "Mi ROAS cayó esta semana — ¿qué está pasando?",
    q2: "¿Qué tipo de hook está ganando ahora?",
    q3: "Escribe 3 hooks para mi mejor mercado",
    q4: "¿Qué anuncios debo pausar hoy?",
    q5: "Mi CPM subió. ¿Qué debo producir?",
    q6: "Diagnostica la caída de mi CTR",
  },
};

// ── Block types ───────────────────────────────────────────────────────────────
interface Block {
  type: "action" | "pattern" | "hooks" | "warning" | "insight" | "off_topic" | "navigate" | "tool_call" | "dashboard";
  title: string;
  content?: string;
  items?: string[];
  route?: string;
  params?: Record<string, string>;
  cta?: string;
  tool?: string;
  tool_params?: Record<string, string>;
  metrics?: Array<{ label: string; value: string; delta?: string; trend?: "up" | "down" | "flat"; color?: string }>;
}
interface AIMessage { role: "user" | "assistant"; blocks?: Block[]; userText?: string; ts: number; }

const BS: Record<string, { color: string; icon: string; bg: string; border: string }> = {
  action:    { color: "#0ea5e9", icon: "🎯", bg: "rgba(14,165,233,0.07)", border: "rgba(14,165,233,0.18)" },
  pattern:   { color: "#60a5fa", icon: "📊", bg: "rgba(96,165,250,0.07)",  border: "rgba(96,165,250,0.18)" },
  hooks:     { color: "#06b6d4", icon: "⚡", bg: "rgba(6,182,212,0.07)",   border: "rgba(6,182,212,0.18)" },
  warning:   { color: "#fbbf24", icon: "⚠️", bg: "rgba(251,191,36,0.07)", border: "rgba(251,191,36,0.18)" },
  insight:   { color: "#34d399", icon: "📈", bg: "rgba(52,211,153,0.07)",  border: "rgba(52,211,153,0.18)" },
  off_topic: { color: "rgba(255,255,255,0.25)", icon: "🚫", bg: "rgba(255,255,255,0.02)", border: "rgba(255,255,255,0.06)" },
  navigate:  { color: "#0ea5e9", icon: "→", bg: "rgba(14,165,233,0.05)", border: "rgba(14,165,233,0.22)" },
  tool_call: { color: "#a78bfa", icon: "⚡", bg: "rgba(167,139,250,0.07)", border: "rgba(167,139,250,0.2)" },
  dashboard: { color: "#34d399", icon: "📊", bg: "rgba(52,211,153,0.04)", border: "rgba(52,211,153,0.15)" },
};

// ── Dashboard card renderer ───────────────────────────────────────────────────
function DashboardBlock({ block }: { block: Block }) {
  if (!block.metrics?.length) return null;
  return (
    <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", overflow: "hidden", marginBottom: 10 }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
        <TrendingUp size={13} color="#34d399" />
        <span style={{ ...j, fontSize: 12, fontWeight: 700, color: "#34d399" }}>{block.title}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(block.metrics.length, 3)}, 1fr)`, gap: 1, background: "rgba(255,255,255,0.04)" }}>
        {block.metrics.map((metric, i) => {
          const isUp = metric.trend === "up";
          const isDown = metric.trend === "down";
          const metricColor = metric.color || (isDown ? "#f87171" : isUp ? "#34d399" : "#fff");
          return (
            <div key={i} style={{ background: "#09090f", padding: "16px 18px" }}>
              <p style={{ ...m, fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{metric.label}</p>
              <p style={{ ...j, fontSize: 24, fontWeight: 900, color: metricColor, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 4 }}>{metric.value}</p>
              {metric.delta && (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {isDown ? <AlertTriangle size={10} color="#f87171" /> : isUp ? <TrendingUp size={10} color="#34d399" /> : null}
                  <span style={{ ...m, fontSize: 10, color: isDown ? "#f87171" : isUp ? "#34d399" : "rgba(255,255,255,0.35)" }}>{metric.delta}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {block.content && (
        <div style={{ padding: "12px 16px" }}>
          <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>{block.content}</p>
        </div>
      )}
    </div>
  );
}

// ── Block card ────────────────────────────────────────────────────────────────
function BlockCard({
  block, onNavigate, onRunTool, ui
}: {
  block: Block;
  onNavigate?: (route: string, params?: Record<string, string>) => void;
  onRunTool?: (tool: string, params: Record<string, string>) => void;
  ui: Record<string, string>;
}) {
  const s = BS[block.type] || BS.insight;
  const [open, setOpen] = useState(true);

  if (block.type === "dashboard") return <DashboardBlock block={block} />;

  if (block.type === "navigate") {
    return (
      <div style={{ borderRadius: 14, border: `1px solid ${s.border}`, background: s.bg, marginBottom: 10, padding: "14px 16px" }}>
        <p style={{ ...j, fontSize: 13, fontWeight: 700, color: s.color, marginBottom: 6 }}>{block.title}</p>
        {block.content && <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, marginBottom: 12 }}>{block.content}</p>}
        <button onClick={() => onNavigate?.(block.route!, block.params)}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 10, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", ...j }}>
          {block.cta || ui.open_tool} <ArrowRight size={13} />
        </button>
      </div>
    );
  }

  if (block.type === "tool_call") {
    return (
      <div style={{ borderRadius: 14, border: `1px solid ${s.border}`, background: s.bg, marginBottom: 10, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: block.content ? 8 : 0 }}>
          <Zap size={13} color={s.color} />
          <span style={{ ...j, fontSize: 12, fontWeight: 700, color: s.color }}>{block.title}</span>
        </div>
        {block.content && <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{block.content}</p>}
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 14, border: `1px solid ${s.border}`, background: s.bg, overflow: "hidden", marginBottom: 10 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "none", border: "none", cursor: "pointer" }}>
        <span style={{ fontSize: 15 }}>{s.icon}</span>
        <span style={{ ...j, flex: 1, fontSize: 12, fontWeight: 700, color: s.color, textAlign: "left" }}>{block.title}</span>
        {open ? <ChevronUp size={13} color={s.color} /> : <ChevronDown size={13} color={s.color} />}
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          {block.content && (
            <p style={{ ...m, fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.75, marginBottom: block.items?.length ? 10 : 0 }}>
              {block.content}
            </p>
          )}
          {block.items?.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ color: s.color, fontSize: 11, marginTop: 2, flexShrink: 0, fontWeight: 700 }}>{i + 1}.</span>
              <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdBriefAI() {
  const { user, profile } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang = (["pt","es"].includes(language) ? language : "en") as "en" | "pt" | "es";
  const ui = UI[lang] || UI.en;

  const SESSION_CHAT_KEY = "adbrief_ai_chat_session";
  const [messages, setMessages] = useState<AIMessage[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_CHAT_KEY) || "[]"); } catch { return []; }
  });

  const [metaConnected, setMetaConnected] = useState<boolean | null>(null);
  const [connectingMeta, setConnectingMeta] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const [context, setContext] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check Meta connection
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("platform_connections" as any)
      .select("platform, status").eq("user_id", user.id).eq("platform", "meta").maybeSingle()
      .then(({ data }) => setMetaConnected(!!data));
  }, [user?.id]);

  // Persist chat
  useEffect(() => {
    try { sessionStorage.setItem(SESSION_CHAT_KEY, JSON.stringify(messages.slice(-20))); } catch {}
  }, [messages]);

  // Load context
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const [analysesRes, patternsRes, personaRes, entriesRes, savedRes] = await Promise.all([
        supabase.from("analyses").select("id,title,created_at,result,hook_strength,recommended_platforms").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
        (supabase as any).from("learned_patterns").select("pattern_key,variables,avg_ctr,avg_cpc,avg_roas,confidence,is_winner,insight_text,sample_size").eq("user_id", user.id).order("confidence", { ascending: false }).limit(50),
        (supabase as any).from("personas").select("name,result").eq("user_id", user.id).eq("is_active", true).single(),
        (supabase as any).from("creative_entries").select("filename,market,editor,platform,creative_type,ctr,roas,spend,clicks,impressions,import_batch_id").eq("user_id", user.id).order("ctr", { ascending: false }).limit(500),
        (supabase as any).from("ai_user_insights").select("summary").eq("user_id", user.id).single(),
      ]);

      const analyses = (analysesRes.data || []) as any[];
      const patterns = (patternsRes.data || []) as any[];
      const persona = personaRes.data as any;
      const entries = (entriesRes.data || []) as any[];
      const saved = (savedRes.data as any)?.summary || "";

      const analysesSummary = analyses.map((a: any) => {
        const r = a.result as Record<string, any> || {};
        return `[${a.id.slice(0,8)}] ${a.title||"Untitled"} | score:${r.hook_score??""} | type:${r.hook_type??""} | market:${r.market_guess??""} | platform:${(a.recommended_platforms||[]).join("+")} | strength:${a.hook_strength??""} | date:${a.created_at?.slice(0,10)}`;
      }).join("\n");

      const patternsSummary = patterns.map((p: any) =>
        `${p.pattern_key}: ctr=${p.avg_ctr?.toFixed(2)||"?"} cpc=${p.avg_cpc?.toFixed(2)||"?"} roas=${p.avg_roas?.toFixed(2)||"?"} conf=${p.confidence?.toFixed(2)||"?"} ${p.is_winner?"★":""} ${p.insight_text||""}`
      ).join("\n");

      const editorMap: Record<string, any> = {};
      entries.forEach((e: any) => {
        if (!e.editor) return;
        if (!editorMap[e.editor]) editorMap[e.editor] = { total: 0, ctr_sum: 0, roas_sum: 0 };
        editorMap[e.editor].total++;
        editorMap[e.editor].ctr_sum += e.ctr || 0;
        editorMap[e.editor].roas_sum += e.roas || 0;
      });
      const editorSummary = Object.entries(editorMap).map(([ed, d]: [string, any]) =>
        `${ed}: ${d.total} creatives | avg_ctr=${(d.ctr_sum/d.total).toFixed(2)} | avg_roas=${(d.roas_sum/d.total).toFixed(2)}`
      ).join("\n");

      const ctx = `=== ACTIVE PERSONA ===\n${persona ? `Name:${persona.name} | Age:${(persona.result as any)?.age_range??"?"} | Pain:${((persona.result as any)?.pain_points||[]).slice(0,3).join(", ")} | Triggers:${((persona.result as any)?.emotional_triggers||[]).slice(0,3).join(", ")} | Platforms:${((persona.result as any)?.platforms||[]).join("+")}` : "No active persona"}\n\n=== ALL ANALYSES (${analyses.length} total) ===\n${analysesSummary||"None yet"}\n\n=== LEARNED PATTERNS ===\n${patternsSummary||"No patterns yet"}\n\n=== EDITOR PERFORMANCE ===\n${editorSummary||"No data"}\n\n=== SAVED INSIGHTS ===\n${saved||"None yet"}`;

      setContext(ctx);
      setContextReady(true);
    })();
  }, [user?.id]);

  const handleConnectMeta = async () => {
    setConnectingMeta(true);
    try {
      const { data } = await supabase.functions.invoke("meta-oauth", { body: { action: "get_auth_url", user_id: user.id } });
      if (data?.url) window.location.href = data.url;
    } catch { setConnectingMeta(false); }
  };

  const handleNavigate = (route: string, params?: Record<string, string>) => {
    if (!params || Object.keys(params).length === 0) { navigate(route); return; }
    navigate(`${route}?${new URLSearchParams(params).toString()}`);
  };

  // Execute tool_call blocks automatically
  const executeToolCall = async (tool: string, params: Record<string, string>): Promise<Block[]> => {
    try {
      const fnMap: Record<string, string> = {
        hooks: "generate-hooks", script: "generate-script",
        brief: "generate-brief", competitor: "decode-competitor", translate: "translate-text",
      };
      const fn = fnMap[tool];
      if (!fn) return [];
      const { data } = await supabase.functions.invoke(fn, { body: { ...params, user_id: user.id } });
      if (!data) return [];
      if (data.hooks) return [{ type: "hooks", title: "Generated Hooks", items: data.hooks }];
      if (data.script) return [{ type: "insight", title: "Generated Script", content: data.script }];
      if (data.brief) return [{ type: "insight", title: "Creative Brief", content: data.brief }];
      if (data.result) return [{ type: "insight", title: "Analysis", content: data.result }];
      return [];
    } catch { return []; }
  };

  const send = async (overrideInput?: string) => {
    const msg = (overrideInput ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }

    const userMsg: AIMessage = { role: "user", userText: msg, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.slice(-12).map(m =>
        m.role === "user"
          ? { role: "user" as const, content: m.userText || "" }
          : { role: "assistant" as const, content: JSON.stringify(m.blocks || []) }
      );

      const { data, error } = await supabase.functions.invoke("adbrief-ai-chat", {
        body: { message: msg, context, user_id: user.id, history, user_language: lang },
      });

      if (error || !data?.blocks) throw new Error(error?.message || "No response");

      let blocks: Block[] = data.blocks;

      // Auto-execute tool_call blocks
      const toolBlock = blocks.find(b => b.type === "tool_call" && b.tool);
      if (toolBlock?.tool && toolBlock.tool_params) {
        const toolResults = await executeToolCall(toolBlock.tool, toolBlock.tool_params);
        if (toolResults.length > 0) {
          blocks = [...blocks.filter(b => b.type !== "tool_call"), ...toolResults];
        }
      }

      const assistantMsg: AIMessage = { role: "assistant", blocks, ts: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: "assistant",
        blocks: [{ type: "warning", title: "Error", content: e.message || "Failed to reach AI." }],
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const quickQuestions = [ui.q1, ui.q2, ui.q3, ui.q4, ui.q5, ui.q6];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", background: "#07080f", ...j }}>

      {/* Header */}
      <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Brain size={15} color="#000" />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 800, color: "#fff", lineHeight: 1 }}>AdBrief AI</p>
          <p style={{ ...m, fontSize: 9.5, color: contextReady ? "rgba(52,211,153,0.7)" : "rgba(255,255,255,0.25)", letterSpacing: "0.1em", marginTop: 2 }}>
            {contextReady ? ui.ready : ui.loading_ctx}
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={() => { setMessages([]); sessionStorage.removeItem(SESSION_CHAT_KEY); }}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", gap: 4, fontSize: 11, ...m }}>
            <RotateCcw size={11} /> {ui.clear}
          </button>
        )}
      </div>

      {/* Meta banner */}
      {metaConnected === false && (
        <div style={{ margin: "12px 20px 0", padding: "12px 16px", borderRadius: 12, background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.2)", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <p style={{ ...j, fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{ui.connect_title}</p>
            <p style={{ ...m, fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0 }}>{ui.connect_sub}</p>
          </div>
          <button onClick={handleConnectMeta} disabled={connectingMeta}
            style={{ ...j, fontSize: 12, fontWeight: 700, padding: "9px 16px", borderRadius: 10, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", color: "#000", border: "none", cursor: connectingMeta ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {connectingMeta && <Loader2 size={11} className="animate-spin" />}
            {connectingMeta ? ui.connecting : ui.connect_btn}
          </button>
        </div>
      )}
      {metaConnected === true && (
        <div style={{ margin: "10px 20px 0", padding: "7px 14px", borderRadius: 8, background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.15)", display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 4px #34d399" }} />
          <p style={{ ...m, fontSize: 10.5, color: "rgba(52,211,153,0.75)", margin: 0 }}>{ui.connected}</p>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 0" }}>
        {messages.length === 0 && (
          <div style={{ maxWidth: 620, margin: "20px auto 0" }}>
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 6, ...j }}>{ui.empty_title}</p>
              <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.7 }}>{ui.empty_sub}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {quickQuestions.map(q => (
                <button key={q} onClick={() => send(q)}
                  style={{ padding: "11px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer", textAlign: "left", ...m, lineHeight: 1.5, transition: "all 0.15s" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,0.05)"; el.style.borderColor = "rgba(255,255,255,0.12)"; el.style.color = "rgba(255,255,255,0.8)"; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,0.03)"; el.style.borderColor = "rgba(255,255,255,0.07)"; el.style.color = "rgba(255,255,255,0.55)"; }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ maxWidth: 680, margin: "0 auto 16px" }}>
            {msg.role === "user" ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ padding: "10px 14px", borderRadius: "14px 14px 3px 14px", background: "rgba(14,165,233,0.13)", border: "1px solid rgba(14,165,233,0.22)", fontSize: 13, color: "rgba(255,255,255,0.88)", ...j, maxWidth: "82%", lineHeight: 1.55 }}>
                  {msg.userText}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Sparkles size={9} color="#000" />
                  </div>
                  <span style={{ ...m, fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em" }}>ADBRIEF AI</span>
                </div>
                {msg.blocks?.map((b, bi) => (
                  <BlockCard key={bi} block={b} onNavigate={handleNavigate} onRunTool={executeToolCall} ui={ui} />
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ maxWidth: 680, margin: "0 auto 16px", display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={9} color="#000" />
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {[0,1,2].map(d => (
                <div key={d} style={{ width: 5, height: 5, borderRadius: "50%", background: "#0ea5e9", animation: `pulse 1.2s ease-in-out ${d*0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} style={{ height: 16 }} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 20px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={ui.placeholder}
            rows={1}
            style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px 14px", color: "#fff", fontSize: 13, resize: "none", outline: "none", ...m, lineHeight: 1.5, minHeight: 44, maxHeight: 120 }}
            onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 120) + "px"; }}
          />
          <button onClick={() => send()} disabled={!input.trim() || loading || !contextReady}
            style={{ width: 44, height: 44, borderRadius: 12, background: input.trim() && !loading ? "linear-gradient(135deg, #0ea5e9, #06b6d4)" : "rgba(255,255,255,0.06)", border: "none", cursor: input.trim() && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
            {loading ? <Loader2 size={16} color="#0ea5e9" className="animate-spin" /> : <Send size={16} color={input.trim() ? "#000" : "rgba(255,255,255,0.2)"} />}
          </button>
        </div>
        <p style={{ ...m, fontSize: 10, color: "rgba(255,255,255,0.15)", textAlign: "center", marginTop: 7, letterSpacing: "0.05em" }}>
          {ui.disclaimer}
        </p>
      </div>

      <style>{`@keyframes pulse { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.4);opacity:1} }`}</style>
    </div>
  );
}
