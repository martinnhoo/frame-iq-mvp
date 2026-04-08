// AdBrief AI Chat v2
// Removed: dead imports (Sparkles, Brain, Radio, Wifi etc), unused vars (PLATFORMS, BS, SUGGS, metaConn),
//          duplicate LP_CSS injection, LP_CSS as separate string
// Fixed: DashboardLimitPopup missing plan prop, LABEL.en.placeholder bug,
//        single CSS block (no more split/duplicate style tags)
import React, { useState, useEffect, useRef } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { storage } from "@/lib/storage";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import {
  Send, Loader2, RotateCcw,
  ThumbsUp, ThumbsDown, Copy, RefreshCw,
  Zap, Clapperboard, ScanEye, LayoutDashboard, X,
  TrendingUp, TrendingDown, BarChart2, BarChart3,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Calendar,
} from "lucide-react";
// v20: removed unused — Sparkles, Brain, Upload, FileText, Activity, ExternalLink,
//      DollarSign, MousePointerClick, Eye, Target, Radio, Wifi, WifiOff
import UpgradeWall from "@/components/UpgradeWall";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
const F = "'Plus Jakarta Sans', sans-serif";
const M = "'Inter', sans-serif";

// ── ABAvatar — logo real do adbrief (PNG asset) ───────────────────────────────
function ABAvatar({ size = 28 }: { size?: number }) {
  const r = Math.round(size * 0.28);
  return (
    <div style={{
      width: size, height: size, borderRadius: r,
      background: "#0a0c10",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, overflow: "hidden",
    }}>
      <img
        src="/ab-avatar.png"
        alt="AB"
        width={size}
        height={size}
        style={{ display: "block", width: size, height: size, objectFit: "cover" }}
      />
    </div>
  );
}
const j = { fontFamily: F } as const;
const m = { fontFamily: M } as const;

// ── Platforms ──────────────────────────────────────────────────────────────────

// Inline icons

// Inline icons for use in JSX buttons
const PLATFORM_ICONS_INLINE: Record<string,React.ReactNode> = {
  meta: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill="url(#lobe-icons-meta-fill-0)"></path><path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill="url(#lobe-icons-meta-fill-1)"></path><path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill="url(#lobe-icons-meta-fill-2)"></path><path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill="url(#lobe-icons-meta-fill-3)"></path><path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill="url(#lobe-icons-meta-fill-4)"></path><path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill="url(#lobe-icons-meta-fill-5)"></path><path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="#0082FB"></path><path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill="url(#lobe-icons-meta-fill-6)"></path><path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082FB"></path><path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill="url(#lobe-icons-meta-fill-7)"></path><path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill="url(#lobe-icons-meta-fill-8)"></path><path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill="url(#lobe-icons-meta-fill-9)"></path><path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill="url(#lobe-icons-meta-fill-10)"></path><path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill="url(#lobe-icons-meta-fill-11)"></path><path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill="url(#lobe-icons-meta-fill-12)"></path><defs><linearGradient id="lobe-icons-meta-fill-0" x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%"><stop offset=".06%" stopColor="#0867DF"></stop><stop offset="45.39%" stopColor="#0668E1"></stop><stop offset="85.91%" stopColor="#0064E0"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-1" x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%"><stop offset="13.23%" stopColor="#0064DF"></stop><stop offset="99.88%" stopColor="#0064E0"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-2" x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%"><stop offset="1.47%" stopColor="#0072EC"></stop><stop offset="68.81%" stopColor="#0064DF"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-3" x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%"><stop offset="7.31%" stopColor="#007CF6"></stop><stop offset="99.43%" stopColor="#0072EC"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-4" x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%"><stop offset="7.31%" stopColor="#007FF9"></stop><stop offset="100%" stopColor="#007CF6"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-5" x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%"><stop offset="7.31%" stopColor="#007FF9"></stop><stop offset="100%" stopColor="#0082FB"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-6" x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%"><stop offset="27.99%" stopColor="#007FF8"></stop><stop offset="91.41%" stopColor="#0082FB"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-7" x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%"><stop offset="0%" stopColor="#0082FB"></stop><stop offset="99.95%" stopColor="#0081FA"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-8" x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%"><stop offset="6.19%" stopColor="#0081FA"></stop><stop offset="100%" stopColor="#0080F9"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-9" x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%"><stop offset="0%" stopColor="#027AF3"></stop><stop offset="100%" stopColor="#0080F9"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-10" x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%"><stop offset="0%" stopColor="#0377EF"></stop><stop offset="99.94%" stopColor="#0279F1"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-11" x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%"><stop offset=".19%" stopColor="#0471E9"></stop><stop offset="100%" stopColor="#0377EF"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-12" x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%"><stop offset="27.65%" stopColor="#0867DF"></stop><stop offset="100%" stopColor="#0471E9"></stop></linearGradient></defs></svg>,
};
const TOOLBAR: Record<string, Array<{icon: any; label: string; action: string; color: string}>> = {
  en: [
    { icon: Zap,            label: "Gen hooks",      action: "hooks",      color: "#06b6d4" },
    { icon: Clapperboard,   label: "Write script",   action: "script",     color: "#34d399" },
    { icon: ScanEye,        label: "Competitors",     action: "competitor", color: "#a78bfa" },
    { icon: LayoutDashboard,label: "Dashboard",      action: "dashboard",  color: "#0ea5e9" },
  ],
  pt: [
    { icon: Zap,            label: "Gerar hooks",        action: "hooks",      color: "#06b6d4" },
    { icon: Clapperboard,   label: "Escrever roteiro",   action: "script",     color: "#34d399" },
    { icon: ScanEye,        label: "Concorrentes",        action: "competitor", color: "#a78bfa" },
    { icon: LayoutDashboard,label: "Dashboard",          action: "dashboard",  color: "#0ea5e9" },
  ],
  es: [
    { icon: Zap,            label: "Generar hooks",     action: "hooks",      color: "#06b6d4" },
    { icon: Clapperboard,   label: "Escribir guión",    action: "script",     color: "#34d399" },
    { icon: ScanEye,        label: "Competidores",        action: "competitor", color: "#a78bfa" },
    { icon: BarChart2, label: "Dashboard",    action: "dashboard",  color: "#0ea5e9" },
  ],
};

// ── Block types ────────────────────────────────────────────────────────────────
interface Block {
  type: "action"|"pattern"|"hooks"|"warning"|"insight"|"off_topic"|"navigate"|"tool_call"|"dashboard"|"meta_action"|"dashboard_offer"|"text"|"trend_chart"|"limit_warning";
  remaining?: number;
  original_message?: string;
  title: string; content?: string; items?: string[];
  route?: string; params?: Record<string,string>; cta?: string;
  tool?: string; tool_params?: Record<string,string>;
  meta_action?: string; target_id?: string; target_type?: string; target_name?: string; value?: string;
  metrics?: { label:string; value:string; delta?:string; trend?:"up"|"down"|"flat" }[];
  table?: { headers:string[]; rows:string[][] };
  chart?: { type:"bar"; labels:string[]; values:number[]; colors?:string[] };
  trend?: { dates:string[]; ctr:number[]; roas:number[]; spend:number[] };
}
interface AIMessage {
  role: "user"|"assistant";
  blocks?: Block[];
  userText?: string;
  ts: number;
  id: number;
}


// ── InlineToolPanel ──────────────────────────────────────────────────────────────
function InlineToolPanel({ action, onClose, onSend, lang, accountCtx }: {
  action: string; onClose: () => void; onSend: (msg: string, displayText?: string) => void; lang: string;
  accountCtx?: { product?: string; niche?: string; market?: string; platform?: string; angle?: string };
}) {
  const [val, setVal] = useState(accountCtx?.angle || "");
  const [platform, setPlatform] = useState("meta"); // google disabled
  const [tone, setTone] = useState("direct");

  const config: Record<string, any> = {
    hooks: {
      icon: "⚡", color: "#06b6d4",
      title: { en: "Generate Hooks", pt: "Gerar Hooks", es: "Generar Hooks" },
      placeholder: { en: "Describe product, angle, or paste context…", pt: "Descreva o produto, ângulo, ou cole o contexto…", es: "Describe el producto, ángulo, o pega el contexto…" },
      cta: { en: "Generate 5 hooks →", pt: "Gerar 5 hooks →", es: "Generar 5 hooks →" },
      buildMsg: (v: string, p: string, t: string) => `[HOOKS] Generate 5 high-converting ${t} ad hooks. Product: ${accountCtx?.product||accountCtx?.niche||""}. Market: ${accountCtx?.market||lang.toUpperCase()}. Platform: ${accountCtx?.platform||p}. Tone: ${t}. Context: "${v}". Format: [N]. [Hook]. Label hook type. Use account patterns if available.`,
    },
    script: {
      icon: "✍️", color: "#34d399",
      title: { en: "Write Script", pt: "Escrever Roteiro", es: "Escribir Guión" },
      placeholder: { en: "What's the ad about? Paste brief or context…", pt: "Sobre o que é o anúncio? Cole o brief ou contexto…", es: "¿De qué trata el anuncio? Pega el brief o contexto…" },
      cta: { en: "Write script →", pt: "Escrever roteiro →", es: "Escribir guión →" },
      buildMsg: (v: string, p: string, t: string) => `[SCRIPT] Write a complete ${t} video ad script. Product: ${accountCtx?.product||accountCtx?.niche||""}. Market: ${accountCtx?.market||lang.toUpperCase()}. Platform: ${accountCtx?.platform||p}. Context: "${v}". Format: VO | ON-SCREEN | VISUAL. Hook in first 3s.`,
    },
    competitor: {
      icon: "🔍", color: "#a78bfa",
      title: { en: "Competitors Analysis", pt: "Análise de Concorrentes", es: "Análisis de Competidores" },
      placeholder: { en: "Paste competitor URL, describe their ad, or enter brand name…", pt: "Cole URL do concorrente, descreva o criativo, ou escreva a marca…", es: "Pega URL del competidor, describe su anuncio, o escribe la marca…" },
      cta: { en: "Analyze →", pt: "Analisar →", es: "Analizar →" },
      buildMsg: (v: string) => `Analyze this competitor: "${v}". Give: 1) Hook type & formula, 2) Emotional trigger, 3) Creative model, 4) What makes it work, 5) How to beat it.`,
    },
  };
  const cfg = config[action];
  if (!cfg) return null;
  const l = ["en","pt","es"].includes(lang) ? lang : "en";
  const tones = ["direct","conversational","urgent","educational"];
  const toneLabels: Record<string,Record<string,string>> = {
    direct:{en:"Direct",pt:"Direto",es:"Directo"},
    conversational:{en:"Conversational",pt:"Conversacional",es:"Conversacional"},
    urgent:{en:"Urgent",pt:"Urgente",es:"Urgente"},
    educational:{en:"Educational",pt:"Educativo",es:"Educativo"},
  };
  const submit = () => { if(val.trim()){onSend(cfg.buildMsg(val.trim(),platform,tone), val.trim());onClose();}};

  return (
    <div style={{borderRadius:16,overflow:"hidden",border:`1px solid rgba(255,255,255,0.10)`,background:"linear-gradient(160deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.03) 100%)",boxShadow:`0 0 0 1px rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.35), 0 0 40px ${cfg.color}08`,backdropFilter:"blur(16px)",margin:"0 0 12px",animation:"toolSlideIn 0.22s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px 10px",borderBottom:`1px solid rgba(255,255,255,0.08)`}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:24,height:24,borderRadius:7,background:`${cfg.color}20`,border:`1px solid ${cfg.color}35`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:12}}>{cfg.icon}</span>
          </div>
          <span style={{...j,fontSize:13,fontWeight:700,color:"#f0f2f8",letterSpacing:"-0.01em"}}>{cfg.title[l]}</span>
        </div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:7,color:"rgba(255,255,255,0.5)",cursor:"pointer",display:"flex",padding:"4px 6px",transition:"all 0.15s"}}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.10)";(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.8)"}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.06)";(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.5)"}}>
          <X size={13}/>
        </button>
      </div>
      <div style={{padding:"12px 16px 14px",display:"flex",flexDirection:"column",gap:10}}>
        {action!=="competitor"&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{display:"flex",gap:4}}>
              {["meta","tiktok"].map(p=>(
                <button key={p} onClick={()=>setPlatform(p)}
                  style={{padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:600,border:"none",cursor:"pointer",...j,background:platform===p?cfg.color:"rgba(255,255,255,0.05)",color:platform===p?"#000":"rgba(255,255,255,0.4)",transition:"all 0.1s"}}>
                  {p.charAt(0).toUpperCase()+p.slice(1)}
                </button>
              ))}
            </div>
            <div style={{width:1,height:16,background:"rgba(255,255,255,0.08)"}}/>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {tones.map(t=>(
                <button key={t} onClick={()=>setTone(t)}
                  style={{padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:600,border:"none",cursor:"pointer",...j,background:tone===t?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.03)",color:tone===t?"#fff":"rgba(255,255,255,0.3)",transition:"all 0.1s"}}>
                  {toneLabels[t][l]}
                </button>
              ))}
            </div>
          </div>
        )}
        <textarea value={val} onChange={e=>setVal(e.target.value)} placeholder={cfg.placeholder[l]} rows={3} autoFocus
          style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"10px 14px",color:"#f0f2f8",fontSize:13,lineHeight:1.65,resize:"none",outline:"none",...m,caretColor:cfg.color,boxSizing:"border-box",transition:"border-color 0.2s, background 0.2s, box-shadow 0.2s"}}
          onFocus={e=>{e.currentTarget.style.borderColor=`${cfg.color}55`;e.currentTarget.style.background="rgba(255,255,255,0.08)";e.currentTarget.style.boxShadow=`0 0 0 1px ${cfg.color}20`;}}
          onBlur={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.12)";e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.boxShadow="none";}}
          onKeyDown={e=>{if(e.key==="Enter"&&e.metaKey)submit();}}
        />
        <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8}}>
          <span style={{...m,fontSize:12,color:"rgba(255,255,255,0.18)"}}>⌘↵</span>
          <button onClick={submit} disabled={!val.trim()}
            style={{padding:"8px 20px",borderRadius:10,fontSize:13,fontWeight:700,background:val.trim()?"#0ea5e9":"rgba(255,255,255,0.06)",color:val.trim()?"#fff":"rgba(255,255,255,0.25)",border:"none",cursor:val.trim()?"pointer":"not-allowed",...j,transition:"all 0.15s",boxShadow:val.trim()?"0 4px 16px rgba(14,165,233,0.35)":"none"}}>
            {cfg.cta[l]}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard block ────────────────────────────────────────────────────────────
function DashboardBlock({block}:{block:Block}) {
  const cols = !block.metrics?.length ? 1 : block.metrics.length<=2 ? block.metrics.length : block.metrics.length<=4 ? 2 : 3;
  return (
    <div style={{borderRadius:16,border:"1px solid rgba(14,165,233,0.15)",background:"linear-gradient(135deg,rgba(14,165,233,0.04) 0%,rgba(6,182,212,0.02) 100%)",overflow:"hidden",marginBottom:10,boxShadow:"0 4px 24px rgba(0,0,0,0.25)"}}>
      <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",gap:9}}>
        <div style={{width:26,height:26,borderRadius:8,background:"#0369a1",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <BarChart2 size={12} color="#000"/>
        </div>
        <p style={{...j,fontSize:12,fontWeight:700,color:"#fff",flex:1,margin:0}}>{block.title}</p>
        <span style={{...m,fontSize:12,color:"rgba(14,165,233,0.5)",letterSpacing:"0.12em"}}>LIVE DATA</span>
      </div>
      {block.metrics && block.metrics.length>0 && (
        <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:"1px",background:"rgba(255,255,255,0.03)"}}>
          {block.metrics.map((metric,i)=>{
            const isUp=metric.trend==="up",isDown=metric.trend==="down";
            const mc=isDown?"#f87171":isUp?"#34d399":"#e2e8f0";
            return(
              <div key={i} style={{padding:"16px",background:"rgba(255,255,255,0.02)",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:`radial-gradient(circle,${mc}10,transparent 65%)`,pointerEvents:"none"}}/>
                <p style={{...m,fontSize:12,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>{metric.label}</p>
                <p style={{...j,fontSize:28,fontWeight:900,color:mc,letterSpacing:"-0.04em",lineHeight:1,marginBottom:6}}>{metric.value}</p>
                {metric.delta&&(
                  <div style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 7px",borderRadius:5,background:isDown?"rgba(248,113,113,0.1)":isUp?"rgba(52,211,153,0.1)":"rgba(255,255,255,0.05)",border:`1px solid ${isDown?"rgba(248,113,113,0.2)":isUp?"rgba(52,211,153,0.2)":"rgba(255,255,255,0.10)"}`}}>
                    {isDown?<TrendingDown size={9} color="#f87171"/>:isUp?<TrendingUp size={9} color="#34d399"/>:null}
                    <span style={{...m,fontSize:12,fontWeight:600,color:isDown?"#f87171":isUp?"#34d399":"rgba(255,255,255,0.4)"}}>{metric.delta}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {block.chart&&block.chart.type==="bar"&&(
        <div style={{padding:"16px",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
          {block.chart.labels.map((label,i)=>{
            const max=Math.max(...block.chart!.values);
            const pct=max>0?(block.chart!.values[i]/max)*100:0;
            const color=block.chart!.colors?.[i]||"#0ea5e9";
            return(
              <div key={i} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{...m,fontSize:12,color:"rgba(255,255,255,0.6)"}}>{label}</span>
                  <span style={{...j,fontSize:12,fontWeight:700,color:"#fff"}}>{block.chart!.values[i]}</span>
                </div>
                <div style={{height:6,background:"rgba(255,255,255,0.05)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${color},${color}99)`,borderRadius:3}}/>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {block.trend&&block.trend.dates.length>1&&(()=>{
        const d=block.trend;
        const n=d.dates.length;
        const W=340,H=80,PAD=8;
        // Sparkline path helper
        const path=(vals:number[],color:string)=>{
          const min=Math.min(...vals),max=Math.max(...vals);
          const range=max-min||1;
          const pts=vals.map((v,i)=>`${PAD+(i/(n-1))*(W-PAD*2)},${H-PAD-(v-min)/range*(H-PAD*2)}`);
          return <polyline key={color} points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>;
        };
        const lastCtr=d.ctr[n-1],firstCtr=d.ctr[0];
        const lastRoas=d.roas[n-1],firstRoas=d.roas[0];
        const ctrDelta=firstCtr>0?((lastCtr-firstCtr)/firstCtr*100):0;
        const roasDelta=firstRoas>0?((lastRoas-firstRoas)/firstRoas*100):0;
        const totalSpend=d.spend.reduce((a,b)=>a+b,0);
        return(
          <div style={{padding:"16px",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
            <div style={{display:"flex",gap:16,marginBottom:10}}>
              <div><span style={{...m,fontSize:12,color:"rgba(255,255,255,0.3)",display:"block"}}>CTR {n}d</span><span style={{...j,fontSize:16,fontWeight:700,color:"#fff"}}>{(lastCtr*100).toFixed(2)}%</span><span style={{...m,fontSize:12,color:ctrDelta>=0?"#4ade80":"#f87171",marginLeft:4}}>{ctrDelta>=0?"+":""}{ctrDelta.toFixed(1)}%</span></div>
              <div><span style={{...m,fontSize:12,color:"rgba(255,255,255,0.3)",display:"block"}}>ROAS {n}d</span><span style={{...j,fontSize:16,fontWeight:700,color:"#fff"}}>{lastRoas.toFixed(2)}x</span><span style={{...m,fontSize:12,color:roasDelta>=0?"#4ade80":"#f87171",marginLeft:4}}>{roasDelta>=0?"+":""}{roasDelta.toFixed(1)}%</span></div>
              <div><span style={{...m,fontSize:12,color:"rgba(255,255,255,0.3)",display:"block"}}>Spend {n}d</span><span style={{...j,fontSize:16,fontWeight:700,color:"#fff"}}>${totalSpend.toFixed(0)}</span></div>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{display:"block",maxWidth:W}}>
              {d.ctr.some(v=>v>0)&&path(d.ctr,"#0ea5e9")}
              {d.roas.some(v=>v>0)&&path(d.roas.map(v=>v/Math.max(...d.roas)),"#4ade80")}
            </svg>
            <div style={{display:"flex",gap:12,marginTop:6}}>
              <span style={{...m,fontSize:12,color:"rgba(255,255,255,0.35)",display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:2,background:"#0369a1",display:"inline-block",borderRadius:1}}/> CTR</span>
              {d.roas.some(v=>v>0)&&<span style={{...m,fontSize:12,color:"rgba(255,255,255,0.35)",display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:2,background:"#4ade80",display:"inline-block",borderRadius:1}}/> ROAS (norm.)</span>}
              <span style={{...m,fontSize:12,color:"rgba(255,255,255,0.25)",marginLeft:"auto"}}>{d.dates[0]} → {d.dates[n-1]}</span>
            </div>
          </div>
        );
      })()}
      {block.table&&(
        <div style={{overflowX:"auto",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"rgba(255,255,255,0.02)"}}>
              {block.table.headers.map((h,i)=>(
                <th key={i} style={{...m,fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.28)",textAlign:"left",padding:"8px 14px",letterSpacing:"0.1em",textTransform:"uppercase",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{block.table.rows.map((row,ri)=>(
              <tr key={ri} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                {row.map((cell,ci)=>(
                  <td key={ci} style={{...m,fontSize:12,color:ci===0?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.5)",padding:"10px 14px",fontWeight:ci===0?600:400}}>{cell}</td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {block.content&&<div style={{padding:"10px 16px"}}><p style={{...m,fontSize:12,color:"rgba(255,255,255,0.55)",lineHeight:1.65,margin:0}}>{block.content}</p></div>}
    </div>
  );
}

// ── Confirm action block ───────────────────────────────────────────────────────
function ConfirmActionBlock({block,onConfirm,lang}:{block:Block;onConfirm:(b:Block)=>Promise<void>;lang:string}) {
  const [state, setState] = useState<"idle"|"running"|"done"|"cancelled">("idle");
  const [result, setResult] = useState("");

  // Auto-execute read-only actions without user confirmation
  useEffect(()=>{
    if((block as any)._autoExec && state==="idle"){
      setState("running");
      onConfirm(block).then(()=>{setState("done");}).catch(()=>{setState("idle");});
    }
  },[]);

  if((block as any)._autoExec && state==="running") return(
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:10,background:"rgba(14,165,233,0.06)",border:"1px solid rgba(14,165,233,0.15)",marginBottom:8}}>
      <Loader2 size={13} color="#0ea5e9" className="animate-spin"/>
      <span style={{...m,fontSize:12,color:"rgba(238,240,246,0.6)"}}>{lang==="pt"?"Buscando dados...":lang==="es"?"Buscando datos...":"Fetching data..."}</span>
    </div>
  );
  if((block as any)._autoExec && state==="done") return null; // result shown by executeMetaAction callback

  const L: Record<string,Record<string,string>> = {
    en:{
      sure:"Are you sure you want to proceed with the action:",
      confirm:lang==="es"?"Sí, continuar":"Sim, continuar",cancel:lang==="es"?"Cancelar":"Cancelar",running:lang==="es"?"Ejecutando...":"Executando...",done:lang==="es"?"Listo ✓":"Pronto ✓",
      pause:lang==="es"?"Pausar":"Pausar",enable:lang==="es"?"Activar":"Ativar",update_budget:lang==="es"?"Actualizar budget":"Atualizar budget",publish:lang==="es"?"Publicar":"Publicar",duplicate:lang==="es"?"Duplicar":"Duplicar",
      warning:"This action will be logged and cannot be undone.",
    },
    pt:{
      sure:"Tem certeza que deseja prosseguir com a ação:",
      confirm:"Sim, prosseguir",cancel:"Cancelar",running:"Executando...",done:"Concluído ✓",
      pause:"Pausar",enable:"Ativar",update_budget:"Atualizar orçamento",publish:"Publicar",duplicate:"Duplicar",
      warning:"Esta ação será registrada e não pode ser desfeita.",
    },
    es:{
      sure:"¿Estás seguro de que deseas proceder con la acción:",
      confirm:"Sí, proceder",cancel:"Cancelar",running:"Ejecutando...",done:"Completado ✓",
      pause:"Pausar",enable:"Activar",update_budget:"Actualizar presupuesto",publish:"Publicar",duplicate:"Duplicar",
      warning:"Esta acción quedará registrada y no se puede deshacer.",
    },
  };
  const t=L[lang]||L.en;
  const actionLabel=t[block.meta_action as string]||block.meta_action||"Execute";
  const target=block.target_name||block.target_id||"";
  const icons: Record<string,string>={pause:"⏸",enable:"▶",update_budget:"💰",publish:"🚀",duplicate:"📋"};
  const icon=icons[block.meta_action||""]||"⚡";

  if(state==="done") return(
    <div style={{borderRadius:14,border:"1px solid rgba(52,211,153,0.25)",background:"rgba(52,211,153,0.06)",padding:"14px 16px",marginBottom:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
        <span style={{fontSize:16}}>✅</span>
        <p style={{...j,fontSize:13,fontWeight:700,color:"#34d399",margin:0}}>{t.done}</p>
      </div>
      <p style={{...m,fontSize:12,color:"rgba(52,211,153,0.7)",margin:0}}>{result}</p>
    </div>
  );
  if(state==="cancelled") return null;

  return(
    <div style={{borderRadius:16,border:"1px solid rgba(251,146,60,0.3)",background:"rgba(251,146,60,0.04)",marginBottom:10,overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"16px 16px 12px",borderBottom:"1px solid rgba(251,146,60,0.12)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span style={{fontSize:20}}>{icon}</span>
          <p style={{...j,fontSize:13,fontWeight:700,color:"#fb923c",margin:0}}>{block.title}</p>
        </div>
        {/* Clear confirmation question */}
        <p style={{...m,fontSize:13,color:"rgba(255,255,255,0.8)",lineHeight:1.5,margin:"0 0 4px"}}>
          {t.sure}
        </p>
        <p style={{...j,fontSize:14,fontWeight:700,color:"#fff",margin:0}}>
          {actionLabel}{target?` — ${target}`:""}
          {block.value?<span style={{color:"#fb923c"}}> → {block.value}</span>:null}
        </p>
      </div>
      {/* Warning */}
      <div style={{padding:"8px 16px",background:"rgba(251,146,60,0.06)",borderBottom:"1px solid rgba(251,146,60,0.08)"}}>
        <p style={{...m,fontSize:12,color:"rgba(251,146,60,0.6)",margin:0}}>⚠️ {t.warning}</p>
      </div>
      {/* Buttons */}
      <div style={{padding:"16px",display:"flex",gap:8}}>
        <button onClick={async()=>{
          setState("running");
          await onConfirm(block);
          setResult(`${actionLabel}${target?` — ${target}`:""} executado com sucesso`);
          setState("done");
        }} disabled={state==="running"}
          style={{...j,fontSize:13,fontWeight:700,padding:"10px 20px",borderRadius:10,background:state==="running"?"rgba(251,146,60,0.3)":"#fb923c",color:state==="running"?"#fb923c":"#000",border:state==="running"?"1px solid rgba(251,146,60,0.3)":"none",cursor:state==="running"?"wait":"pointer",display:"flex",alignItems:"center",gap:6,flex:1,justifyContent:"center"}}>
          {state==="running"?<><Loader2 size={13} className="animate-spin"/>{t.running}</>:t.confirm}
        </button>
        <button onClick={()=>setState("cancelled")}
          style={{...m,fontSize:12,padding:"10px 16px",borderRadius:10,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontWeight:500}}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}

// ── renderMarkdown — typing animation + tipografia hierárquica ───────────────
function renderMarkdown(text: string, stream = false): React.ReactNode[] {
  if (!text || typeof text !== "string") return [];
  const normalized = text.replace(/\\n\\n/g, "\n\n").replace(/\\n/g, "\n");
  const lines = normalized.split("\n");
  const nodes: React.ReactNode[] = [];
  let listBuffer: { text: string; ordered: boolean; num?: number }[] = [];
  let orderedCounter = 0;
  const F = "'Plus Jakarta Sans',sans-serif";
  const MONO = "'DM Mono',monospace";

  // Stagger por nó — simula o cursor avançando bloco a bloco
  const stagger = stream ? 0.09 : 0.045;
  const typeDur = stream ? "0.35s" : "0.2s";

  // Inline formatting — bold, code, italic
  const inlineFormat = (str: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = str;
    let idx = 0;
    while (remaining.length > 0) {
      const boldMatch  = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*$)/s);
      const italicMatch = remaining.match(/^(.*?)_(.+?)_(.*$)/s);
      const codeMatch  = remaining.match(/^(.*?)`([^`]+)`(.*$)/s);
      const earliest = [
        boldMatch  ? boldMatch[1].length  : Infinity,
        italicMatch ? italicMatch[1].length : Infinity,
        codeMatch  ? codeMatch[1].length  : Infinity,
      ];
      const minIdx = earliest.indexOf(Math.min(...earliest));
      if (minIdx === 0 && boldMatch) {
        if (boldMatch[1])  parts.push(<span key={idx++}>{boldMatch[1]}</span>);
        parts.push(<strong key={idx++} style={{ fontWeight: 600, color: "rgba(255,255,255,0.97)", letterSpacing: "-0.01em" }}>{boldMatch[2]}</strong>);
        remaining = boldMatch[3];
      } else if (minIdx === 1 && italicMatch) {
        if (italicMatch[1]) parts.push(<span key={idx++}>{italicMatch[1]}</span>);
        parts.push(<em key={idx++} style={{ fontStyle: "italic", color: "rgba(255,255,255,0.7)" }}>{italicMatch[2]}</em>);
        remaining = italicMatch[3];
      } else if (minIdx === 2 && codeMatch) {
        if (codeMatch[1]) parts.push(<span key={idx++}>{codeMatch[1]}</span>);
        parts.push(<code key={idx++} style={{ fontFamily: MONO, fontSize: "0.85em", background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.18)", borderRadius: 4, padding: "1px 6px", color: "#67e8f9" }}>{codeMatch[2]}</code>);
        remaining = codeMatch[3];
      } else {
        parts.push(<span key={idx++}>{remaining}</span>);
        break;
      }
    }
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  const animStyle = (i: number): React.CSSProperties => stream ? {
    // Typing: aparece palavra a palavra via clip-path expandindo da esquerda
    animation: `typeIn ${typeDur} cubic-bezier(0.16,1,0.3,1) both`,
    animationDelay: `${i * stagger}s`,
  } : {
    animation: `fadeUp ${typeDur} ease-out both`,
    animationDelay: `${i * stagger}s`,
  };

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    const items = [...listBuffer];
    const isOrdered = items[0]?.ordered;
    nodes.push(
      <div key={key} style={{ margin: "6px 0 12px", display: "flex", flexDirection: "column", gap: 5 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", ...animStyle(nodes.length + i * 0.3) }}>
            {isOrdered
              ? <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "rgba(14,165,233,0.6)", flexShrink: 0, minWidth: 18, marginTop: 3, letterSpacing: "0.02em" }}>{item.num}.</span>
              : <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(14,165,233,0.7)", flexShrink: 0, marginTop: 8 }} />
            }
            <span style={{ fontFamily: F, fontSize: 14.5, color: "rgba(240,242,248,0.88)", lineHeight: 1.7, letterSpacing: "-0.01em" }}>
              {inlineFormat(item.text)}
            </span>
          </div>
        ))}
      </div>
    );
    listBuffer = [];
    orderedCounter = 0;
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // H1 — # título principal
    if (/^#\s/.test(trimmed)) {
      flushList(`fl-${i}`);
      nodes.push(
        <p key={i} style={{ fontFamily: F, fontSize: 20, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.03em", margin: "20px 0 6px", lineHeight: 1.2, ...animStyle(nodes.length) }}>
          {inlineFormat(trimmed.replace(/^#\s/, ""))}
        </p>
      );
      return;
    }

    // H2 — ## subtítulo
    if (/^##\s/.test(trimmed)) {
      flushList(`fl-${i}`);
      nodes.push(
        <p key={i} style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.95)", letterSpacing: "-0.025em", margin: "16px 0 5px", lineHeight: 1.3, ...animStyle(nodes.length) }}>
          {inlineFormat(trimmed.replace(/^##\s/, ""))}
        </p>
      );
      return;
    }

    // H3 — ### label de seção
    if (/^###\s/.test(trimmed)) {
      flushList(`fl-${i}`);
      nodes.push(
        <p key={i} style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: "rgba(14,165,233,0.7)", letterSpacing: "0.09em", textTransform: "uppercase", margin: "14px 0 4px", ...animStyle(nodes.length) }}>
          {trimmed.replace(/^###\s/, "")}
        </p>
      );
      return;
    }

    // Horizontal rule ---
    if (/^---+$/.test(trimmed)) {
      flushList(`fl-${i}`);
      nodes.push(<div key={i} style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "12px 0", ...animStyle(nodes.length) }} />);
      return;
    }

    // Unordered list
    if (/^[-*•]\s/.test(trimmed)) {
      listBuffer.push({ text: trimmed.replace(/^[-*•]\s/, ""), ordered: false });
      return;
    }

    // Ordered list
    const ordMatch = trimmed.match(/^(\d+)\.\s(.+)/);
    if (ordMatch) {
      orderedCounter++;
      listBuffer.push({ text: ordMatch[2], ordered: true, num: parseInt(ordMatch[1]) });
      return;
    }

    // Empty line
    if (!trimmed) {
      flushList(`fl-${i}`);
      return;
    }

    // Paragraph
    flushList(`fl-${i}`);
    nodes.push(
      <p key={i} style={{ fontFamily: F, fontSize: 14.5, color: "rgba(235,240,248,0.88)", lineHeight: 1.75, margin: "0 0 10px", letterSpacing: "-0.01em", ...animStyle(nodes.length) }}>
        {inlineFormat(trimmed)}
      </p>
    );
  });

  flushList("final");
  return nodes;
}

// ── Block card ────────────────────────────────────────────────────────────────
const BlockCard = React.memo(function BlockCard({block,lang,onNavigate,onSend,accountCtx,stream=false}: {block:Block;lang:string;onNavigate:(r:string,p?:Record<string,string>)=>void;onSend?:(msg:string)=>void;accountCtx?:{product?:string;niche?:string;market?:string;platform?:string};stream?:boolean}) {
  const [copiedIdx,setCopiedIdx]=useState<number|null>(null);
  const [scriptLoadingIdx,setScriptLoadingIdx]=useState<number|null>(null);
  const F="'Plus Jakarta Sans',sans-serif";
  const M="'Inter',sans-serif";
  const MONO="'DM Mono',monospace";

  const copyItem=(text:string,idx:number)=>{
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(()=>setCopiedIdx(null),1800);
  };
  const useAsScript=(text:string,idx:number)=>{
    if(!onSend) { onNavigate("/dashboard/script",{product:text.slice(0,120)}); return; }
    setScriptLoadingIdx(idx);
    // Build a [SCRIPT] command using the hook as the opening — AI will call generate-script inline
    const product = accountCtx?.product||accountCtx?.niche||"";
    const market  = accountCtx?.market||(lang==="pt"?"BR":lang==="es"?"MX":"US");
    const platform= accountCtx?.platform||"Meta";
    const msg = `[SCRIPT] Escreva um roteiro completo de vídeo usando este hook de abertura exato: "${text}". Produto: ${product}. Mercado: ${market}. Plataforma: ${platform}. Formato: VO | ON-SCREEN | VISUAL. Mantenha o hook exatamente como está nas primeiras cenas.`;
    setTimeout(()=>setScriptLoadingIdx(null),2000);
    onSend(msg);
  };

  // ── NAVIGATE ──
  if(block.type==="navigate") return(
    <div style={{margin:"4px 0 8px"}}>
      {block.content&&<p style={{fontFamily:M,fontSize:13.5,color:"rgba(255,255,255,0.55)",lineHeight:1.65,marginBottom:10}}>{block.content}</p>}
      <button onClick={()=>onNavigate(block.route!,block.params)}
        style={{fontFamily:F,fontSize:12,fontWeight:700,padding:"7px 16px",borderRadius:8,background:"rgba(14,165,233,0.1)",color:"rgba(14,165,233,0.9)",border:"1px solid rgba(14,165,233,0.2)",cursor:"pointer",letterSpacing:"-0.01em",transition:"all 0.15s"}}
        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(14,165,233,0.18)"}}
        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(14,165,233,0.1)"}}>
        {block.cta||"Abrir →"}
      </button>
    </div>
  );

  // ── WARNING — linha colorida discreta, sem caixa ──
  if(block.type==="warning") return(
    <div style={{display:"flex",alignItems:"flex-start",gap:8,margin:"2px 0 8px",padding:"12px 14px 12px 16px",borderRadius:8,background:"rgba(251,191,36,0.05)",borderLeft:"3px solid rgba(251,191,36,0.4)"}}>
      <span style={{fontSize:13,flexShrink:0,marginTop:1,lineHeight:1}}>⚠</span>
      <div className="msg-body" style={{fontSize:13.5,lineHeight:1.65,margin:0,flex:1}}>
        {renderMarkdown(block.content||block.title||"", stream)}
      </div>
    </div>
  );

  // ── HOOKS — inspirado em Claude.ai: lista limpa, sem caixas ──
  if(block.type==="hooks") return(
    <div style={{marginBottom:4}}>
      {block.items?.map((item,i)=>{
        const copied = copiedIdx===i;
        return(
          <div key={i}
            style={{display:"flex",alignItems:"flex-start",gap:0,borderBottom:"1px solid rgba(255,255,255,0.06)",transition:"background 0.12s",animation:"fadeUp 0.18s ease-out both",animationDelay:`${i*0.06}s`}}
            className="hook-item"
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.03)"}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent"}}>
            {/* Número */}
            <div style={{width:32,paddingTop:14,paddingBottom:12,flexShrink:0,display:"flex",justifyContent:"flex-end",paddingRight:8}}>
              <span style={{fontFamily:MONO,fontSize:12,color:"rgba(255,255,255,0.2)",letterSpacing:"0.02em"}}>{i+1}</span>
            </div>
            {/* Texto */}
            <div style={{flex:1,padding:"12px 12px 12px 0",minWidth:0}}>
              <span style={{fontFamily:M,fontSize:14,color:"rgba(255,255,255,0.9)",lineHeight:1.65,display:"block",letterSpacing:"-0.01em"}}>{item}</span>
            </div>
            {/* Ações — aparecem no hover via opacity */}
            <div style={{display:"flex",alignItems:"center",gap:4,padding:"0 4px",paddingTop:12,flexShrink:0,opacity:0.6,transition:"opacity 0.12s"}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity="1"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity="0.6"}}>
              <button onClick={()=>copyItem(item,i)}
                style={{display:"flex",alignItems:"center",gap:3,padding:"3px 8px",height:24,borderRadius:6,background:copied?"rgba(52,211,153,0.1)":"transparent",border:`1px solid ${copied?"rgba(52,211,153,0.25)":"rgba(255,255,255,0.1)"}`,cursor:"pointer",fontSize:12,color:copied?"#34d399":"rgba(255,255,255,0.5)",fontFamily:M,transition:"all 0.15s",whiteSpace:"nowrap" as const,transform:copied?"scale(1.04)":"scale(1)"}}>
                {copied
                  ?<><svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{lang==="pt"?"Copiado":lang==="es"?"Copiado":"Copied"}</span></>
                  :<><Copy size={9}/><span>{lang==="pt"?"Copiar":lang==="es"?"Copiar":lang==="es"?"Copiar":"Copiar"}</span></>
                }
              </button>
              <button onClick={()=>useAsScript(item,i)}
                disabled={scriptLoadingIdx===i}
                style={{display:"flex",alignItems:"center",gap:3,padding:"3px 8px",height:24,borderRadius:6,background:scriptLoadingIdx===i?"rgba(14,165,233,0.12)":"transparent",border:`1px solid ${scriptLoadingIdx===i?"rgba(14,165,233,0.3)":"rgba(255,255,255,0.1)"}`,cursor:scriptLoadingIdx===i?"default":"pointer",fontSize:12,color:scriptLoadingIdx===i?"rgba(14,165,233,0.8)":"rgba(255,255,255,0.5)",fontFamily:M,transition:"all 0.12s",whiteSpace:"nowrap" as const}}
                onMouseEnter={e=>{if(scriptLoadingIdx!==i){(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.2)";(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.8)"}}}
                onMouseLeave={e=>{if(scriptLoadingIdx!==i){(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.1)";(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.5)"}}}>
                {scriptLoadingIdx===i
                  ? <><span style={{width:8,height:8,borderRadius:"50%",border:"1.5px solid rgba(14,165,233,0.5)",borderTopColor:"#0ea5e9",animation:"lp-spin 0.7s linear infinite",display:"inline-block"}}/><span>{lang==="pt"?"Gerando...":lang==="es"?"Generando...":"Generating..."}</span></>
                  : <>{lang==="pt"?"Roteiro":lang==="es"?"Guión":"Script"}</>
                }
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── ACTION — inline, sem caixa verde ──
  if(block.type==="action") return(
    <div className="msg-body" style={{fontSize:14,lineHeight:1.75,margin:"0 0 6px"}}>
      {renderMarkdown(block.content||block.title||"", stream)}
    </div>
  );

  // ── DEFAULT: insight / prose — markdown rendered ──
  const hasItems = block.items && block.items.length > 0;
  return(
    <div style={{marginBottom:hasItems?10:4}} className="msg-body">
      {block.content&&(
        <div style={{margin:hasItems?"0 0 14px":"0"}}>
          {renderMarkdown(block.content, stream)}
        </div>
      )}
      {hasItems&&(
        <div style={{display:"flex",flexDirection:"column",gap:0,marginTop:block.content?2:0}}>
          {block.items!.map((item,i)=>(
            <div key={i} style={{display:"flex",gap:0,alignItems:"flex-start",borderBottom:"1px solid rgba(255,255,255,0.05)",padding:"10px 0"}}>
              <span style={{fontFamily:MONO,fontSize:12,color:"rgba(255,255,255,0.2)",marginTop:4,flexShrink:0,width:24,letterSpacing:"0.02em"}}>{String(i+1).padStart(2,"0")}</span>
              <span style={{fontFamily:M,fontSize:14,color:"rgba(240,242,248,0.82)",lineHeight:1.72,flex:1,letterSpacing:"-0.01em"}}>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ── Main ──────────────────────────────────────────────────────────────────────

// ── Proactive Block — first message from the AI when chat opens ──────────────
const ProactiveBlock = React.memo(function ProactiveBlock({ block, lang, onSend, connections, personaName }: { block: Block; lang: string; onSend: (s: string) => void; connections?: string[]; personaName?: string }) {
  const F = "'Plus Jakarta Sans', sans-serif";
  const M = "'Inter', sans-serif";

  const hasMeta = connections?.includes("meta");
  const hasGoogle = false; // disabled
  const hasData = hasMeta;
  const quickActions: Record<string, string[]> = {
    pt: hasData
      ? ["O que pausar agora?", "Gerar hooks vencedores", "Escrever roteiro", "O que escalar?"]
      : ["Gerar hooks para minha conta", "Escrever roteiro de anúncio", "Analisar concorrente", "Quais trends posso usar?"],
    es: hasData
      ? ["¿Qué pausar ahora?", "Generar hooks ganadores", "Escribir guión", "¿Qué escalar?"]
      : ["Generar hooks para mi cuenta", "Escribir guión de anuncio", "Analizar competidor", "¿Qué trends usar?"],
    en: hasData
      ? ["What to pause now?", "Generate winning hooks", "Write a script", "What to scale?"]
      : ["Generate hooks for my account", "Write an ad script", "Analyze a competitor", "Which trends can I use?"],
  };
  const actions = quickActions[lang] || quickActions.pt;

  // Detect if this is a "real data" greeting by looking for spend values
  const content = block.content || "";
  const hasRealData = /R\$[\d,]+|CTR\s[\d,.]+%|\$[\d,]+\s(spent|gastos|gastados)/i.test(content);

  // Parse key numbers from content for visual callouts
  const spendMatch = content.match(/R\$(\d+[\d.,]*)\s*(gastos|spent|gastados)/i) ||
                     content.match(/\$(\d+[\d.,]*)\s*(spent|gastos|gastados)/i);
  const ctrMatch   = content.match(/CTR\s(?:médio\s|promedio\s|avg\s)?(\d+[.,]\d+)%/i) ||
                     content.match(/(\d+[.,]\d+)%\s*(?:avg\s)?CTR/i);

  const spend = spendMatch?.[1];
  const ctr   = ctrMatch?.[1];

  return (
    <div style={{ width:"100%", maxWidth: 680, margin: "auto", padding:"clamp(28px,6vw,48px) clamp(20px,5vw,40px) 32px", display:"flex", flexDirection:"column", alignItems:"flex-start" }}>
      {/* Greeting header — ABAvatar + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <ABAvatar size={40} />
        <span style={{ fontFamily: F, fontSize: 22, fontWeight: 700, color: "#f0f2f8", letterSpacing: "-0.03em", lineHeight: 1.2 }}>{block.title}</span>
      </div>

      {/* If real data: show KPI callout row + message */}
      {hasRealData && (spend || ctr) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" as const }}>
          {spend && (
            <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.18)", flex: "1 1 120px", minWidth: 120 }}>
              <p style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "0 0 3px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                {lang === "pt" ? "Esta semana" : lang === "es" ? "Esta semana" : "This week"}
              </p>
              <p style={{ fontFamily: F, fontSize: 20, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.03em" }}>
                {lang === "en" ? "$" : "R$"}{spend}
              </p>
            </div>
          )}
          {ctr && (
            <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.18)", flex: "1 1 100px", minWidth: 100 }}>
              <p style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "0 0 3px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>CTR</p>
              <p style={{ fontFamily: F, fontSize: 20, fontWeight: 900, color: "#34d399", margin: 0, letterSpacing: "-0.03em" }}>{ctr}%</p>
            </div>
          )}
        </div>
      )}

      {/* Message body */}
      <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14.5, color: "rgba(255,255,255,0.50)", lineHeight: 1.75, margin: "0 0 24px", letterSpacing: "-0.01em", maxWidth: 520 }}>
        {/* Strip spend/CTR from content since we showed them as cards */}
        {hasRealData
          ? content.replace(/—\s*R\$[\d,]+\s*(gastos|spent).*?(?=\.\s|$)/i, "—").replace(/—\s*\$[\d,]+\s*(spent|gastos).*?(?=\.\s|$)/i, "—").replace(/CTR\s(?:médio|avg|promedio)\s[\d,.]+%/i, "").replace(/,\s*,/g, ",").replace(/—\s*\./g, ".").trim()
          : content}
      </p>

      {/* Quick action pills */}
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
        {actions.map((label, i) => (
          <button key={i} onClick={() => onSend(label)}
            style={{ padding: "7px 16px", borderRadius: 99, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.60)", transition: "all 0.15s", whiteSpace: "nowrap" as const, letterSpacing: "-0.01em" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(14,165,233,0.08)"; e.currentTarget.style.borderColor = "rgba(14,165,233,0.22)"; e.currentTarget.style.color = "rgba(255,255,255,0.90)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "rgba(255,255,255,0.60)"; }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
});

// ── Dashboard Offer Block ─────────────────────────────────────────────────────
function DashboardOfferBlock({ block, lang, onConfirm, onSilentConfirm }: { block: Block; lang: string; onConfirm: (msg: string) => void; onSilentConfirm?: (msg: string) => void }) {
  const F = "'Plus Jakarta Sans', sans-serif";
  const M = "'Inter', sans-serif";
  const [loading, setLoading] = useState(false);

  const handleConfirm = () => {
    setLoading(true);
    const internalMsg = `[DASHBOARD_CONFIRMED] ${block.original_message || "gerar dashboard"}`;
    if (onSilentConfirm) {
      // Promise-based so we can reset loading on completion
      Promise.resolve(onSilentConfirm(internalMsg))
        .finally(() => setLoading(false));
    } else {
      onConfirm(internalMsg);
      setLoading(false);
    }
  };

  const labels: Record<string, Record<string, string>> = {
    pt: { confirm: "Gerar dashboard", cancel: "Agora não", remaining: "restantes este mês" },
    es: { confirm: "Generar dashboard", cancel: "Ahora no", remaining: "restantes este mes" },
    en: { confirm: "Generate dashboard", cancel: "Not now", remaining: "remaining this month" },
  };
  const t = labels[lang] || labels.pt;

  return (
    <div style={{ borderRadius: 14, border: "1px solid rgba(14,165,233,0.25)", background: "rgba(14,165,233,0.05)", padding: "16px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>📊</span>
        <p style={{ fontFamily: F, fontSize: 13, fontWeight: 800, color: "#eef0f6", margin: 0 }}>{block.title}</p>
      </div>
      <p style={{ fontFamily: M, fontSize: 12, color: "rgba(238,240,246,0.65)", lineHeight: 1.65, margin: "0 0 14px" }}>{block.content}</p>
      {typeof block.remaining === "number" && block.remaining <= 3 && (
        <p style={{ fontFamily: M, fontSize: 12, color: block.remaining === 0 ? "#f87171" : "#fbbf24", marginBottom: 12 }}>
          {block.remaining === 0 ? "⚠️ " : "⚡ "}{block.remaining} {t.remaining}
        </p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleConfirm} disabled={loading}
          style={{ flex: 1, padding: "9px 14px", borderRadius: 9, background: loading ? "rgba(14,165,233,0.15)" : "#0ea5e9", border: "none", cursor: loading ? "not-allowed" : "pointer", fontFamily: F, fontSize: 13, fontWeight: 700, color: loading ? "#0ea5e9" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }}>
          {loading ? <><Loader2 size={13} className="animate-spin"/> {lang === "pt" ? "Gerando..." : "Generating..."}</> : <><BarChart3 size={13}/> {t.confirm}</>}
        </button>
      </div>
    </div>
  );
}

// ── Dashboard Limit Popup ─────────────────────────────────────────────────────
function DashboardLimitPopup({ lang, plan, onClose }: { lang: string; plan?: string; onClose: () => void }) {
  const F = "'Plus Jakarta Sans', sans-serif";
  const M = "'Inter', sans-serif";
  const navigate = useNavigate();

  const msgs: Record<string, { title: string; sub: string; cta: string }> = {
    pt: { title: "Dashboards do mês esgotados", sub: `Você atingiu o limite de dashboards do plano ${plan || "atual"}. Faça upgrade para continuar gerando dashboards com dados reais da sua conta.`, cta: "Ver planos" },
    es: { title: "Dashboards del mes agotados", sub: `Alcanzaste el límite de dashboards del plan ${plan || "actual"}. Mejora tu plan para seguir generando dashboards.`, cta: "Ver planes" },
    en: { title: "Monthly dashboards exhausted", sub: `You've reached the dashboard limit for the ${plan || "current"} plan. Upgrade to keep generating dashboards with real account data.`, cta: "View plans" },
  };
  const m = msgs[lang] || msgs.pt;

  return (
    <>
      <div role="button" aria-label="Close" tabIndex={0} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500 }} onClick={onClose} onKeyDown={e => e.key === "Escape" && onClose()} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 501, width: 360, background: "#131720", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "28px 24px", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>
        <div style={{ fontSize: 36, marginBottom: 14, textAlign: "center" }}>📊</div>
        <p style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: "#eef0f6", textAlign: "center", margin: "0 0 10px" }}>{m.title}</p>
        <p style={{ fontFamily: M, fontSize: 13, color: "rgba(238,240,246,0.55)", lineHeight: 1.65, textAlign: "center", margin: "0 0 22px" }}>{m.sub}</p>
        <button onClick={() => { navigate("/dashboard/ai"); onClose(); setTimeout(() => navigate("/pricing"), 50); }}
          style={{ width: "100%", padding: "12px", borderRadius: 12, background: "#0ea5e9", border: "none", cursor: "pointer", fontFamily: F, fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 10 }}>
          {m.cta} →
        </button>
        <button onClick={onClose}
          style={{ width: "100%", padding: "10px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", fontFamily: M, fontSize: 13, color: "rgba(238,240,246,0.40)" }}>
          {lang === "pt" ? "Fechar" : lang === "es" ? "Cerrar" : "Close"}
        </button>
      </div>
    </>
  );
}
// ─── Live Panel v5 — build bump v2 ────────────────────────────────────────────────────────────
// Design: editorial dark refinado — Inter, cards com proporção correta


const I = { fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif" };
const MONO = { fontFamily: "'SF Mono','Fira Code',ui-monospace,monospace" };

// ── Tiny sparkline ────────────────────────────────────────────────────────────
function Spark({ d, c = "#0ea5e9", w = 56, h = 28 }: { d: number[]; c?: string; w?: number; h?: number }) {
  if (!d || d.length < 2) return null;
  const mn = Math.min(...d), mx = Math.max(...d), r = mx - mn || 1;
  const pts = d.map((v, i) => [
    (i / (d.length - 1)) * w,
    h - 3 - ((v - mn) / r) * (h - 6)
  ]);
  const linePts = pts.map(([x, y]) => `${x},${y}`).join(" ");
  // Area fill path: line + down to bottom + back
  const areaPath = `M${pts[0][0]},${pts[0][1]} ` +
    pts.slice(1).map(([x,y]) => `L${x},${y}`).join(" ") +
    ` L${pts[pts.length-1][0]},${h} L${pts[0][0]},${h} Z`;
  const lx = pts[pts.length-1][0], ly = pts[pts.length-1][1];
  const up = d[d.length - 1] >= d[d.length - 2];
  const dotC = up ? "#22d3ee" : "#fb7185";
  const id = `sg${Math.random().toString(36).slice(2,7)}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible", flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={c} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${id})`}/>
      <polyline points={linePts} fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={lx} cy={ly} r="2" fill={dotC}/>
    </svg>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function Kpi({ label, value, sub, trend, spark, color = "#0ea5e9", warn = false }: {
  label: string; value: string; sub?: string; trend?: "up" | "down" | "flat";
  spark?: number[]; color?: string; warn?: boolean;
}) {
  const vc = warn ? "#fb7185" : "rgba(255,255,255,0.95)";
  const sc = warn ? "rgba(248,113,133,0.65)" : trend === "up" ? "#22d3ee" : trend === "down" ? "rgba(248,113,133,0.65)" : "rgba(255,255,255,0.25)";
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : null;
  return (
    <div className="lp-kpi" style={{
      flex: 1, minWidth: 0, padding: "14px 16px 12px",
      background: warn ? "rgba(251,113,133,0.05)" : "rgba(255,255,255,0.025)",
      borderRadius: 12,
      borderTop: `2px solid ${warn ? "rgba(251,113,133,0.35)" : "rgba(255,255,255,0.06)"}`,
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize: 10, fontWeight: 600,
          color: "rgba(255,255,255,0.28)", letterSpacing: "0.09em", textTransform: "uppercase" as const }}>{label}</span>
        {spark && spark.length >= 2 && <Spark d={spark} c={warn ? "#fb7185" : color} w={48} h={24}/>}
      </div>
      <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize: 24, fontWeight: 700,
        color: vc, letterSpacing: "-0.035em", lineHeight: 1 }}>{value}</div>
      {sub && (
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          {trendIcon && <span style={{ fontSize: 10, color: sc, lineHeight: 1 }}>{trendIcon}</span>}
          <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 500, color: sc }}>{sub}</span>
        </div>
      )}
    </div>
  );
}

// ── Ad row ────────────────────────────────────────────────────────────────────
const AdRow = React.memo(function AdRow({ a, kind, ask }: { a: any; kind: "winner" | "risk" | "normal"; ask: (q: string) => void }) {
  const isW = kind === "winner", isR = kind === "risk";
  const ctr = parseFloat(a.ctr || 0).toFixed(2);
  const fr = a.freq != null ? parseFloat(a.freq).toFixed(1) : null;
  const sp = parseFloat(a.spend || 0).toFixed(0);
  const accentColor = isW ? "#22d3ee" : isR ? "#fb7185" : "rgba(255,255,255,0.15)";
  return (
    <div className="lp-row" onClick={() => ask(`Analisa o criativo "${a.name}" — por que está ${isW ? "performando bem" : isR ? "em risco" : "assim"}?`)} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "9px 0", cursor: "pointer",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
    }}>
      <span style={{ width: 3, height: 28, borderRadius: 2, background: accentColor, flexShrink: 0, opacity: isW || isR ? 1 : 0.4 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ ...I, fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.82)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name || "—"}</p>
        {a.campaign && <p style={{ ...I, fontSize: 11, color: "rgba(255,255,255,0.28)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.campaign}</p>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ textAlign: "right" as const }}>
          <span style={{ ...MONO, fontSize: 12, fontWeight: 600, color: parseFloat(ctr) > 1.5 ? "#22d3ee" : parseFloat(ctr) < 0.5 ? "#fb7185" : "rgba(255,255,255,0.55)" }}>{ctr}%</span>
          <span style={{ ...I, fontSize: 9, color: "rgba(255,255,255,0.2)", display: "block", letterSpacing: "0.05em" }}>CTR</span>
        </div>
        {fr && <div style={{ textAlign: "right" as const }}>
          <span style={{ ...MONO, fontSize: 12, fontWeight: 600, color: parseFloat(fr) > 3.5 ? "#fb7185" : "rgba(255,255,255,0.35)" }}>{fr}x</span>
          <span style={{ ...I, fontSize: 9, color: "rgba(255,255,255,0.2)", display: "block", letterSpacing: "0.05em" }}>FREQ</span>
        </div>}
        <div style={{ textAlign: "right" as const }}>
          <span style={{ ...MONO, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.45)" }}>R${sp}</span>
          <span style={{ ...I, fontSize: 9, color: "rgba(255,255,255,0.2)", display: "block", letterSpacing: "0.05em" }}>SPEND</span>
        </div>
      </div>
    </div>
  );
});

// ── Campaign row ──────────────────────────────────────────────────────────────
function CampRow({ c }: { c: any }) {
  const on = c.status === "ACTIVE" || c.status === "ENABLED";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ width: 3, height: 20, borderRadius: 2, background: on ? "#22d3ee" : "rgba(255,255,255,0.1)", flexShrink: 0 }} />
      <span style={{ ...I, fontSize: 12.5, fontWeight: 400, color: on ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.25)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
      {c.budget && <span style={{ ...MONO, fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{c.budget}</span>}
      {c.ctr && <span style={{ ...MONO, fontSize: 12, fontWeight: 600, color: parseFloat(c.ctr) > 1.5 ? "#22d3ee" : "rgba(255,255,255,0.25)", flexShrink: 0 }}>{parseFloat(c.ctr).toFixed(2)}%</span>}
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────
function Alert({ a, ask }: { a: { t: "warn" | "ok" | "info"; title: string; detail: string; q: string }; ask: (q: string) => void }) {
  const isOk = a.t === "ok";
  const isWarn = a.t === "warn";
  const accent = isOk ? "#22d3ee" : isWarn ? "#fb7185" : "#818cf8";
  const bg = isOk ? "rgba(34,211,238,0.05)" : isWarn ? "rgba(251,113,133,0.05)" : "rgba(129,140,248,0.05)";
  return (
    <div className="lp-alert" onClick={() => ask(a.q)} style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: 10,
      cursor: "pointer", background: bg,
      border: `1px solid ${accent}22`,
      borderLeft: `3px solid ${accent}`,
      transition: "opacity 0.12s",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 700, color: accent, display: "block" }}>{a.title}</span>
        <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", display: "block", marginTop: 1 }}>{a.detail}</span>
      </div>
      <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize: 11, color: accent, opacity: 0.7, flexShrink: 0, whiteSpace: "nowrap" }}>Perguntar →</span>
    </div>
  );
}

// ── Smart alerts ──────────────────────────────────────────────────────────────
function mkAlerts(d: any, lang: string) {
  if (!d || d.error) return [];
  const k = d.kpis || {}, W = d.winners || [], R = d.at_risk || [];
  const fr = parseFloat(k.frequency || 0), ctr = parseFloat(k.ctr || 0), sp = parseFloat(k.spend || 0);
  const out: Array<{ t: "warn" | "ok" | "info"; title: string; detail: string; q: string }> = [];
  const L = {
    highFreq:   { pt:"Frequência crítica",       es:"Frecuencia crítica",       en:"Critical frequency"    },
    highFreqD:  { pt:`${fr.toFixed(1)}x — fadiga se aproximando`, es:`${fr.toFixed(1)}x — fatiga próxima`, en:`${fr.toFixed(1)}x — fatigue approaching` },
    highFreqQ:  { pt:"Minha frequência está alta. O que devo fazer agora?", es:"Mi frecuencia está alta. ¿Qué hago ahora?", en:"My frequency is high. What should I do now?" },
    lowCtr:     { pt:"CTR abaixo do esperado",   es:"CTR por debajo de lo esperado", en:"CTR below benchmark" },
    lowCtrD:    { pt:`${ctr.toFixed(2)}% — revise os hooks`, es:`${ctr.toFixed(2)}% — revisa los hooks`, en:`${ctr.toFixed(2)}% — review hooks` },
    lowCtrQ:    { pt:"Por que meu CTR está baixo? Quais criativos estão prejudicando?", es:"¿Por qué mi CTR está bajo?", en:"Why is my CTR low? Which creatives are hurting it?" },
    atRisk:     { pt:`${R.length} criativo${R.length>1?"s":""} em risco`, es:`${R.length} creativo${R.length>1?"s":""} en riesgo`, en:`${R.length} creative${R.length>1?"s":""} at risk` },
    atRiskD:    { pt:"Fadiga detectada — pausa recomendada", es:"Fatiga detectada — pausar recomendado", en:"Fatigue detected — pause recommended" },
    atRiskQ:    { pt:"Quais criativos devo pausar agora e por quê?", es:"¿Cuáles creativos debo pausar y por qué?", en:"Which creatives should I pause now and why?" },
    winners:    { pt:`${W.length} criativo${W.length>1?"s":""} prontos pra escalar`, es:`${W.length} creativo${W.length>1?"s":""} listos para escalar`, en:`${W.length} creative${W.length>1?"s":""} ready to scale` },
    winnersD:   { pt:"Janela aberta — CTR alto, freq baixa", es:"Ventana abierta — CTR alto, freq baja", en:"Window open — high CTR, low frequency" },
    winnersQ:   { pt:"Quais criativos posso escalar agora e como?", es:"¿Cuáles creativos puedo escalar ahora?", en:"Which creatives can I scale now and how?" },
    healthy:    { pt:"Conta saudável",            es:"Cuenta saludable",           en:"Healthy account"       },
    healthyD:   { pt:`CTR ${ctr.toFixed(2)}% · freq ${fr.toFixed(1)}x — tudo bem`, es:`CTR ${ctr.toFixed(2)}% · freq ${fr.toFixed(1)}x — todo bien`, en:`CTR ${ctr.toFixed(2)}% · freq ${fr.toFixed(1)}x — looking good` },
    healthyQ:   { pt:"Minha conta está performando bem. Como aproveitar este momento?", es:"Mi cuenta está bien. ¿Cómo aprovechar este momento?", en:"My account is performing well. How can I capitalize on this?" },
  };
  const t = (k: keyof typeof L) => (L[k] as any)[lang] || (L[k] as any).en;
  if (fr > 3.5) out.push({ t: "warn", title: t("highFreq"), detail: t("highFreqD"), q: t("highFreqQ") });
  if (ctr < 0.5 && sp > 50) out.push({ t: "warn", title: t("lowCtr"), detail: t("lowCtrD"), q: t("lowCtrQ") });
  if (R.length > 0) out.push({ t: "warn", title: t("atRisk"), detail: t("atRiskD"), q: t("atRiskQ") });
  if (W.length > 0) out.push({ t: "ok", title: t("winners"), detail: t("winnersD"), q: t("winnersQ") });
  if (!out.length && ctr > 1.5 && fr < 2.5) out.push({ t: "ok", title: t("healthy"), detail: t("healthyD"), q: t("healthyQ") });
  return out;
}

// ── Divider ───────────────────────────────────────────────────────────────────
const Div = () => <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "2px 0" }} />;

// ── Section label ─────────────────────────────────────────────────────────────
const Sec = ({ c, children }: { c: string; children: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 8px" }}>
    <span style={{ width: 3, height: 12, borderRadius: 2, background: c, flexShrink: 0 }}/>
    <p style={{ ...I, fontSize: 10, fontWeight: 700, color: c, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: 0, opacity: 0.85 }}>{children}</p>
  </div>
);

// ── Main LivePanel ────────────────────────────────────────────────────────────
function LivePanel({ user, selectedPersona, connections, lang, onSend }: {
  user: any; selectedPersona: any; connections: string[]; lang: string; onSend: (m: string) => void;
}) {
  const [pd,   setPd]   = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);
  const [fail, setFail] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [tab,  setTab]  = React.useState<"meta" | "google">("meta"); // google disabled
  const [ts,   setTs]   = React.useState<Date | null>(null);
  const today = React.useMemo(()=>{ const d=new Date(); d.setHours(0,0,0,0); return d; },[]);
  const addDaysAI = (d: Date, n: number) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
  const fmtAI = (d: Date) => d.toISOString().split("T")[0];
  const fmtLabelAI = (d: Date) => d.toLocaleDateString("pt-BR", { day:"2-digit", month:"short" });
  const PRESETS_AI = [{label:"7D",days:7},{label:"14D",days:14},{label:"30D",days:30},{label:"60D",days:60},{label:"90D",days:90}];
  const [dateRange, setDateRange] = React.useState({ from: addDaysAI(today,-59), to: today });
  const [showCal, setShowCal] = React.useState(false);
  const [calDraft, setCalDraft] = React.useState<{from:Date|null;to:Date|null}>({from:null,to:null});
  const [calView, setCalView] = React.useState(new Date(today.getFullYear(),today.getMonth(),1));
  const [calSel, setCalSel] = React.useState<"from"|"to">("from");
  const [calHover, setCalHover] = React.useState<Date|null>(null);
  const calRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(()=>{
    if(!showCal) return;
    const handler=(e:MouseEvent)=>{ if(calRef.current&&!calRef.current.contains(e.target as Node)) setShowCal(false); };
    setTimeout(()=>document.addEventListener("mousedown",handler),0);
    return ()=>document.removeEventListener("mousedown",handler);
  },[showCal]);

  const hasMeta   = connections.includes("meta");
  // hasGoogle — disabled (see GOOGLE_ADS_BACKUP.md)

  const load = React.useCallback(async () => {
    if (!user?.id || !selectedPersona?.id) return;
    setBusy(true); setFail(null);
    try {
      const days = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000) + 1;
      const period = days <= 7 ? "7d" : days <= 14 ? "14d" : days <= 30 ? "30d" : days <= 60 ? "60d" : "90d";
      const selectedAccId = localStorage.getItem(`meta_sel_${selectedPersona.id}`) || undefined;
      const { data: r, error: e } = await (supabase.functions.invoke as any)("live-metrics", {
        body: { user_id: user.id, persona_id: selectedPersona.id, period,
          date_from: fmtAI(dateRange.from), date_to: fmtAI(dateRange.to),
          account_id: selectedAccId }
      });
      if (e) throw new Error(e.message || "Erro");
      if (r?.ok) {
        // Adaptar formato do live-metrics para o formato esperado pelo LivePanel
        const adapted: any = {};
        if (r.meta && !r.meta.error) {
          const m = r.meta;
          adapted.meta = {
            account_name: m.account_name,
            currency_symbol: "R$",
            period: `${fmtAI(dateRange.from)} → ${fmtAI(dateRange.to)}`,
            kpis: {
              spend: m.spend?.toFixed(2) || "0.00",
              ctr: ((m.ctr || 0) * 100).toFixed(2),
              cpm: m.impressions > 0 ? ((m.spend / m.impressions) * 1000).toFixed(2) : "0.00",
              frequency: "0.0",
              conversions: (m.conversions || 0).toFixed(0),
              active_ads: m.top_ads?.length || 0,
            },
            top_ads: (m.top_ads || []).map((a: any) => ({
              name: a.ad_name || a.name, campaign: a.campaign_name,
              spend: a.spend, ctr: (a.ctr || 0) * 100,
              cpm: a.cpm || 0, freq: 0, conv: a.conversions || 0,
              isWinner: (a.ctr || 0) * 100 > 1.5 && a.spend > 5,
              isRisk: (a.ctr || 0) * 100 < 0.5 && a.spend > 20,
            })),
            winners: [],
            at_risk: [],
            campaigns: [],
            time_series: (m.daily || []).map((d: any) => ({
              date: d.date, spend: d.spend, ctr: (d.ctr || 0) * 100, cpm: 0
            })),
          };
          adapted.meta.winners = adapted.meta.top_ads.filter((a: any) => a.isWinner).slice(0, 5);
          adapted.meta.at_risk = adapted.meta.top_ads.filter((a: any) => a.isRisk).slice(0, 5);
        }
        // google result handling — disabled (see GOOGLE_ADS_BACKUP.md)
        setPd(adapted); setTs(new Date());
      } else throw new Error(r?.error || "Resposta inválida");
    } catch (e: any) { setFail(e.message || "Falha"); }
    finally { setBusy(false); }
  }, [user?.id, selectedPersona?.id, connections.join(","), dateRange.from.getTime(), dateRange.to.getTime()]);

  React.useEffect(() => { load(); }, [load]);
  // Recarregar automaticamente quando período muda
  React.useEffect(() => { load(); }, [dateRange.from.getTime(), dateRange.to.getTime()]);

  // Recarregar quando usuário troca de conta Meta
  React.useEffect(() => {
    const onAccChanged = () => load();
    window.addEventListener("meta-account-changed", onAccChanged);
    return () => window.removeEventListener("meta-account-changed", onAccChanged);
  }, [load]);

  const data = pd?.[tab];
  const k = data?.kpis || {};
  const spS = (data?.time_series || []).map((d: any) => d.spend);
  const cS  = (data?.time_series || []).map((d: any) => d.ctr);
  const sTr = spS.length >= 2 ? (spS[spS.length - 1] > spS[0] ? "up" : "down") as "up" | "down" : "flat";
  const cTr = cS.length   >= 2 ? (cS[cS.length - 1]   > cS[0]   ? "up" : "down") as "up" | "down" : "flat";
  const alerts = tab === "meta" ? mkAlerts(data, lang) : [];
  const accName = data?.account_name || "";
  const isEmpty = data && !data.error && !parseInt(k.active_ads || k.active_campaigns || "0") && !(data.top_ads?.length) && !(data.campaigns?.length);

  const tcfg: Record<string, { label: string; c: string }> = {
    meta:   { label: "Meta Ads",   c: "#3b82f6" },
    // google: disabled
  };

  // ── Collapsed bar — redesign completo ────────────────────────────────────
  if (!open) {
    const metrics = data && !data.error && !busy ? [
      k.spend       && { lbl: lang==="pt"?"gasto":lang==="es"?"gasto":"spend", val: `${data.currency_symbol||"R$"}${parseFloat(k.spend||0).toFixed(0)}`, warn: false, tr: sTr },
      k.ctr         && { lbl: "ctr", val: `${parseFloat(k.ctr||0).toFixed(2)}%`, warn: parseFloat(k.ctr) < 0.5, tr: cTr },
      k.frequency && parseFloat(k.frequency) > 0 && { lbl: "freq", val: `${parseFloat(k.frequency).toFixed(1)}×`, warn: parseFloat(k.frequency) > 3.5, tr: "flat" as const },
      k.conversions && k.conversions !== "0" && { lbl: "conv", val: k.conversions, warn: false, tr: "flat" as const },
    ].filter(Boolean) : [];
    const warnCount = alerts.filter((a: any) => a.t === "warn").length;
    const scaleCount = (data?.winners || []).length;
    const isLive = !busy && !fail;

    return (
      <div className="lp lp-bar" onClick={() => setOpen(true)} style={{
        ...I, display: "flex", alignItems: "center", gap: 0, height: 36,
        padding: "0 16px", cursor: "pointer", userSelect: "none" as const,
        background: "var(--bg-main)",
        borderBottom: "1px solid rgba(255,255,255,0.055)",
        transition: "background 0.15s",
      }}>

        {/* ── Meta ∞ icon — SVG oficial ── */}
        <div style={{ display:"flex", alignItems:"center", gap:7, marginRight:14, flexShrink:0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill="url(#lp-meta-0)"/>
            <path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17l-.01.017 2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill="url(#lp-meta-1)"/>
            <path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill="url(#lp-meta-2)"/>
            <path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill="url(#lp-meta-3)"/>
            <path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill="url(#lp-meta-4)"/>
            <path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill="url(#lp-meta-5)"/>
            <path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="#0082FB"/>
            <path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill="url(#lp-meta-6)"/>
            <path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082FB"/>
            <path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill="url(#lp-meta-7)"/>
            <path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill="url(#lp-meta-8)"/>
            <path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill="url(#lp-meta-9)"/>
            <path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill="url(#lp-meta-10)"/>
            <path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill="url(#lp-meta-11)"/>
            <path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill="url(#lp-meta-12)"/>
            <defs>
              <linearGradient id="lp-meta-0" x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%"><stop offset=".06%" stopColor="#0867DF"/><stop offset="45.39%" stopColor="#0668E1"/><stop offset="85.91%" stopColor="#0064E0"/></linearGradient>
              <linearGradient id="lp-meta-1" x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%"><stop offset="13.23%" stopColor="#0064DF"/><stop offset="99.88%" stopColor="#0064E0"/></linearGradient>
              <linearGradient id="lp-meta-2" x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%"><stop offset="1.47%" stopColor="#0072EC"/><stop offset="68.81%" stopColor="#0064DF"/></linearGradient>
              <linearGradient id="lp-meta-3" x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%"><stop offset="7.31%" stopColor="#007CF6"/><stop offset="99.43%" stopColor="#0072EC"/></linearGradient>
              <linearGradient id="lp-meta-4" x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%"><stop offset="7.31%" stopColor="#007FF9"/><stop offset="100%" stopColor="#007CF6"/></linearGradient>
              <linearGradient id="lp-meta-5" x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%"><stop offset="7.31%" stopColor="#007FF9"/><stop offset="100%" stopColor="#0082FB"/></linearGradient>
              <linearGradient id="lp-meta-6" x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%"><stop offset="27.99%" stopColor="#007FF8"/><stop offset="91.41%" stopColor="#0082FB"/></linearGradient>
              <linearGradient id="lp-meta-7" x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%"><stop offset="0%" stopColor="#0082FB"/><stop offset="99.95%" stopColor="#0081FA"/></linearGradient>
              <linearGradient id="lp-meta-8" x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%"><stop offset="6.19%" stopColor="#0081FA"/><stop offset="100%" stopColor="#0080F9"/></linearGradient>
              <linearGradient id="lp-meta-9" x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%"><stop offset="0%" stopColor="#027AF3"/><stop offset="100%" stopColor="#0080F9"/></linearGradient>
              <linearGradient id="lp-meta-10" x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%"><stop offset="0%" stopColor="#0377EF"/><stop offset="99.94%" stopColor="#0279F1"/></linearGradient>
              <linearGradient id="lp-meta-11" x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%"><stop offset=".19%" stopColor="#0471E9"/><stop offset="100%" stopColor="#0377EF"/></linearGradient>
              <linearGradient id="lp-meta-12" x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%"><stop offset="27.65%" stopColor="#0867DF"/><stop offset="100%" stopColor="#0471E9"/></linearGradient>
            </defs>
          </svg>

          {/* Live pill */}
          <div style={{ display:"flex", alignItems:"center", gap:4, padding:"2px 7px", borderRadius:99,
            background: isLive ? "rgba(14,165,233,0.1)" : fail ? "rgba(248,113,133,0.1)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${isLive ? "rgba(14,165,233,0.2)" : fail ? "rgba(248,113,133,0.2)" : "rgba(255,255,255,0.08)"}`,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius:"50%", flexShrink:0,
              background: busy ? "rgba(255,255,255,0.3)" : fail ? "#fb7185" : "#0ea5e9",
              boxShadow: isLive ? "0 0 6px rgba(14,165,233,0.8), 0 0 12px rgba(14,165,233,0.4)" : "none",
              animation: isLive ? "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" : "none",
            }}/>
            <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:10, fontWeight:600,
              letterSpacing:"0.06em", textTransform:"uppercase" as const,
              color: isLive ? "rgba(14,165,233,0.8)" : fail ? "rgba(248,113,133,0.7)" : "rgba(255,255,255,0.3)" }}>
              {busy ? "···" : fail ? "err" : "live"}
            </span>
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ width:1, height:16, background:"rgba(255,255,255,0.07)", marginRight:14, flexShrink:0 }}/>

        {/* ── Metric chips ── */}
        {metrics.length > 0 && (
          <div style={{ display:"flex", gap:6, flex:1, overflow:"hidden", alignItems:"center" }}>
            {(metrics as any[]).map((item: any) => (
              <div key={item.lbl} style={{
                display:"flex", alignItems:"center", gap:5,
                padding:"3px 9px", borderRadius:7, flexShrink:0,
                background: item.warn ? "rgba(248,113,133,0.08)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${item.warn ? "rgba(248,113,133,0.15)" : "rgba(255,255,255,0.07)"}`,
              }}>
                <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:10, fontWeight:500,
                  color:"rgba(255,255,255,0.28)", letterSpacing:"0.05em", textTransform:"uppercase" as const }}>
                  {item.lbl}
                </span>
                <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:12, fontWeight:700,
                  color: item.warn ? "#fb7185" : "rgba(255,255,255,0.88)", letterSpacing:"-0.02em" }}>
                  {item.val}
                </span>
                {item.tr !== "flat" && (
                  <span style={{ fontSize:10, fontWeight:600, lineHeight:1,
                    color: item.tr === "up" ? "#22d3ee" : "#fb7185" }}>
                    {item.tr === "up" ? "▲" : "▼"}
                  </span>
                )}
              </div>
            ))}

            {/* Alert badge */}
            {warnCount > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:7,
                background:"rgba(248,113,133,0.1)", border:"1px solid rgba(248,113,133,0.2)", flexShrink:0 }}>
                <span style={{ fontSize:10, color:"#fb7185" }}>⚠</span>
                <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:10, fontWeight:600, color:"rgba(248,113,133,0.9)", letterSpacing:"0.03em" }}>
                  {warnCount} {lang==="pt"?"alerta":"alert"}{warnCount > 1 ? "s" : ""}
                </span>
              </div>
            )}

            {/* Scale badge */}
            {scaleCount > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:7,
                background:"rgba(34,211,238,0.07)", border:"1px solid rgba(34,211,238,0.15)", flexShrink:0 }}>
                <span style={{ fontSize:10, color:"#22d3ee" }}>↑</span>
                <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:10, fontWeight:600, color:"rgba(34,211,238,0.8)", letterSpacing:"0.03em" }}>
                  {scaleCount} {lang==="pt"?"escalar":lang==="es"?"escalar":"scale"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Loading state */}
        {busy && (
          <div style={{ display:"flex", alignItems:"center", gap:6, flex:1 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width:32, height:20, borderRadius:6, background:"rgba(255,255,255,0.05)",
                animation:`skPulse 1.4s ease-in-out ${i*0.15}s infinite` }}/>
            ))}
          </div>
        )}

        {/* Error state */}
        {fail && !busy && (
          <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:11, color:"rgba(248,113,133,0.6)", flex:1 }}>
            {lang==="pt"?"falha ao carregar":lang==="es"?"error al cargar":"failed to load"}
          </span>
        )}

        <ChevronDown size={13} style={{ color:"rgba(255,255,255,0.25)", flexShrink:0, marginLeft:"auto" }}/>
      </div>
    );
  }

  // ── Expanded ───────────────────────────────────────────────────────────────
  return (
    <div className="lp" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "var(--bg-main)", animation: "lp-in 0.18s ease" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* Platform tabs */}
          {[hasMeta && "meta"].filter(Boolean).map((p: any) => {
            const active = tab === p;
            const cfg = tcfg[p];
            const hasErr = pd?.[p]?.error;
            return (
              <button key={p} className="lp-tab" onClick={() => setTab(p)} style={{
                ...I, display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8,
                border: active ? `1px solid ${cfg.c}22` : "1px solid transparent",
                background: active ? `${cfg.c}0d` : "transparent",
                color: active ? "#e2e8f0" : "rgba(255,255,255,0.3)",
                fontSize: 12, fontWeight: active ? 500 : 400, cursor: "pointer", transition: "all 0.15s",
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: busy ? "rgba(255,255,255,0.15)" : hasErr ? "#fb7185" : active ? cfg.c : "rgba(255,255,255,0.15)", boxShadow: active && !hasErr && !busy ? `0 0 7px ${cfg.c}80` : "none", transition: "all 0.2s" }} />
                {cfg.label}
              </button>
            );
          })}
          {/* Account switcher — click to switch ad account */}
          {accName && (() => {
            const pid = selectedPersona?.id;
            const rawAccounts = pid ? localStorage.getItem(`meta_accounts_${pid}`) : null;
            const accounts: any[] = rawAccounts ? JSON.parse(rawAccounts) : [];
            const selId = pid ? (localStorage.getItem(`meta_sel_${pid}`) || "") : "";
            if (accounts.length <= 1) {
              return <span style={{ ...I, fontSize: 12, color: "rgba(255,255,255,0.3)", marginLeft: 8 }}>· {accName}</span>;
            }
            return (
              <div style={{ position: "relative", marginLeft: 8 }} className="acc-switcher">
                <button
                  onClick={() => {
                    const el = document.querySelector(".acc-switcher-menu") as HTMLElement;
                    if (el) el.style.display = el.style.display === "none" ? "block" : "none";
                  }}
                  style={{ ...I, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: "2px 6px", borderRadius: 6, color: "rgba(255,255,255,0.45)", fontSize: 12, transition: "background 0.15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "none"}
                >
                  · {accName}
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
                <div className="acc-switcher-menu" style={{ display: "none", position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100, background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 4px", minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
                  {accounts.map((acc: any) => {
                    const isSel = acc.id === selId || (!selId && acc === accounts[0]);
                    return (
                      <button key={acc.id} onClick={async () => {
                        if (pid) {
                          localStorage.setItem(`meta_sel_${pid}`, acc.id);
                          // Update DB via adbrief-ai-chat service_role — so live-metrics picks up the change
                          supabase.functions.invoke("adbrief-ai-chat", {
                            body: { update_selected_account: true, user_id: user.id, persona_id: pid, account_id: acc.id }
                          }).then(() => {
                            window.dispatchEvent(new CustomEvent("meta-account-changed", { detail: { personaId: pid, accountId: acc.id } }));
                          });
                        }
                        const el = document.querySelector(".acc-switcher-menu") as HTMLElement;
                        if (el) el.style.display = "none";
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 7, background: isSel ? "rgba(14,162,231,0.12)" : "transparent", border: "none", cursor: "pointer", color: isSel ? "#38bdf8" : "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "inherit", textAlign: "left", transition: "background 0.12s" }}
                      onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                      onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: isSel ? "#0da2e7" : "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: isSel ? 600 : 400 }}>{acc.name || acc.id}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{acc.id}</div>
                        </div>
                        {isSel && <svg style={{ marginLeft: "auto", flexShrink: 0 }} width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#0da2e7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {busy
              ? <Loader2 size={9} style={{ color: "#475569", animation: "lp-spin 1s linear infinite" }} />
              : <span style={{ width: 5, height: 5, borderRadius: "50%", background: fail ? "#fb7185" : "#34d399", boxShadow: !fail ? "0 0 5px rgba(52,211,153,0.5)" : "none", animation: !fail ? "lp-glow 2.5s ease-in-out infinite" : "none" }} />
            }
            <span style={{ ...I, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
              {busy
                ? (lang==="pt"?"atualizando...":lang==="es"?"actualizando...":"updating...")
                : ts
                  ? ts.toLocaleTimeString(lang==="pt"?"pt-BR":lang==="es"?"es-MX":"en-US", { hour: "2-digit", minute: "2-digit" })
                  : (lang==="pt"?"ao vivo":lang==="es"?"en vivo":"live")}
            </span>
          </div>
          {/* Date range picker */}
          <div style={{ position: "relative" }}>
            <button onClick={() => { setShowCal(s=>!s); setCalDraft({from:dateRange.from,to:dateRange.to}); setCalSel("from"); }}
              style={{ ...I, display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:8,
                border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.04)",
                color:"rgba(255,255,255,0.6)", fontSize:12, cursor:"pointer", transition:"all 0.15s" }}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.08)"}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.04)"}>
              <Calendar size={11}/>
              {(() => {
                const diff = Math.round((dateRange.to.getTime()-dateRange.from.getTime())/86400000)+1;
                const preset = PRESETS_AI.find(p=>p.days===diff && fmtAI(dateRange.to)===fmtAI(today));
                return preset ? `Últimos ${preset.label}` : `${fmtLabelAI(dateRange.from)} → ${fmtLabelAI(dateRange.to)}`;
              })()}
            </button>
            {showCal && (
              <div ref={calRef} style={{
                position:"fixed", top:"auto", right:"auto", zIndex:9999,
                background:"var(--bg-elevated)", border:"1px solid var(--border-default)", borderRadius:16,
                boxShadow:"0 20px 60px rgba(0,0,0,0.7)",
                padding:"clamp(12px,3vw,20px)",
                width:"min(540px, calc(100vw - 24px))",
                maxWidth:"calc(100vw - 24px)",
                display:"flex", flexDirection:"column", gap:16,
                left:"50%", transform:"translateX(-50%)",
                marginTop:8,
              }}>
                {/* Presets */}
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {PRESETS_AI.map(p=>{
                    const from = addDaysAI(today,-p.days+1);
                    const active = fmtAI(dateRange.from)===fmtAI(from) && fmtAI(dateRange.to)===fmtAI(today);
                    return (
                      <button key={p.days} onClick={()=>{ setDateRange({from,to:today}); setShowCal(false); }}
                        style={{...I,fontSize:12,fontWeight:600,padding:"5px 12px",borderRadius:8,
                          border:`1px solid ${active?"#0ea5e9":"rgba(255,255,255,0.1)"}`,
                          background:active?"rgba(14,165,233,0.12)":"transparent",
                          color:active?"#0ea5e9":"rgba(255,255,255,0.4)",cursor:"pointer",transition:"all 0.15s"}}>
                        Últimos {p.label}
                      </button>
                    );
                  })}
                </div>
                {/* Calendar — 2 months */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
                  {[calView, new Date(calView.getFullYear(),calView.getMonth()+1,1)].map((base,mi)=>{
                    const y=base.getFullYear(),m=base.getMonth();
                    const dim=new Date(y,m+1,0).getDate(),fd=new Date(y,m,1).getDay();
                    const cells:Array<Date|null>=[];
                    for(let i=0;i<fd;i++) cells.push(null);
                    for(let d=1;d<=dim;d++) cells.push(new Date(y,m,d));
                    const inR=(d:Date)=>{
                      const f=calDraft.from,t=calDraft.to||calHover;
                      if(!f||!t) return false;
                      const lo=f<t?f:t,hi=f<t?t:f;
                      return d>lo&&d<hi;
                    };
                    const isE=(d:Date)=>(calDraft.from&&fmtAI(d)===fmtAI(calDraft.from))||(calDraft.to&&fmtAI(d)===fmtAI(calDraft.to));
                    return (
                      <div key={mi}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                          {mi===0?<button onClick={()=>setCalView(new Date(y,m-1,1))} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",display:"flex"}}><ChevronLeft size={16}/></button>:<div/>}
                          <span style={{...I,fontSize:13,fontWeight:700,color:"#e2e8f0"}}>{base.toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</span>
                          {mi===1?<button onClick={()=>setCalView(new Date(y,m-1,1))} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",display:"flex"}}><ChevronRight size={16}/></button>:<div/>}
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
                          {["D","S","T","Q","Q","S","S"].map((d,i)=>(
                            <div key={i} style={{textAlign:"center",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.3)",padding:"4px 0",fontFamily:"inherit"}}>{d}</div>
                          ))}
                          {cells.map((d,i)=>{
                            if(!d) return <div key={i}/>;
                            const isFuture=d>today,inRange=inR(d),isEnd=isE(d);
                            return (
                              <div key={i}
                                onClick={()=>{
                                  if(isFuture) return;
                                  if(calSel==="from"||(calDraft.from&&d<calDraft.from)){
                                    setCalDraft({from:d,to:null}); setCalSel("to");
                                  } else {
                                    const r={from:calDraft.from!,to:d};
                                    setCalDraft(r); setDateRange(r); setShowCal(false);
                                  }
                                }}
                                onMouseEnter={()=>!isFuture&&setCalHover(d)}
                                onMouseLeave={()=>setCalHover(null)}
                                style={{textAlign:"center",padding:"6px 0",borderRadius:8,
                                  cursor:isFuture?"default":"pointer",fontSize:12,fontFamily:"inherit",
                                  fontWeight:isEnd?700:400,
                                  background:isEnd?"#0ea5e9":inRange?"rgba(14,165,233,0.15)":"transparent",
                                  color:isEnd?"#fff":isFuture?"rgba(255,255,255,0.12)":inRange?"#0ea5e9":"#e2e8f0",
                                  transition:"all 0.1s"}}>
                                {d.getDate()}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{...I,fontSize:12,color:"rgba(255,255,255,0.3)"}}>{calSel==="from"?"Selecione a data inicial":"Selecione a data final"}</span>
                  {calDraft.from&&<span style={{...I,fontSize:12,color:"#e2e8f0",fontWeight:600}}>{fmtLabelAI(calDraft.from)} {calDraft.to?`→ ${fmtLabelAI(calDraft.to)}`:""}</span>}
                </div>
              </div>
            )}
          </div>

          <button onClick={(e) => { e.stopPropagation(); load(); }} disabled={busy} className="lp-btn"
            style={{ background: "none", border: "none", cursor: busy ? "wait" : "pointer", color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, transition: "all 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}>
            <RefreshCw size={13} style={{ animation: busy ? "lp-spin 1s linear infinite" : "none" }} />
          </button>
          <button onClick={() => setOpen(false)} className="lp-btn"
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, transition: "all 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"; }}>
            <ChevronUp size={15} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "14px 20px 18px" }}>

        {/* Skeleton */}
        {busy && !pd && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ flex: 1, height: 88, borderRadius: 12, background: "rgba(255,255,255,0.025)", animation: `lp-sk 1.5s ${i * 0.1}s ease-in-out infinite` }} />
              ))}
            </div>
            <div style={{ height: 36, borderRadius: 10, background: "rgba(255,255,255,0.02)", animation: "lp-sk 1.5s 0.5s ease-in-out infinite" }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {[1, 2].map(i => <div key={i} style={{ height: 110, borderRadius: 10, background: "rgba(255,255,255,0.015)", animation: `lp-sk 1.5s ${0.6 + i * 0.1}s ease-in-out infinite` }} />)}
            </div>
          </div>
        )}

        {/* Error */}
        {fail && !busy && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "rgba(251,113,133,0.04)", border: "1px solid rgba(251,113,133,0.1)" }}>
            <span style={{ ...I, fontSize: 12, color: "#f87171" }}>{fail}</span>
            <button onClick={load} style={{ ...I, fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 7, background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.15)", color: "#f87171", cursor: "pointer" }}>
              {lang==="pt"?"Tentar novamente":lang==="es"?"Reintentar":"Retry"}
            </button>
          </div>
        )}

        {/* Special errors */}
        {data?.error === "token_expired" && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(251,146,60,0.04)", border: "1px solid rgba(251,146,60,0.12)" }}>
            <span style={{ ...I, fontSize: 12, color: "#fb923c" }}>
              {lang==="pt"?"Token expirado":lang==="es"?"Token expirado":"Token expired"} — <a href="/dashboard/accounts" style={{ color: "#fb923c", fontWeight: 500 }}>{lang==="pt"?"reconecte em Contas →":lang==="es"?"reconecta en Cuentas →":"reconnect in Accounts →"}</a>
            </span>
          </div>
        )}
        {data?.error === "no_account_selected" && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ ...I, fontSize: 12, color: "#475569" }}>
              {lang==="pt"?"Nenhuma conta selecionada":lang==="es"?"Ninguna cuenta seleccionada":"No account selected"} — <a href="/dashboard/accounts" style={{ color: "#6366f1" }}>{lang==="pt"?"configure em Contas →":lang==="es"?"configura en Cuentas →":"configure in Accounts →"}</a>
            </span>
          </div>
        )}

        {/* ── Real data ── */}
        {data && !data.error && !fail && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Alerts — destaque máximo, aparecem primeiro */}
            {alerts.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {alerts.map((a, i) => <Alert key={i} a={a} ask={onSend} />)}
              </div>
            )}

            {/* KPIs — sem border box individual, top accent bar */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }} className="lp-kpis-row">
              {tab === "meta" ? (
                <>
                  <Kpi label={lang==="pt"?`Spend ${Math.round((dateRange.to.getTime()-dateRange.from.getTime())/86400000)+1} dias`:lang==="es"?`Gasto ${Math.round((dateRange.to.getTime()-dateRange.from.getTime())/86400000)+1} días`:`Spend ${Math.round((dateRange.to.getTime()-dateRange.from.getTime())/86400000)+1} days`} value={`${data.currency_symbol||"R$"}${parseFloat(k.spend || 0).toFixed(0)}`} trend={sTr} spark={spS} color="#0ea5e9" sub={sTr === "up" ? (lang==="pt"?"crescendo":lang==="es"?"creciendo":"growing") : sTr === "down" ? (lang==="pt"?"caindo":lang==="es"?"cayendo":"falling") : (lang==="pt"?"estável":lang==="es"?"estable":"stable")} />
                  <Kpi label="CTR" value={`${parseFloat(k.ctr || 0).toFixed(2)}%`} trend={cTr} spark={cS} color="#0ea5e9" sub={cTr === "up" ? (lang==="pt"?"subindo":lang==="es"?"subiendo":"rising") : cTr === "down" ? (lang==="pt"?"caindo":lang==="es"?"bajando":"falling") : (lang==="pt"?"estável":lang==="es"?"estable":"stable")} warn={parseFloat(k.ctr || 0) < 0.5 && parseFloat(k.spend || 0) > 20} />
                  <Kpi label="CPM" value={`${data.currency_symbol||"R$"}${parseFloat(k.cpm || 0).toFixed(1)}`} color="#0ea5e9" sub={lang==="pt"?"por mil impr.":lang==="es"?"por mil impr.":"per 1k impr."} />
                  <Kpi label={lang==="pt"?"Frequência":lang==="es"?"Frecuencia":"Frequency"} value={`${parseFloat(k.frequency || 0).toFixed(1)}x`} warn={parseFloat(k.frequency || 0) > 3.5} sub={parseFloat(k.frequency || 0) > 3.5 ? (lang==="pt"?"fadiga próxima":lang==="es"?"fatiga próxima":"fatigue close") : parseFloat(k.frequency || 0) > 2.5 ? (lang==="pt"?"monitorar":lang==="es"?"monitorear":"monitor") : (lang==="pt"?"saudável":lang==="es"?"saludable":"healthy")} />
                  <Kpi label={lang==="pt"?"Conversões":lang==="es"?"Conversiones":"Conversions"} value={k.conversions || "0"} color="#34d399" sub={`${k.active_ads || 0} ${lang==="pt"?"ads ativos":lang==="es"?"ads activos":"active ads"}`} />
                </>
              ) : (
                <>
                  <Kpi label={lang==="pt"?`Spend ${Math.round((dateRange.to.getTime()-dateRange.from.getTime())/86400000)+1} dias`:lang==="es"?`Gasto ${Math.round((dateRange.to.getTime()-dateRange.from.getTime())/86400000)+1} días`:`Spend ${Math.round((dateRange.to.getTime()-dateRange.from.getTime())/86400000)+1} days`} value={`$${parseFloat(k.spend || 0).toFixed(0)}`} trend={sTr} spark={spS} color="#3b82f6" sub={sTr === "up" ? (lang==="pt"?"crescendo":lang==="es"?"creciendo":"growing") : (lang==="pt"?"caindo":lang==="es"?"cayendo":"falling")} />
                  <Kpi label="CTR" value={`${parseFloat(k.ctr || 0).toFixed(2)}%`} spark={cS} color="#34d399" />
                  <Kpi label="CPC" value={`$${parseFloat(k.cpc || 0).toFixed(2)}`} color="#f59e0b" />
                  <Kpi label={lang==="pt"?"Conversões":lang==="es"?"Conversiones":"Conversions"} value={k.conversions || "0"} color="#34d399" />
                  <Kpi label={lang==="pt"?"Campanhas":lang==="es"?"Campañas":"Campaigns"} value={k.active_campaigns || "0"} color="#6366f1" sub={lang==="pt"?"ativas":lang==="es"?"activas":"active"} />
                </>
              )}
            </div>

            {/* Empty state */}
            {isEmpty && (
              <div style={{ padding: "24px 16px", textAlign: "center" }}>
                <p style={{ ...I, fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.45)", margin: "0 0 6px" }}>
                  {lang==="pt"?"Nenhuma campanha ativa nos últimos 60 dias":lang==="es"?"Sin campañas activas en los últimos 60 días":"No active campaigns in the last 60 days"}
                </p>
                {accName && <p style={{ ...I, fontSize: 12, color: "rgba(255,255,255,0.22)", margin: "0 0 16px" }}>{accName}</p>}
                <button onClick={() => onSend(lang==="pt"?"O que devo fazer para reativar minhas campanhas?":lang==="es"?"¿Qué debo hacer para reactivar mis campañas?":"What should I do to reactivate my campaigns?")}
                  style={{ ...I, fontSize: 12, fontWeight: 500, padding: "7px 16px", borderRadius: 8, background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)", color: "rgba(14,165,233,0.8)", cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(14,165,233,0.14)"}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(14,165,233,0.08)"}}>
                  {lang==="pt"?"Pedir orientação à IA →":lang==="es"?"Pedir orientación →":"Ask AI for guidance →"}
                </button>
              </div>
            )}

            {/* Criativos + Campanhas */}
            {!isEmpty && (
              <>
                <Div />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>

                  {/* Criativos */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {tab === "meta" && (data.winners || []).length > 0 && (
                      <div>
                        <Sec c="#34d399">{lang==="pt"?"▲ Escalar agora":lang==="es"?"▲ Escalar ahora":"▲ Scale now"}</Sec>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {(data.winners || []).slice(0, 4).map((a: any, i: number) => <AdRow key={i} a={a} kind="winner" ask={onSend} />)}
                        </div>
                      </div>
                    )}
                    {tab === "meta" && (data.at_risk || []).length > 0 && (
                      <div>
                        <Sec c="#fb7185">{lang==="pt"?"▼ Risco de fadiga":lang==="es"?"▼ Riesgo de fatiga":"▼ Fatigue risk"}</Sec>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {(data.at_risk || []).slice(0, 4).map((a: any, i: number) => <AdRow key={i} a={a} kind="risk" ask={onSend} />)}
                        </div>
                      </div>
                    )}
                    {(!(data.winners?.length) && !(data.at_risk?.length)) && (data.top_ads || []).length > 0 && (
                      <div>
                        <Sec c="#475569">{lang==="pt"?"Top anúncios":lang==="es"?"Top anuncios":"Top ads"}</Sec>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {(data.top_ads || []).slice(0, 5).map((a: any, i: number) => <AdRow key={i} a={{ ...a, freq: undefined }} kind="normal" ask={onSend} />)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Campanhas */}
                  {(data.campaigns || []).length > 0 && (
                    <div>
                      <Sec c="#475569">{lang==="pt"?"Campanhas":lang==="es"?"Campañas":"Campaigns"}</Sec>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {(data.campaigns || []).slice(0, 7).map((c: any, i: number) => <CampRow key={i} c={c} />)}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Quick actions */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 4 }}>
              {(lang === "pt" ? [
                { l: "Resumo da semana",  q: "Qual o resumo da minha conta essa semana?" },
                { l: "O que escalar?",    q: "O que posso escalar agora com segurança?" },
                { l: "O que pausar?",     q: "O que devo pausar hoje e por quê?" },
                { l: "Próximo criativo",  q: "Com base nos meus winners, o que criar agora?" },
                { l: "Por que caiu?",     q: "Por que meu ROAS caiu? Qual a causa raiz?" },
              ] : lang === "es" ? [
                { l: "Resumen semana",    q: "¿Cuál es el resumen de mi cuenta esta semana?" },
                { l: "¿Qué escalar?",     q: "¿Qué puedo escalar ahora con seguridad?" },
                { l: "¿Qué pausar?",      q: "¿Qué debo pausar hoy y por qué?" },
                { l: "Próximo creativo",  q: "Basado en mis winners, ¿qué crear ahora?" },
                { l: "¿Por qué bajó?",    q: "¿Por qué bajó mi ROAS? ¿Cuál es la causa raíz?" },
              ] : [
                { l: "Week summary",      q: "What's my account summary this week?" },
                { l: "What to scale?",    q: "What can I safely scale right now?" },
                { l: "What to pause?",    q: "What should I pause today and why?" },
                { l: "Next creative",     q: "Based on my winners, what should I create now?" },
                { l: "Why did it drop?",  q: "Why did my ROAS drop? What's the root cause?" },
              ]).map(({ l, q }) => (
                <button key={q} className="lp-chip" onClick={() => onSend(q)} style={{
                  ...I, fontSize: 11, fontWeight: 500, padding: "5px 11px", borderRadius: 20,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(255,255,255,0.5)", cursor: "pointer", transition: "all 0.15s",
                }}>
                  {l}
                </button>
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}



export default function AdBriefAI() {
  usePageTitle("IA Chat");
  const {user,profile,selectedPersona,setSelectedPersona}=useOutletContext<DashboardContext>();
  const {language}=useLanguage();
  const lang=(["pt","es"].includes(language)?language:"en") as "pt"|"es"|"en";
  const navigate=useNavigate();
  // SK scoped per persona — each account has its own persistent chat history
  const SK=`adbrief_chat_v1_${selectedPersona?.id||"default"}`;

  const [messages,setMessages]=useState<AIMessage[]>(()=>{
    try {
      const saved = storage.getJSON(SK, []);
      // Sanitize — strip trend_chart blocks (can't serialize SVG state properly)
      return saved.map((m: any) => ({
        ...m,
        blocks: (m.blocks||[]).filter((b: any) => b.type !== "trend_chart")
      }));
    } catch { return []; }
  });
  const [accountAlerts,setAccountAlerts]=useState<any[]>([]);
  // Virtual scroll: render only last N messages for performance
  // User can load older messages with "Ver mais"
  const MSG_PAGE = 30;
  const [visibleCount, setVisibleCount] = useState(MSG_PAGE);
  // Reset visible count when conversation clears
  const visibleMessages = messages.slice(-visibleCount);
  const hasOlderMessages = messages.length > visibleCount;
  const [alertsDismissing,setAlertsDismissing]=useState<Set<string>>(new Set());
  const [greetingKey,setGreetingKey]=useState(0);
  const [input,setInput]=useState("");

  // Session goal — persists 7 days, resets automatically
  const GOAL_KEY = `adbrief_goal_${selectedPersona?.id || "default"}`;
  const [sessionGoal, setSessionGoal] = useState<string>(() => {
    try {
      const saved = storage.getJSON(GOAL_KEY, null);
      if (saved?.text && saved?.ts && Date.now() - saved.ts < 7 * 24 * 60 * 60 * 1000) return saved.text;
    } catch {}
    return "";
  });
  const [showGoalInput, setShowGoalInput] = useState(false);
  const saveGoal = (text: string) => {
    setSessionGoal(text);
    try { storage.setJSON(GOAL_KEY, { text, ts: Date.now() }); } catch {}
    setShowGoalInput(false);
  };
  const [loading,setLoading]=useState(false);
  const [contextReady,setContextReady]=useState(false);
  const [context,setContext]=useState("");
  const [connections,setConnections]=useState<string[]>([]);
  const [feedback,setFeedback]=useState<Record<number,"like"|"dislike"|null>>({});
  const [copiedId,setCopiedId]=useState<number|null>(null);
  const [activeTool,setActiveTool]=useState<string|null>(null);
  const [activeToolParams,setActiveToolParams]=useState<Record<string,string>>({});
  const [showUpgradeWall,setShowUpgradeWall]=useState(false);
  const [showDashboardLimit,setShowDashboardLimit]=useState(false);
  // usageStats — computed from freeUsage + profile (no backend dependency)
  const [freeUsage,setFreeUsage]=useState<{count:number,lastReset:string|null}|null>(null);
  const [countdown,setCountdown]=useState("");
  const [proactiveLoading,setProactiveLoading]=useState(false);
  const proactiveFired=useRef(false);
  const bottomRef=useRef<HTMLDivElement>(null);
  const textareaRef=useRef<HTMLTextAreaElement>(null);
  const prevPersonaId=useRef<string|null>(null);

  // ── Load free_usage from DB (source of truth — not affected by clearing chat) ──
  useEffect(()=>{
    if(!user?.id||(profile?.plan&&profile.plan!=="free")) return;
    const load = async () => {
      const { data } = await (supabase as any).from("free_usage").select("chat_count,last_reset").eq("user_id",user.id).maybeSingle();
      const today = new Date().toISOString().slice(0,10);
      if(data){
        const sameDay = data.last_reset?.slice(0,10)===today;
        setFreeUsage({ count: sameDay ? (data.chat_count||0) : 0, lastReset: data.last_reset });
      } else {
        setFreeUsage({ count:0, lastReset:null });
      }
    };
    load();
  },[user?.id, profile?.plan]);

  // ── Countdown timer: time until midnight (daily reset) ──
  useEffect(()=>{
    if(!freeUsage||freeUsage.count<3) return;
    const tick=()=>{
      const now=new Date();
      const midnight=new Date(now);
      midnight.setHours(24,0,0,0);
      const diff=midnight.getTime()-now.getTime();
      const h=Math.floor(diff/3600000);
      const m=Math.floor((diff%3600000)/60000);
      const s=Math.floor((diff%60000)/1000);
      setCountdown(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    };
    tick();
    const id=setInterval(tick,1000);
    return ()=>clearInterval(id);
  },[freeUsage]);

  // Update freeUsage count after each successful send
  // ── Load correct chat history when account changes (no reset — each account has its own history) ──
  useEffect(()=>{
    const newId = selectedPersona?.id || null;
    if(prevPersonaId.current !== newId) {
      // Load this account's saved history from localStorage
      const newSK = `adbrief_chat_v1_${newId||"default"}`;
      try {
        const saved = storage.getJSON(newSK, []);
        setMessages(saved.map((m: any) => ({
          ...m,
          blocks: (m.blocks||[]).filter((b: any) => b.type !== "trend_chart")
        })));
      } catch { setMessages([]); }
      // Reload session goal for this account
      const goalKey = `adbrief_goal_${newId||"default"}`;
      try {
        const saved = storage.getJSON(goalKey, null);
        if (saved?.text && saved?.ts && Date.now() - saved.ts < 7 * 24 * 60 * 60 * 1000) {
          setSessionGoal(saved.text);
        } else {
          setSessionGoal("");
        }
      } catch { setSessionGoal(""); }
      // Reset context so greeting fires for this account
      proactiveFired.current = false;
      setContextReady(false);
      setConnections([]);
      setGreetingKey(k => k + 1);
    }
    prevPersonaId.current = newId;
  },[selectedPersona?.id]);

  // Load connections — STRICT: only scoped to this account, NO global fallback
  // Load connections — runs on persona change AND when tab becomes visible
  // (user may have connected/disconnected in Accounts tab)
  const loadConnections = React.useCallback(() => {
    if(!user?.id) { setConnections([]); return; }
    const pid = selectedPersona?.id || null;
    if(!pid) { setConnections([]); return; }
    supabase.functions.invoke("meta-oauth", {
      body: { action: "get_connections", user_id: user.id }
    }).then(({ data }: any) => {
      const all = (data?.connections || []) as any[];
      const scoped = all.filter((c: any) => c.persona_id === pid && c.status === "active");
      setConnections(scoped.map((c: any) => c.platform));
      // Save ad_accounts list to localStorage for account switcher in LivePanel
      const metaConn = scoped.find((c: any) => c.platform === "meta");
      if (metaConn?.ad_accounts?.length) {
        localStorage.setItem(`meta_accounts_${pid}`, JSON.stringify(metaConn.ad_accounts));
      }
    }).catch(() => setConnections([]));
  }, [user?.id, selectedPersona?.id]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    const onVisible = () => { if(document.visibilityState === "visible") loadConnections(); };
    document.addEventListener("visibilitychange", onVisible);
    // Also reload when user changes Meta ad account in AccountsPage
    const onAccChanged = () => { loadConnections(); setGreetingKey(k => k+1); };
    window.addEventListener("meta-account-changed", onAccChanged);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("meta-account-changed", onAccChanged);
    };
  }, [loadConnections]);

  // Proactive greeting — fires when connections are known (after context is ready)
  useEffect(()=>{
    if(!contextReady || proactiveFired.current) return;
    if(!lang) return;
    if(!user?.id) return;
    // Wait a tick to let connections settle
    const timer = setTimeout(()=>{
      const pid = selectedPersona?.id || null;
      // Server-side filter by persona_id — prevents cross-account snapshot leakage
      const buildSnapQuery = () => {
        const q = (supabase as any).from("daily_snapshots")
          .select("date,total_spend,avg_ctr,active_ads,winners_count,losers_count,yesterday_ctr,ai_insight,top_ads,raw_period")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(5);
        return pid ? q.eq("persona_id", pid) : q.is("persona_id", null);
      };
      buildSnapQuery().then((r:any)=>{
          const snap = (r.data || [])[0] || null;
          const hasMetaConn = connections.includes("meta");
          const hasGoogleConn = false /* google disabled */;
          const hasAnyConn = hasMetaConn || hasGoogleConn;

          if(!snap && hasAnyConn){
            // Both Meta and Google now supported by daily-intelligence
            supabase.functions.invoke("daily-intelligence",{body:{user_id:user.id,persona_id:pid}})
              .then(()=>{
                buildSnapQuery().then((r2:any)=>{
                    const snap2 = (r2.data || [])[0] || null;
                    if(!proactiveFired.current) triggerProactiveGreeting(snap2, hasMetaConn, hasGoogleConn);
                  })
                  .catch(()=>{ if(!proactiveFired.current) triggerProactiveGreeting(null, hasMetaConn, hasGoogleConn); });
              })
              .catch(()=>{ if(!proactiveFired.current) triggerProactiveGreeting(null, hasMetaConn, hasGoogleConn); });
          } else {
            if(!proactiveFired.current) triggerProactiveGreeting(snap, hasMetaConn, hasGoogleConn);
          }
        }).catch(()=>{ if(!proactiveFired.current) triggerProactiveGreeting(null, connections.includes("meta"), false /* google disabled */); });
    }, 300); // 300ms — let connections settle
    return () => clearTimeout(timer);
  },[contextReady, connections.length, user?.id, greetingKey]);

  // Load context — scoped to active account, re-runs when account changes
  useEffect(()=>{
    if(!user?.id)return;
    const pid=selectedPersona?.id||null;
    (async()=>{
      try{
      const[analysesRes,patternsRes,personaRes,entriesRes,snapRes]=await Promise.all([
        (pid ? (supabase as any).from("analyses").select("id,title,created_at,result,hook_strength,recommended_platforms").eq("user_id",user.id).eq("persona_id",pid) : (supabase as any).from("analyses").select("id,title,created_at,result,hook_strength,recommended_platforms").eq("user_id",user.id).is("persona_id",null)).order("created_at",{ascending:false}).limit(50),
        // learned_patterns: filter server-side by persona_id to prevent cross-account leakage
        (pid
          ? (supabase as any).from("learned_patterns").select("pattern_key,avg_ctr,avg_roas,confidence,is_winner,insight_text,persona_id").eq("user_id",user.id).eq("persona_id",pid)
          : (supabase as any).from("learned_patterns").select("pattern_key,avg_ctr,avg_roas,confidence,is_winner,insight_text,persona_id").eq("user_id",user.id).is("persona_id",null)
        ).order("confidence",{ascending:false}).limit(50),
        // personas: filter to current persona only, not just the latest one
        (pid
          ? supabase.from("personas").select("name,result").eq("user_id",user.id).eq("id",pid).maybeSingle()
          : supabase.from("personas").select("name,result").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle()
        ),
        // creative_entries: top 20 by CTR only — full 500 rows bloats the context desnecessariamente
        (pid
          ? (supabase as any).from("creative_entries").select("filename,market,editor,ctr,roas,persona_id").eq("user_id",user.id).eq("persona_id",pid)
          : (supabase as any).from("creative_entries").select("filename,market,editor,ctr,roas,persona_id").eq("user_id",user.id).is("persona_id",null)
        ).order("ctr",{ascending:false}).limit(20),
        // daily_snapshots: filter server-side by persona_id
        (pid
          ? (supabase as any).from("daily_snapshots").select("date,total_spend,avg_ctr,avg_roas,winners_count,losers_count,active_ads,ai_insight,persona_id").eq("user_id",user.id).eq("persona_id",pid)
          : (supabase as any).from("daily_snapshots").select("date,total_spend,avg_ctr,avg_roas,winners_count,losers_count,active_ads,ai_insight,persona_id").eq("user_id",user.id).is("persona_id",null)
        ).order("date",{ascending:false}).limit(14),
      ]);
      const analyses=(analysesRes.data||[]).map((a:any)=>{const r=a.result as any||{};return`[${a.id.slice(0,8)}] ${a.title||"Untitled"} | score:${r.hook_score??""} | type:${r.hook_type??""} | market:${r.market_guess??""} | strength:${a.hook_strength??""} | date:${a.created_at?.slice(0,10)}`;}).join("\n");
      const patterns=((patternsRes.data||[]) as any[]).map((p:any)=>`${p.is_winner?"✓":"✗"} ${p.pattern_key} | CTR:${p.avg_ctr?.toFixed(3)} | ROAS:${p.avg_roas?.toFixed(2)} | conf:${p.confidence}`).join("\n");
      const persona=(()=>{if(!personaRes.data)return"No active persona";const r=personaRes.data.result as any||{};return`Name:${personaRes.data.name}|Age:${r.age_range}|Pain:${(r.pain_points||[]).slice(0,3).join(",")}|Platforms:${(r.platforms||[]).join("+")}`})();
      const entries=(entriesRes.data||[]) as any[];
      const byEd: Record<string,{ctr:number[],roas:number[],n:number}>={};
      entries.forEach((e:any)=>{if(e.editor){if(!byEd[e.editor])byEd[e.editor]={ctr:[],roas:[],n:0};byEd[e.editor].n++;if(e.ctr)byEd[e.editor].ctr.push(e.ctr);if(e.roas)byEd[e.editor].roas.push(e.roas);}});
      const edSummary=Object.entries(byEd).map(([ed,d])=>`${ed}:n=${d.n}|avgCTR=${d.ctr.length?(d.ctr.reduce((a,b)=>a+b)/d.ctr.length).toFixed(3):"?"}|avgROAS=${d.roas.length?(d.roas.reduce((a,b)=>a+b)/d.roas.length).toFixed(2):"?"}`).join("\n");
      // Recent snapshots — already filtered server-side
      const snaps=(snapRes.data||[]) as any[];
      const snapSummary=snaps.length?snaps.map((s:any)=>`${s.date}: spend=R$${s.total_spend?.toFixed(0)} CTR=${(s.avg_ctr*100)?.toFixed(2)}% ads=${s.active_ads} winners=${s.winners_count}${s.ai_insight?" | insight:"+s.ai_insight.slice(0,80):""}`).join("\n"):lang==="pt"?"Sem histórico ainda":"No snapshot data yet";
      const lastSnap=snaps[0];
      const perfSummary=lastSnap?`R$${lastSnap.total_spend?.toFixed(0)} spent last period, ${(lastSnap.avg_ctr*100)?.toFixed(2)}% CTR, ${lastSnap.active_ads} active ads, ${lastSnap.winners_count} winners, ${lastSnap.losers_count} underperformers. AI insight: ${lastSnap.ai_insight||"n/a"}`:lang==="pt"?"Sem dados de performance ainda":"No performance data yet";
      // Active account info
      const accountInfo=selectedPersona?`Account: ${selectedPersona.name}${selectedPersona.website?` | Website: ${selectedPersona.website}`:""}${(selectedPersona as any).description?` | Description: ${(selectedPersona as any).description}`:""}`:pid?"Account ID: "+pid:"No account selected";
      // Pre-compute trends so AI gets insight, not raw numbers to crunch
      const ctrTrend = (() => {
        if (snaps.length < 3) return "";
        const vals = snaps.slice(0, 3).map((s: any) => (s.avg_ctr * 100).toFixed(2));
        const oldest = parseFloat(vals[vals.length - 1]);
        const newest = parseFloat(vals[0]);
        const pct = oldest > 0 ? ((newest - oldest) / oldest * 100).toFixed(1) : "0";
        const dir = newest > oldest ? "↑ subindo" : newest < oldest ? "↓ caindo" : "→ estável";
        return `CTR trend 3d: ${vals.reverse().join("→")}% (${dir} ${Math.abs(parseFloat(pct))}%)`;
      })();
      const spendTrend = (() => {
        if (snaps.length < 3) return "";
        const vals = snaps.slice(0, 3).map((s: any) => parseFloat(s.total_spend || 0).toFixed(0));
        return `Spend trend 3d: R$${vals.reverse().join("→R$")}`;
      })();
      const patternNote = (patternsRes.data || []).length === 0
        ? "Sem padrões suficientes ainda — use snapshots e análises como base."
        : null;
      const connStatus = connections.length
        ? `Plataformas conectadas: ${connections.join(", ")}`
        : "Nenhuma plataforma conectada";
      const alertsNote = accountAlerts.length
        ? `Alertas ativos: ${accountAlerts.map((a: any) => a.detail).join(" | ")}`
        : "";
      const goalNote = sessionGoal.trim()
        ? `Objetivo desta semana: ${sessionGoal.trim()}`
        : "";
      setContext([
        `=== ACTIVE ACCOUNT ===`,
        accountInfo,
        connStatus,
        goalNote,
        alertsNote,
        ``,
        `=== RECENT PERFORMANCE ===`,
        perfSummary,
        ctrTrend,
        spendTrend,
        ``,
        `=== PERFORMANCE HISTORY (14 days) ===`,
        snapSummary,
        ``,
        `=== AUDIENCE PERSONA ===`,
        persona,
        ``,
        `=== ANALYSES (${(analysesRes.data || []).length} total) ===`,
        analyses || "None",
        ``,
        `=== LEARNED PATTERNS ===`,
        patternNote || patterns || "None",
        ``,
        `=== EDITORS PERFORMANCE ===`,
        edSummary || "None",
      ].filter(s => s !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trim());
      setContextReady(true);
      }catch(ctxErr){
        console.error("[AdBriefAI] context init failed:", ctxErr);
        setContextReady(true); // unblock chat even if context fetch fails
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user?.id, selectedPersona?.id, sessionGoal, accountAlerts.length, connections.join(",")]);

  useEffect(()=>{
    try{
      // Strip _autoExec from saved messages to prevent re-firing on reload
      const toSave=messages.slice(-30).map(m=>({
        ...m,
        blocks:m.blocks?.map(b=>(b as any)._autoExec
          ? {...b,type:"insight" as const, _autoExec:undefined}
          : b
        )
      }));
      storage.setJSON(SK, toSave);
    }catch{}

    // ── Supabase persistence for paid users (Maker/Pro/Studio) ──────────────
    // Runs debounced — saves last message only when messages array settles
    const isPaid = profile?.plan && profile.plan !== "free";
    if(!isPaid || !user?.id || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if(!last || (last as any)._synced) return; // already saved
    const pid = selectedPersona?.id || null;
    const payload = {
      user_id: user.id,
      persona_id: pid,
      role: last.role,
      content: last.role === "user"
        ? { userText: last.userText || "" }
        : { blocks: (last.blocks||[]).map(b => { const {_pendingTool,_toolParams,_autoExec,...rest}=b as any; return rest; }) },
      ts: last.ts,
    };
    // fire-and-forget — non-blocking
    void (supabase as any).from("chat_messages").insert(payload);
  },[messages]);

  // ── Load Supabase history for paid users when account changes ─────────────
  useEffect(()=>{
    const isPaid = profile?.plan && profile.plan !== "free";
    if(!isPaid || !user?.id) return;
    const pid = selectedPersona?.id || null;
    const localHasData = (() => { try { return storage.getJSON(SK, []).length > 0; } catch { return false; } })();
    if(localHasData) return; // local data takes priority — already loaded
    (async()=>{
      try {
        const q = (supabase as any).from("chat_messages")
          .select("id,role,content,ts")
          .eq("user_id", user.id)
          .order("ts", { ascending: true })
          .limit(60);
        const { data } = await (pid ? q.eq("persona_id", pid) : q.is("persona_id", null));
        if(!data?.length) return;
        const restored: AIMessage[] = (data as any[]).map((r:any) => ({
          id: r.ts,
          ts: r.ts,
          role: r.role as "user"|"assistant",
          userText: r.content?.userText,
          blocks: (r.content?.blocks||[]).filter((b:any) => b.type !== "trend_chart"),
          _synced: true,
        }));
        // Only restore if still no local data (avoid race with proactive greeting)
        const stillEmpty = (() => { try { return storage.getJSON(SK, []).length === 0; } catch { return true; } })();
        if(stillEmpty && restored.length > 0) {
          setMessages(restored);
          storage.setJSON(SK, restored.slice(-30))
        }
      } catch {}
    })();
  },[user?.id, selectedPersona?.id, profile?.plan]);

  // Execute pending tool_calls — runs once per message that has pending tools
  const executedTools=useRef<Set<string>>(new Set());
  useEffect(()=>{
    messages.forEach(msg=>{
      msg.blocks?.forEach(async(block,bi)=>{
        if(!(block as any)._pendingTool)return;
        const execKey=`${msg.id}-${bi}`;
        if(executedTools.current.has(execKey))return;
        executedTools.current.add(execKey);
        const fn=(block as any)._pendingTool as string;
        const params=(block as any)._toolParams||{};
        try{
          const{data,error}=await supabase.functions.invoke(fn,{body:params});
          if(error)throw error;
          setMessages(prev=>prev.map(m=>{
            if(m.id!==msg.id)return m;
            const nb=[...(m.blocks||[])];
            if(fn==="decode-competitor"&&(data?.analysis||data?.content||data?.result)){
              const analysis=data.analysis||data.content||data.result||"";
              nb[bi]={type:"insight",title:lang==="pt"?"Análise do Concorrente":lang==="es"?"Análisis del Competidor":"Competitor Analysis",content:analysis};
            }else if(fn==="translate-text"&&(data?.translation||data?.translated_text||data?.result)){
              const translated=data.translation||data.translated_text||data.result||"";
              nb[bi]={type:"insight",title:lang==="pt"?"Tradução":lang==="es"?"Traducción":"Translation",content:translated};
            }else if(fn==="generate-hooks"&&data?.hooks?.length){
              nb[bi]={type:"hooks",title:lang==="pt"?"Hooks gerados":lang==="es"?"Hooks generados":"Generated hooks",content:"",items:data.hooks.map((h:any)=>typeof h==="string"?h:h.hook||h.text||JSON.stringify(h))};
              // Capture learning — fire and forget
              if(user?.id){
                supabase.functions.invoke("capture-learning",{body:{
                  user_id:user.id,event_type:"hooks_generated",
                  data:{ hooks:data.hooks, product:params.product, niche:params.niche, market:params.market, platform:params.platform, tone:params.tone, context:params.context }
                }}).catch(()=>{});
              }
            }else if(fn==="generate-script"&&(data?.scripts?.length||data?.script||data?.content)){
              // Capture learning for scripts
              if(user?.id&&data?.scripts?.length){
                supabase.functions.invoke("capture-learning",{body:{
                  user_id:user.id,event_type:"script_generated",
                  data:{ scripts:data.scripts.slice(0,1), product:params.product, market:params.market, format:params.format, angle:params.angle }
                }}).catch(()=>{});
              }
              // generate-script returns { scripts: [{ title, lines, notes, hook_score }] }
              const scripts = data.scripts || [];
              let content = "";
              if(scripts.length > 0){
                content = scripts.map((s: any, si: number) => {
                  const lines: string[] = [];
                  if(scripts.length > 1) lines.push(`## ${s.title || `Variação ${si+1}`}${s.hook_score ? ` · Hook Score: ${s.hook_score}/100` : ""}`);
                  if(s.lines?.length){
                    s.lines.forEach((l: any) => {
                      const prefix = l.type === "vo" ? "**VO**" : l.type === "onscreen" ? "**ON-SCREEN**" : "**VISUAL**";
                      lines.push(`${prefix}  ${l.text}`);
                    });
                  }
                  if(s.notes) lines.push(`\n*${s.notes}*`);
                  return lines.join("\n");
                }).join("\n\n---\n\n");
              } else {
                content = data.script || data.content || "";
              }
              nb[bi]={type:"insight",title:lang==="es"?"Guión":lang==="pt"?"Roteiro":"Script",content};
            }else if(fn==="generate-brief"&&data?.brief){
              // Capture learning for briefs
              if(user?.id){
                supabase.functions.invoke("capture-learning",{body:{
                  user_id:user.id,event_type:"brief_generated",
                  data:{ brief_summary:(data.brief as any)?.objective||(data.brief as any)?.core_message||"", product:params.product, market:params.market }
                }}).catch(()=>{});
              }
              // brief is a structured JSON object — convert to readable markdown
              const b=data.brief as any;
              const lines:string[]=[];
              if(b.objective) lines.push(`**Objetivo:** ${b.objective}`);
              if(b.core_message) lines.push(`\n**Mensagem central:** ${b.core_message}`);
              if(b.value_proposition) lines.push(`\n**Proposta de valor:** ${b.value_proposition}`);
              if(b.target_audience){
                const ta=b.target_audience;
                lines.push(`\n**Público-alvo:**`);
                if(ta.demographics) lines.push(`- ${ta.demographics}`);
                if(ta.psychographics) lines.push(`- ${ta.psychographics}`);
                if(ta.pain_points?.length) lines.push(`- Dores: ${ta.pain_points.join(", ")}`);
              }
              if(b.tone_and_voice) lines.push(`\n**Tom:** ${b.tone_and_voice}`);
              if(b.key_messages?.length) lines.push(`\n**Mensagens-chave:**\n${b.key_messages.map((m:string)=>`- ${m}`).join("\n")}`);
              if(b.formats?.length) lines.push(`\n**Formatos:**\n${b.formats.map((f:any)=>`- ${f.format}${f.duration?` (${f.duration})`:""} — ${f.rationale}`).join("\n")}`);
              if(b.visual_direction) lines.push(`\n**Direção visual:** ${b.visual_direction}`);
              if(b.cta) lines.push(`\n**CTA:** ${b.cta}`);
              if(b.do_not?.length) lines.push(`\n**Não fazer:**\n${b.do_not.map((d:string)=>`- ${d}`).join("\n")}`);
              if(b.compliance_notes) lines.push(`\n**Compliance:** ${b.compliance_notes}`);
              nb[bi]={type:"insight",title:"Brief",content:lines.join("\n")};
            }else{
              nb[bi]={type:"warning",title:"Sem resultado",content:lang==="pt"?"Tente novamente com mais contexto.":lang==="es"?"Intenta de nuevo con más contexto.":"Try again with more context."};
            }
            return{...m,blocks:nb};
          }));
          // Fechar panel da tool após resultado chegar
          setActiveTool(null);
        }catch(e){
          executedTools.current.delete(execKey);
          setActiveTool(null);
          setMessages(prev=>prev.map(m=>{
            if(m.id!==msg.id)return m;
            const nb=[...(m.blocks||[])];
            nb[bi]={type:"warning",title:lang==="es"?"Fallo":"Falha",content:String((e as any)?.message||"Erro")};
            return{...m,blocks:nb};
          }));
        }
      });
    });
  },[messages]);

  // ── Load persistent account alerts ────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const loadAlerts = async () => {
      const { data } = await supabase
        .from("account_alerts" as any)
        .select("*")
        .eq("user_id", user.id)
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (data?.length) setAccountAlerts(data);
    };
    loadAlerts();
  }, [user?.id]);

  // ── Dismiss an alert permanently ───────────────────────────────────────────
  const dismissAlert = async (alertId: string) => {
    setAlertsDismissing(prev => new Set([...prev, alertId]));
    // Fire DB update in background
    supabase.from("account_alerts" as any)
      .update({ dismissed_at: new Date().toISOString() } as any)
      .eq("id", alertId).then(() => {});
    // Wait for exit animation then remove from state
    setTimeout(() => {
      setAccountAlerts(prev => prev.filter((a: any) => a.id !== alertId));
      setAlertsDismissing(prev => { const s = new Set(prev); s.delete(alertId); return s; });
    }, 280);
  };

  // ── Proactive greeting — fires when chat opens, always speaks first ──────────
  const triggerProactiveGreeting = async (snapshot: any, hasMetaConn?: boolean, hasGoogleConn?: boolean) => {
    if (proactiveFired.current) return;
    proactiveFired.current = true;

    // Returning user with real conversation history — don't interrupt
    const existing = (() => { try { return storage.getJSON(SK, []); } catch { return []; } })();
    const hasRealHistory = existing.some((m: any) => m.role === "user");
    if (hasRealHistory) return;

    setProactiveLoading(true);
    try {
      const accountName = selectedPersona?.name || null;
      const greetingTitle = accountName
        ? (lang === "es" ? `${accountName} está lista.` : lang === "en" ? `${accountName} is ready.` : `${accountName} está pronta.`)
        : (lang === "es" ? "Tu cuenta está lista." : lang === "en" ? "Your account is ready." : "Sua conta está pronta.");

      // Build platform context string
      const platforms: string[] = [];
      if (hasMetaConn) platforms.push("Meta Ads");
      // if (hasGoogleConn) platforms.push("Google Ads"); — disabled
      const platformStr = platforms.join(" + ") || "";

      let proactiveMsg = "";

      if (snapshot && snapshot.total_spend > 0) {
        // ── Conta com dados ativos ─────────────────────────────────────────────
        const topAds = (snapshot.top_ads || []) as any[];
        const toScale = topAds.filter((a: any) => a.isScalable).slice(0, 2);
        const toPause = topAds.filter((a: any) => a.needsPause).slice(0, 1);
        const fatigued = topAds.filter((a: any) => a.isFatigued).slice(0, 1);
        // Predictive alerts — criativos saudáveis mas na trajetória de fadiga
        const approachingFatigue = topAds.filter((a: any) => a.predictCritical && !a.isFatigued).slice(0, 2);
        const ctrDelta = snapshot.yesterday_ctr > 0 && snapshot.avg_ctr > 0
          ? ((snapshot.avg_ctr - snapshot.yesterday_ctr) / snapshot.yesterday_ctr * 100) : null;

        const parts: string[] = [];
        // Currency: Google-only = $, Meta (or both) = R$ for PT
        const isGoogleOnly = hasGoogleConn && !hasMetaConn;
        const isBoth = hasMetaConn && hasGoogleConn;
        const currSymbol = isGoogleOnly ? "$" : "R$";
        // Google spend from raw_period when both connected
        const googleRaw = isBoth ? (snapshot.raw_period as any)?.google : null;
        if (lang === "pt") {
          if (isBoth && googleRaw && !googleRaw.skipped) {
            parts.push(`Analisei ${accountName ? `a conta ${accountName}` : "sua conta"} — Meta: R$${snapshot.total_spend?.toFixed(0)} gastos, CTR ${(snapshot.avg_ctr*100)?.toFixed(2)}% | Google: $${parseFloat(googleRaw.spend||0).toFixed(0)}, CTR ${parseFloat(googleRaw.ctr||0).toFixed(2)}%.`);
          } else {
            parts.push(`Analisei ${accountName ? `a conta ${accountName}` : "sua conta"} — ${currSymbol}${snapshot.total_spend?.toFixed(0)} gastos esta semana, CTR médio ${(snapshot.avg_ctr * 100)?.toFixed(2)}%.`);
          }
          if (ctrDelta !== null) parts.push(`CTR ${ctrDelta > 0 ? "↑" : "↓"} ${Math.abs(ctrDelta).toFixed(1)}% vs semana anterior.`);
          if (toScale.length) parts.push(`"${toScale[0].name?.slice(0, 40)}" está com CTR ${(toScale[0].ctr*100)?.toFixed(2)}% — bom candidato para escalar.`);
          if (toPause.length) parts.push(`"${toPause[0].name?.slice(0, 40)}" CTR ${(toPause[0].ctr*100)?.toFixed(2)}%, ${currSymbol}${toPause[0].spend?.toFixed(0)} gastos — considere pausar.`);
          if (fatigued.length) parts.push(`"${fatigued[0].name?.slice(0, 40)}" freq. ${fatigued[0].frequency?.toFixed(1)}x — fadiga criativa, troque o criativo.`);
          if (approachingFatigue.length) parts.push(`⚠️ "${approachingFatigue[0].name?.slice(0, 35)}" — ${approachingFatigue[0].predictCritical}: prepare uma variação agora.`);
          if (snapshot.ai_insight) parts.push(snapshot.ai_insight);
          parts.push("O que quer fazer?");
        } else if (lang === "es") {
          if (isBoth && googleRaw && !googleRaw.skipped) {
            parts.push(`Analicé ${accountName ? `la cuenta ${accountName}` : "tu cuenta"} — Meta: $${snapshot.total_spend?.toFixed(0)} gastados, CTR ${(snapshot.avg_ctr*100)?.toFixed(2)}% | Google: $${parseFloat(googleRaw.spend||0).toFixed(0)}, CTR ${parseFloat(googleRaw.ctr||0).toFixed(2)}%.`);
          } else {
            parts.push(`Analicé ${accountName ? `la cuenta ${accountName}` : "tu cuenta"} — $${snapshot.total_spend?.toFixed(0)} gastados esta semana, CTR ${(snapshot.avg_ctr*100)?.toFixed(2)}%.`);
          }
          if (toScale.length) parts.push(`"${toScale[0].name?.slice(0,40)}" CTR ${(toScale[0].ctr*100)?.toFixed(2)}% — buen candidato para escalar.`);
          if (toPause.length) parts.push(`"${toPause[0].name?.slice(0,40)}" CTR ${(toPause[0].ctr*100)?.toFixed(2)}% — considera pausarlo.`);
          parts.push("¿Qué quieres hacer?");
        } else {
          if (isBoth && googleRaw && !googleRaw.skipped) {
            parts.push(`Checked ${accountName || "your account"} — Meta: R$${snapshot.total_spend?.toFixed(0)} spent, ${(snapshot.avg_ctr*100)?.toFixed(2)}% CTR | Google: $${parseFloat(googleRaw.spend||0).toFixed(0)}, ${parseFloat(googleRaw.ctr||0).toFixed(2)}% CTR.`);
          } else {
            parts.push(`Checked ${accountName ? `${accountName}` : "your account"} — $${snapshot.total_spend?.toFixed(0)} spent this week, ${(snapshot.avg_ctr*100)?.toFixed(2)}% avg CTR.`);
          }
          if (toScale.length) parts.push(`"${toScale[0].name?.slice(0,40)}" at ${(toScale[0].ctr*100)?.toFixed(2)}% CTR — good candidate to scale.`);
          if (toPause.length) parts.push(`"${toPause[0].name?.slice(0,40)}" at ${(toPause[0].ctr*100)?.toFixed(2)}% CTR spending $${toPause[0].spend?.toFixed(0)} — consider pausing.`);
          parts.push((lang as string) === "es" ? "¿Qué quieres hacer?" : "O que quer fazer?");
        }
        proactiveMsg = parts.join(" ");

      } else if (snapshot || platforms.length > 0) {
        // ── Conectado mas sem dados ativos ─────────────────────────────────────
        const histSpend = (snapshot?.total_spend || 0) > 0;
        const hasWinners = (snapshot?.winners_count || 0) > 0;
        const pausedCount = snapshot?.losers_count || 0;
        if (lang === "pt") {
          if (histSpend) {
            proactiveMsg = `Nenhuma campanha ativa essa semana em ${accountName || "sua conta"}, mas tenho seu histórico: R$${snapshot.total_spend?.toFixed(0)} analisados${hasWinners ? `, ${snapshot.winners_count} criativos vencedores identificados` : ""}${pausedCount ? `, ${pausedCount} com baixa performance` : ""}. Quer subir algo novo ou revisamos o que funcionou?`;
          } else if (platforms.length > 0) {
            proactiveMsg = `${platformStr} conectado${platforms.length > 1 ? "s" : ""} para ${accountName || "essa conta"}. Sem dados de campanha ainda — quer gerar hooks, escrever um roteiro ou fazer preflight de um criativo?`;
          } else {
            proactiveMsg = `${accountName ? `${accountName} carregada.` : "Conta carregada."} Sem plataformas de anúncio conectadas ainda — vá em Contas para conectar Meta Ads.`;
          }
        } else if (lang === "es") {
          if (histSpend) {
            proactiveMsg = `Sin campañas activas esta semana en ${accountName || "tu cuenta"}, pero tengo tu historial: $${snapshot?.total_spend?.toFixed(0)} analizados${hasWinners ? `, ${snapshot.winners_count} creativos ganadores` : ""}. ¿Lanzamos algo nuevo o revisamos lo que funcionó?`;
          } else if (platforms.length > 0) {
            proactiveMsg = `${platformStr} conectado${platforms.length > 1 ? "s" : ""} en ${accountName || "esta cuenta"}. Sin datos de campaña aún — ¿genero hooks, escribo un guión o hago preflight?`;
          } else {
            proactiveMsg = `${accountName ? `${accountName} cargada.` : "Cuenta cargada."} Sin plataformas conectadas — ve a Cuentas para conectar Meta Ads o Google Ads.`;
          }
        } else {
          if (histSpend) {
            proactiveMsg = `No active campaigns this week for ${accountName || "this account"}, but I have your history: $${snapshot?.total_spend?.toFixed(0)} analyzed${hasWinners ? `, ${snapshot.winners_count} winning creatives on file` : ""}${pausedCount ? `, ${pausedCount} underperformers flagged` : ""}. Want to launch something new or review what worked?`;
          } else if (platforms.length > 0) {
            proactiveMsg = (lang as string) === "pt"
              ? `${platformStr} conectado${platforms.length > 1 ? "s" : ""} para ${accountName || "essa conta"}. Sem dados de campanha ainda — quer gerar hooks, escrever um roteiro ou fazer preflight de um criativo?`
              : (lang as string) === "es"
              ? `${platformStr} conectado${platforms.length > 1 ? "s" : ""} para ${accountName || "esta cuenta"}. Sin datos de campaña aún — ¿genero hooks, escribo un guión o hago preflight?`
              : `${platformStr} connected for ${accountName || "this account"}. No campaign data yet — want to generate hooks, write a script, or preflight a creative?`;
          } else {
            proactiveMsg = (lang as string) === "pt"
              ? `${accountName ? `${accountName} carregada.` : "Conta carregada."} Sem plataformas de anúncio conectadas ainda — vá em Contas para conectar Meta Ads.`
              : (lang as string) === "es"
              ? `${accountName ? `${accountName} cargada.` : "Cuenta cargada."} Sin plataformas conectadas — ve a Cuentas para conectar Meta Ads o Google Ads.`
              : `${accountName ? `${accountName} loaded.` : "Account loaded."} No ad platforms connected yet — go to Accounts to connect Meta Ads or Google Ads.`;
          }
        }

      } else {
        // ── Sem nada conectado — onboarding consultivo ────────────────────────
        const aid = Date.now() + 1;
        const niche = (selectedPersona?.result as any)?.niche || (selectedPersona?.result as any)?.industry || "";
        const nicheHint = niche
          ? (lang === "pt" ? ` Para contas de ${niche}, já sei o que tende a funcionar.`
           : lang === "es" ? ` Para cuentas de ${niche}, ya sé qué suele funcionar.`
           : ` For ${niche} accounts, I already know what tends to work.`)
          : "";

        const intro = lang === "pt"
          ? `Posso te ajudar com hooks, roteiros, análise de concorrentes e estratégia criativa — mesmo sem dados conectados.${nicheHint} Para análises específicas da sua conta (CTR, ROAS, o que pausar), conecte o Meta Ads em Contas. Ou me diz o que você está trabalhando agora.`
          : lang === "es"
          ? `Puedo ayudarte con hooks, guiones, análisis de competidores y estrategia creativa — incluso sin datos conectados.${nicheHint} Para análisis específicos de tu cuenta (CTR, ROAS, qué pausar), conecta Meta Ads o Google Ads en Cuentas. O dime en qué estás trabajando ahora.`
          : `I can help with hooks, scripts, competitor analysis and creative strategy — even without connected data.${nicheHint} For specific account analysis (CTR, ROAS, what to pause), connect Meta Ads or Google Ads in Accounts. Or just tell me what you're working on.`;

        const cta = lang === "es" ? "Conectar cuenta →" : lang === "pt" ? "Conectar conta →" : "Connect account →";

        setMessages([{
          role: "assistant",
          blocks: [
            { type: "insight" as any, title: greetingTitle, content: intro },
            { type: "navigate" as any, title: lang === "pt" ? "Conectar Meta Ads" : lang === "es" ? "Conectar Meta Ads o Google Ads" : "Connect Meta Ads", content: lang === "pt" ? "Leva 30 segundos — depois vejo tudo da sua conta em tempo real." : lang === "es" ? "Solo 30 segundos — luego veo todo en tiempo real." : "Takes 30 seconds — then I see everything in real time.", route: "/dashboard/accounts", cta },
          ],
          ts: aid, id: aid
        }]);
        setProactiveLoading(false);
        return;
      }

      const aid = Date.now() + 1;
      setMessages([{
        role: "assistant",
        blocks: [{ type: "proactive" as any, title: greetingTitle, content: proactiveMsg }],
        ts: aid, id: aid
      }]);

    } catch (e) {
      console.error("proactive greeting failed:", e);
    } finally {
      setProactiveLoading(false);
    }
  };

  const handleConnect=async(id:string,fn:string)=>{
    // If no account selected, redirect to Accounts to create/select one first
    if(!selectedPersona){
      const msg=lang==="pt"?"Primeiro selecione ou crie uma conta em Contas para vincular o Meta Ads.":lang==="es"?"Primero selecciona o crea una cuenta en Cuentas para vincular Meta Ads.":"First select or create an account in Accounts to connect Meta Ads to.";
      const uid=Date.now();
      setMessages(prev=>[...prev,{role:"assistant",id:uid,ts:uid,blocks:[{type:"navigate",title:lang==="pt"?"Criar conta primeiro":"Create account first",content:msg,route:"/dashboard/accounts",cta:lang==="pt"?"Ir para Contas →":lang==="es"?"Ir a Cuentas →":"Go to Accounts →"}]}]);
      return;
    }
    try{const{data}=await supabase.functions.invoke(fn,{body:{action:"get_auth_url",user_id:user.id,persona_id:selectedPersona.id}});if(data?.url)window.location.href=data.url;}
    catch{}
  };

  const executeMetaAction=async(block:Block)=>{
    const{data,error}=await supabase.functions.invoke("meta-actions",{
      body:{action:block.meta_action,user_id:user.id,persona_id:selectedPersona?.id||null,target_id:block.target_id,target_type:block.target_type,value:block.value}
    });

    // ── Audit log — registra toda ação executada ──
    const actionRecord={
      user_id:user.id,
      action:block.meta_action,
      target_id:block.target_id||null,
      target_type:block.target_type||null,
      target_name:block.target_name||null,
      value:block.value||null,
      title:block.title,
      success:!(error||data?.error),
      error_msg:data?.error||error?.message||null,
      executed_at:new Date().toISOString(),
    };
    supabase.from("ai_action_log" as any).insert(actionRecord).then(()=>{});

    if(error||data?.error){
      const id=Date.now();
      setMessages(prev=>[...prev,{role:"assistant",id,ts:id,blocks:[{type:"warning",title:"Falha",content:data?.error||error?.message||"Tente novamente."}]}]);
      return;
    }

    // ── Feed capture-learning with real action outcomes ──────────────────────
    // Every executed Meta action (pause/enable/budget) becomes a performance signal
    if(user?.id && block.meta_action && block.meta_action !== "list_campaigns"){
      supabase.functions.invoke("capture-learning",{body:{
        user_id: user.id,
        event_type: "meta_action_executed",
        data: {
          action: block.meta_action,
          target_name: block.target_name || block.title || "",
          target_type: block.target_type || "ad",
          target_id: block.target_id || null,
          value: block.value || null,
          success: true,
          executed_at: new Date().toISOString(),
        }
      }}).catch(()=>{});
    }

    if(data?.campaigns){
      const rows=(data.campaigns as any[]).map((c:any)=>[c.name,c.effective_status||c.status,c.daily_budget?`$${(c.daily_budget/100).toFixed(0)}/dia`:"—",c.id]);
      const dashBlock={type:"dashboard" as const,title:lang==="pt"?"Campanhas":"Campaigns",table:{headers:[lang==="pt"?"Nome":"Name","Status",lang==="pt"?"Orçamento":"Budget","ID"],rows}};
      setMessages(prev=>{
        const idx=[...prev].reverse().findIndex((m:any)=>m.blocks?.some((b:any)=>b.meta_action==="list_campaigns"||b.meta_action==="get_campaigns"));
        const realIdx=idx>=0?prev.length-1-idx:-1;
        if(realIdx>=0){return prev.map((m,i)=>i===realIdx?{...m,blocks:[dashBlock]}:m);}
        const id=Date.now();
        return[...prev,{role:"assistant" as const,id,ts:id,blocks:[dashBlock]}];
      });
    } else if(data?.success && block.meta_action){
      // Show success confirmation
      const id=Date.now();
      const label = data.message || (block.meta_action === "pause" ? (lang==="pt"?"Pausado com sucesso":"Paused successfully") : block.meta_action === "enable" ? (lang==="pt"?"Ativado com sucesso":"Activated successfully") : (lang==="pt"?"Ação executada":"Action executed"));
      setMessages(prev=>[...prev,{role:"assistant",id,ts:id,blocks:[{type:"action",title:lang==="pt"?"Pronto":"Done",content:label}]}]);
    }
  };

  const handleNavigate=(route:string,params?:Record<string,string>)=>{
    navigate(params&&Object.keys(params).length?`${route}?${new URLSearchParams(params)}`:`${route}`);
  };

  const handleCopy=(id:number,blocks:Block[])=>{
    const text=blocks.map(b=>[b.title,b.content,...(b.items||[])].filter(Boolean).join("\n")).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(()=>setCopiedId(null),2000);
  };

  const handleFeedback=(id:number,type:"like"|"dislike",blocks:Block[])=>{
    const prev=feedback[id];
    if(prev===type)return; // already set
    setFeedback(f=>({...f,[id]:type}));
    // Fire-and-forget: capture learning
    if(user?.id){
      const msg=messages.find(m=>m.id===id);
      supabase.functions.invoke("capture-learning",{body:{
        user_id:user.id,
        event_type:"chat_feedback",
        data:{ blocks, feedback:type, message_text:msg?.userText||"", persona_id:selectedPersona?.id||null }
      }}).catch(()=>{});
    }
  };

  const send=async(text?:string, displayText?:string)=>{
    let msg=(text??input).trim();
    if(!msg||loading)return;
    const userText = displayText ?? msg;
    // Context ainda carregando — mostra feedback visual em vez de silêncio
    if(!contextReady){
      const uid=Date.now();
      const hint=lang==="pt"?"Carregando contexto da conta, aguarde um instante...":lang==="es"?"Cargando contexto de la cuenta, espera un momento...":"Loading account context, just a moment...";
      setMessages(prev=>[...prev,{role:"user",userText:userText,ts:uid,id:uid},{role:"assistant",ts:uid+1,id:uid+1,blocks:[{type:"insight" as const,title:"",content:hint}]}]);
      setInput("");
      return;
    }

    // ── Intercept Telegram intent — check status first, respond accurately ──
    if (/telegram/i.test(msg) && user?.id) {
      const uid = Date.now();
      setMessages(prev=>[...prev,{role:"user",id:uid,ts:uid,userText:userText}]);
      setInput("");
      requestAnimationFrame(()=>bottomRef.current?.scrollIntoView({behavior:"instant"}));
      setLoading(true);
      try {
        const { data: tgConn } = await (supabase.from("telegram_connections" as any) as any)
          .select("chat_id, telegram_username, connected_at")
          .eq("user_id", user.id).eq("active", true).maybeSingle();

        const aid = Date.now()+1;

        if (tgConn?.chat_id) {
          // CONNECTED — confirm status and show commands
          const username = tgConn.telegram_username ? `@${tgConn.telegram_username}` : null;
          const since = tgConn.connected_at
            ? new Date(tgConn.connected_at).toLocaleDateString(lang==="pt"?"pt-BR":"en", { day:"2-digit", month:"short", year:"numeric" })
            : null;
          const txt = lang==="pt"
            ? `Sim, já está conectado${username ? ` como ${username}` : ""}. Você recebe alertas automáticos quando algo crítico acontece na conta e pode pausar criativos direto pelo bot.`
            : lang==="es"
            ? `Sí, ya está conectado${username ? ` como ${username}` : ""}. Recibes alertas automáticos cuando algo crítico pasa en la cuenta y puedes pausar creativos directo desde el bot.`
            : `Yes, it's connected${username ? ` as ${username}` : ""}. You get automatic alerts when something critical happens in your account and can pause creatives directly from the bot.

To disconnect, click the Telegram icon at the top.`;
          setMessages(prev=>[...prev,{role:"assistant",id:aid,ts:aid,blocks:[{type:"text" as const,title:"",content:txt}]}]);
        } else if (/conect|ativ|quero|want|receb|alert|notif|quiero/i.test(msg)) {
          // NOT CONNECTED + wants to connect — generate pairing link
          const tok = Math.random().toString(36).slice(2,8)+Math.random().toString(36).slice(2,8);
          await (supabase.from("telegram_pairing_tokens" as any) as any).insert({
            user_id:user.id, token:tok,
            expires_at: new Date(Date.now()+10*60*1000).toISOString(),
          });
          const link = `https://t.me/AdBriefAlertsBot?start=${tok}`;
          const txt = lang==="pt"
            ? `Simples. Clique no link — ele abre o @AdBriefAlertsBot com o seu token. Toque em /start e pronto.

🔗 ${link}

Você vai receber alertas críticos e pode pausar anúncios direto pelo Telegram. Tudo fica registrado aqui com data e hora.`
            : lang==="es"
            ? `Simple. Haz clic en el enlace — abre @AdBriefAlertsBot con tu token. Toca /start y listo.

🔗 ${link}

Recibirás alertas críticos y podrás pausar anuncios desde Telegram.`
            : `Simple. Click the link — it opens @AdBriefAlertsBot with your token. Tap /start and you're done.

🔗 ${link}

You'll get critical alerts and can pause ads from Telegram. Everything logged here.`;
          setMessages(prev=>[...prev,{role:"assistant",id:aid,ts:aid,blocks:[{type:"text" as const,title:lang==="pt"?"Conectar Telegram":lang==="es"?"Conectar Telegram":"Connect Telegram",content:txt}]}]);
        } else {
          // NOT CONNECTED + just asking — inform
          const txt = lang==="pt"
            ? `Seu Telegram não está conectado ainda. Quer conectar para receber alertas críticos e pausar anúncios direto pelo app?`
            : lang==="es"
            ? `Tu Telegram aún no está conectado. ¿Quieres conectarlo para recibir alertas?`
            : `Your Telegram isn't connected yet. Want to connect to receive alerts and run commands?`;
          setMessages(prev=>[...prev,{role:"assistant",id:aid,ts:aid,blocks:[{type:"text" as const,title:"Telegram",content:txt}]}]);
        }
      } catch {
        const eid = Date.now()+2;
        setMessages(prev=>[...prev,{role:"assistant",id:eid,ts:eid,blocks:[{type:"warning",title:"Erro",content:lang==="pt"?"Não foi possível verificar o Telegram. Tente novamente.":"Could not check Telegram status. Try again."}]}]);
      }
      setLoading(false);
      return;
    }

        // If dashboard tool is active, prefix with dashboard intent
    if(activeTool==="dashboard"&&!text){
      const prefix=lang==="pt"?"[DASHBOARD] ":lang==="es"?"[DASHBOARD] ":"[DASHBOARD] ";
      msg=prefix+msg;
    }
    setInput("");
    if(textareaRef.current)textareaRef.current.style.height="auto";
    setActiveTool(null);
    const uid=Date.now();
    setMessages(prev=>[...prev,{role:"user",userText:userText,ts:uid,id:uid}]);
    // Scroll imediato ao enviar — não espera a resposta
    requestAnimationFrame(()=>bottomRef.current?.scrollIntoView({behavior:"instant"}));
    setLoading(true);
    try{
      // Compress history: user = plain text; assistant = readable summary including table data
      const history = messages.slice(-12).map(m => {
        if (m.role === "user") return { role: "user" as const, content: m.userText || "" };
        const text = (m.blocks || []).map((b: any) => {
          // Dashboard/table blocks: serialize rows so AI remembers campaign data
          if (b.type === "dashboard" && b.table) {
            const rows = (b.table.rows || []).slice(0, 5).map((r: any[]) =>
              (b.table.headers || []).map((h: string, i: number) => `${h}:${r[i]||"—"}`).join(" ")
            ).join(" | ");
            return `${b.title||"Dados"}: ${rows}`.slice(0, 300);
          }
          const parts = [
            b.title?.trim(),
            b.content?.slice(0, 180),
            (b.items || []).slice(0, 3).join(" | "),
          ].filter(Boolean);
          return parts.join(": ");
        }).filter(Boolean).join(" | ").slice(0, 500);
        return { role: "assistant" as const, content: text || "(response)" };
      });
      // Tone: free-text from localStorage (replaces hardcoded 3 options)
      const aiTonePref = (() => { return storage.get("adbrief_ai_tone", "") })();
      const{data,error}=await supabase.functions.invoke("adbrief-ai-chat",{body:{message:msg,context,user_id:user.id,persona_id:selectedPersona?.id||null,user_language:lang,history,user_prefs:{tone:aiTonePref||undefined}}});

      // Handle rate limit errors (429) — supabase returns them as errors with context
      if(error) {
        // Try multiple ways to parse the 429 body from Supabase edge function errors
        let parsedErr: any = null;
        try {
          const ctx = (error as any).context;
          if (ctx instanceof Response) {
            const txt = await ctx.clone().text();
            parsedErr = JSON.parse(txt);
          } else if (typeof ctx === "string") {
            parsedErr = JSON.parse(ctx);
          } else if (ctx && typeof ctx === "object") {
            // ctx might already be parsed
            parsedErr = ctx;
          }
        } catch {
          // Last resort: try parsing the error message itself
          try { parsedErr = JSON.parse(error?.message || "{}"); } catch {}
        }
        if(parsedErr?.error==="daily_limit"){setShowUpgradeWall(true);setLoading(false);return;}
        if(parsedErr?.error==="dashboard_limit"){setShowDashboardLimit(true);setLoading(false);return;}
        if(parsedErr?.error==="monthly_softcap"){
          const aid=Date.now()+1;
          const warningBlocks=parsedErr.blocks||[{type:"warning",title:lang==="pt"?"Limite mensal":lang==="es"?"Límite mensual":"Monthly limit",content:lang==="pt"?"Você está se aproximando do limite do plano. Considere fazer upgrade.":"You're approaching your plan limit. Consider upgrading."}];
          setMessages(prev=>[...prev,{role:"assistant",blocks:warningBlocks,ts:aid,id:aid}]);
          setLoading(false);
          return;
        }
        // If error has blocks in it, show them instead of crashing
        if(parsedErr?.blocks){
          const aid=Date.now()+1;
          setMessages(prev=>[...prev,{role:"assistant",blocks:parsedErr.blocks,ts:aid,id:aid}]);
          setLoading(false);
          return;
        }
        throw new Error(error?.message||"No response");
      }

      if(!data?.blocks)throw new Error("No response");

      // Update usage counter from response
      // Update freeUsage count after send
      if(data?.usage) setFreeUsage(prev => prev ? {...prev, count: data.usage.daily_count} : {count: data.usage.daily_count, lastReset: new Date().toISOString().slice(0,10)});

      // Show upgrade popup on daily limit (in case returned with 200)
      if(data?.error==="daily_limit"){setShowUpgradeWall(true);setLoading(false);return;}
      if(data?.error==="dashboard_limit"){setShowDashboardLimit(true);setLoading(false);return;}

      // Strip all markdown from text fields
      const stripMd=(s:string)=>String(s)
        .replace(/\*\*(.*?)\*\*/g,"$1").replace(/\*(.*?)\*/g,"$1")
        .replace(/#+\s/g,"").replace(/^\d+\.\s/gm,"").replace(/^[-*]\s/gm,"").trim();

      let blocks:Block[]=Array.isArray(data.blocks)?data.blocks:[{type:"insight",title:"Response",content:String(data.blocks)}];
      const isDashReq=msg.includes("[DASHBOARD]")||msg.toLowerCase().includes("dashboard");
      // Detect trend/evolution requests — auto-inject sparkline from snapshots
      const isTrendReq = /roas.*tempo|ctr.*tempo|evolu|tendên|trend|histórico.*performance|30.*dias|semanas?.*performance|performance.*semana|como.*está.*indo/i.test(msg);
      if (isTrendReq && user?.id) {
        // Fire and forget — load snapshots and prepend trend block
        (supabase as any).from("daily_snapshots")
          .select("date,avg_ctr,avg_roas,total_spend")
          .eq("user_id", user.id)
          .order("date", { ascending: true })
          .limit(30)
          .then((r: any) => {
            const rows = (r.data || []).filter((d: any) => d.date);
            if (rows.length >= 2) {
              const trendBlock: Block = {
                type: "trend_chart",
                title: lang === "pt" ? "Evolução da conta" : lang === "es" ? "Evolución de cuenta" : "Account evolution",
                trend: {
                  dates: rows.map((d: any) => d.date.slice(5)), // MM-DD
                  ctr: rows.map((d: any) => d.avg_ctr || 0),
                  roas: rows.map((d: any) => d.avg_roas || 0),
                  spend: rows.map((d: any) => d.total_spend || 0),
                }
              };
              // Prepend trend block to the AI response
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return [...prev.slice(0, -1), { ...last, blocks: [trendBlock, ...(last.blocks || [])] }];
                }
                return prev;
              });
            }
          }).catch(() => {});
      }

      // Title translation map — converts technical API terms to human-readable labels
      const TITLE_MAP: Record<string, Record<string, string>> = {
        pt: {
          "list_campaigns": "Campanhas da conta",
          "list_ads": "Anúncios ativos",
          "get_campaigns": "Campanhas",
          "get_ads": "Anúncios",
          "list_adsets": "Conjuntos de anúncios",
          "get_insights": "Performance",
          "meta_action": "Ação no Meta Ads",
          "tool_call": "Processando...",
          "hooks": "Hooks gerados",
          "script": "Roteiro",
          "brief": "Brief criativo",
          "off_topic": "Fora do escopo",
          "insight": "",
          "analysis": "",
          "Análise": "",
          "action": "",
          "warning": "Atenção",
          "navigate": "Ver mais",
          "dashboard": "Dashboard",
          "pause": "Pausar campanha",
          "enable": "Ativar campanha",
          "update_budget": "Atualizar orçamento",
          "publish": "Publicar",
          "duplicate": "Duplicar",
        },
        es: {
          "list_campaigns": "Campañas de la cuenta",
          "list_ads": "Anuncios activos",
          "get_campaigns": "Campañas",
          "get_ads": "Anuncios",
          "meta_action": "Acción en Meta Ads",
          "tool_call": "Procesando...",
          "hooks": "Hooks generados",
          "script": "Guión",
          "brief": "Brief creativo",
          "off_topic": "Fuera del alcance",
          "insight": "",
          "analysis": "",
          "action": "",
          "warning": "Atención",
        },
        en: {
          "list_campaigns": "Account campaigns",
          "list_ads": "Active ads",
          "get_campaigns": "Campaigns",
          "get_ads": "Ads",
          "meta_action": "Meta Ads action",
          "tool_call": "Processing...",
          "hooks": "Generated hooks",
          "script": "Script",
          "brief": "Creative brief",
          "off_topic": "Out of scope",
          "insight": "",
          "analysis": "",
          "Analysis": "",
          "action": "",
          "warning": "Attention",
        },
      };
      const translateTitle = (title: string, type: string): string => {
        const map = TITLE_MAP[lang] || TITLE_MAP.en;
        // Check if title is a known technical term
        if (map[title]) return map[title];
        // Check if title is a type name
        if (map[type]) return map[type];
        // Check for patterns like "list_X" or "get_X"
        if (/^(list|get|fetch|update|create|delete|pause|enable)_/.test(title)) {
          const action = title.split('_')[0];
          const subject = title.split('_').slice(1).join(' ');
          const actionMap: Record<string, Record<string,string>> = {
            pt: { list: 'Listar', get: 'Buscar', fetch: 'Buscar', update: 'Atualizar', create: 'Criar', delete: 'Remover', pause: 'Pausar', enable: 'Ativar' },
            es: { list: 'Listar', get: 'Buscar', fetch: 'Buscar', update: 'Actualizar' },
            en: { list: 'List', get: 'Get', fetch: 'Fetch', update: 'Update' },
          };
          const aMap = actionMap[lang] || actionMap.en;
          if (aMap[action]) return `${aMap[action]} ${subject}`;
        }
        return title;
      };

      blocks=blocks.map(b=>{
        // Clean all text
        const c={...b,
          // stripMd only on title — content/items need markdown preserved for renderMarkdown
          title:b.title?translateTitle(stripMd(b.title), b.type):b.title,
          content:b.content, // preserve markdown for renderMarkdown (**bold**, \n\n)
          items:b.items, // preserve markdown in hook items too
        };
        // Upgrade insight→dashboard when requested and no dashboard block exists
        if(isDashReq&&(c.type==="insight"||c.type==="action")&&!blocks.some(bb=>bb.type==="dashboard")){
          const metrics=(c.items||[]).slice(0,6).map((it:string)=>{
            const m=it.match(/^([^:]+):\s*(.+)$/);
            if(m)return{label:m[1].trim().slice(0,30),value:m[2].trim().slice(0,20),delta:"",trend:"flat" as const};
            return{label:it.slice(0,30),value:"—",delta:"",trend:"flat" as const};
          });
          if(metrics.length>0)return{...c,type:"dashboard" as const,metrics,items:undefined};
        }
        // Intercept empty hooks block (AI returned {type:"hooks", items:[]}) — execute generate-hooks
        if(c.type==="hooks" && (!c.items || c.items.length === 0)){
          const countMatch=msg.match(/(\d+)\s+hooks?/i);
          const params={
            product:(profile as any)?.product || selectedPersona?.name || "produto",
            niche:(profile as any)?.industry || (profile as any)?.niche || "geral",
            market:lang.toUpperCase()||"BR",
            platform:connections.includes("meta")?"Meta Feed":false /* google disabled */?"Google":"Meta Feed",
            tone:"human, direct",
            count:countMatch?parseInt(countMatch[1]):5,
            context:msg,
            user_id:user.id,
            persona_id:selectedPersona?.id||null,
          };
          return{...c,type:"tool_call" as const,_pendingTool:"generate-hooks",_toolParams:params};
        }

        // Convert meta_action tool_call — read-only: execute immediately, destructive: show confirm
        if(c.type==="tool_call"&&c.tool_params?.meta_action){
          const p=c.tool_params;
          const DESTRUCTIVE=["pause","enable","update_budget","publish","duplicate","delete","archive","rename","set_","change_"];
          const isDestructive=DESTRUCTIVE.some(d=>String(p.meta_action||"").toLowerCase().includes(d));
          if(!isDestructive){
            return{...c,type:"meta_action" as const,meta_action:p.meta_action,target_id:p.target_id,target_type:p.target_type,target_name:p.target_name,value:p.value,_autoExec:true};
          }
          return{...c,type:"meta_action" as const,meta_action:p.meta_action,target_id:p.target_id,target_type:p.target_type,target_name:p.target_name,value:p.value};
        }
        // When AI emits a tool_call for content tools, open the panel with prefilled context
        if(c.type==="tool_call"&&["hooks","script","brief","competitor","translate"].includes(c.tool||"")&&!(c as any)._pendingTool){
          // Auto-open panel with AI-populated context + prefill from tool_params
          const p=c.tool_params||{};
          const prefill: Record<string,string>={};
          if(p.competitor_url||p.url||p.brand||p.ad_text) prefill.val=p.competitor_url||p.url||p.brand||p.ad_text||"";
          if(p.source_text||p.text) prefill.val=p.source_text||p.text||"";
          if(p.angle) prefill.val=p.angle;
          setTimeout(()=>{setActiveTool(c.tool||null);setActiveToolParams(prefill);},100);
        }
        // Execute competitor tool_calls inline — invoke decode-competitor
        if(c.type==="tool_call"&&c.tool==="competitor"){
          const p=c.tool_params||{};
          const params={
            ad_text: p.competitor_url||p.url||p.brand||p.ad_text||p.context||"",
            observation: p.angle||p.context||"",
            ui_language: lang,
            user_id: user.id,
          };
          return{...c,type:"tool_call" as const,_pendingTool:"decode-competitor",_toolParams:params};
        }
        // Execute translate tool_calls inline — invoke translate-text
        if(c.type==="tool_call"&&c.tool==="translate"){
          const p=c.tool_params||{};
          const params={
            source_text: p.source_text||p.text||p.content||"",
            to_language: p.target_language||p.to_language||"en",
            to_language_name: p.target_language_name||p.to_language_name||"English",
            tone: p.tone||"Persuasive",
            context: p.context||p.angle||"",
            user_id: user.id,
          };
          return{...c,type:"tool_call" as const,_pendingTool:"translate-text",_toolParams:params};
        }
        // Execute hooks/script/brief tool_calls inline — fire and replace
        if(c.type==="tool_call"&&["hooks","script","brief"].includes(c.tool||"")){
          const p=c.tool_params||{};
          const fn=c.tool==="hooks"?"generate-hooks":c.tool==="script"?"generate-script":"generate-brief";
          // generate-script expects: product, offer, audience, format, duration, market, angle, extra_context
          // generate-hooks expects: product, niche, market, platform, tone, count, context
          const params = fn === "generate-script" ? {
            user_id: user.id,
            persona_id: selectedPersona?.id || null,
            product: p.product || p.niche || "produto",
            offer: p.cta || "",
            audience: p.audience || p.target || "",
            format: p.format || "ugc",
            duration: p.duration || "30s",
            market: p.market || (lang === "pt" ? "BR" : lang === "es" ? "MX" : "US"),
            angle: p.angle || p.tone || "",
            extra_context: p.context || p.extra_context || "",
            ui_language: lang, // user's app language — primary for output language
          } : {
            ...p,
            user_id: user.id,
            persona_id: selectedPersona?.id || null,
            product: p.product || p.niche || "produto",
            niche: p.niche || p.product || "produto",
            market: p.market || (lang === "pt" ? "BR" : lang === "es" ? "MX" : "US"),
            platform: p.platform || "Meta Feed",
            tone: p.tone || "human, credible, specific",
            count: p.count || 5,
            context: p.context || p.angle || "",
            angle: p.angle || "",
          };
          return{...c,type:"tool_call" as const,_pendingTool:fn,_toolParams:params};
        }
        return c;
      });

      const aid=Date.now()+1;
      setMessages(prev=>[...prev,{role:"assistant",blocks,ts:aid,id:aid}]);
      // Increment free usage count locally after successful send
      if(profile?.plan==="free"||!profile?.plan){
        setFreeUsage(prev=>prev?{...prev,count:Math.min(3,prev.count+1)}:{count:1,lastReset:new Date().toISOString().slice(0,10)});
      }
    }catch(e:any){
      const eid=Date.now()+1;
      setMessages(prev=>[...prev,{role:"assistant",ts:eid,id:eid,blocks:[{type:"warning",title:lang==="pt"?"Erro de conexão":"Connection error",content:e?.message||"Network error."}]}]);
    }finally{
      setLoading(false);
      setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),80);
    }
  };

  const handleDashboardSilentConfirm = async (msg: string) => {
    if (!msg || loading || !contextReady) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("adbrief-ai-chat", {
        body: {
          message: msg,
          user_id: user.id,
          persona_id: selectedPersona?.id || null,
          user_language: lang,
          history: [...messages].slice(-10).map(m => ({
            role: m.role,
            content: (m.blocks || []).map((b: any) => b.content || "").join(" ").slice(0, 300)
          })).filter(m => m.content),
        }
      });
      if (data?.blocks?.length) {
        const aid = Date.now() + 1;
        setMessages(prev => [...prev, { role: "assistant", blocks: data.blocks, ts: aid, id: aid }]);
      }
    } catch (e) {
      console.error("dashboard silent error", e);
    } finally {
      setLoading(false);
    }
  };

    const TOOLS=TOOLBAR[lang]||TOOLBAR.en;
  const hasData=connections.length>0;

  const dashboardPlaceholder = lang==="pt"?"Diga qual dashboard quer — campanhas, criativos, ROAS...":lang==="es"?"Di qué dashboard quieres — campañas, creativos, ROAS...":"Say what dashboard you want — campaigns, creatives, ROAS...";

  const LABEL: Record<string,Record<string,string>>={
    pt:{clear:"Limpar",placeholder:activeTool==="dashboard"?dashboardPlaceholder:"Pergunte sobre sua conta...",footer:"Somente performance de anúncios e inteligência criativa",connecting:"Conectando...",soon:"Em breve"},
    es:{clear:"Limpiar",placeholder:activeTool==="dashboard"?dashboardPlaceholder:"Pregunta sobre tu cuenta...",footer:"Solo inteligencia de rendimiento publicitario",connecting:"Conectando...",soon:"Pronto"},
    en:{clear:"Clear",placeholder:activeTool==="dashboard"?dashboardPlaceholder:"Ask anything...",footer:"Strictly ad performance & creative intelligence",connecting:"Connecting...",soon:"Soon"},
  };
  const L=LABEL[lang]||LABEL.en;

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",...j,background:"var(--bg-main)",position:"relative" as const}}>
      {/* Background — blueprint grid técnico */}
      <div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:0}}>
        {/* Blueprint grid — linhas horizontais */}
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(14,165,233,0.045) 1px, transparent 1px)",backgroundSize:"100% 44px",maskImage:"linear-gradient(to bottom,transparent 0%,black 12%,black 88%,transparent 100%)",WebkitMaskImage:"linear-gradient(to bottom,transparent 0%,black 12%,black 88%,transparent 100%)"}}/>
        {/* Blueprint grid — linhas verticais */}
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(90deg, rgba(14,165,233,0.03) 1px, transparent 1px)",backgroundSize:"44px 100%",maskImage:"linear-gradient(to bottom,transparent 0%,black 12%,black 88%,transparent 100%)",WebkitMaskImage:"linear-gradient(to bottom,transparent 0%,black 12%,black 88%,transparent 100%)"}}/>
        {/* Bloom topo-direita — azul estático */}
        <div style={{position:"absolute",width:700,height:500,borderRadius:"50%",background:"radial-gradient(ellipse at 80% 10%,rgba(14,165,233,0.09) 0%,transparent 60%)",top:0,right:0,filter:"blur(40px)"}}/>
        {/* Bloom baixo-esquerda — indigo estático */}
        <div style={{position:"absolute",width:500,height:400,borderRadius:"50%",background:"radial-gradient(ellipse at 20% 90%,rgba(99,102,241,0.07) 0%,transparent 60%)",bottom:0,left:0,filter:"blur(40px)"}}/>
        {/* Fade top */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:60,background:"linear-gradient(to bottom,var(--bg-main),transparent)"}}/>
        {/* Fade bottom */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:100,background:"linear-gradient(to top,var(--bg-main),transparent)"}}/>
      </div>

      {/* ── Live Panel — always visible when platform connected, outside scroll ── */}
      {contextReady&&hasData&&(
        <div style={{position:"relative",zIndex:2,flexShrink:0}}>
        <SectionBoundary label="LivePanel" inline>
        <LivePanel
          user={user}
          selectedPersona={selectedPersona}
          connections={connections}
          lang={lang}
          onSend={send}
        />
        </SectionBoundary>
        </div>
      )}

      

      {/* ── Messages ── */}
      <div style={{flex:1,overflowY:"auto",padding:"0",background:"transparent",position:"relative" as const,zIndex:1,display:"flex",flexDirection:"column" as const,paddingTop:8}}>
        
        {/* ── Persistent Account Alerts — survive chat clear ── */}
        {accountAlerts.length > 0 && (
          <div style={{maxWidth:720,margin:"0 auto 16px",padding:"0 16px",display:"flex",flexDirection:"column",gap:8}}>
            {accountAlerts.map((alert:any) => {
              const isHigh = alert.urgency === "high";
              const isDismissing = alertsDismissing.has(alert.id);
              return (
                <div key={alert.id} style={{
                  padding:"12px 16px",borderRadius:12,
                  background: isHigh ? "rgba(248,113,113,0.07)" : "rgba(251,191,36,0.07)",
                  border: `1px solid ${isHigh ? "rgba(248,113,113,0.25)" : "rgba(251,191,36,0.25)"}`,
                  display:"flex",alignItems:"flex-start",gap:10,
                  opacity: isDismissing ? 0 : 1,
                  transform: isDismissing ? "translateX(12px) scale(0.97)" : "translateX(0) scale(1)",
                  transition: isDismissing ? "all 0.25s cubic-bezier(0.4,0,0.2,1)" : "opacity 0.15s",
                  pointerEvents: isDismissing ? "none" as const : "auto" as const
                }}>
                  <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{isHigh ? "🔴" : "🟡"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:"0 0 2px",fontSize:12,fontWeight:700,color: isHigh ? "#f87171" : alert.type==="system" ? "rgba(14,165,233,0.8)" : "#fbbf24",textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"'DM Mono',monospace"}}>
                      {(() => {
                        const t = alert.type;
                        const labels: Record<string,Record<string,string>> = {
                          critical:  { pt:"Alerta crítico",   es:"Alerta crítica",   en:"Critical alert"   },
                          warning:   { pt:"Atenção",          es:"Atención",         en:"Warning"          },
                          system:    { pt:"Sistema",          es:"Sistema",          en:"System"           },
                          action:    { pt:"Ação registrada",  es:"Acción registrada",en:"Action logged"    },
                          info:      { pt:"Info",             es:"Info",             en:"Info"             },
                        };
                        return labels[t]?.[lang] || labels[t]?.en || t?.replace(/_/g," ") || "Alert";
                      })()}
                    </p>
                    {alert.ad_name && (
                      <p style={{margin:"0 0 2px",fontSize:13,fontWeight:600,color:"#eef0f6",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
                        {alert.ad_name}
                        {alert.campaign_name && <span style={{fontWeight:400,color:"rgba(238,240,246,0.4)",fontSize:12}}> · {alert.campaign_name}</span>}
                      </p>
                    )}
                    <p style={{margin:0,fontSize:12,color:"rgba(238,240,246,0.65)",lineHeight:1.5,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
                      {alert.detail}
                    </p>
                    <p style={{margin:"4px 0 0",fontSize:12,color:"rgba(238,240,246,0.3)",fontFamily:"'DM Mono',monospace"}}>
                      {new Date(alert.created_at).toLocaleString(lang==="pt"?"pt-BR":"en-US",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
                    </p>
                  </div>
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    disabled={isDismissing}
                    style={{flexShrink:0,background:"none",border:"none",cursor:"pointer",color:"rgba(238,240,246,0.25)",fontSize:16,padding:"2px 4px",lineHeight:1}}
                    title={lang==="pt"?"Dispensar":"Dismiss"}>
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {messages.length===0&&proactiveLoading&&(
          <div style={{maxWidth:720,margin:"0 auto",paddingTop:12,padding:"12px 16px 0"}}>
            <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:16}}>
              <div style={{width:28,height:28,borderRadius:8,background:"rgba(14,165,233,0.10)",flexShrink:0,animation:"skPulse 1.4s ease-in-out infinite"}}/>
              <div style={{flex:1}}>
                <div style={{height:10,width:72,borderRadius:6,background:"rgba(255,255,255,0.06)",marginBottom:10,animation:"skPulse 1.4s ease-in-out infinite"}}/>
                <div style={{height:13,width:"90%",borderRadius:6,background:"rgba(255,255,255,0.05)",marginBottom:7,animation:"skPulse 1.4s 0.1s ease-in-out infinite"}}/>
                <div style={{height:13,width:"75%",borderRadius:6,background:"rgba(255,255,255,0.05)",marginBottom:7,animation:"skPulse 1.4s 0.2s ease-in-out infinite"}}/>
                <div style={{height:13,width:"55%",borderRadius:6,background:"rgba(255,255,255,0.03)",marginBottom:14,animation:"skPulse 1.4s 0.3s ease-in-out infinite"}}/>
                <div style={{display:"flex",gap:8}}>
                  {[96,84,88,78].map((w,i)=>(
                    <div key={i} style={{height:26,width:w,borderRadius:20,background:"rgba(255,255,255,0.03)",animation:`skPulse 1.4s ${i*0.12}s ease-in-out infinite`}}/>
                  ))}
                </div>
              </div>
            </div>
            <style>{`@keyframes skPulse{0%,100%{opacity:0.35}50%{opacity:0.75}}`}</style>
          </div>
        )}

        {messages.length===0&&!proactiveLoading&&contextReady&&(
          <div style={{maxWidth:720,margin:"16px auto 0",padding:"0 16px"}}>
            {!hasData ? (
              /* ── No account connected — force connect ── */
              <div style={{textAlign:"center",padding:"48px 24px"}}>
                {/* Icon */}
                <div style={{width:52,height:52,borderRadius:14,background:"rgba(14,165,233,0.08)",border:"1px solid rgba(14,165,233,0.15)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(14,165,233,0.75)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h8M8 14h5"/></svg>
                </div>
                <h3 style={{...j,fontSize:17,fontWeight:700,color:"#f0f2f8",margin:"0 0 8px",letterSpacing:"-0.02em"}}>
                  {lang==="pt"?"Conecte sua conta de anúncios":lang==="es"?"Conecta tu cuenta de anuncios":"Connect your ad account"}
                </h3>
                <p style={{...m,fontSize:13,color:"rgba(255,255,255,0.4)",lineHeight:1.65,margin:"0 0 24px",maxWidth:320,marginLeft:"auto",marginRight:"auto"}}>
                  {lang==="pt"?"Sem conexão, a IA responde de forma genérica. Com sua conta, ela vê CTR, spend, o que pausar e o que escalar.":lang==="es"?"Sin conexión la IA responde de forma genérica. Con tu cuenta ve CTR, spend, qué pausar y escalar.":"Without connection, AI gives generic answers. With your account it sees CTR, spend, what to pause and scale."}
                </p>
                {selectedPersona ? (
                  <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
                    <button onClick={()=>handleConnect("meta","meta-oauth")}
                      style={{...j,display:"inline-flex",alignItems:"center",gap:8,padding:"12px 28px",borderRadius:12,background:"#1877F2",color:"#fff",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,boxShadow:"0 0 24px rgba(14,165,233,0.2)",transition:"all 0.2s"}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform="translateY(-1px)";}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform="translateY(0)";}}>
                      {PLATFORM_ICONS_INLINE.meta} {lang==="pt"?"Conectar Meta Ads":lang==="es"?"Conectar Meta Ads":"Connect Meta Ads"}
                    </button>
                    <button onClick={()=>navigate("/dashboard/accounts")}
                      style={{...j,display:"inline-flex",alignItems:"center",gap:6,padding:"9px 20px",borderRadius:10,background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.4)",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",fontSize:12,fontWeight:500}}>
                      {lang==="pt"?"Ou conectar Google Ads →":lang==="es"?"O conectar Google Ads →":"Or connect Google Ads →"}
                    </button>
                  </div>
                ) : (
                  <button onClick={()=>navigate("/dashboard/accounts")}
                    style={{...j,display:"inline-flex",alignItems:"center",gap:8,padding:"12px 28px",borderRadius:12,background:"rgba(255,255,255,0.08)",color:"#fff",border:"1px solid rgba(255,255,255,0.12)",cursor:"pointer",fontSize:13,fontWeight:700}}>
                    {lang==="pt"?"Criar conta primeiro →":lang==="es"?"Crear cuenta primero →":"Create account first →"}
                  </button>
                )}
                <p style={{...m,fontSize:12,color:"rgba(255,255,255,0.15)",marginTop:16}}>
                  {lang==="pt"?"Conectar leva menos de 2 minutos":lang==="es"?"Conectar toma menos de 2 minutos":"Takes less than 2 minutes to connect"}
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* Load more — shown when there are older messages not rendered */}
        {hasOlderMessages && (
          <div style={{maxWidth:720,width:"100%",margin:"0 auto 8px",padding:"0 clamp(12px,4vw,28px)",boxSizing:"border-box" as const}}>
            <button onClick={()=>setVisibleCount(c=>c+MSG_PAGE)}
              style={{width:"100%",padding:"8px 0",background:"var(--bg-surface)",border:"1px solid var(--border-subtle)",borderRadius:10,color:"var(--text-muted)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",transition:"all 0.15s"}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border-default)"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border-subtle)"}}>
              ↑ Ver {Math.min(MSG_PAGE, messages.length - visibleCount)} mensagens anteriores
            </button>
          </div>
        )}
        {visibleMessages.length > 0 && <div style={{height:8,flexShrink:0}}/>}
        {visibleMessages.map((msg, mi)=>{
          const isLatest = mi === visibleMessages.length - 1 && msg.role === "assistant";
          return (
          <div key={msg.id} className="msg-wrap-inner" style={{maxWidth:720,width:"100%",margin:"0 auto 14px",padding:"0 clamp(12px,4vw,28px)",boxSizing:"border-box" as const}}>
            {msg.role==="user"?(
              /* ── Bolha do usuário — direita, azul sólido ── */
              <div style={{display:"flex",justifyContent:"flex-end"}} className="user-msg-row">
                <div className="user-bubble-wrap" style={{display:"flex",flexDirection:"column" as const,alignItems:"flex-end",gap:4,maxWidth:"min(72%,calc(100vw - 80px))"}}>
                  <div style={{
                    padding:"10px 16px",
                    borderRadius:"18px 18px 4px 18px",
                    background:"linear-gradient(135deg,#0ea5e9,#0891b2)",
                    boxShadow:"0 2px 12px rgba(14,165,233,0.25)",
                    fontSize:14,fontWeight:400,
                    color:"#fff",
                    lineHeight:1.65,
                    animation:"bubbleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                    ...m,
                  }}>
                    {msg.userText}
                  </div>
                  {/* Ações no hover */}
                  <div className="user-msg-actions" style={{display:"flex",alignItems:"center",gap:4,opacity:0,transition:"opacity 0.15s",pointerEvents:"none" as const}}>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"rgba(255,255,255,0.18)"}}>
                      {new Date(typeof msg.ts === "number" ? msg.ts : Date.now()).toLocaleTimeString(lang==="pt"?"pt-BR":"en-US",{hour:"2-digit",minute:"2-digit"})}
                    </span>
                    <button onClick={(e)=>{navigator.clipboard.writeText(msg.userText||"");const b=e.currentTarget;b.style.color="#34d399";setTimeout(()=>{b.style.color="rgba(255,255,255,0.25)";},1600);}}
                      style={{display:"flex",alignItems:"center",gap:3,height:22,padding:"0 7px",borderRadius:5,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",color:"rgba(255,255,255,0.25)",fontSize:11,...m,transition:"color 0.18s"}}>
                      <Copy size={8}/>Copiar
                    </button>
                    <button onClick={()=>send(msg.userText||"")}
                      style={{display:"flex",alignItems:"center",gap:3,height:22,padding:"0 7px",borderRadius:5,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",color:"rgba(255,255,255,0.25)",fontSize:11,...m,transition:"color 0.12s"}}>
                      <RefreshCw size={8}/>Retry
                    </button>
                  </div>
                </div>
              </div>
            ):(
              /* ── Bolha da IA — esquerda, card escuro ── */
              /* Se todos blocks são _pendingTool, suprimir tudo — ThinkingIndicator cobre */
              <div key={msg.blocks?.every((b:any)=>b._pendingTool) ? "pending" : "resolved"}>
                {/* Avatar + label — só mostra se há blocks reais */}
                {!!(msg.blocks?.length) && !(msg.blocks?.length === 1 && (msg.blocks[0].type as string) === "proactive") && (
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,animation:"fadeUp 0.15s ease-out"}}>
                    <div style={{width:26,height:26,borderRadius:8,flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(14,165,233,0.12)",border:"1px solid rgba(14,165,233,0.22)"}}>
                      <ABAvatar size={26}/>
                    </div>
                    <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,fontWeight:600,color:"rgba(14,165,233,0.7)",letterSpacing:"-0.01em"}}>AdBrief AI</span>
                  </div>
                )}
                {/* Blocks — card da IA */}
                {!(msg.blocks?.length === 1 && (msg.blocks[0].type as string) === "proactive") && !msg.blocks?.every((b:any)=>b._pendingTool) ? (
                  <div style={{
                    background:"var(--bg-card)",
                    border:"1px solid var(--border-subtle)",
                    borderRadius:"4px 18px 18px 18px",
                    padding:"16px 20px",
                    boxShadow:"0 2px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
                    backdropFilter:"blur(8px)",
                    animation:isLatest?"cardIn 0.28s cubic-bezier(0.16,1,0.3,1)":"cardIn 0.22s ease-out",
                  }}>
                    {msg.blocks?.map((b,bi)=>
                      b.type==="dashboard"?<DashboardBlock key={bi} block={b}/>:
                      b.type==="meta_action"?<ConfirmActionBlock key={bi} block={b} lang={lang} onConfirm={executeMetaAction}/>:
                      b.type==="dashboard_offer"?<DashboardOfferBlock key={bi} block={b} lang={lang} onConfirm={(msg)=>send(msg)} onSilentConfirm={handleDashboardSilentConfirm}/>:
                      (b.type as string)==="limit_warning"?(
                        <div key={bi} style={{marginTop:8,padding:"10px 14px",borderRadius:10,background:"rgba(14,165,233,0.05)",border:"1px solid rgba(14,165,233,0.15)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap" as const}}>
                          <p style={{...m,fontSize:13,color:"rgba(14,165,233,0.8)",lineHeight:1.5,margin:0,flex:1}}>{b.content}</p>
                          {(b as any).will_hit_limit&&(
                            <button onClick={()=>setShowUpgradeWall(true)}
                              style={{...j,fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:8,background:"#0ea5e9",color:"#fff",border:"none",cursor:"pointer",flexShrink:0,whiteSpace:"nowrap" as const}}>
                              {lang==="pt"?"Ver planos →":lang==="es"?"Ver planes →":"See plans →"}
                            </button>
                          )}
                        </div>
                      ):
                      (b as any)._pendingTool?null:
                      <BlockCard key={bi} block={b} lang={lang} onNavigate={handleNavigate} onSend={send} accountCtx={{product:(profile as any)?.product||selectedPersona?.name,niche:(profile as any)?.industry||(profile as any)?.niche,market:(profile as any)?.market||(lang==="pt"?"BR":lang==="es"?"MX":"US"),platform:connections.includes("meta")?"Meta":undefined}} stream={isLatest}/>
                    )}
                    {/* Cursor piscando — só na última mensagem, desaparece após 3s */}
                    {isLatest && (
                      <span style={{
                        display:"inline-block", width:2, height:14,
                        background:"rgba(14,165,233,0.7)", borderRadius:1,
                        marginLeft:2, verticalAlign:"middle",
                        animation:"cursorBlink 0.9s step-end infinite, fadeUp 0.1s ease-out both",
                        animationDelay:"0s, 0s",
                        // Auto-hide after 3s via opacity transition
                        opacity:1,
                      }} className="stream-cursor"/>
                    )}
                  </div>
                ) : (
                  /* Proactive — sem card, renderiza direto */
                  msg.blocks?.map((b,bi)=>
                    (b.type as string)==="proactive"?<ProactiveBlock key={bi} block={b} lang={lang} onSend={send} connections={connections} personaName={selectedPersona?.name||undefined}/>:
                    <BlockCard key={bi} block={b} lang={lang} onNavigate={handleNavigate} onSend={send} accountCtx={{product:(profile as any)?.product||selectedPersona?.name,niche:(profile as any)?.industry||(profile as any)?.niche,market:(profile as any)?.market||(lang==="pt"?"BR":lang==="es"?"MX":"US"),platform:connections.includes("meta")?"Meta":undefined}} stream={isLatest}/>
                  )
                )}
                {/* 👍 👎 Copy Retry row — hidden for proactive messages */}
                {!(msg.blocks?.length === 1 && (msg.blocks[0].type as string) === "proactive") && (
                <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4,paddingLeft:0,opacity:0,transition:"opacity 0.15s",animation:"fadeUp 0.25s ease-out"}} className="msg-actions-row" onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity="1"}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity="0.6"}}>
                  <button onClick={()=>handleFeedback(msg.id,"like",msg.blocks||[])}
                    style={{display:"flex",alignItems:"center",justifyContent:"center",width:24,height:22,borderRadius:6,background:feedback[msg.id]==="like"?"rgba(52,211,153,0.12)":"transparent",border:`1px solid ${feedback[msg.id]==="like"?"rgba(52,211,153,0.3)":"rgba(255,255,255,0.07)"}`,cursor:"pointer",color:feedback[msg.id]==="like"?"#34d399":"rgba(255,255,255,0.25)",transition:"all 0.12s"}}
                    onMouseEnter={e=>{if(feedback[msg.id]!=="like")(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.15)"}}
                    onMouseLeave={e=>{if(feedback[msg.id]!=="like")(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.07)"}}>
                    <ThumbsUp size={10}/>
                  </button>
                  <button onClick={()=>handleFeedback(msg.id,"dislike",msg.blocks||[])}
                    style={{display:"flex",alignItems:"center",justifyContent:"center",width:24,height:22,borderRadius:6,background:feedback[msg.id]==="dislike"?"rgba(248,113,113,0.12)":"transparent",border:`1px solid ${feedback[msg.id]==="dislike"?"rgba(248,113,113,0.3)":"rgba(255,255,255,0.07)"}`,cursor:"pointer",color:feedback[msg.id]==="dislike"?"#f87171":"rgba(255,255,255,0.25)",transition:"all 0.12s"}}
                    onMouseEnter={e=>{if(feedback[msg.id]!=="dislike")(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.15)"}}
                    onMouseLeave={e=>{if(feedback[msg.id]!=="dislike")(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.07)"}}>
                    <ThumbsDown size={10}/>
                  </button>
                  <div style={{width:1,height:14,background:"rgba(255,255,255,0.07)",margin:"0 2px"}}/>
                  <button onClick={()=>handleCopy(msg.id,msg.blocks||[])}
                    style={{display:"flex",alignItems:"center",gap:3,height:26,padding:"0 8px",borderRadius:6,background:copiedId===msg.id?"rgba(52,211,153,0.08)":"transparent",border:`1px solid ${copiedId===msg.id?"rgba(52,211,153,0.25)":"rgba(255,255,255,0.07)"}`,cursor:"pointer",color:copiedId===msg.id?"#34d399":"rgba(255,255,255,0.25)",fontSize:12,...m,transition:"all 0.18s",transform:copiedId===msg.id?"scale(1.06)":"scale(1)"}}
                    onMouseEnter={e=>{if(copiedId!==msg.id)(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.15)"}}
                    onMouseLeave={e=>{if(copiedId!==msg.id)(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.07)"}}>
                    {copiedId===msg.id?<svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>:<Copy size={9}/>}
                    {copiedId===msg.id?"Copiado!":lang==="es"?"Copiar":"Copiar"}
                  </button>
                  <button onClick={()=>{
                    // Find the user message that immediately precedes this assistant message
                    const idx = messages.indexOf(msg);
                    const prevUser = [...messages].slice(0, idx).reverse().find(m => m.role === "user");
                    send(prevUser?.userText || "");
                  }}
                    style={{display:"flex",alignItems:"center",gap:3,height:26,padding:"0 8px",borderRadius:6,background:"transparent",border:"1px solid rgba(255,255,255,0.07)",cursor:"pointer",color:"rgba(255,255,255,0.25)",fontSize:12,...m,transition:"all 0.12s"}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.15)"}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.07)"}}>
                    <RefreshCw size={9}/>Retry
                  </button>
                </div>
                )}
              </div>
            )}
          </div>
          );
        })}

        <div style={{maxWidth:720,width:"100%",margin:"0 auto",padding:"0 clamp(12px,4vw,40px)",boxSizing:"border-box" as const}}>{loading&&<ThinkingIndicator lang={lang} variant="chat"/>}</div>
        {!loading&&messages.some(m=>m.blocks?.some(b=>(b as any)._pendingTool))&&(
          <div style={{maxWidth:720,width:"100%",margin:"0 auto",padding:"0 32px",boxSizing:"border-box"}}>
          <ThinkingIndicator lang={lang} variant="chat" label={(() => {
              const pendingFn = (messages.flatMap(m=>m.blocks||[]) as any[]).find(b=>b._pendingTool)?._pendingTool as string|undefined;
              if(pendingFn==="generate-hooks")  return lang==="pt"?"Gerando hooks...":lang==="es"?"Generando hooks...":"Generating hooks...";
              if(pendingFn==="generate-script") return lang==="pt"?"Escrevendo roteiro...":lang==="es"?"Escribiendo guión...":"Writing script...";
              if(pendingFn==="generate-brief")  return lang==="pt"?"Criando brief...":lang==="es"?"Creando brief...":"Creating brief...";
              // Usar a última mensagem do usuário para label contextual
              const last = (messages.filter(m=>m.role==="user").slice(-1)[0]?.userText||"").toLowerCase().trim();
              const isGreeting = /^(oi|olá|ola|hey|hi|hello|e aí|e ai|bom dia|boa tarde|boa noite|tudo bem|td bem|salve)[\s!?.,]*$/.test(last);
              if(isGreeting)                     return lang==="pt"?"Respondendo...":lang==="es"?"Respondiendo...":"Thinking...";
              if(/hook|gancho|copy|abertura/.test(last))   return lang==="pt"?"Analisando hooks...":lang==="es"?"Analizando hooks...":"Analyzing hooks...";
              if(/roteiro|script|vídeo|video|ugc/.test(last)) return lang==="pt"?"Estruturando roteiro...":lang==="es"?"Estructurando guión...":"Building script...";
              if(/brief|editor|direção/.test(last))        return lang==="pt"?"Montando brief...":"Building brief...";
              if(/pausa|pause|escal|budget/.test(last))    return lang==="pt"?"Verificando conta...":"Checking account...";
              if(/roas|ctr|cpm|cpc|perform/.test(last))    return lang==="pt"?"Analisando performance...":"Analyzing performance...";
              if(/concorr|competitor|rival/.test(last))    return lang==="pt"?"Analisando concorrente...":"Analyzing competitor...";
              if(last.length < 20)                         return lang==="pt"?"Respondendo...":lang==="es"?"Respondiendo...":"Thinking...";
              return lang==="pt"?"Pensando...":lang==="es"?"Pensando...":"Thinking...";
            })()}/>
          </div>
        )}
        {/* Inline tool panel — only show when not loading */}
        {activeTool&&activeTool!=="dashboard"&&!loading&&!messages.some(m=>m.blocks?.some(b=>(b as any)._pendingTool))&&(
          <div style={{maxWidth:720,margin:"0 auto 8px",padding:"0 40px",boxSizing:"border-box" as const}}>
            <InlineToolPanel
              action={activeTool}
              onClose={()=>setActiveTool(null)}
              onSend={send}
              lang={lang}
              accountCtx={{
                product: (profile as any)?.product || selectedPersona?.name || undefined,
                niche: (profile as any)?.industry || (profile as any)?.niche || undefined,
                market: (profile as any)?.market || lang.toUpperCase(),
                platform: connections.includes("meta") ? "Meta" : false /* google disabled */ ? "Google" : undefined,
                angle: undefined,
              }}
            />
          </div>
        )}

        <div style={{flexShrink:0,height:16}}/>
        <div ref={bottomRef} style={{height:4}}/>
      </div>

      {/* ── Input area ── */}
      <div style={{flexShrink:0,position:"relative" as const,zIndex:2}}>

        {/* Fade from chat → input */}
        <div style={{height:40,background:"linear-gradient(to bottom,transparent,rgba(9,12,20,0.98))",pointerEvents:"none",marginBottom:-1}}/>

        {/* Main input surface */}
        <div style={{background:"#0a0d16",padding:"8px 0 18px"}}>
          <div style={{maxWidth:720,margin:"0 auto",padding:"0 24px",boxSizing:"border-box" as const}}>

            {/* Session goal — one line, persists 7 days */}
            {showGoalInput ? (
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                <input
                  autoFocus
                  placeholder={lang==="pt"?"Objetivo desta semana (ex: escalar winners, cortar CPA)…":lang==="es"?"Objetivo esta semana (ej: escalar ganadores, cortar CPA)…":"Goal this week (e.g. scale winners, cut CPA)…"}
                  defaultValue={sessionGoal}
                  onKeyDown={e=>{
                    if(e.key==="Enter") saveGoal((e.target as HTMLInputElement).value.trim());
                    if(e.key==="Escape"){setShowGoalInput(false);}
                  }}
                  onBlur={e=>saveGoal(e.target.value.trim())}
                  style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(14,165,233,0.35)",borderRadius:8,padding:"5px 12px",color:"#f0f2f8",fontSize:12,outline:"none",fontFamily:"'Inter',sans-serif",caretColor:"#0ea5e9"}}
                />
                <button onClick={()=>setShowGoalInput(false)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)",fontSize:16,lineHeight:1,padding:"0 4px"}}>×</button>
              </div>
            ) : (
              <button
                onClick={()=>setShowGoalInput(true)}
                style={{display:"flex",alignItems:"center",gap:5,marginBottom:8,background:"none",border:"none",cursor:"pointer",padding:0,maxWidth:"100%"}}
              >
                <span style={{fontSize:11,color:"rgba(255,255,255,0.18)",fontFamily:"'Inter',sans-serif",letterSpacing:"0.04em",textTransform:"uppercase" as const}}>
                  {lang==="pt"?"objetivo":lang==="es"?"objetivo":"goal"}
                </span>
                <span style={{fontSize:12,color:sessionGoal?"rgba(14,165,233,0.7)":"rgba(255,255,255,0.22)",fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const,maxWidth:400}}>
                  {sessionGoal || (lang==="pt"?"definir foco desta semana →":lang==="es"?"definir foco esta semana →":"set this week's focus →")}
                </span>
              </button>
            )}

            {/* Tool pills */}
            <div className="tool-pills-row" style={{display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none",marginBottom:10} as any}>
              {TOOLS.map(tool=>{
                const isOn = activeTool===tool.action;
                return (
                  <button key={tool.action} className={isOn?"tool-pill tool-pill-on":"tool-pill"}
                    onClick={()=>{
                      if(tool.action==="dashboard"){
                        if(!isOn){
                          const defMsg=lang==="pt"?"[DASHBOARD] Mostrar resumo da conta — campanhas, ROAS e criativos ativos":lang==="es"?"[DASHBOARD] Mostrar resumen de la cuenta":"[DASHBOARD] Show account summary — campaigns, ROAS and active creatives";
                          send(defMsg);
                        }
                        return;
                      }
                      setActiveTool(isOn?null:tool.action);
                    }}
                    style={{
                      display:"flex",alignItems:"center",gap:5,
                      padding:"5px 12px",borderRadius:99,flexShrink:0,
                      background: isOn ? tool.color : "var(--bg-surface)",
                      border:`1px solid ${isOn ? "transparent" : "var(--border-default)"}`,
                      color: isOn ? "#000" : "rgba(255,255,255,0.65)",
                      fontSize:12,fontWeight:500,cursor:"pointer",
                      fontFamily:"'Plus Jakarta Sans',sans-serif",
                      letterSpacing:"-0.01em",
                      transition:"background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s",
                      boxShadow: isOn ? `0 0 12px ${tool.color}50` : "0 0 0px transparent",
                    }}
                  >
                    <tool.icon size={12} strokeWidth={isOn?2.5:2}/>
                    {tool.label}
                  </button>
                );
              })}
            </div>

            {/* Usage — barra + count, funciona pra qualquer plano */}
            {freeUsage!==null&&(()=>{
              const planKey = profile?.plan||"free";
              const CAPS: Record<string,number> = {free:3,maker:50,pro:200,studio:500};
              const cap = CAPS[planKey]??3;
              if(cap>=500) return null; // studio — sem limite, esconde
              const used = freeUsage?.count??0;
              const isLocked = used>=cap;
              const pct = Math.min(100,(used/cap)*100);
              const barColor = isLocked?"rgba(239,68,68,0.6)":pct>=80?"rgba(245,158,11,0.6)":"rgba(14,165,233,0.5)";
              const textColor = isLocked?"rgba(239,68,68,0.5)":pct>=80?"rgba(245,158,11,0.5)":"rgba(255,255,255,0.2)";
              return(
                <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:8,marginBottom:6}}>
                  {/* barra */}
                  <div style={{width:40,height:2,borderRadius:99,background:"rgba(255,255,255,0.07)",overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:99,width:`${pct}%`,background:barColor,transition:"width 0.4s"}}/>
                  </div>
                  {/* count */}
                  <span style={{fontSize:11,color:textColor,fontFamily:"'Plus Jakarta Sans',sans-serif",fontVariantNumeric:"tabular-nums"}}>
                    {used}/{cap}
                  </span>
                  {/* timer quando locked */}
                  {isLocked&&countdown&&(
                    <span style={{fontSize:11,color:"rgba(255,255,255,0.18)",fontFamily:"'Plus Jakarta Sans',sans-serif",fontVariantNumeric:"tabular-nums"}}>
                      {countdown}
                    </span>
                  )}
                  {/* upgrade — mesmo estilo do botão da landing */}
                  {isLocked&&(
                    <button onClick={()=>setShowUpgradeWall(true)} style={{
                      fontSize:13,fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,
                      padding:"6px 16px",borderRadius:12,border:"none",
                      background:"#0ea5e9",color:"#fff",cursor:"pointer",
                      boxShadow:"0 0 32px rgba(14,165,233,0.25)",
                      whiteSpace:"nowrap",letterSpacing:"-0.025em",
                    }}>Upgrade</button>
                  )}
                </div>
              );
            })()}

            {/* Input card — clean dark, como a demo */}
            <div className="input-box-wrap" style={{
              display:"flex",alignItems:"center",gap:10,
              background:"rgba(255,255,255,0.04)",
              backdropFilter:"blur(20px) saturate(180%)",
              border:"1px solid var(--border-subtle)",
              borderRadius:16,
              padding:"12px 12px 12px 18px",
              boxShadow:"0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
              transition:"border-color 0.2s, box-shadow 0.2s",
            }}>
              <textarea ref={textareaRef} value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
                placeholder={L.placeholder} rows={1}
                style={{flex:1,background:"transparent",border:"none",padding:"0",color:"#f0f2f8",fontSize:15.5,resize:"none",outline:"none",...m,lineHeight:1.6,minHeight:26,maxHeight:140,caretColor:"#0ea5e9"}}
                className="chat-textarea"
                onInput={e=>{const t=e.target as HTMLTextAreaElement;requestAnimationFrame(()=>{t.style.height="auto";t.style.height=Math.min(t.scrollHeight,140)+"px";});}}
              />
              <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0,paddingBottom:1}}>
                {messages.length>0&&(
                  <button onClick={()=>{
                    const confirmed = window.confirm(
                      lang==="pt" ? "Limpar toda a conversa? Isso não pode ser desfeito." :
                      lang==="es" ? "¿Limpiar toda la conversación? Esto no se puede deshacer." :
                      "Clear the entire conversation? This cannot be undone."
                    );
                    if(!confirmed) return;
                    setMessages([]);
                    storage.remove(SK);
                    executedTools.current.clear();
                    proactiveFired.current=false;
                    setVisibleCount(MSG_PAGE);
                    setGreetingKey(k=>k+1);
                  }}
                    title={lang==="pt"?"Limpar conversa":lang==="es"?"Limpiar chat":"Clear chat"}
                    style={{width:34,height:34,borderRadius:10,background:"transparent",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s",color:"rgba(255,255,255,0.22)"}}
                    onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor="rgba(255,255,255,0.18)";el.style.color="rgba(255,255,255,0.55)";}}
                    onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor="rgba(255,255,255,0.08)";el.style.color="rgba(255,255,255,0.22)";}}>
                    <RotateCcw size={13}/>
                  </button>
                )}
                <button onClick={()=>{
                  const isFree=(profile?.plan==="free"||!profile?.plan);
                  const used=freeUsage?.count??0;
                  if(isFree&&used>=3){setShowUpgradeWall(true);return;}
                  send();
                }} disabled={!input.trim()||loading||!contextReady}
                  style={{
                    width:34,height:34,borderRadius:10,border:"none",
                    background:input.trim()&&!loading&&contextReady?"#0ea5e9":"rgba(255,255,255,0.06)",
                    cursor:input.trim()&&contextReady?"pointer":"not-allowed",
                    display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                    transition:"background 0.15s",
                  }}>
                  {loading
                    ?<Loader2 size={15} color="rgba(255,255,255,0.7)" className="animate-spin"/>
                    :<Send size={15} color={input.trim()&&contextReady?"#fff":"rgba(255,255,255,0.22)"}/>
                  }
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{transform:scale(1);opacity:0.4}50%{transform:scale(1.4);opacity:1}}
        @keyframes orbFloat1{0%{transform:translate(0,0) scale(1)}100%{transform:translate(8%,12%) scale(1.08)}}
        @keyframes orbFloat2{0%{transform:translate(0,0) scale(1)}100%{transform:translate(-10%,-8%) scale(1.05)}}
        @keyframes toolSlideIn{from{opacity:0;transform:translateY(10px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes lp-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bubbleIn{from{opacity:0;transform:translateX(10px) scale(0.95)}to{opacity:1;transform:translateX(0) scale(1)}}
        @keyframes cardIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes cursorBlink{0%,49%{opacity:1}50%,100%{opacity:0}}
        @keyframes cursorFade{0%,85%{opacity:1}100%{opacity:0}}
        .stream-cursor{animation:cursorBlink 0.7s step-end 4, cursorFade 3s linear 1 forwards!important;}
        /* Cursor pisca 4x em 2.8s depois faz fade */
        @keyframes typeIn{from{opacity:0;transform:translateY(3px) scale(0.99)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes lp-glow{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.35;transform:scale(0.75)}}
        @keyframes lp-spin{to{transform:rotate(360deg)}}
        @keyframes lp-sk{0%,100%{opacity:0.2}50%{opacity:0.5}}
        .lp *{box-sizing:border-box;}
        .lp-kpi{transition:border-color 0.15s,background 0.15s;}
        .lp-kpi:hover{border-color:rgba(255,255,255,0.1)!important;background:rgba(255,255,255,0.04)!important;}
        .lp-row{transition:background 0.12s;}
        .lp-row:hover{background:rgba(148,163,184,0.05)!important;}
        .input-box-wrap:focus-within{border-color:rgba(14,165,233,0.4)!important;box-shadow:0 0 0 3px rgba(14,165,233,0.08)!important;}
        .lp-chip:hover{background:rgba(14,165,233,0.08)!important;border-color:rgba(14,165,233,0.2)!important;color:rgba(255,255,255,0.8)!important;}
        .lp-alert{transition:opacity 0.12s;}
        .lp-alert:hover{opacity:0.75;}
        .lp-btn:hover{color:rgba(255,255,255,0.7)!important;background:rgba(255,255,255,0.07)!important;}
        .lp-tab:hover{color:rgba(255,255,255,0.6)!important;}
        .lp-bar:hover{background:rgba(255,255,255,0.025)!important;}
        .tool-pill:not(.tool-pill-on):hover{background:rgba(255,255,255,0.10)!important;border-color:rgba(255,255,255,0.18)!important;color:rgba(255,255,255,0.85)!important;}
        .input-box-wrap:focus-within{border-color:rgba(14,165,233,0.4)!important;}
        .chat-textarea{caret-color:#0ea5e9;}
        .chat-textarea::placeholder{color:rgba(255,255,255,0.32)!important}
        .user-msg-row:hover .user-msg-actions{opacity:1!important;pointer-events:auto!important;}
        .user-msg-row>div{box-shadow:none!important;}
        .msg-wrap-inner:hover .msg-actions-row{opacity:1!important;}
        .msg-body{font-size:14px;line-height:1.75;color:rgba(235,240,248,0.90);}
        .msg-body p{margin:0 0 10px;}
        .msg-body p:last-child{margin-bottom:0;}
        .msg-body strong{font-weight:600;color:rgba(255,255,255,0.95);letter-spacing:-0.01em;}
        .msg-body code{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:5px;padding:2px 6px;font-family:'DM Mono',monospace;font-size:12.5px;}
        .user-msg-row .user-msg-actions button:hover{color:rgba(255,255,255,0.6)!important;}
        @media(max-width:768px){
          /* Chat: mensagens ocupam largura total */
          .msg-wrap-inner{padding:0 12px!important;margin-bottom:12px!important}
          .user-bubble-wrap{max-width:86%!important}
          /* Card da IA: padding menor */
          .msg-wrap-inner [style*="border-radius: 4px"],[style*="borderRadius: \\"4px\\""]{ padding:14px 16px!important }
          /* Actions row: menor */
          .msg-actions-row{gap:3px!important}
          /* Body text: levemente menor */
          .msg-body p{font-size:13.5px!important;line-height:1.7!important}
          /* Input: sem hint desktop, font 16px anti-zoom */
          .chat-footer-hint{display:none!important}
          .chat-textarea{font-size:16px!important}
          .chat-textarea::placeholder{font-size:14px!important;opacity:0.25!important}
          /* LivePanel: KPIs 2 por linha */
          .lp-kpi{min-width:calc(50% - 4px)!important;flex:1 1 calc(50% - 4px)!important}
          .lp-kpis-row{gap:6px!important;flex-wrap:wrap!important}
          .lp-chip{font-size:11px!important;padding:4px 9px!important}
          /* Tool pills: scroll horizontal */
          .tool-pills-row{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;padding-bottom:4px!important;flex-wrap:nowrap!important;scrollbar-width:none}
          .tool-pills-row::-webkit-scrollbar{display:none}
          /* Proactive block: padding menor */
          .proactive-wrap{padding:32px 20px 24px!important}
          /* Input wrap: padding menor */
          .chat-input-wrap{padding:8px 12px 12px!important}
          /* Suggestions: scroll horizontal */
          .suggestions-bar{overflow-x:auto!important;flex-wrap:nowrap!important;-webkit-overflow-scrolling:touch;padding-bottom:4px;scrollbar-width:none}
          .suggestions-bar::-webkit-scrollbar{display:none}
        }
        @media(max-width:480px){
          .msg-wrap-inner{padding:0 10px!important;margin-bottom:10px!important}
          .user-bubble-wrap{max-width:90%!important}
          .lp-bar{height:38px!important;padding:0 10px!important}
          /* Metric chips na bar: menores */
          .lp-bar [style*="padding: 3px"]{padding:2px 7px!important}
        }
      `}</style>

      {showUpgradeWall&&<UpgradeWall trigger="chat" onClose={()=>setShowUpgradeWall(false)}/>}
      {showDashboardLimit&&<DashboardLimitPopup lang={lang} plan={profile?.plan} onClose={()=>setShowDashboardLimit(false)}/>}
    </div>
  );
}

// 1775424742
