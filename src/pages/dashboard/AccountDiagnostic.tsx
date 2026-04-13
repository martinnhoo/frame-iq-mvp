import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, AlertTriangle, TrendingUp, TrendingDown, Shield,
  Pause, Zap, Activity, ChevronDown, ChevronUp, Check, X,
  ArrowRight, RefreshCw, BarChart3, DollarSign, Eye, MousePointerClick,
  Target, Flame, Crown, Sparkles, HelpCircle, Info,
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
// DESIGN TOKENS — Extracted from AdBrief live CSS vars
// ═══════════════════════════════════════════════════════════════════════════

const T = {
  font: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
  mono: "'DM Mono', 'SF Mono', 'Fira Code', monospace",
  // Surfaces (navy-tinted, not gray)
  surface0: "#070d1a",
  surface1: "#0d1117",
  surface2: "#111620",
  surface3: "#161c2a",
  elevated: "#16181f",
  // Accent
  accent: "#0ea5e9",
  accentGlow: "rgba(14,165,233,.1)",
  cyan: "rgba(6,182,212,.35)",
  cyanGlow: "rgba(6,182,212,.12)",
  purpleGlow: "rgba(139,92,246,.05)",
  // Semantic
  red: "#ef4444",
  green: "#22c55e",
  amber: "#eab308",
  // Text
  textPrimary: "#f0f2f8",
  textSecondary: "rgba(255,255,255,.5)",
  textMuted: "rgba(255,255,255,.28)",
  // Borders
  borderSubtle: "rgba(255,255,255,.04)",
  borderLight: "rgba(255,255,255,.08)",
  borderTopLight: "rgba(255,255,255,.12)",
  // Radius
  r: 12,
};

const card = (level: 1 | 2 | 3 = 1): React.CSSProperties => ({
  background: level === 1 ? T.surface1 : level === 2 ? T.surface2 : T.surface3,
  border: `1px solid ${T.borderSubtle}`,
  borderRadius: T.r,
  boxShadow: `inset 0 1px 0 0 ${T.borderTopLight}, 0 2px 8px rgba(0,0,0,.25)`,
});

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  letterSpacing: "-0.03em",
  fontVariantNumeric: "tabular-nums",
};

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATIONS
// ═══════════════════════════════════════════════════════════════════════════

const ANIM_CSS = `
@keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
@keyframes scaleIn { from { opacity:0; transform:scale(.94) } to { opacity:1; transform:scale(1) } }
@keyframes spin { to { transform:rotate(360deg) } }
@keyframes countUp { from { opacity:0; filter:blur(6px) } to { opacity:1; filter:blur(0) } }
@keyframes glowPulse { 0%,100% { opacity:.4 } 50% { opacity:.9 } }
`;

const fadeUp = (d: number): React.CSSProperties => ({
  animation: `fadeUp .55s cubic-bezier(.16,1,.3,1) ${d}ms both`,
});

// ═══════════════════════════════════════════════════════════════════════════
// TOOLTIP — small "?" that shows explanation on hover
// ═══════════════════════════════════════════════════════════════════════════

function Tip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", cursor: "help" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen(o => !o)}
    >
      <HelpCircle size={12} color={T.textMuted} style={{ opacity: 0.6 }} />
      {open && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
          transform: "translateX(-50%)", zIndex: 50,
          width: 220, padding: "10px 12px", borderRadius: 10,
          background: T.surface3, border: `1px solid ${T.borderLight}`,
          boxShadow: "0 8px 24px rgba(0,0,0,.5)",
          fontSize: 11, lineHeight: 1.55, color: T.textSecondary,
          fontWeight: 400, fontFamily: T.font,
          pointerEvents: "none",
        }}>
          {/* Arrow */}
          <span style={{
            position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%) rotate(45deg)",
            width: 10, height: 10, background: T.surface3, border: `1px solid ${T.borderLight}`,
            borderTop: "none", borderLeft: "none",
          }} />
          {text}
        </span>
      )}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOADING STEPS
// ═══════════════════════════════════════════════════════════════════════════

const LOADING_STEPS = [
  { label: "Conectando à Meta Ads API", duration: 1500 },
  { label: "Puxando 30 dias de dados", duration: 2000 },
  { label: "Classificando cada anúncio", duration: 1500 },
  { label: "Calculando desperdício real", duration: 1000 },
  { label: "Gerando insights com IA", duration: 2000 },
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
      const p = Math.min(elapsed / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, enabled]);
  return value;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORE RING
// ═══════════════════════════════════════════════════════════════════════════

function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const prog = (score / 100) * circ;
  const color = score >= 70 ? T.green : score >= 40 ? T.accent : T.red;
  const label = score >= 80 ? "Excelente" : score >= 60 ? "Bom" : score >= 40 ? "Regular" : "Crítico";

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {/* Glow */}
      <div style={{
        position: "absolute", inset: -16,
        background: `radial-gradient(circle, ${color}14 0%, transparent 70%)`,
        animation: "glowPulse 3s ease-in-out infinite",
      }} />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "relative" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.borderSubtle} strokeWidth={10} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - prog}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 2s cubic-bezier(.16,1,.3,1)", filter: `drop-shadow(0 0 6px ${color}50)` }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.28, fontWeight: 900, color: T.textPrimary, ...mono, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 9, color, fontWeight: 700, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// METRIC CARD
// ═══════════════════════════════════════════════════════════════════════════

const METRIC_TIPS: Record<string, string> = {
  spend: "Quanto você investiu em anúncios nos últimos 30 dias. Inclui todos os anúncios ativos no período.",
  ctr: "Click-Through Rate — % de pessoas que clicaram no anúncio após vê-lo. Acima de 1.5% é considerado bom para Meta Ads.",
  impressions: "Quantas vezes seus anúncios foram exibidos. Cada visualização conta como 1 impressão.",
  conversions: "Ações valiosas geradas: compras, leads, cadastros ou instalações. Depende do pixel/API de conversão configurado.",
  roas: "Return on Ad Spend — quanto de receita você gerou para cada R$1 gasto. ROAS 2x = R$2 de receita por R$1 investido.",
  cpa: "Custo por Aquisição — quanto você paga em média por cada conversão. Quanto menor, melhor.",
};

function MetricCard({ icon: Icon, label, value, sub, color, delay, tipKey }: {
  icon: any; label: string; value: string; sub?: string; color: string; delay: number; tipKey?: string;
}) {
  return (
    <div style={{ ...card(1), padding: "14px 14px", position: "relative", overflow: "hidden", ...fadeUp(delay) }}>
      {/* Subtle top accent line */}
      <div style={{
        position: "absolute", top: 0, left: "20%", right: "20%", height: 1,
        background: `linear-gradient(90deg, transparent, ${color}25, transparent)`,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
        <Icon size={12} color={T.textMuted} />
        <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>{label}</span>
        {tipKey && METRIC_TIPS[tipKey] && <Tip text={METRIC_TIPS[tipKey]} />}
      </div>
      <span style={{ fontSize: 20, fontWeight: 800, color, ...mono, display: "block" }}>{value}</span>
      {sub && <span style={{ fontSize: 10, color: T.textMuted, marginTop: 2, display: "block" }}>{sub}</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AD ROW
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
  const ctrDisplay = (ad.ctr * 100).toFixed(2);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
      ...card(1), opacity: isPausing ? 0.5 : 1, transition: "opacity .2s",
      ...fadeUp(delay),
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: `${color}0c`, border: `1px solid ${color}15`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={13} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
          {ad.ad_name}
        </p>
        <p style={{ fontSize: 11, color: T.textMuted, margin: "2px 0 0", lineHeight: 1.4 }}>
          {ad.campaign_name}
          <span style={{ color: T.borderLight }}> · </span>
          <span style={mono}>R${ad.spend.toFixed(0)}</span>
          <span style={{ color: T.borderLight }}> · </span>
          <span style={mono}>CTR {ctrDisplay}%</span>
          {ad.roas != null && (
            <>
              <span style={{ color: T.borderLight }}> · </span>
              <span style={mono}>ROAS {ad.roas.toFixed(1)}x</span>
            </>
          )}
        </p>
        {ad.reason && (
          <p style={{ fontSize: 10, color, fontWeight: 500, margin: "3px 0 0", opacity: 0.85 }}>{ad.reason}</p>
        )}
      </div>
      {type === "pause" && onPause && (
        <button
          onClick={() => onPause(ad.ad_id)}
          disabled={!!pausingId}
          style={{
            padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 600,
            background: `${T.red}0c`, color: T.red, border: `1px solid ${T.red}20`,
            cursor: isPausing ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 4, fontFamily: T.font,
          }}
        >
          {isPausing ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Pause size={11} />}
          {isPausing ? "..." : "Pausar"}
        </button>
      )}
      {type === "scale" && (
        <div style={{ padding: "3px 9px", borderRadius: 6, background: `${T.green}0c`, border: `1px solid ${T.green}15` }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: "0.04em" }}>Escalar</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INSIGHT CARD
// ═══════════════════════════════════════════════════════════════════════════

function InsightCard({ insight, delay }: { insight: DiagnosticInsight; delay: number }) {
  const colorMap = { waste: T.red, opportunity: T.green, health: T.accent };
  const IconMap = { waste: AlertTriangle, opportunity: TrendingUp, health: Shield };
  const color = colorMap[insight.type];
  const Icon = IconMap[insight.type];
  const urgencyColor = insight.urgency === "alta" ? T.red : insight.urgency === "media" ? T.amber : T.textMuted;

  return (
    <div style={{ ...card(2), padding: 18, position: "relative", overflow: "hidden", ...fadeUp(delay) }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${color}30, transparent)`,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: `${color}0c`, border: `1px solid ${color}15`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={12} color={color} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, flex: 1 }}>{insight.title}</span>
        <span style={{
          fontSize: 9, fontWeight: 700, color: urgencyColor,
          textTransform: "uppercase", letterSpacing: "0.08em",
          padding: "2px 7px", borderRadius: 4, background: `${urgencyColor}0c`,
        }}>
          {insight.urgency}
        </span>
      </div>
      <p style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.65, margin: "0 0 12px" }}>{insight.description}</p>
      <div style={{
        padding: "5px 11px", borderRadius: 7, display: "inline-flex", alignItems: "center", gap: 5,
        background: `${color}08`, border: `1px solid ${color}12`,
      }}>
        <Sparkles size={10} color={color} />
        <span style={{ fontSize: 12, fontWeight: 700, color, ...mono }}>{insight.impact}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK ROW
// ═══════════════════════════════════════════════════════════════════════════

const BENCH_TIPS: Record<string, string> = {
  CTR: "Sua taxa de clique comparada à média do mercado. Quanto maior, melhor — indica que seu criativo está chamando atenção.",
  CPM: "Custo por mil impressões. Quanto menor, mais barato está seu alcance. Varia por nicho e época do ano.",
  CPC: "Custo por clique. Quanto menor, mais eficiente seu investimento por cada visita gerada.",
  "Frequência": "Quantas vezes cada pessoa viu seu anúncio em média. Acima de 3.5x indica fadiga de audiência.",
};

function BenchmarkRow({ label, yours, benchmark, verdict, format }: {
  label: string; yours: number; benchmark: number; verdict: "above" | "below" | "at"; format: (v: number) => string;
}) {
  const color = verdict === "above" ? T.green : verdict === "below" ? T.red : T.amber;
  const pct = benchmark > 0 ? ((yours - benchmark) / benchmark) * 100 : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.borderSubtle}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>{label}</span>
        {BENCH_TIPS[label] && <Tip text={BENCH_TIPS[label]} />}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, ...mono }}>{format(yours)}</span>
        <span style={{ fontSize: 10, color: T.textMuted }}>vs {format(benchmark)}</span>
        <div style={{
          padding: "2px 6px", borderRadius: 4,
          background: `${color}0c`, border: `1px solid ${color}15`,
          display: "flex", alignItems: "center", gap: 3,
        }}>
          {verdict === "above" ? <TrendingUp size={9} color={color} /> : verdict === "below" ? <TrendingDown size={9} color={color} /> : null}
          <span style={{ fontSize: 10, fontWeight: 700, color, ...mono }}>{pct >= 0 ? "+" : ""}{pct.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════════════════════

function SectionHeader({ icon: Icon, color, title, count, delay, tip }: {
  icon: any; color: string; title: string; count?: number; delay: number; tip?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, ...fadeUp(delay) }}>
      <div style={{
        width: 26, height: 26, borderRadius: 7,
        background: `${color}0c`, border: `1px solid ${color}15`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={12} color={color} />
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>{title}</span>
      {count !== undefined && (
        <span style={{ fontSize: 11, fontWeight: 700, color, ...mono, padding: "1px 7px", borderRadius: 5, background: `${color}0c` }}>{count}</span>
      )}
      {tip && <Tip text={tip} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORE BREAKDOWN BAR
// ═══════════════════════════════════════════════════════════════════════════

const BREAKDOWN_TIPS: Record<string, string> = {
  ROAS: "Mede quanto de receita você está gerando por R$ investido. Sem pixel de conversão, usamos um score neutro (17/35).",
  CPA: "Custo por cada ação/conversão. Sem dados de conversão, usamos score neutro (12/25). Configure seu pixel para melhorar esta métrica.",
  CTR: "Baseado no CTR médio dos seus anúncios. 20/20 = seu CTR está excelente comparado ao mercado.",
  "Eficiência Orçamento": "% do orçamento gasto em anúncios de baixa performance. Menos desperdício = score mais alto.",
  "Saúde Criativa": "Proporção de anúncios escaláveis vs fatigados. Mais criativos bons = score mais alto.",
};

function BreakdownBar({ label, score, max, delay, hasData = true }: {
  label: string; score: number; max: number; delay: number; hasData?: boolean;
}) {
  const pct = max > 0 ? score / max : 0;
  const color = pct >= 0.7 ? T.green : pct >= 0.4 ? T.accent : T.red;
  const tag = !hasData ? "Sem dados" : pct >= 0.7 ? "Bom" : pct >= 0.4 ? "Regular" : "Baixo";
  const tagColor = !hasData ? T.textMuted : color;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9, ...fadeUp(delay) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, width: 130, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>{label}</span>
        {BREAKDOWN_TIPS[label] && <Tip text={BREAKDOWN_TIPS[label]} />}
      </div>
      <div style={{ flex: 1, height: 5, background: T.borderSubtle, borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3,
          background: hasData ? `linear-gradient(90deg, ${color}80, ${color})` : `${T.textMuted}30`,
          width: `${pct * 100}%`,
          transition: "width 1.5s cubic-bezier(.16,1,.3,1)",
          ...(hasData ? { boxShadow: `0 0 6px ${color}30` } : {}),
        }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, width: 38, textAlign: "right", ...mono }}>{score}/{max}</span>
      <span style={{ fontSize: 9, fontWeight: 600, color: tagColor, textTransform: "uppercase", letterSpacing: ".06em", width: 55, textAlign: "right" }}>{tag}</span>
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
    for (const ad of data.ads_to_pause.filter(a => !pausedIds.has(a.ad_id))) {
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
      <div style={{ minHeight: "100vh", background: T.surface0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font }}>
        <style>{ANIM_CSS}</style>
        <div style={{ textAlign: "center", maxWidth: 380, padding: 24 }}>
          <div style={{
            width: 60, height: 60, margin: "0 auto 24px", borderRadius: 14, position: "relative",
            background: `${T.accent}08`, border: `1px solid ${T.accent}15`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              position: "absolute", inset: -8, borderRadius: 18,
              border: `2px solid ${T.accent}10`,
              animation: "glowPulse 2s ease-in-out infinite",
            }} />
            <Loader2 size={22} color={T.accent} style={{ animation: "spin 1s linear infinite" }} />
          </div>

          <h2 style={{ fontSize: 19, fontWeight: 800, color: T.textPrimary, marginBottom: 5, letterSpacing: "-.02em" }}>
            Analisando sua conta
          </h2>
          <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 24 }}>Isso leva ~15 segundos</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
            {LOADING_STEPS.map((step, i) => {
              const active = i === loadingStep;
              const done = i < loadingStep;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 9,
                  background: active ? `${T.accent}06` : "transparent",
                  border: active ? `1px solid ${T.accent}10` : "1px solid transparent",
                  opacity: done || active ? 1 : 0.3,
                  transition: "all .4s cubic-bezier(.16,1,.3,1)",
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: done ? `${T.green}0c` : active ? `${T.accent}0c` : T.borderSubtle,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: `1px solid ${done ? T.green + "18" : active ? T.accent + "18" : "transparent"}`,
                  }}>
                    {done ? <Check size={11} color={T.green} /> : active ? <Loader2 size={11} color={T.accent} style={{ animation: "spin 1s linear infinite" }} /> : <div style={{ width: 4, height: 4, borderRadius: 2, background: T.textMuted }} />}
                  </div>
                  <span style={{ fontSize: 12, color: active ? T.textPrimary : done ? T.textSecondary : T.textMuted, fontWeight: active ? 600 : 400 }}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 20, height: 3, background: T.borderSubtle, borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              background: `linear-gradient(90deg, ${T.accent}70, ${T.accent})`,
              width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%`,
              transition: "width .8s cubic-bezier(.16,1,.3,1)",
              boxShadow: `0 0 10px ${T.accent}30`,
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
      <div style={{ minHeight: "100vh", background: T.surface0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font }}>
        <style>{ANIM_CSS}</style>
        <div style={{ textAlign: "center", maxWidth: 400, padding: 24 }}>
          <div style={{
            width: 52, height: 52, margin: "0 auto 18px", borderRadius: 14,
            background: `${T.red}08`, border: `1px solid ${T.red}15`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={22} color={T.red} />
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: T.textPrimary, marginBottom: 8 }}>Erro no diagnóstico</h2>
          <div style={{ ...card(2), padding: "10px 14px", marginBottom: 18, textAlign: "left" }}>
            <p style={{ fontSize: 11, color: T.red, ...mono, margin: 0, wordBreak: "break-all", lineHeight: 1.5 }}>{error}</p>
          </div>
          <button onClick={() => navigate("/dashboard/accounts")} style={{ padding: "9px 18px", borderRadius: 8, ...card(2), color: T.textPrimary, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: T.font }}>
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
      <div style={{ minHeight: "100vh", background: T.surface0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font }}>
        <style>{ANIM_CSS}</style>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <div style={{
            width: 52, height: 52, margin: "0 auto 18px", borderRadius: 14,
            background: `${T.amber}08`, border: `1px solid ${T.amber}15`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <BarChart3 size={22} color={T.amber} />
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: T.textPrimary, marginBottom: 8, letterSpacing: "-.02em" }}>
            {data ? "Dados insuficientes" : "Conecte sua conta Meta Ads"}
          </h2>
          <p style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6, marginBottom: 22 }}>
            {data
              ? `Sua conta tem ${data.metrics.active_ads} anúncio(s) e R$${data.metrics.total_spend.toFixed(0)} de spend nos últimos 30 dias. Precisamos de pelo menos 2 anúncios e R$50 de spend para gerar um diagnóstico completo.`
              : "Para gerar seu diagnóstico, conecte uma conta Meta Ads na página de Contas."}
          </p>
          <button onClick={() => navigate("/dashboard/accounts")} style={{
            padding: "10px 22px", borderRadius: 8, fontFamily: T.font,
            background: T.accent, color: "#fff", fontSize: 13, fontWeight: 700,
            border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
            boxShadow: `0 0 16px ${T.accent}25`,
          }}>
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
  const savedMoney = data.ads_to_pause.filter(a => pausedIds.has(a.ad_id)).reduce((s, a) => s + a.spend, 0);

  const ctrDisplay = (data.metrics.avg_ctr * 100).toFixed(2);
  const hasRevenue = data.metrics.total_revenue > 0;
  const hasConversions = data.metrics.total_conversions > 0;

  return (
    <div style={{ minHeight: "100vh", background: T.surface0, fontFamily: T.font }}>
      <style>{ANIM_CSS}</style>

      {/* Radial glow at top */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 500, pointerEvents: "none",
        background: data.wasted_spend > 0
          ? `radial-gradient(ellipse 70% 45% at 50% -10%, ${T.red}06 0%, transparent 70%)`
          : `radial-gradient(ellipse 70% 45% at 50% -10%, ${T.accent}04 0%, transparent 70%)`,
      }} />

      <div style={{ position: "relative", maxWidth: 700, margin: "0 auto", padding: "24px 20px 80px" }}>

        {/* ── Header ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, ...fadeUp(0) }}>
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 800, color: T.textPrimary, margin: 0, letterSpacing: "-.02em" }}>
              Diagnóstico da Conta
            </h1>
            <p style={{ fontSize: 12, color: T.textMuted, margin: "4px 0 0" }}>
              {data.ad_account_name}
              <span style={{ color: T.borderLight }}> · </span>
              Últimos {data.period_days} dias
              <span style={{ color: T.borderLight }}> · </span>
              <span style={mono}>{data.metrics.active_ads} ads</span>
            </p>
          </div>
          <button onClick={() => window.location.reload()} style={{
            padding: "7px 12px", borderRadius: 8, ...card(2), color: T.textMuted,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, fontFamily: T.font,
          }}>
            <RefreshCw size={11} /> Atualizar
          </button>
        </div>

        {/* ── HERO ──────────────────────────────────────────────────── */}
        <div style={{
          ...card(1), padding: "32px 24px", marginBottom: 14, position: "relative", overflow: "hidden", textAlign: "center",
          ...fadeUp(80),
        }}>
          <div style={{
            position: "absolute", top: "-40%", left: "50%", transform: "translateX(-50%)",
            width: "120%", height: "80%", pointerEvents: "none",
            background: data.wasted_spend > 0
              ? `radial-gradient(ellipse, ${T.red}08 0%, transparent 70%)`
              : `radial-gradient(ellipse, ${T.green}05 0%, transparent 70%)`,
          }} />

          {data.wasted_spend > 0 ? (
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 10 }}>
                <AlertTriangle size={13} color={T.red} />
                <span style={{ fontSize: 10, fontWeight: 700, color: T.red, textTransform: "uppercase", letterSpacing: ".1em" }}>
                  Dinheiro desperdiçado em 30 dias
                </span>
                <Tip text="Soma total do investimento em anúncios que nossa análise identificou como de baixa performance e deveriam ser pausados." />
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 600, color: T.textMuted, ...mono, marginRight: 4 }}>R$</span>
                <span style={{
                  fontSize: 52, fontWeight: 900, color: T.textPrimary, ...mono,
                  animation: "countUp .8s ease-out",
                  textShadow: data.wasted_spend > 500 ? `0 0 24px ${T.red}20` : "none",
                }}>{animatedWaste.toLocaleString("pt-BR")}</span>
              </div>
              <p style={{ fontSize: 12, color: T.textMuted, margin: "0 0 14px" }}>
                em <span style={{ color: T.textPrimary, fontWeight: 700 }}>{data.ads_to_pause.length}</span> anúncio{data.ads_to_pause.length > 1 ? "s" : ""} que deveria{data.ads_to_pause.length > 1 ? "m" : ""} ser pausado{data.ads_to_pause.length > 1 ? "s" : ""}
              </p>
              {data.projected_roas && data.current_roas && data.roas_improvement_pct ? (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "7px 14px", borderRadius: 8,
                  background: `${T.green}06`, border: `1px solid ${T.green}12`,
                }}>
                  <TrendingUp size={12} color={T.green} />
                  <span style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>ROAS:</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: T.textPrimary, ...mono }}>{data.current_roas.toFixed(2)}x</span>
                  <ArrowRight size={11} color={T.textMuted} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: T.green, ...mono }}>{data.projected_roas.toFixed(2)}x</span>
                  <span style={{ fontSize: 10, color: T.green, ...mono }}>(+{data.roas_improvement_pct.toFixed(0)}%)</span>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6 }}>
                <Check size={14} color={T.green} />
                <span style={{ fontSize: 10, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: ".1em" }}>
                  Conta saudável
                </span>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, margin: 0 }}>
                Nenhum anúncio precisa ser pausado agora
              </p>
            </div>
          )}
        </div>

        {/* ── Score + Quick Metrics ────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, marginBottom: 14 }}>
          <div style={{
            ...card(1), padding: "22px 26px",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            position: "relative", overflow: "hidden", ...fadeUp(160),
          }}>
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: `radial-gradient(ellipse 70% 50% at 50% 30%, ${data.score >= 70 ? T.green : data.score >= 40 ? T.accent : T.red}06 0%, transparent 70%)`,
            }} />
            <ScoreRing score={data.score} />
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 10 }}>
              <span style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>
                Account Health
              </span>
              <Tip text="Score de 0 a 100 calculado com base em 5 métricas: ROAS (35pts), CPA (25pts), CTR (20pts), eficiência de budget (10pts) e saúde criativa (10pts)." />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <MetricCard icon={DollarSign} label="Spend total" value={`R$${data.metrics.total_spend.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
              sub={`${data.metrics.active_campaigns} campanhas`} color={T.textPrimary} delay={200} tipKey="spend" />
            <MetricCard icon={MousePointerClick} label="CTR médio" value={`${ctrDisplay}%`}
              sub={`vs 1.50% benchmark`}
              color={data.benchmarks.ctr?.verdict === "above" ? T.green : data.benchmarks.ctr?.verdict === "below" ? T.red : T.accent}
              delay={240} tipKey="ctr" />
            <MetricCard icon={Eye} label="Impressões"
              value={data.metrics.total_impressions >= 1e6 ? `${(data.metrics.total_impressions / 1e6).toFixed(1)}M`
                : data.metrics.total_impressions >= 1e3 ? `${(data.metrics.total_impressions / 1e3).toFixed(1)}K`
                : String(data.metrics.total_impressions)}
              sub={`CPM R$${data.metrics.avg_cpm.toFixed(2)}`} color={T.textPrimary} delay={280} tipKey="impressions" />
            <MetricCard icon={Target} label="Conversões" value={String(data.metrics.total_conversions)}
              sub={hasConversions ? `CPA R$${(data.metrics.total_spend / data.metrics.total_conversions).toFixed(0)}` : "Configure pixel para rastrear"}
              color={hasConversions ? T.green : T.textMuted} delay={320} tipKey="conversions" />
          </div>
        </div>

        {/* ── Score Breakdown ──────────────────────────────────────── */}
        <div style={{ ...card(1), padding: "16px 16px 10px", marginBottom: 14, ...fadeUp(360) }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>Score Breakdown</span>
              <Tip text="Cada componente contribui para o score total. Componentes marcados 'Sem dados' usam valores neutros — conecte seu pixel de conversão para dados completos." />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: T.textPrimary, ...mono }}>
              {data.score}<span style={{ color: T.textMuted, fontWeight: 500 }}>/100</span>
            </span>
          </div>
          <BreakdownBar label="ROAS" score={data.score_breakdown.roas_score} max={35} delay={400} hasData={hasRevenue} />
          <BreakdownBar label="CPA" score={data.score_breakdown.cpa_score} max={25} delay={430} hasData={hasConversions} />
          <BreakdownBar label="CTR" score={data.score_breakdown.ctr_score} max={20} delay={460} />
          <BreakdownBar label="Eficiência Orçamento" score={data.score_breakdown.budget_efficiency} max={10} delay={490} />
          <BreakdownBar label="Saúde Criativa" score={data.score_breakdown.creative_health} max={10} delay={520} />
        </div>

        {/* ── Benchmarks ───────────────────────────────────────────── */}
        <div style={{ ...card(1), padding: 16, marginBottom: 14, ...fadeUp(550) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <BarChart3 size={13} color={T.accent} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>vs Benchmark do Mercado</span>
            <Tip text="Comparamos suas métricas com a média do mercado de Meta Ads. Verde = acima da média, vermelho = abaixo." />
          </div>
          <BenchmarkRow label="CTR" yours={data.benchmarks.ctr.yours} benchmark={data.benchmarks.ctr.benchmark} verdict={data.benchmarks.ctr.verdict} format={v => `${(v * 100).toFixed(2)}%`} />
          <BenchmarkRow label="CPM" yours={data.benchmarks.cpm.yours} benchmark={data.benchmarks.cpm.benchmark} verdict={data.benchmarks.cpm.verdict} format={v => `R$${v.toFixed(2)}`} />
          <BenchmarkRow label="CPC" yours={data.benchmarks.cpc.yours} benchmark={data.benchmarks.cpc.benchmark} verdict={data.benchmarks.cpc.verdict} format={v => `R$${v.toFixed(2)}`} />
          <BenchmarkRow label="Frequência" yours={data.benchmarks.frequency.yours} benchmark={data.benchmarks.frequency.benchmark} verdict={data.benchmarks.frequency.verdict} format={v => `${v.toFixed(1)}x`} />
        </div>

        {/* ── Ads to Pause ─────────────────────────────────────────── */}
        {data.ads_to_pause.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <SectionHeader icon={Pause} color={T.red} title="Anúncios para pausar" count={unpausedAds.length} delay={600}
                tip="Anúncios com ROAS muito baixo, zero conversões com gasto alto, ou CPA acima de R$200. Pausar eles libera orçamento para os que funcionam." />
              {unpausedAds.length > 1 && (
                <button onClick={handleBatchPause} disabled={batchPausing || unpausedAds.length === 0} style={{
                  padding: "6px 14px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                  background: `${T.red}0c`, color: T.red, border: `1px solid ${T.red}18`,
                  cursor: batchPausing ? "not-allowed" : "pointer", fontFamily: T.font,
                  display: "flex", alignItems: "center", gap: 4, ...fadeUp(610),
                }}>
                  {batchPausing ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Pause size={11} />}
                  Pausar todos
                </button>
              )}
            </div>
            {pausedIds.size > 0 && (
              <div style={{ ...card(2), padding: "9px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 7, border: `1px solid ${T.green}15` }}>
                <Check size={13} color={T.green} />
                <span style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>{pausedIds.size} pausado{pausedIds.size > 1 ? "s" : ""}</span>
                <span style={{ color: T.textMuted }}>—</span>
                <span style={{ fontSize: 12, color: T.textPrimary, fontWeight: 700, ...mono }}>R${savedMoney.toFixed(0)}/mês economizados</span>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {(showAllPause ? data.ads_to_pause : data.ads_to_pause.slice(0, 5)).map((ad, i) => (
                <AdRow key={ad.ad_id} ad={ad} type="pause" onPause={handlePause} pausingId={pausingId} isPaused={pausedIds.has(ad.ad_id)} delay={630 + i * 30} />
              ))}
            </div>
            {data.ads_to_pause.length > 5 && (
              <button onClick={() => setShowAllPause(!showAllPause)} style={{
                marginTop: 8, background: "none", border: "none", color: T.accent, fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: T.font, display: "flex", alignItems: "center", gap: 3,
              }}>
                {showAllPause ? <><ChevronUp size={12} /> Mostrar menos</> : <><ChevronDown size={12} /> Ver todos ({data.ads_to_pause.length})</>}
              </button>
            )}
          </div>
        )}

        {/* ── Ads to Scale ─────────────────────────────────────────── */}
        {data.ads_to_scale.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <SectionHeader icon={TrendingUp} color={T.green} title="Anúncios para escalar" count={data.ads_to_scale.length} delay={750}
              tip="Anúncios com KPI primário acima do threshold e spend acima de R$10. Eles estão performando — aumentar o orçamento pode trazer mais resultados." />
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }}>
              {(showAllScale ? data.ads_to_scale : data.ads_to_scale.slice(0, 5)).map((ad, i) => (
                <AdRow key={ad.ad_id} ad={ad} type="scale" delay={770 + i * 30} />
              ))}
            </div>
            {data.ads_to_scale.length > 5 && (
              <button onClick={() => setShowAllScale(!showAllScale)} style={{
                marginTop: 8, background: "none", border: "none", color: T.accent, fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: T.font, display: "flex", alignItems: "center", gap: 3,
              }}>
                {showAllScale ? <><ChevronUp size={12} /> Mostrar menos</> : <><ChevronDown size={12} /> Ver todos ({data.ads_to_scale.length})</>}
              </button>
            )}
          </div>
        )}

        {/* ── Fatigued Ads ─────────────────────────────────────────── */}
        {data.ads_fatigued.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <SectionHeader icon={Flame} color={T.amber} title="Em fadiga criativa" count={data.ads_fatigued.length} delay={850}
              tip="Anúncios com frequência acima de 3.5x — ou seja, cada pessoa já viu o anúncio mais de 3 vezes. Troque o criativo para recuperar performance." />
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }}>
              {(showAllFatigued ? data.ads_fatigued : data.ads_fatigued.slice(0, 4)).map((ad, i) => (
                <AdRow key={ad.ad_id} ad={ad} type="fatigued" delay={870 + i * 30} />
              ))}
            </div>
            {data.ads_fatigued.length > 4 && (
              <button onClick={() => setShowAllFatigued(!showAllFatigued)} style={{
                marginTop: 8, background: "none", border: "none", color: T.accent, fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: T.font, display: "flex", alignItems: "center", gap: 3,
              }}>
                {showAllFatigued ? <><ChevronUp size={12} /> Mostrar menos</> : <><ChevronDown size={12} /> Ver todos ({data.ads_fatigued.length})</>}
              </button>
            )}
          </div>
        )}

        {/* ── Top Performers ───────────────────────────────────────── */}
        {data.top_performers.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <SectionHeader icon={Crown} color={T.accent} title="Top performers" count={data.top_performers.length} delay={950}
              tip="Seus melhores anúncios — KPI primário acima do threshold e sem problemas. São referência para novos criativos." />
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }}>
              {data.top_performers.slice(0, 5).map((ad, i) => (
                <AdRow key={ad.ad_id} ad={ad} type="top" delay={970 + i * 30} />
              ))}
            </div>
          </div>
        )}

        {/* ── AI Insights ──────────────────────────────────────────── */}
        {data.insights.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <SectionHeader icon={Sparkles} color={T.accent} title="Insights da IA" delay={1050}
              tip="A IA analisou todos os dados numéricos e gerou 3 recomendações contextualizadas. Todos os números citados vêm dos seus dados reais." />
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 10 }}>
              {data.insights.map((insight, i) => (
                <InsightCard key={i} insight={insight} delay={1070 + i * 60} />
              ))}
            </div>
          </div>
        )}

        {/* ── CTA Footer ──────────────────────────────────────────── */}
        <div style={{
          ...card(1), padding: "26px 22px", marginTop: 28, textAlign: "center",
          position: "relative", overflow: "hidden", ...fadeUp(1200),
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 1,
            background: `linear-gradient(90deg, transparent, ${T.accent}30, transparent)`,
          }} />
          <div style={{
            position: "absolute", top: "-50%", left: "50%", transform: "translateX(-50%)",
            width: "100%", height: "100%", pointerEvents: "none",
            background: `radial-gradient(ellipse 60% 50% at 50% 0%, ${T.accent}04 0%, transparent 70%)`,
          }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, margin: "0 0 5px", position: "relative" }}>
            Quer ir mais fundo?
          </p>
          <p style={{ fontSize: 12, color: T.textMuted, margin: "0 0 16px", position: "relative" }}>
            Converse com a IA sobre seus resultados — ela conhece cada detalhe da sua conta.
          </p>
          <button onClick={() => navigate("/dashboard/ai")} style={{
            padding: "10px 24px", borderRadius: 8, fontFamily: T.font,
            background: T.accent, color: "#fff", fontSize: 13, fontWeight: 700,
            border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
            boxShadow: `0 0 20px ${T.accent}25`, position: "relative",
          }}>
            Abrir AI Chat <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
