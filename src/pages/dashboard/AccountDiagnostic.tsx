import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, AlertTriangle, TrendingUp, TrendingDown, Shield,
  Pause, Zap, Activity, ChevronDown, ChevronUp, Check, X,
  ArrowRight, RefreshCw, BarChart3, DollarSign, Eye, MousePointerClick,
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
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const F = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const BG = "#07080f";
const CARD_BG = "rgba(255,255,255,0.03)";
const CARD_BORDER = "rgba(255,255,255,0.06)";
const RED = "#ef4444";
const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const BLUE = "#3b82f6";
const MUTED = "rgba(255,255,255,0.4)";

// ═══════════════════════════════════════════════════════════════════════════
// LOADING STEPS
// ═══════════════════════════════════════════════════════════════════════════

const LOADING_STEPS = [
  { label: "Conectando à Meta Ads API...", duration: 1500 },
  { label: "Puxando dados dos últimos 30 dias...", duration: 2000 },
  { label: "Classificando cada anúncio...", duration: 1500 },
  { label: "Calculando desperdício real...", duration: 1000 },
  { label: "Gerando insights com IA...", duration: 2000 },
];

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED COUNTER
// ═══════════════════════════════════════════════════════════════════════════

function useAnimatedNumber(target: number, duration = 2000, enabled = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, enabled]);
  return value;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORE RING
// ═══════════════════════════════════════════════════════════════════════════

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 70 ? GREEN : score >= 40 ? AMBER : RED;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1.5s ease-out" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.3, fontWeight: 800, color: "#fff", fontFamily: F, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>/ 100</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AD ROW (with pause action)
// ═══════════════════════════════════════════════════════════════════════════

function AdRow({
  ad, type, onPause, pausingId,
}: {
  ad: ClassifiedAd;
  type: "pause" | "scale" | "fatigued";
  onPause?: (adId: string) => void;
  pausingId?: string | null;
}) {
  const iconColor = type === "pause" ? RED : type === "scale" ? GREEN : AMBER;
  const Icon = type === "pause" ? AlertTriangle : type === "scale" ? TrendingUp : Activity;
  const isPausing = pausingId === ad.ad_id;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
      background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${iconColor}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} color={iconColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
          {ad.ad_name}
        </p>
        <p style={{ fontSize: 11, color: MUTED, margin: "3px 0 0 0" }}>
          {ad.campaign_name} · R${ad.spend.toFixed(0)} · {ad.reason}
        </p>
      </div>
      {type === "pause" && onPause && (
        <button
          onClick={() => onPause(ad.ad_id)}
          disabled={!!pausingId}
          style={{
            padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: isPausing ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)",
            color: RED, border: `1px solid ${RED}30`, cursor: isPausing ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 4, fontFamily: F,
            transition: "all 0.15s",
          }}
        >
          {isPausing ? <Loader2 size={12} className="animate-spin" /> : <Pause size={12} />}
          {isPausing ? "Pausando..." : "Pausar"}
        </button>
      )}
      {type === "scale" && (
        <div style={{ padding: "4px 10px", borderRadius: 6, background: `${GREEN}15`, border: `1px solid ${GREEN}25` }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: GREEN }}>Escalável</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INSIGHT CARD
// ═══════════════════════════════════════════════════════════════════════════

function InsightCard({ insight }: { insight: DiagnosticInsight }) {
  const color = insight.type === "waste" ? RED : insight.type === "opportunity" ? GREEN : BLUE;
  const Icon = insight.type === "waste" ? AlertTriangle : insight.type === "opportunity" ? TrendingUp : Shield;
  const urgencyColor = insight.urgency === "alta" ? RED : insight.urgency === "media" ? AMBER : MUTED;

  return (
    <div style={{
      padding: 16, borderRadius: 12,
      background: `${color}08`, border: `1px solid ${color}20`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon size={16} color={color} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{insight.title}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, color: urgencyColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {insight.urgency}
        </span>
      </div>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, margin: 0 }}>{insight.description}</p>
      <div style={{ marginTop: 10, padding: "6px 10px", borderRadius: 6, background: `${color}12`, display: "inline-block" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{insight.impact}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK ROW
// ═══════════════════════════════════════════════════════════════════════════

function BenchmarkRow({ label, yours, benchmark, verdict, format }: {
  label: string;
  yours: number;
  benchmark: number;
  verdict: "above" | "below" | "at";
  format: (v: number) => string;
}) {
  const color = verdict === "above" ? GREEN : verdict === "below" ? RED : AMBER;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${CARD_BORDER}` }}>
      <span style={{ fontSize: 13, color: MUTED }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{format(yours)}</span>
        <span style={{ fontSize: 11, color: MUTED }}>vs</span>
        <span style={{ fontSize: 12, color: MUTED }}>{format(benchmark)}</span>
        <div style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
      </div>
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

  // Animated hero number
  const animatedWaste = useAnimatedNumber(data?.wasted_spend || 0, 2500, phase === "reveal" || phase === "done");

  // ── Load diagnostic ─────────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/login"); return; }

        // Get active persona
        const { data: personas } = await supabase
          .from("personas" as any)
          .select("id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const personaId = personas?.[0]?.id || null;

        // Animate loading steps
        for (let i = 0; i < LOADING_STEPS.length; i++) {
          setLoadingStep(i);
          await new Promise(r => setTimeout(r, LOADING_STEPS[i].duration));
        }

        // Call edge function
        const { data: result, error: fnError } = await supabase.functions.invoke("account-diagnostic", {
          body: { user_id: user.id, persona_id: personaId },
        });

        if (fnError) throw new Error(fnError.message);
        if (result?.error) {
          if (result.error === "no_meta_connection") {
            setPhase("empty");
            return;
          }
          throw new Error(result.error);
        }

        setData(result);

        // Check if account has enough data
        if (result.metrics.active_ads < 2 || result.metrics.total_spend < 50) {
          setPhase("empty");
          return;
        }

        // Reveal phase (hero number animation)
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
        .from("personas" as any).select("id").eq("user_id", user!.id).limit(1);

      const { data: result, error } = await supabase.functions.invoke("meta-actions", {
        body: {
          action: "pause",
          user_id: user!.id,
          persona_id: personas?.[0]?.id || null,
          target_id: adId,
          target_type: "ad",
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

  // ── Batch pause all ─────────────────────────────────────────────────
  const handleBatchPause = useCallback(async () => {
    if (!data) return;
    setBatchPausing(true);
    const toPause = data.ads_to_pause.filter(a => !pausedIds.has(a.ad_id));
    for (const ad of toPause) {
      await handlePause(ad.ad_id);
      // Small delay between calls to respect rate limits
      await new Promise(r => setTimeout(r, 500));
    }
    setBatchPausing(false);
  }, [data, pausedIds, handlePause]);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: LOADING
  // ═══════════════════════════════════════════════════════════════════════

  if (phase === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 24px", borderRadius: 14, background: `${BLUE}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 size={24} color={BLUE} className="animate-spin" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 24 }}>Analisando sua conta</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
            {LOADING_STEPS.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: i <= loadingStep ? 1 : 0.3, transition: "opacity 0.4s" }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 10, flexShrink: 0,
                  background: i < loadingStep ? `${GREEN}20` : i === loadingStep ? `${BLUE}20` : "rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {i < loadingStep ? (
                    <Check size={12} color={GREEN} />
                  ) : i === loadingStep ? (
                    <Loader2 size={12} color={BLUE} className="animate-spin" />
                  ) : (
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.15)" }} />
                  )}
                </div>
                <span style={{ fontSize: 13, color: i <= loadingStep ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)" }}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 24, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", background: BLUE, borderRadius: 2,
              width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%`,
              transition: "width 0.8s ease-out",
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
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 20px", borderRadius: 14, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={24} color={RED} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Erro no diagnóstico</h2>
          <p style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>{error}</p>
          <button
            onClick={() => navigate("/dashboard/accounts")}
            style={{ padding: "10px 20px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: F }}
          >
            Voltar para Contas
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: EMPTY (no data / no connection)
  // ═══════════════════════════════════════════════════════════════════════

  if (phase === "empty") {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 20px", borderRadius: 14, background: `${AMBER}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BarChart3 size={24} color={AMBER} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
            {data ? "Dados insuficientes" : "Conecte sua conta Meta Ads"}
          </h2>
          <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 24 }}>
            {data
              ? `Sua conta tem ${data.metrics.active_ads} anúncio(s) e R$${data.metrics.total_spend.toFixed(0)} de spend nos últimos 30 dias. Precisamos de pelo menos 2 anúncios e R$50 de spend para gerar um diagnóstico completo.`
              : "Para gerar seu diagnóstico, conecte uma conta Meta Ads na página de Contas."}
          </p>
          <button
            onClick={() => navigate("/dashboard/accounts")}
            style={{
              padding: "10px 20px", borderRadius: 8, fontFamily: F,
              background: BLUE, color: "#fff", fontSize: 13, fontWeight: 600,
              border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
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

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: F, padding: "24px 16px 80px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* ── Header ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>Diagnóstico da Conta</h1>
            <p style={{ fontSize: 13, color: MUTED, margin: "4px 0 0 0" }}>
              {data.ad_account_name} · Últimos {data.period_days} dias
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, color: MUTED, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontFamily: F }}
          >
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>

        {/* ── Hero: Wasted Spend ───────────────────────────────────── */}
        <div style={{
          padding: "32px 24px", borderRadius: 16, marginBottom: 16,
          background: data.wasted_spend > 0
            ? "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.02) 100%)"
            : "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.02) 100%)",
          border: `1px solid ${data.wasted_spend > 0 ? RED : GREEN}18`,
          textAlign: "center",
        }}>
          {data.wasted_spend > 0 ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
                <AlertTriangle size={16} color={RED} />
                <span style={{ fontSize: 12, fontWeight: 600, color: RED, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Dinheiro desperdiçado este mês
                </span>
              </div>
              <div style={{ fontSize: 52, fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginRight: 4 }}>R$</span>
                {animatedWaste.toLocaleString("pt-BR")}
              </div>
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
                em {data.ads_to_pause.length} anúncio{data.ads_to_pause.length > 1 ? "s" : ""} que deveria{data.ads_to_pause.length > 1 ? "m" : ""} ser pausado{data.ads_to_pause.length > 1 ? "s" : ""}
              </p>
              {data.projected_roas && data.current_roas && data.roas_improvement_pct ? (
                <div style={{ marginTop: 16, padding: "10px 16px", borderRadius: 8, background: "rgba(34,197,94,0.08)", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <TrendingUp size={14} color={GREEN} />
                  <span style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>
                    ROAS projetado: {data.current_roas.toFixed(2)}x → {data.projected_roas.toFixed(2)}x (+{data.roas_improvement_pct.toFixed(0)}%)
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
                <Check size={16} color={GREEN} />
                <span style={{ fontSize: 12, fontWeight: 600, color: GREEN, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Conta saudável
                </span>
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#fff", margin: 0 }}>
                Nenhum anúncio precisa ser pausado agora
              </p>
            </>
          )}
        </div>

        {/* ── Score + Quick Metrics Row ─────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, marginBottom: 16 }}>
          {/* Score Ring */}
          <div style={{
            padding: 20, borderRadius: 14, background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          }}>
            <ScoreRing score={data.score} />
            <span style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>Account Health</span>
          </div>

          {/* Quick metrics grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { icon: DollarSign, label: "Spend total", value: `R$${data.metrics.total_spend.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`, color: "#fff" },
              { icon: MousePointerClick, label: "CTR médio", value: `${(data.metrics.avg_ctr * 100).toFixed(2)}%`, color: data.benchmarks.ctr?.verdict === "above" ? GREEN : data.benchmarks.ctr?.verdict === "below" ? RED : AMBER },
              { icon: Eye, label: "Impressões", value: data.metrics.total_impressions.toLocaleString("pt-BR"), color: "#fff" },
              { icon: Zap, label: "Conversões", value: String(data.metrics.total_conversions), color: data.metrics.total_conversions > 0 ? GREEN : MUTED },
            ].map((m, i) => (
              <div key={i} style={{ padding: "12px 14px", borderRadius: 10, background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <m.icon size={13} color={MUTED} />
                  <span style={{ fontSize: 11, color: MUTED }}>{m.label}</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Score Breakdown ──────────────────────────────────────── */}
        <div style={{ padding: 16, borderRadius: 14, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 12px 0" }}>Score Breakdown</h3>
          {[
            { label: "ROAS", score: data.score_breakdown.roas_score, max: 35 },
            { label: "CPA", score: data.score_breakdown.cpa_score, max: 25 },
            { label: "CTR", score: data.score_breakdown.ctr_score, max: 20 },
            { label: "Budget Efficiency", score: data.score_breakdown.budget_efficiency, max: 10 },
            { label: "Creative Health", score: data.score_breakdown.creative_health, max: 10 },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: MUTED, width: 120 }}>{item.label}</span>
              <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 3,
                  background: (item.score / item.max) >= 0.7 ? GREEN : (item.score / item.max) >= 0.4 ? AMBER : RED,
                  width: `${(item.score / item.max) * 100}%`,
                  transition: "width 1s ease-out",
                }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", width: 45, textAlign: "right" }}>{item.score}/{item.max}</span>
            </div>
          ))}
        </div>

        {/* ── Benchmarks ───────────────────────────────────────────── */}
        <div style={{ padding: 16, borderRadius: 14, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 8px 0" }}>vs Benchmark do Mercado</h3>
          <BenchmarkRow label="CTR" yours={data.benchmarks.ctr.yours} benchmark={data.benchmarks.ctr.benchmark} verdict={data.benchmarks.ctr.verdict} format={v => `${(v * 100).toFixed(2)}%`} />
          <BenchmarkRow label="CPM" yours={data.benchmarks.cpm.yours} benchmark={data.benchmarks.cpm.benchmark} verdict={data.benchmarks.cpm.verdict} format={v => `R$${v.toFixed(2)}`} />
          <BenchmarkRow label="CPC" yours={data.benchmarks.cpc.yours} benchmark={data.benchmarks.cpc.benchmark} verdict={data.benchmarks.cpc.verdict} format={v => `R$${v.toFixed(2)}`} />
          <BenchmarkRow label="Frequência" yours={data.benchmarks.frequency.yours} benchmark={data.benchmarks.frequency.benchmark} verdict={data.benchmarks.frequency.verdict} format={v => `${v.toFixed(1)}x`} />
        </div>

        {/* ── Ads to Pause ─────────────────────────────────────────── */}
        {data.ads_to_pause.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <Pause size={15} color={RED} /> Anúncios para pausar ({unpausedAds.length})
              </h3>
              {unpausedAds.length > 1 && (
                <button
                  onClick={handleBatchPause}
                  disabled={batchPausing || unpausedAds.length === 0}
                  style={{
                    padding: "6px 14px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                    background: `${RED}15`, color: RED, border: `1px solid ${RED}30`,
                    cursor: batchPausing ? "not-allowed" : "pointer", fontFamily: F,
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  {batchPausing ? <Loader2 size={12} className="animate-spin" /> : <Pause size={12} />}
                  Pausar todos
                </button>
              )}
            </div>

            {pausedIds.size > 0 && (
              <div style={{ padding: "8px 12px", borderRadius: 8, background: `${GREEN}10`, border: `1px solid ${GREEN}20`, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Check size={14} color={GREEN} />
                <span style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>
                  {pausedIds.size} pausado{pausedIds.size > 1 ? "s" : ""} — economizando R${savedMoney.toFixed(0)}/mês
                </span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(showAllPause ? data.ads_to_pause : data.ads_to_pause.slice(0, 5))
                .filter(a => !pausedIds.has(a.ad_id))
                .map(ad => (
                  <AdRow key={ad.ad_id} ad={ad} type="pause" onPause={handlePause} pausingId={pausingId} />
                ))}
            </div>
            {data.ads_to_pause.length > 5 && (
              <button
                onClick={() => setShowAllPause(!showAllPause)}
                style={{ marginTop: 8, background: "none", border: "none", color: BLUE, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", gap: 4 }}
              >
                {showAllPause ? <><ChevronUp size={14} /> Mostrar menos</> : <><ChevronDown size={14} /> Ver todos ({data.ads_to_pause.length})</>}
              </button>
            )}
          </div>
        )}

        {/* ── Ads to Scale ─────────────────────────────────────────── */}
        {data.ads_to_scale.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingUp size={15} color={GREEN} /> Anúncios para escalar ({data.ads_to_scale.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(showAllScale ? data.ads_to_scale : data.ads_to_scale.slice(0, 5)).map(ad => (
                <AdRow key={ad.ad_id} ad={ad} type="scale" />
              ))}
            </div>
            {data.ads_to_scale.length > 5 && (
              <button
                onClick={() => setShowAllScale(!showAllScale)}
                style={{ marginTop: 8, background: "none", border: "none", color: BLUE, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", gap: 4 }}
              >
                {showAllScale ? <><ChevronUp size={14} /> Mostrar menos</> : <><ChevronDown size={14} /> Ver todos ({data.ads_to_scale.length})</>}
              </button>
            )}
          </div>
        )}

        {/* ── Fatigued Ads ─────────────────────────────────────────── */}
        {data.ads_fatigued.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: 6 }}>
              <Activity size={15} color={AMBER} /> Em fadiga ({data.ads_fatigued.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.ads_fatigued.slice(0, 5).map(ad => (
                <AdRow key={ad.ad_id} ad={ad} type="fatigued" />
              ))}
            </div>
          </div>
        )}

        {/* ── AI Insights ──────────────────────────────────────────── */}
        {data.insights.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: 6 }}>
              <Zap size={15} color={BLUE} /> Insights da IA
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.insights.map((insight, i) => (
                <InsightCard key={i} insight={insight} />
              ))}
            </div>
          </div>
        )}

        {/* ── CTA Footer ──────────────────────────────────────────── */}
        <div style={{
          padding: 20, borderRadius: 14, marginTop: 24,
          background: "linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 100%)",
          border: `1px solid ${BLUE}18`, textAlign: "center",
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: "0 0 8px 0" }}>
            Quer ir mais fundo?
          </p>
          <p style={{ fontSize: 12, color: MUTED, margin: "0 0 16px 0" }}>
            Converse com a IA sobre seus resultados — ela conhece cada detalhe da sua conta.
          </p>
          <button
            onClick={() => navigate("/dashboard/ai")}
            style={{
              padding: "10px 24px", borderRadius: 8, fontFamily: F,
              background: BLUE, color: "#fff", fontSize: 13, fontWeight: 600,
              border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            Abrir AI Chat <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
