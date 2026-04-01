import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'DM Mono', monospace";

const VERDICT_CONFIG = {
  winner:  { label: "Vencedor",  bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.18)",  dot: "#22c55e", text: "#86efac" },
  scaled:  { label: "Escalado",  bg: "rgba(14,165,233,0.08)", border: "rgba(14,165,233,0.18)", dot: "#0ea5e9", text: "#7dd3fc" },
  testing: { label: "Testando",  bg: "rgba(251,191,36,0.07)", border: "rgba(251,191,36,0.15)", dot: "#fbbf24", text: "#fde68a" },
  loser:   { label: "Pausado",   bg: "rgba(239,68,68,0.07)",  border: "rgba(239,68,68,0.15)",  dot: "#ef4444", text: "#fca5a5" },
};

type Verdict = keyof typeof VERDICT_CONFIG;

interface DiaryEntry {
  id: string;
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  adset_name: string;
  platform: string;
  status: string;
  launched_at: string | null;
  paused_at: string | null;
  days_running: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conv_value: number;
  roas: number | null;
  frequency: number | null;
  verdict: Verdict;
  verdict_reason: string;
  peak_ctr: number;
  synced_at: string;
}

function fmt(n: number, decimals = 0) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(decimals);
}

function DiaryRow({ entry, expanded, onToggle }: { entry: DiaryEntry; expanded: boolean; onToggle: () => void }) {
  const cfg = VERDICT_CONFIG[entry.verdict] || VERDICT_CONFIG.testing;
  const ctrPct = (entry.ctr * 100).toFixed(2);
  const isPositive = entry.verdict === "winner" || entry.verdict === "scaled";
  const isNegative = entry.verdict === "loser";

  return (
    <div style={{
      borderRadius: 10,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      overflow: "hidden",
      transition: "all 0.15s",
    }}>
      {/* Main row */}
      <button onClick={onToggle} style={{
        width: "100%", display: "flex", alignItems: "center",
        padding: "14px 16px", background: "none", border: "none",
        cursor: "pointer", textAlign: "left", gap: 14,
      }}>
        {/* Verdict dot */}
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: cfg.dot, flexShrink: 0,
          boxShadow: `0 0 6px ${cfg.dot}80`,
        }} />

        {/* Name + campaign */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.88)", fontFamily: F, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.ad_name || "—"}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "rgba(255,255,255,0.35)", fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[entry.campaign_name, entry.adset_name].filter(Boolean).join(" · ")}
          </p>
        </div>

        {/* CTR — hero metric */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: cfg.text, fontFamily: M, letterSpacing: "-0.02em" }}>
            {ctrPct}%
          </p>
          <p style={{ margin: "1px 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: F }}>CTR</p>
        </div>

        {/* ROAS or spend */}
        <div style={{ textAlign: "right", flexShrink: 0, minWidth: 56 }}>
          {entry.roas && entry.roas > 0 ? (
            <>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isPositive ? "#86efac" : isNegative ? "#fca5a5" : "rgba(255,255,255,0.6)", fontFamily: M }}>
                {entry.roas.toFixed(1)}×
              </p>
              <p style={{ margin: "1px 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: F }}>ROAS</p>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)", fontFamily: M }}>
                R${fmt(entry.spend)}
              </p>
              <p style={{ margin: "1px 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: F }}>spend</p>
            </>
          )}
        </div>

        {/* Verdict badge */}
        <div style={{
          padding: "3px 9px", borderRadius: 6,
          background: "rgba(0,0,0,0.2)",
          border: `1px solid ${cfg.border}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: cfg.text, fontFamily: F, letterSpacing: "0.02em" }}>
            {cfg.label}
          </span>
        </div>

        {/* Expand */}
        <div style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${cfg.border}`, padding: "12px 16px 14px" }}>
          {/* Metrics grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8, marginBottom: 12 }}>
            {[
              { label: "Spend", value: `R$${entry.spend.toFixed(0)}` },
              { label: "Impressões", value: fmt(entry.impressions) },
              { label: "Cliques", value: fmt(entry.clicks) },
              { label: "CTR", value: `${(entry.ctr * 100).toFixed(2)}%` },
              { label: "CPC", value: `R$${entry.cpc.toFixed(2)}` },
              ...(entry.conversions > 0 ? [{ label: "Conv.", value: entry.conversions.toFixed(0) }] : []),
              ...(entry.roas ? [{ label: "ROAS", value: `${entry.roas.toFixed(2)}×` }] : []),
              ...(entry.frequency ? [{ label: "Freq.", value: entry.frequency.toFixed(1) }] : []),
              ...(entry.days_running > 0 ? [{ label: "Dias", value: String(entry.days_running) }] : []),
            ].map(m => (
              <div key={m.label} style={{ padding: "8px 10px", borderRadius: 7, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: F }}>{m.label}</p>
                <p style={{ margin: "2px 0 0", fontSize: 13.5, fontWeight: 700, color: "rgba(255,255,255,0.82)", fontFamily: M }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Reason */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: F, lineHeight: 1.5 }}>
              {entry.verdict_reason}
            </p>
          </div>

          {/* Dates */}
          {entry.launched_at && (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: F }}>
              Lançado {new Date(entry.launched_at).toLocaleDateString("pt-BR")}
              {entry.paused_at && ` · Pausado ${new Date(entry.paused_at).toLocaleDateString("pt-BR")}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdDiary() {
  const { user, selectedPersona } = useOutletContext<DashboardContext>();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<Verdict | "all">("all");
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !selectedPersona?.id) { setLoading(false); return; }
    const { data } = await (supabase as any).from("ad_diary")
      .select("*")
      .eq("user_id", user.id)
      .eq("persona_id", selectedPersona.id)
      .order("spend", { ascending: false })
      .limit(200);
    setEntries((data || []) as DiaryEntry[]);
    if (data?.length) setLastSync(new Date((data[0] as any).synced_at));
    setLoading(false);
  }, [user?.id, selectedPersona?.id]);

  const sync = async () => {
    if (!user?.id || !selectedPersona?.id) return;
    setSyncing(true);
    try {
      await supabase.functions.invoke("sync-ad-diary", {
        body: { user_id: user.id, persona_id: selectedPersona.id },
      });
      await load();
      setLastSync(new Date());
    } catch {}
    setSyncing(false);
  };

  useEffect(() => { load(); }, [load]);

  // Auto-sync if no entries
  useEffect(() => {
    if (!loading && entries.length === 0 && user?.id && selectedPersona?.id) {
      sync();
    }
  }, [loading, entries.length]);

  const filtered = filter === "all" ? entries : entries.filter(e => e.verdict === filter);

  // Summary stats
  const winners = entries.filter(e => e.verdict === "winner" || e.verdict === "scaled").length;
  const losers = entries.filter(e => e.verdict === "loser").length;
  const totalSpend = entries.reduce((s, e) => s + e.spend, 0);
  const totalConvValue = entries.reduce((s, e) => s + e.conv_value, 0);
  const winRate = entries.length > 0 ? Math.round((winners / entries.length) * 100) : 0;

  const TABS: { key: Verdict | "all"; label: string; count: number }[] = [
    { key: "all", label: "Todos", count: entries.length },
    { key: "winner", label: "Vencedores", count: entries.filter(e => e.verdict === "winner").length },
    { key: "scaled", label: "Escalados", count: entries.filter(e => e.verdict === "scaled").length },
    { key: "testing", label: "Testando", count: entries.filter(e => e.verdict === "testing").length },
    { key: "loser", label: "Pausados", count: entries.filter(e => e.verdict === "loser").length },
  ];

  if (!selectedPersona) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", fontFamily: F }}>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Selecione uma conta para ver o diário</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "clamp(16px,4vw,32px)", fontFamily: F }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, color: "#f0f2f8", letterSpacing: "-0.03em" }}>
            Diário de Anúncios
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
            {selectedPersona.name} · {entries.length} anúncios registrados
            {lastSync && ` · Sync ${lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
          </p>
        </div>
        <button onClick={sync} disabled={syncing}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)", color: "#38bdf8", fontSize: 13, fontWeight: 600, cursor: syncing ? "default" : "pointer", opacity: syncing ? 0.6 : 1, transition: "all 0.15s", whiteSpace: "nowrap", fontFamily: F }}>
          <RefreshCw size={13} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
          {syncing ? "Sincronizando..." : "Sincronizar"}
        </button>
      </div>

      {/* Summary cards */}
      {entries.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 24 }}>
          {[
            { label: "Taxa de acerto", value: `${winRate}%`, sub: `${winners} de ${entries.length} ads`, color: winRate >= 40 ? "#22c55e" : winRate >= 20 ? "#fbbf24" : "#f87171" },
            { label: "Total investido", value: `R$${totalSpend >= 1000 ? (totalSpend / 1000).toFixed(1) + "k" : totalSpend.toFixed(0)}`, sub: "nos últimos 90 dias", color: "rgba(255,255,255,0.7)" },
            { label: "Retorno gerado", value: totalConvValue > 0 ? `R$${totalConvValue >= 1000 ? (totalConvValue / 1000).toFixed(1) + "k" : totalConvValue.toFixed(0)}` : "—", sub: totalConvValue > 0 && totalSpend > 0 ? `ROAS ${(totalConvValue / totalSpend).toFixed(2)}×` : "sem dados de conv.", color: totalConvValue > totalSpend ? "#22c55e" : "rgba(255,255,255,0.7)" },
            { label: "Pausados", value: String(losers), sub: `${entries.length > 0 ? Math.round((losers / entries.length) * 100) : 0}% do total`, color: "#f87171" },
          ].map(card => (
            <div key={card.label} style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{card.label}</p>
              <p style={{ margin: "6px 0 2px", fontSize: 22, fontWeight: 800, color: card.color, fontFamily: M, letterSpacing: "-0.03em", lineHeight: 1 }}>{card.value}</p>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      {entries.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
          {TABS.filter(t => t.count > 0 || t.key === "all").map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 7, border: "1px solid", whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.12s", fontFamily: F, fontSize: 12.5, fontWeight: filter === tab.key ? 600 : 400,
                background: filter === tab.key ? "rgba(255,255,255,0.08)" : "transparent",
                borderColor: filter === tab.key ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)",
                color: filter === tab.key ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.4)",
              }}>
              {tab.key !== "all" && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: VERDICT_CONFIG[tab.key as Verdict]?.dot, flexShrink: 0 }} />
              )}
              {tab.label}
              <span style={{ fontSize: 11, opacity: 0.6 }}>{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(14,165,233,0.2)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* Syncing state */}
      {syncing && entries.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(14,165,233,0.2)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0 }}>Importando seus anúncios...</p>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginTop: 6 }}>Isso pode levar alguns segundos</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !syncing && entries.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 20px", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.08)" }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>Nenhum anúncio ainda</p>
          <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 13, margin: "0 0 20px" }}>Conecte Meta Ads ou Google Ads e clique em Sincronizar</p>
          <button onClick={sync} style={{ padding: "10px 22px", borderRadius: 9, background: "linear-gradient(135deg, #0ea5e9, #0891b2)", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: F }}>
            Sincronizar agora
          </button>
        </div>
      )}

      {/* Entries */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(entry => (
            <DiaryRow
              key={entry.id}
              entry={entry}
              expanded={expanded === entry.id}
              onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
            />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && entries.length > 0 && (
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 14, padding: "40px 0" }}>
          Nenhum anúncio nessa categoria
        </p>
      )}
    </div>
  );
}
