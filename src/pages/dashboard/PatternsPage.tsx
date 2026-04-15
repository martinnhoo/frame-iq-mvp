/**
 * PatternsPage — Full-page view of detected creative patterns.
 * Shows all patterns for the selected persona with detail cards,
 * top ads per pattern, and "Generate variation" CTAs.
 */
import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { TrendingUp, TrendingDown, Sparkles, RefreshCw, Loader2, ArrowLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";
const M = "'DM Mono', monospace";

interface DetectedPattern {
  id?: string;
  pattern_key: string;
  variables?: Record<string, string>;
  avg_ctr: number | null;
  avg_cpc?: number | null;
  avg_roas?: number | null;
  sample_size: number;
  confidence: number;
  is_winner: boolean;
  insight_text: string | null;
  last_updated?: string;
}

const PatternsPage: React.FC = () => {
  const ctx = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const userId = ctx.user?.id;
  const personaId = ctx.selectedPersona?.id;
  const personaName = ctx.selectedPersona?.name || "Account";

  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [baseline, setBaseline] = useState<{ ctr: number; cpc: number; roas: number; ads_count: number } | null>(null);

  const fetchPatterns = useCallback(async () => {
    if (!userId || !personaId) { setPatterns([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("detect-patterns", {
        body: { action: "list", user_id: userId, persona_id: personaId },
      });
      setPatterns(data?.patterns || []);
    } catch (err) {
      console.error("PatternsPage fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, personaId]);

  const runDetection = useCallback(async () => {
    if (!userId || !personaId || detecting) return;
    setDetecting(true);
    try {
      const { data } = await supabase.functions.invoke("detect-patterns", {
        body: { action: "detect", user_id: userId, persona_id: personaId },
      });
      setPatterns(data?.patterns || []);
      if (data?.baseline) setBaseline(data.baseline);
    } catch (err) {
      console.error("PatternsPage detect:", err);
    } finally {
      setDetecting(false);
    }
  }, [userId, personaId, detecting]);

  useEffect(() => { fetchPatterns(); }, [fetchPatterns]);

  // Auto-detect if empty
  useEffect(() => {
    if (!loading && patterns.length === 0 && userId && personaId && !detecting) {
      const t = setTimeout(runDetection, 600);
      return () => clearTimeout(t);
    }
  }, [loading, patterns.length, userId, personaId, detecting]);

  const winners = patterns.filter((p) => p.is_winner);
  const others = patterns.filter((p) => !p.is_winner);

  return (
    <div style={{
      maxWidth: 720, margin: "0 auto", padding: "32px 20px 64px",
      fontFamily: F,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{
            fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.90)",
            margin: 0, letterSpacing: "-0.02em",
          }}>
            Creative Patterns
          </h1>
          <p style={{
            fontSize: 13, color: "rgba(255,255,255,0.40)", margin: "4px 0 0",
            fontFamily: F,
          }}>
            {personaName} — patterns detected from real ad performance data
          </p>
        </div>
        <button
          onClick={runDetection}
          disabled={detecting}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(159,122,234,0.10)", border: "1px solid rgba(159,122,234,0.20)",
            borderRadius: 8, padding: "8px 14px", cursor: detecting ? "default" : "pointer",
            transition: "all 0.15s", opacity: detecting ? 0.6 : 1,
          }}
        >
          {detecting
            ? <Loader2 size={14} color="#9f7aea" style={{ animation: "spin 1s linear infinite" }} />
            : <RefreshCw size={14} color="#9f7aea" />
          }
          <span style={{ fontSize: 13, fontWeight: 600, color: "#9f7aea", fontFamily: F }}>
            {detecting ? "Detecting..." : "Re-detect"}
          </span>
        </button>
      </div>

      {/* Baseline stats */}
      {baseline && (
        <div style={{
          display: "flex", gap: 16, marginBottom: 20, padding: "12px 16px",
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10,
        }}>
          <Stat label="Baseline CTR" value={`${(baseline.ctr * 100).toFixed(2)}%`} />
          {baseline.roas > 0 && <Stat label="Baseline ROAS" value={`${baseline.roas.toFixed(1)}x`} />}
          {baseline.cpc > 0 && <Stat label="Baseline CPC" value={`$${baseline.cpc.toFixed(2)}`} />}
          <Stat label="Ads analyzed" value={String(baseline.ads_count)} />
        </div>
      )}

      {/* Loading */}
      {(loading || detecting) && patterns.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
          <style>{`@keyframes ppPulse{0%,100%{opacity:0.3}50%{opacity:0.6}}`}</style>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{
              height: 80, borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
              animation: `ppPulse 1.4s ease-in-out ${i * 0.12}s infinite`,
            }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !detecting && patterns.length === 0 && (
        <div style={{
          textAlign: "center", padding: "48px 20px",
          background: "rgba(255,255,255,0.02)", borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <TrendingUp size={32} color="rgba(255,255,255,0.15)" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.50)", margin: "0 0 6px", fontWeight: 600 }}>
            No patterns detected yet
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.30)", margin: 0, maxWidth: 360, marginInline: "auto" }}>
            Patterns appear automatically as your ads accumulate performance data.
            Connect your Meta account and sync your ad diary to get started.
          </p>
        </div>
      )}

      {/* Winners */}
      {winners.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{
            fontSize: 13, fontWeight: 600, color: "#9f7aea",
            letterSpacing: "0.06em", textTransform: "uppercase",
            margin: "0 0 10px", fontFamily: F,
          }}>
            Winning patterns
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {winners.map((p, i) => (
              <FullPatternCard key={p.pattern_key || i} pattern={p} navigate={navigate} />
            ))}
          </div>
        </div>
      )}

      {/* Other patterns */}
      {others.length > 0 && (
        <div>
          <h2 style={{
            fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.40)",
            letterSpacing: "0.06em", textTransform: "uppercase",
            margin: "0 0 10px", fontFamily: F,
          }}>
            Other patterns
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {others.map((p, i) => (
              <FullPatternCard key={p.pattern_key || i} pattern={p} navigate={navigate} />
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", margin: "0 0 2px", fontFamily: F }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.80)", margin: 0, fontFamily: M }}>{value}</p>
    </div>
  );
}

function FullPatternCard({ pattern: p, navigate }: { pattern: DetectedPattern; navigate: any }) {
  const [hov, setHov] = useState(false);

  // Parse label from pattern_key
  const parts = p.pattern_key?.split(":") || [];
  const featureType = p.variables?.feature_type || parts[2] || "";
  const featureValue = p.variables?.feature_value || parts[3] || "";
  const label = featureValue ? `${featureType}: ${featureValue}` : p.pattern_key;

  // Impact calculation from baseline
  const ctrDisplay = p.avg_ctr ? (p.avg_ctr > 1 ? p.avg_ctr : p.avg_ctr * 100).toFixed(2) : null;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "14px 16px",
        borderRadius: 10,
        background: hov ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${p.is_winner ? "rgba(159,122,234,0.18)" : "rgba(255,255,255,0.06)"}`,
        transition: "all 0.12s",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {p.is_winner && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: "#9f7aea",
              background: "rgba(159,122,234,0.12)", padding: "2px 6px",
              borderRadius: 4, letterSpacing: "0.04em", fontFamily: F,
            }}>
              WINNER
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.60)", fontFamily: F }}>
            {label}
          </span>
        </div>
        <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.25)", fontFamily: M }}>
          {p.sample_size} ads · {(p.confidence * 100).toFixed(0)}% conf
        </span>
      </div>

      {/* Insight */}
      {p.insight_text && (
        <p style={{
          fontSize: 13, color: "rgba(255,255,255,0.70)", lineHeight: 1.5,
          margin: "0 0 8px", fontFamily: F,
        }}>
          {p.insight_text}
        </p>
      )}

      {/* Metrics */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: p.is_winner ? 10 : 0 }}>
        {ctrDisplay && (
          <span style={{ fontSize: 12, color: p.is_winner ? "#34d399" : "rgba(255,255,255,0.45)", fontFamily: M }}>
            CTR {ctrDisplay}%
          </span>
        )}
        {p.avg_roas != null && p.avg_roas > 0 && (
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", fontFamily: M }}>
            ROAS {p.avg_roas.toFixed(1)}x
          </span>
        )}
        {p.avg_cpc != null && p.avg_cpc > 0 && (
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", fontFamily: M }}>
            CPC ${p.avg_cpc.toFixed(2)}
          </span>
        )}
      </div>

      {/* CTA for winners */}
      {p.is_winner && (
        <button
          onClick={() => {
            const ft = p.feature_type || p.variables?.feature_type || "";
            const st = { state: { fromPattern: p } };
            if (ft === "hook_type" || ft === "hook_presence") navigate("/dashboard/hooks", st);
            else if (ft === "format" || ft === "combination" || ft === "text_density" || ft === "gap") navigate("/dashboard/boards/new", st);
            else if (ft === "campaign" || ft === "adset") navigate("/dashboard/brief", st);
            else navigate("/dashboard/hooks", st);
          }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(159,122,234,0.08)", border: "1px solid rgba(159,122,234,0.20)",
            borderRadius: 7, padding: "7px 14px", cursor: "pointer",
            transition: "all 0.12s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(159,122,234,0.15)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(159,122,234,0.08)";
          }}
        >
          <Sparkles size={12} color="#9f7aea" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#9f7aea", fontFamily: F }}>
            Generate variation based on this pattern
          </span>
          <ChevronRight size={12} color="#9f7aea" style={{ marginLeft: "auto" }} />
        </button>
      )}
    </div>
  );
}

export default PatternsPage;
