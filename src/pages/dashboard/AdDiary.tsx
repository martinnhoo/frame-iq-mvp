import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { DESIGN_TOKENS as DT } from "@/hooks/useDesignTokens";

const F = DT.font;
const M = DT.mono;

const T = {
  pt: {
    title: "Diário de Anúncios",
    updated: "Atualizado às",
    sync: "Sincronizar",
    syncing: "Sincronizando...",
    win_rate: "Taxa de acerto",
    winners_of: (w: number, t: number) => `${w} vencedor${w !== 1 ? "es" : ""} de ${t}`,
    invested: "Investido",
    roas_label: "ROAS geral",
    return_label: "Retorno",
    return_suffix: "retorno",
    no_conv: "sem conversão",
    all: "Todos",
    winners: "Vencedores",
    scaled: "Escalados",
    testing: "Testando",
    paused: "Pausados",
    no_name: "Sem nome",
    launched: "Lançado",
    paused_on: "Pausado",
    no_ads: "Nenhum anúncio ainda",
    no_ads_sub: "Conecte Meta Ads e clique em Sincronizar",
    sync_now: "Sincronizar agora",
    importing: "Importando anúncios...",
    importing_sub: "Isso pode levar alguns segundos",
    no_category: "Nenhum anúncio nessa categoria",
    more_ads: (n: number) => `+${n} anúncios`,
    verdict: { winner: "Vencedor", scaled: "Escalado", testing: "Testando", loser: "Pausado" },
    metrics: { spend: "Gasto", impressions: "Impressões", clicks: "Cliques", cpc: "CPC", conversions: "Conversões", frequency: "Frequência", days: "Dias", ctr: "CTR", roas: "ROAS" },
    date_locale: "pt-BR",
    pick_dates: "Escolher datas",
  },
  es: {
    title: "Diario de Anuncios",
    updated: "Actualizado a las",
    sync: "Sincronizar",
    syncing: "Sincronizando...",
    win_rate: "Tasa de acierto",
    winners_of: (w: number, t: number) => `${w} ganador${w !== 1 ? "es" : ""} de ${t}`,
    invested: "Invertido",
    roas_label: "ROAS general",
    return_label: "Retorno",
    return_suffix: "retorno",
    no_conv: "sin conversión",
    all: "Todos",
    winners: "Ganadores",
    scaled: "Escalados",
    testing: "Probando",
    paused: "Pausados",
    no_name: "Sin nombre",
    launched: "Lanzado",
    paused_on: "Pausado",
    no_ads: "Sin anuncios aún",
    no_ads_sub: "Conecta Meta Ads y haz clic en Sincronizar",
    sync_now: "Sincronizar ahora",
    importing: "Importando anuncios...",
    importing_sub: "Esto puede tardar unos segundos",
    no_category: "Sin anuncios en esta categoría",
    more_ads: (n: number) => `+${n} anuncios`,
    verdict: { winner: "Ganador", scaled: "Escalado", testing: "Probando", loser: "Pausado" },
    metrics: { spend: "Gasto", impressions: "Impresiones", clicks: "Clics", cpc: "CPC", conversions: "Conversiones", frequency: "Frecuencia", days: "Días", ctr: "CTR", roas: "ROAS" },
    date_locale: "es-MX",
    pick_dates: "Elegir fechas",
  },
  en: {
    title: "Ad Diary",
    updated: "Updated at",
    sync: "Sync",
    syncing: "Syncing...",
    win_rate: "Win rate",
    winners_of: (w: number, t: number) => `${w} winner${w !== 1 ? "s" : ""} of ${t}`,
    invested: "Invested",
    roas_label: "Overall ROAS",
    return_label: "Return",
    return_suffix: "return",
    no_conv: "no conversions",
    all: "All",
    winners: "Winners",
    scaled: "Scaled",
    testing: "Testing",
    paused: "Paused",
    no_name: "Untitled",
    launched: "Launched",
    paused_on: "Paused",
    no_ads: "No ads yet",
    no_ads_sub: "Connect Meta Ads and click Sync",
    sync_now: "Sync now",
    importing: "Importing ads...",
    importing_sub: "This may take a few seconds",
    no_category: "No ads in this category",
    more_ads: (n: number) => `+${n} ads`,
    verdict: { winner: "Winner", scaled: "Scaled", testing: "Testing", loser: "Paused" },
    metrics: { spend: "Spend", impressions: "Impressions", clicks: "Clicks", cpc: "CPC", conversions: "Conversions", frequency: "Frequency", days: "Days", ctr: "CTR", roas: "ROAS" },
    date_locale: "en-US",
    pick_dates: "Pick dates",
  },
};

const V_STYLE = {
  winner:  { bg: "rgba(34,197,94,0.06)",  border: "rgba(34,197,94,0.18)",  bar: "#22A3A3", num: "#2ECECE", badge: "rgba(34,197,94,0.12)" },
  scaled:  { bg: "rgba(14,165,233,0.06)", border: "rgba(14,165,233,0.18)", bar: "#0ea5e9", num: "#38bdf8", badge: "rgba(14,165,233,0.12)" },
  testing: { bg: "rgba(251,191,36,0.05)", border: "rgba(251,191,36,0.15)", bar: "#fbbf24", num: "#fcd34d", badge: "rgba(251,191,36,0.10)" },
  loser:   { bg: "rgba(239,68,68,0.05)",  border: "rgba(239,68,68,0.15)",  bar: "#ef4444", num: "#f87171", badge: "rgba(239,68,68,0.10)" },
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
  thumbnail_url?: string | null;
}

function money(n: number, lang?: string) {
  const sym = lang === "pt" ? "R$" : "$";
  if (n >= 1000) return `${sym}${(n / 1000).toFixed(1)}k`;
  return `${sym}${n.toFixed(0)}`;
}

// ── Thumbnail component with fallback ──
function AdThumb({ url, name, verdict }: { url?: string | null; name: string; verdict: Verdict }) {
  const [err, setErr] = useState(false);
  const cfg = V_STYLE[verdict] || V_STYLE.testing;
  if (url && !err) {
    return (
      <img src={url} alt={name} onError={() => setErr(true)}
        style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "rgba(255,255,255,0.04)", border: `1px solid ${cfg.border}` }}
      />
    );
  }
  // Fallback: colored initial
  return (
    <div style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, background: cfg.badge, border: `1px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 16, fontWeight: 800, color: cfg.num, fontFamily: M }}>{(name || "?").charAt(0).toUpperCase()}</span>
    </div>
  );
}

// ── Diary Row — card style with thumbnail ──
const DiaryRow = React.memo(function DiaryRow({ entry, expanded, onToggle, t, lang }: { entry: Entry; expanded: boolean; onToggle: () => void; t: typeof T.pt; lang?: string }) {
  const cfg = V_STYLE[entry.verdict] || V_STYLE.testing;
  const verdictLabel = t.verdict[entry.verdict as keyof typeof t.verdict] || entry.verdict;
  const ctr = (entry.ctr * 100).toFixed(2);
  const isPos = entry.verdict === "winner" || entry.verdict === "scaled";

  return (
    <div style={{ borderRadius: 14, background: cfg.bg, border: `1px solid ${cfg.border}`, overflow: "hidden", transition: "transform 0.15s, box-shadow 0.15s" }} className="ab-diary-row">
      <button onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", padding: 0, background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ width: 3, alignSelf: "stretch", background: cfg.bar, flexShrink: 0, opacity: 0.75 }} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, padding: "11px 14px" }}>
          {/* Thumbnail */}
          <AdThumb url={entry.thumbnail_url} name={entry.ad_name} verdict={entry.verdict} />

          {/* Name + campaign */}
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#f0f2f8", fontFamily: F, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.ad_name || t.no_name}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.28)", fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.campaign_name || ""}
              {entry.days_running > 0 && ` · ${entry.days_running}d`}
            </p>
          </div>

          {/* CTR + ROAS/Spend in compact form */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: cfg.num, fontFamily: M, letterSpacing: "-0.03em", lineHeight: 1 }}>{ctr}%</p>
              <p style={{ margin: "1px 0 0", fontSize: 9, color: "rgba(255,255,255,0.22)", fontFamily: F, letterSpacing: "0.08em", textTransform: "uppercase" }}>CTR</p>
            </div>
            {entry.roas && entry.roas > 0 ? (
              <div style={{ textAlign: "right", minWidth: 40 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: isPos ? "#2ECECE" : "#f87171", fontFamily: M, letterSpacing: "-0.03em", lineHeight: 1 }}>{entry.roas.toFixed(1)}×</p>
                <p style={{ margin: "1px 0 0", fontSize: 9, color: "rgba(255,255,255,0.22)", fontFamily: F, letterSpacing: "0.08em", textTransform: "uppercase" }}>ROAS</p>
              </div>
            ) : (
              <div style={{ textAlign: "right", minWidth: 40 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.5)", fontFamily: M, letterSpacing: "-0.02em", lineHeight: 1 }}>{money(entry.spend, lang)}</p>
                <p style={{ margin: "1px 0 0", fontSize: 9, color: "rgba(255,255,255,0.22)", fontFamily: F, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.metrics.spend}</p>
              </div>
            )}
          </div>

          {/* Badge + chevron */}
          <div style={{ padding: "3px 8px", borderRadius: 5, background: cfg.badge, flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: cfg.num, fontFamily: F }}>{verdictLabel}</span>
          </div>
          <div style={{ color: "rgba(255,255,255,0.15)", flexShrink: 0 }}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: `1px solid ${cfg.border}`, padding: "12px 16px 14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(82px, 1fr))", gap: 6, marginBottom: 10 }}>
            {[
              { l: t.metrics.spend,       v: money(entry.spend, lang) },
              { l: t.metrics.impressions, v: entry.impressions >= 1000 ? `${(entry.impressions/1000).toFixed(0)}k` : String(entry.impressions) },
              { l: t.metrics.clicks,      v: String(entry.clicks) },
              { l: t.metrics.ctr,         v: `${(entry.ctr*100).toFixed(2)}%` },
              { l: t.metrics.cpc,         v: `${lang === "pt" ? "R$" : "$"}${entry.cpc.toFixed(2)}` },
              ...(entry.conversions > 0   ? [{ l: t.metrics.conversions, v: entry.conversions.toFixed(0) }] : []),
              ...(entry.roas              ? [{ l: t.metrics.roas,        v: `${entry.roas.toFixed(2)}×`   }] : []),
              ...(entry.frequency         ? [{ l: t.metrics.frequency,   v: `${entry.frequency.toFixed(1)}×` }] : []),
              ...(entry.days_running > 0  ? [{ l: t.metrics.days,        v: String(entry.days_running)    }] : []),
            ].map(m => (
              <div key={m.l} style={{ padding: "7px 9px", borderRadius: 7, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.28)", fontFamily: F, textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.l}</p>
                <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", fontFamily: M, letterSpacing: "-0.02em" }}>{m.v}</p>
              </div>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.38)", fontFamily: F, lineHeight: 1.6, borderLeft: `2px solid ${cfg.bar}`, paddingLeft: 10, borderRadius: 0 }}>
            {entry.verdict_reason}
          </p>
          {(entry.launched_at || entry.paused_at) && (
            <p style={{ margin: "7px 0 0", fontSize: 10, color: "rgba(255,255,255,0.18)", fontFamily: F }}>
              {entry.launched_at && `${t.launched} ${new Date(entry.launched_at).toLocaleDateString(t.date_locale)}`}
              {entry.paused_at && ` · ${t.paused_on} ${new Date(entry.paused_at).toLocaleDateString(t.date_locale)}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

// ── Helpers for calendar ──
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const fmtD = (d: Date) => d.toISOString().slice(0, 10);
const fmtLabel = (d: Date, locale: string) => d.toLocaleDateString(locale, { day: "numeric", month: "short" });

export default function AdDiary({ propUser, propPersona, propLang, embedded }: { propUser?: any; propPersona?: any; propLang?: string; embedded?: boolean } = {}) {
  usePageTitle("Diário de Anúncios");
  const { user: ctxUser, selectedPersona: ctxPersona } = useOutletContext<DashboardContext>();
  const user = propUser ?? ctxUser;
  const selectedPersona = propPersona ?? ctxPersona;
  const { language: ctxLang } = useLanguage();
  const language = propLang ?? ctxLang;
  const t = T[language as keyof typeof T] || T.pt;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<Verdict | "all">("all");
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Date range (like LivePanel)
  const today = useMemo(() => new Date(), []);
  const PRESETS = [{ label: "7D", days: 7 }, { label: "30D", days: 30 }, { label: "90D", days: 90 }];
  const [activePreset, setActivePreset] = useState("90D");
  const [dateRange, setDateRange] = useState({ from: addDays(today, -89), to: today });
  const [showCal, setShowCal] = useState(false);
  const [calView, setCalView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [calDraft, setCalDraft] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [calSel, setCalSel] = useState<"from" | "to">("from");
  const calRef = useRef<HTMLDivElement>(null);

  // Close calendar on outside click
  useEffect(() => {
    if (!showCal) return;
    const handler = (e: MouseEvent) => { if (calRef.current && !calRef.current.contains(e.target as Node)) setShowCal(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCal]);

  const personaId = selectedPersona?.id || null;

  const load = useCallback(async () => {
    if (!user?.id || !personaId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any).from("ad_diary")
      .select("*").eq("user_id", user.id).eq("persona_id", personaId)
      .order("spend", { ascending: false }).limit(500);
    let rows = (data || []) as Entry[];

    // Enrich missing thumbnails via ads→creatives join (ads.meta_ad_id matches ad_diary.ad_id)
    const missing = rows.filter(e => !e.thumbnail_url && e.ad_id);
    if (missing.length > 0) {
      const adIds = missing.map(e => e.ad_id);
      const { data: adsWithThumb } = await (supabase as any).from("ads")
        .select("meta_ad_id, creative:creatives(thumbnail_url)")
        .in("meta_ad_id", adIds.slice(0, 100));
      if (adsWithThumb?.length) {
        const thumbMap: Record<string, string> = {};
        for (const a of adsWithThumb) {
          const url = a.creative?.thumbnail_url;
          if (url) thumbMap[a.meta_ad_id] = url;
        }
        rows = rows.map(e => e.thumbnail_url ? e : { ...e, thumbnail_url: thumbMap[e.ad_id] || null });
      }
    }

    setEntries(rows);
    if (data?.length) setLastSync(new Date((data[0] as any).synced_at));
    setLoading(false);
  }, [user?.id, personaId]);

  useEffect(() => { load(); }, [load]);

  // Re-fetch when Meta ad account changes
  useEffect(() => {
    const handler = () => { load(); };
    window.addEventListener('meta-account-changed', handler);
    return () => window.removeEventListener('meta-account-changed', handler);
  }, [load]);

  const syncAccount = async () => {
    if (!user?.id || !personaId) return;
    setSyncing(personaId);
    setSyncError(null);
    try {
      const days = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000) + 1;
      const period = days <= 7 ? "7d" : days <= 14 ? "14d" : days <= 30 ? "30d" : days <= 60 ? "60d" : "90d";
      const { data: res, error } = await supabase.functions.invoke("live-metrics", {
        body: { user_id: user.id, persona_id: personaId, period, date_from: fmtD(dateRange.from), date_to: fmtD(dateRange.to) }
      });
      if (error) { setSyncError(`Erro: ${error.message}`); setSyncing(null); return; }

      const metaAds: any[] = res?.meta?.top_ads || [];
      if (!metaAds.length) { setSyncError("0 anúncios encontrados"); setSyncing(null); return; }

      const calcVerdict = (a: any) => {
        const ctr = (a.ctr || 0) * 100;
        const spend = a.spend || 0;
        if (a.freq > 3.5) return { verdict: "loser" as const, reason: `Freq ${a.freq?.toFixed(1)}× — fadiga` };
        if (ctr >= 2.5 && spend > 5) return { verdict: "winner" as const, reason: `CTR ${ctr.toFixed(2)}% — forte` };
        if (ctr >= 1.5 && spend > 20) return { verdict: "scaled" as const, reason: `CTR ${ctr.toFixed(2)}% com volume` };
        if (spend < 10) return { verdict: "testing" as const, reason: "Em aprendizado" };
        if (ctr < 0.5 && spend > 20) return { verdict: "loser" as const, reason: `CTR ${ctr.toFixed(2)}% baixo` };
        return { verdict: "testing" as const, reason: "Aguardando mais dados" };
      };

      const rows = metaAds.map((a: any) => {
        const ctr = a.ctr || 0;
        const spend = a.spend || 0;
        const roas = a.roas || null;
        const conv = a.conversions || 0;
        const verd = calcVerdict({ ...a, ctr: ctr * 100, spend, roas });
        return {
          user_id: user.id, persona_id: personaId, platform: "meta",
          ad_id: a.id || a.name || String(Math.random()),
          ad_name: a.name || "Sem nome",
          campaign_name: a.campaign || null,
          adset_name: a.adset || null,
          status: "active",
          launched_at: null, paused_at: null, days_running: 0,
          spend, impressions: a.impressions || 0, clicks: 0,
          ctr, cpc: a.cpc || 0, conversions: conv, conv_value: 0,
          roas, frequency: null,
          verdict: verd.verdict, verdict_reason: verd.reason,
          peak_ctr: ctr, synced_at: new Date().toISOString(),
          thumbnail_url: a.thumbnail_url || null,
        };
      });

      await (supabase as any).from("ad_diary").upsert(rows, { onConflict: "user_id,persona_id,platform,ad_id" });
      await load();
      setLastSync(new Date());
    } catch (e: any) { setSyncError(`Falha: ${String(e?.message || e)}`); }
    setSyncing(null);
  };

  const filteredEntries = entries.filter(e => filter === "all" || e.verdict === filter);

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
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .ab-diary-row:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,0.25)}`}</style>

      {/* ── Header: title + date presets/calendar + sync ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 10, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, color: "#f0f2f8", letterSpacing: "-0.03em" }}>{t.title}</h1>
          {lastSync && <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{t.updated} {lastSync.toLocaleTimeString(t.date_locale, { hour: "2-digit", minute: "2-digit" })}</p>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Period presets */}
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => {
              setActivePreset(p.label);
              setDateRange({ from: addDays(today, -(p.days - 1)), to: today });
            }}
              style={{
                padding: "4px 10px", borderRadius: 999, border: "none",
                background: activePreset === p.label ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.04)",
                color: activePreset === p.label ? "#0ea5e9" : "rgba(255,255,255,0.38)",
                fontSize: 10, fontWeight: 700, fontFamily: F,
                letterSpacing: "0.02em", cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (activePreset !== p.label) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}}
              onMouseLeave={e => { if (activePreset !== p.label) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.38)"; }}}
            >
              {p.label}
            </button>
          ))}

          {/* Calendar icon */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowCal(!showCal)}
              style={{
                width: 28, height: 28, borderRadius: 999, border: "none",
                background: showCal ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.04)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (!showCal) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={e => { if (!showCal) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              title={t.pick_dates}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={showCal ? "#0ea5e9" : "rgba(255,255,255,0.40)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </button>

            {/* Calendar dropdown */}
            {showCal && (
              <div ref={calRef} style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 100,
                background: "rgba(15,17,22,0.98)", border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 14, padding: 16, minWidth: 260,
                boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
                backdropFilter: "blur(16px)",
              }}>
                {/* Month nav */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <button onClick={() => setCalView(new Date(calView.getFullYear(), calView.getMonth() - 1, 1))}
                    style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>
                    ‹
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: F }}>
                    {calView.toLocaleDateString(language === "pt" ? "pt-BR" : language === "es" ? "es-MX" : "en-US", { month: "long", year: "numeric" })}
                  </span>
                  <button onClick={() => setCalView(new Date(calView.getFullYear(), calView.getMonth() + 1, 1))}
                    style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>
                    ›
                  </button>
                </div>
                {/* Day headers */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
                  {(language === "pt" ? ["D","S","T","Q","Q","S","S"] : language === "es" ? ["D","L","M","M","J","V","S"] : ["S","M","T","W","T","F","S"]).map((d, i) => (
                    <div key={i} style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.25)", textAlign: "center", padding: 4, fontFamily: F }}>{d}</div>
                  ))}
                </div>
                {/* Calendar days */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
                  {(() => {
                    const first = new Date(calView.getFullYear(), calView.getMonth(), 1);
                    const last = new Date(calView.getFullYear(), calView.getMonth() + 1, 0);
                    const cells: React.ReactNode[] = [];
                    for (let i = 0; i < first.getDay(); i++) cells.push(<div key={`e${i}`} />);
                    for (let d = 1; d <= last.getDate(); d++) {
                      const dt = new Date(calView.getFullYear(), calView.getMonth(), d);
                      const isFrom = calDraft.from && dt.toDateString() === calDraft.from.toDateString();
                      const isTo = calDraft.to && dt.toDateString() === calDraft.to.toDateString();
                      const inRange = calDraft.from && calDraft.to && dt >= calDraft.from && dt <= calDraft.to;
                      const isFuture = dt > today;
                      cells.push(
                        <button key={d} disabled={isFuture} onClick={() => {
                          if (calSel === "from") {
                            setCalDraft({ from: dt, to: null });
                            setCalSel("to");
                          } else {
                            const from = calDraft.from!;
                            const finalFrom = dt < from ? dt : from;
                            const finalTo = dt < from ? from : dt;
                            setCalDraft({ from: finalFrom, to: finalTo });
                            setActivePreset("");
                            setDateRange({ from: finalFrom, to: finalTo });
                            setShowCal(false);
                            setCalSel("from");
                          }
                        }}
                          style={{
                            width: "100%", aspectRatio: "1", border: "none", borderRadius: 8,
                            background: isFrom || isTo ? "rgba(14,165,233,0.3)" : inRange ? "rgba(14,165,233,0.08)" : "transparent",
                            color: isFuture ? "rgba(255,255,255,0.12)" : isFrom || isTo ? "#0ea5e9" : "#fff",
                            fontSize: 11, fontWeight: isFrom || isTo ? 700 : 500, fontFamily: F,
                            cursor: isFuture ? "default" : "pointer",
                            transition: "all 0.1s",
                          }}
                        >
                          {d}
                        </button>
                      );
                    }
                    return cells;
                  })()}
                </div>
                {/* Current range label */}
                <div style={{ marginTop: 10, fontSize: 10, color: "rgba(255,255,255,0.35)", textAlign: "center", fontFamily: F }}>
                  {fmtLabel(dateRange.from, t.date_locale)} — {fmtLabel(dateRange.to, t.date_locale)}
                </div>
              </div>
            )}
          </div>

          {/* Sync button */}
          <button onClick={syncAccount} disabled={!!syncing}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 9, background: syncing ? "rgba(255,255,255,0.04)" : "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)", color: "#38bdf8", fontSize: 12, fontWeight: 600, cursor: syncing ? "default" : "pointer", opacity: syncing ? 0.5 : 1, fontFamily: F, whiteSpace: "nowrap" }}>
            <RefreshCw size={12} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
            {syncing ? t.syncing : t.sync}
          </button>
        </div>
      </div>

      {/* ── Summary cards — horizontal strip ── */}
      {entries.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 18, overflowX: "auto", paddingBottom: 2 }}>
          {/* Win rate */}
          <div style={{ flex: "1 1 0", minWidth: 120, padding: "12px 14px", borderRadius: 12, background: stats.winRate >= 40 ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${stats.winRate >= 40 ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)"}` }}>
            <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.win_rate}</p>
            <p style={{ margin: "4px 0 1px", fontSize: 26, fontWeight: 700, color: stats.winRate >= 40 ? "#2ECECE" : stats.winRate >= 20 ? "#fcd34d" : "#f87171", fontFamily: M, letterSpacing: "-0.04em", lineHeight: 1 }}>{stats.winRate}%</p>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{t.winners_of(stats.winners, entries.length)}</p>
          </div>
          {/* Invested */}
          <div style={{ flex: "1 1 0", minWidth: 100, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.invested}</p>
            <p style={{ margin: "4px 0 1px", fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.7)", fontFamily: M, letterSpacing: "-0.03em", lineHeight: 1 }}>{money(stats.totalSpend, language)}</p>
          </div>
          {/* ROAS */}
          <div style={{ flex: "1 1 0", minWidth: 100, padding: "12px 14px", borderRadius: 12, background: stats.overallRoas && stats.overallRoas >= 1 ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.03)", border: `1px solid ${stats.overallRoas && stats.overallRoas >= 1 ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.06)"}` }}>
            <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{stats.overallRoas ? t.roas_label : t.return_label}</p>
            <p style={{ margin: "4px 0 1px", fontSize: 22, fontWeight: 700, color: stats.overallRoas && stats.overallRoas >= 2 ? "#2ECECE" : stats.overallRoas && stats.overallRoas >= 1 ? "#fcd34d" : "rgba(255,255,255,0.38)", fontFamily: M, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {stats.overallRoas ? `${stats.overallRoas.toFixed(2)}×` : stats.totalReturn > 0 ? money(stats.totalReturn, language) : "—"}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.22)" }}>{stats.overallRoas ? `${money(stats.totalReturn, language)} ${t.return_suffix}` : t.no_conv}</p>
          </div>
        </div>
      )}

      {/* ── Verdict filter tabs — inline, compact ── */}
      {entries.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
          {TABS.filter(tab => tab.count > 0 || tab.key === "all").map(tab => {
            const isActive = filter === tab.key;
            const color = tab.key !== "all" ? V_STYLE[tab.key].bar : undefined;
            return (
              <button key={tab.key} onClick={() => setFilter(tab.key)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, border: "1px solid", whiteSpace: "nowrap", cursor: "pointer", fontFamily: F, fontSize: 12, fontWeight: isActive ? 600 : 400, transition: "all 0.12s", background: isActive ? "rgba(255,255,255,0.06)" : "transparent", borderColor: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)", color: isActive ? "#f0f2f8" : "rgba(255,255,255,0.35)" }}>
                {color && <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />}
                {tab.label}
                <span style={{ fontSize: 10, fontFamily: M, color: isActive ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.18)" }}>{tab.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Error */}
      {syncError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 13px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "#f87171", flex: 1 }}>{syncError}</span>
          <button onClick={() => setSyncError(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 14, padding: 0 }}>✕</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "48px 0", minHeight: 140 }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(14,165,233,0.15)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
        </div>
      )}

      {/* Syncing empty */}
      {!loading && syncing && entries.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px", minHeight: 140 }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(14,165,233,0.15)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0 }}>{t.importing}</p>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginTop: 5 }}>{t.importing_sub}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !syncing && entries.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.07)", minHeight: 140 }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>{t.no_ads}</p>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, margin: "0 0 20px" }}>{t.no_ads_sub}</p>
          <button onClick={syncAccount} style={{ padding: "10px 24px", borderRadius: 9, background: "#0ea5e9", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {t.sync_now}
          </button>
        </div>
      )}

      {/* ── Ad list ── */}
      {!loading && filteredEntries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filteredEntries.map(entry => (
            <DiaryRow key={entry.id} entry={entry} t={t} lang={language}
              expanded={expanded === entry.id}
              onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
            />
          ))}
        </div>
      )}

      {!loading && filteredEntries.length === 0 && entries.length > 0 && (
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14, padding: "40px 0" }}>{t.no_category}</p>
      )}
    </div>
  );
}
