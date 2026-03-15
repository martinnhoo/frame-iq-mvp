/**
 * AdBrief Loop V2
 * The creative intelligence command center.
 * Three-column layout: Account Pulse | AI Chat | Quick Actions
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Send, Loader2, BarChart3, Zap, Brain, FileText,
  ArrowRight, TrendingUp, TrendingDown, Minus,
  Link2, CheckCircle2, Plus, Sparkles, RotateCcw,
  Target, AlertTriangle, Activity, RefreshCw,
} from "lucide-react";

// ── Design tokens ──────────────────────────────────────────────────────────────
const J = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;
const M = { fontFamily: "'DM Mono', monospace" } as React.CSSProperties;
const BLUE = "#0ea5e9";
const TEAL = "#06b6d4";
const GREEN = "#34d399";
const AMBER = "#fbbf24";
const RED = "#f87171";
const MUTED = "rgba(255,255,255,0.35)";
const BORDER = "rgba(255,255,255,0.07)";
const SURFACE = "rgba(255,255,255,0.03)";
const SURFACE2 = "rgba(255,255,255,0.06)";

// ── Types ──────────────────────────────────────────────────────────────────────
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
  title: string;
  content?: string;
  items?: string[];
  route?: string;
  cta?: string;
}

interface AIMessage {
  role: "user" | "assistant";
  text?: string;
  blocks?: AIBlock[];
  ts: number;
  loading?: boolean;
}

// ── Micro components ───────────────────────────────────────────────────────────

function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, animation: pulse ? "pulse 2s infinite" : "none" }} />
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ ...M, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color, background: `${color}14`, border: `1px solid ${color}28`, padding: "3px 8px", borderRadius: 999 }}>
      {label}
    </span>
  );
}

function StatRow({ label, value, delta, color = BLUE }: { label: string; value: string; delta?: number | null; color?: string }) {
  const DeltaIcon = delta == null ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const deltaColor = delta == null ? "rgba(255,255,255,0.2)" : delta > 0 ? GREEN : delta < 0 ? RED : MUTED;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ ...M, fontSize: 10, color: MUTED, letterSpacing: "0.06em" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {delta != null && <DeltaIcon size={10} color={deltaColor} />}
        <span style={{ ...J, fontSize: 13, fontWeight: 700, color: "#fff" }}>{value}</span>
      </div>
    </div>
  );
}

function PlatformBadge({ platform, connected }: { platform: string; connected: boolean }) {
  const icons: Record<string, string> = { meta: "M", tiktok: "T", google: "G" };
  const colors: Record<string, string> = { meta: "#60a5fa", tiktok: TEAL, google: GREEN };
  const labels: Record<string, string> = { meta: "Meta", tiktok: "TikTok", google: "Google" };
  const c = colors[platform] || BLUE;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: connected ? `${c}08` : SURFACE, border: `1px solid ${connected ? c + "25" : BORDER}` }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: connected ? `${c}20` : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ ...M, fontSize: 10, fontWeight: 700, color: connected ? c : "rgba(255,255,255,0.2)" }}>{icons[platform]}</span>
      </div>
      <span style={{ ...J, fontSize: 11, fontWeight: 600, color: connected ? "#fff" : "rgba(255,255,255,0.3)" }}>{labels[platform]}</span>
      <div style={{ marginLeft: "auto" }}>
        {connected ? <Dot color={GREEN} pulse /> : <Dot color="rgba(255,255,255,0.15)" />}
      </div>
    </div>
  );
}

// ── AI Block renderer ──────────────────────────────────────────────────────────

const BLOCK_STYLES: Record<AIBlock["type"], { color: string; bg: string; border: string }> = {
  insight:  { color: GREEN,  bg: "rgba(52,211,153,0.06)",  border: "rgba(52,211,153,0.18)"  },
  action:   { color: BLUE,   bg: "rgba(14,165,233,0.06)",  border: "rgba(14,165,233,0.18)"  },
  warning:  { color: AMBER,  bg: "rgba(251,191,36,0.06)",  border: "rgba(251,191,36,0.18)"  },
  pattern:  { color: "#a78bfa", bg: "rgba(167,139,250,0.06)", border: "rgba(167,139,250,0.18)" },
  hooks:    { color: TEAL,   bg: "rgba(6,182,212,0.06)",   border: "rgba(6,182,212,0.18)"   },
  navigate: { color: BLUE,   bg: "rgba(14,165,233,0.04)",  border: "rgba(14,165,233,0.22)"  },
};

const BLOCK_ICONS: Record<AIBlock["type"], React.ElementType> = {
  insight: Sparkles, action: Target, warning: AlertTriangle,
  pattern: Activity, hooks: Zap, navigate: ArrowRight,
};

function AIBlockCard({ block, onNav }: { block: AIBlock; onNav: (r: string) => void }) {
  const s = BLOCK_STYLES[block.type];
  const Icon = BLOCK_ICONS[block.type];

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${s.border}`, background: s.bg, padding: "12px 14px", marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: block.content || block.items ? 8 : 0 }}>
        <Icon size={13} color={s.color} />
        <span style={{ ...J, fontSize: 12, fontWeight: 700, color: s.color }}>{block.title}</span>
      </div>
      {block.content && <p style={{ ...J, fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, marginBottom: block.items ? 8 : 0 }}>{block.content}</p>}
      {block.items?.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <span style={{ color: s.color, fontSize: 10, marginTop: 3, flexShrink: 0 }}>→</span>
          <span style={{ ...J, fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{item}</span>
        </div>
      ))}
      {block.type === "navigate" && block.route && (
        <button onClick={() => onNav(block.route!)}
          style={{ ...J, display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "8px 14px", borderRadius: 8, background: `linear-gradient(135deg,${BLUE},${TEAL})`, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none" }}>
          {block.cta || "Open →"} <ArrowRight size={11} />
        </button>
      )}
    </div>
  );
}

// ── Quick action button ────────────────────────────────────────────────────────

function QuickAction({ icon: Icon, label, desc, color, onClick }: { icon: React.ElementType; label: string; desc: string; color: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", borderRadius: 11, cursor: "pointer",
        background: hov ? `${color}0d` : SURFACE,
        border: `1px solid ${hov ? color + "30" : BORDER}`,
        transition: "all 0.15s", textAlign: "left",
      }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={14} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ ...J, fontSize: 12, fontWeight: 700, color: hov ? "#fff" : "rgba(255,255,255,0.8)", marginBottom: 1 }}>{label}</p>
        <p style={{ ...M, fontSize: 9, color: MUTED, letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{desc}</p>
      </div>
      <ArrowRight size={12} color={hov ? color : "rgba(255,255,255,0.15)"} style={{ flexShrink: 0, transition: "color 0.15s" }} />
    </button>
  );
}

// ── Left column: Account Pulse ─────────────────────────────────────────────────

function AccountPulsePanel({ pulse, loading }: { pulse: AccountPulse | null; loading: boolean }) {
  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%" }}>

      {/* Header */}
      <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Activity size={13} color={BLUE} />
          <span style={{ ...M, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED }}>Account Pulse</span>
          {!loading && <Dot color={GREEN} pulse />}
          {loading && <Loader2 size={10} color={MUTED} className="animate-spin" />}
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ marginBottom: 2 }}>
          <StatRow label="Avg hook score" value={pulse?.avgHookScore ? `${pulse.avgHookScore.toFixed(1)} / 10` : "—"} delta={pulse?.weeklyDelta} color={BLUE} />
          <StatRow label="Total analyses" value={String(pulse?.totalAnalyses ?? 0)} color={TEAL} />
          <StatRow label="Viral hooks" value={String(pulse?.viralHooks ?? 0)} color={GREEN} />
          <StatRow label="Top format" value={pulse?.topFormat ?? "—"} color="#a78bfa" />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0" }}>
            <span style={{ ...M, fontSize: 10, color: MUTED, letterSpacing: "0.06em" }}>Top market</span>
            <Tag label={pulse?.topMarket ?? "—"} color={AMBER} />
          </div>
        </div>
      </div>

      {/* Platform connections */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}` }}>
        <p style={{ ...M, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 8 }}>Platforms</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {["meta", "tiktok", "google"].map(p => {
            const imp = pulse?.platformImports?.find(i => i.platform === p);
            return <PlatformBadge key={p} platform={p} connected={!!imp} />;
          })}
        </div>
        <button style={{ ...J, width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", borderRadius: 8, background: "transparent", border: `1px dashed ${BORDER}`, color: MUTED, fontSize: 11, cursor: "pointer" }}>
          <Link2 size={11} /> Connect account
        </button>
      </div>

      {/* Recent activity */}
      <div style={{ padding: "12px 16px", flex: 1, overflow: "hidden" }}>
        <p style={{ ...M, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 8 }}>Recent</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, overflow: "hidden" }}>
          {(pulse?.recentActivity ?? []).slice(0, 5).map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, background: SURFACE2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                {item.type === "analysis" ? <BarChart3 size={9} color={BLUE} /> : <FileText size={9} color={TEAL} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...J, fontSize: 10, color: "rgba(255,255,255,0.65)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 1 }}>{item.title}</p>
                <p style={{ ...M, fontSize: 9, color: "rgba(255,255,255,0.25)" }}>{timeAgo(item.ts)}{item.score ? ` · ${item.score.toFixed(1)}` : ""}</p>
              </div>
            </div>
          ))}
          {!pulse?.recentActivity?.length && (
            <p style={{ ...M, fontSize: 10, color: "rgba(255,255,255,0.2)" }}>No activity yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Center column: AI Chat ─────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  "What's my best-performing hook type right now?",
  "Which ads should I pause before I waste more budget?",
  "What should I produce next for BR?",
  "Why did my CTR drop this week?",
  "Generate 3 hooks based on my winning patterns",
  "What's wrong with my recent ads?",
];

function AIPanel({ pulse, user }: { pulse: AccountPulse | null; user: any }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Show welcome after short delay
    const t = setTimeout(() => {
      setMessages([{
        role: "assistant",
        blocks: [{
          type: "insight",
          title: "Ready — full account context loaded",
          content: pulse?.totalAnalyses
            ? `I have access to ${pulse.totalAnalyses} analyses, your creative patterns, and performance history. Ask me anything about your ads.`
            : "No analyses yet. Analyze your first ad to start building creative intelligence.",
        }],
        ts: Date.now(),
      }]);
      setReady(true);
    }, 400);
    return () => clearTimeout(t);
  }, [pulse]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    setInput("");
    setSending(true);

    const userMsg: AIMessage = { role: "user", text, ts: Date.now() };
    const loadingMsg: AIMessage = { role: "assistant", loading: true, ts: Date.now() + 1 };
    setMessages(prev => [...prev, userMsg, loadingMsg]);

    try {
      const { data, error } = await supabase.functions.invoke("adbrief-ai", {
        body: { message: text, user_id: user.id, context: { pulse } },
      });
      if (error) throw error;

      setMessages(prev => prev.map(m =>
        m.loading ? { role: "assistant", blocks: data.blocks || [], ts: Date.now() } : m
      ));
    } catch (e: any) {
      setMessages(prev => prev.map(m =>
        m.loading ? {
          role: "assistant",
          blocks: [{ type: "warning", title: "Something went wrong", content: e.message || "Try again in a moment." }],
          ts: Date.now(),
        } : m
      ));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Header */}
      <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg,${BLUE},${TEAL})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Brain size={13} color="#000" />
        </div>
        <div>
          <p style={{ ...J, fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>AdBrief AI</p>
          <p style={{ ...M, fontSize: 9, color: MUTED, letterSpacing: "0.06em" }}>
            {pulse?.totalAnalyses ? `${pulse.totalAnalyses} analyses · full context` : "waiting for data"}
          </p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Dot color={ready ? GREEN : AMBER} pulse={ready} />
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
            {msg.role === "user" && (
              <div style={{ maxWidth: "80%", padding: "9px 14px", borderRadius: "12px 12px 3px 12px", background: SURFACE2, border: `1px solid ${BORDER}` }}>
                <p style={{ ...J, fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>{msg.text}</p>
              </div>
            )}
            {msg.role === "assistant" && msg.loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: SURFACE }}>
                <Loader2 size={12} color={BLUE} className="animate-spin" />
                <span style={{ ...M, fontSize: 11, color: MUTED }}>Thinking...</span>
              </div>
            )}
            {msg.role === "assistant" && !msg.loading && msg.blocks && (
              <div style={{ width: "100%", maxWidth: "90%" }}>
                {msg.blocks.map((block, j) => (
                  <AIBlockCard key={j} block={block} onNav={navigate} />
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Quick prompts — show when no conversation yet */}
        {messages.filter(m => m.role === "user").length === 0 && ready && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            <p style={{ ...M, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 4 }}>Suggested</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {QUICK_PROMPTS.map((q, i) => (
                <button key={i} onClick={() => send(q)}
                  style={{ ...J, padding: "9px 11px", borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}`, color: "rgba(255,255,255,0.55)", fontSize: 11, cursor: "pointer", textAlign: "left", lineHeight: 1.4, transition: "all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = BLUE + "40"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)"; }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "8px 8px 8px 14px", transition: "border-color 0.15s" }}
          onFocus={e => (e.currentTarget as HTMLDivElement).style.borderColor = BLUE + "50"}
          onBlur={e => (e.currentTarget as HTMLDivElement).style.borderColor = BORDER}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your ads..."
            rows={1}
            style={{ ...J, flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", color: "#fff", fontSize: 13, lineHeight: 1.5, maxHeight: 80, overflowY: "auto" }}
          />
          <button onClick={() => send(input)} disabled={!input.trim() || sending}
            style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() && !sending ? `linear-gradient(135deg,${BLUE},${TEAL})` : SURFACE, border: "none", cursor: input.trim() && !sending ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
            {sending ? <Loader2 size={13} color={MUTED} className="animate-spin" /> : <Send size={13} color={input.trim() ? "#000" : MUTED} />}
          </button>
        </div>
        <p style={{ ...M, fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 6, textAlign: "center", letterSpacing: "0.04em" }}>Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

// ── Right column: Quick Actions ────────────────────────────────────────────────

function ActionsPanel({ pulse }: { pulse: AccountPulse | null }) {
  const navigate = useNavigate();

  const tools = [
    { icon: BarChart3, label: "Analyze ad", desc: "Hook score in 60s", color: BLUE, route: "/dashboard/analyses/new" },
    { icon: Zap, label: "Generate hooks", desc: "10 angles, predicted CTR", color: TEAL, route: "/dashboard/hooks" },
    { icon: FileText, label: "Create brief", desc: "Scene-by-scene, VO copy", color: GREEN, route: "/dashboard/boards/new" },
    { icon: Brain, label: "Write script", desc: "Full ad from concept", color: "#a78bfa", route: "/dashboard/script" },
    { icon: Target, label: "Pre-flight check", desc: "Before you launch", color: AMBER, route: "/dashboard/preflight" },
    { icon: Activity, label: "Competitor decoder", desc: "Reverse-engineer any ad", color: RED, route: "/dashboard/competitor" },
  ];

  const hasData = (pulse?.totalAnalyses ?? 0) > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Header */}
      <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={13} color={AMBER} />
          <span style={{ ...M, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED }}>Tools</span>
        </div>
      </div>

      {/* Tools list */}
      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        {tools.map(t => (
          <QuickAction key={t.route} icon={t.icon} label={t.label} desc={t.desc} color={t.color} onClick={() => navigate(t.route)} />
        ))}
      </div>

      {/* AI Memory status */}
      <div style={{ padding: "12px 14px", borderTop: `1px solid ${BORDER}` }}>
        <div style={{ background: hasData ? "rgba(52,211,153,0.05)" : SURFACE, border: `1px solid ${hasData ? "rgba(52,211,153,0.18)" : BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Brain size={12} color={hasData ? GREEN : MUTED} />
            <span style={{ ...J, fontSize: 11, fontWeight: 700, color: hasData ? GREEN : MUTED }}>AI Memory</span>
            <Tag label={hasData ? "Active" : "Empty"} color={hasData ? GREEN : MUTED} />
          </div>
          <p style={{ ...M, fontSize: 9, color: "rgba(255,255,255,0.3)", lineHeight: 1.55 }}>
            {hasData
              ? `Learning from ${pulse?.totalAnalyses} analyses. Every new ad makes the AI sharper for your account.`
              : "Analyze your first ad to start building account intelligence."}
          </p>
          {!hasData && (
            <button onClick={() => navigate("/dashboard/analyses/new")}
              style={{ ...J, width: "100%", marginTop: 8, padding: "8px", borderRadius: 8, background: `linear-gradient(135deg,${BLUE},${TEAL})`, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none" }}>
              Analyze first ad →
            </button>
          )}
        </div>

        {/* Import data */}
        <button onClick={() => navigate("/dashboard/loop/import")}
          style={{ ...J, width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 10, background: "transparent", border: `1px dashed ${BORDER}`, color: MUTED, fontSize: 11, cursor: "pointer", transition: "all 0.15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = BLUE + "40"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER; (e.currentTarget as HTMLButtonElement).style.color = MUTED; }}>
          <Plus size={11} /> Import platform data
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LoopV2() {
  const { user, profile } = useOutletContext<DashboardContext>();
  const [pulse, setPulse] = useState<AccountPulse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPulse = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: analyses }, { data: mem }, { data: imp }] = await Promise.all([
        supabase.from("analyses").select("id, created_at, result, hook_strength, hook_score, status, title")
          .eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(100),
        supabase.from("creative_memory" as never).select("hook_type, hook_score, platform, created_at" as never)
          .eq("user_id" as never, user.id).order("created_at" as never, { ascending: false }).limit(100),
        supabase.from("ads_data_imports" as never).select("platform, created_at" as never)
          .eq("user_id" as never, user.id).order("created_at" as never, { ascending: false }),
      ]);

      const rows = (analyses || []) as any[];
      const memRows = (mem || []) as any[];
      const impRows = (imp || []) as any[];

      // Compute stats
      const scores = rows.map((r: any) => {
        const res = r.result as any;
        return res?.hook_score || res?.hookScore || r.hook_score || null;
      }).filter(Boolean) as number[];

      const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

      // Weekly delta: compare last 7d avg vs previous 7d
      const now = Date.now();
      const week = 7 * 24 * 3600 * 1000;
      const recentScores = rows.filter((r: any) => new Date(r.created_at).getTime() > now - week)
        .map((r: any) => { const res = r.result as any; return res?.hook_score || null; }).filter(Boolean) as number[];
      const prevScores = rows.filter((r: any) => {
        const t = new Date(r.created_at).getTime();
        return t > now - 2 * week && t <= now - week;
      }).map((r: any) => { const res = r.result as any; return res?.hook_score || null; }).filter(Boolean) as number[];

      const recentAvg = recentScores.length ? recentScores.reduce((a, b) => a + b) / recentScores.length : null;
      const prevAvg = prevScores.length ? prevScores.reduce((a, b) => a + b) / prevScores.length : null;
      const weeklyDelta = recentAvg && prevAvg ? Math.round((recentAvg - prevAvg) * 10) / 10 : null;

      // Top format / market from memory
      const countField = (field: string, arr: any[]) => {
        const map: Record<string, number> = {};
        arr.forEach(r => { const v = r[field]; if (v && v !== "unknown") map[v] = (map[v] || 0) + 1; });
        return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      };

      const topFormat = countField("hook_type", memRows);
      const topPlatform = countField("platform", memRows);

      // Markets from analyses results
      const markets: Record<string, number> = {};
      rows.forEach((r: any) => {
        const m = (r.result as any)?.market;
        if (m) markets[m] = (markets[m] || 0) + 1;
      });
      const topMarket = Object.entries(markets).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      // Viral hooks
      const viralHooks = rows.filter((r: any) => r.hook_strength === "viral").length;

      // Recent activity
      const recentActivity = rows.slice(0, 8).map((r: any) => ({
        title: r.title || "Analysis",
        type: "analysis",
        score: (r.result as any)?.hook_score || null,
        ts: r.created_at,
      }));

      // Platform imports summary
      const platMap: Record<string, { count: number; last: string }> = {};
      impRows.forEach((r: any) => {
        const p = r.platform || "unknown";
        if (!platMap[p]) platMap[p] = { count: 0, last: r.created_at };
        platMap[p].count++;
        if (r.created_at > platMap[p].last) platMap[p].last = r.created_at;
      });
      const platformImports = Object.entries(platMap).map(([platform, v]) => ({ platform, ...v }));

      setPulse({
        avgHookScore: avgScore ? Math.round(avgScore * 10) / 10 : null,
        totalAnalyses: rows.length,
        topFormat,
        topMarket,
        weeklyDelta,
        viralHooks,
        topPlatform,
        recentActivity,
        platformImports,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { loadPulse(); }, [loadPulse]);

  return (
    <div style={{ height: "calc(100vh - 60px)", display: "flex", flexDirection: "column", background: "#07080f" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .loop-chat-input:focus { outline: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 999px; }
      `}</style>

      {/* Top status bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px", borderBottom: `1px solid ${BORDER}`, background: "rgba(7,8,15,0.8)", backdropFilter: "blur(8px)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: `linear-gradient(135deg,${BLUE},${TEAL})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RefreshCw size={10} color="#000" />
            </div>
            <span style={{ ...J, fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Loop</span>
          </div>
          <div style={{ height: 12, width: 1, background: BORDER }} />
          <span style={{ ...M, fontSize: 9, color: MUTED, letterSpacing: "0.06em" }}>
            {loading ? "loading..." : `${pulse?.totalAnalyses ?? 0} analyses · ${pulse?.platformImports?.length ?? 0} platforms`}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {["meta", "tiktok", "google"].map(p => {
            const connected = pulse?.platformImports?.some(i => i.platform === p);
            const colors: Record<string, string> = { meta: "#60a5fa", tiktok: TEAL, google: GREEN };
            const labels: Record<string, string> = { meta: "M", tiktok: "T", google: "G" };
            return (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ ...M, fontSize: 9, color: connected ? colors[p] : "rgba(255,255,255,0.15)", fontWeight: 700 }}>{labels[p]}</span>
                <Dot color={connected ? colors[p] : "rgba(255,255,255,0.12)"} />
              </div>
            );
          })}
          <button onClick={loadPulse} style={{ width: 22, height: 22, borderRadius: 6, background: SURFACE, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginLeft: 4 }}>
            <RefreshCw size={10} color={MUTED} />
          </button>
        </div>
      </div>

      {/* Three-column layout */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "220px 1fr 200px", overflow: "hidden" }}>

        {/* Left — Account Pulse */}
        <div style={{ borderRight: `1px solid ${BORDER}`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <AccountPulsePanel pulse={pulse} loading={loading} />
        </div>

        {/* Center — AI Chat */}
        <div style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <AIPanel pulse={pulse} user={user} />
        </div>

        {/* Right — Quick Actions */}
        <div style={{ borderLeft: `1px solid ${BORDER}`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <ActionsPanel pulse={pulse} />
        </div>
      </div>
    </div>
  );
}
