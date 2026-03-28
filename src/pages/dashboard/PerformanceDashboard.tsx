// PerformanceDashboard v1 — Inspired by runads.ai clarity, built on AdBrief dark design system
// Real data from daily_snapshots + Meta Ads API
import { useEffect, useState, useMemo, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, ExternalLink,
  DollarSign, MousePointer, Target, Eye, Zap, ChevronUp, ChevronDown,
  BarChart3, AlertCircle, Rocket, ArrowUpRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Snapshot {
  id: string;
  date: string;
  persona_id: string | null;
  account_name: string | null;
  total_spend: number;
  avg_ctr: number;
  total_clicks: number;
  active_ads: number;
  winners_count: number;
  losers_count: number;
  yesterday_spend: number;
  yesterday_ctr: number;
  top_ads: any[];
  ai_insight: string | null;
  raw_period: any;
}

type Period = "7d" | "14d" | "30d";

// ── Design tokens ─────────────────────────────────────────────────────────────
const F    = "'DM Sans', 'Plus Jakarta Sans', system-ui, sans-serif";
const BG   = "#0e1118";
const S1   = "#141824";  // card background
const S2   = "#1a2135";  // deeper surface
const BD   = "rgba(255,255,255,0.07)";
const TEXT = "#eef0f6";
const MUTED = "rgba(255,255,255,0.40)";
const ACCENT = "#0ea5e9";
const GREEN  = "#22c55e";
const RED    = "#ef4444";
const AMBER  = "#f59e0b";

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data, color, fill = false }: { data: number[]; color: string; fill?: boolean }) {
  if (!data || data.length < 2) return null;
  const w = 80, h = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const pathD = `M ${pts.join(" L ")}`;
  const areaD = `M 0,${h} L ${pathD.slice(2)} L ${w},${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      {fill && <path d={areaD} fill={`${color}20`} />}
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Area chart ────────────────────────────────────────────────────────────────
function AreaChart({ snapshots }: { snapshots: Snapshot[] }) {
  if (!snapshots.length) return null;

  const W = 800, H = 200, PAD = { top: 16, right: 16, bottom: 32, left: 56 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const spends = sorted.map(s => s.total_spend);
  const ctrs   = sorted.map(s => s.avg_ctr * 100);

  const maxSpend = Math.max(...spends, 1);
  const maxCtr   = Math.max(...ctrs, 0.01);

  const spendPts = sorted.map((_, i) => {
    const x = PAD.left + (i / (sorted.length - 1 || 1)) * innerW;
    const y = PAD.top + innerH - (spends[i] / maxSpend) * innerH;
    return [x, y];
  });

  const ctrPts = sorted.map((_, i) => {
    const x = PAD.left + (i / (sorted.length - 1 || 1)) * innerW;
    const y = PAD.top + innerH - (ctrs[i] / maxCtr) * innerH;
    return [x, y];
  });

  const spendPath = spendPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
  const ctrPath   = ctrPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");

  const spendArea = `${spendPath} L ${spendPts[spendPts.length - 1][0]} ${PAD.top + innerH} L ${PAD.left} ${PAD.top + innerH} Z`;
  const ctrArea   = `${ctrPath} L ${ctrPts[ctrPts.length - 1][0]} ${PAD.top + innerH} L ${PAD.left} ${PAD.top + innerH} Z`;

  const labelDates = sorted
    .filter((_, i) => i === 0 || i === Math.floor(sorted.length / 2) || i === sorted.length - 1)
    .map((s, idx, arr) => {
      const origIdx = sorted.indexOf(s);
      const x = PAD.left + (origIdx / (sorted.length - 1 || 1)) * innerW;
      const d = new Date(s.date);
      return { x, label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) };
    });

  const spendTicks = [0, maxSpend / 2, maxSpend].map(v => ({
    y: PAD.top + innerH - (v / maxSpend) * innerH,
    label: v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v.toFixed(0)}`,
  }));

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.25" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="ctrGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GREEN} stopOpacity="0.2" />
          <stop offset="100%" stopColor={GREEN} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {spendTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
            stroke={BD} strokeWidth={1} strokeDasharray="4,4" />
          <text x={PAD.left - 8} y={t.y + 4} textAnchor="end"
            style={{ fontSize: 10, fill: MUTED, fontFamily: F }}>{t.label}</text>
        </g>
      ))}

      {/* Area fills */}
      {sorted.length > 1 && (
        <>
          <path d={spendArea} fill="url(#spendGrad)" />
          <path d={ctrArea} fill="url(#ctrGrad)" />
        </>
      )}

      {/* Lines */}
      {sorted.length > 1 && (
        <>
          <path d={spendPath} fill="none" stroke={ACCENT} strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round" />
          <path d={ctrPath} fill="none" stroke={GREEN} strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}

      {/* Dots */}
      {spendPts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={ACCENT} stroke={S1} strokeWidth={2} />
      ))}

      {/* Date labels */}
      {labelDates.map((d, i) => (
        <text key={i} x={d.x} y={H - 6} textAnchor="middle"
          style={{ fontSize: 10, fill: MUTED, fontFamily: F }}>{d.label}</text>
      ))}
    </svg>
  );
}

// ── Delta badge ───────────────────────────────────────────────────────────────
function Delta({ value, suffix = "%" }: { value: number | null; suffix?: string }) {
  if (value === null || isNaN(value)) return <span style={{ color: MUTED, fontSize: 12 }}>—</span>;
  const up = value >= 0;
  const Icon = up ? ChevronUp : ChevronDown;
  const color = up ? GREEN : RED;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12, fontWeight: 600, color }}>
      <Icon size={12} />
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({
  label, value, delta, suffix, prefix, sparkData, accent, icon: Icon
}: {
  label: string; value: string; delta?: number | null;
  suffix?: string; prefix?: string; sparkData?: number[];
  accent?: string; icon?: any;
}) {
  const c = accent || ACCENT;
  return (
    <div style={{
      background: S1, border: `1px solid ${BD}`, borderRadius: 16,
      padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12,
      transition: "border-color 0.2s",
      position: "relative", overflow: "hidden",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${c}40`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BD; }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {Icon && (
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `${c}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={14} color={c} />
            </div>
          )}
          <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
        </div>
        {sparkData && <Sparkline data={sparkData} color={c} />}
      </div>

      {/* Value */}
      <div>
        <div style={{ fontSize: 32, fontWeight: 800, color: TEXT, letterSpacing: "-0.03em", lineHeight: 1 }}>
          {prefix}<span>{value}</span>{suffix && <span style={{ fontSize: 18, fontWeight: 600, color: MUTED, marginLeft: 2 }}>{suffix}</span>}
        </div>
        {delta !== undefined && delta !== null && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <Delta value={delta} />
            <span style={{ fontSize: 12, color: MUTED }}>vs período anterior</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ad row ───────────────────────────────────────────────────────────────────
function AdRow({ ad, rank }: { ad: any; rank: number }) {
  const ctr = (ad.ctr || 0) * 100;
  const isWinner = ad.isScalable || ctr > 2;
  const isPauser = ad.needsPause || ctr < 0.3;
  const badge = isWinner
    ? { label: "↑ Escalar", color: GREEN, bg: "rgba(34,197,94,0.1)" }
    : isPauser
    ? { label: "⏸ Pausar", color: RED, bg: "rgba(239,68,68,0.1)" }
    : null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "14px 0", borderBottom: `1px solid ${BD}`,
    }}>
      <span style={{ width: 20, fontSize: 12, color: MUTED, fontWeight: 600, flexShrink: 0 }}>{rank}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {ad.name || "—"}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: MUTED }}>{ad.campaign || ""}</p>
      </div>
      <div style={{ display: "flex", gap: 24, flexShrink: 0 }}>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT }}>R${(ad.spend || 0).toFixed(0)}</p>
          <p style={{ margin: 0, fontSize: 10, color: MUTED }}>Spend</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: ctr > 2 ? GREEN : ctr < 0.5 ? RED : TEXT }}>{ctr.toFixed(2)}%</p>
          <p style={{ margin: 0, fontSize: 10, color: MUTED }}>CTR</p>
        </div>
        {ad.roas && (
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: ad.roas > 2 ? GREEN : TEXT }}>{ad.roas.toFixed(1)}×</p>
            <p style={{ margin: 0, fontSize: 10, color: MUTED }}>ROAS</p>
          </div>
        )}
        {badge && (
          <span style={{ fontSize: 11, fontWeight: 700, color: badge.color, background: badge.bg, borderRadius: 6, padding: "3px 8px", alignSelf: "center", whiteSpace: "nowrap" }}>
            {badge.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PerformanceDashboard() {
  const { user, selectedPersona } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("7d");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showSpinner = false) => {
    if (!user || !selectedPersona) return;
    if (showSpinner) setRefreshing(true);
    else setLoading(true);

    const days = period === "7d" ? 7 : period === "14d" ? 14 : 30;
    const since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];

    const { data } = await (supabase as any)
      .from("daily_snapshots")
      .select("*")
      .eq("user_id", user.id)
      .eq("persona_id", selectedPersona.id)
      .gte("date", since)
      .order("date", { ascending: false });

    setSnapshots((data || []) as Snapshot[]);
    setLoading(false);
    setRefreshing(false);
  }, [user, selectedPersona, period]);

  useEffect(() => { load(); }, [load]);

  // ── Aggregated metrics ────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!snapshots.length) return null;
    const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0];
    const half = Math.floor(sorted.length / 2);
    const current = sorted.slice(0, half);
    const previous = sorted.slice(half);

    const sum = (arr: Snapshot[], k: keyof Snapshot) =>
      arr.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const avg = (arr: Snapshot[], k: keyof Snapshot) =>
      arr.length ? sum(arr, k) / arr.length : 0;

    const deltaRatio = (cur: number, prev: number) =>
      prev > 0 ? ((cur - prev) / prev) * 100 : null;

    const curSpend  = sum(current, "total_spend");
    const prevSpend = sum(previous, "total_spend");
    const curCtr    = avg(current, "avg_ctr");
    const prevCtr   = avg(previous, "avg_ctr");
    const curClicks = sum(current, "total_clicks");
    const prevClicks = sum(previous, "total_clicks");

    // All top_ads from all snapshots combined → deduplicated by ad id
    const allAds: Record<string, any> = {};
    for (const snap of sorted) {
      for (const ad of (snap.top_ads || [])) {
        if (!allAds[ad.id] || allAds[ad.id].spend < ad.spend) allAds[ad.id] = ad;
      }
    }
    const topAds = Object.values(allAds)
      .sort((a, b) => (b.spend || 0) - (a.spend || 0))
      .slice(0, 8);

    return {
      totalSpend: sum(sorted, "total_spend"),
      totalClicks: sum(sorted, "total_clicks"),
      avgCtr: avg(sorted, "avg_ctr"),
      activeAds: latest?.active_ads || 0,
      winners: latest?.winners_count || 0,
      losers: latest?.losers_count || 0,
      aiInsight: latest?.ai_insight || null,
      deltaSpend: deltaRatio(curSpend, prevSpend),
      deltaCtr: deltaRatio(curCtr, prevCtr),
      deltaClicks: deltaRatio(curClicks, prevClicks),
      sparkSpend: sorted.map(s => s.total_spend).reverse(),
      sparkCtr:   sorted.map(s => s.avg_ctr * 100).reverse(),
      sparkClicks: sorted.map(s => s.total_clicks).reverse(),
      topAds,
    };
  }, [snapshots]);

  const noData = !loading && !snapshots.length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100%", background: BG, fontFamily: F, padding: "28px 32px 48px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .perf-period-btn { background: transparent; border: 1px solid ${BD}; color: ${MUTED}; borderRadius: 8px; padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: ${F}; }
        .perf-period-btn.active { background: ${ACCENT}; border-color: ${ACCENT}; color: #fff; }
        .perf-period-btn:hover:not(.active) { border-color: rgba(255,255,255,0.2); color: ${TEXT}; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: TEXT }}>
              {selectedPersona?.name || "Sua conta"}
            </h1>
            {metrics && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: GREEN, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "3px 10px" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN }} />
                Live
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 14, color: MUTED }}>Dashboard de performance · Meta Ads</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Period toggle */}
          <div style={{ display: "flex", gap: 4, background: S1, border: `1px solid ${BD}`, borderRadius: 10, padding: 4 }}>
            {(["7d", "14d", "30d"] as Period[]).map(p => (
              <button key={p} className={`perf-period-btn${period === p ? " active" : ""}`}
                onClick={() => setPeriod(p)}>
                {p === "7d" ? "7D" : p === "14d" ? "14D" : "30D"}
              </button>
            ))}
          </div>

          <button onClick={() => load(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: S1, border: `1px solid ${BD}`, borderRadius: 10, color: TEXT, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: F }}>
            <RefreshCw size={14} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            Atualizar
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

          <button onClick={() => navigate("/dashboard/campaigns/new")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "linear-gradient(135deg,#0ea5e9,#0891b2)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F }}>
            <Rocket size={14} /> Nova campanha
          </button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {noData && (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <h3 style={{ color: TEXT, fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Nenhum dado ainda</h3>
          <p style={{ color: MUTED, fontSize: 14, margin: "0 0 24px" }}>Conecte sua conta Meta Ads e aguarde o relatório diário das 11h UTC.</p>
          <button onClick={() => navigate("/dashboard/accounts")}
            style={{ padding: "10px 20px", background: ACCENT, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: F }}>
            Conectar Meta Ads
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{ height: i < 4 ? 120 : 100, background: S1, borderRadius: 16, animation: "pulse 1.5s ease-in-out infinite", border: `1px solid ${BD}` }} />
          ))}
          <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`}</style>
        </div>
      )}

      {/* ── Metrics grid ── */}
      {!loading && metrics && (
        <>
          {/* AI Insight banner */}
          {metrics.aiInsight && (
            <div style={{ display: "flex", gap: 12, padding: "14px 20px", background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)", borderRadius: 14, marginBottom: 24, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(14,165,233,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Zap size={14} color={ACCENT} />
              </div>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.07em" }}>Insight do dia</p>
                <p style={{ margin: 0, fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{metrics.aiInsight}</p>
              </div>
            </div>
          )}

          {/* Top row — 4 big metrics like runads.ai */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
            <MetricCard
              label="Ad Spend"
              value={metrics.totalSpend >= 1000
                ? `${(metrics.totalSpend / 1000).toFixed(1)}k`
                : metrics.totalSpend.toFixed(0)}
              prefix="R$"
              delta={metrics.deltaSpend}
              sparkData={metrics.sparkSpend}
              accent={ACCENT}
              icon={DollarSign}
            />
            <MetricCard
              label="CTR Médio"
              value={(metrics.avgCtr * 100).toFixed(2)}
              suffix="%"
              delta={metrics.deltaCtr}
              sparkData={metrics.sparkCtr}
              accent={GREEN}
              icon={MousePointer}
            />
            <MetricCard
              label="Cliques"
              value={metrics.totalClicks >= 1000
                ? `${(metrics.totalClicks / 1000).toFixed(1)}k`
                : String(metrics.totalClicks)}
              delta={metrics.deltaClicks}
              sparkData={metrics.sparkClicks}
              accent="#a78bfa"
              icon={Target}
            />
            <MetricCard
              label="Anúncios Ativos"
              value={String(metrics.activeAds)}
              accent={AMBER}
              icon={Eye}
            />
          </div>

          {/* Second row — winners/losers + quick stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div style={{ background: S1, border: `1px solid rgba(34,197,94,0.2)`, borderRadius: 16, padding: "20px 24px" }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em" }}>Para Escalar</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 40, fontWeight: 800, color: GREEN, letterSpacing: "-0.03em" }}>{metrics.winners}</span>
                <span style={{ fontSize: 14, color: MUTED }}>anúncios</span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED }}>Acima do threshold de performance</p>
            </div>

            <div style={{ background: S1, border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 16, padding: "20px 24px" }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em" }}>Para Pausar</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 40, fontWeight: 800, color: RED, letterSpacing: "-0.03em" }}>{metrics.losers}</span>
                <span style={{ fontSize: 14, color: MUTED }}>anúncios</span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED }}>Spend alto, conversão baixa</p>
            </div>

            <div style={{ background: S1, border: `1px solid ${BD}`, borderRadius: 16, padding: "20px 24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em" }}>Ações rápidas</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={() => navigate("/dashboard/campaigns/new")}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)", borderRadius: 10, color: ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: F, textAlign: "left" }}>
                  <Rocket size={13} /> Criar campanha
                </button>
                <button onClick={() => navigate("/dashboard/hooks")}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 10, color: "#a78bfa", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: F, textAlign: "left" }}>
                  <Zap size={13} /> Gerar hooks
                </button>
              </div>
            </div>
          </div>

          {/* Trend chart */}
          {snapshots.length > 1 && (
            <div style={{ background: S1, border: `1px solid ${BD}`, borderRadius: 16, padding: "24px", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>Tendência de Performance</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>Spend e CTR ao longo do período</p>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 24, height: 2, background: ACCENT, borderRadius: 1 }} />
                    <span style={{ fontSize: 12, color: MUTED }}>Spend</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 24, height: 2, background: GREEN, borderRadius: 1 }} />
                    <span style={{ fontSize: 12, color: MUTED }}>CTR</span>
                  </div>
                </div>
              </div>
              <AreaChart snapshots={[...snapshots].sort((a, b) => a.date.localeCompare(b.date))} />
            </div>
          )}

          {/* Top ads table */}
          {metrics.topAds.length > 0 && (
            <div style={{ background: S1, border: `1px solid ${BD}`, borderRadius: 16, padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>Top anúncios</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>Ordenados por spend — período selecionado</p>
                </div>
                <button onClick={() => navigate("/dashboard/ai")}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", background: "transparent", border: `1px solid ${BD}`, borderRadius: 8, color: MUTED, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: F }}>
                  Analisar com IA <ArrowUpRight size={12} />
                </button>
              </div>

              {/* Table header */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 0 10px 28px", borderBottom: `1px solid ${BD}`, marginTop: 16 }}>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Anúncio</span>
                <div style={{ display: "flex", gap: 24, flexShrink: 0 }}>
                  {["Spend", "CTR", "ROAS", "Status"].map(h => (
                    <span key={h} style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", width: h === "Status" ? 80 : 60, textAlign: "right" }}>{h}</span>
                  ))}
                </div>
              </div>

              {metrics.topAds.map((ad, i) => (
                <AdRow key={ad.id || i} ad={ad} rank={i + 1} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
