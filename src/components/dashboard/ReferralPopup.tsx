// ReferralPopup — floating card that shows on login, dismissable for 24h
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Copy, Check, X, Gift, Users, Sparkles } from "lucide-react";
import { toast } from "sonner";

const A = "#0da2e7";
const F = "'Plus Jakarta Sans', sans-serif";
const MONO = "'DM Mono','SF Mono',monospace";
const LS_KEY = "adbrief_referral_popup_dismissed";

interface Props {
  userId?: string;
}

export function ReferralPopup({ userId }: Props) {
  const { language } = useLanguage();
  const pt = language === "pt", es = language === "es";

  const [visible, setVisible] = useState(false);
  const [code, setCode] = useState("");
  const [totalRefs, setTotalRefs] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [copied, setCopied] = useState(false);
  const [closing, setClosing] = useState(false);

  // Check 24h cooldown
  useEffect(() => {
    if (!userId) return;
    try {
      const dismissed = localStorage.getItem(LS_KEY);
      if (dismissed) {
        const ts = parseInt(dismissed, 10);
        if (Date.now() - ts < 24 * 60 * 60 * 1000) return; // still within 24h
      }
    } catch { /* ignore */ }

    // Load referral info
    supabase.functions.invoke("claim-referral", {
      body: { action: "get_info", user_id: userId },
    }).then(({ data }: any) => {
      if (data?.code) {
        setCode(data.code);
        setTotalRefs(data.total_referrals || 0);
        setBonus(data.bonus_earned || 0);
        // Small delay so it feels intentional
        setTimeout(() => setVisible(true), 800);
      }
    }).catch(() => {});
  }, [userId]);

  const dismiss = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      try { localStorage.setItem(LS_KEY, String(Date.now())); } catch { /* */ }
    }, 250);
  }, []);

  const copyLink = useCallback(() => {
    const url = `https://adbrief.pro/signup?ref=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success(pt ? "Link copiado!" : es ? "¡Link copiado!" : "Link copied!");
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  }, [code, pt, es]);

  if (!visible || !code) return null;

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      width: 320, maxWidth: "calc(100vw - 48px)",
      background: "#0c0e14",
      border: `1px solid ${A}25`,
      borderRadius: 16,
      boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${A}08`,
      overflow: "hidden",
      animation: closing ? "rp-out 0.25s ease forwards" : "rp-in 0.35s ease both",
      fontFamily: F,
    }}>
      <style>{`
        @keyframes rp-in{from{opacity:0;transform:translateY(16px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes rp-out{to{opacity:0;transform:translateY(10px) scale(0.97)}}
      `}</style>

      {/* Top accent line */}
      <div style={{height:2,background:`linear-gradient(90deg, transparent, ${A}, transparent)`}}/>

      {/* Header */}
      <div style={{padding:"16px 18px 0",display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{
            width:36,height:36,borderRadius:10,
            background:`linear-gradient(135deg, ${A}20, ${A}08)`,
            border:`1px solid ${A}25`,
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>
            <Gift size={18} color={A} strokeWidth={1.8}/>
          </div>
          <div>
            <p style={{margin:0,fontSize:14,fontWeight:700,color:"#f0f2f8",letterSpacing:"-0.02em"}}>
              {pt?"Indique e ganhe":es?"Invita y gana":"Refer & Earn"}
            </p>
            <p style={{margin:"2px 0 0",fontSize:11,color:"rgba(255,255,255,0.40)"}}>
              {pt?"+10 análises para cada indicação":es?"+10 análisis por referido":"+10 analyses per referral"}
            </p>
          </div>
        </div>
        <button onClick={dismiss} style={{
          background:"none",border:"none",cursor:"pointer",padding:4,
          color:"rgba(255,255,255,0.25)",display:"flex",borderRadius:6,
          transition:"color 0.15s",
        }}
          onMouseEnter={e=>{e.currentTarget.style.color="rgba(255,255,255,0.5)"}}
          onMouseLeave={e=>{e.currentTarget.style.color="rgba(255,255,255,0.25)"}}>
          <X size={16}/>
        </button>
      </div>

      {/* Code + copy */}
      <div style={{padding:"14px 18px 0"}}>
        <div style={{
          display:"flex",alignItems:"center",gap:0,
          background:`${A}06`,border:`1px solid ${A}15`,
          borderRadius:10,overflow:"hidden",
        }}>
          <div style={{
            flex:1,padding:"10px 14px",
            fontFamily:MONO,fontSize:15,fontWeight:700,
            color:A,letterSpacing:"0.08em",
          }}>
            {code}
          </div>
          <button onClick={copyLink} style={{
            padding:"10px 14px",
            background:copied?`${A}15`:"transparent",
            border:"none",borderLeft:`1px solid ${A}15`,
            cursor:"pointer",display:"flex",alignItems:"center",gap:6,
            color:copied?"#10b981":A,fontSize:12,fontWeight:600,
            fontFamily:F,transition:"all 0.15s",whiteSpace:"nowrap",
          }}
            onMouseEnter={e=>{if(!copied)e.currentTarget.style.background=`${A}10`}}
            onMouseLeave={e=>{if(!copied)e.currentTarget.style.background="transparent"}}>
            {copied?<Check size={13}/>:<Copy size={13}/>}
            {copied?(pt?"Copiado":"Copied"):(pt?"Copiar link":"Copy link")}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"flex",gap:8,padding:"14px 18px"}}>
        <div style={{
          flex:1,padding:"10px 12px",
          background:`${A}04`,border:`1px solid ${A}10`,borderRadius:8,
          textAlign:"center",
        }}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,marginBottom:4}}>
            <Users size={11} color={`${A}60`}/>
            <span style={{fontSize:18,fontWeight:800,color:"#f0f2f8",fontFamily:MONO,lineHeight:1}}>{totalRefs}</span>
          </div>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.30)",fontWeight:500}}>
            {pt?"Indicações":"Referrals"}
          </span>
        </div>
        <div style={{
          flex:1,padding:"10px 12px",
          background:`${A}04`,border:`1px solid ${A}10`,borderRadius:8,
          textAlign:"center",
        }}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,marginBottom:4}}>
            <Sparkles size={11} color={`${A}60`}/>
            <span style={{fontSize:18,fontWeight:800,color:"#f0f2f8",fontFamily:MONO,lineHeight:1}}>+{bonus}</span>
          </div>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.30)",fontWeight:500}}>
            {pt?"Bônus ganho":"Bonus earned"}
          </span>
        </div>
      </div>

      {/* Bottom gradient */}
      <div style={{height:1,background:`linear-gradient(90deg, transparent, ${A}15, transparent)`}}/>
    </div>
  );
}
