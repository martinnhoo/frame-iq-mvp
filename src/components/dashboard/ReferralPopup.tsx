// ReferralPopup — premium floating card, bottom-right, dismissable 24h
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Copy, Check, X, Gift, Users, Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const A = "#0da2e7";
const GREEN = "#10b981";
const F = "'DM Sans','Plus Jakarta Sans',system-ui,sans-serif";
const MONO = "'DM Mono','SF Mono',monospace";
const LS_KEY = "adbrief_referral_popup_dismissed";

interface Props { userId?: string; }

export function ReferralPopup({ userId }: Props) {
  const { language } = useLanguage();
  const pt = language === "pt", es = language === "es";

  const [visible, setVisible] = useState(false);
  const [code, setCode] = useState("");
  const [totalRefs, setTotalRefs] = useState(0);
  const [bonusAnalyses, setBonusAnalyses] = useState(0);
  const [copied, setCopied] = useState(false);
  const [closing, setClosing] = useState(false);
  const [hoverClose, setHoverClose] = useState(false);
  const [hoverCopy, setHoverCopy] = useState(false);
  const [hoverShare, setHoverShare] = useState(false);
  const mountRef = useRef(true);

  // Check 24h cooldown + load data
  useEffect(() => {
    if (!userId) return;
    mountRef.current = true;

    try {
      const dismissed = localStorage.getItem(LS_KEY);
      if (dismissed) {
        const ts = parseInt(dismissed, 10);
        if (!isNaN(ts) && Date.now() - ts < 24 * 60 * 60 * 1000) return;
      }
    } catch { /* ignore */ }

    const timer = setTimeout(() => {
      supabase.functions.invoke("claim-referral", {
        body: { action: "get_info", user_id: userId },
      }).then(({ data, error }: any) => {
        if (!mountRef.current) return;
        // Edge function returns: referral_code, total_referrals, bonus_analyses
        const refCode = data?.referral_code || data?.code || "";
        if (refCode) {
          setCode(refCode);
          setTotalRefs(data?.total_referrals || 0);
          setBonusAnalyses(data?.bonus_analyses || data?.bonus_earned || 0);
          setVisible(true);
        } else if (!error) {
          // Fallback: show popup even without edge function data
          // Generate a visual code from userId
          const fallback = userId.replace(/-/g, "").substring(0, 8).toUpperCase();
          setCode(fallback);
          setVisible(true);
        }
      }).catch(() => {
        // Even on error, show popup with userId-based code
        if (!mountRef.current) return;
        const fallback = (userId || "").replace(/-/g, "").substring(0, 8).toUpperCase();
        if (fallback) {
          setCode(fallback);
          setVisible(true);
        }
      });
    }, 1200);

    return () => { mountRef.current = false; clearTimeout(timer); };
  }, [userId]);

  const dismiss = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
      try { localStorage.setItem(LS_KEY, String(Date.now())); } catch { /* */ }
    }, 300);
  }, []);

  const referralUrl = `https://adbrief.pro/signup?ref=${code}`;

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      toast.success(pt ? "Link copiado!" : es ? "¡Link copiado!" : "Link copied!");
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      // Fallback for clipboard API
      toast.info(pt ? "Copie manualmente:" : "Copy manually:");
    });
  }, [referralUrl, pt, es]);

  const shareLink = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: pt ? "Experimente o AdBrief" : "Try AdBrief",
        text: pt ? "Use meu link e ganhe análises grátis!" : "Use my link and get free analyses!",
        url: referralUrl,
      }).catch(() => {});
    } else {
      copyLink();
    }
  }, [referralUrl, pt, copyLink]);

  if (!visible || !code) return null;

  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 9999,
      width: 340, maxWidth: "calc(100vw - 40px)",
      background: "linear-gradient(165deg, #0f1118 0%, #0a0c12 100%)",
      border: `1px solid rgba(13,162,231,0.18)`,
      borderRadius: 20,
      boxShadow: `
        0 24px 80px rgba(0,0,0,0.55),
        0 0 60px rgba(13,162,231,0.06),
        inset 0 1px 0 rgba(255,255,255,0.04)
      `,
      overflow: "hidden",
      animation: closing ? "rp-out 0.3s cubic-bezier(0.4,0,1,1) forwards" : "rp-in 0.5s cubic-bezier(0.16,1,0.3,1) both",
      fontFamily: F,
    }}>
      <style>{`
        @keyframes rp-in{
          from{opacity:0;transform:translateY(24px) scale(0.92)}
          to{opacity:1;transform:translateY(0) scale(1)}
        }
        @keyframes rp-out{
          to{opacity:0;transform:translateY(16px) scale(0.95)}
        }
        @keyframes rp-glow{
          0%,100%{opacity:0.4}
          50%{opacity:0.8}
        }
        @keyframes rp-shimmer{
          0%{transform:translateX(-100%)}
          100%{transform:translateX(100%)}
        }
        @media(max-width:480px){
          .rp-root{width:calc(100vw - 24px)!important;right:12px!important;bottom:12px!important}
        }
      `}</style>

      {/* Top glow accent */}
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, transparent 0%, ${A}60 30%, ${A} 50%, ${A}60 70%, transparent 100%)`,
        animation: "rp-glow 3s ease-in-out infinite",
      }}/>

      {/* Shimmer overlay on top */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 80,
        background: `linear-gradient(135deg, transparent 40%, rgba(13,162,231,0.04) 50%, transparent 60%)`,
        pointerEvents: "none",
      }}/>

      {/* Close button */}
      <button
        onClick={dismiss}
        onMouseEnter={() => setHoverClose(true)}
        onMouseLeave={() => setHoverClose(false)}
        style={{
          position: "absolute", top: 12, right: 12, zIndex: 2,
          width: 28, height: 28, borderRadius: 8,
          background: hoverClose ? "rgba(255,255,255,0.08)" : "transparent",
          border: `1px solid ${hoverClose ? "rgba(255,255,255,0.12)" : "transparent"}`,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          color: hoverClose ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)",
          transition: "all 0.2s ease",
          padding: 0,
        }}
      >
        <X size={14} />
      </button>

      {/* Header */}
      <div style={{ padding: "18px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: `linear-gradient(135deg, ${A}18, ${A}06)`,
          border: `1px solid ${A}22`,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", flexShrink: 0,
        }}>
          <Gift size={20} color={A} strokeWidth={1.6} />
          {/* Subtle pulse */}
          <div style={{
            position: "absolute", inset: -2, borderRadius: 14,
            border: `1px solid ${A}15`,
            animation: "rp-glow 2.5s ease-in-out infinite",
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 15, fontWeight: 700, color: "#f0f2f8",
            letterSpacing: "-0.02em", lineHeight: 1.2,
          }}>
            {pt ? "Indique amigos" : es ? "Invita amigos" : "Refer friends"}
          </p>
          <p style={{
            margin: "3px 0 0", fontSize: 11.5, color: "rgba(255,255,255,0.38)",
            lineHeight: 1.3, fontWeight: 500,
          }}>
            {pt ? "Ganhe +10 análises por indicação" : es ? "Gana +10 análisis por referido" : "Earn +10 analyses per referral"}
          </p>
        </div>
      </div>

      {/* Code + copy area */}
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{
          display: "flex", alignItems: "stretch",
          background: "rgba(13,162,231,0.04)",
          border: `1px solid rgba(13,162,231,0.12)`,
          borderRadius: 12, overflow: "hidden",
          transition: "border-color 0.2s",
          ...(hoverCopy ? { borderColor: `rgba(13,162,231,0.30)` } : {}),
        }}>
          <div style={{
            flex: 1, padding: "11px 16px",
            fontFamily: MONO, fontSize: 14, fontWeight: 700,
            color: A, letterSpacing: "0.1em",
            display: "flex", alignItems: "center",
          }}>
            {code}
          </div>
          <button
            onClick={copyLink}
            onMouseEnter={() => setHoverCopy(true)}
            onMouseLeave={() => setHoverCopy(false)}
            style={{
              padding: "11px 16px",
              background: copied
                ? `rgba(16,185,129,0.10)`
                : hoverCopy
                  ? `rgba(13,162,231,0.10)`
                  : "transparent",
              border: "none", borderLeft: `1px solid rgba(13,162,231,0.12)`,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              color: copied ? GREEN : A,
              fontSize: 12, fontWeight: 600, fontFamily: F,
              transition: "all 0.2s ease",
              whiteSpace: "nowrap",
            }}
          >
            {copied
              ? <><Check size={13} strokeWidth={2.5} />{pt ? "Copiado!" : "Copied!"}</>
              : <><Copy size={13} />{pt ? "Copiar" : "Copy"}</>
            }
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 8, padding: "14px 20px 0" }}>
        <div style={{
          flex: 1, padding: "12px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 10, textAlign: "center",
          transition: "all 0.2s",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, marginBottom: 5,
          }}>
            <Users size={12} color="rgba(13,162,231,0.5)" />
            <span style={{
              fontSize: 20, fontWeight: 800, color: "#f0f2f8",
              fontFamily: MONO, lineHeight: 1, letterSpacing: "-0.03em",
            }}>
              {totalRefs}
            </span>
          </div>
          <span style={{
            fontSize: 10, color: "rgba(255,255,255,0.28)", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: MONO,
          }}>
            {pt ? "Indicações" : es ? "Referidos" : "Referrals"}
          </span>
        </div>
        <div style={{
          flex: 1, padding: "12px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 10, textAlign: "center",
          transition: "all 0.2s",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, marginBottom: 5,
          }}>
            <Sparkles size={12} color="rgba(13,162,231,0.5)" />
            <span style={{
              fontSize: 20, fontWeight: 800, color: "#f0f2f8",
              fontFamily: MONO, lineHeight: 1, letterSpacing: "-0.03em",
            }}>
              +{bonusAnalyses}
            </span>
          </div>
          <span style={{
            fontSize: 10, color: "rgba(255,255,255,0.28)", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: MONO,
          }}>
            {pt ? "Bônus" : "Bonus"}
          </span>
        </div>
      </div>

      {/* Share button */}
      <div style={{ padding: "14px 20px 16px" }}>
        <button
          onClick={shareLink}
          onMouseEnter={() => setHoverShare(true)}
          onMouseLeave={() => setHoverShare(false)}
          style={{
            width: "100%", padding: "11px 16px",
            background: hoverShare
              ? `linear-gradient(135deg, ${A}, rgba(13,162,231,0.85))`
              : `linear-gradient(135deg, ${A}dd, ${A}bb)`,
            border: "none", borderRadius: 10,
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 7,
            color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: F,
            letterSpacing: "-0.01em",
            transition: "all 0.2s ease",
            boxShadow: hoverShare
              ? `0 4px 20px rgba(13,162,231,0.35)`
              : `0 2px 12px rgba(13,162,231,0.20)`,
            transform: hoverShare ? "translateY(-1px)" : "none",
          }}
        >
          <ExternalLink size={14} strokeWidth={2} />
          {pt ? "Compartilhar link" : es ? "Compartir enlace" : "Share link"}
        </button>
      </div>

      {/* Bottom subtle line */}
      <div style={{
        height: 1,
        background: `linear-gradient(90deg, transparent, rgba(13,162,231,0.10), transparent)`,
      }} />
    </div>
  );
}
