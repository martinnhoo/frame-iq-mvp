import { useState, useEffect, useCallback, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, ChevronDown, ChevronUp, Layers, LayoutList } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'DM Mono', monospace";

const T = {
  pt: {
    title: "Diário de Anúncios",
    updated: "Atualizado às",
    sync: "Sincronizar",
    syncing: "Sincronizando...",
    combined: "Combinado",
    separate: "Separado",
    win_rate: "Taxa de acerto",
    winners_of: (w: number, t: number) => `${w} vencedor${w !== 1 ? "es" : ""} de ${t} anúncios`,
    invested: "Investido",
    last90: "últimos 90 dias",
    roas_label: "ROAS geral",
    return_label: "Retorno",
    return_suffix: "retorno",
    no_conv: "sem dados de conversão",
    all: "Todos",
    winners: "Vencedores",
    scaled: "Escalados",
    testing: "Testando",
    paused: "Pausados",
    no_name: "Sem nome",
    launched: "Lançado",
    paused_on: "Pausado",
    select_account: "Selecione uma conta",
    select_sub: "Escolha acima qual conta quer analisar",
    no_ads: "Nenhum anúncio ainda",
    no_ads_sub: "Conecte Meta Ads ou Google Ads e clique em Sincronizar",
    sync_now: "Sincronizar agora",
    importing: "Importando anúncios...",
    importing_sub: "Isso pode levar alguns segundos",
    no_category: "Nenhum anúncio nessa categoria",
    more_ads: (n: number) => `+${n} anúncios`,
    accounts_label: (n: number) => `${n} contas`,
    verdict: { winner: "Vencedor", scaled: "Escalado", testing: "Testando", loser: "Pausado" },
    metrics: { spend: "Gasto", impressions: "Impressões", clicks: "Cliques", cpc: "CPC", conversions: "Conversões", frequency: "Frequência", days: "Dias", ctr: "CTR", roas: "ROAS" },
    date_locale: "pt-BR",
  },
  es: {
    title: "Diario de Anuncios",
    updated: "Actualizado a las",
    sync: "Sincronizar",
    syncing: "Sincronizando...",
    combined: "Combinado",
    separate: "Separado",
    win_rate: "Tasa de acierto",
    winners_of: (w: number, t: number) => `${w} ganador${w !== 1 ? "es" : ""} de ${t} anuncios`,
    invested: "Invertido",
    last90: "últimos 90 días",
    roas_label: "ROAS general",
    return_label: "Retorno",
    return_suffix: "retorno",
    no_conv: "sin datos de conversión",
    all: "Todos",
    winners: "Ganadores",
    scaled: "Escalados",
    testing: "Probando",
    paused: "Pausados",
    no_name: "Sin nombre",
    launched: "Lanzado",
    paused_on: "Pausado",
    select_account: "Selecciona una cuenta",
    select_sub: "Elige arriba qué cuenta quieres analizar",
    no_ads: "Sin anuncios aún",
    no_ads_sub: "Conecta Meta Ads o Google Ads y haz clic en Sincronizar",
    sync_now: "Sincronizar ahora",
    importing: "Importando anuncios...",
    importing_sub: "Esto puede tardar unos segundos",
    no_category: "Sin anuncios en esta categoría",
    more_ads: (n: number) => `+${n} anuncios`,
    accounts_label: (n: number) => `${n} cuentas`,
    verdict: { winner: "Ganador", scaled: "Escalado", testing: "Probando", loser: "Pausado" },
    metrics: { spend: "Gasto", impressions: "Impresiones", clicks: "Clics", cpc: "CPC", conversions: "Conversiones", frequency: "Frecuencia", days: "Días", ctr: "CTR", roas: "ROAS" },
    date_locale: "es-MX",
  },
  en: {
    title: "Ad Diary",
    updated: "Updated at",
    sync: "Sync",
    syncing: "Syncing...",
    combined: "Combined",
    separate: "Separate",
    win_rate: "Win rate",
    winners_of: (w: number, t: number) => `${w} winner${w !== 1 ? "s" : ""} of ${t} ads`,
    invested: "Invested",
    last90: "last 90 days",
    roas_label: "Overall ROAS",
    return_label: "Return",
    return_suffix: "return",
    no_conv: "no conversion data",
    all: "All",
    winners: "Winners",
    scaled: "Scaled",
    testing: "Testing",
    paused: "Paused",
    no_name: "Untitled",
    launched: "Launched",
    paused_on: "Paused",
    select_account: "Select an account",
    select_sub: "Choose which account to analyze above",
    no_ads: "No ads yet",
    no_ads_sub: "Connect Meta Ads or Google Ads and click Sync",
    sync_now: "Sync now",
    importing: "Importing ads...",
    importing_sub: "This may take a few seconds",
    no_category: "No ads in this category",
    more_ads: (n: number) => `+${n} ads`,
    accounts_label: (n: number) => `${n} accounts`,
    verdict: { winner: "Winner", scaled: "Scaled", testing: "Testing", loser: "Paused" },
    metrics: { spend: "Spend", impressions: "Impressions", clicks: "Clicks", cpc: "CPC", conversions: "Conversions", frequency: "Frequency", days: "Days", ctr: "CTR", roas: "ROAS" },
    date_locale: "en-US",
  },
};

const V_STYLE = {
  winner:  { bg: "rgba(34,197,94,0.06)",  border: "rgba(34,197,94,0.18)",  bar: "#22c55e", num: "#4ade80", badge: "rgba(34,197,94,0.12)"  },
  scaled:  { bg: "rgba(14,165,233,0.06)", border: "rgba(14,165,233,0.18)", bar: "#0ea5e9", num: "#38bdf8", badge: "rgba(14,165,233,0.12)" },
  testing: { bg: "rgba(251,191,36,0.05)", border: "rgba(251,191,36,0.15)", bar: "#fbbf24", num: "#fcd34d", badge: "rgba(251,191,36,0.10)" },
  loser:   { bg: "rgba(239,68,68,0.05)",  border: "rgba(239,68,68,0.15)",  bar: "#ef4444", num: "#f87171", badge: "rgba(239,68,68,0.10)"  },
};

type Verdict = keyof typeof V_STYLE;
interface Account { id: string; name: string | null; }
interface Entry {
  id: string; ad_id: string; ad_name: string; campaign_name: string;
  adset_name: string; platform: string; status: string;
  launched_at: string | null; paused_at: string | null; days_running: number;
  spend: number; impressions: number; clicks: number; ctr: number; cpc: number;
  conversions: number; conv_value: number; roas: number | null;
  frequency: number | null; verdict: Verdict; verdict_reason: string;
  peak_ctr: number; synced_at: string; persona_id: string;
}

const PLAT_COLOR: Record<string, string> = { meta: "#1877F2", google: "#4285F4" };
const PLAT_LABEL: Record<string, string> = { meta: "Meta", google: "Google" };

function money(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function DiaryRow({ entry, expanded, onToggle, t }: { entry: Entry; expanded: boolean; onToggle: () => void; t: typeof T.pt }) {
  const cfg = V_STYLE[entry.verdict] || V_STYLE.testing;
  const verdictLabel = t.verdict[entry.verdict as keyof typeof t.verdict] || entry.verdict;
  const ctr = (entry.ctr * 100).toFixed(2);
  const isPos = entry.verdict === "winner" || entry.verdict === "scaled";
  const platColor = PLAT_COLOR[entry.platform] || "#666";

  return (
    <div style={{ borderRadius: 12, background: cfg.bg, border: `1px solid ${cfg.border}`, overflow: "hidden" }}>
      <button onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", padding: 0, background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ width: 3, alignSelf: "stretch", background: cfg.bar, flexShrink: 0, opacity: 0.75 }} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, padding: "13px 15px" }}>
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#f0f2f8", fontFamily: F, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.ad_name || t.no_name}
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "rgba(255,255,255,0.3)", fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ color: platColor, fontWeight: 600 }}>{PLAT_LABEL[entry.platform] || entry.platform}</span>
              {entry.campaign_name && ` · ${entry.campaign_name}`}
              {entry.days_running > 0 && ` · ${entry.days_running}d`}
            </p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: cfg.num, fontFamily: M, letterSpacing: "-0.03em", lineHeight: 1 }}>{ctr}%</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: F, letterSpacing: "0.06em", textTransform: "uppercase" }}>CTR</p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, minWidth: 52 }}>
            {entry.roas && entry.roas > 0 ? (
              <>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: isPos ? "#4ade80" : "#f87171", fontFamily: M, letterSpacing: "-0.03em", lineHeight: 1 }}>{entry.roas.toFixed(1)}×</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: F, letterSpacing: "0.06em", textTransform: "uppercase" }}>ROAS</p>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.55)", fontFamily: M, letterSpacing: "-0.02em", lineHeight: 1 }}>{money(entry.spend)}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: F, letterSpacing: "0.06em", textTransform: "uppercase" }}>{t.metrics.spend}</p>
              </>
            )}
          </div>
          <div style={{ padding: "3px 9px", borderRadius: 5, background: cfg.badge, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: cfg.num, fontFamily: F }}>{verdictLabel}</span>
          </div>
          <div style={{ color: "rgba(255,255,255,0.18)", flexShrink: 0 }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: `1px solid ${cfg.border}`, padding: "13px 18px 15px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 7, marginBottom: 12 }}>
            {[
              { l: t.metrics.spend,       v: money(entry.spend) },
              { l: t.metrics.impressions, v: entry.impressions >= 1000 ? `${(entry.impressions/1000).toFixed(0)}k` : String(entry.impressions) },
              { l: t.metrics.clicks,      v: String(entry.clicks) },
              { l: t.metrics.ctr,         v: `${(entry.ctr*100).toFixed(2)}%` },
              { l: t.metrics.cpc,         v: `$${entry.cpc.toFixed(2)}` },
              ...(entry.conversions > 0   ? [{ l: t.metrics.conversions, v: entry.conversions.toFixed(0) }] : []),
              ...(entry.roas              ? [{ l: t.metrics.roas,        v: `${entry.roas.toFixed(2)}×`   }] : []),
              ...(entry.frequency         ? [{ l: t.metrics.frequency,   v: `${entry.frequency.toFixed(1)}×` }] : []),
              ...(entry.days_running > 0  ? [{ l: t.metrics.days,        v: String(entry.days_running)    }] : []),
            ].map(m => (
              <div key={m.l} style={{ padding: "8px 10px", borderRadius: 7, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: F, textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.l}</p>
                <p style={{ margin: "3px 0 0", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.85)", fontFamily: M, letterSpacing: "-0.02em" }}>{m.v}</p>
              </div>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.4)", fontFamily: F, lineHeight: 1.6, borderLeft: `2px solid ${cfg.bar}`, paddingLeft: 10, borderRadius: 0 }}>
            {entry.verdict_reason}
          </p>
          {(entry.launched_at || entry.paused_at) && (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: F }}>
              {entry.launched_at && `${t.launched} ${new Date(entry.launched_at).toLocaleDateString(t.date_locale)}`}
              {entry.paused_at && ` · ${t.paused_on} ${new Date(entry.paused_at).toLocaleDateString(t.date_locale)}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdDiary({ propUser, propPersona, propLang, embedded }: { propUser?: any; propPersona?: any; propLang?: string; embedded?: boolean } = {}) {
  const { user: ctxUser, selectedPersona: ctxPersona } = useOutletContext<DashboardContext>();
  const user = propUser ?? ctxUser;
  const selectedPersona = propPersona ?? ctxPersona;
  const { language: ctxLang } = useLanguage();
  const language = propLang ?? ctxLang;
  const t = T[language as keyof typeof T] || T.pt;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"combined" | "separate">("combined");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<Verdict | "all">("all");
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Load accounts
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("personas").select("id, name").eq("user_id", user.id).order("created_at")
      .then(({ data }) => setAccounts((data || []) as Account[]));
  }, [user?.id]);

  // Sync selected with active persona from sidebar
  useEffect(() => {
    if (selectedPersona?.id && !selectedIds.includes(selectedPersona.id)) {
      setSelectedIds([selectedPersona.id]);
    }
  }, [selectedPersona?.id]);

  const load = useCallback(async () => {
    if (!user?.id || selectedIds.length === 0) { setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any).from("ad_diary")
      .select("*").eq("user_id", user.id).in("persona_id", selectedIds)
      .order("spend", { ascending: false }).limit(500);
    setEntries((data || []) as Entry[]);
    if (data?.length) setLastSync(new Date((data[0] as any).synced_at));
    setLoading(false);
  }, [user?.id, selectedIds.join(",")]);

  useEffect(() => { load(); }, [load]);

  // Auto-sync disabled — prevents infinite loop when embedded. User clicks Sync manually.

  const syncAccount = async (personaId: string) => {
    if (!user?.id) return;
    setSyncing(personaId);
    try {
      await supabase.functions.invoke("sync-ad-diary", { body: { user_id: user.id, persona_id: personaId } });
      await load();
      setLastSync(new Date());
    } catch (e) { console.error("[AdBrief]", e); }
    setSyncing(null);
  };

  const syncAll = () => selectedIds.forEach(pid => syncAccount(pid));

  const toggleAccount = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter(x => x !== id) : prev
        : [...prev, id]
    );
  };

  const entriesByAccount = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    for (const e of entries) {
      if (!map[e.persona_id]) map[e.persona_id] = [];
      map[e.persona_id].push(e);
    }
    return map;
  }, [entries]);

  const filteredEntries = filter === "all" ? entries : entries.filter(e => e.verdict === filter);

  const stats = useMemo(() => {
    const winners = entries.filter(e => e.verdict === "winner" || e.verdict === "scaled").length;
    const totalSpend = entries.reduce((s, e) => s + e.spend, 0);
    const totalReturn = entries.reduce((s, e) => s + e.conv_value, 0);
    const winRate = entries.length > 0 ? Math.round((winners / entries.length) * 100) : 0;
    const overallRoas = totalSpend > 0 && totalReturn > 0 ? totalReturn / totalSpend : null;
    return { winners, totalSpend, totalReturn, winRate, overallRoas };
  }, [entries]);

  const TABS = [
    { key: "all" as const,     label: t.all,     count: entries.length },
    { key: "winner" as const,  label: t.winners, count: entries.filter(e => e.verdict === "winner").length },
    { key: "scaled" as const,  label: t.scaled,  count: entries.filter(e => e.verdict === "scaled").length },
    { key: "testing" as const, label: t.testing, count: entries.filter(e => e.verdict === "testing").length },
    { key: "loser" as const,   label: t.paused,  count: entries.filter(e => e.verdict === "loser").length },
  ];

  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ maxWidth: embedded ? "none" : 840, margin: embedded ? "0" : "0 auto", padding: embedded ? "20px 0 40px" : "clamp(16px,4vw,36px)", fontFamily: F }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, color: "#f0f2f8", letterSpacing: "-0.03em" }}>{t.title}</h1>
          {lastSync && <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{t.updated} {lastSync.toLocaleTimeString(t.date_locale, { hour: "2-digit", minute: "2-digit" })}</p>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {selectedIds.length > 1 && (
            <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 3, gap: 2 }}>
              {(["combined", "separate"] as const).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  style={{ padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: viewMode === mode ? "rgba(255,255,255,0.1)" : "transparent", color: viewMode === mode ? "#f0f2f8" : "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontFamily: F }}>
                  {mode === "combined" ? <Layers size={12} /> : <LayoutList size={12} />}
                  {mode === "combined" ? t.combined : t.separate}
                </button>
              ))}
            </div>
          )}
          <button onClick={syncAll} disabled={!!syncing}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, background: syncing ? "rgba(255,255,255,0.04)" : "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)", color: "#38bdf8", fontSize: 13, fontWeight: 600, cursor: syncing ? "default" : "pointer", opacity: syncing ? 0.5 : 1, fontFamily: F, whiteSpace: "nowrap" }}>
            <RefreshCw size={13} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
            {syncing ? t.syncing : t.sync}
          </button>
        </div>
      </div>

      {/* Account selector — só aparece se há mais de 1 conta */}
      {accounts.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {accounts.map(acc => {
            const isSel = selectedIds.includes(acc.id);
            const isSyncing = syncing === acc.id;
            return (
              <button key={acc.id} onClick={() => toggleAccount(acc.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: `1px solid ${isSel ? "rgba(14,165,233,0.35)" : "rgba(255,255,255,0.08)"}`, background: isSel ? "rgba(14,165,233,0.1)" : "rgba(255,255,255,0.03)", color: isSel ? "#38bdf8" : "rgba(255,255,255,0.4)", fontSize: 12.5, fontWeight: isSel ? 600 : 400, cursor: "pointer", fontFamily: F, transition: "all 0.12s" }}>
                {isSyncing
                  ? <div style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid rgba(14,165,233,0.3)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
                  : isSel && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0ea5e9" }} />
                }
                {acc.name || "Conta"}
              </button>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {entries.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
          <div style={{ gridColumn: "span 2", padding: "18px 20px", borderRadius: 14, background: stats.winRate >= 40 ? "rgba(34,197,94,0.07)" : "rgba(255,255,255,0.03)", border: `1px solid ${stats.winRate >= 40 ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)"}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.win_rate}</p>
              <p style={{ margin: "5px 0 3px", fontSize: 38, fontWeight: 900, color: stats.winRate >= 40 ? "#4ade80" : stats.winRate >= 20 ? "#fcd34d" : "#f87171", fontFamily: M, letterSpacing: "-0.04em", lineHeight: 1 }}>{stats.winRate}%</p>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{t.winners_of(stats.winners, entries.length)}</p>
            </div>
            <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 40 }}>
              {[
                { pct: stats.winners / Math.max(entries.length, 1), color: "#22c55e" },
                { pct: entries.filter(e => e.verdict === "testing").length / Math.max(entries.length, 1), color: "#fbbf24" },
                { pct: entries.filter(e => e.verdict === "loser").length / Math.max(entries.length, 1), color: "#ef4444" },
              ].map((b, i) => (
                <div key={i} style={{ width: 12, height: `${Math.max(b.pct * 100, 4)}%`, background: b.color, borderRadius: "3px 3px 0 0", opacity: 0.7, minHeight: 4 }} />
              ))}
            </div>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.invested}</p>
            <p style={{ margin: "5px 0 2px", fontSize: 24, fontWeight: 800, color: "rgba(255,255,255,0.75)", fontFamily: M, letterSpacing: "-0.03em", lineHeight: 1 }}>{money(stats.totalSpend)}</p>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{t.last90}</p>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 12, background: stats.overallRoas && stats.overallRoas >= 1 ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.03)", border: `1px solid ${stats.overallRoas && stats.overallRoas >= 1 ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.07)"}` }}>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{stats.overallRoas ? t.roas_label : t.return_label}</p>
            <p style={{ margin: "5px 0 2px", fontSize: 24, fontWeight: 800, color: stats.overallRoas && stats.overallRoas >= 2 ? "#4ade80" : stats.overallRoas && stats.overallRoas >= 1 ? "#fcd34d" : "rgba(255,255,255,0.4)", fontFamily: M, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {stats.overallRoas ? `${stats.overallRoas.toFixed(2)}×` : stats.totalReturn > 0 ? money(stats.totalReturn) : "—"}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
              {stats.overallRoas ? `${money(stats.totalReturn)} ${t.return_suffix}` : t.no_conv}
            </p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {entries.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
          {TABS.filter(tab => tab.count > 0 || tab.key === "all").map(tab => {
            const isActive = filter === tab.key;
            const color = tab.key !== "all" ? V_STYLE[tab.key].bar : undefined;
            return (
              <button key={tab.key} onClick={() => setFilter(tab.key)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1px solid", whiteSpace: "nowrap", cursor: "pointer", fontFamily: F, fontSize: 12.5, fontWeight: isActive ? 600 : 400, transition: "all 0.12s", background: isActive ? "rgba(255,255,255,0.08)" : "transparent", borderColor: isActive ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)", color: isActive ? "#f0f2f8" : "rgba(255,255,255,0.38)" }}>
                {color && <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />}
                {tab.label}
                <span style={{ fontSize: 11, fontFamily: M, color: isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)" }}>{tab.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(14,165,233,0.15)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
        </div>
      )}

      {/* Syncing empty */}
      {!loading && syncing && entries.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(14,165,233,0.15)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0 }}>{t.importing}</p>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginTop: 5 }}>{t.importing_sub}</p>
        </div>
      )}

      {/* No account selected */}
      {!loading && selectedIds.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 20px", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.07)" }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>{t.select_account}</p>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, margin: 0 }}>{t.select_sub}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !syncing && entries.length === 0 && selectedIds.length > 0 && (
        <div style={{ textAlign: "center", padding: "80px 20px", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.07)" }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>{t.no_ads}</p>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, margin: "0 0 20px" }}>{t.no_ads_sub}</p>
          <button onClick={syncAll} style={{ padding: "10px 24px", borderRadius: 9, background: "linear-gradient(135deg,#0ea5e9,#0891b2)", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {t.sync_now}
          </button>
        </div>
      )}

      {/* Combined view */}
      {!loading && filteredEntries.length > 0 && (viewMode === "combined" || selectedIds.length <= 1) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filteredEntries.map(entry => (
            <DiaryRow key={entry.id} entry={entry} t={t}
              expanded={expanded === entry.id}
              onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
            />
          ))}
          {filteredEntries.length < entries.length && (
            <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.2)", margin: "4px 0 0" }}>
              {t.more_ads(entries.length - filteredEntries.length)}
            </p>
          )}
        </div>
      )}

      {/* Separate view */}
      {!loading && selectedIds.length > 1 && viewMode === "separate" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {selectedIds.map(pid => {
            const acc = accounts.find(a => a.id === pid);
            const accEntries = (entriesByAccount[pid] || []).filter(e => filter === "all" || e.verdict === filter);
            if (accEntries.length === 0) return null;
            const accWin = Math.round((accEntries.filter(e => e.verdict === "winner" || e.verdict === "scaled").length / accEntries.length) * 100);
            return (
              <div key={pid}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(14,165,233,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0ea5e9" }}>{(acc?.name || "?").charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f0f2f8", fontFamily: F }}>{acc?.name || "Conta"}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: F }}>{accEntries.length} ads · {accWin}%</p>
                  </div>
                  {syncing === pid && <div style={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px solid rgba(14,165,233,0.3)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite", marginLeft: "auto" }} />}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {accEntries.map(entry => (
                    <DiaryRow key={entry.id} entry={entry} t={t}
                      expanded={expanded === entry.id}
                      onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filteredEntries.length === 0 && entries.length > 0 && (
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14, padding: "40px 0" }}>{t.no_category}</p>
      )}
    </div>
  );
}
