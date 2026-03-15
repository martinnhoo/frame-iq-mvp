import { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Send, Loader2, ArrowRight, Sparkles, Brain,
  BarChart3, Zap, FileText, Target, Upload, RefreshCw,
  AlertCircle, ExternalLink,
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
  connections: { platform: string; status: string; ad_accounts: any[] }[];
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

// SVG logos for platforms — real brand icons
const MetaLogo = ({ size = 16, active = false }: { size?: number; active?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z" fill={active ? "#60a5fa" : "rgba(255,255,255,0.3)"} />
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8.5 16.5v-9l7 4.5-7 4.5z" fill="none" />
    {/* Meta f */}
    <text x="6" y="17" fontSize="13" fontWeight="900" fill={active ? "#60a5fa" : "rgba(255,255,255,0.3)"} fontFamily="sans-serif">f</text>
  </svg>
);

// Platform config with real brand colors
const PLATFORMS = [
  {
    id: "meta", label: "Meta Ads", fn: "meta-oauth",
    color: "#1877F2", activeColor: "#60a5fa",
    icon: ({ active }: { active: boolean }) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? "#60a5fa" : "rgba(255,255,255,0.3)"}>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    id: "tiktok", label: "TikTok Ads", fn: "tiktok-oauth",
    color: "#000000", activeColor: "#06b6d4",
    icon: ({ active }: { active: boolean }) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? "#06b6d4" : "rgba(255,255,255,0.3)"}>
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.72a4.85 4.85 0 0 1-1.01-.03z"/>
      </svg>
    ),
  },
  {
    id: "google", label: "Google Ads", fn: "google-oauth",
    color: "#4285F4", activeColor: "#34d399",
    icon: ({ active }: { active: boolean }) => (
      <svg width="16" height="16" viewBox="0 0 24 24">
        <path fill={active ? "#34d399" : "rgba(255,255,255,0.3)"} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.01 14.93A7.987 7.987 0 0 1 12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8c2.15 0 4.1.86 5.53 2.24l-2.31 2.31A4.974 4.974 0 0 0 12 8c-2.76 0-5 2.24-5 5s2.24 5 5 5c2.1 0 3.89-1.3 4.64-3.14H12v-3h8.01c.1.58.16 1.18.16 1.82 0 1.86-.51 3.61-1.4 5.11l.24.14z"/>
      </svg>
    ),
  },
];

const SUGGESTIONS_EMPTY = [
  "What should I focus on today?",
  "Help me write a hook for a new campaign",
  "What makes a high-converting ad hook?",
  "Generate 5 hook angles for a product launch",
  "How do I brief my video editor?",
  "What's the difference between UGC and VSL ads?",
];

const SUGGESTIONS_WITH_DATA = (pulse: AccountPulse) => [
  `Why is my hook score at ${pulse.avgHookScore?.toFixed(1) ?? "—"}?`,
  "Which of my recent ads should I pause?",
  `Generate hooks for my ${pulse.topMarket ?? "top"} market`,
  "What pattern is driving my best results?",
  "Suggest what to produce next based on my data",
  "How do I improve my average CTR?",
];

const TOOLS = [
  { icon: Upload,    label: "Upload ad",       action: "upload",     color: BLUE   },
  { icon: Zap,       label: "Generate hooks",  action: "hooks",      color: TEAL   },
  { icon: FileText,  label: "Write script",    action: "script",     color: GREEN  },
  { icon: BarChart3, label: "Competitor",      action: "competitor", color: PURPLE },
];

// ── AI Block ──────────────────────────────────────────────────────────────────
function Block({ block, onNav }: { block: AIBlock; onNav: (r: string) => void }) {
  const color = BLOCK_COLORS[block.type];

  if (block.type === "navigate") {
    return (
      <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.15)", marginBottom: 8 }}>
        <p style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: BLUE, marginBottom: 6 }}>{block.title}</p>
        {block.content && <p style={{ fontFamily: F, fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.65, marginBottom: 12 }}>{block.content}</p>}
        <button onClick={() => onNav(block.route!)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: `linear-gradient(135deg,${BLUE},${TEAL})`, color: "#000", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", fontFamily: F }}>
          {block.cta || "Open →"} <ArrowRight size={13} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 10 }}>
      {block.title && <p style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color, marginBottom: 6 }}>{block.title}</p>}
      {block.content && <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.82)", lineHeight: 1.75, marginBottom: block.items ? 10 : 0 }}>{block.content}</p>}
      {block.items?.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6, alignItems: "flex-start" }}>
          <span style={{ color, fontSize: 16, flexShrink: 0, lineHeight: 1.5 }}>·</span>
          <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>{item}</p>
        </div>
      ))}
    </div>
  );
}

// ── Platform connection badge — with real logo ────────────────────────────────
function PlatformBadge({ platform, connected, onConnect, requiresPersona }: {
  platform: typeof PLATFORMS[0];
  connected: boolean;
  onConnect: () => void;
  requiresPersona: boolean;
}) {
  const [hov, setHov] = useState(false);
  const Icon = platform.icon;

  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onConnect}
      disabled={connected}
      title={requiresPersona ? "Select a persona first to connect" : connected ? `${platform.label} connected` : `Connect ${platform.label}`}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "7px 12px", borderRadius: 9,
        background: connected
          ? `${platform.activeColor}10`
          : hov && !requiresPersona ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${connected ? platform.activeColor + "35" : hov && !requiresPersona ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)"}`,
        cursor: connected ? "default" : requiresPersona ? "not-allowed" : "pointer",
        transition: "all 0.15s", opacity: requiresPersona ? 0.45 : 1,
        fontFamily: F,
      }}
    >
      <Icon active={connected} />
      <span style={{ fontSize: 12, fontWeight: 500, color: connected ? platform.activeColor : "rgba(255,255,255,0.5)" }}>
        {platform.label}
      </span>
      {connected && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, animation: "statusPulse 2.5s infinite", flexShrink: 0 }} />
      )}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LoopV2() {
  const { user, selectedPersona } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();

  const [pulse, setPulse] = useState<AccountPulse | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasData = (pulse?.totalAnalyses ?? 0) > 0;
  const suggestions = hasData && pulse ? SUGGESTIONS_WITH_DATA(pulse) : SUGGESTIONS_EMPTY;

  const loadPulse = useCallback(async () => {
    try {
      const [{ data: analyses }, { data: imp }, { data: conns }] = await Promise.all([
        supabase.from("analyses").select("id, created_at, result, hook_strength, status, title")
          .eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(100),
        supabase.from("ads_data_imports" as never).select("platform, created_at" as never).eq("user_id" as never, user.id),
        supabase.from("platform_connections" as any).select("platform, status, ad_accounts").eq("user_id", user.id),
      ]);

      const rows = (analyses || []) as any[];
      const impRows = (imp || []) as any[];
      const connRows = (conns || []) as any[];

      const scores = rows.map((r: any) => (r.result as any)?.hook_score).filter(Boolean) as number[];
      const avg = scores.length ? scores.reduce((a, b) => a + b) / scores.length : null;

      const now = Date.now(), W = 7 * 86400000;
      const r7 = rows.filter((r: any) => +new Date(r.created_at) > now - W).map((r: any) => (r.result as any)?.hook_score).filter(Boolean) as number[];
      const p7 = rows.filter((r: any) => { const t = +new Date(r.created_at); return t > now - 2 * W && t <= now - W; }).map((r: any) => (r.result as any)?.hook_score).filter(Boolean) as number[];
      const delta = r7.length && p7.length ? Math.round((r7.reduce((a, b) => a + b) / r7.length - p7.reduce((a, b) => a + b) / p7.length) * 10) / 10 : null;

      const count = (f: string, arr: any[]) => { const m: Record<string, number> = {}; arr.forEach(r => { const v = r[f]; if (v && v !== "unknown") m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || null; };
      const markets: Record<string, number> = {}; rows.forEach((r: any) => { const m = (r.result as any)?.market; if (m) markets[m] = (markets[m] || 0) + 1; });
      const platMap: Record<string, number> = {}; impRows.forEach((r: any) => { const p = r.platform || "?"; if (p !== "other" && p !== "unknown") platMap[p] = (platMap[p] || 0) + 1; });

      const newPulse: AccountPulse = {
        avgHookScore: avg ? Math.round(avg * 10) / 10 : null,
        totalAnalyses: rows.length,
        viralHooks: rows.filter((r: any) => r.hook_strength === "viral").length,
        topFormat: count("hook_type", []),
        topMarket: Object.entries(markets).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
        weeklyDelta: delta,
        recentActivity: rows.slice(0, 5).map((r: any) => ({ title: r.title || "Analysis", score: (r.result as any)?.hook_score || null, ts: r.created_at })),
        platformImports: Object.entries(platMap).map(([platform, count]) => ({ platform, count })),
        connections: connRows,
      };
      setPulse(newPulse);
      return newPulse;
    } catch (e) { console.error(e); return null; }
    finally { setLoading(false); }
  }, [user.id]);

  useEffect(() => {
    loadPulse().then(p => {
      const connectedPlatforms = (p?.connections || []).filter(c => c.status === "active").map(c => c.platform);
      setMessages([{
        role: "assistant",
        blocks: [{
          type: p?.totalAnalyses ? "insight" : "action",
          title: "",
          content: p?.totalAnalyses
            ? `${connectedPlatforms.length ? `${connectedPlatforms.map(pl => pl.charAt(0).toUpperCase() + pl.slice(1)).join(" & ")} connected. ` : ""}${p.totalAnalyses} ${p.totalAnalyses === 1 ? "analysis" : "analyses"}, avg hook score ${p.avgHookScore?.toFixed(1) ?? "—"}/10${p.weeklyDelta != null ? ` (${p.weeklyDelta > 0 ? "↑" : "↓"}${Math.abs(p.weeklyDelta)} vs last week)` : ""}. What do you want to work on?`
            : "Connect your ad accounts and I'll analyze your campaigns in real time — or just ask me anything. Scripts, hooks, briefs, research, strategy.",
        }],
        ts: Date.now(),
      }]);
      setReady(true);
    });
  }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase.channel("loop_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "analyses", filter: `user_id=eq.${user.id}` },
        async () => {
          const newPulse = await loadPulse();
          if (newPulse) {
            setMessages(prev => [...prev, {
              role: "assistant" as const,
              blocks: [{ type: "insight" as const, title: "", content: `New analysis detected — ${newPulse.totalAnalyses} total${newPulse.avgHookScore ? `, avg ${newPulse.avgHookScore.toFixed(1)}/10` : ""}. Want me to review it?` }],
              ts: Date.now(),
            }]);
          }
        })
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
        body: { message: text, user_id: user.id, persona_id: selectedPersona?.id, context: { pulse } },
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

  const handleConnect = async (platform: typeof PLATFORMS[0]) => {
    if (!selectedPersona) {
      // Prompt persona selection instead
      setMessages(prev => [...prev, {
        role: "assistant" as const,
        blocks: [{ type: "warning" as const, title: "Select a persona first", content: `To connect ${platform.label}, select a persona (workspace) from the top bar. Each persona represents a client or brand — this keeps your ad accounts organized.` }],
        ts: Date.now(),
      }]);
      return;
    }
    setConnecting(platform.id);
    try {
      const { data } = await supabase.functions.invoke(platform.fn, {
        body: { action: "get_auth_url", user_id: user.id, persona_id: selectedPersona.id },
      });
      if (data?.url) window.location.href = data.url;
    } catch (e) { console.error(e); }
    finally { setConnecting(null); }
  };

  const handleToolAction = (action: string) => {
    const routes: Record<string, string> = {
      upload: "/dashboard/analyses/new",
      hooks: "/dashboard/hooks",
      script: "/dashboard/script",
      competitor: "/dashboard/competitor",
    };
    if (routes[action]) navigate(routes[action]);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const connectedPlatforms = (pulse?.connections || []).filter(c => c.status === "active").map(c => c.platform);
  const hasConversation = messages.filter(m => m.role === "user").length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: "calc(100vh - 44px)", background: "#0a0a0a", fontFamily: F }}>

      {/* ── Header — clean, just platform status ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 48, borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>

        {/* Left: persona + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {selectedPersona ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{selectedPersona.avatar_emoji}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{selectedPersona.name}</span>
              {hasData && (
                <>
                  <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.1)" }} />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                    {pulse?.totalAnalyses} analyses
                    {pulse?.avgHookScore && <span style={{ color: "rgba(255,255,255,0.45)", marginLeft: 4 }}>· {pulse.avgHookScore.toFixed(1)}/10</span>}
                  </span>
                </>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>No workspace selected</span>
          )}
        </div>

        {/* Right: platform badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {PLATFORMS.map(p => (
            <PlatformBadge
              key={p.id}
              platform={p}
              connected={connectedPlatforms.includes(p.id)}
              onConnect={() => handleConnect(p)}
              requiresPersona={!selectedPersona}
            />
          ))}
          <button onClick={() => loadPulse()}
            style={{ width: 30, height: 30, borderRadius: 7, background: "transparent", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginLeft: 4 }}>
            <RefreshCw size={12} color="rgba(255,255,255,0.25)" />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ maxWidth: 740, margin: "0 auto", padding: "28px 24px 16px", display: "flex", flexDirection: "column", gap: 22 }}>

          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ maxWidth: "76%", padding: "11px 16px", borderRadius: "16px 16px 4px 16px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)" }}>
                    <p style={{ fontSize: 15, color: "rgba(255,255,255,0.9)", lineHeight: 1.65, fontFamily: F }}>{msg.text}</p>
                  </div>
                </div>
              )}
              {msg.role === "assistant" && (
                <div style={{ display: "flex", gap: 0, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    {msg.loading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
                        <Loader2 size={14} color="rgba(255,255,255,0.3)" className="animate-spin" />
                        <span style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", fontFamily: F }}>Thinking...</span>
                      </div>
                    ) : (
                      msg.blocks?.map((block, j) => <Block key={j} block={block} onNav={navigate} />)
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {!hasConversation && ready && (
            <div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginBottom: 14, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {hasData ? "Based on your account" : "Suggestions"}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => send(s)}
                    style={{ padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)", fontSize: 14, cursor: "pointer", textAlign: "left", lineHeight: 1.5, fontFamily: F, transition: "all 0.1s", minHeight: 52, display: "flex", alignItems: "center" }}
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

      {/* ── Input ── */}
      <div style={{ padding: "12px 24px 16px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 740, margin: "0 auto" }}>
          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-end", transition: "border-color 0.15s" }}
            onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,233,0.4)"; }}
            onBlurCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"; }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={selectedPersona ? `Ask anything about ${selectedPersona.name}...` : "Ask anything about your campaigns, ads, or strategy..."}
              rows={1}
              autoFocus
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", color: "#fff", fontSize: 15, lineHeight: 1.65, maxHeight: 120, overflowY: "auto", fontFamily: F, caretColor: BLUE }}
            />
            <button onClick={() => send(input)} disabled={!input.trim() || sending}
              style={{ width: 34, height: 34, borderRadius: 9, background: input.trim() && !sending ? `linear-gradient(135deg,${BLUE},${TEAL})` : "rgba(255,255,255,0.06)", border: "none", cursor: input.trim() && !sending ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.12s" }}>
              {sending ? <Loader2 size={14} color="rgba(255,255,255,0.4)" className="animate-spin" /> : <Send size={14} color={input.trim() ? "#000" : "rgba(255,255,255,0.25)"} />}
            </button>
          </div>

          {/* Tool actions — only non-connect tools */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {TOOLS.map(t => (
              <button key={t.action} onClick={() => handleToolAction(t.action)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer", fontFamily: F, transition: "all 0.1s" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${t.color}40`; el.style.color = t.color; el.style.background = `${t.color}0a`; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.08)"; el.style.color = "rgba(255,255,255,0.45)"; el.style.background = "transparent"; }}>
                <t.icon size={11} /> {t.label}
              </button>
            ))}
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", marginLeft: "auto" }}>Enter to send</span>
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
