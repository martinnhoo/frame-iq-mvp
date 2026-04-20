import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Trophy, TrendingUp, Zap, AlertTriangle, Flame, Target } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { DESIGN_TOKENS as T } from "@/hooks/useDesignTokens";

// ── Design tokens — from unified design system ──
const F = T.font; // 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif
const MONO = T.mono; // 'Space Grotesk', 'DM Mono', monospace
const HERO = T.font; // hero numbers — clean, not monospace
const A = T.accent; // #0ea5e9
const GREEN = T.green; // #22A3A3
const RED = T.red; // #ef4444
const AMBER = T.amber; // #eab308
const TX = T.textPrimary;
const MT = T.textMuted;

// ── Score engine ──
function calcAdScore(ad: any): { score: number; tier: Tier; badges: Badge[] } {
  const ctr = (ad.ctr || 0) * 100;
  const spend = ad.spend || 0;
  const roas = ad.roas || 0;
  const conv = ad.conversions || 0;
  const freq = ad.frequency || 0;

  // Score 0-100 based on weighted metrics
  let score = 0;
  // CTR weight: 35pts
  if (ctr >= 3) score += 35;
  else if (ctr >= 2) score += 28;
  else if (ctr >= 1.5) score += 22;
  else if (ctr >= 1) score += 15;
  else if (ctr >= 0.5) score += 8;
  else score += 2;

  // ROAS weight: 30pts
  if (roas >= 4) score += 30;
  else if (roas >= 3) score += 25;
  else if (roas >= 2) score += 20;
  else if (roas >= 1) score += 12;
  else score += 3;

  // Conversions weight: 20pts
  if (conv >= 50) score += 20;
  else if (conv >= 20) score += 16;
  else if (conv >= 10) score += 12;
  else if (conv >= 5) score += 8;
  else if (conv >= 1) score += 4;
  else score += 1;

  // Efficiency bonus: 15pts (low freq = good, high spend efficiency)
  if (freq > 0 && freq < 2) score += 15;
  else if (freq < 3) score += 10;
  else if (freq < 4) score += 5;
  else score += 0;

  score = Math.min(100, Math.max(0, score));

  // Tier
  let tier: Tier;
  if (score >= 80) tier = "elite";
  else if (score >= 60) tier = "strong";
  else if (score >= 40) tier = "average";
  else if (score >= 20) tier = "weak";
  else tier = "critical";

  // Badges
  const badges: Badge[] = [];
  if (ctr >= 2.5) badges.push({ label: "CTR Alto", icon: "target", color: GREEN });
  if (roas >= 3) badges.push({ label: "ROAS Top", icon: "trending", color: GREEN });
  if (ctr >= 2 && spend > 50) badges.push({ label: "Escalável", icon: "flame", color: A });
  if (freq > 3.5) badges.push({ label: "Fadiga", icon: "alert", color: RED });
  if (conv >= 20) badges.push({ label: "Conversor", icon: "zap", color: AMBER });

  return { score, tier, badges };
}

type Tier = "elite" | "strong" | "average" | "weak" | "critical";
interface Badge { label: string; icon: string; color: string; }

const TIER_CONFIG: Record<Tier, { label: string; labelPt: string; color: string; bg: string; border: string }> = {
  elite:    { label: "Elite",    labelPt: "Elite",    color: GREEN,  bg: `${GREEN}12`, border: `${GREEN}25` },
  strong:   { label: "Strong",   labelPt: "Forte",    color: A,      bg: `${A}12`,     border: `${A}25`     },
  average:  { label: "Average",  labelPt: "Médio",    color: AMBER,  bg: `${AMBER}12`, border: `${AMBER}25` },
  weak:     { label: "Weak",     labelPt: "Fraco",    color: RED,    bg: `${RED}08`,   border: `${RED}20`   },
  critical: { label: "Critical", labelPt: "Crítico",  color: RED,    bg: `${RED}12`,   border: `${RED}30`   },
};

// ── Percentile engine ──
function calcPercentile(score: number, allScores: number[]): number {
  if (allScores.length === 0) return 0;
  const below = allScores.filter(s => s < score).length;
  return Math.round((below / allScores.length) * 100);
}

// ── Badge icon ──
function BadgeIcon({ icon, size = 10 }: { icon: string; size?: number }) {
  switch (icon) {
    case "target": return <Target size={size} />;
    case "trending": return <TrendingUp size={size} />;
    case "flame": return <Flame size={size} />;
    case "alert": return <AlertTriangle size={size} />;
    case "zap": return <Zap size={size} />;
    default: return <Trophy size={size} />;
  }
}

// ── Score ring ──
function ScoreRing({ score, tier, size = 56 }: { score: number; tier: Tier; size?: number }) {
  const cfg = TIER_CONFIG[tier];
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={cfg.color} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: HERO, fontSize: size * 0.34, fontWeight: 900, color: cfg.color, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" as any,
      }}>
        {score}
      </div>
    </div>
  );
}

// ── Score Detail Panel ──
function ScoreDetail({ ad, pt, onClose }: { ad: any; pt: boolean; onClose: () => void }) {
  const { score, tier, badges } = calcAdScore(ad);
  const cfg = TIER_CONFIG[tier];
  const ctr = ((ad.ctr || 0) * 100).toFixed(2);
  const spend = ad.spend || 0;
  const roas = ad.roas || 0;
  const conv = ad.conversions || 0;
  const freq = ad.frequency || 0;

  // Individual metric scores for breakdown
  const ctrNum = parseFloat(ctr);
  const ctrPct = ctrNum >= 3 ? 100 : ctrNum >= 2 ? 80 : ctrNum >= 1.5 ? 63 : ctrNum >= 1 ? 43 : ctrNum >= 0.5 ? 23 : 6;
  const roasPct = roas >= 4 ? 100 : roas >= 3 ? 83 : roas >= 2 ? 67 : roas >= 1 ? 40 : 10;
  const convPct = conv >= 50 ? 100 : conv >= 20 ? 80 : conv >= 10 ? 60 : conv >= 5 ? 40 : conv >= 1 ? 20 : 5;
  const effPct = freq > 0 && freq < 2 ? 100 : freq < 3 ? 67 : freq < 4 ? 33 : 0;

  const metrics = [
    { label: "CTR", value: `${ctr}%`, pct: ctrPct, weight: "35%", color: A },
    { label: "ROAS", value: roas ? `${roas.toFixed(1)}×` : "—", pct: roasPct, weight: "30%", color: GREEN },
    { label: pt ? "Conversões" : "Conversions", value: String(conv), pct: convPct, weight: "20%", color: AMBER },
    { label: pt ? "Eficiência" : "Efficiency", value: freq ? `${freq.toFixed(1)} freq` : "—", pct: effPct, weight: "15%", color: "#8b5cf6" },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(480px, 92vw)", background: "#0e1014",
        border: `1px solid ${cfg.border}`, borderRadius: 20,
        overflow: "hidden", animation: "fadeUp 0.25s ease both",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <ScoreRing score={score} tier={tier} size={56} />
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TX, fontFamily: F }}>{ad.ad_name || ad.name || "—"}</p>
                <p style={{ margin: "3px 0 0", fontSize: 11, color: MT, fontFamily: F }}>{ad.campaign_name || ad.campaign || ""}</p>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8,
              width: 32, height: 32, cursor: "pointer", color: MT, fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>
        </div>
        {/* Score breakdown */}
        <div style={{ padding: "16px 24px 20px" }}>
          <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, color: MT, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: F }}>
            {pt ? "Breakdown do Score" : "Score Breakdown"}
          </p>
          {metrics.map(m => (
            <div key={m.label} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: TX, fontFamily: F }}>{m.label} <span style={{ fontSize: 10, color: MT }}>({m.weight})</span></span>
                <span style={{ fontSize: 13, fontWeight: 800, color: m.color, fontFamily: HERO, fontVariantNumeric: "tabular-nums" as any }}>{m.value}</span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${m.pct}%`, background: m.color, borderRadius: 2, transition: "width 0.5s ease" }} />
              </div>
            </div>
          ))}
          {/* Badges */}
          {badges.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {badges.map(b => (
                <span key={b.label} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 11, fontWeight: 700, fontFamily: F,
                  color: b.color, background: `${b.color}12`,
                  border: `1px solid ${b.color}20`,
                  borderRadius: 8, padding: "5px 10px",
                }}>
                  <BadgeIcon icon={b.icon} size={11} />
                  {b.label}
                </span>
              ))}
            </div>
          )}
          {/* Quick metrics row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              { label: spend >= 1000 ? `R$${(spend/1000).toFixed(1)}k` : `R$${spend.toFixed(0)}`, sub: pt ? "Gasto" : "Spend" },
              { label: `${ctr}%`, sub: "CTR" },
              { label: roas ? `${roas.toFixed(1)}×` : "—", sub: "ROAS" },
            ].map(m => (
              <div key={m.sub} style={{ textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: TX, fontFamily: HERO, fontVariantNumeric: "tabular-nums" as any }}>{m.label}</p>
                <p style={{ margin: "3px 0 0", fontSize: 9, fontWeight: 700, color: MT, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: F }}>{m.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Ad Card (TikTok style) ──
function AdCard({ ad, allScores, pt, onSelect }: { ad: any; allScores: number[]; pt: boolean; onSelect: () => void }) {
  const { score, tier, badges } = useMemo(() => calcAdScore(ad), [ad]);
  const percentile = useMemo(() => calcPercentile(score, allScores), [score, allScores]);
  const cfg = TIER_CONFIG[tier];
  const ctr = ((ad.ctr || 0) * 100).toFixed(2);

  // Try to get thumbnail from ad data
  const thumb = ad.thumbnail_url || ad.image_url || ad.creative_thumbnail || null;

  return (
    <div
      onClick={onSelect}
      style={{
        background: "linear-gradient(165deg, rgba(13,162,231,0.04), transparent 60%)",
        border: `1px solid ${cfg.border}`,
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.2s ease",
        display: "flex",
        flexDirection: "column",
      }}
      className="ad-score-card"
    >
      {/* Thumbnail area */}
      <div style={{
        height: 180,
        background: thumb ? `url(${thumb}) center/cover` : `linear-gradient(135deg, ${A}12, ${A}04)`,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        {!thumb && (
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `${A}15`, border: `1px solid ${A}25`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={A} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
        {/* Tier badge */}
        <div style={{
          position: "absolute", top: 10, left: 10,
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          borderRadius: 8, padding: "4px 10px",
          display: "flex", alignItems: "center", gap: 5,
          backdropFilter: "blur(8px)",
        }}>
          <Trophy size={10} color={cfg.color} />
          <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, fontFamily: F, letterSpacing: "0.02em" }}>
            {pt ? cfg.labelPt : cfg.label}
          </span>
        </div>
        {/* Score ring */}
        <div style={{ position: "absolute", top: 8, right: 8 }}>
          <ScoreRing score={score} tier={tier} size={48} />
        </div>
        {/* Percentile badge */}
        {percentile > 0 && (
          <div style={{
            position: "absolute", bottom: 10, left: 10,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
            borderRadius: 8, padding: "4px 10px",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <TrendingUp size={10} color={GREEN} />
            <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, fontFamily: F }}>
              Top {100 - percentile}%
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "14px 14px 10px", flex: 1 }}>
        {/* Ad name */}
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 600, color: TX, fontFamily: F,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          lineHeight: 1.3,
        }}>
          {ad.ad_name || ad.name || "—"}
        </p>
        {(ad.campaign_name || ad.campaign) && (
          <p style={{
            margin: "3px 0 0", fontSize: 11, color: MT,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {ad.campaign_name || ad.campaign}
          </p>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 10 }}>
            {badges.map(b => (
              <span key={b.label} style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: 10, fontWeight: 700, fontFamily: F,
                color: b.color, background: `${b.color}12`,
                border: `1px solid ${b.color}20`,
                borderRadius: 6, padding: "3px 7px",
              }}>
                <BadgeIcon icon={b.icon} size={9} />
                {b.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Metrics footer */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        borderTop: `1px solid ${A}10`,
        padding: "10px 14px",
      }}>
        {[
          { label: ad.spend >= 1000 ? `R$${(ad.spend/1000).toFixed(1)}k` : `R$${(ad.spend||0).toFixed(0)}`, sub: pt ? "Gasto" : "Spend" },
          { label: `${ctr}%`, sub: "CTR" },
          { label: ad.roas ? `${ad.roas.toFixed(1)}×` : "—", sub: "ROAS" },
        ].map(m => (
          <div key={m.sub} style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: TX, fontFamily: HERO, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" as any }}>{m.label}</p>
            <p style={{ margin: "3px 0 0", fontSize: 9, fontWeight: 700, color: MT, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: F }}>{m.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sort options ──
type SortKey = "score" | "spend" | "ctr" | "roas";

// ── Main page ──
export default function AdScorePage() {
  usePageTitle("Ad Score");
  const { user, selectedPersona } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const pt = language === "pt";
  const navigate = useNavigate();

  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("score");
  const [filterTier, setFilterTier] = useState<Tier | "all">("all");
  const [selectedAd, setSelectedAd] = useState<any | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !selectedPersona?.id) { setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any).from("ad_diary")
      .select("*").eq("user_id", user.id).eq("persona_id", selectedPersona.id)
      .order("spend", { ascending: false }).limit(200);
    setEntries(data || []);
    setLoading(false);
  }, [user?.id, selectedPersona?.id]);

  useEffect(() => { load(); }, [load]);

  const syncAds = async () => {
    if (!user?.id || !selectedPersona?.id) return;
    setSyncing(true);
    try {
      const { data: res } = await supabase.functions.invoke("live-metrics", {
        body: { user_id: user.id, persona_id: selectedPersona.id, period: "90d" }
      });
      const metaAds: any[] = res?.meta?.top_ads || [];
      if (metaAds.length) {
        const rows = metaAds.map((a: any) => ({
          user_id: user.id, persona_id: selectedPersona.id, platform: "meta",
          ad_id: a.id || a.name || String(Math.random()),
          ad_name: a.name || "Sem nome",
          campaign_name: a.campaign || null, adset_name: a.adset || null,
          status: "active", launched_at: null, paused_at: null, days_running: 0,
          spend: a.spend || 0, impressions: a.impressions || 0, clicks: 0,
          ctr: a.ctr || 0, cpc: a.cpc || 0, conversions: a.conversions || 0,
          conv_value: 0, roas: a.roas || null, frequency: null,
          verdict: "testing", verdict_reason: "",
          peak_ctr: a.ctr || 0, synced_at: new Date().toISOString(),
        }));
        await (supabase as any).from("ad_diary").upsert(rows, { onConflict: "user_id,persona_id,platform,ad_id" });
        await load();
      }
    } catch (e) { console.error(e); }
    setSyncing(false);
  };

  // Compute scores for all ads
  const scored = useMemo(() => {
    return entries.map(ad => ({ ...ad, ...calcAdScore(ad) }));
  }, [entries]);

  const allScores = useMemo(() => scored.map(s => s.score), [scored]);

  // Filter & sort
  const filtered = useMemo(() => {
    let list = filterTier === "all" ? scored : scored.filter(a => a.tier === filterTier);
    switch (sortBy) {
      case "score": return list.sort((a, b) => b.score - a.score);
      case "spend": return list.sort((a, b) => (b.spend || 0) - (a.spend || 0));
      case "ctr":   return list.sort((a, b) => (b.ctr || 0) - (a.ctr || 0));
      case "roas":  return list.sort((a, b) => (b.roas || 0) - (a.roas || 0));
      default: return list;
    }
  }, [scored, filterTier, sortBy]);

  // Stats
  const stats = useMemo(() => {
    if (scored.length === 0) return null;
    const avg = Math.round(scored.reduce((s, a) => s + a.score, 0) / scored.length);
    const elite = scored.filter(a => a.tier === "elite").length;
    const strong = scored.filter(a => a.tier === "strong").length;
    return { avg, elite, strong, total: scored.length };
  }, [scored]);

  return (
    <div style={{ minHeight: "100%", fontFamily: F, padding: "clamp(16px,4vw,28px) clamp(14px,4vw,28px) 100px" }} className="adscore-page">
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .ad-score-card{animation:fadeUp 0.3s ease both}
        .ad-score-card:hover{transform:translateY(-3px);box-shadow:0 12px 40px rgba(13,162,231,0.15)!important;border-color:${A}40!important}
        @media(max-width:768px){
          .adscore-page{padding:14px 14px 80px!important}
          .adscore-grid{grid-template-columns:repeat(2,1fr)!important;gap:10px!important}
          .adscore-stats{grid-template-columns:repeat(2,1fr)!important}
        }
        @media(max-width:480px){
          .adscore-grid{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: TX, letterSpacing: "-0.03em", fontFamily: F }}>
              Ad Score
            </h1>
            <div style={{
              display: "flex", alignItems: "center", gap: 5, padding: "4px 10px",
              borderRadius: 20, background: `${A}10`, border: `1px solid ${A}20`,
            }}>
              <Trophy size={11} color={A} />
              <span style={{ fontSize: 11, fontWeight: 700, color: A, fontFamily: F }}>
                {scored.length} ads
              </span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: MT }}>
            {pt ? "Score de performance de cada criativo" : "Performance score for each creative"}
          </p>
        </div>
        <button onClick={syncAds} disabled={syncing}
          style={{
            display: "flex", alignItems: "center", gap: 7, padding: "8px 16px",
            background: `${A}10`, border: `1px solid ${A}25`, borderRadius: 10,
            color: A, fontSize: 13, fontWeight: 700, cursor: syncing ? "wait" : "pointer",
            fontFamily: F, transition: "all 0.15s",
            opacity: syncing ? 0.6 : 1,
          }}>
          <RefreshCw size={13} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
          {syncing ? (pt ? "Sincronizando..." : "Syncing...") : (pt ? "Sincronizar" : "Sync")}
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="adscore-stats" style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24,
        }}>
          {[
            { label: pt ? "Score Médio" : "Avg Score", value: String(stats.avg), color: A },
            { label: "Elite", value: String(stats.elite), color: GREEN },
            { label: pt ? "Fortes" : "Strong", value: String(stats.strong), color: A },
            { label: "Total", value: String(stats.total), color: MT },
          ].map(s => (
            <div key={s.label} style={{
              background: `${s.color}06`, border: `1px solid ${s.color}15`,
              borderRadius: 12, padding: "12px 14px", textAlign: "center",
            }}>
              <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: s.color, fontFamily: HERO, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>{s.value}</p>
              <p style={{ margin: "4px 0 0", fontSize: 9, fontWeight: 700, color: MT, textTransform: "uppercase", letterSpacing: "0.10em", fontFamily: F }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter + sort bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {/* Tier filters */}
        {(["all", "elite", "strong", "average", "weak", "critical"] as const).map(t => {
          const isActive = filterTier === t;
          const color = t === "all" ? A : TIER_CONFIG[t].color;
          const label = t === "all" ? (pt ? "Todos" : "All") : (pt ? TIER_CONFIG[t].labelPt : TIER_CONFIG[t].label);
          return (
            <button key={t} onClick={() => setFilterTier(t)}
              style={{
                padding: "5px 14px", borderRadius: 8, cursor: "pointer",
                fontFamily: F, fontSize: 11, fontWeight: isActive ? 700 : 500,
                background: isActive ? `${color}15` : "transparent",
                border: `1px solid ${isActive ? color + "40" : A + "12"}`,
                color: isActive ? color : MT,
                transition: "all 0.15s",
              }}>
              {label}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* Sort */}
        {(["score", "spend", "ctr", "roas"] as const).map(s => {
          const isActive = sortBy === s;
          const label = s === "score" ? "Score" : s.toUpperCase();
          return (
            <button key={s} onClick={() => setSortBy(s)}
              style={{
                padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                fontFamily: F, fontSize: 10, fontWeight: isActive ? 700 : 500,
                background: isActive ? `${A}12` : "transparent",
                border: `1px solid ${isActive ? A + "35" : A + "10"}`,
                color: isActive ? A : MT,
                transition: "all 0.15s", letterSpacing: "0.04em",
              }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{
              height: 300, background: `${A}04`, borderRadius: 16, border: `1px solid ${A}08`,
              opacity: 1 - i * 0.1, animation: "fadeUp 0.25s ease both",
            }} />
          ))}
        </div>
      )}

      {/* No persona */}
      {!selectedPersona && !loading && (
        <div style={{ textAlign: "center", padding: "64px 24px", maxWidth: 420, margin: "0 auto" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `${A}10`, border: `1px solid ${A}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <Trophy size={20} color={A} />
          </div>
          <h3 style={{ color: TX, fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>
            {pt ? "Selecione uma conta" : "Select an account"}
          </h3>
          <p style={{ color: MT, fontSize: 13, margin: "0 0 24px", lineHeight: 1.65 }}>
            {pt ? "Conecte Meta Ads para ver o score dos seus criativos." : "Connect Meta Ads to see creative scores."}
          </p>
          <button onClick={() => navigate("/dashboard/accounts")} style={{
            padding: "10px 22px", background: A, color: "#fff", border: "none",
            borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}>
            {pt ? "Conectar conta →" : "Connect account →"}
          </button>
        </div>
      )}

      {/* No ads */}
      {selectedPersona && !loading && entries.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 24px", maxWidth: 420, margin: "0 auto" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `${A}10`, border: `1px solid ${A}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <Trophy size={20} color={A} />
          </div>
          <h3 style={{ color: TX, fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>
            {pt ? "Nenhum ad encontrado" : "No ads found"}
          </h3>
          <p style={{ color: MT, fontSize: 13, margin: "0 0 24px", lineHeight: 1.65 }}>
            {pt ? "Sincronize seus anúncios para gerar o ranking." : "Sync your ads to generate the ranking."}
          </p>
          <button onClick={syncAds} style={{
            padding: "10px 22px", background: A, color: "#fff", border: "none",
            borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}>
            {pt ? "Sincronizar agora" : "Sync now"}
          </button>
        </div>
      )}

      {/* Card grid */}
      {!loading && filtered.length > 0 && (
        <div className="adscore-grid" style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 14,
        }}>
          {filtered.map((ad, i) => (
            <div key={ad.id || ad.ad_id || i}>
              <AdCard ad={ad} allScores={allScores} pt={pt} onSelect={() => setSelectedAd(ad)} />
            </div>
          ))}
        </div>
      )}

      {/* Score detail modal */}
      {selectedAd && <ScoreDetail ad={selectedAd} pt={pt} onClose={() => setSelectedAd(null)} />}
    </div>
  );
}
