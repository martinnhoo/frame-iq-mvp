/**
 * CreditBar — Credit usage indicator for sidebar footer.
 * Bold, vivid design. No SVG icons. Strong readable fonts.
 */
import { useState, useEffect, useCallback } from "react";
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

export function CreditBar({ userId, plan }: Props) {
  const [credits, setCredits] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();
  const pt = language === "pt";
  const es = language === "es";

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
    const interval = setInterval(fetchCredits, 60_000);
    return () => clearInterval(interval);
  }, [fetchCredits]);

  useEffect(() => {
    const handler = () => fetchCredits();
    window.addEventListener("adbrief:credits-updated", handler);
    return () => window.removeEventListener("adbrief:credits-updated", handler);
  }, [fetchCredits]);

  if (loading || !credits) {
    return (
      <div style={{ padding: "10px 16px", margin: "0 8px" }}>
        <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.04)" }} />
      </div>
    );
  }

  const total = credits.total;
  const remaining = credits.remaining;
  const used = total - remaining;
  const usedPct = total > 0 ? (used / total) * 100 : 100;
  const isEmpty = remaining <= 0;
  const isLow = usedPct >= 75 && !isEmpty;
  const isCritical = usedPct >= 90 && !isEmpty;

  // Vivid color system
  let accentColor = "#0ea5e9"; // blue
  let accentBg = "rgba(14,165,233,0.12)";
  let accentGlow = "rgba(14,165,233,0.35)";
  if (isCritical) {
    accentColor = "#ef4444";
    accentBg = "rgba(239,68,68,0.12)";
    accentGlow = "rgba(239,68,68,0.4)";
  } else if (isLow) {
    accentColor = "#f59e0b";
    accentBg = "rgba(245,158,11,0.10)";
    accentGlow = "rgba(245,158,11,0.35)";
  }
  if (isEmpty) {
    accentColor = "#ef4444";
    accentBg = "rgba(239,68,68,0.10)";
    accentGlow = "rgba(239,68,68,0.5)";
  }

  const fillPct = Math.min(100, Math.max(0, usedPct));

  return (
    <div style={{
      padding: isEmpty ? "14px 16px" : "10px 16px",
      margin: "0 8px",
      borderRadius: 14,
      background: isEmpty ? accentBg : "transparent",
      border: isEmpty ? `1px solid ${accentColor}30` : "none",
      transition: "all 0.3s ease",
    }}>
      {/* Top row: label + count */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 7,
      }}>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: isEmpty ? accentColor : "rgba(255,255,255,0.7)",
          letterSpacing: "-0.01em",
        }}>
          {pt ? "Créditos" : es ? "Créditos" : "Credits"}
        </span>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          color: isEmpty ? accentColor : isCritical ? "#ef4444" : isLow ? "#f59e0b" : "rgba(255,255,255,0.85)",
          fontVariantNumeric: "tabular-nums",
        }}>
          {remaining.toLocaleString()}
          <span style={{ fontWeight: 500, opacity: 0.5 }}> / {total.toLocaleString()}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 6,
        borderRadius: 4,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
        position: "relative",
      }}>
        <div style={{
          height: "100%",
          borderRadius: 4,
          width: `${fillPct}%`,
          background: isEmpty
            ? accentColor
            : `linear-gradient(90deg, ${accentColor}, ${isCritical ? "#dc2626" : isLow ? "#d97706" : "#06b6d4"})`,
          boxShadow: `0 0 10px ${accentGlow}`,
          transition: "width 0.5s ease, background 0.3s ease",
        }} />
      </div>

      {/* Warning / empty state */}
      {isCritical && !isEmpty && (
        <p style={{
          margin: "8px 0 0",
          fontSize: 12,
          fontWeight: 600,
          color: "#ef4444",
          lineHeight: 1.3,
        }}>
          {pt ? "Créditos quase esgotados" : es ? "Créditos casi agotados" : "Credits almost exhausted"}
        </p>
      )}

      {isEmpty && (
        <div style={{ marginTop: 10 }}>
          <p style={{
            margin: "0 0 10px",
            fontSize: 14,
            fontWeight: 700,
            color: "#ef4444",
            lineHeight: 1.3,
          }}>
            {pt ? "Seus créditos acabaram" : es ? "Tus créditos se agotaron" : "You're out of credits"}
          </p>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent("adbrief:show-upgrade"));
            }}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #0ea5e9, #06b6d4)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 16px rgba(14,165,233,0.3)",
              transition: "transform 0.15s, box-shadow 0.15s",
              letterSpacing: "-0.01em",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 20px rgba(14,165,233,0.45)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 16px rgba(14,165,233,0.3)";
            }}
          >
            {pt ? "Fazer upgrade" : es ? "Mejorar plan" : "Upgrade plan"}
          </button>
        </div>
      )}
    </div>
  );
}
