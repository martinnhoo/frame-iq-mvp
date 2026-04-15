/**
 * UsageBar — Inline usage bar for sidebar footer.
 * Shows execution capacity, NOT credits.
 * Clean startup style. No boxes, no borders. Just text + bar.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { getPlanCredits } from "@/lib/planLimits";

interface UsageData {
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

/** @deprecated Use UsageBar instead */
export const CreditBar = UsageBar;

export function UsageBar({ userId, plan }: Props) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();
  const pt = language === "pt";
  const es = language === "es";

  const fetchUsage = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase.functions.invoke("check-usage", {
        body: { user_id: userId },
      });
      if (data?.credits) setUsage(data.credits);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUsage();
    const interval = setInterval(fetchUsage, 60_000);
    return () => clearInterval(interval);
  }, [fetchUsage]);

  useEffect(() => {
    const handler = () => fetchUsage();
    window.addEventListener("adbrief:credits-updated", handler);
    return () => window.removeEventListener("adbrief:credits-updated", handler);
  }, [fetchUsage]);

  // Fallback: if API returned 0/0, use plan's pool
  const planPool = getPlanCredits(plan);
  const total = (usage && usage.total > 0) ? usage.total : planPool;
  const remaining = (usage && usage.total > 0) ? usage.remaining : planPool;
  const used = total - remaining;
  const usedPct = total > 0 ? (used / total) * 100 : 0;
  const isEmpty = remaining <= 0 && total > 0;
  const isLow = usedPct >= 75 && !isEmpty;
  const isCritical = usedPct >= 90 && !isEmpty;

  // Colors
  const countColor = isEmpty ? "#ef4444" : isCritical ? "#ef4444" : isLow ? "#eab308" : "rgba(255,255,255,0.9)";
  const barFill = isEmpty ? "#ef4444" : isCritical ? "#ef4444" : isLow ? "#eab308" : "#0ea5e9";

  if (loading && !usage) {
    return (
      <div style={{ padding: "8px 14px", margin: "0 6px" }}>
        <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)" }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 14px 8px", margin: "0 6px" }}>
      {/* Label + numbers */}
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 6,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 500,
          color: "rgba(255,255,255,0.5)",
        }}>
          {pt ? "Uso mensal" : es ? "Uso mensual" : "Monthly usage"}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 600,
          color: countColor,
          fontVariantNumeric: "tabular-nums",
        }}>
          {remaining.toLocaleString()}
          <span style={{ color: "rgba(255,255,255,0.25)", fontWeight: 400 }}> / {total.toLocaleString()}</span>
        </span>
      </div>

      {/* Bar */}
      <div style={{
        height: 4, borderRadius: 2,
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 2,
          width: `${Math.min(100, usedPct)}%`,
          background: barFill,
          transition: "width 0.4s ease",
        }} />
      </div>

      {/* Warnings */}
      {isCritical && !isEmpty && (
        <p style={{ margin: "6px 0 0", fontSize: 11, fontWeight: 500, color: "#ef4444" }}>
          {pt ? "Uso se aproximando do limite" : es ? "Uso acercándose al límite" : "Usage approaching monthly limit"}
        </p>
      )}
      {isEmpty && (
        <p style={{ margin: "6px 0 0", fontSize: 11, fontWeight: 600, color: "#ef4444" }}>
          {pt ? "Limite mensal atingido" : es ? "Límite mensual alcanzado" : "Monthly limit reached"}
        </p>
      )}
    </div>
  );
}
