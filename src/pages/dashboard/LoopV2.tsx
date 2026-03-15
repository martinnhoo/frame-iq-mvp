/**
 * AdBrief Loop — Premium AI interface
 * Clean, full-width, like Claude/ChatGPT but for performance marketing.
 * The AI has real-time context: analyses, campaigns, patterns, connected platforms.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Send, Loader2, ArrowRight, Sparkles, Brain,
  BarChart3, Zap, FileText, Target, Search, Link2,
  TrendingUp, TrendingDown, Upload, RefreshCw,
} from "lucide-react";

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";
const BLUE = "#0ea5e9";
const TEAL = "#06b6d4";
const GREEN = "#34d399";
const AMBER = "#fbbf24";
const RED = "#f87171";
const PURPLE = "#a78bfa";

interface AccountPulse {
  avgHookScore: number | null;
  totalAnalyses: number;
  topFormat: string | null;
  topMarket: string | null;
  weeklyDelta: number | null;
  viralHooks: number;
  recentActivity: { title: string; score: number | null; ts: string }[];
  platformImports: { platform: string; count: number }[];
}

interface AIBlock {
  type: "insight" | "action" | "warning" | "pattern" | "hooks" | "navigate" | "data";
  title: string; content?: string; items?: string[];
  route?: string; cta?: string; data?: Record<string, string>;
}
interface AIMessage {
  role: "user" | "assistant";
  text?: string; blocks?: AIBlock[]; ts: number; loading?: boolean;
}

const BLOCK_COLORS: Record<AIBlock["type"], string> = {
  insight: GREEN, action: BLUE, warning: AMBER,
  pattern: PURPLE, hooks: TEAL, navigate: BLUE, data: "rgba(255,255,255,0.5)",
};

// ── Suggestions by context ─────────────────────────────────────────────────────
const SUGGESTIONS_EMPTY = [
  "What should I focus on today?",
  "Analyze my latest ad campaign",
  "My CTR dropped this week — why?",
  "Generate 5 hook angles for my next ad",
  "What's working best in my account right now?",
  "Write a script for a product launch",
];
const SUGGESTIONS_WITH_DATA = (pulse: AccountPulse) => [
  `Why is my hook score at ${pulse.avgHookScore?.toFixed(1) ?? "—"}?`,
  "Which of my recent ads should I pause?",
  `Generate hooks for my ${pulse.topMarket ?? "top"} market`,
  "What pattern is driving my best results?",
  "Suggest what to produce next based on my data",
  "How do I improve my average CTR?",
];

// ── Action shortcuts below input ───────────────────────────────────────────────
const ACTIONS = [
  { icon: Upload,     label: "Upload ad",         action: "upload",    color: BLUE  },
  { icon: Zap,        label: "Generate hooks",     action: "hooks",     color: TEAL  },
  { icon: FileText,   label: "Write script",       action: "script",    color: GREEN },
  { icon: BarChart3,  label: "Analyze competitor", action: "competitor",color: PURPLE},
  { icon: Link2,      label: "Connect Meta",       action: "connect",   color: AMBER },
];

// ── AI Block renderer ──────────────────────────────────────────────────────────
function Block({ block, onNav }: { block: AIBlock; onNav: (r: string) => void }) {
  const color = BLOCK_COLORS[block.type];

  if (block.type === "navigate") {
    return (
      <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.15)", marginBottom: 8 }}>
        <p style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: BLUE, marginBottom: 6 }}>{block.title}</p>
        {block.content && <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 12 }}>{block.content}</p>}
        <button onClick={() => onNav(block.route!)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: `linear-gradient(135deg,${BLUE},${TEAL})`, color: "#000", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", fontFamily: F }}>
          {block.cta || "Open →"} <ArrowRight size={13} />
        </button>
      </div>
    );
  }

  if (block.type === "data" && block.data) {
    return (
      <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 8 }}>
        <p style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 11 }}>{block.title}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {Object.entries(block.data).map(([k, v]) => (
            <div key={k} style={{ textAlign: "center" }}>
              <p style={{ fontFamily: F, fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{v}</p>
              <p style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{k}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {block.title && <p style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color, marginBottom: 8 }}>{block.title}</p>}
      {block.content && <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.8)", lineHeight: 1.75, marginBottom: block.items ? 10 : 0 }}>{block.content}</p>}
      {block.items?.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 5, alignItems: "flex-start" }}>
          <span style={{ color, fontSize: 14, flexShrink: 0, marginTop: 2 }}>·</span>
          <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>{item}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function LoopV2() {
  const { user } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();

  const [pulse, setPulse] = useState<AccountPulse | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasData = (pulse?.totalAnalyses ?? 0) > 0;
  const suggestions = hasData && pulse ? SUGGESTIONS_WITH_DATA(pulse) : SUGGESTIONS_EMPTY;

  // Load account data
  const loadPulse = useCallback(async () => {
    try {
      const [{ data: analyses }, { data: mem }, { data: imp }] = await Promise.all([
        supabase.from("analyses").select("id, created_at, result, hook_strength, status, title")
          .eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(100),
        supabase.from("creative_memory" as never).select("hook_type, hook_score, platform, created_at" as never)
          .eq("user_id" as never, user.id).limit(100),
        supabase.from("ads_data_imports" as never).select("platform, created_at" as never)
          .eq("user_id" as never, user.id),
      ]);

      const rows = (analyses || []) as any[];
      const memRows = (mem || []) as any[];
      const impRows = (imp || []) as any[];

      const scores = rows.map((r: any) => (r.result as any)?.hook_score).filter(Boolean) as number[];
      const avg = scores.length ? scores.reduce((a, b) => a + b) / scores.length : null;

      const now = Date.now(), W = 7 * 86400000;
      const r7 = rows.filter((r: any) => +new Date(r.created_at) > now - W).map((r: any) => (r.result as any)?.hook_score).filter(Boolean) as number[];
      const p7 = rows.filter((r: any) => { const t = +new Date(r.created_at); return t > now - 2 * W && t <= now - W; }).map((r: any) => (r.result as any)?.hook_score).filter(Boolean) as number[];
      const delta = r7.length && p7.length ? Math.round((r7.reduce((a, b) => a + b) / r7.length - p7.reduce((a, b) => a + b) / p7.length) * 10) / 10 : null;

      const count = (f: string, arr: any[]) => { const m: Record<string, number> = {}; arr.forEach(r => { const v = r[f]; if (v && v !== "unknown") m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || null; };
      const markets: Record<string, number> = {}; rows.forEach((r: any) => { const m = (r.result as any)?.market; if (m) markets[m] = (markets[m] || 0) + 1; });
      const platMap: Record<string, number> = {}; impRows.forEach((r: any) => { const p = r.platform || "?"; platMap[p] = (platMap[p] || 0) + 1; });

      const newPulse: AccountPulse = {
        avgHookScore: avg ? Math.round(avg * 10) / 10 : null,
        totalAnalyses: rows.length,
        viralHooks: rows.filter((r: any) => r.hook_strength === "viral").length,
        topFormat: count("hook_type", memRows),
        topMarket: Object.entries(markets).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
        weeklyDelta: delta,
        recentActivity: rows.slice(0, 5).map((r: any) => ({ title: r.title || "Analysis", score: (r.result as any)?.hook_score || null, ts: r.created_at })),
        platformImports: Object.entries(platMap).map(([platform, count]) => ({ platform, count })),
      };
      setPulse(newPulse);
      return newPulse;
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  // Init
  useEffect(() => {
    loadPulse().then(p => {
      setMessages([{
        role: "assistant",
        blocks: [{
          type: p?.totalAnalyses ? "insight" : "action",
          title: "",
          content: p?.totalAnalyses
            ? `I have access to ${p.totalAnalyses} analyses${p.platformImports.length ? ` and ${p.platformImports.length} connected platform${p.platformImports.length > 1 ? "s" : ""}` : ""}. Your average hook score is ${p.avgHookScore?.toFixed(1) ?? "—"}${p.weeklyDelta != null ? ` (${p.weeklyDelta > 0 ? "+" : ""}${p.weeklyDelta} vs last week)` : ""}. What would you like to explore?`
            : "I'm your creative strategy AI. Connect your ad platforms or upload an ad analysis to get real-time insights. Or just ask me anything — I can help with scripts, hooks, briefs, and strategy.",
        }],
        ts: Date.now(),
      }]);
      setReady(true);
    });
  }, []);


  // Realtime — subscribe to new analyses appearing
  useEffect(() => {
    const channel = supabase
      .channel("analyses_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "analyses", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          // New analysis detected — refresh pulse and notify
          const newPulse = await loadPulse();
          if (newPulse) {
            setMessages(prev => [...prev, {
              role: "assistant" as const,
              blocks: [{
                type: "insight" as const,
                title: "New analysis detected",
                content: `I just picked up a new ad analysis. Your account now has ${newPulse.totalAnalyses} total analyses. Want me to review what changed?`,
              }],
              ts: Date.now(),
            }]);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user.id, loadPulse]);

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
      setMessages(prev => prev.map(m =>
        m.loading ? { role: "assistant" as const, blocks: data?.blocks || [{ type: "insight" as const, title: "", content: data?.response || "Done." }], ts: Date.now() } : m
      ));
    } catch (e: any) {
      setMessages(prev => prev.map(m =>
        m.loading ? { role: "assistant" as const, blocks: [{ type: "warning" as const, title: "Something went wrong", content: e.message || "Try again." }], ts: Date.now() } : m
      ));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  };

  const handleAction = (action: string) => {
    const routes: Record<string, string> = {
      upload:     "/dashboard/analyses/new",
      hooks:      "/dashboard/hooks",
      script:     "/dashboard/script",
      competitor: "/dashboard/competitor",
    };
    if (action === "connect") {
      setConnecting(true);
      supabase.functions.invoke("meta-oauth", { body: { action: "get_auth_url", user_id: user.id } })
        .then(({ data }) => { if (data?.url) window.location.href = data.url; })
        .finally(() => setConnecting(false));
      return;
    }
    if (routes[action]) navigate(routes[action]);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const hasConversation = messages.filter(m => m.role === "user").length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: "calc(100vh - 44px)", background: "#0a0a0a", fontFamily: F }}>

      {/* Header — minimal status */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: ready ? GREEN : AMBER, animation: ready ? "statusPulse 2.5s infinite" : "none" }} />
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 400, fontFamily: F }}>
            AdBrief AI
            {hasData && <span style={{ color: "rgba(255,255,255,0.25)" }}> · {pulse?.totalAnalyses} analyses loaded</span>}
            {pulse?.platformImports.length ? <span style={{ color: "rgba(255,255,255,0.25)" }}> · {pulse.platformImports.map(p => p.platform).join(", ")} connected</span> : null}
          </span>
        </div>
        <button onClick={() => loadPulse()} title="Refresh context"
          style={{ width: 28, height: 28, borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <RefreshCw size={11} color="rgba(255,255,255,0.3)" />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ maxWidth: 740, margin: "0 auto", padding: "24px 24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ maxWidth: "76%", padding: "10px 15px", borderRadius: "16px 16px 4px 16px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)" }}>
                    <p style={{ fontSize: 15, color: "rgba(255,255,255,0.9)", lineHeight: 1.65, fontFamily: F }}>{msg.text}</p>
                  </div>
                </div>
              )}
              {msg.role === "assistant" && (
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    {msg.loading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
                        <Loader2 size={14} color="rgba(255,255,255,0.3)" className="animate-spin" />
                        <span style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", fontFamily: F }}>Thinking...</span>
                      </div>
                    ) : (
                      <div>
                        {msg.blocks?.map((block, j) => <Block key={j} block={block} onNav={navigate} />)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Suggestions — only when no conversation yet */}
          {!hasConversation && ready && (
            <div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", marginBottom: 14, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {hasData ? "BASED ON YOUR ACCOUNT" : "SUGGESTIONS"}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => send(s)}
                    style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)", fontSize: 14, cursor: "pointer", textAlign: "left", lineHeight: 1.5, fontFamily: F, transition: "all 0.1s" }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(14,165,233,0.3)"; el.style.color = "rgba(255,255,255,0.85)"; el.style.background = "rgba(14,165,233,0.05)"; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.07)"; el.style.color = "rgba(255,255,255,0.55)"; el.style.background = "rgba(255,255,255,0.03)"; }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div style={{ padding: "12px 24px 16px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 740, margin: "0 auto" }}>
          {/* Main input box */}
          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-end", transition: "border-color 0.15s" }}
            onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,233,0.4)"; }}
            onBlurCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"; }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything about your campaigns, ads, or strategy..."
              rows={1}
              autoFocus
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", color: "#fff", fontSize: 15, lineHeight: 1.65, maxHeight: 120, overflowY: "auto", fontFamily: F, caretColor: BLUE }}
            />
            <button onClick={() => send(input)} disabled={!input.trim() || sending}
              style={{ width: 34, height: 34, borderRadius: 9, background: input.trim() && !sending ? `linear-gradient(135deg,${BLUE},${TEAL})` : "rgba(255,255,255,0.06)", border: "none", cursor: input.trim() && !sending ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.12s" }}>
              {sending ? <Loader2 size={14} color="rgba(255,255,255,0.4)" className="animate-spin" /> : <Send size={14} color={input.trim() ? "#000" : "rgba(255,255,255,0.25)"} />}
            </button>
          </div>

          {/* Quick actions row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {ACTIONS.map(a => (
              <button key={a.action} onClick={() => handleAction(a.action)}
                disabled={a.action === "connect" && connecting}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: F, transition: "all 0.1s" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${a.color}40`; el.style.color = a.color; el.style.background = `${a.color}0a`; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.08)"; el.style.color = "rgba(255,255,255,0.45)"; el.style.background = "transparent"; }}>
                <a.icon size={11} />
                {a.action === "connect" && connecting ? "Connecting..." : a.label}
              </button>
            ))}
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", marginLeft: "auto" }}>
              Enter to send
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes statusPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }
        textarea::placeholder { color: rgba(255,255,255,0.28); }
      `}</style>
    </div>
  );
}
