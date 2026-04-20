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
 * New format: "TITLE || REASON || INSIGHT"
 * Legacy format: "TITLE || INSIGHT" or plain text.
 */
function parseAiInsight(insightText: string | null): {
  title: string | null;
  reason: string | null;
  explanation: string | null;
} {
  if (!insightText || insightText.length < 5 || isRawInsightText(insightText)) {
    return { title: null, reason: null, explanation: null };
  }
  // New format: "Title || Reason || Insight"
  if (insightText.includes(" || ")) {
    const parts = insightText.split(" || ").map(s => s.trim());
    if (parts.length >= 3) {
      // 3-part: title, reason, insight
      const title = parts[0].length > 5 && !isRawInsightText(parts[0])
        ? (parts[0].length > 80 ? parts[0].slice(0, 77) + "..." : parts[0]) : null;
      const reason = parts[1].length > 3 && !isRawInsightText(parts[1]) ? parts[1] : null;
      const explanation = parts[2].length > 5 && !isRawInsightText(parts[2]) ? parts[2] : null;
      return { title, reason, explanation };
    }
    if (parts.length === 2) {
      // Legacy 2-part: title, insight (no reason)
      const title = parts[0].length > 5 && !isRawInsightText(parts[0])
        ? (parts[0].length > 80 ? parts[0].slice(0, 77) + "..." : parts[0]) : null;
      const explanation = parts[1].length > 5 && !isRawInsightText(parts[1]) ? parts[1] : null;
      return { title, reason: null, explanation };
    }
  }
  // Legacy: plain text
  if (insightText.length <= 80 && !isRawInsightText(insightText)) {
    return { title: insightText, reason: null, explanation: null };
  }
  if (!isRawInsightText(insightText)) {
    return { title: null, reason: null, explanation: insightText.length > 200 ? insightText.slice(0, 197) + "..." : insightText };
  }
  return { title: null, reason: null, explanation: null };
}

/** BLOCKLIST — generic phrases that must never appear in displayed intelligence */
const GENERIC_BLOCKLIST = [
  "ctr acima da média", "acima da média", "performance superior",
  "padrão vencedor", "alta confiança", "bom desempenho",
  "desempenho superior", "resultado positivo", "resultado forte",
  "excelente resultado", "boa performance",
];

function containsGenericPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  return GENERIC_BLOCKLIST.some(phrase => lower.includes(phrase));
}

function humanizePatternLabel(p: DetectedPattern): string {
  // 1. AI-generated title — preferred, but filtered for generics
  const ai = parseAiInsight(p.insight_text);
  if (ai.title && !containsGenericPhrase(ai.title)) return ai.title;

  // 2. Structured fallback — factual, no adjectives
  const featureType = p.feature_type || p.variables?.feature_type || "";
  const featureValue = p.feature_value || p.variables?.feature_value || "";

  switch (featureType) {
    case "hook_type": return `Hook: ${humanizeHookType(featureValue)}`;
    case "hook_presence": return featureValue === "with_hook" ? "Anúncios com hook" : "Anúncios sem hook";
    case "format": return `Formato: ${humanizeFormat(featureValue)}`;
    case "text_density": return `Texto: ${humanizeTextDensity(featureValue)}`;
    case "campaign": return `Campanha: "${featureValue}"`;
    case "adset": return `Público: "${featureValue}"`;
    case "gap": return `Não testado: ${humanizeFormat(featureValue)}`;
    case "deviation": return p.label || "Desvio detectado";
    case "combination": {
      const parts = featureValue.split("+");
      const formatted = parts.map((part) => {
        const trimmed = part.trim();
        if (trimmed === "hook") return "hook";
        if (trimmed === "no_hook") return "sem hook";
        return humanizeFormat(trimmed);
      });
      return `Combo: ${formatted.join(" + ")}`;
    }
    case "status": return `Status: ${featureValue}`;
    default: {
      if (p.pattern_key) {
        const parts = p.pattern_key.split(":");
        if (parts.length >= 4) {
          const ft = parts[2] || "";
          const fv = parts[3] || "";
          if (ft === "hook_type") return `Hook: ${humanizeHookType(fv)}`;
          if (ft === "format") return `Formato: ${humanizeFormat(fv)}`;
          if (ft === "hook_presence") return fv === "with_hook" ? "Anúncios com hook" : "Anúncios sem hook";
          if (ft === "text_density") return `Texto: ${humanizeTextDensity(fv)}`;
          if (ft && fv) return `${ft.replace(/_/g, " ")}: ${fv.replace(/_/g, " ")}`;
        }
      }
      return `Padrão identificado`;
    }
  }
}

/** Get the quoted reason WHY a pattern works */
function patternReason(p: DetectedPattern): string | null {
  const ai = parseAiInsight(p.insight_text);
  if (ai.reason && !containsGenericPhrase(ai.reason)) return ai.reason;
  return null;
}

/** Get actionable insight — what to DO with this pattern */
function patternAction(p: DetectedPattern): string | null {
  const ai = parseAiInsight(p.insight_text);
  if (ai.explanation && !containsGenericPhrase(ai.explanation)) return ai.explanation;
  return null;
}

/** Check if pattern has a real, explainable reason */
function hasRealIntelligence(p: DetectedPattern): boolean {
  const ai = parseAiInsight(p.insight_text);
  const ft = p.feature_type || p.variables?.feature_type || "";

  // Gap patterns are always actionable (they suggest what to test)
  if (ft === "gap") return true;

  // If AI provided a non-generic reason, it's real
  if (ai.reason && !containsGenericPhrase(ai.reason)) return true;

  // If AI provided a non-generic title that implies causation, accept
  if (ai.title && !containsGenericPhrase(ai.title)) {
    // Check if title contains causal language
    const causalSignals = ["porque", "quando", "com ", "sem ", "usando", "direto", "pergunta", "urgência", "número", "emocional", "promessa", "chamada"];
    if (causalSignals.some(s => ai.title!.toLowerCase().includes(s))) return true;
  }

  // Hook types inherently carry a reason (the hook type IS the reason)
  if (ft === "hook_type") return true;

  // Everything else needs an explicit reason
  return false;
}

function formatCtr(value: number): string {
  const pct = value > 1 ? value : value * 100;
  return pct.toFixed(1) + "%";
}

// ── Hero metric — just the number, no judgment words ──

interface HeroMetric {
  label: string;       // "CTR", "ROAS", "Impacto"
  value: string;       // "7.9%", "3.2x", "+23%"
}

/**
 * Extract the ONE hero metric for display.
 * Returns raw metric — no "forte", "bom", or status labels.
 */
function evaluateHeroMetric(p: DetectedPattern): HeroMetric | null {
  const ft = p.feature_type || p.variables?.feature_type || "";
  const ctr = p.avg_ctr != null && p.avg_ctr > 0 ? (p.avg_ctr > 1 ? p.avg_ctr : p.avg_ctr * 100) : 0;
  const roas = p.avg_roas != null && p.avg_roas > 0 ? p.avg_roas : 0;
  const impactCtr = parseFloat(p.impact_ctr_pct || "0");
  const impactRoas = parseFloat(p.impact_roas_pct || "0");

  if (ft === "gap") return null;

  // Hook patterns → CTR or impact
  if (ft === "hook_type" || ft === "hook_presence") {
    if (impactCtr > 0) return { label: "CTR", value: `+${p.impact_ctr_pct} vs média` };
    if (ctr >= 1.5) return { label: "CTR", value: formatCtr(p.avg_ctr!) };
    return null;
  }

  // Format / combination → ROAS preferred, then impact
  if (ft === "format" || ft === "combination") {
    if (roas >= 1.0) return { label: "ROAS", value: `${roas.toFixed(1)}x` };
    if (impactRoas > 0) return { label: "ROAS", value: `+${p.impact_roas_pct} vs média` };
    if (impactCtr > 0) return { label: "CTR", value: `+${p.impact_ctr_pct} vs média` };
    return null;
  }

  // Campaign / adset → ROAS or impact
  if (ft === "campaign" || ft === "adset") {
    if (roas >= 1.0) return { label: "ROAS", value: `${roas.toFixed(1)}x` };
    if (impactCtr > 0) return { label: "CTR", value: `+${p.impact_ctr_pct} vs média` };
    return null;
  }

  // Text density → CTR
  if (ft === "text_density") {
    if (impactCtr > 0) return { label: "CTR", value: `+${p.impact_ctr_pct} vs média` };
    if (ctr >= 1.5) return { label: "CTR", value: formatCtr(p.avg_ctr!) };
    return null;
  }

  // Fallback: strongest signal
  if (roas >= 2.0) return { label: "ROAS", value: `${roas.toFixed(1)}x` };
  if (impactCtr >= 5) return { label: "CTR", value: `+${p.impact_ctr_pct} vs média` };
  if (ctr >= 2.5) return { label: "CTR", value: formatCtr(p.avg_ctr!) };
  return null;
}

/** Low-data indicator — only shown for early signals, never fake confidence */
function dataMaturity(p: DetectedPattern): string | null {
  if (p.sample_size <= 1) return "Sinal inicial — ainda precisa de mais dados";
  if (p.sample_size <= 3 || p.confidence < 0.3) return "Dados iniciais";
  // Sufficient data — no label needed (the metric speaks for itself)
  return null;
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
  const [sectionOpen, setSectionOpen] = useState(false);
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
  // CORE RULE: If the system does NOT know WHY something worked, do NOT show it.
  // Every pattern must pass: (1) has real intelligence, (2) has metric or is gap.
  const worthShowing = patterns.filter((p) => {
    const ft = p.feature_type || p.variables?.feature_type || "";

    // Gap patterns — always actionable (suggest what to test)
    if (ft === "gap") return true;

    // NO-INVENTION RULE: Pattern must have an explainable reason
    if (!hasRealIntelligence(p)) return false;

    // Must have a metric to show (or be a gap)
    const hero = evaluateHeroMetric(p);
    if (!hero) return false;

    // Minimum bar: at least some data
    if (p.sample_size < 2) return false;

    return true;
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
              fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.60)",
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
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.60)", fontFamily: F }}>
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
            <div style={{ padding: "0 2px 8px" }}>
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
  const reason = patternReason(p);
  const action = patternAction(p);
  const hero = evaluateHeroMetric(p);
  const maturity = dataMaturity(p);
  const ft = p.feature_type || p.variables?.feature_type || "";
  const isGap = ft === "gap";

  // For hook_type patterns, the type itself is the reason if AI didn't provide one
  const implicitReason = ft === "hook_type"
    ? `${humanizeHookType(p.feature_value || p.variables?.feature_value || "").toLowerCase()} no início`
    : null;
  const displayReason = reason || implicitReason;

  const hasTopAds = p.top_ads && p.top_ads.length > 0;
  const hasExpandable = hasTopAds || !!action;

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
      {/* ── ROW 1: Title ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13.5, fontWeight: 700, color: L1, lineHeight: 1.4,
            fontFamily: F, letterSpacing: "-0.01em",
          }}>
            {displayLabel}
          </div>
        </div>
        {hasExpandable && (
          <span style={{
            fontSize: 14, lineHeight: 1, marginTop: 2, flexShrink: 0,
            transition: "transform 0.2s ease, color 0.15s",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            color: hov ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.30)",
          }}>
            ›
          </span>
        )}
      </div>

      {/* ── ROW 2: Metric + sample size ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        marginTop: 6,
      }}>
        {hero && (
          <span style={{
            fontSize: 12.5, fontWeight: 700, color: "#38BDF8",
            fontFamily: F, fontVariant: "tabular-nums",
            letterSpacing: "-0.01em",
          }}>
            {hero.label} {hero.value}
          </span>
        )}
        {isGap && !hero && (
          <span style={{ fontSize: 11, fontWeight: 600, color: "#A78BFA", fontFamily: F }}>
            não testado
          </span>
        )}

        <span style={{ fontSize: 7, color: "rgba(255,255,255,0.10)" }}>·</span>

        <span style={{ fontSize: 10.5, color: L3, fontFamily: F, fontWeight: 500, fontVariant: "tabular-nums" }}>
          {pluralAds(p.sample_size)}
        </span>

        {maturity && (
          <>
            <span style={{ fontSize: 7, color: "rgba(255,255,255,0.10)" }}>·</span>
            <span style={{ fontSize: 10.5, color: L3, fontFamily: F, fontWeight: 500, fontStyle: "italic" }}>
              {maturity}
            </span>
          </>
        )}
      </div>

      {/* ── ROW 3: Quoted reason — the WHY ── */}
      {displayReason && (
        <div style={{
          marginTop: 8,
          fontSize: 12, color: "rgba(255,255,255,0.60)", lineHeight: 1.5,
          fontFamily: F,
        }}>
          <span style={{ color: L3, fontSize: 10.5, fontWeight: 600 }}>Motivo: </span>
          <span style={{ fontStyle: "italic" }}>"{displayReason}"</span>
        </div>
      )}

      {/* ── CTA — actionable, always visible for winners ── */}
      {onGenerateVariation && (
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
              {ft === "hook_type" || ft === "hook_presence" ? "Gerar hooks similares →" :
               ft === "format" || ft === "combination" || ft === "text_density" ? "Criar roteiro →" :
               ft === "gap" ? "Testar formato →" :
               "Aplicar padrão →"}
            </span>
          </button>
        </div>
      )}

      {/* ═══ EXPANDED — top ads + action insight ═══ */}
      <PPExpandable open={expanded}>
        <div style={{ paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 10 }}>
          {/* Actionable insight */}
          {action && (
            <div style={{
              fontSize: 12.5, color: "rgba(255,255,255,0.60)", lineHeight: 1.55,
              borderLeft: "2px solid rgba(167,139,250,0.25)",
              paddingLeft: 10, marginBottom: hasTopAds ? 12 : 0,
            }}>
              {action}
            </div>
          )}

          {/* Top performing ads */}
          {hasTopAds && (
            <div>
              <div style={{
                fontSize: 9.5, fontWeight: 700, color: L3,
                letterSpacing: "0.08em", marginBottom: 6,
              }}>
                ANÚNCIOS NESTE PADRÃO
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
                  <span style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, fontFamily: F, fontVariant: "tabular-nums", flexShrink: 0 }}>
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
