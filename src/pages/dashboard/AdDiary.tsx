import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'DM Mono', monospace";

const V = {
  winner:  { label: "Vencedor",  bg: "rgba(34,197,94,0.06)",   border: "rgba(34,197,94,0.16)",  bar: "#22c55e", num: "#4ade80", badge: "rgba(34,197,94,0.12)"  },
  scaled:  { label: "Escalado",  bg: "rgba(14,165,233,0.06)",  border: "rgba(14,165,233,0.16)", bar: "#0ea5e9", num: "#38bdf8", badge: "rgba(14,165,233,0.12)" },
  testing: { label: "Testando",  bg: "rgba(251,191,36,0.05)",  border: "rgba(251,191,36,0.13)", bar: "#fbbf24", num: "#fcd34d", badge: "rgba(251,191,36,0.10)" },
  loser:   { label: "Pausado",   bg: "rgba(239,68,68,0.05)",   border: "rgba(239,68,68,0.13)",  bar: "#ef4444", num: "#f87171", badge: "rgba(239,68,68,0.10)"  },
};

type Verdict = keyof typeof V;

interface Entry {
  id: string; ad_id: string; ad_name: string; campaign_name: string;
  adset_name: string; platform: string; status: string;
  launched_at: string | null; paused_at: string | null; days_running: number;
  spend: number; impressions: number; clicks: number; ctr: number; cpc: number;
  conversions: number; conv_value: number; roas: number | null;
  frequency: number | null; verdict: Verdict; verdict_reason: string;
  peak_ctr: number; synced_at: string;
}

function money(n: number) {
  if (n >= 1000) return `R$${(n / 1000).toFixed(1)}k`;
  return `R$${n.toFixed(0)}`;
}

function DiaryRow({ entry, expanded, onToggle }: { entry: Entry; expanded: boolean; onToggle: () => void }) {
  const cfg = V[entry.verdict] || V.testing;
  const ctr = (entry.ctr * 100).toFixed(2);
  const isPos = entry.verdict === "winner" || entry.verdict === "scaled";

  return (
    <div style={{
      borderRadius: 12, background: cfg.bg, border: `1px solid ${cfg.border}`,
      overflow: "hidden", transition: "box-shadow 0.15s",
    }}>
      <button onClick={onToggle} style={{
        width: "100%", display: "flex", alignItems: "center",
        padding: "0", background: "none", border: "none", cursor: "pointer",
      }}>
        {/* Left color bar */}
        <div style={{ width: 3, alignSelf: "stretch", background: cfg.bar, flexShrink: 0, opacity: 0.7 }} />

        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, padding: "16px 18px" }}>
          {/* Ad name + campaign */}
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#f0f2f8", fontFamily: F, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>
              {entry.ad_name || "Sem nome"}
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.campaign_name || entry.platform}
              {entry.days_running > 0 && ` · ${entry.days_running}d`}
            </p>
          </div>

          {/* CTR */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: cfg.num, fontFamily: M, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {ctr}%
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "rgba(255,255,255,0.25)", fontFamily: F, letterSpacing: "0.06em", textTransform: "uppercase" }}>CTR</p>
          </div>

          {/* ROAS or spend */}
          <div style={{ textAlign: "right", flexShrink: 0, minWidth: 52 }}>
            {entry.roas && entry.roas > 0 ? (
              <>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: isPos ? "#4ade80" : "#f87171", fontFamily: M, letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {entry.roas.toFixed(1)}×
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "rgba(255,255,255,0.25)", fontFamily: F, letterSpacing: "0.06em", textTransform: "uppercase" }}>ROAS</p>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.55)", fontFamily: M, letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {money(entry.spend)}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "rgba(255,255,255,0.25)", fontFamily: F, letterSpacing: "0.06em", textTransform: "uppercase" }}>Gasto</p>
              </>
            )}
          </div>

          {/* Verdict badge */}
          <div style={{ padding: "4px 10px", borderRadius: 6, background: cfg.badge, flexShrink: 0 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: cfg.num, fontFamily: F, letterSpacing: "0.01em" }}>
              {cfg.label}
            </span>
          </div>

          {/* Chevron */}
          <div style={{ color: "rgba(255,255,255,0.18)", flexShrink: 0 }}>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </div>
      </button>

      {/* Expanded */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${cfg.border}`, padding: "16px 21px 18px" }}>
          {/* Metric grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8, marginBottom: 14 }}>
            {[
              { l: "Gasto",      v: money(entry.spend) },
              { l: "Impressões", v: entry.impressions >= 1000 ? `${(entry.impressions/1000).toFixed(0)}k` : String(entry.impressions) },
              { l: "Cliques",    v: String(entry.clicks) },
              { l: "CTR",        v: `${(entry.ctr*100).toFixed(2)}%` },
              { l: "CPC",        v: `R$${entry.cpc.toFixed(2)}` },
              ...(entry.conversions > 0 ? [{ l: "Conversões", v: entry.conversions.toFixed(0) }] : []),
              ...(entry.roas ? [{ l: "ROAS", v: `${entry.roas.toFixed(2)}×` }] : []),
              ...(entry.frequency ? [{ l: "Frequência", v: `${entry.frequency.toFixed(1)}×` }] : []),
              ...(entry.days_running > 0 ? [{ l: "Dias", v: String(entry.days_running) }] : []),
            ].map(m => (
              <div key={m.l} style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <p style={{ margin: 0, fontSize: 10.5, color: "rgba(255,255,255,0.3)", fontFamily: F, textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.l}</p>
                <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.85)", fontFamily: M, letterSpacing: "-0.02em" }}>{m.v}</p>
              </div>
            ))}
          </div>

          {/* Reason */}
          <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.4)", fontFamily: F, lineHeight: 1.6, borderLeft: `2px solid ${cfg.bar}`, paddingLeft: 10 }}>
            {entry.verdict_reason}
          </p>

          {/* Dates */}
          {(entry.launched_at || entry.paused_at) && (
            <p style={{ margin: "10px 0 0", fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: F }}>
              {entry.launched_at && `Lançado ${new Date(entry.launched_at).toLocaleDateString("pt-BR")}`}
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
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<Verdict | "all">("all");
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !selectedPersona?.id) { setLoading(false); return; }
    const { data } = await (supabase as any).from("ad_diary")
      .select("*").eq("user_id", user.id).eq("persona_id", selectedPersona.id)
      .order("spend", { ascending: false }).limit(200);
    setEntries((data || []) as Entry[]);
    if (data?.length) setLastSync(new Date((data[0] as any).synced_at));
    setLoading(false);
  }, [user?.id, selectedPersona?.id]);

  const sync = async () => {
    if (!user?.id || !selectedPersona?.id) return;
    setSyncing(true);
    try {
      await supabase.functions.invoke("sync-ad-diary", { body: { user_id: user.id, persona_id: selectedPersona.id } });
      await load();
      setLastSync(new Date());
    } catch {}
    setSyncing(false);
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!loading && entries.length === 0 && user?.id && selectedPersona?.id) sync();
  }, [loading, entries.length]);

  const filtered = filter === "all" ? entries : entries.filter(e => e.verdict === filter);
  const winners  = entries.filter(e => e.verdict === "winner" || e.verdict === "scaled").length;
  const losers   = entries.filter(e => e.verdict === "loser").length;
  const totalSpend    = entries.reduce((s, e) => s + e.spend, 0);
  const totalReturn   = entries.reduce((s, e) => s + e.conv_value, 0);
  const winRate       = entries.length > 0 ? Math.round((winners / entries.length) * 100) : 0;
  const overallRoas   = totalSpend > 0 && totalReturn > 0 ? totalReturn / totalSpend : null;

  const TABS = [
    { key: "all" as const,     label: "Todos",       count: entries.length },
    { key: "winner" as const,  label: "Vencedores",  count: entries.filter(e => e.verdict === "winner").length },
    { key: "scaled" as const,  label: "Escalados",   count: entries.filter(e => e.verdict === "scaled").length },
    { key: "testing" as const, label: "Testando",    count: entries.filter(e => e.verdict === "testing").length },
    { key: "loser" as const,   label: "Pausados",    count: entries.filter(e => e.verdict === "loser").length },
  ];

  if (!selectedPersona) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, fontFamily: F }}>Selecione uma conta para ver o diário</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "clamp(16px,4vw,36px)", fontFamily: F }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(22px,3vw,28px)", fontWeight: 800, color: "#f0f2f8", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Diário de Anúncios
          </h1>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: F }}>
            {selectedPersona.name}
            {lastSync && ` · atualizado às ${lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
          </p>
        </div>
        <button onClick={sync} disabled={syncing}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 9, background: syncing ? "rgba(255,255,255,0.04)" : "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)", color: "#38bdf8", fontSize: 13, fontWeight: 600, cursor: syncing ? "default" : "pointer", opacity: syncing ? 0.5 : 1, transition: "all 0.15s", fontFamily: F, whiteSpace: "nowrap" }}>
          <RefreshCw size={13} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
          {syncing ? "Sincronizando..." : "Sincronizar"}
        </button>
      </div>

      {/* ── Summary ────────────────────────────────────────────────── */}
      {entries.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 28 }}>
          {/* Taxa de acerto — destaque */}
          <div style={{ gridColumn: "span 2", padding: "20px 22px", borderRadius: 14, background: winRate >= 40 ? "rgba(34,197,94,0.07)" : "rgba(255,255,255,0.03)", border: `1px solid ${winRate >= 40 ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)"}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: F }}>Taxa de acerto</p>
              <p style={{ margin: "6px 0 4px", fontSize: 40, fontWeight: 900, color: winRate >= 40 ? "#4ade80" : winRate >= 20 ? "#fcd34d" : "#f87171", fontFamily: M, letterSpacing: "-0.04em", lineHeight: 1 }}>
                {winRate}%
              </p>
              <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.35)", fontFamily: F }}>
                {winners} vencedor{winners !== 1 ? "es" : ""} de {entries.length} anúncios
              </p>
            </div>
            {/* Mini bar chart */}
            <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 40 }}>
              {[
                { pct: winners / Math.max(entries.length, 1), color: "#22c55e" },
                { pct: entries.filter(e => e.verdict === "testing").length / Math.max(entries.length, 1), color: "#fbbf24" },
                { pct: losers / Math.max(entries.length, 1), color: "#ef4444" },
              ].map((b, i) => (
                <div key={i} style={{ width: 12, height: `${Math.max(b.pct * 100, 4)}%`, background: b.color, borderRadius: "3px 3px 0 0", opacity: 0.7, minHeight: 4 }} />
              ))}
            </div>
          </div>

          {/* Investido */}
          <div style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Investido</p>
            <p style={{ margin: "6px 0 3px", fontSize: 26, fontWeight: 800, color: "rgba(255,255,255,0.75)", fontFamily: M, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {totalSpend >= 1000 ? `R$${(totalSpend/1000).toFixed(1)}k` : `R$${totalSpend.toFixed(0)}`}
            </p>
            <p style={{ margin: 0, fontSize: 11.5, color: "rgba(255,255,255,0.25)", fontFamily: F }}>nos últimos 90 dias</p>
          </div>

          {/* Retorno / ROAS */}
          <div style={{ padding: "16px 18px", borderRadius: 12, background: overallRoas && overallRoas >= 1 ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.03)", border: `1px solid ${overallRoas && overallRoas >= 1 ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.07)"}` }}>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{overallRoas ? "ROAS geral" : "Retorno"}</p>
            <p style={{ margin: "6px 0 3px", fontSize: 26, fontWeight: 800, color: overallRoas && overallRoas >= 2 ? "#4ade80" : overallRoas && overallRoas >= 1 ? "#fcd34d" : "rgba(255,255,255,0.4)", fontFamily: M, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {overallRoas ? `${overallRoas.toFixed(2)}×` : totalReturn > 0 ? (totalReturn >= 1000 ? `R$${(totalReturn/1000).toFixed(1)}k` : `R$${totalReturn.toFixed(0)}`) : "—"}
            </p>
            <p style={{ margin: 0, fontSize: 11.5, color: "rgba(255,255,255,0.25)", fontFamily: F }}>
              {overallRoas ? `R$${totalReturn >= 1000 ? (totalReturn/1000).toFixed(1)+"k" : totalReturn.toFixed(0)} retorno` : "sem dados de conversão"}
            </p>
          </div>
        </div>
      )}

      {/* ── Filter tabs ─────────────────────────────────────────────── */}
      {entries.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 18, overflowX: "auto", paddingBottom: 2 }}>
          {TABS.filter(t => t.count > 0 || t.key === "all").map(tab => {
            const isActive = filter === tab.key;
            const color = tab.key !== "all" ? V[tab.key].bar : undefined;
            return (
              <button key={tab.key} onClick={() => setFilter(tab.key)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid", whiteSpace: "nowrap", cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: isActive ? 600 : 400, transition: "all 0.12s",
                  background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                  borderColor: isActive ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                  color: isActive ? "#f0f2f8" : "rgba(255,255,255,0.38)",
                }}>
                {color && <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />}
                {tab.label}
                <span style={{ fontSize: 11.5, fontFamily: M, color: isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)" }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── States ──────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(14,165,233,0.15)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
        </div>
      )}

      {syncing && entries.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(14,165,233,0.15)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0, fontFamily: F }}>Importando seus anúncios...</p>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginTop: 5, fontFamily: F }}>Isso pode levar alguns segundos</p>
        </div>
      )}

      {!loading && !syncing && entries.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 20px", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.07)" }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, fontWeight: 600, margin: "0 0 6px", fontFamily: F }}>Nenhum anúncio ainda</p>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, margin: "0 0 20px", fontFamily: F }}>Conecte Meta Ads ou Google Ads e clique em Sincronizar</p>
          <button onClick={sync} style={{ padding: "10px 24px", borderRadius: 9, background: "linear-gradient(135deg,#0ea5e9,#0891b2)", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: F }}>
            Sincronizar agora
          </button>
        </div>
      )}

      {/* ── Entries ─────────────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(entry => (
            <DiaryRow key={entry.id} entry={entry}
              expanded={expanded === entry.id}
              onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
            />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && entries.length > 0 && (
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14, padding: "40px 0", fontFamily: F }}>
          Nenhum anúncio nessa categoria
        </p>
      )}
    </div>
  );
}
