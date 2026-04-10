/**
 * CreditBar — Inline credit usage indicator for the sidebar footer.
 * Shows a progress bar with remaining/total credits for the current month.
 * Matches AdBrief design tokens: accent=#0da2e7, bg=#080a0f
 */
import { useState, useEffect, useCallback } from "react";
import { Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

interface CreditData {
  total: number;
  used: number;
  bonus: number;
  remaining: number;
  pool: number;
}

interface Props {
  userId?: string;
  plan?: string;
}

const F = "'Plus Jakarta Sans', sans-serif";
const A = "#0da2e7";

export function CreditBar({ userId, plan }: Props) {
  const [credits, setCredits] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();
  const pt = language === "pt";

  const fetchCredits = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase.functions.invoke("check-usage", {
        body: { user_id: userId },
      });
      if (data?.credits) setCredits(data.credits);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCredits();
    // Refresh every 60 seconds
    const interval = setInterval(fetchCredits, 60_000);
    return () => clearInterval(interval);
  }, [fetchCredits]);

  // Listen for credit updates from other components
  useEffect(() => {
    const handler = () => fetchCredits();
    window.addEventListener("adbrief:credits-updated", handler);
    return () => window.removeEventListener("adbrief:credits-updated", handler);
  }, [fetchCredits]);

  if (loading || !credits) {
    return (
      <div style={{ padding: "6px 14px", marginLeft: 6, marginRight: 6 }}>
        <div style={{
          height: 4, borderRadius: 2,
          background: "rgba(255,255,255,0.04)",
        }} />
      </div>
    );
  }

  const total = credits.total;
  const remaining = credits.remaining;
  const usedPct = total > 0 ? ((total - remaining) / total) * 100 : 0;

  // Color based on usage
  let barColor = A; // blue (healthy)
  let barGlow = `${A}40`;
  if (usedPct >= 90) {
    barColor = "#ef4444"; // red (critical)
    barGlow = "rgba(239,68,68,0.4)";
  } else if (usedPct >= 75) {
    barColor = "#f59e0b"; // amber (warning)
    barGlow = "rgba(245,158,11,0.4)";
  }

  const fillPct = Math.min(100, Math.max(0, 100 - usedPct));

  return (
    <div style={{
      padding: "8px 14px 6px",
      marginLeft: 6, marginRight: 6,
    }}>
      {/* Label row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 5,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Zap size={11} strokeWidth={2} color={barColor} style={{ opacity: 0.8 }} />
          <span style={{
            fontSize: 10.5, fontWeight: 600, fontFamily: F,
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.02em",
          }}>
            {pt ? "Créditos" : "Credits"}
          </span>
        </div>
        <span style={{
          fontSize: 10.5, fontWeight: 600, fontFamily: F,
          color: usedPct >= 90 ? "rgba(239,68,68,0.8)" : usedPct >= 75 ? "rgba(245,158,11,0.7)" : "rgba(255,255,255,0.50)",
        }}>
          {remaining.toLocaleString()}<span style={{ opacity: 0.4 }}> / {total.toLocaleString()}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4, borderRadius: 2,
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
        position: "relative",
      }}>
        <div style={{
          height: "100%", borderRadius: 2,
          width: `${fillPct}%`,
          background: barColor,
          boxShadow: `0 0 8px ${barGlow}`,
          transition: "width 0.5s ease, background 0.3s ease",
        }} />
      </div>

      {/* Warning text */}
      {usedPct >= 90 && remaining > 0 && (
        <p style={{
          margin: "4px 0 0", fontSize: 9.5, fontFamily: F,
          color: "rgba(239,68,68,0.6)", fontWeight: 500,
        }}>
          {pt ? "Créditos quase esgotados" : "Credits almost exhausted"}
        </p>
      )}
      {remaining <= 0 && (
        <p style={{
          margin: "4px 0 0", fontSize: 9.5, fontFamily: F,
          color: "rgba(239,68,68,0.7)", fontWeight: 600,
        }}>
          {pt ? "Sem créditos — faça upgrade" : "No credits — upgrade plan"}
        </p>
      )}
    </div>
  );
}
