// AdBrief AI — unified v4
// Design: LoopV2 clean + AdBriefAI power (meta actions, dashboards, tool_call)
import { useState, useEffect, useRef } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import {
  Send, Loader2, Sparkles, RotateCcw, Brain,
  ThumbsUp, ThumbsDown, Copy, RefreshCw,
  ScanLine, Zap, Clapperboard, ScanEye, LayoutDashboard, X,
  TrendingUp, TrendingDown, AlertTriangle, BarChart2,
  Upload, FileText, BarChart3
} from "lucide-react";
import UpgradeWall from "@/components/UpgradeWall";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
const F = "'Plus Jakarta Sans', sans-serif";
const M = "'Inter', sans-serif";
const j = { fontFamily: F } as const;
const m = { fontFamily: M } as const;

// ── Platforms ──────────────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: "meta",   label: "Meta Ads",   fn: "meta-oauth",   color: "#1877F2",
    Icon: ({ active }: { active: boolean }) => (
      <svg width="16" height="10" viewBox="0 0 36 18" fill="none">
        <path d="M8.5 0C5.5 0 3.2 1.6 1.6 3.8 0.6 5.2 0 7 0 9c0 2 0.6 3.8 1.6 5.2C3.2 16.4 5.5 18 8.5 18c2.2 0 4-0.9 5.5-2.4L18 12l4 3.6C23.5 17.1 25.3 18 27.5 18c3 0 5.3-1.6 6.9-3.8 1-1.4 1.6-3.2 1.6-5.2 0-2-0.6-3.8-1.6-5.2C32.8 1.6 30.5 0 27.5 0c-2.2 0-4 0.9-5.5 2.4L18 6l-4-3.6C12.5 0.9 10.7 0 8.5 0zm0 4c1.2 0 2.2 0.5 3.2 1.4L15 8.9 11.7 12.6C10.7 13.5 9.7 14 8.5 14c-1.6 0-2.9-0.8-3.8-2C4 11 3.6 10 3.6 9s0.4-2 1.1-3C5.6 4.8 6.9 4 8.5 4zm19 0c1.6 0 2.9 0.8 3.8 2 0.7 1 1.1 2 1.1 3s-0.4 2-1.1 3c-0.9 1.2-2.2 2-3.8 2-1.2 0-2.2-0.5-3.2-1.4L21 9.1l3.3-3.7C25.3 4.5 26.3 4 27.5 4z" fill={active ? "#1877F2" : "rgba(255,255,255,0.4)"}/>
      </svg>
    )},
  { id: "tiktok", label: "TikTok Ads", fn: "tiktok-oauth", color: "#06b6d4", soon: true,
    Icon: ({ active }: { active: boolean }) => (
      <svg width="14" height="14" viewBox="0 0 24 24" fill={active ? "#06b6d4" : "rgba(255,255,255,0.3)"}>
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.72a4.85 4.85 0 0 1-1.01-.03z"/>
      </svg>
    )},
  { id: "google", label: "Google Ads", fn: "google-oauth", color: "#4285F4", soon: true,
    Icon: ({ active }: { active: boolean }) => (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill={active ? "#4285F4" : "rgba(255,255,255,0.3)"}/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill={active ? "#34A853" : "rgba(255,255,255,0.2)"}/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill={active ? "#FBBC05" : "rgba(255,255,255,0.2)"}/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill={active ? "#EA4335" : "rgba(255,255,255,0.2)"}/>
      </svg>
    )},
];

// Inline icons for use in JSX buttons
const PLATFORM_ICONS_INLINE: Record<string,React.ReactNode> = {
  meta: <svg width="16" height="10" viewBox="0 0 36 18" fill="none"><path d="M8.5 0C5.5 0 3.2 1.6 1.6 3.8 0.6 5.2 0 7 0 9c0 2 0.6 3.8 1.6 5.2C3.2 16.4 5.5 18 8.5 18c2.2 0 4-0.9 5.5-2.4L18 12l4 3.6C23.5 17.1 25.3 18 27.5 18c3 0 5.3-1.6 6.9-3.8 1-1.4 1.6-3.2 1.6-5.2 0-2-0.6-3.8-1.6-5.2C32.8 1.6 30.5 0 27.5 0c-2.2 0-4 0.9-5.5 2.4L18 6l-4-3.6C12.5 0.9 10.7 0 8.5 0zm0 4c1.2 0 2.2 0.5 3.2 1.4L15 8.9 11.7 12.6C10.7 13.5 9.7 14 8.5 14c-1.6 0-2.9-0.8-3.8-2C4 11 3.6 10 3.6 9s0.4-2 1.1-3C5.6 4.8 6.9 4 8.5 4zm19 0c1.6 0 2.9 0.8 3.8 2 0.7 1 1.1 2 1.1 3s-0.4 2-1.1 3c-0.9 1.2-2.2 2-3.8 2-1.2 0-2.2-0.5-3.2-1.4L21 9.1l3.3-3.7C25.3 4.5 26.3 4 27.5 4z" fill="#fff"/></svg>,
};
const TOOLBAR: Record<string, Array<{icon: any; label: string; action: string; color: string}>> = {
  en: [
    { icon: ScanLine,       label: "Upload ad",      action: "upload",     color: "#60a5fa" },
    { icon: Zap,            label: "Gen hooks",      action: "hooks",      color: "#06b6d4" },
    { icon: Clapperboard,   label: "Write script",   action: "script",     color: "#34d399" },
    { icon: ScanEye,        label: "Competitors",     action: "competitor", color: "#a78bfa" },
    { icon: LayoutDashboard,label: "Dashboard",      action: "dashboard",  color: "#0ea5e9" },
  ],
  pt: [
    { icon: ScanLine,       label: "Upload anúncio",    action: "upload",     color: "#60a5fa" },
    { icon: Zap,            label: "Gerar hooks",        action: "hooks",      color: "#06b6d4" },
    { icon: Clapperboard,   label: "Escrever roteiro",   action: "script",     color: "#34d399" },
    { icon: ScanEye,        label: "Concorrentes",        action: "competitor", color: "#a78bfa" },
    { icon: LayoutDashboard,label: "Dashboard",          action: "dashboard",  color: "#0ea5e9" },
  ],
  es: [
    { icon: ScanLine,       label: "Subir anuncio",     action: "upload",     color: "#60a5fa" },
    { icon: Zap,            label: "Generar hooks",     action: "hooks",      color: "#06b6d4" },
    { icon: Clapperboard,   label: "Escribir guión",    action: "script",     color: "#34d399" },
    { icon: ScanEye,        label: "Competidores",        action: "competitor", color: "#a78bfa" },
    { icon: BarChart2, label: "Dashboard",    action: "dashboard",  color: "#0ea5e9" },
  ],
};

const SUGG: Record<string, string[]> = {
  pt: ["O que está matando meu ROAS agora?", "Qual anúncio devo pausar hoje?", "Escreva 3 hooks dos meus top criativos", "O que produzir semana que vem?"],
  es: ["¿Qué está matando mi ROAS ahora?", "¿Qué anuncio pausar hoy?", "Escribe 3 hooks de mis mejores creativos", "¿Qué producir la próxima semana?"],
  en: ["What's killing my ROAS right now?", "Which ad should I pause today?", "Write 3 hooks from my best creatives", "What should I produce next week?"],
};

// ── Block types ────────────────────────────────────────────────────────────────
interface Block {
  type: "action"|"pattern"|"hooks"|"warning"|"insight"|"off_topic"|"navigate"|"tool_call"|"dashboard"|"meta_action"|"dashboard_offer"|"text";
  remaining?: number;
  original_message?: string;
  title: string; content?: string; items?: string[];
  route?: string; params?: Record<string,string>; cta?: string;
  tool?: string; tool_params?: Record<string,string>;
  meta_action?: string; target_id?: string; target_type?: string; target_name?: string; value?: string;
  metrics?: { label:string; value:string; delta?:string; trend?:"up"|"down"|"flat" }[];
  table?: { headers:string[]; rows:string[][] };
  chart?: { type:"bar"; labels:string[]; values:number[]; colors?:string[] };
}
interface AIMessage {
  role: "user"|"assistant";
  blocks?: Block[];
  userText?: string;
  ts: number;
  id: number;
}

const BS: Record<string,{color:string;bg:string;border:string}> = {
  action:      {color:"#60a5fa",bg:"rgba(96,165,250,0.06)",  border:"rgba(96,165,250,0.16)"},
  pattern:     {color:"#a78bfa",bg:"rgba(167,139,250,0.06)", border:"rgba(167,139,250,0.16)"},
  hooks:       {color:"#06b6d4",bg:"rgba(6,182,212,0.06)",   border:"rgba(6,182,212,0.16)"},
  warning:     {color:"#fbbf24",bg:"rgba(251,191,36,0.06)",  border:"rgba(251,191,36,0.16)"},
  insight:     {color:"#34d399",bg:"rgba(52,211,153,0.06)",  border:"rgba(52,211,153,0.16)"},
  off_topic:   {color:"rgba(255,255,255,0.25)",bg:"rgba(255,255,255,0.02)",border:"rgba(255,255,255,0.10)"},
  navigate:    {color:"#60a5fa",bg:"rgba(96,165,250,0.04)",  border:"rgba(96,165,250,0.18)"},
  tool_call:   {color:"#a78bfa",bg:"rgba(167,139,250,0.06)", border:"rgba(167,139,250,0.18)"},
  dashboard:   {color:"#0ea5e9",bg:"rgba(14,165,233,0.04)",  border:"rgba(14,165,233,0.15)"},
  meta_action: {color:"#fb923c",bg:"rgba(251,146,60,0.06)",  border:"rgba(251,146,60,0.2)"},
};

// ── InlineToolPanel (from LoopV2) ──────────────────────────────────────────────
function InlineToolPanel({ action, onClose, onSend, lang }: {
  action: string; onClose: () => void; onSend: (msg: string) => void; lang: string;
}) {
  const [val, setVal] = useState("");
  const [platform, setPlatform] = useState("meta");
  const [tone, setTone] = useState("direct");

  const config: Record<string, any> = {
    hooks: {
      icon: "⚡", color: "#06b6d4",
      title: { en: "Generate Hooks", pt: "Gerar Hooks", es: "Generar Hooks" },
      placeholder: { en: "Describe product, angle, or paste context…", pt: "Descreva o produto, ângulo, ou cole o contexto…", es: "Describe el producto, ángulo, o pega el contexto…" },
      cta: { en: "Generate 5 hooks →", pt: "Gerar 5 hooks →", es: "Generar 5 hooks →" },
      buildMsg: (v: string, p: string, t: string) => `Generate 5 high-converting ${t} ad hooks for ${p}: "${v}". Format: [N]. [Hook text]. Include hook type label.`,
    },
    script: {
      icon: "✍️", color: "#34d399",
      title: { en: "Write Script", pt: "Escrever Roteiro", es: "Escribir Guión" },
      placeholder: { en: "What's the ad about? Paste brief or context…", pt: "Sobre o que é o anúncio? Cole o brief ou contexto…", es: "¿De qué trata el anuncio? Pega el brief o contexto…" },
      cta: { en: "Write script →", pt: "Escrever roteiro →", es: "Escribir guión →" },
      buildMsg: (v: string, p: string, t: string) => `Write a complete ${t} video ad script for ${p}: "${v}". Format per scene: VO | ON-SCREEN | VISUAL. Strong hook in first 3s.`,
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
  const submit = () => { if(val.trim()){onSend(cfg.buildMsg(val.trim(),platform,tone));onClose();}};

  return (
    <div style={{borderRadius:16,overflow:"hidden",border:`1px solid ${cfg.color}22`,background:`linear-gradient(135deg,${cfg.color}07 0%,rgba(10,12,20,0.98) 100%)`,margin:"0 0 12px",animation:"toolSlideIn 0.22s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px 10px",borderBottom:`1px solid ${cfg.color}15`}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:15}}>{cfg.icon}</span>
          <span style={{...j,fontSize:13,fontWeight:700,color:"#fff"}}>{cfg.title[l]}</span>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:15,display:"flex",padding:4}}>
          <X size={14}/>
        </button>
      </div>
      <div style={{padding:"12px 16px 14px",display:"flex",flexDirection:"column",gap:10}}>
        {action!=="competitor"&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{display:"flex",gap:4}}>
              {["meta","tiktok","google"].map(p=>(
                <button key={p} onClick={()=>setPlatform(p)}
                  style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,border:"none",cursor:"pointer",...j,background:platform===p?cfg.color:"rgba(255,255,255,0.05)",color:platform===p?"#000":"rgba(255,255,255,0.4)",transition:"all 0.1s"}}>
                  {p.charAt(0).toUpperCase()+p.slice(1)}
                </button>
              ))}
            </div>
            <div style={{width:1,height:16,background:"rgba(255,255,255,0.08)"}}/>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {tones.map(t=>(
                <button key={t} onClick={()=>setTone(t)}
                  style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,border:"none",cursor:"pointer",...j,background:tone===t?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.03)",color:tone===t?"#fff":"rgba(255,255,255,0.3)",transition:"all 0.1s"}}>
                  {toneLabels[t][l]}
                </button>
              ))}
            </div>
          </div>
        )}
        <textarea value={val} onChange={e=>setVal(e.target.value)} placeholder={cfg.placeholder[l]} rows={3} autoFocus
          style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:10,padding:"10px 12px",color:"#fff",fontSize:13,lineHeight:1.6,resize:"none",outline:"none",...m,caretColor:cfg.color,boxSizing:"border-box"}}
          onFocus={e=>{e.currentTarget.style.borderColor=`${cfg.color}45`;}}
          onBlur={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.09)";}}
          onKeyDown={e=>{if(e.key==="Enter"&&e.metaKey)submit();}}
        />
        <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8}}>
          <span style={{...m,fontSize:10,color:"rgba(255,255,255,0.18)"}}>⌘↵</span>
          <button onClick={submit} disabled={!val.trim()}
            style={{padding:"8px 18px",borderRadius:10,fontSize:13,fontWeight:700,background:val.trim()?`linear-gradient(135deg,${cfg.color},${cfg.color}bb)`:"rgba(255,255,255,0.05)",color:val.trim()?"#000":"rgba(255,255,255,0.25)",border:"none",cursor:val.trim()?"pointer":"not-allowed",...j,transition:"all 0.15s"}}>
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
        <div style={{width:26,height:26,borderRadius:7,background:"linear-gradient(135deg,#0ea5e9,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <BarChart2 size={12} color="#000"/>
        </div>
        <p style={{...j,fontSize:12,fontWeight:700,color:"#fff",flex:1,margin:0}}>{block.title}</p>
        <span style={{...m,fontSize:10,color:"rgba(14,165,233,0.5)",letterSpacing:"0.12em"}}>LIVE DATA</span>
      </div>
      {block.metrics && block.metrics.length>0 && (
        <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:"1px",background:"rgba(255,255,255,0.04)"}}>
          {block.metrics.map((metric,i)=>{
            const isUp=metric.trend==="up",isDown=metric.trend==="down";
            const mc=isDown?"#f87171":isUp?"#34d399":"#e2e8f0";
            return(
              <div key={i} style={{padding:"16px 18px",background:"#181e2d",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:`radial-gradient(circle,${mc}10,transparent 65%)`,pointerEvents:"none"}}/>
                <p style={{...m,fontSize:11,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>{metric.label}</p>
                <p style={{...j,fontSize:28,fontWeight:900,color:mc,letterSpacing:"-0.04em",lineHeight:1,marginBottom:6}}>{metric.value}</p>
                {metric.delta&&(
                  <div style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 7px",borderRadius:5,background:isDown?"rgba(248,113,113,0.1)":isUp?"rgba(52,211,153,0.1)":"rgba(255,255,255,0.05)",border:`1px solid ${isDown?"rgba(248,113,113,0.2)":isUp?"rgba(52,211,153,0.2)":"rgba(255,255,255,0.10)"}`}}>
                    {isDown?<TrendingDown size={9} color="#f87171"/>:isUp?<TrendingUp size={9} color="#34d399"/>:null}
                    <span style={{...m,fontSize:10,fontWeight:600,color:isDown?"#f87171":isUp?"#34d399":"rgba(255,255,255,0.4)"}}>{metric.delta}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {block.chart&&block.chart.type==="bar"&&(
        <div style={{padding:"14px 16px",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
          {block.chart.labels.map((label,i)=>{
            const max=Math.max(...block.chart!.values);
            const pct=max>0?(block.chart!.values[i]/max)*100:0;
            const color=block.chart!.colors?.[i]||"#0ea5e9";
            return(
              <div key={i} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{...m,fontSize:11,color:"rgba(255,255,255,0.6)"}}>{label}</span>
                  <span style={{...j,fontSize:11,fontWeight:700,color:"#fff"}}>{block.chart!.values[i]}</span>
                </div>
                <div style={{height:6,background:"rgba(255,255,255,0.05)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${color},${color}99)`,borderRadius:3}}/>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {block.table&&(
        <div style={{overflowX:"auto",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"rgba(255,255,255,0.02)"}}>
              {block.table.headers.map((h,i)=>(
                <th key={i} style={{...m,fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.28)",textAlign:"left",padding:"8px 14px",letterSpacing:"0.1em",textTransform:"uppercase",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>{h}</th>
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
      confirm:"Yes, proceed",cancel:"Cancel",running:"Executing...",done:"Done ✓",
      pause:"Pause",enable:"Activate",update_budget:"Update budget",publish:"Publish",duplicate:"Duplicate",
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
      <div style={{padding:"14px 16px 10px",borderBottom:"1px solid rgba(251,146,60,0.12)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span style={{fontSize:20}}>{icon}</span>
          <p style={{...j,fontSize:13,fontWeight:800,color:"#fb923c",margin:0}}>{block.title}</p>
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
        <p style={{...m,fontSize:11,color:"rgba(251,146,60,0.6)",margin:0}}>⚠️ {t.warning}</p>
      </div>
      {/* Buttons */}
      <div style={{padding:"12px 16px",display:"flex",gap:8}}>
        <button onClick={async()=>{
          setState("running");
          await onConfirm(block);
          setResult(`${actionLabel}${target?` — ${target}`:""} executado com sucesso`);
          setState("done");
        }} disabled={state==="running"}
          style={{...j,fontSize:13,fontWeight:700,padding:"10px 20px",borderRadius:10,background:state==="running"?"rgba(251,146,60,0.3)":"linear-gradient(135deg,#fb923c,#f97316)",color:state==="running"?"#fb923c":"#000",border:state==="running"?"1px solid rgba(251,146,60,0.3)":"none",cursor:state==="running"?"wait":"pointer",display:"flex",alignItems:"center",gap:6,flex:1,justifyContent:"center"}}>
          {state==="running"?<><Loader2 size={13} className="animate-spin"/>{t.running}</>:t.confirm}
        </button>
        <button onClick={()=>setState("cancelled")}
          style={{...m,fontSize:12,padding:"10px 16px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontWeight:500}}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}

// ── Block card ────────────────────────────────────────────────────────────────
function BlockCard({block,lang,onNavigate}:{block:Block;lang:string;onNavigate:(r:string,p?:Record<string,string>)=>void}) {
  const s=BS[block.type]||BS.insight;
  const [open,setOpen]=useState(true);
  const [copiedIdx,setCopiedIdx]=useState<number|null>(null);
  const ICONS: Record<string,string>={action:"🎯",pattern:"📊",hooks:"⚡",warning:"⚠️",insight:"📈",navigate:"→",tool_call:"⚡",off_topic:"🚫"};

  const copyItem=(text:string,idx:number)=>{
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(()=>setCopiedIdx(null),1800);
  };

  const useAsScript=(text:string)=>{
    onNavigate("/dashboard/script",{product:text.slice(0,120)});
  };

  if(block.type==="navigate") return(
    <div style={{borderRadius:14,border:`1px solid ${s.border}`,background:s.bg,marginBottom:8,padding:"12px 14px"}}>
      <p style={{...j,fontSize:12,fontWeight:700,color:s.color,marginBottom:5}}>{block.title}</p>
      {block.content&&<p style={{...m,fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.6,marginBottom:10}}>{block.content}</p>}
      <button onClick={()=>onNavigate(block.route!,block.params)}
        style={{...j,fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:10,background:"rgba(96,165,250,0.15)",color:s.color,border:`1px solid ${s.border}`,cursor:"pointer"}}>
        {block.cta||"Open →"}
      </button>
    </div>
  );

  const isHooks = block.type === "hooks";

  return(
    <div style={{borderRadius:14,border:`1px solid ${s.border}`,background:s.bg,overflow:"hidden",marginBottom:8}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"11px 14px",background:"none",border:"none",cursor:"pointer"}}>
        <span style={{fontSize:14,flexShrink:0}}>{ICONS[block.type]||"•"}</span>
        <span style={{...j,flex:1,fontSize:12,fontWeight:700,color:s.color,textAlign:"left"}}>{block.title}</span>
        <span style={{...m,fontSize:10,color:s.color,opacity:0.6}}>{open?"▲":"▼"}</span>
      </button>
      {open&&(
        <div style={{padding:"0 14px 12px"}}>
          {block.content&&<p style={{...m,fontSize:13,color:"rgba(255,255,255,0.68)",lineHeight:1.7,marginBottom:block.items?.length?8:0}}>{block.content}</p>}
          {block.items?.map((item,i)=>(
            <div key={i} style={{display:"flex",gap:9,marginBottom:7,padding:"9px 12px",borderRadius:9,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.05)",alignItems:"flex-start"}}>
              <span style={{color:s.color,fontSize:11,marginTop:3,flexShrink:0,fontWeight:700}}>{i+1}.</span>
              <span style={{...m,fontSize:13,color:"#d4d8e8",lineHeight:1.6,flex:1}}>{item}</span>
              {isHooks&&(
                <div style={{display:"flex",gap:4,flexShrink:0,marginTop:1}}>
                  <button onClick={()=>copyItem(item,i)}
                    style={{display:"flex",alignItems:"center",gap:3,padding:"3px 8px",borderRadius:6,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",cursor:"pointer",fontSize:10,color:copiedIdx===i?"#34d399":"rgba(255,255,255,0.35)",...m,transition:"all 0.12s"}}>
                    <Copy size={9}/>{copiedIdx===i?(lang==="pt"?"✓":lang==="es"?"✓":"✓"):(lang==="pt"?"Copiar":lang==="es"?"Copiar":"Copy")}
                  </button>
                  <button onClick={()=>useAsScript(item)}
                    style={{display:"flex",alignItems:"center",gap:3,padding:"3px 8px",borderRadius:6,background:`${s.color}10`,border:`1px solid ${s.color}25`,cursor:"pointer",fontSize:10,color:s.color,...m,transition:"all 0.12s"}}>
                    {lang==="pt"?"→ Roteiro":lang==="es"?"→ Guión":"→ Script"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

// ── Proactive Block — first message from the AI when chat opens ──────────────
function ProactiveBlock({ block, lang, onSend }: { block: Block; lang: string; onSend: (s: string) => void }) {
  const F = "'Plus Jakarta Sans', sans-serif";
  const M = "'Inter', sans-serif";
  const hour = new Date().getHours();
  const timeEmoji = hour < 12 ? "🌅" : hour < 18 ? "☀️" : "🌙";

  const quickActions: Record<string, string[][]> = {
    pt: [["📊","Resumo da conta"],["⚡","Gerar hooks"],["✍️","Escrever roteiro"],["🎯","O que pausar?"]],
    es: [["📊","Resumen de cuenta"],["⚡","Generar hooks"],["✍️","Escribir guión"],["🎯","¿Qué pausar?"]],
    en: [["📊","Account summary"],["⚡","Generate hooks"],["✍️","Write script"],["🎯","What to pause?"]],
  };
  const actions = quickActions[lang] || quickActions.pt;


  return (
    <div style={{ maxWidth: 680, margin: "0 auto 8px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(14,165,233,0.6)", flexShrink: 0 }}/>
        <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: "rgba(238,240,246,0.85)", letterSpacing: "-0.01em" }}>{block.title}</span>
      </div>
      {/* Message */}
      <div style={{ paddingLeft: 40 }}>
        <p style={{ fontFamily: M, fontSize: 13.5, color: "rgba(238,240,246,0.78)", lineHeight: 1.72, margin: "0 0 14px" }}>
          {block.content}
        </p>
        {/* Quick action pills */}
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
          {actions.map(([emoji, label], i) => (
            <button key={i} onClick={() => onSend(label)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer", fontFamily: M, fontSize: 12, color: "rgba(238,240,246,0.55)", transition: "all 0.13s", whiteSpace: "nowrap" as const }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(14,165,233,0.08)"; e.currentTarget.style.borderColor = "rgba(14,165,233,0.25)"; e.currentTarget.style.color = "#eef0f6"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "rgba(238,240,246,0.55)"; }}>
              <span style={{ fontSize: 12 }}>{emoji}</span>{label}
            </button>
          ))}

        </div>
      </div>
    </div>
  );
}

// ── Dashboard Offer Block ─────────────────────────────────────────────────────
function DashboardOfferBlock({ block, lang, onConfirm }: { block: Block; lang: string; onConfirm: (msg: string) => void }) {
  const F = "'Plus Jakarta Sans', sans-serif";
  const M = "'Inter', sans-serif";
  const [loading, setLoading] = useState(false);

  const handleConfirm = () => {
    setLoading(true);
    onConfirm(`[DASHBOARD_CONFIRMED] ${block.original_message || "gerar dashboard"}`);
  };

  const labels: Record<string, Record<string, string>> = {
    pt: { confirm: "Gerar dashboard", cancel: "Agora não", remaining: "restantes este mês" },
    es: { confirm: "Generar dashboard", cancel: "Ahora no", remaining: "restantes este mes" },
    en: { confirm: "Generate dashboard", cancel: "Not now", remaining: "remaining this month" },
  };
  const t = labels[lang] || labels.pt;

  return (
    <div style={{ borderRadius: 14, border: "1px solid rgba(14,165,233,0.25)", background: "rgba(14,165,233,0.05)", padding: "16px 18px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>📊</span>
        <p style={{ fontFamily: F, fontSize: 13, fontWeight: 800, color: "#eef0f6", margin: 0 }}>{block.title}</p>
      </div>
      <p style={{ fontFamily: M, fontSize: 12, color: "rgba(238,240,246,0.65)", lineHeight: 1.65, margin: "0 0 14px" }}>{block.content}</p>
      {typeof block.remaining === "number" && block.remaining <= 3 && (
        <p style={{ fontFamily: M, fontSize: 11, color: block.remaining === 0 ? "#f87171" : "#fbbf24", marginBottom: 12 }}>
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
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200 }} onClick={onClose} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 201, width: 360, background: "#131720", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "28px 24px", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>
        <div style={{ fontSize: 36, marginBottom: 14, textAlign: "center" }}>📊</div>
        <p style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: "#eef0f6", textAlign: "center", margin: "0 0 10px" }}>{m.title}</p>
        <p style={{ fontFamily: M, fontSize: 13, color: "rgba(238,240,246,0.55)", lineHeight: 1.65, textAlign: "center", margin: "0 0 22px" }}>{m.sub}</p>
        <button onClick={() => { navigate("/dashboard/ai"); onClose(); setTimeout(() => navigate("/pricing"), 50); }}
          style={{ width: "100%", padding: "12px", borderRadius: 12, background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", border: "none", cursor: "pointer", fontFamily: F, fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 10 }}>
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

export default function AdBriefAI() {
  const {user,selectedPersona,setSelectedPersona}=useOutletContext<DashboardContext>();
  const {language}=useLanguage();
  const lang=(["pt","es"].includes(language)?language:"en") as "pt"|"es"|"en";
  const navigate=useNavigate();
  const SK="adbrief_ai_v4";

  const [messages,setMessages]=useState<AIMessage[]>(()=>{try{return JSON.parse(sessionStorage.getItem(SK)||"[]")}catch{return[]}});
  const [accountAlerts,setAccountAlerts]=useState<any[]>([]);
  const [alertsDismissing,setAlertsDismissing]=useState<Set<string>>(new Set());
  const [greetingKey,setGreetingKey]=useState(0);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [contextReady,setContextReady]=useState(false);
  const [context,setContext]=useState("");
  const [connections,setConnections]=useState<string[]>([]);
  const [connectingId,setConnectingId]=useState<string|null>(null);
  const [feedback,setFeedback]=useState<Record<number,"like"|"dislike"|null>>({});
  const [copiedId,setCopiedId]=useState<number|null>(null);
  const [activeTool,setActiveTool]=useState<string|null>(null);
  const [msgCounter,setMsgCounter]=useState(0);
  const [showUpgradeWall,setShowUpgradeWall]=useState(false);
  const [showDashboardLimit,setShowDashboardLimit]=useState(false);
  const [proactiveLoading,setProactiveLoading]=useState(false);
  const proactiveFired=useRef(false);
  const bottomRef=useRef<HTMLDivElement>(null);
  const textareaRef=useRef<HTMLTextAreaElement>(null);

  // Load connections — scoped to selected account, fallback to global
  useEffect(()=>{
    if(!user?.id){setConnections([]);return;}
    const pid=selectedPersona?.id||null;
    // Don't clear connections immediately if no persona — wait for persona to load
    // This prevents the flash of "Connect Meta" screen
    if(!pid) return; // leave connections as-is until persona resolves
    // Check specific connection for this account, then fall back to global (null)
    Promise.all([
      supabase.from("platform_connections" as any).select("platform,status").eq("user_id",user.id).eq("persona_id",pid),
      supabase.from("platform_connections" as any).select("platform,status").eq("user_id",user.id).is("persona_id",null),
    ]).then(([specific,global])=>{
      const s=((specific.data||[]) as any[]).filter(c=>c.status==="active").map(c=>c.platform);
      const g=((global.data||[]) as any[]).filter(c=>c.status==="active").map(c=>c.platform);
      // specific takes priority; merge with globals not already covered by specific
      setConnections([...new Set([...s,...g])]);
    });
  },[user?.id,selectedPersona?.id]);

  // Proactive greeting — fires when connections are known (after context is ready)
  useEffect(()=>{
    if(!contextReady || proactiveFired.current) return;
    if(!lang) return;
    if(!user?.id) return;
    // Wait a tick to let connections settle
    const timer = setTimeout(()=>{
      const today = new Date().toISOString().split("T")[0];
      const pid = selectedPersona?.id || null;
      (supabase as any).from("daily_snapshots")
        .select("date,total_spend,avg_ctr,active_ads,winners_count,losers_count,yesterday_ctr,ai_insight,top_ads,raw_period")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r:any)=>{
          const snap = r.data;
          const hasMetaConn = connections.includes("meta");
          if(!snap && hasMetaConn){
            // Has Meta but no snapshot yet — run intelligence first
            supabase.functions.invoke("daily-intelligence",{body:{user_id:user.id,persona_id:pid}})
              .then(()=>{
                (supabase as any).from("daily_snapshots")
                  .select("date,total_spend,avg_ctr,active_ads,winners_count,losers_count,yesterday_ctr,ai_insight,top_ads,raw_period")
                  .eq("user_id",user.id).order("date",{ascending:false}).limit(1).maybeSingle()
                  .then((r2:any)=>{ if(!proactiveFired.current) triggerProactiveGreeting(r2.data, hasMetaConn); })
                  .catch(()=>{ if(!proactiveFired.current) triggerProactiveGreeting(null, hasMetaConn); });
              })
              .catch(()=>{ if(!proactiveFired.current) triggerProactiveGreeting(null, hasMetaConn); });
          } else {
            if(!proactiveFired.current) triggerProactiveGreeting(snap, hasMetaConn);
          }
        }).catch(()=>{ if(!proactiveFired.current) triggerProactiveGreeting(null, connections.includes("meta")); });
    }, 300); // 300ms — let connections settle
    return () => clearTimeout(timer);
  },[contextReady, connections.length, user?.id, greetingKey]);

  // Load context
  useEffect(()=>{
    if(!user?.id)return;
    (async()=>{
      const[analysesRes,patternsRes,personaRes,entriesRes]=await Promise.all([
        supabase.from("analyses").select("id,title,created_at,result,hook_strength,recommended_platforms").eq("user_id",user.id).order("created_at",{ascending:false}).limit(200),
        (supabase as any).from("learned_patterns").select("pattern_key,avg_ctr,avg_roas,confidence,is_winner,insight_text").eq("user_id",user.id).order("confidence",{ascending:false}).limit(50),
        supabase.from("personas").select("name,result").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
        (supabase as any).from("creative_entries").select("filename,market,editor,ctr,roas").eq("user_id",user.id).order("ctr",{ascending:false}).limit(500),
      ]);
      const analyses=(analysesRes.data||[]).map((a:any)=>{const r=a.result as any||{};return`[${a.id.slice(0,8)}] ${a.title||"Untitled"} | score:${r.hook_score??""} | type:${r.hook_type??""} | market:${r.market_guess??""} | strength:${a.hook_strength??""} | date:${a.created_at?.slice(0,10)}`;}).join("\n");
      const patterns=(patternsRes.data||[]).map((p:any)=>`${p.is_winner?"✓":"✗"} ${p.pattern_key} | CTR:${p.avg_ctr?.toFixed(3)} | ROAS:${p.avg_roas?.toFixed(2)} | conf:${p.confidence}`).join("\n");
      const persona=(()=>{if(!personaRes.data)return"No active persona";const r=personaRes.data.result as any||{};return`Name:${personaRes.data.name}|Age:${r.age_range}|Pain:${(r.pain_points||[]).slice(0,3).join(",")}|Platforms:${(r.platforms||[]).join("+")}`})();
      const entries=entriesRes.data||[];
      const byEd: Record<string,{ctr:number[],roas:number[],n:number}>={};
      entries.forEach((e:any)=>{if(e.editor){if(!byEd[e.editor])byEd[e.editor]={ctr:[],roas:[],n:0};byEd[e.editor].n++;if(e.ctr)byEd[e.editor].ctr.push(e.ctr);if(e.roas)byEd[e.editor].roas.push(e.roas);}});
      const edSummary=Object.entries(byEd).map(([ed,d])=>`${ed}:n=${d.n}|avgCTR=${d.ctr.length?(d.ctr.reduce((a,b)=>a+b)/d.ctr.length).toFixed(3):"?"}|avgROAS=${d.roas.length?(d.roas.reduce((a,b)=>a+b)/d.roas.length).toFixed(2):"?"}`).join("\n");
      setContext(`=== PERSONA ===\n${persona}\n\n=== ANALYSES (${(analysesRes.data||[]).length}) ===\n${analyses||"None"}\n\n=== PATTERNS ===\n${patterns||"None"}\n\n=== EDITORS ===\n${edSummary||"None"}`);
      setContextReady(true);
      // Proactive greeting now fires from the connections useEffect (after connections load)
    })();
  },[user?.id]);

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
      sessionStorage.setItem(SK,JSON.stringify(toSave));
    }catch{}
  },[messages]);

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
            if(fn==="generate-hooks"&&data?.hooks?.length){
              nb[bi]={type:"hooks",title:lang==="pt"?"Hooks gerados":lang==="es"?"Hooks generados":"Generated hooks",content:"",items:data.hooks.map((h:any)=>typeof h==="string"?h:h.hook||h.text||JSON.stringify(h))};
              // Capture learning — fire and forget
              if(user?.id){
                supabase.functions.invoke("capture-learning",{body:{
                  user_id:user.id,event_type:"hooks_generated",
                  data:{ hooks:data.hooks, product:params.product, niche:params.niche, market:params.market, platform:params.platform, tone:params.tone, context:params.context }
                }}).catch(()=>{});
              }
            }else if(fn==="generate-script"&&(data?.script||data?.content)){
              nb[bi]={type:"insight",title:lang==="pt"?"Roteiro":"Script",content:data.script||data.content};
            }else if(fn==="generate-brief"&&(data?.brief||data?.content)){
              nb[bi]={type:"insight",title:"Brief",content:data.brief||data.content};
            }else{
              nb[bi]={type:"warning",title:"Sem resultado",content:lang==="pt"?"Tente novamente com mais contexto.":"Try again with more context."};
            }
            return{...m,blocks:nb};
          }));
        }catch(e){
          executedTools.current.delete(execKey);
          setMessages(prev=>prev.map(m=>{
            if(m.id!==msg.id)return m;
            const nb=[...(m.blocks||[])];
            nb[bi]={type:"warning",title:"Falha",content:String((e as any)?.message||"Error")};
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
  const triggerProactiveGreeting = async (snapshot: any, hasMetaConn?: boolean) => {
    if (proactiveFired.current) return;
    proactiveFired.current = true;

    // Returning user with real conversation history — don't interrupt
    const existing = (() => { try { return JSON.parse(sessionStorage.getItem(SK) || "[]"); } catch { return []; } })();
    const hasRealHistory = existing.some((m: any) => m.role === "user");
    if (hasRealHistory) return;

    setProactiveLoading(true);
    try {
      const today = new Date();
      const hour = today.getHours();
      const greeting = lang === "pt"
        ? hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"
        : lang === "es" ? (hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches")
        : (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

      let proactiveMsg = "";

      if (snapshot && snapshot.total_spend > 0) {
        // ── Meta conectado com campanhas ativas ───────────────────────────────
        const topAds = (snapshot.top_ads || []) as any[];
        const toScale = topAds.filter((a: any) => a.isScalable).slice(0, 2);
        const toPause = topAds.filter((a: any) => a.needsPause).slice(0, 1);
        const fatigued = topAds.filter((a: any) => a.isFatigued).slice(0, 1);
        const ctrDelta = snapshot.yesterday_ctr > 0 && snapshot.avg_ctr > 0
          ? ((snapshot.avg_ctr - snapshot.yesterday_ctr) / snapshot.yesterday_ctr * 100) : null;

        const parts: string[] = [];
        if (lang === "pt") {
          parts.push(`${greeting}. Analisei sua conta — R$${snapshot.total_spend?.toFixed(0)} gastos esta semana, CTR médio ${(snapshot.avg_ctr * 100)?.toFixed(2)}%.`);
          if (ctrDelta !== null) parts.push(`CTR ${ctrDelta > 0 ? "↑" : "↓"} ${Math.abs(ctrDelta).toFixed(1)}% vs semana anterior.`);
          if (toScale.length) parts.push(`"${toScale[0].name?.slice(0, 40)}" está com CTR ${(toScale[0].ctr*100)?.toFixed(2)}% — bom candidato para escalar.`);
          if (toPause.length) parts.push(`"${toPause[0].name?.slice(0, 40)}" CTR ${(toPause[0].ctr*100)?.toFixed(2)}%, R$${toPause[0].spend?.toFixed(0)} gastos — considere pausar.`);
          if (fatigued.length) parts.push(`"${fatigued[0].name?.slice(0, 40)}" freq. ${fatigued[0].frequency?.toFixed(1)}x — fadiga criativa, troque o criativo.`);
          if (snapshot.ai_insight) parts.push(snapshot.ai_insight);
          parts.push("O que quer fazer?");
        } else if (lang === "es") {
          parts.push(`${greeting}. Analicé tu cuenta — $${snapshot.total_spend?.toFixed(0)} gastados esta semana, CTR ${(snapshot.avg_ctr*100)?.toFixed(2)}%.`);
          if (toScale.length) parts.push(`"${toScale[0].name?.slice(0,40)}" CTR ${(toScale[0].ctr*100)?.toFixed(2)}% — buen candidato para escalar.`);
          if (toPause.length) parts.push(`"${toPause[0].name?.slice(0,40)}" CTR ${(toPause[0].ctr*100)?.toFixed(2)}% — considera pausarlo.`);
          parts.push("¿Qué quieres hacer?");
        } else {
          parts.push(`${greeting}. Checked your account — $${snapshot.total_spend?.toFixed(0)} spent this week, ${(snapshot.avg_ctr*100)?.toFixed(2)}% avg CTR.`);
          if (toScale.length) parts.push(`"${toScale[0].name?.slice(0,40)}" at ${(toScale[0].ctr*100)?.toFixed(2)}% CTR — good candidate to scale.`);
          if (toPause.length) parts.push(`"${toPause[0].name?.slice(0,40)}" at ${(toPause[0].ctr*100)?.toFixed(2)}% CTR spending $${toPause[0].spend?.toFixed(0)} — consider pausing.`);
          parts.push("What do you want to do?");
        }
        proactiveMsg = parts.join(" ");

      } else if (snapshot) {
        // ── Meta conectado mas sem campanhas ativas — usa histórico disponível ─
        const histSpend = (snapshot.total_spend || 0) > 0;
        const hasWinners = (snapshot.winners_count || 0) > 0;
        const toPause = (snapshot.losers_count || 0);
        if (lang === "pt") {
          proactiveMsg = histSpend
            ? `${greeting}. Nenhuma campanha ativa essa semana, mas tenho seu histórico: R$${snapshot.total_spend?.toFixed(0)} analisados${hasWinners ? `, ${snapshot.winners_count} criativos vencedores identificados` : ""}${toPause ? `, ${toPause} com baixa performance` : ""}. Quer subir algo novo ou revisamos o que funcionou antes?`
            : `${greeting}. Meta conectado. Sem dados essa semana ainda — quer gerar hooks, escrever um roteiro ou fazer preflight de um criativo?`;
        } else if (lang === "es") {
          proactiveMsg = histSpend
            ? `${greeting}. Sin campañas activas esta semana, pero tengo tu historial: $${snapshot.total_spend?.toFixed(0)} analizados${hasWinners ? `, ${snapshot.winners_count} creativos ganadores` : ""}. ¿Lanzamos algo nuevo o revisamos lo que funcionó?`
            : `${greeting}. Meta conectado. Sin datos esta semana — ¿genero hooks, escribo un guión o hago preflight?`;
        } else {
          proactiveMsg = histSpend
            ? `${greeting}. No active campaigns this week, but I have your history: $${snapshot.total_spend?.toFixed(0)} analyzed${hasWinners ? `, ${snapshot.winners_count} winning creatives on file` : ""}${toPause ? `, ${toPause} underperformers flagged` : ""}. Want to launch something new or review what worked?`
            : `${greeting}. Meta connected. No data this week yet — want to generate hooks, write a script, or preflight a creative?`;
        }

      } else if (hasMetaConn) {
        // ── Meta conectado mas sem campanhas ─────────────────────────────────
        proactiveMsg = lang === "pt"
          ? `${greeting}. Sua conta Meta Ads está conectada, mas não encontrei campanhas com dados nos últimos 7 dias. Você tem campanhas pausadas que quer reativar? Ou quer criar novos criativos?`
          : lang === "es"
          ? `${greeting}. Tu cuenta Meta Ads está conectada pero no encontré campañas activas en los últimos 7 días. ¿Tienes campañas pausadas? ¿Quieres crear nuevos creativos?`
          : `${greeting}. Your Meta Ads account is connected but I found no active campaigns in the last 7 days. Do you have paused campaigns to reactivate?`;
      } else {
        // ── Sem Meta conectado ────────────────────────────────────────────────
        proactiveMsg = lang === "pt"
          ? `${greeting}. Para eu trabalhar de verdade preciso ver sua conta Meta Ads — sem isso só consigo respostas genéricas que não ajudam. Conecte e vejo CTR, spend, o que escalar e o que pausar em tempo real.`
          : lang === "es"
          ? `${greeting}. Para trabajar bien necesito ver tu cuenta Meta Ads. Conéctala y veo CTR, spend, qué escalar y qué pausar en tiempo real.`
          : `${greeting}. To work properly I need to see your Meta Ads account. Connect it and I'll analyze CTR, spend, what to scale and what to pause in real time.`;
      }

      // Remove greeting from content if it starts with it (avoids duplicate)
      const cleanMsg = proactiveMsg.startsWith(greeting)
        ? proactiveMsg.slice(greeting.length).replace(/^[.,!]\s*/, "").trim()
        : proactiveMsg;

      const aid = Date.now() + 1;
      setMessages([{
        role: "assistant",
        blocks: [{ type: "proactive" as any, title: greeting, content: cleanMsg }],
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
    setConnectingId(id);
    try{const{data}=await supabase.functions.invoke(fn,{body:{action:"get_auth_url",user_id:user.id,persona_id:selectedPersona.id}});if(data?.url)window.location.href=data.url;}
    catch{setConnectingId(null);}
  };

  const executeMetaAction=async(block:Block)=>{
    const{data,error}=await supabase.functions.invoke("meta-actions",{
      body:{action:block.meta_action,user_id:user.id,target_id:block.target_id,target_type:block.target_type,value:block.value}
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
      const id=Date.now();
      setMessages(prev=>[...prev,{role:"assistant",id,ts:id,blocks:[{type:"dashboard",title:lang==="pt"?"Campanhas":"Campaigns",table:{headers:[lang==="pt"?"Nome":"Name","Status",lang==="pt"?"Orçamento":"Budget","ID"],rows}}]}]);
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
        data:{ blocks, feedback:type, message_text:msg?.userText||"" }
      }}).catch(()=>{});
    }
  };

  const send=async(text?:string)=>{
    let msg=(text??input).trim();
    if(!msg||loading||!contextReady)return;

    // ── Intercept Telegram intent — check status first, respond accurately ──
    if (/telegram/i.test(msg) && user?.id) {
      const uid = Date.now();
      setMessages(prev=>[...prev,{role:"user",id:uid,ts:uid,userText:msg}]);
      setInput("");
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
    setMsgCounter(c=>c+1);
    setMessages(prev=>[...prev,{role:"user",userText:msg,ts:uid,id:uid}]);
    setLoading(true);
    try{
      const history=messages.slice(-12).map(m=>m.role==="user"?{role:"user" as const,content:m.userText||""}:{role:"assistant" as const,content:JSON.stringify(m.blocks||[])});
      const{data,error}=await supabase.functions.invoke("adbrief-ai-chat",{body:{message:msg,context,user_id:user.id,persona_id:selectedPersona?.id||null,user_language:lang,history}});
      if(error||!data?.blocks)throw new Error(error?.message||"No response");

      // Show upgrade popup on daily limit
      if(data?.error==="daily_limit"){setShowUpgradeWall(true);setLoading(false);return;}
      if(data?.error==="dashboard_limit"){setShowDashboardLimit(true);setLoading(false);return;}

      // Strip all markdown from text fields
      const stripMd=(s:string)=>String(s)
        .replace(/\*\*(.*?)\*\*/g,"$1").replace(/\*(.*?)\*/g,"$1")
        .replace(/#+\s/g,"").replace(/^\d+\.\s/gm,"").replace(/^[-*]\s/gm,"").trim();

      let blocks:Block[]=Array.isArray(data.blocks)?data.blocks:[{type:"insight",title:"Response",content:String(data.blocks)}];
      const isDashReq=msg.includes("[DASHBOARD]")||msg.toLowerCase().includes("dashboard");

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
          "insight": "Análise",
          "action": "Ação recomendada",
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
          "insight": "Análisis",
          "action": "Acción recomendada",
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
          "insight": "Analysis",
          "action": "Recommended action",
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
          title:b.title?translateTitle(stripMd(b.title), b.type):b.title,
          content:b.content?stripMd(b.content):b.content,
          items:b.items?.map((it:string)=>stripMd(it)),
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
            product:"iGaming", niche:"iGaming",
            market:lang.toUpperCase()||"BR",
            platform:"Meta Feed",
            tone:"Aggressive / Urgent",
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
        // Execute hooks/script/brief tool_calls inline — fire and replace
        if(c.type==="tool_call"&&["hooks","script","brief"].includes(c.tool||"")){
          const p=c.tool_params||{};
          const fn=c.tool==="hooks"?"generate-hooks":c.tool==="script"?"generate-script":"generate-brief";
          const params={...p,user_id:user.id,persona_id:selectedPersona?.id||null,
            product:p.product||p.niche||"iGaming",
            niche:p.niche||p.product||"iGaming",
            market:p.market||lang.toUpperCase()||"BR",
            platform:p.platform||"Meta Feed",
            tone:p.tone||"Aggressive / Urgent",
            count:p.count||5,
            context:p.context||p.angle||"",
            angle:p.angle||"",
          };
          return{...c,type:"tool_call" as const,_pendingTool:fn,_toolParams:params};
        }
        return c;
      });

      const aid=Date.now()+1;
      setMessages(prev=>[...prev,{role:"assistant",blocks,ts:aid,id:aid}]);
    }catch(e:any){
      const eid=Date.now()+1;
      setMessages(prev=>[...prev,{role:"assistant",ts:eid,id:eid,blocks:[{type:"warning",title:lang==="pt"?"Erro de conexão":"Connection error",content:e?.message||"Network error."}]}]);
    }finally{
      setLoading(false);
      setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),80);
    }
  };

  const SUGGS=SUGG[lang]||SUGG.en;
  const TOOLS=TOOLBAR[lang]||TOOLBAR.en;
  const hasData=connections.length>0;
  const metaConn=connections.includes("meta");

  const dashboardPlaceholder = lang==="pt"?"Diga qual dashboard quer — campanhas, criativos, ROAS...":lang==="es"?"Di qué dashboard quieres — campañas, creativos, ROAS...":"Say what dashboard you want — campaigns, creatives, ROAS...";

  const LABEL: Record<string,Record<string,string>>={
    pt:{clear:"Limpar",placeholder:activeTool==="dashboard"?dashboardPlaceholder:"Pergunte algo...",footer:"Somente performance de anúncios e inteligência criativa",connecting:"Conectando...",soon:"Em breve"},
    es:{clear:"Limpiar",placeholder:activeTool==="dashboard"?dashboardPlaceholder:"Pregunta algo...",footer:"Solo inteligencia de rendimiento publicitario",connecting:"Conectando...",soon:"Pronto"},
    en:{clear:"Clear",placeholder:activeTool==="dashboard"?dashboardPlaceholder:"Ask anything...",footer:"Strictly ad performance & creative intelligence",connecting:"Connecting...",soon:"Soon"},
  };
  const L=LABEL[lang]||LABEL.en;

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:"transparent",...j,overflow:"hidden"}}>

      {/* ── Messages ── */}
      <div style={{flex:1,overflowY:"auto",padding:"12px 0 8px"}}>
        
        {/* ── Persistent Account Alerts — survive chat clear ── */}
        {accountAlerts.length > 0 && (
          <div style={{maxWidth:720,margin:"0 auto 16px",padding:"0 16px",display:"flex",flexDirection:"column",gap:8}}>
            {accountAlerts.map((alert:any) => {
              const isHigh = alert.urgency === "high";
              const isDismissing = alertsDismissing.has(alert.id);
              return (
                <div key={alert.id} style={{
                  padding:"12px 14px",borderRadius:14,
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
                    <p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,color: isHigh ? "#f87171" : alert.type==="system" ? "rgba(14,165,233,0.8)" : "#fbbf24",textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"'DM Mono',monospace"}}>
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
                        {alert.campaign_name && <span style={{fontWeight:400,color:"rgba(238,240,246,0.4)",fontSize:11}}> · {alert.campaign_name}</span>}
                      </p>
                    )}
                    <p style={{margin:0,fontSize:12,color:"rgba(238,240,246,0.65)",lineHeight:1.5,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
                      {alert.detail}
                    </p>
                    <p style={{margin:"4px 0 0",fontSize:10,color:"rgba(238,240,246,0.3)",fontFamily:"'DM Mono',monospace"}}>
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
          <div style={{maxWidth:720,margin:"0 auto",paddingTop:24,padding:"24px 16px 0"}}>
            <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:16}}>
              <div style={{width:28,height:28,borderRadius:8,background:"rgba(14,165,233,0.10)",flexShrink:0,animation:"skPulse 1.4s ease-in-out infinite"}}/>
              <div style={{flex:1}}>
                <div style={{height:10,width:72,borderRadius:6,background:"rgba(255,255,255,0.06)",marginBottom:10,animation:"skPulse 1.4s ease-in-out infinite"}}/>
                <div style={{height:13,width:"90%",borderRadius:6,background:"rgba(255,255,255,0.05)",marginBottom:7,animation:"skPulse 1.4s 0.1s ease-in-out infinite"}}/>
                <div style={{height:13,width:"75%",borderRadius:6,background:"rgba(255,255,255,0.05)",marginBottom:7,animation:"skPulse 1.4s 0.2s ease-in-out infinite"}}/>
                <div style={{height:13,width:"55%",borderRadius:6,background:"rgba(255,255,255,0.04)",marginBottom:14,animation:"skPulse 1.4s 0.3s ease-in-out infinite"}}/>
                <div style={{display:"flex",gap:8}}>
                  {[96,84,88,78].map((w,i)=>(
                    <div key={i} style={{height:26,width:w,borderRadius:20,background:"rgba(255,255,255,0.04)",animation:`skPulse 1.4s ${i*0.12}s ease-in-out infinite`}}/>
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
              <div style={{textAlign:"center",padding:"32px 20px"}}>
                <div style={{width:52,height:52,borderRadius:14,background:"rgba(14,165,233,0.08)",border:"1px solid rgba(14,165,233,0.18)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
                  <Sparkles size={22} color="#0ea5e9"/>
                </div>
                <h3 style={{...j,fontSize:17,fontWeight:800,color:"#fff",margin:"0 0 8px",letterSpacing:"-0.02em"}}>
                  {lang==="pt"?"Conecte o Meta Ads para começar":lang==="es"?"Conecta Meta Ads para empezar":"Connect Meta Ads to start"}
                </h3>
                <p style={{...m,fontSize:13,color:"rgba(255,255,255,0.45)",lineHeight:1.6,margin:"0 0 22px",maxWidth:360,marginLeft:"auto",marginRight:"auto"}}>
                  {lang==="pt"?"A IA só responde com os seus dados reais. Sem a conexão, você recebe respostas genéricas que não ajudam.":lang==="es"?"La IA solo responde con tus datos reales. Sin la conexión recibes respuestas genéricas que no sirven.":"The AI only works with your real data. Without connection, you get generic answers that don't help."}
                </p>
                {selectedPersona ? (
                  <button onClick={()=>handleConnect("meta","meta-oauth")}
                    style={{...j,display:"inline-flex",alignItems:"center",gap:8,padding:"11px 22px",borderRadius:11,background:"linear-gradient(135deg,#1877F2,#0ea5e9)",color:"#fff",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,letterSpacing:"-0.01em",boxShadow:"0 0 24px rgba(14,165,233,0.25)"}}>
                    {PLATFORM_ICONS_INLINE.meta} {lang==="pt"?"Conectar Meta Ads":lang==="es"?"Conectar Meta Ads":"Connect Meta Ads"}
                  </button>
                ) : (
                  <button onClick={()=>navigate("/dashboard/accounts")}
                    style={{...j,display:"inline-flex",alignItems:"center",gap:8,padding:"11px 22px",borderRadius:11,background:"rgba(255,255,255,0.08)",color:"#fff",border:"1px solid rgba(255,255,255,0.12)",cursor:"pointer",fontSize:13,fontWeight:700,letterSpacing:"-0.01em"}}>
                    {lang==="pt"?"Criar conta primeiro →":lang==="es"?"Crear cuenta primero →":"Create account first →"}
                  </button>
                )}
                <p style={{...m,fontSize:11,color:"rgba(255,255,255,0.2)",marginTop:14}}>
                  {lang==="pt"?"Leva 30 segundos":lang==="es"?"30 segundos":"30 seconds"}
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* Inline tool panel */}
        {activeTool&&activeTool!=="upload"&&(
          <div style={{maxWidth:620,margin:"0 auto 4px"}}>
            <InlineToolPanel action={activeTool} onClose={()=>setActiveTool(null)} onSend={send} lang={lang}/>
          </div>
        )}

        {messages.map((msg)=>(
          <div key={msg.id} style={{maxWidth:720,margin:"0 auto 14px",padding:"0 16px"}}>
            {msg.role==="user"?(
              <div style={{display:"flex",justifyContent:"flex-end"}}>
                <div style={{padding:"10px 14px",borderRadius:"14px 14px 4px 14px",background:"rgba(14,165,233,0.12)",border:"1px solid rgba(14,165,233,0.2)",fontSize:13,color:"rgba(255,255,255,0.85)",...j,maxWidth:"82%",lineHeight:1.55}}>
                  {msg.userText}
                </div>
              </div>
            ):(
              <div>
                {/* AI dot — minimal sender indicator */}
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:"rgba(14,165,233,0.5)",flexShrink:0}}/>
                </div>
                {/* Blocks */}
                {msg.blocks?.map((b,bi)=>
                  b.type==="dashboard"?<DashboardBlock key={bi} block={b}/>:
                  b.type==="meta_action"?<ConfirmActionBlock key={bi} block={b} lang={lang} onConfirm={executeMetaAction}/>:
                  b.type==="dashboard_offer"?<DashboardOfferBlock key={bi} block={b} lang={lang} onConfirm={(msg)=>send(msg)}/>:
                  (b.type as string)==="proactive"?<ProactiveBlock key={bi} block={b} lang={lang} onSend={send}/>:
                  (b as any)._pendingTool?null:
                  <BlockCard key={bi} block={b} lang={lang} onNavigate={handleNavigate}/>
                )}
                {/* 👍 👎 Copy Retry row — hidden for proactive messages */}
                {!(msg.blocks?.length === 1 && (msg.blocks[0].type as string) === "proactive") && (
                <div style={{display:"flex",alignItems:"center",gap:5,marginTop:5}}>
                  <button onClick={()=>handleFeedback(msg.id,"like",msg.blocks||[])}
                    style={{display:"flex",alignItems:"center",justifyContent:"center",width:26,height:24,borderRadius:6,background:feedback[msg.id]==="like"?"rgba(52,211,153,0.1)":"transparent",border:`1px solid ${feedback[msg.id]==="like"?"rgba(52,211,153,0.3)":"rgba(255,255,255,0.10)"}`,cursor:"pointer",color:feedback[msg.id]==="like"?"#34d399":"rgba(255,255,255,0.35)",transition:"all 0.12s"}}>
                    <ThumbsUp size={11}/>
                  </button>
                  <button onClick={()=>handleFeedback(msg.id,"dislike",msg.blocks||[])}
                    style={{display:"flex",alignItems:"center",justifyContent:"center",width:26,height:24,borderRadius:6,background:feedback[msg.id]==="dislike"?"rgba(248,113,113,0.1)":"transparent",border:`1px solid ${feedback[msg.id]==="dislike"?"rgba(248,113,113,0.3)":"rgba(255,255,255,0.10)"}`,cursor:"pointer",color:feedback[msg.id]==="dislike"?"#f87171":"rgba(255,255,255,0.35)",transition:"all 0.12s"}}>
                    <ThumbsDown size={11}/>
                  </button>
                  <button onClick={()=>handleCopy(msg.id,msg.blocks||[])}
                    style={{display:"flex",alignItems:"center",gap:4,height:24,padding:"0 8px",borderRadius:6,background:"transparent",border:"1px solid rgba(255,255,255,0.07)",cursor:"pointer",color:"rgba(255,255,255,0.35)",fontSize:10,...m,transition:"all 0.12s"}}>
                    <Copy size={10}/>{copiedId===msg.id?"✓":"Copy"}
                  </button>
                  <button onClick={()=>send(messages[messages.indexOf(msg)-1]?.userText||"")}
                    style={{display:"flex",alignItems:"center",gap:4,height:24,padding:"0 8px",borderRadius:6,background:"transparent",border:"1px solid rgba(255,255,255,0.07)",cursor:"pointer",color:"rgba(255,255,255,0.35)",fontSize:10,...m,transition:"all 0.12s"}}>
                    <RefreshCw size={10}/>Retry
                  </button>
                </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading&&<ThinkingIndicator lang={lang} variant="chat"/>}
        {!loading&&messages.some(m=>m.blocks?.some(b=>(b as any)._pendingTool))&&(
          <ThinkingIndicator lang={lang} variant="chat" label={(() => {
              const lastMsg = (messages.filter(m=>m.role==="user").slice(-1)[0]?.userText||"").toLowerCase();
              if(lastMsg.includes("hook")||lastMsg.includes("gancho")) return lang==="pt"?"Gerando hooks...":lang==="es"?"Generando hooks...":"Generating hooks...";
              if(lastMsg.includes("roteiro")||lastMsg.includes("script")||lastMsg.includes("guión")) return lang==="pt"?"Escrevendo roteiro...":lang==="es"?"Escribiendo guión...":"Writing script...";
              if(lastMsg.includes("pausa")||lastMsg.includes("pause")||lastMsg.includes("escal")) return lang==="pt"?"Verificando dados ao vivo...":lang==="es"?"Verificando datos...":"Checking live data...";
              if(lastMsg.includes("roas")||lastMsg.includes("ctr")||lastMsg.includes("cpm")||lastMsg.includes("perform")) return lang==="pt"?"Analisando performance...":lang==="es"?"Analizando rendimiento...":"Analyzing performance...";
              if(lastMsg.includes("camp")||lastMsg.includes("anunc")) return lang==="pt"?"Lendo campanhas...":lang==="es"?"Leyendo campañas...":"Reading campaigns...";
              return lang==="pt"?"Pensando...":lang==="es"?"Pensando...":"Thinking...";
            })()}/>
        )}
        <div ref={bottomRef} style={{height:8}}/>
      </div>

      {/* ── Input area ── */}
      <div style={{padding:"8px 0 12px",flexShrink:0}}>
        <div style={{maxWidth:720,margin:"0 auto",padding:"0 16px",borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:10}}>
          {/* Input row: [textarea] [clear] [send] */}
          <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
            <textarea ref={textareaRef} value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
              placeholder={L.placeholder} rows={1}
              style={{flex:1,background:"#1a2032",border:"1px solid rgba(255,255,255,0.10)",borderRadius:14,padding:"11px 14px",color:"#fff",fontSize:13,resize:"none",outline:"none",...m,lineHeight:1.5,minHeight:42,maxHeight:120}} className="chat-textarea"
              onInput={e=>{const t=e.target as HTMLTextAreaElement;t.style.height="auto";t.style.height=Math.min(t.scrollHeight,120)+"px";}}
              onFocus={e=>{e.currentTarget.style.borderColor="rgba(14,165,233,0.3)";}}
              onBlur={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";}}
            />
            {messages.length>0&&(
              <button onClick={()=>{setMessages([]);sessionStorage.removeItem(SK);proactiveFired.current=false;setGreetingKey(k=>k+1);}} title={lang==="pt"?"Limpar conversa":lang==="es"?"Limpiar chat":"Clear chat"}
                style={{width:42,height:42,borderRadius:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s",color:"rgba(255,255,255,0.25)"}}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.08)";(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.55)";}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.04)";(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.25)";}}>
                <RotateCcw size={14}/>
              </button>
            )}
            <button onClick={()=>send()} disabled={!input.trim()||loading||!contextReady||!hasData}
              style={{width:42,height:42,borderRadius:12,background:input.trim()&&!loading&&hasData?"linear-gradient(135deg,#0ea5e9,#6366f1)":"rgba(255,255,255,0.05)",border:"none",cursor:input.trim()&&!loading&&hasData?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s"}}>
              {loading?<Loader2 size={15} color="#0ea5e9" className="animate-spin"/>:<Send size={15} color={input.trim()&&hasData?"#fff":"rgba(255,255,255,0.2)"}/>}
            </button>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes pulse{0%,100%{transform:scale(1);opacity:0.4}50%{transform:scale(1.4);opacity:1}}
        @keyframes toolSlideIn{from{opacity:0;transform:translateY(10px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @media(max-width:640px){
          .chat-footer-hint{display:none!important}
          textarea::placeholder{font-size:12px!important;opacity:0.35!important}
        }
        .chat-textarea::placeholder{color:rgba(255,255,255,0.22)!important}
      `}</style>

      {showUpgradeWall&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <UpgradeWall trigger="chat" onClose={()=>setShowUpgradeWall(false)}/>
        </div>
      )}
      {showDashboardLimit&&<DashboardLimitPopup lang={lang} onClose={()=>setShowDashboardLimit(false)}/>}
    </div>
  );
}
