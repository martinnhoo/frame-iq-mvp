// SidebarReferral — compact inline referral widget for the sidebar footer
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Copy, Check, Gift, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const A = "#0da2e7";
const F = "'Plus Jakarta Sans',system-ui,sans-serif";

interface Props { userId?: string; }

export function ReferralPopup({ userId }: Props) {
  const { language } = useLanguage();
  const pt = language === "pt", es = language === "es";

  const [code, setCode] = useState("");
  const [totalRefs, setTotalRefs] = useState(0);
  const [bonusAnalyses, setBonusAnalyses] = useState(0);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hover, setHover] = useState(false);
  const mountRef = useRef(true);

  useEffect(() => {
    if (!userId) return;
    mountRef.current = true;

    supabase.functions.invoke("claim-referral", {
      body: { action: "get_info", user_id: userId },
    }).then(({ data }: any) => {
      if (!mountRef.current) return;
      const refCode = data?.referral_code || data?.code || "";
      if (refCode) {
        setCode(refCode);
        setTotalRefs(data?.total_referrals || 0);
        setBonusAnalyses(data?.bonus_analyses || data?.bonus_earned || 0);
      } else {
        const fallback = (userId || "").replace(/-/g, "").substring(0, 8).toUpperCase();
        setCode(fallback);
      }
    }).catch(() => {
      if (!mountRef.current) return;
      const fallback = (userId || "").replace(/-/g, "").substring(0, 8).toUpperCase();
      if (fallback) setCode(fallback);
    });

    return () => { mountRef.current = false; };
  }, [userId]);

  const referralUrl = `https://adbrief.pro/signup?ref=${code}`;

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      toast.success(pt ? "Link copiado!" : es ? "¡Link copiado!" : "Link copied!");
      setTimeout(() => setCopied(false), 2200);
    }).catch(() => {});
  }, [referralUrl, pt, es]);

  if (!code) return null;

  return (
    <div style={{ margin: "0 6px 4px", fontFamily: F }}>
      {/* Collapsed: clean row */}
      <button
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "8px 10px", borderRadius: 8,
          background: hover ? "rgba(255,255,255,0.04)" : "transparent",
          border: "none", cursor: "pointer",
          transition: "background 0.15s",
        }}
      >
        <Gift size={14} strokeWidth={1.6} color="rgba(255,255,255,0.45)" />
        <span style={{
          flex: 1, fontSize: 12.5, fontWeight: 500,
          color: "rgba(255,255,255,0.60)", textAlign: "left",
          fontFamily: F,
        }}>
          {pt ? "Indique amigos" : es ? "Invitar amigos" : "Refer friends"}
        </span>
        {totalRefs > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 600, color: A,
            background: `${A}12`, borderRadius: 4, padding: "1px 5px",
            fontFamily: F,
          }}>
            {totalRefs}
          </span>
        )}
        {expanded
          ? <ChevronDown size={11} color="rgba(255,255,255,0.20)" />
          : <ChevronUp size={11} color="rgba(255,255,255,0.20)" />
        }
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div style={{
          padding: "10px",
          animation: "sb-in 0.15s ease",
        }}>
          {/* Description */}
          <p style={{
            margin: "0 0 10px", fontSize: 11, color: "rgba(255,255,255,0.32)",
            lineHeight: 1.45, fontFamily: F,
          }}>
            {pt
              ? "Compartilhe seu link. Cada pessoa que criar uma conta, você ganha +10 melhorias grátis."
              : es
                ? "Comparte tu enlace. Por cada registro, ganas +10 mejoras gratis."
                : "Share your link. For each signup, you earn +10 free upgrades."}
          </p>

          {/* Code + copy */}
          <div style={{
            display: "flex", alignItems: "center",
            borderRadius: 7, overflow: "hidden",
            border: `1px solid rgba(255,255,255,0.06)`,
          }}>
            <span style={{
              flex: 1, padding: "7px 10px",
              fontSize: 12, fontWeight: 600, letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.55)",
              fontFamily: F,
            }}>
              {code}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); copyLink(); }}
              style={{
                padding: "7px 10px",
                background: copied ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)",
                border: "none", borderLeft: "1px solid rgba(255,255,255,0.06)",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                color: copied ? "#22A3A3" : "rgba(255,255,255,0.40)",
                fontSize: 11, fontWeight: 600, fontFamily: F,
                transition: "all 0.15s",
              }}
            >
              {copied
                ? <><Check size={11} strokeWidth={2.5} />{pt ? "Copiado" : "Copied"}</>
                : <><Copy size={11} />{pt ? "Copiar" : "Copy"}</>
              }
            </button>
          </div>

          {/* Stats row */}
          {(totalRefs > 0 || bonusAnalyses > 0) && (
            <div style={{
              display: "flex", gap: 0, marginTop: 8,
              fontSize: 11, color: "rgba(255,255,255,0.28)",
              fontFamily: F,
            }}>
              <span style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.50)" }}>{totalRefs}</span>
                {" "}{pt ? "indicações" : "referrals"}
              </span>
              <span>
                <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.50)" }}>+{bonusAnalyses}</span>
                {" "}{pt ? "bônus" : "bonus"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
