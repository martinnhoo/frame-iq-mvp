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
 *
 * Studio plan → clean premium text badge with shimmer
 * Free/Maker/Pro → usage bar + upgrade CTA at bottom
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { getPlanCredits } from "@/lib/planLimits";
import { ArrowRight } from "lucide-react";

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

const F = "'Plus Jakarta Sans', system-ui, sans-serif";

/** @deprecated Use UsageBar instead */
export const CreditBar = UsageBar;

export function UsageBar({ userId, plan }: Props) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();
  const pt = language === "pt";
  const es = language === "es";

  // ── Studio plan → premium badge ──────────────────────────────────────────
  const isStudio = plan === "studio" || plan === "scale";
  if (isStudio) {
    return (
      <>
        <style>{`
          @keyframes studioShimmer {
            0%   { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
        `}</style>
        <div style={{
          padding: "14px 16px 10px", margin: "0 6px",
          display: "flex", flexDirection: "column", gap: 2,
        }}>
          <p style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 800,
            fontFamily: F,
            letterSpacing: "-0.02em",
            background: "linear-gradient(90deg, #a78bfa 0%, #c4b5fd 25%, #e0d4ff 50%, #c4b5fd 75%, #a78bfa 100%)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "studioShimmer 3s linear infinite",
          }}>
            Studio
          </p>
          <p style={{
            margin: 0, fontSize: 11, fontWeight: 500,
            color: "rgba(167,139,250,0.40)",
            fontFamily: F,
            letterSpacing: "0.01em",
          }}>
            {pt ? "Sem limites" : es ? "Sin límites" : "No limits"}
          </p>
        </div>
      </>
    );
  }

  // ── Usage fetching ───────────────────────────────────────────────────────
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

  const isFree = !plan || plan === "free" || plan === "trial";
  const planLabel = plan === "maker" ? "Maker" : plan === "pro" ? "Pro" : "Free";

  const openUpgrade = () => {
    window.dispatchEvent(new CustomEvent("adbrief:open-upgrade"));
  };

  if (loading && !usage) {
    return (
      <div style={{ padding: "8px 14px", margin: "0 6px" }}>
        <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)" }} />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes upgradeGlow {
          0%, 100% { box-shadow: 0 0 12px rgba(14,165,233,0.15), inset 0 1px 0 rgba(255,255,255,0.06); }
          50%       { box-shadow: 0 0 20px rgba(14,165,233,0.25), inset 0 1px 0 rgba(255,255,255,0.10); }
        }
        .sidebar-upgrade-btn:hover {
          background: linear-gradient(135deg, rgba(14,165,233,0.20), rgba(99,102,241,0.12)) !important;
          transform: translateY(-1px);
        }
        .sidebar-upgrade-btn:active { transform: translateY(0); }
      `}</style>
      <div style={{ padding: "10px 14px 4px", margin: "0 6px" }}>
        {/* Label + percentage */}
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          marginBottom: 6,
        }}>
          <span style={{
            fontSize: 11.5, fontWeight: 500,
            color: labelColor, fontFamily: F,
          }}>
            {{ pt: "Uso mensal", es: "Uso mensual", en: "Monthly usage" }[language] || "Monthly usage"}
          </span>
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: pctColor,
            fontVariantNumeric: "tabular-nums",
            fontFamily: F,
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

        {/* Status text — contextual */}
        {isEmpty ? (
          <p
            onClick={openUpgrade}
            style={{ margin: "6px 0 0", fontSize: 10.5, fontWeight: 600, color: "#ef4444", lineHeight: 1.4, cursor: "pointer", fontFamily: F }}
          >
            {{ pt: "Limite atingido — fazer upgrade", es: "Límite alcanzado — hacer upgrade", en: "Limit reached — upgrade now" }[language] || "Limit reached — upgrade now"}
          </p>
        ) : isCritical ? (
          <p
            onClick={openUpgrade}
            style={{ margin: "6px 0 0", fontSize: 10.5, fontWeight: 500, color: "#ef4444", lineHeight: 1.4, cursor: "pointer", fontFamily: F }}
          >
            {{ pt: "Quase no limite — expandir capacidade", es: "Casi en el límite — expandir capacidad", en: "Near limit — expand capacity" }[language] || "Near limit — expand capacity"}
          </p>
        ) : isLow ? (
          <p
            onClick={openUpgrade}
            style={{ margin: "6px 0 0", fontSize: 10.5, fontWeight: 500, color: "rgba(234,179,8,0.7)", lineHeight: 1.4, cursor: "pointer", fontFamily: F }}
          >
            {{ pt: "Uso elevado — expandir capacidade", es: "Uso elevado — expandir capacidad", en: "High usage — expand capacity" }[language] || "High usage — expand capacity"}
          </p>
        ) : null}

        {/* ── Upgrade CTA — shown for Free / Maker / Pro ── */}
        <button
          className="sidebar-upgrade-btn"
          onClick={openUpgrade}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "9px 12px",
            borderRadius: 10,
            border: "1px solid rgba(14,165,233,0.22)",
            background: "linear-gradient(135deg, rgba(14,165,233,0.12), rgba(99,102,241,0.06))",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: F,
            animation: "upgradeGlow 2.5s ease-in-out infinite",
            transition: "all 0.15s ease",
          }}
        >
          <span style={{
            flex: 1,
            textAlign: "left",
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.01em",
          }}>
            {{ pt: "Fazer upgrade", es: "Hacer upgrade", en: "Upgrade plan" }[language] || "Upgrade plan"}
          </span>
          <ArrowRight size={13} color="rgba(14,165,233,0.8)" strokeWidth={2.5} />
        </button>
      </div>
    </>
  );
}
