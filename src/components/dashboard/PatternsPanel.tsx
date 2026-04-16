/**
 * PatternsPanel — "O QUE FUNCIONA" — Core intelligence section.
 *
 * DESIGN v3: High contrast, readable at low brightness.
 * - L1 text: #F0F6FC (titles, metrics)
 * - L2 text: rgba(255,255,255,0.70) (content)
 * - L3 text: rgba(255,255,255,0.40) (hints)
 * - Content bg: #0D1117 (elevated from page #06080C)
 * - Colors at full signal strength
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const F = "'Inter', 'Plus Jakarta Sans', sans-serif";
const M = "'Inter', 'Plus Jakarta Sans', sans-serif"; // metrics use same clean typeface, tabular-nums via style

// ── Text hierarchy constants ──
const L1 = "#F0F6FC";          // titles, key info — bright white
const L2 = "rgba(255,255,255,0.70)"; // content — clearly readable
const L3 = "rgba(255,255,255,0.40)"; // hints, meta — visible but subtle

interface DetectedPattern {
  id?: string;
  pattern_key: string;
  label: string;
  feature_type?: string;
  feature_value?: string;
  variables?: Record<string, string>;
  avg_ctr: number | null;
  avg_cpc?: number | null;
  avg_roas?: number | null;
  sample_size: number;
  confidence: number;
  is_winner: boolean;
  impact_ctr_pct?: string;
  impact_roas_pct?: string;
  insight_text: string | null;
  top_ads?: { ad_id: string; ad_name: string; ctr: number; thumbnail_url: string | null }[];
}

interface PatternsPanelProps {
  userId: string | undefined;
  personaId: string | undefined;
  onGenerateVariation?: (pattern: DetectedPattern) => void;
  onPatternsLoaded?: (count: number) => void;
  compact?: boolean;
}

// ── Humanization helpers ──

const HOOK_TYPE_LABELS: Record<string, string> = {
  urgency: "Urgência", question: "Pergunta", curiosity: "Curiosidade",
  social_proof: "Prova social", benefit: "Benefício direto", pain_point: "Dor do cliente",
  storytelling: "Storytelling", statistic: "Estatística", testimonial: "Depoimento",
  cta: "Chamada para ação", humor: "Humor", controversy: "Controvérsia",
  fear: "Medo", authority: "Autoridade", scarcity: "Escassez",
  newness: "Novidade", comparison: "Comparação", emotional: "Emocional",
};

const FORMAT_LABELS: Record<string, string> = {
  video: "Vídeo", image: "Imagem", carousel: "Carrossel", ugc: "UGC",
  static: "Estático", reels: "Reels", stories: "Stories",
};

const TEXT_DENSITY_LABELS: Record<string, string> = {
  low: "Pouco texto", medium: "Texto moderado", high: "Muito texto", none: "Sem texto",
};

function humanizeHookType(raw: string): string {
  return HOOK_TYPE_LABELS[raw.toLowerCase()] || raw.charAt(0).toUpperCase() + raw.slice(1);
}
function humanizeFormat(raw: string): string {
  return FORMAT_LABELS[raw.toLowerCase()] || raw.charAt(0).toUpperCase() + raw.slice(1);
}
function humanizeTextDensity(raw: string): string {
  return TEXT_DENSITY_LABELS[raw.toLowerCase()] || raw;
}

/** Detect if insight_text is raw/debug data that should NOT be shown */
function isRawInsightText(text: string): boolean {
  if (/CTR \d+\.\d{4,}/.test(text)) return true;
  if (/ROAS null/i.test(text)) return true;
  if (/em meta:/i.test(text)) return true;
  if (/\bnull\b/.test(text)) return true;
  if (/^[a-z_]+:[a-z_]+$/i.test(text.trim())) return true;
  return false;
}

/**
 * Parse AI-generated insight_text.
 * Format from detect-patterns: "TITLE || INSIGHT" or legacy plain text.
 */
function parseAiInsight(insightText: string | null): { title: string | null; explanation: string | null } {
  if (!insightText || insightText.length < 5 || isRawInsightText(insightText)) {
    return { title: null, explanation: null };
  }
  // New format: "Title || Explanation"
  if (insightText.includes(" || ")) {
    const [title, ...rest] = insightText.split(" || ");
    const explanation = rest.join(" || ").trim();
    const cleanTitle = title.trim();
    if (cleanTitle.length > 5 && !isRawInsightText(cleanTitle)) {
      return {
        title: cleanTitle.length > 80 ? cleanTitle.slice(0, 77) + "..." : cleanTitle,
        explanation: explanation.length > 5 && !isRawInsightText(explanation) ? explanation : null,
      };
    }
  }
  // Legacy: plain text — use as explanation if short, or title if very short
  if (insightText.length <= 80 && !isRawInsightText(insightText)) {
    return { title: insightText, explanation: null };
  }
  if (!isRawInsightText(insightText)) {
    return { title: null, explanation: insightText.length > 200 ? insightText.slice(0, 197) + "..." : insightText };
  }
  return { title: null, explanation: null };
}

function humanizePatternLabel(p: DetectedPattern): string {
  // 1. AI-generated title is ALWAYS preferred — it explains the WHY
  const ai = parseAiInsight(p.insight_text);
  if (ai.title) return ai.title;

  // 2. Structured fallback per feature_type (still descriptive)
  const featureType = p.feature_type || p.variables?.feature_type || "";
  const featureValue = p.feature_value || p.variables?.feature_value || "";
  const ctrStr = p.avg_ctr != null && p.avg_ctr > 0 ? ` — CTR ${formatCtr(p.avg_ctr)}` : "";

  switch (featureType) {
    case "hook_type": return `Hook com ${humanizeHookType(featureValue).toLowerCase()} performa melhor${ctrStr}`;
    case "hook_presence": return featureValue === "with_hook"
      ? `Anúncios com hook geram mais cliques${ctrStr}`
      : `Anúncios sem hook nesta conta${ctrStr}`;
    case "format": return `${humanizeFormat(featureValue)} supera outros formatos${ctrStr}`;
    case "text_density": return `${humanizeTextDensity(featureValue)} gera mais resultado${ctrStr}`;
    case "campaign": return `Campanha "${featureValue}" se destaca${ctrStr}`;
    case "adset": return `Público "${featureValue}" converte melhor${ctrStr}`;
    case "gap": return `Formato ${humanizeFormat(featureValue)} ainda não testado — oportunidade`;
    case "deviation": return p.label || `Desvio de performance detectado${ctrStr}`;
    case "combination": {
      const parts = featureValue.split("+");
      const formatted = parts.map((part) => {
        const trimmed = part.trim();
        if (trimmed === "hook") return "com hook";
        if (trimmed === "no_hook") return "sem hook";
        return humanizeFormat(trimmed);
      });
      return `${formatted.join(" + ")} é a combinação vencedora${ctrStr}`;
    }
    case "status": return `Status: ${featureValue}`;
    default: {
      // Try pattern_key extraction
      if (p.pattern_key) {
        const parts = p.pattern_key.split(":");
        if (parts.length >= 4) {
          const ft = parts[2] || "";
          const fv = parts[3] || "";
          if (ft === "hook_type") return `Hook com ${humanizeHookType(fv).toLowerCase()} se destaca`;
          if (ft === "format") return `Formato ${humanizeFormat(fv)} se destaca`;
          if (ft === "hook_presence") return fv === "with_hook" ? "Anúncios com hook performam melhor" : "Anúncios sem hook";
          if (ft === "text_density") return `${humanizeTextDensity(fv)} gera mais resultado`;
          if (ft && fv) return `${ft.replace(/_/g, " ")}: ${fv.replace(/_/g, " ")}`;
        }
      }
      if (p.is_winner && p.avg_ctr != null && p.avg_ctr > 0) return `Padrão vencedor em ${pluralAds(p.sample_size)}`;
      return `Sinal detectado em ${pluralAds(p.sample_size)}`;
    }
  }
}

/** Generate explanation — prefers AI insight, falls back to structured */
function patternExplanation(p: DetectedPattern): string | null {
  // 1. AI explanation is preferred
  const ai = parseAiInsight(p.insight_text);
  if (ai.explanation) return ai.explanation;

  // 2. Structured fallback
  const featureType = p.feature_type || p.variables?.feature_type || "";
  const impactNum = parseFloat(p.impact_ctr_pct || "0");
  const impactStr = impactNum > 0 ? `+${p.impact_ctr_pct} acima da média` : impactNum < 0 ? `${p.impact_ctr_pct} abaixo da média` : "";

  if (featureType === "hook_type") return impactStr ? `Tende a gerar mais cliques nos primeiros segundos · ${impactStr}` : "Tende a gerar mais cliques nos primeiros segundos";
  if (featureType === "hook_presence") return "Hooks capturam atenção e aumentam taxa de clique";
  if (featureType === "format") return impactStr ? `Este formato se destaca na sua conta · ${impactStr}` : "Este formato tem performance superior na sua conta";
  if (featureType === "text_density") return "A densidade de texto influencia diretamente o CTR";
  if (featureType === "gap") return "Testar este formato pode revelar novas oportunidades";
  if (featureType === "combination") return impactStr ? `Esta combinação supera outras · ${impactStr}` : "Esta combinação tem performance acima das demais";
  if (featureType === "campaign" || featureType === "adset") return impactStr || "Performance consistente acima da média da conta";
  if (impactStr) return impactStr;
  return null;
}

function formatCtr(value: number): string {
  const pct = value > 1 ? value : value * 100;
  return pct.toFixed(1) + "%";
}

// ── Performance status — every metric gets judged ──
type MetricStatus = "forte" | "bom" | "neutro";

interface HeroMetric {
  label: string;       // "Retenção", "ROAS", "CPC", "CTR"
  value: string;       // "+23%", "3.2x", "R$1.40", "4.1%"
  context: string;     // "acima da média da conta", "retorno sólido", etc.
  status: MetricStatus;
  color: string;       // semantic: green=forte, soft-green=bom, amber=neutro
}

const STATUS_COLORS: Record<MetricStatus, string> = {
  forte: "#4ADE80",    // strong green
  bom: "#86EFAC",      // soft green
  neutro: "#FBBF24",   // amber
};

const STATUS_LABELS: Record<MetricStatus, string> = {
  forte: "forte",
  bom: "bom",
  neutro: "neutro",
};

/** Evaluate the ONE hero metric for a pattern — returns null if not worth showing.
 *
 * INTELLIGENCE LAYER:
 * 1. Select the right metric for this pattern type
 * 2. Judge its quality against account context (impact_pct = deviation from avg)
 * 3. If weak → return null → pattern won't display a metric
 * 4. Always include comparison context so the user understands WHY
 */
function evaluateHeroMetric(p: DetectedPattern): HeroMetric | null {
  const ft = p.feature_type || p.variables?.feature_type || "";
  const ctr = p.avg_ctr != null && p.avg_ctr > 0 ? (p.avg_ctr > 1 ? p.avg_ctr : p.avg_ctr * 100) : 0;
  const roas = p.avg_roas != null && p.avg_roas > 0 ? p.avg_roas : 0;
  const cpc = p.avg_cpc != null && p.avg_cpc > 0 ? p.avg_cpc : 0;
  const impactCtr = parseFloat(p.impact_ctr_pct || "0");
  const impactRoas = parseFloat(p.impact_roas_pct || "0");

  // ── Helper: classify impact strength ──
  function classifyImpact(pct: number): MetricStatus | null {
    if (pct >= 20) return "forte";
    if (pct >= 5) return "bom";
    if (pct > 0) return "neutro";
    return null; // negative or zero = not worth showing
  }

  function classifyRoas(val: number): MetricStatus | null {
    if (val >= 4.0) return "forte";
    if (val >= 2.0) return "bom";
    if (val >= 1.0) return "neutro";
    return null;
  }

  function classifyCtr(val: number): MetricStatus | null {
    if (val >= 4.0) return "forte";
    if (val >= 2.5) return "bom";
    if (val >= 1.5) return "neutro";
    return null;
  }

  function impactContext(pct: number): string {
    if (pct >= 20) return "muito acima da média da conta";
    if (pct >= 5) return "acima da média da conta";
    if (pct > 0) return "levemente acima da média";
    return "";
  }

  // ── Hook patterns → retention / attention ──
  if (ft === "hook_type" || ft === "hook_presence") {
    if (impactCtr > 0) {
      const status = classifyImpact(impactCtr);
      if (!status) return null;
      return { label: "Retenção", value: `+${p.impact_ctr_pct}`, context: impactContext(impactCtr), status, color: STATUS_COLORS[status] };
    }
    const ctrStatus = classifyCtr(ctr);
    if (!ctrStatus || ctrStatus === "neutro") return null; // only strong CTR for hooks
    return { label: "CTR", value: formatCtr(p.avg_ctr!), context: ctr >= 4.0 ? "taxa de clique excelente" : "boa taxa de clique", status: ctrStatus, color: STATUS_COLORS[ctrStatus] };
  }

  // ── Format / combination → efficiency (ROAS > CPC > impact) ──
  if (ft === "format" || ft === "combination") {
    if (roas > 0) {
      const status = classifyRoas(roas);
      if (!status) return null;
      const ctx = roas >= 4.0 ? "retorno excepcional" : roas >= 2.0 ? "retorno sólido" : "retorno positivo";
      return { label: "ROAS", value: `${roas.toFixed(1)}x`, context: ctx, status, color: STATUS_COLORS[status] };
    }
    if (impactRoas > 0) {
      const status = classifyImpact(impactRoas);
      if (!status) return null;
      return { label: "ROAS", value: `+${p.impact_roas_pct}`, context: impactContext(impactRoas), status, color: STATUS_COLORS[status] };
    }
    if (impactCtr > 0) {
      const status = classifyImpact(impactCtr);
      if (!status) return null;
      return { label: "Impacto", value: `+${p.impact_ctr_pct}`, context: impactContext(impactCtr), status, color: STATUS_COLORS[status] };
    }
    return null;
  }

  // ── Campaign / adset → ROI ──
  if (ft === "campaign" || ft === "adset") {
    if (roas > 0) {
      const status = classifyRoas(roas);
      if (!status) return null;
      const ctx = roas >= 4.0 ? "ROI excepcional" : roas >= 2.0 ? "ROI sólido" : "ROI positivo";
      return { label: "ROAS", value: `${roas.toFixed(1)}x`, context: ctx, status, color: STATUS_COLORS[status] };
    }
    if (impactCtr > 0) {
      const status = classifyImpact(impactCtr);
      if (!status) return null;
      return { label: "Performance", value: `+${p.impact_ctr_pct}`, context: impactContext(impactCtr), status, color: STATUS_COLORS[status] };
    }
    return null;
  }

  // ── Text density → CTR ──
  if (ft === "text_density") {
    if (impactCtr > 0) {
      const status = classifyImpact(impactCtr);
      if (!status) return null;
      return { label: "CTR", value: `+${p.impact_ctr_pct}`, context: impactContext(impactCtr), status, color: STATUS_COLORS[status] };
    }
    const ctrStatus = classifyCtr(ctr);
    if (!ctrStatus || ctrStatus === "neutro") return null;
    return { label: "CTR", value: formatCtr(p.avg_ctr!), context: "boa taxa de clique", status: ctrStatus, color: STATUS_COLORS[ctrStatus] };
  }

  // ── Gap → opportunity, no metric needed ──
  if (ft === "gap") return null;

  // ── Fallback: pick strongest signal that's actually good ──
  if (roas >= 2.0) {
    const status = classifyRoas(roas)!;
    return { label: "ROAS", value: `${roas.toFixed(1)}x`, context: roas >= 4.0 ? "retorno excepcional" : "retorno sólido", status, color: STATUS_COLORS[status] };
  }
  if (impactCtr >= 5) {
    const status = classifyImpact(impactCtr)!;
    return { label: "Impacto", value: `+${p.impact_ctr_pct}`, context: impactContext(impactCtr), status, color: STATUS_COLORS[status] };
  }
  if (ctr >= 2.5) {
    const status = classifyCtr(ctr)!;
    return { label: "CTR", value: formatCtr(p.avg_ctr!), context: "taxa de clique acima da média", status, color: STATUS_COLORS[status] };
  }
  return null; // nothing strong enough to show
}

function formatConfidence(confidence: number): { label: string; color: string } {
  const pct = Math.round(confidence * 100);
  if (pct >= 70) return { label: "Alta confiança", color: "#4ADE80" };
  if (pct >= 40) return { label: "Confiança moderada", color: "#FBBF24" };
  if (pct >= 20) return { label: "Poucos dados", color: L3 };
  return { label: "Dados iniciais", color: L3 };
}

function pluralAds(count: number): string {
  return count === 1 ? "1 anúncio" : `${count} anúncios`;
}

export function PatternsPanel({ userId, personaId, onGenerateVariation, onPatternsLoaded, compact = false }: PatternsPanelProps) {
  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alignment, setAlignment] = useState<{ score: number; label: string } | null>(null);
  const [sectionOpen, setSectionOpen] = useState(true);
  const triedDetect = useRef(false);
  const navigate = useNavigate();

  const fetchPatterns = useCallback(async () => {
    if (!userId || !personaId) { setPatterns([]); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("detect-patterns", {
        body: { action: "list", user_id: userId, persona_id: personaId },
      });
      if (fnErr) throw fnErr;
      const list = data?.patterns || [];
      const mapped: DetectedPattern[] = list.map((p: any) => ({
        ...p,
        label: p.label || p.pattern_key?.split(":").slice(2).join(":") || "",
        feature_type: p.variables?.feature_type || p.feature_type,
        feature_value: p.variables?.feature_value || p.feature_value,
      }));
      setPatterns(mapped);
      if (data?.alignment) setAlignment(data.alignment);
      onPatternsLoaded?.(mapped.length);
    } catch (err) {
      console.error("PatternsPanel fetch error:", err);
      setError("Erro ao carregar padrões");
    } finally { setLoading(false); }
  }, [userId, personaId]);

  const runDetection = useCallback(async () => {
    if (!userId || !personaId || detecting) return;
    setDetecting(true); setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("detect-patterns", {
        body: { action: "detect", user_id: userId, persona_id: personaId },
      });
      if (fnErr) throw fnErr;
      const list = data?.patterns || [];
      const mapped: DetectedPattern[] = list.map((p: any) => ({
        ...p,
        label: p.label || `${p.feature_type}: ${p.feature_value}`,
        feature_type: p.feature_type || p.variables?.feature_type,
        feature_value: p.feature_value || p.variables?.feature_value,
      }));
      setPatterns(mapped);
    } catch (err) {
      console.error("PatternsPanel detect error:", err);
      setError("Detecção falhou");
    } finally { setDetecting(false); }
  }, [userId, personaId, detecting]);

  useEffect(() => { triedDetect.current = false; fetchPatterns(); }, [fetchPatterns]);
  useEffect(() => {
    if (!loading && patterns.length === 0 && userId && personaId && !detecting && !error && !triedDetect.current) {
      triedDetect.current = true;
      const t = setTimeout(runDetection, 800);
      return () => clearTimeout(t);
    }
  }, [loading, patterns.length, userId, personaId, detecting, error]);

  if (!userId || !personaId) return null;

  // ── INTELLIGENCE FILTER ──
  // A pattern earns its spot ONLY if it has a strong metric or is actionable.
  // No weak signals. No "showing numbers without meaning."
  // Every pattern that passes MUST be able to answer: "Is this actually good?"
  const worthShowing = patterns.filter((p) => {
    const ft = p.feature_type || p.variables?.feature_type || "";

    // Gap patterns (untested formats) = always useful — they're opportunities, not metrics
    if (ft === "gap") return true;

    // Evaluate the hero metric — this IS the quality gate
    const hero = evaluateHeroMetric(p);

    // Winners validated by engine pass IF they have a metric to show
    // (even validated patterns shouldn't show if their numbers are weak)
    if (p.is_winner && hero) return true;

    // Strong or good signals pass — neutro only with high confidence
    if (hero) {
      if (hero.status === "forte" || hero.status === "bom") return true;
      if (hero.status === "neutro" && p.confidence >= 0.5 && p.sample_size >= 5) return true;
    }

    // Nothing strong enough → filter out
    return false;
  });

  const displayPatterns = compact ? worthShowing.slice(0, 3) : worthShowing.slice(0, 5);
  const isEmpty = !loading && !detecting && displayPatterns.length === 0;
  const hasContent = displayPatterns.length > 0 || (loading || detecting) || isEmpty;

  return (
    <div style={{ paddingTop: 12 }}>
      {/* ── HEADER — clickable collapse toggle ── */}
      <div
        onClick={() => { if (hasContent) setSectionOpen(prev => !prev); }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 2px 10px",
          cursor: hasContent ? "pointer" : "default",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 14, lineHeight: 1,
            color: sectionOpen ? "rgba(255,255,255,0.50)" : "rgba(255,255,255,0.30)",
            transition: "transform 0.2s ease, color 0.15s",
            transform: sectionOpen ? "rotate(90deg)" : "rotate(0deg)",
          }}>
            ›
          </span>
          <span style={{
            fontSize: 13, fontWeight: 700, color: L1,
            fontFamily: F, letterSpacing: "-0.01em",
          }}>
            Inteligência
          </span>
          {worthShowing.length > 0 && (
            <span style={{
              fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.40)",
              fontFamily: F,
            }}>
              {worthShowing.length} {worthShowing.length === 1 ? "padrão" : "padrões"}
            </span>
          )}
          {/* Alignment inline when collapsed */}
          {!sectionOpen && alignment && alignment.score > 0 && patterns.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 4 }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#A78BFA",
                boxShadow: "0 0 6px rgba(167,139,250,0.35)",
              }} />
              <span style={{
                fontSize: 10.5, fontWeight: 700, fontFamily: F, fontVariant: "tabular-nums",
                color: alignment.score >= 70 ? "#4ADE80" : alignment.score >= 40 ? "#FBBF24" : "rgba(255,255,255,0.50)",
              }}>
                {alignment.score}%
              </span>
            </div>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); runDetection(); }}
          disabled={detecting}
          style={{
            background: "none", border: "none",
            cursor: detecting ? "default" : "pointer",
            padding: 4, display: "flex", alignItems: "center",
            opacity: detecting ? 0.4 : 0.5,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => { if (!detecting) (e.currentTarget as HTMLElement).style.opacity = "0.8"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = detecting ? "0.4" : "0.5"; }}
          title="Atualizar padrões"
        >
          {detecting
            ? <Loader2 size={14} color={L3} style={{ animation: "spin 1s linear infinite" }} />
            : <RefreshCw size={14} color={L3} />
          }
        </button>
      </div>

      {/* ── COLLAPSIBLE BODY ── */}
      <PPExpandable open={sectionOpen}>
        <div>
          {/* Alignment Score */}
          {alignment && alignment.score > 0 && patterns.length > 0 && (
            <div style={{
              padding: "0 2px 12px",
              display: "flex", alignItems: "center", gap: 7,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#A78BFA",
                boxShadow: "0 0 8px rgba(167,139,250,0.40)",
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 11, fontWeight: 700, fontFamily: F, fontVariant: "tabular-nums",
                color: alignment.score >= 70 ? "#4ADE80" : alignment.score >= 40 ? "#FBBF24" : "rgba(255,255,255,0.50)",
              }}>
                {alignment.score}%
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", fontFamily: F }}>
                alinhamento · {alignment.label}
              </span>
            </div>
          )}

          {/* Loading */}
          {(loading || detecting) && patterns.length === 0 && (
            <div style={{ padding: "4px 2px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              <style>{`@keyframes ppPulse{0%,100%{opacity:0.4}50%{opacity:0.7}}`}</style>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  height: 44, borderRadius: 4,
                  background: "rgba(255,255,255,0.03)",
                  animation: `ppPulse 1.4s ease-in-out ${i * 0.12}s infinite`,
                }} />
              ))}
            </div>
          )}

          {/* Empty */}
          {isEmpty && (
            <div style={{ padding: "4px 2px 16px" }}>
              <p style={{
                fontSize: 12.5, color: L3, fontFamily: F,
                margin: 0, lineHeight: 1.55,
              }}>
                {patterns.length > 0
                  ? "Nenhum padrão forte identificado ainda. Sinais fracos foram filtrados — só mostramos o que realmente funciona."
                  : "Dados insuficientes para gerar padrões. Eles aparecem automaticamente conforme seus anúncios acumulam dados."}
              </p>
            </div>
          )}

          {/* Pattern list */}
          {displayPatterns.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {displayPatterns.map((p, idx) => (
                <div key={p.pattern_key || idx} style={{
                  animation: 'pp-fadeUp 0.3s ease both',
                  animationDelay: `${idx * 0.05}s`,
                }}>
                  <PatternRow pattern={p} onGenerateVariation={onGenerateVariation} isFirst={idx === 0} />
                </div>
              ))}
            </div>
          )}

          {/* View all */}
          {worthShowing.length > displayPatterns.length && (
            <button
              onClick={() => navigate("/dashboard/intelligence")}
              style={{
                background: "transparent", border: "none",
                cursor: "pointer", transition: "opacity 0.15s",
                padding: "14px 2px 4px", display: "flex", alignItems: "center", gap: 4,
                opacity: 0.5,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.8"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.5"; }}
            >
              <span style={{ fontSize: 11.5, color: "#A78BFA", fontFamily: F, fontWeight: 600 }}>
                Ver todos os padrões
              </span>
              <ChevronRight size={12} color="#A78BFA" />
            </button>
          )}
        </div>
      </PPExpandable>

      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pp-fadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
}

// ── Expandable wrapper ──
function PPExpandable({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      const full = el.scrollHeight;
      setH(0);
      requestAnimationFrame(() => requestAnimationFrame(() => setH(full)));
      const t = setTimeout(() => setH(-1), 250);
      return () => clearTimeout(t);
    } else {
      setH(el.scrollHeight);
      requestAnimationFrame(() => requestAnimationFrame(() => setH(0)));
    }
  }, [open]);

  const isAuto = open && h === -1;
  return (
    <div style={{
      height: isAuto ? "auto" : h,
      overflow: isAuto ? "visible" : "hidden",
      transition: isAuto ? "none" : "height 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.18s ease",
      opacity: open ? 1 : 0,
      pointerEvents: open ? "auto" : "none",
    }}>
      <div ref={ref}>{children}</div>
    </div>
  );
}

// ── Pattern Row — premium clarity, descriptive, expandable ──

function PatternRow({
  pattern: p,
  onGenerateVariation,
  isFirst,
}: {
  pattern: DetectedPattern;
  onGenerateVariation?: (pattern: DetectedPattern) => void;
  isFirst: boolean;
}) {
  const [hov, setHov] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const displayLabel = humanizePatternLabel(p);
  const explanation = patternExplanation(p);
  const conf = formatConfidence(p.confidence);

  const hasTopAds = p.top_ads && p.top_ads.length > 0;
  const hasExtraMetrics = (p.avg_cpc != null && p.avg_cpc > 0) ||
    (p.avg_roas != null && p.avg_roas > 0) ||
    (p.impact_roas_pct && p.impact_roas_pct !== "?");
  const hasInsightText = p.insight_text && p.insight_text.length > 10 && !isRawInsightText(p.insight_text);
  const hasExpandable = hasTopAds || hasExtraMetrics || hasInsightText;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        if (hasExpandable) setExpanded(prev => !prev);
      }}
      style={{
        padding: "14px 14px",
        borderRadius: 6,
        background: hov ? "rgba(255,255,255,0.035)" : "transparent",
        transition: "all 0.18s ease",
        borderTop: isFirst ? "none" : "1px solid rgba(255,255,255,0.06)",
        cursor: hasExpandable ? "pointer" : "default",
        transform: hov ? "translateX(2px)" : "translateX(0)",
      }}
    >
      {/* ── ROW 1: Pattern name + validated indicator ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13.5, fontWeight: 700, color: L1, lineHeight: 1.4,
            fontFamily: F, letterSpacing: "-0.01em",
          }}>
            {displayLabel}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginTop: 2 }}>
          {p.is_winner && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: "#4ADE80",
              letterSpacing: "0.04em", fontFamily: F,
            }}>
              ✓ validado
            </span>
          )}
          {hasExpandable && (
            <span style={{
              fontSize: 14, lineHeight: 1,
              transition: "transform 0.2s ease, color 0.15s",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              color: hov ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.30)",
            }}>
              ›
            </span>
          )}
        </div>
      </div>

      {/* ── ROW 2: Intelligent metric — value + context + status ── */}
      {(() => {
        const hero = evaluateHeroMetric(p);
        const ft = p.feature_type || p.variables?.feature_type || "";
        const isGap = ft === "gap";
        return (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            marginTop: 8, marginBottom: explanation ? 6 : 0,
          }}>
            {/* Hero metric with context — the core intelligence */}
            {hero && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontSize: 12.5, fontWeight: 700, color: hero.color,
                  fontFamily: F, fontVariant: "tabular-nums",
                  letterSpacing: "-0.01em",
                }}>
                  {hero.label} {hero.value}
                </span>
                {hero.context && (
                  <span style={{
                    fontSize: 10.5, color: "rgba(255,255,255,0.45)",
                    fontFamily: F, fontWeight: 400,
                  }}>
                    · {hero.context}
                  </span>
                )}
                {/* Status pill — forte/bom */}
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  color: hero.color,
                  letterSpacing: "0.03em",
                  opacity: 0.8,
                }}>
                  {STATUS_LABELS[hero.status]}
                </span>
              </div>
            )}

            {/* Gap opportunity — no metric, just label */}
            {isGap && !hero && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: "#A78BFA",
                fontFamily: F,
              }}>
                oportunidade
              </span>
            )}

            <span style={{ fontSize: 7, color: "rgba(255,255,255,0.10)" }}>·</span>

            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", fontFamily: F, fontWeight: 500, fontVariant: "tabular-nums" }}>
              {pluralAds(p.sample_size)}
            </span>

            <span style={{ fontSize: 7, color: "rgba(255,255,255,0.10)" }}>·</span>

            <span style={{ fontSize: 10.5, color: conf.color, fontFamily: F, fontWeight: 600 }}>
              {conf.label}
            </span>
          </div>
        );
      })()}

      {/* ── ROW 3: Explanation — why it matters ── */}
      {explanation && (
        <div style={{
          fontSize: 12, color: "rgba(255,255,255,0.50)", lineHeight: 1.5,
          fontFamily: F,
        }}>
          {explanation}
        </div>
      )}

      {/* ── Action ── */}
      {p.is_winner && onGenerateVariation && (() => {
        const ft = p.feature_type || p.variables?.feature_type || "";
        const ctaLabel =
          ft === "hook_type" || ft === "hook_presence" ? "Gerar novos hooks →" :
          ft === "format" || ft === "combination" || ft === "text_density" ? "Criar roteiro →" :
          ft === "campaign" || ft === "adset" ? "Criar brief →" :
          ft === "gap" ? "Explorar formato →" :
          "Gerar variações →";
        return (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => onGenerateVariation(p)}
              style={{
                background: "none", border: "none",
                cursor: "pointer", padding: 0,
                transition: "opacity 0.15s",
                opacity: hov || expanded ? 0.8 : 0.4,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = hov || expanded ? "0.8" : "0.4"; }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: "#A78BFA", fontFamily: F }}>
                {ctaLabel}
              </span>
            </button>
          </div>
        );
      })()}

      {/* ═══ EXPANDED CONTENT ═══ */}
      <PPExpandable open={expanded}>
        <div style={{ paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 10 }}>
          {/* Extra metrics */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: hasTopAds ? 12 : 0 }}>
            {p.avg_roas != null && p.avg_roas > 0 && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", fontFamily: M }}>
                ROAS <span style={{ color: "#4ADE80", fontWeight: 700, fontSize: 12 }}>{p.avg_roas.toFixed(1)}x</span>
              </span>
            )}
            {p.avg_cpc != null && p.avg_cpc > 0 && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", fontFamily: M }}>
                CPC <span style={{ color: L1, fontWeight: 700, fontSize: 12 }}>R${(p.avg_cpc / 100).toFixed(2)}</span>
              </span>
            )}
            {p.impact_roas_pct && p.impact_roas_pct !== "?" && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", fontFamily: M }}>
                ROAS <span style={{ color: parseFloat(p.impact_roas_pct) > 0 ? "#4ADE80" : "#F87171", fontWeight: 700, fontSize: 12 }}>{p.impact_roas_pct}</span>
              </span>
            )}
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", fontFamily: M }}>
              Confiança <span style={{ color: L1, fontWeight: 700, fontSize: 12 }}>{Math.round(p.confidence * 100)}%</span>
            </span>
          </div>

          {/* Full insight text if different from display label */}
          {hasInsightText && p.insight_text !== displayLabel && (
            <div style={{
              fontSize: 12.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.55,
              borderLeft: "2px solid rgba(167,139,250,0.30)",
              paddingLeft: 10, marginBottom: 10,
            }}>
              {p.insight_text}
            </div>
          )}

          {/* Top performing ads */}
          {hasTopAds && (
            <div>
              <div style={{
                fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.45)",
                letterSpacing: "0.08em", marginBottom: 6,
              }}>
                MELHORES ANÚNCIOS
              </div>
              {p.top_ads!.slice(0, 3).map((ad, i) => (
                <div key={ad.ad_id || i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "5px 0",
                  borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <span style={{
                    fontSize: 11.5, color: "rgba(255,255,255,0.70)", fontWeight: 500,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    flex: 1, marginRight: 8,
                  }}>
                    {ad.ad_name || "Anúncio"}
                  </span>
                  <span style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, fontFamily: M, flexShrink: 0 }}>
                    CTR {formatCtr(ad.ctr)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </PPExpandable>
    </div>
  );
}

export type { DetectedPattern };
