/**
 * PatternsPanel — "WHAT WORKS" — Core intelligence section.
 *
 * Elevated from sidebar widget to a prominent intelligence block.
 * Displays validated patterns with clear impact, confidence, and actionability.
 */
import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, Sparkles, ChevronRight, Loader2, RefreshCw } from "lucide-react";
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
        label: p.variables?.feature_value
          ? `${p.variables.feature_type}: ${p.variables.feature_value}`
          : p.pattern_key?.split(":").slice(2).join(":") || "Pattern",
        feature_type: p.variables?.feature_type,
        feature_value: p.variables?.feature_value,
      }));
      setPatterns(mapped);
      if (data?.alignment) setAlignment(data.alignment);
      onPatternsLoaded?.(mapped.length);
    } catch (err) {
      console.error("PatternsPanel fetch error:", err);
      setError("Failed to load patterns");
    } finally {
      setLoading(false);
    }
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
      }));
      setPatterns(mapped);
    } catch (err) {
      console.error("PatternsPanel detect error:", err);
      setError("Detection failed");
    } finally {
      setDetecting(false);
    }
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
    <div style={{
      background: "#0C1017",
      border: "1px solid rgba(255,255,255,0.04)",
      borderRadius: 6,
      overflow: "hidden",
    }}>
      {/* ── HEADER — elevated, prominent ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px 10px",
        borderBottom: displayPatterns.length > 0 ? "1px solid rgba(255,255,255,0.03)" : "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 800, color: "rgba(139,92,246,0.70)",
            letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: F,
          }}>
            INTELIGÊNCIA
          </span>
          <span style={{
            width: 3, height: 3, borderRadius: "50%",
            background: "rgba(255,255,255,0.10)",
          }} />
          <span style={{
            fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.40)",
            fontFamily: F,
          }}>
            What works
          </span>
          {patterns.length > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: "rgba(139,92,246,0.50)",
              fontFamily: M,
            }}>
              {patterns.length}
            </span>
          )}
        </div>
        <button
          onClick={runDetection}
          disabled={detecting}
          style={{
            background: "none", border: "none",
            cursor: detecting ? "default" : "pointer",
            padding: 4, display: "flex", alignItems: "center",
            opacity: detecting ? 0.3 : 0.4,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => { if (!detecting) (e.currentTarget as HTMLElement).style.opacity = "0.8"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = detecting ? "0.3" : "0.4"; }}
          title="Refresh patterns"
        >
          {detecting
            ? <Loader2 size={13} color="rgba(255,255,255,0.4)" style={{ animation: "spin 1s linear infinite" }} />
            : <RefreshCw size={13} color="rgba(255,255,255,0.3)" />
          }
        </button>
      </div>

      {/* Alignment Score */}
      {alignment && alignment.score > 0 && patterns.length > 0 && (
        <div style={{
          padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 10,
          borderBottom: "1px solid rgba(255,255,255,0.03)",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: `conic-gradient(${alignment.score >= 70 ? "#34d399" : alignment.score >= 40 ? "#F59E0B" : "#DC2626"} ${alignment.score * 3.6}deg, rgba(255,255,255,0.04) 0deg)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", background: "#0C1017",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.60)", fontFamily: M,
            }}>
              {alignment.score}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.55)", fontFamily: F }}>
              Alinhamento de padrões
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", fontFamily: F }}>
              {alignment.label}
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {(loading || detecting) && patterns.length === 0 && (
        <div style={{ padding: "14px 16px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
          <style>{`@keyframes ppPulse{0%,100%{opacity:0.3}50%{opacity:0.6}}`}</style>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              height: 52, borderRadius: 6,
              background: "rgba(255,255,255,0.02)",
              animation: `ppPulse 1.4s ease-in-out ${i * 0.12}s infinite`,
            }} />
          ))}
        </div>
      )}

      {/* Empty */}
      {isEmpty && (
        <div style={{ padding: "12px 16px 18px" }}>
          <p style={{
            fontSize: 12, color: "rgba(255,255,255,0.22)", fontFamily: F,
            margin: 0, lineHeight: 1.55,
          }}>
            Dados insuficientes para gerar padrões. Eles aparecem automaticamente conforme seus anúncios acumulam dados.
          </p>
        </div>
      )}

      {/* Pattern list */}
      {displayPatterns.length > 0 && (
        <div style={{ padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          {displayPatterns.map((p, idx) => (
            <PatternCard key={p.pattern_key || idx} pattern={p} onGenerateVariation={onGenerateVariation} />
          ))}
        </div>
      )}

      {/* View all */}
      {patterns.length > displayPatterns.length && (
        <button
          onClick={() => navigate("/dashboard/intelligence")}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            gap: 4, padding: "10px 16px",
            background: "transparent", border: "none",
            borderTop: "1px solid rgba(255,255,255,0.03)",
            cursor: "pointer", transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.35)", fontFamily: F, fontWeight: 600 }}>
            Ver todos os padrões
          </span>
          <ChevronRight size={12} color="rgba(255,255,255,0.25)" />
        </button>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Pattern Card — elevated design ──

function PatternCard({
  pattern: p,
  onGenerateVariation,
}: {
  pattern: DetectedPattern;
  onGenerateVariation?: (pattern: DetectedPattern) => void;
}) {
  const [hov, setHov] = useState(false);

  const impactNum = parseFloat(p.impact_ctr_pct || "0");
  const isPositive = impactNum > 0;
  const impactColor = isPositive ? "#34d399" : "#DC2626";

  const displayLabel = p.insight_text
    ? p.insight_text.length > 80 ? p.insight_text.slice(0, 80) + "..." : p.insight_text
    : p.label;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "12px 12px 10px",
        borderRadius: 5,
        background: hov ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)",
        border: `1px solid ${p.is_winner ? "rgba(139,92,246,0.10)" : "rgba(255,255,255,0.03)"}`,
        transition: "all 0.15s ease",
        transform: hov ? "translateY(-1px)" : "none",
      }}
    >
      {/* Top row: badge + impact */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {p.is_winner ? (
            <span style={{
              fontSize: 8.5, fontWeight: 800, color: "#8B5CF6",
              background: "rgba(139,92,246,0.10)", padding: "2px 7px",
              borderRadius: 3, letterSpacing: "0.08em", fontFamily: F,
            }}>
              VALIDADO
            </span>
          ) : (
            <span style={{
              fontSize: 8.5, fontWeight: 700, color: "rgba(255,255,255,0.22)",
              letterSpacing: "0.06em", fontFamily: F,
            }}>
              PADRÃO
            </span>
          )}
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", fontFamily: M }}>
            {p.sample_size} ads
          </span>
        </div>

        {p.impact_ctr_pct && (
          <div style={{
            display: "flex", alignItems: "center", gap: 3,
            padding: "2px 6px", borderRadius: 3,
          }}>
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

      {/* Insight */}
      <p style={{
        fontSize: 12.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.45,
        margin: "0 0 8px", fontFamily: F,
      }}>
        {displayLabel}
      </p>

      {/* Metrics */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: p.is_winner ? 8 : 0 }}>
        {p.avg_ctr != null && p.avg_ctr > 0 && (
          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.25)", fontFamily: M }}>
            CTR {(p.avg_ctr > 1 ? p.avg_ctr : p.avg_ctr * 100).toFixed(2)}%
          </span>
        )}
        {p.avg_roas != null && p.avg_roas > 0 && (
          <>
            <span style={{ fontSize: 7, color: "rgba(255,255,255,0.08)" }}>·</span>
            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.25)", fontFamily: M }}>
              ROAS {p.avg_roas.toFixed(1)}x
            </span>
          </>
        )}
        <span style={{ fontSize: 7, color: "rgba(255,255,255,0.08)" }}>·</span>
        <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.18)", fontFamily: M }}>
          {(p.confidence * 100).toFixed(0)}% conf
        </span>
      </div>

      {/* CTA — execution trigger, not "feature" */}
      {p.is_winner && onGenerateVariation && (
        <button
          onClick={() => onGenerateVariation(p)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "#8B5CF6", border: "none",
            borderRadius: 4, padding: "7px 14px", cursor: "pointer",
            transition: "all 0.15s ease", width: "100%", justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#7C3AED";
            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(139,92,246,0.25)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#8B5CF6";
            (e.currentTarget as HTMLElement).style.transform = "none";
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          <Sparkles size={11} color="#fff" />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", fontFamily: F }}>
            Aplicar este padrão
          </span>
        </button>
      )}
    </div>
  );
}

export type { DetectedPattern };
