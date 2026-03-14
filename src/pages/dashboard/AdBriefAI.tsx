import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Send, Loader2, ChevronDown, ChevronUp, Sparkles, RotateCcw, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const m = { fontFamily: "'DM Mono', monospace" } as const;

interface Block {
  type: "action" | "pattern" | "hooks" | "warning" | "insight" | "off_topic";
  title: string;
  content?: string;
  items?: string[];
}
interface AIMessage { role: "user" | "assistant"; blocks?: Block[]; userText?: string; ts: number; }

const BS: Record<Block["type"], { color: string; icon: string; bg: string; border: string }> = {
  action:    { color: "#a78bfa", icon: "🎯", bg: "rgba(167,139,250,0.07)", border: "rgba(167,139,250,0.2)"  },
  pattern:   { color: "#60a5fa", icon: "📊", bg: "rgba(96,165,250,0.07)",  border: "rgba(96,165,250,0.2)"  },
  hooks:     { color: "#f472b6", icon: "⚡", bg: "rgba(244,114,182,0.07)", border: "rgba(244,114,182,0.2)" },
  warning:   { color: "#fbbf24", icon: "⚠️", bg: "rgba(251,191,36,0.07)",  border: "rgba(251,191,36,0.2)"  },
  insight:   { color: "#34d399", icon: "🧠", bg: "rgba(52,211,153,0.07)",  border: "rgba(52,211,153,0.2)"  },
  off_topic: { color: "rgba(255,255,255,0.25)", icon: "🚫", bg: "rgba(255,255,255,0.02)", border: "rgba(255,255,255,0.07)" },
};

const QUICK = [
  "What's my best performing hook type?",
  "Which market should I double down on?",
  "Write 3 hooks for cold traffic based on my data",
  "Why might my CTRs be dropping?",
  "What should I test next?",
  "Which editor has the best results?",
];

function BlockCard({ block }: { block: Block }) {
  const s = BS[block.type];
  const [open, setOpen] = useState(true);
  return (
    <div style={{ borderRadius: 14, border: `1px solid ${s.border}`, background: s.bg, overflow: "hidden", marginBottom: 8 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "none", border: "none", cursor: "pointer" }}>
        <span style={{ fontSize: 15 }}>{s.icon}</span>
        <span style={{ ...j, flex: 1, fontSize: 12, fontWeight: 700, color: s.color, textAlign: "left" }}>{block.title}</span>
        {open ? <ChevronUp size={13} color={s.color} /> : <ChevronDown size={13} color={s.color} />}
      </button>
      {open && (
        <div style={{ padding: "0 14px 12px" }}>
          {block.content && <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, marginBottom: block.items?.length ? 8 : 0 }}>{block.content}</p>}
          {block.items?.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
              <span style={{ color: s.color, fontSize: 10, marginTop: 3, flexShrink: 0 }}>→</span>
              <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdBriefAI() {
  const { user, profile } = useOutletContext<DashboardContext>();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const [context, setContext] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── Load all user context once ── */
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const [analysesRes, patternsRes, personaRes, entriesRes, savedRes] = await Promise.all([
        supabase.from("analyses").select("id,title,created_at,result,hook_strength,recommended_platforms").eq("user_id", user.id).order("created_at", { ascending: false }),
        (supabase as any).from("learned_patterns").select("pattern_key,variables,avg_ctr,avg_cpc,avg_roas,confidence,is_winner,insight_text,sample_size").eq("user_id", user.id).order("confidence", { ascending: false }),
        supabase.from("personas" as never).select("name,result").eq("user_id", user.id).eq("is_active", true).single(),
        (supabase as any).from("creative_entries").select("filename,market,editor,platform,creative_type,ctr,roas,spend,clicks,impressions,import_batch_id").eq("user_id", user.id).order("ctr", { ascending: false }),
        (supabase as any).from("ai_user_insights").select("summary").eq("user_id", user.id).single(),
      ]);

      const analyses = (analysesRes.data || []).map((a: any) => {
        const r = a.result as Record<string, any> || {};
        return `[${a.id.slice(0,8)}] ${a.title || "Untitled"} | score:${r.hook_score ?? "?"} | type:${r.hook_type ?? "?"} | market:${r.market_guess ?? "?"} | platform:${(a.recommended_platforms||[]).join("+")} | strength:${a.hook_strength ?? "?"} | date:${a.created_at?.slice(0,10)}`;
      }).join("\n");

      const patterns = (patternsRes.data || []).map((p: any) =>
        `${p.is_winner ? "✓WIN" : "✗LOSE"} ${p.pattern_key} | CTR:${p.avg_ctr?.toFixed(3) ?? "?"} | ROAS:${p.avg_roas?.toFixed(2) ?? "?"} | conf:${p.confidence} | n:${p.sample_size} | ${p.insight_text ?? ""}`
      ).join("\n");

      const persona = (() => {
        if (!personaRes.data) return "No active persona";
        const r = personaRes.data.result as Record<string, any> || {};
        return `Name:${personaRes.data.name} | Age:${r.age_range ?? "?"} | Pain:${(r.pain_points || []).slice(0,3).join(", ")} | Triggers:${(r.emotional_triggers || []).slice(0,3).join(", ")} | Platforms:${(r.platforms || []).join("+")}`;
      })();

      // Batch entries into per-editor and per-campaign summaries
      const entries = entriesRes.data || [];
      const byEditor: Record<string, {ctr: number[], roas: number[], count: number}> = {};
      const byCampaign: Record<string, {filename: string, ctr: number|null, roas: number|null, market: string, platform: string, editor: string}[]> = {};
      entries.forEach((e: any) => {
        if (e.editor) {
          if (!byEditor[e.editor]) byEditor[e.editor] = { ctr: [], roas: [], count: 0 };
          byEditor[e.editor].count++;
          if (e.ctr) byEditor[e.editor].ctr.push(e.ctr);
          if (e.roas) byEditor[e.editor].roas.push(e.roas);
        }
        const batch = e.import_batch_id || "unknown";
        if (!byCampaign[batch]) byCampaign[batch] = [];
        byCampaign[batch].push({ filename: e.filename, ctr: e.ctr, roas: e.roas, market: e.market, platform: e.platform, editor: e.editor });
      });

      const editorSummary = Object.entries(byEditor).map(([ed, d]) => {
        const avgCtr = d.ctr.length ? (d.ctr.reduce((a,b) => a+b,0)/d.ctr.length).toFixed(3) : "?";
        const avgRoas = d.roas.length ? (d.roas.reduce((a,b) => a+b,0)/d.roas.length).toFixed(2) : "?";
        return `Editor:${ed} | creatives:${d.count} | avgCTR:${avgCtr} | avgROAS:${avgRoas}`;
      }).join("\n");

      const campaignSummary = Object.entries(byCampaign).slice(0, 30).map(([batch, rows]) => {
        const top = rows.sort((a,b) => (b.ctr||0)-(a.ctr||0)).slice(0,3);
        return `Batch:${batch.slice(0,8)} (${rows.length} creatives) | Top: ${top.map(r => `${r.filename}(CTR:${r.ctr?.toFixed(3)??'?'})`).join(", ")}`;
      }).join("\n");

      const savedInsights = savedRes.data?.summary || "";

      const ctx = `=== ACTIVE PERSONA ===\n${persona}\n\n=== ALL ANALYSES (${(analysesRes.data||[]).length} total) ===\n${analyses || "None yet"}\n\n=== LEARNED PATTERNS ===\n${patterns || "No patterns yet"}\n\n=== EDITOR PERFORMANCE ===\n${editorSummary || "No data"}\n\n=== CAMPAIGN BATCHES ===\n${campaignSummary || "No CSV data imported"}\n\n=== SAVED INSIGHTS ===\n${savedInsights || "None yet"}`;

      setContext(ctx);
      setContextReady(true);
    })();
  }, [user?.id]);

  /* ── Save important insights back ── */
  const saveInsight = async (text: string) => {
    if (!user?.id || text.length < 20) return;
    const truncated = text.slice(0, 1500);
    await (supabase as any).from("ai_user_insights").upsert({ user_id: user.id, summary: truncated, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  };

  /* ── Send message ── */
  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading || !contextReady) return;
    setInput("");

    const userMsg: AIMessage = { role: "user", userText: msg, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const systemPrompt = `You are AdBrief AI — an elite media buyer and creative performance strategist with 10+ years running paid social at scale. You work exclusively with ad performance data, creative briefs, hooks, scripts, audience targeting, and campaign optimization.

YOUR ONLY DOMAIN: paid advertising, creative performance, hooks, scripts, briefs, audience strategy, campaign data analysis, CTR/ROAS improvement, editor performance, market strategy.

If the user asks ANYTHING outside this domain, respond with a single off_topic block explaining you only handle ad performance and creative intelligence.

USER'S FULL CONTEXT:
${context}

RESPONSE FORMAT — you must ALWAYS respond with a valid JSON array of blocks. No text outside the JSON. Each block:
{
  "type": "action" | "pattern" | "hooks" | "warning" | "insight" | "off_topic",
  "title": "short title",
  "content": "optional paragraph",
  "items": ["optional", "bullet", "list"]
}

Block types:
- action: specific things to do NOW
- pattern: data patterns from their account
- hooks: ready-to-use hook copy variations
- warning: something costing them money/performance
- insight: deeper strategic observation
- off_topic: when question is outside ad performance domain

Rules:
- Always reference THEIR actual data (filenames, editors, CTRs, markets) when available
- Never repeat hooks or recommendations already visible in the context
- Be brutally direct — no filler, no "great question!", no corporate speak
- If they ask for hooks, write REAL copy they can use immediately
- Max 4 blocks per response — prioritize the most impactful
- If data is missing, say what data they need to import to get better answers`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: "user", content: msg }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "[]";
      let blocks: Block[] = [];
      try {
        const clean = raw.replace(/```json|```/g, "").trim();
        blocks = JSON.parse(clean);
        if (!Array.isArray(blocks)) blocks = [{ type: "insight", title: "Response", content: raw }];
      } catch {
        blocks = [{ type: "insight", title: "Response", content: raw }];
      }

      const aiMsg: AIMessage = { role: "assistant", blocks, ts: Date.now() };
      setMessages(prev => [...prev, aiMsg]);

      // Save insights from insight/pattern blocks
      const insightText = blocks.filter(b => ["insight","pattern"].includes(b.type))
        .map(b => `${b.title}: ${b.content || ""} ${(b.items||[]).join(". ")}`)
        .join("\n").slice(0, 1500);
      if (insightText) saveInsight(insightText);

    } catch {
      toast.error("Failed to get response");
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", background: "#080810", ...j }}>

      {/* Header */}
      <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#a78bfa,#f472b6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Brain size={16} color="#000" />
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1 }}>AdBrief AI</p>
          <p style={{ ...m, fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", marginTop: 2 }}>
            {contextReady ? "● READY — full account context loaded" : "○ Loading your data..."}
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} title="Clear chat"
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
            <RotateCcw size={12} /> Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0" }}>
        {messages.length === 0 && (
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🧠</div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 6 }}>Your AI media buyer.</p>
              <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.7 }}>
                I have access to all your analyses, campaign data, patterns and persona.<br />
                Ask me anything about your ads.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {QUICK.map(q => (
                <button key={q} onClick={() => send(q)}
                  style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", textAlign: "left", ...m, lineHeight: 1.5 }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ maxWidth: 640, margin: "0 auto 20px" }}>
            {msg.role === "user" ? (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                <div style={{ padding: "10px 14px", borderRadius: 14, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.2)", fontSize: 13, color: "rgba(255,255,255,0.85)", ...j, maxWidth: "80%" }}>
                  {msg.userText}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: "linear-gradient(135deg,#a78bfa,#f472b6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Sparkles size={10} color="#000" />
                  </div>
                  <span style={{ ...m, fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>ADBRIEF AI</span>
                </div>
                {msg.blocks?.map((b, bi) => <BlockCard key={bi} block={b} />)}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ maxWidth: 640, margin: "0 auto 20px", display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: "linear-gradient(135deg,#a78bfa,#f472b6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={10} color="#000" />
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {[0,1,2].map(d => (
                <div key={d} style={{ width: 5, height: 5, borderRadius: "50%", background: "#a78bfa", opacity: 0.6, animation: `pulse 1.2s ease-in-out ${d*0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} style={{ height: 20 }} />
      </div>

      {/* Input */}
      <div style={{ padding: "14px 20px 20px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your campaigns, hooks, performance data..."
            rows={1}
            style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px 14px", color: "#fff", fontSize: 13, resize: "none", outline: "none", ...m, lineHeight: 1.5, minHeight: 44, maxHeight: 120 }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading || !contextReady}
            style={{ width: 44, height: 44, borderRadius: 12, background: input.trim() && !loading ? "linear-gradient(135deg,#a78bfa,#f472b6)" : "rgba(255,255,255,0.06)", border: "none", cursor: input.trim() && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
            {loading ? <Loader2 size={16} color="#a78bfa" className="animate-spin" /> : <Send size={16} color={input.trim() ? "#000" : "rgba(255,255,255,0.2)"} />}
          </button>
        </div>
        <p style={{ ...m, fontSize: 10, color: "rgba(255,255,255,0.18)", textAlign: "center", marginTop: 8, letterSpacing: "0.06em" }}>
          Strictly ad performance & creative intelligence only
        </p>
      </div>

      <style>{`@keyframes pulse { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.4);opacity:1} }`}</style>
    </div>
  );
}
