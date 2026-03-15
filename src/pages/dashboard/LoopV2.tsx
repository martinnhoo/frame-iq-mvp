import { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Send, Loader2, BarChart3, Zap, Brain, FileText,
  ArrowRight, TrendingUp, TrendingDown, Minus,
  Link2, Plus, Sparkles, RefreshCw, Target,
  AlertTriangle, Activity, CheckCircle2,
} from "lucide-react";

const J = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;
const M = { fontFamily: "'DM Mono', monospace" } as React.CSSProperties;
const BLUE = "#0ea5e9";
const TEAL = "#06b6d4";
const GREEN = "#34d399";
const AMBER = "#fbbf24";
const RED = "#f87171";
const MUTED = "rgba(255,255,255,0.32)";
const BORDER = "rgba(255,255,255,0.07)";
const SURFACE = "rgba(255,255,255,0.03)";
const SURFACE2 = "rgba(255,255,255,0.055)";

interface AccountPulse {
  avgHookScore: number | null;
  totalAnalyses: number;
  topFormat: string | null;
  topMarket: string | null;
  weeklyDelta: number | null;
  viralHooks: number;
  topPlatform: string | null;
  recentActivity: { title: string; type: string; score: number | null; ts: string }[];
  platformImports: { platform: string; count: number; last: string }[];
}

interface AIBlock {
  type: "insight" | "action" | "warning" | "pattern" | "hooks" | "navigate";
  title: string; content?: string; items?: string[]; route?: string; cta?: string;
}
interface AIMessage {
  role: "user" | "assistant"; text?: string; blocks?: AIBlock[]; ts: number; loading?: boolean;
}

const BLOCK_STYLES: Record<AIBlock["type"], { color: string; bg: string; border: string }> = {
  insight:  { color: GREEN,      bg: "rgba(52,211,153,0.06)",   border: "rgba(52,211,153,0.18)"  },
  action:   { color: BLUE,       bg: "rgba(14,165,233,0.06)",   border: "rgba(14,165,233,0.18)"  },
  warning:  { color: AMBER,      bg: "rgba(251,191,36,0.06)",   border: "rgba(251,191,36,0.18)"  },
  pattern:  { color: "#a78bfa",  bg: "rgba(167,139,250,0.06)",  border: "rgba(167,139,250,0.18)" },
  hooks:    { color: TEAL,       bg: "rgba(6,182,212,0.06)",    border: "rgba(6,182,212,0.18)"   },
  navigate: { color: BLUE,       bg: "rgba(14,165,233,0.04)",   border: "rgba(14,165,233,0.2)"   },
};
const BLOCK_ICONS: Record<AIBlock["type"], React.ElementType> = {
  insight: Sparkles, action: Target, warning: AlertTriangle,
  pattern: Activity, hooks: Zap, navigate: ArrowRight,
};

const QUICK_PROMPTS = [
  "What's my best hook type right now?",
  "Which ads should I pause before wasting more budget?",
  "What should I produce next for BR?",
  "Why did my CTR drop this week?",
  "Generate 3 hooks from my winning patterns",
  "What's wrong with my recent ads?",
];

const TOOLS = [
  { icon: BarChart3,  label: "Analyze ad",      desc: "Hook score · 60s",         color: BLUE,      route: "/dashboard/analyses/new" },
  { icon: Zap,        label: "Generate hooks",   desc: "10 angles · CTR predicted", color: TEAL,      route: "/dashboard/hooks" },
  { icon: FileText,   label: "Create brief",     desc: "Scene-by-scene · VO copy",  color: GREEN,     route: "/dashboard/boards/new" },
  { icon: Brain,      label: "Write script",     desc: "Full ad from concept",      color: "#a78bfa", route: "/dashboard/script" },
  { icon: Target,     label: "Pre-flight",       desc: "Check before launch",       color: AMBER,     route: "/dashboard/preflight" },
  { icon: Activity,   label: "Competitor",       desc: "Decode any ad",             color: RED,       route: "/dashboard/competitor" },
];

function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0, animation: pulse ? "loopPulse 2s infinite" : "none" }} />;
}

function Tag({ label, color }: { label: string; color: string }) {
  return <span style={{ ...M, fontSize: 9, color, background: `${color}14`, border: `1px solid ${color}25`, padding: "2px 7px", borderRadius: 999, letterSpacing: "0.06em" }}>{label}</span>;
}

// ── AI Block ──────────────────────────────────────────────────────────────────
function AIBlockCard({ block, onNav }: { block: AIBlock; onNav: (r: string) => void }) {
  const s = BLOCK_STYLES[block.type];
  const Icon = BLOCK_ICONS[block.type];
  return (
    <div style={{ borderRadius: 11, border: `1px solid ${s.border}`, background: s.bg, padding: "10px 12px", marginBottom: 5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: block.content || block.items ? 6 : 0 }}>
        <Icon size={12} color={s.color} />
        <span style={{ ...J, fontSize: 11, fontWeight: 700, color: s.color }}>{block.title}</span>
      </div>
      {block.content && <p style={{ ...J, fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.65, marginBottom: block.items ? 6 : 0 }}>{block.content}</p>}
      {block.items?.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 3 }}>
          <span style={{ color: s.color, fontSize: 10, marginTop: 2, flexShrink: 0 }}>→</span>
          <span style={{ ...J, fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}>{item}</span>
        </div>
      ))}
      {block.type === "navigate" && block.route && (
        <button onClick={() => onNav(block.route!)} style={{ ...J, display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, padding: "7px 12px", borderRadius: 7, background: `linear-gradient(135deg,${BLUE},${TEAL})`, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none" }}>
          {block.cta || "Open →"} <ArrowRight size={10} />
        </button>
      )}
    </div>
  );
}

// ── Left: Pulse ───────────────────────────────────────────────────────────────
function PulsePanel({ pulse, loading, onConnect }: { pulse: AccountPulse | null; loading: boolean; onConnect: () => void }) {
  const timeAgo = (ts: string) => {
    const h = Math.floor((Date.now() - new Date(ts).getTime()) / 3600000);
    if (h < 1) return `${Math.floor((Date.now() - new Date(ts).getTime()) / 60000)}m ago`;
    return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
  };

  const Row = ({ label, value, delta, color = BLUE }: { label: string; value: string; delta?: number | null; color?: string }) => {
    const DIcon = delta == null ? Minus : delta > 0 ? TrendingUp : TrendingDown;
    const dc = delta == null ? "rgba(255,255,255,0.18)" : delta > 0 ? GREEN : RED;
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${BORDER}` }}>
        <span style={{ ...M, fontSize: 10, color: MUTED, letterSpacing: "0.04em" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {delta != null && <DIcon size={9} color={dc} />}
          <span style={{ ...J, fontSize: 12, fontWeight: 700, color: "#fff" }}>{value}</span>
        </div>
      </div>
    );
  };

  const platforms = [
    { id: "meta", label: "Meta", color: "#60a5fa" },
    { id: "tiktok", label: "TikTok", color: TEAL },
    { id: "google", label: "Google", color: GREEN },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "12px 14px 10px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
        <Activity size={11} color={BLUE} />
        <span style={{ ...M, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>Account Pulse</span>
        {!loading && <Dot color={GREEN} pulse />}
        {loading && <Loader2 size={9} color={MUTED} className="animate-spin" />}
      </div>

      {/* Stats */}
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <Row label="Hook score" value={pulse?.avgHookScore ? `${pulse.avgHookScore.toFixed(1)} / 10` : "—"} delta={pulse?.weeklyDelta} />
        <Row label="Analyses" value={String(pulse?.totalAnalyses ?? 0)} />
        <Row label="Viral hooks" value={String(pulse?.viralHooks ?? 0)} color={GREEN} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ ...M, fontSize: 10, color: MUTED, letterSpacing: "0.04em" }}>Top format</span>
          {pulse?.topFormat ? <Tag label={pulse.topFormat} color="#a78bfa" /> : <span style={{ ...J, fontSize: 12, fontWeight: 700, color: "#fff" }}>—</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0" }}>
          <span style={{ ...M, fontSize: 10, color: MUTED, letterSpacing: "0.04em" }}>Top market</span>
          {pulse?.topMarket ? <Tag label={pulse.topMarket} color={AMBER} /> : <span style={{ ...J, fontSize: 12, fontWeight: 700, color: "#fff" }}>—</span>}
        </div>
      </div>

      {/* Platforms */}
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <p style={{ ...M, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)", marginBottom: 7 }}>Platforms</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {platforms.map(p => {
            const connected = pulse?.platformImports?.some(i => i.platform === p.id);
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 8, background: connected ? `${p.color}08` : SURFACE, border: `1px solid ${connected ? p.color + "20" : BORDER}` }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, background: connected ? `${p.color}18` : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ ...M, fontSize: 9, fontWeight: 700, color: connected ? p.color : "rgba(255,255,255,0.18)" }}>{p.id[0].toUpperCase()}</span>
                </div>
                <span style={{ ...J, fontSize: 11, color: connected ? "#fff" : "rgba(255,255,255,0.3)", flex: 1 }}>{p.label}</span>
                <Dot color={connected ? GREEN : "rgba(255,255,255,0.12)"} pulse={connected} />
              </div>
            );
          })}
        </div>
        <button onClick={onConnect} style={{ ...J, width: "100%", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px", borderRadius: 8, background: "transparent", border: `1px dashed ${BLUE}35`, color: BLUE, fontSize: 11, cursor: "pointer", transition: "all 0.12s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${BLUE}0a`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
          <Link2 size={10} /> Connect account
        </button>
      </div>

      {/* Recent */}
      <div style={{ padding: "10px 14px", flex: 1, overflow: "hidden" }}>
        <p style={{ ...M, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)", marginBottom: 7 }}>Recent</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {(pulse?.recentActivity ?? []).slice(0, 5).map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: SURFACE2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                <BarChart3 size={8} color={BLUE} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...J, fontSize: 10, color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 1 }}>{item.title}</p>
                <p style={{ ...M, fontSize: 9, color: "rgba(255,255,255,0.22)" }}>{timeAgo(item.ts)}{item.score ? ` · ${item.score.toFixed(1)}` : ""}</p>
              </div>
            </div>
          ))}
          {!pulse?.recentActivity?.length && <p style={{ ...M, fontSize: 10, color: "rgba(255,255,255,0.18)" }}>No activity yet</p>}
        </div>
      </div>
    </div>
  );
}

// ── Center: AI ────────────────────────────────────────────────────────────────
function AIPanel({ pulse, user }: { pulse: AccountPulse | null; user: any }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setMessages([{
        role: "assistant",
        blocks: [{
          type: "insight",
          title: "Ready — full account context loaded",
          content: pulse?.totalAnalyses
            ? `I have ${pulse.totalAnalyses} analyses, your creative patterns, and performance history. Ask me anything about your ads or account.`
            : "No analyses yet. Analyze your first ad to start building creative intelligence — I'll get smarter with every ad you run.",
        }],
        ts: Date.now(),
      }]);
      setReady(true);
    }, 300);
    return () => clearTimeout(t);
  }, [pulse]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    setInput("");
    setSending(true);
    setMessages(prev => [
      ...prev,
      { role: "user", text, ts: Date.now() },
      { role: "assistant", loading: true, ts: Date.now() + 1 },
    ]);
    try {
      const { data, error } = await supabase.functions.invoke("adbrief-ai-chat", {
        body: { message: text, user_id: user.id, context: { pulse } },
      });
      if (error) throw error;
      setMessages(prev => prev.map(m => m.loading ? { role: "assistant", blocks: data.blocks || [], ts: Date.now() } : m));
    } catch (e: any) {
      setMessages(prev => prev.map(m => m.loading ? { role: "assistant", blocks: [{ type: "warning", title: "Something went wrong", content: e.message || "Try again." }], ts: Date.now() } : m));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const hasConversation = messages.filter(m => m.role === "user").length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Input at TOP — most important, first thing you see */}
      <div style={{ padding: "14px 20px 12px", borderBottom: `1px solid ${BORDER}`, flexShrink: 0, background: "rgba(14,165,233,0.025)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg,${BLUE},${TEAL})`, justifyContent: "center", flexShrink: 0 }}>
            <Brain size={13} color="#000" />
          </div>
          <div style={{ flex: 1, background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 11, padding: "9px 10px 9px 14px", display: "flex", gap: 8, alignItems: "flex-end", transition: "border-color 0.15s" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about your ads, account, or what to do next..."
              rows={1}
              style={{ ...J, flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", color: "#fff", fontSize: 13, lineHeight: 1.5, maxHeight: 72, overflowY: "auto", caretColor: BLUE }}
            />
            <button onClick={() => send(input)} disabled={!input.trim() || sending}
              style={{ width: 30, height: 30, borderRadius: 8, background: input.trim() && !sending ? `linear-gradient(135deg,${BLUE},${TEAL})` : SURFACE, border: "none", cursor: input.trim() && !sending ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.12s" }}>
              {sending ? <Loader2 size={12} color={MUTED} className="animate-spin" /> : <Send size={12} color={input.trim() ? "#000" : MUTED} />}
            </button>
          </div>
        </div>
        <p style={{ ...M, fontSize: 9, color: "rgba(255,255,255,0.18)", marginTop: 5, marginLeft: 38, letterSpacing: "0.04em" }}>
          Enter to send · Shift+Enter for new line · AI has full account context
        </p>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Welcome block */}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
            {msg.role === "user" && (
              <div style={{ maxWidth: "78%", padding: "8px 13px", borderRadius: "11px 11px 3px 11px", background: SURFACE2, border: `1px solid ${BORDER}` }}>
                <p style={{ ...J, fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>{msg.text}</p>
              </div>
            )}
            {msg.role === "assistant" && msg.loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 12px", borderRadius: 10, background: SURFACE }}>
                <Loader2 size={11} color={BLUE} className="animate-spin" />
                <span style={{ ...M, fontSize: 10, color: MUTED }}>Thinking...</span>
              </div>
            )}
            {msg.role === "assistant" && !msg.loading && msg.blocks && (
              <div style={{ width: "100%", maxWidth: "92%" }}>
                {msg.blocks.map((block, j) => <AIBlockCard key={j} block={block} onNav={navigate} />)}
              </div>
            )}
          </div>
        ))}

        {/* Quick prompts — shown when no conversation */}
        {!hasConversation && ready && (
          <div style={{ marginTop: 8 }}>
            <p style={{ ...M, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)", marginBottom: 8 }}>Suggested questions</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
              {QUICK_PROMPTS.map((q, i) => (
                <button key={i} onClick={() => send(q)} style={{ ...J, padding: "8px 10px", borderRadius: 9, background: SURFACE, border: `1px solid ${BORDER}`, color: "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer", textAlign: "left", lineHeight: 1.4, transition: "all 0.12s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${BLUE}40`; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; (e.currentTarget as HTMLButtonElement).style.background = `${BLUE}06`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; (e.currentTarget as HTMLButtonElement).style.background = SURFACE; }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Right: Actions ────────────────────────────────────────────────────────────
function ActionsPanel({ pulse }: { pulse: AccountPulse | null }) {
  const navigate = useNavigate();
  const hasData = (pulse?.totalAnalyses ?? 0) > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "12px 12px 10px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
        <Sparkles size={11} color={AMBER} />
        <span style={{ ...M, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>Tools</span>
      </div>

      <div style={{ padding: "8px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 3, overflow: "hidden" }}>
        {TOOLS.map(t => {
          const [hov, setHov] = useState(false);
          return (
            <button key={t.route}
              onMouseEnter={() => setHov(true)}
              onMouseLeave={() => setHov(false)}
              onClick={() => navigate(t.route)}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 9, cursor: "pointer", background: hov ? `${t.color}0a` : SURFACE, border: `1px solid ${hov ? t.color + "28" : BORDER}`, transition: "all 0.12s", width: "100%", textAlign: "left" }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: `${t.color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <t.icon size={12} color={t.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...J, fontSize: 11, fontWeight: 700, color: hov ? "#fff" : "rgba(255,255,255,0.78)", marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</p>
                <p style={{ ...M, fontSize: 9, color: MUTED, letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.desc}</p>
              </div>
              <ArrowRight size={10} color={hov ? t.color : "rgba(255,255,255,0.14)"} style={{ flexShrink: 0, transition: "color 0.12s" }} />
            </button>
          );
        })}
      </div>

      {/* Memory status */}
      <div style={{ padding: "8px 10px 10px", borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <div style={{ background: hasData ? "rgba(52,211,153,0.05)" : SURFACE, border: `1px solid ${hasData ? "rgba(52,211,153,0.16)" : BORDER}`, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <Brain size={11} color={hasData ? GREEN : MUTED} />
            <span style={{ ...J, fontSize: 11, fontWeight: 700, color: hasData ? GREEN : MUTED }}>AI Memory</span>
            <span style={{ ...M, fontSize: 8, color: hasData ? GREEN : MUTED, background: `${hasData ? GREEN : MUTED}14`, border: `1px solid ${hasData ? GREEN : MUTED}25`, padding: "2px 6px", borderRadius: 999 }}>
              {hasData ? "Active" : "Empty"}
            </span>
          </div>
          <p style={{ ...M, fontSize: 9, color: "rgba(255,255,255,0.28)", lineHeight: 1.55 }}>
            {hasData
              ? `${pulse?.totalAnalyses} ads analyzed. Every new ad makes the AI sharper for your account.`
              : "Analyze your first ad to start building intelligence."}
          </p>
          {!hasData && (
            <button onClick={() => navigate("/dashboard/analyses/new")} style={{ ...J, width: "100%", marginTop: 8, padding: "7px", borderRadius: 7, background: `linear-gradient(135deg,${BLUE},${TEAL})`, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none" }}>
              Analyze first ad →
            </button>
          )}
        </div>
        <button onClick={() => navigate("/dashboard/loop/import")}
          style={{ ...J, width: "100%", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px", borderRadius: 8, background: "transparent", border: `1px dashed ${BORDER}`, color: MUTED, fontSize: 11, cursor: "pointer", transition: "all 0.12s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${BLUE}35`; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER; (e.currentTarget as HTMLButtonElement).style.color = MUTED; }}>
          <Plus size={10} /> Import platform data
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LoopV2() {
  const { user } = useOutletContext<DashboardContext>();
  const [pulse, setPulse] = useState<AccountPulse | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const loadPulse = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: analyses }, { data: mem }, { data: imp }] = await Promise.all([
        supabase.from("analyses").select("id, created_at, result, hook_strength, status, title")
          .eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(100),
        supabase.from("creative_memory" as never).select("hook_type, hook_score, platform, created_at" as never)
          .eq("user_id" as never, user.id).order("created_at" as never, { ascending: false }).limit(100),
        supabase.from("ads_data_imports" as never).select("platform, created_at" as never)
          .eq("user_id" as never, user.id),
      ]);
      const rows = (analyses || []) as any[];
      const memRows = (mem || []) as any[];
      const impRows = (imp || []) as any[];

      const scores = rows.map((r: any) => { const res = r.result as any; return res?.hook_score || res?.hookScore || null; }).filter(Boolean) as number[];
      const avgScore = scores.length ? scores.reduce((a, b) => a + b) / scores.length : null;

      const now = Date.now(), week = 7 * 24 * 3600 * 1000;
      const recentScores = rows.filter((r: any) => new Date(r.created_at).getTime() > now - week).map((r: any) => (r.result as any)?.hook_score).filter(Boolean) as number[];
      const prevScores = rows.filter((r: any) => { const t = new Date(r.created_at).getTime(); return t > now - 2 * week && t <= now - week; }).map((r: any) => (r.result as any)?.hook_score).filter(Boolean) as number[];
      const recentAvg = recentScores.length ? recentScores.reduce((a, b) => a + b) / recentScores.length : null;
      const prevAvg = prevScores.length ? prevScores.reduce((a, b) => a + b) / prevScores.length : null;
      const weeklyDelta = recentAvg && prevAvg ? Math.round((recentAvg - prevAvg) * 10) / 10 : null;

      const countField = (field: string, arr: any[]) => { const map: Record<string, number> = {}; arr.forEach(r => { const v = r[field]; if (v && v !== "unknown") map[v] = (map[v] || 0) + 1; }); return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || null; };

      const markets: Record<string, number> = {};
      rows.forEach((r: any) => { const m = (r.result as any)?.market; if (m) markets[m] = (markets[m] || 0) + 1; });

      const platMap: Record<string, { count: number; last: string }> = {};
      impRows.forEach((r: any) => { const p = r.platform || "unknown"; if (!platMap[p]) platMap[p] = { count: 0, last: r.created_at }; platMap[p].count++; if (r.created_at > platMap[p].last) platMap[p].last = r.created_at; });

      setPulse({
        avgHookScore: avgScore ? Math.round(avgScore * 10) / 10 : null,
        totalAnalyses: rows.length, viralHooks: rows.filter((r: any) => r.hook_strength === "viral").length,
        topFormat: countField("hook_type", memRows), topPlatform: countField("platform", memRows),
        topMarket: Object.entries(markets).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
        weeklyDelta, recentActivity: rows.slice(0, 6).map((r: any) => ({ title: r.title || "Analysis", type: "analysis", score: (r.result as any)?.hook_score || null, ts: r.created_at })),
        platformImports: Object.entries(platMap).map(([platform, v]) => ({ platform, ...v })),
      });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [user.id]);

  useEffect(() => { loadPulse(); }, [loadPulse]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-oauth", { body: { action: "get_auth_url", user_id: user.id } });
      if (error) throw error;
      window.location.href = data.url;
    } catch (e) { console.error(e); setConnecting(false); }
  };

  const platforms = [
    { id: "meta", color: "#60a5fa" },
    { id: "tiktok", color: TEAL },
    { id: "google", color: GREEN },
  ];

  return (
    <div style={{ height: "100%", minHeight: "calc(100vh - 44px)", display: "flex", flexDirection: "column", background: "#070810", overflow: "hidden" }}>
      <style>{`
        @keyframes loopPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 999px; }
      `}</style>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 18px", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: `linear-gradient(135deg,${BLUE},${TEAL})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RefreshCw size={10} color="#000" />
            </div>
            <span style={{ ...J, fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Loop</span>
          </div>
          <div style={{ height: 10, width: 1, background: BORDER }} />
          <span style={{ ...M, fontSize: 9, color: MUTED, letterSpacing: "0.04em" }}>
            {loading ? "loading..." : `${pulse?.totalAnalyses ?? 0} analyses · ${pulse?.platformImports?.length ?? 0} platforms connected`}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {platforms.map(p => {
            const connected = pulse?.platformImports?.some(i => i.platform === p.id);
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ ...M, fontSize: 9, color: connected ? p.color : "rgba(255,255,255,0.14)", fontWeight: 700, letterSpacing: "0.04em" }}>{p.id[0].toUpperCase()}</span>
                <Dot color={connected ? p.color : "rgba(255,255,255,0.1)"} pulse={connected} />
              </div>
            );
          })}
          <button onClick={loadPulse} style={{ width: 22, height: 22, borderRadius: 6, background: SURFACE, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <RefreshCw size={10} color={MUTED} />
          </button>
        </div>
      </div>

      {/* Three columns */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "200px 1fr 210px", overflow: "hidden" }}>
        <div style={{ borderRight: `1px solid ${BORDER}`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <PulsePanel pulse={pulse} loading={loading} onConnect={handleConnect} />
        </div>
        <div style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <AIPanel pulse={pulse} user={user} />
        </div>
        <div style={{ borderLeft: `1px solid ${BORDER}`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <ActionsPanel pulse={pulse} />
        </div>
      </div>
    </div>
  );
}
