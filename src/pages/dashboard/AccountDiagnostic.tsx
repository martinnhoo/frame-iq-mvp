import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, AlertTriangle, TrendingUp, TrendingDown, Shield,
  Pause, Zap, Activity, ChevronDown, ChevronUp, Check, X,
  ArrowRight, RefreshCw, BarChart3, DollarSign, Eye, MousePointerClick,
  Target, Flame, Crown, Sparkles,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ClassifiedAd {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  adset_name: string;
  spend: number;
  impressions: number;
  ctr: number;
  cpc: number;
  conversions: number;
  roas: number | null;
  cpa: number | null;
  frequency: number;
  primary_kpi: string;
  primary_kpi_value: number | null;
  primary_kpi_threshold: number;
  reason: string;
}

interface DiagnosticInsight {
  type: "waste" | "opportunity" | "health";
  title: string;
  description: string;
  impact: string;
  urgency: "alta" | "media" | "baixa";
}

interface DiagnosticData {
  ad_account_id: string;
  ad_account_name: string;
  currency: string;
  period_days: number;
  wasted_spend: number;
  wasted_spend_monthly: number;
  current_roas: number | null;
  projected_roas: number | null;
  roas_improvement_pct: number | null;
  score: number;
  score_breakdown: {
    roas_score: number;
    cpa_score: number;
    ctr_score: number;
    budget_efficiency: number;
    creative_health: number;
  };
  metrics: {
    total_spend: number;
    total_impressions: number;
    total_clicks: number;
    total_conversions: number;
    total_revenue: number;
    avg_ctr: number;
    avg_cpc: number;
    avg_cpm: number;
    avg_frequency: number;
    active_ads: number;
    active_campaigns: number;
  };
  benchmarks: Record<string, { yours: number; benchmark: number; verdict: "above" | "below" | "at" }>;
  ads_to_pause: ClassifiedAd[];
  ads_to_scale: ClassifiedAd[];
  ads_fatigued: ClassifiedAd[];
  top_performers: ClassifiedAd[];
  insights: DiagnosticInsight[];
}

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS — AdBrief DNA
// ═══════════════════════════════════════════════════════════════════════════

const T = {
  font: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
  mono: "'DM Mono', 'SF Mono', 'Fira Code', monospace",
  bg: "#060709",
  card: "rgba(255,255,255,0.035)",
  cardBorder: "rgba(255,255,255,0.06)",
  cardGlass: "rgba(16,18,24,0.65)",
  accent: "#0ea5e9",
  red: "#ef4444",
  green: "#22c55e",
  amber: "#f59e0b",
  white: "#fff",
  muted: "rgba(255,255,255,0.38)",
  dimmer: "rgba(255,255,255,0.22)",
  glow: (color: string, opacity = 0.12) =>
    `radial-gradient(ellipse 60% 40% at 50% 0%, ${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
};

const glass = {
  background: T.cardGlass,
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  border: `1px solid ${T.cardBorder}`,
  borderRadius: 14,
};

const insetLight = {
  boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.04), 0 1px 3px 0 rgba(0,0,0,0.3)",
};

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATIONS
// ═══════════════════════════════════════════════════════════════════════════

const ANIM_CSS = `
@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
@keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes scoreReveal { from { stroke-dashoffset: var(--circ); } }
@keyframes countUp { from { opacity: 0; filter: blur(8px); } to { opacity: 1; filter: blur(0); } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes glowPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
`;

const fadeUp = (delay: number) => ({
  animation: `fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
});

const scaleIn = (delay: number) => ({
  animation: `scaleIn 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
});

// ═══════════════════════════════════════════════════════════════════════════
// LOADING STEPS
// ═══════════════════════════════════════════════════════════════════════════

const LOADING_STEPS = [
  { label: "Conectando à Meta Ads API", icon: "🔗", duration: 1500 },
  { label: "Puxando 30 dias de dados", icon: "📊", duration: 2000 },
  { label: "Classificando cada anúncio", icon: "🏷️", duration: 1500 },
  { label: "Calculando desperdício real", icon: "💰", duration: 1000 },
  { label: "Gerando insights com IA", icon: "✨", duration: 2000 },
];

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED COUNTER
// ═══════════════════════════════════════════════════════════════════════════

function useAnimatedNumber(target: number, duration = 2500, enabled = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled || target === 0) { setValue(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, enabled]);
  return value;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORE RING — Premium with glow
// ═══════════════════════════════════════════════════════════════════════════

function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 70 ? T.green : score >= 40 ? T.amber : T.red;
  const label = score >= 80 ? "Excelente" : score >= 60 ? "Bom" : score >= 40 ? "Regular" : "Crítico";

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {/* Glow behind */}
      <div style={{
        position: "absolute", inset: -12,
        background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
        animation: "glowPulse 3s ease-in-out infinite",
      }} />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "relative" }}>
        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={10} />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 2s cubic-bezier(0.16,1,0.3,1)", filter: `drop-shadow(0 0 8px ${color}60)` }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{
          fontSize: size * 0.28, fontWeight: 900, color: T.white,
          fontFamily: T.mono, lineHeight: 1,
          letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums",
        }}>{score}</span>
        <span style={{ fontSize: 10, color: color, fontWeight: 700, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// METRIC CARD — Glassmorphism KPI
// ═══════════════════════════════════════════════════════════════════════════

function MetricCard({ icon: Icon, label, value, sub, color, delay }: {
  icon: any; label: string; value: string; sub?: string; color: string; delay: number;
}) {
  return (
    <div style={{
      ...glass, ...insetLight, padding: "16px 14px",
      position: "relative", overflow: "hidden",
      ...fadeUp(delay),
    }}>
      {/* Subtle top glow */}
      <div style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: "80%", height: 1,
        background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Icon size={13} color={T.muted} />
        <span style={{ fontSize: 11, color: T.muted, fontWeight: 500 }}>{label}</span>
      </div>
      <span style={{
        fontSize: 20, fontWeight: 800, color,
        fontFamily: T.mono, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums",
        display: "block",
      }}>{value}</span>
      {sub && <span style={{ fontSize: 10, color: T.dimmer, marginTop: 2, display: "block" }}>{sub}</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AD ROW — Premium with glassmorphism
// ═══════════════════════════════════════════════════════════════════════════

function AdRow({
  ad, type, onPause, pausingId, isPaused, delay = 0,
}: {
  ad: ClassifiedAd;
  type: "pause" | "scale" | "fatigued" | "top";
  onPause?: (adId: string) => void;
  pausingId?: string | null;
  isPaused?: boolean;
  delay?: number;
}) {
  const colorMap = { pause: T.red, scale: T.green, fatigued: T.amber, top: T.accent };
  const IconMap = { pause: AlertTriangle, scale: TrendingUp, fatigued: Flame, top: Crown };
  const color = colorMap[type];
  const Icon = IconMap[type];
  const isPausing = pausingId === ad.ad_id;

  if (isPaused) return null;

  // CTR already comes as fraction from backend now
  const ctrDisplay = (ad.ctr * 100).toFixed(2);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
      ...glass, ...insetLight,
      opacity: isPausing ? 0.6 : 1,
      transition: "all 0.2s",
      ...fadeUp(delay),
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: `${color}12`, border: `1px solid ${color}18`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={14} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: T.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
          {ad.ad_name}
        </p>
        <p style={{ fontSize: 11, color: T.muted, margin: "2px 0 0 0", lineHeight: 1.4 }}>
          {ad.campaign_name}
          <span style={{ color: T.dimmer }}> · </span>
          <span style={{ fontFamily: T.mono, fontSize: 10, fontVariantNumeric: "tabular-nums" }}>
            R${ad.spend.toFixed(0)}
          </span>
          <span style={{ color: T.dimmer }}> · </span>
          <span style={{ fontFamily: T.mono, fontSize: 10 }}>CTR {ctrDisplay}%</span>
          {ad.roas !== null && (
            <>
              <span style={{ color: T.dimmer }}> · </span>
              <span style={{ fontFamily: T.mono, fontSize: 10 }}>ROAS {ad.roas.toFixed(1)}x</span>
            </>
          )}
        </p>
        {ad.reason && (
          <p style={{ fontSize: 10, color: color, fontWeight: 500, margin: "3px 0 0 0", opacity: 0.8 }}>
            {ad.reason}
          </p>
        )}
      </div>
      {type === "pause" && onPause && (
        <button
          onClick={() => onPause(ad.ad_id)}
          disabled={!!pausingId}
          style={{
            padding: "6px 14px", borderRadius: 7, fontSize: 11, fontWeight: 600,
            background: `${T.red}12`, color: T.red, border: `1px solid ${T.red}25`,
            cursor: isPausing ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 4, fontFamily: T.font,
            transition: "all 0.15s",
          }}
        >
          {isPausing ? <Loader2 size={12} className="animate-spin" /> : <Pause size={12} />}
          {isPausing ? "..." : "Pausar"}
        </button>
      )}
      {type === "scale" && (
        <div style={{ padding: "4px 10px", borderRadius: 6, background: `${T.green}10`, border: `1px solid ${T.green}18` }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: "0.04em" }}>Escalar</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INSIGHT CARD — Premium glassmorphism
// ═══════════════════════════════════════════════════════════════════════════

function InsightCard({ insight, delay }: { insight: DiagnosticInsight; delay: number }) {
  const colorMap = { waste: T.red, opportunity: T.green, health: T.accent };
  const IconMap = { waste: AlertTriangle, opportunity: TrendingUp, health: Shield };
  const color = colorMap[insight.type];
  const Icon = IconMap[insight.type];
  const urgencyColor = insight.urgency === "alta" ? T.red : insight.urgency === "media" ? T.amber : T.muted;

  return (
    <div style={{
      ...glass, ...insetLight, padding: 18, position: "relative", overflow: "hidden",
      ...fadeUp(delay),
    }}>
      {/* Color accent line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${color}50, transparent)`,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: `${color}12`, border: `1px solid ${color}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={13} color={color} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.white, flex: 1 }}>{insight.title}</span>
        <span style={{
          fontSize: 9, fontWeight: 700, color: urgencyColor,
          textTransform: "uppercase", letterSpacing: "0.08em",
          padding: "3px 8px", borderRadius: 4,
          background: `${urgencyColor}12`,
        }}>
          {insight.urgency}
        </span>
      </div>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, margin: "0 0 12px 0" }}>{insight.description}</p>
      <div style={{
        padding: "6px 12px", borderRadius: 7, display: "inline-flex", alignItems: "center", gap: 6,
        background: `${color}08`, border: `1px solid ${color}15`,
      }}>
        <Sparkles size={11} color={color} />
        <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: T.mono, fontVariantNumeric: "tabular-nums" }}>{insight.impact}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK ROW
// ═══════════════════════════════════════════════════════════════════════════

function BenchmarkRow({ label, yours, benchmark, verdict, format }: {
  label: string; yours: number; benchmark: number; verdict: "above" | "below" | "at"; format: (v: number) => string;
}) {
  const color = verdict === "above" ? T.green : verdict === "below" ? T.red : T.amber;
  const pct = benchmark > 0 ? ((yours - benchmark) / benchmark) * 100 : 0;
  const isGood = verdict === "above";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
      <span style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.white, fontFamily: T.mono, fontVariantNumeric: "tabular-nums" }}>{format(yours)}</span>
        <span style={{ fontSize: 10, color: T.dimmer }}>vs {format(benchmark)}</span>
        <div style={{
          padding: "2px 7px", borderRadius: 4,
          background: `${color}12`, border: `1px solid ${color}18`,
          display: "flex", alignItems: "center", gap: 3,
        }}>
          {isGood ? <TrendingUp size={10} color={color} /> : verdict === "below" ? <TrendingDown size={10} color={color} /> : null}
          <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: T.mono }}>{pct >= 0 ? "+" : ""}{pct.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════════════════════

function SectionHeader({ icon: Icon, color, title, count, delay }: {
  icon: any; color: string; title: string; count?: number; delay: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, ...fadeUp(delay) }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: `${color}12`, border: `1px solid ${color}18`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={13} color={color} />
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.white }}>{title}</span>
      {count !== undefined && (
        <span style={{
          fontSize: 11, fontWeight: 700, color,
          fontFamily: T.mono, padding: "2px 8px", borderRadius: 5,
          background: `${color}10`,
        }}>{count}</span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORE BREAKDOWN BAR
// ═══════════════════════════════════════════════════════════════════════════

function BreakdownBar({ label, score, max, delay }: { label: string; score: number; max: number; delay: number }) {
  const pct = max > 0 ? score / max : 0;
  const color = pct >= 0.7 ? T.green : pct >= 0.4 ? T.amber : T.red;
  const labelTag = pct >= 0.7 ? "Bom" : pct >= 0.4 ? "Regular" : "Baixo";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, ...fadeUp(delay) }}>
      <span style={{ fontSize: 11, color: T.muted, width: 110, fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          width: `${pct * 100}%`,
          transition: "width 1.5s cubic-bezier(0.16,1,0.3,1)",
          boxShadow: `0 0 8px ${color}40`,
        }} />
      </div>
      <span style={{
        fontSize: 11, fontWeight: 700, color: T.white, width: 40, textAlign: "right",
        fontFamily: T.mono, fontVariantNumeric: "tabular-nums",
      }}>{score}/{max}</span>
      <span style={{
        fontSize: 9, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.06em",
        width: 50, textAlign: "right",
      }}>{labelTag}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function AccountDiagnostic() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"loading" | "reveal" | "done" | "error" | "empty">("loading");
  const [loadingStep, setLoadingStep] = useState(0);
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [error, setError] = useState("");
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [pausedIds, setPausedIds] = useState<Set<string>>(new Set());
  const [batchPausing, setBatchPausing] = useState(false);
  const [showAllPause, setShowAllPause] = useState(false);
  const [showAllScale, setShowAllScale] = useState(false);
  const [showAllFatigued, setShowAllFatigued] = useState(false);

  const animatedWaste = useAnimatedNumber(data?.wasted_spend || 0, 2500, phase === "reveal" || phase === "done");
  const animatedScore = useAnimatedNumber(data?.score || 0, 2000, phase === "reveal" || phase === "done");

  // ── Load diagnostic ─────────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/login"); return; }

        const { data: personas } = await supabase
          .from("personas" as any)
          .select("id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const personaId = (personas as any)?.[0]?.id || null;

        for (let i = 0; i < LOADING_STEPS.length; i++) {
          setLoadingStep(i);
          await new Promise(r => setTimeout(r, LOADING_STEPS[i].duration));
        }

        const { data: result, error: fnError } = await supabase.functions.invoke("account-diagnostic", {
          body: { user_id: user.id, persona_id: personaId },
        });

        if (fnError) throw new Error(fnError.message);
        if (result?.error) {
          if (result.error === "no_meta_connection") { setPhase("empty"); return; }
          throw new Error(result.error);
        }

        setData(result);

        if (result.metrics.active_ads < 2 || result.metrics.total_spend < 50) {
          setPhase("empty"); return;
        }

        setPhase("reveal");
        setTimeout(() => setPhase("done"), 3000);
      } catch (e: any) {
        setError(e.message || "Erro ao gerar diagnóstico");
        setPhase("error");
      }
    };
    run();
  }, []);

  // ── Pause single ad ─────────────────────────────────────────────────
  const handlePause = useCallback(async (adId: string) => {
    setPausingId(adId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: personas } = await supabase
        .from("personas" as any).select("id").eq("user_id", user!.id).limit(1) as any;

      const { data: result, error } = await supabase.functions.invoke("meta-actions", {
        body: {
          action: "pause", user_id: user!.id,
          persona_id: personas?.[0]?.id || null,
          target_id: adId, target_type: "ad",
        },
      });

      if (error || result?.error) throw new Error(result?.error || error?.message);
      setPausedIds(prev => new Set([...prev, adId]));
    } catch (e: any) {
      console.error("Pause failed:", e);
    } finally {
      setPausingId(null);
    }
  }, []);

  const handleBatchPause = useCallback(async () => {
    if (!data) return;
    setBatchPausing(true);
    const toPause = data.ads_to_pause.filter(a => !pausedIds.has(a.ad_id));
    for (const ad of toPause) {
      await handlePause(ad.ad_id);
      await new Promise(r => setTimeout(r, 500));
    }
    setBatchPausing(false);
  }, [data, pausedIds, handlePause]);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: LOADING
  // ═══════════════════════════════════════════════════════════════════════

  if (phase === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font }}>
        <style>{ANIM_CSS}</style>
        <div style={{ textAlign: "center", maxWidth: 380, padding: 24 }}>
          {/* Pulsing accent ring */}
          <div style={{
            width: 64, height: 64, margin: "0 auto 28px", borderRadius: 16, position: "relative",
            background: `${T.accent}10`, border: `1px solid ${T.accent}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              position: "absolute", inset: -6, borderRadius: 20,
              border: `2px solid ${T.accent}15`,
              animation: "glowPulse 2s ease-in-out infinite",
            }} />
            <Loader2 size={24} color={T.accent} style={{ animation: "spin 1s linear infinite" }} />
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: T.white, marginBottom: 6, letterSpacing: "-0.02em" }}>
            Analisando sua conta
          </h2>
          <p style={{ fontSize: 12, color: T.dimmer, marginBottom: 28 }}>Isso leva ~15 segundos</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
            {LOADING_STEPS.map((step, i) => {
              const active = i === loadingStep;
              const done = i < loadingStep;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", borderRadius: 10,
                  background: active ? `${T.accent}08` : "transparent",
                  border: active ? `1px solid ${T.accent}15` : "1px solid transparent",
                  opacity: done || active ? 1 : 0.3,
                  transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                    background: done ? `${T.green}15` : active ? `${T.accent}15` : "rgba(255,255,255,0.04)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: `1px solid ${done ? T.green + "25" : active ? T.accent + "25" : "transparent"}`,
                  }}>
                    {done ? (
                      <Check size={12} color={T.green} />
                    ) : active ? (
                      <Loader2 size={12} color={T.accent} style={{ animation: "spin 1s linear infinite" }} />
                    ) : (
                      <div style={{ width: 5, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.15)" }} />
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: active ? T.white : done ? "rgba(255,255,255,0.55)" : T.dimmer, fontWeight: active ? 600 : 400 }}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 24, height: 3, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              background: `linear-gradient(90deg, ${T.accent}80, ${T.accent})`,
              width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%`,
              transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
              boxShadow: `0 0 12px ${T.accent}40`,
            }} />
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: ERROR
  // ═══════════════════════════════════════════════════════════════════════

  if (phase === "error") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font }}>
        <style>{ANIM_CSS}</style>
        <div style={{ textAlign: "center", maxWidth: 400, padding: 24, ...scaleIn(0) }}>
          <div style={{
            width: 56, height: 56, margin: "0 auto 20px", borderRadius: 14,
            background: `${T.red}10`, border: `1px solid ${T.red}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={24} color={T.red} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: T.white, marginBottom: 8 }}>Erro no diagnóstico</h2>
          <div style={{
            ...glass, padding: "10px 14px", marginBottom: 20, textAlign: "left",
          }}>
            <p style={{ fontSize: 11, color: T.red, fontFamily: T.mono, margin: 0, wordBreak: "break-all", lineHeight: 1.5 }}>{error}</p>
          </div>
          <button
            onClick={() => navigate("/dashboard/accounts")}
            style={{
              padding: "10px 20px", borderRadius: 9, fontFamily: T.font,
              ...glass, color: T.white, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            Voltar para Contas
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: EMPTY
  // ═══════════════════════════════════════════════════════════════════════

  if (phase === "empty") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font }}>
        <style>{ANIM_CSS}</style>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24, ...scaleIn(0) }}>
          <div style={{
            width: 56, height: 56, margin: "0 auto 20px", borderRadius: 14,
            background: `${T.amber}10`, border: `1px solid ${T.amber}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <BarChart3 size={24} color={T.amber} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: T.white, marginBottom: 8, letterSpacing: "-0.02em" }}>
            {data ? "Dados insuficientes" : "Conecte sua conta Meta Ads"}
          </h2>
          <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 24 }}>
            {data
              ? `Sua conta tem ${data.metrics.active_ads} anúncio(s) e R$${data.metrics.total_spend.toFixed(0)} de spend nos últimos 30 dias. Precisamos de pelo menos 2 anúncios e R$50 de spend para gerar um diagnóstico completo.`
              : "Para gerar seu diagnóstico, conecte uma conta Meta Ads na página de Contas."}
          </p>
          <button
            onClick={() => navigate("/dashboard/accounts")}
            style={{
              padding: "11px 24px", borderRadius: 9, fontFamily: T.font,
              background: T.accent, color: T.white, fontSize: 13, fontWeight: 700,
              border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              boxShadow: `0 0 20px ${T.accent}30`,
            }}
          >
            {data ? "Voltar" : "Conectar conta"} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: RESULTS
  // ═══════════════════════════════════════════════════════════════════════

  if (!data) return null;

  const unpausedAds = data.ads_to_pause.filter(a => !pausedIds.has(a.ad_id));
  const savedMoney = data.ads_to_pause
    .filter(a => pausedIds.has(a.ad_id))
    .reduce((s, a) => s + a.spend, 0);

  // CTR from backend is now a fraction. avg_ctr is also fraction.
  const ctrDisplay = (data.metrics.avg_ctr * 100).toFixed(2);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.font }}>
      <style>{ANIM_CSS}</style>

      {/* ── Radial glow backdrop ──────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 500, pointerEvents: "none",
        background: data.wasted_spend > 0
          ? `radial-gradient(ellipse 70% 50% at 50% -10%, ${T.red}08 0%, transparent 70%)`
          : `radial-gradient(ellipse 70% 50% at 50% -10%, ${T.green}06 0%, transparent 70%)`,
      }} />

      <div style={{ position: "relative", maxWidth: 700, margin: "0 auto", padding: "28px 20px 80px" }}>

        {/* ── Header ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, ...fadeUp(0) }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: T.white, margin: 0, letterSpacing: "-0.02em" }}>
              Diagnóstico da Conta
            </h1>
            <p style={{ fontSize: 12, color: T.muted, margin: "5px 0 0 0" }}>
              {data.ad_account_name}
              <span style={{ color: T.dimmer }}> · </span>
              Últimos {data.period_days} dias
              <span style={{ color: T.dimmer }}> · </span>
              <span style={{ fontFamily: T.mono, fontSize: 11 }}>{data.metrics.active_ads} ads</span>
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 14px", borderRadius: 8, fontFamily: T.font,
              ...glass, color: T.muted, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
            }}
          >
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>

        {/* ── HERO: Wasted Spend ──────────────────────────────────── */}
        <div style={{
          padding: "36px 28px", borderRadius: 18, marginBottom: 16, position: "relative", overflow: "hidden",
          ...glass, ...insetLight, textAlign: "center",
          ...scaleIn(100),
        }}>
          {/* Glow behind hero */}
          <div style={{
            position: "absolute", top: "-30%", left: "50%", transform: "translateX(-50%)",
            width: "120%", height: "80%", pointerEvents: "none",
            background: data.wasted_spend > 0
              ? `radial-gradient(ellipse, ${T.red}10 0%, transparent 70%)`
              : `radial-gradient(ellipse, ${T.green}08 0%, transparent 70%)`,
          }} />

          {data.wasted_spend > 0 ? (
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 12 }}>
                <AlertTriangle size={14} color={T.red} />
                <span style={{
                  fontSize: 10, fontWeight: 700, color: T.red,
                  textTransform: "uppercase", letterSpacing: "0.1em",
                }}>
                  Dinheiro desperdiçado em 30 dias
                </span>
              </div>
              <div style={{ marginBottom: 10 }}>
                <span style={{
                  fontSize: 22, fontWeight: 600, color: "rgba(255,255,255,0.4)",
                  fontFamily: T.mono, marginRight: 4,
                }}>R$</span>
                <span style={{
                  fontSize: 56, fontWeight: 900, color: T.white,
                  fontFamily: T.mono, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums",
                  animation: "countUp 0.8s ease-out",
                  textShadow: data.wasted_spend > 500 ? `0 0 30px ${T.red}30` : "none",
                }}>{animatedWaste.toLocaleString("pt-BR")}</span>
              </div>
              <p style={{ fontSize: 12, color: T.muted, margin: "0 0 16px 0" }}>
                em <span style={{ color: T.white, fontWeight: 700 }}>{data.ads_to_pause.length}</span> anúncio{data.ads_to_pause.length > 1 ? "s" : ""} que deveria{data.ads_to_pause.length > 1 ? "m" : ""} ser pausado{data.ads_to_pause.length > 1 ? "s" : ""}
              </p>
              {data.projected_roas && data.current_roas && data.roas_improvement_pct ? (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "8px 16px", borderRadius: 9,
                  background: `${T.green}08`, border: `1px solid ${T.green}15`,
                }}>
                  <TrendingUp size={13} color={T.green} />
                  <span style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>
                    ROAS:
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.white, fontFamily: T.mono }}>
                    {data.current_roas.toFixed(2)}x
                  </span>
                  <ArrowRight size={12} color={T.dimmer} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.green, fontFamily: T.mono }}>
                    {data.projected_roas.toFixed(2)}x
                  </span>
                  <span style={{ fontSize: 11, color: T.green, fontFamily: T.mono }}>
                    (+{data.roas_improvement_pct.toFixed(0)}%)
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
                <Check size={16} color={T.green} />
                <span style={{ fontSize: 11, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Conta saudável
                </span>
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: T.white, margin: 0 }}>
                Nenhum anúncio precisa ser pausado agora
              </p>
            </div>
          )}
        </div>

        {/* ── Score + Quick Metrics ────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, marginBottom: 16 }}>
          {/* Score Ring */}
          <div style={{
            ...glass, ...insetLight, padding: "24px 28px",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            position: "relative", overflow: "hidden",
            ...fadeUp(200),
          }}>
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: T.glow(data.score >= 70 ? T.green : data.score >= 40 ? T.amber : T.red, 0.06),
            }} />
            <ScoreRing score={data.score} />
            <span style={{ fontSize: 10, color: T.dimmer, marginTop: 10, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
              Account Health
            </span>
          </div>

          {/* Quick metrics grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <MetricCard
              icon={DollarSign} label="Spend total"
              value={`R$${data.metrics.total_spend.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
              sub={`${data.metrics.active_campaigns} campanhas`}
              color={T.white} delay={250}
            />
            <MetricCard
              icon={MousePointerClick} label="CTR médio"
              value={`${ctrDisplay}%`}
              sub={`vs 1.50% benchmark`}
              color={data.benchmarks.ctr?.verdict === "above" ? T.green : data.benchmarks.ctr?.verdict === "below" ? T.red : T.amber}
              delay={300}
            />
            <MetricCard
              icon={Eye} label="Impressões"
              value={data.metrics.total_impressions >= 1000000
                ? `${(data.metrics.total_impressions / 1000000).toFixed(1)}M`
                : data.metrics.total_impressions >= 1000
                  ? `${(data.metrics.total_impressions / 1000).toFixed(1)}K`
                  : String(data.metrics.total_impressions)}
              sub={`CPM R$${data.metrics.avg_cpm.toFixed(2)}`}
              color={T.white} delay={350}
            />
            <MetricCard
              icon={Target} label="Conversões"
              value={String(data.metrics.total_conversions)}
              sub={data.metrics.total_conversions > 0 && data.metrics.total_spend > 0
                ? `CPA R$${(data.metrics.total_spend / data.metrics.total_conversions).toFixed(0)}`
                : "Sem dados de conversão"}
              color={data.metrics.total_conversions > 0 ? T.green : T.dimmer}
              delay={400}
            />
          </div>
        </div>

        {/* ── Score Breakdown ──────────────────────────────────────── */}
        <div style={{ ...glass, ...insetLight, padding: "18px 18px 12px", marginBottom: 16, ...fadeUp(450) }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Score Breakdown</span>
            <span style={{
              fontSize: 12, fontWeight: 800, color: T.white,
              fontFamily: T.mono, fontVariantNumeric: "tabular-nums",
            }}>{data.score}<span style={{ color: T.dimmer, fontWeight: 500 }}>/100</span></span>
          </div>
          <BreakdownBar label="ROAS" score={data.score_breakdown.roas_score} max={35} delay={500} />
          <BreakdownBar label="CPA" score={data.score_breakdown.cpa_score} max={25} delay={540} />
          <BreakdownBar label="CTR" score={data.score_breakdown.ctr_score} max={20} delay={580} />
          <BreakdownBar label="Eficiência Orçamento" score={data.score_breakdown.budget_efficiency} max={10} delay={620} />
          <BreakdownBar label="Saúde Criativa" score={data.score_breakdown.creative_health} max={10} delay={660} />
        </div>

        {/* ── Benchmarks ───────────────────────────────────────────── */}
        <div style={{ ...glass, ...insetLight, padding: "18px", marginBottom: 16, ...fadeUp(700) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <BarChart3 size={14} color={T.accent} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>vs Benchmark do Mercado</span>
          </div>
          <BenchmarkRow label="CTR" yours={data.benchmarks.ctr.yours} benchmark={data.benchmarks.ctr.benchmark} verdict={data.benchmarks.ctr.verdict} format={v => `${(v * 100).toFixed(2)}%`} />
          <BenchmarkRow label="CPM" yours={data.benchmarks.cpm.yours} benchmark={data.benchmarks.cpm.benchmark} verdict={data.benchmarks.cpm.verdict} format={v => `R$${v.toFixed(2)}`} />
          <BenchmarkRow label="CPC" yours={data.benchmarks.cpc.yours} benchmark={data.benchmarks.cpc.benchmark} verdict={data.benchmarks.cpc.verdict} format={v => `R$${v.toFixed(2)}`} />
          <BenchmarkRow label="Frequência" yours={data.benchmarks.frequency.yours} benchmark={data.benchmarks.frequency.benchmark} verdict={data.benchmarks.frequency.verdict} format={v => `${v.toFixed(1)}x`} />
        </div>

        {/* ── Ads to Pause ─────────────────────────────────────────── */}
        {data.ads_to_pause.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <SectionHeader icon={Pause} color={T.red} title="Anúncios para pausar" count={unpausedAds.length} delay={750} />
              {unpausedAds.length > 1 && (
                <button
                  onClick={handleBatchPause}
                  disabled={batchPausing || unpausedAds.length === 0}
                  style={{
                    padding: "7px 16px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                    background: `${T.red}10`, color: T.red, border: `1px solid ${T.red}20`,
                    cursor: batchPausing ? "not-allowed" : "pointer", fontFamily: T.font,
                    display: "flex", alignItems: "center", gap: 5,
                    boxShadow: `0 0 16px ${T.red}10`,
                    ...fadeUp(760),
                  }}
                >
                  {batchPausing ? <Loader2 size={12} className="animate-spin" /> : <Pause size={12} />}
                  Pausar todos
                </button>
              )}
            </div>

            {pausedIds.size > 0 && (
              <div style={{
                ...glass, padding: "10px 14px", marginBottom: 10,
                border: `1px solid ${T.green}20`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Check size={14} color={T.green} />
                <span style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>
                  {pausedIds.size} pausado{pausedIds.size > 1 ? "s" : ""}
                </span>
                <span style={{ fontSize: 12, color: T.dimmer }}>—</span>
                <span style={{ fontSize: 12, color: T.white, fontWeight: 700, fontFamily: T.mono }}>
                  R${savedMoney.toFixed(0)}/mês economizados
                </span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(showAllPause ? data.ads_to_pause : data.ads_to_pause.slice(0, 5)).map((ad, i) => (
                <AdRow key={ad.ad_id} ad={ad} type="pause" onPause={handlePause} pausingId={pausingId} isPaused={pausedIds.has(ad.ad_id)} delay={780 + i * 40} />
              ))}
            </div>
            {data.ads_to_pause.length > 5 && (
              <button
                onClick={() => setShowAllPause(!showAllPause)}
                style={{ marginTop: 10, background: "none", border: "none", color: T.accent, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: T.font, display: "flex", alignItems: "center", gap: 4 }}
              >
                {showAllPause ? <><ChevronUp size={13} /> Mostrar menos</> : <><ChevronDown size={13} /> Ver todos ({data.ads_to_pause.length})</>}
              </button>
            )}
          </div>
        )}

        {/* ── Ads to Scale ─────────────────────────────────────────── */}
        {data.ads_to_scale.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionHeader icon={TrendingUp} color={T.green} title="Anúncios para escalar" count={data.ads_to_scale.length} delay={900} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(showAllScale ? data.ads_to_scale : data.ads_to_scale.slice(0, 5)).map((ad, i) => (
                <AdRow key={ad.ad_id} ad={ad} type="scale" delay={920 + i * 40} />
              ))}
            </div>
            {data.ads_to_scale.length > 5 && (
              <button
                onClick={() => setShowAllScale(!showAllScale)}
                style={{ marginTop: 10, background: "none", border: "none", color: T.accent, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: T.font, display: "flex", alignItems: "center", gap: 4 }}
              >
                {showAllScale ? <><ChevronUp size={13} /> Mostrar menos</> : <><ChevronDown size={13} /> Ver todos ({data.ads_to_scale.length})</>}
              </button>
            )}
          </div>
        )}

        {/* ── Fatigued Ads ─────────────────────────────────────────── */}
        {data.ads_fatigued.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionHeader icon={Flame} color={T.amber} title="Em fadiga criativa" count={data.ads_fatigued.length} delay={1000} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(showAllFatigued ? data.ads_fatigued : data.ads_fatigued.slice(0, 4)).map((ad, i) => (
                <AdRow key={ad.ad_id} ad={ad} type="fatigued" delay={1020 + i * 40} />
              ))}
            </div>
            {data.ads_fatigued.length > 4 && (
              <button
                onClick={() => setShowAllFatigued(!showAllFatigued)}
                style={{ marginTop: 10, background: "none", border: "none", color: T.accent, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: T.font, display: "flex", alignItems: "center", gap: 4 }}
              >
                {showAllFatigued ? <><ChevronUp size={13} /> Mostrar menos</> : <><ChevronDown size={13} /> Ver todos ({data.ads_fatigued.length})</>}
              </button>
            )}
          </div>
        )}

        {/* ── Top Performers ───────────────────────────────────────── */}
        {data.top_performers.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionHeader icon={Crown} color={T.accent} title="Top performers" count={data.top_performers.length} delay={1100} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.top_performers.slice(0, 5).map((ad, i) => (
                <AdRow key={ad.ad_id} ad={ad} type="top" delay={1120 + i * 40} />
              ))}
            </div>
          </div>
        )}

        {/* ── AI Insights ──────────────────────────────────────────── */}
        {data.insights.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionHeader icon={Sparkles} color={T.accent} title="Insights da IA" delay={1200} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.insights.map((insight, i) => (
                <InsightCard key={i} insight={insight} delay={1220 + i * 80} />
              ))}
            </div>
          </div>
        )}

        {/* ── CTA Footer ──────────────────────────────────────────── */}
        <div style={{
          padding: "28px 24px", borderRadius: 16, marginTop: 32,
          ...glass, ...insetLight, textAlign: "center",
          position: "relative", overflow: "hidden",
          ...fadeUp(1400),
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 1,
            background: `linear-gradient(90deg, transparent, ${T.accent}40, transparent)`,
          }} />
          <div style={{
            position: "absolute", top: "-50%", left: "50%", transform: "translateX(-50%)",
            width: "100%", height: "100%", pointerEvents: "none",
            background: `radial-gradient(ellipse 60% 50% at 50% 0%, ${T.accent}06 0%, transparent 70%)`,
          }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: T.white, margin: "0 0 6px 0", position: "relative" }}>
            Quer ir mais fundo?
          </p>
          <p style={{ fontSize: 12, color: T.muted, margin: "0 0 18px 0", position: "relative" }}>
            Converse com a IA sobre seus resultados — ela conhece cada detalhe da sua conta.
          </p>
          <button
            onClick={() => navigate("/dashboard/ai")}
            style={{
              padding: "11px 28px", borderRadius: 9, fontFamily: T.font,
              background: T.accent, color: T.white, fontSize: 13, fontWeight: 700,
              border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              boxShadow: `0 0 24px ${T.accent}30`,
              position: "relative",
            }}
          >
            Abrir AI Chat <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
