import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, AlertTriangle, TrendingUp, TrendingDown, Shield,
  Pause, Zap, Activity, ChevronDown, ChevronUp, Check, X,
  ArrowRight, RefreshCw, BarChart3, DollarSign, Eye, MousePointerClick,
  Target, Flame, Crown, Sparkles, HelpCircle, Play, CheckCircle2,
  XCircle, ChevronRight, SkipForward,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ClassifiedAd {
  ad_id: string; ad_name: string; campaign_name: string; adset_name: string;
  spend: number; impressions: number; ctr: number; cpc: number; conversions: number;
  roas: number | null; cpa: number | null; frequency: number;
  primary_kpi: string; primary_kpi_value: number | null; primary_kpi_threshold: number;
  reason: string;
}

interface DiagnosticInsight {
  type: "waste" | "opportunity" | "health"; title: string; description: string;
  impact: string; urgency: "alta" | "media" | "baixa";
}

interface DiagnosticData {
  ad_account_id: string; ad_account_name: string; currency: string; period_days: number;
  wasted_spend: number; wasted_spend_monthly: number;
  current_roas: number | null; projected_roas: number | null; roas_improvement_pct: number | null;
  score: number;
  score_breakdown: { roas_score: number; cpa_score: number; ctr_score: number; budget_efficiency: number; creative_health: number; };
  metrics: { total_spend: number; total_impressions: number; total_clicks: number; total_conversions: number; total_revenue: number; avg_ctr: number; avg_cpc: number; avg_cpm: number; avg_frequency: number; active_ads: number; active_campaigns: number; };
  benchmarks: Record<string, { yours: number; benchmark: number; verdict: "above" | "below" | "at" }>;
  ads_to_pause: ClassifiedAd[]; ads_to_scale: ClassifiedAd[];
  ads_fatigued: ClassifiedAd[]; top_performers: ClassifiedAd[];
  insights: DiagnosticInsight[];
}

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS — from AdBrief live CSS vars
// ═══════════════════════════════════════════════════════════════════════════

const T = {
  font: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
  mono: "'Space Grotesk', 'DM Mono', monospace",
  display: "'Syne', 'Plus Jakarta Sans', system-ui, sans-serif",
  surface0: "#070d1a", surface1: "#0d1117", surface2: "#111620", surface3: "#161c2a",
  accent: "#0ea5e9", accentGlow: "rgba(14,165,233,.1)",
  red: "#ef4444", green: "#22c55e", amber: "#eab308",
  textPrimary: "#f0f2f8", textSecondary: "rgba(255,255,255,.65)", textMuted: "rgba(255,255,255,.45)",
  borderSubtle: "rgba(255,255,255,.04)", borderLight: "rgba(255,255,255,.08)", borderTopLight: "rgba(255,255,255,.12)",
  r: 12,
};

const card = (level: 1 | 2 | 3 = 1): React.CSSProperties => ({
  background: level === 1 ? T.surface1 : level === 2 ? T.surface2 : T.surface3,
  border: `1px solid ${T.borderSubtle}`,
  borderRadius: T.r,
  boxShadow: `inset 0 1px 0 0 ${T.borderTopLight}, 0 2px 8px rgba(0,0,0,.25)`,
});

const mono: React.CSSProperties = { fontFamily: T.mono, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" };

const ANIM_CSS = `
@keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
@keyframes spin { to { transform:rotate(360deg) } }
@keyframes countUp { from { opacity:0; filter:blur(6px) } to { opacity:1; filter:blur(0) } }
@keyframes glowPulse { 0%,100% { opacity:.4 } 50% { opacity:.9 } }
@keyframes shake { 0%,100% { transform:translateX(0) } 25% { transform:translateX(-3px) } 75% { transform:translateX(3px) } }
@keyframes successPop { 0% { transform:scale(0) } 50% { transform:scale(1.2) } 100% { transform:scale(1) } }
`;

const fadeUp = (d: number): React.CSSProperties => ({ animation: `fadeUp .55s cubic-bezier(.16,1,.3,1) ${d}ms both` });

// ═══════════════════════════════════════════════════════════════════════════
// TOOLTIP
// ═══════════════════════════════════════════════════════════════════════════

function Tip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", cursor: "help" }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onClick={() => setOpen(o => !o)}>
      <HelpCircle size={12} color={T.textMuted} style={{ opacity: 0.5 }} />
      {open && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", zIndex: 50,
          width: 220, padding: "10px 12px", borderRadius: 10,
          background: T.surface3, border: `1px solid ${T.borderLight}`, boxShadow: "0 8px 24px rgba(0,0,0,.5)",
          fontSize: 11, lineHeight: 1.55, color: T.textSecondary, fontWeight: 400, fontFamily: T.font, pointerEvents: "none",
        }}>
          <span style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%) rotate(45deg)", width: 10, height: 10, background: T.surface3, border: `1px solid ${T.borderLight}`, borderTop: "none", borderLeft: "none" }} />
          {text}
        </span>
      )}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOADING
// ═══════════════════════════════════════════════════════════════════════════

const LOADING_STEPS = [
  { label: "Conectando à Meta Ads API", duration: 1500 },
  { label: "Puxando 30 dias de dados", duration: 2000 },
  { label: "Classificando cada anúncio", duration: 1500 },
  { label: "Calculando desperdício real", duration: 1000 },
  { label: "Preparando ações recomendadas", duration: 2000 },
];

function useAnimatedNumber(target: number, duration = 2500, enabled = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled || target === 0) { setValue(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, enabled]);
  return value;
}

// ═══════════════════════════════════════════════════════════════════════════
// DECISION CARD — the core unit: problem + action + execute
// ═══════════════════════════════════════════════════════════════════════════

function DecisionCard({
  ad, onPause, pausingId, isPaused, delay = 0,
}: {
  ad: ClassifiedAd;
  onPause: (adId: string) => void;
  pausingId: string | null;
  isPaused: boolean;
  delay?: number;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const isPausing = pausingId === ad.ad_id;
  const ctrDisplay = (ad.ctr * 100).toFixed(2);

  if (isPaused) {
    return (
      <div style={{ ...card(1), padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, opacity: 0.6, ...fadeUp(delay) }}>
        <div style={{ animation: "successPop .4s ease-out" }}>
          <CheckCircle2 size={20} color={T.green} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.green, margin: 0 }}>Pausado</p>
          <p style={{ fontSize: 11, color: T.textMuted, margin: "2px 0 0" }}>{ad.ad_name}</p>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.green, ...mono }}>-R${ad.spend.toFixed(0)}/mês</span>
      </div>
    );
  }

  return (
    <div style={{ ...card(1), overflow: "hidden", ...fadeUp(delay) }}>
      {/* Problem strip */}
      <div style={{
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
        borderBottom: showDetail ? `1px solid ${T.borderSubtle}` : "none",
        cursor: "pointer",
      }} onClick={() => setShowDetail(d => !d)}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: `${T.red}0a`, border: `1px solid ${T.red}12`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <AlertTriangle size={15} color={T.red} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ad.ad_name}
          </p>
          <p style={{ fontSize: 11, color: T.textMuted, margin: "2px 0 0" }}>
            <span style={{ color: T.red, fontWeight: 600 }}>R${ad.spend.toFixed(0)} gastos</span>
            <span style={{ color: T.borderLight }}> · </span>
            <span style={mono}>CTR {ctrDisplay}%</span>
            {ad.conversions === 0 && <><span style={{ color: T.borderLight }}> · </span><span style={{ color: T.red }}>0 conversões</span></>}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Quick action */}
          <button
            onClick={(e) => { e.stopPropagation(); onPause(ad.ad_id); }}
            disabled={!!pausingId}
            style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: T.red, color: "#fff", border: "none",
              cursor: isPausing ? "not-allowed" : "pointer", fontFamily: T.font,
              display: "flex", alignItems: "center", gap: 5,
              boxShadow: `0 0 12px ${T.red}25`,
              opacity: isPausing ? 0.7 : 1,
            }}
          >
            {isPausing ? <Loader2 size={12} style={{ animation: "spin .8s linear infinite" }} /> : <Pause size={12} />}
            Pausar
          </button>
          {/* Expand for review */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowDetail(d => !d); }}
            style={{
              padding: "7px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
              background: T.surface2, color: T.textSecondary, border: `1px solid ${T.borderSubtle}`,
              cursor: "pointer", fontFamily: T.font, display: "flex", alignItems: "center", gap: 3,
            }}
          >
            {showDetail ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Revisar
          </button>
        </div>
      </div>

      {/* Detail panel (shown on "Revisar") */}
      {showDetail && (
        <div style={{ padding: "12px 16px", background: T.surface2 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            {[
              { label: "Gasto", value: `R$${ad.spend.toFixed(0)}`, color: T.red },
              { label: "CTR", value: `${ctrDisplay}%`, color: parseFloat(ctrDisplay) < 1.5 ? T.red : T.green },
              { label: "Conv.", value: String(ad.conversions), color: ad.conversions === 0 ? T.red : T.green },
              { label: "Freq.", value: `${ad.frequency.toFixed(1)}x`, color: ad.frequency > 3.5 ? T.amber : T.textPrimary },
            ].map((m, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <span style={{ fontSize: 10, color: T.textMuted, display: "block", marginBottom: 2 }}>{m.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: m.color, ...mono }}>{m.value}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "8px 10px", borderRadius: 7, background: `${T.red}06`, border: `1px solid ${T.red}08` }}>
            <p style={{ fontSize: 11, color: T.textSecondary, margin: 0, lineHeight: 1.5 }}>
              <span style={{ color: T.red, fontWeight: 600 }}>Por que pausar:</span> {ad.reason}
            </p>
          </div>
          <p style={{ fontSize: 10, color: T.textMuted, margin: "8px 0 0", lineHeight: 1.4 }}>
            Campanha: {ad.campaign_name} · Conjunto: {ad.adset_name}
          </p>
          {ad.roas !== null && (
            <p style={{ fontSize: 10, color: T.textMuted, margin: "2px 0 0" }}>
              ROAS: <span style={{ color: ad.roas < 1 ? T.red : T.green, fontWeight: 600, ...mono }}>{ad.roas.toFixed(2)}x</span>
              {ad.cpa !== null && <> · CPA: <span style={{ ...mono }}>{ad.cpa.toFixed(0)}</span></>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCALE CARD — opportunity + action
// ═══════════════════════════════════════════════════════════════════════════

function ScaleCard({ ad, delay = 0 }: { ad: ClassifiedAd; delay?: number }) {
  const ctrDisplay = (ad.ctr * 100).toFixed(2);
  return (
    <div style={{ ...card(1), padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, ...fadeUp(delay) }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: `${T.green}0a`, border: `1px solid ${T.green}12`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <TrendingUp size={14} color={T.green} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ad.ad_name}</p>
        <p style={{ fontSize: 11, color: T.textMuted, margin: "2px 0 0" }}>
          <span style={{ color: T.green, fontWeight: 600, ...mono }}>CTR {ctrDisplay}%</span>
          <span style={{ color: T.borderLight }}> · </span>R${ad.spend.toFixed(0)}
          <span style={{ color: T.borderLight }}> · </span>{ad.reason}
        </p>
      </div>
      <div style={{ padding: "5px 10px", borderRadius: 7, background: `${T.green}0c`, border: `1px solid ${T.green}15` }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: ".04em" }}>Escalar</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INSIGHT CARD
// ═══════════════════════════════════════════════════════════════════════════

function InsightCard({ insight, delay }: { insight: DiagnosticInsight; delay: number }) {
  const colorMap = { waste: T.red, opportunity: T.green, health: T.accent };
  const IconMap = { waste: AlertTriangle, opportunity: TrendingUp, health: Shield };
  const color = colorMap[insight.type]; const Icon = IconMap[insight.type];
  return (
    <div style={{ ...card(2), padding: 16, position: "relative", overflow: "hidden", ...fadeUp(delay) }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${color}30, transparent)` }} />
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, flex: 1 }}>{insight.title}</span>
      </div>
      <p style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6, margin: "0 0 10px" }}>{insight.description}</p>
      <div style={{ padding: "4px 10px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4, background: `${color}08`, border: `1px solid ${color}10` }}>
        <Sparkles size={10} color={color} />
        <span style={{ fontSize: 12, fontWeight: 700, color, ...mono }}>{insight.impact}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK ROW
// ═══════════════════════════════════════════════════════════════════════════

function BenchmarkRow({ label, yours, benchmark, verdict, format, tip }: {
  label: string; yours: number; benchmark: number; verdict: "above" | "below" | "at"; format: (v: number) => string; tip?: string;
}) {
  const color = verdict === "above" ? T.green : verdict === "below" ? T.red : T.amber;
  const pct = benchmark > 0 ? ((yours - benchmark) / benchmark) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${T.borderSubtle}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>{label}</span>
        {tip && <Tip text={tip} />}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, ...mono }}>{format(yours)}</span>
        <span style={{ fontSize: 10, color: T.textMuted }}>vs {format(benchmark)}</span>
        <div style={{ padding: "2px 6px", borderRadius: 4, background: `${color}0c`, border: `1px solid ${color}12`, display: "flex", alignItems: "center", gap: 2 }}>
          {verdict === "above" ? <TrendingUp size={9} color={color} /> : verdict === "below" ? <TrendingDown size={9} color={color} /> : null}
          <span style={{ fontSize: 10, fontWeight: 700, color, ...mono }}>{pct >= 0 ? "+" : ""}{pct.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORE RING (compact)
// ═══════════════════════════════════════════════════════════════════════════

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2; const circ = 2 * Math.PI * r;
  const color = score >= 70 ? T.green : score >= 40 ? T.accent : T.red;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.borderSubtle} strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - (score / 100) * circ}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 2s cubic-bezier(.16,1,.3,1)", filter: `drop-shadow(0 0 4px ${color}40)` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 16, fontWeight: 700, fontFamily: T.mono, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: T.textPrimary }}>{score}</span>
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
  const [batchConfirm, setBatchConfirm] = useState(false);
  const [showScale, setShowScale] = useState(false);
  const [showBenchmarks, setShowBenchmarks] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  const animatedWaste = useAnimatedNumber(data?.wasted_spend || 0, 2500, phase === "reveal" || phase === "done");

  // ── Load diagnostic ─────────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/login"); return; }
        const { data: personas } = await supabase.from("personas" as any).select("id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
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
        if (result.metrics.active_ads < 2 || result.metrics.total_spend < 50) { setPhase("empty"); return; }
        setPhase("reveal");
        setTimeout(() => setPhase("done"), 3000);
      } catch (e: any) { setError(e.message || "Erro ao gerar diagnóstico"); setPhase("error"); }
    };
    run();
  }, []);

  // ── Pause actions ───────────────────────────────────────────────────
  const handlePause = useCallback(async (adId: string) => {
    setPausingId(adId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: personas } = await supabase.from("personas" as any).select("id").eq("user_id", user!.id).limit(1) as any;
      const { data: result, error } = await supabase.functions.invoke("meta-actions", {
        body: { action: "pause", user_id: user!.id, persona_id: personas?.[0]?.id || null, target_id: adId, target_type: "ad" },
      });
      if (error || result?.error) throw new Error(result?.error || error?.message);
      setPausedIds(prev => new Set([...prev, adId]));
    } catch (e: any) { console.error("Pause failed:", e); }
    finally { setPausingId(null); }
  }, []);

  const handleBatchPause = useCallback(async () => {
    if (!data) return;
    setBatchPausing(true);
    for (const ad of data.ads_to_pause.filter(a => !pausedIds.has(a.ad_id))) {
      await handlePause(ad.ad_id);
      await new Promise(r => setTimeout(r, 500));
    }
    setBatchPausing(false);
    setBatchConfirm(false);
  }, [data, pausedIds, handlePause]);

  // ═══════════════════════════════════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════════════════════════════════

  if (phase === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font }}>
        <style>{ANIM_CSS}</style>
        <div style={{ textAlign: "center", maxWidth: 380, padding: 24 }}>
          <div style={{
            width: 60, height: 60, margin: "0 auto 24px", borderRadius: 14, position: "relative",
            background: `${T.accent}08`, border: `1px solid ${T.accent}15`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Loader2 size={22} color={T.accent} style={{ animation: "spin 1s linear infinite" }} />
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: T.textPrimary, marginBottom: 5, letterSpacing: "-.02em" }}>Analisando sua conta</h2>
          <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 24 }}>Isso leva ~15 segundos</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
            {LOADING_STEPS.map((step, i) => {
              const active = i === loadingStep; const done = i < loadingStep;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9,
                  background: active ? `${T.accent}06` : "transparent",
                  border: active ? `1px solid ${T.accent}10` : "1px solid transparent",
                  opacity: done || active ? 1 : 0.3, transition: "all .4s cubic-bezier(.16,1,.3,1)",
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: done ? `${T.green}0c` : active ? `${T.accent}0c` : T.borderSubtle,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: `1px solid ${done ? T.green + "18" : active ? T.accent + "18" : "transparent"}`,
                  }}>
                    {done ? <Check size={11} color={T.green} /> : active ? <Loader2 size={11} color={T.accent} style={{ animation: "spin 1s linear infinite" }} /> : <div style={{ width: 4, height: 4, borderRadius: 2, background: T.textMuted }} />}
                  </div>
                  <span style={{ fontSize: 12, color: active ? T.textPrimary : done ? T.textSecondary : T.textMuted, fontWeight: active ? 600 : 400 }}>{step.label}</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 20, height: 3, background: T.borderSubtle, borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${T.accent}70, ${T.accent})`,
              width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%`,
              transition: "width .8s cubic-bezier(.16,1,.3,1)", boxShadow: `0 0 10px ${T.accent}30`,
            }} />
          </div>
        </div>
      </div>
    );
  }

  // ERROR
  if (phase === "error") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font }}>
        <style>{ANIM_CSS}</style>
        <div style={{ textAlign: "center", maxWidth: 400, padding: 24 }}>
          <div style={{ width: 52, height: 52, margin: "0 auto 18px", borderRadius: 14, background: `${T.red}08`, border: `1px solid ${T.red}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={22} color={T.red} />
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: T.textPrimary, marginBottom: 8 }}>Erro no diagnóstico</h2>
          <div style={{ ...card(2), padding: "10px 14px", marginBottom: 18, textAlign: "left" }}>
            <p style={{ fontSize: 11, color: T.red, ...mono, margin: 0, wordBreak: "break-all", lineHeight: 1.5 }}>{error}</p>
          </div>
          <button onClick={() => navigate("/dashboard/accounts")} style={{ padding: "9px 18px", borderRadius: 8, ...card(2), color: T.textPrimary, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: T.font }}>Voltar para Contas</button>
        </div>
      </div>
    );
  }

  // EMPTY
  if (phase === "empty") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font }}>
        <style>{ANIM_CSS}</style>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <div style={{ width: 52, height: 52, margin: "0 auto 18px", borderRadius: 14, background: `${T.amber}08`, border: `1px solid ${T.amber}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BarChart3 size={22} color={T.amber} />
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: T.textPrimary, marginBottom: 8, letterSpacing: "-.02em" }}>
            {data ? "Dados insuficientes" : "Conecte sua conta Meta Ads"}
          </h2>
          <p style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6, marginBottom: 22 }}>
            {data ? `Sua conta tem ${data.metrics.active_ads} anúncio(s) e R$${data.metrics.total_spend.toFixed(0)} de spend nos últimos 30 dias. Precisamos de pelo menos 2 anúncios e R$50 de spend.` : "Para gerar seu diagnóstico, conecte uma conta Meta Ads."}
          </p>
          <button onClick={() => navigate("/dashboard/accounts")} style={{
            padding: "10px 22px", borderRadius: 8, fontFamily: T.font, background: T.accent, color: "#fff",
            fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, boxShadow: `0 0 16px ${T.accent}25`,
          }}>
            {data ? "Voltar" : "Conectar conta"} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RESULTS — Action-first layout
  // ═══════════════════════════════════════════════════════════════════════

  if (!data) return null;

  const unpausedAds = data.ads_to_pause.filter(a => !pausedIds.has(a.ad_id));
  const savedMoney = data.ads_to_pause.filter(a => pausedIds.has(a.ad_id)).reduce((s, a) => s + a.spend, 0);
  const allPaused = unpausedAds.length === 0 && data.ads_to_pause.length > 0;
  const hasRevenue = data.metrics.total_revenue > 0;
  const hasConversions = data.metrics.total_conversions > 0;
  const totalWastePerDay = data.wasted_spend / 30;

  return (
    <div style={{ minHeight: "100vh", fontFamily: T.font }}>
      <style>{ANIM_CSS}</style>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px 80px" }}>

        {/* ── Tiny header ──────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, ...fadeUp(0) }}>
          <div>
            <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>
              {data.ad_account_name} · {data.metrics.active_ads} ads · {data.period_days}d
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ScoreRing score={data.score} />
            <button onClick={() => window.location.reload()} style={{
              padding: "6px 10px", borderRadius: 7, ...card(2), color: T.textMuted, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, fontFamily: T.font,
            }}>
              <RefreshCw size={10} />
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            HERO: THE CORE ACTION — "Você está perdendo R$X"
           ══════════════════════════════════════════════════════════════ */}

        {data.wasted_spend > 0 && !allPaused ? (
          <div style={{ ...card(1), padding: "28px 22px", marginBottom: 16, position: "relative", overflow: "hidden", ...fadeUp(60) }}>
            {/* Red accent top line */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${T.red}, transparent)` }} />

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: T.red, textTransform: "uppercase", letterSpacing: ".1em", margin: "0 0 8px" }}>
                Você está perdendo hoje
              </p>
              <div>
                <span style={{ fontSize: 18, fontWeight: 600, fontFamily: T.mono, color: T.textMuted, marginRight: 2 }}>R$</span>
                <span style={{
                  fontSize: 48, fontWeight: 700, fontFamily: T.mono, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: T.textPrimary,
                  animation: "countUp .8s ease-out",
                }}>{animatedWaste.toLocaleString("pt-BR")}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: T.textMuted, marginLeft: 4 }}>/mês</span>
              </div>
              <p style={{ fontSize: 12, color: T.textMuted, margin: "6px 0 0" }}>
                <span style={{ fontFamily: T.mono, fontVariantNumeric: "tabular-nums", color: T.red }}>R${totalWastePerDay.toFixed(0)}/dia</span> em {unpausedAds.length} anúncio{unpausedAds.length > 1 ? "s" : ""} de baixa performance
              </p>
            </div>

            {/* THE TWO PATHS — Execute or Review */}
            {!batchConfirm ? (
              <div style={{ display: "flex", gap: 8 }}>
                {/* Path 1: Execute now */}
                <button
                  onClick={() => setBatchConfirm(true)}
                  style={{
                    flex: 1, padding: "12px 16px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                    background: `linear-gradient(135deg, ${T.red}, #dc2626)`, color: "#fff", border: "none", cursor: "pointer", fontFamily: T.font,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    boxShadow: `0 0 20px ${T.red}40, inset 0 1px 0 rgba(255,255,255,.2)`,
                    transition: "all .2s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 24px ${T.red}50, inset 0 1px 0 rgba(255,255,255,.3)`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 0 20px ${T.red}40, inset 0 1px 0 rgba(255,255,255,.2)`; }}
                >
                  <Pause size={15} />
                  Pausar {unpausedAds.length > 1 ? `todos (${unpausedAds.length})` : "agora"}
                </button>
                {/* Path 2: Review first */}
                <button
                  onClick={() => {
                    const el = document.getElementById("ad-decisions");
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  style={{
                    padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                    background: `linear-gradient(135deg, ${T.surface2}, ${T.surface3})`, color: T.textSecondary, border: `1px solid ${T.borderLight}`,
                    cursor: "pointer", fontFamily: T.font, display: "flex", alignItems: "center", gap: 5,
                    transition: "all .2s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = T.textPrimary; e.currentTarget.style.borderColor = T.borderTopLight; e.currentTarget.style.background = `linear-gradient(135deg, ${T.surface3}, #1a2032)`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = T.textSecondary; e.currentTarget.style.borderColor = T.borderLight; e.currentTarget.style.background = `linear-gradient(135deg, ${T.surface2}, ${T.surface3})`; }}
                >
                  Revisar antes <ChevronDown size={14} />
                </button>
              </div>
            ) : (
              /* Confirmation step */
              <div style={{ ...card(2), padding: 16, textAlign: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: "0 0 4px" }}>
                  Pausar {unpausedAds.length} anúncio{unpausedAds.length > 1 ? "s" : ""} agora?
                </p>
                <p style={{ fontSize: 11, color: T.textMuted, margin: "0 0 12px" }}>
                  Isso economiza <span style={{ color: T.green, fontWeight: 700, fontFamily: T.mono, fontVariantNumeric: "tabular-nums" }}>R${data.wasted_spend.toFixed(0)}/mês</span>. Você pode reativar a qualquer momento no Meta Ads Manager.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <button
                    onClick={handleBatchPause}
                    disabled={batchPausing}
                    style={{
                      padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      background: `linear-gradient(135deg, ${T.red}, #dc2626)`, color: "#fff", border: "none",
                      cursor: batchPausing ? "not-allowed" : "pointer", fontFamily: T.font,
                      display: "flex", alignItems: "center", gap: 5,
                      opacity: batchPausing ? 0.7 : 1,
                      boxShadow: `0 0 16px ${T.red}40, inset 0 1px 0 rgba(255,255,255,.2)`,
                      transition: "all .2s ease",
                    }}
                    onMouseEnter={(e) => { if (!batchPausing) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 20px ${T.red}50, inset 0 1px 0 rgba(255,255,255,.3)`; } }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 0 16px ${T.red}40, inset 0 1px 0 rgba(255,255,255,.2)`; }}
                  >
                    {batchPausing ? <Loader2 size={13} style={{ animation: "spin .8s linear infinite" }} /> : <Check size={13} />}
                    {batchPausing ? `Pausando (${pausedIds.size}/${data.ads_to_pause.length})...` : "Confirmar"}
                  </button>
                  <button
                    onClick={() => setBatchConfirm(false)}
                    style={{
                      padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: T.surface3, color: T.textSecondary, border: `1px solid ${T.borderSubtle}`,
                      cursor: "pointer", fontFamily: T.font,
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* ROAS projection */}
            {data.projected_roas && data.current_roas && data.roas_improvement_pct ? (
              <div style={{
                marginTop: 14, padding: "8px 12px", borderRadius: 8,
                background: `${T.green}06`, border: `1px solid ${T.green}10`,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <TrendingUp size={12} color={T.green} />
                <span style={{ fontSize: 11, color: T.textSecondary }}>ROAS projetado:</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: T.textPrimary, ...mono }}>{data.current_roas.toFixed(2)}x</span>
                <ArrowRight size={10} color={T.textMuted} />
                <span style={{ fontSize: 12, fontWeight: 800, color: T.green, ...mono }}>{data.projected_roas.toFixed(2)}x</span>
              </div>
            ) : null}
          </div>
        ) : allPaused ? (
          /* ALL DONE STATE */
          <div style={{ ...card(1), padding: "28px 22px", marginBottom: 16, textAlign: "center", ...fadeUp(60) }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${T.green}, transparent)` }} />
            <div style={{ width: 48, height: 48, margin: "0 auto 12px", borderRadius: 12, background: `${T.green}10`, border: `1px solid ${T.green}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={24} color={T.green} />
            </div>
            <p style={{ fontSize: 17, fontWeight: 800, color: T.textPrimary, margin: "0 0 4px" }}>Pronto!</p>
            <p style={{ fontSize: 13, color: T.textSecondary, margin: "0 0 6px" }}>
              Todos os {data.ads_to_pause.length} anúncios foram pausados.
            </p>
            <p style={{ fontSize: 15, fontWeight: 800, color: T.green, ...mono, margin: 0 }}>
              R${savedMoney.toFixed(0)}/mês economizados
            </p>
          </div>
        ) : (
          /* HEALTHY ACCOUNT */
          <div style={{ ...card(1), padding: "24px 22px", marginBottom: 16, textAlign: "center", ...fadeUp(60) }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6 }}>
              <Check size={14} color={T.green} />
              <span style={{ fontSize: 11, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: ".1em" }}>Conta saudável</span>
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, margin: 0 }}>Nenhuma ação necessária agora</p>
          </div>
        )}

        {/* ── Savings counter (if some paused) ─────────────────────── */}
        {pausedIds.size > 0 && !allPaused && (
          <div style={{ ...card(1), padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8, border: `1px solid ${T.green}15`, ...fadeUp(100) }}>
            <CheckCircle2 size={15} color={T.green} />
            <span style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>{pausedIds.size} pausado{pausedIds.size > 1 ? "s" : ""}</span>
            <span style={{ color: T.textMuted }}>—</span>
            <span style={{ fontSize: 12, color: T.textPrimary, fontWeight: 700, fontFamily: T.mono, fontVariantNumeric: "tabular-nums" }}>R${savedMoney.toFixed(0)}/mês economizados</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            INDIVIDUAL DECISIONS — "Revisar antes" scrolls here
           ══════════════════════════════════════════════════════════════ */}

        {unpausedAds.length > 0 && (
          <div id="ad-decisions" style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, ...fadeUp(200) }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>Ações recomendadas</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.red, fontFamily: T.mono, fontVariantNumeric: "tabular-nums", padding: "1px 6px", borderRadius: 4, background: `${T.red}0c` }}>{unpausedAds.length}</span>
              <Tip text="Cada card é uma decisão: veja o problema, clique 'Pausar' pra executar, ou 'Revisar' pra ver detalhes antes." />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {unpausedAds.map((ad, i) => (
                <DecisionCard key={ad.ad_id} ad={ad} onPause={handlePause} pausingId={pausingId} isPaused={pausedIds.has(ad.ad_id)} delay={220 + i * 40} />
              ))}
            </div>
            {/* Already-paused cards */}
            {pausedIds.size > 0 && data.ads_to_pause.filter(a => pausedIds.has(a.ad_id)).map((ad, i) => (
              <DecisionCard key={ad.ad_id} ad={ad} onPause={handlePause} pausingId={pausingId} isPaused={true} delay={0} />
            ))}
          </div>
        )}

        {/* ── Opportunities (collapsible) ──────────────────────────── */}
        {data.ads_to_scale.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <button onClick={() => setShowScale(s => !s)} style={{
              display: "flex", alignItems: "center", gap: 6, width: "100%",
              padding: "12px 14px", borderRadius: 10, ...card(1), cursor: "pointer",
              fontFamily: T.font, ...fadeUp(400),
            }}>
              <TrendingUp size={14} color={T.green} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, flex: 1, textAlign: "left" }}>
                Anúncios para escalar
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.green, fontFamily: T.mono, fontVariantNumeric: "tabular-nums", padding: "1px 6px", borderRadius: 4, background: `${T.green}0c` }}>{data.ads_to_scale.length}</span>
              {showScale ? <ChevronUp size={14} color={T.textMuted} /> : <ChevronDown size={14} color={T.textMuted} />}
            </button>
            {showScale && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
                {data.ads_to_scale.map((ad, i) => <ScaleCard key={ad.ad_id} ad={ad} delay={420 + i * 30} />)}
              </div>
            )}
          </div>
        )}

        {/* ── Fatigued (collapsible) ───────────────────────────────── */}
        {data.ads_fatigued.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <button onClick={() => {}} style={{
              display: "flex", alignItems: "center", gap: 6, width: "100%",
              padding: "12px 14px", borderRadius: 10, ...card(1), cursor: "default",
              fontFamily: T.font, ...fadeUp(450),
            }}>
              <Flame size={14} color={T.amber} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, flex: 1, textAlign: "left" }}>Em fadiga criativa</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.amber, fontFamily: T.mono, fontVariantNumeric: "tabular-nums", padding: "1px 6px", borderRadius: 4, background: `${T.amber}0c` }}>{data.ads_fatigued.length}</span>
              <Tip text="Frequência acima de 3.5x. Troque o criativo pra recuperar performance." />
            </button>
          </div>
        )}

        {/* ── Quick metrics strip ──────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 14, ...fadeUp(500) }}>
          {[
            { label: "Spend", value: `R$${data.metrics.total_spend.toFixed(0)}`, color: T.textPrimary },
            { label: "CTR", value: `${(data.metrics.avg_ctr * 100).toFixed(2)}%`, color: data.benchmarks.ctr?.verdict === "above" ? T.green : T.red },
            { label: "CPC", value: `R$${data.metrics.avg_cpc.toFixed(2)}`, color: data.benchmarks.cpc?.verdict === "above" ? T.green : T.red },
            { label: "Conv.", value: String(data.metrics.total_conversions), color: hasConversions ? T.green : T.textMuted },
          ].map((m, i) => (
            <div key={i} style={{ ...card(1), padding: "10px 8px", textAlign: "center" }}>
              <span style={{ fontSize: 9, color: T.textMuted, display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: ".06em" }}>{m.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: m.color, fontFamily: T.mono, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{m.value}</span>
            </div>
          ))}
        </div>

        {/* ── Benchmarks (collapsible) ─────────────────────────────── */}
        <div style={{ marginBottom: 14 }}>
          <button onClick={() => setShowBenchmarks(b => !b)} style={{
            display: "flex", alignItems: "center", gap: 6, width: "100%",
            padding: "12px 14px", borderRadius: 10, ...card(1), cursor: "pointer",
            fontFamily: T.font, ...fadeUp(550),
          }}>
            <BarChart3 size={14} color={T.accent} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, flex: 1, textAlign: "left" }}>vs Benchmark do Mercado</span>
            {showBenchmarks ? <ChevronUp size={14} color={T.textMuted} /> : <ChevronDown size={14} color={T.textMuted} />}
          </button>
          {showBenchmarks && (
            <div style={{ ...card(1), padding: "4px 14px", marginTop: 6 }}>
              <BenchmarkRow label="CTR" yours={data.benchmarks.ctr.yours} benchmark={data.benchmarks.ctr.benchmark} verdict={data.benchmarks.ctr.verdict} format={v => `${(v * 100).toFixed(2)}%`} tip="Sua taxa de clique vs média do mercado." />
              <BenchmarkRow label="CPM" yours={data.benchmarks.cpm.yours} benchmark={data.benchmarks.cpm.benchmark} verdict={data.benchmarks.cpm.verdict} format={v => `R$${v.toFixed(2)}`} tip="Custo por mil impressões." />
              <BenchmarkRow label="CPC" yours={data.benchmarks.cpc.yours} benchmark={data.benchmarks.cpc.benchmark} verdict={data.benchmarks.cpc.verdict} format={v => `R$${v.toFixed(2)}`} tip="Custo por clique." />
              <BenchmarkRow label="Freq." yours={data.benchmarks.frequency.yours} benchmark={data.benchmarks.frequency.benchmark} verdict={data.benchmarks.frequency.verdict} format={v => `${v.toFixed(1)}x`} tip="Vezes que cada pessoa viu seu ad." />
            </div>
          )}
        </div>

        {/* ── AI Insights (collapsible) ────────────────────────────── */}
        {data.insights.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <button onClick={() => setShowInsights(s => !s)} style={{
              display: "flex", alignItems: "center", gap: 6, width: "100%",
              padding: "12px 14px", borderRadius: 10, ...card(1), cursor: "pointer",
              fontFamily: T.font, ...fadeUp(600),
            }}>
              <Sparkles size={14} color={T.accent} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, flex: 1, textAlign: "left" }}>Insights da IA</span>
              <span style={{ fontSize: 11, color: T.textMuted }}>{data.insights.length}</span>
              {showInsights ? <ChevronUp size={14} color={T.textMuted} /> : <ChevronDown size={14} color={T.textMuted} />}
            </button>
            {showInsights && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                {data.insights.map((insight, i) => <InsightCard key={i} insight={insight} delay={620 + i * 50} />)}
              </div>
            )}
          </div>
        )}

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <div style={{ ...card(1), padding: "22px 20px", marginTop: 20, textAlign: "center", position: "relative", overflow: "hidden", ...fadeUp(700) }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${T.accent}30, transparent)` }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, margin: "0 0 4px" }}>Quer ir mais fundo?</p>
          <p style={{ fontSize: 12, color: T.textMuted, margin: "0 0 14px" }}>A IA conhece cada detalhe da sua conta.</p>
          <button onClick={() => navigate("/dashboard/ai")} style={{
            padding: "10px 22px", borderRadius: 8, fontFamily: T.font, background: T.accent, color: "#fff",
            fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", display: "inline-flex",
            alignItems: "center", gap: 6, boxShadow: `0 0 16px ${T.accent}25`,
          }}>
            Abrir AI Chat <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
