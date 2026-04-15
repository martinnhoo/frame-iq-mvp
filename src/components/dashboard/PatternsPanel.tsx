/**
 * PatternsPanel — Compact sidebar widget showing detected creative patterns.
 *
 * Displays top 3-5 patterns derived from real ad_diary data.
 * Each pattern shows: label, impact %, confidence, and "Generate variation" CTA.
 *
 * Placement: Below the Copilot feed section in the main dashboard area,
 * or embedded in the sidebar ANALISE section.
 */
import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, Sparkles, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'DM Mono', monospace";

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
  compact?: boolean;
}

export function PatternsPanel({ userId, personaId, onGenerateVariation, compact = false }: PatternsPanelProps) {
  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Fetch cached patterns
  const fetchPatterns = useCallback(async () => {
    if (!userId || !personaId) { setPatterns([]); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("detect-patterns", {
        body: { action: "list", user_id: userId, persona_id: personaId },
      });
      if (fnErr) throw fnErr;
      const list = data?.patterns || [];
      // Rebuild display fields from stored data
      const mapped: DetectedPattern[] = list.map((p: any) => ({
        ...p,
        label: p.variables?.feature_value
          ? `${p.variables.feature_type}: ${p.variables.feature_value}`
          : p.pattern_key?.split(":").slice(2).join(":") || "Pattern",
        feature_type: p.variables?.feature_type,
        feature_value: p.variables?.feature_value,
      }));
      setPatterns(mapped);
    } catch (err) {
      console.error("PatternsPanel fetch error:", err);
      setError("Failed to load patterns");
    } finally {
      setLoading(false);
    }
  }, [userId, personaId]);

  // Run full detection
  const runDetection = useCallback(async () => {
    if (!userId || !personaId || detecting) return;
    setDetecting(true);
    setError(null);
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

  // Load on mount and persona change
  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  // Auto-detect if no cached patterns
  useEffect(() => {
    if (!loading && patterns.length === 0 && userId && personaId && !detecting && !error) {
      // Small delay to avoid race with fetchPatterns
      const t = setTimeout(runDetection, 800);
      return () => clearTimeout(t);
    }
  }, [loading, patterns.length, userId, personaId, detecting, error]);

  if (!userId || !personaId) return null;

  const displayPatterns = compact ? patterns.slice(0, 3) : patterns.slice(0, 5);
  const isEmpty = !loading && !detecting && displayPatterns.length === 0;

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px 8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <TrendingUp size={13} style={{ color: "#9f7aea" }} />
          <span style={{
            fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: F,
          }}>
            Patterns
          </span>
          {patterns.length > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.25)",
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
            background: "none", border: "none", cursor: detecting ? "default" : "pointer",
            padding: 2, display: "flex", alignItems: "center",
            opacity: detecting ? 0.4 : 0.5,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => { if (!detecting) (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = detecting ? "0.4" : "0.5"; }}
          title="Refresh patterns"
        >
          {detecting
            ? <Loader2 size={12} color="rgba(255,255,255,0.5)" style={{ animation: "spin 1s linear infinite" }} />
            : <RefreshCw size={12} color="rgba(255,255,255,0.4)" />
          }
        </button>
      </div>

      {/* Loading state */}
      {(loading || detecting) && patterns.length === 0 && (
        <div style={{ padding: "12px 14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          <style>{`@keyframes ppPulse{0%,100%{opacity:0.3}50%{opacity:0.6}}`}</style>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              height: 44, borderRadius: 8,
              background: "rgba(255,255,255,0.03)",
              animation: `ppPulse 1.4s ease-in-out ${i * 0.12}s infinite`,
            }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div style={{ padding: "8px 14px 16px" }}>
          <p style={{
            fontSize: 12, color: "rgba(255,255,255,0.30)", fontFamily: F,
            margin: 0, lineHeight: 1.5,
          }}>
            No patterns detected yet. Patterns appear automatically as your ads accumulate performance data.
          </p>
        </div>
      )}

      {/* Pattern list */}
      {displayPatterns.length > 0 && (
        <div style={{ padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
          {displayPatterns.map((p, idx) => (
            <PatternCard
              key={p.pattern_key || idx}
              pattern={p}
              onGenerateVariation={onGenerateVariation}
            />
          ))}
        </div>
      )}

      {/* View all link */}
      {patterns.length > displayPatterns.length && (
        <button
          onClick={() => navigate("/dashboard/intelligence")}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            gap: 4, padding: "8px 14px",
            background: "transparent", border: "none", borderTop: "1px solid rgba(255,255,255,0.04)",
            cursor: "pointer", transition: "background 0.12s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.40)", fontFamily: F, fontWeight: 500 }}>
            View all patterns
          </span>
          <ChevronRight size={11} color="rgba(255,255,255,0.30)" />
        </button>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Individual pattern card ─────────────────────────────────────────────────

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
  const impactColor = isPositive ? "#34d399" : "#f87171";
  const impactBg = isPositive ? "rgba(52,211,153,0.10)" : "rgba(248,113,113,0.10)";

  // Build display label
  const displayLabel = p.insight_text
    ? p.insight_text.length > 80
      ? p.insight_text.slice(0, 80) + "..."
      : p.insight_text
    : p.label;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "10px 10px 8px",
        borderRadius: 8,
        background: hov ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)",
        border: `1px solid ${p.is_winner ? "rgba(159,122,234,0.15)" : "rgba(255,255,255,0.04)"}`,
        transition: "all 0.12s",
        cursor: "default",
      }}
    >
      {/* Top row: badge + impact */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {p.is_winner ? (
            <span style={{
              fontSize: 9, fontWeight: 700, color: "#9f7aea",
              background: "rgba(159,122,234,0.12)", padding: "2px 6px",
              borderRadius: 4, letterSpacing: "0.04em", fontFamily: F,
            }}>
              WINNER
            </span>
          ) : (
            <span style={{
              fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.30)",
              letterSpacing: "0.04em", fontFamily: F,
            }}>
              PATTERN
            </span>
          )}
          <span style={{
            fontSize: 10, color: "rgba(255,255,255,0.20)", fontFamily: M,
          }}>
            {p.sample_size} ads
          </span>
        </div>

        {/* Impact badge */}
        {p.impact_ctr_pct && (
          <div style={{
            display: "flex", alignItems: "center", gap: 3,
            background: impactBg, padding: "2px 6px", borderRadius: 4,
          }}>
            {isPositive
              ? <TrendingUp size={10} color={impactColor} />
              : <TrendingDown size={10} color={impactColor} />
            }
            <span style={{ fontSize: 11, fontWeight: 600, color: impactColor, fontFamily: M }}>
              {p.impact_ctr_pct} CTR
            </span>
          </div>
        )}
      </div>

      {/* Insight text */}
      <p style={{
        fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.45,
        margin: "0 0 6px", fontFamily: F,
      }}>
        {displayLabel}
      </p>

      {/* Metrics row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {p.avg_ctr != null && p.avg_ctr > 0 && (
          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", fontFamily: M }}>
            CTR {(p.avg_ctr > 1 ? p.avg_ctr : p.avg_ctr * 100).toFixed(2)}%
          </span>
        )}
        {p.avg_roas != null && p.avg_roas > 0 && (
          <>
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.10)" }}>·</span>
            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", fontFamily: M }}>
              ROAS {p.avg_roas.toFixed(1)}x
            </span>
          </>
        )}
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.10)" }}>·</span>
        <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.25)", fontFamily: M }}>
          {(p.confidence * 100).toFixed(0)}% conf
        </span>
      </div>

      {/* Generate variation CTA */}
      {p.is_winner && onGenerateVariation && (
        <button
          onClick={() => onGenerateVariation(p)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(159,122,234,0.08)", border: "1px solid rgba(159,122,234,0.18)",
            borderRadius: 6, padding: "5px 10px", cursor: "pointer",
            transition: "all 0.12s", width: "100%", justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(159,122,234,0.14)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(159,122,234,0.30)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(159,122,234,0.08)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(159,122,234,0.18)";
          }}
        >
          <Sparkles size={11} color="#9f7aea" />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "#9f7aea", fontFamily: F }}>
            Generate variation
          </span>
        </button>
      )}
    </div>
  );
}

export type { DetectedPattern };
