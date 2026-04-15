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
import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, ChevronRight, Loader2, RefreshCw, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const F = "'Inter', 'Plus Jakarta Sans', sans-serif";
const M = "'DM Mono', 'SF Mono', monospace";

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
  // Patterns that indicate raw debug output:
  // "urgency em meta: CTR 7.909774, ROAS null"
  // "question em meta: CTR 2.068966, ROAS null"
  // Contains raw numbers with many decimals, "null", "em meta:", etc.
  if (/CTR \d+\.\d{4,}/.test(text)) return true;
  if (/ROAS null/i.test(text)) return true;
  if (/em meta:/i.test(text)) return true;
  if (/\bnull\b/.test(text)) return true;
  // Raw pattern_key format like "hook_type:urgency"
  if (/^[a-z_]+:[a-z_]+$/i.test(text.trim())) return true;
  return false;
}

function humanizePatternLabel(p: DetectedPattern): string {
  // Only use insight_text if it's actually a good human-written insight
  if (p.insight_text && p.insight_text.length > 10 && !isRawInsightText(p.insight_text)) {
    let cleaned = p.insight_text;
    if (cleaned.length > 100) cleaned = cleaned.slice(0, 97) + "...";
    return cleaned;
  }

  // Always fall through to structured humanization
  const featureType = p.feature_type || p.variables?.feature_type || "";
  const featureValue = p.feature_value || p.variables?.feature_value || "";
  switch (featureType) {
    case "hook_type": return `Hook com ${humanizeHookType(featureValue).toLowerCase()} se destaca`;
    case "hook_presence": return featureValue === "with_hook" ? "Anúncios com hook performam melhor" : "Anúncios sem hook nesta conta";
    case "format": return `Formato ${humanizeFormat(featureValue)} se destaca`;
    case "text_density": return `${humanizeTextDensity(featureValue)} nos criativos`;
    case "campaign": return `Campanha: ${featureValue}`;
    case "adset": return `Público: ${featureValue}`;
    case "gap": return `Formato ${humanizeFormat(featureValue)} ainda não testado`;
    case "deviation": return p.label || "Desvio detectado";
    case "combination": {
      const parts = featureValue.split("+");
      const formatted = parts.map((part) => {
        const trimmed = part.trim();
        if (trimmed === "hook") return "com hook";
        if (trimmed === "no_hook") return "sem hook";
        return humanizeFormat(trimmed);
      });
      return `Combinação: ${formatted.join(" + ")}`;
    }
    case "status": return `Status: ${featureValue}`;
    default:
      if (p.label && !isRawInsightText(p.label)) {
        return p.label.replace(/\bads\b/gi, "anúncios").replace(/\bAds\b/g, "Anúncios")
          .replace(/\bHook:\s*/gi, "Hook: ").replace(/\bText density:\s*/gi, "Densidade de texto: ");
      }
      return "Padrão detectado";
  }
}

function formatCtr(value: number): string {
  const pct = value > 1 ? value : value * 100;
  return pct.toFixed(1) + "%";
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
        label: p.label || p.pattern_key?.split(":").slice(2).join(":") || "Padrão",
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

  useEffect(() => { fetchPatterns(); }, [fetchPatterns]);
  useEffect(() => {
    if (!loading && patterns.length === 0 && userId && personaId && !detecting && !error) {
      const t = setTimeout(runDetection, 800);
      return () => clearTimeout(t);
    }
  }, [loading, patterns.length, userId, personaId, detecting, error]);

  if (!userId || !personaId) return null;

  const displayPatterns = compact ? patterns.slice(0, 3) : patterns.slice(0, 5);
  const isEmpty = !loading && !detecting && displayPatterns.length === 0;

  return (
    <div style={{ paddingTop: 12 }}>
      {/* ── HEADER — "brain" of the product, high contrast ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 2px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#A78BFA",
            boxShadow: "0 0 12px rgba(167,139,250,0.50), 0 0 4px rgba(167,139,250,0.30)",
          }} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                fontSize: 14, fontWeight: 700, color: L1,
                fontFamily: F, letterSpacing: "-0.01em",
              }}>
                Inteligência
              </span>
              {patterns.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: "#A78BFA",
                  fontFamily: M,
                }}>
                  {patterns.length} {patterns.length === 1 ? "padrão" : "padrões"}
                </span>
              )}
            </div>
            <span style={{
              fontSize: 11, color: L3,
              fontFamily: F,
            }}>
              O que funciona na sua conta
            </span>
          </div>
        </div>
        <button
          onClick={runDetection}
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

      {/* Alignment Score */}
      {alignment && alignment.score > 0 && patterns.length > 0 && (
        <div style={{
          padding: "0 2px 16px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: `conic-gradient(${alignment.score >= 70 ? "#4ADE80" : alignment.score >= 40 ? "#FBBF24" : "#A78BFA"} ${alignment.score * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%", background: "#06080C",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9.5, fontWeight: 800, color: L2, fontFamily: M,
            }}>
              {alignment.score}%
            </div>
          </div>
          <div style={{ fontSize: 11, color: L3, fontFamily: F }}>
            Alinhamento · <span style={{ color: L2 }}>{alignment.label}</span>
          </div>
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
            Dados insuficientes para gerar padrões. Eles aparecem automaticamente conforme seus anúncios acumulam dados.
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
      {patterns.length > displayPatterns.length && (
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

      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pp-fadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
}

// ── Pattern Row — high contrast, readable ──

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

  const impactNum = parseFloat(p.impact_ctr_pct || "0");
  const isPositive = impactNum > 0;
  const impactColor = isPositive ? "#4ADE80" : "#F87171";
  const displayLabel = humanizePatternLabel(p);
  const conf = formatConfidence(p.confidence);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "14px 12px",
        borderRadius: 4,
        background: hov ? "rgba(255,255,255,0.03)" : "transparent",
        transition: "background 0.15s ease",
        borderTop: isFirst ? "none" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Meta row: badge + sample + impact */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {p.is_winner && (
            <span style={{
              fontSize: 8.5, fontWeight: 800, color: "#A78BFA",
              background: "rgba(167,139,250,0.12)", padding: "2px 6px",
              borderRadius: 2, letterSpacing: "0.08em", fontFamily: F,
            }}>
              VALIDADO
            </span>
          )}
          <span style={{ fontSize: 10.5, color: L3, fontFamily: M }}>
            {pluralAds(p.sample_size)}
          </span>
        </div>

        {p.impact_ctr_pct && p.impact_ctr_pct !== "?" && (
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            {isPositive
              ? <TrendingUp size={10} color={impactColor} />
              : <TrendingDown size={10} color={impactColor} />
            }
            <span style={{ fontSize: 11, fontWeight: 700, color: impactColor, fontFamily: M }}>
              {p.impact_ctr_pct}
            </span>
          </div>
        )}
      </div>

      {/* Insight — L2 contrast, clearly readable */}
      <div style={{
        fontSize: 13, color: L2, lineHeight: 1.5,
        margin: "0 0 8px", fontFamily: F,
      }}>
        {displayLabel}
      </div>

      {/* Metrics row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {p.avg_ctr != null && p.avg_ctr > 0 && (
          <span style={{ fontSize: 10.5, color: L3, fontFamily: M }}>
            CTR <span style={{ color: L2, fontWeight: 600 }}>{formatCtr(p.avg_ctr)}</span>
          </span>
        )}
        {p.avg_roas != null && p.avg_roas > 0 && (
          <>
            <span style={{ fontSize: 7, color: "rgba(255,255,255,0.10)" }}>·</span>
            <span style={{ fontSize: 10.5, color: L3, fontFamily: M }}>
              ROAS <span style={{ color: L2, fontWeight: 600 }}>{p.avg_roas.toFixed(1)}x</span>
            </span>
          </>
        )}
        <span style={{ fontSize: 7, color: "rgba(255,255,255,0.10)" }}>·</span>
        <span style={{ fontSize: 10.5, color: conf.color, fontFamily: M, fontWeight: 500 }}>
          {conf.label}
        </span>

        {/* Inline action */}
        {p.is_winner && onGenerateVariation && (
          <>
            <span style={{ flex: 1 }} />
            <button
              onClick={() => onGenerateVariation(p)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "none", border: "none",
                cursor: "pointer", padding: "2px 0",
                transition: "opacity 0.15s",
                opacity: hov ? 0.8 : 0.5,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = hov ? "0.8" : "0.5"; }}
            >
              <Zap size={11} color="#A78BFA" />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#A78BFA", fontFamily: F }}>
                Gerar variações
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export type { DetectedPattern };
