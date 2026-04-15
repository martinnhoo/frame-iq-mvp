/**
 * PatternsPanel — "O QUE FUNCIONA" — Core intelligence section.
 *
 * DESIGN: Fluid, borderless, central "brain" of the product.
 * No box-in-box nesting. Patterns flow like a continuous list.
 * Actions integrated, not dominant.
 */
import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, ChevronRight, Loader2, RefreshCw, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const F = "'Inter', 'Plus Jakarta Sans', sans-serif";
const M = "'DM Mono', 'SF Mono', monospace";

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

function humanizePatternLabel(p: DetectedPattern): string {
  if (p.insight_text && p.insight_text.length > 10) {
    let cleaned = p.insight_text;
    if (cleaned.length > 100) cleaned = cleaned.slice(0, 97) + "...";
    return cleaned;
  }
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
      if (p.label) {
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
  if (pct >= 70) return { label: "Alta confiança", color: "rgba(52,211,153,0.50)" };
  if (pct >= 40) return { label: "Confiança moderada", color: "rgba(245,158,11,0.50)" };
  if (pct >= 20) return { label: "Poucos dados", color: "rgba(255,255,255,0.22)" };
  return { label: "Dados iniciais", color: "rgba(255,255,255,0.15)" };
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
    <div style={{ paddingTop: 8 }}>
      {/* ── HEADER — elevated, central, "brain" presence ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 2px 14px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Accent dot — purple glow, signals "intelligence active" */}
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "#8B5CF6",
            boxShadow: "0 0 8px rgba(139,92,246,0.35)",
          }} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.65)",
                fontFamily: F, letterSpacing: "-0.01em",
              }}>
                Inteligência
              </span>
              {patterns.length > 0 && (
                <span style={{
                  fontSize: 10.5, fontWeight: 600, color: "rgba(139,92,246,0.50)",
                  fontFamily: M,
                }}>
                  {patterns.length} {patterns.length === 1 ? "padrão" : "padrões"}
                </span>
              )}
            </div>
            <span style={{
              fontSize: 10.5, color: "rgba(255,255,255,0.25)",
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
            opacity: detecting ? 0.3 : 0.35,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => { if (!detecting) (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = detecting ? "0.3" : "0.35"; }}
          title="Atualizar padrões"
        >
          {detecting
            ? <Loader2 size={14} color="rgba(255,255,255,0.4)" style={{ animation: "spin 1s linear infinite" }} />
            : <RefreshCw size={14} color="rgba(255,255,255,0.3)" />
          }
        </button>
      </div>

      {/* Alignment Score — inline, not boxed */}
      {alignment && alignment.score > 0 && patterns.length > 0 && (
        <div style={{
          padding: "0 2px 14px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: `conic-gradient(${alignment.score >= 70 ? "#34d399" : alignment.score >= 40 ? "#F59E0B" : "rgba(139,92,246,0.50)"} ${alignment.score * 3.6}deg, rgba(255,255,255,0.04) 0deg)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", background: "#08090D",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.50)", fontFamily: M,
            }}>
              {alignment.score}%
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.25)", fontFamily: F }}>
            Alinhamento · {alignment.label}
          </div>
        </div>
      )}

      {/* Loading */}
      {(loading || detecting) && patterns.length === 0 && (
        <div style={{ padding: "4px 2px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <style>{`@keyframes ppPulse{0%,100%{opacity:0.3}50%{opacity:0.6}}`}</style>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              height: 40, borderRadius: 3,
              background: "rgba(255,255,255,0.015)",
              animation: `ppPulse 1.4s ease-in-out ${i * 0.12}s infinite`,
            }} />
          ))}
        </div>
      )}

      {/* Empty */}
      {isEmpty && (
        <div style={{ padding: "4px 2px 16px" }}>
          <p style={{
            fontSize: 12, color: "rgba(255,255,255,0.18)", fontFamily: F,
            margin: 0, lineHeight: 1.55,
          }}>
            Dados insuficientes para gerar padrões. Eles aparecem automaticamente conforme seus anúncios acumulam dados.
          </p>
        </div>
      )}

      {/* Pattern list — fluid, no card wrappers */}
      {displayPatterns.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {displayPatterns.map((p, idx) => (
            <PatternRow key={p.pattern_key || idx} pattern={p} onGenerateVariation={onGenerateVariation} isFirst={idx === 0} />
          ))}
        </div>
      )}

      {/* View all — subtle link, not button */}
      {patterns.length > displayPatterns.length && (
        <button
          onClick={() => navigate("/dashboard/intelligence")}
          style={{
            background: "transparent", border: "none",
            cursor: "pointer", transition: "opacity 0.15s",
            padding: "12px 2px 4px", display: "flex", alignItems: "center", gap: 4,
            opacity: 0.35,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.6"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.35"; }}
        >
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", fontFamily: F, fontWeight: 600 }}>
            Ver todos os padrões
          </span>
          <ChevronRight size={11} color="rgba(255,255,255,0.30)" />
        </button>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Pattern Row — fluid, borderless, content-first ──

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
  const impactColor = isPositive ? "#34d399" : "#DC2626";
  const displayLabel = humanizePatternLabel(p);
  const conf = formatConfidence(p.confidence);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "12px 10px",
        borderRadius: 3,
        background: hov ? "rgba(255,255,255,0.02)" : "transparent",
        transition: "background 0.15s ease",
        // No borders — just spacing separates items
        borderTop: isFirst ? "none" : "1px solid rgba(255,255,255,0.025)",
      }}
    >
      {/* Single-line meta: badge + sample + impact — all compact */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {p.is_winner && (
            <span style={{
              fontSize: 8, fontWeight: 800, color: "#8B5CF6",
              background: "rgba(139,92,246,0.08)", padding: "1.5px 5px",
              borderRadius: 2, letterSpacing: "0.08em", fontFamily: F,
            }}>
              VALIDADO
            </span>
          )}
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.13)", fontFamily: M }}>
            {pluralAds(p.sample_size)}
          </span>
        </div>

        {p.impact_ctr_pct && p.impact_ctr_pct !== "?" && (
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            {isPositive
              ? <TrendingUp size={9} color={impactColor} />
              : <TrendingDown size={9} color={impactColor} />
            }
            <span style={{ fontSize: 10.5, fontWeight: 700, color: impactColor, fontFamily: M }}>
              {p.impact_ctr_pct}
            </span>
          </div>
        )}
      </div>

      {/* Insight text — the main content */}
      <div style={{
        fontSize: 12.5, color: "rgba(255,255,255,0.50)", lineHeight: 1.5,
        margin: "0 0 6px", fontFamily: F,
      }}>
        {displayLabel}
      </div>

      {/* Metrics — inline, subtle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {p.avg_ctr != null && p.avg_ctr > 0 && (
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.20)", fontFamily: M }}>
            CTR {formatCtr(p.avg_ctr)}
          </span>
        )}
        {p.avg_roas != null && p.avg_roas > 0 && (
          <>
            <span style={{ fontSize: 6, color: "rgba(255,255,255,0.06)" }}>·</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.20)", fontFamily: M }}>
              ROAS {p.avg_roas.toFixed(1)}x
            </span>
          </>
        )}
        <span style={{ fontSize: 6, color: "rgba(255,255,255,0.06)" }}>·</span>
        <span style={{ fontSize: 10, color: conf.color, fontFamily: M }}>
          {conf.label}
        </span>

        {/* Inline action — not a big button, just a subtle link */}
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
                opacity: hov ? 0.7 : 0.4,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = hov ? "0.7" : "0.4"; }}
            >
              <Zap size={10} color="#8B5CF6" />
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "#8B5CF6", fontFamily: F }}>
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
