/**
 * UsageBar — Inline usage bar for sidebar footer.
 * Shows execution capacity as PERCENTAGE + ascending action count.
 * Never exposes raw credit numbers. Premium performance feel.
 *
 * Display logic:
 *  Normal (<75%):  "Uso mensal"  ██████░░░░  42%
 *  Warning (75-89%): "Uso mensal"  ████████░░  78% + warning text
 *  Critical (90%+):  "Uso mensal"  █████████░  94% + critical text
 *  Empty (100%):     "Uso mensal"  ██████████  100% + limit reached
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
  const usedPct = total > 0 ? Math.round((used / total) * 100) : 0;
  const isEmpty = remaining <= 0 && total > 0;
  const isLow = usedPct >= 75 && !isEmpty;
  const isCritical = usedPct >= 90 && !isEmpty;

  // Colors
  const pctColor = isEmpty ? "#ef4444" : isCritical ? "#ef4444" : isLow ? "#eab308" : "rgba(255,255,255,0.55)";
  const barFill = isEmpty ? "#ef4444" : isCritical ? "#ef4444" : isLow ? "#eab308" : "#0ea5e9";
  const labelColor = isEmpty ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.55)";

  if (loading && !usage) {
    return (
      <div style={{ padding: "8px 14px", margin: "0 6px" }}>
        <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)" }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 14px 8px", margin: "0 6px" }}>
      {/* Label + percentage */}
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 6,
      }}>
        <span style={{
          fontSize: 11.5, fontWeight: 500,
          color: labelColor,
        }}>
          {{ pt: "Uso mensal", es: "Uso mensual", fr: "Utilisation mensuelle", de: "Monatliche Nutzung", zh: "月度用量", ar: "الاستخدام الشهري", en: "Monthly usage" }[language] || "Monthly usage"}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 600,
          color: pctColor,
          fontVariantNumeric: "tabular-nums",
        }}>
          {usedPct}%
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

      {/* Status text — contextual, with capacity hint at 80%+ */}
      {isEmpty ? (
        <p
          onClick={() => window.dispatchEvent(new CustomEvent("adbrief:open-capacity-modal"))}
          style={{ margin: "6px 0 0", fontSize: 10.5, fontWeight: 600, color: "#ef4444", lineHeight: 1.4, cursor: "pointer" }}
        >
          {{ pt: "Limite atingido — adicionar capacidade", es: "Límite alcanzado — agregar capacidad", fr: "Limite atteinte — ajouter de la capacité", de: "Limit erreicht — Kapazität hinzufügen", zh: "已达上限 — 增加容量", ar: "تم بلوغ الحد — إضافة سعة", en: "Limit reached — add capacity" }[language] || "Limit reached — add capacity"}
        </p>
      ) : isCritical ? (
        <p
          onClick={() => window.dispatchEvent(new CustomEvent("adbrief:open-capacity-modal"))}
          style={{ margin: "6px 0 0", fontSize: 10.5, fontWeight: 500, color: "#ef4444", lineHeight: 1.4, cursor: "pointer" }}
        >
          {{ pt: "Quase no limite — expandir capacidade", es: "Casi en el límite — expandir capacidad", fr: "Presque à la limite — étendre la capacité", de: "Fast am Limit — Kapazität erweitern", zh: "接近上限 — 扩展容量", ar: "قريب من الحد — توسيع السعة", en: "Near limit — expand capacity" }[language] || "Near limit — expand capacity"}
        </p>
      ) : isLow ? (
        <p
          onClick={() => window.dispatchEvent(new CustomEvent("adbrief:open-capacity-modal"))}
          style={{ margin: "6px 0 0", fontSize: 10.5, fontWeight: 500, color: "rgba(234,179,8,0.7)", lineHeight: 1.4, cursor: "pointer" }}
        >
          {{ pt: "Uso elevado — expandir capacidade", es: "Uso elevado — expandir capacidad", fr: "Utilisation élevée — étendre la capacité", de: "Hohe Nutzung — Kapazität erweitern", zh: "用量较高 — 扩展容量", ar: "استخدام مرتفع — توسيع السعة", en: "High usage — expand capacity" }[language] || "High usage — expand capacity"}
        </p>
      ) : null}
    </div>
  );
}
